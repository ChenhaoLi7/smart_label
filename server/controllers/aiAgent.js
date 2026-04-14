const agentTools = require('../services/agentTools')
const { planAgentQuery } = require('../services/agentPlanner')

const TOOL_LABELS = {
  getInventorySnapshot: 'Inventory Snapshot',
  getLowStockItems: 'Low-Stock Scan',
  getExpiringLots: 'Expiry Watch',
  getRecentTransactions: 'Recent Activity',
  getItemSnapshots: 'Item Lookup',
  getBinOverview: 'Bin Review',
  getSuggestionSummary: 'Suggestion Watch'
}

const TOOL_RUNNERS = {
  getInventorySnapshot: (params) => agentTools.getInventorySnapshot(params),
  getLowStockItems: (params) => agentTools.getLowStockItems(params.limit),
  getExpiringLots: (params) => agentTools.getExpiringLots(params.days, params.limit),
  getRecentTransactions: (params) => agentTools.getRecentTransactions(params.limit),
  getItemSnapshots: (params) => agentTools.getItemSnapshots(params.searchTerm, params.limit),
  getBinOverview: (params) => agentTools.getBinOverview(params.searchTerm, params.limit),
  getSuggestionSummary: (params) => agentTools.getSuggestionSummary(params.limit)
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toISOString().slice(0, 10)
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
    case 'getSuggestionSummary':
      return `${data.counters?.new || 0} new suggestion${data.counters?.new === 1 ? '' : 's'} waiting`
    default:
      return 'Tool completed successfully'
  }
}

const buildResponseShape = (intent, results) => {
  const snapshot = results.getInventorySnapshot
  const metrics = buildMetricsFromSnapshot(snapshot)
  const tables = []
  const nextActions = []
  let answer = 'I reviewed the current warehouse picture and prepared a safe read-only summary.'

  if (intent === 'overview') {
    const lowStock = results.getLowStockItems || []
    const expiring = results.getExpiringLots || []

    answer = snapshot
      ? `I checked the live warehouse picture. There are ${snapshot.tracked_items} tracked items, ${snapshot.live_lots} active lots, and ${snapshot.low_stock_items} low-stock signals right now.`
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
      nextActions.push('No urgent issues were found. You can keep using this view as a health snapshot.')
    }
  }

  if (intent === 'low_stock_review') {
    const lowStock = results.getLowStockItems || []
    answer = lowStock.length
      ? `I found ${lowStock.length} SKU${lowStock.length === 1 ? '' : 's'} below target. I ranked them by shortage so you can replenish the most urgent ones first.`
      : 'I checked the current stock levels and did not find any SKU below its minimum target.'

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
    nextActions.push(lowStock.length ? 'Start replenishment from the first two rows.' : 'No replenishment task is needed right now.')
  }

  if (intent === 'expiry_watch') {
    const expiring = results.getExpiringLots || []
    answer = expiring.length
      ? `I found ${expiring.length} active lot${expiring.length === 1 ? '' : 's'} with expiry dates coming up soon.`
      : 'I checked the active lots and did not find any that are close to expiry in the selected window.'

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
    nextActions.push(expiring.length ? 'Use FEFO for the earliest lots first.' : 'No expiry action is needed right now.')
  }

  if (intent === 'recent_activity') {
    const activity = results.getRecentTransactions || []
    answer = activity.length
      ? `I reviewed the ${activity.length} most recent warehouse events so you can see what changed most recently.`
      : 'There is no recent activity to show yet.'

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
    nextActions.push(activity.length ? 'Open Inventory History if you need the full audit trail.' : 'Once scans happen, activity will appear here automatically.')
  }

  if (intent === 'item_lookup') {
    const items = results.getItemSnapshots || []
    answer = items.length
      ? `I found ${items.length} matching item snapshot${items.length === 1 ? '' : 's'} and summarized their stock coverage below.`
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
    nextActions.push(items.length ? 'Scan or open the matching item if you want to operate on a specific lot.' : 'Try a clearer SKU or item name.')
  }

  if (intent === 'bin_lookup') {
    const bins = results.getBinOverview || []
    answer = bins.length
      ? `I reviewed ${bins.length} storage bin${bins.length === 1 ? '' : 's'} and summarized current utilization.`
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
    nextActions.push(bins.length ? 'Use this view to decide where new inbound stock should go.' : 'Try searching by a clearer bin code like Refrigerator or bookshelf.')
  }

  if (intent === 'suggestion_watch') {
    const summary = results.getSuggestionSummary || { counters: {}, recent: [] }
    answer = `I checked the suggestion pipeline. There are ${summary.counters?.new || 0} new suggestions, ${summary.counters?.under_review || 0} under review, and ${summary.counters?.planned || 0} already planned.`

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
    nextActions.push('Review new drink requests and reply from the Suggestions page if needed.')
  }

  return { answer, metrics, tables, nextActions }
}

exports.getContext = async (req, res) => {
  try {
    const context = await agentTools.getAgentContext()

    return res.json({
      success: true,
      mode: 'read_only_agent',
      status: 'connected',
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
    const { prompt } = req.body

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a question for the agent.'
      })
    }

    const plan = planAgentQuery(prompt)
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

    const shaped = buildResponseShape(plan.intent, results)

    return res.json({
      success: true,
      mode: plan.mode,
      intent: plan.intent,
      plan: plan.steps,
      toolCalls,
      answer: shaped.answer,
      metrics: shaped.metrics,
      tables: shaped.tables,
      nextActions: shaped.nextActions
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
