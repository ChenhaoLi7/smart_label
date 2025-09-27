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

    res.json({
      success: true,
      data: {
        totalItems,
        totalLots,
        totalBins,
        lowStockItems,
        expiredLots,
        todayTransactions
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
        { user: { [Op.like]: `%${search}%` } }
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

module.exports = {
  getInventoryStats,
  getItems,
  getLots,
  getBins,
  getTransactions,
  exportInventoryData
}

