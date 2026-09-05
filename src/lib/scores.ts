export interface ScoreStats {
  average: number
  median: number
  max: number
  min: number
  passRate: number
  excellentRate: number
  count: number
}

export const PASS_LINE = 60
export const EXCELLENT_LINE = 85

/** 成绩统计：平均分 / 中位数 / 及格率 / 优秀率（UI 规范 11.2） */
export function computeStats(scores: number[]): ScoreStats | null {
  if (scores.length === 0) return null
  const sorted = [...scores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  const sum = sorted.reduce((acc, value) => acc + value, 0)
  return {
    average: sum / sorted.length,
    median,
    max: sorted[sorted.length - 1],
    min: sorted[0],
    passRate: sorted.filter((value) => value >= PASS_LINE).length / sorted.length,
    excellentRate: sorted.filter((value) => value >= EXCELLENT_LINE).length / sorted.length,
    count: sorted.length,
  }
}

/** 名次：同分并列（1,2,2,4），分数高者靠前 */
/** 成绩必须在 [0, fullScore]；非法或负数返回 null */
export function clampScore(raw: string, fullScore: number): number | null {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.min(value, fullScore)
}

export function computeRanks(scoreByStudent: Map<number, number>): Map<number, number> {
  const entries = [...scoreByStudent.entries()].sort((a, b) => b[1] - a[1])
  const ranks = new Map<number, number>()
  let lastScore: number | null = null
  let lastRank = 0
  entries.forEach(([studentId, score], index) => {
    if (lastScore !== null && score === lastScore) {
      ranks.set(studentId, lastRank)
    } else {
      lastRank = index + 1
      lastScore = score
      ranks.set(studentId, lastRank)
    }
  })
  return ranks
}
