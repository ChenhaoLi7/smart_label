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
createApp(App)
  .use(router)    
  .mount('#app')