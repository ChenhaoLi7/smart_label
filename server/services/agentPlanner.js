const DEFAULT_LIMIT = 6

const ITEM_LOOKUP_STOP_WORDS = new Set([
  'show', 'me', 'the', 'for', 'with', 'about', 'inventory', 'item', 'items', 'stock', 'sku',
  'check', 'find', 'lookup', 'review', 'please', 'details', 'detail', 'status', 'of', 'and',
  'what', 'which', 'tell', 'give', 'need', 'want', 'bin', 'location'
])

const parseLimit = (prompt) => {
  const match = String(prompt || '').match(/\b(\d{1,2})\b/)
  if (!match) return DEFAULT_LIMIT
  const limit = Number(match[1])
  return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 20) : DEFAULT_LIMIT
}

const inferSearchTerm = (prompt) => {
  const normalized = String(prompt || '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !ITEM_LOOKUP_STOP_WORDS.has(token.toLowerCase()))

  return normalized.slice(0, 4).join(' ').trim()
}

const buildPlan = (steps, tools) => ({
  steps,
  tools
})

const planAgentQuery = (prompt) => {
  const normalized = String(prompt || '').toLowerCase()
  const limit = parseLimit(prompt)
  const has = (patterns) => patterns.some((pattern) => normalized.includes(pattern))
  const tools = []

  const pushTool = (name, params = {}) => {
    if (!tools.find((tool) => tool.name === name)) {
      tools.push({ name, params })
    }
  }

  if (has(['low stock', 'below target', 'minimum stock', 'replenish', 'shortage'])) {
    pushTool('getInventorySnapshot')
    pushTool('getLowStockItems', { limit })

    return {
      intent: 'low_stock_review',
      mode: 'read_only_agent',
      searchTerm: '',
      ...buildPlan(
        [
          'Review current stock coverage.',
          'Find SKUs below their minimum stock target.',
          'Summarize what should be replenished first.'
        ],
        tools
      )
    }
  }

  if (has(['expire', 'expiry', 'expiring', 'shelf life', 'best before'])) {
    pushTool('getExpiringLots', { days: 30, limit })

    return {
      intent: 'expiry_watch',
      mode: 'read_only_agent',
      searchTerm: '',
      ...buildPlan(
        [
          'Check live lots with upcoming expiry dates.',
          'Sort the most urgent lots first.',
          'Highlight where those lots are stored.'
        ],
        tools
      )
    }
  }

  if (has(['suggestion', 'suggestions', 'drink request', 'new beverage', 'request'])) {
    pushTool('getSuggestionSummary', { limit })

    return {
      intent: 'suggestion_watch',
      mode: 'read_only_agent',
      searchTerm: '',
      ...buildPlan(
        [
          'Review the current suggestion queue.',
          'Check how many requests are still new or under review.',
          'Surface the latest user requests.'
        ],
        tools
      )
    }
  }

  if (has(['transaction', 'transactions', 'history', 'recent activity', 'inbound', 'outbound', 'move', 'count'])) {
    pushTool('getRecentTransactions', { limit })

    return {
      intent: 'recent_activity',
      mode: 'read_only_agent',
      searchTerm: '',
      ...buildPlan(
        [
          'Inspect the most recent warehouse activity.',
          'Group inbound, outbound, move, and count operations.',
          'Summarize what changed most recently.'
        ],
        tools
      )
    }
  }

  if (has(['refrigerator', 'bookshelf', 'shelf', 'bin', 'location', 'zone'])) {
    const searchTerm = inferSearchTerm(prompt)
    pushTool('getBinOverview', { searchTerm, limit })

    return {
      intent: 'bin_lookup',
      mode: 'read_only_agent',
      searchTerm,
      ...buildPlan(
        [
          'Inspect the requested storage locations.',
          'Measure utilization and lot coverage by bin.',
          'Return the clearest bin-level view.'
        ],
        tools
      )
    }
  }

  const searchTerm = inferSearchTerm(prompt)
  if (searchTerm && (/[0-9]/.test(searchTerm) || searchTerm.length >= 4)) {
    pushTool('getItemSnapshots', { searchTerm, limit })

    return {
      intent: 'item_lookup',
      mode: 'read_only_agent',
      searchTerm,
      ...buildPlan(
        [
          'Search matching items by SKU or name.',
          'Collect current stock coverage and lot spread.',
          'Summarize the item-level position.'
        ],
        tools
      )
    }
  }

  pushTool('getInventorySnapshot')
  pushTool('getLowStockItems', { limit: 5 })
  pushTool('getExpiringLots', { days: 14, limit: 5 })

  return {
    intent: 'overview',
    mode: 'read_only_agent',
    searchTerm: '',
    ...buildPlan(
      [
        'Take a quick inventory snapshot.',
        'Check low-stock and expiry signals.',
        'Return a concise operating summary.'
      ],
      tools
    )
  }
}

module.exports = {
  planAgentQuery
}
