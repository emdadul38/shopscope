import { defineConfig } from 'vite'
import { resolve } from 'path'

/**
 * MV3 service workers are most reliable as a single classic script
 * (no cross-chunk ES imports that can break under suspension).
 */
export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/background/service-worker.ts'),
      name: 'ShopScopeServiceWorker',
      formats: ['iife'],
      fileName: () => 'service-worker.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        extend: true,
      },
    },
  },
})
