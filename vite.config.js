import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/filmarks-watchlist-site/',
  plugins: [react()],
})
