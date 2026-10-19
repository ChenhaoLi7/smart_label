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
            <p class="eyebrow">Scanner Lab</p>
            <h1>Scanner Performance</h1>
            <p class="page-subtitle">Measure decode success and latency under real scan conditions.</p>
          </div>
        </div>

        <div class="header-actions">
          <button class="secondary-btn" @click="goToRecoveryBenchmark">
            Recovery Lab
          </button>

          <button class="secondary-btn" @click="goToRankingDataset">
            Ranking Dataset
          </button>

          <label class="period-select">
            <span>Window</span>
            <select v-model.number="selectedDays" @change="loadSummary">
              <option v-for="option in dayOptions" :key="option" :value="option">
                Last {{ option }} days
              </option>
            </select>
          </label>

          <button class="primary-btn" @click="loadSummary" :disabled="loading">
            {{ loading ? 'Refreshing' : 'Refresh' }}
          </button>
        </div>
      </header>

      <main class="page-body">
        <div v-if="errorMessage" class="state-banner error">
          {{ errorMessage }}
        </div>

        <section class="study-note" :class="{ preliminary: isPreliminary }">
          <div>
            <span class="note-dot"></span>
            <strong>{{ studyNoteTitle }}</strong>
          </div>
          <p>{{ studyNoteCopy }}</p>
        </section>

        <section class="metric-grid" aria-label="Primary scanner metrics">
          <article v-for="metric in primaryMetrics" :key="metric.label" class="metric-card">
            <div class="metric-head">
              <span>{{ metric.label }}</span>
              <small>{{ metric.scope }}</small>
            </div>
            <strong :class="metric.tone">{{ metric.value }}</strong>
            <p>{{ metric.note }}</p>
          </article>
        </section>

        <section class="analysis-grid">
          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Failure Conditions</p>
                <h2>Where scans struggle</h2>
              </div>
              <span class="count-chip">{{ scenarioRows.length }} {{ scenarioRows.length === 1 ? 'tag' : 'tags' }}</span>
            </div>

            <div v-if="scenarioRows.length" class="bar-list">
              <div v-for="row in scenarioRows" :key="row.label" class="bar-row">
                <div class="bar-copy">
                  <strong>{{ formatScenarioLabel(row.label) }}</strong>
                  <span>{{ row.total }} samples · {{ formatPercent(row.successRate) }} success</span>
                </div>
                <div class="bar-track" aria-hidden="true">
                  <div class="bar-fill warm" :style="{ width: `${barWidth(row.total, scenarioRows)}%` }"></div>
                </div>
              </div>
            </div>

            <div v-else class="empty-state">
              <strong>No condition tags yet</strong>
              <p>Add blur, tilt, reflection, low-light, or other tags when recording benchmark scans.</p>
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Decode Profile</p>
                <h2>Formats and engines</h2>
              </div>
            </div>

            <div class="profile-block">
              <div class="mini-head">
                <strong>Decoded formats</strong>
                <span>{{ formatRows.length }} recorded</span>
              </div>

              <div v-if="formatRows.length" class="compact-list">
                <div v-for="row in formatRows" :key="row.label" class="compact-row">
                  <span>{{ row.label }}</span>
                  <strong>{{ row.total }}</strong>
                  <small>{{ row.avgLockMs ? `${formatMs(row.avgLockMs)} mean lock` : 'No lock timing' }}</small>
                </div>
              </div>
              <p v-else class="inline-empty">Successful decodes will appear here by format.</p>
            </div>

            <div class="profile-block engine-block">
              <div class="mini-head">
                <strong>Decoder paths</strong>
                <span>{{ engineRows.length }} recorded</span>
              </div>

              <div v-if="engineRows.length" class="engine-grid">
                <div v-for="engine in engineRows" :key="engine.label" class="engine-card">
                  <span>{{ engine.label }}</span>
                  <strong>{{ engine.total }}</strong>
                  <small>{{ formatPercent(engine.successRate) }} success</small>
                </div>
              </div>
              <p v-else class="inline-empty">Local, server-retry, and ROI-assisted paths will appear after scans.</p>
            </div>
          </article>
        </section>

        <section class="panel recent-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Recent Sessions</p>
              <h2>Latest benchmark records</h2>
            </div>
            <span class="count-chip">{{ recentRows.length }} rows</span>
          </div>

          <div class="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Format</th>
                  <th>Lock</th>
                  <th>First Frame</th>
                  <th>Engine</th>
                  <th>Conditions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!recentRows.length">
                  <td colspan="8">No benchmark sessions in this window.</td>
                </tr>
                <tr v-for="row in recentRows" :key="row.sessionId">
                  <td>{{ formatDateTime(row.completedAt) }}</td>
                  <td><span class="status-pill" :class="row.status">{{ row.status || '-' }}</span></td>
                  <td>{{ row.labelType || '-' }}</td>
                  <td>{{ row.decodedFormat || '-' }}</td>
                  <td>{{ formatMs(row.lockMs) }}</td>
                  <td>{{ formatMs(row.firstFrameMs) }}</td>
                  <td>{{ row.decodeEngine || '-' }}</td>
                  <td>
                    <div class="tag-wrap">
                      <span v-for="tag in visibleScenarioTags(row.scenarioTags)" :key="tag" class="tag-pill">
                        {{ formatScenarioLabel(tag) }}
                      </span>
                      <span v-if="!visibleScenarioTags(row.scenarioTags).length">-</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
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
const errorMessage = ref('')
const selectedDays = ref(14)
const dayOptions = [7, 14, 30, 60, 90]

const summary = ref({
  days: 14,
  total: 0,
  success: 0,
  successRate: 0,
  lockSampleCount: 0,
  avgLockMs: null,
  medianLockMs: null,
  p95LockMs: null,
  avgFirstFrameMs: null,
  byDecodeEngine: [],
  byDecodedFormat: [],
  byScenarioTag: [],
  recent: []
})

const formatPercent = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0%'
  return `${Math.round(numeric * 100)}%`
}

const formatMs = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(1)} s`
  return `${Math.round(numeric)} ms`
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const formatScenarioLabel = (label) => {
  return String(label || 'unknown')
    .replace(/^label-/, 'label: ')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const nonConditionTags = new Set([
  'decoded',
  'not-decoded',
  'label-item',
  'label-unresolved',
  'one-dimensional',
  'two-dimensional'
])

const visibleScenarioTags = (tags) => {
  return (Array.isArray(tags) ? tags : [])
    .filter((tag) => !nonConditionTags.has(String(tag || '').toLowerCase()))
}

const barWidth = (value, rows) => {
  const max = Math.max(...rows.map((row) => Number(row.total || 0)), 1)
  return Math.max(8, Math.round((Number(value || 0) / max) * 100))
}

const isPreliminary = computed(() => Number(summary.value.total || 0) < 30)

const studyNoteTitle = computed(() => {
  if (!summary.value.total) return 'Waiting for benchmark data'
  return isPreliminary.value ? 'Preliminary dataset' : 'Benchmark window ready for comparison'
})

const studyNoteCopy = computed(() => {
  if (!summary.value.total) {
    return 'Run controlled and field scans to populate target coverage, latency, and condition-level evidence.'
  }
  if (isPreliminary.value) {
    return `${summary.value.total} sessions are available. Treat the current percentages as descriptive signals, not stable performance estimates.`
  }
  return `${summary.value.total} sessions are included. Latency metrics below use successful scans with recorded lock timing.`
})

const primaryMetrics = computed(() => [
  {
    label: 'Decode Success',
    scope: `${summary.value.success || 0}/${summary.value.total || 0} sessions`,
    value: formatPercent(summary.value.successRate),
    note: 'Sessions marked successful by the current scanner workflow.',
    tone: summary.value.successRate >= 0.9 ? 'good' : summary.value.successRate >= 0.7 ? 'watch' : 'risk'
  },
  {
    label: 'Median Lock',
    scope: 'successful scans',
    value: formatMs(summary.value.medianLockMs),
    note: `${summary.value.lockSampleCount || 0} successful sessions include lock timing.`,
    tone: 'neutral'
  },
  {
    label: 'P95 Lock',
    scope: 'successful scans',
    value: formatMs(summary.value.p95LockMs),
    note: 'Tail latency for successful decoding.',
    tone: 'neutral'
  },
  {
    label: 'First Live Frame',
    scope: `${summary.value.total || 0} sessions`,
    value: formatMs(summary.value.avgFirstFrameMs),
    note: 'Mean camera readiness before decoding begins.',
    tone: summary.value.avgFirstFrameMs && summary.value.avgFirstFrameMs > 2500 ? 'watch' : 'good'
  }
])

const scenarioRows = computed(() => {
  return [...(summary.value.byScenarioTag || [])]
    .filter((row) => !nonConditionTags.has(String(row.label || '').toLowerCase()))
    .sort((a, b) => {
      if (a.successRate !== b.successRate) return a.successRate - b.successRate
      return b.total - a.total
    })
    .slice(0, 8)
})

const formatRows = computed(() => {
  return [...(summary.value.byDecodedFormat || [])]
    .filter((row) => row.label && row.label !== 'UNKNOWN')
    .slice(0, 6)
})

const engineRows = computed(() => {
  return [...(summary.value.byDecodeEngine || [])]
    .filter((row) => row.label && row.label !== 'UNKNOWN')
    .slice(0, 6)
})

const recentRows = computed(() => summary.value.recent || [])

const loadSummary = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/scan/benchmark/summary?days=${selectedDays.value}`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (response.status === 401) {
      router.push('/login')
      return
    }

    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to load scanner benchmark summary.')
    }

    summary.value = { ...summary.value, ...result.data }
  } catch (error) {
    errorMessage.value = error.message || 'Failed to load scanner benchmark summary.'
  } finally {
    loading.value = false
  }
}

const goBack = () => router.push('/dashboard')
const goToRecoveryBenchmark = () => router.push('/recovery-benchmark')
const goToRankingDataset = () => router.push('/ranking-dataset')

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
.metric-card {
  min-width: 0;
}

.page-header,
.panel,
.metric-card,
.study-note {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.045);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 24px;
  border-radius: 24px;
}

.heading-group,
.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
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

.page-subtitle {
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
  padding: 0 16px;
  cursor: pointer;
  font-weight: 750;
}

.primary-btn {
  border: 1px solid #111827;
  color: #ffffff;
  background: #111827;
}

.secondary-btn {
  border: 1px solid #dbe3ec;
}

.primary-btn:disabled {
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
  min-width: 150px;
  padding: 0 36px 0 12px;
  font-size: 0.9rem;
  font-weight: 700;
}

.page-body {
  display: grid;
  gap: 18px;
  margin-top: 18px;
}

.state-banner,
.study-note {
  padding: 14px 18px;
  border-radius: 16px;
}

.state-banner.error {
  border: 1px solid #fecaca;
  color: #991b1b;
  background: #fff1f2;
  font-weight: 700;
}

.study-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  box-shadow: none;
}

.study-note > div {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.study-note p {
  color: #64748b;
  text-align: right;
}

.note-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #0f766e;
}

.study-note.preliminary .note-dot {
  background: #d97706;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  min-height: 150px;
  display: grid;
  align-content: space-between;
  gap: 12px;
  padding: 20px;
  border-radius: 20px;
}

.metric-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.metric-head span {
  color: #536176;
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.metric-head small {
  color: #94a3b8;
}

.metric-card > strong {
  font-size: 2.35rem;
  letter-spacing: -0.06em;
}

.metric-card > strong.good { color: #047857; }
.metric-card > strong.watch { color: #b45309; }
.metric-card > strong.risk { color: #b91c1c; }

.metric-card p,
.inline-empty,
.empty-state p {
  color: #64748b;
  line-height: 1.48;
}

.analysis-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 18px;
}

.panel {
  padding: 22px;
  border-radius: 22px;
}

.panel-head,
.mini-head,
.bar-copy {
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
  gap: 16px;
}

.bar-row {
  display: grid;
  gap: 8px;
}

.bar-copy span {
  color: #64748b;
  font-size: 0.88rem;
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

.bar-fill.warm {
  background: #f59e0b;
}

.profile-block + .profile-block {
  margin-top: 22px;
  padding-top: 20px;
  border-top: 1px solid #e7ecf2;
}

.mini-head {
  margin-bottom: 12px;
}

.mini-head span {
  color: #64748b;
  font-size: 0.82rem;
}

.compact-list {
  display: grid;
  gap: 8px;
}

.compact-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(120px, auto);
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f7f9fb;
}

.compact-row small {
  color: #64748b;
  text-align: right;
}

.engine-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.engine-card {
  min-height: 92px;
  display: grid;
  align-content: center;
  gap: 4px;
  padding: 12px;
  border: 1px solid #e4e9ef;
  border-radius: 14px;
  background: #fbfcfd;
}

.engine-card span,
.engine-card small {
  overflow: hidden;
  color: #64748b;
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.engine-card strong {
  font-size: 1.45rem;
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

.table-shell {
  max-width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 13px 11px;
  border-bottom: 1px solid #e7ecf2;
  text-align: left;
  white-space: nowrap;
}

th {
  color: #7b8798;
  font-size: 0.68rem;
  font-weight: 850;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

td {
  color: #334155;
  font-size: 0.9rem;
  font-weight: 650;
}

.status-pill,
.tag-pill {
  display: inline-flex;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
}

.status-pill {
  color: #475569;
  background: #edf2f7;
  text-transform: capitalize;
}

.status-pill.success {
  color: #047857;
  background: #dff7ec;
}

.status-pill.decode_failed,
.status-pill.startup_failed {
  color: #b91c1c;
  background: #fee2e2;
}

.tag-wrap {
  display: flex;
  min-width: 170px;
  flex-wrap: wrap;
  gap: 5px;
}

.tag-pill {
  color: #475569;
  background: #f1f5f9;
}

@media (max-width: 1080px) {
  .page-header,
  .study-note {
    align-items: stretch;
    flex-direction: column;
  }

  .study-note p {
    text-align: left;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .analysis-grid {
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

  .secondary-btn {
    grid-column: 1 / -1;
  }

  .period-select select,
  .primary-btn {
    width: 100%;
  }

  .primary-btn {
    grid-column: 1 / -1;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .metric-card {
    min-height: 132px;
  }

  .engine-grid {
    grid-template-columns: 1fr 1fr;
  }

  .bar-copy,
  .compact-row {
    display: grid;
  }

  .compact-row small {
    text-align: left;
  }
}
</style>
