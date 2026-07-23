import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  base: './',

  root: 'src',

  resolve: {
    alias: {
      '@lib': new URL('lib', import.meta.url).pathname,
    },
  },

  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },

  server: {
    port: 5174,
    strictPort: true,
  },

  envPrefix: ['VITE_'],
})
