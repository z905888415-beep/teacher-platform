/** 日期与周次工具：所有函数基于本地时区，日期使用 ISO 字符串 yyyy-mm-dd */

export const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const
export const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日'] as const

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

/** 该日期所在周的周一 */
export function mondayOf(iso: string): string {
  const date = parseISODate(iso)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return toISODate(date)
}

/** 教学周序号：从学期开始周起算，最小为 1 */
export function teachingWeek(weekStart: string, semesterStart: string): number {
  const from = parseISODate(mondayOf(semesterStart)).getTime()
  const current = parseISODate(weekStart).getTime()
  return Math.max(1, Math.floor((current - from) / (7 * 24 * 3600 * 1000)) + 1)
}

/** 单周 / 双周：按教学周奇偶 */
export function weekParity(weekNo: number): 'odd' | 'even' {
  return weekNo % 2 === 1 ? 'odd' : 'even'
}

export function weekParityLabel(weekNo: number): string {
  return weekNo % 2 === 1 ? '单周' : '双周'
}

export function formatDateCN(iso: string): string {
  const date = parseISODate(iso)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

export function weekdayName(iso: string): string {
  return WEEKDAY_NAMES[parseISODate(iso).getDay()]
}

/** 距离目标日期还剩几天（按自然日） */
export function daysUntil(iso: string): number {
  const target = parseISODate(iso).getTime()
  const today = parseISODate(todayISO()).getTime()
  return Math.round((target - today) / (24 * 3600 * 1000))
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** 默认节次时间（可被设置覆盖） */
export const DEFAULT_PERIOD_TIMES: string[] = [
  '08:00-08:45',
  '08:55-09:40',
  '10:00-10:45',
  '10:55-11:40',
  '14:00-14:45',
  '14:55-15:40',
  '15:50-16:35',
  '16:45-17:30',
]

/** 解析节次时间设置：非法 JSON / 非字符串数组时回退默认，避免首页白屏 */
export function parsePeriodTimes(raw: string, periodCount: number): string[] {
  const fallback = DEFAULT_PERIOD_TIMES.slice(0, Math.max(1, periodCount))
  if (!raw.trim()) return fallback
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback
    if (parsed.some((item) => typeof item !== 'string' || !item.includes('-'))) return fallback
    return parsed as string[]
  } catch {
    return fallback
  }
}

export function periodRange(times: string[], period: number): { start: string; end: string } | null {
  const raw = times[period - 1]
  if (!raw || !raw.includes('-')) return null
  const [start, end] = raw.split('-')
  return { start, end }
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export { minutesOf }

/** 当前时间落在哪个节次内（仅周一至周五） */
export function currentPeriod(times: string[], now: Date): number | null {
  const day = now.getDay()
  if (day === 0 || day === 6) return null
  const minutes = now.getHours() * 60 + now.getMinutes()
  for (let i = 0; i < times.length; i += 1) {
    const range = periodRange(times, i + 1)
    if (!range) continue
    if (minutes >= minutesOf(range.start) && minutes <= minutesOf(range.end)) return i + 1
  }
  return null
}
