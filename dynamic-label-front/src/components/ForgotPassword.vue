<template>
  <div class="forgot-page">
    <div class="forgot-container">
      <h1 class="title">Reset Password</h1>
      <p class="subtitle">Enter your account email and a new password.</p>

      <form @submit.prevent="handleReset" class="form">
        <input
          v-model="email"
          type="email"
          placeholder="Email address"
          required
          :disabled="loading"
          class="input"
        />
        <input
          v-model="newPassword"
          type="password"
          placeholder="New password (min 6 characters)"
          minlength="6"
          required
          :disabled="loading"
          class="input"
        />
        <input
          v-model="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          required
          :disabled="loading"
          class="input"
        />

        <div v-if="passwordMismatch" class="error">Passwords do not match</div>
        <div v-if="error" class="error">{{ error }}</div>
        <div v-if="success" class="success">{{ success }}</div>

        <button type="submit" class="btn" :disabled="loading || passwordMismatch">
          {{ loading ? 'Resetting...' : 'Reset Password' }}
        </button>
      </form>

      <router-link to="/login" class="back-link">Back to Sign In</router-link>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import axios from 'axios'

const email = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

const passwordMismatch = computed(() => {
  return newPassword.value && confirmPassword.value && newPassword.value !== confirmPassword.value
})

const handleReset = async () => {
  if (loading.value) return
  if (passwordMismatch.value) return

  error.value = ''
  success.value = ''
  loading.value = true

  try {
    await axios.post('/api/auth/forgot-password', {
      email: email.value,
      newPassword: newPassword.value
    })
    success.value = 'Password reset successful. Please sign in.'
    email.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e) {
    error.value = e.response?.data?.message || 'Password reset failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.forgot-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.forgot-container { width: 100%; max-width: 420px; }
.title { margin: 0 0 8px; }
.subtitle { color: #6b7280; margin: 0 0 20px; }
.form { display: flex; flex-direction: column; gap: 12px; }
.input { padding: 14px; border: 1px solid #d1d5db; border-radius: 10px; }
.btn { margin-top: 6px; padding: 14px; border: none; border-radius: 10px; background: #000; color: #fff; font-weight: 600; }
.btn:disabled { opacity: 0.6; }
.error { color: #dc2626; font-size: 13px; }
.success { color: #166534; font-size: 13px; }
.back-link { display: inline-block; margin-top: 16px; color: #374151; }
</style>
