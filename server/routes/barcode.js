const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/auth')
const requireRole = require('../middlewares/requireRole')
const { lookupBarcode } = require('../controllers/barcodeLookup')

// 需要登录；仅员工（顾客 viewer 不可查询内部条码信息）
router.use(authMiddleware)
router.use(requireRole('admin', 'operator'))

// GET /api/barcode/:code - 级联查询条码信息
router.get('/:code', lookupBarcode)

module.exports = router
