import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, nowISO } from '../../db'
import { setTodoDone } from '../../services/todos'

describe('setTodoDone 回写沟通跟进', () => {
  beforeEach(async () => {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear()
    })
  })

  it('完成跟进待办后沟通记录 needFollowup 置 0', async () => {
    const stamp = nowISO()
    const todoId = await db.todos.add({
      title: '跟进李雨桐',
      dueAt: '2026-09-03',
      category: '家校',
      priority: 'normal',
      createdAt: stamp,
      updatedAt: stamp,
    })
    const commId = await db.communications.add({
      studentId: 1,
      date: stamp.slice(0, 10),
      method: '电话',
      summary: '作业时间',
      needFollowup: 1,
      followupTodoId: todoId,
      createdAt: stamp,
      updatedAt: stamp,
    })
    await setTodoDone(todoId, true)
    const comm = await db.communications.get(commId)
    const todo = await db.todos.get(todoId)
    expect(todo?.doneAt).toBeTruthy()
    expect(comm?.needFollowup).toBe(0)
  })
})
