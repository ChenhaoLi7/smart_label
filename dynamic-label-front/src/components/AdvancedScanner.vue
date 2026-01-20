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
        <video 
          ref="videoRef" 
          autoplay 
          playsinline 
          class="camera-video"
          :class="{ scanning: isScanning }"
        ></video>
        
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

        <!-- 摄像头控制 -->
        <div class="camera-controls">
          <button @click="toggleCamera" class="control-btn">
            {{ isScanning ? 'Stop Scan' : 'Start Scan' }}
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
        <div v-if="scanResult.parsed" class="result-item">
          <span class="label">Parsed Result:</span>
          <pre class="parsed-json">{{ JSON.stringify(scanResult.parsed, null, 2) }}</pre>
        </div>
        <div class="result-item">
          <span class="label">Scan Time:</span>
          <span class="value">{{ scanResult.timestamp }}</span>
        </div>
      </div>
      
      <!-- 业务操作按钮 -->
      <div class="business-actions">
        <button @click="handleInbound" class="action-btn inbound">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Inbound Processing
        </button>
        <button @click="handleOutbound" class="action-btn outbound">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Outbound Processing
        </button>
        <button @click="handleInventory" class="action-btn inventory">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          Inventory Inquiry
        </button>
        <button @click="handleProduction" class="action-btn production" style="background: #8b5cf6; color: white;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Production
        </button>
        <button @click="handleCount" class="action-btn count" style="background: #eab308; color: white;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          Count
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

    <!-- 状态提示 -->
    <div v-if="statusMessage" class="status-message" :class="statusType">
      {{ statusMessage }}
    </div>
    
    <!-- 低光环境提示 -->
    <div v-if="isLowLight && !flashOn && hasFlash" class="low-light-hint">
      <div class="hint-content">
        <span class="hint-icon">🌙</span>
        <span>Low light detected. Turning on the light will improve scan accuracy</span>
        <button @click="toggleFlash" class="hint-btn">Turn On Light</button>
      </div>
    </div>

    <!-- 队列状态可视化 (新增) -->
    <div v-if="requestQueue.length > 0" class="queue-status">
      <h3>Background Tasks ({{ requestQueue.length }})</h3>
      <div v-for="task in requestQueue" :key="task.id" class="queue-item" :class="task.status">
        <div class="task-info">
          <span class="task-desc">{{ task.desc }}</span>
          <span class="task-time">{{ task.timestamp }}</span>
        </div>
        <div class="task-status">
          <span v-if="task.status === 'pending'">⏳ Pending</span>
          <span v-if="task.status === 'sending'">🔄 Sending...</span>
          <span v-if="task.status === 'retrying'">⚠️ Retry ({{ task.retryCount }})</span>
          <span v-if="task.status === 'success'">✅ Done</span>
        </div>
      </div>
    </div>

    <!-- 设备选择 -->
    <div v-if="devices.length > 1" class="device-selector">
      <label>Select Camera:</label>
      <select v-model="selectedDevice" @change="switchDevice">
        <option v-for="device in devices" :key="device.deviceId" :value="device.deviceId">
          {{ device.label || `Camera ${device.deviceId.slice(0, 8)}` }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'


import { BrowserMultiFormatReader } from '@zxing/browser'
// import QRCode from 'qrcode' // 暂时注释，后续会用到

// 响应式数据
const videoRef = ref(null)
const fileInput = ref(null)
const isScanning = ref(false)
const currentMode = ref('camera')
const scanResult = ref(null)
const statusMessage = ref('')
const statusType = ref('info')
const manualCode = ref('')
const devices = ref([])
const selectedDevice = ref('')
const hasFlash = ref(false)
const flashOn = ref(false)
const isLowLight = ref(false) // 低光环境检测
let lightCheckInterval = null

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

// ZXing 扫码器
let codeReader = null
let stream = null

// 生命周期
onMounted(async () => {
  await checkPermissions()
  await listDevices()
  if (currentMode.value === 'camera') {
    await startScanning()
  }
})

onBeforeUnmount(() => {
  stopScanning()
})

// 检查权限
const checkPermissions = async () => {
  try {
    await navigator.mediaDevices.getUserMedia({ video: true })
    statusMessage.value = 'Camera permission granted'
    statusType.value = 'success'
  } catch (error) {
    statusMessage.value = 'Cannot access camera. Please check permission settings'
    statusType.value = 'error'
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

// 切换模式
const switchMode = async (mode) => {
  if (currentMode.value === 'camera') {
    await stopScanning()
  }
  currentMode.value = mode
  
  if (mode === 'camera') {
    await nextTick()
    await startScanning()
  }
}

// 开始扫描
const startScanning = async () => {
  if (!videoRef.value || isScanning.value) return
  
  try {
    isScanning.value = true
    statusMessage.value = 'Starting camera...'
    statusType.value = 'info'
    
    // 获取视频流
    const constraints = {
      video: {
        deviceId: selectedDevice.value ? { exact: selectedDevice.value } : undefined,
        // 优先使用后置摄像头（通常有闪光灯）
        facingMode: selectedDevice.value ? undefined : 'environment'
      }
    }
    
    stream = await navigator.mediaDevices.getUserMedia(constraints)
    videoRef.value.srcObject = stream
    
    // 检测闪光灯支持
    await checkFlashSupport()
    
    // 初始化 ZXing
    codeReader = new BrowserMultiFormatReader()
    
    // 开始解码
    await codeReader.decodeFromVideoDevice(
      selectedDevice.value || undefined,
      videoRef.value,
      (result) => {
        if (result) {
          handleScanResult(result.getText())
        }
        // 忽略连续的空帧错误
      }
    )
    
    statusMessage.value = 'Scan started. Please place the barcode inside the frame'
    statusType.value = 'success'
    
    // 开始检测环境亮度
    startLightDetection()
    
  } catch (error) {
    console.error('スキャン開始に失敗しました:', error)
    statusMessage.value = 'Failed to start scan: ' + error.message
    statusType.value = 'error'
    isScanning.value = false
  }
}

// 停止扫描
const stopScanning = async () => {
  isScanning.value = false
  
  if (codeReader) {
    try {
      await codeReader.reset()
      codeReader = null
    } catch (error) {
      console.error('スキャナーの停止に失敗しました:', error)
    }
  }
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
  
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
  
  // 停止亮度检测
  stopLightDetection()
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

// 检测环境亮度
const detectLightLevel = () => {
  if (!videoRef.value || !isScanning.value) return
  
  try {
    const video = videoRef.value
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    canvas.width = video.videoWidth || 320
    canvas.height = video.videoHeight || 240
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // 获取图像数据
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    
    // 计算平均亮度（使用灰度值）
    let totalBrightness = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      // 使用标准灰度公式
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114)
      totalBrightness += brightness
    }
    
    const avgBrightness = totalBrightness / (data.length / 4)
    
    // 如果平均亮度低于阈值（0-255，阈值设为80），认为是低光环境
    const threshold = 80
    const wasLowLight = isLowLight.value
    isLowLight.value = avgBrightness < threshold
    
    // 如果检测到低光环境且闪光灯未开启，提示用户
    if (isLowLight.value && !flashOn.value && hasFlash.value && !wasLowLight) {
      statusMessage.value = 'Low light detected. It is recommended to turn on the light'
      statusType.value = 'info'
      // 3秒后自动清除提示
      setTimeout(() => {
        if (statusMessage.value.includes('Low light detected')) {
          statusMessage.value = ''
        }
      }, 3000)
    }
    
  } catch (error) {
    console.error('亮度检测失败:', error)
  }
}

// 开始亮度检测
const startLightDetection = () => {
  stopLightDetection() // 先清除之前的检测
  if (videoRef.value) {
    // 每2秒检测一次环境亮度
    lightCheckInterval = setInterval(() => {
      detectLightLevel()
    }, 2000)
  }
}

// 停止亮度检测
const stopLightDetection = () => {
  if (lightCheckInterval) {
    clearInterval(lightCheckInterval)
    lightCheckInterval = null
  }
  isLowLight.value = false
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
    statusMessage.value = 'Analyzing image...'
    statusType.value = 'info'
    
    // 使用 ZXing 解析图片
    const arrayBuffer = await file.arrayBuffer()
    const result = await codeReader.decodeFromArrayBuffer(arrayBuffer)
    
    if (result) {
      handleScanResult(result.getText())
    }
  } catch (error) {
    console.error('画像解析に失敗しました:', error)
    statusMessage.value = 'Cannot recognize barcode in image'
    statusType.value = 'error'
  }
}

// 处理手动输入
const handleManualSubmit = () => {
  if (manualCode.value.trim()) {
    handleScanResult(manualCode.value.trim())
    manualCode.value = ''
  }
}

// 处理扫描结果
const handleScanResult = (rawData) => {
  try {
    // 尝试解析 JSON
    let parsed = null
    try {
      parsed = JSON.parse(rawData)
    } catch (e) {
      // 如果不是 JSON，当作普通条码处理
      parsed = { type: 'UNKNOWN', content: rawData }
    }
    
    scanResult.value = {
      raw: rawData,
      parsed: parsed,
      timestamp: new Date().toLocaleString()
    }
    
    // 震动反馈
    // 震动反馈 (Haptic Feedback) - 主要针对 Android
    if (navigator.vibrate) {
      navigator.vibrate(200)
    }

    // 音效反馈 (Audio Feedback) - 针对 iOS 和所有设备
    playScanSound()
    
    statusMessage.value = 'Scan successful!'
    statusType.value = 'success'
    
  } catch (error) {
    console.error('スキャン結果の処理に失敗しました:', error)
    statusMessage.value = 'Failed to process scan result'
    statusType.value = 'error'
  }
}

// 业务操作
const handleInbound = () => {
  if (!scanResult.value) return
  // TODO: 调用入库API
  console.log('入庫処理を実行:', scanResult.value)
}

const handleOutbound = () => {
  if (!scanResult.value) return
  // TODO: 调用出库API
  console.log('出庫処理を実行:', scanResult.value)
}

const handleInventory = () => {
  if (!scanResult.value) return
  // TODO: 调用库存查询API
  console.log('在庫照会を実行:', scanResult.value)
}

const handleProduction = async () => {
  if (!scanResult.value) return
  
  // Try to find SKU
  let sku = null
  if (scanResult.value.parsed) {
     if (scanResult.value.parsed.type === 'ITEM') sku = scanResult.value.parsed.id
     else if (scanResult.value.parsed.sku) sku = scanResult.value.parsed.sku
  }

  if (!sku) {
    statusMessage.value = 'Please scan an Item or Lot label first'
    statusType.value = 'error'
    return
  }

  const qtyStr = prompt(`Enter production quantity for ${sku}:`, '1')
  if (!qtyStr) return
  
  const qty = parseFloat(qtyStr)
  if (isNaN(qty) || qty <= 0) {
    alert('Invalid quantity')
    return
  }

  try {
    statusMessage.value = 'Creating production run...'
    statusType.value = 'info'
    
    // Call backend
    const response = await fetch('/api/production/produce', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ sku, qty })
    })

    const result = await response.json()
    if (result.success) {
      statusMessage.value = `Production successful! New Lot: ${result.data.lot.lot_number}`
      statusType.value = 'success'
      alert(`Production Complete!\nNew Lot: ${result.data.lot.lot_number}\nMat. Consumed: ${result.data.consumed}`)
    } else {
      throw new Error(result.message)
    }
  } catch (error) {
    console.error('Production error:', error)
    statusMessage.value = 'Production failed: ' + error.message
    statusType.value = 'error'
    alert('Production failed: ' + error.message)
  }
}

const handleCount = async () => {
  if (!scanResult.value) return
  
  // Try to find Lot Number
  let lotNumber = null
  if (scanResult.value.parsed && scanResult.value.parsed.type === 'LOT') {
    lotNumber = scanResult.value.parsed.id
  }

  if (!lotNumber) {
    statusMessage.value = 'Please scan a LOT label for counting'
    statusType.value = 'error'
    return
  }

  const actualQtyStr = prompt(`Enter ACTUAL quantity for Lot ${lotNumber}:`)
    alert('Invalid quantity')
      alert('Invalid quantity')
    return
  }
  
  const reason = prompt('Enter reason for adjustment (optional):', 'Cycle Count')

  // 🔑 关键改进：为这次业务操作生成唯一 Key，并缓存
  // 如果是重试，使用相同的 key
  if (!currentCountKey.value || currentCountKey.value.lotNumber !== lotNumber) {
    currentCountKey.value = {
      lotNumber: lotNumber,
      key: `count-${lotNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
    console.log('🔑 生成新的幂等性 Key:', currentCountKey.value.key)
  } else {
    console.log('♻️ 重试使用相同 Key:', currentCountKey.value.key)
  }

  // ✅ 方案一：前端“死磕”模式 (Queue)
  // 不直接发请求，而是加入队列
  
  const taskId = `count-${lotNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  requestQueue.value.unshift({
    id: taskId,
    lot: lotNumber,
    qty: actualQty,
    reason: reason,
    status: 'pending',
    retryCount: 0,
    timestamp: new Date().toLocaleString(),
    desc: `Count Lot ${lotNumber}: ${actualQty}` 
  })
  
  statusMessage.value = 'Task queued. Uploading in background...'
  statusType.value = 'success'
  
  // 立即触发一次处理
  processQueue()
  
  // 清除扫码结果，准备下一次扫描 (Fire and Forget!)
  scanResult.value = null
}

const clearResult = () => {
  scanResult.value = null
  statusMessage.value = ''
}

// 播放扫描音效
const playScanSound = () => {
  // 简单的 "叮" 声 (Base64 encoded wav)
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(1200, audioContext.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1)
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
  
  oscillator.start()
  oscillator.stop(audioContext.currentTime + 0.1)
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
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.camera-video {
  width: 100%;
  height: 400px;
  object-fit: cover;
  background: #000000;
}

.camera-video.scanning {
  border: 3px solid #10b981;
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

.low-light-hint {
  margin: 20px 0;
  padding: 15px 20px;
  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hint-content {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
  font-weight: 500;
}

.hint-icon {
  font-size: 1.5rem;
  animation: moonPulse 2s ease-in-out infinite;
}

@keyframes moonPulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.hint-content span:not(.hint-icon) {
  flex: 1;
  line-height: 1.5;
}

.hint-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid white;
  border-radius: 6px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.hint-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .hint-content {
    flex-direction: column;
    text-align: center;
  }
  
  .hint-btn {
    width: 100%;
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
  
  .camera-video {
    height: 300px;
  }
  
  .scan-frame {
    width: 200px;
    height: 200px;
  }
  
  .mode-selector {
    flex-direction: column;
    align-items: center;
  }
  
  .business-actions {
    flex-direction: column;
  }
  
  .action-btn {
    width: 100%;
  }
}
</style>
