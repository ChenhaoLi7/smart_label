#!/bin/bash

echo "🚀 启动智能标签系统..."

# 检查Node.js和Python是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装Node.js"
    exit 1
fi

if ! command -v python &> /dev/null; then
    echo "❌ 请先安装Python"
    exit 1
fi

# 启动后端服务
echo "📦 启动后端服务..."
cd "/Users/lichenhao/Desktop/smart label /server"
if [ ! -d "node_modules" ]; then
    echo "安装后端依赖..."
    npm install
fi
# 设置环境变量允许外部访问
export HOST=0.0.0.0
npm start &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动AI服务
echo "🤖 启动AI服务..."
cd "/Users/lichenhao/Desktop/smart label /ai_service"
if [ ! -d "venv" ]; then
    echo "创建Python虚拟环境..."
    python -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
python app.py &
AI_PID=$!

# 等待AI服务启动
sleep 3

# 启动前端服务
echo "🎨 启动前端服务..."
cd "/Users/lichenhao/Desktop/smart label /dynamic-label-front"
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi
# 启动前端服务并允许局域网访问
npm run serve -- --host 0.0.0.0 --port 8080 &
FRONTEND_PID=$!

# 获取本机IP地址
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

echo ""
echo "✅ 所有服务已启动！"
echo ""
echo "📱 本机访问："
echo "🌐 前端地址: https://localhost:8080 (HTTPS - 摄像头功能需要)"
echo "   ⚠️  如果浏览器提示证书不安全，请点击'继续访问'或'高级'->'继续访问'"
echo "🔧 后端API: http://localhost:3000"
echo "🤖 AI服务: http://localhost:8000"
echo ""
echo "🌍 局域网访问（其他设备可通过以下地址访问）："
echo "🌐 前端地址: https://$LOCAL_IP:8080 (HTTPS - 摄像头功能需要)"
echo "   ⚠️  移动设备首次访问需要信任证书"
echo "🔧 后端API: http://$LOCAL_IP:3000"
echo "🤖 AI服务: http://$LOCAL_IP:8000"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
wait

