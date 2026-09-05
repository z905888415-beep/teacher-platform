import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, nowISO } from '../../db'
import { collectClassRelations, uniqueClassNameError } from '../classes'

describe('uniqueClassNameError', () => {
  it('空名和重名报错，排除自身 id', () => {
    const existing = [
      { id: 1, name: '初二（3）班', isHomeroom: 1 as const, archived: 0 as const, createdAt: '', updatedAt: '' },
    ]
    expect(uniqueClassNameError('  ', existing)).toBe('班级名称不能为空')
    expect(uniqueClassNameError('初二（3）班', existing)).toBe('该班级名称已存在')
    expect(uniqueClassNameError('初二（3）班', existing, 1)).toBeNull()
    expect(uniqueClassNameError('初二（5）班', existing)).toBeNull()
  })
})

describe('collectClassRelations', () => {
  beforeEach(async () => {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear()
    })
  })

  it('有课程时计入关联，不允许当作空班删除', async () => {
    const stamp = nowISO()
    const classId = await db.classes.add({
      name: '初二（5）班',
      isHomeroom: 0,
      archived: 0,
      createdAt: stamp,
      updatedAt: stamp,
    })
    await db.courseTemplates.add({
      teachingClassId: classId,
      subject: '数学',
      dayOfWeek: 1,
      period: 2,
      weekType: 'all',
      createdAt: stamp,
      updatedAt: stamp,
    })
    const relations = await collectClassRelations(classId)
    expect(relations.some((item) => item.includes('课程'))).toBe(true)
  })
})
