const { verifyJWS } = require('../utils/jwsSigner')
const { Item, Bin, Lot, PurchaseOrder, PurchaseOrderLine, SalesOrder, SalesOrderLine, Transaction, ScanLog } = require('../models')

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
      scan_type: 'SCAN',
      user_id: userId,
      device_id: device,
      success: false,
      transaction_time: new Date()
    })

    // 解析JWS
    let parsedData
    try {
      const verification = await verifyJWS(raw)
      if (!verification.valid) {
        throw new Error(verification.error || 'JWS验证失败')
      }
      parsedData = verification.payload
    } catch (error) {
      // 如果不是JWS格式，尝试解析为普通JSON
      try {
        parsedData = JSON.parse(raw)
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: '无效的扫码内容格式'
        })
      }
    }

    // 根据类型分发处理
    let result
    switch (parsedData.type) {
      case 'LOT':
        result = await handleLotScan(parsedData, req.user)
        break
      case 'BIN':
        result = await handleBinScan(parsedData, req.user)
        break
      case 'ITEM':
        result = await handleItemScan(parsedData, req.user)
        break
      case 'TASK':
        result = await handleTaskScan(parsedData, req.user)
        break
      case 'PO':
        result = await handlePOScan(parsedData, req.user)
        break
      case 'SO':
        result = await handleSOScan(parsedData, req.user)
        break
      default:
        return res.status(400).json({
          success: false,
          message: `不支持的标签类型: ${parsedData.type}`
        })
    }

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
      message: '批次不存在，需要创建新批次',
      data: { lot_number: lotNumber, sku }
    }
  }

  return {
    action: 'SHOW_LOT_INFO',
    message: '批次信息',
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
      message: '库位不存在，需要创建新库位',
      data: { bin_code: binCode }
    }
  }

  return {
    action: 'SHOW_BIN_INFO',
    message: '库位信息',
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
      { model: Lot, as: 'lots' }
    ]
  })

  if (!item) {
    return {
      action: 'CREATE_ITEM',
      message: '物料不存在，需要创建新物料',
      data: { sku: sku }
    }
  }

  return {
    action: 'SHOW_ITEM_INFO',
    message: '物料信息',
    data: {
      item: item,
      actions: ['VIEW_STOCK', 'CREATE_LOT', 'MOVE']
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
  try {
    const { lot_number, sku, qty, bin_code, po_number } = req.body
    const userId = req.user?.id || 'unknown'

    // 创建或更新批次
    let lot = await Lot.findOne({
      where: { lot_number, sku }
    })

    if (!lot) {
      lot = await Lot.create({
        lot_number,
        sku,
        qty: 0,
        uom: 'pcs',
        created_by: userId
      })
    }

    // 更新数量
    await lot.update({
      qty: lot.qty + qty
    })

    // 分配库位
    if (bin_code) {
      let bin = await Bin.findOne({
        where: { bin_code }
      })

      if (!bin) {
        bin = await Bin.create({
          bin_code,
          zone: 'A区',
          capacity: 1000,
          created_by: userId
        })
      }

      await lot.update({ bin_id: bin.id })
    }

    // 记录交易
    await Transaction.create({
      transactionType: 'in',
      itemCode: sku,
      itemName: sku,
      quantity: qty,
      beforeQuantity: lot.qty - qty,
      afterQuantity: lot.qty,
      operator: req.user?.username || 'unknown',
      operatorId: userId,
      location: bin_code,
      supplier: po_number ? `PO: ${po_number}` : 'unknown',
      transactionTime: new Date()
    })

    res.json({
      success: true,
      message: '入库成功',
      data: {
        lot: lot,
        transaction: {
          type: 'INBOUND',
          qty: qty,
          total_qty: lot.qty
        }
      }
    })

  } catch (error) {
    console.error('入库操作失败:', error)
    res.status(500).json({
      success: false,
      message: '入库操作失败',
      error: error.message
    })
  }
}

// 执行出库操作
const executeOutbound = async (req, res) => {
  try {
    const { lot_number, sku, qty, so_number } = req.body
    const userId = req.user?.id || 'unknown'

    // 查找批次
    const lot = await Lot.findOne({
      where: { lot_number, sku }
    })

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      })
    }

    if (lot.qty < qty) {
      return res.status(400).json({
        success: false,
        message: '库存不足',
        data: {
          available: lot.qty,
          requested: qty
        }
      })
    }

    // 更新数量
    await lot.update({
      qty: lot.qty - qty
    })

    // 记录交易
    await Transaction.create({
      transactionType: 'out',
      itemCode: sku,
      itemName: sku,
      quantity: qty,
      beforeQuantity: lot.qty + qty,
      afterQuantity: lot.qty,
      operator: req.user?.username || 'unknown',
      operatorId: userId,
      customer: so_number ? `SO: ${so_number}` : 'unknown',
      transactionTime: new Date()
    })

    res.json({
      success: true,
      message: '出库成功',
      data: {
        lot: lot,
        transaction: {
          type: 'OUTBOUND',
          qty: qty,
          remaining_qty: lot.qty
        }
      }
    })

  } catch (error) {
    console.error('出库操作失败:', error)
    res.status(500).json({
      success: false,
      message: '出库操作失败',
      error: error.message
    })
  }
}

module.exports = {
  handleScan,
  executeInbound,
  executeOutbound
}
