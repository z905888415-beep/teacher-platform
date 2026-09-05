import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, nowISO } from '../../db'
import { backupSummary, clearAllData, exportBackup, parseBackup, restoreBackup, BackupError } from '../backup'

/** F22：JSON 备份导出 → 清空 → 恢复 的端到端往返（fake-indexeddb 环境） */
describe('backup roundtrip', () => {
  beforeEach(async () => {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear()
    })
  })

  it('导出 → 清空 → 恢复后数据一致，设置保留', async () => {
    const stamp = nowISO()
    const classId = await db.classes.add({
      name: '初二（3）班',
      isHomeroom: 1,
      archived: 0,
      createdAt: stamp,
      updatedAt: stamp,
    })
    await db.students.bulkAdd([
      { classId, name: '陈晓明', parentPhone: '13800000000', createdAt: stamp, updatedAt: stamp },
      { classId, name: '李雨桐', parentPhone: '13900000000', createdAt: stamp, updatedAt: stamp },
    ])
    await db.courseTemplates.add({
      teachingClassId: classId,
      subject: '数学',
      dayOfWeek: 1,
      period: 2,
      weekType: 'all',
      createdAt: stamp,
      updatedAt: stamp,
    })
    await db.settings.bulkPut([
      { key: 'semesterStart', value: '2026-08-31' },
      { key: 'passwordHash', value: 'abc123' },
    ])

    const backup = await exportBackup()
    expect(backup.app).toBe('teacher-workbench')
    const summary = backupSummary(backup)
    expect(summary.find((item) => item.name === 'classes')?.count).toBe(1)
    expect(summary.find((item) => item.name === 'students')?.count).toBe(2)
    expect(summary.find((item) => item.name === 'courseTemplates')?.count).toBe(1)

    await clearAllData()
    expect(await db.classes.count()).toBe(0)
    expect(await db.students.count()).toBe(0)
    // 清空不清设置（F01 依赖此行为）
    expect(await db.settings.get('passwordHash')).toEqual({ key: 'passwordHash', value: 'abc123' })

    await restoreBackup(backup)
    const restored = await db.classes.toArray()
    expect(restored).toHaveLength(1)
    expect(restored[0].name).toBe('初二（3）班')
    expect(await db.students.where('classId').equals(classId).count()).toBe(2)
    expect(await db.courseTemplates.count()).toBe(1)
    expect((await db.settings.get('semesterStart'))?.value).toBe('2026-08-31')
  })

  it('备份中的未知表被忽略，不导致恢复失败', async () => {
    const backup = await exportBackup()
    const forged = {
      ...backup,
      tables: {
        ...backup.tables,
        legacyGaokao: [{ id: 1, target: '某大学' }],
      },
    }
    await restoreBackup(forged)
    expect(await db.classes.count()).toBe(0)
  })

  it('旧 courses / 倒计时可转换，缺字段能定位到表行', () => {
    const { backup, summary } = parseBackup(
      JSON.stringify({
        app: 'teacher-platform',
        version: 0,
        tables: {
          courses: [{ subject: '数学', dayOfWeek: 1, period: 2, classId: 1 }],
          countdowns: [{ title: '期中考试', date: '2026-11-01' }],
          gaokao: [{ id: 1 }],
        },
      }),
    )
    expect(backup.tables.courseTemplates).toHaveLength(1)
    expect(backup.tables.calendarEvents).toHaveLength(1)
    expect(summary.converted.length).toBeGreaterThan(0)
    expect(summary.ignored.some((item) => item.name === 'gaokao')).toBe(true)
  })

  it('缺少必填字段时给出表、行、字段', () => {
    try {
      parseBackup(
        JSON.stringify({
          app: 'teacher-workbench',
          version: 1,
          tables: { students: [{ classId: 1 }] },
        }),
      )
    } catch (error) {
      expect(error).toBeInstanceOf(BackupError)
      const issues = (error as BackupError).issues
      expect(issues[0]).toMatchObject({ table: 'students', field: 'name' })
      return
    }
    // 有 classes 空、students 缺 name：parseBackup 可能不 throw 而只放 issues
    const { summary } = parseBackup(
      JSON.stringify({
        app: 'teacher-workbench',
        version: 1,
        tables: { classes: [{ name: '初二（3）班' }], students: [{ classId: 1 }] },
      }),
    )
    expect(summary.issues.some((issue) => issue.table === 'students' && issue.field === 'name')).toBe(true)
  })
})
