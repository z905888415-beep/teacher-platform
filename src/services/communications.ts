import { db, nowISO, type Communication } from '../db'

export interface CommunicationFormValue {
  studentId: number
  studentName: string
  date: string
  method: string
  summary: string
  needFollowup: boolean
  followupDate?: string
}

/** 保存沟通记录，并在同一事务中创建、更新或清理关联的跟进待办。 */
export async function saveCommunicationRecord(
  value: CommunicationFormValue,
  record?: Communication | null,
): Promise<number> {
  const stamp = nowISO()
  return db.transaction('rw', db.communications, db.todos, async () => {
    let followupTodoId = record?.followupTodoId
    if (value.needFollowup && value.followupDate) {
      const todo = {
        title: `跟进${value.studentName}家长沟通`,
        dueAt: value.followupDate,
        priority: 'normal' as const,
        category: '家校' as const,
        relatedStudentId: value.studentId,
        updatedAt: stamp,
      }
      if (followupTodoId != null && (await db.todos.get(followupTodoId))) {
        await db.todos.update(followupTodoId, { ...todo, doneAt: undefined, archivedAt: undefined })
      } else {
        followupTodoId = await db.todos.add({ ...todo, createdAt: stamp })
      }
    } else if (followupTodoId != null) {
      await db.todos.delete(followupTodoId)
      followupTodoId = undefined
    }

    const values = {
      studentId: value.studentId,
      date: value.date,
      method: value.method,
      summary: value.summary,
      needFollowup: value.needFollowup ? (1 as const) : (0 as const),
      followupDate: value.needFollowup ? value.followupDate : undefined,
      followupTodoId,
      updatedAt: stamp,
    }
    if (record?.id != null) {
      await db.communications.update(record.id, values)
      return record.id
    }
    return db.communications.add({ ...values, createdAt: stamp })
  })
}

/** 删除沟通时同步删除由它生成的待办，避免留下孤立任务。 */
export async function deleteCommunicationRecord(record: Communication): Promise<void> {
  if (record.id == null) return
  await db.transaction('rw', db.communications, db.todos, async () => {
    if (record.followupTodoId != null) await db.todos.delete(record.followupTodoId)
    await db.communications.delete(record.id!)
  })
}
