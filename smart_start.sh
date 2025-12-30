#!/bin/bash

echo "🚀 智能标签系统 - 智能启动脚本"
echo "================================"

# 检查端口是否被占用
check_port() {
    local port=$1
    local service_name=$2
    
    if lsof -i :$port > /dev/null 2>&1; then
        echo "⚠️  $service_name (端口 $port) 已经在运行中"
        return 1
    else
        echo "✅ $service_name (端口 $port) 可用"
        return 0
    fi
}

# 停止指定端口的服务
stop_service_on_port() {
    local port=$1
    local service_name=$2
    
    echo "🛑 正在停止 $service_name (端口 $port)..."
    lsof -ti :$port | xargs kill -9 2>/dev/null
    sleep 2
    
    if ! lsof -i :$port > /dev/null 2>&1; then
        echo "✅ $service_name 已停止"
    else
        echo "❌ 无法停止 $service_name"
    fi
}

# 启动后端服务
start_backend() {
    echo "📦 启动后端服务..."
    cd "/Users/lichenhao/Desktop/smart label /server"
    
    if [ ! -d "node_modules" ]; then
        echo "安装后端依赖..."
        npm install
    fi
    
    export HOST=0.0.0.0
    npm start &
    BACKEND_PID=$!
    echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"
}

# 启动AI服务
start_ai() {
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
    echo "✅ AI服务已启动 (PID: $AI_PID)"
}

# 启动前端服务
start_frontend() {
    echo "🎨 启动前端服务..."
    cd "/Users/lichenhao/Desktop/smart label /dynamic-label-front"
    
    if [ ! -d "node_modules" ]; then
        echo "安装前端依赖..."
        npm install
    fi
    
    npm run serve -- --host 0.0.0.0 --port 8080 &
    FRONTEND_PID=$!
    echo "✅ 前端服务已启动 (PID: $FRONTEND_PID)"
}

# 主逻辑
echo "🔍 检查当前服务状态..."

# 检查各端口
backend_running=$(check_port 3000 "后端服务")
ai_running=$(check_port 8000 "AI服务")
frontend_running=$(check_port 8080 "前端服务")

echo ""
echo "📋 服务状态："
echo "  后端服务 (3000): $([ $backend_running -eq 0 ] && echo "✅ 运行中" || echo "❌ 未运行")"
echo "  AI服务 (8000): $([ $ai_running -eq 0 ] && echo "✅ 运行中" || echo "❌ 未运行")"
echo "  前端服务 (8080): $([ $frontend_running -eq 0 ] && echo "✅ 运行中" || echo "❌ 未运行")"

echo ""
read -p "是否要重新启动所有服务？(y/N): " restart_all

if [[ $restart_all =~ ^[Yy]$ ]]; then
    echo "🔄 重新启动所有服务..."
    
    # 停止所有服务
    stop_service_on_port 3000 "后端服务"
    stop_service_on_port 8000 "AI服务" 
    stop_service_on_port 8080 "前端服务"
    
    sleep 3
    
    # 启动所有服务
    start_backend
    sleep 3
    start_ai
    sleep 3
    start_frontend
    
    echo ""
    echo "✅ 所有服务已重新启动！"
else
    echo "📝 只启动未运行的服务..."
    
    [ $backend_running -ne 0 ] && start_backend && sleep 3
    [ $ai_running -ne 0 ] && start_ai && sleep 3
    [ $frontend_running -ne 0 ] && start_frontend
fi

# 获取本机IP地址
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

echo ""
echo "🌐 服务访问地址："
echo "  本机访问："
echo "    🌐 前端: https://localhost:8080 (HTTPS - 摄像头功能需要)"
echo "       ⚠️  如果浏览器提示证书不安全，请点击'继续访问'"
echo "    🔧 后端: http://localhost:3000"
echo "    🤖 AI服务: http://localhost:8000"
echo ""
echo "  局域网访问："
echo "    🌐 前端: https://$LOCAL_IP:8080 (HTTPS - 摄像头功能需要)"
echo "       ⚠️  移动设备首次访问需要信任证书"
echo "    🔧 后端: http://$LOCAL_IP:3000"
echo "    🤖 AI服务: http://$LOCAL_IP:8000"
echo ""
echo "💡 提示：运行 ./check_services.sh 可以随时检查服务状态"


