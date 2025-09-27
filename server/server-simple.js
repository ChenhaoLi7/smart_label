const express = require('express')
const cors = require('cors')
const path = require('path')

// 创建Express应用
const app = express()

// 中间件配置
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 静态文件服务
app.use('/downloads', express.static(path.join(__dirname, 'downloads')))

// 基础路由
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: '智能仓库管理系统运行正常（简化模式）'
  })
})

// 模拟认证中间件
const mockAuthMiddleware = (req, res, next) => {
  // 简化版本，暂时跳过认证
  req.user = { username: 'admin', id: 1 }
  next()
}

// 模拟打印中心API
app.get('/api/print-center/templates', mockAuthMiddleware, (req, res) => {
  const templates = [
    {
      id: 'LOT-50x50',
      name: '批次标签 50x50mm',
      description: '标准批次标签，包含SKU、批次、数量、库位、过期时间',
      size: { width: 50, height: 50, unit: 'mm' },
      placeholders: ['{{sku}}', '{{lot}}', '{{qty}}', '{{uom}}', '{{bin}}', '{{exp}}', '{{qr}}'],
      printTypes: ['LOT']
    },
    {
      id: 'BIN-80x40',
      name: '库位标签 80x40mm',
      description: '库位标识标签，包含库位编码、区域、容量信息',
      size: { width: 80, height: 40, unit: 'mm' },
      placeholders: ['{{bin_code}}', '{{zone}}', '{{capacity}}', '{{qr}}'],
      printTypes: ['BIN']
    },
    {
      id: 'ITEM-60x40',
      name: '物料标签 60x40mm',
      description: '物料标识标签，包含SKU、名称、规格、单位',
      size: { width: 60, height: 40, unit: 'mm' },
      placeholders: ['{{sku}}', '{{name}}', '{{spec}}', '{{uom}}', '{{qr}}'],
      printTypes: ['ITEM']
    }
  ]

  res.json({
    success: true,
    data: templates
  })
})

app.post('/api/print-center/print', mockAuthMiddleware, (req, res) => {
  const { templateId, printType, items, options = {} } = req.body
  
  // 模拟打印处理
  const jobNumber = `PRINT-${Date.now()}`
  
  res.json({
    success: true,
    data: {
      job_number: jobNumber,
      template: templateId,
      print_type: printType,
      total_count: items.length * (options.copies || 1),
      download_url: `/downloads/${jobNumber}.pdf`
    }
  })
})

app.get('/api/print-center/jobs', mockAuthMiddleware, (req, res) => {
  const jobs = [
    {
      id: 1,
      job_number: 'PRINT-1734584123456',
      template_name: 'LOT-50x50',
      print_type: 'LOT',
      total_count: 5,
      status: 'COMPLETED',
      created_at: new Date().toISOString()
    }
  ]

  res.json({
    success: true,
    data: {
      jobs: jobs,
      pagination: {
        total: jobs.length,
        page: 1,
        limit: 20,
        totalPages: 1
      }
    }
  })
})

// 模拟认证API
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body
  
  // 简化的登录验证
  if (email === 'chenhaoli523@gmail.com' && password === '123456') {
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token: 'mock-jwt-token-' + Date.now(),
        user: {
          id: 1,
          username: 'admin',
          email: email
        }
      }
    })
  } else {
    res.status(401).json({
      success: false,
      message: '邮箱或密码错误'
    })
  }
})

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body
  
  // 简化的注册
  res.json({
    success: true,
    message: '注册成功',
    data: {
      user: {
        id: 2,
        username: username,
        email: email
      }
    }
  })
})

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  })
})

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error)
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: error.message
  })
})

// 启动服务器
const PORT = process.env.PORT || 3000
const startServer = () => {
  try {
    app.listen(PORT, () => {
      console.log('🚀 简化版服务器启动成功！')
      console.log('📍 端口:', PORT)
      console.log('🌐 地址: http://localhost:' + PORT)
      console.log('📊 健康检查: http://localhost:' + PORT + '/api/health')
      console.log('⚠️  注意：这是简化模式，数据库功能已禁用')
    })
  } catch (error) {
    console.error('❌ 服务器启动失败:', error)
    process.exit(1)
  }
}

startServer()
