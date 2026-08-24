import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// PWA 注册（自动更新）。
// 注意：Tauri 桌面应用走 tauri:// 自定义协议，Service Worker 无法注册，此处跳过。
const isTauri = window.location.protocol === 'tauri:' || window.location.hostname.endsWith('tauri.localhost')
if (!isTauri && window.location.protocol !== 'file:') {
  registerSW({ immediate: true })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
