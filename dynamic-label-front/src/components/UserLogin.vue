<template>
  <div class="login-page-wrapper">
    <!-- 环境光效背景 -->
    <div class="ambient-light light-1"></div>
    <div class="ambient-light light-2"></div>
    <div class="ambient-light light-3"></div>

    <!-- 磨砂玻璃面板 -->
    <div class="glass-panel">
      <!-- 品牌标识 -->
      <div class="brand-section">
        <div class="logo-icon">📦</div>
        <h1 class="brand-title">Smart Warehouse</h1>
        <!-- <p class="brand-subtitle">Vision Pro Ready</p> -->
      </div>

      <!-- 登录表单 -->
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label class="input-label">Email</label>
          <div class="input-wrapper">
            <input 
              id="email" 
              v-model="email" 
              type="email" 
              placeholder="name@example.com"
              required 
              :disabled="loading"
              class="glass-input"
            />
            <div class="input-glow"></div>
          </div>
        </div>
        
        <div class="form-group">
          <label class="input-label">Password</label>
          <div class="input-wrapper">
            <input 
              id="password" 
              v-model="password" 
              type="password" 
              placeholder="••••••••"
              required 
              :disabled="loading"
              class="glass-input"
            />
            <div class="input-glow"></div>
          </div>
        </div>
        
        <button type="submit" class="glass-button" :class="{ 'loading': loading }" :disabled="loading">
          <span v-if="!loading">Sign In</span>
          <span v-else class="spinner"></span>
        </button>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </form>

      <!-- 底部链接 -->
      <div class="footer-links">
        <router-link to="/register" class="text-link">Create Account</router-link>
        <span class="divider">•</span>
        <span class="text-link">Forgot Password</span>
      </div>

      <!-- 演示账户 (折叠式) -->
      <div class="demo-trigger" @click="showDemo = !showDemo">
        Demo Accounts {{ showDemo ? '▼' : '▶' }}
      </div>
      
      <div class="demo-accounts" :class="{ 'visible': showDemo }">
        <div class="demo-item"><span>Admin:</span> admin / admin123</div>
        <div class="demo-item"><span>LI:</span> LI / 123456</div>
        <div class="demo-item"><span>Test:</span> testuser / test123</div>
      </div>
    </div>
    
    <!-- Theme Toggle -->
    <button class="theme-toggle" @click="toggleTheme" :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
      <span v-if="isDark">☀️</span>
      <span v-else>🌙</span>
    </button>
  </div>
</template>

<script>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import SunCalc from 'suncalc'

export default {
  name: 'UserLogin',
  setup() {
    const email = ref('')
    const password = ref('')
    const error = ref('')
    const loading = ref(false)
    const showDemo = ref(false)
    const router = useRouter()
    const isDark = ref(true)

    // Theme Logic
    // Theme Logic
    const initTheme = () => {
      // 1. Default fallback logic (immediate application to prevent flash)
      const hour = new Date().getHours()
      const isNightFallback = hour >= 18 || hour < 6
      isDark.value = isNightFallback
      document.documentElement.setAttribute('data-theme', isNightFallback ? 'dark' : 'light')

      // 2. Try to get geolocation for accurate sun times
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
          try {
            const { latitude, longitude } = position.coords
            const times = SunCalc.getTimes(new Date(), latitude, longitude)
            const now = new Date()
            
            // Check if it's night time (after sunset or before sunrise)
            // Note: SunCalc returns dates for the current day
            const isNight = now >= times.sunset || now < times.sunrise
            
            console.log('📍 Location acquired:', latitude, longitude)
            console.log('☀️ Sunrise:', times.sunrise.toLocaleTimeString())
            console.log('🌙 Sunset:', times.sunset.toLocaleTimeString())
            console.log('🌗 Is Night?', isNight)

            isDark.value = isNight
            document.documentElement.setAttribute('data-theme', isNight ? 'dark' : 'light')
          } catch (e) {
            console.error('Error calculating sun times:', e)
          }
        }, (error) => {
          console.log('Geolocation denied or error, using fallback (6PM-6AM):', error.message)
        })
      }
    }

    const toggleTheme = () => {
      isDark.value = !isDark.value
      document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
    }

    // Initialize theme on mount
    initTheme()

    const handleLogin = async () => {
      if (loading.value) return
      
      error.value = ''
      loading.value = true
      
      try {
        const res = await axios.post('/api/auth/login', {
          username: email.value,
          password: password.value
        })
        
        localStorage.setItem('token', res.data.data.token)
        localStorage.setItem('username', res.data.data.user.username)
        localStorage.setItem('userEmail', res.data.data.user.email)
        localStorage.setItem('userAvatar', res.data.data.user.avatar || '')
        
        // 延迟跳转以展示动画
        setTimeout(() => {
          router.push('/dashboard')
        }, 800)
        
      } catch (e) {
        if (e.response?.status === 401) {
          error.value = 'Invalid credentials'
        } else if (e.response?.status === 404) {
          error.value = 'User not found'
        } else if (e.code === 'NETWORK_ERROR') {
          error.value = 'Network error'
        } else {
          error.value = e.response?.data?.message || 'Login failed'
        }
      } finally {
        loading.value = false
      }
    }

    return {
      email,
      password,
      error,
      loading,
      showDemo,
      handleLogin,
      isDark,
      toggleTheme
    }
  }
}
</script>

<style scoped>
/* 全局重置与字体 */
.login-page-wrapper {
  min-height: 100vh;
  width: 100%;
  background-color: var(--bg-primary);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif;
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* 环境光效 - 模拟空间感 */
.ambient-light {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.6;
  animation: float 10s infinite ease-in-out alternate;
}

.light-1 {
  top: -10%;
  left: -10%;
  width: 50vw;
  height: 50vw;
  background: radial-gradient(circle, var(--light-1), transparent 70%);
}

.light-2 {
  bottom: -10%;
  right: -10%;
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, var(--light-2), transparent 70%);
  animation-delay: -5s;
}

.light-3 {
  top: 40%;
  left: 40%;
  width: 30vw;
  height: 30vw;
  background: radial-gradient(circle, var(--light-3), transparent 70%);
  animation-duration: 15s;
}

@keyframes float {
  0% { transform: translate(0, 0); }
  100% { transform: translate(30px, 20px); }
}

/* 磨砂玻璃面板 - 核心设计 */
.glass-panel {
  width: 100%;
  max-width: 420px;
  padding: 48px 40px;
  
  /* Glassmorphism 效果 */
  background: var(--glass-bg);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid var(--glass-border);
  border-radius: 32px;
  
  /* 深度与阴影 */
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.2),
    inset 0 0 0 1px var(--glass-border);
    
  /* 空间悬浮动画 */
  transform: translateZ(0);
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s ease;
}

.glass-panel:hover {
  transform: translateY(-5px) scale(1.01);
  box-shadow: 
    0 30px 60px rgba(0, 0, 0, 0.3),
    inset 0 0 0 1px var(--glass-border);
}

/* 品牌区域 */
.brand-section {
  text-align: center;
  margin-bottom: 48px;
}

.logo-icon {
  font-size: 48px;
  margin-bottom: 16px;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
}

.brand-title {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}

.brand-subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--text-secondary);
  letter-spacing: 1px;
  text-transform: uppercase;
}

/* 表单样式 */
.form-group {
  margin-bottom: 24px;
}

.input-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  margin-left: 4px;
}

.input-wrapper {
  position: relative;
}

.glass-input {
  width: 100%;
  padding: 16px 20px;
  font-size: 16px;
  color: var(--text-primary);
  background: var(--input-bg);
  border: none;
  border-radius: 16px;
  outline: none;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.glass-input:focus {
  background: var(--input-focus-bg);
  box-shadow: 0 0 0 2px var(--glass-border);
}

.glass-input::placeholder {
  color: var(--text-tertiary);
}

/* 按钮样式 */
.glass-button {
  width: 100%;
  padding: 16px;
  margin-top: 12px;
  border: none;
  border-radius: 30px; /* Pill shape */
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  
  /* 白色磨砂质感 */
  background: var(--button-bg);
  color: var(--button-text);
  backdrop-filter: blur(10px);
  
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.glass-button:hover:not(:disabled) {
  background: var(--button-hover-bg);
  transform: scale(1.02);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
}

.glass-button:active:not(:disabled) {
  transform: scale(0.98);
}

.glass-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 底部链接 */
.footer-links {
  margin-top: 32px;
  display: flex;
  justify-content: center;
  gap: 12px;
  font-size: 14px;
}

.text-link {
  color: var(--text-secondary);
  text-decoration: none;
  cursor: pointer;
  transition: color 0.2s;
}

.text-link:hover {
  color: var(--text-primary);
  text-decoration: underline;
}

.divider {
  color: var(--text-tertiary);
}

/* 错误信息 */
.error-message {
  margin-top: 16px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 59, 48, 0.1); /* Apple Red */
  border: 1px solid rgba(255, 59, 48, 0.2);
  color: #ff453a;
  font-size: 13px;
  text-align: center;
}

/* 演示账户 */
.demo-trigger {
  margin-top: 40px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 0.2s;
}

.demo-trigger:hover {
  color: var(--text-secondary);
}

.demo-accounts {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
  background: var(--input-bg);
  border-radius: 12px;
  margin-top: 8px;
}

.demo-accounts.visible {
  max-height: 120px;
  padding: 12px;
}

.demo-item {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  font-family: monospace;
}

.demo-item span {
  color: var(--text-primary);
  font-weight: 600;
}

/* 加载动画 */
.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #000;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .glass-panel {
    max-width: 100%;
    height: 100vh;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6); /* 移动端更深色背景以保证可读性 */
  }
  
  .brand-title {
    font-size: 32px;
  }
}


/* Theme Toggle Button */
.theme-toggle {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: all 0.3s ease;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.theme-toggle:hover {
  transform: scale(1.1);
  background: var(--glass-border);
}
</style>
