const express = require('express')
const router = express.Router()
const {
  handleScan,
  recordScannerBenchmark,
  getScannerBenchmarkSummary,
  getInventoryInquiry,
  executeInbound,
  executeOutbound,
  executeMove
} = require('../controllers/scanController')
const authMiddleware = require('../middlewares/auth')
const requireRole = require('../middlewares/requireRole')

// 统一扫码入口
router.post('/scan', authMiddleware, requireRole('admin', 'operator'), handleScan)

// 扫码性能样本
router.post('/benchmark', authMiddleware, requireRole('admin', 'operator'), recordScannerBenchmark)

// 扫码性能汇总
router.get('/benchmark/summary', authMiddleware, requireRole('admin'), getScannerBenchmarkSummary)

// 入库操作
router.post('/inbound', authMiddleware, requireRole('admin', 'operator'), executeInbound)

// 库存查询
router.post('/inquiry', authMiddleware, requireRole('admin', 'operator'), getInventoryInquiry)

// 出库操作
router.post('/outbound', authMiddleware, requireRole('admin', 'operator'), executeOutbound)

// 移库操作
router.post('/move', authMiddleware, requireRole('admin'), executeMove)

module.exports = router
