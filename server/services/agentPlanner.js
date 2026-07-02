const DEFAULT_LIMIT = 6

const ITEM_LOOKUP_STOP_WORDS = new Set([
  'show', 'me', 'the', 'for', 'with', 'about', 'inventory', 'item', 'items', 'stock', 'sku',
  'check', 'find', 'lookup', 'review', 'please', 'details', 'detail', 'status', 'of', 'and',
  'what', 'which', 'tell', 'give', 'need', 'want', 'bin', 'location', 'warehouse', 'overview',
  'summary', 'current', 'now'
])

const INTENT_DEFINITIONS = {
  overview: {
    cjkSteps: [
      '读取当前库存总览。',
      '检查低库存和临期批次信号。',
      '用简短语言回答当前商品与风险状态。'
    ],
    steps: [
      'Take a quick inventory snapshot.',
      'Check low-stock and expiry signals.',
      'Return a concise operating summary.'
    ],
    tools: [
      { name: 'getInventorySnapshot' },
      { name: 'getLowStockItems', params: { limit: 5 } },
      { name: 'getExpiringLots', params: { days: 14, limit: 5 } }
    ]
  },
  low_stock_review: {
    cjkSteps: [
      '读取当前库存覆盖情况。',
      '找出低于安全库存的商品。',
      '按缺口大小给出补货优先级。'
    ],
    steps: [
      'Review current stock coverage.',
      'Find SKUs below their minimum stock target.',
      'Summarize what should be replenished first.'
    ],
    tools: [
      { name: 'getInventorySnapshot' },
      { name: 'getLowStockItems', params: { limit: '$limit' } }
    ]
  },
  expiry_watch: {
    cjkSteps: [
      '检查即将到期的有效批次。',
      '按到期紧急程度排序。',
      '标出这些批次所在的存放位置。'
    ],
    steps: [
      'Check live lots with upcoming expiry dates.',
      'Sort the most urgent lots first.',
      'Highlight where those lots are stored.'
    ],
    tools: [
      { name: 'getExpiringLots', params: { days: 30, limit: '$limit' } }
    ]
  },
  suggestion_watch: {
    cjkSteps: [
      '查看当前饮品/商品建议队列。',
      '统计新建议、审核中和计划中的数量。',
      '展示最近的用户请求。'
    ],
    steps: [
      'Review the current suggestion queue.',
      'Check how many requests are still new or under review.',
      'Surface the latest user requests.'
    ],
    tools: [
      { name: 'getSuggestionSummary', params: { limit: '$limit' } }
    ]
  },
  recent_activity: {
    cjkSteps: [
      '读取最近的仓库操作记录。',
      '整理入库、出库、移库和盘点活动。',
      '总结最近发生的库存变化。'
    ],
    steps: [
      'Inspect the most recent warehouse activity.',
      'Group inbound, outbound, move, and count operations.',
      'Summarize what changed most recently.'
    ],
    tools: [
      { name: 'getRecentTransactions', params: { limit: '$limit' } }
    ]
  },
  bin_lookup: {
    cjkSteps: [
      '查看指定存放位置。',
      '整理该位置的容量、利用率和批次覆盖情况。',
      '返回最清晰的 Bin 级别视图。'
    ],
    steps: [
      'Inspect the requested storage locations.',
      'Measure utilization and lot coverage by bin.',
      'Return the clearest bin-level view.'
    ],
    tools: [
      { name: 'getBinOverview', params: { searchTerm: '$searchTerm', limit: '$limit' } }
    ]
  },
  item_lookup: {
    cjkSteps: [
      '按 SKU、条码或商品名查找匹配商品。',
      '收集库存数量、所在 Bin 和批次分布。',
      '总结该商品当前库存状态。'
    ],
    steps: [
      'Search matching items by SKU or name.',
      'Collect current stock coverage and lot spread.',
      'Summarize the item-level position.'
    ],
    tools: [
      { name: 'getItemSnapshots', params: { searchTerm: '$searchTerm', limit: '$limit' } }
    ]
  },
  drill_down: {
    cjkSteps: [
      '识别上一轮结果中用户想展开的对象。',
      '读取该对象的库存、位置、批次和近期操作证据。',
      '用可追问的方式解释这个对象的详细情况。'
    ],
    steps: [
      'Identify the target entity from the previous result.',
      'Fetch stock, location, lot, and recent activity evidence for that entity.',
      'Explain the selected entity with drill-down details.'
    ],
    tools: [
      { name: 'getDrilldownContext', params: { entity: '$entity', scope: '$scope', limit: '$limit' } }
    ]
  }
}

const SIGNALS = {
  overview: [
    [/overview|summary|dashboard|warehouse health|inventory status|stock status/u, 4],
    [/how many (items|products)|total (items|products)/u, 5],
    [/现在.*(几种|几个|多少).*商品/u, 7],
    [/目前.*(几种|几个|多少).*商品/u, 7],
    [/当前.*(几种|几个|多少).*商品/u, 7],
    [/(总共|一共).*商品/u, 7],
    [/商品.*数量/u, 5],
    [/库存.*(状态|概览|总览|健康|情况)/u, 6],
    [/仓库.*(状态|概览|总览|健康|情况)/u, 6],
    [/(在庫|倉庫).*(状況|概要|サマリー)/u, 6],
    [/商品.*何/u, 5]
  ],
  low_stock_review: [
    [/low stock|below target|minimum stock|replenish|shortage|restock/u, 7],
    [/低库存|安全库存|库存不足|缺货|快没|补货|補貨|不足/u, 7],
    [/補充|欠品|在庫不足|少ない|足りない/u, 7]
  ],
  expiry_watch: [
    [/expire|expiry|expiring|shelf life|best before/u, 7],
    [/过期|過期|临期|臨期|保质期|賞味期限|消費期限|期限/u, 7],
    [/期限.*近|もうすぐ.*期限/u, 6]
  ],
  suggestion_watch: [
    [/suggestion|suggestions|drink request|new beverage|request/u, 7],
    [/建议|建議|提案|请求|申請|申请|想要|新饮料|新商品/u, 7],
    [/リクエスト|要望|提案/u, 7]
  ],
  recent_activity: [
    [/transaction|transactions|history|recent activity|inbound|outbound|move|count/u, 7],
    [/最近|刚才|剛才|历史|歷史|履历|履歴|记录|記録/u, 4],
    [/入库|入庫|出库|出庫|移库|移動|盘点|盤点|棚卸/u, 7],
    [/誰.*(操作|扫描|スキャン)|谁.*(操作|扫码|扫描)/u, 6]
  ],
  bin_lookup: [
    [/refrigerator|fridge|bookshelf|shelf|bin|location|zone/u, 7],
    [/冰箱|冷藏|冷蔵|冷庫|书架|書架|货架|棚|位置|存放|保管場所|場所/u, 7]
  ],
  item_lookup: [
    [/\bsku\b|barcode|bar code|item lookup|product lookup/u, 5],
    [/商品.*(详情|詳細|明细|查|找)|品目|製品/u, 4],
    [/\b[A-Z]{1,6}[-_]?\d{2,}\b/u, 8],
    [/\b\d{6,}\b/u, 8],
    [/LOT-\d+/iu, 8]
  ],
  drill_down: [
    [/drill.?down|expand|details?|explain|why|evidence|where is|located/u, 7],
    [/展开|展開|详情|詳細|明细|明細|为什么|為什么|为何|理由|依据|依據|证据|証拠|根拠|在哪|哪里|哪裡|位置/u, 7],
    [/第[一二三四五六七八九十\d]+(个|個|条|條|项|項)?/u, 7],
    [/(first|second|third|1st|2nd|3rd)\s+(one|row|item|lot|result)?/u, 7]
  ]
}

const parseLimit = (prompt) => {
  const match = String(prompt || '').match(/\b(\d{1,2})\b/)
  if (!match) return DEFAULT_LIMIT
  const limit = Number(match[1])
  return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 20) : DEFAULT_LIMIT
}

const hasCjk = (value) => /[\u3040-\u30ff\u3400-\u9fff]/u.test(String(value || ''))

const hasContextReference = (prompt) => (
  /(里面|裡面|那里面|这里面|那里|那边|这个|那个|它|刚才|剛才|上面|前面|there|that|it|same|previous|その|そこ|それ|さっき|同じ)/iu
    .test(String(prompt || ''))
)

const normalizeContext = (context = {}) => ({
  lastIntent: String(context.lastIntent || context.intent || '').trim(),
  lastSearchTerm: String(context.lastSearchTerm || context.searchTerm || '').trim(),
  lastSubjectType: String(context.lastSubjectType || context.subjectType || '').trim(),
  lastFocusedEntity: normalizeEntity(context.lastFocusedEntity || context.focusedEntity),
  lastEntities: Array.isArray(context.lastEntities)
    ? context.lastEntities.map(normalizeEntity).filter(Boolean).slice(0, 10)
    : []
})

const normalizeEntity = (entity = {}) => {
  const type = String(entity.type || entity.entityType || '').trim().toLowerCase()
  const searchTerm = String(entity.searchTerm || entity.term || entity.id || '').trim()
  if (!type || !searchTerm) return null

  return {
    type,
    searchTerm,
    label: String(entity.label || searchTerm).trim(),
    source: String(entity.source || '').trim()
  }
}

const scoreIntent = (prompt, normalized, intent) => {
  const source = `${prompt}\n${normalized}`
  return (SIGNALS[intent] || []).reduce((score, [pattern, weight]) => (
    pattern.test(source) ? score + weight : score
  ), 0)
}

const inferBinSearchTerm = (prompt) => {
  const value = String(prompt || '')
  if (/冰箱|冷藏|冷蔵|冷庫|refrigerator|fridge/i.test(value)) return 'Refrigerator'
  if (/书架|書架|bookshelf/i.test(value)) return 'bookshelf'
  if (/货架|貨架|棚|shelf/i.test(value)) return 'shelf'
  return inferSearchTerm(prompt)
}

const hasExplicitBinSignal = (prompt) => (
  /冰箱|冷藏|冷蔵|冷庫|refrigerator|fridge|书架|書架|bookshelf|货架|貨架|棚|shelf|bin|location|zone|位置|存放|保管場所|場所/i
    .test(String(prompt || ''))
)

const inferSearchTerm = (prompt) => {
  const normalized = String(prompt || '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !ITEM_LOOKUP_STOP_WORDS.has(token.toLowerCase()))

  return normalized.slice(0, 4).join(' ').trim()
}

const inferItemSearchTerm = (prompt) => {
  const value = String(prompt || '')
  const lotMatch = value.match(/LOT-\d+(?:-\d+)?(?:-MV\d+)?/i)
  if (lotMatch) return lotMatch[0]

  const skuMatch = value.match(/\b\d{6,}\b/)
  if (skuMatch) return skuMatch[0]

  const codeMatch = value.match(/\b[A-Z]{1,8}[-_]?\d{2,}\b/i)
  if (codeMatch) return codeMatch[0]

  return inferSearchTerm(prompt)
}

const inferExplicitItemSearchTerm = (prompt) => {
  const value = String(prompt || '')
  const lotMatch = value.match(/LOT-\d+(?:-\d+)?(?:-MV\d+)?/i)
  if (lotMatch) return lotMatch[0]

  const skuMatch = value.match(/\b\d{6,}\b/)
  if (skuMatch) return skuMatch[0]

  const codeMatch = value.match(/\b[A-Z]{1,8}[-_]?\d{2,}\b/i)
  if (codeMatch) return codeMatch[0]

  return ''
}

const hasExplicitItemSignal = (prompt) => Boolean(inferExplicitItemSearchTerm(prompt))

const parseOrdinalIndex = (prompt) => {
  const value = String(prompt || '').toLowerCase()
  const numberMatch = value.match(/第\s*(\d{1,2})\s*(个|個|条|條|项|項)?/u)
  if (numberMatch) return Math.max(Number(numberMatch[1]) - 1, 0)

  const cjkOrdinals = [
    ['一', 0],
    ['二', 1],
    ['三', 2],
    ['四', 3],
    ['五', 4],
    ['六', 5],
    ['七', 6],
    ['八', 7],
    ['九', 8],
    ['十', 9]
  ]

  for (const [token, index] of cjkOrdinals) {
    if (new RegExp(`第\\s*${token}\\s*(个|個|条|條|项|項)?`, 'u').test(value)) return index
  }

  if (/\b(first|1st)\b/u.test(value)) return 0
  if (/\b(second|2nd)\b/u.test(value)) return 1
  if (/\b(third|3rd)\b/u.test(value)) return 2
  return null
}

const inferEntityFromPrompt = (prompt, normalizedContext) => {
  const value = String(prompt || '')
  const ordinalIndex = parseOrdinalIndex(prompt)
  if (ordinalIndex !== null && normalizedContext.lastEntities[ordinalIndex]) {
    return normalizedContext.lastEntities[ordinalIndex]
  }

  const explicitLot = value.match(/LOT-\d+(?:-\d+)?(?:-MV\d+)?/i)
  if (explicitLot) {
    return {
      type: 'lot',
      searchTerm: explicitLot[0],
      label: explicitLot[0],
      source: 'prompt'
    }
  }

  const explicitSku = inferExplicitItemSearchTerm(prompt)
  if (explicitSku) {
    return {
      type: 'item',
      searchTerm: explicitSku,
      label: explicitSku,
      source: 'prompt'
    }
  }

  if (hasExplicitBinSignal(prompt)) {
    const binTerm = inferBinSearchTerm(prompt)
    if (binTerm) {
      return {
        type: 'bin',
        searchTerm: binTerm,
        label: binTerm,
        source: 'prompt'
      }
    }
  }

  if (/lot|批次|ロット/i.test(value)) {
    const lotEntity = normalizedContext.lastEntities.find((entity) => entity.type === 'lot')
    if (lotEntity) return lotEntity
  }

  if (/商品|sku|item|品目|製品/i.test(value)) {
    const itemEntity = normalizedContext.lastEntities.find((entity) => entity.type === 'item')
    if (itemEntity) return itemEntity
  }

  if (/bin|位置|存放|保管|場所|冰箱|冷藏|冷蔵|书架|書架|货架|棚/i.test(value)) {
    const binEntity = normalizedContext.lastEntities.find((entity) => entity.type === 'bin')
    if (binEntity) return binEntity
  }

  return normalizedContext.lastFocusedEntity || normalizedContext.lastEntities[0] || null
}

const inferScope = (prompt, intent, normalizedContext) => {
  if (intent === 'drill_down') {
    return inferEntityFromPrompt(prompt, normalizedContext)
  }

  if (intent === 'bin_lookup') {
    const searchTerm = hasContextReference(prompt) &&
      normalizedContext.lastSubjectType === 'bin' &&
      normalizedContext.lastSearchTerm
      ? normalizedContext.lastSearchTerm
      : inferBinSearchTerm(prompt)

    return searchTerm ? { type: 'bin', searchTerm } : null
  }

  if (intent === 'item_lookup') {
    const searchTerm = hasContextReference(prompt) &&
      normalizedContext.lastSubjectType === 'item' &&
      normalizedContext.lastSearchTerm
      ? normalizedContext.lastSearchTerm
      : inferItemSearchTerm(prompt)

    return searchTerm ? { type: 'item', searchTerm } : null
  }

  if (hasExplicitBinSignal(prompt)) {
    const searchTerm = inferBinSearchTerm(prompt)
    if (searchTerm) return { type: 'bin', searchTerm }
  }

  if (hasExplicitItemSignal(prompt)) {
    const searchTerm = inferExplicitItemSearchTerm(prompt)
    if (searchTerm) return { type: 'item', searchTerm }
  }

  if (
    hasContextReference(prompt) &&
    normalizedContext.lastSearchTerm &&
    ['bin', 'item'].includes(normalizedContext.lastSubjectType)
  ) {
    return {
      type: normalizedContext.lastSubjectType,
      searchTerm: normalizedContext.lastSearchTerm
    }
  }

  return null
}

const resolveParams = (params = {}, context) => Object.fromEntries(
  Object.entries(params).map(([key, value]) => {
    if (value === '$limit') return [key, context.limit]
    if (value === '$searchTerm') return [key, context.searchTerm]
    if (value === '$scope') return [key, context.scope]
    if (value === '$entity') return [key, context.entity]
    return [key, value]
  })
)

const SCOPED_TOOL_NAMES = new Set([
  'getInventorySnapshot',
  'getLowStockItems',
  'getExpiringLots',
  'getRecentTransactions'
])

const buildPlanFromIntent = ({ intent, prompt, limit, searchTerm = '', scope = null, scores = [] }) => {
  const definition = INTENT_DEFINITIONS[intent] || INTENT_DEFINITIONS.overview
  const context = { limit, searchTerm, scope, entity: scope }
  const tools = []

  for (const tool of definition.tools) {
    if (!tools.find((existing) => existing.name === tool.name)) {
      const rawParams = { ...(tool.params || {}) }
      if (scope && SCOPED_TOOL_NAMES.has(tool.name)) {
        rawParams.scope = '$scope'
      }

      tools.push({
        name: tool.name,
        params: resolveParams(rawParams, context)
      })
    }
  }

  return {
    intent,
    mode: 'read_only_agent',
    searchTerm,
    scope,
    entity: intent === 'drill_down' ? scope : null,
    planner: {
      strategy: 'semantic_score',
      scores: scores.slice(0, 3)
    },
    steps: hasCjk(prompt) ? definition.cjkSteps : definition.steps,
    tools
  }
}

const chooseIntent = (prompt, normalized, context = {}) => {
  const scores = Object.keys(INTENT_DEFINITIONS)
    .map((intent) => ({ intent, score: scoreIntent(prompt, normalized, intent) }))
    .sort((a, b) => b.score - a.score)

  const [winner, runnerUp] = scores
  const normalizedContext = normalizeContext(context)

  if (
    hasContextReference(prompt) &&
    normalizedContext.lastSearchTerm &&
    ['bin_lookup', 'item_lookup'].includes(normalizedContext.lastIntent)
  ) {
    const contextualScore = 5
    const topScore = winner?.score || 0
    if (topScore <= 0 || winner.intent === 'overview') {
      return {
        intent: normalizedContext.lastIntent,
        scores: [
          { intent: normalizedContext.lastIntent, score: contextualScore, source: 'context' },
          ...scores.filter((entry) => entry.intent !== normalizedContext.lastIntent)
        ]
      }
    }
  }

  if (
    hasContextReference(prompt) &&
    normalizedContext.lastSearchTerm &&
    ['bin', 'item'].includes(normalizedContext.lastSubjectType)
  ) {
    const contextualIntent = normalizedContext.lastSubjectType === 'bin' ? 'bin_lookup' : 'item_lookup'
    const contextualScore = 5
    const topScore = winner?.score || 0

    if (topScore <= 0 || winner.intent === 'overview') {
      return {
        intent: contextualIntent,
        scores: [
          { intent: contextualIntent, score: contextualScore, source: 'context' },
          ...scores.filter((entry) => entry.intent !== contextualIntent)
        ]
      }
    }
  }

  if (!winner || winner.score <= 0) {
    return { intent: 'overview', scores }
  }

  // Natural language often includes "商品" while asking for a total count. Keep totals as overview.
  if (winner.intent === 'item_lookup' && (scores.find((entry) => entry.intent === 'overview')?.score || 0) >= 5) {
    return { intent: 'overview', scores }
  }

  // Bin names can appear inside activity questions. If the activity signal is close, prefer audit history.
  if (
    winner.intent === 'bin_lookup' &&
    runnerUp?.intent === 'recent_activity' &&
    runnerUp.score >= winner.score - 1
  ) {
    return { intent: 'recent_activity', scores }
  }

  return { intent: winner.intent, scores }
}

const planAgentQuery = (prompt, context = {}) => {
  const normalized = String(prompt || '').toLowerCase()
  const limit = parseLimit(prompt)
  const normalizedContext = normalizeContext(context)
  const { intent, scores } = chooseIntent(prompt, normalized, normalizedContext)
  const scope = inferScope(prompt, intent, normalizedContext)
  const searchTerm = ['bin_lookup', 'item_lookup'].includes(intent)
    ? (scope?.searchTerm || '')
    : ''

  return buildPlanFromIntent({
    intent,
    prompt,
    limit,
    searchTerm,
    scope,
    scores
  })
}

module.exports = {
  planAgentQuery
}
