// Office shop tab (ledger) for monthly settlement.
// Append-only JSONL file: purchases, cancellations and monthly settlements are events; nothing is edited or deleted.
// No payment is taken here and no inventory is changed.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const CANCEL_WINDOW_MS = 15 * 60 * 1000
const monthFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit' })

function tokyoMonth(iso) {
  const parts = monthFormatter.formatToParts(new Date(iso))
  return `${parts.find((p) => p.type === 'year').value}-${parts.find((p) => p.type === 'month').value}`
}

class TabError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function createShopTab({ directory = process.env.SHOP_TAB_DIR || path.resolve(__dirname, '../data/shop-tab'), now = () => new Date() } = {}) {
  const file = path.join(directory, 'events.jsonl')
  let events = null

  function load() {
    if (events) return events
    events = []
    if (fs.existsSync(file)) {
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (line.trim()) events.push(JSON.parse(line))
      }
    }
    return events
  }

  function append(event) {
    load()
    fs.mkdirSync(directory, { recursive: true })
    fs.appendFileSync(file, JSON.stringify(event) + '\n')
    events.push(event)
    return event
  }

  // A settlement lists the purchases it covers; purchases made later stay outstanding and can be settled again.
  function state() {
    const purchases = new Map()
    const settlements = []
    for (const e of load()) {
      if (e.type === 'purchase') purchases.set(e.id, { ...e, cancelled: null, settlement_id: null })
      else if (e.type === 'cancel' && purchases.has(e.purchase_id)) purchases.get(e.purchase_id).cancelled = { by: e.by, at: e.at }
      else if (e.type === 'settle') {
        settlements.push(e)
        for (const id of e.purchase_ids) if (purchases.has(id)) purchases.get(id).settlement_id = e.id
      }
    }
    return { purchases, settlements }
  }

  const sum = (list) => Math.round(list.reduce((acc, p) => acc + p.total_cents, 0))
  const view = (p) => ({ ...p, total: p.total_cents / 100, cancellable_until: new Date(Date.parse(p.created_at) + CANCEL_WINDOW_MS).toISOString() })
  const summarize = (list) => {
    const active = list.filter((p) => !p.cancelled)
    return { count: active.length, cancelled: list.length - active.length, total: sum(active) / 100, outstanding: sum(active.filter((p) => !p.settlement_id)) / 100 }
  }

  // Lookup of one user's own entry by request id (used to verify an unanswered request; never creates anything).
  function findPurchase({ userId, requestId }) {
    const { purchases } = state()
    const p = [...purchases.values()].find((x) => x.user_id === userId && x.request_id === requestId)
    return p ? view(p) : null
  }

  // lines: [{ item: { id, name, price }, qty }]; prices come from the database, never from the client.
  function recordPurchase({ user, lines, requestId }) {
    const { purchases } = state()
    const replay = [...purchases.values()].find((p) => p.user_id === user.id && p.request_id === requestId)
    if (replay) return { purchase: view(replay), replayed: true }
    const at = now().toISOString()
    const month = tokyoMonth(at)
    const items = lines.map(({ item, qty }) => {
      const unitCents = Math.round(Number(item.price) * 100)
      return { item_id: item.id, name: item.name, unit_price: unitCents / 100, qty, line_cents: unitCents * qty }
    })
    const event = append({ type: 'purchase', id: crypto.randomUUID(), request_id: requestId, user_id: user.id, username: user.username,
      month, created_at: at, items, total_cents: items.reduce((a, i) => a + i.line_cents, 0) })
    return { purchase: view({ ...event, cancelled: null, settlement_id: null }), replayed: false }
  }

  function cancelPurchase({ id, actor, isAdmin }) {
    const { purchases } = state()
    const p = purchases.get(id)
    if (!p || (!isAdmin && p.user_id !== actor.id)) throw new TabError(404, 'Purchase not found')
    if (p.cancelled) return { purchase: view(p), replayed: true }
    if (p.settlement_id) throw new TabError(409, 'This purchase is already settled')
    if (!isAdmin && now() - Date.parse(p.created_at) > CANCEL_WINDOW_MS) throw new TabError(409, 'Purchases can only be undone within 15 minutes; please ask staff')
    const e = append({ type: 'cancel', purchase_id: id, by: actor.id, by_role: isAdmin ? 'admin' : 'owner', at: now().toISOString() })
    return { purchase: view({ ...p, cancelled: { by: e.by, at: e.at } }), replayed: false }
  }

  function myTab({ userId, month }) {
    const { purchases, settlements } = state()
    const list = [...purchases.values()].filter((p) => p.user_id === userId && p.month === month).sort((a, b) => b.created_at.localeCompare(a.created_at))
    return { month, purchases: list.map(view), ...summarize(list), settlements: settlements.filter((e) => e.user_id === userId && e.month === month) }
  }

  function monthTabs({ month }) {
    const { purchases, settlements } = state()
    const byUser = new Map()
    for (const p of purchases.values()) {
      if (p.month !== month) continue
      const u = byUser.get(p.user_id) || { user_id: p.user_id, username: p.username, purchases: [] }
      u.username = p.username
      u.purchases.push(p)
      byUser.set(p.user_id, u)
    }
    const rows = [...byUser.values()].map((u) => ({ user_id: u.user_id, username: u.username, ...summarize(u.purchases),
      settlements: settlements.filter((e) => e.user_id === u.user_id && e.month === month),
      purchases: u.purchases.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(view) })).sort((a, b) => b.total - a.total)
    const cents = (k) => rows.reduce((a, r) => a + Math.round(r[k] * 100), 0) / 100
    return { month, rows, grand_total: cents('total'), outstanding_total: cents('outstanding') }
  }

  // Marks every outstanding (not cancelled, not yet settled) purchase of this user and month as paid.
  function settle({ userId, month, actor }) {
    const { purchases } = state()
    const open = [...purchases.values()].filter((p) => p.user_id === userId && p.month === month && !p.cancelled && !p.settlement_id)
    if (!open.length) throw new TabError(409, 'Nothing outstanding for this user and month')
    const e = append({ type: 'settle', id: crypto.randomUUID(), user_id: userId, month, purchase_ids: open.map((p) => p.id),
      amount: sum(open) / 100, by: actor.id, at: now().toISOString() })
    return { settlement: e, replayed: false }
  }

  return { recordPurchase, findPurchase, cancelPurchase, myTab, monthTabs, settle, tokyoMonth, file }
}

module.exports = { createShopTab, TabError, tokyoMonth }
