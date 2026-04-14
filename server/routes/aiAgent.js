const express = require('express');
const router = express.Router();
const aiAgentController = require('../controllers/aiAgent');
const authMiddleware = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');

// 处理自然语言查询
router.get('/context', authMiddleware, requireRole('admin'), aiAgentController.getContext);
router.post('/query', authMiddleware, requireRole('admin'), aiAgentController.handleQuery);

module.exports = router;
