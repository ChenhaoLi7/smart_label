<template>
  <div class="recovery-benchmark">
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>

    <header class="page-header glass-panel no-print">
      <div class="header-copy">
        <button class="icon-btn" @click="goBack" aria-label="Back to scanner metrics">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div>
          <p class="eyebrow">Scanner Lab · Phase 1</p>
          <h1>Recovery Benchmark Setup</h1>
          <p class="header-subtitle">
            Generate controlled Code 128 labels and verify every physical label under normal capture conditions before collecting difficult cases.
          </p>
        </div>
      </div>

      <div class="header-actions">
        <button class="soft-btn" @click="downloadManifest">Download manifest</button>
        <button class="primary-btn" @click="printLabels">Print labels</button>
      </div>
    </header>

    <main class="page-body">
      <section class="phase-banner glass-panel no-print">
        <div class="phase-copy">
          <span class="phase-number">01</span>
          <div>
            <p class="eyebrow">Current boundary</p>
            <h2>Labels and normal references only</h2>
            <p>No difficult-scene collection, Expert Bank comparison, Router, or Scheduler is active on this page.</p>
          </div>
        </div>
        <div class="progress-block">
          <strong>{{ passedCount }}/{{ labels.length }}</strong>
          <span>normal references passed</span>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
          </div>
        </div>
      </section>

      <section class="workspace-grid">
        <article class="label-panel glass-panel print-sheet">
          <div class="panel-head no-print">
            <div>
              <p class="eyebrow">Controlled labels</p>
              <h2>Code 128 pilot set</h2>
              <p>Five values, one print format, fixed physical IDs.</p>
            </div>
            <span class="panel-chip">Manifest v1</span>
          </div>

          <div class="label-grid">
            <article v-for="label in labels" :key="label.physicalId" class="print-label">
              <div class="label-meta">
                <span>{{ label.physicalId }}</span>
                <span>CODE 128</span>
              </div>
              <svg class="barcode-svg" :data-barcode-value="label.value"></svg>
              <strong>{{ label.value }}</strong>
            </article>
          </div>

          <div class="print-guidance no-print">
            <strong>Print control</strong>
            <p>Use the same printer, paper, scale, and orientation. Print at 100% and do not use “fit to page” if it changes the physical label size.</p>
          </div>
        </article>

        <article class="validation-panel glass-panel no-print">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Normal reference</p>
              <h2>Verify before degradation</h2>
              <p>Capture one clear, front-facing image. The expected value and CODE_128 format must both match.</p>
            </div>
            <span class="panel-chip">ZXing · no preprocessing</span>
          </div>

          <div class="validation-form">
            <label class="field-shell">
              <span>Expected physical label</span>
              <select v-model="selectedValue">
                <option v-for="label in labels" :key="label.physicalId" :value="label.value">
                  {{ label.physicalId }} · {{ label.value }}
                </option>
              </select>
            </label>

            <label class="capture-btn" :class="{ disabled: decoding }">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                :disabled="decoding"
                @change="handleReferenceImage"
              >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {{ decoding ? 'Decoding reference…' : 'Capture or upload normal reference' }}
            </label>
          </div>

          <div v-if="previewUrl || decodeResult" class="reference-workspace">
            <div class="preview-shell">
              <img v-if="previewUrl" :src="previewUrl" alt="Normal reference preview">
              <span v-else>No image selected</span>
            </div>

            <div v-if="decodeResult" class="result-card" :class="decodeResult.passed ? 'passed' : 'failed'">
              <div class="result-status">
                <span>{{ decodeResult.passed ? 'PASS' : 'FAIL' }}</span>
                <strong>{{ decodeResult.passed ? 'Normal reference verified' : 'Reference not verified' }}</strong>
              </div>
              <dl>
                <div>
                  <dt>Expected</dt>
                  <dd>{{ decodeResult.expected }}</dd>
                </div>
                <div>
                  <dt>Decoded</dt>
                  <dd>{{ decodeResult.decoded || 'No value returned' }}</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>{{ decodeResult.format || 'Unknown' }}</dd>
                </div>
                <div>
                  <dt>Raw decode</dt>
                  <dd>{{ formatMs(decodeResult.decodeMs) }}</dd>
                </div>
              </dl>
              <p v-if="decodeResult.logError" class="log-warning">Decoded locally, but the benchmark log could not be saved: {{ decodeResult.logError }}</p>
            </div>
          </div>

          <div class="reference-list">
            <div v-for="label in labels" :key="`status-${label.physicalId}`" class="reference-row">
              <div>
                <strong>{{ label.physicalId }}</strong>
                <span>{{ label.value }}</span>
              </div>
              <span v-if="referenceState[label.value]" class="status-pill passed">
                Verified {{ formatDate(referenceState[label.value].passedAt) }}
              </span>
              <span v-else class="status-pill pending">Pending</span>
            </div>
          </div>

          <button v-if="passedCount" class="reset-btn" @click="resetLocalProgress">
            Reset local reference progress
          </button>
        </article>
      </section>

      <section class="protocol-panel glass-panel no-print">
        <div>
          <p class="eyebrow">Acceptance protocol</p>
          <h2>A label enters Phase 1 only after a clean exact match</h2>
        </div>
        <div class="protocol-grid">
          <div><span>1</span><p>Print all labels with the same material and scale.</p></div>
          <div><span>2</span><p>Assign and preserve the printed physical label ID.</p></div>
          <div><span>3</span><p>Capture a clear front-facing normal reference.</p></div>
          <div><span>4</span><p>Require exact content and CODE_128 format before difficult capture.</p></div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { BarcodeFormat } from '@zxing/library'
import JsBarcode from 'jsbarcode'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createEnhancedCodeReader } from '@/utils/enhancedScanner'

const router = useRouter()
const reader = createEnhancedCodeReader()
const STORAGE_KEY = 'recovery-benchmark-normal-reference-v1'

const labels = Object.freeze([
  { physicalId: 'LABEL_001', value: 'ITEM0001' },
  { physicalId: 'LABEL_002', value: 'ITEM0002' },
  { physicalId: 'LABEL_003', value: 'ITEM0003' },
  { physicalId: 'LABEL_004', value: 'ITEM0004' },
  { physicalId: 'LABEL_005', value: 'ITEM0005' }
])

const selectedValue = ref(labels[0].value)
const previewUrl = ref('')
const decoding = ref(false)
const decodeResult = ref(null)
const referenceState = ref(loadReferenceState())

const passedCount = computed(() => labels.filter((label) => referenceState.value[label.value]).length)
const progressPercent = computed(() => Math.round((passedCount.value / labels.length) * 100))

function loadReferenceState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (_error) {
    return {}
  }
}

function saveReferenceState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(referenceState.value))
}

async function renderBarcodes() {
  await nextTick()
  document.querySelectorAll('.barcode-svg').forEach((element) => {
    JsBarcode(element, element.dataset.barcodeValue, {
      format: 'CODE128',
      width: 2.4,
      height: 70,
      margin: 12,
      displayValue: false,
      background: '#ffffff',
      lineColor: '#05070a'
    })
  })
}

function normalizeFormat(result) {
  const rawFormat = result?.getBarcodeFormat?.()
  if (typeof rawFormat === 'number' && BarcodeFormat[rawFormat]) return BarcodeFormat[rawFormat]
  return rawFormat == null ? '' : String(rawFormat)
}

function loadImage(sourceUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The selected image could not be opened.'))
    image.src = sourceUrl
  })
}

function buildDecodeCanvas(image) {
  const maxDimension = 2400
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function recordReferenceAttempt(payload) {
  const token = localStorage.getItem('token')
  if (!token) throw new Error('Authentication token is missing.')

  const response = await fetch('/api/scan/benchmark', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Benchmark log request failed.')
  }
}

async function handleReferenceImage(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || decoding.value) return

  decoding.value = true
  decodeResult.value = null

  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)

  const selectedLabel = labels.find((label) => label.value === selectedValue.value)
  const sessionId = `normal-reference-${selectedLabel.physicalId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const startedAt = new Date()
  let decoded = ''
  let format = ''
  let decodeMs = 0
  let canvas = null
  let localError = ''

  try {
    const image = await loadImage(previewUrl.value)
    canvas = buildDecodeCanvas(image)
    const decodeStart = performance.now()

    try {
      const result = reader.decodeFromCanvas(canvas)
      decoded = result?.getText?.() || ''
      format = normalizeFormat(result)
    } catch (_error) {
      decoded = ''
      format = ''
    }

    decodeMs = performance.now() - decodeStart
  } catch (error) {
    localError = error.message || 'Reference image could not be processed.'
  }

  const exactMatch = decoded === selectedLabel.value
  const code128Match = format === 'CODE_128'
  const passed = exactMatch && code128Match
  const completedAt = new Date()

  const nextResult = {
    expected: selectedLabel.value,
    decoded,
    format,
    decodeMs,
    passed,
    logError: localError
  }
  decodeResult.value = nextResult

  if (passed) {
    referenceState.value = {
      ...referenceState.value,
      [selectedLabel.value]: {
        physicalLabelId: selectedLabel.physicalId,
        passedAt: completedAt.toISOString(),
        decoded,
        format,
        decodeMs: Math.round(decodeMs)
      }
    }
    saveReferenceState()
  }

  try {
    await recordReferenceAttempt({
      id: sessionId,
      mode: 'normal-reference',
      status: passed ? 'success' : 'decode_failed',
      labelType: 'CODE_128',
      rawData: decoded,
      startedAt: startedAt.toISOString(),
      completedAtIso: completedAt.toISOString(),
      lockMs: Math.round(decodeMs),
      decodeAttempts: 1,
      frameSamples: 1,
      decodePath: 'normal-reference-no-preprocessing',
      decodedFormat: format || null,
      decodeEngine: 'ZXing BrowserMultiFormatReader',
      scenarioTags: ['phase-1', 'normal-reference', 'code-128'],
      physicalLabelId: selectedLabel.physicalId,
      expectedValue: selectedLabel.value,
      exactMatch,
      formatMatch: code128Match,
      sourceFilename: file.name,
      sourceMimeType: file.type,
      sourceWidth: canvas?.width || null,
      sourceHeight: canvas?.height || null
    })
  } catch (error) {
    decodeResult.value = {
      ...nextResult,
      logError: error.message || 'Benchmark log could not be saved.'
    }
  } finally {
    decoding.value = false
  }
}

function printLabels() {
  window.print()
}

function downloadManifest() {
  const lines = [
    'manifest_version,physical_label_id,barcode_value,symbology',
    ...labels.map((label) => `v1,${label.physicalId},${label.value},CODE_128`)
  ]
  const blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'recovery-benchmark-label-manifest-v1.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function resetLocalProgress() {
  if (!window.confirm('Reset the normal-reference progress stored on this browser? Server benchmark logs will remain unchanged.')) return
  referenceState.value = {}
  localStorage.removeItem(STORAGE_KEY)
  decodeResult.value = null
}

function formatMs(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)} ms` : '-'
}

function formatDate(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed)
}

function goBack() {
  router.push('/scanner-performance')
}

onMounted(renderBarcodes)

onBeforeUnmount(() => {
  reader.reset?.()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<style scoped>
.recovery-benchmark {
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  padding: 30px;
  color: #111827;
  background:
    radial-gradient(circle at 6% 10%, rgba(125, 211, 252, 0.34), transparent 30%),
    radial-gradient(circle at 94% 12%, rgba(196, 181, 253, 0.28), transparent 30%),
    linear-gradient(135deg, #f8fafc 0%, #eef4f7 50%, #f8fafc 100%);
}

.ambient {
  position: fixed;
  border-radius: 999px;
  pointer-events: none;
  filter: blur(20px);
  opacity: 0.5;
}

.ambient-one {
  width: 320px;
  height: 320px;
  top: -120px;
  left: 8%;
  background: rgba(56, 189, 248, 0.22);
}

.ambient-two {
  width: 360px;
  height: 360px;
  right: -120px;
  bottom: 8%;
  background: rgba(139, 92, 246, 0.15);
}

.glass-panel {
  position: relative;
  z-index: 1;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(28px);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border-radius: 32px;
}

.header-copy,
.header-actions,
.phase-copy,
.panel-head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-copy > div,
.panel-head > div {
  min-width: 0;
}

.icon-btn,
.soft-btn,
.primary-btn,
.reset-btn {
  border: 1px solid rgba(148, 163, 184, 0.28);
  cursor: pointer;
  font-weight: 800;
}

.icon-btn {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
}

.soft-btn,
.primary-btn {
  min-height: 46px;
  padding: 0 18px;
  border-radius: 16px;
}

.soft-btn {
  background: rgba(255, 255, 255, 0.88);
  color: #111827;
}

.primary-btn {
  border-color: #111827;
  background: #111827;
  color: white;
}

.eyebrow {
  margin: 0 0 6px;
  color: #7c8aa0;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.17em;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: clamp(2rem, 4vw, 3.5rem);
  letter-spacing: -0.06em;
}

h2 {
  font-size: clamp(1.35rem, 2.4vw, 2rem);
  letter-spacing: -0.045em;
}

.header-subtitle,
.panel-head p,
.phase-copy p,
.print-guidance p {
  color: #64748b;
  line-height: 1.6;
}

.header-subtitle {
  max-width: 760px;
  margin-top: 8px;
}

.page-body {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 22px;
  margin-top: 22px;
}

.phase-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding: 24px 28px;
  border-radius: 28px;
}

.phase-number {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: #111827;
  color: white;
  font-size: 1.15rem;
  font-weight: 900;
}

.progress-block {
  min-width: 230px;
  text-align: right;
}

.progress-block strong {
  display: block;
  font-size: 1.65rem;
}

.progress-block span {
  color: #64748b;
  font-size: 0.85rem;
}

.progress-track {
  height: 8px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #10b981);
  transition: width 0.25s ease;
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(420px, 0.95fr);
  gap: 22px;
  align-items: start;
}

.label-panel,
.validation-panel,
.protocol-panel {
  padding: 24px;
  border-radius: 30px;
}

.panel-head {
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.panel-chip {
  flex: 0 0 auto;
  padding: 8px 12px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 0.75rem;
  font-weight: 900;
}

.label-grid {
  display: grid;
  gap: 14px;
}

.print-label {
  width: min(100%, 90mm);
  height: 35mm;
  min-height: 35mm;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2mm 5mm;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  break-inside: avoid;
}

.label-meta {
  width: 100%;
  display: flex;
  justify-content: space-between;
  color: #64748b;
  font-size: 0.55rem;
  font-weight: 900;
  letter-spacing: 0.1em;
}

.barcode-svg {
  width: 100%;
  max-height: 19mm;
  margin-top: 1mm;
}

.print-label > strong {
  margin-top: 0.5mm;
  color: #05070a;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
}

.print-guidance {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.print-guidance strong {
  display: block;
  margin-bottom: 4px;
}

.validation-form {
  display: grid;
  gap: 14px;
}

.field-shell {
  display: grid;
  gap: 7px;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.field-shell select {
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid #cbd5e1;
  border-radius: 15px;
  background: white;
  color: #111827;
  font-size: 1rem;
  font-weight: 800;
}

.capture-btn {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 16px;
  background: #111827;
  color: white;
  cursor: pointer;
  font-weight: 900;
}

.capture-btn.disabled {
  cursor: wait;
  opacity: 0.65;
}

.capture-btn input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.reference-workspace {
  display: grid;
  grid-template-columns: minmax(130px, 0.72fr) minmax(0, 1.28fr);
  gap: 14px;
  margin-top: 18px;
}

.preview-shell {
  min-height: 190px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 18px;
  background: #e2e8f0;
  color: #64748b;
}

.preview-shell img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: white;
}

.result-card {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid;
}

.result-card.passed {
  border-color: #a7f3d0;
  background: #ecfdf5;
}

.result-card.failed {
  border-color: #fecaca;
  background: #fff1f2;
}

.result-status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.result-status span {
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  font-size: 0.68rem;
  font-weight: 900;
}

.result-card dl {
  display: grid;
  gap: 8px;
  margin: 16px 0 0;
}

.result-card dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.result-card dt {
  color: #64748b;
}

.result-card dd {
  margin: 0;
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.log-warning {
  margin-top: 12px;
  color: #9f1239;
  font-size: 0.8rem;
  line-height: 1.5;
}

.reference-list {
  display: grid;
  gap: 9px;
  margin-top: 18px;
}

.reference-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.72);
}

.reference-row > div {
  display: grid;
  gap: 2px;
}

.reference-row span {
  color: #64748b;
  font-size: 0.8rem;
}

.status-pill {
  padding: 6px 9px;
  border-radius: 999px;
  font-weight: 900;
  white-space: nowrap;
}

.status-pill.passed {
  background: #d1fae5;
  color: #047857;
}

.status-pill.pending {
  background: #f1f5f9;
  color: #64748b;
}

.reset-btn {
  margin-top: 14px;
  padding: 9px 12px;
  border-radius: 12px;
  background: transparent;
  color: #64748b;
}

.protocol-panel {
  display: grid;
  grid-template-columns: minmax(240px, 0.7fr) minmax(0, 1.3fr);
  gap: 28px;
  align-items: center;
}

.protocol-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.protocol-grid > div {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: start;
  padding: 14px;
  border-radius: 16px;
  background: #f8fafc;
}

.protocol-grid span {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 9px;
  background: #111827;
  color: white;
  font-size: 0.75rem;
  font-weight: 900;
}

.protocol-grid p {
  color: #475569;
  line-height: 1.5;
}

@media (max-width: 1000px) {
  .workspace-grid,
  .protocol-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .recovery-benchmark {
    padding: 14px;
  }

  .page-header,
  .phase-banner,
  .header-copy,
  .panel-head {
    align-items: flex-start;
  }

  .page-header,
  .phase-banner {
    flex-direction: column;
  }

  .header-actions,
  .header-actions button,
  .progress-block {
    width: 100%;
  }

  .progress-block {
    text-align: left;
  }

  .workspace-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .reference-workspace,
  .protocol-grid {
    grid-template-columns: 1fr;
  }

  .reference-row {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media print {
  .recovery-benchmark {
    min-height: auto;
    padding: 0;
    background: white;
  }

  .no-print,
  .ambient,
  .validation-panel,
  .protocol-panel {
    display: none !important;
  }

  .page-body,
  .workspace-grid {
    display: block;
    margin: 0;
  }

  .print-sheet {
    padding: 0;
    border: 0;
    background: white;
    box-shadow: none;
  }

  .label-grid {
    gap: 5mm;
  }

  .print-label {
    width: 90mm;
    min-height: 35mm;
    border: 0.35mm solid #111827;
    border-radius: 2mm;
  }
}
</style>
