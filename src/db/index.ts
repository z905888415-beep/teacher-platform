import Dexie, { type Table } from 'dexie'

/** 教学班 / 行政班 */
export interface SchoolClass {
  id?: number
  name: string
  grade?: string
  isHomeroom: 0 | 1
  archived: 0 | 1
  createdAt: string
  updatedAt: string
}

/** 学生与家长：仅保留日常联系所需最小字段 */
export interface Student {
  id?: number
  classId: number
  studentNo?: string
  name: string
  gender?: string
  birthday?: string
  parentName?: string
  parentPhone?: string
  emergencyContact?: string
  boarding?: string
  note?: string
  createdAt: string
  updatedAt: string
}

/** 基础周课表 */
export interface CourseTemplate {
  id?: number
  teachingClassId: number
  subject: string
  dayOfWeek: number
  period: number
  weekType: 'all' | 'odd' | 'even'
  room?: string
  note?: string
  createdAt: string
  updatedAt: string
}

/** 临时调课记录；weekStart 为 '*' 表示长期调整的历史留痕 */
export interface CourseAdjustment {
  id?: number
  courseId: number
  weekStart: string
  fromDayOfWeek: number
  fromPeriod: number
  toDayOfWeek: number
  toPeriod: number
  type: 'move' | 'swap' | 'cancel'
  swappedCourseId?: number
  note?: string
  createdAt: string
}

export type TodoCategory = '教学' | '班务' | '家校' | '个人'
export type TodoPriority = 'low' | 'normal' | 'high'

export interface Todo {
  id?: number
  title: string
  dueAt?: string
  priority: TodoPriority
  category: TodoCategory
  doneAt?: string
  archivedAt?: string
  relatedStudentId?: number
  relatedEventId?: number
  note?: string
  createdAt: string
  updatedAt: string
}

export type EventType = '考试' | '放假' | '活动' | '会议' | '其他'

export interface CalendarEvent {
  id?: number
  title: string
  startAt: string
  endAt?: string
  type: EventType
  note?: string
  createdAt: string
  updatedAt: string
}

export type AttendanceType = '迟到' | '早退' | '缺勤'

/** 异常出勤：默认状态为“正常”，只写异常项 */
export interface AttendanceRecord {
  id?: number
  studentId: number
  date: string
  type: AttendanceType
  note?: string
  createdAt: string
}

export interface LeaveRecord {
  id?: number
  studentId: number
  startAt: string
  endAt: string
  type: '病假' | '事假' | '其他'
  reason?: string
  parentConfirmed: 0 | 1
  createdAt: string
}

export interface Communication {
  id?: number
  studentId: number
  date: string
  method: string
  summary: string
  needFollowup: 0 | 1
  followupDate?: string
  followupTodoId?: number
  createdAt: string
  updatedAt: string
}

/** P1：备课资料 */
export interface Resource {
  id?: number
  title: string
  type: '教案' | '课件' | '试题' | '微课' | '反思'
  grade?: string
  volume?: string
  chapter?: string
  link?: string
  note?: string
  /** 关联的课（F15） */
  courseTemplateId?: number
  createdAt: string
  updatedAt: string
}

/** P1：作业记录 */
export interface Homework {
  id?: number
  classId: number
  date: string
  content: string
  estimatedMinutes?: number
  dueAt?: string
  graded: 0 | 1
  needReview: 0 | 1
  createdAt: string
  updatedAt: string
}

/** P1：数学考试与成绩 */
export type ExamType = '随堂测验' | '单元测验' | '月考' | '期中' | '期末'

export interface Exam {
  id?: number
  classId: number
  name: string
  type: ExamType
  date: string
  fullScore: number
  createdAt: string
}

export interface MathScore {
  id?: number
  examId: number
  studentId: number
  score: number | null
}

/** P1：座位与值日 */
export interface SeatVersion {
  id?: number
  classId: number
  name: string
  rows: number
  cols: number
  /** JSON：{ "r-c": studentId } */
  seats: string
  createdAt: string
}

export interface DutyAssignment {
  id?: number
  classId: number
  groupName: string
  members: string
  weekday: number
  task: string
}

/** P1：班级记录（时间线） */
export type ClassRecordType = '班会' | '班级事件' | '表扬' | '纪律' | '卫生' | '活动'

export interface ClassRecord {
  id?: number
  classId: number
  date: string
  type: ClassRecordType
  content: string
  studentIds: string
  createdAt: string
}

/** P1：家长群通知模板 */
export interface NotificationTemplate {
  id?: number
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface AppSetting {
  key: string
  value: string
}

export class WorkbenchDB extends Dexie {
  classes!: Table<SchoolClass, number>
  students!: Table<Student, number>
  courseTemplates!: Table<CourseTemplate, number>
  courseAdjustments!: Table<CourseAdjustment, number>
  todos!: Table<Todo, number>
  calendarEvents!: Table<CalendarEvent, number>
  attendance!: Table<AttendanceRecord, number>
  leaves!: Table<LeaveRecord, number>
  communications!: Table<Communication, number>
  resources!: Table<Resource, number>
  homework!: Table<Homework, number>
  exams!: Table<Exam, number>
  mathScores!: Table<MathScore, number>
  seatVersions!: Table<SeatVersion, number>
  dutyAssignments!: Table<DutyAssignment, number>
  classRecords!: Table<ClassRecord, number>
  notificationTemplates!: Table<NotificationTemplate, number>
  settings!: Table<AppSetting, string>

  constructor() {
    super('teacher-workbench')
    this.version(1).stores({
      classes: '++id, &name, archived, isHomeroom',
      students: '++id, classId, name, studentNo',
      courseTemplates: '++id, teachingClassId, dayOfWeek, period, subject',
      courseAdjustments: '++id, courseId, weekStart',
      todos: '++id, dueAt, category, doneAt',
      calendarEvents: '++id, startAt, type',
      attendance: '++id, studentId, date',
      leaves: '++id, studentId, startAt, endAt',
      communications: '++id, studentId, date, needFollowup',
      resources: '++id, type',
      homework: '++id, classId, date, graded',
      exams: '++id, classId, date',
      mathScores: '++id, examId, studentId',
      seatVersions: '++id, classId',
      dutyAssignments: '++id, classId, weekday',
      classRecords: '++id, classId, date, type',
      notificationTemplates: '++id, title',
      settings: 'key',
    })
    this.version(2).stores({
      classes: '++id, &name, archived, isHomeroom',
      students: '++id, classId, name, studentNo',
      courseTemplates: '++id, teachingClassId, dayOfWeek, period, subject',
      courseAdjustments: '++id, courseId, weekStart',
      todos: '++id, dueAt, category, doneAt',
      calendarEvents: '++id, startAt, type',
      attendance: '++id, studentId, date',
      leaves: '++id, studentId, startAt, endAt',
      communications: '++id, studentId, date, needFollowup',
      resources: '++id, type, courseTemplateId',
      homework: '++id, classId, date, graded',
      exams: '++id, classId, date',
      mathScores: '++id, examId, studentId',
      seatVersions: '++id, classId',
      dutyAssignments: '++id, classId, weekday',
      classRecords: '++id, classId, date, type',
      notificationTemplates: '++id, title',
      settings: 'key',
    })
  }
}

export const db = new WorkbenchDB()

export function nowISO(): string {
  return new Date().toISOString()
}

/** 备份覆盖的全部业务表 */
export const BACKUP_TABLES = [
  'classes',
  'students',
  'courseTemplates',
  'courseAdjustments',
  'todos',
  'calendarEvents',
  'attendance',
  'leaves',
  'communications',
  'resources',
  'homework',
  'exams',
  'mathScores',
  'seatVersions',
  'dutyAssignments',
  'classRecords',
  'notificationTemplates',
] as const

export type BackupTableName = (typeof BACKUP_TABLES)[number]
