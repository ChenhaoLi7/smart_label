const router = require('express').Router()
const authMiddleware = require('../middlewares/auth')
const requireRole = require('../middlewares/requireRole')
const suggestionController = require('../controllers/suggestionController')

router.use(authMiddleware)
// 仅员工；顾客 viewer 不可读写内部建议
router.use(requireRole('admin', 'operator'))

router.get('/', suggestionController.listSuggestions)
router.post('/', suggestionController.createSuggestion)
router.patch('/:id', requireRole('admin'), suggestionController.updateSuggestion)

module.exports = router
