import { describe, expect, it } from 'vitest'
import { clampScore, computeRanks, computeStats, PASS_LINE } from '../scores'

describe('computeStats', () => {
  it('平均分、中位数、及格率、优秀率', () => {
    const stats = computeStats([92, 85, 78, 54, 88, 69])
    expect(stats).not.toBeNull()
    expect(stats!.count).toBe(6)
    expect(stats!.average).toBeCloseTo(77.67, 2)
    // 排序后 54,69,78,85,88,92 → 中位数 (78+85)/2
    expect(stats!.median).toBe(81.5)
    expect(stats!.max).toBe(92)
    expect(stats!.min).toBe(54)
    expect(stats!.passRate).toBeCloseTo(5 / 6, 4)
    expect(stats!.excellentRate).toBeCloseTo(3 / 6, 4)
  })

  it('奇数个成绩取中间值', () => {
    expect(computeStats([100, 60, 20])!.median).toBe(60)
  })

  it('空数据返回 null', () => {
    expect(computeStats([])).toBeNull()
  })

  it('恰好等于及格线算及格', () => {
    const stats = computeStats([PASS_LINE, 0])
    expect(stats!.passRate).toBe(0.5)
  })
})

describe('clampScore', () => {
  it('拒绝负数，截断超过满分', () => {
    expect(clampScore('-1', 100)).toBeNull()
    expect(clampScore('abc', 100)).toBeNull()
    expect(clampScore('105', 100)).toBe(100)
    expect(clampScore('88', 100)).toBe(88)
  })
})

describe('computeRanks', () => {
  it('同分并列名次（1,2,2,4）', () => {
    const ranks = computeRanks(
      new Map([
        [1, 90],
        [2, 85],
        [3, 85],
        [4, 70],
      ]),
    )
    expect(ranks.get(1)).toBe(1)
    expect(ranks.get(2)).toBe(2)
    expect(ranks.get(3)).toBe(2)
    expect(ranks.get(4)).toBe(4)
  })
})
