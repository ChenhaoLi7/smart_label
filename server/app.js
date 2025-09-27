// server/app.js
require('dotenv').config();       // ① 加载 .env 中的环境变量
const express = require('express');
const cors    = require('cors');

// ② 创建一个 Express 应用实例
const app = express();

// ③ 注册中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ④ 挂载所有路由：访问 /api/* 时都走 routes 里的逻辑
const routes = require('./routes');
app.use('/api', routes);

// ⑤ 导出 app，供 server.js 调用 app.listen(...)
module.exports = app;
