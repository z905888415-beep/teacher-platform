// 极简 className 合并（避免额外引入 clsx 依赖）
export function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter(Boolean).join(' ')
}

export function uid(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** 格式化日期 YYYY-MM-DD */
export function fmtDate(d?: string | Date): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr(): string {
  return fmtDate(new Date())
}

/** 获取某天是星期几（1-7，1=周一） */
export function dayOfWeek(d: string | Date = new Date()): number {
  const date = typeof d === 'string' ? new Date(`${d}T00:00:00`) : d
  const day = date.getDay()
  return day === 0 ? 7 : day
}

/** 本周周一日期 */
export function mondayOf(date: Date = new Date()): Date {
  const d = new Date(date)
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (dow - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

/** 判断是否是双周（用于单双周课表），weekOffset 用于切换当前周 */
export function isEvenWeek(weekOffset = 0): boolean {
  const monday = mondayOf()
  // 以 2020-01-06（周一）为第 1 周基准
  const base = new Date('2020-01-06T00:00:00')
  const diff = Math.round((monday.getTime() - base.getTime()) / (7 * 86400000))
  const weekNo = Math.abs(diff) + 1
  return weekNo % 2 === 0
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function round(n: number, digits = 1): number {
  const p = Math.pow(10, digits)
  return Math.round(n * p) / p
}

/** 数字千分位 */
export function formatNum(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString('zh-CN') : '-'
}

export function percent(n: number, digits = 1): string {
  return Number.isFinite(n) ? `${round(n, digits)}%` : '-'
}

/** 触发浏览器下载 */
export function download(filename: string, content: string | Blob, mime = 'application/octet-stream'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 计算两个日期相差天数（b - a） */
export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime()
  const db = new Date(`${b}T00:00:00`).getTime()
  return Math.round((db - da) / 86400000)
}

/** 倒计时文案 */
export function countdownText(target: string): { days: number; text: string } {
  const days = daysBetween(todayStr(), target)
  if (days === 0) return { days, text: '就是今天' }
  if (days < 0) return { days, text: `已过 ${Math.abs(days)} 天` }
  return { days, text: `还有 ${days} 天` }
}

/** 解析日期字段为可排序的 key */
export function dateKey(v?: string): string {
  return v || ''
}

/** 转义 HTML（用于模板复制等场景的安全输出） */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}
