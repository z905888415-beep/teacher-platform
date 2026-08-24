import { db } from '../db'
import { download } from './utils'
import { exportExcel, importExcel } from './excel'
import { csvBlob, parseCSV } from './csv'

// 全库导入导出与单表导入导出。

const DATA_TABLES = [
  'courses', 'events', 'todos',
  'resources', 'templates', 'teachingRecords', 'students', 'exams', 'scores', 'examSummaries',
  'communication', 'classSummaries', 'cadres', 'seats', 'duty', 'rewards',
  'leaves', 'concerns', 'classMeetings', 'classFund', 'classLog', 'attendance',
  'dormitory', 'morningEvening', 'safetyHealth', 'parentMeetings', 'homeVisits',
  'familySituation', 'notifications',
  'subjectTeachers', 'teachingProgress', 'homework', 'meetings',
  'goals', 'career', 'psychology', 'talks', 'comprehensive', 'borderline',
  'studentRecords', 'collegeEntrance', 'funding', 'countdowns',
  'aiTools', 'officeTools', 'docTemplates', 'fileTools',
]

export interface ExportPayload {
  app: string
  version: number
  exportedAt: string
  tables: Record<string, unknown[]>
}

/** 导出全库 JSON */
export async function exportAllJson(): Promise<void> {
  const tables: Record<string, unknown[]> = {}
  for (const name of DATA_TABLES) {
    tables[name] = await db.table(name).toArray()
  }
  const payload: ExportPayload = {
    app: 'teacher-platform',
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  }
  download(`教师工作平台备份_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json')
}

/** 从 JSON 恢复全库（默认清空后导入） */
export async function importAllJson(file: File, options: { clear?: boolean } = {}): Promise<number> {
  const text = await file.text()
  const payload = JSON.parse(text) as ExportPayload
  if (!payload.tables) throw new Error('备份文件格式不正确')
  let count = 0
  await db.transaction('rw', db.tables, async () => {
    for (const name of DATA_TABLES) {
      const rows = payload.tables[name]
      if (!rows) continue
      const t = db.table(name)
      if (options.clear) await t.clear()
      await t.bulkPut(rows)
      count += rows.length
    }
  })
  return count
}

/** 单表导出 CSV */
export function exportTableCsv(filename: string, rows: Record<string, unknown>[]): void {
  download(filename, csvBlob(rows), 'text/csv')
}

/** 单表导出 Excel */
export function exportTableExcel(filename: string, rows: Record<string, unknown>[]): void {
  exportExcel(filename, rows)
}

/** 从 CSV 文件读取对象数组 */
export async function readCsvFile(file: File): Promise<Record<string, string>[]> {
  return parseCSV(await file.text())
}

/** 从 Excel/CSV 文件读取对象数组（按扩展名自动判断） */
export async function readSpreadsheet(file: File): Promise<Record<string, string>[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return readCsvFile(file)
  return importExcel(file)
}

/** 数据透视：把 studentId 批量替换为 name 等展示值（导出时用） */
export function resolveNames(
  rows: Record<string, unknown>[],
  key: string,
  labelMap: Map<number, string>,
  newKey: string,
): Record<string, unknown>[] {
  return rows.map((r) => {
    const id = Number(r[key])
    const out = { ...r }
    if (!Number.isNaN(id) && labelMap.has(id)) out[newKey] = labelMap.get(id)!
    delete out[key]
    return out
  })
}
