<template>
  <div class="login-page">
    <div class="login-container">
      <!-- 品牌标识 -->
      <div class="brand-header">
        <h1 class="brand-title">Smart Warehouse</h1>
        <p class="brand-subtitle">智能仓库管理系统</p>
      </div>

      <!-- 主标题 -->
      <h2 class="welcome-title">Welcome back</h2>
      <p class="welcome-subtitle">欢迎回来</p>

      <!-- 登录表单 -->
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <input 
            id="email" 
            v-model="email" 
            type="email" 
            placeholder="Email address"
            required 
            :disabled="loading"
            class="email-input"
          />
        </div>
        
        <div class="form-group">
          <input 
            id="password" 
            v-model="password" 
            type="password" 
            placeholder="Password"
            required 
            :disabled="loading"
            class="password-input"
          />
        </div>
        
        <button type="submit" class="continue-btn" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Continue' }}
        </button>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </form>

      <!-- 注册链接 -->
      <div class="signup-section">
        <p class="signup-text">
          Don't have an account? 
          <router-link to="/register" class="signup-link">Sign up</router-link>
        </p>
      </div>

      <!-- 分隔线 -->
      <div class="divider">
        <span class="divider-text">OR</span>
      </div>

      <!-- 演示账户 -->
      <div class="demo-section">
        <details class="demo-details">
          <summary class="demo-summary">💡 Demo Accounts</summary>
          <div class="demo-list">
            <div class="demo-account">
              <strong>Admin:</strong> admin@warehouse.com / admin123
            </div>
            <div class="demo-account">
              <strong>Test:</strong> test@warehouse.com / test123
            </div>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

export default {
  name: 'UserLogin',
  setup() {
    const email = ref('')
    const password = ref('')
    const error = ref('')
    const loading = ref(false)
    const router = useRouter()

    const handleLogin = async () => {
      if (loading.value) return
      
      error.value = ''
      loading.value = true
      
      try {
        const res = await axios.post('http://localhost:3000/api/auth/login', {
          email: email.value,
          password: password.value
        })
        
        // 存储 JWT 并跳转
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('userEmail', email.value)
        
        // 显示成功消息
        error.value = '登录成功！正在跳转...'
        
        // 延迟跳转，让用户看到成功消息
        setTimeout(() => {
          router.push('/dashboard')
        }, 1000)
        
      } catch (e) {
        if (e.response?.status === 401) {
          error.value = '邮箱或密码错误，请检查后重试'
        } else if (e.response?.status === 404) {
          error.value = '用户不存在，请先注册账户'
        } else if (e.code === 'NETWORK_ERROR') {
          error.value = '网络连接失败，请检查后端服务是否启动'
        } else {
          error.value = e.response?.data?.message || '登录失败，请重试'
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
      handleLogin
    }
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.login-container {
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.brand-header {
  margin-bottom: 40px;
}

.brand-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #000000;
  margin: 0 0 8px 0;
  letter-spacing: -0.025em;
}

.brand-subtitle {
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
  font-weight: 400;
}

.welcome-title {
  font-size: 2rem;
  font-weight: 700;
  color: #000000;
  margin: 0 0 8px 0;
  letter-spacing: -0.025em;
}

.welcome-subtitle {
  font-size: 1rem;
  color: #6b7280;
  margin: 0 0 32px 0;
  font-weight: 400;
}

.login-form {
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 16px;
}

.email-input,
.password-input {
  width: 100%;
  padding: 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
  box-sizing: border-box;
  background: #ffffff;
  color: #000000;
}

.email-input:focus,
.password-input:focus {
  outline: none;
  border-color: #000000;
  box-shadow: 0 0 0 1px #000000;
}

.email-input:disabled,
.password-input:disabled {
  background-color: #f9fafb;
  cursor: not-allowed;
  opacity: 0.6;
}

.email-input::placeholder,
.password-input::placeholder {
  color: #9ca3af;
}

.continue-btn {
  width: 100%;
  padding: 16px;
  background: #000000;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.continue-btn:hover:not(:disabled) {
  background: #1f2937;
}

.continue-btn:disabled {
  background: #6b7280;
  cursor: not-allowed;
}

.error-message {
  background: #fef2f2;
  color: #dc2626;
  padding: 12px;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 0.875rem;
  border: 1px solid #fecaca;
}

.signup-section {
  margin-bottom: 24px;
}

.signup-text {
  color: #6b7280;
  margin: 0;
  font-size: 0.875rem;
}

.signup-link {
  color: #000000;
  text-decoration: none;
  font-weight: 600;
}

.signup-link:hover {
  text-decoration: underline;
}

.divider {
  position: relative;
  margin: 24px 0;
  text-align: center;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #e5e7eb;
}

.divider-text {
  background: #ffffff;
  padding: 0 16px;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
}

.demo-section {
  margin-bottom: 32px;
}

.demo-details {
  text-align: left;
}

.demo-summary {
  color: #000000;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
  user-select: none;
  text-align: center;
  padding: 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.demo-summary:hover {
  background: #f3f4f6;
}

.demo-list {
  margin-top: 12px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 0.8rem;
  border: 1px solid #e5e7eb;
}

.demo-account {
  margin-bottom: 8px;
  color: #374151;
  line-height: 1.4;
}

.demo-account:last-child {
  margin-bottom: 0;
}

.demo-account strong {
  color: #000000;
}

@media (max-width: 480px) {
  .login-container {
    padding: 0 16px;
  }
  
  .brand-title {
    font-size: 2rem;
  }
  
  .welcome-title {
    font-size: 1.75rem;
  }
}
</style>