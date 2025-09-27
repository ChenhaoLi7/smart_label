// server/controllers/purchaseController.js
const { PurchaseOrder, PurchaseOrderLine, Item, Lot, Bin, Transaction } = require('../models')
const { generateLotJWS, generateReceivingTaskJWS } = require('../utils/jwsSigner')
const { Op } = require('sequelize')
const sequelize = require('../config/database')

/**
 * 创建采购订单
 */
const createPurchaseOrder = async (req, res) => {
  const transaction = await sequelize.transaction()
  
  try {
    const {
      supplier_name,
      supplier_id,
      expected_date,
      priority = 'NORMAL',
      notes,
      lines = [] // 采购订单行数据
    } = req.body

    // 生成采购订单号
    const po_number = `PO${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`

    // 创建采购订单头
    const purchaseOrder = await PurchaseOrder.create({
      po_number,
      supplier_name,
      supplier_id,
      expected_date,
      priority,
      notes,
      status: 'DRAFT',
      created_by: req.user?.username || 'system'
    }, { transaction })

    // 创建采购订单行
    let total_amount = 0
    const createdLines = []
    
    for (const line of lines) {
      const { sku, quantity, unit_price, notes: line_notes } = line
      
      // 验证物料是否存在
      const item = await Item.findOne({ where: { sku } })
      if (!item) {
        throw new Error(`物料 ${sku} 不存在`)
      }

      const line_total = quantity * unit_price
      total_amount += line_total

      const orderLine = await PurchaseOrderLine.create({
        po_id: purchaseOrder.id,
        sku,
        item_name: item.name,
        quantity,
        received_quantity: 0,
        unit_price,
        line_total,
        uom: item.uom,
        notes: line_notes,
        status: 'PENDING'
      }, { transaction })

      createdLines.push(orderLine)
    }

    // 更新采购订单总金额
    await purchaseOrder.update({ total_amount }, { transaction })

    await transaction.commit()

    res.json({
      success: true,
      message: '采购订单创建成功',
      data: {
        purchaseOrder,
        lines: createdLines
      }
    })

  } catch (error) {
    await transaction.rollback()
    console.error('创建采购订单失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '创建采购订单失败'
    })
  }
}

/**
 * 获取采购订单列表
 */
const getPurchaseOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      supplier_name,
      po_number
    } = req.query

    const where = {}
    if (status) where.status = status
    if (supplier_name) where.supplier_name = { [Op.like]: `%${supplier_name}%` }
    if (po_number) where.po_number = { [Op.like]: `%${po_number}%` }

    const offset = (page - 1) * limit

    const { rows: purchaseOrders, count } = await PurchaseOrder.findAndCountAll({
      where,
      include: [{
        model: PurchaseOrderLine,
        as: 'lines'
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    })

    res.json({
      success: true,
      data: {
        purchaseOrders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    })

  } catch (error) {
    console.error('获取采购订单列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取采购订单列表失败'
    })
  }
}

/**
 * 获取采购订单详情
 */
const getPurchaseOrderDetail = async (req, res) => {
  try {
    const { id } = req.params

    const purchaseOrder = await PurchaseOrder.findByPk(id, {
      include: [{
        model: PurchaseOrderLine,
        as: 'lines',
        include: [{
          model: Item,
          as: 'item'
        }]
      }]
    })

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: '采购订单不存在'
      })
    }

    res.json({
      success: true,
      data: purchaseOrder
    })

  } catch (error) {
    console.error('获取采购订单详情失败:', error)
    res.status(500).json({
      success: false,
      message: '获取采购订单详情失败'
    })
  }
}

/**
 * 确认采购订单
 */
const confirmPurchaseOrder = async (req, res) => {
  const transaction = await sequelize.transaction()
  
  try {
    const { id } = req.params
    
    const purchaseOrder = await PurchaseOrder.findByPk(id, { transaction })
    if (!purchaseOrder) {
      throw new Error('采购订单不存在')
    }

    if (purchaseOrder.status !== 'DRAFT') {
      throw new Error('只有草稿状态的采购订单才能确认')
    }

    // 更新订单状态
    await purchaseOrder.update({
      status: 'CONFIRMED',
      confirmed_at: new Date(),
      confirmed_by: req.user?.username || 'system'
    }, { transaction })

    await transaction.commit()

    res.json({
      success: true,
      message: '采购订单确认成功',
      data: purchaseOrder
    })

  } catch (error) {
    await transaction.rollback()
    console.error('确认采购订单失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '确认采购订单失败'
    })
  }
}

/**
 * 生成收货任务二维码
 */
const generateReceivingTask = async (req, res) => {
  try {
    const { po_id, po_line_id, quantity, bin_code } = req.body

    // 验证采购订单行
    const poLine = await PurchaseOrderLine.findByPk(po_line_id, {
      include: [{
        model: PurchaseOrder,
        as: 'purchaseOrder'
      }]
    })

    if (!poLine) {
      return res.status(404).json({
        success: false,
        message: '采购订单行不存在'
      })
    }

    if (poLine.purchaseOrder.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: '只有已确认的采购订单才能生成收货任务'
      })
    }

    // 验证库位
    const bin = await Bin.findOne({ where: { bin_code } })
    if (!bin) {
      return res.status(404).json({
        success: false,
        message: `库位 ${bin_code} 不存在`
      })
    }

    // 生成批次号
    const lot_number = `L${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${poLine.sku}-${String(Date.now()).slice(-4)}`

    // 生成收货任务JWS
    const taskJWS = await generateReceivingTaskJWS({
      po_id,
      po_line_id,
      sku: poLine.sku,
      lot_number,
      quantity,
      bin_code,
      expected_exp: req.body.expected_exp
    })

    res.json({
      success: true,
      message: '收货任务二维码生成成功',
      data: {
        task_jws: taskJWS,
        lot_number,
        sku: poLine.sku,
        item_name: poLine.item_name,
        quantity,
        bin_code,
        po_number: poLine.purchaseOrder.po_number
      }
    })

  } catch (error) {
    console.error('生成收货任务失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '生成收货任务失败'
    })
  }
}

/**
 * 执行收货确认
 */
const executeReceiving = async (req, res) => {
  const transaction = await sequelize.transaction()
  
  try {
    const {
      task_jws,
      actual_quantity,
      actual_exp,
      operator_notes
    } = req.body

    // 验证任务JWS（这里应该调用JWS验证函数）
    // const taskData = await verifyReceivingTaskJWS(task_jws)
    
    // 临时解析任务数据（实际应该从JWS中解析）
    const taskData = {
      po_line_id: req.body.po_line_id,
      sku: req.body.sku,
      lot_number: req.body.lot_number,
      bin_code: req.body.bin_code,
      quantity: req.body.quantity
    }

    // 验证采购订单行
    const poLine = await PurchaseOrderLine.findByPk(taskData.po_line_id, { transaction })
    if (!poLine) {
      throw new Error('采购订单行不存在')
    }

    // 检查是否超收
    const remaining_quantity = poLine.quantity - poLine.received_quantity
    if (actual_quantity > remaining_quantity) {
      throw new Error(`收货数量不能超过剩余数量 ${remaining_quantity}`)
    }

    // 创建或更新批次库存
    const [lot, created] = await Lot.findOrCreate({
      where: {
        sku: taskData.sku,
        lot_number: taskData.lot_number,
        bin_code: taskData.bin_code
      },
      defaults: {
        quantity: actual_quantity,
        available_quantity: actual_quantity,
        reserved_quantity: 0,
        exp_date: actual_exp,
        status: 'AVAILABLE',
        created_by: req.user?.username || 'system'
      },
      transaction
    })

    if (!created) {
      // 如果批次已存在，累加数量
      await lot.update({
        quantity: lot.quantity + actual_quantity,
        available_quantity: lot.available_quantity + actual_quantity
      }, { transaction })
    }

    // 更新采购订单行收货数量
    const new_received_quantity = poLine.received_quantity + actual_quantity
    const line_status = new_received_quantity >= poLine.quantity ? 'COMPLETED' : 'PARTIAL'
    
    await poLine.update({
      received_quantity: new_received_quantity,
      status: line_status
    }, { transaction })

    // 创建库存事务记录
    await Transaction.create({
      transactionType: 'in',
      itemCode: taskData.sku,
      itemName: poLine.item_name,
      quantity: actual_quantity,
      beforeQuantity: lot.quantity - actual_quantity,
      afterQuantity: lot.quantity,
      operator: req.user?.username || 'system',
      operatorId: req.user?.id,
      location: taskData.bin_code,
      supplier: poLine.purchaseOrder?.supplier_name,
      notes: `采购入库 - PO: ${poLine.purchaseOrder?.po_number}, 批次: ${taskData.lot_number}`,
      scanCode: task_jws
    }, { transaction })

    await transaction.commit()

    res.json({
      success: true,
      message: '收货确认成功',
      data: {
        lot,
        received_quantity: actual_quantity,
        total_received: new_received_quantity,
        line_status
      }
    })

  } catch (error) {
    await transaction.rollback()
    console.error('收货确认失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '收货确认失败'
    })
  }
}

module.exports = {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderDetail,
  confirmPurchaseOrder,
  generateReceivingTask,
  executeReceiving
}