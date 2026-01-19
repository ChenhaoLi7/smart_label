<template>
  <div id="app">
    <router-view/>
    <PWAInstallPrompt />
  </div>
</template>

<script>
import PWAInstallPrompt from './components/PWAInstallPrompt.vue'

export default {
  name: "App",
  components: {
    PWAInstallPrompt
  },
  mounted() {
    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then((registration) => {
            console.log('Service Worker 注册成功:', registration.scope)
            
            // 检查更新
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // 有新版本可用
                  if (confirm('发现新版本，是否立即更新？')) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' })
                    window.location.reload()
                  }
                }
              })
            })
          })
          .catch((error) => {
            console.log('Service Worker 注册失败:', error)
          })
      })
    }
  }
};
</script>

<style>
/* 全局样式 */
:root {
  /* Apple Glass Theme Variables - Default (Dark) */
  --bg-primary: #000000;
  --bg-secondary: #0a0a0a;
  --bg-content: #121212;
  --text-primary: #F5F5F7;
  --text-secondary: #86868B;
  --text-tertiary: #6E6E73;
  --glass-bg: rgba(28, 28, 30, 0.7);
  --glass-border: rgba(255, 255, 255, 0.12);
  --input-bg: rgba(255, 255, 255, 0.08);
  --input-focus-bg: rgba(255, 255, 255, 0.12);
  --button-bg: #FFFFFF;
  --button-text: #000000;
  --button-hover-bg: #E5E5E5;
  --accent-blue: #0A84FF;
  --card-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  --light-1: rgba(41, 151, 255, 0.2);
  --light-2: rgba(255, 45, 85, 0.15);
  --light-3: rgba(175, 82, 222, 0.2);
}

[data-theme="light"] {
  /* Light Mode Variables - Elegant White */
  --bg-primary: #F5F5F7;
  --bg-secondary: #FFFFFF;
  --bg-content: #F2F2F7;
  --text-primary: #1D1D1F;
  --text-secondary: #86868b;
  --text-tertiary: #6e6e73;
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-border: rgba(0, 0, 0, 0.08);
  --input-bg: rgba(0, 0, 0, 0.05);
  --input-focus-bg: rgba(0, 0, 0, 0.08);
  --button-bg: #1D1D1F;
  --button-text: #FFFFFF;
  --button-hover-bg: #333333;
  --accent-blue: #0071E3;
  --card-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
  --light-1: rgba(0, 0, 0, 0.02);
  --light-2: rgba(0, 0, 0, 0.01);
  --light-3: rgba(0, 0, 0, 0.01);
}

body {
  margin: 0;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

</style>
<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
