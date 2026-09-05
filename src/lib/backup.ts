import { db, BACKUP_TABLES, nowISO, type BackupTableName } from '../db'

export interface BackupFile {
  app: 'teacher-workbench'
  version: number
  exportedAt: string
  tables: Partial<Record<BackupTableName, unknown[]>>
  settings: { key: string; value: string }[]
}

export interface BackupIssue {
  table: string
  row: number
  field: string
  message: string
}

export interface MigrationSummary {
  imported: { name: string; count: number }[]
  ignored: { name: string; count: number; reason: string }[]
  converted: string[]
  issues: BackupIssue[]
}

export class BackupError extends Error {
  issues: BackupIssue[]
  constructor(message: string, issues: BackupIssue[] = []) {
    super(message)
    this.name = 'BackupError'
    this.issues = issues
  }
}

const CURRENT_VERSION = 1

const REQUIRED_FIELDS: Partial<Record<BackupTableName, string[]>> = {
  classes: ['name'],
  students: ['classId', 'name'],
  courseTemplates: ['teachingClassId', 'dayOfWeek', 'period', 'subject'],
  courseAdjustments: ['courseId', 'weekStart', 'type'],
  todos: ['title', 'category', 'priority'],
  calendarEvents: ['title', 'startAt', 'type'],
  attendance: ['studentId', 'date', 'type'],
  leaves: ['studentId', 'startAt', 'endAt', 'type'],
  communications: ['studentId', 'date', 'summary'],
  homework: ['classId', 'date', 'content'],
  exams: ['classId', 'name', 'date', 'fullScore'],
  mathScores: ['examId', 'studentId'],
}

const IGNORED_LEGACY = new Set([
  'gaokao',
  'gaokaoApplications',
  'scholarships',
  'insurance',
  'careers',
  'psychology',
  'subjectCombinations',
  'targets',
  'contribution',
  'criticalStudents',
  '赋分',
])

export async function exportBackup(): Promise<BackupFile> {
  const tables: Partial<Record<BackupTableName, unknown[]>> = {}
  for (const name of BACKUP_TABLES) {
    tables[name] = await db.table(name).toArray()
  }
  const settings = await db.settings.toArray()
  return { app: 'teacher-workbench', version: CURRENT_VERSION, exportedAt: nowISO(), tables, settings }
}

export function downloadBackup(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `工作台备份-${backup.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export function parseBackup(text: string): { backup: BackupFile; summary: MigrationSummary } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('不是合法 JSON 文件', [{ table: '-', row: 0, field: '-', message: 'JSON 解析失败' }])
  }
  if (!raw || typeof raw !== 'object') {
    throw new BackupError('备份内容必须是对象')
  }
  const data = raw as Record<string, unknown>
  const tablesRaw = (data.tables && typeof data.tables === 'object' ? data.tables : data) as Record<string, unknown>
  const summary: MigrationSummary = { imported: [], ignored: [], converted: [], issues: [] }

  const known = new Set<string>(BACKUP_TABLES)
  const incoming: Partial<Record<BackupTableName, unknown[]>> = {}

  for (const [name, value] of Object.entries(tablesRaw)) {
    if (name === 'app' || name === 'version' || name === 'exportedAt' || name === 'settings' || name === 'tables') continue
    if (!Array.isArray(value)) continue
    if (IGNORED_LEGACY.has(name) || name.includes('gaokao') || name.includes('赋分')) {
      summary.ignored.push({ name, count: value.length, reason: '高中/已删除业务，已忽略' })
      continue
    }
    if (name === 'courses' && !tablesRaw.courseTemplates) {
      incoming.courseTemplates = convertLegacyCourses(value, summary)
      summary.converted.push(`旧表 courses → courseTemplates（${incoming.courseTemplates.length} 条）`)
      continue
    }
    if ((name === 'countdowns' || name === 'countdown') && !tablesRaw.calendarEvents) {
      incoming.calendarEvents = convertLegacyCountdowns(value, summary)
      summary.converted.push(`旧倒计时 → calendarEvents（${incoming.calendarEvents.length} 条）`)
      continue
    }
    if (known.has(name)) {
      incoming[name as BackupTableName] = value
    } else {
      summary.ignored.push({ name, count: value.length, reason: '未知表，已忽略' })
    }
  }

  const app = data.app
  if (app && app !== 'teacher-workbench' && app !== 'teacher-platform' && !incoming.courseTemplates && !incoming.classes) {
    throw new BackupError(`无法识别的备份来源：${String(app)}`)
  }

  const version = typeof data.version === 'number' ? data.version : 0
  if (version > CURRENT_VERSION) {
    throw new BackupError(`备份版本 ${version} 高于当前应用（${CURRENT_VERSION}），请升级应用后再导入`)
  }

  for (const name of BACKUP_TABLES) {
    const rows = incoming[name] ?? []
    const required = REQUIRED_FIELDS[name]
    if (!required) continue
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object') {
        summary.issues.push({ table: name, row: index + 1, field: '-', message: '记录不是对象' })
        return
      }
      const record = row as Record<string, unknown>
      for (const field of required) {
        if (record[field] == null || record[field] === '') {
          summary.issues.push({ table: name, row: index + 1, field, message: '缺少必填字段' })
        }
      }
    })
  }

  const blocking = summary.issues.filter((issue) => issue.message === '记录不是对象' || issue.message === '缺少必填字段')
  if (blocking.length > 0 && Object.keys(incoming).length === 0) {
    throw new BackupError(formatIssues(blocking), blocking)
  }

  const settings = Array.isArray(data.settings) ? (data.settings as { key: string; value: string }[]) : []
  const backup: BackupFile = {
    app: 'teacher-workbench',
    version: CURRENT_VERSION,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : nowISO(),
    tables: incoming,
    settings,
  }
  summary.imported = BACKUP_TABLES.map((name) => ({ name, count: backup.tables[name]?.length ?? 0 })).filter(
    (entry) => entry.count > 0,
  )
  return { backup, summary }
}

function convertLegacyCourses(rows: unknown[], summary: MigrationSummary): unknown[] {
  const stamp = nowISO()
  return rows.flatMap((row, index) => {
    if (!row || typeof row !== 'object') {
      summary.issues.push({ table: 'courses', row: index + 1, field: '-', message: '记录不是对象，已跳过' })
      return []
    }
    const record = row as Record<string, unknown>
    const subject = String(record.subject ?? record.name ?? '未命名课程')
    const dayOfWeek = Number(record.dayOfWeek ?? record.weekday ?? 1)
    const period = Number(record.period ?? record.section ?? 1)
    if (!Number.isFinite(dayOfWeek) || !Number.isFinite(period)) {
      summary.issues.push({ table: 'courses', row: index + 1, field: 'dayOfWeek/period', message: '节次无法识别，已跳过' })
      return []
    }
    return [
      {
        teachingClassId: Number(record.teachingClassId ?? record.classId ?? 0) || 0,
        subject,
        dayOfWeek,
        period,
        weekType: record.weekType === 'odd' || record.weekType === 'even' ? record.weekType : 'all',
        room: typeof record.room === 'string' ? record.room : undefined,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ]
  })
}

function convertLegacyCountdowns(rows: unknown[], summary: MigrationSummary): unknown[] {
  const stamp = nowISO()
  return rows.flatMap((row, index) => {
    if (!row || typeof row !== 'object') {
      summary.issues.push({ table: 'countdowns', row: index + 1, field: '-', message: '记录不是对象，已跳过' })
      return []
    }
    const record = row as Record<string, unknown>
    const title = String(record.title ?? record.name ?? '')
    const startAt = String(record.startAt ?? record.date ?? record.targetDate ?? '')
    if (!title || !startAt) {
      summary.issues.push({ table: 'countdowns', row: index + 1, field: 'title/startAt', message: '缺少标题或日期，已跳过' })
      return []
    }
    return [{ title, startAt, type: '其他', createdAt: stamp, updatedAt: stamp }]
  })
}

export function formatIssues(issues: BackupIssue[]): string {
  return issues
    .slice(0, 8)
    .map((issue) => `${issue.table} 第 ${issue.row} 行「${issue.field}」：${issue.message}`)
    .join('；')
}

export function backupSummary(backup: BackupFile): { name: string; count: number }[] {
  return BACKUP_TABLES.map((name) => ({ name, count: backup.tables[name]?.length ?? 0 })).filter(
    (entry) => entry.count > 0,
  )
}

export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const name of BACKUP_TABLES) {
      const rows = backup.tables[name] ?? []
      await db.table(name).clear()
      if (rows.length > 0) await db.table(name).bulkAdd(rows as never[])
    }
    if (backup.settings?.length) {
      await db.settings.clear()
      await db.settings.bulkPut(backup.settings)
    }
  })
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const name of BACKUP_TABLES) {
      await db.table(name).clear()
    }
  })
}
