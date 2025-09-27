// server/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { syncDatabase } = require('./models');

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api', require('./routes'));

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

// 启动服务器
const startServer = async () => {
  try {
    // 同步数据库
    await syncDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 服务器启动成功！`);
      console.log(`📍 端口: ${PORT}`);
      console.log(`🌐 地址: http://localhost:${PORT}`);
      console.log(`📊 健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();