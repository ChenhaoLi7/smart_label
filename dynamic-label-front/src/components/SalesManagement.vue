<template>
  <div class="sales-management">
    <!-- 顶部导航栏 -->
    <div class="nav-header">
      <div class="nav-content">
        <div class="nav-left">
          <button @click="goBack" class="back-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5"/>
              <path d="M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 class="page-title">销售管理</h1>
        </div>
        <div class="nav-right">
          <button @click="showCreateDialog = true" class="create-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14"/>
              <path d="M5 12h14"/>
            </svg>
            新建销售订单
          </button>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 筛选器 -->
      <div class="filters-section">
        <div class="filters">
          <div class="filter-group">
            <label>状态</label>
            <select v-model="filters.status" @change="loadSalesOrders">
              <option value="">全部状态</option>
              <option value="DRAFT">草稿</option>
              <option value="CONFIRMED">已确认</option>
              <option value="PICKING">拣货中</option>
              <option value="PARTIAL">部分发货</option>
              <option value="SHIPPED">已发货</option>
              <option value="DELIVERED">已交付</option>
              <option value="CANCELLED">已取消</option>
            </select>
          </div>
          <div class="filter-group">
            <label>客户</label>
            <input v-model="filters.customer_name" @input="debounceSearch" placeholder="输入客户名称">
          </div>
          <div class="filter-group">
            <label>订单号</label>
            <input v-model="filters.so_number" @input="debounceSearch" placeholder="输入销售订单号">
          </div>
          <button @click="resetFilters" class="reset-btn">重置</button>
        </div>
      </div>

      <!-- 销售订单列表 -->
      <div class="orders-section">
        <div class="section-header">
          <h2>销售订单列表</h2>
          <div class="section-actions">
            <span class="total-count">共 {{ pagination.total }} 条记录</span>
          </div>
        </div>

        <!-- 订单卡片列表 -->
        <div class="orders-grid" v-if="salesOrders.length > 0">
          <div 
            v-for="order in salesOrders" 
            :key="order.id" 
            class="order-card"
            @click="showOrderDetail(order)"
          >
            <div class="card-header">
              <div class="order-info">
                <h3 class="order-number">{{ order.so_number }}</h3>
                <span class="customer-name">{{ order.customer_name }}</span>
              </div>
              <div class="order-status">
                <span :class="['status-badge', order.status.toLowerCase()]">
                  {{ getStatusText(order.status) }}
                </span>
              </div>
            </div>
            
            <div class="card-body">
              <div class="order-details">
                <div class="detail-item">
                  <span class="label">订单金额:</span>
                  <span class="value">¥{{ formatAmount(order.total_amount) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">要求发货:</span>
                  <span class="value">{{ formatDate(order.ship_date) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">订单行数:</span>
                  <span class="value">{{ order.lines?.length || 0 }} 行</span>
                </div>
                <div class="detail-item">
                  <span class="label">创建时间:</span>
                  <span class="value">{{ formatDateTime(order.created_at) }}</span>
                </div>
              </div>
            </div>

            <div class="card-actions">
              <button 
                v-if="order.status === 'DRAFT'" 
                @click.stop="confirmOrder(order)"
                class="action-btn primary"
              >
                确认订单
              </button>
              <button 
                v-if="order.status === 'CONFIRMED'" 
                @click.stop="generatePickingTasks(order)"
                class="action-btn secondary"
              >
                生成拣货任务
              </button>
              <button 
                @click.stop="showOrderDetail(order)"
                class="action-btn outline"
              >
                查看详情
              </button>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>暂无销售订单</h3>
          <p>点击右上角按钮创建您的第一个销售订单</p>
        </div>

        <!-- 分页器 -->
        <div class="pagination" v-if="pagination.pages > 1">
          <button 
            @click="changePage(pagination.page - 1)"
            :disabled="pagination.page <= 1"
            class="page-btn"
          >
            上一页
          </button>
          <span class="page-info">
            第 {{ pagination.page }} 页 / 共 {{ pagination.pages }} 页
          </span>
          <button 
            @click="changePage(pagination.page + 1)"
            :disabled="pagination.page >= pagination.pages"
            class="page-btn"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <!-- 创建销售订单对话框 -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click="showCreateDialog = false">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>新建销售订单</h3>
          <button @click="showCreateDialog = false" class="close-btn">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>客户名称 *</label>
            <input v-model="newOrder.customer_name" placeholder="输入客户名称" required>
          </div>
          <div class="form-group">
            <label>客户ID</label>
            <input v-model="newOrder.customer_id" placeholder="输入客户ID">
          </div>
          <div class="form-group">
            <label>要求发货日期</label>
            <input v-model="newOrder.ship_date" type="date">
          </div>
          <div class="form-group">
            <label>要求交货日期</label>
            <input v-model="newOrder.delivery_date" type="date">
          </div>
          <div class="form-group">
            <label>优先级</label>
            <select v-model="newOrder.priority">
              <option value="LOW">低</option>
              <option value="NORMAL">正常</option>
              <option value="HIGH">高</option>
              <option value="URGENT">紧急</option>
            </select>
          </div>
          <div class="form-group">
            <label>收货地址</label>
            <textarea v-model="newOrder.shipping_address" placeholder="输入收货地址"></textarea>
          </div>
          <div class="form-group">
            <label>配送方式</label>
            <input v-model="newOrder.shipping_method" placeholder="输入配送方式">
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea v-model="newOrder.notes" placeholder="输入备注信息"></textarea>
          </div>

          <!-- 销售订单行 -->
          <div class="order-lines-section">
            <div class="section-header">
              <h4>销售明细</h4>
              <button @click="addOrderLine" class="add-line-btn">添加行</button>
            </div>
            <div class="order-lines">
              <div v-for="(line, index) in newOrder.lines" :key="index" class="order-line">
                <div class="line-fields">
                  <input v-model="line.sku" placeholder="SKU" class="sku-input">
                  <input v-model.number="line.qty" type="number" placeholder="数量" class="qty-input">
                  <input v-model.number="line.unit_price" type="number" step="0.01" placeholder="单价" class="price-input">
                  <input v-model="line.notes" placeholder="备注" class="notes-input">
                  <button @click="removeOrderLine(index)" class="remove-btn">×</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button @click="showCreateDialog = false" class="cancel-btn">取消</button>
          <button @click="createSalesOrder" :disabled="creating" class="confirm-btn">
            {{ creating ? '创建中...' : '创建订单' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 响应式数据
const loading = ref(false)
const creating = ref(false)
const showCreateDialog = ref(false)
const salesOrders = ref([])
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  pages: 0
})

const filters = reactive({
  status: '',
  customer_name: '',
  so_number: ''
})

const newOrder = reactive({
  customer_name: '',
  customer_id: '',
  ship_date: '',
  delivery_date: '',
  priority: 'NORMAL',
  shipping_address: '',
  shipping_method: '',
  notes: '',
  lines: []
})

// 生命周期
onMounted(() => {
  loadSalesOrders()
})

// 方法
const goBack = () => {
  router.push('/dashboard')
}

const loadSalesOrders = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    const params = new URLSearchParams({
      page: pagination.value.page,
      limit: pagination.value.limit,
      ...filters
    })

    // 注意：这里使用 /api/sales/orders，如果后端还没有实现，可以先注释掉或使用模拟数据
    const response = await fetch(`/api/sales/orders?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      salesOrders.value = data.data?.salesOrders || []
      pagination.value = data.data?.pagination || pagination.value
    } else {
      // 如果后端还没有实现，显示空列表
      console.warn('销售订单API尚未实现，显示空列表')
      salesOrders.value = []
    }
  } catch (error) {
    console.error('获取销售订单失败:', error)
    // 如果后端还没有实现，显示空列表
    salesOrders.value = []
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.status = ''
  filters.customer_name = ''
  filters.so_number = ''
  pagination.value.page = 1
  loadSalesOrders()
}

let searchTimeout = null
const debounceSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    pagination.value.page = 1
    loadSalesOrders()
  }, 500)
}

const changePage = (page) => {
  if (page >= 1 && page <= pagination.value.pages) {
    pagination.value.page = page
    loadSalesOrders()
  }
}

const addOrderLine = () => {
  newOrder.lines.push({
    sku: '',
    qty: 1,
    unit_price: 0,
    notes: ''
  })
}

const removeOrderLine = (index) => {
  newOrder.lines.splice(index, 1)
}

const createSalesOrder = async () => {
  if (!newOrder.customer_name || newOrder.lines.length === 0) {
    alert('请填写客户名称和至少一行销售明细')
    return
  }

  creating.value = true
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/sales/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newOrder)
    })

    if (response.ok) {
      alert('销售订单创建成功')
      showCreateDialog.value = false
      resetNewOrder()
      loadSalesOrders()
    } else {
      const error = await response.json()
      alert(error.message || '创建销售订单失败')
    }
  } catch (error) {
    console.error('创建销售订单失败:', error)
    alert('创建销售订单失败（后端API可能尚未实现）')
  } finally {
    creating.value = false
  }
}

const resetNewOrder = () => {
  newOrder.customer_name = ''
  newOrder.customer_id = ''
  newOrder.ship_date = ''
  newOrder.delivery_date = ''
  newOrder.priority = 'NORMAL'
  newOrder.shipping_address = ''
  newOrder.shipping_method = ''
  newOrder.notes = ''
  newOrder.lines = []
}

const confirmOrder = async (order) => {
  if (!confirm(`确认销售订单 ${order.so_number}？`)) return

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/sales/orders/${order.id}/confirm`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      alert('销售订单确认成功')
      loadSalesOrders()
    } else {
      const error = await response.json()
      alert(error.message || '确认销售订单失败')
    }
  } catch (error) {
    console.error('确认销售订单失败:', error)
    alert('确认销售订单失败（后端API可能尚未实现）')
  }
}

const generatePickingTasks = (order) => {
  // TODO: 实现生成拣货任务逻辑
  console.log('生成拣货任务:', order)
  alert('拣货任务功能开发中...')
}

const showOrderDetail = (order) => {
  // TODO: 实现订单详情页面
  console.log('查看订单详情:', order)
  alert(`查看订单详情: ${order.so_number}`)
}

// 工具函数
const getStatusText = (status) => {
  const statusMap = {
    DRAFT: '草稿',
    CONFIRMED: '已确认',
    PICKING: '拣货中',
    PARTIAL: '部分发货',
    SHIPPED: '已发货',
    DELIVERED: '已交付',
    CANCELLED: '已取消'
  }
  return statusMap[status] || status
}

const formatAmount = (amount) => {
  return Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('zh-CN')
}

const formatDateTime = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}
</script>

<style scoped>
.sales-management {
  min-height: 100vh;
  background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 顶部导航栏 */
.nav-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  background: none;
  border: none;
  color: #007AFF;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn:hover {
  background: rgba(0, 122, 255, 0.1);
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #1d1d1f;
  margin: 0;
}

.create-btn {
  background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.create-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 122, 255, 0.3);
}

/* 主要内容区域 */
.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
}

/* 筛选器 */
.filters-section {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 32px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.filters {
  display: flex;
  gap: 20px;
  align-items: end;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 150px;
}

.filter-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.filter-group input,
.filter-group select {
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.filter-group input:focus,
.filter-group select:focus {
  outline: none;
  border-color: #007AFF;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.reset-btn {
  background: rgba(0, 122, 255, 0.1);
  color: #007AFF;
  border: 1px solid rgba(0, 122, 255, 0.2);
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.reset-btn:hover {
  background: rgba(0, 122, 255, 0.15);
}

/* 订单列表 */
.orders-section {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0;
}

.total-count {
  font-size: 14px;
  color: #6b7280;
}

.orders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.order-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.order-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  border-color: rgba(0, 122, 255, 0.2);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 16px;
}

.order-number {
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 4px 0;
}

.customer-name {
  font-size: 14px;
  color: #6b7280;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.draft { background: #f3f4f6; color: #374151; }
.status-badge.confirmed { background: #dbeafe; color: #1d4ed8; }
.status-badge.picking { background: #fef3c7; color: #92400e; }
.status-badge.partial { background: #fde68a; color: #78350f; }
.status-badge.shipped { background: #d1fae5; color: #065f46; }
.status-badge.delivered { background: #a7f3d0; color: #047857; }
.status-badge.cancelled { background: #fee2e2; color: #991b1b; }

.card-body {
  margin-bottom: 16px;
}

.order-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.detail-item .label {
  color: #6b7280;
}

.detail-item .value {
  color: #1d1d1f;
  font-weight: 500;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid;
}

.action-btn.primary {
  background: #007AFF;
  color: white;
  border-color: #007AFF;
}

.action-btn.primary:hover {
  background: #0056CC;
}

.action-btn.secondary {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.action-btn.secondary:hover {
  background: #d97706;
}

.action-btn.outline {
  background: transparent;
  color: #374151;
  border-color: rgba(0, 0, 0, 0.2);
}

.action-btn.outline:hover {
  background: rgba(0, 0, 0, 0.05);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 18px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px 0;
}

/* 分页器 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
}

.page-btn {
  background: rgba(0, 122, 255, 0.1);
  color: #007AFF;
  border: 1px solid rgba(0, 122, 255, 0.2);
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  background: rgba(0, 122, 255, 0.15);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #6b7280;
}

/* 对话框 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
}

.dialog-header h3 {
  font-size: 20px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
}

.dialog-body {
  padding: 0 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #007AFF;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

/* 订单行 */
.order-lines-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.order-lines-section .section-header {
  margin-bottom: 16px;
}

.order-lines-section h4 {
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0;
}

.add-line-btn {
  background: rgba(0, 122, 255, 0.1);
  color: #007AFF;
  border: 1px solid rgba(0, 122, 255, 0.2);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.add-line-btn:hover {
  background: rgba(0, 122, 255, 0.15);
}

.order-line {
  margin-bottom: 12px;
}

.line-fields {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 2fr auto;
  gap: 12px;
  align-items: center;
}

.line-fields input {
  margin: 0;
}

.remove-btn {
  background: #ef4444;
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: #dc2626;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.cancel-btn {
  background: transparent;
  color: #6b7280;
  border: 1px solid rgba(0, 0, 0, 0.2);
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.confirm-btn {
  background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.confirm-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

.confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 加载状态 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f4f6;
  border-top: 3px solid #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .main-content {
    padding: 16px;
  }
  
  .filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-group {
    min-width: auto;
  }
  
  .orders-grid {
    grid-template-columns: 1fr;
  }
  
  .order-details {
    grid-template-columns: 1fr;
  }
  
  .line-fields {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .dialog {
    width: 95%;
    margin: 20px;
  }
}
</style>

