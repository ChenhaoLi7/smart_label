#!/bin/bash
# 创建 PWA 图标脚本
# 如果你有 ImageMagick 或 sips (macOS) 工具

echo "📱 创建 PWA 图标..."

# 检查是否有 favicon.ico
if [ -f "public/favicon.ico" ]; then
    echo "✅ 找到 favicon.ico"
    
    # macOS 使用 sips
    if command -v sips &> /dev/null; then
        echo "使用 sips 创建图标..."
        # 注意：sips 不能直接转换 ico，需要先有 PNG
        echo "⚠️  请手动创建图标文件"
    fi
    
    # 如果有 ImageMagick
    if command -v convert &> /dev/null; then
        echo "使用 ImageMagick 创建图标..."
        convert public/favicon.ico -resize 192x192 public/icon-192.png
        convert public/favicon.ico -resize 512x512 public/icon-512.png
        echo "✅ 图标创建完成"
    else
        echo "⚠️  未找到 ImageMagick，请手动创建图标"
    fi
else
    echo "⚠️  未找到 favicon.ico"
    echo "请手动创建以下图标文件："
    echo "  - public/icon-192.png (192x192)"
    echo "  - public/icon-512.png (512x512)"
fi

echo ""
echo "💡 提示："
echo "1. 可以使用在线工具生成：https://realfavicongenerator.net/"
echo "2. 或使用设计工具（Photoshop、Figma等）创建"
echo "3. 暂时可以使用 favicon.ico 作为占位符"




