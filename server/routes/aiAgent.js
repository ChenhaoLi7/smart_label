const express = require('express');
const router = express.Router();
const aiAgentController = require('../controllers/aiAgent');

// 处理自然语言查询
router.post('/query', aiAgentController.handleQuery);

module.exports = router;
