const { Item, Bin, Lot, PurchaseOrder, PurchaseOrderLine, SalesOrder, SalesOrderLine, PrintJob } = require('../models')
const { 
  generateLotJWS, 
  generateBinJWS, 
  generateItemJWS 
} = require('../utils/jwsSigner')

// 获取可用的打印模板
const getTemplates = async (req, res) => {
  try {
    const templates = [
      {
        id: 'LOT-50x50',
        name: '批次标签 50x50mm',
        description: '标准批次标签，包含SKU、批次、数量、库位、过期时间',
        size: { width: 50, height: 50, unit: 'mm' },
        placeholders: ['{{sku}}', '{{lot}}', '{{qty}}', '{{uom}}', '{{bin}}', '{{exp}}', '{{qr}}'],
        printTypes: ['LOT']
      },
      {
        id: 'BIN-80x40',
        name: '库位标签 80x40mm',
        description: '库位标识标签，包含库位编码、区域、容量信息',
        size: { width: 80, height: 40, unit: 'mm' },
        placeholders: ['{{bin_code}}', '{{zone}}', '{{capacity}}', '{{qr}}'],
        printTypes: ['BIN']
      },
      {
        id: 'ITEM-60x40',
        name: '物料标签 60x40mm',
        description: '物料标识标签，包含SKU、名称、规格、单位',
        size: { width: 60, height: 40, unit: 'mm' },
        placeholders: ['{{sku}}', '{{name}}', '{{spec}}', '{{uom}}', '{{qr}}'],
        printTypes: ['ITEM']
      }
    ]

    res.json({
      success: true,
      data: templates
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

// 打印标签
const printLabels = async (req, res) => {
  try {
    const { templateId, printType, items, options = {} } = req.body
    
    if (!templateId || !printType || !items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: '参数不完整'
      })
    }

    // 创建打印任务
    const jobNumber = `PRINT-${Date.now()}`
    const printJob = await PrintJob.create({
      job_number: jobNumber,
      template_name: templateId,
      print_type: printType,
      total_count: items.length * (options.copies || 1),
      copies_per_item: options.copies || 1,
      format: options.format || 'PDF',
      dpi: options.dpi || 300,
      status: 'PENDING',
      created_by: req.user.username || 'system'
    })

    // 根据打印类型获取数据
    let labelData = []
    
    switch (printType) {
      case 'LOT':
        labelData = await getLotLabelData(items)
        break
      case 'BIN':
        labelData = await getBinLabelData(items)
        break
      case 'ITEM':
        labelData = await getItemLabelData(items)
        break
      default:
        throw new Error(`不支持的打印类型: ${printType}`)
    }

    // 生成标签内容（这里简化处理，实际应该调用PDF生成库）
    const labels = labelData.map(item => ({
      ...item,
      template: templateId,
      qr_content: item.qr_content || 'QR_CODE_PLACEHOLDER'
    }))

    // 更新打印任务状态
    await printJob.update({
      status: 'COMPLETED',
      completed_at: new Date(),
      output_file: `/downloads/${jobNumber}.pdf`
    })

    res.json({
      success: true,
      data: {
        job_number: jobNumber,
        template: templateId,
        print_type: printType,
        labels: labels,
        total_count: labels.length,
        download_url: `/downloads/${jobNumber}.pdf`
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

// 获取批次标签数据
const getLotLabelData = async (items) => {
  const lotData = []
  
  for (const item of items) {
    if (item.lot_id) {
      // 根据批次ID获取数据
      const lot = await Lot.findByPk(item.lot_id, {
        include: [
          { model: Item, as: 'item' },
          { model: Bin, as: 'bin' }
        ]
      })
      
      if (lot) {
        // 生成JWS签名的二维码内容
        const qrContent = await generateLotJWS(lot.lot_number, lot.sku)
        
        lotData.push({
          sku: lot.sku,
          lot: lot.lot_number,
          qty: lot.qty,
          uom: lot.uom,
          bin: lot.bin?.bin_code || 'N/A',
          exp: lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('zh-CN') : 'N/A',
          qr_content: qrContent
        })
      }
    } else if (item.po_line_id) {
      // 根据采购订单行获取数据
      const poLine = await PurchaseOrderLine.findByPk(item.po_line_id, {
        include: [{ model: PurchaseOrder, as: 'po' }]
      })
      
      if (poLine) {
        // 生成临时批次号
        const tempLotNumber = `L${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
        const qrContent = await generateLotJWS(tempLotNumber, poLine.sku)
        
        lotData.push({
          sku: poLine.sku,
          lot: tempLotNumber,
          qty: poLine.qty,
          uom: poLine.uom,
          bin: '待分配',
          exp: '待设置',
          qr_content: qrContent
        })
      }
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
      if (bin) {
        // 生成JWS签名的二维码内容
        const qrContent = await generateBinJWS(bin.bin_code, bin.zone)
        
        binData.push({
          bin_code: bin.bin_code,
          zone: bin.zone,
          capacity: bin.capacity,
          qr_content: qrContent
        })
      }
    } else if (item.bin_code) {
      // 生成JWS签名的二维码内容
      const qrContent = await generateBinJWS(item.bin_code, item.zone || '待设置')
      
      binData.push({
        bin_code: item.bin_code,
        zone: item.zone || '待设置',
        capacity: item.capacity || 0,
        qr_content: qrContent
      })
    }
  }
  
  return binData
}

// 获取物料标签数据
const getItemLabelData = async (items) => {
  const itemData = []
  
  for (const item of items) {
    if (item.sku) {
      const itemRecord = await Item.findOne({ where: { sku: item.sku } })
      if (itemRecord) {
        // 生成JWS签名的二维码内容
        const qrContent = await generateItemJWS(itemRecord.sku)
        
        itemData.push({
          sku: itemRecord.sku,
          name: itemRecord.name,
          spec: itemRecord.description || 'N/A',
          uom: itemRecord.uom,
          qr_content: qrContent
        })
      }
    }
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
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

    res.json({
      success: true,
      data: {
        jobs: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
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
  printLabels,
  getPrintJobs
}
