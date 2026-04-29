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

const routes = [
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

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('userRole') || 'operator'
  const publicPages = ['/login', '/register', '/forgot-password']
  if (!publicPages.includes(to.path) && !token) {
    return next('/login')
  }

  if (blockedRoutes.includes(to.path)) {
    return next('/dashboard')
  }

  if (to.path === '/advanced-scan' && !isHandheldClient()) {
    return next('/dashboard')
  }

  // 对 operator 限制：允许进入扫码页和仪表盘(Dashboard)
  if (role !== 'admin' && !publicPages.includes(to.path) && to.path !== '/advanced-scan' && to.path !== '/dashboard' && to.path !== '/suggestions') {
    return next('/dashboard')
  }

  return next()
})

export default router
