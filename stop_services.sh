#!/bin/bash

echo "🛑 停止智能标签系统所有服务"
echo "================================"

# 停止服务的函数
stop_service() {
    local port=$1
    local service_name=$2
    
    if lsof -i :$port > /dev/null 2>&1; then
        echo "🛑 正在停止 $service_name (端口 $port)..."
        lsof -ti :$port | xargs kill -9 2>/dev/null
        sleep 1
        
        if ! lsof -i :$port > /dev/null 2>&1; then
            echo "✅ $service_name 已停止"
        else
            echo "❌ 无法停止 $service_name"
        fi
    else
        echo "ℹ️  $service_name (端口 $port) 未运行"
    fi
}

# 停止所有服务
stop_service 3000 "后端服务"
stop_service 8000 "AI服务"
stop_service 8080 "前端服务"

echo ""
echo "🔍 检查是否还有相关进程..."

# 检查是否还有相关进程
remaining_processes=$(ps aux | grep -E "(vue-cli-service|node.*server|python.*app)" | grep -v grep | wc -l)

if [ $remaining_processes -gt 0 ]; then
    echo "⚠️  发现 $remaining_processes 个相关进程仍在运行："
    ps aux | grep -E "(vue-cli-service|node.*server|python.*app)" | grep -v grep
    echo ""
    read -p "是否要强制停止这些进程？(y/N): " force_stop
    
    if [[ $force_stop =~ ^[Yy]$ ]]; then
        echo "🛑 强制停止所有相关进程..."
        ps aux | grep -E "(vue-cli-service|node.*server|python.*app)" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
        echo "✅ 所有进程已停止"
    fi
else
    echo "✅ 所有服务已成功停止"
fi

echo ""
echo "📊 最终状态检查："
lsof -i :3000,8000,8080 2>/dev/null | grep LISTEN || echo "✅ 所有端口已释放"


