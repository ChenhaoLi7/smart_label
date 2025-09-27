// server/controllers/inventoryController.js
const { Lot, Item, Bin, Transaction, ScanLog } = require('../models')
const { Op } = require('sequelize')
const sequelize = require('../config/database')

/**
 * 获取库存概览
 */
const getInventoryOverview = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sku,
      bin_code,
      lot_number,
      status = 'AVAILABLE'
    } = req.query

    const where = { status }
    if (sku) where.sku = { [Op.like]: `%${sku}%` }
    if (bin_code) where.bin_code = { [Op.like]: `%${bin_code}%` }
    if (lot_number) where.lot_number = { [Op.like]: `%${lot_number}%` }

    const offset = (page - 1) * limit

    const { rows: lots, count } = await Lot.findAndCountAll({
      where,
      include: [
        {
          model: Item,
          as: 'item',
          attributes: ['sku', 'name', 'description', 'uom', 'category']
        },
        {
          model: Bin,
          as: 'bin',
          attributes: ['bin_code', 'zone', 'capacity', 'status']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    })

    // 计算汇总统计
    const summary = await Lot.findAll({
      attributes: [
        'sku',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity'],
        [sequelize.fn('SUM', sequelize.col('available_quantity')), 'total_available'],
        [sequelize.fn('SUM', sequelize.col('reserved_quantity')), 'total_reserved'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'lot_count']
      ],
      where,
      group: ['sku'],
      include: [{
        model: Item,
        as: 'item',
        attributes: ['name', 'uom']
      }]
    })

    res.json({
      success: true,
      data: {
        lots,
        summary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    })

  } catch (error) {
    console.error('获取库存概览失败:', error)
    res.status(500).json({
      success: false,
      message: '获取库存概览失败'
    })
  }
}

/**
 * 获取库存统计
 */
const getInventoryStats = async (req, res) => {
  try {
    // 总物料数
    const totalItems = await Item.count({
      where: { status: 'ACTIVE' }
    })

    // 总批次数
    const totalLots = await Lot.count({
      where: { status: 'AVAILABLE' }
    })

    // 总库位数
    const totalBins = await Bin.count({
      where: { status: 'ACTIVE' }
    })

    // 库位利用率
    const usedBins = await Lot.count({
      distinct: true,
      col: 'bin_code',
      where: { 
        status: 'AVAILABLE',
        quantity: { [Op.gt]: 0 }
      }
    })

    const utilization = totalBins > 0 ? Math.round((usedBins / totalBins) * 100) : 0

    // 低库存预警
    const lowStockItems = await Item.findAll({
      include: [{
        model: Lot,
        as: 'lots',
        attributes: [[sequelize.fn('SUM', sequelize.col('available_quantity')), 'total_available']],
        where: { status: 'AVAILABLE' },
        required: false
      }],
      having: sequelize.literal('COALESCE(SUM(lots.available_quantity), 0) <= min_stock'),
      group: ['Item.id']
    })

    // 即将过期的批次
    const expiringLots = await Lot.count({
      where: {
        status: 'AVAILABLE',
        exp_date: {
          [Op.between]: [new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)] // 30天内过期
        }
      }
    })

    res.json({
      success: true,
      data: {
        totalItems,
        totalLots,
        totalBins,
        utilization: `${utilization}%`,
        lowStockCount: lowStockItems.length,
        expiringLotsCount: expiringLots,
        usedBins,
        availableBins: totalBins - usedBins
      }
    })

  } catch (error) {
    console.error('获取库存统计失败:', error)
    res.status(500).json({
      success: false,
      message: '获取库存统计失败'
    })
  }
}

/**
 * 移库操作
 */
const moveInventory = async (req, res) => {
  const transaction = await sequelize.transaction()
  
  try {
    const {
      lot_id,
      from_bin_code,
      to_bin_code,
      quantity,
      notes
    } = req.body

    // 验证源批次
    const sourceLot = await Lot.findOne({
      where: {
        id: lot_id,
        bin_code: from_bin_code,
        status: 'AVAILABLE'
      },
      transaction
    })

    if (!sourceLot) {
      throw new Error('源批次不存在或状态不可用')
    }

    if (sourceLot.available_quantity < quantity) {
      throw new Error(`可用数量不足，当前可用: ${sourceLot.available_quantity}`)
    }

    // 验证目标库位
    const targetBin = await Bin.findOne({
      where: { bin_code: to_bin_code, status: 'ACTIVE' },
      transaction
    })

    if (!targetBin) {
      throw new Error('目标库位不存在或状态不可用')
    }

    // 检查目标库位是否已有相同SKU的批次
    const [targetLot, created] = await Lot.findOrCreate({
      where: {
        sku: sourceLot.sku,
        lot_number: sourceLot.lot_number,
        bin_code: to_bin_code
      },
      defaults: {
        quantity: quantity,
        available_quantity: quantity,
        reserved_quantity: 0,
        exp_date: sourceLot.exp_date,
        status: 'AVAILABLE',
        created_by: req.user?.username || 'system'
      },
      transaction
    })

    if (!created) {
      // 目标位置已有此批次，累加数量
      await targetLot.update({
        quantity: targetLot.quantity + quantity,
        available_quantity: targetLot.available_quantity + quantity
      }, { transaction })
    }

    // 减少源批次数量
    const newSourceQuantity = sourceLot.quantity - quantity
    const newSourceAvailable = sourceLot.available_quantity - quantity

    if (newSourceQuantity === 0) {
      // 如果源批次数量为0，删除记录
      await sourceLot.destroy({ transaction })
    } else {
      await sourceLot.update({
        quantity: newSourceQuantity,
        available_quantity: newSourceAvailable
      }, { transaction })
    }

    // 记录移库事务
    await Transaction.create({
      transactionType: 'move',
      itemCode: sourceLot.sku,
      itemName: sourceLot.item?.name || sourceLot.sku,
      quantity: quantity,
      beforeQuantity: sourceLot.quantity,
      afterQuantity: newSourceQuantity,
      operator: req.user?.username || 'system',
      operatorId: req.user?.id,
      location: `${from_bin_code} → ${to_bin_code}`,
      notes: `移库操作 - 批次: ${sourceLot.lot_number}${notes ? `, 备注: ${notes}` : ''}`
    }, { transaction })

    await transaction.commit()

    res.json({
      success: true,
      message: '移库操作成功',
      data: {
        from_lot: {
          id: sourceLot.id,
          bin_code: from_bin_code,
          remaining_quantity: newSourceQuantity
        },
        to_lot: {
          id: targetLot.id,
          bin_code: to_bin_code,
          total_quantity: targetLot.quantity + (created ? 0 : quantity)
        },
        moved_quantity: quantity
      }
    })

  } catch (error) {
    await transaction.rollback()
    console.error('移库操作失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '移库操作失败'
    })
  }
}

/**
 * 盘点操作
 */
const stocktakeInventory = async (req, res) => {
  const transaction = await sequelize.transaction()
  
  try {
    const {
      lot_id,
      actual_quantity,
      notes
    } = req.body

    // 验证批次
    const lot = await Lot.findByPk(lot_id, {
      include: [{
        model: Item,
        as: 'item'
      }],
      transaction
    })

    if (!lot) {
      throw new Error('批次不存在')
    }

    const difference = actual_quantity - lot.quantity
    const adjustmentType = difference > 0 ? 'in' : 'out'
    const adjustmentQuantity = Math.abs(difference)

    if (difference !== 0) {
      // 更新批次数量
      await lot.update({
        quantity: actual_quantity,
        available_quantity: lot.available_quantity + difference
      }, { transaction })

      // 记录盘点调整事务
      await Transaction.create({
        transactionType: adjustmentType,
        itemCode: lot.sku,
        itemName: lot.item?.name || lot.sku,
        quantity: adjustmentQuantity,
        beforeQuantity: lot.quantity - difference,
        afterQuantity: actual_quantity,
        operator: req.user?.username || 'system',
        operatorId: req.user?.id,
        location: lot.bin_code,
        notes: `盘点调整 - 批次: ${lot.lot_number}, 差异: ${difference > 0 ? '+' : ''}${difference}${notes ? `, 备注: ${notes}` : ''}`
      }, { transaction })
    }

    await transaction.commit()

    res.json({
      success: true,
      message: difference === 0 ? '盘点正确，无需调整' : '盘点调整完成',
      data: {
        lot_id: lot.id,
        sku: lot.sku,
        lot_number: lot.lot_number,
        bin_code: lot.bin_code,
        before_quantity: lot.quantity - difference,
        after_quantity: actual_quantity,
        difference,
        adjustment_type: difference === 0 ? 'none' : adjustmentType
      }
    })

  } catch (error) {
    await transaction.rollback()
    console.error('盘点操作失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '盘点操作失败'
    })
  }
}

/**
 * 获取库存事务历史
 */
const getTransactionHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      itemCode,
      transactionType,
      operator,
      startDate,
      endDate
    } = req.query

    const where = {}
    if (itemCode) where.itemCode = { [Op.like]: `%${itemCode}%` }
    if (transactionType) where.transactionType = transactionType
    if (operator) where.operator = { [Op.like]: `%${operator}%` }
    if (startDate && endDate) {
      where.transactionTime = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      }
    }

    const offset = (page - 1) * limit

    const { rows: transactions, count } = await Transaction.findAndCountAll({
      where,
      order: [['transactionTime', 'DESC']],
      limit: parseInt(limit),
      offset
    })

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    })

  } catch (error) {
    console.error('获取事务历史失败:', error)
    res.status(500).json({
      success: false,
      message: '获取事务历史失败'
    })
  }
}

module.exports = {
  getInventoryOverview,
  getInventoryStats,
  moveInventory,
  stocktakeInventory,
  getTransactionHistory
}


