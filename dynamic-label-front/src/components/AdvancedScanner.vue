<template>
  <div class="scanner-container">
    <!-- 扫码模式选择 -->
    <div class="scanner-header">
      <h2 class="scanner-title">Smart Scan System</h2>
      <div class="mode-selector">
        <button 
          v-for="mode in scanModes" 
          :key="mode.value"
          :class="['mode-btn', { active: currentMode === mode.value }]"
          @click="switchMode(mode.value)"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <!-- 扫码区域 -->
    <div class="scanner-area">
      <!-- 摄像头预览 -->
      <div v-if="currentMode === 'camera'" class="camera-container">
        <div class="camera-stage">
          <video 
            ref="videoRef" 
            autoplay 
            playsinline
            webkit-playsinline="true"
            muted
            class="camera-video"
            :class="{ scanning: isScanning, ready: isVideoFrameReady, pending: !isVideoFrameReady }"
            @loadeddata="handleVideoFrameReady"
            @canplay="handleVideoFrameReady"
            @playing="handleVideoFrameReady"
          ></video>

          <div v-if="isScanning && !isVideoFrameReady" class="camera-stage-placeholder">
            <div class="camera-stage-placeholder-copy">
              <strong>Opening camera</strong>
              <p>Preparing the live preview…</p>
            </div>
          </div>
          
          <!-- 扫描框 -->
          <div class="scan-overlay">
            <div class="scan-frame">
              <div class="corner top-left"></div>
              <div class="corner top-right"></div>
              <div class="corner bottom-left"></div>
              <div class="corner bottom-right"></div>
            </div>
            <p class="scan-hint">Please place the barcode inside the frame</p>
          </div>
        </div>

        <!-- 摄像头控制 -->
        <div class="camera-controls">
          <button @click="toggleCamera" class="control-btn">
            {{ isScanning ? 'Stop Scan' : 'Retry Camera' }}
          </button>
          <button @click="switchCamera" class="control-btn" v-if="devices.length > 1">
            Switch Camera
          </button>
          <button @click="toggleFlash" class="control-btn flash-btn" :class="{ active: flashOn }" v-if="hasFlash">
            <span class="flash-icon">{{ flashOn ? '💡' : '🔦' }}</span>
            {{ flashOn ? 'Light Off' : 'Light On' }}
          </button>
        </div>

      </div>

      <!-- 文件上传 -->
      <div v-if="currentMode === 'file'" class="file-upload">
        <div class="upload-area" @click="triggerFileInput">
          <input 
            ref="fileInput" 
            type="file" 
            accept="image/*" 
            @change="handleFileUpload" 
            style="display: none"
          />
          <div class="upload-icon">📁</div>
          <p>Click to select an image or drag it here</p>
          <p class="upload-hint">Supports JPG and PNG formats</p>
        </div>
      </div>

      <!-- 手动输入 -->
      <div v-if="currentMode === 'manual'" class="manual-input">
        <input 
          v-model="manualCode" 
          type="text" 
          placeholder="Please enter the barcode content"
          class="manual-input-field"
          @keyup.enter="handleManualSubmit"
        />
        <button @click="handleManualSubmit" class="submit-btn">Confirm</button>
      </div>
    </div>

    <!-- 扫描结果 -->
    <div v-if="scanResult" class="scan-result">
      <h3>Scan Result</h3>
      <div class="result-content">
        <div class="result-item">
          <span class="label">Raw Data:</span>
          <span class="value">{{ scanResult.raw }}</span>
        </div>
        <div class="result-item">
          <span class="label">Scan Time:</span>
          <span class="value">{{ scanResult.timestamp }}</span>
        </div>
      </div>

      <!-- 业务操作按钮 -->
      <div class="business-actions">
        <!-- 自动识别未入库商品时显示快速建档按钮 -->
        <button v-if="isAdmin && scanAction === 'CREATE_ITEM'" @click="showCreateItemModal = true" class="action-btn" style="background: #10b981; color: white; border-color: #10b981;">
          <span class="icon">➕</span>
          Fast Item Creation
        </button>

        <button v-if="isAdmin" @click="handleInbound" class="action-btn inbound">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Inbound Processing
        </button>
        <button v-if="isAdmin" @click="handleMove" class="action-btn" style="background: #0f172a; color: white;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 3h5v5"/>
            <path d="M4 20L21 3"/>
            <path d="M8 21H3v-5"/>
            <path d="M15 15l6 6"/>
            <path d="M3 3l6 6"/>
          </svg>
          Move Bin
        </button>
        <button @click="handleOutbound" class="action-btn outbound">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Outbound Processing
        </button>
        <button @click="clearResult" class="action-btn clear">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Clear Result
        </button>
      </div>
    </div>

    <div v-if="actionFeedbackModal.visible" class="modal-overlay modal-overlay-foreground" @click="closeActionFeedbackModal">
      <div class="modal-content action-feedback-modal" @click.stop>
        <div class="action-feedback-icon">✓</div>
        <h3>{{ actionFeedbackModal.title }}</h3>
        <p>{{ actionFeedbackModal.message }}</p>
        <button @click="closeActionFeedbackModal" class="btn-primary action-feedback-btn">Done</button>
      </div>
    </div>

    <!-- 状态提示 -->
    <div v-if="operationNotice.visible" class="operation-toast" :class="operationNotice.type">
      <div class="operation-toast-icon">{{ operationNotice.type === 'success' ? '✓' : '!' }}</div>
      <div class="operation-toast-copy">
        <strong>{{ operationNotice.title }}</strong>
        <p>{{ operationNotice.message }}</p>
      </div>
    </div>

    <div v-if="statusMessage" class="status-message" :class="statusType">
      {{ statusMessage }}
    </div>

    <!-- 设备选择 -->
    <div v-if="devices.length > 1" class="device-selector">
      <label>Select Camera:</label>
      <select v-model="selectedDevice" @change="switchDevice">
        <option v-for="(device, index) in devices" :key="device.deviceId" :value="device.deviceId">
          {{ formatCameraLabel(device, index) }}
        </option>
      </select>
    </div>

    <!-- 快速建档弹窗 -->
    <div v-if="showCreateItemModal" class="modal-overlay" @click="showCreateItemModal = false">
      <div class="modal-content glass-panel" @click.stop>
        <div class="modal-header">
          <h3>Create New Item</h3>
          <button @click="showCreateItemModal = false" class="close-btn">&times;</button>
        </div>
        <div class="modal-body form-body">
          <div class="form-group">
            <label>SKU (Barcode)</label>
            <input type="text" v-model="newItemForm.sku" disabled class="input-field disabled-input">
          </div>
          <div class="form-group">
            <label>Item Name</label>
            <input type="text" v-model="newItemForm.name" placeholder="Enter item name..." class="input-field" required>
          </div>
          <div class="form-group">
            <label>Category</label>
            <input type="text" v-model="newItemForm.category" placeholder="e.g. Beverages" class="input-field">
          </div>
          <div class="form-group">
            <label>Brand</label>
            <input type="text" v-model="newItemForm.brand" placeholder="e.g. Coca-Cola" class="input-field">
          </div>
          <div class="form-group">
            <label>Price</label>
            <input type="number" v-model="newItemForm.price" min="0" step="0.01" placeholder="Optional" class="input-field">
          </div>
          <div class="form-actions">
            <button @click="showCreateItemModal = false" class="btn-cancel">Cancel</button>
            <button @click="submitNewItem" class="btn-primary" :disabled="isSubmittingItem">
              {{ isSubmittingItem ? 'Saving...' : 'Save Item' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 入库弹窗 -->
    <div v-if="showInboundModal" class="modal-overlay" @click="showInboundModal = false">
      <div class="modal-content glass-panel" @click.stop>
        <div class="modal-header">
          <h3>📦 Inbound Processing</h3>
          <button @click="showInboundModal = false" class="close-btn">&times;</button>
        </div>
        <div class="modal-body form-body">
          <div class="form-group">
            <label>SKU (Barcode)</label>
            <input type="text" v-model="inboundForm.sku" disabled class="input-field disabled-input">
          </div>
          <div class="form-group">
            <label>Item Name</label>
            <input type="text" v-model="inboundForm.item_name" disabled class="input-field disabled-input">
          </div>
          <div class="form-group">
            <label>Lot Number</label>
            <input type="text" v-model="inboundForm.lot_number" class="input-field" placeholder="e.g. LOT-20260401-1234">
          </div>
          <div class="form-group">
            <label>Quantity ✳️</label>
            <input type="number" v-model="inboundForm.qty" min="1" class="input-field" placeholder="How many?">
          </div>
          <div class="form-group">
            <label>Expiry Date</label>
            <input type="date" v-model="inboundForm.expiry_date" class="input-field">
            <p class="form-hint">Optional. Set this when the batch has a real expiry date.</p>
          </div>
          <div class="form-group">
            <label>Location (Bin)</label>
            <select
              v-if="availableBins.length"
              v-model="inboundBinSelection"
              @change="syncInboundBinSelection"
              class="input-field"
            >
              <option v-for="bin in availableBins" :key="`inbound-${bin.bin_code}`" :value="bin.bin_code">
                {{ formatBinOptionLabel(bin) }}
              </option>
              <option :value="CUSTOM_BIN_OPTION">Custom / New Bin...</option>
            </select>
            <input
              v-if="!availableBins.length || inboundBinSelection === CUSTOM_BIN_OPTION"
              type="text"
              v-model="inboundForm.bin_code"
              class="input-field"
              placeholder="e.g. Refrigerator"
            >
            <p class="form-hint">
              Select an existing bin to avoid typos. Use Custom / New Bin only when creating a new location.
            </p>
            <p v-if="binLoadingError" class="form-hint form-hint-error">{{ binLoadingError }}</p>
          </div>
          <div class="form-actions">
            <button @click="showInboundModal = false" class="btn-cancel">Cancel</button>
            <button @click="submitInbound" class="btn-primary" :disabled="isSubmittingInbound">
              {{ isSubmittingInbound ? 'Saving...' : '✓ Confirm Inbound' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 移库弹窗 -->
    <div v-if="showMoveModal" class="modal-overlay" @click="showMoveModal = false">
      <div class="modal-content glass-panel" @click.stop>
        <div class="modal-header">
          <h3>↔ Move Inventory</h3>
          <button @click="showMoveModal = false" class="close-btn">&times;</button>
        </div>
        <div class="modal-body form-body">
          <div class="form-group">
            <label>Lot Number</label>
            <input type="text" v-model="moveForm.lot_number" disabled class="input-field disabled-input">
          </div>
          <div class="form-group">
            <label>SKU</label>
            <input type="text" v-model="moveForm.sku" disabled class="input-field disabled-input">
          </div>
          <div class="form-group">
            <label>Current Bin</label>
            <input type="text" v-model="moveForm.from_bin_code" disabled class="input-field disabled-input">
          </div>
          <div class="form-group">
            <label>Available Qty</label>
            <input type="number" :value="moveForm.available_qty" disabled class="input-field disabled-input">
          </div>
          <div class="form-group">
            <label>Move Qty ✳️</label>
            <input type="number" v-model="moveForm.qty" min="1" :max="moveForm.available_qty || 1" class="input-field" placeholder="Leave the full quantity to move the entire lot">
            <p class="form-hint">If the quantity is smaller than the full lot, the system will split off a new destination lot automatically.</p>
          </div>
          <div class="form-group">
            <label>Target Bin ✳️</label>
            <select
              v-if="availableBins.length"
              v-model="moveBinSelection"
              @change="syncMoveBinSelection"
              class="input-field"
            >
              <option
                v-for="bin in moveTargetBins"
                :key="`move-${bin.bin_code}`"
                :value="bin.bin_code"
              >
                {{ formatBinOptionLabel(bin) }}
              </option>
              <option :value="CUSTOM_BIN_OPTION">Custom / New Bin...</option>
            </select>
            <input
              v-if="!availableBins.length || moveBinSelection === CUSTOM_BIN_OPTION"
              type="text"
              v-model="moveForm.to_bin_code"
              class="input-field"
              placeholder="e.g. Refrigerator"
            >
            <p class="form-hint">
              Pick the destination bin from the list whenever possible to reduce location mistakes.
            </p>
            <p v-if="binLoadingError" class="form-hint form-hint-error">{{ binLoadingError }}</p>
          </div>
          <div class="form-group">
            <label>Note</label>
            <input type="text" v-model="moveForm.notes" class="input-field" placeholder="Optional note for this move">
          </div>
          <div class="form-actions">
            <button @click="showMoveModal = false" class="btn-cancel">Cancel</button>
            <button @click="submitMove" class="btn-primary" :disabled="isSubmittingMove">
              {{ isSubmittingMove ? 'Moving...' : '✓ Confirm Move' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 出库弹窗 -->
    <div v-if="showOutboundModal" class="modal-overlay" @click="showOutboundModal = false">
      <div class="modal-content glass-panel" @click.stop>
        <div class="modal-header">
          <h3>📤 Outbound Processing</h3>
          <button @click="showOutboundModal = false" class="close-btn">&times;</button>
        </div>
        <div class="modal-body form-body">
          <div class="form-group">
            <label>SKU</label>
            <input type="text" v-model="outboundForm.sku" disabled class="input-field disabled-input">
          </div>
          <div class="form-group">
            <label>Item Name</label>
            <input type="text" v-model="outboundForm.item_name" disabled class="input-field disabled-input">
          </div>
          <div v-if="outboundWorkflowGuide.length" class="form-group">
            <label>Workflow Guide</label>
            <div class="workflow-guide-compact">
              <div v-for="tip in outboundWorkflowGuide" :key="`modal-${tip}`" class="workflow-guide-compact-item">
                {{ tip }}
              </div>
            </div>
          </div>
          <div v-if="isOutboundFifoMode && canChooseOutboundLot" class="form-group">
            <label>Outbound Mode</label>
            <div class="outbound-mode-toggle">
              <button
                type="button"
                class="outbound-mode-btn"
                :class="{ active: outboundSelectionMode === 'AUTO' }"
                @click="outboundSelectionMode = 'AUTO'; syncOutboundCandidate()"
              >
                FIFO Auto
              </button>
              <button
                type="button"
                class="outbound-mode-btn"
                :class="{ active: outboundSelectionMode === 'MANUAL' }"
                @click="outboundSelectionMode = 'MANUAL'; syncOutboundCandidate()"
              >
                Choose Lot
              </button>
            </div>
            <p class="form-hint">FIFO is still the default, but you can switch to a specific lot whenever you need exact batch control.</p>
          </div>
          <div v-if="isOutboundAutoMode" class="form-group">
            <label>Deduction Strategy</label>
            <input type="text" value="FIFO · oldest lot first" disabled class="input-field disabled-input">
            <p class="form-hint">Scanning an item label will now deduct from the oldest active lot first, then continue forward only if more stock is needed.</p>
          </div>
          <div v-if="isOutboundAutoMode" class="form-group">
            <label>FIFO Plan</label>
            <div class="outbound-plan-list">
              <div
                v-for="(candidate, index) in outboundCandidates"
                :key="candidate.key"
                class="outbound-plan-card"
              >
                <div class="outbound-plan-step">Step {{ index + 1 }}</div>
                <div class="outbound-plan-main">{{ candidate.lot_number }}</div>
                <div class="outbound-plan-meta">
                  <span>{{ candidate.bin_code }}</span>
                  <span>{{ candidate.available_qty }} {{ candidate.uom }}</span>
                  <span v-if="candidate.expiry_date">Exp {{ formatDate(candidate.expiry_date) }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="outboundCandidates.length > 1" class="form-group">
            <label>Source Lot / Bin ✳️</label>
            <select v-model="selectedOutboundLotKey" @change="syncOutboundCandidate" class="input-field">
              <option
                v-for="candidate in outboundCandidates"
                :key="candidate.key"
                :value="candidate.key"
              >
                {{ formatOutboundCandidateLabel(candidate) }}
              </option>
            </select>
            <p class="form-hint">Choose the exact lot and bin you want to deduct from.</p>
          </div>
          <div class="form-group">
            <label>{{ isOutboundAutoMode ? 'Lot Sequence' : 'Lot Number' }}</label>
            <input type="text" v-model="outboundForm.lot_number" disabled class="input-field disabled-input">
          </div>
          <div class="form-group">
            <label>{{ isOutboundAutoMode ? 'Source Bins' : 'Source Bin' }}</label>
            <input type="text" v-model="outboundForm.source_bin_code" disabled class="input-field disabled-input">
          </div>
          <div class="form-group">
            <label>Available Qty</label>
            <input type="number" :value="outboundForm.available_qty" disabled class="input-field disabled-input">
          </div>
          <div class="form-group">
            <label>Outbound Qty ✳️</label>
            <input type="number" v-model="outboundForm.qty" min="1" :max="outboundForm.available_qty || 1" class="input-field" placeholder="How many will be deducted?">
          </div>
          <div class="form-actions">
            <button @click="showOutboundModal = false" class="btn-cancel">Cancel</button>
            <button @click="submitOutbound" class="btn-primary" :disabled="isSubmittingOutbound">
              {{ isSubmittingOutbound ? 'Saving...' : '✓ Confirm Outbound' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  applyPreferredTrackConstraints,
  buildDecodeCandidatesFromVideo,
  buildPreferredVideoConstraints,
  computeFrameMetrics,
  createEnhancedCodeReader,
  decodeFromCandidates
} from '@/utils/enhancedScanner'
// import QRCode from 'qrcode' // 暂时注释，后续会用到

const router = useRouter()

const isHandheldClient = () => {
  const ua = window.navigator.userAgent || window.navigator.vendor || ''
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const isTouchMac = /Macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1

  return isMobileUa || isTouchMac
}

// 响应式数据
const videoRef = ref(null)
const fileInput = ref(null)
const isScanning = ref(false)
const currentMode = ref('camera')
const scanResult = ref(null)
const scanAction = ref(null) // 保存后端的 action 标识
const statusMessage = ref('')
const statusType = ref('info')
const isVideoFrameReady = ref(false)
const manualCode = ref('')
const devices = ref([])
const selectedDevice = ref('')
const hasFlash = ref(false)
const flashOn = ref(false)
const scanCanvasCache = {}
const userRole = ref(localStorage.getItem('userRole') || 'operator')
const isAdmin = userRole.value === 'admin'
const SCAN_COOLDOWN_MS = 1200
const isHandlingScan = ref(false)
const lastProcessedScan = ref('')
const lastProcessedAt = ref(0)
const operationNotice = ref({
  visible: false,
  type: 'success',
  title: '',
  message: ''
})
let operationNoticeTimer = null
const actionFeedbackModal = ref({
  visible: false,
  title: '',
  message: ''
})
let sharedAudioContext = null
let removeAudioPrimeListeners = null

// 新建商品相关状态
const showCreateItemModal = ref(false)
const isSubmittingItem = ref(false)
const newItemForm = ref({
  sku: '',
  name: '',
  category: '',
  brand: '',
  price: ''
})

// 入库弹窗相关状态
const showInboundModal = ref(false)
const isSubmittingInbound = ref(false)
const inboundForm = ref({
  sku: '',
  item_name: '',
  lot_number: '',
  qty: 1,
  bin_code: 'Refrigerator',
  expiry_date: ''
})
const CUSTOM_BIN_OPTION = '__custom__'
const availableBins = ref([])
const isLoadingBins = ref(false)
const binLoadingError = ref('')
const inboundBinSelection = ref(CUSTOM_BIN_OPTION)

// 移库弹窗相关状态
const showMoveModal = ref(false)
const isSubmittingMove = ref(false)
const moveForm = ref({
  lot_number: '',
  sku: '',
  item_name: '',
  from_bin_code: '',
  available_qty: 0,
  qty: 1,
  to_bin_code: 'Refrigerator',
  notes: ''
})
const moveBinSelection = ref(CUSTOM_BIN_OPTION)

// 出库弹窗相关状态
const showOutboundModal = ref(false)
const isSubmittingOutbound = ref(false)
const outboundCandidates = ref([])
const selectedOutboundLotKey = ref('')
const outboundStrategy = ref('DIRECT')
const outboundSelectionMode = ref('AUTO')
const outboundForm = ref({
  sku: '',
  item_name: '',
  lot_number: '',
  source_bin_code: '',
  available_qty: 0,
  qty: 1,
  uom: 'pcs'
})

// 🔑 幂等性与离线队列
// 1. 从 LocalStorage 初始化队列 (Persistence)
const savedQueue = localStorage.getItem('offlineQueue')
const requestQueue = ref(savedQueue ? JSON.parse(savedQueue) : []) 

const isProcessingQueue = ref(false)

// 2. 监听队列变化自动保存
watch(requestQueue, (newQueue) => {
  localStorage.setItem('offlineQueue', JSON.stringify(newQueue))
}, { deep: true })

// 队列处理逻辑 (Background Worker)
const processQueue = async () => {
  if (isProcessingQueue.value) return
  isProcessingQueue.value = true

  try {
    // 找到所有待处理的任务 (pending 或 retrying)
    const pendingTasks = requestQueue.value.filter(t => t.status === 'pending' || t.status === 'retrying')
    
    for (const task of pendingTasks) {
      try {
        task.status = 'sending'
        console.log(`🚀 开始处理任务: ${task.id} (重试: ${task.retryCount})`)

        await fetch('/api/inventory-management/adjust', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Idempotency-Key': task.id // 🔑 关键：死磕到底，绝不换 Key
          },
          body: JSON.stringify({ 
            lot_number: task.lot, 
            actual_qty: task.qty,
            reason: task.reason
          })
        })
        
        // 成功！
        task.status = 'success'
        task.completedAt = new Date().toLocaleString()
        console.log(`✅ 任务成功: ${task.id}`)
        
        // 3秒后从 UI 移除完成的任务
        setTimeout(() => {
           const idx = requestQueue.value.findIndex(t => t.id === task.id)
           if (idx !== -1) requestQueue.value.splice(idx, 1)
        }, 3000)

      } catch (error) {
        console.warn(`⚠️ 任务失败: ${task.id}`, error)
        task.retryCount++
        task.status = 'retrying'
        task.lastError = error.message
        // 继续处理下一个，不阻塞
      }
    }
  } finally {
    isProcessingQueue.value = false
  }
}

// 启动后台轮询 (每 2 秒检查一次队列)
let queueInterval = null
onMounted(() => {
  queueInterval = setInterval(processQueue, 2000)
})

onBeforeUnmount(() => {
  if (queueInterval) clearInterval(queueInterval)
})

// 扫码模式
const scanModes = [
  { value: 'camera', label: '📷 Camera Scan', icon: '📷' },
  { value: 'file', label: '📁 Image Upload', icon: '📁' },
  { value: 'manual', label: '⌨️ Manual Input', icon: '⌨️' }
]

const canUseVibrationFeedback = () => {
  const ua = window.navigator.userAgent || ''
  const isIOS = /iPhone|iPad|iPod/i.test(ua)

  return typeof navigator.vibrate === 'function' && !isIOS
}

const getSharedAudioContext = () => {
  const AudioCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioCtor) return null

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioCtor()
  }

  return sharedAudioContext
}

const primeAudioFeedback = async () => {
  const audioContext = getSharedAudioContext()
  if (!audioContext) return null

  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume()
    } catch (error) {
      console.warn('Failed to resume audio context:', error)
    }
  }

  return audioContext
}

const playTonePattern = async (tones, { volume = 0.22, waveform = 'sine' } = {}) => {
  const audioContext = await primeAudioFeedback()
  if (!audioContext) return

  const gainNode = audioContext.createGain()
  gainNode.connect(audioContext.destination)
  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime)

  tones.forEach((tone) => {
    const oscillator = audioContext.createOscillator()
    oscillator.type = waveform
    oscillator.frequency.setValueAtTime(tone.frequency, audioContext.currentTime + tone.start)
    oscillator.connect(gainNode)

    gainNode.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + tone.start + 0.012)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + tone.start + tone.duration)

    oscillator.start(audioContext.currentTime + tone.start)
    oscillator.stop(audioContext.currentTime + tone.start + tone.duration)
  })
}

const bindAudioPrimeListeners = () => {
  const primeFromGesture = () => {
    void primeAudioFeedback()
    if (typeof removeAudioPrimeListeners === 'function') {
      removeAudioPrimeListeners()
      removeAudioPrimeListeners = null
    }
  }

  window.addEventListener('pointerdown', primeFromGesture, { passive: true })
  window.addEventListener('keydown', primeFromGesture, { passive: true })

  removeAudioPrimeListeners = () => {
    window.removeEventListener('pointerdown', primeFromGesture)
    window.removeEventListener('keydown', primeFromGesture)
  }
}

const shouldSkipDuplicateScan = (rawData, bypassCooldown = false) => {
  if (bypassCooldown) return false

  const now = Date.now()
  return rawData === lastProcessedScan.value && now - lastProcessedAt.value < SCAN_COOLDOWN_MS
}

const triggerScanFeedback = () => {
  if (canUseVibrationFeedback()) {
    navigator.vibrate(200)
  }

  playScanSound()
}

const showOperationNotice = (title, message, type = 'success') => {
  if (operationNoticeTimer) {
    clearTimeout(operationNoticeTimer)
  }

  operationNotice.value = {
    visible: true,
    type,
    title,
    message
  }

  operationNoticeTimer = setTimeout(() => {
    operationNotice.value.visible = false
  }, 3200)
}

const showActionFeedbackModal = (title, message) => {
  actionFeedbackModal.value = {
    visible: true,
    title,
    message
  }

  playActionSuccessSound()
}

const closeActionFeedbackModal = () => {
  actionFeedbackModal.value.visible = false
}

const moveTargetBins = computed(() => {
  const currentBinCode = String(moveForm.value.from_bin_code || '').trim()
  return availableBins.value.filter((bin) => bin.bin_code !== currentBinCode)
})
const isOutboundFifoMode = computed(() => outboundStrategy.value === 'FIFO')
const canChooseOutboundLot = computed(() => outboundCandidates.value.length > 1)
const isOutboundAutoMode = computed(() => isOutboundFifoMode.value && outboundSelectionMode.value === 'AUTO')
const totalOutboundAvailableQty = computed(() => (
  outboundCandidates.value.reduce((sum, candidate) => sum + Number(candidate.available_qty || 0), 0)
))
const outboundWorkflowGuide = computed(() => {
  const parsed = scanResult.value?.parsed
  if (!parsed) return []

  if (parsed?.lot) {
    const expiry = parsed.lot?.expiry_date ? `Expiry: ${formatDate(parsed.lot.expiry_date)}.` : 'No expiry date on this lot yet.'
    return [
      'This is a lot label. Outbound will deduct this exact batch only.',
      `${expiry} Use this path when you need exact batch control or FEFO review.`
    ]
  }

  if (parsed?.item) {
    const activeLots = (parsed.item.lots || []).filter((lot) => Number(lot.qty || 0) > 0)
    const lotsWithExpiry = activeLots.filter((lot) => lot.expiry_date)

    if (activeLots.length > 1) {
      return [
        'Scanning an item label defaults to FIFO deduction across the oldest active lots.',
        lotsWithExpiry.length
          ? 'Expiry dates are available on some lots. You can switch to Choose Lot if you want to deduct a specific batch instead of FIFO.'
          : 'You can keep FIFO Auto, or switch to Choose Lot when you need an exact batch or bin.'
      ]
    }

    return [
      'This item currently has one active lot, so item outbound is straightforward.',
      'If you later split stock across bins or batches, scanning the item will switch back to guided FIFO mode.'
    ]
  }

  if (parsed?.bin) {
    return [
      'This is a bin label. Scan an item or lot next if you want to perform outbound from stock.',
      'Bin scans are best used for inquiry, cycle counts, and location-aware workflows.'
    ]
  }

  return []
})

const formatBinOptionLabel = (bin) => {
  const parts = [bin.bin_code]

  if (bin.zone) parts.push(formatZoneLabel(bin.zone))
  if (bin.temperature_zone) parts.push(bin.temperature_zone)

  return parts.join(' · ')
}

const formatZoneLabel = (zone) => {
  const normalizedZone = String(zone || '').trim()

  if (normalizedZone === 'A区') return 'Zone A'
  if (normalizedZone === 'B区') return 'Zone B'
  if (normalizedZone === 'C区') return 'Zone C'

  return normalizedZone
}

const formatDate = (value) => {
  if (!value) return '-'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return String(value)
  }

  return parsed.toLocaleDateString()
}

const formatCameraLabel = (device, index) => {
  const rawLabel = String(device?.label || '').trim()
  const lowerLabel = rawLabel.toLowerCase()

  if (
    lowerLabel.includes('back') ||
    lowerLabel.includes('rear') ||
    lowerLabel.includes('environment') ||
    rawLabel.includes('后') ||
    rawLabel.includes('後')
  ) {
    return 'Rear Camera'
  }

  if (
    lowerLabel.includes('front') ||
    lowerLabel.includes('user') ||
    rawLabel.includes('前')
  ) {
    return 'Front Camera'
  }

  return `Camera ${index + 1}`
}

const findMatchingBinCode = (binCode, bins = availableBins.value) => {
  const normalized = String(binCode || '').trim()
  return bins.find((bin) => bin.bin_code === normalized)?.bin_code || ''
}

const syncInboundBinSelection = () => {
  if (inboundBinSelection.value !== CUSTOM_BIN_OPTION) {
    inboundForm.value.bin_code = inboundBinSelection.value
  }
}

const syncMoveBinSelection = () => {
  if (moveBinSelection.value !== CUSTOM_BIN_OPTION) {
    moveForm.value.to_bin_code = moveBinSelection.value
  }
}

const getCodeReader = () => {
  if (!codeReader) {
    codeReader = createEnhancedCodeReader()
  }

  return codeReader
}

const ensureBinsLoaded = async ({ force = false } = {}) => {
  if (!isAdmin) return
  if (isLoadingBins.value) return
  if (availableBins.value.length > 0 && !force) return

  isLoadingBins.value = true
  binLoadingError.value = ''

  try {
    const response = await fetch('/api/inventory-management/bins?limit=200&sortBy=bin_code', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to load bins')
    }

    availableBins.value = result.data?.bins || []
  } catch (error) {
    console.error('加载库位列表失败:', error)
    binLoadingError.value = 'Bin list could not be loaded. You can still type a new bin manually.'
  } finally {
    isLoadingBins.value = false
  }
}

const prepareInboundBinPicker = () => {
  const currentBinCode = String(inboundForm.value.bin_code || '').trim()
  const matchedCode = findMatchingBinCode(currentBinCode)

  if (matchedCode) {
    inboundBinSelection.value = matchedCode
    inboundForm.value.bin_code = matchedCode
    return
  }

  inboundBinSelection.value = CUSTOM_BIN_OPTION
}

const prepareMoveBinPicker = () => {
  const currentTarget = String(moveForm.value.to_bin_code || '').trim()
  const currentSource = String(moveForm.value.from_bin_code || '').trim()
  const matchedCode = findMatchingBinCode(currentTarget, moveTargetBins.value)

  if (matchedCode) {
    moveBinSelection.value = matchedCode
    moveForm.value.to_bin_code = matchedCode
    return
  }

  const refrigerator = moveTargetBins.value.find((bin) => bin.bin_code === 'Refrigerator')
  if (refrigerator) {
    moveBinSelection.value = refrigerator.bin_code
    moveForm.value.to_bin_code = refrigerator.bin_code
    return
  }

  const firstDifferentBin = moveTargetBins.value.find((bin) => bin.bin_code !== currentSource)
  if (firstDifferentBin) {
    moveBinSelection.value = firstDifferentBin.bin_code
    moveForm.value.to_bin_code = firstDifferentBin.bin_code
    return
  }

  moveBinSelection.value = CUSTOM_BIN_OPTION
}

const buildOutboundCandidate = (lot, fallbackItemName = '') => {
  const lotNumber = String(lot?.lot_number || lot?.id || '').trim()
  const sku = String(lot?.sku || '').trim()
  const itemName = String(lot?.item?.name || fallbackItemName || sku).trim()
  const binCode = String(lot?.bin?.bin_code || lot?.bin_code || 'Unassigned').trim() || 'Unassigned'
  const availableQty = Number(lot?.qty || 0)
  const uom = String(lot?.uom || lot?.item?.uom || 'pcs').trim() || 'pcs'

  return {
    key: `${lotNumber}::${binCode}`,
    lot_number: lotNumber,
    sku,
    item_name: itemName,
    bin_code: binCode,
    available_qty: availableQty,
    uom,
    expiry_date: lot?.expiry_date || null,
    created_at: lot?.createdAt || lot?.created_at || null
  }
}

const formatOutboundCandidateLabel = (candidate) => {
  return `${candidate.bin_code} · ${candidate.lot_number} · ${candidate.available_qty} ${candidate.uom}`
}

const getOutboundCandidateTimestamp = (candidate) => {
  const rawValue = candidate?.created_at
  const timestamp = rawValue ? new Date(rawValue).getTime() : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER
}

const sortOutboundCandidatesForFifo = (candidates) => {
  return [...candidates].sort((left, right) => {
    const timeDelta = getOutboundCandidateTimestamp(left) - getOutboundCandidateTimestamp(right)
    if (timeDelta !== 0) return timeDelta

    return String(left.lot_number || '').localeCompare(String(right.lot_number || ''))
  })
}

const syncOutboundCandidate = () => {
  if (isOutboundAutoMode.value) {
    const firstCandidate = outboundCandidates.value[0]
    const totalAvailable = totalOutboundAvailableQty.value
    const boundedQty = Math.min(
      Math.max(Number(outboundForm.value.qty || 1), 1),
      Math.max(totalAvailable, 1)
    )

    outboundForm.value = {
      sku: firstCandidate?.sku || outboundForm.value.sku || '',
      item_name: firstCandidate?.item_name || outboundForm.value.item_name || '',
      lot_number: outboundCandidates.value.length === 1
        ? firstCandidate?.lot_number || ''
        : `${outboundCandidates.value.length} FIFO lots`,
      source_bin_code: outboundCandidates.value.length === 1
        ? firstCandidate?.bin_code || '-'
        : 'Automatic across oldest active lots',
      available_qty: totalAvailable,
      qty: boundedQty,
      uom: firstCandidate?.uom || outboundForm.value.uom || 'pcs'
    }
    return
  }

  const selectedCandidate =
    outboundCandidates.value.find((candidate) => candidate.key === selectedOutboundLotKey.value) ||
    outboundCandidates.value[0]

  if (!selectedCandidate) return

  selectedOutboundLotKey.value = selectedCandidate.key
  outboundForm.value = {
    sku: selectedCandidate.sku,
    item_name: selectedCandidate.item_name,
    lot_number: selectedCandidate.lot_number,
    source_bin_code: selectedCandidate.bin_code,
    available_qty: selectedCandidate.available_qty,
    qty: Math.min(Math.max(Number(outboundForm.value.qty || 1), 1), Math.max(selectedCandidate.available_qty, 1)),
    uom: selectedCandidate.uom
  }
}

const resolveOutboundCandidates = () => {
  const parsed = scanResult.value?.parsed

  if (parsed?.lot) {
    const candidate = buildOutboundCandidate(parsed.lot, parsed.lot.item?.name || parsed.lot.sku)

    if (!candidate.lot_number || !candidate.sku) {
      return { error: 'This lot label is missing lot or SKU details, so outbound cannot continue yet.' }
    }

    if (candidate.available_qty <= 0) {
      return { error: 'This lot has no stock left for outbound.' }
    }

    return { candidates: [candidate], strategy: 'DIRECT' }
  }

  if (parsed?.item) {
    const itemName = parsed.item.name || parsed.item.sku || ''
    const candidates = sortOutboundCandidatesForFifo((parsed.item.lots || [])
      .map((lot) => buildOutboundCandidate(lot, itemName))
      .filter((candidate) => candidate.lot_number && candidate.sku && candidate.available_qty > 0))

    if (!candidates.length) {
      return { error: 'This item has no available stock for outbound.' }
    }

    return { candidates, strategy: 'FIFO' }
  }

  return { error: 'Please scan an item label or a lot label before outbound.' }
}

const resolveScanLabelType = (parsed, action = '') => {
  if (parsed?.lot) return 'LOT'
  if (parsed?.bin) return 'BIN'
  if (parsed?.item) return 'ITEM'
  if (action === 'CREATE_ITEM') return 'NEW_ITEM'
  return 'UNKNOWN'
}

const createBenchmarkSession = (mode = currentMode.value) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  mode,
  startedAt: new Date().toISOString(),
  startPerf: performance.now(),
  status: 'pending',
  frameSamples: 0,
  frameScoreTotal: 0,
  brightnessTotal: 0,
  lowLightFrames: 0,
  blurryFrames: 0,
  decodeAttempts: 0,
  deviceId: selectedDevice.value || '',
  deviceLabel: formatCameraLabel(
    devices.value.find((device) => device.deviceId === selectedDevice.value) || {},
    Math.max(devices.value.findIndex((device) => device.deviceId === selectedDevice.value), 0)
  ),
  labelType: 'PENDING',
  lockMs: null,
  completedAt: null
})

const activeBenchmarkSession = ref(null)

const postBenchmarkSession = async (sessionPayload) => {
  const token = localStorage.getItem('token')
  if (!token) return

  try {
    await fetch('/api/scan/benchmark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(sessionPayload),
      keepalive: true
    })
  } catch (error) {
    console.warn('Failed to send scanner benchmark session:', error)
  }
}

const beginBenchmarkSession = (mode = currentMode.value) => {
  activeBenchmarkSession.value = createBenchmarkSession(mode)
}

const ensureBenchmarkSession = (mode = currentMode.value) => {
  if (!activeBenchmarkSession.value || activeBenchmarkSession.value.status !== 'pending') {
    beginBenchmarkSession(mode)
  }
}

const captureBenchmarkFrame = (metrics) => {
  if (!activeBenchmarkSession.value || !metrics) return

  activeBenchmarkSession.value.frameSamples += 1
  activeBenchmarkSession.value.frameScoreTotal += Number(metrics.score || 0)
  activeBenchmarkSession.value.brightnessTotal += Number(metrics.brightness || 0)
  if (metrics.lowLight) activeBenchmarkSession.value.lowLightFrames += 1
  if (metrics.blurry) activeBenchmarkSession.value.blurryFrames += 1
}

const finalizeBenchmarkSession = ({ status, labelType = 'UNKNOWN', rawData = '' } = {}) => {
  if (!activeBenchmarkSession.value) return

  const session = activeBenchmarkSession.value
  const completedAt = Date.now()
  const lockMs = performance.now() - session.startPerf
  const avgFrameScore = session.frameSamples ? session.frameScoreTotal / session.frameSamples : 0
  const avgBrightness = session.frameSamples ? session.brightnessTotal / session.frameSamples : 0

  const completedSession = {
    ...session,
    status,
    labelType,
    rawData,
    completedAt,
    completedAtIso: new Date(completedAt).toISOString(),
    lockMs,
    avgFrameScore,
    avgBrightness
  }

  activeBenchmarkSession.value = null
  void postBenchmarkSession(completedSession)

  if (isScanning.value) {
    beginBenchmarkSession('camera')
  }
}

const decodeCurrentVideoFrame = (video) => {
  const videoWidth = video.videoWidth || 0
  const videoHeight = video.videoHeight || 0
  if (!videoWidth || !videoHeight) return ''

  const metrics = computeFrameMetrics(video, scanCanvasCache)
  const includeFullFrame = metrics.lowLight || metrics.blurry
  const candidates = buildDecodeCandidatesFromVideo(video, scanCanvasCache, metrics, {
    includeFullFrame,
    enableTiltAssist: true
  })

  const decoded = decodeFromCandidates(getCodeReader(), candidates)
  return decoded?.text ? String(decoded.text).trim() : ''
}

const stopScanLoop = () => {
  if (scanLoopFrame) {
    window.cancelAnimationFrame(scanLoopFrame)
    scanLoopFrame = null
  }
}

const runEnhancedScanLoop = () => {
  if (!isScanning.value || !videoRef.value) return

  scanLoopFrame = window.requestAnimationFrame(runEnhancedScanLoop)

  const video = videoRef.value
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return

  const now = performance.now()
  if (now - lastDecodeAttemptAt < 90) return
  lastDecodeAttemptAt = now
  if (isHandlingScan.value) return

  ensureBenchmarkSession('camera')
  activeBenchmarkSession.value.decodeAttempts += 1
  captureBenchmarkFrame(computeFrameMetrics(video, scanCanvasCache))

  const decodedText = decodeCurrentVideoFrame(video)
  if (!decodedText) return

  void handleScanResult(decodedText)
}

// ZXing 扫码器
let codeReader = null
let stream = null
let scanLoopFrame = null
let lastDecodeAttemptAt = 0
let cameraStartupHintTimer = null

// 生命周期
onMounted(async () => {
  bindAudioPrimeListeners()

  if (!isHandheldClient()) {
    router.replace('/dashboard')
    return
  }

  await checkPermissions()
  await listDevices()
  if (isAdmin) {
    void ensureBinsLoaded()
  }
  if (currentMode.value === 'camera') {
    await autoStartCamera()
  }
})

onBeforeUnmount(() => {
  stopScanning()

  if (typeof removeAudioPrimeListeners === 'function') {
    removeAudioPrimeListeners()
    removeAudioPrimeListeners = null
  }
})

onBeforeUnmount(() => {
  if (operationNoticeTimer) {
    clearTimeout(operationNoticeTimer)
  }
})

// 检查权限
const checkPermissions = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    statusMessage.value = 'This browser cannot access the camera.'
    statusType.value = 'error'
    return
  }

  if (!navigator.permissions?.query) {
    statusMessage.value = 'Opening camera...'
    statusType.value = 'info'
    return
  }

  try {
    const permission = await navigator.permissions.query({ name: 'camera' })
    if (permission.state === 'denied') {
      statusMessage.value = 'Cannot access camera. Please check permission settings'
      statusType.value = 'error'
      return
    }

    statusMessage.value = 'Opening camera...'
    statusType.value = 'info'
  } catch (error) {
    statusMessage.value = 'Opening camera...'
    statusType.value = 'info'
  }
}

// 列出设备
const listDevices = async () => {
  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices()
    devices.value = allDevices.filter(device => device.kind === 'videoinput')
    
    if (devices.value.length > 0) {
      // 优先选择后置摄像头（通常有闪光灯）
      const rearCamera = devices.value.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment') ||
        device.label.includes('后') ||
        device.label.includes('後')
      )
      
      selectedDevice.value = rearCamera ? rearCamera.deviceId : devices.value[0].deviceId
      
      console.log('📷 可用摄像头:', devices.value.map(d => ({
        deviceId: d.deviceId,
        label: d.label
      })))
      console.log('📷 选择的摄像头:', selectedDevice.value)
    }
  } catch (error) {
    console.error('デバイス一覧の取得に失敗しました:', error)
  }
}

const waitForVideoMetadata = (videoEl, timeoutMs = 900) => new Promise((resolve) => {
  if (!videoEl) {
    resolve()
    return
  }

  if (videoEl.readyState >= 1) {
    resolve()
    return
  }

  const handleReady = () => {
    if (timer) {
      clearTimeout(timer)
    }
    videoEl.removeEventListener('loadedmetadata', handleReady)
    videoEl.removeEventListener('loadeddata', handleReady)
    resolve()
  }

  const timer = window.setTimeout(() => {
    videoEl.removeEventListener('loadedmetadata', handleReady)
    videoEl.removeEventListener('loadeddata', handleReady)
    resolve()
  }, timeoutMs)

  videoEl.addEventListener('loadedmetadata', handleReady, { once: true })
  videoEl.addEventListener('loadeddata', handleReady, { once: true })
})

const waitForVideoPlayableState = (videoEl, timeoutMs = 900) => new Promise((resolve) => {
  if (!videoEl) {
    resolve(false)
    return
  }

  if (videoEl.readyState >= 2) {
    resolve(true)
    return
  }

  const handleReady = () => {
    if (timer) {
      clearTimeout(timer)
    }
    videoEl.removeEventListener('canplay', handleReady)
    videoEl.removeEventListener('playing', handleReady)
    videoEl.removeEventListener('loadeddata', handleReady)
    resolve(true)
  }

  const timer = window.setTimeout(() => {
    videoEl.removeEventListener('canplay', handleReady)
    videoEl.removeEventListener('playing', handleReady)
    videoEl.removeEventListener('loadeddata', handleReady)
    resolve(videoEl.readyState >= 2)
  }, timeoutMs)

  videoEl.addEventListener('canplay', handleReady, { once: true })
  videoEl.addEventListener('playing', handleReady, { once: true })
  videoEl.addEventListener('loadeddata', handleReady, { once: true })
})

const safeStopStream = (mediaStream) => {
  if (!mediaStream) return
  mediaStream.getTracks().forEach((track) => track.stop())
}

const getPrimaryVideoTrack = (mediaStream) => mediaStream?.getVideoTracks?.()?.[0] || null

const getStreamSnapshot = (mediaStream) => {
  const track = getPrimaryVideoTrack(mediaStream)
  const settings = track?.getSettings?.() || {}

  return {
    track,
    deviceId: settings.deviceId || '',
    facingMode: settings.facingMode || ''
  }
}

const shouldUpgradeFromPrimer = (mediaStream) => {
  const { deviceId, facingMode } = getStreamSnapshot(mediaStream)

  if (selectedDevice.value) {
    return !deviceId || deviceId !== selectedDevice.value
  }

  if (facingMode) {
    return facingMode !== 'environment'
  }

  return true
}

const attachStreamToVideo = (mediaStream, { awaitReady = false } = {}) => {
  if (!videoRef.value) return

  isVideoFrameReady.value = false
  stream = mediaStream
  videoRef.value.srcObject = mediaStream

  const track = getPrimaryVideoTrack(mediaStream)
  if (track) {
    void applyPreferredTrackConstraints(track)
  }

  if (awaitReady) {
    return ensureVideoPlayback(videoRef.value)
  }

  void ensureVideoPlayback(videoRef.value)
}

const requestBasicCameraPermission = async () => navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: { ideal: 'environment' }
  },
  audio: false
})

const requestCameraStreamWithTimeout = async (timeoutMs = 2600) => Promise.race([
  requestCameraStream(),
  new Promise((_, reject) => {
    window.setTimeout(() => {
      reject(new Error('Camera request timed out'))
    }, timeoutMs)
  })
])

const getCameraConstraintCandidates = () => {
  const preferred = buildPreferredVideoConstraints(selectedDevice.value, 'environment')

  return [
    preferred,
    buildPreferredVideoConstraints('', 'environment'),
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    },
    {
      video: true
    }
  ]
}

const requestCameraStream = async () => {
  const attempts = getCameraConstraintCandidates()
  let lastError = null

  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      lastError = error
      console.warn('Camera constraint attempt failed:', constraints, error)
    }
  }

  throw lastError || new Error('Unable to open camera stream')
}

const ensureVideoPlayback = async (videoEl) => {
  if (!videoEl) return

  videoEl.setAttribute('muted', '')
  videoEl.muted = true
  videoEl.playsInline = true
  const metadataPromise = waitForVideoMetadata(videoEl, 1200)

  const tryPlay = async () => {
    const playPromise = videoEl.play()
    if (!playPromise || typeof playPromise.then !== 'function') {
      return true
    }

    return Promise.race([
      playPromise.then(() => true),
      new Promise((resolve) => {
        window.setTimeout(() => resolve(false), 700)
      })
    ])
  }

  try {
    const played = await tryPlay()
    if (!played) {
      console.warn('Video playback is taking longer than expected; continuing while waiting for the first frame.')
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      await new Promise((resolve) => setTimeout(resolve, 120))
      await tryPlay()
    } else {
      console.warn('Video play() did not complete cleanly; continuing with the attached camera stream.', error)
    }
  }

  await metadataPromise
  await waitForVideoPlayableState(videoEl, 800)
}

const handleVideoFrameReady = () => {
  if (!isScanning.value) return
  isVideoFrameReady.value = true
}

const autoStartCamera = async () => {
  if (currentMode.value !== 'camera' || isScanning.value) return

  await nextTick()

  if (!videoRef.value || currentMode.value !== 'camera' || isScanning.value) return

  statusMessage.value = 'Opening camera...'
  statusType.value = 'info'
  void startScanning()
}

// 切换模式
const switchMode = async (mode) => {
  if (currentMode.value === 'camera') {
    await stopScanning()
  }
  currentMode.value = mode
  
  if (mode === 'camera') {
    await autoStartCamera()
  }
}

// 开始扫描
const startScanning = async () => {
  if (!videoRef.value || isScanning.value) return
  
  try {
    void primeAudioFeedback()
    isScanning.value = true
    isVideoFrameReady.value = false
    beginBenchmarkSession('camera')
    statusMessage.value = 'Starting camera...'
    statusType.value = 'info'

    cameraStartupHintTimer = window.setTimeout(() => {
      if (isScanning.value && !stream) {
        statusMessage.value = 'Waiting for camera permission. In Safari, tap the address bar menu and choose “开始使用相机”.'
        statusType.value = 'info'
      }
    }, 1800)

    const primerStream = await requestBasicCameraPermission()
    attachStreamToVideo(primerStream)

    if (cameraStartupHintTimer) {
      clearTimeout(cameraStartupHintTimer)
      cameraStartupHintTimer = null
    }

    // 初始化 ZXing
    getCodeReader()
    lastDecodeAttemptAt = 0
    stopScanLoop()
    runEnhancedScanLoop()

    statusMessage.value = 'Camera opened. Live preview is starting...'
    statusType.value = 'info'

    void listDevices()

    if (shouldUpgradeFromPrimer(primerStream)) {
      void (async () => {
        try {
          const upgradedStream = await requestCameraStreamWithTimeout(1600)
          if (!isScanning.value) {
            safeStopStream(upgradedStream)
            return
          }

          if (upgradedStream !== stream) {
            const previousStream = stream
            attachStreamToVideo(upgradedStream)
            if (previousStream && previousStream !== upgradedStream) {
              safeStopStream(previousStream)
            }
          }

          statusMessage.value = 'Rear camera optimized. Please place the barcode inside the frame'
          statusType.value = 'success'
          void checkFlashSupport()
        } catch (upgradeError) {
          console.warn('Continuing with the fast compatibility camera stream:', upgradeError)
          statusMessage.value = 'Scan started. Please place the barcode inside the frame'
          statusType.value = 'success'
          void checkFlashSupport()
        }
      })()
    } else {
      statusMessage.value = 'Scan started. Please place the barcode inside the frame'
      statusType.value = 'success'
      void checkFlashSupport()
    }
    
    if (videoRef.value.readyState < 2) {
      statusMessage.value = 'Camera opened. Waiting for the first live frame...'
      statusType.value = 'info'
    }

    void listDevices()
  } catch (error) {
    console.error('スキャン開始に失敗しました:', error)
    if (cameraStartupHintTimer) {
      clearTimeout(cameraStartupHintTimer)
      cameraStartupHintTimer = null
    }
    safeStopStream(stream)
    stream = null
    if (videoRef.value) {
      videoRef.value.srcObject = null
    }
    const fallbackMessage = error?.name === 'AbortError'
      ? 'Camera startup was interrupted. Please tap Retry Camera once more.'
      : (error?.message || 'Unknown camera error')
    statusMessage.value = 'Failed to start scan: ' + fallbackMessage
    statusType.value = 'error'
    isScanning.value = false
    finalizeBenchmarkSession({ status: 'startup_failed', labelType: 'CAMERA_INIT' })
  }
}

// 停止扫描
const stopScanning = async () => {
  isScanning.value = false
  isVideoFrameReady.value = false
  stopScanLoop()
  if (cameraStartupHintTimer) {
    clearTimeout(cameraStartupHintTimer)
    cameraStartupHintTimer = null
  }
  
  if (codeReader) {
    try {
      await codeReader.reset()
      codeReader = null
    } catch (error) {
      console.error('スキャナーの停止に失敗しました:', error)
    }
  }
  
  if (stream) {
    safeStopStream(stream)
    stream = null
  }
  
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }

  if (activeBenchmarkSession.value?.status === 'pending') {
    finalizeBenchmarkSession({ status: 'stopped', labelType: 'UNRESOLVED' })
  }
}

// 切换摄像头
const switchDevice = async () => {
  if (isScanning.value) {
    await stopScanning()
    // 等待一下确保资源释放
    await new Promise(resolve => setTimeout(resolve, 300))
    await startScanning()
    // 切换摄像头后重新检测闪光灯
    await checkFlashSupport()
  }
}

// 切换摄像头开关
const toggleCamera = async () => {
  if (isScanning.value) {
    await stopScanning()
  } else {
    await startScanning()
  }
}

// 检测闪光灯支持
const checkFlashSupport = async () => {
  if (!stream) {
    console.log('⚠️ 没有视频流，无法检测闪光灯')
    hasFlash.value = false
    return
  }
  
  try {
    const track = stream.getVideoTracks()[0]
    if (!track) {
      console.log('⚠️ 没有视频轨道，无法检测闪光灯')
      hasFlash.value = false
      return
    }
    
    const capabilities = track.getCapabilities()
    const settings = track.getSettings()
    
    console.log('📷 摄像头能力检测:', {
      deviceId: settings.deviceId,
      facingMode: settings.facingMode,
      capabilities: capabilities,
      settings: settings
    })
    
    // 检查是否支持 torch（手电筒模式）- 最常用
    if (capabilities.torch !== undefined) {
      hasFlash.value = true
      console.log('✅ 检测到闪光灯支持 (torch API)')
      statusMessage.value = 'Light feature is available'
      statusType.value = 'success'
      setTimeout(() => {
        if (statusMessage.value === 'Light feature is available') {
          statusMessage.value = ''
        }
      }, 2000)
      return
    } 
    
    // 检查是否支持 fillLightMode（填充光模式）
    if (capabilities.fillLightMode && Array.isArray(capabilities.fillLightMode) && capabilities.fillLightMode.length > 0) {
      hasFlash.value = true
      console.log('✅ 检测到闪光灯支持 (fillLightMode)')
      return
    }
    
    // 检查是否支持 exposureCompensation（曝光补偿）
    if (capabilities.exposureCompensation !== undefined) {
      hasFlash.value = true
      console.log('✅ 检测到亮度调节支持 (exposureCompensation)')
      return
    }
    
    // 如果都不支持
    hasFlash.value = false
    console.log('⚠️ 当前摄像头不支持闪光灯控制', {
      facingMode: settings.facingMode,
      hasTorch: capabilities.torch !== undefined,
      hasFillLight: capabilities.fillLightMode !== undefined,
      hasExposure: capabilities.exposureCompensation !== undefined
    })
    
    // 如果是前置摄像头，提示切换到后置
    if (settings.facingMode === 'user') {
      console.log('💡 提示：前置摄像头通常没有闪光灯，请切换到后置摄像头')
    }
    
  } catch (error) {
    console.error('❌ 闪光灯检测失败:', error)
    hasFlash.value = false
  }
}

// 切换手电筒
const toggleFlash = async () => {
  if (!stream) return
  
  try {
    const track = stream.getVideoTracks()[0]
    if (!track) {
      statusMessage.value = 'Camera track not found'
      statusType.value = 'error'
      return
    }
    
    const capabilities = track.getCapabilities()
    
    // 方法1: 使用 torch API（最常用）
    if (capabilities.torch !== undefined) {
      flashOn.value = !flashOn.value
      await track.applyConstraints({
        advanced: [{ torch: flashOn.value }]
      })
      statusMessage.value = flashOn.value ? 'Light turned on' : 'Light turned off'
      statusType.value = 'success'
      return
    }
    
    // 方法2: 使用 fillLightMode
    if (capabilities.fillLightMode && capabilities.fillLightMode.length > 0) {
      flashOn.value = !flashOn.value
      const lightMode = flashOn.value ? 'flash' : 'off'
      await track.applyConstraints({
        advanced: [{ fillLightMode: lightMode }]
      })
      statusMessage.value = flashOn.value ? 'Light turned on' : 'Light turned off'
      statusType.value = 'success'
      return
    }
    
    // 方法3: 调整曝光补偿（间接提高亮度）
    if (capabilities.exposureCompensation !== undefined) {
      flashOn.value = !flashOn.value
      const compensation = flashOn.value ? 2.0 : 0.0 // 增加曝光补偿
      await track.applyConstraints({
        advanced: [{ exposureCompensation: compensation }]
      })
      statusMessage.value = flashOn.value ? 'Brightness increased' : 'Brightness restored'
      statusType.value = 'success'
      return
    }
    
    // 如果不支持任何方式
    statusMessage.value = 'This device does not support light control'
    statusType.value = 'error'
    
  } catch (error) {
    console.error('ライト切り替えに失敗しました:', error)
    statusMessage.value = 'Failed to toggle light: ' + error.message
    statusType.value = 'error'
    
    // 某些设备可能需要重新获取流
    if (error.name === 'NotReadableError' || error.name === 'OverconstrainedError') {
      console.log('尝试重新获取摄像头流...')
      await stopScanning()
      await new Promise(resolve => setTimeout(resolve, 500))
      await startScanning()
    }
  }
}

// 处理文件上传
const triggerFileInput = () => {
  fileInput.value.click()
}

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  try {
    beginBenchmarkSession('file')
    void primeAudioFeedback()
    statusMessage.value = 'Analyzing image...'
    statusType.value = 'info'
    
    // 使用 ZXing 解析图片
    const arrayBuffer = await file.arrayBuffer()
    const result = await getCodeReader().decodeFromArrayBuffer(arrayBuffer)
    
    if (result) {
      void handleScanResult(result.getText())
    }
  } catch (error) {
    console.error('画像解析に失敗しました:', error)
    finalizeBenchmarkSession({ status: 'decode_failed', labelType: 'FILE_IMAGE' })
    statusMessage.value = 'Cannot recognize barcode in image'
    statusType.value = 'error'
  }
}

// 处理手动输入
const handleManualSubmit = () => {
  if (manualCode.value.trim()) {
    beginBenchmarkSession('manual')
    void primeAudioFeedback()
    void handleScanResult(manualCode.value.trim())
    manualCode.value = ''
  }
}

// 处理扫描结果
const handleScanResult = async (rawData, options = {}) => {
  const { bypassCooldown = false, silent = false } = options
  const normalizedRaw = String(rawData || '').trim()

  if (!normalizedRaw) return
  if (isHandlingScan.value) return
  if (shouldSkipDuplicateScan(normalizedRaw, bypassCooldown)) return

  isHandlingScan.value = true
  lastProcessedScan.value = normalizedRaw
  lastProcessedAt.value = Date.now()

  try {
    statusMessage.value = 'Processing scan...'
    statusType.value = 'info'
      scanResult.value = null
      scanAction.value = null

    // Call Backend Scan API
    const response = await fetch('/api/scan/scan', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ raw: normalizedRaw, device: 'web-scanner' })
    })

    const result = await response.json()
    
    if (result.success) {
      ensureBenchmarkSession(options.sourceMode || currentMode.value)
      scanResult.value = {
        raw: normalizedRaw,
        parsed: result.data.data, // Contains specific data points returned from scanController
        timestamp: new Date().toLocaleString()
      }
      scanAction.value = result.data.action

      // 如果返回 action 是 CREATE_ITEM 且带有外部获取的数据，自动填充
      if (result.data.action === 'CREATE_ITEM') {
        const itemData = result.data.data
        newItemForm.value.sku = itemData.sku || normalizedRaw
        
        if (itemData.external_data) {
          const ext = itemData.external_data
          newItemForm.value.name = ext.name || ''
          newItemForm.value.category = ext.category || ''
          newItemForm.value.brand = ext.brand || ''
          newItemForm.value.price = ''
          statusMessage.value = 'Found match in cloud database!'
          statusType.value = 'success'
          // Optionally auto-open the modal
          showCreateItemModal.value = true
        } else {
           newItemForm.value.name = ''
           newItemForm.value.category = ''
           newItemForm.value.brand = ''
           newItemForm.value.price = ''
           statusMessage.value = 'Item not found in database. Fast creation available.'
           statusType.value = 'info'
        }
      } else {
        statusMessage.value = result.data.message || 'Scan successful!'
        statusType.value = 'success'
      }

      if (!silent) {
        triggerScanFeedback()
      }

      finalizeBenchmarkSession({
        status: 'success',
        labelType: resolveScanLabelType(result.data.data, result.data.action),
        rawData: normalizedRaw
      })

    } else {
      statusMessage.value = result.message || 'Scan failed'
      statusType.value = 'error'
      finalizeBenchmarkSession({
        status: 'backend_failed',
        labelType: 'UNRESOLVED',
        rawData: normalizedRaw
      })
    }
    
  } catch (error) {
    console.error('スキャン結果の処理に失敗しました:', error)
    statusMessage.value = 'Failed to process scan result'
    statusType.value = 'error'
    finalizeBenchmarkSession({
      status: 'request_failed',
      labelType: 'UNRESOLVED',
      rawData: normalizedRaw
    })
  } finally {
    isHandlingScan.value = false
  }
}

// 提交新商品
const submitNewItem = async () => {
  if (!newItemForm.value.name) {
    alert('Item name is required')
    return
  }

  isSubmittingItem.value = true
  try {
    const response = await fetch('/api/inventory-management/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        sku: newItemForm.value.sku,
        name: newItemForm.value.name,
        category: newItemForm.value.category,
        description: newItemForm.value.brand ? `Brand: ${newItemForm.value.brand}` : '',
        price: newItemForm.value.price === '' ? null : Number(newItemForm.value.price)
      })
    })

    const result = await response.json()
    if (result.success) {
      statusMessage.value = 'Item successfully registered locally!'
      statusType.value = 'success'
      showCreateItemModal.value = false
      await handleScanResult(newItemForm.value.sku, { bypassCooldown: true, silent: true })
    } else {
      alert(result.message || 'Failed to create item')
    }
  } catch (err) {
    console.error('Error creating item:', err)
    alert('Network error while saving item')
  } finally {
    isSubmittingItem.value = false
  }
}

// 业务操作
const handleInbound = async () => {
  if (!scanResult.value) return

  // 从扫描结果中提取商品信息
  const parsed = scanResult.value.parsed
  let sku = ''
  let itemName = ''

  if (parsed?.item) {
    sku = parsed.item.sku || ''
    itemName = parsed.item.name || ''
  } else if (parsed?.sku) {
    sku = parsed.sku
    itemName = parsed.name || sku
  } else {
    // 直接用原始条码作为 SKU
    sku = scanResult.value.raw || ''
    itemName = sku
  }

  // 生成默认批次号（当天日期 + SKU 后4位）
  const today = new Date()
  const dateStr = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
  const skuSuffix = sku.slice(-4)

  inboundForm.value = {
    sku,
    item_name: itemName,
    lot_number: `LOT-${dateStr}-${skuSuffix}`,
    qty: 1,
    bin_code: 'Refrigerator',
    expiry_date: ''
  }
  await ensureBinsLoaded()
  prepareInboundBinPicker()
  showInboundModal.value = true
}

const submitInbound = async () => {
  if (!inboundForm.value.sku || inboundForm.value.qty <= 0 || !String(inboundForm.value.bin_code || '').trim()) {
    statusMessage.value = 'Please complete all inbound fields.'
    statusType.value = 'error'
    return
  }
  isSubmittingInbound.value = true
  try {
    const response = await fetch('/api/scan/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        lot_number: inboundForm.value.lot_number,
        sku: inboundForm.value.sku,
        qty: Number(inboundForm.value.qty),
        bin_code: inboundForm.value.bin_code,
        expiry_date: inboundForm.value.expiry_date || null
      })
    })
    const result = await response.json()
    if (result.success) {
      statusMessage.value = 'Inbound saved successfully.'
      statusType.value = 'success'
      showActionFeedbackModal(
        'Inbound Complete',
        `${inboundForm.value.item_name} × ${inboundForm.value.qty} was added to ${inboundForm.value.bin_code}.`
      )
      showInboundModal.value = false
      if (canUseVibrationFeedback()) navigator.vibrate([100, 50, 100])
      await ensureBinsLoaded({ force: true })
      await handleScanResult(inboundForm.value.sku, { bypassCooldown: true, silent: true })
    } else {
      throw new Error(result.message || 'Inbound failed')
    }
  } catch (err) {
    statusMessage.value = `Inbound failed: ${err.message}`
    statusType.value = 'error'
    showOperationNotice('Inbound Failed', err.message, 'error')
  } finally {
    isSubmittingInbound.value = false
  }
}

const resolveMoveContext = () => {
  const parsed = scanResult.value?.parsed

  if (parsed?.lot) {
    return {
      lot: parsed.lot,
      itemName: parsed.lot.item?.name || parsed.lot.sku,
      fromBinCode: parsed.lot.bin?.bin_code || ''
    }
  }

  if (parsed?.item) {
    const activeLots = (parsed.item.lots || []).filter((lot) => Number(lot.qty || 0) > 0)

    if (activeLots.length === 0) {
      return { error: 'This item has no active lot available for a bin move.' }
    }

    if (activeLots.length > 1) {
      return { error: 'This item exists in multiple lots. Please scan a specific lot label before moving it.' }
    }

    return {
      lot: activeLots[0],
      itemName: parsed.item.name || parsed.item.sku,
      fromBinCode: activeLots[0].bin?.bin_code || ''
    }
  }

  return { error: 'Please scan a lot label first, or scan an item that only has one active lot.' }
}

const handleMove = async () => {
  if (!scanResult.value) return

  const moveContext = resolveMoveContext()

  if (moveContext.error) {
    statusMessage.value = moveContext.error
    statusType.value = 'error'
    return
  }

  const { lot, itemName, fromBinCode } = moveContext

  moveForm.value = {
    lot_number: lot.lot_number,
    sku: lot.sku,
    item_name: itemName,
    from_bin_code: fromBinCode || 'Unassigned',
    available_qty: Number(lot.qty || 0),
    qty: Number(lot.qty || 0),
    to_bin_code: fromBinCode && fromBinCode !== 'Refrigerator' ? 'Refrigerator' : '',
    notes: ''
  }

  await ensureBinsLoaded()
  prepareMoveBinPicker()
  showMoveModal.value = true
}

const submitMove = async () => {
  const availableQty = Number(moveForm.value.available_qty || 0)
  const moveQty = Number(moveForm.value.qty)

  if (!moveForm.value.lot_number || !moveForm.value.sku || !moveForm.value.to_bin_code.trim()) {
    statusMessage.value = 'Please complete all move fields.'
    statusType.value = 'error'
    return
  }

  if (!Number.isFinite(moveQty) || moveQty <= 0 || moveQty > availableQty) {
    statusMessage.value = `Move quantity must be between 1 and ${availableQty}.`
    statusType.value = 'error'
    return
  }

  isSubmittingMove.value = true

  try {
    const response = await fetch('/api/scan/move', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        lot_number: moveForm.value.lot_number,
        sku: moveForm.value.sku,
        qty: moveQty,
        to_bin_code: moveForm.value.to_bin_code.trim(),
        notes: moveForm.value.notes.trim()
      })
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Move failed')
    }

    const movedLot = result.data?.moved_lot
    const moveSummary = result.data?.split_created
      ? `A new split lot ${movedLot?.lot_number} was created in ${movedLot?.bin_code}.`
      : `${moveForm.value.lot_number} was moved to ${movedLot?.bin_code || moveForm.value.to_bin_code}.`

    statusMessage.value = 'Move completed successfully.'
    statusType.value = 'success'
    showActionFeedbackModal('Move Complete', moveSummary)
    showMoveModal.value = false
    await ensureBinsLoaded({ force: true })
    await handleScanResult(scanResult.value.raw, { bypassCooldown: true, silent: true })
  } catch (error) {
    statusMessage.value = `Move failed: ${error.message}`
    statusType.value = 'error'
    showOperationNotice('Move Failed', error.message, 'error')
  } finally {
    isSubmittingMove.value = false
  }
}

const handleOutbound = () => {
  if (!scanResult.value) return

  const { candidates, strategy, error } = resolveOutboundCandidates()

  if (error) {
    statusMessage.value = error
    statusType.value = 'error'
    return
  }

  outboundStrategy.value = strategy || 'DIRECT'
  outboundSelectionMode.value = strategy === 'FIFO' && candidates.length > 1 ? 'AUTO' : 'MANUAL'
  outboundCandidates.value = candidates
  selectedOutboundLotKey.value = candidates[0]?.key || ''
  outboundForm.value = {
    sku: '',
    item_name: '',
    lot_number: '',
    source_bin_code: '',
    available_qty: 0,
    qty: 1,
    uom: 'pcs'
  }
  syncOutboundCandidate()
  showOutboundModal.value = true
}

const submitOutbound = async () => {
  const qty = Number(outboundForm.value.qty)

  if (!outboundForm.value.sku) {
    statusMessage.value = 'Please scan an item or lot before outbound.'
    statusType.value = 'error'
    return
  }

  if (!isOutboundAutoMode.value && !outboundForm.value.lot_number) {
    statusMessage.value = 'Please choose a specific lot and source bin first.'
    statusType.value = 'error'
    return
  }

  if (!Number.isFinite(qty) || qty <= 0 || qty > Number(outboundForm.value.available_qty || 0)) {
    statusMessage.value = `Outbound quantity must be between 1 and ${outboundForm.value.available_qty}.`
    statusType.value = 'error'
    return
  }

  isSubmittingOutbound.value = true

  try {
    statusMessage.value = 'Saving outbound record...'
    statusType.value = 'info'

    const response = await fetch('/api/scan/outbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(
        isOutboundAutoMode.value
          ? {
              sku: outboundForm.value.sku,
              qty,
              strategy: 'FIFO'
            }
          : {
              lot_number: outboundForm.value.lot_number,
              sku: outboundForm.value.sku,
              qty,
              source_bin_code: outboundForm.value.source_bin_code
            }
      )
    })

    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Outbound failed')
    }

    const deductions = result.data?.deductions || []
    const directSourceBinCode = outboundForm.value.source_bin_code || 'selected bin'
    const fifoSummary = deductions
      .map((entry) => `${entry.deducted_qty} from ${entry.lot_number} (${entry.bin_code})`)
      .join(', ')

    statusMessage.value = 'Outbound saved successfully.'
    statusType.value = 'success'
    showActionFeedbackModal(
      'Outbound Complete',
      isOutboundAutoMode.value
        ? `${outboundForm.value.item_name} -${qty} was deducted by FIFO. ${fifoSummary}`
        : `${outboundForm.value.item_name} -${qty} was deducted from ${directSourceBinCode}.`
    )
    showOutboundModal.value = false
    await handleScanResult(scanResult.value.raw, { bypassCooldown: true, silent: true })
  } catch (error) {
    statusMessage.value = `Outbound failed: ${error.message}`
    statusType.value = 'error'
    showOperationNotice('Outbound Failed', error.message, 'error')
  } finally {
    isSubmittingOutbound.value = false
  }
}

const clearResult = () => {
  scanResult.value = null
  scanAction.value = null
  showInboundModal.value = false
  showMoveModal.value = false
  showOutboundModal.value = false
  outboundCandidates.value = []
  selectedOutboundLotKey.value = ''
  outboundStrategy.value = 'DIRECT'
  outboundSelectionMode.value = 'AUTO'
  actionFeedbackModal.value.visible = false
  if (operationNoticeTimer) {
    clearTimeout(operationNoticeTimer)
  }
  operationNotice.value.visible = false
  statusMessage.value = ''
}

// 播放扫描音效
const playScanSound = () => {
  void playTonePattern(
    [
      { frequency: 1240, start: 0, duration: 0.07 },
      { frequency: 1680, start: 0.085, duration: 0.08 }
    ],
    { volume: 0.2, waveform: 'triangle' }
  )
}

const playActionSuccessSound = () => {
  void playTonePattern(
    [
      { frequency: 920, start: 0, duration: 0.08 },
      { frequency: 1280, start: 0.095, duration: 0.09 },
      { frequency: 1560, start: 0.2, duration: 0.11 }
    ],
    { volume: 0.24, waveform: 'sine' }
  )
}
</script>

<style scoped>
.scanner-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.scanner-header {
  text-align: center;
  margin-bottom: 30px;
}

.scanner-title {
  font-size: 2rem;
  font-weight: 700;
  color: #000000;
  margin: 0 0 20px 0;
}

.mode-selector {
  display: flex;
  justify-content: center;
  gap: 15px;
  flex-wrap: wrap;
}

.mode-btn {
  padding: 12px 24px;
  border: 2px solid #e5e7eb;
  background: white;
  color: #374151;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.mode-btn.active {
  background: #000000;
  color: white;
  border-color: #000000;
}

.mode-btn:hover:not(.active) {
  border-color: #9ca3af;
}

.scanner-area {
  margin-bottom: 30px;
}

.camera-container {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  background: #f9fafb;
}

.camera-stage {
  position: relative;
  overflow: hidden;
  background: #000000;
  min-height: 400px;
}

.camera-video {
  width: 100%;
  height: 400px;
  object-fit: cover;
  background: #000000;
  opacity: 1;
  transition: opacity 0.18s ease;
}

.camera-video.scanning {
  border: 3px solid #10b981;
}

.camera-video.pending {
  opacity: 0;
}

.camera-video.ready {
  opacity: 1;
}

.camera-stage-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, rgba(17, 24, 39, 0.8), rgba(0, 0, 0, 0.98));
  z-index: 1;
}

.camera-stage-placeholder-copy {
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
}

.camera-stage-placeholder-copy strong {
  display: block;
  font-size: 1.05rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.camera-stage-placeholder-copy p {
  margin: 8px 0 0;
  font-size: 0.92rem;
  color: rgba(255, 255, 255, 0.68);
}

.scan-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 2;
}

.scan-frame {
  position: relative;
  width: 250px;
  height: 250px;
  border: 2px solid rgba(255, 255, 255, 0.8);
}

.corner {
  position: absolute;
  width: 20px;
  height: 20px;
  border: 3px solid #10b981;
}

.top-left {
  top: -3px;
  left: -3px;
  border-right: none;
  border-bottom: none;
}

.top-right {
  top: -3px;
  right: -3px;
  border-left: none;
  border-bottom: none;
}

.bottom-left {
  bottom: -3px;
  left: -3px;
  border-right: none;
  border-top: none;
}

.bottom-right {
  bottom: -3px;
  right: -3px;
  border-left: none;
  border-top: none;
}

.scan-hint {
  margin-top: 20px;
  color: white;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}

.camera-controls {
  display: flex;
  justify-content: center;
  gap: 15px;
  padding: 20px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.control-btn {
  padding: 10px 20px;
  background: #000000;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.control-btn:hover {
  background: #1f2937;
}

.control-btn.flash-btn {
  position: relative;
}

.control-btn.flash-btn.active {
  background: #fbbf24;
  color: #000000;
  animation: flash-pulse 2s ease-in-out infinite;
}

.control-btn.flash-btn.active:hover {
  background: #f59e0b;
}

.flash-icon {
  display: inline-block;
  margin-right: 5px;
  font-size: 1.1em;
}

@keyframes flash-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(251, 191, 36, 0);
  }
}

.file-upload {
  padding: 40px;
  text-align: center;
}

.upload-area {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 60px 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-area:hover {
  border-color: #9ca3af;
  background: #f9fafb;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.upload-hint {
  color: #6b7280;
  font-size: 0.9rem;
  margin-top: 10px;
}

.manual-input {
  display: flex;
  gap: 15px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 12px;
}

.manual-input-field {
  flex: 1;
  padding: 15px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
}

.manual-input-field:focus {
  outline: none;
  border-color: #000000;
}

.submit-btn {
  padding: 15px 30px;
  background: #000000;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.submit-btn:hover {
  background: #1f2937;
}

.scan-result {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 25px;
  margin-bottom: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
}

.scan-result h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary);
  font-size: 1.25rem;
  font-weight: 600;
}

.result-content {
  margin-bottom: 25px;
}

.workflow-guide-card {
  margin: 0 0 24px;
  padding: 16px 18px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96) 0%, rgba(241, 245, 249, 0.96) 100%);
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.workflow-guide-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.workflow-guide-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.workflow-guide-list {
  margin: 0;
  padding-left: 18px;
  color: #334155;
  display: grid;
  gap: 8px;
}

.workflow-guide-compact {
  display: grid;
  gap: 10px;
}

.workflow-guide-compact-item {
  border-radius: 12px;
  border: 1px solid #dbe3f0;
  background: #f8fafc;
  padding: 11px 12px;
  color: #334155;
  line-height: 1.5;
}

.result-item {
  margin-bottom: 15px;
}

.result-item .label {
  font-weight: 500;
  color: var(--text-secondary);
  display: inline-block;
  width: 100px;
}

.result-item .value {
  color: var(--text-primary);
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, monospace;
  word-break: break-all;
}

.parsed-json {
  background: rgba(0, 0, 0, 0.03);
  padding: 15px;
  border-radius: 8px;
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, monospace;
  font-size: 0.9rem;
  overflow-x: auto;
  margin: 10px 0;
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
}

.inquiry-panel {
  margin: 0 0 24px;
  padding: 18px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.inquiry-header,
.inquiry-summary,
.inquiry-meta,
.section-topline,
.inquiry-row {
  display: flex;
}

.inquiry-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.inquiry-eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6b7280;
}

.inquiry-header h4 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--text-primary);
}

.inquiry-subtitle {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.inquiry-type {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-primary);
}

.inquiry-summary {
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.inquiry-card {
  flex: 1;
  min-width: 130px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.92);
}

.inquiry-card span,
.meta-pill span {
  display: block;
  font-size: 0.78rem;
  color: #6b7280;
}

.inquiry-card strong,
.meta-pill strong {
  display: block;
  margin-top: 4px;
  color: var(--text-primary);
}

.inquiry-card.ok {
  background: rgba(236, 253, 245, 0.95);
}

.inquiry-card.danger {
  background: rgba(255, 241, 242, 0.95);
}

.inquiry-meta {
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.meta-pill {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.88);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.inquiry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.inquiry-section {
  padding: 14px;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.88);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.section-topline {
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.section-topline span {
  font-size: 0.82rem;
  color: #6b7280;
}

.inquiry-rows {
  display: grid;
  gap: 10px;
}

.inquiry-row {
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.inquiry-row:first-child {
  border-top: none;
  padding-top: 0;
}

.inquiry-row strong {
  display: block;
  color: var(--text-primary);
}

.inquiry-row p {
  margin: 4px 0 0;
  font-size: 0.82rem;
  color: #6b7280;
}

.inquiry-row span {
  white-space: nowrap;
  font-size: 0.82rem;
  color: var(--text-primary);
}

.inquiry-empty {
  font-size: 0.88rem;
  color: #6b7280;
}

.business-actions {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 12px 24px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  background: var(--glass-bg);
  color: var(--text-primary);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  flex: 1;
  min-width: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.action-btn:hover {
  transform: translateY(-2px);
  background: var(--glass-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.operation-toast {
  position: sticky;
  top: 16px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  padding: 16px 18px;
  border-radius: 16px;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid transparent;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
}

.operation-toast.success {
  background: rgba(236, 253, 245, 0.92);
  border-color: rgba(16, 185, 129, 0.18);
}

.operation-toast.error {
  background: rgba(254, 242, 242, 0.94);
  border-color: rgba(239, 68, 68, 0.18);
}

.operation-toast-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 700;
  flex-shrink: 0;
}

.operation-toast.success .operation-toast-icon {
  background: rgba(16, 185, 129, 0.14);
  color: #059669;
}

.operation-toast.error .operation-toast-icon {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.operation-toast-copy strong {
  display: block;
  color: #0f172a;
  font-size: 0.98rem;
}

.operation-toast-copy p {
  margin: 4px 0 0;
  color: #475569;
  font-size: 0.88rem;
  line-height: 1.45;
}


.status-message {
  padding: 15px;
  border-radius: 12px;
  margin-bottom: 20px;
  text-align: center;
  font-weight: 500;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid transparent;
}

.status-message.info {
  background: rgba(59, 130, 246, 0.1);
  color: var(--text-primary);
  border-color: rgba(59, 130, 246, 0.2);
}

.status-message.success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--text-primary);
  border-color: rgba(16, 185, 129, 0.2);
}

.status-message.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--text-primary);
  border-color: rgba(239, 68, 68, 0.2);
}

.device-selector {
  text-align: center;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
}

.device-selector label {
  margin-right: 10px;
  font-weight: 600;
  color: #374151;
}

.device-selector select {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 0.9rem;
}


.queue-status {
  margin-top: 20px;
  background: white;
  border-radius: 12px;
  padding: 15px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.queue-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.queue-item:last-child {
  border-bottom: none;
}

.queue-item.success { color: #10b981; }
.queue-item.retrying { color: #f59e0b; }
.queue-item.sending { color: #3b82f6; }

.task-desc { font-weight: bold; font-size: 14px; }
.task-time { font-size: 12px; color: #666; margin-left: 8px; }

@media (max-width: 640px) {
  .scanner-header {
    padding: 15px;
  }
  
  .camera-video {
    height: 300px;
  }
}

@media (max-width: 768px) {
  .scanner-container {
    padding: 15px;
  }

  .scanner-header {
    margin-bottom: 18px;
  }
  
  .camera-video {
    height: 300px;
  }
  
  .scan-frame {
    width: 200px;
    height: 200px;
  }
  
  .mode-selector {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    align-items: stretch;
  }

  .mode-btn {
    width: 100%;
    padding: 12px 10px;
    font-size: 0.95rem;
  }
  
  .business-actions {
    flex-direction: column;
  }

  .camera-controls {
    flex-wrap: wrap;
  }

  .inquiry-grid {
    grid-template-columns: 1fr;
  }
  
  .action-btn {
    width: 100%;
  }
}

@media (max-width: 520px) {
  .mode-selector {
    grid-template-columns: 1fr;
  }

  .scan-hint {
    margin-top: 14px;
    padding: 0 18px;
    text-align: center;
    font-size: 0.95rem;
    line-height: 1.35;
  }
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  overflow-y: auto;
  padding: 24px 16px;
  box-sizing: border-box;
}

.modal-overlay-foreground {
  z-index: 1200;
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-height: min(88vh, 760px);
  display: flex;
  flex-direction: column;
}

.action-feedback-modal {
  align-items: center;
  text-align: center;
  gap: 14px;
  padding: 28px 24px 24px;
  max-width: 360px;
}

.action-feedback-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  font-size: 1.75rem;
  font-weight: 800;
}

.action-feedback-modal h3 {
  margin: 0;
  font-size: 1.35rem;
  color: #0f172a;
}

.action-feedback-modal p {
  margin: 0;
  color: #475569;
  line-height: 1.6;
}

.action-feedback-btn {
  width: 100%;
  margin-top: 6px;
  min-height: 48px;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #111827;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
}

.form-body {
  padding: 24px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
  color: #374151;
}

.input-field {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}

.disabled-input {
  background-color: #f3f4f6;
  color: #6b7280;
  cursor: not-allowed;
}

.form-hint {
  margin-top: 6px;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #64748b;
}

.form-hint-error {
  color: #dc2626;
}

.outbound-plan-list {
  display: grid;
  gap: 10px;
}

.outbound-mode-toggle {
  display: inline-flex;
  width: 100%;
  padding: 4px;
  gap: 4px;
  border-radius: 12px;
  background: #e2e8f0;
}

.outbound-mode-btn {
  flex: 1;
  min-height: 42px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #475569;
  font-weight: 700;
  cursor: pointer;
}

.outbound-mode-btn.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}

.outbound-plan-card {
  border: 1px solid #dbe3f0;
  border-radius: 14px;
  padding: 12px 14px;
  background: linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%);
}

.outbound-plan-step {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.outbound-plan-main {
  margin-top: 4px;
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
}

.outbound-plan-meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: #475569;
  font-size: 0.85rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}

.btn-cancel, .btn-primary {
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
}

.btn-cancel {
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}

.btn-primary {
  background: #10b981;
  border: 1px solid #10b981;
  color: white;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.benchmark-panel {
  margin: 18px 0 22px;
  border: 1px solid #dbe3f0;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.benchmark-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  background: transparent;
  border: none;
  color: #0f172a;
  font-size: 0.98rem;
  font-weight: 700;
  cursor: pointer;
}

.benchmark-body {
  padding: 0 18px 18px;
}

.benchmark-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.benchmark-card {
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #ffffff;
}

.benchmark-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.benchmark-card strong {
  display: block;
  margin-top: 6px;
  font-size: 1.15rem;
  color: #0f172a;
}

.benchmark-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.benchmark-action {
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  font-weight: 600;
  cursor: pointer;
}

.benchmark-action.danger {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fef2f2;
}

.benchmark-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.benchmark-recent {
  margin-top: 16px;
}

.benchmark-recent h4 {
  margin: 0 0 10px;
  color: #0f172a;
}

.benchmark-list {
  display: grid;
  gap: 10px;
}

.benchmark-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

.benchmark-row p {
  margin: 4px 0 0;
  font-size: 0.84rem;
  color: #64748b;
}

.benchmark-row-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  font-size: 0.84rem;
  color: #334155;
}

.benchmark-status {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.benchmark-status.success {
  background: #dcfce7;
  color: #166534;
}

.benchmark-status.stopped,
.benchmark-status.backend_failed,
.benchmark-status.request_failed,
.benchmark-status.decode_failed,
.benchmark-status.startup_failed {
  background: #fee2e2;
  color: #991b1b;
}

.benchmark-empty {
  margin: 0;
  color: #64748b;
}

@media (max-width: 768px) {
  .benchmark-grid {
    grid-template-columns: 1fr;
  }

  .benchmark-row {
    flex-direction: column;
  }

  .benchmark-row-meta {
    align-items: flex-start;
  }

  .modal-overlay {
    align-items: flex-start;
    padding: max(12px, env(safe-area-inset-top)) 12px calc(20px + env(safe-area-inset-bottom));
  }

  .modal-content {
    width: 100%;
    max-width: none;
    max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px);
    border-radius: 18px;
  }

  .modal-header {
    padding: 16px 18px;
  }

  .form-body {
    padding: 18px;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .form-actions {
    position: sticky;
    bottom: 0;
    z-index: 2;
    margin: 20px -18px -18px;
    padding: 14px 18px calc(14px + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.96);
    border-top: 1px solid #e5e7eb;
  }

  .btn-cancel,
  .btn-primary {
    flex: 1 1 140px;
    min-height: 44px;
  }
}
</style>
