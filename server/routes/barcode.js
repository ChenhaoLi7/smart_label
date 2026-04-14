const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/auth')
const { lookupBarcode } = require('../controllers/barcodeLookup')

// 需要登录但不限制角色
router.use(authMiddleware)

// GET /api/barcode/:code - 级联查询条码信息
router.get('/:code', lookupBarcode)

module.exports = router
