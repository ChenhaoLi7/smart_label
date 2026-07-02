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
          <h1>AI 助手</h1>
        </div>
      </div>
      <div class="topbar-right">
        <span class="mode-pill">{{ llmStatus.enabled ? '本地 LLM Agent' : '只读 Agent' }}</span>
        <span :class="['status-pill', isConnected ? 'connected' : 'offline']">
          {{ isConnected ? '已连接' : '离线' }}
        </span>
      </div>
    </header>

    <main class="page-body">
      <section class="hero-panel glass-panel">
        <div class="hero-copy">
          <p class="eyebrow">Operations Copilot</p>
          <h2>问库存、查风险、看记录，让仓库状态一眼说清楚。</h2>
          <p class="hero-text">
            这个助手运行在本地 Ollama 上。它会先调用经过批准的只读仓库工具查询真实数据，
            再让模型把结果总结成可操作的建议，模型本身不会直接访问或修改数据库。
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
              <h3>分析计划、数据查询与结果</h3>
            </div>
            <p class="panel-note">可以查询库存健康、批次、Bin、近期操作记录和商品建议。</p>
          </div>

          <div class="thread" ref="chatContainer">
            <div v-if="messages.length === 0" class="empty-thread">
              <div class="empty-orb">◎</div>
              <h4>先问一个仓库问题吧。</h4>
              <p>例如库存总览、低库存、临期批次、冰箱状态或最近操作记录。</p>
            </div>

            <article v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
              <div class="avatar">{{ msg.role === 'assistant' ? 'AI' : '你' }}</div>
              <div class="message-card">
                <div class="message-text">{{ msg.content }}</div>

                <div v-if="msg.llm" :class="['llm-chip', msg.llm.used ? 'active' : 'fallback']">
                  <span>{{ msg.llm.used ? 'Ollama 回答' : '规则兜底' }}</span>
                  <strong>{{ msg.llm.model || 'safe planner' }}</strong>
                </div>

                <div v-if="msg.scopeLabel" class="scope-chip">
                  <span>上下文范围</span>
                  <strong>{{ msg.scopeLabel }}</strong>
                </div>

                <div v-if="msg.evidence?.length" class="section-card evidence-section">
                  <div class="section-head">
                    <p class="eyebrow">判断依据</p>
                    <span>{{ msg.evidence.length }} 条证据</span>
                  </div>
                  <div class="evidence-grid">
                    <article
                      v-for="item in msg.evidence"
                      :key="`${msg.content}-${item.label}-${item.value}`"
                      :class="['evidence-card', item.tone || 'slate']"
                    >
                      <span>{{ item.label }}</span>
                      <strong>{{ item.value }}</strong>
                      <p>{{ item.detail }}</p>
                    </article>
                  </div>
                </div>

                <div v-if="msg.plan?.length" class="section-card">
                  <div class="section-head">
                    <p class="eyebrow">分析计划</p>
                    <span>{{ msg.intentLabel || 'Agent 计划' }}</span>
                  </div>
                  <ol class="plan-list">
                    <li v-for="step in msg.plan" :key="step">{{ step }}</li>
                  </ol>
                </div>

                <div v-if="msg.toolCalls?.length" class="section-card">
                  <div class="section-head">
                    <p class="eyebrow">数据查询</p>
                    <span>{{ msg.toolCalls.length }} 个工具已完成</span>
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
                    <p class="eyebrow">分析结果</p>
                    <span>{{ localizeTableTitle(table.title) }}</span>
                  </div>
                  <div class="table-shell">
                    <table>
                      <thead>
                        <tr>
                          <th v-for="column in table.columns" :key="column">{{ localizeColumn(column) }}</th>
                          <th v-if="tableHasDrilldown(table)">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!table.rows?.length">
                          <td :colspan="table.columns.length + (tableHasDrilldown(table) ? 1 : 0)">没有返回记录</td>
                        </tr>
                        <tr v-for="(row, rowIndex) in table.rows" :key="`${table.title}-${rowIndex}`">
                          <td v-for="(cell, cellIndex) in row" :key="`${table.title}-${rowIndex}-${cellIndex}`">{{ cell }}</td>
                          <td v-if="tableHasDrilldown(table)" class="drill-cell">
                            <button
                              v-if="getRowDrilldownEntity(table, row)"
                              class="drill-row-btn"
                              :disabled="loading"
                              @click="drillDownRow(table, row)"
                            >
                              展开
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div v-if="msg.nextActions?.length" class="section-card">
                  <div class="section-head">
                    <p class="eyebrow">下一步建议</p>
                    <span>建议操作</span>
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
              placeholder="可以问：现在有几个商品、有没有快没了、冰箱里怎么样、最近谁操作过..."
              rows="1"
              @input="autoResize"
              @keydown.enter.exact.prevent="sendMessage"
            ></textarea>
            <button @click="sendMessage" :disabled="!userInput.trim() || loading" class="send-btn">
              发送
            </button>
          </div>
          <p class="composer-note">安全模式：Ollama 负责解释数据，库存变更仍必须通过系统操作确认。</p>
        </section>

        <aside class="context-panel">
          <section class="context-card glass-panel">
            <p class="eyebrow">Agent Mode</p>
            <h3>{{ llmStatus.enabled ? '本地 LLM + 安全工具' : '安全仓库推理' }}</h3>
            <div class="runtime-strip">
              <span>{{ llmStatus.provider || '规则 Planner' }}</span>
              <strong>{{ llmStatus.model || '规则兜底' }}</strong>
            </div>
            <p>
              助手会先生成简短计划，再调用只读仓库工具，最后让本地模型解释结果。
              如果 Ollama 不可用，系统会自动回到稳定的规则总结。
            </p>
          </section>

          <section class="context-card glass-panel">
            <p class="eyebrow">能力范围</p>
            <div class="capability-list">
              <article v-for="capability in capabilities" :key="capability.name" class="capability-item">
                <strong>{{ localizeCapabilityName(capability.name) }}</strong>
                <p>{{ localizeCapabilityDescription(capability.description) }}</p>
              </article>
            </div>
          </section>

          <section class="context-card glass-panel">
            <p class="eyebrow">快速提问</p>
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
const conversationContext = ref({
  lastIntent: '',
  lastSearchTerm: '',
  lastSubjectType: '',
  lastFocusedEntity: null,
  lastEntities: []
})
const contextMetrics = ref([
  { label: '商品种类', value: '—', tone: 'blue' },
  { label: '有效批次', value: '—', tone: 'violet' },
  { label: '活跃 Bin', value: '—', tone: 'teal' },
  { label: '利用率', value: '—', tone: 'slate' }
])
const llmStatus = ref({
  enabled: false,
  provider: '规则 Planner',
  model: '规则兜底',
  mode: 'read_only_agent'
})

const suggestionPrompts = [
  '现在仓库状态怎么样？',
  '有没有快没了的东西？',
  '哪些批次快过期了？',
  '最近谁操作过库存？',
  '冰箱里现在怎么样？'
]

const intentLabels = {
  overview: '库存总览',
  low_stock_review: '低库存检查',
  expiry_watch: '临期批次',
  recent_activity: '近期活动',
  item_lookup: '商品查询',
  bin_lookup: 'Bin 状态',
  suggestion_watch: '建议队列'
}

const metricLabels = {
  'Tracked Items': '商品种类',
  'Live Lots': '有效批次',
  'Active Bins': '活跃 Bin',
  Utilization: '利用率',
  'New Suggestions': '新建议',
  'Under Review': '审核中',
  Planned: '已计划'
}

const tableTitles = {
  'Low-stock priorities': '低库存优先级',
  'Low-stock review': '低库存检查',
  'Lots nearing expiry': '临期批次',
  'Expiry watch': '临期监控',
  'Recent activity': '近期操作',
  'Item lookup': '商品查询',
  'Bin overview': 'Bin 概览',
  'Recent suggestions': '最近建议',
  'Lot detail': '批次详情',
  'Related expiry watch': '相关临期批次'
}

const columnLabels = {
  SKU: 'SKU',
  Item: '商品',
  Available: '可用数量',
  Min: '最低库存',
  Shortage: '缺口',
  Bins: 'Bin 数',
  Lot: '批次',
  Qty: '数量',
  Bin: 'Bin',
  Expiry: '到期日',
  'Days Left': '剩余天数',
  Time: '时间',
  Type: '类型',
  Location: '位置',
  Operator: '操作者',
  'Low Stock': '低库存',
  'Top Lots': '主要批次',
  Zone: '区域',
  Temp: '温区',
  Used: '已用',
  Capacity: '容量',
  Title: '标题',
  'Requested Item': '请求商品',
  Category: '类别',
  Status: '状态',
  Created: '创建时间',
  Field: '字段',
  Value: '值'
}

const capabilityNames = {
  'Inventory overview': '库存总览',
  'Low-stock review': '低库存检查',
  'Expiry monitoring': '临期监控',
  'Bin insights': 'Bin 洞察',
  'Suggestion watch': '建议查看',
  'Connection issue': '连接问题'
}

const capabilityDescriptions = {
  'Summarize stock health, active lots, bin readiness, and recent activity.': '总结库存健康、有效批次、Bin 状态和近期活动。',
  'Find items below minimum stock and surface replenishment priorities.': '找出低于最低库存的商品，并给出补货优先级。',
  'Highlight lots that expire soon with bin-level traceability.': '标记即将到期的批次，并显示所在 Bin。',
  'Inspect refrigerator, shelf, and other storage locations safely.': '安全查看冰箱、货架等存放位置。',
  'Review new drink requests and current suggestion pipeline.': '查看新的饮品请求和建议处理状态。',
  'The copilot could not load its live warehouse context. Check the backend service and token.': 'AI 助手无法加载实时仓库上下文，请检查后端服务和登录状态。'
}

const localizeMetric = (metric) => ({
  ...metric,
  label: metricLabels[metric.label] || metric.label
})

const localizeTableTitle = (title) => tableTitles[title] || title
const localizeColumn = (column) => columnLabels[column] || column
const localizeCapabilityName = (name) => capabilityNames[name] || name
const localizeCapabilityDescription = (description) => capabilityDescriptions[description] || description

const inferSubjectType = (intent) => {
  if (intent === 'bin_lookup') return 'bin'
  if (intent === 'item_lookup') return 'item'
  return ''
}

const formatScopeLabel = (scope) => {
  if (!scope?.type || !scope?.searchTerm) return ''
  const typeLabel = scope.type === 'bin' ? 'Bin' : scope.type === 'lot' ? '批次' : '商品'
  return `${typeLabel}: ${scope.searchTerm}`
}

const normalizeEntity = (entity) => {
  if (!entity?.type || !entity?.searchTerm) return null
  return {
    type: entity.type,
    searchTerm: String(entity.searchTerm),
    label: entity.label || String(entity.searchTerm),
    source: entity.source || 'assistant-result'
  }
}

const dedupeEntities = (entities = []) => {
  const seen = new Set()
  const result = []

  for (const entity of entities.map(normalizeEntity).filter(Boolean)) {
    const key = `${entity.type}:${entity.searchTerm}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(entity)
  }

  return result.slice(0, 10)
}

const rowObjectFromTable = (columns = [], row = []) => Object.fromEntries(
  columns.map((column, index) => [column, row[index]])
)

const getRowDrilldownEntity = (table = {}, row = []) => {
  const rowObject = rowObjectFromTable(table.columns || [], row)

  if (rowObject.Lot && rowObject.Lot !== '—') {
    return normalizeEntity({
      type: 'lot',
      searchTerm: rowObject.Lot,
      label: [rowObject.Lot, rowObject.Item || rowObject.SKU].filter(Boolean).join(' · '),
      source: table.title
    })
  }

  if (rowObject.SKU && rowObject.SKU !== '—') {
    return normalizeEntity({
      type: 'item',
      searchTerm: rowObject.SKU,
      label: [rowObject.SKU, rowObject.Item].filter(Boolean).join(' · '),
      source: table.title
    })
  }

  if (rowObject.Bin && rowObject.Bin !== '—') {
    return normalizeEntity({
      type: 'bin',
      searchTerm: rowObject.Bin,
      label: rowObject.Bin,
      source: table.title
    })
  }

  return null
}

const tableHasDrilldown = (table = {}) => (
  (table.rows || []).some((row) => getRowDrilldownEntity(table, row))
)

const extractEntitiesFromTables = (tables = []) => {
  const entities = []

  for (const table of tables) {
    for (const row of table.rows || []) {
      const entity = getRowDrilldownEntity(table, row)
      if (entity) entities.push(entity)
    }
  }

  return dedupeEntities(entities)
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
    llmStatus.value = result.llm || llmStatus.value
    capabilities.value = result.capabilities || []
    contextMetrics.value = (result.metrics || contextMetrics.value).map(localizeMetric)
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
  if (payload.intent) {
    const extractedEntities = extractEntitiesFromTables(payload.tables || [])
    const payloadEntity = normalizeEntity(payload.entity) || normalizeEntity(payload.scope)
    const focusedEntity = payloadEntity || extractedEntities[0] || conversationContext.value.lastFocusedEntity
    const entityPool = dedupeEntities([
      ...(payloadEntity ? [payloadEntity] : []),
      ...extractedEntities,
      ...(conversationContext.value.lastEntities || [])
    ])
    const scopedSubjectType = focusedEntity?.type || payload.scope?.type || inferSubjectType(payload.intent)
    const scopedSearchTerm = focusedEntity?.searchTerm || payload.scope?.searchTerm || payload.searchTerm || ''

    conversationContext.value = {
      lastIntent: payload.intent,
      lastSearchTerm: scopedSearchTerm,
      lastSubjectType: scopedSubjectType,
      lastFocusedEntity: focusedEntity || null,
      lastEntities: entityPool
    }
  }

  const scopeLabel = formatScopeLabel(payload.scope)

  messages.value.push({
    role: 'assistant',
    content: payload.answer || payload.message || 'AI 助手已完成本次请求。',
    plan: payload.plan || [],
    toolCalls: payload.toolCalls || [],
    metrics: (payload.metrics || []).map(localizeMetric),
    evidence: payload.evidence || [],
    tables: payload.tables || [],
    nextActions: payload.nextActions || [],
    llm: payload.llm || null,
    intentLabel: intentLabels[payload.intent] || 'Agent 回答',
    planner: payload.planner || null,
    searchTerm: payload.searchTerm || '',
    scope: payload.scope || null,
    scopeLabel
  })
}

const submitPrompt = async (prompt, contextOverride = {}) => {
  if (!prompt || loading.value) return

  messages.value.push({
    role: 'user',
    content: prompt
  })

  loading.value = true
  await scrollToBottom()

  try {
    const response = await fetch('/api/ai/query', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        prompt,
        context: {
          ...conversationContext.value,
          ...contextOverride
        }
      })
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
      nextActions: ['请检查后端服务和登录状态，然后稍后再试。']
    })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

const sendMessage = async () => {
  const prompt = userInput.value.trim()
  if (!prompt || loading.value) return

  userInput.value = ''
  if (inputField.value) {
    inputField.value.style.height = 'auto'
  }

  await submitPrompt(prompt)
}

const drillDownRow = async (table, row) => {
  const entity = getRowDrilldownEntity(table, row)
  if (!entity || loading.value) return

  const nextEntities = dedupeEntities([
    entity,
    ...(conversationContext.value.lastEntities || [])
  ])

  await submitPrompt(`展开：${entity.label}`, {
    lastIntent: 'drill_down',
    lastSearchTerm: entity.searchTerm,
    lastSubjectType: entity.type,
    lastFocusedEntity: entity,
    lastEntities: nextEntities
  })
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

.llm-chip,
.scope-chip,
.runtime-strip {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: fit-content;
  max-width: 100%;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.76);
  color: #475569;
  font-size: 12px;
}

.llm-chip strong,
.scope-chip strong,
.runtime-strip strong {
  color: #0f172a;
}

.llm-chip.active {
  border-color: rgba(52, 211, 153, 0.22);
  background: rgba(236, 253, 245, 0.82);
}

.llm-chip.fallback {
  border-color: rgba(245, 158, 11, 0.22);
  background: rgba(255, 251, 235, 0.82);
}

.scope-chip {
  border-color: rgba(59, 130, 246, 0.18);
  background: rgba(239, 246, 255, 0.84);
}

.section-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.92);
}

.evidence-section {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(239, 246, 255, 0.72)),
    rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(37, 99, 235, 0.08);
}

.evidence-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.evidence-card {
  display: grid;
  gap: 7px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.evidence-card span {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.evidence-card strong {
  color: #0f172a;
  font-size: 20px;
  letter-spacing: -0.04em;
}

.evidence-card p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.evidence-card.blue { border-color: rgba(59, 130, 246, 0.16); background: rgba(239, 246, 255, 0.9); }
.evidence-card.violet { border-color: rgba(124, 58, 237, 0.14); background: rgba(245, 243, 255, 0.9); }
.evidence-card.mint { border-color: rgba(16, 185, 129, 0.14); background: rgba(236, 253, 245, 0.9); }
.evidence-card.amber { border-color: rgba(245, 158, 11, 0.2); background: rgba(255, 251, 235, 0.92); }
.evidence-card.red { border-color: rgba(239, 68, 68, 0.2); background: rgba(254, 242, 242, 0.92); }
.evidence-card.slate { border-color: rgba(100, 116, 139, 0.12); background: rgba(248, 250, 252, 0.92); }

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

.drill-cell {
  width: 1%;
  white-space: nowrap;
}

.drill-row-btn {
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 999px;
  padding: 7px 12px;
  background: rgba(239, 246, 255, 0.9);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.drill-row-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: #ffffff;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.12);
}

.drill-row-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
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

.runtime-strip {
  display: flex;
  width: 100%;
  margin: 12px 0;
  border-radius: 18px;
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
