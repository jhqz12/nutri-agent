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
          navigateFallback: `${base}index.html`,
          globPatterns: ['**/*.{js,css,html,svg}'],
          importScripts: [`${base}push-sw.js`],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true
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
