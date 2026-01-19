<template>
  <div class="print-center">
    <!-- 顶部标题栏 -->
    <div class="header">
      <h1>🖨️ 打印中心</h1>
      <div class="header-actions">
        <button @click="refreshTemplates" class="btn btn-primary">
          🔄 刷新模板
        </button>
        <button @click="viewPrintHistory" class="btn btn-info">
          📋 打印历史
        </button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧：模板选择 -->
      <div class="left-panel">
        <div class="panel-section">
          <h3>📋 选择模板</h3>
          <div class="template-list">
            <div 
              v-for="template in templates" 
              :key="template.id"
              @click="selectTemplate(template)"
              :class="['template-item', { active: selectedTemplate?.id === template.id }]"
            >
              <div class="template-icon">🏷️</div>
              <div class="template-info">
                <div class="template-name">{{ template.name }}</div>
                <div class="template-desc">{{ template.description }}</div>
                <div class="template-size">{{ template.size.width }}×{{ template.size.height }}{{ template.size.unit }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-section">
          <h3>📊 模板信息</h3>
          <div v-if="selectedTemplate" class="template-details">
            <div class="detail-item">
              <span class="label">模板ID:</span>
              <span class="value">{{ selectedTemplate.id }}</span>
            </div>
            <div class="detail-item">
              <span class="label">尺寸:</span>
              <span class="value">{{ selectedTemplate.size.width }}×{{ selectedTemplate.size.height }}{{ selectedTemplate.size.unit }}</span>
            </div>
            <div class="detail-item">
              <span class="label">占位符:</span>
              <div class="placeholders">
                <span 
                  v-for="placeholder in selectedTemplate.placeholders" 
                  :key="placeholder"
                  class="placeholder-tag"
                >
                  {{ placeholder }}
                </span>
              </div>
            </div>
          </div>
          <div v-else class="no-selection">
            请选择一个模板
          </div>
        </div>
      </div>

      <!-- 中间：数据源选择 -->
      <div class="center-panel">
        <div class="panel-section">
          <h3>📦 选择数据源</h3>
          
          <!-- 打印类型选择 -->
          <div class="print-type-selector">
            <label class="radio-label">
              <input 
                type="radio" 
                v-model="printType" 
                value="LOT" 
                :disabled="!selectedTemplate || !selectedTemplate.printTypes.includes('LOT')"
              >
              <span class="radio-text">批次标签 (LOT)</span>
            </label>
            <label class="radio-label">
              <input 
                type="radio" 
                v-model="printType" 
                value="BIN" 
                :disabled="!selectedTemplate || !selectedTemplate.printTypes.includes('BIN')"
              >
              <span class="radio-text">库位标签 (BIN)</span>
            </label>
            <label class="radio-label">
              <input 
                type="radio" 
                v-model="printType" 
                value="ITEM" 
                :disabled="!selectedTemplate || !selectedTemplate.printTypes.includes('ITEM')"
              >
              <span class="radio-text">物料标签 (ITEM)</span>
            </label>
          </div>

          <!-- 数据源选择 -->
          <div v-if="printType" class="data-source-selector">
            <div class="source-tabs">
              <button 
                v-for="tab in dataSourceTabs" 
                :key="tab.key"
                @click="activeDataSourceTab = tab.key"
                :class="['tab-btn', { active: activeDataSourceTab === tab.key }]"
              >
                {{ tab.label }}
              </button>
            </div>

            <!-- 采购订单数据 -->
            <div v-if="activeDataSourceTab === 'po'" class="data-content">
              <div class="search-bar">
                <input 
                  v-model="poSearchQuery" 
                  placeholder="搜索采购订单号或SKU..." 
                  class="search-input"
                >
                <button @click="searchPO" class="btn btn-primary">搜索</button>
              </div>
              
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" @change="toggleAllPO" v-model="selectAllPO"></th>
                      <th>PO号</th>
                      <th>SKU</th>
                      <th>商品名称</th>
                      <th>数量</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="poLine in filteredPOLines" :key="poLine.id">
                      <td>
                        <input 
                          type="checkbox" 
                          v-model="selectedPOItems" 
                          :value="poLine.id"
                        >
                      </td>
                      <td>{{ poLine.po_number }}</td>
                      <td>{{ poLine.sku }}</td>
                      <td>{{ poLine.item_name }}</td>
                      <td>{{ poLine.qty }} {{ poLine.uom }}</td>
                      <td>
                        <span :class="['status-badge', poLine.status]">
                          {{ getPOStatusText(poLine.status) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 批次数据 -->
            <div v-if="activeDataSourceTab === 'lots'" class="data-content">
              <div class="search-bar">
                <input 
                  v-model="lotSearchQuery" 
                  placeholder="搜索批次号或SKU..." 
                  class="search-input"
                >
                <button @click="searchLots" class="btn btn-primary">搜索</button>
              </div>
              
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" @change="toggleAllLots" v-model="selectAllLots"></th>
                      <th>批次号</th>
                      <th>SKU</th>
                      <th>数量</th>
                      <th>库位</th>
                      <th>过期时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="lot in filteredLots" :key="lot.id">
                      <td>
                        <input 
                          type="checkbox" 
                          v-model="selectedLotItems" 
                          :value="lot.id"
                        >
                      </td>
                      <td>{{ lot.lot_number }}</td>
                      <td>{{ lot.sku }}</td>
                      <td>{{ lot.qty }} {{ lot.uom }}</td>
                      <td>{{ lot.bin?.bin_code || 'N/A' }}</td>
                      <td>{{ formatDate(lot.expiry_date) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 库位数据 -->
            <div v-if="activeDataSourceTab === 'bins'" class="data-content">
              <div class="search-bar">
                <input 
                  v-model="binSearchQuery" 
                  placeholder="搜索库位编码或区域..." 
                  class="search-input"
                >
                <button @click="searchBins" class="btn btn-primary">搜索</button>
              </div>
              
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" @change="toggleAllBins" v-model="selectAllBins"></th>
                      <th>库位编码</th>
                      <th>区域</th>
                      <th>容量</th>
                      <th>已用</th>
                      <th>利用率</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="bin in filteredBins" :key="bin.id">
                      <td>
                        <input 
                          type="checkbox" 
                          v-model="selectedBinItems" 
                          :value="bin.id"
                        >
                      </td>
                      <td>{{ bin.bin_code }}</td>
                      <td>{{ bin.zone }}</td>
                      <td>{{ bin.capacity }}</td>
                      <td>{{ bin.used || 0 }}</td>
                      <td>
                        <div class="utilization-bar">
                          <div 
                            :class="['utilization-fill', getUtilizationClass(bin.utilization || 0)]"
                            :style="{ width: (bin.utilization || 0) + '%' }"
                          ></div>
                          <span>{{ bin.utilization || 0 }}%</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：打印选项和预览 -->
      <div class="right-panel">
        <div class="panel-section">
          <h3>⚙️ 打印选项</h3>
          
          <div class="option-group">
            <label class="option-label">
              <span>打印份数:</span>
              <input 
                type="number" 
                v-model="printOptions.copies" 
                min="1" 
                max="10" 
                class="option-input"
              >
            </label>
          </div>

          <div class="option-group">
            <label class="option-label">
              <span>输出格式:</span>
              <select v-model="printOptions.format" class="option-select">
                <option value="PDF">PDF</option>
                <option value="PNG">PNG</option>
                <option value="ZPL">ZPL (标签打印机)</option>
              </select>
            </label>
          </div>

          <div class="option-group">
            <label class="option-label">
              <span>分辨率 (DPI):</span>
              <select v-model="printOptions.dpi" class="option-select">
                <option value="150">150 DPI</option>
                <option value="300">300 DPI</option>
                <option value="600">600 DPI</option>
              </select>
            </label>
          </div>
        </div>

        <div class="panel-section">
          <h3>📊 打印统计</h3>
          <div class="print-stats">
            <div class="stat-item">
              <span class="stat-label">选中项目:</span>
              <span class="stat-value">{{ selectedItemCount }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">总打印数:</span>
              <span class="stat-value">{{ totalPrintCount }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">模板:</span>
              <span class="stat-value">{{ selectedTemplate?.name || '未选择' }}</span>
            </div>
          </div>
        </div>

        <div class="panel-section">
          <h3>🖨️ 打印操作</h3>
          <div class="print-actions">
            <button 
              @click="previewLabels" 
              class="btn btn-info btn-block"
              :disabled="!canPrint"
            >
              👁️ 预览标签
            </button>
            <button 
              @click="printLabels" 
              class="btn btn-success btn-block"
              :disabled="!canPrint"
            >
              🖨️ 开始打印
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 打印历史弹窗 -->
    <div v-if="showPrintHistory" class="modal-overlay" @click="closePrintHistory">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>📋 打印历史</h3>
          <button @click="closePrintHistory" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="print-history-list">
            <div v-for="job in printJobs" :key="job.id" class="history-item">
              <div class="job-header">
                <span class="job-number">{{ job.job_number }}</span>
                <span :class="['job-status', job.status]">{{ getJobStatusText(job.status) }}</span>
              </div>
              <div class="job-details">
                <span>模板: {{ job.template_name }}</span>
                <span>类型: {{ job.print_type }}</span>
                <span>数量: {{ job.total_count }}</span>
                <span>时间: {{ formatDateTime(job.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

// 响应式数据
const templates = ref([])
const selectedTemplate = ref(null)
const printType = ref('')
const activeDataSourceTab = ref('po')

// 数据源标签页
const dataSourceTabs = [
  { key: 'po', label: '采购订单' },
  { key: 'lots', label: '批次库存' },
  { key: 'bins', label: '库位信息' }
]

// 搜索查询
const poSearchQuery = ref('')
const lotSearchQuery = ref('')
const binSearchQuery = ref('')

// 数据列表
const poLines = ref([])
const lots = ref([])
const bins = ref([])

// 选中的项目
const selectedPOItems = ref([])
const selectedLotItems = ref([])
const selectedBinItems = ref([])
const selectAllPO = ref(false)
const selectAllLots = ref(false)
const selectAllBins = ref(false)

// 打印选项
const printOptions = ref({
  copies: 1,
  format: 'PDF',
  dpi: 300
})

// 打印历史
const showPrintHistory = ref(false)
const printJobs = ref([])

// 计算属性
const filteredPOLines = computed(() => {
  if (!poSearchQuery.value) return poLines.value
  return poLines.value.filter(line => 
    line.po_number.toLowerCase().includes(poSearchQuery.value.toLowerCase()) ||
    line.sku.toLowerCase().includes(poSearchQuery.value.toLowerCase())
  )
})

const filteredLots = computed(() => {
  if (!lotSearchQuery.value) return lots.value
  return lots.value.filter(lot => 
    lot.lot_number.toLowerCase().includes(lotSearchQuery.value.toLowerCase()) ||
    lot.sku.toLowerCase().includes(lotSearchQuery.value.toLowerCase())
  )
})

const filteredBins = computed(() => {
  if (!binSearchQuery.value) return bins.value
  return bins.value.filter(bin => 
    bin.bin_code.toLowerCase().includes(binSearchQuery.value.toLowerCase()) ||
    bin.zone.toLowerCase().includes(binSearchQuery.value.toLowerCase())
  )
})

const selectedItemCount = computed(() => {
  switch (printType.value) {
    case 'LOT':
      return selectedLotItems.value.length
    case 'BIN':
      return selectedBinItems.value.length
    case 'ITEM':
      return selectedPOItems.value.length
    default:
      return 0
  }
})

const totalPrintCount = computed(() => {
  return selectedItemCount.value * printOptions.value.copies
})

const canPrint = computed(() => {
  return selectedTemplate.value && printType.value && selectedItemCount.value > 0
})

// 生命周期
onMounted(() => {
  loadTemplates()
  loadMockData()
})

// 方法
const loadTemplates = async () => {
  try {
    const response = await axios.get('/api/print-center/templates', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    
    if (response.data.success) {
      templates.value = response.data.data
    }
  } catch (error) {
    console.error('加载模板失败:', error)
    // 使用模拟数据
    loadMockTemplates()
  }
}

const loadMockTemplates = () => {
  templates.value = [
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
}

const loadMockData = async () => {
  // Load real lots data from API
  try {
    const token = localStorage.getItem('token')
    const response = await axios.get('/api/inventory-management/lots', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.data.success) {
      lots.value = response.data.data.lots || []
    } else {
      // Fallback to mock data
      loadMockLotsData()
    }
  } catch (error) {
    console.error('加载批次数据失败:', error)
    // Fallback to mock data
    loadMockLotsData()
  }

  // Load bins data from API
  try {
    const token = localStorage.getItem('token')
    const response = await axios.get('/api/inventory-management/bins', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.data.success) {
      bins.value = response.data.data.bins || []
    } else {
      loadMockBinsData()
    }
  } catch (error) {
    console.error('加载库位数据失败:', error)
    loadMockBinsData()
  }

  // Mock purchase orders (no real API yet)
  loadMockPOData()
}

const loadMockLotsData = () => {
  // 模拟批次数据
  lots.value = [
    {
      id: 1,
      lot_number: 'L20250820-001',
      sku: 'PAD-001-XL',
      qty: 100,
      uom: 'pcs',
      bin: { bin_code: 'A1-03-02' },
      expiry_date: '2026-08-20'
    }
  ]
}

const loadMockBinsData = () => {
  // 模拟库位数据
  bins.value = [
    {
      id: 1,
      bin_code: 'A1-03-02',
      zone: 'A区',
      capacity: 1000,
      used: 750,
      utilization: 75
    }
  ]
}

const loadMockPOData = () => {
  // 模拟采购订单行数据
  poLines.value = [
    {
      id: 1,
      po_number: 'PO20250820-001',
      sku: 'PAD-001-XL',
      item_name: '智能平板电脑 XL',
      qty: 100,
      uom: 'pcs',
      status: 'OPEN'
    },
    {
      id: 2,
      po_number: 'PO20250820-002',
      sku: 'LAP-002-15',
      item_name: '笔记本电脑 15寸',
      qty: 50,
      uom: 'pcs',
      status: 'OPEN'
    }
  ]
}

const selectTemplate = (template) => {
  selectedTemplate.value = template
  // 自动选择第一个支持的打印类型
  if (template.printTypes.length > 0) {
    printType.value = template.printTypes[0]
  }
}

const toggleAllPO = () => {
  if (selectAllPO.value) {
    selectedPOItems.value = filteredPOLines.value.map(item => item.id)
  } else {
    selectedPOItems.value = []
  }
}

const toggleAllLots = () => {
  if (selectAllLots.value) {
    selectedLotItems.value = filteredLots.value.map(item => item.id)
  } else {
    selectedLotItems.value = []
  }
}

const toggleAllBins = () => {
  if (selectAllBins.value) {
    selectedBinItems.value = filteredBins.value.map(item => item.id)
  } else {
    selectedBinItems.value = []
  }
}

const searchPO = () => {
  // 实际应该调用API搜索
  console.log('搜索采购订单:', poSearchQuery.value)
}

const searchLots = () => {
  // 实际应该调用API搜索
  console.log('搜索批次:', lotSearchQuery.value)
}

const searchBins = () => {
  // 实际应该调用API搜索
  console.log('搜索库位:', binSearchQuery.value)
}

const previewLabels = async () => {
  try {
    const items = getSelectedItems()
    if (items.length === 0) {
      alert('请选择要打印的项目')
      return
    }

    const response = await axios.post('/api/print-center/print', {
      templateId: selectedTemplate.value.id,
      printType: printType.value,
      items: items,
      options: printOptions.value
    }, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    if (response.data.success) {
      alert(`预览成功！共生成 ${response.data.data.total_count} 个标签`)
      console.log('标签数据:', response.data.data.labels)
    }
  } catch (error) {
    console.error('预览标签失败:', error)
    alert('预览失败: ' + error.message)
  }
}

const printLabels = async () => {
  try {
    const items = getSelectedItems()
    if (items.length === 0) {
      alert('请选择要打印的项目')
      return
    }

    const response = await axios.post('/api/print-center/print', {
      templateId: selectedTemplate.value.id,
      printType: printType.value,
      items: items,
      options: printOptions.value
    }, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    if (response.data.success) {
      alert(`打印成功！任务号: ${response.data.data.job_number}`)
      // 清空选择
      selectedPOItems.value = []
      selectedLotItems.value = []
      selectedBinItems.value = []
    }
  } catch (error) {
    console.error('打印标签失败:', error)
    alert('打印失败: ' + error.message)
  }
}

const getSelectedItems = () => {
  switch (printType.value) {
    case 'LOT':
      return selectedLotItems.value.map(id => ({ lot_id: id }))
    case 'BIN':
      return selectedBinItems.value.map(id => ({ bin_id: id }))
    case 'ITEM':
      return selectedPOItems.value.map(id => ({ po_line_id: id }))
    default:
      return []
  }
}

const viewPrintHistory = async () => {
  try {
    const response = await axios.get('/api/print-center/jobs', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    
    if (response.data.success) {
      printJobs.value = response.data.data.jobs
      showPrintHistory.value = true
    }
  } catch (error) {
    console.error('获取打印历史失败:', error)
    // 使用模拟数据
    printJobs.value = [
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
    showPrintHistory.value = true
  }
}

const closePrintHistory = () => {
  showPrintHistory.value = false
}

const refreshTemplates = () => {
  loadTemplates()
}

// 工具函数
const getPOStatusText = (status) => {
  const statusMap = {
    'OPEN': '待收货',
    'PARTIAL': '部分收货',
    'COMPLETED': '已完成'
  }
  return statusMap[status] || status
}

const getJobStatusText = (status) => {
  const statusMap = {
    'PENDING': '待处理',
    'PROCESSING': '处理中',
    'COMPLETED': '已完成',
    'FAILED': '失败'
  }
  return statusMap[status] || status
}

const getUtilizationClass = (utilization) => {
  if (utilization > 80) return 'high'
  if (utilization > 50) return 'medium'
  return 'low'
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('zh-CN')
}

const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return 'N/A'
  return new Date(dateTimeString).toLocaleString('zh-CN')
}
</script>

<style scoped>
.print-center {
  padding: 20px;
  background: #f5f5f5;
  min-height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.header h1 {
  margin: 0;
  color: #333;
  font-size: 28px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.main-content {
  display: grid;
  grid-template-columns: 300px 1fr 350px;
  gap: 20px;
  height: calc(100vh - 150px);
}

.left-panel, .center-panel, .right-panel {
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  overflow: hidden;
}

.panel-section {
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.panel-section:last-child {
  border-bottom: none;
}

.panel-section h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.template-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid #eee;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.template-item:hover {
  border-color: #007bff;
  background: #f8f9fa;
}

.template-item.active {
  border-color: #007bff;
  background: #e3f2fd;
}

.template-icon {
  font-size: 24px;
}

.template-info {
  flex: 1;
}

.template-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.template-desc {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.template-size {
  font-size: 11px;
  color: #999;
}

.template-details {
  font-size: 14px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.detail-item .label {
  color: #666;
}

.detail-item .value {
  color: #333;
  font-weight: 500;
}

.placeholders {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.placeholder-tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
}

.no-selection {
  color: #999;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.print-type-selector {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.radio-label input[type="radio"] {
  margin: 0;
}

.radio-text {
  color: #333;
}

.data-source-selector {
  margin-top: 20px;
}

.source-tabs {
  display: flex;
  border-bottom: 1px solid #eee;
  margin-bottom: 20px;
}

.tab-btn {
  padding: 10px 20px;
  border: none;
  background: none;
  cursor: pointer;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.3s;
}

.tab-btn.active {
  color: #007bff;
  border-bottom-color: #007bff;
}

.search-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.data-table-container {
  max-height: 400px;
  overflow-y: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th,
.data-table td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.data-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.data-table tbody tr:hover {
  background: #f8f9fa;
}

.status-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.OPEN {
  background: #fff3cd;
  color: #856404;
}

.status-badge.PARTIAL {
  background: #d1ecf1;
  color: #0c5460;
}

.status-badge.COMPLETED {
  background: #d4edda;
  color: #155724;
}

.utilization-bar {
  position: relative;
  width: 60px;
  height: 16px;
  background: #e9ecef;
  border-radius: 8px;
  overflow: hidden;
}

.utilization-fill {
  height: 100%;
  transition: width 0.3s;
}

.utilization-fill.low {
  background: #28a745;
}

.utilization-fill.medium {
  background: #ffc107;
}

.utilization-fill.high {
  background: #dc3545;
}

.utilization-bar span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 9px;
  font-weight: 500;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.option-group {
  margin-bottom: 15px;
}

.option-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #333;
}

.option-input,
.option-select {
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 100px;
}

.print-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  color: #666;
}

.stat-value {
  color: #333;
  font-weight: 600;
}

.print-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary { background: #007bff; color: white; }
.btn-success { background: #28a745; color: white; }
.btn-info { background: #17a2b8; color: white; }
.btn-warning { background: #ffc107; color: #212529; }
.btn-danger { background: #dc3545; color: white; }

.btn:hover { opacity: 0.8; transform: translateY(-1px); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.btn-block { width: 100%; }

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 10px;
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  max-height: 60vh;
}

.print-history-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.history-item {
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 8px;
  background: #f8f9fa;
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.job-number {
  font-weight: 600;
  color: #333;
}

.job-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.job-status.PENDING {
  background: #fff3cd;
  color: #856404;
}

.job-status.PROCESSING {
  background: #d1ecf1;
  color: #0c5460;
}

.job-status.COMPLETED {
  background: #d4edda;
  color: #155724;
}

.job-status.FAILED {
  background: #f8d7da;
  color: #721c24;
}

.job-details {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  font-size: 12px;
  color: #666;
}
</style>

