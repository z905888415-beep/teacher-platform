import { db, nowISO, type CourseTemplate } from '../db'

export interface Rollback {
  (): Promise<void>
}

async function getCourse(id: number): Promise<CourseTemplate | undefined> {
  return db.courseTemplates.get(id)
}

/** 新增课程 */
export async function addCourse(data: Omit<CourseTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const stamp = nowISO()
  const id = await db.courseTemplates.add({ ...data, createdAt: stamp, updatedAt: stamp })
  return id
}

/** 编辑课程（课名 / 班级 / 教室 / 单双周 / 备注） */
export async function updateCourse(id: number, patch: Partial<CourseTemplate>): Promise<void> {
  await db.courseTemplates.update(id, { ...patch, updatedAt: nowISO() })
}

export async function deleteCourse(id: number): Promise<void> {
  await db.transaction('rw', db.courseTemplates, db.courseAdjustments, async () => {
    await db.courseAdjustments.where('courseId').equals(id).delete()
    await db.courseTemplates.delete(id)
  })
}

/** 仅本周移动：写入该周调课记录，不修改基础课表 */
export async function moveCourseWeekly(
  courseId: number,
  weekStart: string,
  toDay: number,
  toPeriod: number,
): Promise<Rollback> {
  const course = await getCourse(courseId)
  if (!course) return async () => {}
  const id = await db.courseAdjustments.add({
    courseId,
    weekStart,
    fromDayOfWeek: course.dayOfWeek,
    fromPeriod: course.period,
    toDayOfWeek: toDay,
    toPeriod: toPeriod,
    type: 'move',
    createdAt: nowISO(),
  })
  return () => db.courseAdjustments.delete(id)
}

/** 从本周起长期移动：基础课表与历史记录同一事务写入 */
export async function moveCoursePermanent(courseId: number, toDay: number, toPeriod: number): Promise<Rollback> {
  const course = await getCourse(courseId)
  if (!course) return async () => {}
  const prev = { dayOfWeek: course.dayOfWeek, period: course.period }
  const stamp = nowISO()
  const historyId = await db.transaction('rw', db.courseTemplates, db.courseAdjustments, async () => {
    await db.courseTemplates.update(courseId, { dayOfWeek: toDay, period: toPeriod, updatedAt: stamp })
    return db.courseAdjustments.add({
      courseId,
      weekStart: '*',
      fromDayOfWeek: prev.dayOfWeek,
      fromPeriod: prev.period,
      toDayOfWeek: toDay,
      toPeriod: toPeriod,
      type: 'move',
      note: '长期调整',
      createdAt: stamp,
    })
  })
  return async () => {
    await db.transaction('rw', db.courseTemplates, db.courseAdjustments, async () => {
      await db.courseTemplates.update(courseId, { ...prev, updatedAt: nowISO() })
      await db.courseAdjustments.delete(historyId)
    })
  }
}

/** 仅本周交换两节课（同一条调课记录，事务内写入） */
export async function swapCoursesWeekly(
  courseId: number,
  otherCourseId: number,
  weekStart: string,
): Promise<Rollback> {
  const id = await db.courseAdjustments.add({
    courseId,
    weekStart,
    fromDayOfWeek: 0,
    fromPeriod: 0,
    toDayOfWeek: 0,
    toPeriod: 0,
    type: 'swap',
    swappedCourseId: otherCourseId,
    createdAt: nowISO(),
  })
  return () => db.courseAdjustments.delete(id)
}

/** 长期交换：同时修改两条基础课表 */
export async function swapCoursesPermanent(courseId: number, otherCourseId: number): Promise<Rollback> {
  const a = await getCourse(courseId)
  const b = await getCourse(otherCourseId)
  if (!a || !b) return async () => {}
  const prevA = { dayOfWeek: a.dayOfWeek, period: a.period }
  const prevB = { dayOfWeek: b.dayOfWeek, period: b.period }
  await db.transaction('rw', db.courseTemplates, async () => {
    await db.courseTemplates.update(courseId, { ...prevB, updatedAt: nowISO() })
    await db.courseTemplates.update(otherCourseId, { ...prevA, updatedAt: nowISO() })
  })
  return async () => {
    await db.courseTemplates.update(courseId, { ...prevA, updatedAt: nowISO() })
    await db.courseTemplates.update(otherCourseId, { ...prevB, updatedAt: nowISO() })
  }
}

/** 仅本周覆盖目标课程：目标课该周取消 + 本课移动（同一事务写入，F11） */
export async function overwriteWeekly(
  courseId: number,
  targetCourseId: number,
  weekStart: string,
  toDay: number,
  toPeriod: number,
): Promise<Rollback> {
  const course = await getCourse(courseId)
  const target = await getCourse(targetCourseId)
  if (!course || !target) return async () => {}
  const stamp = nowISO()
  const ids = await db.transaction('rw', db.courseAdjustments, async () => {
    const moveId = await db.courseAdjustments.add({
      courseId,
      weekStart,
      fromDayOfWeek: course.dayOfWeek,
      fromPeriod: course.period,
      toDayOfWeek: toDay,
      toPeriod: toPeriod,
      type: 'move',
      createdAt: stamp,
    })
    const cancelId = await db.courseAdjustments.add({
      courseId: targetCourseId,
      weekStart,
      fromDayOfWeek: target.dayOfWeek,
      fromPeriod: target.period,
      toDayOfWeek: target.dayOfWeek,
      toPeriod: target.period,
      type: 'cancel',
      createdAt: stamp,
    })
    return { moveId, cancelId }
  })
  return async () => {
    await db.courseAdjustments.delete(ids.moveId)
    await db.courseAdjustments.delete(ids.cancelId)
  }
}

/** 长期覆盖目标课程：移动、删除目标、写历史同一事务 */
export async function overwritePermanent(
  courseId: number,
  targetCourseId: number,
  toDay: number,
  toPeriod: number,
): Promise<Rollback> {
  const course = await getCourse(courseId)
  const target = await db.courseTemplates.get(targetCourseId)
  if (!course) return async () => {}
  const prev = { dayOfWeek: course.dayOfWeek, period: course.period }
  const targetSnapshot = target ? { ...target } : null
  const stamp = nowISO()
  const historyId = await db.transaction('rw', db.courseTemplates, db.courseAdjustments, async () => {
    await db.courseTemplates.update(courseId, { dayOfWeek: toDay, period: toPeriod, updatedAt: stamp })
    if (target?.id != null) await db.courseTemplates.delete(target.id)
    return db.courseAdjustments.add({
      courseId,
      weekStart: '*',
      fromDayOfWeek: prev.dayOfWeek,
      fromPeriod: prev.period,
      toDayOfWeek: toDay,
      toPeriod: toPeriod,
      type: 'move',
      note: '长期覆盖',
      createdAt: stamp,
    })
  })
  return async () => {
    await db.transaction('rw', db.courseTemplates, db.courseAdjustments, async () => {
      await db.courseTemplates.update(courseId, { ...prev, updatedAt: nowISO() })
      if (targetSnapshot) await db.courseTemplates.put({ ...targetSnapshot, updatedAt: nowISO() })
      await db.courseAdjustments.delete(historyId)
    })
  }
}
