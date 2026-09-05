/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 相对路径同时兼容浏览器部署与 Electron 的 file:// 加载。
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5180 },
  test: {
    environment: 'node',
  },
})
