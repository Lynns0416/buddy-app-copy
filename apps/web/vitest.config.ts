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
      '@/i18n/routing': resolve(__dirname, 'src/i18n/routing.ts'),
      '@/lib/api': resolve(__dirname, 'src/lib/api.ts'),
      '@/lib/api-client': resolve(__dirname, 'src/lib/api-client.ts'),
      '@/lib/api-error': resolve(__dirname, 'src/lib/api-error.ts'),
      '@/lib/auth': resolve(__dirname, 'src/lib/auth.tsx'),
      '@/components/ui/badge': resolve(__dirname, 'src/components/ui/badge.tsx'),
      '@/components/app-shell': resolve(__dirname, 'src/components/app-shell.tsx'),
      'zod': require.resolve('zod'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
})
