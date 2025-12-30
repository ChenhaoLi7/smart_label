<template>
  <div class="warehouse-dashboard">
    <!-- 顶部导航栏 - Apple风格 -->
    <div class="nav-header">
      <div class="nav-content">
        <div class="nav-left">
          <div class="logo">
            <div class="logo-icon">📦</div>
            <span class="logo-text">Smart Warehouse</span>
          </div>
        </div>
        <div class="nav-right">
          <div class="user-menu">
            <AvatarUpload 
              :username="username" 
              :current-avatar="userAvatar"
              @avatar-updated="handleAvatarUpdated"
            />
            <span class="username">{{ username }}</span>
            <button @click="logout" class="logout-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 主布局容器 -->
    <div v-if="!isMobile" class="desktop-layout">
      <div class="main-layout">
        <!-- 左侧导航栏 -->
        <div 
          class="sidebar" 
          :class="{ 'collapsed': isSidebarCollapsed }"
          @mouseenter="isHovered = true"
          @mouseleave="isHovered = false"
        >
          
          <div class="sidebar-content">
            <!-- Main Functions Navigation -->
            <div class="nav-section">
              <h3 class="nav-title">Main Functions</h3>
              <nav class="nav-menu">
                <a href="#" @click.prevent="goToAdvancedScan" class="nav-item">
                  <div class="nav-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                      <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                      <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                      <path d="M8 12h8"/>
                      <path d="M8 8h8"/>
                      <path d="M8 16h6"/>
                    </svg>
                  </div>
                  <span class="nav-text">Advanced Scan</span>
                </a>
                
                <a href="#" @click.prevent="goToLabelDesign" class="nav-item active">
                  <div class="nav-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                      <line x1="7" y1="7" x2="7.01" y2="7"/>
                    </svg>
                  </div>
                  <span class="nav-text">Label Design</span>
                </a>
                
                <a href="#" @click.prevent="goToPrintCenter" class="nav-item">
                  <div class="nav-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <polyline points="6,9 6,2 18,2 18,9"/>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                      <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                  </div>
                  <span class="nav-text">Print Center</span>
                </a>
              </nav>
            </div>
  
            <!-- Management Functions -->
            <div class="nav-section">
              <h3 class="nav-title">Management</h3>
              <nav class="nav-menu">
                <a href="#" @click.prevent="goToInventoryManagement" class="nav-item">
                  <div class="nav-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
                      <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                  </div>
                  <span class="nav-text">Inventory</span>
                </a>
                
                <a href="#" @click.prevent="goToPurchaseManagement" class="nav-item">
                  <div class="nav-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                      <path d="M9 14l2 2 4-4"/>
                    </svg>
                  </div>
                  <span class="nav-text">Purchase</span>
                </a>
                
                <a href="#" @click.prevent="goToSalesManagement" class="nav-item">
                  <div class="nav-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8z"/>
                      <path d="m3.3 7 8.7 5 8.7-5"/>
                      <path d="M12 22V12"/>
                    </svg>
                  </div>
                  <span class="nav-text">Sales</span>
                </a>
  
                <a href="#" @click.prevent="goToAnalytics" class="nav-item">
                  <div class="nav-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                  </div>
                  <span class="nav-text">AI Analytics</span>
                </a>
              </nav>
            </div>
  
            <!-- Quick Actions -->
            <div class="nav-section">
              <h3 class="nav-title">Quick Actions</h3>
              <div class="quick-actions">
                <button class="quick-btn primary" @click="goToLabelDesign">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14"/>
                    <path d="M5 12h14"/>
                  </svg>
                  New Label
                </button>
                <button class="quick-btn secondary" @click="goToAdvancedScan">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                    <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  </svg>
                  Scan Inbound
                </button>
              </div>
            </div>
          </div>

          <!-- 侧边栏切换按钮 (Exness 风格 - 底部) -->
          <button class="sidebar-toggle-bottom" @click="toggleSidebar">
            <svg v-if="sidebarCollapsed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="13 17 18 12 13 7" />
              <polyline points="6 17 11 12 6 7" />
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="11 17 6 12 11 7" />
              <polyline points="18 17 13 12 18 7" />
            </svg>
          </button>
        </div>

        <!-- 右侧主内容区 -->
        <div class="main-content">
          <!-- Welcome Section -->
          <div class="welcome-section">
            <div class="welcome-header">
              <h1 class="page-title">Warehouse Management Center</h1>
            </div>
            <div class="welcome-actions">
              <button class="action-btn primary" @click="goToLabelDesign">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Design Label
              </button>
              <button class="action-btn secondary" @click="goToAdvancedScan">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                  <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                </svg>
                Start Scanning
              </button>
            </div>
          </div>
  
          <!-- System Overview -->
          <div class="overview-section">
            <div class="section-header">
              <h2 class="section-title">System Overview</h2>
              <p class="section-subtitle">Real-time warehouse operations monitoring</p>
            </div>
            
            <div class="stats-grid">
              <div class="stat-card primary glassmorphism">
                <div class="stat-content">
                  <div class="stat-header">
                    <div class="stat-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                      </svg>
                    </div>
                    <div class="stat-trend positive">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
                        <polyline points="17,6 23,6 23,12"/>
                      </svg>
                      +12%
                    </div>
                  </div>
                  <div class="stat-number">156</div>
                  <div class="stat-label">Active Items</div>
                  <div class="stat-description">18 new items this month</div>
                  <div class="trend-chart">
                    <svg width="100" height="30" viewBox="0 0 100 30">
                      <polyline points="0,25 20,20 40,15 60,18 80,12 100,8" 
                                fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
                    </svg>
                  </div>
                </div>
              </div>
  
              <div class="stat-card glassmorphism">
                <div class="stat-content">
                  <div class="stat-header">
                    <div class="stat-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                        <line x1="7" y1="7" x2="7.01" y2="7"/>
                      </svg>
                    </div>
                    <div class="stat-trend positive">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
                        <polyline points="17,6 23,6 23,12"/>
                      </svg>
                      +5%
                    </div>
                  </div>
                  <div class="stat-number">89</div>
                  <div class="stat-label">Inventory Lots</div>
                  <div class="stat-description">Good turnover</div>
                  <div class="trend-chart">
                    <svg width="100" height="30" viewBox="0 0 100 30">
                      <polyline points="0,20 25,18 50,15 75,12 100,10" 
                                fill="none" stroke="rgba(52,199,89,0.6)" stroke-width="2"/>
                    </svg>
                  </div>
                </div>
              </div>
  
              <div class="stat-card glassmorphism">
                <div class="stat-content">
                  <div class="stat-header">
                    <div class="stat-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                      </svg>
                    </div>
                    <div class="stat-trend negative">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="1,18 10.5,8.5 15.5,13.5 23,6"/>
                        <polyline points="7,18 1,18 1,12"/>
                      </svg>
                      -3%
                    </div>
                  </div>
                  <div class="stat-number">45</div>
                  <div class="stat-label">Pending Tasks</div>
                  <div class="stat-description">Needs attention</div>
                  <div class="trend-chart">
                    <svg width="100" height="30" viewBox="0 0 100 30">
                      <polyline points="0,10 20,12 40,15 60,18 80,20 100,22" 
                                fill="none" stroke="rgba(255,149,0,0.6)" stroke-width="2"/>
                    </svg>
                  </div>
                </div>
              </div>
  
              <div class="stat-card featured glassmorphism">
                <div class="stat-content">
                  <div class="efficiency-display">
                    <div class="efficiency-ring">
                      <svg width="80" height="80" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="6"/>
                        <circle cx="40" cy="40" r="30" fill="none" stroke="#ffffff" stroke-width="6" 
                                stroke-dasharray="150" stroke-dashoffset="33" stroke-linecap="round"/>
                      </svg>
                      <div class="ring-center">
                        <div class="efficiency-number">78%</div>
                        <div class="efficiency-label">Efficiency</div>
                      </div>
                    </div>
                  </div>
                  <div class="stat-label">Inventory Efficiency</div>
                  <div class="stat-description">Operations running well</div>
                  <div class="efficiency-trend">
                    <span class="trend-indicator positive">↗ Continuously rising</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
  
  
          <!-- Floating Action Buttons -->
          <div class="floating-actions">
            <button class="fab primary" @click="goToLabelDesign" title="Design Label">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
            </button>
            <button class="fab secondary" @click="goToAdvancedScan" title="Start Scanning">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Mobile Layout -->
    <div v-if="isMobile" class="mobile-layout">
      <div class="mobile-header">
        <div class="mobile-user-info">
          <AvatarUpload 
            :username="username" 
            :current-avatar="userAvatar"
            @avatar-updated="handleAvatarUpdated"
            class="mobile-avatar"
          />
          <div class="mobile-welcome">
            <span class="greeting">Hi, {{ username }}</span>
            <span class="subtitle">Ready to scan?</span>
          </div>
        </div>
        <button @click="logout" class="mobile-logout">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>

      <div class="mobile-content">
        <!-- Hero Scan Button -->
        <div class="hero-scan-container" @click="goToAdvancedScan">
          <div class="scan-circle">
            <div class="scan-icon-wrapper">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                <line x1="2" y1="12" x2="22" y2="12" class="scan-line"/>
              </svg>
            </div>
            <span class="scan-text">TAP TO SCAN</span>
          </div>
          <div class="scan-ripple"></div>
        </div>

        <!-- Simplified Stats -->
        <div class="mobile-stats-container">
          <div class="mobile-stat-card warning" v-if="systemStats.lowStockCount > 0">
            <div class="stat-icon">⚠️</div>
            <div class="stat-info">
              <span class="stat-value">{{ systemStats.lowStockCount }}</span>
              <span class="stat-label">Low Stock Items</span>
            </div>
          </div>
          
          <div class="mobile-stat-card normal">
             <div class="stat-icon">📦</div>
             <div class="stat-info">
               <span class="stat-value">{{ systemStats.totalItems }}</span>
               <span class="stat-label">Total Items</span>
             </div>
          </div>
        </div>
      </div>

      <!-- Mobile Bottom Navigation -->
      <nav class="mobile-bottom-nav">
        <a href="#" class="nav-tab active">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>Home</span>
        </a>
        <a href="#" class="nav-tab" @click.prevent="goToInventoryManagement">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <span>Stock</span>
        </a>
      </nav>
    </div>
  </div>
</template>
  
<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import AvatarUpload from './AvatarUpload.vue'

const router = useRouter()
const username = ref('Admin')
const userAvatar = ref('')
const sidebarCollapsed = ref(false)
const isHovered = ref(false)
const isMobile = ref(false)

const checkDevice = () => {
  isMobile.value = window.innerWidth <= 768
}

// 计算侧边栏是否应该折叠
// 逻辑：如果用户设置了折叠，且鼠标没有悬停在上面，则折叠。
// 只要鼠标悬停，或者用户设置了展开，就保持展开。
const isSidebarCollapsed = computed(() => {
  if (isMobile.value) return true // 移动端逻辑通常不同，这里暂时保持兼容
  return sidebarCollapsed.value && !isHovered.value
})

const systemStats = ref({
  totalItems: 0,
  totalLots: 0,
  totalBins: 0,
  utilization: '0%',
  lowStockCount: 0
})

onMounted(() => {
  checkDevice()
  window.addEventListener('resize', checkDevice)
  loadSystemStats()
  loadUserInfo()
  restoreSidebarState()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkDevice)
})

const loadSystemStats = async () => {
  try {
    const token = localStorage.getItem('token')
    if (!token) {
      // 使用默认数据
      systemStats.value = {
        totalItems: 156,
        totalLots: 89,
        totalBins: 45,
        utilization: '78%',
        lowStockCount: 0
      }
      return
    }

    const response = await fetch('/api/inventory-management/stats', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const result = await response.json()
      if (result.success) {
        systemStats.value = {
          totalItems: result.data.totalItems || 156,
          totalLots: result.data.totalLots || 89,
          totalBins: result.data.totalBins || 45,
          utilization: `${result.data.utilization || 78}%`,
          lowStockCount: result.data.lowStockCount || 0
        }
      }
    } else {
      // 使用默认数据
      systemStats.value = {
        totalItems: 156,
        totalLots: 89,
        totalBins: 45,
        utilization: '78%',
        lowStockCount: 0
      }
    }
  } catch (error) {
    console.error('加载系统统计失败:', error)
    // 使用默认数据
    systemStats.value = {
      totalItems: 156,
      totalLots: 89,
      totalBins: 45,
      utilization: '78%',
      lowStockCount: 0
    }
  }
}

const loadUserInfo = async () => {
  try {
    const token = localStorage.getItem('token')
    if (!token) return

    const response = await fetch('/api/auth/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const result = await response.json()
      if (result.success) {
        username.value = result.data.user.username
        userAvatar.value = result.data.user.avatar || ''
      }
    }
  } catch (error) {
    console.error('加载用户信息失败:', error)
  }
}

const handleAvatarUpdated = (avatarUrl) => {
  userAvatar.value = avatarUrl
}

const goToAdvancedScan = () => {
  router.push('/advanced-scan')
}

const goToLabelDesign = () => {
  router.push('/label-design')
}

const goToPrintCenter = () => {
  router.push('/print-center')
}

const goToInventoryManagement = () => {
  router.push('/inventory-management')
}

const goToPurchaseManagement = () => {
  router.push('/purchase-management')
}

const goToSalesManagement = () => {
  // 暂时跳转到打印中心，后续实现销售管理页面
  router.push('/print-center')
}

const goToAnalytics = () => {
  router.push('/analytics')
}

// 切换侧边栏
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
  // 保存状态到本地存储
  localStorage.setItem('sidebarCollapsed', sidebarCollapsed.value.toString())
}

// 从本地存储恢复侧边栏状态
const restoreSidebarState = () => {
  const saved = localStorage.getItem('sidebarCollapsed')
  if (saved !== null) {
    sidebarCollapsed.value = saved === 'true'
  }
    }

const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  localStorage.removeItem('userAvatar')
  router.push('/login')
}
</script>
  
<style scoped>
/* Apple风格设计系统 */
.warehouse-dashboard {
  min-height: 100vh;
  background-color: var(--bg-primary);
  position: relative;
  overflow: hidden; /* Prevent scrollbars from moving lights */
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif;
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* 环境光效 - 模拟空间感 */
.ambient-light {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.6;
  animation: float 10s infinite ease-in-out alternate;
  z-index: 0;
  pointer-events: none;
}

.light-1 {
  top: -10%;
  left: -10%;
  width: 50vw;
  height: 50vw;
  background: radial-gradient(circle, var(--light-1), transparent 70%);
}

.light-2 {
  bottom: -10%;
  right: -10%;
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, var(--light-2), transparent 70%);
  animation-delay: -5s;
}

.light-3 {
  top: 40%;
  left: 40%;
  width: 30vw;
  height: 30vw;
  background: radial-gradient(circle, var(--light-3), transparent 70%);
  animation-duration: 15s;
}

@keyframes float {
  0% { transform: translate(0, 0); }
  100% { transform: translate(30px, 20px); }
}

/* 顶部导航栏 */
.nav-header {
  height: 64px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  position: relative;
  z-index: 100;
  flex-shrink: 0;
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

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 20px;
  font-weight: 600;
  color: #1d1d1f;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #000000;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.username {
  font-size: 15px;
  font-weight: 500;
  color: #1d1d1f;
}

.logout-btn {
  background: none;
  border: none;
  color: #000000;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logout-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

/* 主布局容器 */
.main-layout {
  display: flex;
  height: calc(100vh - 64px);
  overflow: hidden;
}

/* 左侧导航栏 */
.sidebar {
  width: 280px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar.collapsed .sidebar-content {
  opacity: 0;
  transform: translateX(-20px);
}

.sidebar.collapsed .nav-text {
  opacity: 0;
}

.sidebar.collapsed .nav-title {
  opacity: 0;
}

.sidebar.collapsed .quick-actions {
  opacity: 0;
}

/* 侧边栏底部切换按钮 */
.sidebar-toggle-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 48px;
  background: rgba(255, 255, 255, 0.95);
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: flex-end; /* 展开时靠右 */
  padding-right: 20px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
}

.sidebar.collapsed .sidebar-toggle-bottom {
  justify-content: center; /* 收起时居中 */
  padding-right: 0;
}

.sidebar-toggle-bottom:hover {
  background: #f3f4f6;
  color: #111827;
}

.sidebar-content {
  padding: 24px;
  height: calc(100% - 48px); /* 减去底部按钮高度 */
  overflow-y: auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-section {
  margin-bottom: 32px;
}

.nav-title {
  font-size: 13px;
  font-weight: 600;
  color: #86868b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
  padding: 0 12px;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: #1d1d1f;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #000000;
}

.nav-item.active {
  background: #000000;
  color: white;
}

.nav-item.active .nav-icon {
  color: white;
}

.nav-icon {
  color: #86868b;
  transition: color 0.2s ease;
}

.nav-item:hover .nav-icon {
  color: #000000;
}

.nav-text {
  flex: 1;
  transition: opacity 0.3s ease;
}

.nav-title {
  transition: opacity 0.3s ease;
}

/* 快捷操作按钮 */
.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: opacity 0.3s ease;
}

.quick-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-btn.primary {
  background: #000000;
  color: white;
}

.quick-btn.primary:hover {
  background: #1f2937;
  transform: translateY(-1px);
}

.quick-btn.secondary {
  background: rgba(0, 0, 0, 0.05);
  color: #000000;
}

.quick-btn.secondary:hover {
  background: rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}

/* 右侧主内容区域 */
.main-content {
  flex: 1;
  padding: 40px 48px;
  overflow-y: auto;
  background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
  position: relative;
}

/* 欢迎区域 */
.welcome-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 48px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 32px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.welcome-header {
  flex: 1;
}

.page-title {
  font-size: 32px;
  font-weight: 700;
  color: #1d1d1f;
  margin: 0 0 8px 0;
  letter-spacing: -0.5px;
}

.page-subtitle {
  font-size: 17px;
  color: #86868b;
  margin: 0;
  font-weight: 400;
}

.welcome-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btn.primary {
  background: #000000;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.action-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

.action-btn.secondary {
  background: rgba(0, 0, 0, 0.05);
  color: #000000;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.action-btn.secondary:hover {
  background: rgba(0, 0, 0, 0.05);
  transform: translateY(-2px);
}

/* 统计概览区域 */
.overview-section {
  margin-bottom: 56px;
}

.section-header {
  margin-bottom: 24px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1d1d1f;
  margin: 0 0 4px 0;
  letter-spacing: -0.3px;
}

.section-subtitle {
  font-size: 15px;
  color: #86868b;
  margin: 0;
  font-weight: 400;
}

/* 快速访问区域 */
.quick-access-section {
  margin-bottom: 48px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

/* 圆角卡片按钮样式 */
.quick-card-button {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  padding: 24px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: left;
  width: 100%;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

.quick-card-button:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
  border-color: rgba(0, 0, 0, 0.1);
}

.quick-card-button.primary {
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.1);
}

.quick-card-button.primary:hover {
  background: rgba(0, 0, 0, 0.1);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
}

.quick-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 16px;
}

.quick-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.1);
}

.quick-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #000000;
  flex-shrink: 0;
}

.quick-icon.featured {
  background: #000000;
  color: white;
}

.quick-info {
  flex: 1;
}

.quick-title {
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 4px 0;
}

.quick-desc {
  font-size: 14px;
  color: #86868b;
  margin: 0;
  line-height: 1.4;
}

/* 快速访问箭头 */
.quick-arrow {
  color: #86868b;
  transition: all 0.3s ease;
  opacity: 0.6;
}

.quick-card-button:hover .quick-arrow {
  color: #000000;
  opacity: 1;
  transform: translateX(4px);
}

/* 浮动操作按钮 */
.floating-actions {
  position: fixed;
  bottom: 32px;
  right: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 1000;
}

.fab {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(20px);
  position: relative;
  overflow: hidden;
}

.fab.primary {
  background: #000000;
  color: white;
}

.fab.secondary {
  background: rgba(255, 255, 255, 0.9);
  color: #000000;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.fab:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
}

.fab.primary:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
}

.fab.secondary:hover {
  background: rgba(0, 0, 0, 0.05);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
}

.fab:active {
  transform: translateY(0) scale(0.95);
}

.module-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.module-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  border-color: rgba(0, 0, 0, 0.1);
}

.module-card.featured {
  background: #000000;
  color: white;
}

.module-card.featured .card-icon {
  color: white;
}

.module-card.featured .card-title {
  color: white;
}

.module-card.featured .card-description {
  color: rgba(255, 255, 255, 0.8);
}

.card-content {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #000000;
  flex-shrink: 0;
}

.card-info {
  flex: 1;
}

.card-title {
  font-size: 17px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 4px 0;
}

.card-description {
  font-size: 15px;
  color: #86868b;
  margin: 0;
  line-height: 1.4;
}

/* 状态概览 */
.stats-section {
  margin-top: 48px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-card {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid var(--glass-border);
  padding: 28px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* 毛玻璃效果增强 */
.stat-card.glassmorphism {
  background: var(--glass-bg);
  backdrop-filter: blur(25px);
  border: 1px solid var(--glass-border);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.stat-card.primary.glassmorphism {
  background: var(--glass-bg);
  backdrop-filter: blur(25px);
  border: 1px solid var(--glass-border);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.stat-card.primary {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.stat-card.primary .stat-number {
  color: var(--text-primary);
}

.stat-card.primary .stat-label {
  color: var(--text-secondary);
}

.stat-card.primary .stat-description {
  color: var(--text-secondary);
}

.stat-card.primary .stat-icon {
  color: #000000;
  opacity: 1;
}

.stat-card.featured {
  background: var(--glass-bg);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.stat-card.featured .stat-label {
  color: var(--text-secondary);
}

.stat-card.featured .stat-description {
  color: var(--text-secondary);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.stat-description {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
  font-weight: 400;
}

.efficiency-display {
  margin-bottom: 16px;
}

.efficiency-number {
  font-size: 20px;
  font-weight: 700;
}

.efficiency-label {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 2px;
}

.stat-content {
  position: relative;
  z-index: 2;
}

.stat-number {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
  line-height: 1;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.stat-trend {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  display: inline-block;
}

.stat-trend.positive {
  background: rgba(52, 199, 89, 0.15);
  color: #34C759;
}

.stat-trend.negative {
  background: rgba(255, 149, 0, 0.15);
  color: #FF9500;
}

/* 趋势图表样式 */
.trend-chart {
  margin-top: 12px;
  opacity: 0.8;
  transition: opacity 0.3s ease;
}

.stat-card:hover .trend-chart {
  opacity: 1;
}

/* 效率趋势指示器 */
.efficiency-trend {
  margin-top: 12px;
  text-align: center;
}

.trend-indicator {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  display: inline-block;
}

.trend-indicator.positive {
  background: rgba(52, 199, 89, 0.15);
  color: #34C759;
}

.stat-icon {
  position: absolute;
  top: 24px;
  right: 24px;
  opacity: 0.1;
  color: #000000;
}

/* 效率环形图 */
.efficiency-ring {
  position: relative;
  display: inline-block;
}

.ring-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 16px;
  font-weight: 700;
  color: white;
}

.featured-stat .stat-number {
  color: var(--text-primary);
  font-size: 24px;
}

.featured-stat .stat-label {
  color: var(--text-secondary);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .main-layout {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }
  
  .sidebar.collapsed {
    width: 100%;
    height: 64px;
  }
  
  .sidebar.collapsed .sidebar-content {
    opacity: 0;
    height: 0;
    overflow: hidden;
  }
  
  .sidebar-toggle {
    top: 16px;
    right: 16px;
  }
  
  .sidebar-content {
    padding: 16px 24px;
  }
  
  .nav-section {
    margin-bottom: 24px;
  }
  
  .main-content {
    padding: 24px;
  }
}

@media (max-width: 768px) {
  .main-content {
    padding: 16px;
  }
  
  .welcome-section {
    flex-direction: column;
    text-align: center;
    gap: 24px;
  }
  
  .welcome-actions {
    justify-content: center;
  }
  
  .page-title {
    font-size: 28px;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  
  .quick-grid {
    grid-template-columns: 1fr;
  }
  
  .nav-content {
    padding: 0 16px;
  }
  
  .sidebar-content {
    padding: 16px;
  }
  
  /* 移动端浮动按钮调整 */
  .floating-actions {
    bottom: 20px;
    right: 20px;
    gap: 12px;
  }
  
  .fab {
    width: 48px;
    height: 48px;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .quick-card {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }
  
  .welcome-actions {
    flex-direction: column;
    width: 100%;
  }
  
  .action-btn {
    width: 100%;
    justify-content: center;
  }
}

/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.module-card {
  animation: fadeIn 0.6s ease-out;
}

.stat-card {
  animation: fadeIn 0.6s ease-out;
}

/* 让动画错开播放 */
.module-card:nth-child(1) { animation-delay: 0.1s; }
.module-card:nth-child(2) { animation-delay: 0.2s; }
.module-card:nth-child(3) { animation-delay: 0.3s; }
.module-card:nth-child(4) { animation-delay: 0.4s; }
.module-card:nth-child(5) { animation-delay: 0.5s; }
.module-card:nth-child(6) { animation-delay: 0.6s; }

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  background: rgba(255, 255, 255, 0.95);
  padding: 20px 30px;
  border-radius: 15px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.header h1 {
  margin: 0;
  color: #333;
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.username {
  font-size: 16px;
  color: #333;
  font-weight: 500;
}

.logout-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.logout-btn:hover {
  background: #c82333;
  transform: translateY(-2px);
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 25px;
  margin-bottom: 40px;
}

.action-card {
  background: rgba(255, 255, 255, 0.95);
  padding: 30px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.4s;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.action-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 1);
}

.card-icon {
  font-size: 48px;
  margin-bottom: 20px;
  text-align: center;
}

.card-title {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin-bottom: 15px;
  text-align: center;
}

.card-description {
  color: #666;
  text-align: center;
  line-height: 1.6;
  font-size: 16px;
}

.status-overview {
  background: rgba(255, 255, 255, 0.95);
  padding: 30px;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.status-overview h2 {
  margin: 0 0 25px 0;
  color: #333;
  font-size: 24px;
  font-weight: 600;
  text-align: center;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border-radius: 15px;
  color: white;
}

.status-icon {
  font-size: 32px;
}

.status-info {
  flex: 1;
}

.status-value {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 5px;
}

.status-label {
  font-size: 14px;
  opacity: 0.9;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .header h1 {
    font-size: 24px;
  }
  
  .action-grid {
    grid-template-columns: 1fr;
  }
  
  .status-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .warehouse-dashboard {
    padding: 10px;
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
}

/* Mobile Layout Styles */
.mobile-layout {
  min-height: 100vh;
  background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
  display: flex;
  flex-direction: column;
  padding-bottom: 70px; /* Space for bottom nav */
}

.mobile-header {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.mobile-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-welcome {
  display: flex;
  flex-direction: column;
}

.greeting {
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
}

.subtitle {
  font-size: 13px;
  color: #86868b;
}

.mobile-logout {
  background: rgba(0, 0, 0, 0.05);
  border: none;
  padding: 8px;
  border-radius: 50%;
  color: #1d1d1f;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mobile-logout:hover {
  background: rgba(0, 0, 0, 0.05);
}

.mobile-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 24px;
  gap: 32px;
  margin-top: 24px;
}

/* Hero Scan Button */
.hero-scan-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-height: 300px;
}

.scan-circle {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: #000;
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 2;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
}

.scan-circle:active {
  transform: scale(0.95);
}

.scan-icon-wrapper {
  margin-bottom: 12px;
}

.scan-line {
  animation: scanMove 2s infinite linear;
}

@keyframes scanMove {
  0% { transform: translateY(-8px); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateY(8px); opacity: 0; }
}

.scan-text {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1px;
}

.scan-ripple {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.05);
  animation: ripple 2s infinite cubic-bezier(0, 0, 0.2, 1);
  z-index: 1;
}

@keyframes ripple {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}

/* Mobile Stats */
.mobile-stats-container {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.mobile-stat-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  padding: 16px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.mobile-stat-card.warning {
  background: rgba(255, 149, 0, 0.1);
  border-color: rgba(255, 149, 0, 0.2);
}

.mobile-stat-card .stat-icon {
  font-size: 24px;
}

.mobile-stat-card .stat-info {
  display: flex;
  flex-direction: column;
}

.mobile-stat-card .stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #1d1d1f;
}

.mobile-stat-card .stat-label {
  font-size: 12px;
  color: #86868b;
}

/* Bottom Navigation */
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 1000;
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-decoration: none;
  color: #999;
  font-size: 10px;
  font-weight: 500;
  width: 64px;
  transition: color 0.2s ease;
}

.nav-tab.active {
  color: #000000;
}

.nav-tab svg {
  stroke: currentColor;
}
</style>