// server/routes/inventory.js
const express = require('express')
const router = express.Router()
const {
  getInventoryOverview,
  getInventoryStats,
  moveInventory,
  stocktakeInventory,
  getTransactionHistory
} = require('../controllers/inventoryController')
const authMiddleware = require('../middlewares/auth')

// 所有库存相关路由都需要认证
router.use(authMiddleware)

// 库存查询
router.get('/overview', getInventoryOverview)
router.get('/stats', getInventoryStats)
router.get('/transactions', getTransactionHistory)

// 库存操作
router.post('/move', moveInventory)
router.post('/stocktake', stocktakeInventory)

module.exports = router