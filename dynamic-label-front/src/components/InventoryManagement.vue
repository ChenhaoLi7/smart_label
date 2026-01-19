<template>
  <div class="inventory-management">
    <!-- Desktop Layout -->
    <div v-if="!isMobile" class="desktop-layout">
      <!-- 顶部标题栏 -->
      <div class="header glass-panel">
        <div class="header-left">
          <h1>Inventory Management</h1>
          <p class="subtitle">Real-time stock tracking and control</p>
        </div>
        <div class="header-actions">
          <button @click="refreshData" class="btn btn-glass">
            <span class="icon">🔄</span> Refresh
          </button>
          <button @click="exportData" class="btn btn-glass">
            <span class="icon">📊</span> Export
          </button>
        </div>
      </div>

      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card glass-panel">
          <div class="stat-icon-wrapper blue">
            <div class="stat-icon">📦</div>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.totalItems }}</div>
            <div class="stat-label">Total Items</div>
          </div>
        </div>
        <div class="stat-card glass-panel">
          <div class="stat-icon-wrapper purple">
            <div class="stat-icon">📋</div>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.totalLots }}</div>
            <div class="stat-label">Total Lots</div>
          </div>
        </div>
        <div class="stat-card glass-panel">
          <div class="stat-icon-wrapper orange">
            <div class="stat-icon">📍</div>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.totalBins }}</div>
            <div class="stat-label">Storage Bins</div>
          </div>
        </div>
        <div class="stat-card glass-panel">
          <div class="stat-icon-wrapper red">
            <div class="stat-icon">⚠️</div>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.lowStock }}</div>
            <div class="stat-label">Low Stock</div>
          </div>
        </div>
      </div>

      <!-- 数据表格区域 -->
      <div class="data-section glass-panel">
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
            <h3>Item Inventory</h3>
            <div class="table-actions">
              <div class="search-wrapper">
                <span class="search-icon">🔍</span>
                <input 
                  v-model="searchQuery" 
                  placeholder="Search items..." 
                  class="search-input"
                >
              </div>
              <select v-model="sortBy" class="sort-select">
                <option value="sku">Sort by SKU</option>
                <option value="name">Sort by Name</option>
                <option value="totalQty">Sort by Quantity</option>
              </select>
            </div>
          </div>
          
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Total Qty</th>
                  <th>Available</th>
                  <th>Bin Count</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredItems" :key="item.sku">
                  <td><span class="mono-text">{{ item.sku }}</span></td>
                  <td>{{ item.name }}</td>
                  <td>{{ item.totalQty }}</td>
                  <td>{{ item.availableQty }}</td>
                  <td>{{ item.binCount }} bins</td>
                  <td>
                    <span :class="['status-badge', item.status]">
                      {{ getStatusText(item.status) }}
                    </span>
                  </td>
                  <td>
                    <button @click="viewItemDetails(item)" class="btn-icon" title="View Details">
                      👁️
                    </button>
                    <button @click="printItemLabel(item)" class="btn-icon" title="Print QR Label" style="margin-left: 8px;">
                      🖨️
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
            <h3>Lot Inventory</h3>
            <div class="table-actions">
              <div class="search-wrapper">
                <span class="search-icon">🔍</span>
                <input 
                  v-model="searchQuery" 
                  placeholder="Search lots..." 
                  class="search-input"
                >
              </div>
              <select v-model="sortBy" class="sort-select">
                <option value="lot">Sort by Lot #</option>
                <option value="exp">Sort by Expiry</option>
                <option value="qty">Sort by Quantity</option>
              </select>
            </div>
          </div>
          
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Lot Number</th>
                  <th>SKU</th>
                  <th>Quantity</th>
                  <th>Bin</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="lot in filteredLots" :key="lot.id">
                  <td><span class="mono-text">{{ lot.lot }}</span></td>
                  <td><span class="mono-text">{{ lot.sku }}</span></td>
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
                    <button @click="viewLotDetails(lot)" class="btn-icon">
                      👁️
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
            <h3>Bin Status</h3>
            <div class="table-actions">
              <div class="search-wrapper">
                <span class="search-icon">🔍</span>
                <input 
                  v-model="searchQuery" 
                  placeholder="Search bins..." 
                  class="search-input"
                >
              </div>
              <select v-model="sortBy" class="sort-select">
                <option value="bin_code">Sort by Bin Code</option>
                <option value="zone">Sort by Zone</option>
                <option value="utilization">Sort by Utilization</option>
              </select>
            </div>
          </div>
          
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Bin Code</th>
                  <th>Zone</th>
                  <th>Capacity</th>
                  <th>Used</th>
                  <th>Utilization</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="bin in filteredBins" :key="bin.id">
                  <td><span class="mono-text">{{ bin.bin_code }}</span></td>
                  <td>{{ bin.zone }}</td>
                  <td>{{ bin.capacity }}</td>
                  <td>{{ bin.used }}</td>
                  <td>
                    <div class="utilization-bar">
                      <div 
                        :class="['utilization-fill', getUtilizationClass(bin.utilization)]"
                        :style="{ width: bin.utilization + '%' }"
                      ></div>
                    </div>
                    <span class="utilization-text">{{ bin.utilization }}%</span>
                  </td>
                  <td>
                    <span :class="['status-badge', bin.status]">
                      {{ getStatusText(bin.status) }}
                    </span>
                  </td>
                  <td>
                    <button @click="viewBinDetails(bin)" class="btn-icon">
                      👁️
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
            <h3>Transactions</h3>
            <div class="table-actions">
              <div class="search-wrapper">
                <span class="search-icon">🔍</span>
                <input 
                  v-model="searchQuery" 
                  placeholder="Search transactions..." 
                  class="search-input"
                >
              </div>
              <select v-model="sortBy" class="sort-select">
                <option value="timestamp">Sort by Time</option>
                <option value="type">Sort by Type</option>
                <option value="user">Sort by User</option>
              </select>
            </div>
          </div>
          
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>SKU</th>
                  <th>Quantity</th>
                  <th>Bin</th>
                  <th>User</th>
                  <th>Status</th>
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
                  <td><span class="mono-text">{{ txn.sku }}</span></td>
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
    </div>

    <!-- Mobile Layout -->
    <div v-else class="mobile-layout">
      <div class="mobile-header glass-panel">
        <h2>Inventory</h2>
        <div class="mobile-actions">
          <button @click="refreshData" class="btn-icon">🔄</button>
        </div>
      </div>

      <!-- Mobile Stats (Horizontal Scroll) -->
      <div class="mobile-stats-scroll">
        <div class="mobile-stat-card glass-panel">
          <div class="stat-icon">📦</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.totalItems }}</span>
            <span class="stat-label">Items</span>
          </div>
        </div>
        <div class="mobile-stat-card glass-panel">
          <div class="stat-icon">📋</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.totalLots }}</span>
            <span class="stat-label">Lots</span>
          </div>
        </div>
        <div class="mobile-stat-card glass-panel">
          <div class="stat-icon">⚠️</div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.lowStock }}</span>
            <span class="stat-label">Low Stock</span>
          </div>
        </div>
      </div>

      <!-- Mobile Tabs (Segmented Control) -->
      <div class="mobile-tabs-container">
        <div class="mobile-tabs">
          <button 
            v-for="tab in tabs" 
            :key="tab.key"
            @click="activeTab = tab.key"
            :class="['mobile-tab-btn', { active: activeTab === tab.key }]"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Mobile Search -->
      <div class="mobile-search">
        <div class="search-wrapper glass-panel">
          <span class="search-icon">🔍</span>
          <input 
            v-model="searchQuery" 
            placeholder="Search..." 
            class="search-input"
          >
        </div>
      </div>

      <!-- Mobile List View -->
      <div class="mobile-list">
        <!-- Items List -->
        <div v-if="activeTab === 'items'" class="list-container">
          <div v-for="item in filteredItems" :key="item.sku" class="mobile-card glass-panel" @click="viewItemDetails(item)">
            <div class="card-header">
              <span class="card-title">{{ item.name }}</span>
              <span :class="['status-badge', item.status]">{{ getStatusText(item.status) }}</span>
            </div>
            <div class="card-body">
              <div class="info-row">
                <span class="label">SKU:</span>
                <span class="value mono-text">{{ item.sku }}</span>
              </div>
              <div class="info-row">
                <span class="label">Stock:</span>
                <span class="value">{{ item.availableQty }} / {{ item.totalQty }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Lots List -->
        <div v-if="activeTab === 'lots'" class="list-container">
          <div v-for="lot in filteredLots" :key="lot.id" class="mobile-card glass-panel" @click="viewLotDetails(lot)">
            <div class="card-header">
              <span class="card-title mono-text">{{ lot.lot }}</span>
              <span :class="['status-badge', lot.status]">{{ getStatusText(lot.status) }}</span>
            </div>
            <div class="card-body">
              <div class="info-row">
                <span class="label">SKU:</span>
                <span class="value mono-text">{{ lot.sku }}</span>
              </div>
              <div class="info-row">
                <span class="label">Qty:</span>
                <span class="value">{{ lot.qty }} {{ lot.uom }}</span>
              </div>
              <div class="info-row">
                <span class="label">Exp:</span>
                <span class="value" :class="getExpiryClass(lot.exp)">{{ formatDate(lot.exp) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Bins List -->
        <div v-if="activeTab === 'bins'" class="list-container">
          <div v-for="bin in filteredBins" :key="bin.id" class="mobile-card glass-panel" @click="viewBinDetails(bin)">
            <div class="card-header">
              <span class="card-title mono-text">{{ bin.bin_code }}</span>
              <span class="card-subtitle">{{ bin.zone }}</span>
            </div>
            <div class="card-body">
              <div class="utilization-wrapper">
                <div class="utilization-bar">
                  <div 
                    :class="['utilization-fill', getUtilizationClass(bin.utilization)]"
                    :style="{ width: bin.utilization + '%' }"
                  ></div>
                </div>
                <span class="utilization-text">{{ bin.utilization }}% Used</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Transactions List -->
        <div v-if="activeTab === 'transactions'" class="list-container">
          <div v-for="txn in filteredTransactions" :key="txn.id" class="mobile-card glass-panel">
            <div class="card-header">
              <span :class="['type-badge', txn.type]">{{ getTransactionTypeText(txn.type) }}</span>
              <span class="card-time">{{ formatDateTime(txn.timestamp) }}</span>
            </div>
            <div class="card-body">
              <div class="info-row">
                <span class="label">SKU:</span>
                <span class="value mono-text">{{ txn.sku }}</span>
              </div>
              <div class="info-row">
                <span class="label">Qty:</span>
                <span class="value">{{ txn.qty }} {{ txn.uom }}</span>
              </div>
              <div class="info-row">
                <span class="label">User:</span>
                <span class="value">{{ txn.user }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 (Shared) -->
    <div v-if="showDetailsModal" class="modal-overlay" @click="closeDetailsModal">
      <div class="modal-content glass-panel" @click.stop>
        <div class="modal-header">
          <h3>{{ detailsModalTitle }}</h3>
          <button @click="closeDetailsModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <pre class="json-view">{{ JSON.stringify(selectedItem, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// 响应式数据
const activeTab = ref('items')
const searchQuery = ref('')
const sortBy = ref('sku')
const showDetailsModal = ref(false)
const selectedItem = ref(null)
const detailsModalTitle = ref('')
const isMobile = ref(false)

const checkDevice = () => {
  isMobile.value = window.innerWidth <= 768
}

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
  { key: 'items', label: 'Items' },
  { key: 'lots', label: 'Lots' },
  { key: 'bins', label: 'Bins' },
  { key: 'transactions', label: 'History' }
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

// 监听变化自动重新加载
watch([activeTab, searchQuery, sortBy], () => {
  loadData()
})

// 生命周期
onMounted(() => {
  checkDevice()
  window.addEventListener('resize', checkDevice)
  refreshData()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkDevice)
})

// 方法
// Helper Methods
const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

const loadStats = async () => {
  try {
    const response = await fetch('/api/inventory-management/stats', {
      headers: getAuthHeaders()
    })
    const result = await response.json()
    if (result.success) {
      stats.value = {
        totalItems: result.data.totalItems,
        totalLots: result.data.totalLots,
        totalBins: result.data.totalBins,
        lowStock: result.data.lowStockCount
      }
    }
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

const loadData = async () => {
  try {
    const params = new URLSearchParams({
      search: searchQuery.value,
      sortBy: sortBy.value || (activeTab.value === 'transactions' ? 'moment' : 'id'), // 'moment' or 'createdAt' depending on backend
      limit: 100
    })

    let url = ''
    if (activeTab.value === 'items') url = `/api/inventory-management/items?${params}`
    else if (activeTab.value === 'lots') url = `/api/inventory-management/lots?${params}`
    else if (activeTab.value === 'bins') url = `/api/inventory-management/bins?${params}`
    else if (activeTab.value === 'transactions') url = `/api/inventory-management/transactions?${params}`

    const response = await fetch(url, { headers: getAuthHeaders() })
    const result = await response.json()

    if (result.success) {
      if (activeTab.value === 'items') {
        items.value = result.data.items
      } else if (activeTab.value === 'lots') {
        // Map backend fields to frontend expected fields
        lots.value = result.data.lots.map(l => ({
          ...l,
          lot: l.lot_number,
          bin: l.bin?.bin_code || 'N/A',
          exp: l.expiry_date
        }))
      } else if (activeTab.value === 'bins') {
        bins.value = result.data.bins
      } else if (activeTab.value === 'transactions') {
        transactions.value = result.data.transactions.map(t => ({
          ...t,
          timestamp: t.transactionTime,
          type: t.transactionType === 'in' ? 'INBOUND' : 'OUTBOUND',
          sku: t.itemCode,
          qty: t.quantity,
          user: t.operator || 'System',
          status: 'COMPLETED'
        }))
      }
    }
  } catch (error) {
    console.error('Failed to load data:', error)
  }
}

const refreshData = () => {
  loadStats()
  loadData()
}

const exportData = async () => {
  try {
    const response = await fetch('/api/inventory-management/export', { headers: getAuthHeaders() })
    const result = await response.json()
    if (result.success) {
      const data = result.data
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventory-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error('Export failed:', error)
  }
}

const viewItemDetails = (item) => {
  selectedItem.value = item
  detailsModalTitle.value = `商品详情 - ${item.sku}`
  showDetailsModal.value = true
}

const printItemLabel = async (item) => {
  if (!confirm(`Generate QR label for ${item.sku}?`)) return

  try {
    const response = await fetch('/api/print-center/print', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        templateId: 'ITEM-60x40',
        printType: 'ITEM',
        items: [{ sku: item.sku }],
        options: { copies: 1, format: 'PDF' }
      })
    })
    
    const result = await response.json()
    
    if (result.success && result.data.download_url) {
      // Create a temporary link to download the PDF
      const link = document.createElement('a')
      link.href = result.data.download_url
      link.download = `Label-${item.sku}-${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      alert('Failed to generate label: ' + (result.message || 'Unknown error'))
    }
  } catch (error) {
    console.error('Print error:', error)
    alert('Error printing label: ' + error.message)
  }
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
  background: transparent;
  min-height: 100vh;
  color: var(--text-primary);
}

/* Glass Panel Utility */
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 24px;
}

.header h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.5px;
}

.subtitle {
  margin: 5px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Buttons */
.btn-glass {
  padding: 10px 20px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-glass:hover {
  background: var(--glass-border);
  transform: translateY(-1px);
}

.btn-icon {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: rgba(0, 0, 0, 0.05);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
  margin-bottom: 30px;
}

.stat-card {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-icon-wrapper.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.stat-icon-wrapper.purple { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
.stat-icon-wrapper.orange { background: rgba(249, 115, 22, 0.1); color: #f97316; }
.stat-icon-wrapper.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  letter-spacing: -1px;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 4px;
}

/* Data Section */
.data-section {
  padding: 0;
  overflow: hidden;
}

/* Tabs */
.tabs {
  display: flex;
  padding: 16px 24px 0;
  border-bottom: 1px solid var(--glass-border);
  gap: 24px;
}

.tab-btn {
  padding: 0 0 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s;
  position: relative;
}

.tab-btn.active {
  color: var(--text-primary);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--text-primary);
  border-radius: 2px 2px 0 0;
}

.tab-btn:hover {
  color: var(--text-primary);
}

/* Table Header */
.table-container {
  padding: 24px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.table-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.table-actions {
  display: flex;
  gap: 12px;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.search-input {
  padding: 10px 12px 10px 36px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  width: 240px;
  font-size: 14px;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.1);
}

.sort-select {
  padding: 10px 16px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
}

/* Data Table */
.table-wrapper {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  padding: 16px;
  text-align: left;
  background: rgba(0, 0, 0, 0.02);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--glass-border);
}

.data-table td {
  padding: 16px;
  border-bottom: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-size: 14px;
}

.data-table tr:last-child td {
  border-bottom: none;
}

.data-table tr:hover td {
  background: rgba(0, 0, 0, 0.02);
}

.mono-text {
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, monospace;
  font-size: 13px;
  color: var(--text-primary);
}

/* Status Badges */
.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
}

.status-badge.ACTIVE, .status-badge.COMPLETED, .status-badge.MOVE {
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
}

.status-badge.INACTIVE, .status-badge.OUT_OF_STOCK, .status-badge.OUTBOUND, .status-badge.CANCELLED {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}

.status-badge.LOW_STOCK, .status-badge.PENDING {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
}

.type-badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary);
}

.type-badge.INBOUND { background: rgba(59, 130, 246, 0.15); color: #2563eb; }

/* Utilization Bar */
.utilization-bar {
  width: 100px;
  height: 6px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.utilization-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.utilization-fill.low { background: #10b981; }
.utilization-fill.medium { background: #f59e0b; }
.utilization-fill.high { background: #ef4444; }

.utilization-text {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Expiry Colors */
.expiry-warning { color: #ef4444; font-weight: 600; }
.expiry-notice { color: #f59e0b; font-weight: 600; }
.expiry-normal { color: #10b981; }

/* Mobile Layout Styles */
.mobile-layout {
  padding-bottom: 80px;
}

.mobile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  margin-bottom: 20px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.mobile-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.mobile-stats-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 0 20px 20px;
  scrollbar-width: none;
}

.mobile-stats-scroll::-webkit-scrollbar {
  display: none;
}

.mobile-stat-card {
  min-width: 140px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-stat-card .stat-icon {
  font-size: 24px;
}

.mobile-stat-card .stat-info {
  display: flex;
  flex-direction: column;
}

.mobile-stat-card .stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.mobile-stat-card .stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.mobile-tabs-container {
  padding: 0 20px 20px;
}

.mobile-tabs {
  display: flex;
  background: rgba(118, 118, 128, 0.12);
  padding: 2px;
  border-radius: 8px;
}

.mobile-tab-btn {
  flex: 1;
  padding: 6px 0;
  border: none;
  background: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  border-radius: 6px;
  cursor: pointer;
}

.mobile-tab-btn.active {
  background: white;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
}

.mobile-search {
  padding: 0 20px 20px;
}

.mobile-search .search-wrapper {
  padding: 0;
  border-radius: 10px;
  background: var(--glass-bg);
}

.mobile-search .search-input {
  width: 100%;
  border: none;
  background: transparent;
}

.mobile-list {
  padding: 0 20px;
}

.list-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-card {
  padding: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}

.mobile-card:active {
  transform: scale(0.98);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.card-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--text-primary);
}

.card-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

.card-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.info-row .label {
  color: var(--text-secondary);
}

.info-row .value {
  color: var(--text-primary);
  font-weight: 500;
}

.utilization-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.utilization-wrapper .utilization-bar {
  flex: 1;
  margin-bottom: 0;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.json-view {
  background: rgba(0, 0, 0, 0.03);
  padding: 15px;
  border-radius: 8px;
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, monospace;
  font-size: 13px;
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .inventory-management {
    padding: 0;
  }
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

