// server/routes/purchase.js
const express = require('express')
const router = express.Router()
const {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderDetail,
  confirmPurchaseOrder,
  generateReceivingTask,
  executeReceiving
} = require('../controllers/purchaseController')
const authMiddleware = require('../middlewares/auth')

// 所有采购相关路由都需要认证
router.use(authMiddleware)

// 采购订单管理
router.post('/orders', createPurchaseOrder)
router.get('/orders', getPurchaseOrders)
router.get('/orders/:id', getPurchaseOrderDetail)
router.put('/orders/:id/confirm', confirmPurchaseOrder)

// 收货管理
router.post('/receiving/task', generateReceivingTask)
router.post('/receiving/execute', executeReceiving)

module.exports = router