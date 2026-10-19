<template>
  <div class="tabs-page">
    <div class="ambient-light light-1" aria-hidden="true"></div>
    <div class="ambient-light light-2" aria-hidden="true"></div>

    <header class="top-bar glass">
      <button class="pill ghost" type="button" @click="router.push('/dashboard')">← Dashboard</button>
      <span class="title">Shop admin</span>
      <router-link class="pill ghost" to="/shop">Shop</router-link>
    </header>

    <main class="content">
      <section class="hero">
        <p class="eyebrow">Office shop</p>
        <h1>{{ { billing: 'Who owes what', stock: 'Sale stock', returns: 'Return requests', consumption: 'Consumption' }[section] }}</h1>
        <p class="subtitle" v-if="section === 'billing'">Mark a person's outstanding amount as settled once they have paid you. Settlement is a manual cash record only — no payment is processed and stock is not changed.</p>
        <p class="subtitle" v-else-if="section === 'stock'">Choose which lot on which shelf bin each product is sold from. Customers can only take from the bound lot; nothing is picked from other bins.</p>
        <p class="subtitle" v-else-if="section === 'returns'">Approve only after checking that the items were not taken or have been put back on the same shelf. Approval restores the original lot and reverses the tab in one step.</p>
        <p class="subtitle" v-else>Confirmed pickups and confirmed returns per Tokyo day and SKU. Source: user-declared, staff-unverified pickups. Moves, restock, scans and settlements are not included.</p>
      </section>

      <div class="segments glass" role="tablist">
        <button v-for="sct in sections" :key="sct.key" type="button" role="tab" :aria-selected="section === sct.key" :class="{ active: section === sct.key }" @click="go(sct.key)">{{ sct.label }}</button>
      </div>

      <section v-if="isAdmin && section === 'stock'" class="mode glass">
        <div>
          <strong>Shop mode: {{ modeInfo.mode === 'INVENTORY_LINKED' ? 'Stock-linked pickups' : 'Tab only (legacy, stock not changed)' }}</strong>
          <p class="muted">{{ modeInfo.mode === 'INVENTORY_LINKED' ? 'Customers confirm pickups against the bound lots; stock and tabs update together.' : 'Off by default. Bind lots first, then enable. Old tab entries stay as they are.' }}</p>
        </div>
        <button class="pill" :class="modeInfo.mode === 'INVENTORY_LINKED' ? 'ghost' : 'solid'" type="button" :disabled="busy" @click="toggleMode">{{ modeInfo.mode === 'INVENTORY_LINKED' ? 'Switch back to tab only' : 'Enable stock-linked pickups' }}</button>
      </section>

      <template v-if="section === 'stock'">
        <p v-if="lastMoved" class="state glass">Recently moved on this device: lot <strong>{{ lastMoved.lot_number }}</strong> ({{ lastMoved.qty }}) → bin {{ lastMoved.bin_code }}. <button class="text-btn" type="button" @click="openLots(lastMoved.sku, lastMoved.lot_number)">Use for {{ lastMoved.sku }}</button></p>
        <p v-if="stockError" class="state glass error" role="alert">{{ stockError }}</p>
        <article v-for="b in bindings" :key="b.sku" class="person glass">
          <div class="person-head">
            <span class="avatar" aria-hidden="true">{{ String(b.name || '?').slice(0, 1).toUpperCase() }}</span>
            <div class="who">
              <strong>{{ b.name }}</strong>
              <span>{{ b.sku }} · {{ b.price === null ? 'no price' : `¥${money(b.price)}` }}</span>
            </div>
            <div class="amounts">
              <span>{{ b.lot ? `Lot ${b.lot.lot_number} @ ${b.lot.bin_code}` : 'Not bound' }}</span>
              <strong :class="{ due: b.sellable }">{{ b.sellable ? `${b.lot.qty} on sale` : (b.problems || []).join(', ').replace(/_/g, ' ') }}</strong>
            </div>
          </div>
          <div class="person-actions">
            <button class="text-btn" type="button" @click="openLots(b.sku)">{{ lotsFor === b.sku ? 'Hide lots' : 'Choose lot' }}</button>
            <button v-if="b.binding && b.binding.active_lot_id" class="text-btn" type="button" :disabled="busy" @click="bind(b, null)">Unbind</button>
          </div>
          <ul v-if="lotsFor === b.sku" class="purchase-list">
            <li v-if="!lots.length">No lots for this SKU. Stock in and move it to a shelf bin first.</li>
            <li v-for="l in lots" :key="l.id" :class="{ hl: highlightLot === l.lot_number }">
              <span class="time">{{ l.bin_code }}</span>
              <span class="items">{{ l.lot_number }} · {{ l.qty }} · {{ l.quality_status }}{{ l.expiry_date ? ` · exp ${String(l.expiry_date).slice(0, 10)}` : '' }}</span>
              <span class="tag" :class="{ ok: !l.problems.length && !l.bound_elsewhere }">{{ l.bound_elsewhere ? 'bound' : l.problems.length ? l.problems.join(', ').replace(/_/g, ' ') : 'eligible' }}</span>
              <button v-if="!l.problems.length && !l.bound_elsewhere" class="pill solid" type="button" :disabled="busy" @click="bind(b, l)">Bind</button>
            </li>
          </ul>
        </article>
      </template>

      <template v-if="section === 'returns'">
        <p v-if="returnsError" class="state glass error" role="alert">{{ returnsError }}</p>
        <p v-if="!returnsList.length" class="state glass">No pending return requests.</p>
        <article v-for="p in returnsList" :key="p.id" class="person glass">
          <div class="person-head">
            <div class="who"><strong>{{ p.purchase_no }}</strong><span>{{ time(p.confirmed_at) }} · requested {{ time(p.return_request.requested_at) }}</span></div>
            <div class="amounts"><span>{{ p.lines.map((l) => `${l.item_name} ×${l.qty} (${l.lot_number} @ ${l.bin_code})`).join(', ') }}</span><strong>¥{{ money(p.total) }}</strong></div>
          </div>
          <div class="person-actions">
            <button v-if="isAdmin" class="text-btn" type="button" :disabled="busy" @click="decide(p, 'reject')">Reject (keep tab and stock)</button>
            <button class="pill solid" type="button" :disabled="busy" @click="decide(p, 'approve')">Items back on shelf — approve</button>
          </div>
        </article>
      </template>

      <template v-if="section === 'consumption'">
        <div class="controls glass">
          <input v-model="cons.from" type="date" class="date-in" aria-label="From">
          <input v-model="cons.to" type="date" class="date-in" aria-label="To">
          <input v-model.trim="cons.sku" class="date-in" placeholder="SKU (optional)" aria-label="SKU">
          <button class="pill ghost refresh" type="button" @click="loadConsumption">Show</button>
        </div>
        <p v-if="consError" class="state glass error" role="alert">{{ consError }}</p>
        <p v-else-if="consRows && !consRows.length" class="state glass">No confirmed pickups in this range.</p>
        <table v-else-if="consRows" class="cons glass">
          <thead><tr><th>Tokyo date</th><th>SKU</th><th>Confirmed</th><th>Returned</th><th>Net</th></tr></thead>
          <tbody><tr v-for="r in consRows" :key="r.day + r.sku"><td>{{ r.day }}</td><td>{{ r.sku }}</td><td>{{ r.confirmed }}</td><td>{{ r.returned }}</td><td>{{ r.net }}</td></tr></tbody>
        </table>
      </template>

      <div v-if="section === 'billing'" class="controls glass">
        <button class="icon" type="button" aria-label="Previous month" @click="shiftMonth(-1)">‹</button>
        <strong>{{ monthLabel }}</strong>
        <button class="icon" type="button" aria-label="Next month" :disabled="month >= currentMonth" @click="shiftMonth(1)">›</button>
        <button class="pill ghost refresh" type="button" :disabled="loading" @click="load">{{ loading ? 'Loading…' : 'Refresh' }}</button>
      </div>

      <p v-if="section === 'billing' && error" class="state glass error" role="alert">{{ error }}</p>
      <template v-if="section === 'billing' && linked">
        <h2 class="block-title">Stock-linked pickups</h2>
        <p v-if="!linked.rows.length" class="state glass">No stock-linked pickups in {{ monthLabel }}.</p>
        <article v-for="row in linked.rows" :key="'l' + row.user_id" class="person glass">
          <div class="person-head">
            <span class="avatar" aria-hidden="true">{{ String(row.username || '?').slice(0, 1).toUpperCase() }}</span>
            <div class="who"><strong>{{ row.username }}</strong><span>{{ row.purchases }} pickups<template v-if="row.pending_returns"> · {{ row.pending_returns }} return pending</template></span></div>
            <div class="amounts"><span>Settled ¥{{ money(row.settled) }} · returned ¥{{ money(row.reversed) }}</span><strong :class="{ due: row.open > 0 }">{{ row.open > 0 ? `Due ¥${money(row.open)}` : 'Nothing due' }}</strong></div>
          </div>
          <div class="person-actions">
            <span class="muted small">{{ row.pending_returns ? 'Resolve the return request first' : '' }}</span>
            <button v-if="row.open > 0" class="pill solid" type="button" :disabled="settling === 'l' + row.user_id || row.pending_returns > 0" @click="settleLinked(row)">{{ settling === 'l' + row.user_id ? 'Saving…' : `Mark ¥${money(row.open)} received` }}</button>
          </div>
        </article>
        <h2 class="block-title">Legacy tab (not linked to stock)</h2>
      </template>
      <template v-if="section === 'billing' && !error && data">
        <div class="totals">
          <div class="glass"><span>Total this month</span><strong>¥{{ money(data.grand_total) }}</strong></div>
          <div class="glass"><span>Still to settle</span><strong class="due">¥{{ money(data.outstanding_total) }}</strong></div>
          <div class="glass"><span>People</span><strong>{{ data.rows.length }}</strong></div>
        </div>

        <p v-if="!data.rows.length" class="state glass">No purchases in {{ monthLabel }}.</p>
        <article v-for="row in data.rows" :key="row.user_id" class="person glass">
          <div class="person-head">
            <span class="avatar" aria-hidden="true">{{ String(row.username || '?').slice(0, 1).toUpperCase() }}</span>
            <div class="who">
              <strong>{{ row.username }}</strong>
              <span>{{ row.count }} {{ row.count === 1 ? 'purchase' : 'purchases' }}<template v-if="row.cancelled"> · {{ row.cancelled }} undone</template></span>
            </div>
            <div class="amounts">
              <span>Total ¥{{ money(row.total) }}</span>
              <strong :class="{ due: row.outstanding > 0 }">{{ row.outstanding > 0 ? `Due ¥${money(row.outstanding)}` : 'Settled' }}</strong>
            </div>
          </div>
          <div class="person-actions">
            <button class="text-btn" type="button" @click="toggle(row.user_id)">{{ open.has(row.user_id) ? 'Hide purchases' : 'Show purchases' }}</button>
            <button v-if="row.outstanding > 0" class="pill solid" type="button" :disabled="settling === row.user_id" @click="settle(row)">{{ settling === row.user_id ? 'Saving…' : `Mark ¥${money(row.outstanding)} settled` }}</button>
          </div>
          <ul v-if="open.has(row.user_id)" class="purchase-list">
            <li v-for="p in row.purchases" :key="p.id" :class="{ cancelled: p.cancelled }">
              <span class="time">{{ time(p.created_at) }}</span>
              <span class="items">{{ p.items.map((i) => `${i.name} ×${i.qty}`).join(', ') }}</span>
              <span class="amt">¥{{ money(p.total) }}</span>
              <span class="tag" :class="{ ok: p.settlement_id && !p.cancelled }">{{ p.cancelled ? 'Undone' : p.settlement_id ? 'Settled' : 'Open' }}</span>
              <button v-if="!p.cancelled && !p.settlement_id" class="text-btn small" type="button" @click="voidPurchase(p)">Void</button>
            </li>
          </ul>
          <p v-if="row.settlements.length" class="settle-log">
            Settled: <span v-for="(s, k) in row.settlements" :key="s.id">{{ k ? ' · ' : '' }}¥{{ money(s.amount) }} on {{ time(s.at) }}</span>
          </p>
        </article>
      </template>
      <p v-else-if="section === 'billing'" class="state glass">Loading…</p>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const isAdmin = localStorage.getItem('userRole') === 'admin'
const sections = isAdmin
  ? [{ key: 'billing', label: 'Billing' }, { key: 'stock', label: 'Sale stock' }, { key: 'returns', label: 'Returns' }, { key: 'consumption', label: 'Consumption' }]
  : [{ key: 'returns', label: 'Returns' }]
const section = ref(sections.some((x) => x.key === route.query.section) ? route.query.section : sections[0].key)
const busy = ref(false)
const linked = ref(null)
const modeInfo = ref({ mode: 'LEGACY_TAB', version: 0 })
const bindings = ref([])
const lots = ref([])
const lotsFor = ref('')
const highlightLot = ref('')
const stockError = ref('')
const returnsList = ref([])
const returnsError = ref('')
const todayTokyo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())
const cons = ref({ from: `${todayTokyo.slice(0, 8)}01`, to: todayTokyo, sku: '' })
const consRows = ref(null)
const consError = ref('')
const lastMoved = (() => { try { const v = JSON.parse(localStorage.getItem('shop.lastMovedLot') || 'null'); return v && Date.now() - v.at < 2 * 3600 * 1000 ? v : null } catch (_) { return null } })()
const fmtMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit' })
const currentMonth = fmtMonth.format(new Date()).slice(0, 7)
const month = ref(currentMonth)
const data = ref(null)
const error = ref('')
const loading = ref(false)
const settling = ref(null)
const open = ref(new Set())

const monthLabel = computed(() => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month.value}-15T00:00:00Z`)))
const money = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
const time = (iso) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(new Date(iso))

async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options, headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' } })
  if (response.status === 401) { router.replace('/login'); throw new Error('Signed out') }
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) throw new Error(result?.message || `HTTP ${response.status}`)
  return result.data
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const both = await api(`/api/shop/v2/tabs?month=${month.value}`)
    linked.value = both.linked
    data.value = both.legacy
  } catch (e) { error.value = `Could not load tabs: ${e.message}` } finally { loading.value = false }
}

function go(key) {
  section.value = key
  router.replace({ query: { ...route.query, section: key } })
  loadSection()
}

async function loadSection() {
  if (section.value === 'billing') return load()
  if (section.value === 'stock') return loadStock()
  if (section.value === 'returns') return loadReturns()
  if (section.value === 'consumption') return loadConsumption()
}

async function loadStock() {
  stockError.value = ''
  try {
    const [m, b] = await Promise.all([api('/api/shop/v2/mode'), api('/api/shop/v2/bindings')])
    modeInfo.value = m
    bindings.value = b
  } catch (e) { stockError.value = `Could not load sale stock: ${e.message}` }
}

async function toggleMode() {
  const next = modeInfo.value.mode === 'INVENTORY_LINKED' ? 'LEGACY_TAB' : 'INVENTORY_LINKED'
  const msg = next === 'INVENTORY_LINKED'
    ? 'Enable stock-linked pickups?\n\nCustomers will confirm pickups against bound lots; stock and tabs update together. New legacy tab entries will be refused.'
    : 'Switch back to tab only?\n\nNew pickups will no longer change stock. Existing stock-linked records stay.'
  if (!window.confirm(msg)) return
  busy.value = true
  try { modeInfo.value = await api('/api/shop/v2/mode', { method: 'PUT', body: JSON.stringify({ mode: next, expected_version: modeInfo.value.version }) }) } catch (e) { stockError.value = e.message } finally { busy.value = false; loadStock() }
}

async function openLots(sku, highlight) {
  if (lotsFor.value === sku && !highlight) { lotsFor.value = ''; return }
  lotsFor.value = sku
  highlightLot.value = highlight || ''
  lots.value = []
  try { lots.value = await api(`/api/shop/v2/bindings/${encodeURIComponent(sku)}/lots`) } catch (e) { stockError.value = e.message }
}

async function bind(b, lot) {
  const text = lot ? `Sell ${b.name} from lot ${lot.lot_number} in bin ${lot.bin_code} (${lot.qty} now)?\n\nCheck that this lot is physically on that shelf.` : `Unbind ${b.name}? It will no longer be sold until a lot is bound.`
  if (!window.confirm(text)) return
  busy.value = true
  stockError.value = ''
  try {
    await api(`/api/shop/v2/bindings/${encodeURIComponent(b.sku)}`, { method: 'PUT', body: JSON.stringify({ lot_id: lot ? lot.id : null, expected_version: b.binding ? b.binding.version : 0, note: lot ? 'bound in Shop admin' : 'unbound in Shop admin' }) })
    lotsFor.value = ''
    await loadStock()
  } catch (e) { stockError.value = `Not saved: ${e.message}` } finally { busy.value = false }
}

async function loadReturns() {
  returnsError.value = ''
  try { returnsList.value = await api('/api/shop/v2/returns/pending') } catch (e) { returnsError.value = `Could not load returns: ${e.message}` }
}

async function decide(p, action) {
  const text = action === 'approve' ? `Approve return of ${p.purchase_no}?\n\nOnly if the items were not taken or are back on the same shelf. Stock goes back to the original lot and ¥${money(p.total)} is removed from the tab.` : `Reject the return of ${p.purchase_no}? The tab and stock stay as they are.`
  if (!window.confirm(text)) return
  busy.value = true
  returnsError.value = ''
  try { await api(`/api/shop/v2/purchases/${p.id}/return-${action}`, { method: 'POST', body: JSON.stringify({}) }) } catch (e) { returnsError.value = e.message } finally { busy.value = false; loadReturns() }
}

async function loadConsumption() {
  consError.value = ''
  try {
    const q = new URLSearchParams({ from: cons.value.from, to: cons.value.to })
    if (cons.value.sku) q.set('sku', cons.value.sku)
    consRows.value = (await api(`/api/shop/v2/consumption/daily?${q}`)).rows
  } catch (e) { consError.value = `Could not load consumption: ${e.message}` }
}

async function settleLinked(row) {
  if (!window.confirm(`Record that ${row.username} paid ¥${money(row.open)} for ${monthLabel.value}?\n\nOnly do this after you have received the money. Stock is not changed.`)) return
  settling.value = 'l' + row.user_id
  try { await api('/api/shop/v2/tabs/settle', { method: 'POST', body: JSON.stringify({ user_id: row.user_id, month: month.value }) }); await load() } catch (e) { error.value = `Could not settle: ${e.message}` } finally { settling.value = null }
}

function shiftMonth(delta) {
  const [y, m] = month.value.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  month.value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  data.value = null
  load()
}

function toggle(id) {
  const next = new Set(open.value)
  next.has(id) ? next.delete(id) : next.add(id)
  open.value = next
}

async function settle(row) {
  if (!window.confirm(`Mark ¥${money(row.outstanding)} from ${row.username} (${monthLabel.value}) as settled?\n\nOnly do this after you have received the money.`)) return
  settling.value = row.user_id
  try {
    await api('/api/shop/tabs/settle', { method: 'POST', body: JSON.stringify({ user_id: row.user_id, month: month.value }) })
    await load()
  } catch (e) { error.value = `Could not settle: ${e.message}` } finally { settling.value = null }
}

async function voidPurchase(p) {
  if (!window.confirm(`Void this purchase of ¥${money(p.total)}? It will no longer count towards the tab.`)) return
  try {
    await api(`/api/shop/purchases/${encodeURIComponent(p.id)}/cancel`, { method: 'POST' })
    await load()
  } catch (e) { error.value = `Could not void: ${e.message}` }
}

onMounted(() => {
  loadSection()
  if (route.query.sku && isAdmin) openLots(String(route.query.sku), route.query.lot ? String(route.query.lot) : '')
})
</script>

<style scoped>
.tabs-page { position: relative; min-height: 100vh; overflow-x: hidden; background-color: var(--bg-primary); color: var(--text-primary); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif; text-align: left; -webkit-font-smoothing: antialiased; }
.ambient-light { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.7; pointer-events: none; }
.light-1 { top: -15%; left: -20%; width: 70vw; height: 70vw; background: radial-gradient(circle, var(--light-1), transparent 70%); }
.light-2 { bottom: -20%; right: -20%; width: 80vw; height: 80vw; background: radial-gradient(circle, var(--light-3), transparent 70%); }
.glass { background: var(--glass-bg); backdrop-filter: blur(30px) saturate(160%); -webkit-backdrop-filter: blur(30px) saturate(160%); border: 1px solid var(--glass-border); box-shadow: var(--card-shadow); }
.top-bar { position: sticky; top: 12px; z-index: 10; max-width: 960px; margin: 12px auto 0; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-radius: 999px; }
.top-bar .title { font-weight: 650; font-size: 17px; }
.pill { display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 0 16px; border-radius: 999px; font: inherit; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; }
.pill.ghost { border: 1px solid var(--glass-border); background: var(--input-bg); color: var(--text-primary); }
.pill.solid { border: 0; background: var(--button-bg); color: var(--button-text); }
.pill:disabled { opacity: 0.6; cursor: wait; }
.content { position: relative; z-index: 1; max-width: 960px; margin: 0 auto; padding: 32px 20px 80px; box-sizing: border-box; }
.hero h1 { margin: 0; font-size: clamp(32px, 6vw, 46px); letter-spacing: -0.035em; }
.eyebrow { margin: 0 0 8px; color: var(--text-secondary); font-size: 15px; }
.subtitle { margin: 12px 0 22px; color: var(--text-secondary); font-size: 15px; line-height: 1.5; max-width: 720px; }
.controls { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 999px; margin-bottom: 16px; }
.controls strong { min-width: 150px; text-align: center; font-size: 17px; }
.controls .icon { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--glass-border); background: var(--input-bg); color: var(--text-primary); font-size: 20px; cursor: pointer; }
.controls .icon:disabled { opacity: 0.35; cursor: default; }
.controls .refresh { margin-left: auto; }
.totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
.totals > div { padding: 16px 18px; border-radius: 22px; }
.totals span { display: block; color: var(--text-secondary); font-size: 13px; }
.totals strong { font-size: 26px; font-variant-numeric: tabular-nums; }
.due { color: var(--accent-blue); }
.person { padding: 16px 18px; border-radius: 24px; margin-bottom: 12px; }
.person-head { display: flex; align-items: center; gap: 14px; }
.avatar { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border-radius: 50%; background: linear-gradient(135deg, #bf5af2, #5e5ce6); color: #fff; font-weight: 700; }
.who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.who span, .amounts span { color: var(--text-secondary); font-size: 13px; }
.amounts { display: flex; flex-direction: column; align-items: flex-end; font-variant-numeric: tabular-nums; }
.person-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 12px; }
.text-btn { border: 0; background: transparent; color: var(--accent-blue); font: inherit; font-size: 14px; font-weight: 550; cursor: pointer; padding: 6px 2px; }
.text-btn.small { font-size: 13px; }
.purchase-list { list-style: none; margin: 10px 0 0; padding: 0; }
.purchase-list li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--glass-border); font-size: 14px; flex-wrap: wrap; }
.purchase-list li.cancelled .items, .purchase-list li.cancelled .amt { opacity: 0.45; text-decoration: line-through; }
.time { color: var(--text-secondary); font-size: 12px; min-width: 100px; }
.items { flex: 1; min-width: 160px; overflow-wrap: anywhere; }
.amt { font-weight: 650; font-variant-numeric: tabular-nums; }
.tag { padding: 2px 9px; border-radius: 999px; background: var(--input-bg); border: 1px solid var(--glass-border); color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.tag.ok { color: #30d158; }
.settle-log { margin: 10px 0 0; color: var(--text-secondary); font-size: 12px; }
.state { padding: 18px 20px; border-radius: 20px; color: var(--text-secondary); }
.state.error { color: #ff453a; }
.segments { display: flex; gap: 6px; padding: 6px; border-radius: 999px; margin-bottom: 16px; overflow-x: auto; }
.segments button { flex: none; border: 0; background: transparent; color: var(--text-primary); font: inherit; font-size: 14px; font-weight: 600; padding: 8px 16px; border-radius: 999px; cursor: pointer; }
.segments button.active { background: var(--button-bg); color: var(--button-text); }
.mode { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 18px; border-radius: 24px; margin-bottom: 14px; }
.mode p { margin: 4px 0 0; }
.muted { color: var(--text-secondary); font-size: 13px; }
.small { font-size: 12px; }
.block-title { font-size: 18px; margin: 18px 4px 10px; }
.purchase-list li.hl { background: rgba(10, 132, 255, 0.12); border-radius: 10px; }
.date-in { height: 36px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--input-bg); color: var(--text-primary); padding: 0 12px; font: inherit; }
.cons { width: 100%; border-collapse: collapse; border-radius: 20px; overflow: hidden; }
.cons th, .cons td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--glass-border); font-size: 14px; }
.cons td:nth-child(n+3), .cons th:nth-child(n+3) { text-align: right; }
@media (max-width: 640px) {
  .top-bar { margin: 10px 12px 0; }
  .content { padding: 24px 16px 80px; }
  .totals { grid-template-columns: 1fr 1fr; }
  .totals > div:last-child { display: none; }
  .person-actions { flex-wrap: wrap; }
}
</style>
