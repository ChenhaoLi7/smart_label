# PWA 设置说明

## ✅ 已完成的配置

1. ✅ 安装了 `@vue/cli-plugin-pwa` 插件
2. ✅ 创建了 `manifest.json` 文件
3. ✅ 配置了 `vue.config.js` 中的 PWA 选项
4. ✅ 创建了 Service Worker 注册逻辑
5. ✅ 添加了 PWA 安装提示组件
6. ✅ 更新了 `index.html` 添加 PWA 元数据

## 📱 需要创建的图标文件

PWA 需要以下图标文件，请将它们放在 `public/` 目录下：

### 必需的图标

1. **icon-192.png** (192x192 像素)
   - 用于 Android 主屏幕图标
   - 用于 iOS 添加到主屏幕

2. **icon-512.png** (512x512 像素)
   - 用于 Android 启动画面
   - 用于 PWA 安装提示

### 如何生成图标

你可以使用以下方法生成图标：

#### 方法1: 在线工具
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator

#### 方法2: 使用 ImageMagick (命令行)
```bash
# 如果你有 ImageMagick 安装
convert logo.png -resize 192x192 public/icon-192.png
convert logo.png -resize 512x512 public/icon-512.png
```

#### 方法3: 使用现有 favicon
如果暂时没有图标，可以：
1. 复制 `favicon.ico` 并重命名为 `icon-192.png` 和 `icon-512.png`
2. 或者创建一个简单的占位图标

## 🚀 使用方法

### 开发环境

1. 启动开发服务器：
```bash
npm run serve
```

2. 在浏览器中访问应用

3. 打开开发者工具 → Application → Service Workers
   - 应该能看到 Service Worker 已注册

### 生产环境

1. 构建应用：
```bash
npm run build
```

2. Service Worker 会自动生成在 `dist/service-worker.js`

3. 部署到支持 HTTPS 的服务器

## 📱 安装 PWA

### Android Chrome
1. 访问应用
2. 浏览器会显示"添加到主屏幕"提示
3. 或点击菜单（三个点）→ "添加到主屏幕"

### iOS Safari
1. 访问应用
2. 点击底部分享按钮
3. 选择"添加到主屏幕"
4. 点击"添加"

### 桌面浏览器
- **Chrome/Edge**: 地址栏右侧会显示安装图标
- **Firefox**: 菜单 → "安装"

## ✨ PWA 功能特性

### 已实现的功能

1. ✅ **离线访问**
   - 静态资源缓存
   - API 响应缓存（网络优先）
   - 离线页面支持

2. ✅ **安装提示**
   - 自动检测安装条件
   - 友好的安装提示界面
   - 手动安装说明

3. ✅ **快速启动**
   - 应用图标
   - 启动画面
   - 全屏体验

4. ✅ **后台同步**
   - Service Worker 后台运行
   - 自动更新检查

### 缓存策略

- **静态资源** (CSS, JS, 图片): 缓存优先，30天过期
- **API 请求**: 网络优先，失败时使用缓存，5分钟过期
- **HTML 页面**: 网络优先，24小时过期

## 🔧 配置说明

### manifest.json

主要配置项：
- `name`: 应用名称
- `short_name`: 简短名称
- `start_url`: 启动URL
- `display`: 显示模式（standalone = 全屏）
- `theme_color`: 主题色
- `icons`: 应用图标

### Service Worker

当前使用 `GenerateSW` 模式，Workbox 会自动生成 Service Worker。

如果需要自定义 Service Worker，可以：
1. 将 `workboxPluginMode` 改为 `InjectManifest`
2. 创建自定义 Service Worker 文件
3. 在 `workboxOptions.swSrc` 中指定路径

## 🐛 常见问题

### Q1: Service Worker 没有注册
**解决**: 
- 确保在 HTTPS 环境下（localhost 除外）
- 检查浏览器控制台是否有错误
- 清除浏览器缓存后重试

### Q2: 安装提示不显示
**解决**:
- 确保满足 PWA 安装条件（HTTPS、manifest、Service Worker）
- 检查是否已经安装过
- 清除 `localStorage` 中的 `pwa-install-dismissed`

### Q3: 离线功能不工作
**解决**:
- 检查 Service Worker 是否已激活
- 查看 Application → Cache Storage
- 确保资源已被正确缓存

## 📊 测试 PWA

### Chrome DevTools

1. **Application 标签**:
   - Service Workers: 查看注册状态
   - Cache Storage: 查看缓存内容
   - Manifest: 查看 manifest 信息

2. **Network 标签**:
   - 勾选 "Offline" 测试离线功能
   - 查看资源加载情况

### Lighthouse

运行 Lighthouse 测试 PWA 评分：
1. 打开 Chrome DevTools
2. 切换到 Lighthouse 标签
3. 选择 "Progressive Web App"
4. 运行测试

## 🎯 下一步优化

1. **推送通知**: 实现 Web Push API
2. **后台同步**: 实现离线操作同步
3. **分享目标**: 实现接收分享内容
4. **文件处理**: 实现文件系统访问（Chrome 86+）

## 📝 注意事项

1. **HTTPS 要求**: PWA 必须在 HTTPS 环境下运行（localhost 除外）
2. **图标要求**: 必须提供至少 192x192 和 512x512 的图标
3. **更新机制**: Service Worker 更新需要用户刷新页面
4. **缓存管理**: 定期清理旧缓存，避免占用过多存储空间




