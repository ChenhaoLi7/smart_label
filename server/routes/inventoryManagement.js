const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/auth')
const {
  getInventoryStats,
  getItems,
  getLots,
  getBins,
  getTransactions,
  exportInventoryData,
  adjustInventory
} = require('../controllers/inventoryManagement')

// 所有路由都需要认证
router.use(authMiddleware)

// 获取库存统计概览
router.get('/stats', getInventoryStats)

// 获取商品列表
router.get('/items', getItems)

// 获取批次列表
router.get('/lots', getLots)

// 获取库位列表
router.get('/bins', getBins)

// 获取交易记录
router.get('/transactions', getTransactions)

// 导出库存数据
router.get('/export', exportInventoryData)

// 调整库存 (盘点)
router.post('/adjust', adjustInventory)

module.exports = router
