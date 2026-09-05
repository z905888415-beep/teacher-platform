import type { CourseAdjustment, CourseTemplate, SchoolClass } from '../db'
import { weekParity } from './dates'

export interface WeekCourse {
  templateId: number
  subject: string
  classId: number
  className: string
  room?: string
  note?: string
  day: number
  period: number
  weekType: 'all' | 'odd' | 'even'
  tags: string[]
  isCurrent: boolean
}

export interface VacantSlot {
  day: number
  period: number
  label: string
}

export interface WeekSchedule {
  /** key = `${day}-${period}` */
  slots: Map<string, WeekCourse[]>
  /** 本周因临时调课空出的原位置 */
  vacant: Map<string, VacantSlot>
}

export function slotKey(day: number, period: number): string {
  return `${day}-${period}`
}

/**
 * 纯函数：基础课表 + 周次 + 临时调课 → 当前周课表（开发文档 7.4 / 11.2）
 */
export function computeWeekSchedule(
  templates: CourseTemplate[],
  adjustments: CourseAdjustment[],
  classes: SchoolClass[],
  weekStart: string,
  weekNo: number,
  currentSlot: { day: number; period: number } | null,
  nextSlot?: { day: number; period: number } | null,
): WeekSchedule {
  const parity = weekParity(weekNo)
  const classNameById = new Map(classes.map((c) => [c.id ?? 0, c.name]))
  const slots = new Map<string, WeekCourse[]>()

  const buildCourse = (t: CourseTemplate, day: number, period: number, extraTags: string[] = []): WeekCourse => ({
    templateId: t.id ?? 0,
    subject: t.subject,
    classId: t.teachingClassId,
    className: classNameById.get(t.teachingClassId) ?? '未分配班级',
    room: t.room,
    note: t.note,
    day,
    period,
    weekType: t.weekType,
    tags: [
      ...extraTags,
      ...(t.weekType === 'odd' ? ['单周'] : t.weekType === 'even' ? ['双周'] : []),
      ...(nextSlot && nextSlot.day === day && nextSlot.period === period ? ['即将开始'] : []),
    ],
    isCurrent: Boolean(currentSlot && currentSlot.day === day && currentSlot.period === period),
  })

  const removeFromSlots = (course: WeekCourse) => {
    const key = slotKey(course.day, course.period)
    const list = slots.get(key) ?? []
    const index = list.findIndex((c) => c.templateId === course.templateId)
    if (index >= 0) list.splice(index, 1)
    if (list.length === 0) slots.delete(key)
  }

  const place = (course: WeekCourse) => {
    const key = slotKey(course.day, course.period)
    const list = slots.get(key) ?? []
    list.push(course)
    slots.set(key, list)
  }

  const basePosition = new Map<number, { day: number; period: number }>()
  for (const t of templates) {
    if (t.weekType !== 'all' && t.weekType !== parity) continue
    place(buildCourse(t, t.dayOfWeek, t.period))
    if (t.id != null) basePosition.set(t.id, { day: t.dayOfWeek, period: t.period })
  }

  // 调课按创建顺序链式应用：每条从“课程当前所在位置”取课，支持同一课程多次临时调课
  const weekAdjustments = adjustments
    .filter((a) => a.weekStart === weekStart)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const displaced = new Map<number, string | null>()
  for (const adj of weekAdjustments) {
    const found = findInSlots(slots, adj.courseId)
    if (!found) continue
    const course = found.course
    removeFromSlots(course)
    if (adj.type === 'move') {
      course.day = adj.toDayOfWeek
      course.period = adj.toPeriod
      if (!course.tags.includes('仅本周')) course.tags.push('仅本周')
      place(course)
      displaced.set(
        adj.courseId,
        `已调至周${['', '一', '二', '三', '四', '五', '六', '日'][adj.toDayOfWeek]}第 ${adj.toPeriod} 节`,
      )
    } else if (adj.type === 'cancel') {
      displaced.set(adj.courseId, '本周取消')
    } else if (adj.type === 'swap' && adj.swappedCourseId) {
      const otherFound = findInSlots(slots, adj.swappedCourseId)
      if (!otherFound) {
        place(course)
        continue
      }
      const other = otherFound.course
      removeFromSlots(other)
      const day = course.day
      const period = course.period
      course.day = other.day
      course.period = other.period
      other.day = day
      other.period = period
      if (!course.tags.includes('仅本周')) course.tags.push('仅本周')
      if (!other.tags.includes('仅本周')) other.tags.push('仅本周')
      place(course)
      place(other)
      displaced.set(adj.courseId, null)
      displaced.set(adj.swappedCourseId, null)
    }
  }

  // 被调走课程的基础位置显示虚线占位；若该格已有其他课程则不显示
  const vacant = new Map<string, VacantSlot>()
  for (const [templateId, label] of displaced) {
    const base = basePosition.get(templateId)
    if (!base) continue
    const current = findInSlots(slots, templateId)
    if (current && current.course.day === base.day && current.course.period === base.period) continue
    const key = slotKey(base.day, base.period)
    if (slots.has(key)) continue
    vacant.set(key, { day: base.day, period: base.period, label: label ?? '本周取消' })
  }

  return { slots, vacant }
}

function findInSlots(
  slots: Map<string, WeekCourse[]>,
  templateId: number,
): { list: WeekCourse[]; index: number; key: string; course: WeekCourse } | null {
  for (const [key, list] of slots) {
    const index = list.findIndex((c) => c.templateId === templateId)
    if (index >= 0) return { list, index, key, course: list[index] }
  }
  return null
}
