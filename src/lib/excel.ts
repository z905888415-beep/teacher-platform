// Excel (.xlsx) 导入导出，基于 SheetJS。
import * as XLSX from 'xlsx'

/** 将对象数组导出为 xlsx 并下载 */
export function exportExcel(filename: string, rows: Record<string, unknown>[], sheetName = '数据'): void {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

/** 从 xlsx / csv 文件读取为对象数组（取第一个工作表） */
export async function importExcel(file: File): Promise<Record<string, string>[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  return XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
}
