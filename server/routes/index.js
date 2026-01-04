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
const aiAgentRoutes = require('./aiAgent')

// 注册路由
router.use('/auth', authRoutes)
router.use('/inventory', inventoryRoutes)
router.use('/purchase', purchaseRoutes)
router.use('/ai', aiAgentRoutes)
router.use('/inventory-management', inventoryManagementRoutes)
router.use('/print-center', printCenterRoutes)
router.use('/scan', scanRoutes)

// 健康检查
router.get('/health', async (req, res) => {
  let dbStatus = 'UNKNOWN';
  let dbError = null;

  try {
    const sequelize = require('../config/database');
    await sequelize.authenticate();
    dbStatus = 'CONNECTED';
  } catch (error) {
    dbStatus = 'DISCONNECTED';
    dbError = error.message;
    console.error('健康检查 - 数据库连接失败:', error.message);
  }

  res.json({
    status: dbStatus === 'CONNECTED' ? 'OK' : 'ERROR',
    database: {
      status: dbStatus,
      error: dbError
    },
    timestamp: new Date().toISOString(),
    message: dbStatus === 'CONNECTED' ? '智能仓库管理系统运行正常' : '智能仓库管理系统连接异常'
  })
})

module.exports = router