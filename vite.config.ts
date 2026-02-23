import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
