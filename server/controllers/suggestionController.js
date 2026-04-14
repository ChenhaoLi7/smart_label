const { Suggestion, User } = require('../models')

const VALID_STATUSES = ['NEW', 'UNDER_REVIEW', 'PLANNED', 'DECLINED']
const VALID_CATEGORIES = ['BEVERAGE', 'SNACK', 'OTHER']

const buildBaseWhere = (req) => {
  const where = {}
  const { status, category } = req.query

  if (status && VALID_STATUSES.includes(status)) {
    where.status = status
  }

  if (category && VALID_CATEGORIES.includes(category)) {
    where.category = category
  }

  if (req.user?.role !== 'admin') {
    where.user_id = req.user?.id
  }

  return where
}

const serializeSuggestion = (suggestion) => ({
  id: suggestion.id,
  title: suggestion.title,
  desired_item: suggestion.desired_item,
  preferred_brand: suggestion.preferred_brand,
  category: suggestion.category,
  details: suggestion.details,
  status: suggestion.status,
  admin_reply: suggestion.admin_reply,
  resolved_by: suggestion.resolved_by,
  resolved_at: suggestion.resolved_at,
  createdAt: suggestion.createdAt,
  updatedAt: suggestion.updatedAt,
  author: suggestion.author ? {
    id: suggestion.author.id,
    username: suggestion.author.username,
    email: suggestion.author.email,
    role: suggestion.author.role
  } : null
})

const createSuggestion = async (req, res) => {
  try {
    const { title, desired_item, preferred_brand, category, details } = req.body

    if (!title || !desired_item) {
      return res.status(400).json({
        success: false,
        message: '标题和想要的商品名称不能为空'
      })
    }

    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: '建议分类不正确'
      })
    }

    const suggestion = await Suggestion.create({
      user_id: req.user.id,
      title: title.trim(),
      desired_item: desired_item.trim(),
      preferred_brand: preferred_brand?.trim() || null,
      category: category || 'BEVERAGE',
      details: details?.trim() || null
    })

    const createdSuggestion = await Suggestion.findByPk(suggestion.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'email', 'role']
      }]
    })

    return res.status(201).json({
      success: true,
      message: '建议已提交',
      data: serializeSuggestion(createdSuggestion)
    })
  } catch (error) {
    console.error('提交建议失败:', error)
    return res.status(500).json({
      success: false,
      message: '提交建议失败',
      error: error.message
    })
  }
}

const listSuggestions = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1)
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '20', 10), 1), 100)
    const offset = (page - 1) * limit
    const where = buildBaseWhere(req)

    const { rows, count } = await Suggestion.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'email', 'role']
      }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    })

    const summaryPromises = VALID_STATUSES.map((status) => Suggestion.count({
      where: {
        ...where,
        status
      }
    }))

    const [newCount, underReviewCount, plannedCount, declinedCount] = await Promise.all(summaryPromises)

    return res.json({
      success: true,
      data: {
        suggestions: rows.map(serializeSuggestion),
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit)
        },
        summary: {
          total: count,
          NEW: newCount,
          UNDER_REVIEW: underReviewCount,
          PLANNED: plannedCount,
          DECLINED: declinedCount
        }
      }
    })
  } catch (error) {
    console.error('获取建议列表失败:', error)
    return res.status(500).json({
      success: false,
      message: '获取建议列表失败',
      error: error.message
    })
  }
}

const updateSuggestion = async (req, res) => {
  try {
    const suggestion = await Suggestion.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'email', 'role']
      }]
    })

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: '建议不存在'
      })
    }

    const { status, admin_reply } = req.body
    const nextData = {}

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: '建议状态不正确'
        })
      }
      nextData.status = status
    }

    if (admin_reply !== undefined) {
      nextData.admin_reply = String(admin_reply || '').trim() || null
    }

    const nextStatus = nextData.status || suggestion.status
    const nextReply = Object.prototype.hasOwnProperty.call(nextData, 'admin_reply')
      ? nextData.admin_reply
      : suggestion.admin_reply

    if (['PLANNED', 'DECLINED'].includes(nextStatus) || nextReply) {
      nextData.resolved_by = req.user?.username || `user-${req.user?.id}`
      nextData.resolved_at = new Date()
    } else if (nextStatus === 'NEW' || nextStatus === 'UNDER_REVIEW') {
      nextData.resolved_by = null
      nextData.resolved_at = null
    }

    await suggestion.update(nextData)

    return res.json({
      success: true,
      message: '建议处理结果已更新',
      data: serializeSuggestion(suggestion)
    })
  } catch (error) {
    console.error('更新建议失败:', error)
    return res.status(500).json({
      success: false,
      message: '更新建议失败',
      error: error.message
    })
  }
}

module.exports = {
  createSuggestion,
  listSuggestions,
  updateSuggestion
}
