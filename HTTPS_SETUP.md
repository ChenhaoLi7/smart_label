# HTTPS 配置说明 - 摄像头访问

## 为什么需要 HTTPS？

现代浏览器（Chrome、Firefox、Safari等）出于安全考虑，**要求访问摄像头、麦克风等敏感设备时必须使用 HTTPS 协议**（localhost 除外）。

如果你的应用运行在：
- `http://localhost:8080` ✅ 可以使用摄像头（localhost 例外）
- `http://192.168.x.x:8080` ❌ **无法使用摄像头**
- `https://192.168.x.x:8080` ✅ 可以使用摄像头

## 当前配置状态

✅ **证书已配置完成！**

项目已经配置好了 HTTPS 证书：
- 证书位置：`dynamic-label-front/certs/cert.pem`
- 私钥位置：`dynamic-label-front/certs/key.pem`
- 证书类型：mkcert 开发证书（已自动信任）

## 如何使用

### 1. 启动服务

运行启动脚本：
```bash
./smart_start.sh
# 或
./start_services.sh
```

### 2. 访问地址

**重要：必须使用 HTTPS 访问！**

- ✅ **正确**：`https://localhost:8080`
- ✅ **正确**：`https://192.168.x.x:8080`（局域网）
- ❌ **错误**：`http://localhost:8080`（非 localhost 时无法使用摄像头）
- ❌ **错误**：`http://192.168.x.x:8080`（无法使用摄像头）

### 3. 浏览器证书警告处理

首次访问时，浏览器可能会显示"您的连接不是私密连接"的警告：

#### Chrome/Edge
1. 点击"高级"
2. 点击"继续前往 localhost（不安全）"或"继续访问"

#### Firefox
1. 点击"高级"
2. 点击"接受风险并继续"

#### Safari (macOS)
1. 点击"显示详细信息"
2. 点击"访问此网站"

**为什么会有警告？**
- 这是自签名证书的正常行为
- 证书是安全的，只是浏览器需要你手动确认
- 使用 mkcert 生成的证书在本地已自动信任，但其他设备需要手动确认

### 4. 移动设备访问

在手机/平板上访问时：

1. **首次访问**：浏览器会显示证书警告
2. **信任证书**：
   - iOS Safari：设置 → 通用 → 关于本机 → 证书信任设置 → 启用完全信任
   - Android Chrome：点击"高级" → "继续访问"

## 验证 HTTPS 是否生效

### 方法1：查看浏览器地址栏
- ✅ 显示 🔒 锁图标 = HTTPS 已启用
- ❌ 显示 ⚠️ 警告图标 = HTTP（无法使用摄像头）

### 方法2：查看控制台
打开浏览器开发者工具（F12），在 Console 中：
```javascript
// 检查协议
console.log(window.location.protocol) // 应该显示 "https:"
```

### 方法3：测试摄像头权限
访问 `/advanced-scan` 页面，如果摄像头可以正常启动，说明 HTTPS 配置成功。

## 常见问题

### Q1: 为什么访问 http://localhost:8080 也能用摄像头？
A: `localhost` 是浏览器的特殊例外，允许在 HTTP 下访问摄像头。但如果你使用 IP 地址（如 `192.168.x.x`），就必须使用 HTTPS。

### Q2: 证书过期了怎么办？
A: 当前证书有效期到 2028年，如果过期了，可以重新生成：
```bash
cd dynamic-label-front/certs
# 使用 mkcert 重新生成
mkcert localhost 192.168.x.x
```

### Q3: 如何为其他 IP 地址生成证书？
A: 使用 mkcert：
```bash
mkcert localhost 192.168.1.100 192.168.1.101
# 会生成 cert.pem 和 key.pem
# 复制到 dynamic-label-front/certs/ 目录
```

### Q4: 生产环境怎么办？
A: 生产环境应该使用：
- 正式的 SSL 证书（Let's Encrypt、商业证书等）
- 配置反向代理（Nginx、Apache）
- 使用云服务（AWS、阿里云等）的负载均衡器

## 技术细节

### Vue CLI 配置
配置文件：`dynamic-label-front/vue.config.js`

```javascript
const httpsOptions = 
  fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)
    ? {
        key: fs.readFileSync(KEY_PATH),
        cert: fs.readFileSync(CERT_PATH)
      }
    : false
```

如果证书文件存在，Vue CLI 会自动启用 HTTPS。

### 证书信息
- 证书类型：mkcert 开发证书
- 有效期：2025-11-12 至 2028-02-12
- 支持的域名：localhost 和你的局域网 IP

## 总结

✅ **已配置完成** - 证书文件已存在  
✅ **自动启用** - Vue CLI 会自动检测证书并启用 HTTPS  
⚠️ **需要手动确认** - 首次访问需要信任证书  
📱 **移动设备** - 需要额外配置信任证书  

**记住：访问时使用 `https://` 而不是 `http://`！**




