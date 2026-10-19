<template>
  <div class="analytics-page">
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>

    <header class="page-header glass-panel">
      <div class="header-copy">
        <button class="back-btn" @click="goBack" aria-label="Back to dashboard">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div>
          <p class="eyebrow">Inventory intelligence</p>
          <h1>Inventory Analytics</h1>
          <p class="header-subtitle">Review SKU usage history and compare operator activity from the warehouse audit trail.</p>
        </div>
      </div>

      <button class="refresh-btn" @click="loadAnalytics" :disabled="loading">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
          <polyline points="21 3 21 9 15 9"/>
        </svg>
        {{ loading ? 'Refreshing' : 'Refresh' }}
      </button>
    </header>

    <main class="page-body">
      <section class="filter-panel glass-panel">
        <div class="filter-heading">
          <div>
            <p class="eyebrow">Analysis scope</p>
            <h2>{{ scopeLabel }}</h2>
          </div>
          <button v-if="filtersActive" class="clear-btn" @click="clearFilters">Clear filters</button>
        </div>

        <div class="filter-grid">
          <label class="filter-control">
            <span>SKU</span>
            <select v-model="selectedSku" @change="loadAnalytics">
              <option value="">All SKUs</option>
              <option v-for="item in skuOptions" :key="item.sku" :value="item.sku">
                {{ item.sku }} · {{ item.name }}
              </option>
            </select>
          </label>

          <label class="filter-control">
            <span>Operator</span>
            <select v-model="selectedOperator" @change="loadAnalytics">
              <option value="">All operators</option>
              <option v-for="user in operatorOptions" :key="user.username" :value="user.username">
                {{ user.username }}{{ user.role ? ` · ${user.role}` : '' }}
              </option>
            </select>
          </label>

          <div class="filter-control period-control">
            <span>Time window</span>
            <div class="period-switch" role="group" aria-label="Analytics time window">
              <button
                v-for="option in dayOptions"
                :key="option"
                :class="{ active: selectedDays === option }"
                @click="setDays(option)"
              >
                {{ option }}D
              </button>
            </div>
          </div>
        </div>
      </section>

      <div v-if="errorMessage" class="state-banner error">
        {{ errorMessage }}
      </div>

      <section class="metric-grid">
        <article v-for="metric in metricCards" :key="metric.label" class="metric-card glass-panel" :class="metric.tone">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <p>{{ metric.note }}</p>
        </article>
      </section>

      <section class="primary-grid">
        <article class="chart-panel glass-panel movement-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">SKU movement</p>
              <h3>{{ movementTitle }}</h3>
            </div>
            <div class="chart-legend">
              <span><i class="legend-dot outbound"></i>Usage</span>
              <span><i class="legend-dot inbound"></i>Inbound</span>
            </div>
          </div>

          <div v-if="hasMovement" class="movement-chart">
            <svg viewBox="0 0 720 260" role="img" :aria-label="`${movementTitle} chart`">
              <g class="chart-grid-lines">
                <g v-for="line in chartModel.gridLines" :key="line.y">
                  <line x1="50" :y1="line.y" x2="700" :y2="line.y"/>
                  <text x="40" :y="line.y + 4" text-anchor="end">{{ line.value }}</text>
                </g>
              </g>

              <path :d="chartModel.outboundArea" class="usage-area"/>
              <polyline :points="chartModel.outboundPoints" class="chart-line outbound-line"/>
              <polyline :points="chartModel.inboundPoints" class="chart-line inbound-line"/>

              <g v-for="point in chartModel.outboundMarkers" :key="`out-${point.date}`">
                <circle :cx="point.x" :cy="point.outboundY" r="3.5" class="chart-point outbound-point">
                  <title>{{ point.date }}: {{ point.outbound }} used</title>
                </circle>
              </g>
              <g v-for="point in chartModel.inboundMarkers" :key="`in-${point.date}`">
                <circle :cx="point.x" :cy="point.inboundY" r="3.5" class="chart-point inbound-point">
                  <title>{{ point.date }}: {{ point.inbound }} inbound</title>
                </circle>
              </g>

              <g class="x-axis-labels">
                <text v-for="label in chartModel.labels" :key="label.date" :x="label.x" y="252" text-anchor="middle">
                  {{ label.label }}
                </text>
              </g>
            </svg>
          </div>

          <div v-else class="empty-state chart-empty">
            <span class="empty-icon">—</span>
            <div>
              <strong>No stock movement in this period</strong>
              <p>Change the SKU, operator, or time window to inspect another slice.</p>
            </div>
          </div>
        </article>

        <article class="chart-panel glass-panel operator-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">People</p>
              <h3>Operator activity</h3>
            </div>
            <span class="panel-chip">{{ analytics.summary.activeOperators || 0 }} active</span>
          </div>

          <div v-if="topOperators.length" class="bar-list">
            <button
              v-for="row in topOperators"
              :key="row.operator"
              class="bar-row"
              :class="{ selected: selectedOperator === row.operator }"
              @click="selectOperator(row.operator)"
            >
              <div class="bar-copy">
                <strong>{{ row.operator }}</strong>
                <span>{{ row.operations }} operations · {{ formatNumber(row.outboundQty) }} used</span>
              </div>
              <div class="bar-value">{{ row.operations }}</div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: `${operatorBarWidth(row.operations)}%` }"></div>
              </div>
            </button>
          </div>

          <div v-else class="empty-state compact">
            <span class="empty-icon">—</span>
            <div>
              <strong>No operator activity</strong>
              <p>No matching audit events were found.</p>
            </div>
          </div>
        </article>
      </section>

      <section class="secondary-grid">
        <article class="chart-panel glass-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Consumption ranking</p>
              <h3>SKU usage</h3>
            </div>
            <span class="panel-chip">Outbound only</span>
          </div>

          <div v-if="topSkus.length" class="sku-list">
            <button
              v-for="row in topSkus"
              :key="row.sku"
              class="sku-row"
              :class="{ selected: selectedSku === row.sku }"
              @click="selectSku(row.sku)"
            >
              <div class="sku-copy">
                <strong>{{ row.name || row.sku }}</strong>
                <span>{{ row.sku }} · {{ row.operations }} operations</span>
              </div>
              <div class="sku-usage">
                <strong>{{ formatNumber(row.outboundQty) }}</strong>
                <span>used</span>
              </div>
              <div class="sku-track">
                <div class="sku-fill" :style="{ width: `${skuBarWidth(row.outboundQty)}%` }"></div>
              </div>
            </button>
          </div>

          <div v-else class="empty-state compact">
            <span class="empty-icon">—</span>
            <div>
              <strong>No SKU usage found</strong>
              <p>Only real outbound transactions count as usage.</p>
            </div>
          </div>
        </article>

        <article class="chart-panel glass-panel activity-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Audit trail</p>
              <h3>Recent matching operations</h3>
            </div>
            <span class="panel-chip">{{ analytics.recent.length }} shown</span>
          </div>

          <div v-if="analytics.recent.length" class="activity-list">
            <div v-for="row in analytics.recent" :key="row.id" class="activity-row">
              <span class="activity-type" :class="row.operationType">{{ operationLabel(row.operationType) }}</span>
              <div class="activity-copy">
                <strong>{{ row.itemName || row.itemCode }}</strong>
                <span>{{ row.itemCode }} · {{ row.operator }}</span>
              </div>
              <div class="activity-quantity">
                <strong>{{ operationQuantity(row) }}</strong>
                <time>{{ formatTimestamp(row.transactionTime) }}</time>
              </div>
            </div>
          </div>

          <div v-else class="empty-state compact">
            <span class="empty-icon">—</span>
            <div>
              <strong>No matching operations</strong>
              <p>There is no audit history for the selected scope.</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const errorMessage = ref('')
const selectedSku = ref('')
const selectedOperator = ref('')
const selectedDays = ref(30)
const dayOptions = [7, 30, 90]

const analytics = ref({
  options: { skus: [], operators: [] },
  summary: {
    operations: 0,
    inboundQty: 0,
    outboundQty: 0,
    netMovement: 0,
    countOperations: 0,
    moveOperations: 0,
    activeOperators: 0,
    truncated: false
  },
  timeline: [],
  operatorBreakdown: [],
  skuBreakdown: [],
  recent: []
})

const skuOptions = computed(() => analytics.value.options?.skus || [])
const operatorOptions = computed(() => analytics.value.options?.operators || [])
const filtersActive = computed(() => Boolean(selectedSku.value || selectedOperator.value || selectedDays.value !== 30))

const selectedSkuName = computed(() => {
  return skuOptions.value.find((item) => item.sku === selectedSku.value)?.name || selectedSku.value
})

const scopeLabel = computed(() => {
  const parts = []
  if (selectedSku.value) parts.push(selectedSkuName.value || selectedSku.value)
  if (selectedOperator.value) parts.push(selectedOperator.value)
  return parts.length ? parts.join(' · ') : 'All warehouse activity'
})

const movementTitle = computed(() => {
  return selectedSku.value
    ? `${selectedSkuName.value || selectedSku.value} movement`
    : 'Inbound and usage over time'
})

const metricCards = computed(() => [
  {
    label: 'Usage',
    value: formatNumber(analytics.value.summary.outboundQty),
    note: 'Units from real outbound operations',
    tone: 'amber'
  },
  {
    label: 'Inbound',
    value: formatNumber(analytics.value.summary.inboundQty),
    note: 'Units added during the period',
    tone: 'blue'
  },
  {
    label: 'Operations',
    value: formatNumber(analytics.value.summary.operations),
    note: `${analytics.value.summary.countOperations || 0} counts · ${analytics.value.summary.moveOperations || 0} moves`,
    tone: 'slate'
  },
  {
    label: 'Active Operators',
    value: formatNumber(analytics.value.summary.activeOperators),
    note: 'Users with matching audit events',
    tone: 'mint'
  }
])

const topOperators = computed(() => (analytics.value.operatorBreakdown || []).slice(0, 6))
const topSkus = computed(() => (analytics.value.skuBreakdown || []).slice(0, 6))
const maxOperatorOperations = computed(() => Math.max(...topOperators.value.map((row) => Number(row.operations || 0)), 1))
const maxSkuUsage = computed(() => Math.max(...topSkus.value.map((row) => Number(row.outboundQty || 0)), 1))

const chartModel = computed(() => {
  const rows = analytics.value.timeline || []
  const left = 50
  const right = 700
  const top = 20
  const bottom = 225
  const plotHeight = bottom - top
  const maxValue = Math.max(...rows.flatMap((row) => [Number(row.inbound || 0), Number(row.outbound || 0)]), 1)
  const divisor = Math.max(rows.length - 1, 1)

  const points = rows.map((row, index) => {
    const x = left + ((right - left) * index) / divisor
    const inbound = Number(row.inbound || 0)
    const outbound = Number(row.outbound || 0)
    return {
      date: row.date,
      x,
      inbound,
      outbound,
      inboundY: bottom - (inbound / maxValue) * plotHeight,
      outboundY: bottom - (outbound / maxValue) * plotHeight
    }
  })

  const outboundPoints = points.map((point) => `${point.x},${point.outboundY}`).join(' ')
  const inboundPoints = points.map((point) => `${point.x},${point.inboundY}`).join(' ')
  const outboundArea = points.length
    ? `M ${points[0].x} ${bottom} L ${points.map((point) => `${point.x} ${point.outboundY}`).join(' L ')} L ${points[points.length - 1].x} ${bottom} Z`
    : ''
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: bottom - ratio * plotHeight,
    value: Math.round(maxValue * ratio)
  }))
  const labelStep = Math.max(1, Math.ceil(rows.length / 6))
  const labels = points
    .filter((point, index) => index === 0 || index === points.length - 1 || index % labelStep === 0)
    .map((point) => ({
      date: point.date,
      x: point.x,
      label: formatChartDate(point.date)
    }))

  return {
    points,
    outboundPoints,
    inboundPoints,
    outboundArea,
    gridLines,
    labels,
    outboundMarkers: points.filter((point) => point.outbound > 0),
    inboundMarkers: points.filter((point) => point.inbound > 0)
  }
})

const hasMovement = computed(() => {
  return (analytics.value.timeline || []).some((row) => Number(row.inbound || 0) > 0 || Number(row.outbound || 0) > 0)
})

onMounted(loadAnalytics)

async function loadAnalytics() {
  loading.value = true
  errorMessage.value = ''

  try {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    const params = new URLSearchParams({ days: String(selectedDays.value) })
    if (selectedSku.value) params.set('sku', selectedSku.value)
    if (selectedOperator.value) params.set('operator', selectedOperator.value)

    const response = await fetch(`/api/inventory-management/analytics?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Inventory analytics could not be loaded.')
    }

    analytics.value = result.data
  } catch (error) {
    console.error('Failed to load inventory analytics:', error)
    errorMessage.value = error.message || 'Inventory analytics could not be loaded.'
  } finally {
    loading.value = false
  }
}

function setDays(days) {
  if (selectedDays.value === days) return
  selectedDays.value = days
  loadAnalytics()
}

function selectOperator(operator) {
  selectedOperator.value = selectedOperator.value === operator ? '' : operator
  loadAnalytics()
}

function selectSku(sku) {
  selectedSku.value = selectedSku.value === sku ? '' : sku
  loadAnalytics()
}

function clearFilters() {
  selectedSku.value = ''
  selectedOperator.value = ''
  selectedDays.value = 30
  loadAnalytics()
}

function goBack() {
  router.push('/dashboard')
}

function operatorBarWidth(value) {
  return Math.max(4, Math.round((Number(value || 0) / maxOperatorOperations.value) * 100))
}

function skuBarWidth(value) {
  if (Number(value || 0) <= 0) return 0
  return Math.max(4, Math.round((Number(value || 0) / maxSkuUsage.value) * 100))
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function formatChartDate(value) {
  const date = new Date(`${value}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
}

function formatTimestamp(value) {
  if (!value) return 'Unknown time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

function operationLabel(type) {
  return {
    inbound: 'Inbound',
    outbound: 'Usage',
    count: 'Count',
    move: 'Move'
  }[type] || 'Operation'
}

function operationQuantity(row) {
  if (row.operationType === 'inbound') return `+${formatNumber(row.quantity)}`
  if (row.operationType === 'outbound') return `−${formatNumber(row.quantity)}`
  if (row.operationType === 'count') return `${row.beforeQuantity ?? '—'} → ${row.afterQuantity ?? '—'}`
  return formatNumber(row.quantity)
}
</script>

<style scoped>
.analytics-page {
  --surface: rgba(255, 255, 255, 0.78);
  --border: rgba(15, 23, 42, 0.08);
  --text: #101218;
  --muted: #6b7280;
  --muted-strong: #4b5563;
  --blue: #2563eb;
  --amber: #d97706;
  --mint: #15966a;
  min-height: 100vh;
  padding: 24px;
  color: var(--text);
  background:
    radial-gradient(circle at 8% 2%, rgba(125, 211, 252, 0.2), transparent 28%),
    radial-gradient(circle at 90% 20%, rgba(167, 243, 208, 0.18), transparent 24%),
    linear-gradient(180deg, #fbfbfd 0%, #eff2f6 100%);
  font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif;
  position: relative;
  overflow: hidden;
}

.ambient {
  position: fixed;
  border-radius: 999px;
  filter: blur(60px);
  pointer-events: none;
}

.ambient-one {
  width: 28rem;
  height: 28rem;
  top: -12rem;
  right: -8rem;
  background: rgba(96, 165, 250, 0.16);
}

.ambient-two {
  width: 22rem;
  height: 22rem;
  left: -8rem;
  bottom: -8rem;
  background: rgba(52, 211, 153, 0.12);
}

.glass-panel {
  background: var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.86);
  box-shadow: 0 22px 48px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(26px);
  -webkit-backdrop-filter: blur(26px);
}

.page-header,
.header-copy,
.panel-head,
.filter-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.page-header {
  position: relative;
  z-index: 1;
  max-width: 1480px;
  margin: 0 auto;
  padding: 24px 28px;
  border-radius: 30px;
}

.header-copy {
  justify-content: flex-start;
}

.back-btn,
.refresh-btn,
.clear-btn {
  border: 1px solid var(--border);
  color: var(--text);
  background: rgba(255, 255, 255, 0.78);
  cursor: pointer;
}

.back-btn {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 15px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.refresh-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.eyebrow {
  margin: 0;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 0;
  font-size: 30px;
  letter-spacing: -0.04em;
}

.header-subtitle {
  margin: 7px 0 0;
  color: var(--muted-strong);
  font-size: 13px;
}

.page-body {
  position: relative;
  z-index: 1;
  max-width: 1480px;
  margin: 18px auto 0;
  display: grid;
  gap: 16px;
}

.filter-panel,
.chart-panel {
  padding: 22px;
  border-radius: 26px;
}

.filter-heading h2 {
  margin: 6px 0 0;
  font-size: 22px;
  letter-spacing: -0.03em;
}

.clear-btn {
  padding: 9px 12px;
  border-radius: 999px;
  color: var(--blue);
  font-size: 12px;
  font-weight: 700;
}

.filter-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: minmax(240px, 1.25fr) minmax(220px, 1fr) minmax(230px, auto);
  gap: 12px;
}

.filter-control {
  display: grid;
  gap: 7px;
}

.filter-control > span {
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.filter-control select {
  width: 100%;
  height: 44px;
  padding: 0 40px 0 13px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--text);
  font: inherit;
  font-size: 13px;
}

.period-switch {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 4px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.05);
}

.period-switch button {
  height: 36px;
  padding: 0 15px;
  border: none;
  border-radius: 11px;
  background: transparent;
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.period-switch button.active {
  background: #fff;
  color: var(--text);
  box-shadow: 0 5px 14px rgba(15, 23, 42, 0.08);
}

.state-banner {
  padding: 13px 16px;
  border-radius: 16px;
  font-size: 13px;
}

.state-banner.error {
  color: #b42318;
  background: rgba(254, 226, 226, 0.88);
  border: 1px solid rgba(239, 68, 68, 0.16);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  padding: 19px;
  border-radius: 22px;
  border-top: 3px solid transparent;
}

.metric-card > span {
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 700;
}

.metric-card > strong {
  display: block;
  margin-top: 13px;
  font-size: 34px;
  letter-spacing: -0.05em;
}

.metric-card p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 11px;
}

.metric-card.amber { border-top-color: rgba(217, 119, 6, 0.55); }
.metric-card.blue { border-top-color: rgba(37, 99, 235, 0.5); }
.metric-card.mint { border-top-color: rgba(21, 150, 106, 0.5); }
.metric-card.slate { border-top-color: rgba(71, 85, 105, 0.45); }

.primary-grid,
.secondary-grid {
  display: grid;
  gap: 16px;
  align-items: start;
}

.primary-grid {
  grid-template-columns: minmax(0, 1.55fr) minmax(330px, 0.75fr);
}

.secondary-grid {
  grid-template-columns: minmax(340px, 0.8fr) minmax(0, 1.2fr);
}

.panel-head {
  align-items: flex-start;
}

.panel-head h3 {
  margin: 7px 0 0;
  font-size: 21px;
  letter-spacing: -0.03em;
}

.panel-chip {
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: var(--muted-strong);
  font-size: 10px;
  font-weight: 700;
}

.chart-legend {
  display: flex;
  gap: 14px;
  color: var(--muted-strong);
  font-size: 11px;
}

.chart-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.legend-dot.outbound { background: var(--amber); }
.legend-dot.inbound { background: var(--blue); }

.movement-chart {
  margin-top: 18px;
  min-height: 280px;
}

.movement-chart svg {
  width: 100%;
  height: 280px;
  overflow: visible;
}

.chart-grid-lines line {
  stroke: rgba(15, 23, 42, 0.08);
  stroke-width: 1;
}

.chart-grid-lines text,
.x-axis-labels text {
  fill: var(--muted);
  font-size: 9px;
}

.usage-area {
  fill: rgba(217, 119, 6, 0.08);
}

.chart-line {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.outbound-line { stroke: var(--amber); }
.inbound-line { stroke: var(--blue); }
.chart-point { stroke: #fff; stroke-width: 2; }
.outbound-point { fill: var(--amber); }
.inbound-point { fill: var(--blue); }

.bar-list,
.sku-list,
.activity-list {
  margin-top: 18px;
  display: grid;
}

.bar-list,
.sku-list {
  gap: 9px;
}

.bar-row,
.sku-row {
  position: relative;
  width: 100%;
  display: grid;
  align-items: center;
  gap: 10px;
  padding: 13px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.62);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.bar-row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.bar-row.selected,
.sku-row.selected {
  border-color: rgba(37, 99, 235, 0.26);
  background: rgba(239, 246, 255, 0.78);
}

.bar-copy strong,
.bar-copy span,
.sku-copy strong,
.sku-copy span,
.sku-usage strong,
.sku-usage span {
  display: block;
}

.bar-copy strong,
.sku-copy strong {
  font-size: 13px;
}

.bar-copy span,
.sku-copy span {
  margin-top: 4px;
  color: var(--muted);
  font-size: 10px;
}

.bar-value {
  font-size: 12px;
  font-weight: 800;
}

.bar-track,
.sku-track {
  grid-column: 1 / -1;
  height: 5px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.07);
  overflow: hidden;
}

.bar-fill,
.sku-fill {
  height: 100%;
  border-radius: inherit;
}

.bar-fill { background: linear-gradient(90deg, #475569, #0f172a); }
.sku-fill { background: linear-gradient(90deg, #f59e0b, #d97706); }

.sku-row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.sku-usage {
  text-align: right;
}

.sku-usage strong {
  font-size: 16px;
}

.sku-usage span {
  margin-top: 2px;
  color: var(--muted);
  font-size: 9px;
  text-transform: uppercase;
}

.activity-list {
  gap: 0;
}

.activity-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.07);
}

.activity-row:last-child {
  border-bottom: none;
}

.activity-type {
  padding: 6px 7px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: var(--muted-strong);
  text-align: center;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.activity-type.inbound { background: rgba(37, 99, 235, 0.09); color: #1d4ed8; }
.activity-type.outbound { background: rgba(245, 158, 11, 0.12); color: #a14f08; }
.activity-type.count { background: rgba(71, 85, 105, 0.09); color: #475569; }
.activity-type.move { background: rgba(124, 58, 237, 0.09); color: #6d28d9; }

.activity-copy strong,
.activity-copy span,
.activity-quantity strong,
.activity-quantity time {
  display: block;
}

.activity-copy strong,
.activity-quantity strong {
  font-size: 12px;
}

.activity-copy span,
.activity-quantity time {
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
}

.activity-quantity {
  text-align: right;
}

.empty-state {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--muted-strong);
}

.empty-state.compact {
  min-height: 150px;
}

.empty-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: rgba(15, 23, 42, 0.06);
  color: var(--muted);
}

.empty-state strong {
  display: block;
  font-size: 13px;
}

.empty-state p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
}

@media (max-width: 1100px) {
  .primary-grid,
  .secondary-grid {
    grid-template-columns: 1fr;
  }

  .filter-grid {
    grid-template-columns: 1fr 1fr;
  }

  .period-control {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .analytics-page {
    padding: 14px;
  }

  .page-header,
  .filter-heading,
  .panel-head {
    align-items: flex-start;
  }

  .page-header {
    padding: 20px;
  }

  .header-subtitle {
    display: none;
  }

  .filter-grid,
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .period-control {
    grid-column: auto;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .movement-chart,
  .movement-chart svg {
    min-height: 230px;
    height: 230px;
  }

  .activity-row {
    grid-template-columns: 66px minmax(0, 1fr);
  }

  .activity-quantity {
    grid-column: 2;
    text-align: left;
  }
}
</style>
