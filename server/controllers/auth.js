// server/controllers/auth.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { User } = require('../models');
const config = require('../config/config');

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/avatars');
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名：时间戳 + 随机数 + 原扩展名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  },
  fileFilter: function (req, file, cb) {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  }
});

// 用户注册
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 检查用户是否已存在
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名或邮箱已存在'
      });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 首个注册用户自动成为管理员，后续用户为操作员
    const userCount = await User.count();
    const role = userCount === 0 ? 'admin' : 'operator';

    // 创建用户
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('用户注册失败:', error);
    res.status(500).json({
      success: false,
      message: '用户注册失败'
    });
  }
};

// 用户登录
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 查找用户 - 支持用户名或邮箱登录
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { username: username },
          { email: username }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 生成JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        id: user.id,
        username: user.username,
        role: user.role || 'operator'
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role || 'operator',
          avatar: user.avatar
        }
      }
    });
  } catch (error) {
    console.error('用户登录失败 - 详细错误:', {
      message: error.message,
      stack: error.stack,
      code: error.original?.code,
      errno: error.original?.errno,
      sqlState: error.original?.sqlState
    });
    res.status(500).json({
      success: false,
      message: '用户登录失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 忘记密码 - 通过邮箱重置
const forgotPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    return res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('重置密码失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Password reset failed'
    });
  }
};

// 上传头像
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的图片文件'
      });
    }

    const userId = req.user.userId;
    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    // 更新用户头像
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 删除旧头像文件（如果存在）
    if (user.avatar) {
      const oldAvatarPath = path.join(__dirname, '../public', user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // 更新用户头像URL
    await user.update({ avatar: avatarPath });

    res.json({
      success: true,
      message: '头像上传成功',
      data: {
        avatarUrl: avatarPath
      }
    });
  } catch (error) {
    console.error('头像上传失败:', error);
    res.status(500).json({
      success: false,
      message: '头像上传失败',
      error: error.message
    });
  }
};

// 获取用户信息
const getUserInfo = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email', 'role', 'avatar', 'createdAt']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role || 'operator',
          avatar: user.avatar,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
};

// 管理员查看所有注册用户
const listUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'role', 'status', 'avatar', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']]
    });

    const summary = users.reduce((acc, user) => {
      acc.total += 1;
      acc[user.role] = (acc[user.role] || 0) + 1;
      if (user.status === 'active') {
        acc.active += 1;
      }
      return acc;
    }, {
      total: 0,
      admin: 0,
      operator: 0,
      viewer: 0,
      active: 0
    });

    res.json({
      success: true,
      data: {
        users,
        summary
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败'
    });
  }
};

// 管理员提升用户为管理员
const promoteUserToAdmin = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: '无效的用户ID'
      });
    }

    const targetUser = await User.findByPk(targetUserId, {
      attributes: ['id', 'username', 'email', 'role', 'status', 'avatar', 'createdAt', 'updatedAt']
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    if (targetUser.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: '该用户已经是管理员'
      });
    }

    await targetUser.update({
      role: 'admin'
    });

    res.json({
      success: true,
      message: '管理员权限已授予，该用户下次重新登录后生效',
      data: {
        user: targetUser
      }
    });
  } catch (error) {
    console.error('提升管理员权限失败:', error);
    res.status(500).json({
      success: false,
      message: '提升管理员权限失败'
    });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  uploadAvatar,
  getUserInfo,
  listUsers,
  promoteUserToAdmin,
  upload // 导出multer中间件
};
