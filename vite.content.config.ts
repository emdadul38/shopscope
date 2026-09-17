import { defineConfig } from 'vite'
import { resolve } from 'path'

/**
 * Content scripts injected via chrome.scripting.executeScript({ files })
 * must be classic scripts with no ES module imports.
 */
export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/content/content-script.ts'),
      name: 'ShopScopeContentScript',
      formats: ['iife'],
      fileName: () => 'content-script.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        extend: true,
      },
    },
  },
})
