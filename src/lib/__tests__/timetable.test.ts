import { describe, expect, it } from 'vitest'
import type { CourseAdjustment, CourseTemplate, SchoolClass } from '../../db'
import { computeWeekSchedule, slotKey } from '../timetable'

const classes: SchoolClass[] = [
  { id: 1, name: '初二（3）班', isHomeroom: 1, archived: 0, createdAt: '', updatedAt: '' },
  { id: 2, name: '初二（5）班', isHomeroom: 0, archived: 0, createdAt: '', updatedAt: '' },
]

function template(overrides: Partial<CourseTemplate>): CourseTemplate {
  return {
    id: 1,
    teachingClassId: 1,
    subject: '数学',
    dayOfWeek: 1,
    period: 2,
    weekType: 'all',
    room: '203',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function adjustment(overrides: Partial<CourseAdjustment>): CourseAdjustment {
  return {
    id: 1,
    courseId: 1,
    weekStart: '2026-08-24',
    fromDayOfWeek: 1,
    fromPeriod: 2,
    toDayOfWeek: 1,
    toPeriod: 5,
    type: 'move',
    createdAt: '2026-08-24T08:00:00Z',
    ...overrides,
  }
}

const WEEK = '2026-08-24'

function slotsAt(schedule: ReturnType<typeof computeWeekSchedule>, day: number, period: number) {
  return schedule.slots.get(slotKey(day, period)) ?? []
}

describe('computeWeekSchedule', () => {
  it('全部周课程正常显示，单周课程只在单周出现', () => {
    const templates = [template({ id: 1 }), template({ id: 2, dayOfWeek: 2, period: 3, weekType: 'odd', teachingClassId: 2 })]
    const odd = computeWeekSchedule(templates, [], classes, WEEK, 1, null)
    expect(slotsAt(odd, 2, 3)).toHaveLength(1)
    expect(slotsAt(odd, 2, 3)[0].tags).toContain('单周')

    const even = computeWeekSchedule(templates, [], classes, WEEK, 2, null)
    expect(slotsAt(even, 2, 3)).toHaveLength(0)
  })

  it('仅本周移动：出现在目标格并带「仅本周」，原格有虚线占位，基础课表不变', () => {
    const templates = [template({ id: 1, dayOfWeek: 1, period: 2 })]
    const adjustments = [adjustment({})]
    const week = computeWeekSchedule(templates, adjustments, classes, WEEK, 1, null)
    expect(slotsAt(week, 1, 5)).toHaveLength(1)
    expect(slotsAt(week, 1, 5)[0].tags).toContain('仅本周')
    expect(week.vacant.get(slotKey(1, 2))?.label).toContain('已调至周一第 5 节')

    // 其他周不受影响
    const otherWeek = computeWeekSchedule(templates, adjustments, classes, '2026-08-31', 2, null)
    expect(slotsAt(otherWeek, 1, 2)).toHaveLength(1)
    expect(slotsAt(otherWeek, 1, 5)).toHaveLength(0)
  })

  it('同一课程连续两次临时调课按创建顺序链式生效（F09 回归）', () => {
    const templates = [template({ id: 1, dayOfWeek: 1, period: 2 })]
    const adjustments = [
      adjustment({ id: 1, createdAt: '2026-08-24T08:00:00Z' }), // 1-2 → 1-5
      adjustment({ id: 2, createdAt: '2026-08-25T08:00:00Z', toDayOfWeek: 3, toPeriod: 5 }), // 1-2 → 3-5
    ]
    const week = computeWeekSchedule(templates, adjustments, classes, WEEK, 1, null)
    expect(slotsAt(week, 3, 5)).toHaveLength(1)
    expect(slotsAt(week, 1, 5)).toHaveLength(0)
    // 基础位置的占位显示最终去向
    expect(week.vacant.get(slotKey(1, 2))?.label).toContain('已调至周三第 5 节')
  })

  it('交换两节课：两条课程位置互换且都带「仅本周」', () => {
    const templates = [
      template({ id: 1, dayOfWeek: 1, period: 2 }),
      template({ id: 2, dayOfWeek: 4, period: 5, subject: '班会' }),
    ]
    const adjustments = [adjustment({ type: 'swap', swappedCourseId: 2, toDayOfWeek: 0, toPeriod: 0 })]
    const week = computeWeekSchedule(templates, adjustments, classes, WEEK, 1, null)
    expect(slotsAt(week, 4, 5)[0].templateId).toBe(1)
    expect(slotsAt(week, 1, 2)[0].templateId).toBe(2)
    expect(slotsAt(week, 4, 5)[0].tags).toContain('仅本周')
    expect(slotsAt(week, 1, 2)[0].tags).toContain('仅本周')
  })

  it('本周取消：课程移除并显示占位', () => {
    const templates = [template({ id: 1, dayOfWeek: 1, period: 2 })]
    const adjustments = [adjustment({ type: 'cancel' })]
    const week = computeWeekSchedule(templates, adjustments, classes, WEEK, 1, null)
    expect(slotsAt(week, 1, 2)).toHaveLength(0)
    expect(week.vacant.get(slotKey(1, 2))?.label).toBe('本周取消')
  })

  it('当前节次标记 isCurrent，下一节标记「即将开始」', () => {
    const templates = [
      template({ id: 1, dayOfWeek: 1, period: 2 }),
      template({ id: 2, dayOfWeek: 1, period: 3 }),
    ]
    const week = computeWeekSchedule(templates, [], classes, WEEK, 1, { day: 1, period: 2 }, { day: 1, period: 3 })
    expect(slotsAt(week, 1, 2)[0].isCurrent).toBe(true)
    expect(slotsAt(week, 1, 3)[0].tags).toContain('即将开始')
    expect(slotsAt(week, 1, 2)[0].tags).not.toContain('即将开始')
  })

  it('未分配班级的课程显示「未分配班级」', () => {
    const templates = [template({ id: 1, teachingClassId: 0 })]
    const week = computeWeekSchedule(templates, [], classes, WEEK, 1, null)
    expect(slotsAt(week, 1, 2)[0].className).toBe('未分配班级')
  })
})
