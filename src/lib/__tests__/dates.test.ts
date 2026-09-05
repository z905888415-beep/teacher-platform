import { describe, expect, it } from 'vitest'
import {
  addDays,
  currentPeriod,
  daysUntil,
  mondayOf,
  parsePeriodTimes,
  periodRange,
  teachingWeek,
  todayISO,
  weekParityLabel,
  DEFAULT_PERIOD_TIMES,
} from '../dates'

describe('dates', () => {
  it('mondayOf 把周日归到所在周的周一', () => {
    expect(mondayOf('2026-08-30')).toBe('2026-08-24')
    expect(mondayOf('2026-08-31')).toBe('2026-08-31')
    expect(mondayOf('2026-09-05')).toBe('2026-08-31')
  })

  it('addDays 跨月正确', () => {
    expect(addDays('2026-08-30', 2)).toBe('2026-09-01')
    expect(addDays('2026-09-01', -2)).toBe('2026-08-30')
  })

  it('teachingWeek 从学期开始周起算，开学前按第 1 周', () => {
    expect(teachingWeek('2026-08-24', '2026-08-31')).toBe(1)
    expect(teachingWeek('2026-08-31', '2026-08-31')).toBe(1)
    expect(teachingWeek('2026-09-07', '2026-08-31')).toBe(2)
    expect(teachingWeek('2026-09-14', '2026-08-31')).toBe(3)
  })

  it('weekParityLabel 单双周', () => {
    expect(weekParityLabel(1)).toBe('单周')
    expect(weekParityLabel(2)).toBe('双周')
    expect(weekParityLabel(7)).toBe('单周')
  })

  it('currentPeriod 命中节次区间，周末返回 null', () => {
    const times = DEFAULT_PERIOD_TIMES
    expect(currentPeriod(times, new Date(2026, 7, 31, 8, 30))).toBe(1)
    expect(currentPeriod(times, new Date(2026, 7, 31, 8, 50))).toBeNull()
    expect(currentPeriod(times, new Date(2026, 7, 31, 9, 10))).toBe(2)
    expect(currentPeriod(times, new Date(2026, 7, 31, 15, 0))).toBe(6)
    // 周日 2026-08-30
    expect(currentPeriod(times, new Date(2026, 7, 30, 8, 30))).toBeNull()
  })

  it('periodRange 解析起止时间', () => {
    expect(periodRange(DEFAULT_PERIOD_TIMES, 1)).toEqual({ start: '08:00', end: '08:45' })
    expect(periodRange(DEFAULT_PERIOD_TIMES, 9)).toBeNull()
  })

  it('parsePeriodTimes 非法 JSON 回退默认，不抛错', () => {
    expect(parsePeriodTimes('{', 6)).toEqual(DEFAULT_PERIOD_TIMES.slice(0, 6))
    expect(parsePeriodTimes('[]', 6)).toEqual(DEFAULT_PERIOD_TIMES.slice(0, 6))
    expect(parsePeriodTimes('["08:00-08:45"]', 6)).toEqual(['08:00-08:45'])
  })

  it('daysUntil 今天为 0，未来为正', () => {
    expect(daysUntil(todayISO())).toBe(0)
    expect(daysUntil(addDays(todayISO(), 3))).toBe(3)
  })
})
