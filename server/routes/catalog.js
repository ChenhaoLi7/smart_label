// Read-only catalog route used by the /shop page: any signed-in account (customer or staff), no writes.
const express = require('express')
const authMiddleware = require('../middlewares/auth')
const requireRole = require('../middlewares/requireRole')
const { listCatalogItems } = require('../controllers/catalogController')

const router = express.Router()

// Small per-IP limit as an extra guard on the customer-facing route.
const WINDOW_MS = 60 * 1000
const MAX_REQUESTS = 60
const hits = new Map()
function rateLimit(req, res, next) {
  const now = Date.now()
  const key = req.ip || 'unknown'
  const entry = hits.get(key)
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(key, { start: now, count: 1 })
    if (hits.size > 5000) hits.clear()
    return next()
  }
  entry.count += 1
  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({ success: false, message: 'Too many catalog requests, please wait a moment' })
  }
  return next()
}

router.get('/items', rateLimit, authMiddleware, requireRole('admin', 'operator', 'viewer'), listCatalogItems)

module.exports = router
