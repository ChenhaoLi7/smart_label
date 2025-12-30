<template>
  <div class="avatar-upload">
    <!-- 头像显示区域 -->
    <div class="avatar-container" @click="openFileDialog">
      <div class="avatar-display">
        <img 
          v-if="avatarUrl && !imageLoadError" 
          :src="avatarUrl" 
          :alt="username"
          class="avatar-image"
          @error="handleImageError"
        />
        <div v-else class="avatar-placeholder">
          {{ username.charAt(0).toUpperCase() }}
        </div>
        <div class="avatar-overlay">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span>更换头像</span>
        </div>
      </div>
    </div>

    <!-- 文件选择对话框 -->
    <input 
      ref="fileInput"
      type="file" 
      accept="image/*" 
      @change="handleFileSelect"
      style="display: none"
    />

    <!-- 头像预览和编辑模态框 -->
    <Teleport to="body">
      <div v-if="showPreview" class="modal-overlay" @click="closePreview">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>编辑头像</h3>
            <button @click="closePreview" class="close-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="preview-container">
              <div 
                class="preview-avatar"
                @mousedown="startDrag"
                @mousemove="onDrag"
                @mouseup="stopDrag"
                @mouseleave="stopDrag"
                @touchstart.prevent="startDrag"
                @touchmove.prevent="onDrag"
                @touchend="stopDrag"
              >
                <img 
                  ref="previewImage"
                  :src="previewUrl" 
                  alt="预览头像"
                  class="preview-img"
                  :style="imageStyle"
                  draggable="false"
                />
              </div>
              
              <div class="preview-controls">
                <div class="zoom-controls">
                  <button @click="zoomOut" class="control-btn" :disabled="scale <= 0.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="M21 21l-4.35-4.35"/>
                      <line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                  </button>
                  <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
                  <button @click="zoomIn" class="control-btn" :disabled="scale >= 2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="M21 21l-4.35-4.35"/>
                      <line x1="11" y1="8" x2="11" y2="14"/>
                      <line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                  </button>
                </div>
                
                <div class="position-controls">
                  <button @click="resetPosition" class="control-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                      <path d="M21 3v5h-5"/>
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                      <path d="M3 21v-5h5"/>
                    </svg>
                    重置位置
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button @click="closePreview" class="btn btn-secondary">取消</button>
            <button @click="saveAvatar" class="btn btn-primary" :disabled="isUploading">
              <span v-if="isUploading">上传中...</span>
              <span v-else>保存头像</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// eslint-disable-next-line no-undef
const props = defineProps({
  username: {
    type: String,
    default: 'Admin'
  },
  currentAvatar: {
    type: String,
    default: ''
  }
})

// eslint-disable-next-line no-undef
const emit = defineEmits(['avatar-updated'])

// 响应式数据
const fileInput = ref(null)
const previewImage = ref(null)
const showPreview = ref(false)
const selectedFile = ref(null)
const previewUrl = ref('')
const scale = ref(1)
const position = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const isUploading = ref(false)
const imageLoadError = ref(false)

// Watch for avatarUrl changes to reset error state
import { watch } from 'vue'
// eslint-disable-next-line no-undef
watch(() => props.currentAvatar, () => {
  imageLoadError.value = false
})

// 计算属性
const avatarUrl = computed(() => {
  let url = props.currentAvatar || localStorage.getItem('userAvatar')
  if (!url) return ''
  
  // Fix Windows paths if present
  url = url.replace(/\\/g, '/')
  
  // Ensure it starts with / if it's a relative path (and not a data URL or http)
  if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('/')) {
    url = '/' + url
  }

  // If it's a full URL pointing to localhost/127.0.0.1, strip it to use the proxy
  if (url.includes('localhost:3000') || url.includes('127.0.0.1:3000')) {
    url = url.replace(/http:\/\/(localhost|127\.0\.0\.1):3000/, '')
  }
  
  // Debug log
  console.log('Processed Avatar URL:', url)
  
  // Add timestamp to force reload
  return url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`
})

const imageStyle = computed(() => ({
  transform: `scale(${scale.value}) translate(${position.value.x}px, ${position.value.y}px)`,
  cursor: isDragging.value ? 'grabbing' : 'grab'
}))

// 方法
const openFileDialog = () => {
  fileInput.value.click()
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    return
  }
  
  // 验证文件大小 (最大5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('图片大小不能超过5MB')
    return
  }
  
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
  showPreview.value = true
  resetPosition()
}

const zoomIn = () => {
  if (scale.value < 2) {
    scale.value += 0.1
  }
}

const zoomOut = () => {
  if (scale.value > 0.5) {
    scale.value -= 0.1
  }
}

const resetPosition = () => {
  scale.value = 1
  position.value = { x: 0, y: 0 }
}

// Dragging Logic
const startDrag = (event) => {
  isDragging.value = true
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const clientY = event.touches ? event.touches[0].clientY : event.clientY
  dragStart.value = {
    x: clientX - position.value.x,
    y: clientY - position.value.y
  }
}

const onDrag = (event) => {
  if (!isDragging.value) return
  
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const clientY = event.touches ? event.touches[0].clientY : event.clientY
  
  position.value = {
    x: clientX - dragStart.value.x,
    y: clientY - dragStart.value.y
  }
}

const stopDrag = () => {
  isDragging.value = false
}

const closePreview = () => {
  showPreview.value = false
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = ''
  selectedFile.value = null
  resetPosition()
}

const handleImageError = (e) => {
  console.warn('Avatar failed to load:', e.target.src)
  imageLoadError.value = true
}

const getCroppedBlob = () => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    // Set canvas size to desired output size (e.g., 200x200)
    canvas.width = 200
    canvas.height = 200
    
    // Draw background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    const img = previewImage.value
    if (!img) return resolve(null)
    
    // Save context
    ctx.save()
    
    // Move to center
    ctx.translate(canvas.width / 2, canvas.height / 2)
    
    // Apply transforms
    ctx.translate(position.value.x, position.value.y)
    ctx.scale(scale.value, scale.value)
    
    // Draw image centered using its actual displayed size
    // We assume the preview-img CSS ensures it fits within the container while maintaining aspect ratio
    // The container is 200x200.
    
    // We want to draw it exactly as it appears on screen (relative to the 200x200 container)
    // Since we removed object-fit: cover, the img element might be smaller than 200x200 if we use max-width/height
    
    ctx.drawImage(
      img, 
      -img.offsetWidth / 2, 
      -img.offsetHeight / 2, 
      img.offsetWidth, 
      img.offsetHeight
    )
    
    ctx.restore()
    
    canvas.toBlob((blob) => {
      resolve(blob)
    }, 'image/jpeg', 0.9)
  })
}

const saveAvatar = async () => {
  if (!selectedFile.value) return
  
  isUploading.value = true
  
  try {
    // Get cropped image
    const croppedBlob = await getCroppedBlob()
    if (!croppedBlob) throw new Error('Failed to crop image')

    // Create FormData
    const formData = new FormData()
    formData.append('avatar', croppedBlob, 'avatar.jpg')
    
    // 获取认证token
    const token = localStorage.getItem('token')
    if (!token) {
      throw new Error('未找到认证令牌')
    }
    
    // 上传头像
    const response = await fetch('/api/auth/upload-avatar', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    
    if (response.ok) {
      const result = await response.json()
      if (result.success) {
        // 保存头像URL到本地存储
        localStorage.setItem('userAvatar', result.data.avatarUrl)
        
        // 触发父组件更新
        emit('avatar-updated', result.data.avatarUrl)
        
        // 关闭预览
        closePreview()
        
        // 显示成功消息
        alert('头像更新成功！')
      } else {
        throw new Error(result.message || '上传失败')
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    console.error('上传头像失败:', error)
    alert('上传头像失败: ' + error.message)
  } finally {
    isUploading.value = false
  }
}
</script>

<style scoped>
.avatar-upload {
  position: relative;
}

.avatar-container {
  cursor: pointer;
  position: relative;
  display: inline-block;
}

.avatar-display {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  transition: all 0.3s ease;
}

.avatar-display:hover {
  transform: scale(1.05);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #007AFF, #5856D6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  font-size: 10px;
  gap: 2px;
}

.avatar-display:hover .avatar-overlay {
  opacity: 1;
}

.avatar-overlay svg {
  width: 12px;
  height: 12px;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 85vh; /* Reduce max height */
  overflow-y: auto; /* Allow scrolling if needed */
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  margin-top: 5vh; /* Push down slightly */
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e5e7;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
}

.close-btn {
  background: none;
  border: none;
  color: #86868b;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #1d1d1f;
}

.modal-body {
  padding: 24px;
}

.preview-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.preview-avatar {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #e5e5e7;
  position: relative;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  /* transition: transform 0.3s ease; Remove transition to make drag responsive */
}

.preview-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.zoom-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.control-btn {
  background: #f8f9fa;
  border: 1px solid #e5e5e7;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #1d1d1f;
}

.control-btn:hover:not(:disabled) {
  background: #e5e5e7;
  border-color: #d1d1d6;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zoom-level {
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
  min-width: 50px;
  text-align: center;
}

.position-controls {
  display: flex;
  justify-content: center;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e5e5e7;
  background: #f8f9fa;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: #e5e5e7;
  color: #1d1d1f;
}

.btn-secondary:hover {
  background: #d1d1d6;
}

.btn-primary {
  background: #007AFF;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056CC;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    margin: 20px;
  }
  
  .preview-avatar {
    width: 150px;
    height: 150px;
  }
  
  .modal-body {
    padding: 16px;
  }
  
  .modal-footer {
    padding: 16px;
  }
}
</style>
