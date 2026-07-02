const { Op } = require('sequelize')
const { Item, Lot, Bin, Transaction, Suggestion } = require('../models')

const ACTIVE_LOT_STATUSES = new Set(['ACTIVE', 'PENDING', 'PASSED'])

const toNumber = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

const getActiveLots = (lots = []) => lots.filter((lot) => ACTIVE_LOT_STATUSES.has(lot.status || 'ACTIVE'))

const normalizeScope = (scope = {}) => {
  const type = String(scope.type || scope.scopeType || '').trim().toLowerCase()
  const searchTerm = String(scope.searchTerm || scope.term || '').trim()
  return type && searchTerm ? { type, searchTerm } : null
}

const includesTerm = (value, term) => (
  String(value || '').toLowerCase().includes(String(term || '').toLowerCase())
)

const itemMatchesScope = (item, scope) => {
  const normalizedScope = normalizeScope(scope)
  if (!normalizedScope) return true

  const { type, searchTerm } = normalizedScope

  if (type !== 'item') return false

  return [
    item.sku,
    item.name,
    item.description,
    item.category
  ].some((value) => includesTerm(value, searchTerm))
}

const lotMatchesScope = (lot, scope, item = null) => {
  const normalizedScope = normalizeScope(scope)
  if (!normalizedScope) return true

  const { type, searchTerm } = normalizedScope

  if (type === 'bin') {
    return [
      lot.bin?.bin_code,
      lot.bin?.zone,
      lot.bin?.temperature_zone
    ].some((value) => includesTerm(value, searchTerm))
  }

  if (type === 'item') {
    return [
      lot.sku,
      lot.lot_number,
      lot.item?.sku,
      lot.item?.name,
      item?.sku,
      item?.name,
      item?.description,
      item?.category
    ].some((value) => includesTerm(value, searchTerm))
  }

  if (type === 'lot') {
    return [
      lot.lot_number
    ].some((value) => includesTerm(value, searchTerm))
  }

  return true
}

const transactionMatchesScope = (row, scope) => {
  const normalizedScope = normalizeScope(scope)
  if (!normalizedScope) return true

  const { type, searchTerm } = normalizedScope

  if (type === 'bin') {
    return [
      row.location,
      row.notes
    ].some((value) => includesTerm(value, searchTerm))
  }

  if (type === 'item') {
    return [
      row.itemCode,
      row.itemName,
      row.scanCode,
      row.notes
    ].some((value) => includesTerm(value, searchTerm))
  }

  if (type === 'lot') {
    return [
      row.scanCode,
      row.notes,
      row.location
    ].some((value) => includesTerm(value, searchTerm))
  }

  return true
}

const mapItemRollup = (item, scope = null) => {
  const activeLots = getActiveLots(item.lots || []).filter((lot) => lotMatchesScope(lot, scope, item))
  const totalQty = activeLots.reduce((sum, lot) => sum + toNumber(lot.qty), 0)
  const minStock = toNumber(item.min_stock)

  return {
    sku: item.sku,
    name: item.name,
    category: item.category || 'Uncategorized',
    unit: item.uom || 'pcs',
    price: item.price !== null && item.price !== undefined ? Number(item.price) : null,
    min_stock: minStock,
    max_stock: item.max_stock !== null && item.max_stock !== undefined ? Number(item.max_stock) : null,
    available_qty: totalQty,
    bin_count: new Set(activeLots.map((lot) => lot.bin_id).filter(Boolean)).size,
    low_stock: minStock > 0 && totalQty < minStock,
    shortage: minStock > 0 ? Math.max(minStock - totalQty, 0) : 0,
    lots: activeLots.map((lot) => ({
      lot_number: lot.lot_number,
      qty: toNumber(lot.qty),
      status: lot.status || 'ACTIVE',
      expiry_date: lot.expiry_date,
      bin: lot.bin?.bin_code || '—'
    }))
  }
}

const fetchItemsWithLots = async (searchTerm = '', limit = 12, scope = null) => {
  const where = { status: 'ACTIVE' }
  const trimmed = String(searchTerm || '').trim()
  const normalizedScope = normalizeScope(scope)

  if (trimmed) {
    where[Op.or] = [
      { sku: { [Op.like]: `%${trimmed}%` } },
      { name: { [Op.like]: `%${trimmed}%` } },
      { description: { [Op.like]: `%${trimmed}%` } },
      { category: { [Op.like]: `%${trimmed}%` } }
    ]
  }

  const items = await Item.findAll({
    where,
    include: [
      {
        model: Lot,
        as: 'lots',
        required: false,
        include: [{ model: Bin, as: 'bin', attributes: ['bin_code'] }]
      }
    ],
    order: [['updatedAt', 'DESC']],
    limit: normalizedScope ? Math.max(limit * 8, 50) : limit
  })

  const rollups = items.map((item) => mapItemRollup(item, normalizedScope))

  if (!normalizedScope) return rollups

  return rollups.filter((rollup, index) => (
    rollup.lots.length > 0 || itemMatchesScope(items[index], normalizedScope)
  )).slice(0, limit)
}

const getInventorySnapshot = async (scope = null) => {
  const normalizedScope = normalizeScope(scope)
  const [items, liveLots, bins, recentTransactions, suggestions] = await Promise.all([
    Item.findAll({
      where: { status: 'ACTIVE' },
      include: [
        {
          model: Lot,
          as: 'lots',
          required: false,
          include: [{ model: Bin, as: 'bin', attributes: ['bin_code', 'zone', 'temperature_zone'] }]
        }
      ]
    }),
    normalizedScope
      ? Lot.findAll({
          where: { status: 'ACTIVE' },
          include: [
            { model: Item, as: 'item', attributes: ['sku', 'name'] },
            { model: Bin, as: 'bin', attributes: ['bin_code', 'zone', 'temperature_zone'] }
          ]
        })
      : Lot.count({ where: { status: 'ACTIVE' } }),
    Bin.findAll({
      where: { status: 'ACTIVE' },
      include: [{ model: Lot, as: 'lots', required: false }]
    }),
    Transaction.count({
      where: {
        transactionTime: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    }),
    Suggestion.count({ where: { status: 'NEW' } })
  ])

  const scopedItems = normalizedScope
    ? items.filter((item) => itemMatchesScope(item, normalizedScope) || getActiveLots(item.lots || []).some((lot) => lotMatchesScope(lot, normalizedScope, item)))
    : items
  const rollups = scopedItems.map((item) => mapItemRollup(item, normalizedScope))
  const lowStockCount = rollups.filter((item) => item.low_stock).length
  const expiringEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const expiringSoonCount = normalizedScope
    ? liveLots.filter((lot) => (
        lotMatchesScope(lot, normalizedScope) &&
        lot.expiry_date &&
        new Date(lot.expiry_date) >= new Date() &&
        new Date(lot.expiry_date) <= expiringEnd
      )).length
    : await Lot.count({
        where: {
          status: 'ACTIVE',
          expiry_date: {
            [Op.between]: [new Date(), expiringEnd]
          }
        }
      })

  const scopedBins = normalizedScope?.type === 'bin'
    ? bins.filter((bin) => [
        bin.bin_code,
        bin.zone,
        bin.temperature_zone
      ].some((value) => includesTerm(value, normalizedScope.searchTerm)))
    : bins

  const utilization = scopedBins.length
    ? Math.round(
        scopedBins.reduce((sum, bin) => {
          const used = (bin.lots || []).reduce((lotSum, lot) => lotSum + toNumber(lot.qty), 0)
          return sum + (toNumber(bin.capacity) > 0 ? (used / toNumber(bin.capacity)) * 100 : 0)
        }, 0) / scopedBins.length
      )
    : 0

  return {
    tracked_items: rollups.length,
    live_lots: normalizedScope ? liveLots.filter((lot) => lotMatchesScope(lot, normalizedScope)).length : liveLots,
    active_bins: normalizedScope?.type === 'bin' ? scopedBins.length : bins.length,
    low_stock_items: lowStockCount,
    expiring_soon: expiringSoonCount,
    new_suggestions: suggestions,
    recent_activity: recentTransactions,
    utilization
  }
}

const getLowStockItems = async (limit = 6, scope = null) => {
  const items = await fetchItemsWithLots('', Math.max(limit * 3, 12), scope)
  return items
    .filter((item) => item.low_stock)
    .sort((a, b) => b.shortage - a.shortage || a.available_qty - b.available_qty)
    .slice(0, limit)
}

const getExpiringLots = async (days = 14, limit = 6, scope = null) => {
  const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  const normalizedScope = normalizeScope(scope)

  const lots = await Lot.findAll({
    where: {
      status: 'ACTIVE',
      expiry_date: {
        [Op.not]: null,
        [Op.between]: [new Date(), endDate]
      }
    },
    include: [
      { model: Item, as: 'item', attributes: ['sku', 'name'] },
      { model: Bin, as: 'bin', attributes: ['bin_code'] }
    ],
    order: [['expiry_date', 'ASC']],
    limit: normalizedScope ? Math.max(limit * 8, 50) : limit
  })

  return lots
    .filter((lot) => lotMatchesScope(lot, normalizedScope))
    .slice(0, limit)
    .map((lot) => ({
    lot_number: lot.lot_number,
    sku: lot.sku,
    item_name: lot.item?.name || lot.sku,
    qty: toNumber(lot.qty),
    bin: lot.bin?.bin_code || '—',
    expiry_date: lot.expiry_date,
    days_left: Math.max(0, Math.ceil((new Date(lot.expiry_date) - new Date()) / (24 * 60 * 60 * 1000)))
  }))
}

const getRecentTransactions = async (limit = 8, scope = null) => {
  const normalizedScope = normalizeScope(scope)
  const rows = await Transaction.findAll({
    order: [['transactionTime', 'DESC']],
    limit: normalizedScope ? Math.max(limit * 8, 80) : limit
  })

  return rows
    .filter((row) => transactionMatchesScope(row, normalizedScope))
    .slice(0, limit)
    .map((row) => ({
    id: row.id,
    type: row.notes?.startsWith('Cycle Count Adjustment:')
      ? 'COUNT'
      : row.notes?.startsWith('BIN_TRANSFER:')
        ? 'MOVE'
        : row.transactionType === 'in'
          ? 'INBOUND'
          : 'OUTBOUND',
    sku: row.itemCode,
    item_name: row.itemName,
    qty: toNumber(row.quantity),
    before_qty: row.beforeQuantity,
    after_qty: row.afterQuantity,
    operator: row.operator || 'System',
    location: row.location || '—',
    note: row.notes || '',
    timestamp: row.transactionTime
  }))
}

const getItemSnapshots = async (searchTerm, limit = 5) => {
  if (!String(searchTerm || '').trim()) return []
  return fetchItemsWithLots(searchTerm, limit)
}

const getBinOverview = async (searchTerm = '', limit = 6) => {
  const where = { status: 'ACTIVE' }
  const trimmed = String(searchTerm || '').trim()

  if (trimmed) {
    where[Op.or] = [
      { bin_code: { [Op.like]: `%${trimmed}%` } },
      { zone: { [Op.like]: `%${trimmed}%` } },
      { temperature_zone: { [Op.like]: `%${trimmed}%` } }
    ]
  }

  const rows = await Bin.findAll({
    where,
    include: [{ model: Lot, as: 'lots', required: false }],
    order: [['updatedAt', 'DESC']],
    limit
  })

  return rows.map((bin) => {
    const activeLots = getActiveLots(bin.lots || [])
    const used = activeLots.reduce((sum, lot) => sum + toNumber(lot.qty), 0)
    const capacity = toNumber(bin.capacity)
    return {
      bin_code: bin.bin_code,
      zone: bin.zone || '—',
      temperature_zone: bin.temperature_zone || '—',
      used,
      capacity,
      utilization: capacity > 0 ? Math.round((used / capacity) * 100) : 0,
      lot_count: activeLots.length
    }
  })
}

const getLotDetails = async (searchTerm = '') => {
  const trimmed = String(searchTerm || '').trim()
  if (!trimmed) return []

  const lots = await Lot.findAll({
    where: {
      lot_number: { [Op.like]: `%${trimmed}%` }
    },
    include: [
      { model: Item, as: 'item', attributes: ['sku', 'name', 'category', 'min_stock'] },
      { model: Bin, as: 'bin', attributes: ['bin_code', 'zone', 'temperature_zone', 'capacity'] }
    ],
    order: [['updatedAt', 'DESC']],
    limit: 5
  })

  return lots.map((lot) => ({
    lot_number: lot.lot_number,
    sku: lot.sku,
    item_name: lot.item?.name || lot.sku,
    category: lot.item?.category || '—',
    qty: toNumber(lot.qty),
    status: lot.status || 'ACTIVE',
    quality_status: lot.quality_status || '—',
    bin: lot.bin?.bin_code || '—',
    zone: lot.bin?.zone || '—',
    temperature_zone: lot.bin?.temperature_zone || '—',
    expiry_date: lot.expiry_date,
    days_left: lot.expiry_date
      ? Math.ceil((new Date(lot.expiry_date) - new Date()) / (24 * 60 * 60 * 1000))
      : null,
    updated_at: lot.updatedAt
  }))
}

const getDrilldownContext = async ({ entity = null, scope = null, limit = 6 } = {}) => {
  const target = normalizeScope(entity) || normalizeScope(scope)

  if (!target) {
    return {
      target: null,
      lots: [],
      items: [],
      bins: [],
      expiring_lots: [],
      low_stock_items: [],
      recent_activity: []
    }
  }

  if (target.type === 'lot') {
    const lots = await getLotDetails(target.searchTerm)
    const primaryLot = lots[0]
    const itemScope = primaryLot?.sku ? { type: 'item', searchTerm: primaryLot.sku } : null

    return {
      target: {
        ...target,
        label: primaryLot ? `${primaryLot.lot_number} · ${primaryLot.item_name}` : target.searchTerm
      },
      lots,
      items: itemScope ? await getItemSnapshots(itemScope.searchTerm, 1) : [],
      bins: primaryLot?.bin ? await getBinOverview(primaryLot.bin, 1) : [],
      expiring_lots: itemScope ? await getExpiringLots(60, limit, itemScope) : [],
      low_stock_items: itemScope ? await getLowStockItems(limit, itemScope) : [],
      recent_activity: await getRecentTransactions(limit, target)
    }
  }

  if (target.type === 'item') {
    return {
      target,
      lots: [],
      items: await getItemSnapshots(target.searchTerm, Math.min(limit, 5)),
      bins: [],
      expiring_lots: await getExpiringLots(60, limit, target),
      low_stock_items: await getLowStockItems(limit, target),
      recent_activity: await getRecentTransactions(limit, target)
    }
  }

  if (target.type === 'bin') {
    return {
      target,
      lots: [],
      items: await fetchItemsWithLots('', Math.min(limit, 8), target),
      bins: await getBinOverview(target.searchTerm, Math.min(limit, 5)),
      expiring_lots: await getExpiringLots(60, limit, target),
      low_stock_items: await getLowStockItems(limit, target),
      recent_activity: await getRecentTransactions(limit, target)
    }
  }

  return {
    target,
    lots: [],
    items: [],
    bins: [],
    expiring_lots: [],
    low_stock_items: [],
    recent_activity: await getRecentTransactions(limit, target)
  }
}

const getSuggestionSummary = async (limit = 5) => {
  const [newCount, reviewCount, plannedCount, recent] = await Promise.all([
    Suggestion.count({ where: { status: 'NEW' } }),
    Suggestion.count({ where: { status: 'UNDER_REVIEW' } }),
    Suggestion.count({ where: { status: 'PLANNED' } }),
    Suggestion.findAll({
      order: [['createdAt', 'DESC']],
      limit
    })
  ])

  return {
    counters: {
      new: newCount,
      under_review: reviewCount,
      planned: plannedCount
    },
    recent: recent.map((suggestion) => ({
      title: suggestion.title,
      desired_item: suggestion.desired_item,
      category: suggestion.category,
      status: suggestion.status,
      created_at: suggestion.createdAt
    }))
  }
}

const getAgentContext = async () => ({
  snapshot: await getInventorySnapshot(),
  capabilities: [
    {
      name: 'Inventory overview',
      description: 'Summarize stock health, active lots, bin readiness, and recent activity.'
    },
    {
      name: 'Low-stock review',
      description: 'Find items below minimum stock and surface replenishment priorities.'
    },
    {
      name: 'Expiry monitoring',
      description: 'Highlight lots that expire soon with bin-level traceability.'
    },
    {
      name: 'Bin insights',
      description: 'Inspect refrigerator, shelf, and other storage locations safely.'
    },
    {
      name: 'Suggestion watch',
      description: 'Review new drink requests and current suggestion pipeline.'
    }
  ]
})

module.exports = {
  getAgentContext,
  getInventorySnapshot,
  getLowStockItems,
  getExpiringLots,
  getRecentTransactions,
  getItemSnapshots,
  getBinOverview,
  getDrilldownContext,
  getSuggestionSummary
}
