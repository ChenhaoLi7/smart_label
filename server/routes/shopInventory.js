// /api/shop/v2: inventory-linked Shop (spec shop-lot-bin-v1-20261019). Separate from the legacy /api/shop tab.
const express = require('express')
const authMiddleware = require('../middlewares/auth')
const requireRole = require('../middlewares/requireRole')
const svc = require('../services/shopInventory')
const { createShopTab } = require('../services/shopTab')

const router = express.Router()
const legacyLedger = createShopTab()
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const ANY = requireRole('admin', 'operator', 'viewer')
const STAFF = requireRole('admin', 'operator')
const ADMIN = requireRole('admin')

const actor = (req) => ({ id: Number(req.user.id), username: req.user.username || `user-${req.user.id}`, role: req.user.role })
const month = (req) => (typeof req.query.month === 'string' && MONTH_RE.test(req.query.month) ? req.query.month : svc.tokyoMonth(new Date()))
const faultAt = (req) => (process.env.SHOP_FAULT_INJECTION_ENABLED === '1' ? req.get('X-Test-Fault') || null : null)
const wrap = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res)
    if (!res.headersSent) res.json({ success: true, data })
  } catch (e) {
    if (e instanceof svc.ShopError) return res.status(e.status).json({ success: false, code: e.code, message: e.message, ...(e.extra || {}) })
    console.error('shop v2 error:', e)
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'The shop service is temporarily unavailable. Nothing is confirmed until you see a purchase number.' })
  }
}

router.use(authMiddleware, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })

router.get('/mode', ANY, wrap(() => svc.getMode()))
router.put('/mode', ADMIN, wrap((req) => svc.setMode({ actor: actor(req), mode: req.body?.mode, expectedVersion: req.body?.expected_version })))

router.get('/catalog', ANY, wrap(() => svc.catalog()))

router.post('/purchases', ANY, wrap(async (req, res) => {
  const out = await svc.purchase({ user: actor(req), requestId: req.body?.request_id, items: req.body?.items, faultAt: faultAt(req) })
  res.status(out.replayed ? 200 : 201).json({ success: true, data: out })
}))
router.get('/purchases/by-request/:requestId', ANY, wrap(async (req) => {
  const p = await svc.purchaseByRequest(actor(req), req.params.requestId)
  if (!p) throw new svc.ShopError(404, 'NOT_FOUND', 'No confirmed purchase for this request id')
  return p
}))
router.get('/purchases/mine', ANY, wrap((req) => svc.myPurchases(actor(req), month(req))))
router.post('/purchases/:id/return-request', ANY, wrap((req) => svc.requestReturn({ actor: actor(req), purchaseId: Number(req.params.id), reason: req.body?.reason })))
router.post('/purchases/:id/return-approve', STAFF, wrap((req) => svc.approveReturn({ actor: actor(req), purchaseId: Number(req.params.id), note: req.body?.note, faultAt: faultAt(req) })))
router.post('/purchases/:id/return-reject', ADMIN, wrap((req) => svc.rejectReturn({ actor: actor(req), purchaseId: Number(req.params.id), note: req.body?.note })))
router.get('/returns/pending', STAFF, wrap(() => svc.pendingReturns()))

router.get('/bindings', ADMIN, wrap(() => svc.listBindings()))
router.get('/bindings/:sku/lots', ADMIN, wrap((req) => svc.eligibleLots(String(req.params.sku))))
router.put('/bindings/:sku', ADMIN, wrap((req) => {
  const lotId = req.body?.lot_id === null ? null : Number(req.body?.lot_id)
  if (lotId !== null && (!Number.isSafeInteger(lotId) || lotId <= 0)) throw new svc.ShopError(400, 'BAD_LOT', 'lot_id must be a positive integer or null to unbind')
  return svc.setBinding({ actor: actor(req), sku: String(req.params.sku), lotId, expectedVersion: req.body?.expected_version, note: req.body?.note })
}))

router.get('/tabs', ADMIN, wrap((req) => {
  const m = month(req)
  return svc.monthTabs(m).then((linked) => ({ month: m, linked, legacy: { ...legacyLedger.monthTabs({ month: m }), source: 'LEGACY_TAB (not linked to stock)' } }))
}))
router.post('/tabs/settle', ADMIN, wrap((req) => {
  const userId = Number(req.body?.user_id); const m = req.body?.month
  if (!Number.isSafeInteger(userId) || userId <= 0 || typeof m !== 'string' || !MONTH_RE.test(m)) throw new svc.ShopError(400, 'BAD_INPUT', 'Invalid user or month')
  return svc.settle({ actor: actor(req), userId, month: m })
}))

router.get('/consumption/daily', ADMIN, wrap((req) => {
  const { from, to, sku } = req.query
  if (!DAY_RE.test(String(from)) || !DAY_RE.test(String(to))) throw new svc.ShopError(400, 'BAD_RANGE', 'from and to must be YYYY-MM-DD')
  return svc.dailyConsumption({ sku: sku ? String(sku) : null, from: String(from), to: String(to) })
}))
router.get('/office-history/:sku', ADMIN, wrap((req) => svc.officeHistory(String(req.params.sku))))

module.exports = router
