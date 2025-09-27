const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/auth')
const {
  getTemplates,
  printLabels,
  getPrintJobs
} = require('../controllers/printCenter')

// 所有路由都需要认证
router.use(authMiddleware)

// 获取可用模板
router.get('/templates', getTemplates)

// 打印标签
router.post('/print', printLabels)

// 获取打印任务列表
router.get('/jobs', getPrintJobs)

module.exports = router

