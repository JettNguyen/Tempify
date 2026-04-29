import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/Tempify/' : '/',
  server: {
    proxy: {
      // Proxies /itunes/* → https://itunes.apple.com/* in dev to avoid CORS
      '/itunes': {
        target: 'https://itunes.apple.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/itunes/, ''),
      },
    },
  },
}))
