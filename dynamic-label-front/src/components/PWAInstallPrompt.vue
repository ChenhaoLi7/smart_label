<template>
  <div v-if="showInstallPrompt" class="pwa-install-prompt">
    <div class="prompt-content">
      <div class="prompt-icon">📱</div>
      <div class="prompt-text">
        <h3>安装应用</h3>
        <p>将应用添加到主屏幕，获得更好的使用体验</p>
      </div>
      <div class="prompt-actions">
        <button @click="installApp" class="install-btn">安装</button>
        <button @click="dismissPrompt" class="dismiss-btn">稍后</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const showInstallPrompt = ref(false)
let deferredPrompt = null

onMounted(() => {
  // 检查是否已经安装
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return // 已经安装，不显示提示
  }

  // 监听 beforeinstallprompt 事件
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    
    // 检查用户是否已经拒绝过
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (!dismissed) {
      showInstallPrompt.value = true
    }
  })

  // 检查是否已经安装
  window.addEventListener('appinstalled', () => {
    console.log('PWA已安装')
    showInstallPrompt.value = false
    localStorage.setItem('pwa-installed', 'true')
  })
})

const installApp = async () => {
  if (!deferredPrompt) {
    // 如果不支持自动安装，显示手动安装说明
    showManualInstallInstructions()
    return
  }

  // 显示安装提示
  deferredPrompt.prompt()
  
  // 等待用户响应
  const { outcome } = await deferredPrompt.userChoice
  
  if (outcome === 'accepted') {
    console.log('用户接受了安装提示')
  } else {
    console.log('用户拒绝了安装提示')
  }
  
  deferredPrompt = null
  showInstallPrompt.value = false
}

const dismissPrompt = () => {
  showInstallPrompt.value = false
  localStorage.setItem('pwa-install-dismissed', 'true')
  
  // 24小时后重新显示
  setTimeout(() => {
    localStorage.removeItem('pwa-install-dismissed')
  }, 24 * 60 * 60 * 1000)
}

const showManualInstallInstructions = () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isAndroid = /Android/.test(navigator.userAgent)
  
  let message = ''
  
  if (isIOS) {
    message = 'iOS安装说明：\n1. 点击底部分享按钮\n2. 选择"添加到主屏幕"\n3. 点击"添加"'
  } else if (isAndroid) {
    message = 'Android安装说明：\n1. 点击浏览器菜单（三个点）\n2. 选择"添加到主屏幕"或"安装应用"\n3. 确认安装'
  } else {
    message = '安装说明：\n请使用浏览器的"添加到主屏幕"功能'
  }
  
  alert(message)
}
</script>

<style scoped>
.pwa-install-prompt {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  max-width: 400px;
  width: calc(100% - 40px);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateX(-50%) translateY(100px);
    opacity: 0;
  }
  to {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
}

.prompt-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 15px;
}

.prompt-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.prompt-text {
  flex: 1;
}

.prompt-text h3 {
  margin: 0 0 5px 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.prompt-text p {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.9;
}

.prompt-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.install-btn,
.dismiss-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.install-btn {
  background: white;
  color: #667eea;
}

.install-btn:hover {
  background: #f0f0f0;
  transform: translateY(-1px);
}

.dismiss-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

@media (max-width: 480px) {
  .prompt-content {
    flex-direction: column;
    text-align: center;
  }
  
  .prompt-actions {
    width: 100%;
    justify-content: stretch;
  }
  
  .install-btn,
  .dismiss-btn {
    flex: 1;
  }
}
</style>




