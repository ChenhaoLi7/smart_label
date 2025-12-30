// server/routes/auth.js
const router = require('express').Router();
const authCtrl = require('../controllers/auth');
const authMiddleware = require('../middlewares/auth');

// POST /api/auth/register
router.post('/register', authCtrl.register);
// POST /api/auth/login
router.post('/login', authCtrl.login);
// GET /api/auth/profile
router.get('/profile', authMiddleware, authCtrl.getUserInfo);
// POST /api/auth/upload-avatar
router.post('/upload-avatar', authMiddleware, authCtrl.upload.single('avatar'), authCtrl.uploadAvatar);

module.exports = router;