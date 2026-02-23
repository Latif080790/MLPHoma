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
        name: 'MLPHoma Project Manager',
        short_name: 'MLPHoma',
        description: 'Enterprise Construction Project Management',
        theme_color: '#ffffff',
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/obmquofivolvxxkxtlbb\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
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
          'chart-vendor': ['recharts'],
          'date-vendor': ['date-fns'],
          'state-vendor': ['zustand'],
          'auth-vendor': ['@supabase/supabase-js'],
          'doc-vendor': ['jspdf', 'jspdf-autotable', 'xlsx'],
          // Feature-based chunks
          'ahsp-modules': [
            './src/components/ahsp/AHSPCatalog.tsx',
            './src/components/ahsp/AHSPItemEditor.tsx',
            './src/components/ahsp/ResourceManager.tsx'
          ],
          'analytics-modules': [
            './src/pages/modules/v3/CommandCenter.tsx',
            './src/pages/modules/v3/ProjectOverview.tsx',
            './src/pages/modules/v3/PortfolioResources.tsx',
            './src/pages/modules/v3/StrategySimulation.tsx',
            './src/pages/modules/v3/CostForecastDashboard.tsx'
          ],
        }
      }
    }
  },
})
