<template>
  <div class="register-page">
    <div class="register-container">
      <!-- 品牌标识 -->
      <div class="brand-header">
        <h1 class="brand-title">Smart Warehouse</h1>
        <p class="brand-subtitle">智能仓库管理系统</p>
      </div>

      <!-- 主标题 -->
      <h2 class="welcome-title">Create your account</h2>
      <p class="welcome-subtitle">创建您的账户</p>

      <!-- 注册表单 -->
      <form @submit.prevent="handleRegister" class="register-form">
        <div class="form-group">
          <input 
            id="username" 
            v-model="username" 
            type="text" 
            placeholder="Username"
            required 
            :disabled="loading"
            class="form-input"
          />
        </div>
        
        <div class="form-group">
          <input 
            id="email" 
            v-model="email" 
            type="email" 
            placeholder="Email address"
            required 
            :disabled="loading"
            class="form-input"
          />
        </div>
        
        <div class="form-group">
          <input 
            id="password" 
            v-model="password" 
            type="password" 
            placeholder="Password (min 6 characters)"
            required 
            minlength="6"
            :disabled="loading"
            class="form-input"
          />
        </div>
        
        <div class="form-group">
          <input 
            id="confirmPassword" 
            v-model="confirmPassword" 
            type="password" 
            placeholder="Confirm password"
            required 
            :disabled="loading"
            class="form-input"
          />
          <div v-if="passwordMismatch" class="password-error">
            Passwords do not match
          </div>
        </div>
        
        <button type="submit" class="continue-btn" :disabled="loading || passwordMismatch">
          {{ loading ? 'Creating account...' : 'Create account' }}
        </button>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
        
        <div v-if="success" class="success-message">
          {{ success }}
        </div>
      </form>

      <!-- 登录链接 -->
      <div class="signin-section">
        <p class="signin-text">
          Already have an account? 
          <router-link to="/" class="signin-link">Sign in</router-link>
        </p>
      </div>

      <!-- 分隔线 -->
      <div class="divider">
        <span class="divider-text">OR</span>
      </div>

      <!-- 系统特色 -->
      <div class="features-section">
        <h3 class="features-title">🎯 System Features</h3>
        <div class="features-grid">
          <div class="feature-item">
            <span class="feature-icon">📱</span>
            <span class="feature-text">Scan & Manage</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📦</span>
            <span class="feature-text">Smart Inventory</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🏷️</span>
            <span class="feature-text">Custom Labels</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📊</span>
            <span class="feature-text">Real-time Data</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🤖</span>
            <span class="feature-text">AI Analytics</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

export default {
  name: 'UserRegister',
  setup() {
    const username = ref('')
    const email = ref('')
    const password = ref('')
    const confirmPassword = ref('')
    const error = ref('')
    const success = ref('')
    const loading = ref(false)
    const router = useRouter()

    // 计算属性：检查密码是否匹配
    const passwordMismatch = computed(() => {
      return password.value && confirmPassword.value && password.value !== confirmPassword.value
    })

    const handleRegister = async () => {
      if (loading.value) return
      
      // 验证密码
      if (password.value !== confirmPassword.value) {
        error.value = '两次输入的密码不一致'
        return
      }
      
      if (password.value.length < 6) {
        error.value = '密码长度至少6位'
        return
      }
      
      error.value = ''
      success.value = ''
      loading.value = true
      
      try {
        await axios.post('http://localhost:3000/api/auth/register', {
          username: username.value,
          email: email.value,
          password: password.value
        })
        
        success.value = '注册成功！即将跳转到登录页面...'
        
        // 延迟跳转
        setTimeout(() => {
          router.push('/')
        }, 2000)
        
      } catch (e) {
        if (e.response?.status === 400) {
          if (e.response.data.message.includes('邮箱已注册')) {
            error.value = '该邮箱已被注册，请使用其他邮箱或直接登录'
          } else {
            error.value = e.response.data.message
          }
        } else if (e.code === 'NETWORK_ERROR') {
          error.value = '网络连接失败，请检查后端服务是否启动'
        } else {
          error.value = e.response?.data?.message || '注册失败，请重试'
        }
      } finally {
        loading.value = false
      }
    }

    return {
      username,
      email,
      password,
      confirmPassword,
      error,
      success,
      loading,
      passwordMismatch,
      handleRegister
    }
  }
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.register-container {
  width: 100%;
  max-width: 450px;
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

.register-form {
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 16px;
}

.form-input {
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

.form-input:focus {
  outline: none;
  border-color: #000000;
  box-shadow: 0 0 0 1px #000000;
}

.form-input:disabled {
  background-color: #f9fafb;
  cursor: not-allowed;
  opacity: 0.6;
}

.form-input::placeholder {
  color: #9ca3af;
}

.password-error {
  color: #dc2626;
  font-size: 0.8rem;
  margin-top: 5px;
  text-align: left;
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

.success-message {
  background: #f0fdf4;
  color: #166534;
  padding: 12px;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 0.875rem;
  border: 1px solid #bbf7d0;
}

.signin-section {
  margin-bottom: 24px;
}

.signin-text {
  color: #6b7280;
  margin: 0;
  font-size: 0.875rem;
}

.signin-link {
  color: #000000;
  text-decoration: none;
  font-weight: 600;
}

.signin-link:hover {
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

.features-section {
  margin-bottom: 32px;
}

.features-title {
  color: #000000;
  margin: 0 0 20px 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;
}

.feature-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.feature-icon {
  font-size: 1.5rem;
  margin-bottom: 8px;
}

.feature-text {
  font-size: 0.8rem;
  color: #374151;
  font-weight: 500;
  text-align: center;
}

@media (max-width: 480px) {
  .register-container {
    padding: 0 16px;
  }
  
  .brand-title {
    font-size: 2rem;
  }
  
  .welcome-title {
    font-size: 1.75rem;
  }
  
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
}
</style>