const express = require('express')
const router = express.Router()
const { handleScan, executeInbound, executeOutbound } = require('../controllers/scanController')
const authMiddleware = require('../middlewares/auth')

// 统一扫码入口
router.post('/scan', authMiddleware, handleScan)

// 入库操作
router.post('/inbound', authMiddleware, executeInbound)

// 出库操作
router.post('/outbound', authMiddleware, executeOutbound)

module.exports = router
