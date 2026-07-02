#!/bin/bash

echo "🚀 启动智能标签系统..."

export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# 基于脚本位置定位项目根目录，避免硬编码路径错误
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
AI_DIR="$SCRIPT_DIR/ai_service"
FRONTEND_DIR="$SCRIPT_DIR/dynamic-label-front"

# 检查Node.js和Python是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装Node.js"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ 请先安装Python"
    exit 1
fi

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

# 启动后端服务
echo "📦 启动后端服务..."
cd "$SERVER_DIR" || exit 1
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
cd "$AI_DIR" || exit 1

# 如果虚拟环境损坏（python解释器不存在），先重建
if [ -d "venv" ] && [ ! -x "venv/bin/python" ]; then
    echo "检测到损坏的虚拟环境，重新创建..."
    rm -rf venv
fi

if [ ! -d "venv" ]; then
    echo "创建Python虚拟环境..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
python app.py &
AI_PID=$!

# 等待AI服务启动
sleep 3

# 启动前端服务
echo "🎨 启动前端服务..."
cd "$FRONTEND_DIR" || exit 1
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi
# 启动前端服务并允许局域网访问
npm run serve -- --host 0.0.0.0 --port 8080 --skip-plugins @vue/cli-plugin-eslint &
FRONTEND_PID=$!

# 获取本机网络地址
LOCAL_HOSTNAME=$(get_local_hostname)
LOCAL_IP=$(get_local_ip)

echo ""
echo "✅ 所有服务已启动！"
echo ""
echo "📱 本机访问："
echo "🌐 前端地址: https://localhost:8080 (HTTPS - 摄像头功能需要)"
echo "   ⚠️  如果浏览器提示证书不安全，请点击'继续访问'或'高级'->'继续访问'"
echo "🔧 后端API: http://localhost:3000"
echo "🤖 AI服务: http://localhost:8000"
if [ -n "$LOCAL_HOSTNAME" ]; then
echo ""
echo "🍎 推荐局域网主机名访问："
echo "🌐 前端地址: https://$LOCAL_HOSTNAME:8080"
echo "   ⚠️  移动设备首次访问可能仍会提示证书不安全，继续访问即可"
echo "🔧 后端API: http://$LOCAL_HOSTNAME:3000"
echo "🤖 AI服务: http://$LOCAL_HOSTNAME:8000"
fi
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
