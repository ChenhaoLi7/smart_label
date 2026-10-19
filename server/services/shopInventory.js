// Shop x LOT/BIN inventory link (spec shop-lot-bin-v1-20261019).
// Every write that changes stock, billing or a binding runs in ONE MySQL transaction together with the lot rows.
// Idempotency is enforced by database unique keys, not by in-process memory.
const crypto = require('crypto')
const { QueryTypes } = require('sequelize')
const sequelize = require('../config/database')

const SHOP_ID = 'OFFICE-1'
const SPEC_VERSION = 'shop-lot-bin-v1-20261019'
const MODES = ['LEGACY_TAB', 'INVENTORY_LINKED']
const MAX_LINES = 20
const MAX_QTY = 20
const REQUEST_RE = /^[A-Za-z0-9-]{8,64}$/
const RETURN_WINDOW_MS = 15 * 60 * 1000
const RETRYABLE = new Set([1213, 1205])
const MAX_RETRIES = 3

class ShopError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra }
}

const tokyoDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const tokyoMonth = (d) => tokyoDate(d).slice(0, 7)
const cents = (price) => Math.round(Number(price) * 100)
// Raw-query replacements format JS Dates in the server's local time, while reads (and the rest of the app's
// Sequelize models) use UTC. Dates are therefore passed as explicit UTC strings so stored and read times agree.
const utc = (v) => (v instanceof Date ? v.toISOString().slice(0, 23).replace('T', ' ') : v)
const args = (r) => (Array.isArray(r) ? r.map(utc) : r)
const sel = (sql, replacements, transaction) => sequelize.query(sql, { replacements: args(replacements), transaction, type: QueryTypes.SELECT })
const exec = (sql, replacements, transaction) => sequelize.query(sql, { replacements: args(replacements), transaction })
const insert = async (sql, replacements, transaction) => (await sequelize.query(sql, { replacements: args(replacements), transaction, type: QueryTypes.INSERT }))[0]
const errno = (e) => e?.original?.errno || e?.parent?.errno || e?.errno

// Test-only fault injection: active only when the backend was started with SHOP_FAULT_INJECTION_ENABLED=1.
function fault(stage, faultAt) {
  if (process.env.SHOP_FAULT_INJECTION_ENABLED === '1' && faultAt === stage) throw new ShopError(500, 'INJECTED_FAULT', `injected fault at ${stage}`)
}

// Test-only: hold the purchase transaction open before commit, to reproduce "lookup while the original is still processing".
async function faultDelay(stage, faultAt) {
  if (process.env.SHOP_FAULT_INJECTION_ENABLED !== '1' || typeof faultAt !== 'string') return
  const m = faultAt.match(/^delay_([a-z_]+):(\d{1,5})$/)
  if (m && m[1] === stage) await new Promise((r) => setTimeout(r, Math.min(Number(m[2]), 15000)))
}

async function withRetry(fn) {
  for (let attempt = 0; ; attempt += 1) {
    const t = await sequelize.transaction()
    try {
      const out = await fn(t, attempt)
      await t.commit()
      return out
    } catch (e) {
      try { await t.rollback() } catch (_) { /* already rolled back */ }
      if (RETRYABLE.has(errno(e)) && attempt < MAX_RETRIES) continue
      if (e && e.retryWithFreshRead && attempt < MAX_RETRIES) continue
      throw e
    }
  }
}

// ---------------------------------------------------------------- mode
async function getMode(transaction, lock) {
  const rows = await sel(`SELECT shop_id, mode, version, updated_by, updated_at FROM shop_settings WHERE shop_id = ?${lock ? ` ${lock}` : ''}`, [SHOP_ID], transaction)
  return rows[0] || { shop_id: SHOP_ID, mode: 'LEGACY_TAB', version: 0, updated_by: null, updated_at: null, default: true }
}

async function setMode({ actor, mode, expectedVersion }) {
  if (!MODES.includes(mode)) throw new ShopError(400, 'BAD_MODE', 'Unknown mode')
  return withRetry(async (t) => {
    await exec('INSERT IGNORE INTO shop_settings (shop_id, mode, version, updated_by, updated_at) VALUES (?, \'LEGACY_TAB\', 0, NULL, ?)', [SHOP_ID, new Date()], t)
    const cur = await getMode(t, 'FOR UPDATE')
    if (expectedVersion !== undefined && Number(expectedVersion) !== Number(cur.version)) throw new ShopError(409, 'VERSION_CONFLICT', 'Settings changed; reload and try again', { current: cur })
    if (cur.mode === mode) return { ...cur, changed: false }
    const at = new Date()
    await exec('UPDATE shop_settings SET mode = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE shop_id = ?', [mode, actor.id, at, SHOP_ID], t)
    await exec('INSERT INTO shop_mode_changes (shop_id, from_mode, to_mode, changed_by, changed_at, source) VALUES (?, ?, ?, ?, ?, \'SYSTEM\')', [SHOP_ID, cur.mode, mode, actor.id, at], t)
    return { ...(await getMode(t)), changed: true }
  })
}

// ---------------------------------------------------------------- validity
function lotProblems(lot, binding, sku, now) {
  const p = []
  if (!lot) return ['lot_missing']
  if (lot.sku !== sku) p.push('lot_sku_mismatch')
  if (binding && Number(lot.bin_id) !== Number(binding.sale_bin_id)) p.push('lot_moved_from_sale_bin')
  if (lot.status !== 'ACTIVE') p.push(`lot_status_${lot.status}`)
  if (lot.quality_status !== 'PASSED') p.push(`lot_quality_${lot.quality_status}`)
  if (lot.expiry_date && new Date(lot.expiry_date) <= now) p.push('lot_expired')
  if (lot.bin_status && lot.bin_status !== 'ACTIVE') p.push(`bin_status_${lot.bin_status}`)
  return p
}

const LOT_COLS = 'l.id, l.lot_number, l.sku, l.qty, l.bin_id, l.status, l.quality_status, l.expiry_date, l.version, b.bin_code, b.status AS bin_status'

// ---------------------------------------------------------------- bindings (admin)
async function listBindings() {
  const now = new Date()
  const items = await sel('SELECT id, sku, name, price, status FROM items ORDER BY name, id')
  const binds = await sel('SELECT * FROM shop_sale_bindings WHERE shop_id = ?', [SHOP_ID])
  const lotIds = binds.map((b) => b.active_lot_id).filter(Boolean)
  const lots = lotIds.length ? await sel(`SELECT ${LOT_COLS} FROM lots l JOIN bins b ON b.id = l.bin_id WHERE l.id IN (?)`, [lotIds]) : []
  const L = new Map(lots.map((l) => [Number(l.id), l]))
  return items.map((it) => {
    const b = binds.find((x) => x.sku === it.sku)
    const lot = b && b.active_lot_id ? L.get(Number(b.active_lot_id)) : null
    const problems = !b || !b.active_lot_id ? ['unbound'] : lotProblems(lot, b, it.sku, now)
    if (it.status !== 'ACTIVE') problems.push(`item_status_${it.status}`)
    if (!(Number(it.price) > 0)) problems.push('no_price')
    return { item_id: it.id, sku: it.sku, name: it.name, price: it.price === null ? null : Number(it.price), item_status: it.status,
             binding: b ? { id: b.id, version: b.version, sale_bin_id: b.sale_bin_id, active_lot_id: b.active_lot_id, updated_at: b.updated_at } : null,
             lot: lot ? { id: lot.id, lot_number: lot.lot_number, qty: lot.qty, bin_code: lot.bin_code, status: lot.status, quality_status: lot.quality_status, expiry_date: lot.expiry_date } : null,
             sellable: problems.length === 0 && lot && lot.qty > 0, problems }
  })
}

async function eligibleLots(sku) {
  const now = new Date()
  const rows = await sel(`SELECT ${LOT_COLS}, sb.sku AS bound_sku FROM lots l JOIN bins b ON b.id = l.bin_id LEFT JOIN shop_sale_bindings sb ON sb.active_lot_id = l.id WHERE l.sku = ? ORDER BY b.bin_code, l.lot_number`, [sku])
  return rows.map((l) => ({ id: l.id, lot_number: l.lot_number, qty: l.qty, bin_id: l.bin_id, bin_code: l.bin_code, status: l.status, quality_status: l.quality_status,
                            expiry_date: l.expiry_date, bound_elsewhere: Boolean(l.bound_sku), problems: lotProblems(l, null, sku, now) }))
}

async function setBinding({ actor, sku, lotId, expectedVersion, note }) {
  return withRetry(async (t) => {
    const [item] = await sel('SELECT id, sku, status FROM items WHERE sku = ?', [sku], t)
    if (!item) throw new ShopError(404, 'ITEM_NOT_FOUND', 'Unknown SKU')
    const now = new Date()
    await exec('INSERT IGNORE INTO shop_sale_bindings (shop_id, sku, item_id, sale_bin_id, active_lot_id, version, updated_by, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, 0, ?, ?, ?)', [SHOP_ID, sku, item.id, actor.id, now, now], t)
    const [b] = await sel('SELECT * FROM shop_sale_bindings WHERE shop_id = ? AND sku = ? FOR UPDATE', [SHOP_ID, sku], t)
    if (expectedVersion !== undefined && expectedVersion !== null && Number(expectedVersion) !== Number(b.version)) {
      throw new ShopError(409, 'VERSION_CONFLICT', 'Binding changed; reload and confirm again', { current_version: b.version })
    }
    let toBin = null
    let toLot = null
    if (lotId !== null) {
      const [lot] = await sel(`SELECT ${LOT_COLS} FROM lots l JOIN bins b ON b.id = l.bin_id WHERE l.id = ? FOR UPDATE OF l`, [lotId], t)
      const problems = lotProblems(lot, null, sku, now)
      if (problems.length) throw new ShopError(409, 'LOT_NOT_ELIGIBLE', 'This lot cannot be used for sale', { problems })
      const [other] = await sel('SELECT shop_id, sku FROM shop_sale_bindings WHERE active_lot_id = ? AND id <> ?', [lot.id, b.id], t)
      if (other) throw new ShopError(409, 'LOT_ALREADY_BOUND', 'This lot is already bound for sale', { other })
      toBin = lot.bin_id; toLot = lot.id
    }
    await exec('UPDATE shop_sale_bindings SET sale_bin_id = ?, active_lot_id = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE id = ?', [toBin, toLot, actor.id, now, b.id], t)
    await exec('INSERT INTO shop_sale_binding_changes (binding_id, shop_id, sku, from_bin_id, from_lot_id, to_bin_id, to_lot_id, to_version, changed_by, changed_at, note) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [b.id, SHOP_ID, sku, b.sale_bin_id, b.active_lot_id, toBin, toLot, Number(b.version) + 1, actor.id, now, note ? String(note).slice(0, 255) : null], t)
    const [after] = await sel('SELECT * FROM shop_sale_bindings WHERE id = ?', [b.id], t)
    return after
  })
}

// ---------------------------------------------------------------- customer catalog
async function catalog() {
  const mode = await getMode()
  const rows = await listBindings()
  return { mode: mode.mode, shop_id: SHOP_ID, items: rows.filter((r) => r.item_status === 'ACTIVE').map((r) => ({
    item_id: r.item_id, name: r.name, price: r.price, sellable: Boolean(r.sellable), available: r.sellable ? r.lot.qty : 0,
    reason: r.sellable ? null : (r.problems.includes('unbound') ? 'not_on_sale' : r.problems.includes('no_price') ? 'no_price' : r.lot && r.lot.qty <= 0 ? 'out_of_stock' : 'unavailable') })) }
}

// ---------------------------------------------------------------- purchase (confirm pickup and charge to tab)
function normalizeBasket(items) {
  if (!Array.isArray(items) || !items.length || items.length > MAX_LINES) throw new ShopError(400, 'BAD_BASKET', `1-${MAX_LINES} products per confirmation`)
  const lines = items.map((l) => ({ item_id: Number(l?.item_id), qty: Number(l?.qty) }))
  if (lines.some((l) => !Number.isSafeInteger(l.item_id) || l.item_id <= 0 || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY)) throw new ShopError(400, 'BAD_BASKET', `Each product once, quantity 1-${MAX_QTY}`)
  if (new Set(lines.map((l) => l.item_id)).size !== lines.length) throw new ShopError(400, 'BAD_BASKET', 'Each product may appear only once')
  return lines.sort((a, b) => a.item_id - b.item_id)
}

const requestHash = (lines) => crypto.createHash('sha256').update(JSON.stringify([SHOP_ID, lines.map((l) => [l.item_id, l.qty])])).digest('hex')

async function purchaseView(purchaseId, t) {
  const [p] = await sel('SELECT *, DATE_FORMAT(tokyo_date, \'%Y-%m-%d\') AS tokyo_day FROM shop_purchases WHERE id = ?', [purchaseId], t)
  if (!p) return null
  const lines = await sel('SELECT line_no, item_id, sku, item_name, unit_price_cents, qty, line_cents, lot_number, bin_code FROM shop_purchase_lines WHERE purchase_id = ? ORDER BY line_no', [purchaseId], t)
  const [r] = await sel('SELECT status, requested_at, decided_at, decision_note FROM shop_return_requests WHERE purchase_id = ?', [purchaseId], t)
  return { id: p.id, purchase_no: p.purchase_no, request_id: p.request_id, status: p.status, billing_status: p.billing_status, total: Number(p.total_cents) / 100,
           confirmed_at: p.confirmed_at, tokyo_date: p.tokyo_day, tokyo_month: p.tokyo_month, settlement_id: p.settlement_id, source: 'INVENTORY_LINKED',
           lines: lines.map((l) => ({ ...l, unit_price: Number(l.unit_price_cents) / 100, line_total: Number(l.line_cents) / 100 })),
           return_request: r || null, return_window_until: new Date(new Date(p.confirmed_at).getTime() + RETURN_WINDOW_MS).toISOString() }
}

async function purchase({ user, requestId, items, faultAt }) {
  if (typeof requestId !== 'string' || !REQUEST_RE.test(requestId)) throw new ShopError(400, 'BAD_REQUEST_ID', 'Invalid request id')
  const lines = normalizeBasket(items)
  const hash = requestHash(lines)
  return withRetry(async (t) => {
    const [existing] = await sel('SELECT id, request_hash FROM shop_purchases WHERE user_id = ? AND request_id = ?', [user.id, requestId], t)
    if (existing) {
      if (existing.request_hash !== hash) throw new ShopError(409, 'REQUEST_ID_REUSED', 'This request id was already used for a different basket')
      return { replayed: true, purchase: await purchaseView(existing.id, t) }
    }
    const mode = await getMode(t, 'FOR SHARE')
    if (mode.mode !== 'INVENTORY_LINKED') throw new ShopError(409, 'MODE_NOT_LINKED', 'Inventory-linked pickup is not enabled for this shop')
    const ids = lines.map((l) => l.item_id)
    const itemRows = await sel('SELECT id, sku, name, price, status FROM items WHERE id IN (?)', [ids], t)
    const I = new Map(itemRows.map((r) => [Number(r.id), r]))
    const now = new Date()
    const problems = []
    for (const l of lines) {
      const it = I.get(l.item_id)
      if (!it) problems.push({ item_id: l.item_id, problem: 'unknown_item' })
      else if (it.status !== 'ACTIVE') problems.push({ item_id: l.item_id, problem: `item_status_${it.status}` })
      else if (!(Number(it.price) > 0)) problems.push({ item_id: l.item_id, problem: 'no_price' })
    }
    if (problems.length) throw new ShopError(409, 'NOT_SELLABLE', 'Some products cannot be confirmed', { problems })
    const skus = lines.map((l) => I.get(l.item_id).sku).sort()
    const binds = await sel('SELECT * FROM shop_sale_bindings WHERE shop_id = ? AND sku IN (?) ORDER BY sku FOR UPDATE', [SHOP_ID, skus], t)
    const B = new Map(binds.map((b) => [b.sku, b]))
    const lotIds = binds.map((b) => b.active_lot_id).filter(Boolean).map(Number).sort((a, b) => a - b)
    const lots = lotIds.length ? await sel(`SELECT ${LOT_COLS} FROM lots l JOIN bins b ON b.id = l.bin_id WHERE l.id IN (?) ORDER BY l.id FOR UPDATE OF l`, [lotIds], t) : []
    const L = new Map(lots.map((l) => [Number(l.id), l]))
    for (const l of lines) {
      const it = I.get(l.item_id); const b = B.get(it.sku)
      if (!b || !b.active_lot_id) { problems.push({ item_id: l.item_id, problem: 'not_on_sale' }); continue }
      const lot = L.get(Number(b.active_lot_id))
      const p = lotProblems(lot, b, it.sku, now)
      if (p.length) problems.push({ item_id: l.item_id, problem: p.join(',') })
      else if (lot.qty < l.qty) problems.push({ item_id: l.item_id, problem: 'insufficient_stock', available: lot.qty })
    }
    if (problems.length) throw new ShopError(409, 'NOT_SELLABLE', 'Some products cannot be confirmed; nothing was charged', { problems })
    const total = lines.reduce((n, l) => n + cents(I.get(l.item_id).price) * l.qty, 0)
    const purchaseNo = `SP${tokyoDate(now).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
    let purchaseId
    try {
      const ins = await insert('INSERT INTO shop_purchases (purchase_no, shop_id, user_id, username, request_id, request_hash, status, billing_status, total_cents, confirmed_at, tokyo_date, tokyo_month, spec_version) VALUES (?,?,?,?,?,?,\'CONFIRMED\',\'OPEN\',?,?,?,?,?)',
        [purchaseNo, SHOP_ID, user.id, user.username, requestId, hash, total, now, tokyoDate(now), tokyoMonth(now), SPEC_VERSION], t)
      purchaseId = ins
    } catch (e) {
      if (errno(e) === 1062) { const err = new Error('duplicate request id; re-read'); err.retryWithFreshRead = true; throw err }
      throw e
    }
    fault('after_purchase_insert', faultAt)
    for (let k = 0; k < lines.length; k += 1) {
      const l = lines[k]; const it = I.get(l.item_id); const b = B.get(it.sku); const lot = L.get(Number(b.active_lot_id))
      const unit = cents(it.price)
      const lineId = await insert('INSERT INTO shop_purchase_lines (purchase_id, line_no, item_id, sku, item_name, unit_price_cents, qty, line_cents, binding_id, binding_version, lot_id, lot_number, bin_id, bin_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [purchaseId, k + 1, it.id, it.sku, it.name, unit, l.qty, unit * l.qty, b.id, b.version, lot.id, lot.lot_number, lot.bin_id, lot.bin_code], t)
      const before = Number(lot.qty); const after = before - l.qty
      await exec('UPDATE lots SET qty = ?, version = version + 1, updatedAt = ? WHERE id = ?', [after, now, lot.id], t)
      lot.qty = after
      fault('after_lot_update', faultAt)
      await exec('INSERT INTO shop_stock_movements (source, purchase_id, line_id, lot_id, bin_id, sku, delta, before_qty, after_qty, created_by, created_at, tokyo_date) VALUES (\'SHOP_CONSUMPTION\',?,?,?,?,?,?,?,?,?,?,?)',
        [purchaseId, lineId, lot.id, lot.bin_id, it.sku, -l.qty, before, after, user.id, now, tokyoDate(now)], t)
      fault('after_movement_insert', faultAt)
      await exec('INSERT INTO transactions (transactionType, itemCode, itemName, quantity, beforeQuantity, afterQuantity, operator, operatorId, location, notes, transactionTime, createdAt, updatedAt, idempotency_key) VALUES (\'out\',?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [it.sku, it.name, l.qty, before, after, user.username, user.id, lot.bin_code, `SHOP_CONSUMPTION purchase=${purchaseNo} line=${k + 1} lot=${lot.lot_number}`, now, now, now, `shop-consume:${lineId}`], t)
    }
    await faultDelay('before_commit', faultAt)
    fault('before_commit', faultAt)
    return { replayed: false, purchase: await purchaseView(purchaseId, t) }
  })
}

async function purchaseByRequest(user, requestId) {
  const [p] = await sel('SELECT id FROM shop_purchases WHERE user_id = ? AND request_id = ?', [user.id, String(requestId)])
  return p ? purchaseView(p.id) : null
}

async function myPurchases(user, month) {
  const rows = await sel('SELECT id FROM shop_purchases WHERE user_id = ? AND tokyo_month = ? ORDER BY confirmed_at DESC', [user.id, month])
  const purchases = []
  for (const r of rows) purchases.push(await purchaseView(r.id))
  const sum = (f) => purchases.filter(f).reduce((n, p) => n + Math.round(p.total * 100), 0) / 100
  return { month, purchases, total_confirmed: sum((p) => p.status === 'CONFIRMED'), open: sum((p) => p.billing_status === 'OPEN'), settled: sum((p) => p.billing_status === 'SETTLED') }
}

// ---------------------------------------------------------------- returns
async function requestReturn({ actor, purchaseId, reason }) {
  const isStaff = ['admin', 'operator'].includes(actor.role)
  return withRetry(async (t) => {
    const [p] = await sel('SELECT * FROM shop_purchases WHERE id = ? FOR UPDATE', [purchaseId], t)
    if (!p || (!isStaff && Number(p.user_id) !== Number(actor.id))) throw new ShopError(404, 'NOT_FOUND', 'Purchase not found')
    const [existing] = await sel('SELECT status FROM shop_return_requests WHERE purchase_id = ?', [p.id], t)
    if (existing) return { replayed: true, purchase: await purchaseView(p.id, t) }
    if (p.billing_status === 'SETTLED') throw new ShopError(409, 'ALREADY_SETTLED', 'This purchase is settled; please contact staff for manual handling')
    if (p.status !== 'CONFIRMED' || p.billing_status !== 'OPEN') throw new ShopError(409, 'NOT_RETURNABLE', 'This purchase cannot be returned')
    if (!isStaff && Date.now() - new Date(p.confirmed_at).getTime() > RETURN_WINDOW_MS) throw new ShopError(409, 'WINDOW_CLOSED', 'Return requests close 15 minutes after confirmation; please ask staff')
    await exec('INSERT INTO shop_return_requests (purchase_id, status, requested_by, requested_role, requested_at, reason) VALUES (?, \'REQUESTED\', ?, ?, ?, ?)', [p.id, actor.id, actor.role, new Date(), reason ? String(reason).slice(0, 255) : null], t)
    return { replayed: false, purchase: await purchaseView(p.id, t) }
  })
}

async function approveReturn({ actor, purchaseId, note, faultAt }) {
  return withRetry(async (t) => {
    const [p] = await sel('SELECT * FROM shop_purchases WHERE id = ? FOR UPDATE', [purchaseId], t)
    if (!p) throw new ShopError(404, 'NOT_FOUND', 'Purchase not found')
    const [r] = await sel('SELECT * FROM shop_return_requests WHERE purchase_id = ? FOR UPDATE', [p.id], t)
    if (!r) throw new ShopError(409, 'NO_REQUEST', 'No return request for this purchase')
    if (r.status === 'APPROVED') return { replayed: true, purchase: await purchaseView(p.id, t) }
    if (r.status === 'REJECTED') throw new ShopError(409, 'REQUEST_REJECTED', 'This return request was rejected')
    if (p.billing_status !== 'OPEN' || p.status !== 'CONFIRMED') throw new ShopError(409, 'MANUAL_REVIEW_REQUIRED', 'Purchase is settled or no longer open; handle manually')
    const lines = await sel('SELECT * FROM shop_purchase_lines WHERE purchase_id = ? ORDER BY lot_id, line_no', [p.id], t)
    const lotIds = [...new Set(lines.map((l) => Number(l.lot_id)))].sort((a, b) => a - b)
    const lots = await sel(`SELECT ${LOT_COLS} FROM lots l JOIN bins b ON b.id = l.bin_id WHERE l.id IN (?) ORDER BY l.id FOR UPDATE OF l`, [lotIds], t)
    const L = new Map(lots.map((l) => [Number(l.id), l]))
    const now = new Date()
    const problems = []
    for (const line of lines) {
      const lot = L.get(Number(line.lot_id))
      const pr = lotProblems(lot, { sale_bin_id: line.bin_id }, line.sku, now)
      if (pr.length) problems.push({ line_no: line.line_no, lot_number: line.lot_number, problem: pr.join(',') })
    }
    if (problems.length) throw new ShopError(409, 'MANUAL_REVIEW_REQUIRED', 'Original lot changed (moved, expired or not active); stock was not restored', { problems })
    for (const line of lines) {
      const lot = L.get(Number(line.lot_id))
      const before = Number(lot.qty); const after = before + Number(line.qty)
      await exec('UPDATE lots SET qty = ?, version = version + 1, updatedAt = ? WHERE id = ?', [after, now, lot.id], t)
      lot.qty = after
      fault('return_after_lot_update', faultAt)
      await exec('INSERT INTO shop_stock_movements (source, purchase_id, line_id, lot_id, bin_id, sku, delta, before_qty, after_qty, created_by, created_at, tokyo_date) VALUES (\'SHOP_RETURN\',?,?,?,?,?,?,?,?,?,?,?)',
        [p.id, line.id, lot.id, lot.bin_id, line.sku, Number(line.qty), before, after, actor.id, now, tokyoDate(now)], t)
      await exec('INSERT INTO transactions (transactionType, itemCode, itemName, quantity, beforeQuantity, afterQuantity, operator, operatorId, location, notes, transactionTime, createdAt, updatedAt, idempotency_key) VALUES (\'in\',?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [line.sku, line.item_name, Number(line.qty), before, after, actor.username, actor.id, lot.bin_code, `SHOP_RETURN purchase=${p.purchase_no} line=${line.line_no} lot=${line.lot_number}`, now, now, now, `shop-return:${line.id}`], t)
    }
    await exec('UPDATE shop_purchases SET status = \'RETURNED\', billing_status = \'REVERSED\' WHERE id = ?', [p.id], t)
    await exec('UPDATE shop_return_requests SET status = \'APPROVED\', decided_by = ?, decided_at = ?, decided_tokyo_date = ?, decision_note = ? WHERE id = ?', [actor.id, now, tokyoDate(now), note ? String(note).slice(0, 255) : null, r.id], t)
    return { replayed: false, purchase: await purchaseView(p.id, t) }
  })
}

async function rejectReturn({ actor, purchaseId, note }) {
  return withRetry(async (t) => {
    const [r] = await sel('SELECT * FROM shop_return_requests WHERE purchase_id = ? FOR UPDATE', [purchaseId], t)
    if (!r) throw new ShopError(409, 'NO_REQUEST', 'No return request for this purchase')
    if (r.status === 'REJECTED') return { replayed: true, purchase: await purchaseView(purchaseId, t) }
    if (r.status === 'APPROVED') throw new ShopError(409, 'ALREADY_APPROVED', 'Already approved')
    await exec('UPDATE shop_return_requests SET status = \'REJECTED\', decided_by = ?, decided_at = ?, decided_tokyo_date = ?, decision_note = ? WHERE id = ?', [actor.id, new Date(), tokyoDate(new Date()), note ? String(note).slice(0, 255) : null, r.id], t)
    return { replayed: false, purchase: await purchaseView(purchaseId, t) }
  })
}

async function pendingReturns() {
  const rows = await sel('SELECT r.purchase_id FROM shop_return_requests r WHERE r.status = \'REQUESTED\' ORDER BY r.requested_at')
  const out = []
  for (const r of rows) out.push(await purchaseView(r.purchase_id))
  return out
}

// ---------------------------------------------------------------- monthly tabs and settlement (inventory-linked only)
async function monthTabs(month) {
  const rows = await sel(`SELECT p.user_id, MAX(p.username) AS username, COUNT(*) AS purchases,
      SUM(CASE WHEN p.billing_status = 'OPEN' THEN p.total_cents ELSE 0 END) AS open_cents,
      SUM(CASE WHEN p.billing_status = 'SETTLED' THEN p.total_cents ELSE 0 END) AS settled_cents,
      SUM(CASE WHEN p.billing_status = 'REVERSED' THEN p.total_cents ELSE 0 END) AS reversed_cents,
      SUM(CASE WHEN r.status = 'REQUESTED' THEN 1 ELSE 0 END) AS pending_returns
    FROM shop_purchases p LEFT JOIN shop_return_requests r ON r.purchase_id = p.id WHERE p.tokyo_month = ? GROUP BY p.user_id ORDER BY open_cents DESC`, [month])
  return { month, source: 'INVENTORY_LINKED', rows: rows.map((r) => ({ user_id: r.user_id, username: r.username, purchases: Number(r.purchases), open: Number(r.open_cents) / 100,
    settled: Number(r.settled_cents) / 100, reversed: Number(r.reversed_cents) / 100, pending_returns: Number(r.pending_returns) })) }
}

async function settle({ actor, userId, month }) {
  return withRetry(async (t) => {
    const open = await sel('SELECT id, total_cents FROM shop_purchases WHERE user_id = ? AND tokyo_month = ? AND billing_status = \'OPEN\' ORDER BY id FOR UPDATE', [userId, month], t)
    if (!open.length) throw new ShopError(409, 'NOTHING_OPEN', 'Nothing open for this user and month')
    const pending = await sel('SELECT purchase_id FROM shop_return_requests WHERE purchase_id IN (?) AND status = \'REQUESTED\' FOR UPDATE', [open.map((p) => p.id)], t)
    if (pending.length) throw new ShopError(409, 'PENDING_RETURNS', 'Resolve pending return requests before settling', { purchase_ids: pending.map((p) => p.purchase_id) })
    const amount = open.reduce((n, p) => n + Number(p.total_cents), 0)
    const sid = await insert('INSERT INTO shop_settlements (shop_id, user_id, tokyo_month, amount_cents, purchase_count, settled_by, settled_at, note) VALUES (?,?,?,?,?,?,?,?)', [SHOP_ID, userId, month, amount, open.length, actor.id, new Date(), 'manual cash collection recorded; no payment gateway'], t)
    await exec('UPDATE shop_purchases SET billing_status = \'SETTLED\', settlement_id = ? WHERE id IN (?)', [sid, open.map((p) => p.id)], t)
    return { settlement_id: sid, amount: amount / 100, purchases: open.length }
  })
}

// ---------------------------------------------------------------- consumption statistics and coverage
async function coverageDays(today = new Date()) {
  const allowFixture = process.env.SHOP_ALLOW_FIXTURE_COVERAGE === '1'
  const changes = await sel(`SELECT to_mode, changed_at, source FROM shop_mode_changes WHERE shop_id = ? ${allowFixture ? '' : "AND source = 'SYSTEM'"} ORDER BY changed_at, id`, [SHOP_ID])
  const intervals = []
  let openAt = null
  for (const c of changes) {
    if (c.to_mode === 'INVENTORY_LINKED' && !openAt) openAt = new Date(c.changed_at)
    if (c.to_mode !== 'INVENTORY_LINKED' && openAt) { intervals.push([openAt, new Date(c.changed_at)]); openAt = null }
  }
  if (openAt) intervals.push([openAt, today])
  const covered = new Set()
  const todayTokyo = tokyoDate(today)
  for (const [a, b] of intervals) {
    let d = new Date(`${tokyoDate(a)}T00:00:00+09:00`)
    while (d < b) {
      const next = new Date(d.getTime() + 86400000)
      const day = tokyoDate(d)
      if (d >= a && next <= b && day < todayTokyo) covered.add(day)
      d = next
    }
  }
  return { covered: [...covered].sort(), sources: [...new Set(changes.map((c) => c.source))], intervals: intervals.map(([a, b]) => [a.toISOString(), b.toISOString()]) }
}

async function dailyConsumption({ sku, from, to }) {
  const cond = sku ? 'AND l.sku = ?' : ''
  const args = sku ? [from, to, sku] : [from, to]
  const confirmed = await sel(`SELECT DATE_FORMAT(p.tokyo_date, '%Y-%m-%d') AS day, l.sku, SUM(l.qty) AS qty, COUNT(DISTINCT p.id) AS purchases FROM shop_purchase_lines l JOIN shop_purchases p ON p.id = l.purchase_id WHERE p.tokyo_date BETWEEN ? AND ? ${cond} GROUP BY day, l.sku`, args)
  const returned = await sel(`SELECT DATE_FORMAT(m.tokyo_date, '%Y-%m-%d') AS day, l.sku, SUM(m.delta) AS qty FROM shop_stock_movements m JOIN shop_purchase_lines l ON l.id = m.line_id WHERE m.source = 'SHOP_RETURN' AND m.tokyo_date BETWEEN ? AND ? ${cond} GROUP BY day, l.sku`, args)
  const key = (r) => `${String(r.day).slice(0, 10)}|${r.sku}`
  const map = new Map()
  for (const r of confirmed) map.set(key(r), { day: String(r.day).slice(0, 10), sku: r.sku, confirmed: Number(r.qty), returned: 0, purchases: Number(r.purchases) })
  for (const r of returned) {
    const k = key(r); const row = map.get(k) || { day: String(r.day).slice(0, 10), sku: r.sku, confirmed: 0, returned: 0, purchases: 0 }
    row.returned += Number(r.qty); map.set(k, row)
  }
  const rows = [...map.values()].map((r) => ({ ...r, net: r.confirmed - r.returned })).sort((a, b) => (a.day + a.sku).localeCompare(b.day + b.sku))
  return { from, to, sku: sku || null, source_label: 'user-declared and confirmed pickups (not automatically verified)', rows }
}

// Full Tokyo days (00:00-24:00 JST, before today) lying entirely inside one of the [start, end) intervals.
function fullDays(intervals, today) {
  const out = new Set(); const todayTokyo = tokyoDate(today)
  for (const [a, b] of intervals) {
    for (let d = new Date(`${tokyoDate(a)}T00:00:00+09:00`); d < b; d = new Date(d.getTime() + 86400000)) {
      const next = new Date(d.getTime() + 86400000); const day = tokyoDate(d)
      if (d >= a && next <= b && day < todayTokyo) out.add(day)
    }
  }
  return out
}

// Periods in which this SKU had an active sale binding (from the binding change log).
async function bindingIntervals(sku, today) {
  const rows = await sel('SELECT to_lot_id, changed_at FROM shop_sale_binding_changes WHERE shop_id = ? AND sku = ? ORDER BY changed_at, id', [SHOP_ID, sku])
  const iv = []; let openAt = null
  for (const r of rows) {
    if (r.to_lot_id !== null && !openAt) openAt = new Date(r.changed_at)
    if (r.to_lot_id === null && openAt) { iv.push([openAt, new Date(r.changed_at)]); openAt = null }
  }
  if (openAt) iv.push([openAt, today])
  return iv
}

// Office history for one SKU, kept in three separate layers (spec shop-lot-bin round 2):
//  1. shop-wide mode coverage (shop_mode_changes)     -> the shop recorded linked pickups that day
//  2. SKU coverage (shop_sale_binding_changes)          -> this SKU was bound for sale the whole day
//  3. recorded consumption (confirmed pickups/returns)  -> what was actually recorded
// None of these proves the SKU was sellable and in stock all day (quality, expiry, bin moves and stock level outside
// shop movements are not logged continuously), and a stock-out limits supply rather than showing zero demand.
// So no day is certified as a valid demand day and the office baseline stays unavailable. Unknown days stay null.
async function officeHistory(sku, today = new Date()) {
  const shop = await coverageDays(today)
  const shopSet = new Set(shop.covered)
  const boundSet = fullDays(await bindingIntervals(sku, today), today)
  const stockout = new Set((await sel("SELECT DISTINCT DATE_FORMAT(tokyo_date, '%Y-%m-%d') AS d FROM shop_stock_movements WHERE sku = ? AND after_qty = 0", [sku])).map((r) => String(r.d).slice(0, 10)))
  const yesterday = tokyoDate(new Date(today.getTime() - 86400000))
  const [firstRec] = await sel("SELECT DATE_FORMAT(MIN(p.tokyo_date), '%Y-%m-%d') AS d FROM shop_purchase_lines l JOIN shop_purchases p ON p.id = l.purchase_id WHERE l.sku = ?", [sku])
  const starts = [shop.covered[0], [...boundSet].sort()[0], firstRec && firstRec.d ? String(firstRec.d).slice(0, 10) : null].filter(Boolean).sort()
  const first = starts[0] && starts[0] <= yesterday ? starts[0] : null
  const byDay = new Map()
  if (first) for (const r of (await dailyConsumption({ sku, from: first, to: yesterday })).rows) byDay.set(r.day, r)
  const history = []
  if (first) {
    for (let d = new Date(`${first}T00:00:00+09:00`); tokyoDate(d) <= yesterday; d = new Date(d.getTime() + 86400000)) {
      const day = tokyoDate(d); const r = byDay.get(day)
      const shopLinked = shopSet.has(day); const bound = boundSet.has(day); const chain = shopLinked && bound
      const status = !shopLinked ? 'shop_not_linked_all_day' : !bound ? 'sku_not_bound_all_day' : stockout.has(day) ? 'stockout_observed' : 'availability_unverified'
      // recorded_*: actual records; 0 only where the recording chain (shop linked + SKU bound) ran all day; otherwise null = unknown
      const rec = r ? { confirmed: r.confirmed, returned: r.returned, net: r.net } : chain ? { confirmed: 0, returned: 0, net: 0 } : { confirmed: null, returned: null, net: null }
      history.push({ date: day, shop_linked_all_day: shopLinked, sku_bound_all_day: bound, stockout_observed: stockout.has(day), availability_verified: false,
        status, recorded_confirmed: rec.confirmed, recorded_returned: rec.returned, recorded_net: rec.net, demand: null, valid_demand_day: false })
    }
  }
  const layers = {
    shop_linked_all_day: history.filter((h) => h.shop_linked_all_day).length,
    sku_bound_all_day: history.filter((h) => h.sku_bound_all_day).length,
    recording_chain_all_day: history.filter((h) => h.shop_linked_all_day && h.sku_bound_all_day).length,
    stockout_observed: history.filter((h) => h.stockout_observed).length,
    availability_verified: 0,
    with_recorded_pickups: history.filter((h) => byDay.has(h.date)).length
  }
  const negative = history.filter((h) => h.recorded_net !== null && h.recorded_net < 0).map((h) => ({ date: h.date, net: h.recorded_net }))
  const reason = !first ? 'No complete day of office history for this SKU yet (stock-linked mode, its binding and any records started today or not at all; today is not a complete day).'
    : layers.sku_bound_all_day === 0 ? `This SKU was never bound for sale for a full day (${layers.shop_linked_all_day} full days of shop-wide linked mode do not count for it). No demand can be inferred.`
    : `This SKU was bound for ${layers.sku_bound_all_day} full days, but whether it was sellable and in stock all day is not recorded (quality, expiry, moves and stock level are not logged continuously; ${layers.stockout_observed} stock-out days seen). No day can be certified as a valid demand day, so the office baseline stays unavailable.`
  return { sku, spec: 'office-history-sku-coverage-r2', data_start: first, layers, history, negative_net_days: negative,
    unknown_days: history.filter((h) => h.recorded_net === null).map((h) => h.date),
    valid_demand_days: 0, consecutive_valid_days_to_yesterday: 0, eligible_for_baseline: false, baseline: null, reason,
    required_for_baseline: '28 consecutive valid demand days ending yesterday. A valid day needs: shop in linked mode all day, SKU bound all day, SKU sellable and in stock all day (availability evidence), and recorded pickups/returns. Even then the output is only an office-unvalidated 28-day mean, not a trained office model.',
    // kept for older callers
    covered_days: layers.shop_linked_all_day, consecutive_complete_days_to_yesterday: 0, missing_days_in_range: history.filter((h) => h.recorded_net === null).map((h) => h.date) }
}

module.exports = { SHOP_ID, SPEC_VERSION, ShopError, getMode, setMode, listBindings, eligibleLots, setBinding, catalog, purchase, purchaseByRequest, myPurchases,
  requestReturn, approveReturn, rejectReturn, pendingReturns, monthTabs, settle, dailyConsumption, coverageDays, officeHistory, tokyoDate, tokyoMonth }
