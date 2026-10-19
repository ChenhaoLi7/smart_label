<template>
  <div class="research-page">
    <div class="page-shell">
      <header class="page-header">
        <div class="heading-group">
          <button class="icon-btn" @click="goBack" aria-label="Back to dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>

          <div>
            <p class="eyebrow">Ranking Lab</p>
            <h1>Ranking Dataset</h1>
            <p class="page-subtitle">Inspect multi-code decisions before using interaction records as weak labels.</p>
          </div>
        </div>

        <div class="header-actions">
          <button class="secondary-btn" @click="goToScannerPerformance">
            Scanner Performance
          </button>

          <label class="period-select">
            <span>Window</span>
            <select v-model.number="selectedDays" @change="loadSummary">
              <option v-for="option in dayOptions" :key="option" :value="option">
                Last {{ option }} days
              </option>
            </select>
          </label>

          <button class="secondary-btn export-btn" @click="downloadCsv" :disabled="exporting">
            {{ exporting ? 'Exporting' : 'Export CSV' }}
          </button>
          <button class="primary-btn" @click="loadSummary" :disabled="loading">
            {{ loading ? 'Refreshing' : 'Refresh' }}
          </button>
        </div>
      </header>

      <main class="page-body">
        <div v-if="errorMessage" class="state-banner error">{{ errorMessage }}</div>
        <div v-if="statusMessage" class="state-banner success">{{ statusMessage }}</div>

        <section class="research-boundary">
          <div class="boundary-icon">i</div>
          <div>
            <strong>Interaction data, not automatic ground truth</strong>
            <p>User-selected sessions may become weak labels only after task checks and validation. Auto-selected and dismissed sessions remain unverified.</p>
          </div>
        </section>

        <section class="metric-grid" aria-label="Ranking dataset summary">
          <article v-for="metric in primaryMetrics" :key="metric.label" class="metric-card">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <p>{{ metric.note }}</p>
          </article>
        </section>

        <section class="analysis-grid">
          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Decision Types</p>
                <h2>How sessions were resolved</h2>
              </div>
              <span class="count-chip">{{ decisionRows.length }} {{ decisionRows.length === 1 ? 'type' : 'types' }}</span>
            </div>

            <div v-if="decisionRows.length" class="bar-list">
              <div v-for="row in decisionRows" :key="row.decision_type" class="bar-row">
                <div class="bar-copy">
                  <div>
                    <strong>{{ formatDecisionType(row.decision_type) }}</strong>
                    <small>{{ decisionDescription(row.decision_type) }}</small>
                  </div>
                  <span>{{ row.session_count }} sessions</span>
                </div>
                <div class="bar-track" aria-hidden="true">
                  <div class="bar-fill" :class="decisionTone(row.decision_type)" :style="{ width: `${decisionWidth(row.session_count)}%` }"></div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <strong>No selection sessions yet</strong>
              <p>Multi-code decisions will appear after an operator chooses, auto-selects, or dismisses a candidate list.</p>
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Label Readiness</p>
                <h2>What can enter training</h2>
              </div>
            </div>

            <div class="readiness-list">
              <div class="readiness-row candidate">
                <div>
                  <strong>User-selected sessions</strong>
                  <p>Candidate weak labels after validation.</p>
                </div>
                <span>{{ labelReadiness.userSelected }}</span>
              </div>
              <div class="readiness-row pending">
                <div>
                  <strong>Auto-selected sessions</strong>
                  <p>No explicit user preference; keep unverified.</p>
                </div>
                <span>{{ labelReadiness.autoSelected }}</span>
              </div>
              <div class="readiness-row excluded">
                <div>
                  <strong>Dismissed or unresolved</strong>
                  <p>Exclude from preference-label training.</p>
                </div>
                <span>{{ labelReadiness.excluded }}</span>
              </div>
            </div>

            <p class="readiness-footnote">
              The current logger does not yet distinguish “accepted top candidate” from “corrected to another candidate” in this aggregate view.
            </p>
          </article>
        </section>

        <section class="analysis-grid lower-grid">
          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Context Coverage</p>
                <h2>Operation modes represented</h2>
              </div>
              <span class="count-chip">{{ operationRows.length }} {{ operationRows.length === 1 ? 'mode' : 'modes' }}</span>
            </div>

            <div v-if="operationRows.length" class="operation-list">
              <div v-for="row in operationRows" :key="row.operation_mode" class="operation-row">
                <div>
                  <strong>{{ row.operation_mode || 'UNKNOWN' }}</strong>
                  <p>{{ formatDecimal(row.avg_candidate_count, 1) }} candidates per session</p>
                </div>
                <div class="operation-meta">
                  <strong>{{ row.session_count }}</strong>
                  <span>{{ formatMs(row.avg_confirmation_time_ms) }} confirm</span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state compact">
              <strong>No operation context yet</strong>
              <p>Inbound, outbound, transfer, and stocktake sessions will be summarized here.</p>
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Collection Path</p>
                <h2>How candidate lists were triggered</h2>
              </div>
            </div>

            <div v-if="triggerRows.length" class="trigger-grid">
              <div v-for="row in triggerRows" :key="row.trigger" class="trigger-card">
                <span>{{ formatTrigger(row.trigger) }}</span>
                <strong>{{ row.session_count }}</strong>
                <small>sessions</small>
              </div>
            </div>
            <div v-else class="empty-state compact">
              <strong>No trigger data yet</strong>
              <p>Manual and automatic recovery events will be shown here.</p>
            </div>
          </article>
        </section>

        <section class="panel selected-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Descriptive Distribution</p>
              <h2>Frequently selected candidates</h2>
              <p class="panel-subtitle">Frequency is not ranking accuracy and should not be used as model evidence by itself.</p>
            </div>
            <span class="count-chip">{{ topCandidates.length }} rows</span>
          </div>

          <div v-if="topCandidates.length" class="candidate-table">
            <div class="candidate-row candidate-head">
              <span>Candidate</span>
              <span>Context</span>
              <span>Shown</span>
              <span>Selected</span>
              <span>Selection Rate</span>
            </div>
            <div v-for="candidate in topCandidates" :key="candidateKey(candidate)" class="candidate-row">
              <div>
                <strong>{{ candidate.display_title || candidate.candidate_item_id || candidate.barcode_value || 'Unknown candidate' }}</strong>
                <small>{{ candidate.parsed_type || 'CODE' }}</small>
              </div>
              <span>{{ candidate.operation_mode || 'SCAN' }}</span>
              <span>{{ candidate.shown_count }}</span>
              <span>{{ candidate.selected_count }}</span>
              <strong>{{ formatPercent(candidate.selection_rate) }}</strong>
            </div>
          </div>
          <div v-else class="empty-state compact">
            <strong>No selected candidates yet</strong>
            <p>Selected-candidate frequencies will appear after multi-code decisions are recorded.</p>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const exporting = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')
const selectedDays = ref(14)
const dayOptions = [7, 14, 30, 60, 90]

const summary = ref({
  filters: {},
  totals: {
    sessions: 0,
    sessions_with_selection: 0,
    candidates: 0,
    selected_candidates: 0,
    session_resolution_rate: 0,
    candidate_selected_rate: 0
  },
  by_operation_mode: [],
  by_decision_type: [],
  by_trigger: [],
  top_selected_candidates: []
})

const dateRangeQuery = computed(() => {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - Number(selectedDays.value || 14))
  return new URLSearchParams({ start: start.toISOString(), end: end.toISOString() }).toString()
})

const formatPercent = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : '0%'
}

const formatDecimal = (value, digits = 1) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : '-'
}

const formatMs = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(1)} s`
  return `${Math.round(numeric)} ms`
}

const formatDecisionType = (value) => {
  const labels = {
    user_selected: 'User selected',
    auto_selected: 'Auto selected',
    dismissed: 'Dismissed'
  }
  return labels[value] || String(value || 'Unknown').replaceAll('_', ' ')
}

const decisionDescription = (value) => {
  const descriptions = {
    user_selected: 'An operator explicitly chose a candidate.',
    auto_selected: 'The system selected without explicit confirmation.',
    dismissed: 'The candidate list was closed without a selection.'
  }
  return descriptions[value] || 'Recorded interaction outcome.'
}

const decisionTone = (value) => {
  if (value === 'user_selected') return 'candidate'
  if (value === 'auto_selected') return 'pending'
  return 'excluded'
}

const formatTrigger = (value) => {
  return String(value || 'unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const extractDownloadFilename = (contentDisposition, fallback) => {
  const disposition = String(contentDisposition || '')
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch (_error) {
      return utf8Match[1]
    }
  }
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1] || fallback
}

const decisionRows = computed(() => summary.value.by_decision_type || [])
const operationRows = computed(() => summary.value.by_operation_mode || [])
const triggerRows = computed(() => summary.value.by_trigger || [])
const topCandidates = computed(() => [...(summary.value.top_selected_candidates || [])].slice(0, 8))

const decisionCount = (type) => {
  const row = decisionRows.value.find((item) => item.decision_type === type)
  return Number(row?.session_count || 0)
}

const labelReadiness = computed(() => {
  const totals = summary.value.totals || {}
  const userSelected = decisionCount('user_selected')
  const autoSelected = decisionCount('auto_selected')
  const dismissed = decisionCount('dismissed')
  const known = userSelected + autoSelected + dismissed
  const unknown = Math.max(0, Number(totals.sessions || 0) - known)
  return {
    userSelected,
    autoSelected,
    excluded: dismissed + unknown
  }
})

const primaryMetrics = computed(() => {
  const totals = summary.value.totals || {}
  return [
    {
      label: 'Selection Sessions',
      value: String(totals.sessions || 0),
      note: 'Multi-candidate decision groups recorded in this window.'
    },
    {
      label: 'Candidate Rows',
      value: String(totals.candidates || 0),
      note: 'One feature row per candidate within a selection session.'
    },
    {
      label: 'User Selected',
      value: String(labelReadiness.value.userSelected),
      note: 'Explicit interactions requiring validation before training.'
    },
    {
      label: 'Resolution Rate',
      value: formatPercent(totals.session_resolution_rate),
      note: `${totals.sessions_with_selection || 0} sessions contain a selected candidate.`
    }
  ]
})

const decisionWidth = (value) => {
  const max = Math.max(...decisionRows.value.map((row) => Number(row.session_count || 0)), 1)
  return Math.max(7, Math.round((Number(value || 0) / max) * 100))
}

const candidateKey = (candidate) => {
  return `${candidate.barcode_value || candidate.candidate_item_id || 'candidate'}-${candidate.operation_mode || 'SCAN'}`
}

const loadSummary = async () => {
  loading.value = true
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/scanner/roi-assist/ranking-summary?${dateRangeQuery.value}`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (response.status === 401) {
      router.push('/login')
      return
    }

    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to load ranking dataset summary.')
    }

    summary.value = { ...summary.value, ...(result.summary || {}) }
  } catch (error) {
    errorMessage.value = error.message || 'Failed to load ranking dataset summary.'
  } finally {
    loading.value = false
  }
}

const downloadCsv = async () => {
  exporting.value = true
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/scanner/roi-assist/ranking-export?${dateRangeQuery.value}`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (response.status === 401) {
      router.push('/login')
      return
    }

    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      throw new Error(result.message || 'Failed to export ranking data.')
    }

    const blob = await response.blob()
    const filename = extractDownloadFilename(
      response.headers.get('content-disposition'),
      `scanner-ranking-training-${Date.now()}.csv`
    )
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(downloadUrl)
    statusMessage.value = `Downloaded ${filename}`
  } catch (error) {
    errorMessage.value = error.message || 'Failed to export ranking data.'
  } finally {
    exporting.value = false
  }
}

const goBack = () => router.push('/dashboard')
const goToScannerPerformance = () => router.push('/scanner-performance')

onMounted(loadSummary)
</script>

<style scoped>
.research-page {
  min-height: 100vh;
  overflow-x: hidden;
  padding: 24px;
  color: #101827;
  background: #f3f6f9;
}

.page-shell {
  width: min(1480px, 100%);
  max-width: 100%;
  min-width: 0;
  margin: 0 auto;
}

.page-body,
.metric-grid,
.analysis-grid,
.panel,
.metric-card,
.research-boundary {
  min-width: 0;
}

.page-header,
.panel,
.metric-card,
.research-boundary {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.045);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  padding: 22px 24px;
  border-radius: 24px;
}

.heading-group,
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.eyebrow,
h1,
h2,
p {
  margin: 0;
}

.eyebrow {
  margin-bottom: 5px;
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 850;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1 {
  font-size: clamp(2rem, 3.3vw, 3rem);
  letter-spacing: -0.055em;
}

h2 {
  font-size: 1.28rem;
  letter-spacing: -0.035em;
}

.page-subtitle,
.panel-subtitle {
  margin-top: 5px;
  color: #64748b;
  line-height: 1.45;
}

.icon-btn,
.primary-btn,
.secondary-btn,
.period-select select {
  min-height: 44px;
  border-radius: 13px;
  font: inherit;
}

.icon-btn,
.secondary-btn,
.period-select select {
  border: 1px solid #dbe3ec;
  color: #172033;
  background: #ffffff;
}

.icon-btn {
  width: 44px;
  display: grid;
  flex: none;
  place-items: center;
  cursor: pointer;
}

.primary-btn,
.secondary-btn {
  padding: 0 15px;
  cursor: pointer;
  font-weight: 750;
}

.primary-btn {
  border: 1px solid #111827;
  color: #ffffff;
  background: #111827;
}

.primary-btn:disabled,
.secondary-btn:disabled {
  cursor: wait;
  opacity: 0.6;
}

.period-select {
  display: grid;
  gap: 4px;
  color: #64748b;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.period-select select {
  min-width: 146px;
  padding: 0 36px 0 12px;
  font-size: 0.9rem;
  font-weight: 700;
}

.page-body {
  display: grid;
  gap: 18px;
  margin-top: 18px;
}

.state-banner {
  padding: 13px 17px;
  border-radius: 14px;
  font-weight: 700;
}

.state-banner.error {
  border: 1px solid #fecaca;
  color: #991b1b;
  background: #fff1f2;
}

.state-banner.success {
  border: 1px solid #bbf7d0;
  color: #166534;
  background: #f0fdf4;
}

.research-boundary {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 15px 18px;
  border-color: #c7d2fe;
  border-radius: 16px;
  box-shadow: none;
}

.research-boundary p {
  margin-top: 3px;
  color: #64748b;
  line-height: 1.45;
}

.boundary-icon {
  width: 30px;
  height: 30px;
  display: grid;
  flex: none;
  place-items: center;
  border-radius: 50%;
  color: #3730a3;
  background: #e0e7ff;
  font-weight: 900;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  min-height: 148px;
  display: grid;
  align-content: space-between;
  gap: 10px;
  padding: 20px;
  border-radius: 20px;
}

.metric-card > span {
  color: #536176;
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.metric-card > strong {
  color: #172554;
  font-size: 2.3rem;
  letter-spacing: -0.06em;
}

.metric-card p,
.readiness-row p,
.readiness-footnote,
.operation-row p,
.empty-state p {
  color: #64748b;
  line-height: 1.48;
}

.analysis-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
  gap: 18px;
}

.lower-grid {
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
}

.panel {
  padding: 22px;
  border-radius: 22px;
}

.panel-head,
.bar-copy,
.operation-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.panel-head {
  margin-bottom: 20px;
}

.count-chip {
  flex: none;
  padding: 7px 10px;
  border-radius: 999px;
  color: #64748b;
  background: #f1f5f9;
  font-size: 0.74rem;
  font-weight: 800;
}

.bar-list {
  display: grid;
  gap: 17px;
}

.bar-row {
  display: grid;
  gap: 8px;
}

.bar-copy > div {
  display: grid;
  gap: 3px;
}

.bar-copy small,
.bar-copy > span {
  color: #64748b;
  font-size: 0.84rem;
}

.bar-track {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf1f5;
}

.bar-fill {
  height: 100%;
  border-radius: inherit;
}

.bar-fill.candidate { background: #4f46e5; }
.bar-fill.pending { background: #d97706; }
.bar-fill.excluded { background: #94a3b8; }

.readiness-list {
  display: grid;
  gap: 10px;
}

.readiness-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 15px;
  border: 1px solid #e5eaf0;
  border-left-width: 4px;
  border-radius: 14px;
  background: #fbfcfd;
}

.readiness-row.candidate { border-left-color: #4f46e5; }
.readiness-row.pending { border-left-color: #d97706; }
.readiness-row.excluded { border-left-color: #94a3b8; }

.readiness-row span {
  font-size: 1.65rem;
  font-weight: 850;
}

.readiness-footnote {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f7f9fb;
  font-size: 0.84rem;
}

.operation-list {
  display: grid;
  gap: 9px;
}

.operation-row {
  align-items: center;
  padding: 13px 14px;
  border-radius: 14px;
  background: #f7f9fb;
}

.operation-meta {
  display: grid;
  justify-items: end;
  gap: 2px;
}

.operation-meta strong {
  font-size: 1.35rem;
}

.operation-meta span {
  color: #64748b;
  font-size: 0.8rem;
}

.trigger-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.trigger-card {
  min-height: 105px;
  display: grid;
  align-content: center;
  gap: 4px;
  padding: 13px;
  border: 1px solid #e5eaf0;
  border-radius: 14px;
  background: #fbfcfd;
}

.trigger-card span,
.trigger-card small {
  color: #64748b;
}

.trigger-card strong {
  font-size: 1.7rem;
}

.candidate-table {
  max-width: 100%;
  overflow-x: auto;
}

.candidate-row {
  min-width: 760px;
  display: grid;
  grid-template-columns: minmax(240px, 2fr) minmax(120px, 1fr) 90px 90px 120px;
  align-items: center;
  gap: 14px;
  padding: 13px 12px;
  border-bottom: 1px solid #e7ecf2;
}

.candidate-row > div {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.candidate-row > div strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-row small,
.candidate-row > span {
  color: #64748b;
}

.candidate-head {
  color: #7b8798;
  font-size: 0.68rem;
  font-weight: 850;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.empty-state {
  min-height: 180px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  padding: 20px;
  border: 1px dashed #cbd5e1;
  border-radius: 16px;
  text-align: center;
  background: #fafbfc;
}

.empty-state.compact {
  min-height: 125px;
}

@media (max-width: 1180px) {
  .page-header {
    align-items: stretch;
    flex-direction: column;
  }

  .header-actions {
    flex-wrap: wrap;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .analysis-grid,
  .lower-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .research-page {
    padding: 12px;
  }

  .page-header,
  .panel {
    padding: 18px;
    border-radius: 18px;
  }

  .heading-group {
    align-items: flex-start;
  }

  .header-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .header-actions > * {
    width: 100%;
  }

  .header-actions .secondary-btn:first-child {
    grid-column: 1 / -1;
  }

  .header-actions .primary-btn {
    grid-column: 1 / -1;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .metric-card {
    min-height: 132px;
  }

  .research-boundary,
  .bar-copy,
  .readiness-row {
    align-items: flex-start;
  }

  .trigger-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
