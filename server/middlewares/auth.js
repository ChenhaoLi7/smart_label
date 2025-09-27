const jwt = require('jsonwebtoken');
const config = require('../config/config');

module.exports = (req, res, next) => {
  try {
    // 从请求头获取token
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: '未提供认证令牌' });
    }

    // 验证token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // 将用户信息添加到请求对象
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '认证令牌已过期' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: '无效的认证令牌' });
    } else {
      return res.status(500).json({ message: '认证失败' });
    }
  }
};
