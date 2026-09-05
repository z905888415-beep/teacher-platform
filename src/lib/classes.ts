import { db, type SchoolClass } from '../db'

/** 统计班级关联业务数据；任意一项 > 0 则不允许物理删除（开发文档 10.4） */
export async function collectClassRelations(classId: number): Promise<string[]> {
  const blockedBy: string[] = []
  const studentCount = await db.students.where('classId').equals(classId).count()
  if (studentCount > 0) blockedBy.push(`学生 ${studentCount} 人`)

  const courseCount = await db.courseTemplates.where('teachingClassId').equals(classId).count()
  if (courseCount > 0) blockedBy.push(`课程 ${courseCount} 节`)

  const examCount = await db.exams.where('classId').equals(classId).count()
  if (examCount > 0) blockedBy.push(`考试 ${examCount} 场`)

  const homeworkCount = await db.homework.where('classId').equals(classId).count()
  if (homeworkCount > 0) blockedBy.push(`作业 ${homeworkCount} 条`)

  const recordCount = await db.classRecords.where('classId').equals(classId).count()
  if (recordCount > 0) blockedBy.push(`班级记录 ${recordCount} 条`)

  const seatCount = await db.seatVersions.where('classId').equals(classId).count()
  if (seatCount > 0) blockedBy.push(`座位表 ${seatCount} 份`)

  const dutyCount = await db.dutyAssignments.where('classId').equals(classId).count()
  if (dutyCount > 0) blockedBy.push(`值日 ${dutyCount} 条`)

  const studentIds = (await db.students.where('classId').equals(classId).primaryKeys()) as number[]
  if (studentIds.length > 0) {
    const idSet = new Set(studentIds)
    const todoCount = await db.todos.filter((todo) => Boolean(todo.relatedStudentId && idSet.has(todo.relatedStudentId))).count()
    if (todoCount > 0) blockedBy.push(`待办 ${todoCount} 条`)
    const commCount = await db.communications.filter((item) => idSet.has(item.studentId)).count()
    if (commCount > 0) blockedBy.push(`家校沟通 ${commCount} 条`)
    const leaveCount = await db.leaves.filter((item) => idSet.has(item.studentId)).count()
    if (leaveCount > 0) blockedBy.push(`请假 ${leaveCount} 条`)
  }

  return blockedBy
}

export function uniqueClassNameError(name: string, existing: SchoolClass[], excludeId?: number): string | null {
  const trimmed = name.trim()
  if (!trimmed) return '班级名称不能为空'
  const clash = existing.find((item) => item.name === trimmed && item.id !== excludeId)
  if (clash) return '该班级名称已存在'
  return null
}

export function filterRowsByStudentIds<T extends { studentId: number }>(rows: T[], studentIds: Set<number>): T[] {
  return rows.filter((row) => studentIds.has(row.studentId))
}
