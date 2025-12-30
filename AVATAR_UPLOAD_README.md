# 用户头像上传功能

## 功能概述

为智能仓库管理系统添加了用户头像上传和修改功能，用户可以通过点击头像来上传和更换个人头像。

## 功能特性

### 前端功能
- **头像显示**: 支持显示用户上传的头像或默认头像
- **头像上传**: 点击头像即可选择并上传新头像
- **图片预览**: 上传前可以预览和调整图片
- **图片编辑**: 支持缩放和位置调整
- **文件验证**: 只允许上传图片文件，限制文件大小为5MB
- **响应式设计**: 支持移动端和桌面端

### 后端功能
- **文件上传**: 使用multer处理文件上传
- **文件存储**: 头像文件存储在`server/uploads/avatars/`目录
- **静态文件服务**: 通过`/uploads`路径提供头像文件访问
- **数据库存储**: 头像URL存储在用户表的avatar字段
- **文件管理**: 自动删除旧头像文件，避免存储空间浪费

## 技术实现

### 前端组件
- `AvatarUpload.vue`: 头像上传组件
- 集成到`Dashboard.vue`中
- 使用Vue 3 Composition API

### 后端API
- `POST /api/auth/upload-avatar`: 上传头像
- `GET /api/auth/profile`: 获取用户信息（包含头像）
- 使用multer中间件处理文件上传
- JWT认证保护

### 数据库
- 用户表新增字段：
  - `avatar`: 头像URL
  - `role`: 用户角色
  - `status`: 用户状态

## 使用方法

### 1. 用户操作
1. 登录系统后，在右上角可以看到当前头像
2. 点击头像，会显示"更换头像"提示
3. 点击后选择图片文件
4. 在预览界面调整图片位置和大小
5. 点击"保存头像"完成上传

### 2. 开发者使用
```javascript
// 在Vue组件中使用
import AvatarUpload from './AvatarUpload.vue'

// 模板中使用
<AvatarUpload 
  :username="username" 
  :current-avatar="userAvatar"
  @avatar-updated="handleAvatarUpdated"
/>
```

### 3. API调用
```javascript
// 上传头像
const formData = new FormData()
formData.append('avatar', file)

const response = await fetch('/api/auth/upload-avatar', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})
```

## 文件结构

```
server/
├── controllers/
│   └── auth.js              # 认证控制器（包含头像上传）
├── models/
│   └── User.js             # 用户模型（新增avatar字段）
├── routes/
│   └── auth.js             # 认证路由（新增头像上传路由）
├── uploads/
│   └── avatars/            # 头像文件存储目录
└── migrations/
    └── add_avatar_to_users.sql  # 数据库迁移文件

dynamic-label-front/src/components/
├── AvatarUpload.vue         # 头像上传组件
└── Dashboard.vue           # 仪表板（集成头像功能）
```

## 配置说明

### 环境要求
- Node.js 14+
- Vue 3
- Express.js
- Multer (文件上传)
- Sequelize (数据库ORM)

### 安装依赖
```bash
# 后端依赖
cd server
npm install multer

# 前端依赖（已包含在现有依赖中）
cd ../dynamic-label-front
npm install
```

### 数据库迁移
```sql
-- 执行迁移文件
source server/migrations/add_avatar_to_users.sql
```

## 安全考虑

1. **文件类型验证**: 只允许上传图片文件
2. **文件大小限制**: 限制上传文件大小为5MB
3. **认证保护**: 所有头像相关操作都需要JWT认证
4. **文件清理**: 自动删除旧头像文件，防止存储空间浪费
5. **路径安全**: 使用安全的文件命名和存储路径

## 测试

运行测试脚本验证功能：
```bash
./test_avatar_upload.sh
```

## 注意事项

1. 确保`server/uploads/avatars/`目录存在且有写权限
2. 服务器需要配置静态文件服务
3. 生产环境建议使用云存储服务（如AWS S3、阿里云OSS等）
4. 建议定期清理未使用的头像文件

## 未来改进

1. 支持更多图片格式
2. 添加图片压缩功能
3. 集成云存储服务
4. 添加头像裁剪功能
5. 支持头像模板选择
