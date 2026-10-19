<template>
  <div class="shop-page">
    <!-- Ambient light, same as the sign-in page -->
    <div class="ambient-light light-1" aria-hidden="true"></div>
    <div class="ambient-light light-2" aria-hidden="true"></div>
    <div class="ambient-light light-3" aria-hidden="true"></div>

    <header class="top-bar glass">
      <a class="brand" href="/shop" aria-label="Office shop">
        <span class="brand-icon" aria-hidden="true">🛍️</span>
        <span>Office Shop</span>
      </a>
      <div class="top-actions">
        <router-link v-if="isAdmin" class="pill ghost" to="/shop-tabs">Tabs</router-link>
        <router-link v-if="isStaff" class="pill ghost" to="/dashboard">Dashboard</router-link>
        <span v-if="username" class="avatar" :title="username" aria-hidden="true">{{ initials(username) }}</span>
        <button class="pill ghost" type="button" @click="signOut">Sign out</button>
      </div>
    </header>

    <main class="content">
      <section class="hero">
        <p class="eyebrow">Hi{{ username ? `, ${username}` : '' }}</p>
        <h1>What would you like today?</h1>
        <p class="subtitle" v-if="linked">Take items from the shelf, then confirm your pickup here. Stock and your monthly tab update together.</p>
        <p class="subtitle" v-else-if="legacyActive">Pick snacks and drinks. Your selection stays on this page only.</p>
        <p class="subtitle" v-else-if="modeState === 'loading'">Checking how this shop records pickups…</p>
        <p class="subtitle" v-else>Shop mode could not be confirmed; confirming is paused.</p>
      </section>

      <form class="search glass" role="search" @submit.prevent="loadCatalog">
        <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <label class="sr-only" for="catalog-search">Search products</label>
        <input id="catalog-search" v-model.trim="searchQuery" type="search" maxlength="80" placeholder="Search products or categories" :disabled="loading" />
        <button class="pill solid" type="submit" :disabled="loading">{{ loading ? '…' : 'Search' }}</button>
      </form>

      <div v-if="categories.length > 1" class="chips" role="group" aria-label="Filter by category">
        <button v-for="c in ['All', ...categories]" :key="c" type="button" class="chip glass" :class="{ active: activeCategory === c }" @click="activeCategory = c">{{ c }}</button>
      </div>

      <p v-if="modeState === 'unknown'" class="state glass error" role="alert" data-testid="mode-unknown">We cannot confirm right now whether this shop records pickups with stock or as a tab, so confirming is paused. Nothing has been changed. <button class="text-btn" type="button" @click="reloadMode">Try again</button></p>

      <p v-if="errorMessage" class="state glass error" role="alert">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state glass" role="status">Loading products…</p>

      <section v-else aria-labelledby="catalog-heading">
        <div class="section-head">
          <h2 id="catalog-heading">Products</h2>
          <span class="muted">{{ total > items.length ? `${visibleItems.length} of ${total}` : `${visibleItems.length} items` }}</span>
        </div>

        <p v-if="!visibleItems.length" class="state glass">{{ searchQuery ? 'No products match this search.' : 'No products are available right now.' }}</p>

        <div v-else class="grid">
          <button v-for="item in visibleItems" :key="item.id" type="button" class="card glass" :class="{ picked: isSelected(item.id), unavailable: linked && !item.sellable }" :aria-pressed="isSelected(item.id)" :aria-disabled="linked && !item.sellable" @click="toggleSelection(item)">
            <span class="thumb" :style="{ background: tint(item.name) }" aria-hidden="true">{{ initials(item.name) }}</span>
            <span class="card-body">
              <span class="category">{{ item.category || 'Product' }}</span>
              <span class="name">{{ item.name }}</span>
              <span v-if="item.description" class="desc">{{ item.description }}</span>
              <span class="meta">{{ item.unit }} · <template v-if="item.price !== null">¥{{ formatPrice(item.price) }}</template><template v-else>price not set</template></span>
              <span v-if="linked" class="stock" :class="{ off: !item.sellable }">{{ item.sellable ? `${item.available} left on the shelf` : reasonLabel(item.reason) }}</span>
            </span>
            <span class="check" aria-hidden="true">
              <svg v-if="isSelected(item.id)" viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <svg v-else viewBox="0 0 24 24"><path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
            </span>
          </button>
        </div>
      </section>

      <section id="selection" class="selection glass" aria-labelledby="selected-heading" aria-live="polite">
        <div class="section-head">
          <h2 id="selected-heading">Your selection</h2>
          <button v-if="selectedItems.length" class="text-btn" type="button" @click="selectedItems = []">Clear all</button>
        </div>
        <p v-if="!selectedItems.length" class="muted">Nothing selected yet. Tap a product to add it.</p>
        <ul v-else class="selected-list">
          <li v-for="item in selectedItems" :key="item.id">
            <span class="mini-thumb" :style="{ background: tint(item.name) }" aria-hidden="true">{{ initials(item.name) }}</span>
            <span class="selected-name">{{ item.name }}<small v-if="item.price === null" class="warn">Price not set</small></span>
            <span class="stepper" role="group" :aria-label="`Quantity of ${item.name}`">
              <button type="button" :disabled="item.qty <= 1" aria-label="Decrease" @click="setQty(item, item.qty - 1)">−</button>
              <span>{{ item.qty }}</span>
              <button type="button" :disabled="item.qty >= maxQty(item)" aria-label="Increase" @click="setQty(item, item.qty + 1)">+</button>
            </span>
            <span class="line-total">{{ item.price === null ? '—' : `¥${formatPrice(item.price * item.qty)}` }}</span>
            <button class="icon-btn" type="button" :aria-label="`Remove ${item.name}`" @click="toggleSelection(item)">✕</button>
          </li>
        </ul>
        <div v-if="selectedItems.length" class="checkout">
          <div>
            <span class="muted">Total</span>
            <strong class="grand">¥{{ formatPrice(selectionTotal) }}</strong>
          </div>
          <button class="pill solid big" type="button" :disabled="checkingOut || hasUnpriced || modeState !== 'known' || Boolean(pending)" @click="addToTab">{{ checkingOut ? (linked ? 'Confirming…' : 'Adding…') : modeState !== 'known' ? 'Paused' : (linked ? 'Confirm pickup & add to tab' : 'Add to my tab') }}</button>
        </div>
        <p v-if="hasUnpriced && selectedItems.length" class="hint warn">Some products have no price yet, so they cannot go on the tab. Please ask staff.</p>
        <p v-if="checkoutError" class="hint error-text" role="alert">{{ checkoutError }}</p>
        <p v-if="pending && selectedItems.length" class="hint warn">New confirmations are paused until your earlier request below is checked.</p>
        <p v-if="linked" class="note">Stock-linked: confirming records that you have taken these items, updates the shelf stock and adds the amount to your monthly tab (settled with staff). No payment is taken here. Selecting items alone changes nothing.</p>
        <p v-else-if="legacyActive" class="note">Tab mode: purchases are recorded to your account and settled monthly with staff. No payment is taken here and stock is not changed.</p>
      </section>

      <section v-if="pending" class="pending glass" role="status" aria-live="polite" data-testid="pending">
        <strong>{{ pendingState === 'not_found_yet' ? 'No record found yet' : 'Earlier request not verified yet' }}</strong>
        <p class="muted">{{ pendingState === 'not_found_yet' ? 'No record of this request so far. That does not prove it was not recorded: it may still be in progress. Check again in a moment. Sending it again uses the same request and the same items, so it can be recorded at most once.' : 'We did not get a clear answer for your last request. Check its status first; new confirmations are paused until it is resolved. It can be recorded at most once.' }}</p>
        <p class="muted small">{{ pending.api === 'v2' ? 'Stock-linked pickup' : 'Tab entry' }}: {{ pending.items.map((i) => `${i.name} ×${i.qty}`).join(', ') }} · request {{ pending.request_id.slice(0, 8) }}<template v-if="modeState === 'known' && pendingModeDiffers"> · made before the shop mode changed; it is checked with the same service it was sent to</template></p>
        <div class="pending-actions">
          <button class="pill ghost" type="button" :disabled="checkingOut" @click="checkPending">{{ checkingOut ? 'Checking…' : 'Check status' }}</button>
          <button v-if="pendingState === 'not_found_yet'" class="pill solid" type="button" :disabled="checkingOut" @click="retryPending">Send the same request again</button>
        </div>
      </section>

      <section v-if="lastPurchase" class="receipt glass" role="status" aria-live="polite" data-testid="receipt">
        <div class="section-head"><h2>Pickup confirmed</h2><span class="tag ok">{{ lastPurchase.purchase_no }}</span></div>
        <ul class="receipt-lines"><li v-for="l in lastPurchase.lines" :key="l.line_no"><span>{{ l.item_name }} ×{{ l.qty }}</span><span>¥{{ formatPrice(l.line_total) }}</span></li></ul>
        <p class="muted">Total ¥{{ formatPrice(lastPurchase.total) }} · stock updated · added to your tab (open, settled monthly with staff)</p>
      </section>

      <section v-if="linked || hasLinkedHistory" class="tab glass" aria-labelledby="ltab-heading" data-testid="linked-history">
        <div class="section-head">
          <h2 id="ltab-heading">Stock-linked pickups · {{ monthLabel }}</h2>
          <span class="muted" v-if="linkedTab">{{ linkedTab.purchases.length }} {{ linkedTab.purchases.length === 1 ? 'confirmation' : 'confirmations' }}</span>
        </div>
        <p v-if="linkedTabError" class="hint error-text" role="alert">{{ linkedTabError }}</p>
        <template v-else-if="linkedTab">
          <div class="tab-totals">
            <div><span class="muted">Confirmed this month</span><strong>¥{{ formatPrice(linkedTab.total_confirmed) }}</strong></div>
            <div><span class="muted">To settle</span><strong :class="{ due: linkedTab.open > 0 }">¥{{ formatPrice(linkedTab.open) }}</strong></div>
          </div>
          <p v-if="!linkedTab.purchases.length" class="muted">No pickups this month yet.</p>
          <ul v-else class="purchase-list">
            <li v-for="p in linkedTab.purchases" :key="p.id" :class="{ cancelled: p.status === 'RETURNED' }">
              <div class="purchase-main">
                <span class="purchase-time">{{ formatTime(p.confirmed_at) }} · {{ p.purchase_no }}</span>
                <span class="purchase-items">{{ p.lines.map((i) => `${i.item_name} ×${i.qty}`).join(', ') }}</span>
              </div>
              <span class="purchase-amount">¥{{ formatPrice(p.total) }}</span>
              <span v-if="p.status === 'RETURNED'" class="tag">Returned</span>
              <span v-else-if="p.billing_status === 'SETTLED'" class="tag ok">Settled</span>
              <span v-else-if="p.return_request && p.return_request.status === 'REQUESTED'" class="tag">Return requested</span>
              <span v-else-if="p.return_request && p.return_request.status === 'REJECTED'" class="tag">Return declined</span>
              <button v-else-if="canRequestReturn(p)" class="text-btn" type="button" :disabled="undoingId === p.id" @click="requestReturn(p)">Request return</button>
              <span v-else class="tag">Open</span>
            </li>
          </ul>
          <p class="note">A return request does not change stock or your tab by itself; staff confirm it after checking the items. Within 15 minutes you can request it here, later please ask staff.</p>
        </template>
        <p v-else class="muted">Loading your pickups…</p>
      </section>

      <section v-if="legacyActive || hasLegacyHistory" class="tab glass" aria-labelledby="tab-heading" data-testid="legacy-history">
        <div class="section-head">
          <h2 id="tab-heading">{{ legacyActive ? 'My tab' : 'Tab entries (not linked to stock)' }} · {{ monthLabel }}</h2>
          <span class="muted" v-if="tab">{{ tab.count }} {{ tab.count === 1 ? 'purchase' : 'purchases' }}</span>
        </div>
        <p v-if="tabError" class="hint error-text" role="alert">{{ tabError }}</p>
        <template v-else-if="tab">
          <div class="tab-totals">
            <div><span class="muted">This month</span><strong>¥{{ formatPrice(tab.total) }}</strong></div>
            <div><span class="muted">To settle</span><strong :class="{ due: tab.outstanding > 0 }">¥{{ formatPrice(tab.outstanding) }}</strong></div>
          </div>
          <p v-if="!tab.purchases.length" class="muted">No purchases this month yet.</p>
          <ul v-else class="purchase-list">
            <li v-for="p in tab.purchases" :key="p.id" :class="{ cancelled: p.cancelled }">
              <div class="purchase-main">
                <span class="purchase-time">{{ formatTime(p.created_at) }}</span>
                <span class="purchase-items">{{ p.items.map((i) => `${i.name} ×${i.qty}`).join(', ') }}</span>
              </div>
              <span class="purchase-amount">¥{{ formatPrice(p.total) }}</span>
              <span v-if="p.cancelled" class="tag">Undone</span>
              <span v-else-if="p.settlement_id" class="tag ok">Settled</span>
              <button v-else-if="canUndo(p)" class="text-btn" type="button" :disabled="undoingId === p.id" @click="undo(p)">Undo</button>
              <span v-else class="tag">Open</span>
            </li>
          </ul>
        </template>
        <p v-else class="muted">Loading your tab…</p>
      </section>
    </main>

    <transition name="rise">
      <a v-if="selectedItems.length" class="floating-bar glass" href="#selection">
        <span class="count">{{ selectedCount }}</span>
        <span>¥{{ formatPrice(selectionTotal) }}</span>
        <span class="view">Review ›</span>
      </a>
    </transition>
    <transition name="rise">
      <div v-if="toast" class="toast glass" role="status">{{ toast }}</div>
    </transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = localStorage.getItem('username') || ''
const isStaff = ['admin', 'operator'].includes(localStorage.getItem('userRole'))
const isAdmin = localStorage.getItem('userRole') === 'admin'
const items = ref([])
const total = ref(0)
const selectedItems = ref([])
const searchQuery = ref('')
const activeCategory = ref('All')
const loading = ref(false)
const errorMessage = ref('')
const checkingOut = ref(false)
const checkoutError = ref('')
const tab = ref(null)
const tabError = ref('')
const undoingId = ref(null)
const toast = ref('')
const nowTick = ref(Date.now())
const SHOP_ID = 'OFFICE-1'
// Mode is 'loading' until the server answers, 'known' afterwards, 'unknown' if it could not be read.
// An unknown mode is never treated as tab mode: confirming stays paused.
const mode = ref(null)
const modeState = ref('loading')
const linked = computed(() => modeState.value === 'known' && mode.value === 'INVENTORY_LINKED')
const legacyActive = computed(() => modeState.value === 'known' && mode.value === 'LEGACY_TAB')
const linkedTab = ref(null)
const linkedTabError = ref('')
const lastPurchase = ref(null)
const hasLinkedHistory = computed(() => Boolean(linkedTab.value && linkedTab.value.purchases.length))
const hasLegacyHistory = computed(() => Boolean(tab.value && tab.value.purchases.length))

// One unresolved request per user, kept across reloads, sign-out and mode changes. It remembers which API it was sent to
// (v2 = stock-linked, legacy = tab), the exact items and the request id, and is only ever verified or resent through that same API.
const pendingKey = `shop.v2.pending.${username}`
function normalizePending(p) {
  if (!p || typeof p !== 'object' || typeof p.request_id !== 'string' || !Array.isArray(p.items) || !p.items.length) return null
  const owner = p.owner || username            // round-1 entries had no owner; their storage key is already per user
  if (owner !== username) return null           // never show or query another account's request
  return { v: 2, api: p.api === 'legacy' ? 'legacy' : 'v2', owner, shop: p.shop || SHOP_ID, request_id: p.request_id, at: p.at || Date.now(),
           items: p.items.map((i) => ({ item_id: Number(i.item_id), name: String(i.name || 'item'), qty: Number(i.qty) })) }
}
const readPending = () => { try { return normalizePending(JSON.parse(localStorage.getItem(pendingKey) || 'null')) } catch (_) { return null } }
const pending = ref(readPending())
const pendingState = ref('unverified')
const savePending = (v) => { pending.value = v; pendingState.value = 'unverified'; try { v ? localStorage.setItem(pendingKey, JSON.stringify(v)) : localStorage.removeItem(pendingKey) } catch (_) { /* storage unavailable */ } }
const pendingModeDiffers = computed(() => Boolean(pending.value) && ((pending.value.api === 'v2') !== linked.value))
const REASONS = { not_on_sale: 'Not on sale here', out_of_stock: 'Out of stock', no_price: 'No price yet', unavailable: 'Not available right now' }
const reasonLabel = (r) => REASONS[r] || 'Not available right now'
const maxQty = (item) => (linked.value ? Math.max(1, Math.min(20, Number(item.available || 0))) : 20)
let generation = 0
let toastTimer = null

const initials = (name) => String(name || '?').trim().slice(0, 1).toUpperCase()
const formatPrice = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
const isSelected = (id) => selectedItems.value.some((item) => item.id === id)
const selectionTotal = computed(() => selectedItems.value.reduce((a, i) => a + (i.price === null ? 0 : Number(i.price) * i.qty), 0))
const selectedCount = computed(() => selectedItems.value.reduce((a, i) => a + i.qty, 0))
const hasUnpriced = computed(() => selectedItems.value.some((i) => i.price === null))
const monthLabel = computed(() => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Tokyo' }).format(new Date()))
const formatTime = (iso) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(new Date(iso))
const canUndo = (p) => !p.cancelled && !p.settlement_id && Date.parse(p.cancellable_until) > nowTick.value
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' })
const newRequestId = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`)
const categories = computed(() => [...new Set(items.value.map((i) => i.category).filter(Boolean))].sort())
const visibleItems = computed(() => activeCategory.value === 'All' ? items.value : items.value.filter((i) => i.category === activeCategory.value))

// Stable soft gradient per product name for the thumbnail tile.
const PALETTE = [['#5ac8fa', '#007aff'], ['#ff9f0a', '#ff375f'], ['#30d158', '#0a84ff'], ['#bf5af2', '#5e5ce6'], ['#ffd60a', '#ff9f0a'], ['#64d2ff', '#30d158']]
function tint(name) {
  let h = 0
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const [a, b] = PALETTE[h % PALETTE.length]
  return `linear-gradient(135deg, ${a}, ${b})`
}

function toggleSelection(item) {
  if (linked.value && !item.sellable && !isSelected(item.id)) return
  selectedItems.value = isSelected(item.id) ? selectedItems.value.filter((s) => s.id !== item.id) : [...selectedItems.value, { ...item, qty: 1 }]
}

function setQty(item, qty) {
  selectedItems.value = selectedItems.value.map((s) => (s.id === item.id ? { ...s, qty: Math.min(maxQty(s), Math.max(1, qty)) } : s))
}

function showToast(text) {
  toast.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3200)
}

async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options, headers: authHeaders() })
  if (response.status === 401) { signOut(); throw new Error('Signed out') }
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) throw new Error(result?.message || `HTTP ${response.status}`)
  return result.data
}

// Both histories are always loaded, so a mode change never hides what this user already has on either tab.
async function loadTab() {
  tabError.value = ''
  linkedTabError.value = ''
  await Promise.all([
    api('/api/shop/purchases/mine').then((d) => { tab.value = d }).catch((error) => { tabError.value = `Could not load your tab entries (${error.message}).` }),
    api('/api/shop/v2/purchases/mine').then((d) => { linkedTab.value = d }).catch((error) => { linkedTabError.value = `Could not load your stock-linked pickups (${error.message}).` })
  ])
}

async function loadMode() {
  try {
    mode.value = (await api('/api/shop/v2/mode')).mode
    modeState.value = 'known'
  } catch (_) {
    modeState.value = 'unknown'
  }
}

async function reloadMode() {
  modeState.value = 'loading'
  await loadMode()
  loadCatalog()
  loadTab()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ENDPOINT = { v2: '/api/shop/v2/purchases', legacy: '/api/shop/purchases' }
// Refusals after which the server is known to have checked this request id before refusing (it replays an existing record first).
// Even then the request is only released after two lookups by request id, at least 3 s apart, both finding nothing.
const RELEASABLE = {
  v2: new Set(['MODE_NOT_LINKED', 'NOT_SELLABLE', 'BAD_BASKET', 'BAD_REQUEST_ID']),
  legacy: new Set(['MODE_INVENTORY_LINKED', 'NO_PRICE', 'ITEM_UNAVAILABLE', 'BAD_BASKET', 'BAD_REQUEST'])
}

// Looks the request up through the API it was sent to: { found } | { notFound: true } | { error }
async function lookup(p) {
  try {
    const response = await fetch(`${ENDPOINT[p.api]}/by-request/${encodeURIComponent(p.request_id)}`, { cache: 'no-store', headers: authHeaders() })
    if (response.status === 401) { signOut(); return { error: 'signed out' } }
    const result = await response.json().catch(() => null)
    if (response.ok && result?.success) return { found: result.data }
    if (response.status === 404) return { notFound: true }
    return { error: result?.message || `HTTP ${response.status}` }
  } catch (e) {
    return { error: e.message || 'network error' }
  }
}

async function resolved(p, record) {
  savePending(null)
  selectedItems.value = []
  checkoutError.value = ''
  if (p.api === 'v2') { lastPurchase.value = record; showToast(`Pickup ${record.purchase_no} confirmed`) } else { showToast(`Added ¥${formatPrice(record.total)} to your tab`) }
  await Promise.all([loadCatalog(), loadTab()])
}

// Sends exactly the saved request (same API, request id and items). Never creates a replacement request.
async function sendPending(p) {
  checkingOut.value = true
  checkoutError.value = ''
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 15000)
  try {
    const items = p.items.map((i) => (p.api === 'v2' ? { item_id: i.item_id, qty: i.qty } : { id: i.item_id, qty: i.qty }))
    const response = await fetch(ENDPOINT[p.api], { method: 'POST', cache: 'no-store', headers: authHeaders(), signal: ctl.signal, body: JSON.stringify({ request_id: p.request_id, items }) })
    if (response.status === 401) { signOut(); return }
    const result = await response.json().catch(() => null)
    if (response.ok && result?.success) return await resolved(p, result.data.purchase)
    if (response.status >= 400 && response.status < 500) return await afterRefusal(p, result, response.status)
    pendingState.value = 'unverified'
    checkoutError.value = 'No confirmation received. Please check its status below.'
  } catch (_) {
    pendingState.value = 'unverified'
    checkoutError.value = 'No answer from the server. Please check the status below before trying again.'
  } finally {
    clearTimeout(timer)
    checkingOut.value = false
  }
}

// A refusal is not taken as proof that nothing was recorded: the original request is looked up first.
async function afterRefusal(p, result, status) {
  const code = result?.code || `HTTP_${status}`
  const detail = (result?.problems || []).map((x) => `${(p.items.find((i) => i.item_id === x.item_id) || {}).name || 'item'}: ${String(x.problem).replace(/_/g, ' ')}`).join('; ')
  const reason = `${result?.message || code}${detail ? ` (${detail})` : ''}`
  const first = await lookup(p)
  if (first.found) return resolved(p, first.found)
  if (!first.notFound) { pendingState.value = 'unverified'; checkoutError.value = `Refused (${reason}), and its status could not be checked. Please check again.`; return }
  if (!RELEASABLE[p.api].has(code)) { pendingState.value = 'not_found_yet'; checkoutError.value = `Refused (${reason}). No record found so far; kept here for checking.`; return }
  await sleep(3000)
  const second = await lookup(p)
  if (second.found) return resolved(p, second.found)
  if (!second.notFound) { pendingState.value = 'unverified'; checkoutError.value = `Refused (${reason}), and its status could not be checked. Please check again.`; return }
  savePending(null)
  checkoutError.value = `Not recorded: ${reason}. The server refused request ${p.request_id.slice(0, 8)} and, checked twice, has no record of it, so nothing was added from it. If you still want these items, confirm them again in the current mode.`
  await loadCatalog()
}

async function checkPending() {
  const p = pending.value
  if (!p) return
  checkingOut.value = true
  try {
    const r = await lookup(p)
    if (r.found) return await resolved(p, r.found)
    if (r.notFound) { pendingState.value = 'not_found_yet'; checkoutError.value = ''; return }
    checkoutError.value = `Could not check the earlier request (${r.error}). Try again in a moment.`
  } finally {
    checkingOut.value = false
  }
}

async function retryPending() {
  if (pending.value) await sendPending(pending.value)
}

const canRequestReturn = (p) => p.status === 'CONFIRMED' && p.billing_status === 'OPEN' && !p.return_request && Date.parse(p.return_window_until) > nowTick.value

async function requestReturn(p) {
  if (!window.confirm(`Request a return for ${p.purchase_no}?\n\nStaff will check the items. Your tab and stock change only after they confirm.`)) return
  undoingId.value = p.id
  try {
    await api(`/api/shop/v2/purchases/${encodeURIComponent(p.id)}/return-request`, { method: 'POST', body: JSON.stringify({}) })
    showToast('Return requested')
    await loadTab()
  } catch (error) {
    tabError.value = `Could not request a return: ${error.message}`
  } finally {
    undoingId.value = null
  }
}

async function addToTab() {
  if (checkingOut.value || !selectedItems.value.length || hasUnpriced.value) return
  if (pending.value) { checkoutError.value = 'Please check your earlier request first.'; return }
  if (modeState.value !== 'known') { checkoutError.value = 'The shop mode could not be confirmed, so nothing can be confirmed right now.'; return }
  const lines = selectedItems.value.map((i) => `${i.name} ×${i.qty}`).join('\n')
  const question = linked.value
    ? `Have you taken (or are you taking) these items?\n\n${lines}\n\nConfirm pickup and add ¥${formatPrice(selectionTotal.value)} to your tab. Shelf stock is updated now.`
    : `Add to your tab for ¥${formatPrice(selectionTotal.value)}?\n\n${lines}`
  if (!window.confirm(question)) return
  const p = { v: 2, api: linked.value ? 'v2' : 'legacy', owner: username, shop: SHOP_ID, request_id: newRequestId(), at: Date.now(),
              items: selectedItems.value.map((i) => ({ item_id: i.id, name: i.name, qty: i.qty })) }
  savePending(p)
  await sendPending(p)
}

async function undo(p) {
  if (!window.confirm(`Undo this purchase of ¥${formatPrice(p.total)}?`)) return
  undoingId.value = p.id
  try {
    await api(`/api/shop/purchases/${encodeURIComponent(p.id)}/cancel`, { method: 'POST' })
    showToast('Purchase undone')
    await loadTab()
  } catch (error) {
    tabError.value = `Could not undo: ${error.message}`
  } finally {
    undoingId.value = null
  }
}

async function loadCatalog() {
  const id = ++generation
  loading.value = true
  errorMessage.value = ''
  try {
    const params = new URLSearchParams({ page: '1', pageSize: '50' })
    if (searchQuery.value) params.set('q', searchQuery.value)
    const response = await fetch(`/api/catalog/items?${params}`, { cache: 'no-store', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
    if (response.status === 401) return signOut()
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) throw new Error(result?.message || `HTTP ${response.status}`)
    if (id !== generation) return
    let list = result.data.items
    if (linked.value) {
      const v2 = await api('/api/shop/v2/catalog')
      const S = new Map(v2.items.map((x) => [x.item_id, x]))
      list = list.map((it) => ({ ...it, sellable: Boolean(S.get(it.id)?.sellable), available: S.get(it.id)?.available || 0, reason: S.get(it.id)?.reason || 'not_on_sale' }))
      selectedItems.value = selectedItems.value.map((sItem) => { const fresh = list.find((x) => x.id === sItem.id); return fresh ? { ...sItem, available: fresh.available, sellable: fresh.sellable } : sItem })
    }
    if (id !== generation) return
    items.value = list
    total.value = result.data.total
    if (!categories.value.includes(activeCategory.value)) activeCategory.value = 'All'
  } catch (error) {
    if (id === generation) errorMessage.value = `We could not load the product catalog (${error.message}). Check your connection and try again.`
  } finally {
    if (id === generation) loading.value = false
  }
}

function signOut() {
  selectedItems.value = []
  for (const key of ['token', 'userRole', 'username', 'userEmail', 'userAvatar']) localStorage.removeItem(key)
  router.replace({ path: '/login', query: { redirect: '/shop' } })
}

let tickTimer = null
onMounted(async () => {
  await loadMode()
  loadCatalog()
  loadTab()
  if (pending.value) checkPending()
  tickTimer = setInterval(() => { nowTick.value = Date.now() }, 30000)
})
onBeforeUnmount(() => { clearInterval(tickTimer); clearTimeout(toastTimer) })
</script>

<style scoped>
.shop-page {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Ambient light (fixed so it stays behind the glass while scrolling) */
.ambient-light { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.7; pointer-events: none; animation: float 12s infinite ease-in-out alternate; }
.light-1 { top: -15%; left: -20%; width: 70vw; height: 70vw; background: radial-gradient(circle, var(--light-1), transparent 70%); }
.light-2 { bottom: -20%; right: -20%; width: 80vw; height: 80vw; background: radial-gradient(circle, var(--light-2), transparent 70%); animation-delay: -6s; }
.light-3 { top: 35%; left: 30%; width: 45vw; height: 45vw; background: radial-gradient(circle, var(--light-3), transparent 70%); animation-duration: 16s; }
@keyframes float { 0% { transform: translate(0, 0); } 100% { transform: translate(30px, 24px); } }

/* Shared glass material */
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(30px) saturate(160%);
  -webkit-backdrop-filter: blur(30px) saturate(160%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--card-shadow);
}

.top-bar {
  position: sticky; top: 12px; z-index: 10;
  max-width: 960px; margin: 12px auto 0; padding: 10px 12px 10px 18px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  border-radius: 999px;
}
.brand { display: inline-flex; align-items: center; gap: 10px; color: var(--text-primary); text-decoration: none; font-size: 17px; font-weight: 650; letter-spacing: -0.02em; }
.brand-icon { font-size: 20px; }
.top-actions { display: flex; align-items: center; gap: 8px; }
.avatar { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: linear-gradient(135deg, #5ac8fa, #007aff); color: #fff; font-size: 14px; font-weight: 650; }

.pill { display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 0 16px; border-radius: 999px; font: inherit; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.2s ease; }
.pill:active { transform: scale(0.96); }
.pill.ghost { border: 1px solid var(--glass-border); background: var(--input-bg); color: var(--text-primary); }
.pill.ghost:hover { background: var(--input-focus-bg); }
.pill.solid { border: 0; background: var(--button-bg); color: var(--button-text); min-height: 42px; padding: 0 20px; }
.pill.solid:hover:not(:disabled) { background: var(--button-hover-bg); }
.pill:disabled { opacity: 0.6; cursor: wait; }

.content { position: relative; z-index: 1; max-width: 960px; margin: 0 auto; padding: 36px 20px 120px; box-sizing: border-box; }

.hero { margin: 18px 4px 26px; }
.eyebrow { margin: 0 0 8px; color: var(--text-secondary); font-size: 15px; font-weight: 500; }
.hero h1 { margin: 0; font-size: clamp(34px, 7vw, 52px); line-height: 1.05; letter-spacing: -0.035em; font-weight: 700; }
.subtitle { margin: 12px 0 0; color: var(--text-secondary); font-size: 17px; line-height: 1.45; }

.search { display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 18px; border-radius: 999px; margin-bottom: 16px; }
.search-icon { width: 20px; height: 20px; color: var(--text-secondary); flex: none; }
.search input { flex: 1; min-width: 0; height: 42px; border: 0; outline: none; background: transparent; color: var(--text-primary); font: inherit; font-size: 16px; }
.search input::placeholder { color: var(--text-tertiary); }
.search input::-webkit-search-cancel-button { filter: grayscale(1); }

.chips { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 10px; margin-bottom: 14px; scrollbar-width: none; }
.chips::-webkit-scrollbar { display: none; }
.chip { flex: none; min-height: 34px; padding: 0 16px; border-radius: 999px; color: var(--text-primary); font: inherit; font-size: 14px; font-weight: 550; cursor: pointer; box-shadow: none; }
.chip.active { background: var(--button-bg); color: var(--button-text); border-color: transparent; }

.section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 10px 4px 14px; }
.section-head h2 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.025em; }
.muted { color: var(--text-secondary); font-size: 14px; margin: 0; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.card {
  position: relative; display: flex; gap: 14px; align-items: flex-start; width: 100%;
  padding: 16px 52px 16px 16px; border-radius: 24px; text-align: left; color: var(--text-primary); font: inherit; cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s ease, border-color 0.25s ease;
}
.card:hover { transform: translateY(-2px); }
.card:active { transform: scale(0.985); }
.card.picked { border-color: var(--accent-blue); box-shadow: 0 0 0 2px var(--accent-blue), var(--card-shadow); }
.thumb { flex: none; width: 56px; height: 56px; display: grid; place-items: center; border-radius: 16px; color: #fff; font-size: 22px; font-weight: 700; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25); }
.card-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.category { color: var(--text-secondary); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
.name { font-size: 17px; font-weight: 650; line-height: 1.3; letter-spacing: -0.015em; overflow-wrap: anywhere; }
.desc { color: var(--text-secondary); font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; }
.meta { color: var(--text-tertiary); font-size: 13px; margin-top: 2px; }
.check { position: absolute; top: 14px; right: 14px; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--glass-border); background: var(--input-bg); color: var(--text-secondary); transition: background 0.2s ease, color 0.2s ease; }
.check svg { width: 16px; height: 16px; }
.card.picked .check { background: var(--accent-blue); border-color: transparent; color: #fff; }

.state { padding: 18px 20px; border-radius: 20px; color: var(--text-secondary); font-size: 15px; margin: 0 0 16px; }
.state.error { color: #ff453a; }

.selection { margin-top: 30px; padding: 6px 18px 18px; border-radius: 28px; }
.selected-list { list-style: none; margin: 0; padding: 0; }
.selected-list li { display: flex; align-items: center; gap: 12px; padding: 10px 2px; }
.selected-list li + li { border-top: 1px solid var(--glass-border); }
.mini-thumb { flex: none; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 10px; color: #fff; font-size: 14px; font-weight: 700; }
.selected-name { flex: 1; min-width: 0; font-size: 15px; overflow-wrap: anywhere; }
.text-btn { border: 0; background: transparent; color: var(--accent-blue); font: inherit; font-size: 15px; font-weight: 550; cursor: pointer; padding: 6px 4px; }
.note { margin: 14px 2px 0; color: var(--text-tertiary); font-size: 12px; }

.floating-bar {
  position: fixed; z-index: 20; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom));
  transform: translateX(-50%); display: flex; align-items: center; gap: 10px;
  padding: 8px 18px 8px 8px; border-radius: 999px; color: var(--text-primary); text-decoration: none; font-size: 15px; font-weight: 550; white-space: nowrap;
}
.floating-bar .count { min-width: 32px; height: 32px; padding: 0 8px; box-sizing: border-box; display: grid; place-items: center; border-radius: 999px; background: var(--accent-blue); color: #fff; font-weight: 700; }
.floating-bar .view { color: var(--accent-blue); margin-left: 6px; }
.rise-enter-active, .rise-leave-active { transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
.rise-enter-from, .rise-leave-to { opacity: 0; transform: translate(-50%, 16px); }

.selected-list li { flex-wrap: wrap; }
.selected-name small { display: block; font-size: 12px; }
.warn { color: #ff9f0a; }
.error-text { color: #ff453a; }
.stepper { display: inline-flex; align-items: center; gap: 2px; padding: 3px; border-radius: 999px; background: var(--input-bg); border: 1px solid var(--glass-border); }
.stepper button { width: 30px; height: 30px; border: 0; border-radius: 50%; background: transparent; color: var(--text-primary); font-size: 18px; cursor: pointer; }
.stepper button:disabled { opacity: 0.35; cursor: default; }
.stepper span { min-width: 22px; text-align: center; font-weight: 650; font-variant-numeric: tabular-nums; }
.line-total { min-width: 64px; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
.icon-btn { width: 30px; height: 30px; border: 0; border-radius: 50%; background: transparent; color: var(--text-tertiary); cursor: pointer; }
.checkout { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--glass-border); }
.checkout .muted { display: block; }
.grand { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.pill.big { min-height: 48px; padding: 0 26px; font-size: 16px; }
.hint { margin: 10px 2px 0; font-size: 13px; }
.tab { margin-top: 18px; padding: 6px 18px 18px; border-radius: 28px; }
.tab-totals { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.tab-totals > div { padding: 14px 16px; border-radius: 18px; background: var(--input-bg); border: 1px solid var(--glass-border); }
.tab-totals .muted { display: block; font-size: 13px; }
.tab-totals strong { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; }
.tab-totals strong.due { color: var(--accent-blue); }
.purchase-list { list-style: none; margin: 0; padding: 0; }
.purchase-list li { display: flex; align-items: center; gap: 12px; padding: 12px 2px; }
.purchase-list li + li { border-top: 1px solid var(--glass-border); }
.purchase-list li.cancelled .purchase-main, .purchase-list li.cancelled .purchase-amount { opacity: 0.45; text-decoration: line-through; }
.purchase-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.purchase-time { color: var(--text-secondary); font-size: 12px; }
.purchase-items { font-size: 14px; overflow-wrap: anywhere; }
.purchase-amount { font-weight: 650; font-variant-numeric: tabular-nums; }
.tag { padding: 3px 10px; border-radius: 999px; background: var(--input-bg); border: 1px solid var(--glass-border); color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.tag.ok { color: #30d158; }
.toast { position: fixed; z-index: 30; left: 50%; top: calc(76px + env(safe-area-inset-top)); transform: translateX(-50%); padding: 12px 20px; border-radius: 999px; font-size: 15px; font-weight: 600; color: var(--text-primary); white-space: nowrap; }
.card.unavailable { opacity: 0.55; cursor: not-allowed; }
.stock { font-size: 12px; font-weight: 600; color: #30d158; margin-top: 2px; }
.stock.off { color: var(--text-tertiary); }
.pending, .receipt { margin-top: 18px; padding: 14px 18px; border-radius: 24px; }
.pending strong { font-size: 16px; }
.pending .small { font-size: 12px; }
.pending-actions { display: flex; gap: 10px; margin-top: 8px; }
.receipt-lines { list-style: none; padding: 0; margin: 0 0 8px; }
.receipt-lines li { display: flex; justify-content: space-between; padding: 6px 0; border-top: 1px solid var(--glass-border); font-size: 14px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }

@media (max-width: 640px) {
  .top-bar { margin: 10px 12px 0; top: 10px; }
  .brand span:last-child { font-size: 16px; }
  .content { padding: 26px 16px 120px; }
  .grid { grid-template-columns: 1fr; }
  .pill.ghost { padding: 0 12px; font-size: 13px; }
  .line-total { min-width: 56px; }
  .grand { font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .ambient-light { animation: none; }
  .card, .pill { transition: none; }
}
</style>
