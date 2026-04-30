const { verifyJWS } = require('../utils/jwsSigner')
const sequelize = require('../config/database')
const { Op } = require('sequelize')
const { Item, Bin, Lot, PurchaseOrder, PurchaseOrderLine, SalesOrder, SalesOrderLine, Transaction, ScanLog, ScannerBenchmark } = require('../models')

const toFiniteNumber = (value, fallback = null) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const toInteger = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback
}

const parseDateOrNull = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const getRequestIp = (req) => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || null
}

const parseScannedPayload = async (raw) => {
  // 解析JWS
  let parsedData = null
  try {
    const verification = await verifyJWS(raw)
    if (!verification.valid) {
      throw new Error(verification.error || 'JWS验证失败')
    }
    parsedData = verification.payload
  } catch (error) {
    // 忽略 JWS 解析失败，继续尝试 JSON / 条码
  }

  if (!parsedData) {
    try {
      parsedData = JSON.parse(raw)
      if (!parsedData || typeof parsedData !== 'object' || !parsedData.type) {
        parsedData = { type: 'ITEM', id: raw.toString().trim() }
      }
    } catch (parseError) {
      const normalized = raw.toString().trim()
      const lotMatch = normalized.match(/^LOT:([^;]+)(?:;SKU:(.+))?$/i)
      const binMatch = normalized.match(/^BIN:([^;]+)(?:;ZONE:(.+))?$/i)
      const itemMatch = normalized.match(/^ITEM:(.+)$/i)

      if (lotMatch) {
        parsedData = {
          type: 'LOT',
          id: lotMatch[1].trim(),
          sku: lotMatch[2]?.trim() || undefined
        }
      } else if (binMatch) {
        parsedData = {
          type: 'BIN',
          id: binMatch[1].trim(),
          zone: binMatch[2]?.trim() || undefined
        }
      } else if (itemMatch) {
        parsedData = {
          type: 'ITEM',
          id: itemMatch[1].trim()
        }
      } else {
        parsedData = { type: 'ITEM', id: normalized }
      }
    }
  }

  return parsedData
}

const routeParsedScan = async (parsedData, user) => {
  switch (parsedData.type) {
    case 'LOT':
      return handleLotScan(parsedData, user)
    case 'BIN':
      return handleBinScan(parsedData, user)
    case 'ITEM':
      return handleItemScan(parsedData, user)
    case 'TASK':
      return handleTaskScan(parsedData, user)
    case 'PO':
      return handlePOScan(parsedData, user)
    case 'SO':
      return handleSOScan(parsedData, user)
    default:
      throw new Error(`不支持的标签类型: ${parsedData.type}`)
  }
}

const serializeRecentTransactions = async (whereClause, limit = 6) => {
  const transactions = await Transaction.findAll({
    where: whereClause,
    order: [['transactionTime', 'DESC']],
    limit
  })

  return transactions.map((transaction) => ({
    id: transaction.id,
    type: typeof transaction.notes === 'string' && transaction.notes.startsWith('BIN_TRANSFER:')
      ? 'MOVE'
      : transaction.transactionType === 'in'
        ? 'INBOUND'
        : 'OUTBOUND',
    quantity: Number(transaction.quantity || 0),
    location: transaction.location || '-',
    operator: transaction.operator || '-',
    note: transaction.notes || transaction.customer || transaction.supplier || '',
    time: transaction.transactionTime || transaction.createdAt
  }))
}

const ensureBinForMovement = async (binCode, userId, transaction) => {
  const normalizedBinCode = String(binCode || '').trim()

  if (!normalizedBinCode) {
    throw new Error('Target bin cannot be empty.')
  }

  let bin = await Bin.findOne({
    where: { bin_code: normalizedBinCode },
    transaction
  })

  if (!bin) {
    bin = await Bin.create({
      bin_code: normalizedBinCode,
      zone: 'Zone A',
      capacity: 1000,
      temperature_zone: /fridge|refrigerator|cold|冰箱/i.test(normalizedBinCode) ? 'COLD' : 'AMBIENT',
      created_by: userId
    }, { transaction })
  }

  return bin
}

const buildTransferLotNumber = async (sourceLotNumber, transaction) => {
  let index = 1

  while (index < 1000) {
    const suffix = `-MV${index}`
    const trimmedSource = sourceLotNumber.slice(0, 100 - suffix.length)
    const candidate = `${trimmedSource}${suffix}`

    const existingLot = await Lot.findOne({
      where: { lot_number: candidate },
      attributes: ['id'],
      transaction
    })

    if (!existingLot) {
      return candidate
    }

    index += 1
  }

    throw new Error('Unable to generate a new lot number for the split move. Please try again.')
}

const buildItemInquiry = async (sku) => {
  const item = await Item.findOne({
    where: { sku },
    include: [{
      model: Lot,
      as: 'lots',
      required: false,
      include: [{
        model: Bin,
        as: 'bin',
        attributes: ['bin_code', 'zone']
      }]
    }]
  })

  if (!item) {
    throw new Error(`Item ${sku} does not exist.`)
  }

  const activeLots = (item.lots || []).filter((lot) => lot.status === 'ACTIVE')
  const totalQty = activeLots.reduce((sum, lot) => sum + Number(lot.qty || 0), 0)
  const uniqueBins = new Set(activeLots.map((lot) => lot.bin?.bin_code).filter(Boolean))

  return {
    entityType: 'ITEM',
    title: item.name,
    subtitle: `SKU ${item.sku}`,
    summary: [
      { label: 'Available Qty', value: `${totalQty} ${item.uom || 'pcs'}`, tone: totalQty <= Number(item.min_stock || 0) ? 'danger' : 'ok' },
      { label: 'Active Lots', value: String(activeLots.length), tone: activeLots.length > 0 ? 'ok' : 'soft' },
      { label: 'Bins', value: String(uniqueBins.size), tone: uniqueBins.size > 0 ? 'ok' : 'soft' },
      { label: 'Min Stock', value: String(Number(item.min_stock || 0)), tone: 'neutral' }
    ],
    meta: [
      { label: 'Category', value: item.category || '-' },
      { label: 'Status', value: item.status || '-' },
      { label: 'Updated', value: item.updatedAt }
    ],
    lots: activeLots.map((lot) => ({
      id: lot.id,
      lot_number: lot.lot_number,
      sku: lot.sku,
      qty: Number(lot.qty || 0),
      uom: lot.uom || item.uom || 'pcs',
      status: lot.status,
      bin_code: lot.bin?.bin_code || '-',
      expiry_date: lot.expiry_date,
      createdAt: lot.createdAt
    })),
    recentTransactions: await serializeRecentTransactions({ itemCode: item.sku })
  }
}

const buildLotInquiry = async (lotNumber, skuHint) => {
  const whereClause = { lot_number: lotNumber }
  if (skuHint) {
    whereClause.sku = skuHint
  }

  const lot = await Lot.findOne({
    where: whereClause,
    include: [
      { model: Item, as: 'item' },
      { model: Bin, as: 'bin', attributes: ['bin_code', 'zone'] }
    ]
  })

  if (!lot) {
    throw new Error(`Lot ${lotNumber} does not exist.`)
  }

  return {
    entityType: 'LOT',
    title: lot.lot_number,
    subtitle: `SKU ${lot.sku}`,
    summary: [
      { label: 'Current Qty', value: `${Number(lot.qty || 0)} ${lot.uom || lot.item?.uom || 'pcs'}`, tone: Number(lot.qty || 0) > 0 ? 'ok' : 'soft' },
      { label: 'Bin', value: lot.bin?.bin_code || '-', tone: lot.bin?.bin_code ? 'ok' : 'soft' },
      { label: 'Quality', value: lot.quality_status || '-', tone: lot.quality_status === 'FAILED' ? 'danger' : 'neutral' },
      { label: 'Status', value: lot.status || '-', tone: lot.status === 'ACTIVE' ? 'ok' : 'soft' }
    ],
    meta: [
      { label: 'Item', value: lot.item?.name || lot.sku },
      { label: 'Expiry', value: lot.expiry_date || '-' },
      { label: 'Supplier', value: lot.supplier || '-' }
    ],
    lots: [{
      id: lot.id,
      lot_number: lot.lot_number,
      sku: lot.sku,
      qty: Number(lot.qty || 0),
      uom: lot.uom || lot.item?.uom || 'pcs',
      status: lot.status,
      bin_code: lot.bin?.bin_code || '-',
      expiry_date: lot.expiry_date
    }],
    recentTransactions: await serializeRecentTransactions({ itemCode: lot.sku })
  }
}

const buildBinInquiry = async (binCode) => {
  const bin = await Bin.findOne({
    where: { bin_code: binCode },
    include: [{
      model: Lot,
      as: 'lots',
      required: false,
      include: [{
        model: Item,
        as: 'item',
        attributes: ['sku', 'name', 'uom']
      }]
    }]
  })

  if (!bin) {
    throw new Error(`Bin ${binCode} does not exist.`)
  }

  const activeLots = (bin.lots || []).filter((lot) => lot.status === 'ACTIVE')
  const used = activeLots.reduce((sum, lot) => sum + Number(lot.qty || 0), 0)
  const utilization = Number(bin.capacity || 0) > 0 ? Math.round((used / Number(bin.capacity || 0)) * 100) : 0
  const uniqueItems = new Set(activeLots.map((lot) => lot.sku).filter(Boolean))

  return {
    entityType: 'BIN',
    title: bin.bin_code,
    subtitle: `${bin.zone || 'Unknown Zone'} storage bin`,
    summary: [
      { label: 'Used', value: `${used} / ${Number(bin.capacity || 0)}`, tone: utilization >= 90 ? 'danger' : 'ok' },
      { label: 'Utilization', value: `${utilization}%`, tone: utilization >= 90 ? 'danger' : utilization >= 60 ? 'neutral' : 'ok' },
      { label: 'Lots', value: String(activeLots.length), tone: activeLots.length > 0 ? 'ok' : 'soft' },
      { label: 'Items', value: String(uniqueItems.size), tone: uniqueItems.size > 0 ? 'ok' : 'soft' }
    ],
    meta: [
      { label: 'Zone', value: bin.zone || '-' },
      { label: 'Temperature', value: bin.temperature_zone || '-' },
      { label: 'Status', value: bin.status || '-' }
    ],
    lots: activeLots.map((lot) => ({
      id: lot.id,
      lot_number: lot.lot_number,
      sku: lot.sku,
      item_name: lot.item?.name || lot.sku,
      qty: Number(lot.qty || 0),
      uom: lot.uom || lot.item?.uom || 'pcs',
      status: lot.status,
      bin_code: bin.bin_code,
      expiry_date: lot.expiry_date
    })),
    recentTransactions: await serializeRecentTransactions({
      location: {
        [Op.like]: `%${bin.bin_code}%`
      }
    })
  }
}

const buildInventoryInquiry = async (parsedData) => {
  switch (parsedData.type) {
    case 'ITEM':
      return buildItemInquiry(parsedData.id)
    case 'LOT':
      return buildLotInquiry(parsedData.id, parsedData.sku)
    case 'BIN':
      return buildBinInquiry(parsedData.id)
    default:
      throw new Error(`${parsedData.type} 类型暂不支持库存查询`)
  }
}

// 统一的扫码入口
const handleScan = async (req, res) => {
  try {
    const { raw, device = 'unknown' } = req.body
    const userId = req.user?.id || 'unknown'

    if (!raw) {
      return res.status(400).json({
        success: false,
        message: '缺少扫码内容'
      })
    }

    // 记录扫码日志
    await ScanLog.create({
      raw_content: raw,
      scan_type: 'VERIFY',
      user_id: userId,
      device_id: device,
      success: false,
      transaction_time: new Date()
    })

    const parsedData = await parseScannedPayload(raw)
    const result = await routeParsedScan(parsedData, req.user)

    // 更新扫码日志为成功
    await ScanLog.update({
      parsed_type: parsedData.type,
      parsed_id: parsedData.id || parsedData.task || parsedData.sku,
      parsed_data: JSON.stringify(parsedData),
      success: true
    }, {
      where: { raw_content: raw }
    })

    res.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('扫码处理失败:', error)

    // 更新扫码日志为失败
    if (req.body.raw) {
      await ScanLog.update({
        success: false,
        error_message: error.message
      }, {
        where: { raw_content: req.body.raw }
      })
    }

    res.status(500).json({
      success: false,
      message: '扫码处理失败',
      error: error.message
    })
  }
}

const recordScannerBenchmark = async (req, res) => {
  try {
    const body = req.body || {}
    const sessionId = String(body.id || body.sessionId || '').trim()

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing scanner benchmark session id.'
      })
    }

    const rawContent = body.rawData == null ? '' : String(body.rawData)
    const completedAt = parseDateOrNull(body.completedAtIso || body.completedAt)
    const startedAt = parseDateOrNull(body.startedAt)

    await ScannerBenchmark.upsert({
      session_id: sessionId,
      mode: String(body.mode || 'camera').slice(0, 30),
      status: String(body.status || 'unknown').slice(0, 40),
      label_type: String(body.labelType || 'UNKNOWN').slice(0, 40),
      raw_content: rawContent ? rawContent.slice(0, 4000) : null,
      raw_length: rawContent.length,
      device_id: body.deviceId ? String(body.deviceId).slice(0, 160) : null,
      device_label: body.deviceLabel ? String(body.deviceLabel).slice(0, 240) : null,
      user_id: req.user?.id || null,
      user_name: req.user?.username || req.user?.email || null,
      user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
      ip_address: getRequestIp(req),
      started_at: startedAt,
      completed_at: completedAt || new Date(),
      lock_ms: toInteger(body.lockMs, null),
      first_frame_ms: toInteger(body.firstFrameMs, null),
      decode_attempts: toInteger(body.decodeAttempts, 0),
      frame_samples: toInteger(body.frameSamples, 0),
      avg_frame_score: toFiniteNumber(body.avgFrameScore),
      best_frame_score: toFiniteNumber(body.bestFrameScore),
      worst_frame_score: toFiniteNumber(body.worstFrameScore),
      avg_brightness: toFiniteNumber(body.avgBrightness),
      low_light_frames: toInteger(body.lowLightFrames, 0),
      blurry_frames: toInteger(body.blurryFrames, 0),
      decode_path: body.decodePath ? String(body.decodePath).slice(0, 120) : null,
      decoded_format: body.decodedFormat ? String(body.decodedFormat).slice(0, 80) : null,
      decode_engine: body.decodeEngine ? String(body.decodeEngine).slice(0, 80) : null,
      fill_ratio: toFiniteNumber(body.fillRatio),
      scenario_tags: Array.isArray(body.scenarioTags) ? body.scenarioTags.slice(0, 12) : [],
      payload: body
    })

    return res.json({
      success: true,
      message: 'Scanner benchmark recorded.'
    })
  } catch (error) {
    console.error('Scanner benchmark save failed:', error)
    return res.status(500).json({
      success: false,
      message: 'Scanner benchmark save failed.',
      error: error.message
    })
  }
}

const summarizeBy = (rows, key) => {
  const groups = new Map()

  rows.forEach((row) => {
    const label = row[key] || 'UNKNOWN'
    const current = groups.get(label) || {
      label,
      total: 0,
      success: 0,
      lockTotal: 0,
      lockSamples: 0
    }

    current.total += 1
    if (row.status === 'success') {
      current.success += 1
      if (Number.isFinite(Number(row.lock_ms))) {
        current.lockTotal += Number(row.lock_ms)
        current.lockSamples += 1
      }
    }

    groups.set(label, current)
  })

  return Array.from(groups.values())
    .map((group) => ({
      label: group.label,
      total: group.total,
      success: group.success,
      successRate: group.total ? group.success / group.total : 0,
      avgLockMs: group.lockSamples ? Math.round(group.lockTotal / group.lockSamples) : null
    }))
    .sort((a, b) => b.total - a.total)
}

const summarizeScenarioTags = (rows) => {
  const groups = new Map()

  rows.forEach((row) => {
    const tags = Array.isArray(row.scenario_tags) ? row.scenario_tags : []

    tags.forEach((tag) => {
      const label = String(tag || '').trim()
      if (!label) return

      const current = groups.get(label) || {
        label,
        total: 0,
        success: 0,
        lockTotal: 0,
        lockSamples: 0
      }

      current.total += 1
      if (row.status === 'success') {
        current.success += 1
        if (Number.isFinite(Number(row.lock_ms))) {
          current.lockTotal += Number(row.lock_ms)
          current.lockSamples += 1
        }
      }

      groups.set(label, current)
    })
  })

  return Array.from(groups.values())
    .map((group) => ({
      label: group.label,
      total: group.total,
      success: group.success,
      successRate: group.total ? group.success / group.total : 0,
      avgLockMs: group.lockSamples ? Math.round(group.lockTotal / group.lockSamples) : null
    }))
    .sort((a, b) => b.total - a.total)
}

const getScannerBenchmarkSummary = async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days || 14), 1), 90)
    const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000))

    const rows = await ScannerBenchmark.findAll({
      where: {
        completed_at: {
          [Op.gte]: since
        }
      },
      order: [['completed_at', 'DESC']],
      limit: 1000
    })

    const plainRows = rows.map((row) => row.toJSON())
    const successfulRows = plainRows.filter((row) => row.status === 'success')
    const lockRows = successfulRows.filter((row) => Number.isFinite(Number(row.lock_ms)))
    const firstFrameRows = plainRows.filter((row) => Number.isFinite(Number(row.first_frame_ms)))
    const totalLockMs = lockRows.reduce((sum, row) => sum + Number(row.lock_ms), 0)
    const totalFirstFrameMs = firstFrameRows.reduce((sum, row) => sum + Number(row.first_frame_ms), 0)

    return res.json({
      success: true,
      data: {
        days,
        total: plainRows.length,
        success: successfulRows.length,
        successRate: plainRows.length ? successfulRows.length / plainRows.length : 0,
        avgLockMs: lockRows.length ? Math.round(totalLockMs / lockRows.length) : null,
        avgFirstFrameMs: firstFrameRows.length ? Math.round(totalFirstFrameMs / firstFrameRows.length) : null,
        byLabelType: summarizeBy(plainRows, 'label_type'),
        byMode: summarizeBy(plainRows, 'mode'),
        byDecodeEngine: summarizeBy(plainRows, 'decode_engine'),
        byDecodedFormat: summarizeBy(plainRows, 'decoded_format'),
        byScenarioTag: summarizeScenarioTags(plainRows),
        recent: plainRows.slice(0, 20).map((row) => ({
          id: row.id,
          sessionId: row.session_id,
          mode: row.mode,
          status: row.status,
          labelType: row.label_type,
          lockMs: row.lock_ms,
          firstFrameMs: row.first_frame_ms,
          avgFrameScore: row.avg_frame_score,
          avgBrightness: row.avg_brightness,
          fillRatio: row.fill_ratio,
          decodedFormat: row.decoded_format,
          decodeEngine: row.decode_engine,
          decodePath: row.decode_path,
          scenarioTags: row.scenario_tags || [],
          completedAt: row.completed_at
        }))
      }
    })
  } catch (error) {
    console.error('Scanner benchmark summary failed:', error)
    return res.status(500).json({
      success: false,
      message: 'Scanner benchmark summary failed.',
      error: error.message
    })
  }
}

const getInventoryInquiry = async (req, res) => {
  try {
    const { raw } = req.body

    if (!raw) {
      return res.status(400).json({
        success: false,
        message: '缺少扫码内容'
      })
    }

    const parsedData = await parseScannedPayload(raw)
    const inquiry = await buildInventoryInquiry(parsedData)

    return res.json({
      success: true,
      data: inquiry
    })
  } catch (error) {
    console.error('库存查询失败:', error)
    return res.status(400).json({
      success: false,
      message: error.message || '库存查询失败',
      error: error.message
    })
  }
}

// 处理批次标签扫码
const handleLotScan = async (data, user) => {
  const { id: lotNumber, sku } = data

  // 查找批次信息
  const lot = await Lot.findOne({
    where: { lot_number: lotNumber },
    include: [
      { model: Item, as: 'item' },
      { model: Bin, as: 'bin' }
    ]
  })

  if (!lot) {
    return {
      action: 'CREATE_LOT',
      message: 'Lot not found. A new lot needs to be created.',
      data: { lot_number: lotNumber, sku }
    }
  }

  return {
    action: 'SHOW_LOT_INFO',
    message: 'Lot details',
    data: {
      lot: lot,
      actions: ['INBOUND', 'OUTBOUND', 'MOVE', 'COUNT']
    }
  }
}

// 处理库位标签扫码
const handleBinScan = async (data, user) => {
  const { id: binCode } = data

  const bin = await Bin.findOne({
    where: { bin_code: binCode },
    include: [
      { model: Lot, as: 'lots' }
    ]
  })

  if (!bin) {
    return {
      action: 'CREATE_BIN',
      message: 'Bin not found. A new bin needs to be created.',
      data: { bin_code: binCode }
    }
  }

  return {
    action: 'SHOW_BIN_INFO',
    message: 'Bin details',
    data: {
      bin: bin,
      actions: ['VIEW_CONTENTS', 'MOVE_ITEMS', 'COUNT']
    }
  }
}

// 处理物料标签扫码
const handleItemScan = async (data, user) => {
  const { id: sku } = data

  const item = await Item.findOne({
    where: { sku: sku },
    include: [
      {
        model: Lot,
        as: 'lots',
        include: [
          {
            model: Bin,
            as: 'bin',
            attributes: ['bin_code', 'zone']
          }
        ]
      }
    ]
  })

  if (!item) {
    // 触发 Fallback: 级联查询 Open Food Facts JP/World 数据库
    let externalData = null
    try {
      console.log(`[API Lookup] Identifying JAN/EAN code: ${sku}`)
      // 优先从日本节点获取更精准的名字和品牌
      const apiUrl = `https://jp.openfoodfacts.org/api/v2/product/${sku}?fields=product_name,product_name_ja,brands,brands_ja,categories_en,image_url`
      const response = await fetch(apiUrl, {
          headers: { 'User-Agent': 'PilotInventorySystem/1.0 (lab-pilot-test)' }
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.status === 1 && result.product) {
          const p = result.product
          externalData = {
            barcode: sku,
            name: p.product_name_ja || p.product_name || '',
            brand: p.brands_ja || p.brands || '',
            category: p.categories_en ? p.categories_en.split(',')[0].trim() : 'Beverages',
            image_url: p.image_url || ''
          }
        }
      }
    } catch (apiError) {
      console.error('Failed to fetch from Open Food Facts API:', apiError)
    }

    return {
      action: 'CREATE_ITEM',
      message: externalData ? `🎉 Found a cloud match for ${externalData.name}. Ready for quick item creation.` : 'No cloud match was found. Please create the item manually.',
      data: {
        sku: sku,
        external_data: externalData // 将拿到的外部数据一并传给前端
      }
    }
  }

  return {
    action: 'SHOW_ITEM_INFO',
    message: 'Item details',
    data: {
      item: item,
      actions: ['VIEW_STOCK', 'INBOUND', 'CREATE_LOT', 'MOVE']
    }
  }
}

// 处理任务标签扫码
const handleTaskScan = async (data, user) => {
  const { task: taskId, task_type, so_number, po_number } = data

  if (task_type === 'PICKING') {
    // 拣选任务
    const so = await SalesOrder.findOne({
      where: { so_number: so_number },
      include: [
        { model: SalesOrderLine, as: 'lines' }
      ]
    })

    if (!so) {
      throw new Error('销售订单不存在')
    }

    return {
      action: 'PICKING_TASK',
      message: '拣选任务',
      data: {
        task_id: taskId,
        sales_order: so,
        actions: ['START_PICKING', 'COMPLETE_PICKING']
      }
    }
  } else if (task_type === 'RECEIVING') {
    // 收货任务
    const po = await PurchaseOrder.findOne({
      where: { po_number: po_number },
      include: [
        { model: PurchaseOrderLine, as: 'lines' }
      ]
    })

    if (!po) {
      throw new Error('采购订单不存在')
    }

    return {
      action: 'RECEIVING_TASK',
      message: '收货任务',
      data: {
        task_id: taskId,
        purchase_order: po,
        actions: ['START_RECEIVING', 'COMPLETE_RECEIVING']
      }
    }
  }

  throw new Error('未知的任务类型')
}

// 处理采购订单扫码
const handlePOScan = async (data, user) => {
  const { id: poNumber } = data

  const po = await PurchaseOrder.findOne({
    where: { po_number: poNumber },
    include: [
      { model: PurchaseOrderLine, as: 'lines' }
    ]
  })

  if (!po) {
    throw new Error('采购订单不存在')
  }

  return {
    action: 'SHOW_PO_INFO',
    message: '采购订单信息',
    data: {
      purchase_order: po,
      actions: ['PRINT_LABELS', 'START_RECEIVING', 'VIEW_DETAILS']
    }
  }
}

// 处理销售订单扫码
const handleSOScan = async (data, user) => {
  const { id: soNumber } = data

  const so = await SalesOrder.findOne({
    where: { so_number: soNumber },
    include: [
      { model: SalesOrderLine, as: 'lines' }
    ]
  })

  if (!so) {
    throw new Error('销售订单不存在')
  }

  return {
    action: 'SHOW_SO_INFO',
    message: '销售订单信息',
    data: {
      sales_order: so,
      actions: ['PRINT_LABELS', 'START_PICKING', 'VIEW_DETAILS']
    }
  }
}

// 执行入库操作
const executeInbound = async (req, res) => {
  const transaction = await sequelize.transaction()

  try {
    const { lot_number, sku, qty, bin_code, po_number, expiry_date } = req.body
    const userId = req.user?.id || 'unknown'
    const parsedQty = Number(qty)

    if (!lot_number || !sku) {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: 'lot_number and sku are required.'
      })
    }

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: 'Inbound quantity must be greater than 0.'
      })
    }

    const item = await Item.findOne({
      where: { sku },
      transaction
    })

    if (!item) {
      await transaction.rollback()
      return res.status(404).json({
        success: false,
        message: `Item ${sku} does not exist yet. Please create it first.`
      })
    }

    let bin = null
    if (bin_code) {
      bin = await Bin.findOne({
        where: { bin_code },
        transaction
      })

      if (!bin) {
        bin = await Bin.create({
          bin_code,
        zone: 'Zone A',
          capacity: 1000,
          created_by: userId
        }, { transaction })
      }
    }

    // 创建或更新批次
    let lot = await Lot.findOne({
      where: { lot_number, sku },
      transaction
    })
    const normalizedExpiryDate = expiry_date ? new Date(expiry_date) : null

    if (expiry_date && Number.isNaN(normalizedExpiryDate.getTime())) {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: 'Expiry date is invalid.'
      })
    }

    if (!lot) {
      if (!bin) {
        await transaction.rollback()
        return res.status(400).json({
          success: false,
          message: 'A target bin is required when creating a new lot.'
        })
      }

      lot = await Lot.create({
        lot_number,
        sku,
        qty: 0,
        uom: 'pcs',
        bin_id: bin.id,
        expiry_date: normalizedExpiryDate,
        created_by: userId
      }, { transaction })
    }

    // 更新数量
    await lot.update({
      qty: lot.qty + parsedQty,
      ...(bin ? { bin_id: bin.id } : {}),
      ...(normalizedExpiryDate ? { expiry_date: normalizedExpiryDate } : {})
    }, { transaction })

    // 记录交易
    await Transaction.create({
      transactionType: 'in',
      itemCode: sku,
      itemName: item.name || sku,
      quantity: parsedQty,
      beforeQuantity: lot.qty - parsedQty,
      afterQuantity: lot.qty,
      operator: req.user?.username || 'unknown',
      operatorId: userId,
      location: bin_code,
      supplier: po_number ? `PO: ${po_number}` : 'unknown',
      transactionTime: new Date()
    }, { transaction })

    await transaction.commit()

    res.json({
      success: true,
      message: 'Inbound completed successfully.',
      data: {
        lot: lot,
        transaction: {
          type: 'INBOUND',
          qty: parsedQty,
          total_qty: lot.qty
        }
      }
    })

  } catch (error) {
    await transaction.rollback()
    console.error('入库操作失败:', error)
    res.status(500).json({
      success: false,
      message: 'Inbound failed.',
      error: error.message
    })
  }
}

// 执行出库操作
const executeOutbound = async (req, res) => {
  const transaction = await sequelize.transaction()

  try {
    const { lot_number, sku, qty, so_number, source_bin_code, strategy } = req.body
    const userId = req.user?.id || 'unknown'
    const operatorName = req.user?.username || 'unknown'
    const parsedQty = Number(qty)
    const normalizedStrategy = String(strategy || '').trim().toUpperCase()

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: 'Outbound quantity must be greater than 0.'
      })
    }

    if (!sku) {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: 'sku is required.'
      })
    }

    if (normalizedStrategy === 'FIFO' && !lot_number) {
      const fifoLots = await Lot.findAll({
        where: {
          sku,
          status: 'ACTIVE',
          qty: { [Op.gt]: 0 }
        },
        include: [
          { model: Item, as: 'item' },
          { model: Bin, as: 'bin', attributes: ['bin_code', 'zone'] }
        ],
        order: [['createdAt', 'ASC'], ['id', 'ASC']],
        transaction,
        lock: true
      })

      if (!fifoLots.length) {
        await transaction.rollback()
        return res.status(404).json({
          success: false,
          message: 'No active lots with stock were found for this item.'
        })
      }

      const totalAvailable = fifoLots.reduce((sum, lot) => sum + Number(lot.qty || 0), 0)
      if (totalAvailable < parsedQty) {
        await transaction.rollback()
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock.',
          data: {
            available: totalAvailable,
            requested: parsedQty
          }
        })
      }

      let remainingQty = parsedQty
      const deductions = []
      const itemName = fifoLots[0].item?.name || sku

      for (const fifoLot of fifoLots) {
        if (remainingQty <= 0) break

        const lotAvailableQty = Number(fifoLot.qty || 0)
        if (lotAvailableQty <= 0) continue

        const deductQty = Math.min(remainingQty, lotAvailableQty)
        const beforeQuantity = lotAvailableQty
        const afterQuantity = lotAvailableQty - deductQty
        const location = String(fifoLot.bin?.bin_code || '-').trim() || '-'

        await fifoLot.update({
          qty: afterQuantity
        }, { transaction })

        await Transaction.create({
          transactionType: 'out',
          itemCode: sku,
          itemName,
          quantity: deductQty,
          beforeQuantity,
          afterQuantity,
          operator: operatorName,
          operatorId: userId,
          location,
          customer: so_number ? `SO: ${so_number}` : 'unknown',
          notes: `OUTBOUND_LOT:${fifoLot.lot_number}|STRATEGY:FIFO`,
          scanCode: fifoLot.lot_number,
          transactionTime: new Date()
        }, { transaction })

        deductions.push({
          lot_number: fifoLot.lot_number,
          bin_code: location,
          deducted_qty: deductQty,
          remaining_qty: afterQuantity,
          expiry_date: fifoLot.expiry_date,
          createdAt: fifoLot.createdAt
        })

        remainingQty -= deductQty
      }

      await transaction.commit()

      return res.json({
        success: true,
        message: 'Outbound completed successfully.',
        data: {
          strategy: 'FIFO',
          item_name: itemName,
          sku,
          deductions,
          transaction: {
            type: 'OUTBOUND',
            qty: parsedQty,
            location: deductions.map((entry) => entry.bin_code).join(', '),
            total_remaining_qty: totalAvailable - parsedQty
          }
        }
      })
    }

    if (!lot_number) {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: 'lot_number is required unless FIFO strategy is used.'
      })
    }

    const lot = await Lot.findOne({
      where: { lot_number, sku },
      include: [
        { model: Item, as: 'item' },
        { model: Bin, as: 'bin', attributes: ['bin_code', 'zone'] }
      ],
      transaction,
      lock: true
    })

    if (!lot) {
      await transaction.rollback()
      return res.status(404).json({
        success: false,
        message: 'Lot not found.'
      })
    }

    const availableQty = Number(lot.qty || 0)
    if (availableQty < parsedQty) {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock.',
        data: {
          available: availableQty,
          requested: parsedQty
        }
      })
    }

    const beforeQuantity = availableQty
    const afterQuantity = availableQty - parsedQty
    const sourceBinCode = String(source_bin_code || lot.bin?.bin_code || '').trim() || '-'
    const itemName = lot.item?.name || sku

    await lot.update({
      qty: afterQuantity
    }, { transaction })

    await Transaction.create({
      transactionType: 'out',
      itemCode: sku,
      itemName,
      quantity: parsedQty,
      beforeQuantity,
      afterQuantity,
      operator: operatorName,
      operatorId: userId,
      location: sourceBinCode,
      customer: so_number ? `SO: ${so_number}` : 'unknown',
      notes: `OUTBOUND_LOT:${lot.lot_number}`,
      scanCode: lot.lot_number,
      transactionTime: new Date()
    }, { transaction })

    await transaction.commit()

    res.json({
      success: true,
      message: 'Outbound completed successfully.',
      data: {
        strategy: 'DIRECT',
        lot,
        deductions: [{
          lot_number: lot.lot_number,
          bin_code: sourceBinCode,
          deducted_qty: parsedQty,
          remaining_qty: afterQuantity,
          expiry_date: lot.expiry_date,
          createdAt: lot.createdAt
        }],
        transaction: {
          type: 'OUTBOUND',
          qty: parsedQty,
          remaining_qty: afterQuantity,
          location: sourceBinCode
        }
      }
    })

  } catch (error) {
    await transaction.rollback()
    console.error('出库操作失败:', error)
    res.status(500).json({
      success: false,
      message: 'Outbound failed.',
      error: error.message
    })
  }
}

const executeMove = async (req, res) => {
  const transaction = await sequelize.transaction()

  try {
    const { lot_number, sku, qty, to_bin_code, notes } = req.body
    const userId = req.user?.id || 'unknown'
    const operatorName = req.user?.username || 'unknown'
    const normalizedTargetBin = String(to_bin_code || '').trim()
    const parsedQty = qty === undefined || qty === null || qty === '' ? null : Number(qty)

    if (!lot_number) {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: 'lot_number is required.'
      })
    }

    if (!normalizedTargetBin) {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: 'Please choose a target bin.'
      })
    }

    if (parsedQty !== null && (!Number.isFinite(parsedQty) || parsedQty <= 0)) {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: 'Move quantity must be greater than 0.'
      })
    }

    const whereClause = { lot_number }
    if (sku) {
      whereClause.sku = sku
    }

    const sourceLot = await Lot.findOne({
      where: whereClause,
      include: [
        { model: Item, as: 'item' },
        { model: Bin, as: 'bin', attributes: ['id', 'bin_code', 'zone'] }
      ],
      transaction,
      lock: true
    })

    if (!sourceLot) {
      await transaction.rollback()
      return res.status(404).json({
        success: false,
        message: 'The source lot could not be found.'
      })
    }

    if (sourceLot.status !== 'ACTIVE') {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: `This lot is currently ${sourceLot.status} and cannot be moved right now.`
      })
    }

    const availableQty = Number(sourceLot.qty || 0)
    const moveQty = parsedQty === null ? availableQty : parsedQty
    const fromBinCode = sourceLot.bin?.bin_code || '-'

    if (moveQty <= 0 || moveQty > availableQty) {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: `Move quantity cannot exceed the available stock. Current movable quantity: ${availableQty}.`
      })
    }

    const targetBin = await ensureBinForMovement(normalizedTargetBin, userId, transaction)

    if (sourceLot.bin_id === targetBin.id) {
      await transaction.rollback()
      return res.status(400).json({
        success: false,
        message: 'The target bin is the same as the current bin. No move is needed.'
      })
    }

    const isPartialMove = moveQty < availableQty
    let targetLot = sourceLot
    let targetLotNumber = sourceLot.lot_number

    if (isPartialMove) {
      const newLotNumber = await buildTransferLotNumber(sourceLot.lot_number, transaction)

      await sourceLot.update({
        qty: availableQty - moveQty,
        updated_by: userId
      }, { transaction })

      targetLot = await Lot.create({
        lot_number: newLotNumber,
        sku: sourceLot.sku,
        qty: moveQty,
        uom: sourceLot.uom || sourceLot.item?.uom || 'pcs',
        bin_id: targetBin.id,
        expiry_date: sourceLot.expiry_date,
        manufacture_date: sourceLot.manufacture_date,
        supplier: sourceLot.supplier,
        po_number: sourceLot.po_number,
        quality_status: sourceLot.quality_status,
        status: sourceLot.status,
        notes: `Split from ${sourceLot.lot_number}`,
        created_by: userId
      }, { transaction })

      targetLotNumber = newLotNumber
    } else {
      await sourceLot.update({
        bin_id: targetBin.id,
        updated_by: userId
      }, { transaction })
    }

    const moveNoteParts = [
      `BIN_TRANSFER: ${sourceLot.lot_number}${isPartialMove ? ` -> ${targetLotNumber}` : ''} ${fromBinCode} → ${normalizedTargetBin}`
    ]

    if (notes) {
      moveNoteParts.push(`Note: ${notes}`)
    }

    await Transaction.create({
      transactionType: 'in',
      itemCode: sourceLot.sku,
      itemName: sourceLot.item?.name || sourceLot.sku,
      quantity: moveQty,
      beforeQuantity: availableQty,
      afterQuantity: isPartialMove ? availableQty - moveQty : moveQty,
      operator: operatorName,
      operatorId: req.user?.id,
      location: `${fromBinCode} → ${normalizedTargetBin}`,
      notes: moveNoteParts.join(' | '),
      transactionTime: new Date()
    }, { transaction })

    await transaction.commit()

    return res.json({
      success: true,
      message: isPartialMove ? 'Split move completed successfully.' : 'Move completed successfully.',
      data: {
        source_lot: {
          lot_number: sourceLot.lot_number,
          sku: sourceLot.sku,
          remaining_qty: isPartialMove ? availableQty - moveQty : moveQty,
          bin_code: isPartialMove ? fromBinCode : normalizedTargetBin
        },
        moved_lot: {
          lot_number: targetLotNumber,
          sku: targetLot.sku,
          qty: moveQty,
          bin_code: normalizedTargetBin
        },
        split_created: isPartialMove
      }
    })
  } catch (error) {
    await transaction.rollback()
    console.error('移库操作失败:', error)
    return res.status(500).json({
      success: false,
      message: 'Move failed.',
      error: error.message
    })
  }
}

module.exports = {
  handleScan,
  recordScannerBenchmark,
  getScannerBenchmarkSummary,
  getInventoryInquiry,
  executeInbound,
  executeOutbound,
  executeMove
}
