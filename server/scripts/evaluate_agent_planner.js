const { planAgentQuery } = require('../services/agentPlanner')

const cases = [
  {
    prompt: '现在有几个商品呀',
    expectedIntent: 'overview',
    expectedTools: ['getInventorySnapshot', 'getLowStockItems', 'getExpiringLots']
  },
  {
    prompt: '有没有快没了的东西',
    expectedIntent: 'low_stock_review',
    expectedTools: ['getInventorySnapshot', 'getLowStockItems']
  },
  {
    prompt: '哪些 lot 快过期了',
    expectedIntent: 'expiry_watch',
    expectedTools: ['getExpiringLots']
  },
  {
    prompt: '最近谁扫过出库',
    expectedIntent: 'recent_activity',
    expectedTools: ['getRecentTransactions']
  },
  {
    prompt: '冰箱里现在怎么样',
    expectedIntent: 'bin_lookup',
    expectedSearchTerm: 'Refrigerator',
    expectedTools: ['getBinOverview']
  },
  {
    prompt: '那里面呢',
    context: {
      lastIntent: 'bin_lookup',
      lastSearchTerm: 'Refrigerator',
      lastSubjectType: 'bin'
    },
    expectedIntent: 'bin_lookup',
    expectedSearchTerm: 'Refrigerator',
    expectedScope: { type: 'bin', searchTerm: 'Refrigerator' },
    expectedTools: ['getBinOverview']
  },
  {
    prompt: '那里面有没有快过期的',
    context: {
      lastIntent: 'bin_lookup',
      lastSearchTerm: 'Refrigerator',
      lastSubjectType: 'bin'
    },
    expectedIntent: 'expiry_watch',
    expectedScope: { type: 'bin', searchTerm: 'Refrigerator' },
    expectedTools: ['getExpiringLots']
  },
  {
    prompt: '那里面最近有什么操作',
    context: {
      lastIntent: 'expiry_watch',
      lastSearchTerm: 'Refrigerator',
      lastSubjectType: 'bin'
    },
    expectedIntent: 'recent_activity',
    expectedScope: { type: 'bin', searchTerm: 'Refrigerator' },
    expectedTools: ['getRecentTransactions']
  },
  {
    prompt: '展开第一个',
    context: {
      lastIntent: 'expiry_watch',
      lastSearchTerm: 'Refrigerator',
      lastSubjectType: 'bin',
      lastEntities: [
        { type: 'lot', searchTerm: 'LOT-20260420-8091', label: 'LOT-20260420-8091 · Kirkland_water_500ml' },
        { type: 'item', searchTerm: '196633938091', label: '196633938091 · Kirkland_water_500ml' }
      ]
    },
    expectedIntent: 'drill_down',
    expectedScope: { type: 'lot', searchTerm: 'LOT-20260420-8091' },
    expectedTools: ['getDrilldownContext']
  },
  {
    prompt: '这个 lot 在哪里',
    context: {
      lastIntent: 'expiry_watch',
      lastSearchTerm: 'Refrigerator',
      lastSubjectType: 'bin',
      lastFocusedEntity: { type: 'lot', searchTerm: 'LOT-20260420-8091', label: 'LOT-20260420-8091' }
    },
    expectedIntent: 'drill_down',
    expectedScope: { type: 'lot', searchTerm: 'LOT-20260420-8091' },
    expectedTools: ['getDrilldownContext']
  },
  {
    prompt: '为什么',
    context: {
      lastIntent: 'item_lookup',
      lastSearchTerm: '196633938091',
      lastSubjectType: 'item',
      lastFocusedEntity: { type: 'item', searchTerm: '196633938091', label: '196633938091' }
    },
    expectedIntent: 'drill_down',
    expectedScope: { type: 'item', searchTerm: '196633938091' },
    expectedTools: ['getDrilldownContext']
  },
  {
    prompt: '冰箱里有没有快没了的东西',
    expectedIntent: 'low_stock_review',
    expectedScope: { type: 'bin', searchTerm: 'Refrigerator' },
    expectedTools: ['getInventorySnapshot', 'getLowStockItems']
  },
  {
    prompt: '196633938091 这个商品怎么样',
    expectedIntent: 'item_lookup',
    expectedSearchTerm: '196633938091',
    expectedScope: { type: 'item', searchTerm: '196633938091' },
    expectedTools: ['getItemSnapshots']
  },
  {
    prompt: '它现在库存怎么样',
    context: {
      lastIntent: 'item_lookup',
      lastSearchTerm: '196633938091',
      lastSubjectType: 'item'
    },
    expectedIntent: 'item_lookup',
    expectedSearchTerm: '196633938091',
    expectedScope: { type: 'item', searchTerm: '196633938091' },
    expectedTools: ['getItemSnapshots']
  },
  {
    prompt: '有没有新的饮料建议',
    expectedIntent: 'suggestion_watch',
    expectedTools: ['getSuggestionSummary']
  },
  {
    prompt: '在庫不足の商品はありますか',
    expectedIntent: 'low_stock_review',
    expectedTools: ['getInventorySnapshot', 'getLowStockItems']
  },
  {
    prompt: '冷蔵庫の状況を教えて',
    expectedIntent: 'bin_lookup',
    expectedSearchTerm: 'Refrigerator',
    expectedTools: ['getBinOverview']
  }
]

const sameArray = (left = [], right = []) => (
  left.length === right.length && left.every((value, index) => value === right[index])
)

const sameScope = (left, right) => {
  if (!right) return true
  return left?.type === right.type && left?.searchTerm === right.searchTerm
}

let failed = 0

for (const testCase of cases) {
  const plan = planAgentQuery(testCase.prompt, testCase.context || {})
  const actualTools = plan.tools.map((tool) => tool.name)
  const errors = []

  if (plan.intent !== testCase.expectedIntent) {
    errors.push(`intent expected ${testCase.expectedIntent}, got ${plan.intent}`)
  }

  if (testCase.expectedSearchTerm !== undefined && plan.searchTerm !== testCase.expectedSearchTerm) {
    errors.push(`searchTerm expected ${testCase.expectedSearchTerm}, got ${plan.searchTerm || '(empty)'}`)
  }

  if (!sameScope(plan.scope, testCase.expectedScope)) {
    errors.push(`scope expected ${JSON.stringify(testCase.expectedScope)}, got ${JSON.stringify(plan.scope || null)}`)
  }

  if (!sameArray(actualTools, testCase.expectedTools)) {
    errors.push(`tools expected ${testCase.expectedTools.join(',')}, got ${actualTools.join(',')}`)
  }

  if (errors.length) {
    failed += 1
    console.error(`FAIL ${testCase.prompt}`)
    errors.forEach((error) => console.error(`  - ${error}`))
  } else {
    console.log(`PASS ${testCase.prompt} -> ${plan.intent}`)
  }
}

if (failed) {
  console.error(`\n${failed}/${cases.length} planner cases failed.`)
  process.exit(1)
}

console.log(`\nAll ${cases.length} planner cases passed.`)
