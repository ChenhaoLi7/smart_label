#!/bin/bash

echo "🔍 智能标签系统服务状态检查"
echo "================================"

# 检查进程
echo "📋 运行中的服务进程："
ps aux | grep -E "(node|python)" | grep -v grep | grep -E "(server|vue-cli-service|app.py)" | while read line; do
    echo "  ✅ $line"
done

echo ""
echo "🌐 端口占用情况："
lsof -i :3000,8000,8080 2>/dev/null | grep LISTEN | while read line; do
    echo "  ✅ $line"
done

echo ""
echo "🔗 API健康检查："

# 检查后端
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "  ✅ 后端服务 (3000) - 正常"
else
    echo "  ❌ 后端服务 (3000) - 异常"
fi

# 检查AI服务
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "  ✅ AI服务 (8000) - 正常"
else
    echo "  ❌ AI服务 (8000) - 异常"
fi

# 检查前端代理
if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "  ✅ 前端服务 (8080) - 正常"
else
    echo "  ❌ 前端服务 (8080) - 异常"
fi

echo ""
echo "📱 访问地址："
echo "  🌐 前端: http://localhost:8080"
echo "  🔧 后端: http://localhost:3000"
echo "  🤖 AI服务: http://localhost:8000"


