// Public read-only product catalog for the shop entry page.
// Only ACTIVE items and a fixed whitelist of display fields; no stock, cost or supplier data.
const { Op } = require('sequelize')
const { Item } = require('../models')

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 50
const MAX_DESCRIPTION_LENGTH = 240

const parsePositiveInteger = (value, fallback) => {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

const listCatalogItems = async (req, res) => {
  const page = parsePositiveInteger(req.query.page, 1)
  const requestedPageSize = parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE)
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  if (!page || !requestedPageSize || requestedPageSize > MAX_PAGE_SIZE || query.length > 80) {
    return res.status(400).json({ success: false, message: 'Invalid catalog page or search query' })
  }

  const where = { status: 'ACTIVE' }
  if (query) {
    where[Op.or] = [
      { name: { [Op.like]: `%${query}%` } },
      { category: { [Op.like]: `%${query}%` } }
    ]
  }

  try {
    const result = await Item.findAndCountAll({
      where,
      attributes: ['id', 'name', 'category', 'uom', 'description', 'price'],
      order: [['name', 'ASC'], ['id', 'ASC']],
      limit: requestedPageSize,
      offset: (page - 1) * requestedPageSize
    })

    res.set('Cache-Control', 'no-store')
    return res.json({
      success: true,
      data: {
        items: result.rows.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category || null,
          unit: item.uom || 'pcs',
          price: item.price === null || item.price === undefined ? null : Number(item.price),
          description: typeof item.description === 'string' ? item.description.slice(0, MAX_DESCRIPTION_LENGTH) : null
        })),
        page,
        pageSize: requestedPageSize,
        total: result.count
      }
    })
  } catch (error) {
    console.error('Catalog lookup failed:', error.message)
    return res.status(500).json({ success: false, message: 'Product catalog is temporarily unavailable' })
  }
}

module.exports = { listCatalogItems }
