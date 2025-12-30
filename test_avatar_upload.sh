#!/bin/bash

# 测试头像上传功能
echo "测试头像上传功能..."

# 1. 首先登录获取token
echo "1. 登录获取token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

echo "登录响应: $LOGIN_RESPONSE"

# 提取token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "获取到的token: $TOKEN"

if [ -z "$TOKEN" ]; then
  echo "登录失败，无法获取token"
  exit 1
fi

# 2. 测试获取用户信息
echo "2. 获取用户信息..."
USER_INFO=$(curl -s -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "用户信息: $USER_INFO"

# 3. 测试头像上传（使用一个简单的测试图片）
echo "3. 测试头像上传..."
# 创建一个简单的测试图片文件
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > test_avatar.png

UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/upload-avatar \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@test_avatar.png")

echo "头像上传响应: $UPLOAD_RESPONSE"

# 清理测试文件
rm -f test_avatar.png

echo "测试完成！"
