// WebDAV 云同步（适配坚果云等）。用 fetch 走 WebDAV 协议：
// PUT 上传、GET 下载、PROPFIND 列出目录。因浏览器 CORS 限制，实际可用性
// 取决于服务端是否允许跨域；坚果云 WebDAV 支持 CORS，可直接使用。

export interface WebDavConfig {
  url: string // 例：https://dav.jianguoyun.com/dav/teacher-platform/
  username: string
  password: string
  autoBackup: boolean
  intervalDays: number
}

function authHeader(cfg: WebDavConfig): string {
  return 'Basic ' + btoa(`${cfg.username}:${cfg.password}`)
}

function normalizeUrl(cfg: WebDavConfig, filename: string): string {
  const base = cfg.url.endsWith('/') ? cfg.url : cfg.url + '/'
  return base + filename
}

export async function webdavPut(cfg: WebDavConfig, filename: string, content: string | Blob): Promise<void> {
  const resp = await fetch(normalizeUrl(cfg, filename), {
    method: 'PUT',
    headers: { Authorization: authHeader(cfg) },
    body: content,
  })
  if (!resp.ok) throw new Error(`上传失败：${resp.status} ${resp.statusText}`)
}

export async function webdavGet(cfg: WebDavConfig, filename: string): Promise<string> {
  const resp = await fetch(normalizeUrl(cfg, filename), {
    method: 'GET',
    headers: { Authorization: authHeader(cfg) },
  })
  if (!resp.ok) throw new Error(`下载失败：${resp.status} ${resp.statusText}`)
  return resp.text()
}

export async function webdavList(cfg: WebDavConfig): Promise<string[]> {
  const base = cfg.url.endsWith('/') ? cfg.url : cfg.url + '/'
  const resp = await fetch(base, {
    method: 'PROPFIND',
    headers: { Authorization: authHeader(cfg), Depth: '1' },
  })
  if (!resp.ok) throw new Error(`连接失败：${resp.status} ${resp.statusText}`)
  const text = await resp.text()
  const names = [...text.matchAll(/<d:href>([^<]+)<\/d:href>/g)].map((m) => decodeURIComponent(m[1]))
  return names
}

/** 测试连接是否可用 */
export async function webdavTest(cfg: WebDavConfig): Promise<boolean> {
  try {
    await webdavPut(cfg, '.test.txt', new Date().toISOString())
    return true
  } catch {
    return false
  }
}
