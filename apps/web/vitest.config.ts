import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

export default defineConfig({
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@peace-buddy/types': resolve(__dirname, '../../packages/types/src/index.ts'),
      'zod': require.resolve('zod'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
})
