<template>
  <div class="scanner-container">
    <!-- 扫码模式选择 -->
    <div class="scanner-header">
      <h2 class="scanner-title">智能扫码系统</h2>
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
          <p class="scan-hint">将条码放入框内</p>
        </div>

        <!-- 摄像头控制 -->
        <div class="camera-controls">
          <button @click="toggleCamera" class="control-btn">
            {{ isScanning ? '停止扫描' : '开始扫描' }}
          </button>
          <button @click="switchCamera" class="control-btn" v-if="devices.length > 1">
            切换摄像头
          </button>
          <button @click="toggleFlash" class="control-btn" v-if="hasFlash">
            {{ flashOn ? '关闭手电筒' : '打开手电筒' }}
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
          <p>点击选择图片或拖拽到此处</p>
          <p class="upload-hint">支持 JPG、PNG 格式</p>
        </div>
      </div>

      <!-- 手动输入 -->
      <div v-if="currentMode === 'manual'" class="manual-input">
        <input 
          v-model="manualCode" 
          type="text" 
          placeholder="请输入条码内容"
          class="manual-input-field"
          @keyup.enter="handleManualSubmit"
        />
        <button @click="handleManualSubmit" class="submit-btn">确认</button>
      </div>
    </div>

    <!-- 扫描结果 -->
    <div v-if="scanResult" class="scan-result">
      <h3>扫描结果</h3>
      <div class="result-content">
        <div class="result-item">
          <span class="label">原始数据：</span>
          <span class="value">{{ scanResult.raw }}</span>
        </div>
        <div v-if="scanResult.parsed" class="result-item">
          <span class="label">解析结果：</span>
          <pre class="parsed-json">{{ JSON.stringify(scanResult.parsed, null, 2) }}</pre>
        </div>
        <div class="result-item">
          <span class="label">扫描时间：</span>
          <span class="value">{{ scanResult.timestamp }}</span>
        </div>
      </div>
      
      <!-- 业务操作按钮 -->
      <div class="business-actions">
        <button @click="handleInbound" class="action-btn inbound">入库操作</button>
        <button @click="handleOutbound" class="action-btn outbound">出库操作</button>
        <button @click="handleInventory" class="action-btn inventory">库存查询</button>
        <button @click="clearResult" class="action-btn clear">清除结果</button>
      </div>
    </div>

    <!-- 状态提示 -->
    <div v-if="statusMessage" class="status-message" :class="statusType">
      {{ statusMessage }}
    </div>

    <!-- 设备选择 -->
    <div v-if="devices.length > 1" class="device-selector">
      <label>选择摄像头：</label>
      <select v-model="selectedDevice" @change="switchDevice">
        <option v-for="device in devices" :key="device.deviceId" :value="device.deviceId">
          {{ device.label || `摄像头 ${device.deviceId.slice(0, 8)}` }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
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

// 扫码模式
const scanModes = [
  { value: 'camera', label: '📷 摄像头扫描', icon: '📷' },
  { value: 'file', label: '📁 图片上传', icon: '📁' },
  { value: 'manual', label: '⌨️ 手动输入', icon: '⌨️' }
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
    statusMessage.value = '摄像头权限已获取'
    statusType.value = 'success'
  } catch (error) {
    statusMessage.value = '无法访问摄像头，请检查权限设置'
    statusType.value = 'error'
  }
}

// 列出设备
const listDevices = async () => {
  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices()
    devices.value = allDevices.filter(device => device.kind === 'videoinput')
    if (devices.value.length > 0) {
      selectedDevice.value = devices.value[0].deviceId
    }
  } catch (error) {
    console.error('获取设备列表失败:', error)
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
    statusMessage.value = '正在启动摄像头...'
    statusType.value = 'info'
    
    // 获取视频流
    const constraints = {
      video: {
        deviceId: selectedDevice.value ? { exact: selectedDevice.value } : undefined,
        facingMode: 'environment'
      }
    }
    
    stream = await navigator.mediaDevices.getUserMedia(constraints)
    videoRef.value.srcObject = stream
    
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
    
    statusMessage.value = '扫描已开始，请将条码放入框内'
    statusType.value = 'success'
    
  } catch (error) {
    console.error('启动扫描失败:', error)
    statusMessage.value = '启动扫描失败: ' + error.message
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
      console.error('停止扫描器失败:', error)
    }
  }
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
  
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
}

// 切换摄像头
const switchDevice = async () => {
  if (isScanning.value) {
    await stopScanning()
    await startScanning()
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

// 切换手电筒
const toggleFlash = async () => {
  if (!stream) return
  
  try {
    const track = stream.getVideoTracks()[0]
    if (track.getCapabilities().torch) {
      flashOn.value = !flashOn.value
      await track.applyConstraints({
        advanced: [{ torch: flashOn.value }]
      })
    }
  } catch (error) {
    console.error('切换手电筒失败:', error)
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
    statusMessage.value = '正在解析图片...'
    statusType.value = 'info'
    
    // 使用 ZXing 解析图片
    const arrayBuffer = await file.arrayBuffer()
    const result = await codeReader.decodeFromArrayBuffer(arrayBuffer)
    
    if (result) {
      handleScanResult(result.getText())
    }
  } catch (error) {
    console.error('解析图片失败:', error)
    statusMessage.value = '无法识别图片中的条码'
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
    if (navigator.vibrate) {
      navigator.vibrate(100)
    }
    
    statusMessage.value = '扫描成功！'
    statusType.value = 'success'
    
  } catch (error) {
    console.error('处理扫描结果失败:', error)
    statusMessage.value = '处理扫描结果失败'
    statusType.value = 'error'
  }
}

// 业务操作
const handleInbound = () => {
  if (!scanResult.value) return
  // TODO: 调用入库API
  console.log('执行入库操作:', scanResult.value)
}

const handleOutbound = () => {
  if (!scanResult.value) return
  // TODO: 调用出库API
  console.log('执行出库操作:', scanResult.value)
}

const handleInventory = () => {
  if (!scanResult.value) return
  // TODO: 调用库存查询API
  console.log('执行库存查询:', scanResult.value)
}

const clearResult = () => {
  scanResult.value = null
  statusMessage.value = ''
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
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 20px;
}

.scan-result h3 {
  margin: 0 0 20px 0;
  color: #000000;
  font-size: 1.25rem;
}

.result-content {
  margin-bottom: 25px;
}

.result-item {
  margin-bottom: 15px;
}

.result-item .label {
  font-weight: 600;
  color: #374151;
  display: inline-block;
  width: 100px;
}

.result-item .value {
  color: #1f2937;
  word-break: break-all;
}

.parsed-json {
  background: #f3f4f6;
  padding: 15px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.9rem;
  overflow-x: auto;
  margin: 10px 0;
}

.business-actions {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.action-btn.inbound {
  background: #10b981;
  color: white;
}

.action-btn.outbound {
  background: #ef4444;
  color: white;
}

.action-btn.inventory {
  background: #3b82f6;
  color: white;
}

.action-btn.clear {
  background: #6b7280;
  color: white;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.status-message {
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: center;
  font-weight: 600;
}

.status-message.info {
  background: #dbeafe;
  color: #1e40af;
}

.status-message.success {
  background: #d1fae5;
  color: #065f46;
}

.status-message.error {
  background: #fee2e2;
  color: #991b1b;
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
