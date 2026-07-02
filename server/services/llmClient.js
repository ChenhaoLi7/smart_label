const axios = require('axios')

const DEFAULT_API_URL = 'http://127.0.0.1:11434/v1/chat/completions'
const DEFAULT_MODEL = 'deepseek-r1:8b'
const DEFAULT_TIMEOUT_MS = 30000

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback
  return !['0', 'false', 'off', 'no'].includes(String(value).trim().toLowerCase())
}

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const getLlmConfig = () => ({
  enabled: parseBoolean(process.env.LLM_ENABLED, true),
  apiUrl: process.env.LLM_API_URL || DEFAULT_API_URL,
  apiKey: process.env.LLM_API_KEY || 'ollama',
  model: process.env.LLM_MODEL || DEFAULT_MODEL,
  timeoutMs: parsePositiveInteger(process.env.LLM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
})

const inferProvider = (apiUrl = '') => {
  const normalized = String(apiUrl).toLowerCase()
  if (normalized.includes('11434') || normalized.includes('ollama')) return 'Ollama'
  if (normalized.includes('openai')) return 'OpenAI-compatible'
  return 'LLM API'
}

const getLlmStatus = () => {
  const config = getLlmConfig()
  return {
    enabled: config.enabled,
    provider: inferProvider(config.apiUrl),
    model: config.model,
    mode: config.enabled ? 'local_llm_tool_agent' : 'read_only_agent',
    timeout_ms: config.timeoutMs
  }
}

const truncate = (value, maxLength = 12000) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  if (!text || text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n... [truncated]`
}

const compactTables = (tables = []) => tables.map((table) => ({
  title: table.title,
  columns: table.columns,
  rows: (table.rows || []).slice(0, 10)
}))

const buildMessages = ({ prompt, plan, toolCalls, shaped }) => [
  {
    role: 'system',
    content: [
      'You are Pilot System, a local warehouse AI assistant running through Ollama.',
      'You must only use the supplied warehouse tool results. Do not invent stock numbers, lots, bins, or dates.',
      'You are read-only: never claim that you changed inventory or executed an operation.',
      'Match the user language when possible. If the user writes Chinese, answer in Chinese; if Japanese, answer in Japanese; otherwise answer in English.',
      'Return strict JSON only: {"answer":"...","nextActions":["..."]}.',
      'Do not add explanations, translations, markdown, or any text outside the JSON object.',
      'The answer must be a complete natural sentence, not only a number, SKU, JSON fragment, or single word.',
      'For inventory overview questions, include the tracked item count and mention whether low-stock or expiry risks exist when those tool results are supplied.',
      'Keep the answer practical, concise, and operational. Do not use markdown tables.'
    ].join('\n')
  },
  {
    role: 'user',
    content: truncate({
      user_question: prompt,
      planner_intent: plan.intent,
      planner_steps: plan.steps,
      completed_tools: toolCalls,
      deterministic_answer: shaped.answer,
      answer_style_requirement: 'Use a complete sentence. If the user asks how many items/products exist, answer with the count plus stock-risk context.',
      metrics: shaped.metrics,
      tables: compactTables(shaped.tables),
      suggested_next_actions: shaped.nextActions
    })
  }
]

const cleanModelText = (text = '') => String(text)
  .replace(/<think>[\s\S]*?<\/think>/gi, '')
  .replace(/```(?:json)?/gi, '')
  .replace(/```/g, '')
  .trim()

const extractFirstJsonObject = (text) => {
  const start = text.indexOf('{')
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') depth += 1
    if (char === '}') depth -= 1

    if (depth === 0) {
      return text.slice(start, index + 1)
    }
  }

  return null
}

const parseModelResponse = (content) => {
  const cleaned = cleanModelText(content)
  const jsonCandidate = extractFirstJsonObject(cleaned)

  if (jsonCandidate) {
    try {
      const parsed = JSON.parse(jsonCandidate)
      return {
        answer: typeof parsed.answer === 'string' ? parsed.answer.trim() : cleaned,
        nextActions: Array.isArray(parsed.nextActions)
          ? parsed.nextActions.filter((action) => typeof action === 'string' && action.trim()).slice(0, 5)
          : null
      }
    } catch (error) {
      // Fall through and use the cleaned model text as a plain answer.
    }
  }

  return {
    answer: cleaned,
    nextActions: null
  }
}

const sanitizeNextActions = ({ parsedActions, fallbackActions = [], toolCalls = [] }) => {
  const toolNames = new Set(
    toolCalls
      .map((toolCall) => String(toolCall.name || '').trim().toLowerCase())
      .filter(Boolean)
  )

  const safeActions = (parsedActions || [])
    .map((action) => String(action).trim())
    .filter((action) => action && !toolNames.has(action.toLowerCase()))
    .slice(0, 5)

  return safeActions.length ? safeActions : fallbackActions
}

const isWeakAnswer = (answer) => {
  const text = String(answer || '').trim()
  if (!text) return true
  if (/^[\d\s.,，。]+$/.test(text)) return true
  if (/^(yes|no|ok|none|unknown|true|false)$/i.test(text)) return true
  if (/^[-\w]+$/.test(text) && text.length <= 8) return true
  return false
}

const postToOllamaApiChat = async ({ apiUrl, model, messages, timeoutMs }) => {
  const response = await axios.post(
    apiUrl,
    {
      model,
      messages,
      stream: false,
      options: {
        temperature: 0.2
      }
    },
    { timeout: timeoutMs }
  )

  return response.data?.message?.content || response.data?.response || ''
}

const postToOpenAiCompatible = async ({ apiUrl, apiKey, model, messages, timeoutMs }) => {
  const headers = {
    'Content-Type': 'application/json'
  }

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const response = await axios.post(
    apiUrl,
    {
      model,
      messages,
      temperature: 0.2,
      max_tokens: 700,
      stream: false
    },
    {
      headers,
      timeout: timeoutMs
    }
  )

  return response.data?.choices?.[0]?.message?.content || response.data?.message?.content || response.data?.response || ''
}

const generateAgentNarrative = async ({ prompt, plan, toolCalls, shaped }) => {
  const config = getLlmConfig()
  const status = getLlmStatus()

  if (!config.enabled) {
    return {
      ...status,
      used: false,
      fallback_reason: 'LLM is disabled'
    }
  }

  try {
    const messages = buildMessages({ prompt, plan, toolCalls, shaped })
    const content = config.apiUrl.includes('/api/chat')
      ? await postToOllamaApiChat({ ...config, messages })
      : await postToOpenAiCompatible({ ...config, messages })

    if (!content) {
      throw new Error('Empty LLM response')
    }

    const parsed = parseModelResponse(content)

    return {
      ...status,
      used: true,
      answer: isWeakAnswer(parsed.answer) ? shaped.answer : parsed.answer,
      nextActions: sanitizeNextActions({
        parsedActions: parsed.nextActions,
        fallbackActions: shaped.nextActions,
        toolCalls
      })
    }
  } catch (error) {
    return {
      ...status,
      used: false,
      fallback_reason: error.message || 'LLM request failed'
    }
  }
}

module.exports = {
  generateAgentNarrative,
  getLlmStatus
}
