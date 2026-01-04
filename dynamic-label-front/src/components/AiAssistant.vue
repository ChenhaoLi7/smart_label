<template>
  <div class="ai-assistant">
    <!-- 顶部导航栏 -->
    <div class="nav-header">
      <div class="nav-content">
        <div class="nav-left">
          <button @click="goBack" class="back-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="logo">
            <div class="logo-icon">🤖</div>
            <span class="logo-text">AI智能助手</span>
          </div>
        </div>
        <div class="nav-right">
          <span class="status-badge" :class="{ 'connected': isConnected }">
            {{ isConnected ? '已连接' : '未配置' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 主聊天区域 -->
    <div class="chat-container" ref="chatContainer">
      <div class="welcome-message" v-if="messages.length === 0">
        <div class="bot-avatar large">🤖</div>
        <h2>你好！我是您的智能库存助手</h2>
        <p>您可以问我任何关于库存、商品或订单的问题。例如：</p>
        <div class="suggestion-grid">
          <button v-for="s in suggestions" :key="s" @click="useSuggestion(s)" class="suggestion-chip">
            {{ s }}
          </button>
        </div>
      </div>

      <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
        <div class="message-meta">
          <div class="bot-avatar" v-if="msg.role === 'assistant'">🤖</div>
          <div class="user-avatar" v-else>👤</div>
        </div>
        <div class="message-content">
          <div class="text">{{ msg.content }}</div>
          
          <!-- SQL 预览 -->
          <div v-if="msg.sql" class="sql-preview">
            <div class="sql-header">
              <span>生成的 SQL</span>
              <button @click="copySql(msg.sql)" class="copy-btn">复制</button>
            </div>
            <code>{{ msg.sql }}</code>
          </div>

          <!-- 数据表格 -->
          <div v-if="msg.data && msg.data.length > 0" class="data-result">
            <div class="result-header">
              <span>查询结果 ({{ msg.data.length }} 条)</span>
            </div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th v-for="key in Object.keys(msg.data[0])" :key="key">{{ key }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rIndex) in msg.data" :key="rIndex">
                    <td v-for="key in Object.keys(row)" :key="key">{{ row[key] }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else-if="msg.data && msg.data.length === 0" class="no-data">
            未找到匹配的数据
          </div>
        </div>
      </div>

      <div v-if="loading" class="message assistant loading">
        <div class="bot-avatar">🤖</div>
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-area">
      <div class="input-wrapper">
        <textarea 
          v-model="userInput" 
          @keydown.enter.prevent="sendMessage"
          placeholder="输入您的指令，例如：查询库存最少的前5个商品..."
          rows="1"
          ref="inputField"
        ></textarea>
        <button @click="sendMessage" :disabled="!userInput.trim() || loading" class="send-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
      <p class="disclaimer">AI 可能会产生错误，请核对重要数据。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const userInput = ref('')
const loading = ref(false)
const isConnected = ref(true)
const chatContainer = ref(null)
const inputField = ref(null)
const messages = ref([])

const suggestions = [
  '查看所有状态为 low_stock 的商品',
  '最近一周的交易记录有哪些',
  '库存总价值是多少',
  '哪个分类的商品最多',
  '显示所有操作员'
]

const goBack = () => router.back()

const useSuggestion = (s) => {
  userInput.value = s
  sendMessage()
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

const copySql = (sql) => {
  navigator.clipboard.writeText(sql)
  alert('SQL 已复制到剪贴板')
}

const sendMessage = async () => {
  if (!userInput.value.trim() || loading.value) return

  const userQuery = userInput.value
  messages.value.push({
    role: 'user',
    content: userQuery
  })
  
  userInput.value = ''
  loading.value = true
  await scrollToBottom()

  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/ai/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ prompt: userQuery })
    })

    const result = await response.json()

    if (response.ok) {
      messages.value.push({
        role: 'assistant',
        content: `我为您查询到了相关数据。`,
        sql: result.sql,
        data: result.data
      })
    } else {
      messages.value.push({
        role: 'assistant',
        content: `抱歉，处理您的请求时出错了：${result.message || '未知错误'}`
      })
    }
  } catch (error) {
    messages.value.push({
      role: 'assistant',
      content: `由于网络问题，查询失败。请确保后端服务正常运行。`
    })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

onMounted(() => {
  inputField.value?.focus()
})
</script>

<style scoped>
.ai-assistant {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
}

/* Nav Header */
.nav-header {
  height: 64px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  z-index: 10;
}

.nav-content {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background 0.2s;
}

.back-btn:hover {
  background: rgba(0,0,0,0.05);
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon { font-size: 24px; }
.logo-text { font-weight: 600; font-size: 18px; }

.status-badge {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(0,0,0,0.05);
  color: var(--text-secondary);
}

.status-badge.connected {
  background: rgba(52, 199, 89, 0.1);
  color: #34c759;
}

/* Chat Area */
.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
}

.welcome-message {
  text-align: center;
  padding: 60px 20px;
  opacity: 0.9;
}

.bot-avatar.large {
  font-size: 64px;
  margin-bottom: 20px;
}

.suggestion-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 24px;
}

.suggestion-chip {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  padding: 10px 16px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-primary);
}

.suggestion-chip:hover {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: white;
}

/* Messages */
.message {
  display: flex;
  gap: 12px;
  max-width: 90%;
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.bot-avatar, .user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--glass-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.message-content {
  background: var(--glass-bg);
  padding: 12px 16px;
  border-radius: 18px;
  border: 1px solid var(--glass-border);
}

.message.user .message-content {
  background: var(--accent-blue);
  color: white;
  border-bottom-right-radius: 4px;
}

.message.assistant .message-content {
  border-bottom-left-radius: 4px;
}

/* SQL Preview */
.sql-preview {
  margin-top: 12px;
  background: rgba(0,0,0,0.8);
  border-radius: 8px;
  overflow: hidden;
  font-size: 13px;
}

.sql-header {
  padding: 6px 12px;
  background: rgba(255,255,255,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(255,255,255,0.6);
}

.copy-btn {
  background: none;
  border: none;
  color: #0A84FF;
  cursor: pointer;
  font-size: 12px;
}

.sql-preview code {
  display: block;
  padding: 12px;
  color: #fff;
  white-space: pre-wrap;
  font-family: "SF Mono", Menlo, monospace;
}

/* Data Result Table */
.data-result {
  margin-top: 12px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-primary);
}

.result-header {
  padding: 8px 12px;
  background: rgba(0,0,0,0.02);
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--glass-border);
}

.table-wrapper {
  overflow-x: auto;
  max-height: 400px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th {
  text-align: left;
  padding: 10px;
  background: rgba(0,0,0,0.03);
  position: sticky;
  top: 0;
}

td {
  padding: 10px;
  border-top: 1px solid var(--glass-border);
}

/* Input Area */
.input-area {
  padding: 20px;
  background: var(--bg-primary);
  border-top: 1px solid rgba(0,0,0,0.05);
}

.input-wrapper {
  max-width: 900px;
  margin: 0 auto;
  position: relative;
  display: flex;
  align-items: flex-end;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  padding: 8px 16px;
  transition: border-color 0.2s;
}

.input-wrapper:focus-within {
  border-color: var(--accent-blue);
}

textarea {
  flex: 1;
  background: none;
  border: none;
  color: var(--text-primary);
  padding: 10px 0;
  resize: none;
  font-family: inherit;
  font-size: 15px;
  outline: none;
  max-height: 200px;
}

.send-btn {
  background: var(--accent-blue);
  color: white;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: 10px;
  margin-bottom: 2px;
  transition: opacity 0.2s;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.disclaimer {
  text-align: center;
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 10px;
}

/* Loading Animation */
.loading-dots {
  display: flex;
  gap: 4px;
  padding: 10px;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

[data-theme="light"] .nav-header { background: rgba(255,255,255,0.8); }
[data-theme="dark"] .nav-header { background: rgba(0,0,0,0.8); }
</style>
