import { describe, expect, it } from 'vitest'
import {
  autoArrangeStudents,
  clipSeatMap,
  nextDutyGroupName,
  placeStudent,
  seatKey,
  sortStudentsForSeating,
} from '../seating'

function students(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `学生${index + 1}`,
    studentNo: String(index + 1).padStart(2, '0'),
  }))
}

describe('seating helpers', () => {
  it('40 人自动排为 8x5，且没有遗漏或重复', () => {
    const result = autoArrangeStudents(students(40), 3, 5)
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.rows).toBe(8)
    expect(result.cols).toBe(5)
    expect(result.seats.size).toBe(40)
    expect(new Set(result.seats.values()).size).toBe(40)
    expect([...result.seats.values()].sort((a, b) => a - b)).toEqual(students(40).map((item) => item.id))
  })

  it('学号按自然数字顺序排序，前导零不让 10 排在 2 前面', () => {
    const result = sortStudentsForSeating([
      { id: 1, name: '十号', studentNo: '10' },
      { id: 2, name: '二号', studentNo: '2' },
      { id: 3, name: '一号', studentNo: '001' },
      { id: 4, name: '三号', studentNo: '02' },
    ])
    expect(result.map((item) => item.id)).toEqual([3, 2, 4, 1])
  })

  it('安排到占用座位时原学生退回未入座', () => {
    const result = placeStudent(
      new Map([
        [seatKey(0, 0), 1],
        [seatKey(0, 1), 2],
      ]),
      3,
      seatKey(0, 1),
    )
    expect(result.get(seatKey(0, 0))).toBe(1)
    expect(result.get(seatKey(0, 1))).toBe(3)
    expect([...result.values()]).not.toContain(2)
  })

  it('裁剪越界座位并返回被退回的学生', () => {
    const result = clipSeatMap(
      new Map([
        [seatKey(0, 0), 1],
        [seatKey(2, 0), 2],
        [seatKey(1, 1), 3],
      ]),
      2,
      2,
      [1, 2, 3],
    )
    expect([...result.seats.entries()]).toEqual([
      [seatKey(0, 0), 1],
      [seatKey(1, 1), 3],
    ])
    expect(result.overflowStudentIds).toEqual([2])
  })

  it('生成未占用的最小正整数值日组号', () => {
    expect(nextDutyGroupName([{ groupName: '第 1 组' }, { groupName: '第 3 组' }])).toBe('第 2 组')
    expect(nextDutyGroupName([{ groupName: '卫生组' }, { groupName: '第 1 组' }])).toBe('第 2 组')
  })
})
