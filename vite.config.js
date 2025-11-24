import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['lumen.png'],
      manifest: {
        name: 'Lumen Ebook Reader',
        short_name: 'Lumen',
        description: 'A distraction-free ebook reader with stats and lore.',
        theme_color: '#111827',
        background_color: '#000000',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'lumen.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'lumen.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/zenquotes': {
        target: 'https://today.zenquotes.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/zenquotes/, '/api'),
      },
    },
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
})
