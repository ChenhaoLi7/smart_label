// server/routes/auth.js
const router = require('express').Router();
const authCtrl = require('../controllers/auth');

// POST /api/auth/register
router.post('/register', authCtrl.register);
// POST /api/auth/login
router.post('/login',    authCtrl.login);

module.exports = router;