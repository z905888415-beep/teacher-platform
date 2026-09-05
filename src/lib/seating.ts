import type { Student } from '../db'

export const MIN_SEATING_SIZE = 1
export const MAX_SEATING_SIZE = 10
export const DEFAULT_SEATING_ROWS = 3
export const DEFAULT_SEATING_COLS = 5

export type SeatMap = Map<string, number>
export type SeatingStudent = Pick<Student, 'id' | 'name' | 'studentNo'>

export interface SeatingDimensions {
  rows: number
  cols: number
}

export interface AutoArrangeSuccess extends SeatingDimensions {
  seats: SeatMap
}

export interface AutoArrangeFailure {
  error: string
}

export type AutoArrangeResult = AutoArrangeSuccess | AutoArrangeFailure

export interface ClippedSeatMap {
  seats: SeatMap
  overflowStudentIds: number[]
}

/** 将行列限制在座位表允许的 1–10 范围内。 */
export function normalizeDimensions(rows: number, cols: number): SeatingDimensions {
  return {
    rows: Math.max(MIN_SEATING_SIZE, Math.min(MAX_SEATING_SIZE, Math.round(Number(rows) || MIN_SEATING_SIZE))),
    cols: Math.max(MIN_SEATING_SIZE, Math.min(MAX_SEATING_SIZE, Math.round(Number(cols) || MIN_SEATING_SIZE))),
  }
}

export function seatKey(row: number, col: number): string {
  return `${row}-${col}`
}

function parseSeatKey(key: string): { row: number; col: number } | null {
  const match = /^(\d+)-(\d+)$/.exec(key)
  if (!match) return null
  const row = Number(match[1])
  const col = Number(match[2])
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null
  return { row, col }
}

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

const CHINESE_UNITS: Record<string, number> = {
  十: 10,
  百: 100,
  千: 1000,
  万: 10000,
}

/** 解析常见的阿拉伯数字或中文数字编号，无法解析时返回 null。 */
function parseNumberToken(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const arabic = trimmed.match(/\d+(?:\.\d+)?/)
  if (arabic) {
    const number = Number(arabic[0])
    return Number.isFinite(number) ? number : null
  }

  if (![...trimmed].some((char) => char in CHINESE_DIGITS || char in CHINESE_UNITS)) return null
  let total = 0
  let section = 0
  let current = 0
  for (const char of trimmed) {
    if (char in CHINESE_DIGITS) {
      current = CHINESE_DIGITS[char]
      continue
    }
    const unit = CHINESE_UNITS[char]
    if (unit === 10000) {
      section += current
      total += section * unit
      section = 0
      current = 0
    } else if (unit) {
      section += (current || 1) * unit
      current = 0
    }
  }
  return total + section + current
}

/**
 * 按学号的自然数字顺序排列，支持“2”排在“10”前面，也支持中文数字。
 * 同一个数字（如“1”和“001”）保留原编号的稳定顺序，最后按姓名排序。
 */
export function compareStudentNo(a: SeatingStudent, b: SeatingStudent): number {
  const aNo = a.studentNo?.trim() ?? ''
  const bNo = b.studentNo?.trim() ?? ''
  const aNumber = parseNumberToken(aNo)
  const bNumber = parseNumberToken(bNo)

  if (aNumber != null && bNumber != null && aNumber !== bNumber) return aNumber - bNumber
  if (aNumber != null && bNumber == null) return -1
  if (aNumber == null && bNumber != null) return 1
  if (aNo !== bNo) return aNo.localeCompare(bNo, 'zh-CN', { numeric: true })
  return a.name.localeCompare(b.name, 'zh-CN')
}

export function sortStudentsForSeating<T extends SeatingStudent>(students: T[]): T[] {
  return [...students].sort((a, b) => compareStudentNo(a, b))
}

/**
 * 只保留可见座位，越界、非法、重复或不属于当前班级的学生会被移出。
 * 该函数不修改传入 Map，便于在调整行列前预览和测试。
 */
export function clipSeatMap(
  source: SeatMap,
  rows: number,
  cols: number,
  allowedStudentIds?: Iterable<number>,
): ClippedSeatMap {
  const dimensions = normalizeDimensions(rows, cols)
  const allowed = allowedStudentIds ? new Set(allowedStudentIds) : null
  const seats: SeatMap = new Map()
  const occupied = new Set<number>()
  const overflowStudentIds: number[] = []

  for (const [key, rawStudentId] of source.entries()) {
    const studentId = Number(rawStudentId)
    if (!Number.isInteger(studentId) || studentId <= 0) continue
    const parsed = parseSeatKey(key)
    const inBounds = parsed != null && parsed.row < dimensions.rows && parsed.col < dimensions.cols
    if (!inBounds || (allowed && !allowed.has(studentId))) {
      overflowStudentIds.push(studentId)
      continue
    }
    if (occupied.has(studentId)) {
      overflowStudentIds.push(studentId)
      continue
    }
    occupied.add(studentId)
    seats.set(key, studentId)
  }

  return { seats, overflowStudentIds }
}

/** 按学号排座，并在需要时只扩展行数；列数始终尊重当前设置。 */
export function autoArrangeStudents(
  students: SeatingStudent[],
  currentRows: number,
  currentCols: number,
): AutoArrangeResult {
  if (students.length > MAX_SEATING_SIZE * MAX_SEATING_SIZE) {
    return { error: '当前班级超过 100 人，座位表最多支持 100 个座位，请先减少学生人数或拆分班级' }
  }

  const dimensions = normalizeDimensions(currentRows, currentCols)
  const requiredRows = Math.max(dimensions.rows, Math.ceil(students.length / dimensions.cols))
  if (requiredRows > MAX_SEATING_SIZE) {
    return {
      error: `当前列数为 ${dimensions.cols} 列，最多可容纳 ${MAX_SEATING_SIZE * dimensions.cols} 人，请先增加列数`,
    }
  }

  const sorted = sortStudentsForSeating(students).filter((student): student is SeatingStudent & { id: number } => student.id != null)
  const seats: SeatMap = new Map()
  sorted.forEach((student, index) => {
    const row = Math.floor(index / dimensions.cols)
    const col = index % dimensions.cols
    seats.set(seatKey(row, col), student.id)
  })
  return { rows: requiredRows, cols: dimensions.cols, seats }
}

/** 把学生安排到目标座位；目标已有学生时，原学生自然回到未入座列表。 */
export function placeStudent(source: SeatMap, studentId: number, targetKey: string): SeatMap {
  const seats = new Map(source)
  for (const [key, occupant] of seats.entries()) {
    if (occupant === studentId) seats.delete(key)
  }
  seats.set(targetKey, studentId)
  return seats
}

/** 交换两个座位，支持其中一个或两个为空。 */
export function swapSeatAssignments(source: SeatMap, keyA: string, keyB: string): SeatMap {
  const seats = new Map(source)
  const a = seats.get(keyA)
  const b = seats.get(keyB)
  if (b != null) seats.set(keyA, b)
  else seats.delete(keyA)
  if (a != null) seats.set(keyB, a)
  else seats.delete(keyB)
  return seats
}

export function parseDutyMemberNames(value: string): string[] {
  return value
    .split(/[、,，\s]+/)
    .map((name) => name.trim())
    .filter(Boolean)
}

/** 生成不重复且尽量连续的默认组名，例如已有第 1、3 组时返回第 2 组。 */
export function nextDutyGroupName(duties: Array<Pick<{ groupName: string }, 'groupName'>>): string {
  const used = new Set<number>()
  for (const duty of duties) {
    const match = /^第\s*(\d+)\s*组$/.exec(duty.groupName.trim())
    if (!match) continue
    const number = Number(match[1])
    if (Number.isInteger(number) && number > 0) used.add(number)
  }
  let next = 1
  while (used.has(next)) next += 1
  return `第 ${next} 组`
}
