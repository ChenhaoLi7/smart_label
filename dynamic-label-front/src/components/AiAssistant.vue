<template>
  <div class="copilot-page">
    <header class="topbar glass-panel">
      <div class="topbar-left">
        <button @click="goBack" class="back-btn" aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <p class="eyebrow">Warehouse Copilot</p>
          <h1>AI Assistant</h1>
        </div>
      </div>
      <div class="topbar-right">
        <span class="mode-pill">Read-only Agent</span>
        <span :class="['status-pill', isConnected ? 'connected' : 'offline']">
          {{ isConnected ? 'Connected' : 'Offline' }}
        </span>
      </div>
    </header>

    <main class="page-body">
      <section class="hero-panel glass-panel">
        <div class="hero-copy">
          <p class="eyebrow">Operations Copilot</p>
          <h2>Ask what matters, inspect the signal, and decide the next move with confidence.</h2>
          <p class="hero-text">
            This assistant now runs in a safe, read-only agent mode. It plans the request, calls approved warehouse tools,
            and returns structured answers instead of raw SQL.
          </p>
          <div class="chip-row">
            <button
              v-for="prompt in suggestionPrompts"
              :key="prompt"
              @click="useSuggestion(prompt)"
              class="prompt-chip"
            >
              {{ prompt }}
            </button>
          </div>
        </div>
        <div class="hero-metrics">
          <article v-for="metric in contextMetrics" :key="metric.label" :class="['metric-card', metric.tone]">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
          </article>
        </div>
      </section>

      <div class="workspace-grid">
        <section class="conversation-panel glass-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Conversation</p>
              <h3>Planning, tools, and results</h3>
            </div>
            <p class="panel-note">The assistant can inspect stock health, lots, bins, recent activity, and suggestions.</p>
          </div>

          <div class="thread" ref="chatContainer">
            <div v-if="messages.length === 0" class="empty-thread">
              <div class="empty-orb">◎</div>
              <h4>Start with a warehouse question.</h4>
              <p>Try a quick stock overview, an expiry review, a bin lookup, or a suggestion summary.</p>
            </div>

            <article v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
              <div class="avatar">{{ msg.role === 'assistant' ? 'AI' : 'You' }}</div>
              <div class="message-card">
                <div class="message-text">{{ msg.content }}</div>

                <div v-if="msg.plan?.length" class="section-card">
                  <div class="section-head">
                    <p class="eyebrow">Plan</p>
                    <span>{{ msg.intentLabel || 'Agent plan' }}</span>
                  </div>
                  <ol class="plan-list">
                    <li v-for="step in msg.plan" :key="step">{{ step }}</li>
                  </ol>
                </div>

                <div v-if="msg.toolCalls?.length" class="section-card">
                  <div class="section-head">
                    <p class="eyebrow">Tool Calls</p>
                    <span>{{ msg.toolCalls.length }} completed</span>
                  </div>
                  <div class="tool-grid">
                    <article v-for="tool in msg.toolCalls" :key="tool.name" class="tool-card">
                      <strong>{{ tool.label }}</strong>
                      <p>{{ tool.summary }}</p>
                    </article>
                  </div>
                </div>

                <div v-if="msg.metrics?.length" class="metric-grid">
                  <article v-for="metric in msg.metrics" :key="`${msg.content}-${metric.label}`" :class="['metric-card', metric.tone]">
                    <span>{{ metric.label }}</span>
                    <strong>{{ metric.value }}</strong>
                  </article>
                </div>

                <div v-for="table in msg.tables || []" :key="table.title" class="section-card">
                  <div class="section-head">
                    <p class="eyebrow">Result</p>
                    <span>{{ table.title }}</span>
                  </div>
                  <div class="table-shell">
                    <table>
                      <thead>
                        <tr>
                          <th v-for="column in table.columns" :key="column">{{ column }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!table.rows?.length">
                          <td :colspan="table.columns.length">No rows returned</td>
                        </tr>
                        <tr v-for="(row, rowIndex) in table.rows" :key="`${table.title}-${rowIndex}`">
                          <td v-for="(cell, cellIndex) in row" :key="`${table.title}-${rowIndex}-${cellIndex}`">{{ cell }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div v-if="msg.nextActions?.length" class="section-card">
                  <div class="section-head">
                    <p class="eyebrow">Next Actions</p>
                    <span>Suggested follow-up</span>
                  </div>
                  <div class="action-list">
                    <div v-for="action in msg.nextActions" :key="action" class="action-item">
                      {{ action }}
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article v-if="loading" class="message assistant">
              <div class="avatar">AI</div>
              <div class="message-card loading-card">
                <span></span><span></span><span></span>
              </div>
            </article>
          </div>

          <div class="composer">
            <textarea
              ref="inputField"
              v-model="userInput"
              class="composer-input"
              placeholder="Ask for an overview, low-stock review, expiry watch, bin status, or item lookup..."
              rows="1"
              @input="autoResize"
              @keydown.enter.exact.prevent="sendMessage"
            ></textarea>
            <button @click="sendMessage" :disabled="!userInput.trim() || loading" class="send-btn">
              Send
            </button>
          </div>
          <p class="composer-note">Read-only mode: the agent can inspect data and recommend actions, but it will not change stock directly.</p>
        </section>

        <aside class="context-panel">
          <section class="context-card glass-panel">
            <p class="eyebrow">Agent Mode</p>
            <h3>Safe warehouse reasoning</h3>
            <p>
              The assistant now works as a tool-driven copilot. It builds a short plan, calls approved warehouse tools,
              and returns structured summaries instead of raw SQL.
            </p>
          </section>

          <section class="context-card glass-panel">
            <p class="eyebrow">Capabilities</p>
            <div class="capability-list">
              <article v-for="capability in capabilities" :key="capability.name" class="capability-item">
                <strong>{{ capability.name }}</strong>
                <p>{{ capability.description }}</p>
              </article>
            </div>
          </section>

          <section class="context-card glass-panel">
            <p class="eyebrow">Quick Start</p>
            <div class="action-list">
              <button
                v-for="prompt in suggestionPrompts"
                :key="`side-${prompt}`"
                class="action-item action-button"
                @click="useSuggestion(prompt)"
              >
                {{ prompt }}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const userInput = ref('')
const loading = ref(false)
const isConnected = ref(false)
const chatContainer = ref(null)
const inputField = ref(null)
const messages = ref([])
const capabilities = ref([])
const contextMetrics = ref([
  { label: 'Tracked Items', value: '—', tone: 'blue' },
  { label: 'Live Lots', value: '—', tone: 'violet' },
  { label: 'Active Bins', value: '—', tone: 'teal' },
  { label: 'Utilization', value: '—', tone: 'slate' }
])

const suggestionPrompts = [
  'Give me a warehouse overview.',
  'Show me low-stock items.',
  'Which lots expire soon?',
  'Review recent warehouse activity.',
  'Check refrigerator bin status.'
]

const intentLabels = {
  overview: 'Overview',
  low_stock_review: 'Low-stock review',
  expiry_watch: 'Expiry watch',
  recent_activity: 'Recent activity',
  item_lookup: 'Item lookup',
  bin_lookup: 'Bin review',
  suggestion_watch: 'Suggestion watch'
}

const goBack = () => router.back()

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }
}

const autoResize = (event) => {
  const target = event?.target || inputField.value
  if (!target) return
  target.style.height = 'auto'
  target.style.height = `${Math.min(target.scrollHeight, 180)}px`
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

const useSuggestion = (prompt) => {
  userInput.value = prompt
  nextTick(() => {
    autoResize()
    sendMessage()
  })
}

const loadContext = async () => {
  try {
    const response = await fetch('/api/ai/context', { headers: getAuthHeaders() })
    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to load agent context')
    }

    isConnected.value = true
    capabilities.value = result.capabilities || []
    contextMetrics.value = result.metrics || contextMetrics.value
  } catch (error) {
    console.error('Failed to load AI context:', error)
    isConnected.value = false
    capabilities.value = [
      {
        name: 'Connection issue',
        description: 'The copilot could not load its live warehouse context. Check the backend service and token.'
      }
    ]
  }
}

const pushAssistantMessage = (payload) => {
  messages.value.push({
    role: 'assistant',
    content: payload.answer || payload.message || 'The agent completed the request.',
    plan: payload.plan || [],
    toolCalls: payload.toolCalls || [],
    metrics: payload.metrics || [],
    tables: payload.tables || [],
    nextActions: payload.nextActions || [],
    intentLabel: intentLabels[payload.intent] || 'Agent response'
  })
}

const sendMessage = async () => {
  const prompt = userInput.value.trim()
  if (!prompt || loading.value) return

  messages.value.push({
    role: 'user',
    content: prompt
  })

  userInput.value = ''
  loading.value = true
  if (inputField.value) {
    inputField.value.style.height = 'auto'
  }
  await scrollToBottom()

  try {
    const response = await fetch('/api/ai/query', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ prompt })
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'The agent could not complete this request.')
    }

    pushAssistantMessage(result)
  } catch (error) {
    pushAssistantMessage({
      message: error.message || 'The agent is temporarily unavailable.',
      plan: [],
      toolCalls: [],
      metrics: [],
      tables: [],
      nextActions: ['Check the backend service and try again in a moment.']
    })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

onMounted(async () => {
  await loadContext()
  inputField.value?.focus()
})
</script>

<style scoped>
.copilot-page {
  min-height: 100vh;
  padding: 20px;
  background:
    radial-gradient(circle at top left, rgba(191, 219, 254, 0.72), transparent 32%),
    radial-gradient(circle at top right, rgba(167, 243, 208, 0.56), transparent 28%),
    linear-gradient(180deg, #f6f8fc 0%, #eef2f8 100%);
  color: #0f172a;
}

.glass-panel {
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.08);
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  padding: 18px 22px;
  border-radius: 28px;
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.back-btn {
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.04);
  color: #0f172a;
  cursor: pointer;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #64748b;
}

.topbar h1,
.hero-copy h2,
.panel-head h3,
.context-card h3 {
  margin: 0;
  letter-spacing: -0.04em;
}

.mode-pill,
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.mode-pill {
  background: rgba(15, 23, 42, 0.06);
}

.status-pill.connected {
  background: rgba(52, 211, 153, 0.14);
  color: #047857;
}

.status-pill.offline {
  background: rgba(248, 113, 113, 0.14);
  color: #b91c1c;
}

.page-body {
  margin-top: 20px;
  display: grid;
  gap: 20px;
}

.hero-panel {
  display: grid;
  grid-template-columns: 1.3fr 0.9fr;
  gap: 20px;
  padding: 28px;
  border-radius: 34px;
}

.hero-copy {
  display: grid;
  gap: 16px;
}

.hero-text {
  margin: 0;
  max-width: 700px;
  color: #475569;
  line-height: 1.7;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.prompt-chip {
  padding: 11px 14px;
  border-radius: 999px;
  border: 1px solid rgba(59, 130, 246, 0.14);
  background: rgba(255, 255, 255, 0.84);
  color: #0f172a;
  cursor: pointer;
}

.hero-metrics,
.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  display: grid;
  gap: 8px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.78);
}

.metric-card span {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
}

.metric-card strong {
  font-size: 28px;
  letter-spacing: -0.05em;
}

.metric-card.blue { background: linear-gradient(180deg, rgba(219, 234, 254, 0.74), rgba(255, 255, 255, 0.88)); }
.metric-card.violet { background: linear-gradient(180deg, rgba(237, 233, 254, 0.74), rgba(255, 255, 255, 0.88)); }
.metric-card.teal { background: linear-gradient(180deg, rgba(204, 251, 241, 0.74), rgba(255, 255, 255, 0.88)); }
.metric-card.slate { background: linear-gradient(180deg, rgba(226, 232, 240, 0.74), rgba(255, 255, 255, 0.88)); }
.metric-card.amber { background: linear-gradient(180deg, rgba(254, 243, 199, 0.74), rgba(255, 255, 255, 0.88)); }
.metric-card.mint { background: linear-gradient(180deg, rgba(220, 252, 231, 0.74), rgba(255, 255, 255, 0.88)); }

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.7fr);
  gap: 20px;
  align-items: start;
}

.conversation-panel,
.context-card {
  border-radius: 30px;
}

.conversation-panel {
  padding: 24px;
  display: grid;
  gap: 18px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.panel-note,
.context-card p,
.capability-item p {
  margin: 0;
  color: #475569;
  line-height: 1.6;
}

.thread {
  max-height: 62vh;
  overflow-y: auto;
  display: grid;
  gap: 16px;
  padding-right: 4px;
}

.empty-thread {
  display: grid;
  place-items: center;
  text-align: center;
  gap: 10px;
  padding: 48px 20px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.48);
}

.empty-orb {
  width: 72px;
  height: 72px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, rgba(191, 219, 254, 0.92), rgba(255, 255, 255, 0.96));
  font-size: 28px;
}

.message {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.avatar {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.08);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.message.user .avatar {
  background: rgba(37, 99, 235, 0.14);
  color: #1d4ed8;
}

.message.assistant .avatar {
  background: rgba(15, 23, 42, 0.1);
}

.message-card {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.message.user .message-card {
  background: linear-gradient(180deg, rgba(219, 234, 254, 0.88), rgba(255, 255, 255, 0.92));
}

.message-text {
  white-space: pre-wrap;
  line-height: 1.7;
}

.section-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.92);
}

.section-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.section-head span {
  font-size: 12px;
  color: #475569;
}

.plan-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
  color: #0f172a;
}

.tool-grid,
.capability-list {
  display: grid;
  gap: 12px;
}

.tool-card,
.capability-item {
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.tool-card strong,
.capability-item strong {
  display: block;
  margin-bottom: 6px;
}

.table-shell {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 12px 10px;
  text-align: left;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  font-size: 14px;
}

th {
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
}

.action-list {
  display: grid;
  gap: 10px;
}

.action-item {
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(15, 23, 42, 0.05);
  line-height: 1.6;
}

.action-button {
  text-align: left;
  cursor: pointer;
  color: #0f172a;
}

.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.composer-input {
  min-height: 58px;
  max-height: 180px;
  resize: none;
  padding: 16px 18px;
  border-radius: 22px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.9);
  font: inherit;
  color: #0f172a;
}

.composer-input:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.32);
  box-shadow: 0 0 0 4px rgba(191, 219, 254, 0.38);
}

.send-btn {
  height: 58px;
  padding: 0 22px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(180deg, #0f172a, #1e293b);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.composer-note {
  margin: -4px 0 0;
  color: #64748b;
  font-size: 12px;
}

.context-panel {
  display: grid;
  gap: 16px;
}

.context-card {
  padding: 22px;
}

.loading-card {
  display: flex;
  gap: 8px;
  align-items: center;
}

.loading-card span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #94a3b8;
  animation: pulse 1.1s infinite ease-in-out;
}

.loading-card span:nth-child(2) {
  animation-delay: 0.15s;
}

.loading-card span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes pulse {
  0%, 80%, 100% { opacity: 0.35; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

@media (max-width: 1100px) {
  .hero-panel,
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .copilot-page {
    padding: 14px;
  }

  .topbar,
  .hero-panel,
  .conversation-panel,
  .context-card {
    border-radius: 24px;
  }

  .topbar,
  .panel-head,
  .topbar-right {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-metrics,
  .metric-grid {
    grid-template-columns: 1fr 1fr;
  }

  .message {
    grid-template-columns: 1fr;
  }

  .avatar {
    width: 38px;
    height: 38px;
  }

  .composer {
    grid-template-columns: 1fr;
  }

  .send-btn {
    width: 100%;
  }
}
</style>
