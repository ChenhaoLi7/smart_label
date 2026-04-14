// server/routes/auth.js
const router = require('express').Router();
const authCtrl = require('../controllers/auth');
const authMiddleware = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');

// POST /api/auth/register
router.post('/register', authCtrl.register);
// POST /api/auth/login
router.post('/login', authCtrl.login);
// POST /api/auth/forgot-password
router.post('/forgot-password', authCtrl.forgotPassword);
// GET /api/auth/profile
router.get('/profile', authMiddleware, authCtrl.getUserInfo);
// GET /api/auth/users
router.get('/users', authMiddleware, requireRole('admin'), authCtrl.listUsers);
// PATCH /api/auth/users/:id/promote
router.patch('/users/:id/promote', authMiddleware, requireRole('admin'), authCtrl.promoteUserToAdmin);
// POST /api/auth/upload-avatar
router.post('/upload-avatar', authMiddleware, authCtrl.upload.single('avatar'), authCtrl.uploadAvatar);

module.exports = router;
