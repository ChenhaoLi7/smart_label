const { Item, Bin, Lot, Transaction } = require('../models')
const { Op } = require('sequelize')

// 获取库存概览统计
const getInventoryStats = async (req, res) => {
  try {
    const [
      totalItems,
      totalLots,
      totalBins,
      lowStockItems,
      expiredLots,
      todayTransactions
    ] = await Promise.all([
      Item.count({ where: { status: 'ACTIVE' } }),
      Lot.count({ where: { status: 'ACTIVE' } }),
      Bin.count({ where: { status: 'ACTIVE' } }),
      Item.count({
        where: {
          status: 'ACTIVE',
          '$lots.qty$': { [Op.lte]: 10 } // 库存少于10的商品
        },
        include: [{ model: Lot, as: 'lots' }]
      }),
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

    const offset = (page - 1) * limit
    const { count, rows } = await Item.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset),
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
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
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

    const offset = (page - 1) * limit
    const { count, rows } = await Lot.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset),
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
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
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

    const offset = (page - 1) * limit
    const { count, rows } = await Bin.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset),
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
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
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
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query

    const whereClause = {}
    if (search) {
      whereClause[Op.or] = [
        { sku: { [Op.like]: `%${search}%` } },
        { operator: { [Op.like]: `%${search}%` } }
      ]
    }

    const offset = (page - 1) * limit
    const { count, rows } = await Transaction.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

    res.json({
      success: true,
      data: {
        transactions: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
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

module.exports = {
  getInventoryStats,
  getItems,
  getLots,
  getBins,
  getTransactions,
  exportInventoryData,
  adjustInventory
}

