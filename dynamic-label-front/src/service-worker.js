/* eslint-disable no-restricted-globals */
// Service Worker for PWA
// 这个文件会被 workbox 处理

// 导入 workbox 核心
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// 预缓存应用核心文件
precacheAndRoute(self.__WB_MANIFEST)

// 缓存策略配置

// 1. 缓存静态资源（CSS, JS, 图片）- 缓存优先
registerRoute(
  ({ request }) => request.destination === 'style' || 
                   request.destination === 'script' ||
                   request.destination === 'image',
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30天
      })
    ]
  })
)

// 2. API请求 - 网络优先，失败时使用缓存
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60 // 5分钟
      })
    ],
    networkTimeoutSeconds: 3 // 3秒超时
  })
)

// 3. 字体文件 - 缓存优先
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 365 * 24 * 60 * 60 // 1年
      })
    ]
  })
)

// 4. HTML页面 - 网络优先，支持离线页面
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 24 * 60 * 60 // 24小时
      })
    ]
  })
)

// 安装事件
self.addEventListener('install', (event) => {
  console.log('Service Worker: 安装中...')
  self.skipWaiting() // 立即激活新的 Service Worker
})

// 激活事件
self.addEventListener('activate', (event) => {
  console.log('Service Worker: 激活中...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 删除旧版本的缓存
          if (cacheName !== 'static-resources' && 
              cacheName !== 'api-cache' && 
              cacheName !== 'fonts' && 
              cacheName !== 'pages') {
            console.log('Service Worker: 删除旧缓存', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  return self.clients.claim() // 立即控制所有页面
})

// 消息处理（用于更新通知）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// 后台同步（用于离线操作）
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // 这里可以添加后台同步逻辑
      console.log('后台同步执行')
    )
  }
})

// 推送通知（可选）
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : '新消息',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'notification',
    requireInteraction: false
  }

  event.waitUntil(
    self.registration.showNotification('智能仓库系统', options)
  )
})

// 通知点击处理
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow('/')
  )
})




