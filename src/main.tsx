import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ensureSeedData } from './db/seed'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

void ensureSeedData().catch((error) => {
  console.error('初始化示例数据失败', error)
})
