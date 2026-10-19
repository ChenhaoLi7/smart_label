const {
  Item,
  Bin,
  Lot,
  Transaction,
  User,
  Inventory,
  PurchaseOrderLine,
  SalesOrderLine,
  BOMHeader,
  BOMLine,
  WorkOrder,
  WorkOrderConsumption,
  WorkOrderOutput
} = require('../models')
const { Op } = require('sequelize')
const sequelize = require('../config/database')

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const normalizeSortOrder = (value, fallback = 'ASC') => {
  return String(value || fallback).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
}

const parseOptionalNonNegativeInt = (value, fallback = null) => {
  if (value === undefined) return fallback
  if (value === null || value === '') return null

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN
}

const parseOptionalPrice = (value, fallback = null) => {
  if (value === undefined) return fallback
  if (value === null || value === '') return null

  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number.NaN
  }

  return Number(parsed.toFixed(2))
}

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) return null
  const normalized = String(value).trim()
  return normalized || null
}

const sortFieldMaps = {
  items: {
    sku: 'sku',
    name: 'name',
    price: 'price',
    totalQty: 'sku',
    availableQty: 'sku',
    status: 'status',
    createdAt: 'createdAt'
  },
  lots: {
    lot: 'lot_number',
    lot_number: 'lot_number',
    sku: 'sku',
    qty: 'qty',
    exp: 'expiry_date',
    expiry_date: 'expiry_date',
    status: 'status',
    createdAt: 'createdAt'
  },
  bins: {
    bin_code: 'bin_code',
    zone: 'zone',
    capacity: 'capacity',
    used: 'used',
    utilization: 'bin_code',
    status: 'status',
    createdAt: 'createdAt'
  },
  transactions: {
    timestamp: 'transactionTime',
    transactionTime: 'transactionTime',
    type: 'transactionType',
    transactionType: 'transactionType',
    user: 'operator',
    operator: 'operator',
    itemCode: 'itemCode',
    createdAt: 'createdAt'
  }
}

const resolveSortField = (scope, requested, fallback) => {
  return sortFieldMaps[scope]?.[requested] || fallback
}

const getAvailableLotQuantity = (lots = []) => {
  return lots.reduce((sum, lot) => {
    if (lot.status !== 'ACTIVE') return sum
    return sum + Number(lot.qty || 0)
  }, 0)
}

const classifyInventoryTransaction = (transaction = {}) => {
  const notes = typeof transaction.notes === 'string' ? transaction.notes : ''
  if (notes.startsWith('Cycle Count Adjustment:')) return 'count'
  if (notes.startsWith('BIN_TRANSFER:')) return 'move'
  return transaction.transactionType === 'in' ? 'inbound' : 'outbound'
}

// 获取库存概览统计
const getInventoryStats = async (req, res) => {
  try {
    const [
      activeItems,
      totalLots,
      totalBins,
      expiredLots,
      todayTransactions
    ] = await Promise.all([
      Item.findAll({
        where: { status: 'ACTIVE' },
        attributes: ['id', 'min_stock'],
        include: [{
          model: Lot,
          as: 'lots',
          attributes: ['qty', 'status'],
          required: false
        }]
      }),
      Lot.count({
        where: {
          status: 'ACTIVE',
          qty: { [Op.gt]: 0 }
        }
      }),
      Bin.count({ where: { status: 'ACTIVE' } }),
      Lot.count({
        where: {
          status: 'ACTIVE',
          expiry_date: { [Op.lt]: new Date() }
        }
      }),
      Transaction.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ])

    const totalItems = activeItems.length
    const lowStockItems = activeItems.reduce((count, item) => {
      const availableQty = getAvailableLotQuantity(item.lots)
      const minStock = Number(item.min_stock || 0)
      return count + (availableQty <= minStock ? 1 : 0)
    }, 0)

    // 计算库位利用率 - count unique bin_ids
    const usedBins = await Lot.count({
      distinct: true,
      col: 'bin_id',
      where: {
        status: 'ACTIVE',
        qty: { [Op.gt]: 0 }
      }
    })

    const utilization = totalBins > 0 ? Math.round((usedBins / totalBins) * 100) : 0

    res.json({
      success: true,
      data: {
        totalItems,
        totalLots,
        totalBins,
        utilization,
        lowStockCount: lowStockItems,
        expiringLotsCount: expiredLots,
        todayTransactions,
        usedBins,
        availableBins: totalBins - usedBins
      }
    })
  } catch (error) {
    console.error('获取库存统计失败:', error)
    res.status(500).json({
      success: false,
      message: '获取库存统计失败',
      error: error.message
    })
  }
}

// 获取商品列表
const getItems = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'sku', sortOrder = 'ASC' } = req.query

    const whereClause = {}
    if (search) {
      whereClause[Op.or] = [
        { sku: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } }
      ]
    }

    const pageNumber = parsePositiveInt(page, 1)
    const pageSize = parsePositiveInt(limit, 20)
    const offset = (pageNumber - 1) * pageSize
    const safeSortBy = resolveSortField('items', sortBy, 'sku')
    const safeSortOrder = normalizeSortOrder(sortOrder)

    const { count, rows } = await Item.findAndCountAll({
      where: whereClause,
      order: [[safeSortBy, safeSortOrder]],
      limit: pageSize,
      offset,
      include: [{
        model: Lot,
        as: 'lots',
        attributes: ['qty', 'bin_id', 'status']
      }]
    })

    // 计算每个商品的总库存和可用库存
    const itemsWithStock = rows.map(item => {
      const lots = item.lots || []
      const totalQty = lots.reduce((sum, lot) => sum + lot.qty, 0)
      const availableQty = lots
        .filter(lot => lot.status === 'ACTIVE')
        .reduce((sum, lot) => sum + lot.qty, 0)

      return {
        ...item.toJSON(),
        totalQty,
        availableQty,
        binCount: new Set(lots.map(lot => lot.bin_id)).size
      }
    })

    res.json({
      success: true,
      data: {
        items: itemsWithStock,
        pagination: {
          total: count,
          page: pageNumber,
          limit: pageSize,
          totalPages: Math.ceil(count / pageSize)
        }
      }
    })
  } catch (error) {
    console.error('获取商品列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取商品列表失败',
      error: error.message
    })
  }
}

// 创建新商品
const createItem = async (req, res) => {
  try {
    const { sku, name, description, category, uom, min_stock, max_stock, price } = req.body
    const normalizedSku = String(sku || '').trim()
    const normalizedName = String(name || '').trim()
    const normalizedMinStock = parseOptionalNonNegativeInt(min_stock, 0)
    const normalizedMaxStock = parseOptionalNonNegativeInt(max_stock, null)
    const normalizedPrice = parseOptionalPrice(price, null)

    if (!normalizedSku || !normalizedName) {
      return res.status(400).json({
        success: false,
        message: 'SKU 和商品名称不能为空'
      })
    }

    if (Number.isNaN(normalizedMinStock) || Number.isNaN(normalizedMaxStock)) {
      return res.status(400).json({
        success: false,
        message: '库存阈值必须是大于等于 0 的整数'
      })
    }

    if (Number.isNaN(normalizedPrice)) {
      return res.status(400).json({
        success: false,
        message: '价格必须是大于等于 0 的数字'
      })
    }

    // 检查 SKU 是否已存在
    const existing = await Item.findOne({ where: { sku: normalizedSku } })
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '该 SKU 编码已存在'
      })
    }

    const newItem = await sequelize.transaction(async (transaction) => Item.create({
      sku: normalizedSku,
      name: normalizedName,
      description: normalizeOptionalText(description),
      category: normalizeOptionalText(category),
      uom: normalizeOptionalText(uom) || 'pcs',
      price: normalizedPrice,
      min_stock: normalizedMinStock ?? 0,
      max_stock: normalizedMaxStock,
      status: 'ACTIVE',
      created_by: req.user?.username || 'system',
      updated_by: req.user?.username || 'system'
    }, { transaction }))

    res.json({
      success: true,
      data: newItem,
      message: '商品创建成功'
    })
  } catch (error) {
    console.error('创建商品失败:', error)
    res.status(500).json({
      success: false,
      message: '创建商品失败',
      error: error.message
    })
  }
}

// 更新商品资料（支持 SKU 级联修改）
const updateItem = async (req, res) => {
  try {
    const currentSku = String(req.params.sku || '').trim()
    const {
      sku,
      name,
      description,
      category,
      uom,
      min_stock,
      max_stock,
      price,
      status
    } = req.body

    const normalizedSku = String(sku || currentSku).trim()
    const normalizedName = String(name || '').trim()
    const normalizedMinStock = parseOptionalNonNegativeInt(min_stock, 0)
    const normalizedMaxStock = parseOptionalNonNegativeInt(max_stock, null)
    const normalizedPrice = parseOptionalPrice(price, null)
    const normalizedStatus = String(status || 'ACTIVE').trim().toUpperCase()
    const allowedStatuses = new Set(['ACTIVE', 'INACTIVE', 'DISCONTINUED'])

    if (!currentSku || !normalizedSku || !normalizedName) {
      return res.status(400).json({
        success: false,
        message: 'SKU 和商品名称不能为空'
      })
    }

    if (Number.isNaN(normalizedMinStock) || Number.isNaN(normalizedMaxStock)) {
      return res.status(400).json({
        success: false,
        message: '库存阈值必须是大于等于 0 的整数'
      })
    }

    if (Number.isNaN(normalizedPrice)) {
      return res.status(400).json({
        success: false,
        message: '价格必须是大于等于 0 的数字'
      })
    }

    if (!allowedStatuses.has(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: '商品状态不合法'
      })
    }

    const item = await Item.findOne({ where: { sku: currentSku } })
    if (!item) {
      return res.status(404).json({
        success: false,
        message: `SKU ${currentSku} 不存在`
      })
    }

    if (normalizedSku !== currentSku) {
      const skuTaken = await Item.findOne({ where: { sku: normalizedSku } })
      if (skuTaken) {
        return res.status(400).json({
          success: false,
          message: `SKU ${normalizedSku} 已存在`
        })
      }
    }

    const skuChanged = normalizedSku !== currentSku
    const nameChanged = normalizedName !== item.name
    const itemPayload = {
      sku: normalizedSku,
      name: normalizedName,
      description: normalizeOptionalText(description),
      category: normalizeOptionalText(category),
      uom: normalizeOptionalText(uom) || 'pcs',
      price: normalizedPrice,
      min_stock: normalizedMinStock ?? 0,
      max_stock: normalizedMaxStock,
      status: normalizedStatus,
      updated_by: req.user?.username || 'system'
    }

    await sequelize.transaction(async (transaction) => {
      await item.update(itemPayload, { transaction })

      const crossReferenceUpdates = []
      const inventoryPayload = {}
      const transactionPayload = {}

      if (skuChanged) {
        inventoryPayload.itemCode = normalizedSku
        transactionPayload.itemCode = normalizedSku

        crossReferenceUpdates.push(
          Lot.update({ sku: normalizedSku }, { where: { sku: currentSku }, transaction }),
          PurchaseOrderLine.update({ sku: normalizedSku }, { where: { sku: currentSku }, transaction }),
          SalesOrderLine.update({ sku: normalizedSku }, { where: { sku: currentSku }, transaction }),
          BOMHeader.update({ sku: normalizedSku }, { where: { sku: currentSku }, transaction }),
          BOMLine.update({ component_sku: normalizedSku }, { where: { component_sku: currentSku }, transaction }),
          WorkOrder.update({ sku: normalizedSku }, { where: { sku: currentSku }, transaction }),
          WorkOrderConsumption.update({ component_sku: normalizedSku }, { where: { component_sku: currentSku }, transaction }),
          WorkOrderOutput.update({ sku: normalizedSku }, { where: { sku: currentSku }, transaction })
        )
      }

      if (nameChanged) {
        inventoryPayload.itemName = normalizedName
        transactionPayload.itemName = normalizedName
      }

      if (Object.keys(inventoryPayload).length > 0) {
        crossReferenceUpdates.push(
          Inventory.update(inventoryPayload, { where: { itemCode: currentSku }, transaction })
        )
      }

      if (Object.keys(transactionPayload).length > 0) {
        crossReferenceUpdates.push(
          Transaction.update(transactionPayload, { where: { itemCode: currentSku }, transaction })
        )
      }

      if (crossReferenceUpdates.length > 0) {
        await Promise.all(crossReferenceUpdates)
      }
    })

    const updatedItem = await Item.findOne({
      where: { sku: normalizedSku },
      include: [{
        model: Lot,
        as: 'lots',
        attributes: ['qty', 'bin_id', 'status']
      }]
    })

    const lots = updatedItem?.lots || []
    const itemWithStock = {
      ...updatedItem.toJSON(),
      totalQty: lots.reduce((sum, lot) => sum + Number(lot.qty || 0), 0),
      availableQty: lots
        .filter((lot) => lot.status === 'ACTIVE')
        .reduce((sum, lot) => sum + Number(lot.qty || 0), 0),
      binCount: new Set(lots.map((lot) => lot.bin_id)).size
    }

    res.json({
      success: true,
      data: itemWithStock,
      message: skuChanged ? '商品更新成功，关联 SKU 已同步' : '商品更新成功'
    })
  } catch (error) {
    console.error('更新商品失败:', error)
    res.status(500).json({
      success: false,
      message: '更新商品失败',
      error: error.message
    })
  }
}

// 获取批次列表
const getLots = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'lot_number', sortOrder = 'ASC' } = req.query

    const whereClause = {}
    if (search) {
      whereClause[Op.or] = [
        { lot_number: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } }
      ]
    }

    const pageNumber = parsePositiveInt(page, 1)
    const pageSize = parsePositiveInt(limit, 20)
    const offset = (pageNumber - 1) * pageSize
    const safeSortBy = resolveSortField('lots', sortBy, 'lot_number')
    const safeSortOrder = normalizeSortOrder(sortOrder)

    const { count, rows } = await Lot.findAndCountAll({
      where: whereClause,
      order: [[safeSortBy, safeSortOrder]],
      limit: pageSize,
      offset,
      include: [
        {
          model: Item,
          as: 'item',
          attributes: ['name', 'uom']
        },
        {
          model: Bin,
          as: 'bin',
          attributes: ['bin_code', 'zone']
        }
      ]
    })

    res.json({
      success: true,
      data: {
        lots: rows,
        pagination: {
          total: count,
          page: pageNumber,
          limit: pageSize,
          totalPages: Math.ceil(count / pageSize)
        }
      }
    })
  } catch (error) {
    console.error('获取批次列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取批次列表失败',
      error: error.message
    })
  }
}

// 获取库位列表
const getBins = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'bin_code', sortOrder = 'ASC' } = req.query

    const whereClause = {}
    if (search) {
      whereClause[Op.or] = [
        { bin_code: { [Op.like]: `%${search}%` } },
        { zone: { [Op.like]: `%${search}%` } }
      ]
    }

    const pageNumber = parsePositiveInt(page, 1)
    const pageSize = parsePositiveInt(limit, 20)
    const offset = (pageNumber - 1) * pageSize
    const safeSortBy = resolveSortField('bins', sortBy, 'bin_code')
    const safeSortOrder = normalizeSortOrder(sortOrder)

    const { count, rows } = await Bin.findAndCountAll({
      where: whereClause,
      order: [[safeSortBy, safeSortOrder]],
      limit: pageSize,
      offset,
      include: [{
        model: Lot,
        as: 'lots',
        attributes: ['qty']
      }]
    })

    // 计算每个库位的利用率
    const binsWithUtilization = rows.map(bin => {
      const lots = bin.lots || []
      const used = lots.reduce((sum, lot) => sum + lot.qty, 0)
      const utilization = bin.capacity > 0 ? Math.round((used / bin.capacity) * 100) : 0

      return {
        ...bin.toJSON(),
        used,
        utilization
      }
    })

    res.json({
      success: true,
      data: {
        bins: binsWithUtilization,
        pagination: {
          total: count,
          page: pageNumber,
          limit: pageSize,
          totalPages: Math.ceil(count / pageSize)
        }
      }
    })
  } catch (error) {
    console.error('获取库位列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取库位列表失败',
      error: error.message
    })
  }
}

// 获取交易记录
const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'transactionTime', sortOrder = 'DESC' } = req.query

    const whereClause = {}
    if (search) {
      whereClause[Op.or] = [
        { itemCode: { [Op.like]: `%${search}%` } },
        { operator: { [Op.like]: `%${search}%` } }
      ]
    }

    const pageNumber = parsePositiveInt(page, 1)
    const pageSize = parsePositiveInt(limit, 20)
    const offset = (pageNumber - 1) * pageSize
    const safeSortBy = resolveSortField('transactions', sortBy, 'transactionTime')
    const safeSortOrder = normalizeSortOrder(sortOrder, 'DESC')

    const { count, rows } = await Transaction.findAndCountAll({
      where: whereClause,
      order: [[safeSortBy, safeSortOrder]],
      limit: pageSize,
      offset
    })

    res.json({
      success: true,
      data: {
        transactions: rows,
        pagination: {
          total: count,
          page: pageNumber,
          limit: pageSize,
          totalPages: Math.ceil(count / pageSize)
        }
      }
    })
  } catch (error) {
    console.error('获取交易记录失败:', error)
    res.status(500).json({
      success: false,
      message: '获取交易记录失败',
      error: error.message
    })
  }
}

// 获取 SKU 使用趋势和用户操作分析
const getInventoryAnalytics = async (req, res) => {
  try {
    const allowedWindows = new Set([7, 30, 90])
    const requestedDays = Number.parseInt(req.query.days, 10)
    const days = allowedWindows.has(requestedDays) ? requestedDays : 30
    const sku = String(req.query.sku || '').trim()
    const operator = String(req.query.operator || '').trim()

    if (sku.length > 100 || operator.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Analytics filters are too long.'
      })
    }

    const now = new Date()
    const startDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - (days - 1)
    ))
    const whereClause = {
      transactionTime: { [Op.gte]: startDate }
    }

    if (sku) whereClause.itemCode = sku
    if (operator) {
      whereClause[Op.and] = [
        sequelize.where(
          sequelize.fn('TRIM', sequelize.col('operator')),
          operator
        )
      ]
    }

    const [transactionResult, itemRows, userRows, historicalOperators] = await Promise.all([
      Transaction.findAndCountAll({
        where: whereClause,
        order: [['transactionTime', 'DESC']],
        limit: 5000,
        raw: true
      }),
      Item.findAll({
        where: { status: 'ACTIVE' },
        attributes: ['sku', 'name'],
        order: [['sku', 'ASC']],
        raw: true
      }),
      User.findAll({
        where: { status: 'active' },
        attributes: ['username', 'role'],
        order: [['username', 'ASC']],
        raw: true
      }),
      Transaction.findAll({
        attributes: ['operator'],
        group: ['operator'],
        order: [['operator', 'ASC']],
        raw: true
      })
    ])

    const transactions = transactionResult.rows
    const timelineMap = new Map()
    const operatorMap = new Map()
    const skuMap = new Map()
    let inboundQty = 0
    let outboundQty = 0
    let countOperations = 0
    let moveOperations = 0

    for (let index = 0; index < days; index += 1) {
      const date = new Date(startDate)
      date.setUTCDate(startDate.getUTCDate() + index)
      const key = date.toISOString().slice(0, 10)
      timelineMap.set(key, {
        date: key,
        inbound: 0,
        outbound: 0,
        operations: 0,
        adjustments: 0
      })
    }

    transactions.forEach((transaction) => {
      const operationType = classifyInventoryTransaction(transaction)
      const quantity = Math.abs(Number(transaction.quantity || 0))
      const timestamp = new Date(transaction.transactionTime)
      const dayKey = Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString().slice(0, 10)
      const operatorName = String(transaction.operator || 'System').trim() || 'System'
      const itemCode = String(transaction.itemCode || 'Unknown SKU').trim() || 'Unknown SKU'

      if (operationType === 'inbound') inboundQty += quantity
      if (operationType === 'outbound') outboundQty += quantity
      if (operationType === 'count') countOperations += 1
      if (operationType === 'move') moveOperations += 1

      const timelineEntry = dayKey ? timelineMap.get(dayKey) : null
      if (timelineEntry) {
        timelineEntry.operations += 1
        if (operationType === 'inbound') timelineEntry.inbound += quantity
        if (operationType === 'outbound') timelineEntry.outbound += quantity
        if (operationType === 'count') timelineEntry.adjustments += 1
      }

      if (!operatorMap.has(operatorName)) {
        operatorMap.set(operatorName, {
          operator: operatorName,
          operations: 0,
          inboundQty: 0,
          outboundQty: 0,
          countOperations: 0,
          moveOperations: 0,
          lastActivity: transaction.transactionTime
        })
      }
      const operatorEntry = operatorMap.get(operatorName)
      operatorEntry.operations += 1
      if (operationType === 'inbound') operatorEntry.inboundQty += quantity
      if (operationType === 'outbound') operatorEntry.outboundQty += quantity
      if (operationType === 'count') operatorEntry.countOperations += 1
      if (operationType === 'move') operatorEntry.moveOperations += 1

      if (!skuMap.has(itemCode)) {
        skuMap.set(itemCode, {
          sku: itemCode,
          name: transaction.itemName || itemCode,
          operations: 0,
          inboundQty: 0,
          outboundQty: 0,
          lastActivity: transaction.transactionTime
        })
      }
      const skuEntry = skuMap.get(itemCode)
      skuEntry.operations += 1
      if (operationType === 'inbound') skuEntry.inboundQty += quantity
      if (operationType === 'outbound') skuEntry.outboundQty += quantity
    })

    const operatorOptionsMap = new Map()
    const itemNameMap = new Map(itemRows.map((item) => [item.sku, item.name || item.sku]))
    userRows.forEach((user) => {
      operatorOptionsMap.set(user.username, {
        username: user.username,
        role: user.role
      })
    })
    historicalOperators.forEach((row) => {
      const username = String(row.operator || '').trim()
      if (username && !operatorOptionsMap.has(username)) {
        operatorOptionsMap.set(username, { username, role: null })
      }
    })

    const recent = transactions.slice(0, 12).map((transaction) => ({
      id: transaction.id,
      operationType: classifyInventoryTransaction(transaction),
      itemCode: transaction.itemCode,
      itemName: itemNameMap.get(transaction.itemCode) || transaction.itemName,
      quantity: Math.abs(Number(transaction.quantity || 0)),
      beforeQuantity: transaction.beforeQuantity,
      afterQuantity: transaction.afterQuantity,
      operator: String(transaction.operator || 'System').trim() || 'System',
      location: transaction.location || null,
      transactionTime: transaction.transactionTime
    }))

    return res.json({
      success: true,
      data: {
        filters: {
          days,
          sku: sku || null,
          operator: operator || null,
          periodStart: startDate.toISOString(),
          periodEnd: now.toISOString()
        },
        options: {
          skus: itemRows,
          operators: Array.from(operatorOptionsMap.values())
            .sort((left, right) => left.username.localeCompare(right.username))
        },
        summary: {
          operations: transactionResult.count,
          inboundQty,
          outboundQty,
          netMovement: inboundQty - outboundQty,
          countOperations,
          moveOperations,
          activeOperators: operatorMap.size,
          truncated: transactionResult.count > transactions.length
        },
        timeline: Array.from(timelineMap.values()),
        operatorBreakdown: Array.from(operatorMap.values())
          .sort((left, right) => right.operations - left.operations),
        skuBreakdown: Array.from(skuMap.values())
          .map((entry) => ({
            ...entry,
            name: itemNameMap.get(entry.sku) || entry.name
          }))
          .sort((left, right) => right.outboundQty - left.outboundQty),
        recent
      }
    })
  } catch (error) {
    console.error('获取库存分析失败:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to load inventory analytics.',
      error: error.message
    })
  }
}

// 导出库存数据
const exportInventoryData = async (req, res) => {
  try {
    const [items, lots, bins, transactions] = await Promise.all([
      Item.findAll({ include: [{ model: Lot, as: 'lots' }] }),
      Lot.findAll({ include: [{ model: Item, as: 'item' }, { model: Bin, as: 'bin' }] }),
      Bin.findAll({ include: [{ model: Lot, as: 'lots' }] }),
      Transaction.findAll()
    ])

    const exportData = {
      exportTime: new Date().toISOString(),
      items: items.map(item => {
        const lots = item.lots || []
        return {
          ...item.toJSON(),
          totalQty: lots.reduce((sum, lot) => sum + lot.qty, 0),
          availableQty: lots
            .filter(lot => lot.status === 'ACTIVE')
            .reduce((sum, lot) => sum + lot.qty, 0)
        }
      }),
      lots,
      bins: bins.map(bin => {
        const lots = bin.lots || []
        const used = lots.reduce((sum, lot) => sum + lot.qty, 0)
        return {
          ...bin.toJSON(),
          used,
          utilization: bin.capacity > 0 ? Math.round((used / bin.capacity) * 100) : 0
        }
      }),
      transactions
    }

    res.json({
      success: true,
      data: exportData
    })
  } catch (error) {
    console.error('导出库存数据失败:', error)
    res.status(500).json({
      success: false,
      message: '导出库存数据失败',
      error: error.message
    })
  }
}

// 调整库存 (盘点) - 使用乐观锁
const adjustInventory = async (req, res) => {
  const transaction = await require('../config/database').transaction();
  try {
    const { lot_number, actual_qty, reason } = req.body

    // 获取幂等性 Key
    const idempotencyKey = req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'] ||
      `${req.user?.id || 'anon'}-${lot_number}-${Date.now()}`

    // 1. 查找批次（读取当前版本号）
    const lot = await Lot.findOne({
      where: { lot_number },
      transaction
    })

    if (!lot) {
      throw new Error('Lot not found')
    }

    const systemQty = lot.qty
    const currentVersion = lot.version || 0  // 读取版本号
    const diff = actual_qty - systemQty

    if (diff === 0) {
      await transaction.rollback();
      return res.json({ success: true, message: 'No adjustment needed', data: { lot } })
    }

    // 2. 使用乐观锁更新库存（版本号必须匹配）
    const [updatedRows] = await Lot.update(
      {
        qty: actual_qty,
        version: currentVersion + 1  // 版本号 +1
      },
      {
        where: {
          lot_number,
          version: currentVersion  // 🔐 关键：只有版本匹配才更新
        },
        transaction
      }
    )

    // 3. 检查是否更新成功
    if (updatedRows === 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: '数据已被其他用户修改，请刷新后重试 (Concurrent modification detected)',
        error: 'VERSION_CONFLICT'
      })
    }

    // 4. 记录交易 (Audit Log)
    await Transaction.create({
      transactionType: diff > 0 ? 'in' : 'out',
      itemCode: lot.sku,
      itemName: lot.sku,
      quantity: Math.abs(diff),
      beforeQuantity: systemQty,
      afterQuantity: actual_qty,
      operator: req.user?.username || 'system',
      operatorId: req.user?.id,
      notes: `Cycle Count Adjustment: ${reason || 'No reason provided'}`,
      transactionTime: new Date(),
      idempotency_key: idempotencyKey
    }, { transaction })

    await transaction.commit();

    res.json({
      success: true,
      message: 'Inventory adjusted successfully',
      data: {
        lot_number,
        old_qty: systemQty,
        new_qty: actual_qty,
        adjustment: diff,
        version: currentVersion + 1
      }
    })

  } catch (error) {
    await transaction.rollback();

    // 幂等性处理
    if (error.name === 'SequelizeUniqueConstraintError' &&
      error.parent?.code === 'ER_DUP_ENTRY') {
      console.log('⚠️ 检测到重复操作，已忽略（幂等性保护）');
      return res.json({
        success: true,
        message: 'Operation already processed (idempotency)',
        data: { lot_number: req.body.lot_number }
      });
    }

    console.error('Adjustment error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

const updateLot = async (req, res) => {
  const transaction = await require('../config/database').transaction()
  try {
    const lotNumber = String(req.params.lotNumber || '').trim()
    const body = req.body || {}
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k)

    if (!lotNumber) {
      await transaction.rollback()
      return res.status(400).json({ success: false, message: 'Lot number is required' })
    }
    if (!has('expiry_date') && !has('quality_status')) {
      await transaction.rollback()
      return res.status(400).json({ success: false, message: 'Nothing to update (expiry_date or quality_status)' })
    }

    const lot = await Lot.findOne({ where: { lot_number: lotNumber }, transaction, lock: true })
    if (!lot) {
      await transaction.rollback()
      return res.status(404).json({ success: false, message: 'Lot not found' })
    }

    const patch = { updated_by: req.user?.username || 'system', version: (lot.version || 0) + 1 }
    // Only fields present in the request change; an explicit '' or null expiry still clears it as before.
    if (has('expiry_date')) {
      const expiry = body.expiry_date
      const normalizedExpiry = expiry === '' || expiry === null || expiry === undefined ? null : new Date(expiry)
      if (normalizedExpiry && Number.isNaN(normalizedExpiry.getTime())) {
        await transaction.rollback()
        return res.status(400).json({ success: false, message: 'Expiry date is invalid' })
      }
      patch.expiry_date = normalizedExpiry
    }
    if (has('quality_status')) {
      if (!['PENDING', 'PASSED', 'FAILED', 'QUARANTINE'].includes(body.quality_status)) {
        await transaction.rollback()
        return res.status(400).json({ success: false, message: 'quality_status must be PENDING, PASSED, FAILED or QUARANTINE' })
      }
      patch.quality_status = body.quality_status
    }

    await lot.update(patch, { transaction })
    await transaction.commit()

    const refreshedLot = await Lot.findOne({
      where: { lot_number: lotNumber },
      include: [
        { model: Item, as: 'item' },
        { model: Bin, as: 'bin', attributes: ['id', 'bin_code', 'zone'] }
      ]
    })

    return res.json({
      success: true,
      message: 'Lot updated successfully',
      data: {
        lot: refreshedLot
      }
    })
  } catch (error) {
    try { await transaction.rollback() } catch (_) { /* already finished */ }
    console.error('更新批次失败:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to update lot',
      error: error.message
    })
  }
}

module.exports = {
  getInventoryStats,
  getItems,
  createItem,
  updateItem,
  getLots,
  getBins,
  getTransactions,
  getInventoryAnalytics,
  exportInventoryData,
  adjustInventory,
  updateLot
}
