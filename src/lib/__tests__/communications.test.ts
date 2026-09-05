import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db'
import { deleteCommunicationRecord, saveCommunicationRecord } from '../../services/communications'

describe('家校沟通与跟进待办联动', () => {
  beforeEach(async () => {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear()
    })
  })

  it('新增、编辑沟通会创建并更新同一条跟进待办', async () => {
    const communicationId = await saveCommunicationRecord({
      studentId: 7,
      studentName: '验收学生01',
      date: '2026-08-31',
      method: '电话',
      summary: '数学作业沟通',
      needFollowup: true,
      followupDate: '2026-09-02',
    })
    const original = await db.communications.get(communicationId)
    const todoId = original?.followupTodoId
    expect(todoId).toBeTypeOf('number')
    expect((await db.todos.get(todoId!))?.dueAt).toBe('2026-09-02')

    await saveCommunicationRecord(
      {
        studentId: 7,
        studentName: '验收学生01',
        date: '2026-08-31',
        method: '微信',
        summary: '继续跟进',
        needFollowup: true,
        followupDate: '2026-09-05',
      },
      original,
    )
    expect((await db.communications.get(communicationId))?.followupTodoId).toBe(todoId)
    expect((await db.todos.get(todoId!))?.dueAt).toBe('2026-09-05')
  })

  it('取消跟进或删除沟通会清理关联待办', async () => {
    const communicationId = await saveCommunicationRecord({
      studentId: 8,
      studentName: '验收学生02',
      date: '2026-08-31',
      method: '面谈',
      summary: '学习计划',
      needFollowup: true,
      followupDate: '2026-09-03',
    })
    let communication = await db.communications.get(communicationId)
    const firstTodoId = communication?.followupTodoId

    await saveCommunicationRecord(
      {
        studentId: 8,
        studentName: '验收学生02',
        date: '2026-08-31',
        method: '面谈',
        summary: '无需继续跟进',
        needFollowup: false,
      },
      communication,
    )
    expect(await db.todos.get(firstTodoId!)).toBeUndefined()

    await saveCommunicationRecord(
      {
        studentId: 8,
        studentName: '验收学生02',
        date: '2026-08-31',
        method: '面谈',
        summary: '重新跟进',
        needFollowup: true,
        followupDate: '2026-09-06',
      },
      await db.communications.get(communicationId),
    )
    communication = await db.communications.get(communicationId)
    const secondTodoId = communication?.followupTodoId
    await deleteCommunicationRecord(communication!)
    expect(await db.communications.get(communicationId)).toBeUndefined()
    expect(await db.todos.get(secondTodoId!)).toBeUndefined()
  })
})
