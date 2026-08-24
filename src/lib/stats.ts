import type { Score, Student } from './types'
import { round } from './utils'

/** 成绩分析工具：纯函数，输入成绩数组即可得到班级 / 个人 / 学科维度统计。 */

export interface SubjectStat {
  subject: string
  count: number
  avg: number
  max: number
  min: number
  fullMark: number
  passRate: number // 及格率 %
  excellentRate: number // 优秀率 %
  distribution: { range: string; count: number }[] // 分数段分布
}

export interface ClassAnalysis {
  subjects: string[]
  subjectStats: SubjectStat[]
  totalAvg: number
  totalMax: number
  totalMin: number
  totalFullMark: number
  studentTotals: { studentId: number; total: number }[] // 按总分降序
}

const DEFAULT_FULL = 100
const EXCELLENT_RATIO = 0.85
const PASS_RATIO = 0.6

/** 取某科满分（从成绩里带的全分推断，否则默认 100） */
function subjectFullMark(scores: Score[], subject: string): number {
  const withMark = scores.filter((s) => s.subject === subject && s.fullMark && s.fullMark > 0)
  return withMark.length ? Math.max(...withMark.map((s) => s.fullMark!)) : DEFAULT_FULL
}

function distribution(scores: number[], fullMark: number): { range: string; count: number }[] {
  const step = Math.max(10, Math.round(fullMark / 10))
  const buckets: Record<string, number> = {}
  scores.forEach((s) => {
    const lo = Math.floor(s / step) * step
    const hi = Math.min(fullMark, lo + step)
    const key = `${lo}-${hi}`
    buckets[key] = (buckets[key] || 0) + 1
  })
  return Object.entries(buckets)
    .sort((a, b) => Number(a[0].split('-')[0]) - Number(b[0].split('-')[0]))
    .map(([range, count]) => ({ range, count }))
}

/** 提取某次考试的科目集合 */
export function examSubjects(scores: Score[], examId: number): string[] {
  return [...new Set(scores.filter((s) => s.examId === examId).map((s) => s.subject))]
}

/** 班级整体分析（平均分/最高最低/优秀率/及格率/分数段/总分） */
export function analyzeExam(scores: Score[], examId: number): ClassAnalysis {
  const sc = scores.filter((s) => s.examId === examId)
  const subjects = [...new Set(sc.map((s) => s.subject))]
  const subjectStats: SubjectStat[] = subjects.map((subject) => {
    const list = sc.filter((s) => s.subject === subject).map((s) => s.score)
    const fullMark = subjectFullMark(sc, subject)
    const pass = list.filter((v) => v >= fullMark * PASS_RATIO).length
    const excellent = list.filter((v) => v >= fullMark * EXCELLENT_RATIO).length
    return {
      subject,
      count: list.length,
      avg: list.length ? round(list.reduce((a, b) => a + b, 0) / list.length) : 0,
      max: list.length ? Math.max(...list) : 0,
      min: list.length ? Math.min(...list) : 0,
      fullMark,
      passRate: list.length ? round((pass / list.length) * 100) : 0,
      excellentRate: list.length ? round((excellent / list.length) * 100) : 0,
      distribution: distribution(list, fullMark),
    }
  })

  const totals = new Map<number, number>()
  sc.forEach((s) => totals.set(s.studentId, (totals.get(s.studentId) || 0) + s.score))
  const totalArr = [...totals.values()]
  const fullMarks = subjectStats.map((s) => s.fullMark)
  const totalFullMark = fullMarks.reduce((a, b) => a + b, 0)
  const studentTotals = [...totals.entries()]
    .map(([studentId, total]) => ({ studentId, total }))
    .sort((a, b) => b.total - a.total)

  return {
    subjects,
    subjectStats,
    totalAvg: totalArr.length ? round(totalArr.reduce((a, b) => a + b, 0) / totalArr.length) : 0,
    totalMax: totalArr.length ? Math.max(...totalArr) : 0,
    totalMin: totalArr.length ? Math.min(...totalArr) : 0,
    totalFullMark,
    studentTotals,
  }
}

/** 单个学生某次考试的成绩向量（用于雷达图） */
export function studentVector(scores: Score[], examId: number, studentId: number): Record<string, number> {
  const vec: Record<string, number> = {}
  scores
    .filter((s) => s.examId === examId && s.studentId === studentId)
    .forEach((s) => (vec[s.subject] = s.score))
  return vec
}

/** 雷达图数据：将学生各科成绩归一化到 0-100（按满分） */
export function radarData(
  scores: Score[],
  examId: number,
  studentId: number | null,
): { subject: string; score: number }[] {
  const subjects = examSubjects(scores, examId)
  if (!subjects.length) return []
  const sc = scores.filter((s) => s.examId === examId)
  if (studentId === null) {
    // 班级平均分雷达
    return subjects.map((subject) => {
      const list = sc.filter((s) => s.subject === subject).map((s) => s.score)
      const full = subjectFullMark(sc, subject)
      const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0
      return { subject, score: round((avg / full) * 100) }
    })
  }
  const vec = studentVector(scores, examId, studentId)
  return subjects.map((subject) => {
    const full = subjectFullMark(sc, subject)
    return { subject, score: round(((vec[subject] ?? 0) / full) * 100) }
  })
}

/** 学生历次考试总分 / 单科趋势 */
export function studentTrend(
  scores: Score[],
  exams: { id?: number; name: string; date?: string }[],
  studentId: number,
  subject?: string,
): { examId: number; examName: string; value: number }[] {
  const ordered = [...exams]
    .filter((e) => e.id !== undefined)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  return ordered.map((e) => {
    const sc = scores.filter((s) => s.examId === e.id && s.studentId === studentId)
    const value = subject ? sc.filter((s) => s.subject === subject).reduce((a, b) => a + b.score, 0) : sc.reduce((a, b) => a + b.score, 0)
    return { examId: e.id as number, examName: e.name, value }
  })
}

/** 班级平均分历次对比 */
export function classAvgTrend(
  scores: Score[],
  exams: { id?: number; name: string; date?: string }[],
): { examId: number; examName: string; avg: number }[] {
  const ordered = [...exams]
    .filter((e) => e.id !== undefined)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  return ordered.map((e) => {
    const sc = scores.filter((s) => s.examId === e.id)
    const totals = new Map<number, number>()
    sc.forEach((s) => totals.set(s.studentId, (totals.get(s.studentId) || 0) + s.score))
    const arr = [...totals.values()]
    return { examId: e.id as number, examName: e.name, avg: arr.length ? round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0 }
  })
}

/** 偏科预警：找出单科明显弱于其总分排名的学生 */
export function detectBias(
  scores: Score[],
  examId: number,
  threshold = 0.15,
): { studentId: number; subject: string; score: number; subjectAvg: number; gap: number }[] {
  const sc = scores.filter((s) => s.examId === examId)
  const subjects = [...new Set(sc.map((s) => s.subject))]
  const results: { studentId: number; subject: string; score: number; subjectAvg: number; gap: number }[] = []
  subjects.forEach((subject) => {
    const list = sc.filter((s) => s.subject === subject)
    if (list.length < 5) return // 样本太少不做
    const full = subjectFullMark(sc, subject)
    list.forEach((s) => {
      const ratio = s.score / full
      if (ratio < threshold) {
        results.push({
          studentId: s.studentId,
          subject,
          score: s.score,
          subjectAvg: round(list.reduce((a, b) => a + b.score, 0) / list.length),
          gap: round((list.reduce((a, b) => a + b.score, 0) / list.length) - s.score),
        })
      }
    })
  })
  return results.sort((a, b) => b.gap - a.gap)
}

/** 临界生筛选：总分落在 [line - buffer, line + buffer] 区间 */
export function borderlineStudents(
  analysis: ClassAnalysis,
  line: number,
  buffer = 10,
): { studentId: number; total: number; delta: number }[] {
  return analysis.studentTotals
    .filter((t) => t.total >= line - buffer && t.total <= line + buffer)
    .map((t) => ({ studentId: t.studentId, total: t.total, delta: round(t.total - line) }))
    .sort((a, b) => a.delta - b.delta)
}

/** 学科贡献率：各科平均分占总分的比重（用于识别短板） */
export function subjectContribution(subjectStats: SubjectStat[]): { subject: string; contribution: number }[] {
  const totalAvg = subjectStats.reduce((a, b) => a + b.avg, 0)
  if (!totalAvg) return []
  return subjectStats.map((s) => ({ subject: s.subject, contribution: round((s.avg / totalAvg) * 100) }))
}

/** 按分数段统计人数（可跨科目统一满分为 100 归一） */
export function scoreBands(totals: number[], fullMark: number): { band: string; count: number }[] {
  const bands = [
    { band: `90-${fullMark}`, lo: 0.9 * fullMark, hi: fullMark + 1 },
    { band: '80-90', lo: 0.8 * fullMark, hi: 0.9 * fullMark },
    { band: '70-80', lo: 0.7 * fullMark, hi: 0.8 * fullMark },
    { band: '60-70', lo: 0.6 * fullMark, hi: 0.7 * fullMark },
    { band: `0-60`, lo: 0, hi: 0.6 * fullMark },
  ]
  return bands.map((b) => ({
    band: b.band,
    count: totals.filter((t) => t >= b.lo && t < b.hi).length,
  }))
}

/** 计算排名（按分数降序，返回学生 -> 名次） */
export function rankMap(items: { studentId: number; total: number }[]): Map<number, number> {
  const sorted = [...items].sort((a, b) => b.total - a.total)
  const map = new Map<number, number>()
  sorted.forEach((it, idx) => map.set(it.studentId, idx + 1))
  return map
}

export { DEFAULT_FULL }
