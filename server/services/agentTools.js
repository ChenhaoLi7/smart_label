const { Op } = require('sequelize')
const { Item, Lot, Bin, Transaction, Suggestion } = require('../models')

const ACTIVE_LOT_STATUSES = new Set(['ACTIVE', 'PENDING', 'PASSED'])

const toNumber = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

const getActiveLots = (lots = []) => lots.filter((lot) => ACTIVE_LOT_STATUSES.has(lot.status || 'ACTIVE'))

const mapItemRollup = (item) => {
  const activeLots = getActiveLots(item.lots || [])
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

const fetchItemsWithLots = async (searchTerm = '', limit = 12) => {
  const where = { status: 'ACTIVE' }
  const trimmed = String(searchTerm || '').trim()

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
    limit
  })

  return items.map(mapItemRollup)
}

const getInventorySnapshot = async () => {
  const [items, liveLots, bins, recentTransactions, suggestions] = await Promise.all([
    Item.findAll({
      where: { status: 'ACTIVE' },
      include: [{ model: Lot, as: 'lots', required: false }]
    }),
    Lot.count({ where: { status: 'ACTIVE' } }),
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

  const rollups = items.map(mapItemRollup)
  const lowStockCount = rollups.filter((item) => item.low_stock).length
  const expiringSoonCount = await Lot.count({
    where: {
      status: 'ACTIVE',
      expiry_date: {
        [Op.between]: [new Date(), new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)]
      }
    }
  })

  const utilization = bins.length
    ? Math.round(
        bins.reduce((sum, bin) => {
          const used = (bin.lots || []).reduce((lotSum, lot) => lotSum + toNumber(lot.qty), 0)
          return sum + (toNumber(bin.capacity) > 0 ? (used / toNumber(bin.capacity)) * 100 : 0)
        }, 0) / bins.length
      )
    : 0

  return {
    tracked_items: rollups.length,
    live_lots: liveLots,
    active_bins: bins.length,
    low_stock_items: lowStockCount,
    expiring_soon: expiringSoonCount,
    new_suggestions: suggestions,
    recent_activity: recentTransactions,
    utilization
  }
}

const getLowStockItems = async (limit = 6) => {
  const items = await fetchItemsWithLots('', Math.max(limit * 3, 12))
  return items
    .filter((item) => item.low_stock)
    .sort((a, b) => b.shortage - a.shortage || a.available_qty - b.available_qty)
    .slice(0, limit)
}

const getExpiringLots = async (days = 14, limit = 6) => {
  const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

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
    limit
  })

  return lots.map((lot) => ({
    lot_number: lot.lot_number,
    sku: lot.sku,
    item_name: lot.item?.name || lot.sku,
    qty: toNumber(lot.qty),
    bin: lot.bin?.bin_code || '—',
    expiry_date: lot.expiry_date,
    days_left: Math.max(0, Math.ceil((new Date(lot.expiry_date) - new Date()) / (24 * 60 * 60 * 1000)))
  }))
}

const getRecentTransactions = async (limit = 8) => {
  const rows = await Transaction.findAll({
    order: [['transactionTime', 'DESC']],
    limit
  })

  return rows.map((row) => ({
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
  getSuggestionSummary
}
