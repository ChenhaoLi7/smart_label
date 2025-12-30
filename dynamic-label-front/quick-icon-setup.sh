#!/bin/bash
# 快速设置图标脚本
# 使用说明：将生成的图标文件放在 Downloads 目录，然后运行此脚本

echo "📱 PWA 图标设置助手"
echo "===================="
echo ""

# 检查 Downloads 目录中的图标文件
DOWNLOADS_DIR="$HOME/Downloads"
ICON_192=""
ICON_512=""

# 查找可能的图标文件
echo "🔍 正在查找图标文件..."
for file in "$DOWNLOADS_DIR"/*.png "$DOWNLOADS_DIR"/*.PNG; do
    if [ -f "$file" ]; then
        # 检查文件尺寸
        if command -v sips &> /dev/null; then
            width=$(sips -g pixelWidth "$file" 2>/dev/null | tail -1 | awk '{print $2}')
            height=$(sips -g pixelHeight "$file" 2>/dev/null | tail -1 | awk '{print $2}')
            
            if [ "$width" = "192" ] && [ "$height" = "192" ]; then
                ICON_192="$file"
                echo "✅ 找到 192x192 图标: $(basename "$file")"
            elif [ "$width" = "512" ] && [ "$height" = "512" ]; then
                ICON_512="$file"
                echo "✅ 找到 512x512 图标: $(basename "$file")"
            fi
        fi
    fi
done

# 目标目录
PUBLIC_DIR="$(pwd)/public"

if [ ! -d "$PUBLIC_DIR" ]; then
    echo "❌ 错误: 找不到 public 目录"
    echo "   请确保在 dynamic-label-front 目录下运行此脚本"
    exit 1
fi

echo ""
echo "📂 目标目录: $PUBLIC_DIR"
echo ""

# 处理图标文件
if [ -n "$ICON_192" ] && [ -n "$ICON_512" ]; then
    echo "🚀 复制图标文件..."
    cp "$ICON_192" "$PUBLIC_DIR/icon-192.png"
    cp "$ICON_512" "$PUBLIC_DIR/icon-512.png"
    echo "✅ 图标已复制到 public 目录"
elif [ -n "$ICON_512" ]; then
    echo "⚠️  只找到 512x512 图标，正在生成 192x192 版本..."
    if command -v sips &> /dev/null; then
        sips -z 192 192 "$ICON_512" --out "$PUBLIC_DIR/icon-192.png"
        cp "$ICON_512" "$PUBLIC_DIR/icon-512.png"
        echo "✅ 图标已生成并复制"
    else
        echo "❌ 需要 ImageMagick 或 sips 工具来调整尺寸"
        echo "   请手动调整图标尺寸"
    fi
else
    echo "⚠️  未在 Downloads 目录找到合适的图标文件"
    echo ""
    echo "💡 请按以下步骤操作："
    echo "   1. 使用 ChatGPT 或其他工具生成图标"
    echo "   2. 将图标保存到 Downloads 目录"
    echo "   3. 确保图标是 512x512 或 192x192 像素"
    echo "   4. 重新运行此脚本"
    echo ""
    echo "   或者手动复制图标："
    echo "   cp ~/Downloads/your-icon-192.png $PUBLIC_DIR/icon-192.png"
    echo "   cp ~/Downloads/your-icon-512.png $PUBLIC_DIR/icon-512.png"
fi

# 验证文件
echo ""
echo "📋 验证图标文件..."
if [ -f "$PUBLIC_DIR/icon-192.png" ] && [ -f "$PUBLIC_DIR/icon-512.png" ]; then
    echo "✅ icon-192.png: $(ls -lh "$PUBLIC_DIR/icon-192.png" | awk '{print $5}')"
    echo "✅ icon-512.png: $(ls -lh "$PUBLIC_DIR/icon-512.png" | awk '{print $5}')"
    echo ""
    echo "🎉 图标设置完成！"
    echo ""
    echo "下一步："
    echo "   1. 运行 npm run build 构建应用"
    echo "   2. 测试 PWA 功能"
else
    echo "❌ 图标文件不完整"
fi




