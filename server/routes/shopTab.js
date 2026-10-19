// Office shop tab API: signed-in customers and staff add purchases to their monthly tab;
// admins review monthly totals and mark them settled. No payment, no inventory change.
const express = require('express')
const authMiddleware = require('../middlewares/auth')
const requireRole = require('../middlewares/requireRole')
const { createShopTab, TabError, tokyoMonth } = require('../services/shopTab')

const MAX_LINES = 20
const MAX_QTY = 20
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const REQUEST_RE = /^[A-Za-z0-9-]{8,64}$/

function createShopTabRouter({ ledger = createShopTab(), loadItems, getMode } = {}) {
  const router = express.Router()
  // Legacy writes are refused once inventory-linked mode is on, so an old retry can never become a stock deduction.
  const currentMode = getMode || (async () => (await require('../services/shopInventory').getMode()).mode)
  const getItems = loadItems || (async (ids) => {
    const { Item } = require('../models')
    return Item.findAll({ where: { id: ids, status: 'ACTIVE' }, attributes: ['id', 'name', 'price'], raw: true })
  })
  const actor = (req) => ({ id: Number(req.user.id), username: req.user.username || `user-${req.user.id}` })
  const month = (req) => (typeof req.query.month === 'string' && MONTH_RE.test(req.query.month) ? req.query.month : tokyoMonth(new Date().toISOString()))
  const fail = (res, error) => {
    if (error instanceof TabError) return res.status(error.status).json({ success: false, message: error.message })
    console.error('Shop tab error:', error)
    return res.status(500).json({ success: false, message: 'The shop tab is temporarily unavailable' })
  }

  router.use(authMiddleware, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })

  router.post('/purchases', requireRole('admin', 'operator', 'viewer'), async (req, res) => {
    try {
      // An entry already recorded under this request id is returned as a replay in any mode (nothing new is written),
      // so a client verifying an unanswered request gets the original instead of a mode refusal.
      const priorId = req.body?.request_id
      if (typeof priorId === 'string' && REQUEST_RE.test(priorId)) {
        const prior = ledger.findPurchase({ userId: actor(req).id, requestId: priorId })
        if (prior) return res.status(200).json({ success: true, data: { purchase: prior, replayed: true } })
      }
      if ((await currentMode()) !== 'LEGACY_TAB') {
        return res.status(409).json({ success: false, code: 'MODE_INVENTORY_LINKED', message: 'This shop now confirms pickups with stock; please reload the page' })
      }
      const lines = Array.isArray(req.body?.items) ? req.body.items : null
      const requestId = req.body?.request_id
      if (!lines || !lines.length || lines.length > MAX_LINES || typeof requestId !== 'string' || !REQUEST_RE.test(requestId)) {
        return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'Invalid purchase request' })
      }
      const ids = lines.map((l) => Number(l?.id))
      const qtys = lines.map((l) => Number(l?.qty))
      if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length ||
          qtys.some((q) => !Number.isInteger(q) || q < 1 || q > MAX_QTY)) {
        return res.status(400).json({ success: false, code: 'BAD_BASKET', message: `Each product once, quantity 1–${MAX_QTY}` })
      }
      const found = new Map((await getItems(ids)).map((i) => [Number(i.id), i]))
      const missing = ids.filter((id) => !found.has(id))
      if (missing.length) return res.status(409).json({ success: false, code: 'ITEM_UNAVAILABLE', message: 'Some products are no longer available; please refresh' })
      const unpriced = ids.map((id) => found.get(id)).filter((i) => i.price === null || i.price === undefined || !(Number(i.price) > 0))
      if (unpriced.length) return res.status(409).json({ success: false, code: 'NO_PRICE', message: `No price set yet: ${unpriced.map((i) => i.name).join(', ')}. Please ask staff.` })
      const result = ledger.recordPurchase({ user: actor(req), lines: ids.map((id, k) => ({ item: found.get(id), qty: qtys[k] })), requestId })
      return res.status(result.replayed ? 200 : 201).json({ success: true, data: result })
    } catch (error) { return fail(res, error) }
  })

  router.get('/purchases/by-request/:requestId', requireRole('admin', 'operator', 'viewer'), (req, res) => {
    try {
      const p = REQUEST_RE.test(String(req.params.requestId)) ? ledger.findPurchase({ userId: actor(req).id, requestId: String(req.params.requestId) }) : null
      if (!p) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'No tab entry found for this request id (so far)' })
      return res.json({ success: true, data: p })
    } catch (error) { return fail(res, error) }
  })

  router.get('/purchases/mine', requireRole('admin', 'operator', 'viewer'), (req, res) => {
    try { return res.json({ success: true, data: ledger.myTab({ userId: actor(req).id, month: month(req) }) }) } catch (error) { return fail(res, error) }
  })

  router.post('/purchases/:id/cancel', requireRole('admin', 'operator', 'viewer'), (req, res) => {
    try {
      return res.json({ success: true, data: ledger.cancelPurchase({ id: String(req.params.id), actor: actor(req), isAdmin: req.user.role === 'admin' }) })
    } catch (error) { return fail(res, error) }
  })

  router.get('/tabs', requireRole('admin'), (req, res) => {
    try { return res.json({ success: true, data: ledger.monthTabs({ month: month(req) }) }) } catch (error) { return fail(res, error) }
  })

  router.post('/tabs/settle', requireRole('admin'), (req, res) => {
    try {
      const userId = Number(req.body?.user_id)
      const m = req.body?.month
      if (!Number.isSafeInteger(userId) || userId <= 0 || typeof m !== 'string' || !MONTH_RE.test(m)) {
        return res.status(400).json({ success: false, message: 'Invalid user or month' })
      }
      return res.json({ success: true, data: ledger.settle({ userId, month: m, actor: actor(req) }) })
    } catch (error) { return fail(res, error) }
  })

  return router
}

module.exports = createShopTabRouter
