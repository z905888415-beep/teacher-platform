// WebDAV 云同步（适配坚果云）。
// 桌面版（Tauri）通过 Rust 原生请求（reqwest）访问，绕过浏览器 CORS 限制；
// 网页版 / 手机浏览器因坚果云不支持 CORS，无法直连，抛明确提示改用 JSON 迁移。

export interface WebDavConfig {
  url: string // 例：https://dav.jianguoyun.com/dav/
  username: string
  password: string
  autoBackup: boolean
  intervalDays: number
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const BROWSER_ERROR =
  '网页版无法直连坚果云（坚果云不支持浏览器跨域 CORS）。请改用桌面版同步，或在网页版用「导出/导入 JSON」迁移数据。'

async function native<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

function nativeCfg(cfg: WebDavConfig) {
  return { url: cfg.url, username: cfg.username, password: cfg.password }
}

export async function webdavPut(cfg: WebDavConfig, filename: string, content: string): Promise<void> {
  if (isTauri) return native('webdav_put', { cfg: nativeCfg(cfg), filename, content })
  throw new Error(BROWSER_ERROR)
}

export async function webdavGet(cfg: WebDavConfig, filename: string): Promise<string> {
  if (isTauri) return native<string>('webdav_get', { cfg: nativeCfg(cfg), filename })
  throw new Error(BROWSER_ERROR)
}

export async function webdavTest(cfg: WebDavConfig): Promise<boolean> {
  if (isTauri) return native<boolean>('webdav_test', { cfg: nativeCfg(cfg) })
  throw new Error(BROWSER_ERROR)
}
