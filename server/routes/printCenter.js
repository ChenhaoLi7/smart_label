const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/auth')
const requireRole = require('../middlewares/requireRole')
const {
  getTemplates,
  createTemplate,
  updateTemplate,
  printLabels,
  reprintJob,
  getPrintJobs
} = require('../controllers/printCenter')

// 所有路由都需要认证
router.use(authMiddleware)
router.use(requireRole('admin'))

// 获取可用模板
router.get('/templates', getTemplates)

// 创建模板
router.post('/templates', createTemplate)

// 更新模板
router.patch('/templates/:templateId', updateTemplate)

// 打印标签
router.post('/print', printLabels)

// 获取打印任务列表
router.get('/jobs', getPrintJobs)

// 重新生成历史打印任务
router.post('/jobs/:jobId/reprint', reprintJob)

module.exports = router
