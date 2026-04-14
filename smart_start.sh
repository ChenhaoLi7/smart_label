#!/bin/bash

echo "🚀 智能标签系统 - 智能启动脚本"
echo "================================"

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
AI_DIR="$SCRIPT_DIR/ai_service"
FRONTEND_DIR="$SCRIPT_DIR/dynamic-label-front"
LOG_DIR="$SCRIPT_DIR/logs"

is_port_in_use() {
    local port=$1
    lsof -i :"$port" > /dev/null 2>&1
}

show_port_status() {
    local port=$1
    local service_name=$2

    if is_port_in_use "$port"; then
        echo "  $service_name ($port): ✅ 运行中"
    else
        echo "  $service_name ($port): ❌ 未运行"
    fi
}

stop_service_on_port() {
    local port=$1
    local service_name=$2

    if is_port_in_use "$port"; then
        echo "🛑 正在停止 $service_name (端口 $port)..."
        lsof -ti :"$port" | xargs kill -9 2>/dev/null
        sleep 2

        if is_port_in_use "$port"; then
            echo "❌ 无法停止 $service_name"
            return 1
        fi

        echo "✅ $service_name 已停止"
    else
        echo "ℹ️  $service_name (端口 $port) 未运行"
    fi
}

ensure_prerequisites() {
    mkdir -p "$LOG_DIR"

    if ! command -v node > /dev/null 2>&1; then
        echo "❌ 请先安装 Node.js"
        exit 1
    fi

    if ! command -v python3 > /dev/null 2>&1; then
        echo "❌ 请先安装 Python 3"
        exit 1
    fi
}

get_local_hostname() {
    local host_name
    host_name=$(scutil --get LocalHostName 2>/dev/null)
    if [ -n "$host_name" ]; then
        echo "${host_name}.local"
    fi
}

get_local_ip() {
    ifconfig | awk '
        /^[a-z0-9]+:/ { iface=$1; sub(":", "", iface) }
        $1 == "inet" && $2 != "127.0.0.1" && iface !~ /^(lo|utun|awdl|llw|bridge|anpi)/ { print $2; exit }
    '
}

start_backend() {
    echo "📦 启动后端服务..."
    cd "$SERVER_DIR" || return 1

    if [ ! -d "node_modules" ]; then
        echo "安装后端依赖..."
        npm install || return 1
    fi

    nohup env HOST=0.0.0.0 npm start > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"
}

start_ai() {
    echo "🤖 启动AI服务..."
    cd "$AI_DIR" || return 1

    if [ -d "venv" ] && [ ! -x "venv/bin/python" ]; then
        echo "检测到损坏的虚拟环境，重新创建..."
        rm -rf venv
    fi

    if [ ! -d "venv" ]; then
        echo "创建 Python 虚拟环境..."
        python3 -m venv venv || return 1
    fi

    source venv/bin/activate
    pip install -r requirements.txt || return 1
    nohup "$AI_DIR/venv/bin/python" app.py > "$LOG_DIR/ai.log" 2>&1 &
    AI_PID=$!
    echo "✅ AI服务已启动 (PID: $AI_PID)"
}

start_frontend() {
    echo "🎨 启动前端服务..."
    cd "$FRONTEND_DIR" || return 1

    if [ ! -d "node_modules" ]; then
        echo "安装前端依赖..."
        npm install || return 1
    fi

    nohup npm run serve -- --host 0.0.0.0 --port 8080 > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "✅ 前端服务已启动 (PID: $FRONTEND_PID)"
}

print_access_info() {
    local local_ip
    local local_hostname
    local_ip=$(get_local_ip)
    local_hostname=$(get_local_hostname)

    echo ""
    echo "🌐 服务访问地址："
    echo "  本机访问："
    echo "    🌐 前端: https://localhost:8080"
    echo "       ⚠️  如果浏览器提示证书不安全，请点击“继续访问”"
    echo "    🔧 后端: http://localhost:3000"
    echo "    🤖 AI服务: http://localhost:8000"
    if [ -n "$local_hostname" ]; then
        echo ""
        echo "  推荐局域网主机名访问："
        echo "    🌐 前端: https://$local_hostname:8080"
        echo "       ⚠️  移动设备首次访问可能仍会提示证书不安全，继续访问即可"
        echo "    🔧 后端: http://$local_hostname:3000"
        echo "    🤖 AI服务: http://$local_hostname:8000"
    fi
    echo ""
    echo "  局域网访问："
    echo "    🌐 前端: https://$local_ip:8080"
    echo "       ⚠️  移动设备首次访问需要信任证书"
    echo "    🔧 后端: http://$local_ip:3000"
    echo "    🤖 AI服务: http://$local_ip:8000"
    echo ""
    echo "💡 提示：运行 ./check_services.sh 可以随时检查服务状态"
    echo "📝 日志目录：$LOG_DIR"
}

ensure_prerequisites

echo "🔍 检查当前服务状态..."
echo ""
echo "📋 服务状态："
show_port_status 3000 "后端服务"
show_port_status 8000 "AI服务"
show_port_status 8080 "前端服务"
echo ""

read -r -p "是否要重新启动所有服务？(y/N): " restart_all

if [[ $restart_all =~ ^[Yy]$ ]]; then
    echo "🔄 重新启动所有服务..."
    stop_service_on_port 3000 "后端服务"
    stop_service_on_port 8000 "AI服务"
    stop_service_on_port 8080 "前端服务"
    echo ""

    start_backend && sleep 3
    start_ai && sleep 3
    start_frontend

    echo ""
    echo "✅ 所有服务已重新启动！"
else
    echo "📝 只启动未运行的服务..."

    if ! is_port_in_use 3000; then
        start_backend && sleep 3
    fi

    if ! is_port_in_use 8000; then
        start_ai && sleep 3
    fi

    if ! is_port_in_use 8080; then
        start_frontend
    fi
fi

print_access_info
