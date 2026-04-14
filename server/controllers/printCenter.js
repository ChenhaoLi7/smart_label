const fs = require('fs')
const path = require('path')
const { Op } = require('sequelize')
const {
  Item,
  Bin,
  Lot,
  PurchaseOrder,
  PurchaseOrderLine,
  PrintJob,
  LabelTemplate
} = require('../models')
const { generateLabelPDF } = require('../utils/labelRenderer')

const DEFAULT_TEMPLATES = [
  {
    template_key: 'LOT-50x50',
    name: 'Lot Label 50x50mm',
    description: 'Standard lot label with SKU, lot code, quantity, bin, and expiry date.',
    template_type: 'warehouse',
    size_width: 50,
    size_height: 50,
    size_unit: 'mm',
    print_types: JSON.stringify(['LOT']),
    placeholders: JSON.stringify(['{{sku}}', '{{lot}}', '{{qty}}', '{{uom}}', '{{bin}}', '{{exp}}', '{{qr}}']),
    is_default: true,
    created_by: 'system',
    updated_by: 'system'
  },
  {
    template_key: 'BIN-80x40',
    name: 'Bin Label 80x40mm',
    description: 'Location label with bin code, zone, and capacity details.',
    template_type: 'warehouse',
    size_width: 80,
    size_height: 40,
    size_unit: 'mm',
    print_types: JSON.stringify(['BIN']),
    placeholders: JSON.stringify(['{{bin_code}}', '{{zone}}', '{{capacity}}', '{{qr}}']),
    is_default: true,
    created_by: 'system',
    updated_by: 'system'
  },
  {
    template_key: 'ITEM-60x40',
    name: 'Item Label 60x40mm',
    description: 'Item label with SKU, product name, spec, and unit.',
    template_type: 'product',
    size_width: 60,
    size_height: 40,
    size_unit: 'mm',
    print_types: JSON.stringify(['ITEM']),
    placeholders: JSON.stringify(['{{sku}}', '{{name}}', '{{spec}}', '{{uom}}', '{{qr}}']),
    is_default: true,
    created_by: 'system',
    updated_by: 'system'
  }
]

const parseStoredJson = (value, fallback) => {
  if (!value) return fallback

  try {
    return JSON.parse(value)
  } catch (error) {
    return fallback
  }
}

const normalizeStringArray = (value, fallback = []) => {
  if (!value) return fallback
  const normalized = Array.isArray(value) ? value : [value]
  const cleaned = normalized
    .map(entry => String(entry || '').trim())
    .filter(Boolean)

  return cleaned.length > 0 ? cleaned : fallback
}

const buildStaticScanPayload = (type, id, additionalData = {}) => JSON.stringify({
  type,
  id,
  ...additionalData
})

const serializeTemplate = (template) => ({
  id: template.template_key,
  dbId: template.id,
  name: template.name,
  description: template.description || '',
  templateType: template.template_type,
  size: {
    width: Number(template.size_width),
    height: Number(template.size_height),
    unit: template.size_unit || 'mm'
  },
  printTypes: parseStoredJson(template.print_types, []),
  placeholders: parseStoredJson(template.placeholders, []),
  canvasState: parseStoredJson(template.canvas_state, null),
  preview: template.preview_image || '',
  isDefault: Boolean(template.is_default),
  createdBy: template.created_by || null,
  updatedBy: template.updated_by || null,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt
})

const ensureDefaultTemplates = async () => {
  const existingCount = await LabelTemplate.count()
  if (existingCount > 0) return

  await LabelTemplate.bulkCreate(DEFAULT_TEMPLATES)
}

const findTemplateByIdentifier = async (identifier) => {
  const whereClauses = [{ template_key: String(identifier) }]
  const numericId = Number.parseInt(identifier, 10)
  if (Number.isFinite(numericId)) {
    whereClauses.push({ id: numericId })
  }

  return LabelTemplate.findOne({
    where: {
      [Op.or]: whereClauses
    }
  })
}

const buildTemplateKey = (name, printTypes) => {
  const prefix = normalizeStringArray(printTypes, ['LABEL'])[0].toUpperCase()
  const slug = String(name || 'template')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${prefix}-${slug || 'TEMPLATE'}`
}

const ensureUniqueTemplateKey = async (requestedKey, currentTemplateId = null) => {
  const baseKey = String(requestedKey || 'LABEL-TEMPLATE').trim().toUpperCase()
  let candidate = baseKey
  let suffix = 1

  while (true) {
    const existing = await LabelTemplate.findOne({ where: { template_key: candidate } })
    if (!existing || existing.id === currentTemplateId) {
      return candidate
    }

    suffix += 1
    candidate = `${baseKey}-${suffix}`
  }
}

const buildTemplatePayload = async (body, currentTemplate, user) => {
  const name = String(body.name || currentTemplate?.name || '').trim()
  if (!name) {
    throw new Error('模板名称不能为空')
  }

  const printTypes = normalizeStringArray(body.printTypes, parseStoredJson(currentTemplate?.print_types, ['ITEM']))
  const placeholders = normalizeStringArray(body.placeholders, parseStoredJson(currentTemplate?.placeholders, []))
  const size = body.size || {}
  const sizeWidth = Number(size.width ?? currentTemplate?.size_width ?? 60)
  const sizeHeight = Number(size.height ?? currentTemplate?.size_height ?? 40)

  if (!Number.isFinite(sizeWidth) || sizeWidth <= 0 || !Number.isFinite(sizeHeight) || sizeHeight <= 0) {
    throw new Error('模板尺寸不正确')
  }

  const requestedKey = String(body.templateKey || currentTemplate?.template_key || buildTemplateKey(name, printTypes)).trim()
  const templateKey = await ensureUniqueTemplateKey(requestedKey, currentTemplate?.id || null)

  return {
    template_key: templateKey,
    name,
    description: String(body.description ?? currentTemplate?.description ?? '').trim() || null,
    template_type: String(body.templateType || currentTemplate?.template_type || 'custom').trim() || 'custom',
    size_width: sizeWidth,
    size_height: sizeHeight,
    size_unit: String(size.unit || currentTemplate?.size_unit || 'mm').trim() || 'mm',
    print_types: JSON.stringify(printTypes),
    placeholders: JSON.stringify(placeholders),
    canvas_state: body.canvasState ? JSON.stringify(body.canvasState) : (currentTemplate?.canvas_state || null),
    preview_image: String(body.preview || currentTemplate?.preview_image || '').trim() || null,
    is_default: currentTemplate?.is_default || false,
    created_by: currentTemplate?.created_by || reqUserName(user),
    updated_by: reqUserName(user)
  }
}

const reqUserName = (user) => user?.username || `user-${user?.id || 'system'}`

const getBackendLabelData = async (printType, items) => {
  switch (printType) {
    case 'LOT':
      return getLotLabelData(items)
    case 'BIN':
      return getBinLabelData(items)
    case 'ITEM':
      return getItemLabelData(items)
    default:
      throw new Error(`不支持的打印类型: ${printType}`)
  }
}

const expandCopies = (items, copies) => {
  const totalCopies = Math.max(1, Number.parseInt(copies || '1', 10))
  const expanded = []

  for (const item of items) {
    for (let index = 0; index < totalCopies; index += 1) {
      expanded.push({
        ...item,
        copy_index: index + 1
      })
    }
  }

  return expanded
}

const ensureDownloadsDir = () => {
  const downloadsDir = path.join(__dirname, '../public/downloads')
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true })
  }
  return downloadsDir
}

const createPrintRun = async ({ template, printType, items, options, user }) => {
  const jobNumber = `PRINT-${Date.now()}`
  const labelData = await getBackendLabelData(printType, items)
  const expandedLabels = expandCopies(labelData, options.copies)

  if (expandedLabels.length === 0) {
    throw new Error('没有可打印的数据，请检查所选记录是否仍然存在')
  }

  const printJob = await PrintJob.create({
    job_number: jobNumber,
    template_name: template.name,
    template_id: template.id,
    print_type: printType,
    total_count: expandedLabels.length,
    copies_per_item: Math.max(1, Number.parseInt(options.copies || '1', 10)),
    format: options.format || 'PDF',
    dpi: Number(options.dpi) || 300,
    status: 'PROCESSING',
    created_by: reqUserName(user),
    request_payload: JSON.stringify({
      templateId: template.template_key,
      printType,
      items,
      options
    })
  })

  const labels = expandedLabels.map(item => ({
    ...item,
    template: template.template_key,
    qr_content: item.qr_content || 'QR_CODE_PLACEHOLDER'
  }))

  const downloadsDir = ensureDownloadsDir()
  const pdfPath = path.join(downloadsDir, `${jobNumber}.pdf`)

  try {
    await generateLabelPDF(printType, labels, pdfPath)
  } catch (error) {
    await printJob.update({
      status: 'FAILED',
      error_message: error.message
    })
    throw error
  }

  await printJob.update({
    status: 'COMPLETED',
    completed_at: new Date(),
    output_file: `/downloads/${jobNumber}.pdf`
  })

  return {
    job: printJob,
    labels,
    downloadUrl: `/downloads/${jobNumber}.pdf`
  }
}

// 获取可用的打印模板
const getTemplates = async (req, res) => {
  try {
    await ensureDefaultTemplates()

    const templates = await LabelTemplate.findAll({
      order: [['is_default', 'DESC'], ['updatedAt', 'DESC']]
    })

    res.json({
      success: true,
      data: templates.map(serializeTemplate)
    })
  } catch (error) {
    console.error('获取模板列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取模板列表失败',
      error: error.message
    })
  }
}

const createTemplate = async (req, res) => {
  try {
    await ensureDefaultTemplates()
    const payload = await buildTemplatePayload(req.body, null, req.user)
    const template = await LabelTemplate.create(payload)

    res.status(201).json({
      success: true,
      message: '模板已保存',
      data: serializeTemplate(template)
    })
  } catch (error) {
    console.error('创建模板失败:', error)
    res.status(400).json({
      success: false,
      message: error.message || '创建模板失败',
      error: error.message
    })
  }
}

const updateTemplate = async (req, res) => {
  try {
    await ensureDefaultTemplates()
    const template = await findTemplateByIdentifier(req.params.templateId)

    if (!template) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      })
    }

    const payload = await buildTemplatePayload(req.body, template, req.user)
    await template.update(payload)

    return res.json({
      success: true,
      message: '模板已更新',
      data: serializeTemplate(template)
    })
  } catch (error) {
    console.error('更新模板失败:', error)
    return res.status(400).json({
      success: false,
      message: error.message || '更新模板失败',
      error: error.message
    })
  }
}

// 打印标签
const printLabels = async (req, res) => {
  try {
    await ensureDefaultTemplates()

    const { templateId, printType, items, options = {} } = req.body

    if (!templateId || !printType || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: '参数不完整'
      })
    }

    const template = await findTemplateByIdentifier(templateId)
    if (!template) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      })
    }

    const supportedTypes = parseStoredJson(template.print_types, [])
    if (!supportedTypes.includes(printType)) {
      return res.status(400).json({
        success: false,
        message: `${template.name} 不支持 ${printType} 打印`
      })
    }

    const { job, labels, downloadUrl } = await createPrintRun({
      template,
      printType,
      items,
      options,
      user: req.user
    })

    res.json({
      success: true,
      data: {
        job_number: job.job_number,
        template: template.template_key,
        template_name: template.name,
        print_type: printType,
        labels,
        total_count: labels.length,
        download_url: downloadUrl
      }
    })
  } catch (error) {
    console.error('打印标签失败:', error)
    res.status(500).json({
      success: false,
      message: '打印标签失败',
      error: error.message
    })
  }
}

const reprintJob = async (req, res) => {
  try {
    await ensureDefaultTemplates()

    const job = await PrintJob.findByPk(req.params.jobId)
    if (!job) {
      return res.status(404).json({
        success: false,
        message: '打印任务不存在'
      })
    }

    const payload = parseStoredJson(job.request_payload, null)
    if (!payload?.templateId || !payload?.printType || !Array.isArray(payload?.items)) {
      return res.status(400).json({
        success: false,
        message: '该打印任务缺少重打所需快照数据'
      })
    }

    const template = await findTemplateByIdentifier(payload.templateId)
    if (!template) {
      return res.status(404).json({
        success: false,
        message: '原始模板已不存在，无法重打'
      })
    }

    const { job: nextJob, labels, downloadUrl } = await createPrintRun({
      template,
      printType: payload.printType,
      items: payload.items,
      options: payload.options || {},
      user: req.user
    })

    res.json({
      success: true,
      message: '已重新生成打印任务',
      data: {
        job_number: nextJob.job_number,
        total_count: labels.length,
        download_url: downloadUrl
      }
    })
  } catch (error) {
    console.error('重打标签失败:', error)
    res.status(500).json({
      success: false,
      message: '重打标签失败',
      error: error.message
    })
  }
}

// 获取批次标签数据
const getLotLabelData = async (items) => {
  const lotData = []

  for (const item of items) {
    if (item.lot_id) {
      const lot = await Lot.findByPk(item.lot_id, {
        include: [
          { model: Item, as: 'item' },
          { model: Bin, as: 'bin' }
        ]
      })

      if (!lot) continue

      lotData.push({
        sku: lot.sku,
        lot: lot.lot_number,
        qty: lot.qty,
        uom: lot.uom || 'pcs',
        bin: lot.bin?.bin_code || 'N/A',
        exp: lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('zh-CN') : 'N/A',
        qr_content: buildStaticScanPayload('LOT', lot.lot_number, { sku: lot.sku })
      })
      continue
    }

    if (item.po_line_id) {
      const poLine = await PurchaseOrderLine.findByPk(item.po_line_id, {
        include: [
          { model: PurchaseOrder, as: 'purchaseOrder' },
          { model: Item, as: 'item' }
        ]
      })

      if (!poLine) continue

      const tempLotNumber = `L${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`
      lotData.push({
        sku: poLine.sku,
        lot: tempLotNumber,
        qty: poLine.qty,
        uom: poLine.item?.uom || poLine.uom || 'pcs',
        bin: '待分配',
        exp: '待设置',
        qr_content: buildStaticScanPayload('LOT', tempLotNumber, { sku: poLine.sku })
      })
    }
  }

  return lotData
}

// 获取库位标签数据
const getBinLabelData = async (items) => {
  const binData = []

  for (const item of items) {
    if (item.bin_id) {
      const bin = await Bin.findByPk(item.bin_id)
      if (!bin) continue

      binData.push({
        bin_code: bin.bin_code,
        zone: bin.zone,
        capacity: bin.capacity,
        qr_content: buildStaticScanPayload('BIN', bin.bin_code, { zone: bin.zone })
      })
      continue
    }

    if (item.bin_code) {
      binData.push({
        bin_code: item.bin_code,
        zone: item.zone || '待设置',
        capacity: item.capacity || 0,
        qr_content: buildStaticScanPayload('BIN', item.bin_code, { zone: item.zone || '待设置' })
      })
    }
  }

  return binData
}

// 获取物料标签数据
const getItemLabelData = async (items) => {
  const itemData = []

  for (const item of items) {
    let itemRecord = null
    let sku = item.sku

    if (item.po_line_id) {
      const poLine = await PurchaseOrderLine.findByPk(item.po_line_id, {
        include: [{
          model: Item,
          as: 'item'
        }]
      })

      if (poLine?.item) {
        itemRecord = poLine.item
        sku = poLine.sku
      }
    }

    if (!itemRecord && sku) {
      itemRecord = await Item.findOne({ where: { sku } })
    }

    if (!itemRecord) continue

    itemData.push({
      sku: itemRecord.sku,
      name: itemRecord.name,
      spec: itemRecord.description || 'N/A',
      uom: itemRecord.uom,
      qr_content: buildStaticScanPayload('ITEM', itemRecord.sku)
    })
  }

  return itemData
}

// 获取打印任务列表
const getPrintJobs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query

    const whereClause = {}
    if (status) {
      whereClause.status = status
    }

    const offset = (page - 1) * limit
    const { count, rows } = await PrintJob.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: Number.parseInt(limit, 10),
      offset: Number.parseInt(offset, 10)
    })

    res.json({
      success: true,
      data: {
        jobs: rows.map((job) => ({
          ...job.toJSON(),
          request_payload: parseStoredJson(job.request_payload, null)
        })),
        pagination: {
          total: count,
          page: Number.parseInt(page, 10),
          limit: Number.parseInt(limit, 10),
          totalPages: Math.ceil(count / limit)
        }
      }
    })
  } catch (error) {
    console.error('获取打印任务列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取打印任务列表失败',
      error: error.message
    })
  }
}

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  printLabels,
  reprintJob,
  getPrintJobs
}
