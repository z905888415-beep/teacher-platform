import { db, nowISO } from '../db'

/** 完成/恢复待办；完成时回写关联的家校跟进沟通（F16） */
export async function setTodoDone(id: number, done: boolean): Promise<void> {
  const stamp = nowISO()
  if (!done) {
    await db.todos.update(id, { doneAt: undefined, updatedAt: stamp })
    return
  }
  await db.todos.update(id, { doneAt: stamp, updatedAt: stamp })
  const linked = await db.communications
    .filter((item) => item.followupTodoId === id && item.needFollowup === 1)
    .toArray()
  for (const item of linked) {
    if (item.id != null) {
      await db.communications.update(item.id, { needFollowup: 0, updatedAt: stamp })
    }
  }
}
