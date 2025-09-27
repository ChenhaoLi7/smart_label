// server/controllers/auth.js
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { User } = require('../models');

// 用户注册
exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: '缺少参数' });
  }
  try {
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(400).json({ message: '邮箱已注册' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hash });
    res.status(201).json({ message: '注册成功', userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '注册失败' });
  }
};

// 用户登录
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: '缺少参数' });
  }
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: '邮箱或密码错误' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: '邮箱或密码错误' });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ message: '登录成功', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '登录失败' });
  }
};