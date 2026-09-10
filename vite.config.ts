import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const base = mode === 'github-pages' ? '/nutri-agent/' : '/'

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: '衡动个人健康工作台',
          short_name: '衡动',
          description: '个人训练、饮食、营养、体感与趋势记录工具',
          theme_color: '#2f6f5c',
          background_color: '#eef6f2',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            { src: `${base}icon-192.svg`, sizes: '192x192', type: 'image/svg+xml' },
            { src: `${base}icon-512.svg`, sizes: '512x512', type: 'image/svg+xml' }
          ]
        },
        workbox: {
          // 不缓存 index.html（globPatterns 去掉 html），导航请求走「网络优先」，
          // 这样每次发布后打开就是最新版，网络失败时才回退到缓存。
          // navigateFallback 显式设为 false，禁用默认的「缓存优先」导航路由，
          // 否则它会抢在下面的 NetworkFirst 之前命中导航请求。
          navigateFallback: null,
          globPatterns: ['**/*.{js,css,svg}'],
          importScripts: [`${base}push-sw.js`],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 5, maxAgeSeconds: 86400 }
              }
            }
          ]
        }
      })
    ],
    build: {
      rollupOptions: mode === 'single' ? undefined : {
        output: {
          manualChunks: {
            charts: ['recharts']
          }
        }
      }
    }
  }
})
