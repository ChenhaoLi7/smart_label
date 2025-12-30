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
  /* Apple Glass Dark Mode Variables (Default) */
  --bg-primary: #000000;
  --text-primary: #F5F5F7;
  --text-secondary: #86868B;
  --text-tertiary: #6E6E73;
  --glass-bg: rgba(30, 30, 30, 0.72);
  --glass-border: rgba(255, 255, 255, 0.1);
  --input-bg: rgba(255, 255, 255, 0.1);
  --input-focus-bg: rgba(255, 255, 255, 0.15);
  --button-bg: #FFFFFF;
  --button-text: #000000;
  --button-hover-bg: #E5E5E5;
  --accent-blue: #0A84FF;
  --light-1: rgba(41, 151, 255, 0.15); /* Blue ambient */
  --light-2: rgba(255, 45, 85, 0.15);  /* Pink ambient */
  --light-3: rgba(175, 82, 222, 0.15); /* Purple ambient */
}

[data-theme="light"] {
  /* Light Mode Variables - Neutral Glass */
  --bg-primary: #F5F5F7;
  --text-primary: #1D1D1F;
  --text-secondary: #86868B;
  --text-tertiary: #6E6E73;
  --glass-bg: rgba(255, 255, 255, 0.6);
  --glass-border: rgba(0, 0, 0, 0.05);
  --input-bg: rgba(0, 0, 0, 0.05);
  --input-focus-bg: rgba(0, 0, 0, 0.08);
  --button-bg: #1D1D1F; /* Black Button */
  --button-text: #FFFFFF;
  --button-hover-bg: #333333;
  --accent-blue: #0071E3; /* Keep blue only for small accents */
  --light-1: rgba(0, 0, 0, 0.03);
  --light-2: rgba(0, 0, 0, 0.02);
  --light-3: rgba(0, 0, 0, 0.02);
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
