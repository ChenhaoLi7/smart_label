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
const productionRoutes = require('./production')
const barcodeRoutes = require('./barcode')
const suggestionRoutes = require('./suggestions')
const scannerAssistRoutes = require('./scannerAssist')
const auth = require('../middlewares/auth')
const requireRole = require('../middlewares/requireRole')
const predictionRuntime = require('../services/predictionRuntime')
const { createForecastService } = require('../services/skuForecast')
const forecastService = createForecastService({ listOfficeItems: async () => {
  const { Item } = require('../models')
  return Item.findAll({ attributes:['sku','name'], order:[['sku','ASC']], limit:500, raw:true })
}, officeHistory: (sku) => require('../services/shopInventory').officeHistory(sku) })

// 注册路由
router.use('/auth', authRoutes)
router.use('/inventory', inventoryRoutes)
router.use('/purchase', purchaseRoutes)
router.use('/ai', aiAgentRoutes)
router.use('/inventory-management', inventoryManagementRoutes)
router.use('/print-center', printCenterRoutes)
router.use('/scan', scanRoutes)
router.use('/production', productionRoutes)
router.use('/barcode', barcodeRoutes)
router.use('/suggestions', suggestionRoutes)
router.use('/scanner', scannerAssistRoutes)
router.use('/catalog', require('./catalog'))
router.use('/shop/v2', require('./shopInventory'))
router.use('/shop', require('./shopTab')())
router.use('/candidate-recommendation', require('./candidateRecommendation')({ authenticate:auth, authorize:requireRole('admin','operator'), getJournal:predictionRuntime.getJournal, recognize:predictionRuntime.recognize, resolve:scannerAssistRoutes.resolveCandidateDisplay }))
router.use('/sku-forecast', require('./skuForecast')({ authenticate:auth, authorize:requireRole('admin'), service:forecastService }))

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
