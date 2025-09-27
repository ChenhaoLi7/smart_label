// server/routes/index.js
const express = require('express')
const router = express.Router()

// 导入路由模块
const authRoutes = require('./auth')
const inventoryRoutes = require('./inventory')
const inventoryManagementRoutes = require('./inventoryManagement')
const printCenterRoutes = require('./printCenter')
const scanRoutes = require('./scan')
const purchaseRoutes = require('./purchase')

// 注册路由
router.use('/auth', authRoutes)
router.use('/inventory', inventoryRoutes)
router.use('/purchase', purchaseRoutes)
router.use('/inventory-management', inventoryManagementRoutes)
router.use('/print-center', printCenterRoutes)
router.use('/scan', scanRoutes)

// 健康检查
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: '智能仓库管理系统运行正常'
  })
})

module.exports = router