import axios from 'axios'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'  
// axios.defaults.baseURL = 'http://localhost:3000/api' // 注释掉，使用Vue代理
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 关闭并清理 Service Worker 缓存，避免旧前端包导致权限 UI 失真
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister())
  })
  if (window.caches && typeof window.caches.keys === 'function') {
    window.caches.keys().then((keys) => {
      keys.forEach((key) => window.caches.delete(key))
    })
  }
}

createApp(App)
  .use(router)    
  .mount('#app')