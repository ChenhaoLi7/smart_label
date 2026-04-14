<template>
  <div class="barcode-lookup-overlay" @click.self="$emit('close')">
    <div class="barcode-lookup-modal">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon">🔍</div>
          <div>
            <h2>Scan to Add Item</h2>
            <p class="header-subtitle">Scan a barcode to auto-fill product info</p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- Step 1: Camera Scanner -->
      <div v-if="step === 'scan'" class="step-scan">
        <div class="scanner-area">
          <div class="scanner-frame" :class="{ scanning: isScanning, found: scanSuccess }">
            <video ref="videoEl" class="scanner-video" autoplay muted playsinline></video>
            <div class="scan-line" v-if="isScanning"></div>
            <div class="corner tl"></div>
            <div class="corner tr"></div>
            <div class="corner bl"></div>
            <div class="corner br"></div>
            <div class="scan-success-overlay" v-if="scanSuccess">
              <div class="success-icon">✓</div>
              <p>{{ scannedBarcode }}</p>
            </div>
          </div>
          <p class="scanner-hint" v-if="isScanning && !scanSuccess">
            Point camera at a barcode on the product
          </p>
          <p class="scanner-hint error" v-if="scanError">{{ scanError }}</p>

          <div v-if="devices.length > 1" class="camera-toolbar">
            <span class="camera-chip">{{ activeCameraLabel }}</span>
            <button
              type="button"
              class="camera-switch-btn"
              :disabled="isSwitchingCamera"
              @click="switchCamera"
            >
              {{ isSwitchingCamera ? 'Switching...' : switchCameraButtonLabel }}
            </button>
          </div>
        </div>

        <!-- Manual input fallback -->
        <div class="manual-input-section">
          <div class="divider"><span>or enter barcode manually</span></div>
          <div class="manual-input-row">
            <input
              v-model="manualBarcode"
              class="manual-input"
              placeholder="e.g. 4902102141673"
              @keyup.enter="lookupBarcode(manualBarcode)"
            />
            <button
              class="btn-lookup"
              @click="lookupBarcode(manualBarcode)"
              :disabled="!manualBarcode || isLooking"
            >
              {{ isLooking ? '...' : 'Lookup' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Step 2: Review & Confirm -->
      <div v-if="step === 'confirm'" class="step-confirm">
        <!-- Found Product Card -->
        <div class="product-found-card" v-if="foundProduct">
          <div class="product-found-header">
            <div class="found-badge">✓ Product Identified</div>
            <span class="barcode-display">{{ scannedBarcode }}</span>
          </div>
          <div class="product-preview">
            <img
              v-if="foundProduct.image_url"
              :src="foundProduct.image_url"
              class="product-image"
              @error="imageError = true"
              v-show="!imageError"
            />
            <div class="product-image-placeholder" v-if="!foundProduct.image_url || imageError">
              📦
            </div>
            <div class="product-info-block">
              <div class="product-name">{{ foundProduct.product_name }}</div>
              <div class="product-brand" v-if="foundProduct.brands">{{ foundProduct.brands }}</div>
              <div class="product-category" v-if="foundProduct.categories_en">
                {{ foundProduct.categories_en.split(',')[0].trim() }}
              </div>
            </div>
          </div>
        </div>

        <!-- Not Found Banner -->
        <div class="product-not-found" v-if="!foundProduct">
          <div class="not-found-icon">🔎</div>
          <p>Product not found in public database.<br>Please fill in details manually.</p>
        </div>

        <!-- Form Fields -->
        <div class="form-section">
          <div class="form-row">
            <label>SKU / Barcode <span class="required">*</span></label>
            <input v-model="form.sku" class="form-input" placeholder="e.g. 4902102141673" />
          </div>
          <div class="form-row">
            <label>Product Name <span class="required">*</span></label>
            <input v-model="form.name" class="form-input" placeholder="e.g. Coca-Cola 350ml" />
          </div>
          <div class="form-row two-col">
            <div>
              <label>Brand / Description</label>
              <input v-model="form.description" class="form-input" placeholder="e.g. Coca-Cola" />
            </div>
            <div>
              <label>Category</label>
              <input v-model="form.category" class="form-input" placeholder="e.g. Beverages" />
            </div>
          </div>
          <div class="form-row two-col">
            <div>
              <label>Unit of Measure</label>
              <select v-model="form.uom" class="form-input">
                <option value="pcs">pcs (pieces)</option>
                <option value="can">can</option>
                <option value="bottle">bottle</option>
                <option value="box">box</option>
                <option value="pack">pack</option>
                <option value="kg">kg</option>
                <option value="L">L</option>
              </select>
            </div>
            <div>
              <label>Min Stock Alert</label>
              <input v-model.number="form.min_stock" type="number" min="0" class="form-input" placeholder="0" />
            </div>
          </div>
          <div class="form-row two-col">
            <div>
              <label>Price</label>
              <input v-model.number="form.price" type="number" min="0" step="0.01" class="form-input" placeholder="Optional" />
            </div>
            <div>
              <label>Status</label>
              <select v-model="form.status" class="form-input">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="DISCONTINUED">DISCONTINUED</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="step === 'loading'" class="step-loading">
        <div class="loading-spinner"></div>
        <p>Looking up barcode in database...</p>
        <p class="barcode-loading-text">{{ scannedBarcode }}</p>
      </div>

      <!-- Footer Actions -->
      <div class="modal-footer">
        <button v-if="step === 'confirm'" class="btn-secondary" @click="step = 'scan'; resetProduct()">
          ← Scan Again
        </button>
        <button v-if="step === 'scan'" class="btn-secondary" @click="$emit('close')">
          Cancel
        </button>
        <button
          v-if="step === 'confirm'"
          class="btn-primary"
          @click="createItem"
          :disabled="!form.sku || !form.name || isSaving"
        >
          <span v-if="isSaving">⏳ Saving...</span>
          <span v-else>✓ Add to Inventory</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
/* eslint-disable no-undef */
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import {
  buildPreferredVideoConstraints,
  createEnhancedCodeReader
} from '@/utils/enhancedScanner'

const emit = defineEmits(['close', 'item-created'])

// ── State ──────────────────────────────────────────────────────────────
const step = ref('scan')        // 'scan' | 'loading' | 'confirm'
const isScanning = ref(false)
const scanSuccess = ref(false)
const scanError = ref('')
const scannedBarcode = ref('')
const manualBarcode = ref('')
const isLooking = ref(false)
const isSaving = ref(false)
const foundProduct = ref(null)
const imageError = ref(false)
const videoEl = ref(null)
const devices = ref([])
const selectedDeviceId = ref('')
const currentFacingMode = ref('environment')
const activeCameraLabel = ref('Rear Camera')
const isSwitchingCamera = ref(false)

const form = ref({
  sku: '',
  name: '',
  description: '',
  category: 'Beverages',
  uom: 'can',
  min_stock: 5,
  price: '',
  status: 'ACTIVE'
})

let codeReader = null
let stream = null
let scanLoopFrame = null
let lastDecodeAttemptAt = 0
const scanCanvasCache = {}

// ── Camera setup ───────────────────────────────────────────────────────
const isRearCameraLabel = (label = '') => /back|rear|environment|后|後/i.test(label)
const isFrontCameraLabel = (label = '') => /front|user|facetime|前/i.test(label)

const switchCameraButtonLabel = computed(() => (
  currentFacingMode.value === 'user' ? 'Use Rear Camera' : 'Switch Camera'
))

const getCodeReader = () => {
  if (!codeReader) {
    codeReader = createEnhancedCodeReader()
  }

  return codeReader
}

const refreshDevices = async () => {
  const allDevices = await navigator.mediaDevices.enumerateDevices()
  const videoDevices = allDevices.filter(device => device.kind === 'videoinput')
  devices.value = videoDevices

  if (!selectedDeviceId.value && videoDevices.length > 0) {
    const preferredDevice = videoDevices.find(device => isRearCameraLabel(device.label)) || videoDevices[videoDevices.length - 1]
    selectedDeviceId.value = preferredDevice.deviceId
  }
}

const syncActiveCameraState = async () => {
  await refreshDevices()

  const stream = videoEl.value?.srcObject
  const track = stream?.getVideoTracks?.()[0]
  const settings = track?.getSettings?.() || {}

  if (settings.deviceId) {
    selectedDeviceId.value = settings.deviceId
  }

  if (settings.facingMode) {
    currentFacingMode.value = settings.facingMode
  }

  const activeDevice = devices.value.find(device => device.deviceId === selectedDeviceId.value)
  if (activeDevice?.label) {
    activeCameraLabel.value = activeDevice.label
    if (isFrontCameraLabel(activeDevice.label)) {
      currentFacingMode.value = 'user'
    } else if (isRearCameraLabel(activeDevice.label)) {
      currentFacingMode.value = 'environment'
    }
    return
  }

  activeCameraLabel.value = currentFacingMode.value === 'user' ? 'Front Camera' : 'Rear Camera'
}

const stopScanLoop = () => {
  if (scanLoopFrame) {
    window.cancelAnimationFrame(scanLoopFrame)
    scanLoopFrame = null
  }
}

const ensureScanCanvas = (key, width, height) => {
  if (!scanCanvasCache[key]) {
    scanCanvasCache[key] = document.createElement('canvas')
  }

  const canvas = scanCanvasCache[key]
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  return canvas
}

const tryDecodeCanvas = (canvas) => {
  try {
    const result = getCodeReader().decodeFromCanvas(canvas)
    if (!result?.getText?.()) return ''
    return String(result.getText()).trim()
  } catch (error) {
    return ''
  }
}

const decodeCurrentVideoFrame = (video) => {
  const videoWidth = video.videoWidth || 0
  const videoHeight = video.videoHeight || 0
  if (!videoWidth || !videoHeight) return ''

  const roiWidth = Math.min(videoWidth * 0.82, videoWidth)
  const roiHeight = Math.min(videoHeight * 0.5, videoHeight)
  const roiX = Math.max((videoWidth - roiWidth) / 2, 0)
  const roiY = Math.max((videoHeight - roiHeight) / 2, 0)

  const roiCanvas = ensureScanCanvas('roiCanvas', Math.round(roiWidth), Math.round(roiHeight))
  const roiCtx = roiCanvas.getContext('2d', { willReadFrequently: true })
  roiCtx.drawImage(video, roiX, roiY, roiWidth, roiHeight, 0, 0, roiCanvas.width, roiCanvas.height)

  const roiResult = tryDecodeCanvas(roiCanvas)
  if (roiResult) return roiResult

  const fullWidth = Math.min(videoWidth, 1280)
  const fullHeight = Math.min(videoHeight, 720)
  const fullCanvas = ensureScanCanvas('fullCanvas', Math.round(fullWidth), Math.round(fullHeight))
  const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true })
  fullCtx.drawImage(video, 0, 0, videoWidth, videoHeight, 0, 0, fullCanvas.width, fullCanvas.height)

  return tryDecodeCanvas(fullCanvas)
}

const runEnhancedScanLoop = () => {
  if (!isScanning.value || !videoEl.value) return

  scanLoopFrame = window.requestAnimationFrame(runEnhancedScanLoop)

  const video = videoEl.value
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return

  const now = performance.now()
  if (now - lastDecodeAttemptAt < 90) return
  lastDecodeAttemptAt = now
  const decodedText = decodeCurrentVideoFrame(video)
  if (!decodedText) return

  onBarcodeScan(decodedText)
}

const startCamera = async () => {
  try {
    stopCamera()
    scanError.value = ''
    await nextTick()
    isScanning.value = true

    const constraints = buildPreferredVideoConstraints(selectedDeviceId.value, 'environment')
    stream = await navigator.mediaDevices.getUserMedia(constraints)
    videoEl.value.srcObject = stream
    await videoEl.value.play()

    getCodeReader()
    lastDecodeAttemptAt = 0
    stopScanLoop()
    runEnhancedScanLoop()

    await syncActiveCameraState()
  } catch (err) {
    console.error('Camera error:', err)
    if (err.name === 'NotAllowedError') {
      scanError.value = 'Camera access denied. Please allow camera access or use manual input.'
    } else {
      scanError.value = 'Could not start camera. Use manual input below.'
    }
    isScanning.value = false
  }
}

const stopCamera = () => {
  stopScanLoop()
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
  if (codeReader) {
    try { codeReader.reset() } catch (e) { /* ignore */ }
    codeReader = null
  }
  if (videoEl.value) {
    videoEl.value.srcObject = null
  }
  isScanning.value = false
}

const switchCamera = async () => {
  if (isSwitchingCamera.value || devices.value.length <= 1) return

  isSwitchingCamera.value = true

  try {
    const currentIndex = devices.value.findIndex(device => device.deviceId === selectedDeviceId.value)
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % devices.value.length : 0
    const nextDevice = devices.value[nextIndex]

    selectedDeviceId.value = nextDevice.deviceId
    currentFacingMode.value = isFrontCameraLabel(nextDevice.label) ? 'user' : 'environment'
    activeCameraLabel.value = nextDevice.label || (currentFacingMode.value === 'user' ? 'Front Camera' : 'Rear Camera')

    await startCamera()
  } catch (err) {
    console.error('Switch camera error:', err)
    scanError.value = 'Could not switch camera. Please try again.'
  } finally {
    isSwitchingCamera.value = false
  }
}

// ── Barcode Events ─────────────────────────────────────────────────────
const onBarcodeScan = (barcode) => {
  if (scanSuccess.value) return   // debounce - only process once
  scanSuccess.value = true
  scannedBarcode.value = barcode
  stopCamera()
  setTimeout(() => lookupBarcode(barcode), 600)
}

// ── Product Lookup via Backend Proxy (级联: OFF → Yahoo Japan) ────────
const lookupBarcode = async (barcode) => {
  if (!barcode) return
  scannedBarcode.value = barcode
  isLooking.value = true
  step.value = 'loading'

  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/barcode/${encodeURIComponent(barcode)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    const data = await res.json()

    if (data.success && data.data) {
      const p = data.data
      foundProduct.value = p
      form.value.sku = barcode
      form.value.name = p.product_name || ''
      form.value.description = p.brands || ''
      // Auto-detect category
      const cats = (p.categories_en || '').toLowerCase()
      if (cats.includes('beverage') || cats.includes('drink') || cats.includes('water') || cats.includes('soda') || cats.includes('飲料')) {
        form.value.category = 'Beverages'
      } else if (cats.includes('snack') || cats.includes('chip') || cats.includes('cookie') || cats.includes('菓子')) {
        form.value.category = 'Snacks'
      } else if (cats.includes('dairy') || cats.includes('milk') || cats.includes('yogurt') || cats.includes('乳製品')) {
        form.value.category = 'Dairy'
      } else {
        form.value.category = p.categories_en?.split(',')[0]?.trim() || 'Other'
      }
    } else {
      foundProduct.value = null
      form.value.sku = barcode
      form.value.name = ''
    }
  } catch (err) {
    console.error('Lookup failed:', err)
    foundProduct.value = null
    form.value.sku = barcode
  } finally {
    isLooking.value = false
    step.value = 'confirm'
    imageError.value = false
  }
}

// ── Create Item in System ──────────────────────────────────────────────
const createItem = async () => {
  if (!form.value.sku || !form.value.name) return
  isSaving.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/inventory-management/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(form.value)
    })
    const result = await res.json()
    if (result.success) {
      emit('item-created', result.data)
      emit('close')
    } else {
      alert('Failed: ' + result.message)
    }
  } catch (err) {
    alert('Network error: ' + err.message)
  } finally {
    isSaving.value = false
  }
}

const resetProduct = () => {
  foundProduct.value = null
  scannedBarcode.value = ''
  scanSuccess.value = false
  manualBarcode.value = ''
  form.value = { sku: '', name: '', description: '', category: 'Beverages', uom: 'can', min_stock: 5, price: '', status: 'ACTIVE' }
  startCamera()
}

// ── Lifecycle ──────────────────────────────────────────────────────────
onMounted(() => {
  startCamera()
})

onUnmounted(() => {
  stopCamera()
})
</script>

<style scoped>
/* ── Overlay ── */
.barcode-lookup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.barcode-lookup-modal {
  background: var(--glass-bg, rgba(28,28,30,0.95));
  border: 1px solid var(--glass-border, rgba(255,255,255,0.12));
  border-radius: 24px;
  width: 100%;
  max-width: 540px;
  max-height: 92vh;
  overflow-y: auto;
  box-shadow: 0 40px 80px rgba(0,0,0,0.5);
}

/* ── Header ── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--glass-border, rgba(255,255,255,0.08));
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #0A84FF, #5E5CE6);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.modal-header h2 {
  margin: 0 0 2px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #F5F5F7);
}

.header-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #86868b);
}

.close-btn {
  background: var(--input-bg, rgba(255,255,255,0.08));
  border: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: 16px;
  color: var(--text-secondary, #86868b);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.close-btn:hover { background: rgba(255,60,50,0.2); color: #ff3c32; }

/* ── Scanner Area ── */
.step-scan {
  padding: 20px 24px;
}

.scanner-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.scanner-frame {
  position: relative;
  width: 260px;
  height: 200px;
  border-radius: 16px;
  overflow: hidden;
  background: #000;
  border: 2px solid rgba(255,255,255,0.15);
  transition: border-color 0.3s;
}

.scanner-frame.scanning { border-color: #0A84FF; box-shadow: 0 0 20px rgba(10,132,255,0.3); }
.scanner-frame.found { border-color: #30D158; box-shadow: 0 0 20px rgba(48,209,88,0.4); }

.scanner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Scan animation line */
.scan-line {
  position: absolute;
  left: 10%;
  right: 10%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #0A84FF, transparent);
  animation: scanMove 2s ease-in-out infinite;
  top: 30%;
}
@keyframes scanMove {
  0%, 100% { top: 20%; }
  50% { top: 80%; }
}

/* Corner brackets */
.corner {
  position: absolute;
  width: 20px;
  height: 20px;
  border-color: #0A84FF;
  border-style: solid;
}
.corner.tl { top: 8px; left: 8px; border-width: 3px 0 0 3px; border-radius: 4px 0 0 0; }
.corner.tr { top: 8px; right: 8px; border-width: 3px 3px 0 0; border-radius: 0 4px 0 0; }
.corner.bl { bottom: 8px; left: 8px; border-width: 0 0 3px 3px; border-radius: 0 0 0 4px; }
.corner.br { bottom: 8px; right: 8px; border-width: 0 3px 3px 0; border-radius: 0 0 4px 0; }

.scan-success-overlay {
  position: absolute;
  inset: 0;
  background: rgba(48, 209, 88, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.success-icon {
  font-size: 40px;
  font-weight: 900;
  color: white;
}

.scan-success-overlay p {
  font-size: 12px;
  color: white;
  margin: 0;
  font-family: monospace;
}

.scanner-hint {
  font-size: 13px;
  color: var(--text-secondary, #86868b);
  text-align: center;
  margin: 0;
}
.scanner-hint.error { color: #FF453A; }

.camera-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.camera-chip {
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary, #86868b);
  font-size: 12px;
  font-weight: 600;
}

.camera-switch-btn {
  border: none;
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(10, 132, 255, 0.16);
  color: #82c7ff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.camera-switch-btn:hover:not(:disabled) {
  background: rgba(10, 132, 255, 0.24);
  color: #c2e3ff;
}

.camera-switch-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Manual Input ── */
.manual-input-section {
  margin-top: 16px;
  width: 100%;
}

.divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  color: var(--text-tertiary, #6e6e73);
  font-size: 12px;
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--glass-border, rgba(255,255,255,0.1));
}

.manual-input-row {
  display: flex;
  gap: 8px;
}

.manual-input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
  background: var(--input-bg, rgba(255,255,255,0.06));
  color: var(--text-primary, #F5F5F7);
  font-size: 14px;
  font-family: monospace;
  outline: none;
  transition: border-color 0.2s;
}
.manual-input:focus { border-color: #0A84FF; }
.manual-input::placeholder { color: var(--text-tertiary, #6e6e73); }

.btn-lookup {
  padding: 10px 18px;
  background: #0A84FF;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.btn-lookup:hover:not(:disabled) { background: #0071e3; }
.btn-lookup:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Loading ── */
.step-loading {
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--text-secondary, #86868b);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(10,132,255,0.2);
  border-top-color: #0A84FF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.barcode-loading-text {
  font-family: monospace;
  font-size: 16px;
  color: var(--text-primary, #F5F5F7);
  margin: 0;
}

/* ── Confirm ── */
.step-confirm {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.product-found-card {
  background: var(--input-bg, rgba(255,255,255,0.05));
  border: 1px solid rgba(48,209,88,0.3);
  border-radius: 16px;
  overflow: hidden;
}

.product-found-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: rgba(48,209,88,0.1);
}

.found-badge {
  font-size: 12px;
  font-weight: 700;
  color: #30D158;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.barcode-display {
  font-size: 11px;
  font-family: monospace;
  color: var(--text-secondary, #86868b);
}

.product-preview {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.product-image {
  width: 72px;
  height: 72px;
  object-fit: contain;
  border-radius: 10px;
  background: white;
  padding: 4px;
}

.product-image-placeholder {
  width: 72px;
  height: 72px;
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  flex-shrink: 0;
}

.product-info-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.product-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #F5F5F7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-brand {
  font-size: 13px;
  color: var(--text-secondary, #86868b);
}

.product-category {
  font-size: 11px;
  color: #0A84FF;
  background: rgba(10,132,255,0.12);
  padding: 2px 8px;
  border-radius: 6px;
  display: inline-block;
  width: fit-content;
}

.product-not-found {
  background: rgba(255,159,10,0.1);
  border: 1px solid rgba(255,159,10,0.3);
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  color: var(--text-secondary, #86868b);
  font-size: 14px;
  line-height: 1.5;
}

.not-found-icon { font-size: 28px; margin-bottom: 8px; }

/* ── Form ── */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-row label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #86868b);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.required { color: #FF453A; }

.form-input {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
  background: var(--input-bg, rgba(255,255,255,0.06));
  color: var(--text-primary, #F5F5F7);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}
.form-input:focus { border-color: #0A84FF; }
.form-input::placeholder { color: var(--text-tertiary, #6e6e73); }
select.form-input option { background: #1c1c1e; }

/* ── Footer ── */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px 24px;
  border-top: 1px solid var(--glass-border, rgba(255,255,255,0.08));
}

.btn-secondary {
  padding: 10px 20px;
  background: var(--input-bg, rgba(255,255,255,0.08));
  border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
  border-radius: 10px;
  color: var(--text-primary, #F5F5F7);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover { background: rgba(255,255,255,0.15); }

.btn-primary {
  padding: 10px 24px;
  background: #0A84FF;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-primary:hover:not(:disabled) { background: #0071e3; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

/* Mobile tweaks */
@media (max-width: 480px) {
  .barcode-lookup-modal { border-radius: 20px; }
  .form-row.two-col { grid-template-columns: 1fr; }
  .scanner-frame { width: 220px; height: 165px; }
}
</style>
