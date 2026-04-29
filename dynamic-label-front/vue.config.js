const fs = require('fs')
const path = require('path')
const { defineConfig } = require('@vue/cli-service')

const CERT_DIR = path.resolve(__dirname, 'certs')
const CERT_PATH = path.join(CERT_DIR, 'cert.pem')
const KEY_PATH = path.join(CERT_DIR, 'key.pem')
const HOME_SCREEN_VERSION = 'pilot-system-home-20260423'
const APPLE_TOUCH_ICON = `pilot-system-home-icon.png?v=${HOME_SCREEN_VERSION}`
const MANIFEST_ID = `/?app=${HOME_SCREEN_VERSION}`

const httpsOptions =
  fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)
    ? {
      key: fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CERT_PATH)
    }
    : false

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    host: process.env.DEV_HOST || '0.0.0.0',
    allowedHosts: 'all',
    port: 8080,
    https: httpsOptions || undefined,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store'
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        ws: true,
        logLevel: 'debug'
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    },
    onListening() {
      if (!httpsOptions) {
        console.warn(
          '[devServer] 未检测到 certs/cert.pem 与 certs/key.pem，已回退为 HTTP。'
        )
      }
    }
  },
  pwa: {
    name: 'Pilot System',
    themeColor: '#000000',
    msTileColor: '#000000',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black',
    iconPaths: {
      favicon32: 'favicon-32.png?v=2',
      favicon16: 'favicon-16.png?v=2',
      appleTouchIcon: APPLE_TOUCH_ICON,
      maskIcon: 'icon-192.png',
      msTileImage: 'icon-192.png'
    },
    manifestOptions: {
      id: MANIFEST_ID,
      name: 'Pilot System',
      short_name: 'Pilot System',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'any',
      start_url: MANIFEST_ID,
      scope: '/',
      icons: [
        {
          src: './pilot-system-home-180.png',
          sizes: '180x180',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: './icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: './icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workboxPluginMode: 'GenerateSW',
    workboxOptions: {
      skipWaiting: true,
      clientsClaim: true,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 30 * 24 * 60 * 60 // 30天
            }
          }
        },
        {
          urlPattern: /^https:\/\/.*\/api\/.*/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 5 * 60 // 5分钟
            },
            networkTimeoutSeconds: 3
          }
        }
      ]
    }
  }
})
