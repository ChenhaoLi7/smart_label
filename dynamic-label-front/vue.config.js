const fs = require('fs')
const path = require('path')
const { defineConfig } = require('@vue/cli-service')

const CERT_DIR = path.resolve(__dirname, 'certs')
const CERT_PATH = path.join(CERT_DIR, 'cert.pem')
const KEY_PATH = path.join(CERT_DIR, 'key.pem')

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
    host: process.env.DEV_HOST || '172.16.0.45',
    port: 8080,
    https: httpsOptions || undefined,
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
    onListening(server) {
      if (!httpsOptions) {
        console.warn(
          '[devServer] 未检测到 certs/cert.pem 与 certs/key.pem，已回退为 HTTP。'
        )
      }
    }
  },
  pwa: {
    name: '智能仓库管理系统',
    themeColor: '#000000',
    msTileColor: '#000000',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black',
    iconPaths: {
      favicon32: 'favicon.ico',
      favicon16: 'favicon.ico',
      appleTouchIcon: 'icon-192.png',
      maskIcon: 'icon-192.png',
      msTileImage: 'icon-192.png'
    },
    manifestOptions: {
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'any',
      start_url: '/',
      scope: '/',
      icons: [
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
