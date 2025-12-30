import { createRouter, createWebHistory } from 'vue-router'
import UserLogin from '../components/UserLogin.vue'
import Register from '../components/Register.vue'
import WarehouseDashboard from '../components/Dashboard.vue'
import AdvancedScanner from '../components/AdvancedScanner.vue'
import LabelDesign from '../components/LabelDesign.vue'
import InventoryManagement from '../components/InventoryManagement.vue'
import PrintCenter from '../components/PrintCenter.vue'
import PurchaseManagement from '../components/PurchaseManagement.vue'
import SalesManagement from '../components/SalesManagement.vue'

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
    path: '/dashboard',
    name: 'WarehouseDashboard',
    component: WarehouseDashboard
  },
  {
    path: '/advanced-scan',
    name: 'AdvancedScanner',
    component: AdvancedScanner
  },
  {
    path: '/label-design',
    name: 'LabelDesign',
    component: LabelDesign
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
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router


