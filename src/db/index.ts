import Dexie, { type Table } from 'dexie'
import { DEFAULT_SUBJECT_FULL_MARKS } from '../lib/types'

/**
 * 数据库表清单。所有实体统一存放在一个 IndexedDB 数据库中，
 * 通用实体用「字段驱动」的 CRUD 管理器读写（见 components/EntityManager.tsx），
 * 因此这里采用统一的 schema 定义，避免为每个实体重复样板代码。
 *
 * 索引约定：主键 ++id 自增；带下标的字段用于排序 / 检索。
 */
const SCHEMA: Record<string, string> = {
  // 主工作台
  courses: '++id, dayOfWeek, period, weekType', // 课表
  events: '++id, date, type', // 校历
  todos: '++id, date, priority, done, category', // 待办
  // 教学工作台
  resources: '++id, category', // 备课资源
  templates: '++id, category, subject', // 备课模板
  teachingRecords: '++id, type, date', // 教学记录
  students: '++id, studentNo, name, classId, selection', // 学生名单/花名册
  exams: '++id, name, type, date', // 考试
  scores: '++id, studentId, examId, subject', // 成绩
  examSummaries: '++id, examId, studentId', // 每次考试的学生汇总（年级排名/赋分）
  // 班主任工作台
  communication: '++id, date, studentId', // 家校沟通
  classSummaries: '++id, type, date', // 班级总结
  cadres: '++id', // 班干部
  seats: '++id, version', // 座位版本
  duty: '++id, date', // 值日
  rewards: '++id, studentId, date, type', // 奖惩
  leaves: '++id, studentId, date', // 请假
  concerns: '++id, studentId, type', // 关注事项
  classMeetings: '++id, date', // 班会
  classFund: '++id, date, type', // 班费
  classLog: '++id, date, category', // 班级日志
  attendance: '++id, studentId, date, type', // 考勤
  dormitory: '++id, studentId', // 宿舍走读
  morningEvening: '++id, week', // 早晚自习
  safetyHealth: '++id, studentId', // 安全健康
  parentMeetings: '++id, date', // 家长会
  homeVisits: '++id, studentId, date', // 家访
  familySituation: '++id, studentId, category', // 家庭情况
  notifications: '++id, category', // 通知模板
  // 学科协同
  subjectTeachers: '++id, subject', // 学科教师通讯录
  teachingProgress: '++id, subject', // 教学进度共享
  homework: '++id, date, subject', // 作业与考试协调
  meetings: '++id, date, type', // 学科协调会
  // 成绩进阶 / 学生发展
  goals: '++id, studentId', // 目标管理
  career: '++id, studentId', // 生涯规划
  psychology: '++id, studentId, date', // 心理状态
  talks: '++id, studentId, date', // 谈心谈话
  comprehensive: '++id, studentId, type', // 综合素质评价
  borderline: '++id, studentId', // 临界生跟踪
  // 行政事务
  studentRecords: '++id, studentId', // 学籍信息
  collegeEntrance: '++id, category', // 高考报名/体检
  funding: '++id, type, date', // 贫困资助保险
  countdowns: '++id, date, title', // 倒计时
  // 常用工具
  aiTools: '++id, category',
  officeTools: '++id, category',
  docTemplates: '++id, category',
  fileTools: '++id, category',
  // 设置
  settings: 'key', // key-value
}

export const DB_NAME = 'teacher-platform'
export const db = new Dexie(DB_NAME)
db.version(1).stores(SCHEMA)

/** 通用取表：用于字段驱动的 CRUD 管理器 */
export function tbl(name: string): Table<any, number> {
  return db.table(name)
}

/** 读写单个设置项 */
export async function getSetting<T = unknown>(key: string, fallback?: T): Promise<T | undefined> {
  const row = await db.table('settings').get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.table('settings').put({ key, value })
}

/** 读取各科目满分（合并默认值，支持用户自定义） */
export async function getSubjectFullMarks(): Promise<Record<string, number>> {
  const saved = await getSetting<Record<string, number>>('subjectFullMarks')
  return { ...DEFAULT_SUBJECT_FULL_MARKS, ...(saved || {}) }
}

export async function setSubjectFullMarks(marks: Record<string, number>): Promise<void> {
  await setSetting('subjectFullMarks', marks)
}

// 复导出类型
export type * from '../lib/types'
