import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'MLPHoma by NATA LABA',
        short_name: 'MLPHoma',
        description: 'Enterprise Construction Project Management by NATA LABA',
        theme_color: '#f97316',
        background_color: '#fff7ed',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        // Take control immediately when a new SW is installed — fixes stale chunk crashes after re-deploy
        skipWaiting: true,
        clientsClaim: true,
        // Bust old cached shells by appending cache version
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Current Supabase project URL
            urlPattern: /^https:\/\/gtpcjjjzjjzpgpxwjzqf\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache-v2',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes only — always prefer fresh data
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    }),
    // visualizer plugin disabled for dev — enable manually for bundle analysis:
    // import { visualizer } from 'rollup-plugin-visualizer'
    // visualizer({ open: false, gzipSize: true, brotliSize: true, filename: 'dist/bundle-stats.html' })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'sonner', 'clsx', 'tailwind-merge'],
          'date-vendor': ['date-fns'],
          'state-vendor': ['zustand'],
          'auth-vendor': ['@supabase/supabase-js'],
          'chart-vendor': ['recharts'],
          'table-vendor': ['@tanstack/react-table', '@tanstack/react-virtual'],
          'radix-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-accordion',
          ],
        }
      }
    }
  },
})
