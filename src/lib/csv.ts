// 轻量 CSV 解析与序列化。导出时带 UTF-8 BOM，保证 Windows Excel 中文不乱码。

/** 将二维数组 / 对象数组序列化为 CSV 字符串 */
export function toCSV(rows: (string | number | null | undefined)[][] | Record<string, unknown>[]): string {
  const data: string[][] = []
  if (!rows.length) return ''
  if (Array.isArray(rows[0])) {
    data.push(...(rows as (string | number | null | undefined)[][]).map((r) => r.map((c) => cell(c))))
  } else {
    const objects = rows as Record<string, unknown>[]
    const headers = Object.keys(objects[0])
    data.push(headers.map((h) => cell(h)))
    objects.forEach((o) => data.push(headers.map((h) => cell(o[h]))))
  }
  return data.map((r) => r.join(',')).join('\r\n')
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** 解析 CSV 字符串为对象数组（首行为表头） */
export function parseCSV(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, '')
  const rows = clean.split(/\r\n|\n|\r/).filter((r) => r.trim() !== '')
  if (!rows.length) return []
  const headers = parseLine(rows[0])
  const result: Record<string, string>[] = []
  for (let i = 1; i < rows.length; i++) {
    const cells = parseLine(rows[i])
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? ''
    })
    if (Object.values(obj).some((v) => v !== '')) result.push(obj)
  }
  return result
}

function parseLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

/** 带 BOM 的 CSV 内容，用于直接下载 */
export function csvBlob(rows: (string | number | null | undefined)[][] | Record<string, unknown>[]): Blob {
  return new Blob(['﻿' + toCSV(rows)], { type: 'text/csv;charset=utf-8' })
}
