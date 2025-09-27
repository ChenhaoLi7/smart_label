<template>
  <div class="inventory-management">
    <!-- 顶部标题栏 -->
    <div class="header">
      <h1>📦 库存管理系统</h1>
      <div class="header-actions">
        <button @click="refreshData" class="btn btn-primary">
          🔄 刷新数据
        </button>
        <button @click="exportData" class="btn btn-success">
          📊 导出数据
        </button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📦</div>
        <div class="stat-content">
          <div class="stat-number">{{ stats.totalItems }}</div>
          <div class="stat-label">商品总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-content">
          <div class="stat-number">{{ stats.totalLots }}</div>
          <div class="stat-label">批次总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📍</div>
        <div class="stat-content">
          <div class="stat-number">{{ stats.totalBins }}</div>
          <div class="stat-label">库位总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚠️</div>
        <div class="stat-content">
          <div class="stat-number">{{ stats.lowStock }}</div>
          <div class="stat-label">库存不足</div>
        </div>
      </div>
    </div>

    <!-- 数据表格区域 -->
    <div class="data-section">
      <!-- 标签页切换 -->
      <div class="tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.key"
          @click="activeTab = tab.key"
          :class="['tab-btn', { active: activeTab === tab.key }]"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 库存商品表格 -->
      <div v-if="activeTab === 'items'" class="table-container">
        <div class="table-header">
          <h3>📦 商品库存表</h3>
          <div class="table-actions">
            <input 
              v-model="searchQuery" 
              placeholder="搜索商品..." 
              class="search-input"
            >
            <select v-model="sortBy" class="sort-select">
              <option value="sku">按SKU排序</option>
              <option value="name">按名称排序</option>
              <option value="totalQty">按总数量排序</option>
            </select>
          </div>
        </div>
        
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>商品名称</th>
                <th>总库存</th>
                <th>可用库存</th>
                <th>库位分布</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredItems" :key="item.sku">
                <td><strong>{{ item.sku }}</strong></td>
                <td>{{ item.name }}</td>
                <td>{{ item.totalQty }}</td>
                <td>{{ item.availableQty }}</td>
                <td>{{ item.binCount }}个库位</td>
                <td>
                  <span :class="['status-badge', item.status]">
                    {{ getStatusText(item.status) }}
                  </span>
                </td>
                <td>
                  <button @click="viewItemDetails(item)" class="btn-sm btn-info">
                    查看详情
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 批次库存表格 -->
      <div v-if="activeTab === 'lots'" class="table-container">
        <div class="table-header">
          <h3>📋 批次库存表</h3>
          <div class="table-actions">
            <input 
              v-model="searchQuery" 
              placeholder="搜索批次..." 
              class="search-input"
            >
            <select v-model="sortBy" class="sort-select">
              <option value="lot">按批次号排序</option>
              <option value="exp">按过期时间排序</option>
              <option value="qty">按数量排序</option>
            </select>
          </div>
        </div>
        
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>批次号</th>
                <th>SKU</th>
                <th>数量</th>
                <th>库位</th>
                <th>过期时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="lot in filteredLots" :key="lot.id">
                <td><strong>{{ lot.lot }}</strong></td>
                <td>{{ lot.sku }}</td>
                <td>{{ lot.qty }} {{ lot.uom }}</td>
                <td>{{ lot.bin }}</td>
                <td>
                  <span :class="getExpiryClass(lot.exp)">
                    {{ formatDate(lot.exp) }}
                  </span>
                </td>
                <td>
                  <span :class="['status-badge', lot.status]">
                    {{ getStatusText(lot.status) }}
                  </span>
                </td>
                <td>
                  <button @click="viewLotDetails(lot)" class="btn-sm btn-info">
                    查看详情
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 库位信息表格 -->
      <div v-if="activeTab === 'bins'" class="table-container">
        <div class="table-header">
          <h3>📍 库位信息表</h3>
          <div class="table-actions">
            <input 
              v-model="searchQuery" 
              placeholder="搜索库位..." 
              class="search-input"
            >
            <select v-model="sortBy" class="sort-select">
              <option value="bin_code">按库位编码排序</option>
              <option value="zone">按区域排序</option>
              <option value="utilization">按利用率排序</option>
            </select>
          </div>
        </div>
        
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>库位编码</th>
                <th>区域</th>
                <th>容量</th>
                <th>已用</th>
                <th>利用率</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bin in filteredBins" :key="bin.id">
                <td><strong>{{ bin.bin_code }}</strong></td>
                <td>{{ bin.zone }}</td>
                <td>{{ bin.capacity }}</td>
                <td>{{ bin.used }}</td>
                <td>
                  <div class="utilization-bar">
                    <div 
                      :class="['utilization-fill', getUtilizationClass(bin.utilization)]"
                      :style="{ width: bin.utilization + '%' }"
                    ></div>
                    <span>{{ bin.utilization }}%</span>
                  </div>
                </td>
                <td>
                  <span :class="['status-badge', bin.status]">
                    {{ getStatusText(bin.status) }}
                  </span>
                </td>
                <td>
                  <button @click="viewBinDetails(bin)" class="btn-sm btn-info">
                    查看详情
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 交易记录表格 -->
      <div v-if="activeTab === 'transactions'" class="table-container">
        <div class="table-header">
          <h3>📝 交易记录表</h3>
          <div class="table-actions">
            <input 
              v-model="searchQuery" 
              placeholder="搜索交易..." 
              class="search-input"
            >
            <select v-model="sortBy" class="sort-select">
              <option value="timestamp">按时间排序</option>
              <option value="type">按类型排序</option>
              <option value="user">按用户排序</option>
            </select>
          </div>
        </div>
        
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>SKU</th>
                <th>数量</th>
                <th>库位</th>
                <th>用户</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="txn in filteredTransactions" :key="txn.id">
                <td>{{ formatDateTime(txn.timestamp) }}</td>
                <td>
                  <span :class="['type-badge', txn.type]">
                    {{ getTransactionTypeText(txn.type) }}
                  </span>
                </td>
                <td>{{ txn.sku }}</td>
                <td>{{ txn.qty }} {{ txn.uom }}</td>
                <td>{{ txn.bin }}</td>
                <td>{{ txn.user }}</td>
                <td>
                  <span :class="['status-badge', txn.status]">
                    {{ getStatusText(txn.status) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="showDetailsModal" class="modal-overlay" @click="closeDetailsModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ detailsModalTitle }}</h3>
          <button @click="closeDetailsModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <pre>{{ JSON.stringify(selectedItem, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// 响应式数据
const activeTab = ref('items')
const searchQuery = ref('')
const sortBy = ref('sku')
const showDetailsModal = ref(false)
const selectedItem = ref(null)
const detailsModalTitle = ref('')

// 统计数据
const stats = ref({
  totalItems: 0,
  totalLots: 0,
  totalBins: 0,
  lowStock: 0
})

// 表格数据
const items = ref([])
const lots = ref([])
const bins = ref([])
const transactions = ref([])

// 标签页配置
const tabs = [
  { key: 'items', label: '商品库存' },
  { key: 'lots', label: '批次库存' },
  { key: 'bins', label: '库位信息' },
  { key: 'transactions', label: '交易记录' }
]

// 计算属性
const filteredItems = computed(() => {
  let filtered = items.value
  
  if (searchQuery.value) {
    filtered = filtered.filter(item => 
      item.sku.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }
  
  if (sortBy.value === 'sku') {
    filtered = [...filtered].sort((a, b) => a.sku.localeCompare(b.sku))
  } else if (sortBy.value === 'name') {
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortBy.value === 'totalQty') {
    filtered = [...filtered].sort((a, b) => b.totalQty - a.totalQty)
  }
  
  return filtered
})

const filteredLots = computed(() => {
  let filtered = lots.value
  
  if (searchQuery.value) {
    filtered = filtered.filter(lot => 
      lot.lot.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      lot.sku.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }
  
  if (sortBy.value === 'lot') {
    filtered = [...filtered].sort((a, b) => a.lot.localeCompare(b.lot))
  } else if (sortBy.value === 'exp') {
    filtered = [...filtered].sort((a, b) => new Date(a.exp) - new Date(b.exp))
  } else if (sortBy.value === 'qty') {
    filtered = [...filtered].sort((a, b) => b.qty - a.qty)
  }
  
  return filtered
})

const filteredBins = computed(() => {
  let filtered = bins.value
  
  if (searchQuery.value) {
    filtered = filtered.filter(bin => 
      bin.bin_code.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      bin.zone.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }
  
  if (sortBy.value === 'bin_code') {
    filtered = [...filtered].sort((a, b) => a.bin_code.localeCompare(b.bin_code))
  } else if (sortBy.value === 'zone') {
    filtered = [...filtered].sort((a, b) => a.zone.localeCompare(b.zone))
  } else if (sortBy.value === 'utilization') {
    filtered = [...filtered].sort((a, b) => b.utilization - a.utilization)
  }
  
  return filtered
})

const filteredTransactions = computed(() => {
  let filtered = transactions.value
  
  if (searchQuery.value) {
    filtered = filtered.filter(txn => 
      txn.sku.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      txn.user.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }
  
  if (sortBy.value === 'timestamp') {
    filtered = [...filtered].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  } else if (sortBy.value === 'type') {
    filtered = [...filtered].sort((a, b) => a.type.localeCompare(b.type))
  } else if (sortBy.value === 'user') {
    filtered = [...filtered].sort((a, b) => a.user.localeCompare(b.user))
  }
  
  return filtered
})

// 生命周期
onMounted(() => {
  loadMockData()
  calculateStats()
})

// 方法
const loadMockData = () => {
  // 模拟商品数据
  items.value = [
    {
      sku: 'PAD-001-XL',
      name: '智能平板电脑 XL',
      totalQty: 500,
      availableQty: 450,
      binCount: 3,
      status: 'ACTIVE'
    },
    {
      sku: 'LAP-002-15',
      name: '笔记本电脑 15寸',
      totalQty: 200,
      availableQty: 180,
      binCount: 2,
      status: 'ACTIVE'
    },
    {
      sku: 'PHN-003-6',
      name: '智能手机 6寸',
      totalQty: 1000,
      availableQty: 50,
      binCount: 5,
      status: 'LOW_STOCK'
    }
  ]

  // 模拟批次数据
  lots.value = [
    {
      id: 1,
      lot: 'L20250819-001',
      sku: 'PAD-001-XL',
      qty: 100,
      uom: 'pcs',
      bin: 'A1-03-02',
      exp: '2026-08-19',
      status: 'ACTIVE'
    },
    {
      id: 2,
      lot: 'L20250819-002',
      sku: 'LAP-002-15',
      qty: 50,
      uom: 'pcs',
      bin: 'B2-01-01',
      exp: '2026-09-15',
      status: 'ACTIVE'
    }
  ]

  // 模拟库位数据
  bins.value = [
    {
      id: 1,
      bin_code: 'A1-03-02',
      zone: 'A区',
      capacity: 1000,
      used: 750,
      utilization: 75,
      status: 'ACTIVE'
    },
    {
      id: 2,
      bin_code: 'B2-01-01',
      zone: 'B区',
      capacity: 800,
      used: 200,
      utilization: 25,
      status: 'ACTIVE'
    }
  ]

  // 模拟交易数据
  transactions.value = [
    {
      id: 1,
      timestamp: '2025-08-19T10:30:00Z',
      type: 'INBOUND',
      sku: 'PAD-001-XL',
      qty: 100,
      uom: 'pcs',
      bin: 'A1-03-02',
      user: 'admin',
      status: 'COMPLETED'
    },
    {
      id: 2,
      timestamp: '2025-08-19T14:20:00Z',
      type: 'OUTBOUND',
      sku: 'LAP-002-15',
      qty: 20,
      uom: 'pcs',
      bin: 'B2-01-01',
      user: 'operator1',
      status: 'COMPLETED'
    }
  ]
}

const calculateStats = () => {
  stats.value.totalItems = items.value.length
  stats.value.totalLots = lots.value.length
  stats.value.totalBins = bins.value.length
  stats.value.lowStock = items.value.filter(item => item.status === 'LOW_STOCK').length
}

const refreshData = () => {
  loadMockData()
  calculateStats()
}

const exportData = () => {
  const data = {
    items: items.value,
    lots: lots.value,
    bins: bins.value,
    transactions: transactions.value,
    stats: stats.value,
    exportTime: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventory-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const viewItemDetails = (item) => {
  selectedItem.value = item
  detailsModalTitle.value = `商品详情 - ${item.sku}`
  showDetailsModal.value = true
}

const viewLotDetails = (lot) => {
  selectedItem.value = lot
  detailsModalTitle.value = `批次详情 - ${lot.lot}`
  showDetailsModal.value = true
}

const viewBinDetails = (bin) => {
  selectedItem.value = bin
  detailsModalTitle.value = `库位详情 - ${bin.bin_code}`
  showDetailsModal.value = true
}

const closeDetailsModal = () => {
  showDetailsModal.value = false
  selectedItem.value = null
}

const getStatusText = (status) => {
  const statusMap = {
    'ACTIVE': '正常',
    'INACTIVE': '停用',
    'LOW_STOCK': '库存不足',
    'OUT_OF_STOCK': '缺货',
    'COMPLETED': '已完成',
    'PENDING': '待处理',
    'CANCELLED': '已取消'
  }
  return statusMap[status] || status
}

const getTransactionTypeText = (type) => {
  const typeMap = {
    'INBOUND': '入库',
    'OUTBOUND': '出库',
    'MOVE': '移库',
    'ADJUST': '调整',
    'COUNT': '盘点'
  }
  return typeMap[type] || type
}

const getExpiryClass = (expDate) => {
  const daysUntilExpiry = Math.ceil((new Date(expDate) - new Date()) / (1000 * 60 * 60 * 24))
  if (daysUntilExpiry < 30) return 'expiry-warning'
  if (daysUntilExpiry < 90) return 'expiry-notice'
  return 'expiry-normal'
}

const getUtilizationClass = (utilization) => {
  if (utilization > 80) return 'high'
  if (utilization > 50) return 'medium'
  return 'low'
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('zh-CN')
}

const formatDateTime = (dateTimeString) => {
  return new Date(dateTimeString).toLocaleString('zh-CN')
}
</script>

<style scoped>
.inventory-management {
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  font-size: 40px;
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 32px;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 5px;
}

.stat-label {
  color: #666;
  font-size: 14px;
}

.data-section {
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  overflow: hidden;
}

.tabs {
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.tab-btn {
  padding: 15px 25px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.3s;
}

.tab-btn.active {
  background: white;
  color: #007bff;
  border-bottom: 2px solid #007bff;
}

.tab-btn:hover {
  background: #e9ecef;
}

.table-container {
  padding: 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.table-header h3 {
  margin: 0;
  color: #333;
}

.table-actions {
  display: flex;
  gap: 10px;
}

.search-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  width: 200px;
}

.sort-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
}

.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.data-table th,
.data-table td {
  padding: 12px;
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
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.ACTIVE {
  background: #d4edda;
  color: #155724;
}

.status-badge.INACTIVE {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.LOW_STOCK {
  background: #fff3cd;
  color: #856404;
}

.status-badge.OUT_OF_STOCK {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.COMPLETED {
  background: #d4edda;
  color: #155724;
}

.status-badge.PENDING {
  background: #fff3cd;
  color: #856404;
}

.type-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.type-badge.INBOUND {
  background: #d1ecf1;
  color: #0c5460;
}

.type-badge.OUTBOUND {
  background: #f8d7da;
  color: #721c24;
}

.type-badge.MOVE {
  background: #d4edda;
  color: #155724;
}

.utilization-bar {
  position: relative;
  width: 100px;
  height: 20px;
  background: #e9ecef;
  border-radius: 10px;
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
  font-size: 11px;
  font-weight: 500;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.expiry-warning {
  color: #dc3545;
  font-weight: 500;
}

.expiry-notice {
  color: #ffc107;
  font-weight: 500;
}

.expiry-normal {
  color: #28a745;
}

.btn {
  padding: 8px 16px;
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
.btn-sm { padding: 4px 8px; font-size: 12px; }

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
  max-width: 600px;
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

.modal-body pre {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
}
</style>

