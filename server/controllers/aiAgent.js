const agentTools = require('../services/agentTools')
const { planAgentQuery } = require('../services/agentPlanner')
const { generateAgentNarrative, getLlmStatus } = require('../services/llmClient')

const TOOL_LABELS = {
  getInventorySnapshot: 'Inventory Snapshot',
  getLowStockItems: 'Low-Stock Scan',
  getExpiringLots: 'Expiry Watch',
  getRecentTransactions: 'Recent Activity',
  getItemSnapshots: 'Item Lookup',
  getBinOverview: 'Bin Review',
  getDrilldownContext: 'Drill-down Detail',
  getSuggestionSummary: 'Suggestion Watch'
}

const TOOL_RUNNERS = {
  getInventorySnapshot: (params) => agentTools.getInventorySnapshot(params.scope),
  getLowStockItems: (params) => agentTools.getLowStockItems(params.limit, params.scope),
  getExpiringLots: (params) => agentTools.getExpiringLots(params.days, params.limit, params.scope),
  getRecentTransactions: (params) => agentTools.getRecentTransactions(params.limit, params.scope),
  getItemSnapshots: (params) => agentTools.getItemSnapshots(params.searchTerm, params.limit),
  getBinOverview: (params) => agentTools.getBinOverview(params.searchTerm, params.limit),
  getDrilldownContext: (params) => agentTools.getDrilldownContext(params),
  getSuggestionSummary: (params) => agentTools.getSuggestionSummary(params.limit)
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toISOString().slice(0, 10)
}

const isChinesePrompt = (value) => /[\u3400-\u9fff]/u.test(String(value || ''))

const formatScopeLabel = (scope, preferChinese = false) => {
  if (!scope?.type || !scope?.searchTerm) return ''
  const typeLabel = scope.type === 'bin'
    ? preferChinese ? '存放位置' : 'bin'
    : preferChinese ? '商品' : 'item'
  return `${typeLabel} ${scope.searchTerm}`
}

const buildMetricsFromSnapshot = (snapshot) => {
  if (!snapshot) return []
  return [
    { label: 'Tracked Items', value: String(snapshot.tracked_items ?? 0), tone: 'blue' },
    { label: 'Live Lots', value: String(snapshot.live_lots ?? 0), tone: 'violet' },
    { label: 'Active Bins', value: String(snapshot.active_bins ?? 0), tone: 'teal' },
    { label: 'Utilization', value: `${snapshot.utilization ?? 0}%`, tone: 'slate' }
  ]
}

const buildToolSummary = (toolName, data) => {
  switch (toolName) {
    case 'getInventorySnapshot':
      return `${data.tracked_items} items, ${data.low_stock_items} low-stock signals, ${data.expiring_soon} lots expiring soon`
    case 'getLowStockItems':
      return `${data.length} item${data.length === 1 ? '' : 's'} below target`
    case 'getExpiringLots':
      return `${data.length} lot${data.length === 1 ? '' : 's'} with upcoming expiry`
    case 'getRecentTransactions':
      return `${data.length} recent warehouse events reviewed`
    case 'getItemSnapshots':
      return `${data.length} matching item snapshot${data.length === 1 ? '' : 's'} found`
    case 'getBinOverview':
      return `${data.length} storage bin${data.length === 1 ? '' : 's'} inspected`
    case 'getDrilldownContext':
      return data.target
        ? `Drill-down target: ${data.target.label || data.target.searchTerm}`
        : 'No previous target was available for drill-down'
    case 'getSuggestionSummary':
      return `${data.counters?.new || 0} new suggestion${data.counters?.new === 1 ? '' : 's'} waiting`
    default:
      return 'Tool completed successfully'
  }
}

const makeEvidence = (label, value, detail = '', tone = 'slate') => ({
  label,
  value: value === undefined || value === null || value === '' ? '—' : String(value),
  detail,
  tone
})

const pushEvidence = (evidence, ...items) => {
  items
    .filter(Boolean)
    .forEach((item) => evidence.push(item))
}

const buildResponseShape = (intent, results, prompt = '', plan = {}) => {
  const preferChinese = isChinesePrompt(prompt)
  const scopeLabel = formatScopeLabel(plan.scope, preferChinese)
  const scopedPrefix = scopeLabel
    ? preferChinese ? `在 ${scopeLabel} 范围内，` : `Within ${scopeLabel}, `
    : ''
  const snapshot = results.getInventorySnapshot
  const metrics = buildMetricsFromSnapshot(snapshot)
  const tables = []
  const evidence = []
  const nextActions = []
  let answer = 'I reviewed the current warehouse picture and prepared a safe read-only summary.'

  if (intent === 'overview') {
    const lowStock = results.getLowStockItems || []
    const expiring = results.getExpiringLots || []

    answer = snapshot
      ? preferChinese
        ? `${scopedPrefix}我检查了当前仓库状态：现在有 ${snapshot.tracked_items} 种商品，${snapshot.live_lots} 个有效批次，当前有 ${snapshot.low_stock_items} 个低库存信号。`
        : `${scopedPrefix}I checked the live warehouse picture. There are ${snapshot.tracked_items} tracked items, ${snapshot.live_lots} active lots, and ${snapshot.low_stock_items} low-stock signals right now.`
      : preferChinese
        ? '我查看了当前仓库状态，并准备了一份只读摘要。'
        : answer

    if (lowStock.length) {
      tables.push({
        title: 'Low-stock priorities',
        columns: ['SKU', 'Item', 'Available', 'Min', 'Shortage'],
        rows: lowStock.map((item) => [item.sku, item.name, String(item.available_qty), String(item.min_stock), String(item.shortage)])
      })
      nextActions.push('Open Inventory and review the lowest-stock SKUs first.')
    }

    if (expiring.length) {
      tables.push({
        title: 'Lots nearing expiry',
        columns: ['Lot', 'SKU', 'Bin', 'Expiry', 'Days Left'],
        rows: expiring.map((lot) => [lot.lot_number, lot.sku, lot.bin, formatDate(lot.expiry_date), String(lot.days_left)])
      })
      nextActions.push('Check expiring lots and decide whether they should be consumed first.')
    }

    if (!nextActions.length) {
      nextActions.push(preferChinese
        ? '目前没有发现紧急问题，可以继续把这里作为仓库健康概览来查看。'
        : 'No urgent issues were found. You can keep using this view as a health snapshot.')
    }

    if (snapshot) {
      pushEvidence(
        evidence,
        makeEvidence('商品种类', snapshot.tracked_items, '来自当前 Inventory Snapshot', 'blue'),
        makeEvidence('有效批次', snapshot.live_lots, 'ACTIVE 状态的 lot 数量', 'violet'),
        makeEvidence('风险信号', snapshot.low_stock_items, `低库存 ${snapshot.low_stock_items} 个，临期 ${snapshot.expiring_soon} 个`, snapshot.low_stock_items || snapshot.expiring_soon ? 'amber' : 'mint')
      )
    }
  }

  if (intent === 'low_stock_review') {
    const lowStock = results.getLowStockItems || []
    answer = lowStock.length
      ? preferChinese
        ? `${scopedPrefix}我找到 ${lowStock.length} 个低于安全库存的 SKU，并按缺口大小排好了优先级。`
        : `${scopedPrefix}I found ${lowStock.length} SKU${lowStock.length === 1 ? '' : 's'} below target. I ranked them by shortage so you can replenish the most urgent ones first.`
      : preferChinese
        ? `${scopedPrefix}我检查了当前库存，没有发现低于安全库存的 SKU。`
        : `${scopedPrefix}I checked the current stock levels and did not find any SKU below its minimum target.`

    tables.push({
      title: 'Low-stock review',
      columns: ['SKU', 'Item', 'Available', 'Min', 'Shortage', 'Bins'],
      rows: lowStock.map((item) => [
        item.sku,
        item.name,
        String(item.available_qty),
        String(item.min_stock),
        String(item.shortage),
        String(item.bin_count)
      ])
    })
    nextActions.push(lowStock.length
      ? preferChinese ? '建议优先从缺口最大的前两项开始补货。' : 'Start replenishment from the first two rows.'
      : preferChinese ? '现在暂时不需要补货。' : 'No replenishment task is needed right now.')

    const firstLowStock = lowStock[0]
    pushEvidence(
      evidence,
      makeEvidence('低库存数量', lowStock.length, '按安全库存阈值筛选', lowStock.length ? 'amber' : 'mint'),
      firstLowStock && makeEvidence('最大缺口', `${firstLowStock.shortage} pcs`, `${firstLowStock.sku} · ${firstLowStock.name}`, 'red'),
      firstLowStock && makeEvidence('当前库存', `${firstLowStock.available_qty} pcs`, `最低库存目标 ${firstLowStock.min_stock} pcs`, 'blue')
    )
  }

  if (intent === 'expiry_watch') {
    const expiring = results.getExpiringLots || []
    answer = expiring.length
      ? preferChinese
        ? `${scopedPrefix}我找到 ${expiring.length} 个即将到期的有效批次。`
        : `${scopedPrefix}I found ${expiring.length} active lot${expiring.length === 1 ? '' : 's'} with expiry dates coming up soon.`
      : preferChinese
        ? `${scopedPrefix}我检查了有效批次，当前没有发现临期批次。`
        : `${scopedPrefix}I checked the active lots and did not find any that are close to expiry in the selected window.`

    tables.push({
      title: 'Expiry watch',
      columns: ['Lot', 'Item', 'Qty', 'Bin', 'Expiry', 'Days Left'],
      rows: expiring.map((lot) => [
        lot.lot_number,
        lot.item_name,
        String(lot.qty),
        lot.bin,
        formatDate(lot.expiry_date),
        String(lot.days_left)
      ])
    })
    nextActions.push(expiring.length
      ? preferChinese ? '建议按 FEFO 先使用最早到期的批次。' : 'Use FEFO for the earliest lots first.'
      : preferChinese ? '现在暂时不需要处理临期风险。' : 'No expiry action is needed right now.')

    const earliestLot = expiring[0]
    pushEvidence(
      evidence,
      makeEvidence('临期批次数', expiring.length, '按到期日升序检查有效批次', expiring.length ? 'amber' : 'mint'),
      earliestLot && makeEvidence('最早到期', `${earliestLot.days_left} 天`, `${earliestLot.lot_number} · ${formatDate(earliestLot.expiry_date)}`, earliestLot.days_left <= 7 ? 'red' : 'amber'),
      earliestLot && makeEvidence('所在位置', earliestLot.bin, `${earliestLot.item_name} · ${earliestLot.qty} pcs`, 'blue')
    )
  }

  if (intent === 'recent_activity') {
    const activity = results.getRecentTransactions || []
    answer = activity.length
      ? preferChinese
        ? `${scopedPrefix}我查看了最近 ${activity.length} 条仓库操作记录，方便你确认最近的库存变化。`
        : `${scopedPrefix}I reviewed the ${activity.length} most recent warehouse events so you can see what changed most recently.`
      : preferChinese
        ? `${scopedPrefix}目前还没有可显示的近期仓库操作记录。`
        : `${scopedPrefix}There is no recent activity to show yet.`

    tables.push({
      title: 'Recent activity',
      columns: ['Time', 'Type', 'SKU', 'Qty', 'Location', 'Operator'],
      rows: activity.map((row) => [
        formatDate(row.timestamp),
        row.type,
        row.sku,
        String(row.qty),
        row.location,
        row.operator
      ])
    })
    nextActions.push(activity.length
      ? preferChinese ? '如果需要完整审计链路，可以打开 Inventory History 查看。' : 'Open Inventory History if you need the full audit trail.'
      : preferChinese ? '之后发生扫码或库存操作时，记录会自动出现在这里。' : 'Once scans happen, activity will appear here automatically.')

    const latestActivity = activity[0]
    pushEvidence(
      evidence,
      makeEvidence('近期记录数', activity.length, '按操作时间倒序读取', activity.length ? 'blue' : 'slate'),
      latestActivity && makeEvidence('最新操作', latestActivity.type, `${latestActivity.sku || '—'} · ${latestActivity.location || '—'}`, 'violet'),
      latestActivity && makeEvidence('操作者', latestActivity.operator || '—', formatDate(latestActivity.timestamp), 'mint')
    )
  }

  if (intent === 'item_lookup') {
    const items = results.getItemSnapshots || []
    answer = items.length
      ? preferChinese
        ? `我找到 ${items.length} 个匹配的商品记录，并整理了它们的库存覆盖情况。`
        : `I found ${items.length} matching item snapshot${items.length === 1 ? '' : 's'} and summarized their stock coverage below.`
      : preferChinese
        ? '我没有找到匹配这个搜索条件的商品。'
        : 'I could not find a matching item with the current search term.'

    tables.push({
      title: 'Item lookup',
      columns: ['SKU', 'Item', 'Available', 'Low Stock', 'Bins', 'Top Lots'],
      rows: items.map((item) => [
        item.sku,
        item.name,
        String(item.available_qty),
        item.low_stock ? 'Yes' : 'No',
        String(item.bin_count),
        item.lots.slice(0, 2).map((lot) => `${lot.lot_number} (${lot.bin})`).join(', ') || '—'
      ])
    })
    nextActions.push(items.length
      ? preferChinese ? '如果要操作具体批次，可以扫描或打开对应商品。' : 'Scan or open the matching item if you want to operate on a specific lot.'
      : preferChinese ? '可以换一个更明确的 SKU 或商品名再试。' : 'Try a clearer SKU or item name.')

    const firstItem = items[0]
    pushEvidence(
      evidence,
      makeEvidence('匹配商品', items.length, '按 SKU、条码或商品名查询', items.length ? 'blue' : 'slate'),
      firstItem && makeEvidence('可用库存', `${firstItem.available_qty} pcs`, `${firstItem.sku} · ${firstItem.name}`, firstItem.low_stock ? 'amber' : 'mint'),
      firstItem && makeEvidence('位置覆盖', `${firstItem.bin_count} bins`, firstItem.lots.slice(0, 2).map((lot) => `${lot.bin}: ${lot.qty}`).join(' / ') || '暂无批次', 'violet')
    )
  }

  if (intent === 'drill_down') {
    const detail = results.getDrilldownContext || {}
    const target = detail.target
    const targetLabel = target?.label || target?.searchTerm || (preferChinese ? '上一轮结果' : 'the previous result')

    answer = target
      ? preferChinese
        ? `我展开了 ${targetLabel} 的详细信息，并补充了库存、位置、批次和近期操作证据。`
        : `I expanded ${targetLabel} and pulled together stock, location, lot, and recent activity evidence.`
      : preferChinese
        ? '我还没有可以展开的上一轮结果。你可以先查一个商品、批次或 Bin，再问“展开第一个”。'
        : 'I do not have a previous result to drill into yet. Ask for an item, lot, or bin first, then say “expand the first one”.'

    if ((detail.lots || []).length) {
      tables.push({
        title: 'Lot detail',
        columns: ['Field', 'Value'],
        rows: (detail.lots || []).slice(0, 1).flatMap((lot) => [
          ['Lot', lot.lot_number],
          ['SKU', lot.sku],
          ['Item', lot.item_name],
          ['Qty', String(lot.qty)],
          ['Bin', lot.bin],
          ['Zone', lot.zone],
          ['Temp', lot.temperature_zone],
          ['Status', lot.status],
          ['Expiry', formatDate(lot.expiry_date)],
          ['Days Left', lot.days_left === null ? '—' : String(lot.days_left)]
        ])
      })
    }

    if ((detail.items || []).length) {
      tables.push({
        title: 'Item lookup',
        columns: ['SKU', 'Item', 'Available', 'Low Stock', 'Bins', 'Top Lots'],
        rows: detail.items.map((item) => [
          item.sku,
          item.name,
          String(item.available_qty),
          item.low_stock ? 'Yes' : 'No',
          String(item.bin_count),
          item.lots.slice(0, 3).map((lot) => `${lot.lot_number} (${lot.bin}, ${lot.qty})`).join(', ') || '—'
        ])
      })
    }

    if ((detail.bins || []).length) {
      tables.push({
        title: 'Bin overview',
        columns: ['Bin', 'Zone', 'Temp', 'Used', 'Capacity', 'Utilization'],
        rows: detail.bins.map((bin) => [
          bin.bin_code,
          bin.zone,
          bin.temperature_zone,
          String(bin.used),
          String(bin.capacity),
          `${bin.utilization}%`
        ])
      })
    }

    if ((detail.expiring_lots || []).length) {
      tables.push({
        title: 'Related expiry watch',
        columns: ['Lot', 'Item', 'Qty', 'Bin', 'Expiry', 'Days Left'],
        rows: detail.expiring_lots.map((lot) => [
          lot.lot_number,
          lot.item_name,
          String(lot.qty),
          lot.bin,
          formatDate(lot.expiry_date),
          String(lot.days_left)
        ])
      })
    }

    if ((detail.recent_activity || []).length) {
      tables.push({
        title: 'Recent activity',
        columns: ['Time', 'Type', 'SKU', 'Qty', 'Location', 'Operator'],
        rows: detail.recent_activity.map((row) => [
          formatDate(row.timestamp),
          row.type,
          row.sku,
          String(row.qty),
          row.location,
          row.operator
        ])
      })
    }

    nextActions.push(target
      ? preferChinese
        ? '你可以继续问“最近是谁操作的”“它在哪个 Bin”“为什么要优先处理”。'
        : 'You can continue with “who handled it recently”, “which bin is it in”, or “why should it be prioritized”.'
      : preferChinese
        ? '先查询一个具体商品、批次或 Bin，再让我展开。'
        : 'Look up a concrete item, lot, or bin first, then ask me to expand it.')

    const primaryLot = (detail.lots || [])[0]
    const primaryItem = (detail.items || [])[0]
    const primaryBin = (detail.bins || [])[0]
    pushEvidence(
      evidence,
      target && makeEvidence('展开对象', target.label || target.searchTerm, target.type, 'blue'),
      primaryLot && makeEvidence('批次数量', `${primaryLot.qty} pcs`, `${primaryLot.lot_number} · ${primaryLot.bin}`, 'violet'),
      primaryItem && makeEvidence('商品库存', `${primaryItem.available_qty} pcs`, `${primaryItem.sku} · ${primaryItem.name}`, primaryItem.low_stock ? 'amber' : 'mint'),
      primaryBin && makeEvidence('Bin 利用率', `${primaryBin.utilization}%`, `${primaryBin.used}/${primaryBin.capacity} used`, primaryBin.utilization >= 80 ? 'amber' : 'mint'),
      (detail.recent_activity || []).length && makeEvidence('近期操作', detail.recent_activity.length, '与该对象相关的最近记录', 'slate')
    )
  }

  if (intent === 'bin_lookup') {
    const bins = results.getBinOverview || []
    answer = bins.length
      ? preferChinese
        ? `我查看了 ${bins.length} 个匹配的存放位置，并整理了当前利用率。`
        : `I reviewed ${bins.length} storage bin${bins.length === 1 ? '' : 's'} and summarized current utilization.`
      : preferChinese
        ? '我没有找到匹配这个搜索条件的 Bin。'
        : 'I could not find a matching bin with the current search term.'

    tables.push({
      title: 'Bin overview',
      columns: ['Bin', 'Zone', 'Temp', 'Used', 'Capacity', 'Utilization'],
      rows: bins.map((bin) => [
        bin.bin_code,
        bin.zone,
        bin.temperature_zone,
        String(bin.used),
        String(bin.capacity),
        `${bin.utilization}%`
      ])
    })
    nextActions.push(bins.length
      ? preferChinese ? '可以用这个视图判断新的入库商品适合放到哪里。' : 'Use this view to decide where new inbound stock should go.'
      : preferChinese ? '可以尝试更明确的 Bin 名称，例如 Refrigerator 或 bookshelf。' : 'Try searching by a clearer bin code like Refrigerator or bookshelf.')

    const firstBin = bins[0]
    pushEvidence(
      evidence,
      makeEvidence('匹配 Bin', bins.length, '按 Bin 名称、区域或温区查询', bins.length ? 'blue' : 'slate'),
      firstBin && makeEvidence('利用率', `${firstBin.utilization}%`, `${firstBin.used}/${firstBin.capacity} used`, firstBin.utilization >= 80 ? 'amber' : 'mint'),
      firstBin && makeEvidence('批次覆盖', `${firstBin.lot_count} lots`, `${firstBin.zone} · ${firstBin.temperature_zone}`, 'violet')
    )
  }

  if (intent === 'suggestion_watch') {
    const summary = results.getSuggestionSummary || { counters: {}, recent: [] }
    answer = preferChinese
      ? `我查看了建议队列：现在有 ${summary.counters?.new || 0} 条新建议，${summary.counters?.under_review || 0} 条审核中，${summary.counters?.planned || 0} 条已计划。`
      : `I checked the suggestion pipeline. There are ${summary.counters?.new || 0} new suggestions, ${summary.counters?.under_review || 0} under review, and ${summary.counters?.planned || 0} already planned.`

    metrics.push(
      { label: 'New Suggestions', value: String(summary.counters?.new || 0), tone: 'amber' },
      { label: 'Under Review', value: String(summary.counters?.under_review || 0), tone: 'blue' },
      { label: 'Planned', value: String(summary.counters?.planned || 0), tone: 'mint' }
    )

    tables.push({
      title: 'Recent suggestions',
      columns: ['Title', 'Requested Item', 'Category', 'Status', 'Created'],
      rows: (summary.recent || []).map((row) => [
        row.title,
        row.desired_item,
        row.category,
        row.status,
        formatDate(row.created_at)
      ])
    })
    nextActions.push(preferChinese
      ? '如有需要，可以到 Suggestions 页面审核并回复新的饮品请求。'
      : 'Review new drink requests and reply from the Suggestions page if needed.')

    pushEvidence(
      evidence,
      makeEvidence('新建议', summary.counters?.new || 0, '等待管理员查看', summary.counters?.new ? 'amber' : 'mint'),
      makeEvidence('审核中', summary.counters?.under_review || 0, '正在处理的建议', 'blue'),
      makeEvidence('已计划', summary.counters?.planned || 0, '已经进入计划队列', 'violet')
    )
  }

  return { answer, metrics, evidence, tables, nextActions }
}

exports.getContext = async (req, res) => {
  try {
    const context = await agentTools.getAgentContext()
    const llm = getLlmStatus()

    return res.json({
      success: true,
      mode: llm.mode,
      status: 'connected',
      llm,
      snapshot: context.snapshot,
      metrics: buildMetricsFromSnapshot(context.snapshot),
      capabilities: context.capabilities
    })
  } catch (error) {
    console.error('AI Agent Context Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to load agent context',
      error: error.message
    })
  }
}

exports.handleQuery = async (req, res) => {
  try {
    const { prompt, context = {} } = req.body

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a question for the agent.'
      })
    }

    const plan = planAgentQuery(prompt, context)
    const results = {}
    const toolCalls = []

    for (const tool of plan.tools) {
      const runner = TOOL_RUNNERS[tool.name]
      if (!runner) continue

      const data = await runner(tool.params || {})
      results[tool.name] = data
      toolCalls.push({
        name: tool.name,
        label: TOOL_LABELS[tool.name] || tool.name,
        status: 'completed',
        summary: buildToolSummary(tool.name, data)
      })
    }

    const shaped = buildResponseShape(plan.intent, results, prompt, plan)
    const llm = await generateAgentNarrative({
      prompt,
      plan,
      toolCalls,
      shaped
    })

    const responseShape = {
      ...shaped,
      answer: llm.used && llm.answer ? llm.answer : shaped.answer,
      nextActions: llm.used && llm.nextActions?.length ? llm.nextActions : shaped.nextActions
    }

    return res.json({
      success: true,
      mode: llm.mode || plan.mode,
      intent: plan.intent,
      searchTerm: plan.searchTerm,
      scope: plan.scope,
      entity: plan.entity,
      planner: plan.planner,
      plan: plan.steps,
      toolCalls,
      llm,
      answer: responseShape.answer,
      metrics: responseShape.metrics,
      evidence: responseShape.evidence,
      tables: responseShape.tables,
      nextActions: responseShape.nextActions
    })
  } catch (error) {
    console.error('AI Agent Query Error:', error)
    return res.status(500).json({
      success: false,
      message: 'The agent could not complete this request right now.',
      error: error.message
    })
  }
}
