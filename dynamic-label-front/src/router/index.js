import { createRouter, createWebHistory } from 'vue-router'
import { isHandheldClient } from '@/utils/device'
import UserLogin from '../components/UserLogin.vue'
import Register from '../components/Register.vue'
import ForgotPassword from '../components/ForgotPassword.vue'
import WarehouseDashboard from '../components/Dashboard.vue'
import AdvancedScanner from '../components/AdvancedScanner.vue'
import InventoryManagement from '../components/InventoryManagement.vue'
import PrintCenter from '../components/PrintCenter.vue'
import PurchaseManagement from '../components/PurchaseManagement.vue'
import SalesManagement from '../components/SalesManagement.vue'
import ProductionManagement from '../components/ProductionManagement.vue'
import AiAssistant from '../components/AiAssistant.vue'
import SuggestionCenter from '../components/SuggestionCenter.vue'
import UserAccessManagement from '../components/UserAccessManagement.vue'
import ScannerPerformance from '../components/ScannerPerformance.vue'
import RankingDataset from '../components/RankingDataset.vue'
import InventoryAnalytics from '../components/InventoryAnalytics.vue'
import RecoveryBenchmark from '../components/RecoveryBenchmark.vue'
import SkuForecast from '../components/SkuForecast.vue'
import Shop from '../components/Shop.vue'
import ShopTabs from '../components/ShopTabs.vue'

const routes = [
  { path:'/candidate-recommendation', name:'CandidateRecommendation', component:AdvancedScanner },
  { path:'/sku-forecast', name:'SkuForecast', component:SkuForecast },
  { path:'/shop', name:'Shop', component:Shop },
  { path:'/shop-tabs', name:'ShopTabs', component:ShopTabs },
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'UserLogin',
    component: UserLogin
  },
  {
    path: '/register',
    name: 'Register',
    component: Register
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: ForgotPassword
  },
  {
    path: '/dashboard',
    name: 'WarehouseDashboard',
    component: WarehouseDashboard
  },
  {
    path: '/ai-assistant',
    name: 'AiAssistant',
    component: AiAssistant
  },
  {
    path: '/suggestions',
    name: 'SuggestionCenter',
    component: SuggestionCenter
  },
  {
    path: '/user-access',
    name: 'UserAccessManagement',
    component: UserAccessManagement
  },
  {
    path: '/scanner-performance',
    name: 'ScannerPerformance',
    component: ScannerPerformance
  },
  {
    path: '/recovery-benchmark',
    name: 'RecoveryBenchmark',
    component: RecoveryBenchmark
  },
  {
    path: '/ranking-dataset',
    name: 'RankingDataset',
    component: RankingDataset
  },
  {
    path: '/inventory-analytics',
    name: 'InventoryAnalytics',
    component: InventoryAnalytics
  },
  {
    path: '/advanced-scan',
    name: 'AdvancedScanner',
    component: AdvancedScanner
  },
  {
    path: '/label-design',
    redirect: '/dashboard'
  },
  {
    path: '/inventory-management',
    name: 'InventoryManagement',
    component: InventoryManagement
  },
  {
    path: '/print-center',
    name: 'PrintCenter',
    component: PrintCenter
  },
  {
    path: '/purchase-management',
    name: 'PurchaseManagement',
    component: PurchaseManagement
  },
  {
    path: '/sales-management',
    name: 'SalesManagement',
    component: SalesManagement
  },
  {
    path: '/production-management',
    name: 'ProductionManagement',
    component: ProductionManagement
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

const blockedRoutes = ['/label-design', '/purchase-management', '/sales-management', '/production-management']

router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('userRole') || 'operator'
  const publicPages = ['/login', '/register', '/forgot-password']
  if (!publicPages.includes(to.path) && !token) {
    return next(to.path === '/shop' ? { path: '/login', query: { redirect: '/shop' } } : '/login')
  }

  // 顾客（viewer）只能使用商店；后端接口同样按角色拒绝
  if (token && role === 'viewer' && !publicPages.includes(to.path) && to.path !== '/shop') {
    return next('/shop')
  }

  if (['/candidate-recommendation','/sku-forecast','/shop-tabs'].includes(to.path)) {
    try {
      const response = await fetch('/api/auth/profile',{ headers:{ Authorization:`Bearer ${token}` },cache:'no-store' })
      const payload = await response.json()
      const verifiedRole = payload?.data?.user?.role
      if (!response.ok) return next('/login')
      const allowed = to.path === '/sku-forecast' ? ['admin'] : ['admin','operator']
      if (!allowed.includes(verifiedRole)) return next('/dashboard')
      return next()
    } catch (_error) { return next('/login') }
  }
  if (blockedRoutes.includes(to.path)) {
    return next('/dashboard')
  }

  if (to.path === '/advanced-scan' && !isHandheldClient()) {
    return next('/dashboard')
  }

  // 对 operator 限制：允许进入扫码页和仪表盘(Dashboard)
  if (role !== 'admin' && !publicPages.includes(to.path) && to.path !== '/advanced-scan' && to.path !== '/dashboard' && to.path !== '/suggestions' && to.path !== '/shop' && to.path !== '/shop-tabs') {
    return next('/dashboard')
  }

  return next()
})

export default router
