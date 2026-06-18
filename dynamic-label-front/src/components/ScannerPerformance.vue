<template>
  <div class="scanner-performance">
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
          <p class="eyebrow">Scanner Lab</p>
          <h1>Scanner Performance</h1>
          <p class="header-subtitle">
            Measure lock speed, camera readiness, difficult label types, and failure scenarios from real warehouse scans.
          </p>
        </div>
      </div>

      <div class="header-actions">
        <label class="period-select">
          <span>Window</span>
          <select v-model.number="selectedDays" @change="loadDashboard">
            <option v-for="option in dayOptions" :key="option" :value="option">
              Last {{ option }} days
            </option>
          </select>
        </label>

        <button class="glass-btn" @click="loadDashboard" :disabled="loading || rankingLoading">
          {{ loading || rankingLoading ? 'Refreshing' : 'Refresh' }}
        </button>
      </div>
    </header>

    <main class="page-body">
      <section class="hero-panel glass-panel">
        <div>
          <p class="eyebrow">Research Signal</p>
          <h2>{{ readinessHeadline }}</h2>
          <p>{{ readinessCopy }}</p>
        </div>

        <div class="hero-orb" :class="readinessTone">
          <strong>{{ formatPercent(summary.successRate) }}</strong>
          <span>success rate</span>
        </div>
      </section>

      <div v-if="errorMessage" class="state-banner error">
        {{ errorMessage }}
      </div>

      <section class="metric-grid">
        <article v-for="metric in primaryMetrics" :key="metric.label" class="metric-card glass-panel" :class="metric.tone">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <p>{{ metric.note }}</p>
        </article>
      </section>

      <section class="ranking-panel glass-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Ranking Dataset</p>
            <h3>Multi-code selection training data</h3>
          </div>
          <div class="ranking-actions">
            <span class="panel-chip">{{ rankingSummary.totals?.candidates || 0 }} candidates</span>
            <button class="glass-btn compact" @click="downloadRankingCsv" :disabled="rankingExporting">
              {{ rankingExporting ? 'Exporting' : 'Export CSV' }}
            </button>
          </div>
        </div>

        <div v-if="rankingErrorMessage" class="state-banner error compact-banner">
          {{ rankingErrorMessage }}
        </div>

        <div class="ranking-metric-grid">
          <article v-for="metric in rankingMetrics" :key="metric.label" class="ranking-metric-card">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <p>{{ metric.note }}</p>
          </article>
        </div>

        <div class="ranking-workspace">
          <article>
            <div class="mini-panel-head">
              <strong>Operation contexts</strong>
              <span>{{ rankingOperationRows.length }} modes</span>
            </div>
            <div v-if="rankingOperationRows.length" class="bar-list compact-bars">
              <div v-for="row in rankingOperationRows" :key="row.operation_mode" class="bar-row">
                <div class="bar-copy">
                  <strong>{{ row.operation_mode }}</strong>
                  <span>{{ row.session_count }} sessions · {{ formatMs(row.avg_confirmation_time_ms) }} confirm</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill violet" :style="{ width: `${barWidth(row.session_count, rankingOperationRowsForBars)}%` }"></div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state compact">
              <strong>No ranking sessions yet</strong>
              <p>Use ROI Assist with multiple codes, then choose a candidate.</p>
            </div>
          </article>

          <article>
            <div class="mini-panel-head">
              <strong>Top selected candidates</strong>
              <span>{{ topSelectedCandidates.length }} labels</span>
            </div>
            <div v-if="topSelectedCandidates.length" class="candidate-list">
              <div v-for="candidate in topSelectedCandidates" :key="`${candidate.barcode_value}-${candidate.operation_mode}`" class="candidate-row">
                <div>
                  <strong>{{ candidate.display_title || candidate.candidate_item_id || candidate.parsed_type || 'Unknown label' }}</strong>
                  <p>{{ candidate.operation_mode || 'SCAN' }} · {{ candidate.parsed_type || 'CODE' }}</p>
                </div>
                <span>{{ candidate.selected_count }}/{{ candidate.shown_count }}</span>
              </div>
            </div>
            <div v-else class="empty-state compact">
              <strong>No selected candidates yet</strong>
              <p>The selected label history will appear after multi-code decisions.</p>
            </div>
          </article>
        </div>

        <p v-if="rankingStatusMessage" class="ranking-status">
          {{ rankingStatusMessage }}
        </p>
      </section>

      <section class="workspace-grid">
        <article class="analysis-panel glass-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Failure Taxonomy</p>
              <h3>Hardest scan scenarios</h3>
            </div>
            <span class="panel-chip">{{ scenarioRows.length }} tags</span>
          </div>

          <div v-if="scenarioRows.length" class="bar-list">
            <div v-for="row in scenarioRows" :key="row.label" class="bar-row">
              <div class="bar-copy">
                <strong>{{ formatScenarioLabel(row.label) }}</strong>
                <span>{{ row.total }} samples · {{ formatPercent(row.successRate) }} success</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill warm" :style="{ width: `${barWidth(row.total, scenarioRows)}%` }"></div>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            <strong>No scenario data yet</strong>
            <p>Scan a few labels to start building the benchmark dataset.</p>
          </div>
        </article>

        <article class="analysis-panel glass-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Decode Profile</p>
              <h3>Formats and engines</h3>
            </div>
            <span class="panel-chip">{{ formatRows.length }} formats</span>
          </div>

          <div v-if="formatRows.length" class="bar-list">
            <div v-for="row in formatRows" :key="row.label" class="bar-row">
              <div class="bar-copy">
                <strong>{{ row.label }}</strong>
                <span>{{ row.total }} samples · {{ row.avgLockMs ? `${row.avgLockMs} ms avg` : 'No lock timing' }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill cool" :style="{ width: `${barWidth(row.total, formatRows)}%` }"></div>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            <strong>No decoded formats yet</strong>
            <p>Successful scans will appear here as QR, CODE_128, EAN, and other formats.</p>
          </div>
        </article>
      </section>

      <section class="workspace-grid">
        <article class="analysis-panel glass-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Bottleneck Radar</p>
              <h3>What to optimize next</h3>
            </div>
          </div>

          <div class="insight-list">
            <div v-for="insight in insights" :key="insight.title" class="insight-card" :class="insight.tone">
              <strong>{{ insight.title }}</strong>
              <p>{{ insight.copy }}</p>
            </div>
          </div>
        </article>

        <article class="analysis-panel glass-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Decode Engine</p>
              <h3>Worker path usage</h3>
            </div>
          </div>

          <div v-if="engineRows.length" class="engine-grid">
            <div v-for="engine in engineRows" :key="engine.label" class="engine-card">
              <span>{{ engine.label }}</span>
              <strong>{{ engine.total }}</strong>
              <small>{{ formatPercent(engine.successRate) }} success</small>
            </div>
          </div>

          <div v-else class="empty-state compact">
            <strong>No engine data yet</strong>
            <p>The worker and fallback decoder labels will show up after scans.</p>
          </div>
        </article>
      </section>

      <section class="recent-panel glass-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Recent Samples</p>
            <h3>Latest scanner benchmark records</h3>
          </div>
          <span class="panel-chip">{{ recentRows.length }} rows</span>
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
                <th>Quality</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!recentRows.length">
                <td colspan="8">No benchmark rows yet.</td>
              </tr>
              <tr v-for="row in recentRows" :key="row.sessionId">
                <td>{{ formatDateTime(row.completedAt) }}</td>
                <td>
                  <span class="status-pill" :class="row.status">{{ row.status || '-' }}</span>
                </td>
                <td>{{ row.labelType || '-' }}</td>
                <td>{{ row.decodedFormat || '-' }}</td>
                <td>{{ formatMs(row.lockMs) }}</td>
                <td>{{ formatMs(row.firstFrameMs) }}</td>
                <td>{{ formatScore(row.avgFrameScore) }}</td>
                <td>
                  <div class="tag-wrap">
                    <span v-for="tag in row.scenarioTags || []" :key="tag" class="tag-pill">
                      {{ formatScenarioLabel(tag) }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
const rankingLoading = ref(false)
const rankingExporting = ref(false)
const rankingErrorMessage = ref('')
const rankingStatusMessage = ref('')
const selectedDays = ref(14)
const dayOptions = [7, 14, 30, 60, 90]

const summary = ref({
  days: 14,
  total: 0,
  success: 0,
  successRate: 0,
  avgLockMs: null,
  avgFirstFrameMs: null,
  byLabelType: [],
  byMode: [],
  byDecodeEngine: [],
  byDecodedFormat: [],
  byScenarioTag: [],
  recent: []
})

const rankingSummary = ref({
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
  feature_averages: {},
  top_selected_candidates: []
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

const formatScore = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  return `${Math.round(numeric * 100)}`
}

const formatDecimal = (value, digits = 2) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  return numeric.toFixed(digits)
}

const dateRangeQuery = computed(() => {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - Number(selectedDays.value || 14))

  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString()
  })

  return params.toString()
})

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

const barWidth = (value, rows) => {
  const max = Math.max(...rows.map((row) => Number(row.total || 0)), 1)
  return Math.max(8, Math.round((Number(value || 0) / max) * 100))
}

const primaryMetrics = computed(() => [
  {
    label: 'Total Samples',
    value: String(summary.value.total || 0),
    note: `Collected over ${summary.value.days || selectedDays.value} days`,
    tone: 'neutral'
  },
  {
    label: 'Success Rate',
    value: formatPercent(summary.value.successRate),
    note: `${summary.value.success || 0} successful scans`,
    tone: summary.value.successRate >= 0.9 ? 'good' : summary.value.successRate >= 0.7 ? 'watch' : 'risk'
  },
  {
    label: 'Avg Lock Time',
    value: formatMs(summary.value.avgLockMs),
    note: 'Time from camera start to decoded result',
    tone: summary.value.avgLockMs && summary.value.avgLockMs > 3000 ? 'risk' : 'good'
  },
  {
    label: 'First Live Frame',
    value: formatMs(summary.value.avgFirstFrameMs),
    note: 'Camera readiness before decode starts',
    tone: summary.value.avgFirstFrameMs && summary.value.avgFirstFrameMs > 2500 ? 'watch' : 'good'
  }
])

const rankingMetrics = computed(() => {
  const totals = rankingSummary.value.totals || {}
  const featureAverages = rankingSummary.value.feature_averages || {}

  return [
    {
      label: 'Selection Sessions',
      value: String(totals.sessions || 0),
      note: 'Multi-code or ROI Assist decisions recorded for ML ranking.'
    },
    {
      label: 'Candidate Rows',
      value: String(totals.candidates || 0),
      note: 'Each row is one candidate label with visual and context features.'
    },
    {
      label: 'Resolved Sessions',
      value: formatPercent(totals.session_resolution_rate),
      note: `${totals.sessions_with_selection || 0} sessions have a selected target label.`
    },
    {
      label: 'Avg Rule Score',
      value: formatDecimal(featureAverages.avg_rule_based_score),
      note: 'Current rule-based ranking signal, before LightGBM training.'
    }
  ]
})

const readinessTone = computed(() => {
  if (summary.value.total === 0) return 'neutral'
  if (summary.value.successRate >= 0.9 && (!summary.value.avgLockMs || summary.value.avgLockMs <= 1800)) return 'good'
  if (summary.value.successRate >= 0.75) return 'watch'
  return 'risk'
})

const readinessHeadline = computed(() => {
  if (summary.value.total === 0) return 'Waiting for real scan data'
  if (readinessTone.value === 'good') return 'Scanner flow is looking production-ready'
  if (readinessTone.value === 'watch') return 'Scanner is usable, but there is room to tune'
  return 'Scanner needs targeted improvement'
})

const readinessCopy = computed(() => {
  if (summary.value.total === 0) {
    return 'Once operators scan labels, this panel will show which formats and capture conditions are slowing the workflow down.'
  }
  return `Across ${summary.value.total} samples, average lock time is ${formatMs(summary.value.avgLockMs)} and first-frame readiness is ${formatMs(summary.value.avgFirstFrameMs)}.`
})

const scenarioRows = computed(() => {
  return [...(summary.value.byScenarioTag || [])]
    .sort((a, b) => {
      if (a.successRate !== b.successRate) return a.successRate - b.successRate
      return b.total - a.total
    })
    .slice(0, 8)
})

const formatRows = computed(() => {
  return [...(summary.value.byDecodedFormat || [])]
    .filter((row) => row.label && row.label !== 'UNKNOWN')
    .slice(0, 8)
})

const engineRows = computed(() => {
  return [...(summary.value.byDecodeEngine || [])]
    .filter((row) => row.label && row.label !== 'UNKNOWN')
    .slice(0, 6)
})

const recentRows = computed(() => summary.value.recent || [])

const rankingOperationRows = computed(() => rankingSummary.value.by_operation_mode || [])

const rankingOperationRowsForBars = computed(() => {
  return rankingOperationRows.value.map((row) => ({
    ...row,
    total: row.session_count
  }))
})

const topSelectedCandidates = computed(() => {
  return [...(rankingSummary.value.top_selected_candidates || [])].slice(0, 6)
})

const findTag = (tag) => {
  return (summary.value.byScenarioTag || []).find((row) => row.label === tag)
}

const insights = computed(() => {
  const slowOpen = findTag('slow-camera-open')
  const slowLock = findTag('slow-lock')
  const blur = findTag('blur-risk')
  const lowLight = findTag('low-light')
  const oneDimensional = findTag('one-dimensional')

  return [
    {
      title: 'Camera startup',
      copy: slowOpen
        ? `${slowOpen.total} samples were tagged as slow camera open. Keep warm-reopen and permission caching as the next camera layer.`
        : 'No slow camera-open signal yet. Current warm-camera path is not the main bottleneck in this sample window.',
      tone: slowOpen ? 'watch' : 'good'
    },
    {
      title: 'Decode lock',
      copy: slowLock
        ? `${slowLock.total} samples locked slowly. Adaptive ROI and format-specific candidate ordering should be next.`
        : 'No slow-lock cluster yet. That means the worker path is currently keeping up with the UI.',
      tone: slowLock ? 'watch' : 'good'
    },
    {
      title: 'Image quality',
      copy: blur || lowLight
        ? `Quality issues detected: ${blur?.total || 0} blur-risk and ${lowLight?.total || 0} low-light samples.`
        : 'No strong low-light or blur cluster yet. Keep collecting field data before adding heavy restoration.',
      tone: blur || lowLight ? 'risk' : 'good'
    },
    {
      title: '1D barcode track',
      copy: oneDimensional
        ? `${oneDimensional.total} one-dimensional samples are now visible. This is the dataset we need for the barcode-specific route.`
        : 'No 1D barcode cluster yet. Scan long barcode samples before tuning the 1D path again.',
      tone: oneDimensional ? 'watch' : 'neutral'
    }
  ]
})

const loadSummary = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/scan/benchmark/summary?days=${selectedDays.value}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (response.status === 401) {
      router.push('/login')
      return
    }

    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to load scanner benchmark summary.')
    }

    summary.value = {
      ...summary.value,
      ...result.data
    }
  } catch (error) {
    errorMessage.value = error.message || 'Failed to load scanner benchmark summary.'
  } finally {
    loading.value = false
  }
}

const loadRankingSummary = async () => {
  rankingLoading.value = true
  rankingErrorMessage.value = ''

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/scanner/roi-assist/ranking-summary?${dateRangeQuery.value}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (response.status === 401) {
      router.push('/login')
      return
    }

    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to load ranking dataset summary.')
    }

    rankingSummary.value = {
      ...rankingSummary.value,
      ...(result.summary || {})
    }
  } catch (error) {
    rankingErrorMessage.value = error.message || 'Failed to load ranking dataset summary.'
  } finally {
    rankingLoading.value = false
  }
}

const loadDashboard = async () => {
  await Promise.all([
    loadSummary(),
    loadRankingSummary()
  ])
}

const downloadRankingCsv = async () => {
  rankingExporting.value = true
  rankingStatusMessage.value = 'Preparing ranking training CSV...'
  rankingErrorMessage.value = ''

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/scanner/roi-assist/ranking-export?${dateRangeQuery.value}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (response.status === 401) {
      router.push('/login')
      return
    }

    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      throw new Error(result.message || 'Failed to export ranking training CSV.')
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

    rankingStatusMessage.value = `Downloaded ${filename}`
    await loadRankingSummary()
  } catch (error) {
    rankingErrorMessage.value = error.message || 'Failed to export ranking training CSV.'
    rankingStatusMessage.value = ''
  } finally {
    rankingExporting.value = false
  }
}

const goBack = () => {
  router.push('/dashboard')
}

onMounted(loadDashboard)
</script>

<style scoped>
.scanner-performance {
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  padding: 32px;
  color: #111827;
  background:
    radial-gradient(circle at 8% 12%, rgba(125, 211, 252, 0.34), transparent 30%),
    radial-gradient(circle at 92% 8%, rgba(187, 247, 208, 0.42), transparent 28%),
    linear-gradient(135deg, #f8fafc 0%, #eef4f7 46%, #f9fafb 100%);
}

.ambient {
  position: fixed;
  border-radius: 999px;
  pointer-events: none;
  filter: blur(18px);
  opacity: 0.55;
}

.ambient-one {
  width: 320px;
  height: 320px;
  top: -120px;
  left: 8%;
  background: rgba(96, 165, 250, 0.25);
}

.ambient-two {
  width: 360px;
  height: 360px;
  right: -110px;
  bottom: 12%;
  background: rgba(52, 211, 153, 0.2);
}

.glass-panel {
  position: relative;
  z-index: 1;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(28px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding: 22px;
  border-radius: 32px;
}

.header-copy,
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn,
.glass-btn {
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.82);
  color: #111827;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.back-btn {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 16px;
}

.glass-btn {
  min-height: 46px;
  padding: 0 18px;
  border-radius: 16px;
  font-weight: 800;
}

.glass-btn.compact {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 0.86rem;
}

.back-btn:hover,
.glass-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.1);
}

.glass-btn:disabled {
  cursor: wait;
  opacity: 0.65;
}

.eyebrow {
  margin: 0 0 6px;
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  font-size: clamp(2rem, 4vw, 3.6rem);
  letter-spacing: -0.06em;
}

h2 {
  font-size: clamp(1.7rem, 3vw, 3rem);
  letter-spacing: -0.055em;
}

h3 {
  font-size: 1.35rem;
  letter-spacing: -0.04em;
}

.header-subtitle {
  max-width: 680px;
  margin-top: 8px;
  color: #64748b;
  line-height: 1.6;
}

.period-select {
  display: grid;
  gap: 5px;
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.period-select select {
  min-height: 46px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 16px;
  padding: 0 42px 0 14px;
  background: rgba(255, 255, 255, 0.82);
  color: #111827;
  font-size: 0.98rem;
  font-weight: 800;
}

.page-body {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 20px;
  margin-top: 20px;
}

.hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: center;
  min-height: 230px;
  padding: 34px;
  border-radius: 36px;
}

.hero-panel p {
  max-width: 720px;
  margin-top: 12px;
  color: #64748b;
  line-height: 1.7;
}

.hero-orb {
  width: 180px;
  height: 180px;
  display: grid;
  place-items: center;
  align-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.86), rgba(255, 255, 255, 0.35));
  box-shadow: inset 0 0 28px rgba(255, 255, 255, 0.65), 0 24px 42px rgba(15, 23, 42, 0.1);
}

.hero-orb strong {
  font-size: 3rem;
  letter-spacing: -0.08em;
}

.hero-orb span {
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-orb.good {
  color: #047857;
}

.hero-orb.watch {
  color: #b45309;
}

.hero-orb.risk {
  color: #b91c1c;
}

.state-banner {
  padding: 14px 18px;
  border-radius: 18px;
  font-weight: 800;
}

.state-banner.error {
  color: #991b1b;
  background: rgba(254, 226, 226, 0.9);
  border: 1px solid rgba(248, 113, 113, 0.35);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.metric-card {
  min-height: 156px;
  display: grid;
  align-content: space-between;
  gap: 10px;
  padding: 22px;
  border-radius: 28px;
}

.metric-card span {
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.metric-card strong {
  font-size: 2.5rem;
  letter-spacing: -0.07em;
}

.metric-card p {
  color: #64748b;
  line-height: 1.5;
}

.metric-card.good strong {
  color: #047857;
}

.metric-card.watch strong {
  color: #b45309;
}

.metric-card.risk strong {
  color: #b91c1c;
}

.ranking-panel {
  padding: 24px;
  border-radius: 32px;
}

.ranking-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.compact-banner {
  margin-bottom: 16px;
}

.ranking-metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.ranking-metric-card {
  min-height: 138px;
  display: grid;
  align-content: space-between;
  gap: 10px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid rgba(37, 99, 235, 0.13);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.84), rgba(239, 246, 255, 0.72)),
    radial-gradient(circle at top right, rgba(99, 102, 241, 0.12), transparent 36%);
}

.ranking-metric-card span {
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.ranking-metric-card strong {
  color: #172554;
  font-size: 2.2rem;
  letter-spacing: -0.06em;
}

.ranking-metric-card p,
.candidate-row p,
.ranking-status {
  color: #64748b;
  line-height: 1.5;
}

.ranking-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;
  margin-top: 18px;
}

.ranking-workspace article {
  min-height: 250px;
  padding: 18px;
  border-radius: 26px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.58);
}

.mini-panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.mini-panel-head strong {
  color: #111827;
}

.mini-panel-head span {
  color: #64748b;
  font-weight: 800;
}

.compact-bars {
  gap: 12px;
}

.bar-fill.violet {
  background: linear-gradient(90deg, #6366f1, #22d3ee);
}

.candidate-list {
  display: grid;
  gap: 10px;
}

.candidate-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.82);
  background: rgba(248, 250, 252, 0.72);
}

.candidate-row strong {
  display: block;
  max-width: 360px;
  overflow: hidden;
  color: #111827;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-row span {
  flex: none;
  padding: 7px 10px;
  border-radius: 999px;
  color: #1d4ed8;
  background: rgba(219, 234, 254, 0.82);
  font-size: 0.84rem;
  font-weight: 900;
}

.ranking-status {
  margin-top: 14px;
  font-weight: 800;
}

.workspace-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.analysis-panel,
.recent-panel {
  padding: 24px;
  border-radius: 32px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 16px;
  margin-bottom: 20px;
}

.panel-chip {
  flex: none;
  padding: 8px 12px;
  border-radius: 999px;
  color: #64748b;
  background: rgba(241, 245, 249, 0.9);
  font-size: 0.75rem;
  font-weight: 900;
}

.bar-list,
.insight-list {
  display: grid;
  gap: 14px;
}

.bar-row {
  display: grid;
  gap: 9px;
}

.bar-copy {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.bar-copy strong {
  color: #111827;
}

.bar-copy span {
  color: #64748b;
  font-size: 0.9rem;
}

.bar-track {
  height: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.9);
}

.bar-fill {
  height: 100%;
  border-radius: inherit;
}

.bar-fill.warm {
  background: linear-gradient(90deg, #f97316, #facc15);
}

.bar-fill.cool {
  background: linear-gradient(90deg, #38bdf8, #10b981);
}

.empty-state {
  display: grid;
  place-items: center;
  min-height: 220px;
  gap: 8px;
  text-align: center;
  color: #64748b;
  border: 1px dashed rgba(148, 163, 184, 0.45);
  border-radius: 24px;
  background: rgba(248, 250, 252, 0.68);
}

.empty-state strong {
  color: #111827;
}

.empty-state.compact {
  min-height: 132px;
}

.insight-card {
  padding: 16px;
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.6);
}

.insight-card strong {
  display: block;
  margin-bottom: 7px;
}

.insight-card p {
  color: #64748b;
  line-height: 1.55;
}

.insight-card.good {
  border-color: rgba(16, 185, 129, 0.24);
}

.insight-card.watch {
  border-color: rgba(245, 158, 11, 0.3);
}

.insight-card.risk {
  border-color: rgba(239, 68, 68, 0.28);
}

.engine-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.engine-card {
  min-height: 120px;
  display: grid;
  align-content: center;
  gap: 6px;
  padding: 16px;
  border-radius: 22px;
  background: rgba(248, 250, 252, 0.82);
}

.engine-card span,
.engine-card small {
  color: #64748b;
  font-weight: 800;
}

.engine-card strong {
  font-size: 2rem;
}

.table-shell {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
  text-align: left;
  white-space: nowrap;
}

th {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

td {
  color: #334155;
  font-weight: 700;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  color: #475569;
  background: rgba(226, 232, 240, 0.78);
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: capitalize;
}

.status-pill.success {
  color: #047857;
  background: rgba(209, 250, 229, 0.8);
}

.status-pill.decode_failed,
.status-pill.startup_failed {
  color: #b91c1c;
  background: rgba(254, 226, 226, 0.82);
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 220px;
}

.tag-pill {
  display: inline-flex;
  padding: 5px 8px;
  border-radius: 999px;
  color: #475569;
  background: rgba(241, 245, 249, 0.9);
  font-size: 0.72rem;
  font-weight: 800;
}

@media (max-width: 1100px) {
  .metric-grid,
  .ranking-metric-grid,
  .workspace-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ranking-workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .scanner-performance {
    padding: 18px;
  }

  .page-header,
  .header-copy,
  .header-actions,
  .hero-panel {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .metric-grid,
  .ranking-metric-grid,
  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .hero-orb {
    width: 142px;
    height: 142px;
  }

  .engine-grid {
    grid-template-columns: 1fr;
  }

  .bar-copy {
    display: grid;
  }
}
</style>
