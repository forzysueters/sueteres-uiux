import { defineConfig } from 'vite'
// SWC em vez de Babel: @vitejs/plugin-react@4 ainda não declara suporte a
// vite@8, o que fazia `npm install` abortar com ERESOLVE em clone novo.
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
} as any)
