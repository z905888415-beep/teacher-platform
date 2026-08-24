import type { ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { EntityManager, type EntityManagerProps as EMProps } from '../components/EntityManager'
import { OPTIONS } from '../lib/types'

// 通用页面：把字段配置映射到 EntityManager，覆盖平台上大多数「列表 + 增删改查」模块。

export type GenericConfig = EMProps & { tableName: string }

function copyText(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => alert('已复制到剪贴板'),
    () => alert('复制失败，请手动选择复制'),
  )
}

const studentField = { key: 'studentId', label: '学生', type: 'student' as const, required: true }
const dateField = { key: 'date', label: '日期', type: 'date' as const }

export const GENERIC: Record<string, GenericConfig> = {
  // ===== 教学工作台 =====
  resources: {
    title: '备课资源', tableName: 'resources', subtitle: '课件、教案、试题、视频等常用网站链接',
    fields: [
      { key: 'title', label: '名称', required: true },
      { key: 'url', label: '链接', type: 'url' },
      { key: 'category', label: '分类', type: 'select', options: OPTIONS.resourceCategory },
      { key: 'note', label: '备注', full: true },
    ],
    filters: [{ key: 'category', label: '分类', options: OPTIONS.resourceCategory }],
    defaultSort: { key: 'id' },
  },
  templates: {
    title: '备课模板', tableName: 'templates', subtitle: '教案、教学设计、课件大纲等模板',
    fields: [
      { key: 'title', label: '标题', required: true },
      { key: 'category', label: '分类', type: 'select', options: OPTIONS.templateCategory },
      { key: 'subject', label: '学科', type: 'subject' },
      { key: 'chapter', label: '章节' },
      { key: 'content', label: '内容', type: 'textarea', full: true },
    ],
    filters: [{ key: 'category', label: '分类', options: OPTIONS.templateCategory }],
    defaultSort: { key: 'id' },
  },
  teachingRecords: {
    title: '教学记录', tableName: 'teachingRecords', subtitle: '上课日志、教学反思、听课记录、作业布置与批改',
    fields: [
      dateField,
      { key: 'type', label: '类型', type: 'select', options: OPTIONS.teachingRecordType },
      { key: 'subject', label: '学科', type: 'subject' },
      { key: 'title', label: '标题' },
      { key: 'content', label: '内容', type: 'textarea', full: true },
    ],
    filters: [{ key: 'type', label: '类型', options: OPTIONS.teachingRecordType }],
  },

  // ===== 班主任工作台 =====
  communication: {
    title: '家校沟通记录', tableName: 'communication', subtitle: '记录与家长的每一次沟通',
    fields: [
      dateField,
      studentField,
      { key: 'parentName', label: '家长' },
      { key: 'method', label: '方式', type: 'select', options: OPTIONS.communicationMethod },
      { key: 'summary', label: '内容摘要', type: 'textarea' },
      { key: 'followup', label: '下一步跟进', type: 'textarea' },
    ],
    filters: [{ key: 'method', label: '方式', options: OPTIONS.communicationMethod }],
  },
  summaries: {
    title: '班级总结', tableName: 'classSummaries', subtitle: '周总结、月总结、学期总结',
    fields: [
      { key: 'type', label: '类型', type: 'select', options: OPTIONS.summaryType },
      { key: 'title', label: '标题', required: true },
      dateField,
      { key: 'content', label: '内容', type: 'textarea', full: true },
    ],
    filters: [{ key: 'type', label: '类型', options: OPTIONS.summaryType }],
  },
  cadres: {
    title: '班干部安排', tableName: 'cadres',
    fields: [
      { key: 'position', label: '职务', required: true },
      studentField,
      { key: 'term', label: '任期' },
      { key: 'duty', label: '职责说明', type: 'textarea', full: true },
    ],
    defaultSort: { key: 'id', desc: false },
  },
  rewards: {
    title: '奖惩记录', tableName: 'rewards', subtitle: '表扬、批评、违纪等行为记录',
    fields: [
      dateField,
      studentField,
      { key: 'type', label: '类型', type: 'select', options: OPTIONS.rewardType },
      { key: 'content', label: '内容', type: 'textarea', full: true },
    ],
    filters: [{ key: 'type', label: '类型', options: OPTIONS.rewardType }],
  },
  leaves: {
    title: '请假记录', tableName: 'leaves',
    fields: [
      studentField,
      { key: 'startDate', label: '开始日期', type: 'date' },
      { key: 'endDate', label: '结束日期', type: 'date' },
      { key: 'type', label: '类型', type: 'select', options: OPTIONS.leaveType },
      { key: 'reason', label: '原因', type: 'textarea', full: true },
    ],
    filters: [{ key: 'type', label: '类型', options: OPTIONS.leaveType }],
  },
  concerns: {
    title: '学生关注事项', tableName: 'concerns', subtitle: '健康、心理、特殊家庭等情况',
    fields: [
      studentField,
      { key: 'type', label: '类型', type: 'select', options: OPTIONS.concernType },
      { key: 'status', label: '状态', type: 'select', options: ['持续关注', '已改善', '已解决'] },
      { key: 'content', label: '详情', type: 'textarea', full: true },
    ],
    filters: [{ key: 'type', label: '类型', options: OPTIONS.concernType }],
  },
  classMeetings: {
    title: '班会记录', tableName: 'classMeetings',
    fields: [
      dateField,
      { key: 'topic', label: '主题', required: true },
      { key: 'content', label: '内容', type: 'textarea' },
      { key: 'feedback', label: '学生反馈', type: 'textarea' },
      { key: 'summary', label: '效果总结', type: 'textarea' },
    ],
  },
  classFund: {
    title: '班费管理', tableName: 'classFund', subtitle: '收支明细与余额',
    fields: [
      dateField,
      { key: 'type', label: '类型', type: 'select', options: ['收入', '支出'], required: true },
      { key: 'amount', label: '金额（元）', type: 'number', required: true },
      { key: 'purpose', label: '用途' },
      { key: 'handler', label: '经办人' },
    ],
    filters: [{ key: 'type', label: '类型', options: ['收入', '支出'] }],
    summary: (rows) => {
      const balance = rows.reduce((sum, r) => sum + (r.type === '收入' ? Number(r.amount || 0) : -Number(r.amount || 0)), 0)
      const income = rows.filter((r) => r.type === '收入').reduce((s, r) => s + Number(r.amount || 0), 0)
      const expense = rows.filter((r) => r.type === '支出').reduce((s, r) => s + Number(r.amount || 0), 0)
      return (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="当前余额" value={`¥${balance.toFixed(2)}`} color={balance >= 0 ? 'text-emerald-600' : 'text-red-600'} />
          <Stat label="累计收入" value={`¥${income.toFixed(2)}`} />
          <Stat label="累计支出" value={`¥${expense.toFixed(2)}`} />
        </div>
      )
    },
  },
  classLog: {
    title: '班级日志', tableName: 'classLog', subtitle: '按天记录班级大事、纪律、卫生、课堂表现',
    fields: [
      dateField,
      { key: 'category', label: '类别', type: 'select', options: OPTIONS.classLogCategory },
      { key: 'content', label: '内容', type: 'textarea', full: true },
    ],
    filters: [{ key: 'category', label: '类别', options: OPTIONS.classLogCategory }],
  },
  attendance: {
    title: '考勤管理', tableName: 'attendance', subtitle: '迟到、早退、缺勤、请假记录',
    fields: [
      dateField,
      studentField,
      { key: 'type', label: '类型', type: 'select', options: OPTIONS.attendanceType },
      { key: 'reason', label: '原因' },
    ],
    filters: [{ key: 'type', label: '类型', options: OPTIONS.attendanceType }],
  },
  dormitory: {
    title: '宿舍与走读管理', tableName: 'dormitory',
    fields: [
      studentField,
      { key: 'boardingType', label: '类型', type: 'select', options: ['住校', '走读'] },
      { key: 'dorm', label: '宿舍/床位' },
      { key: 'checkResult', label: '查寝情况', type: 'textarea' },
      { key: 'pickup', label: '接送方式' },
      { key: 'afterClass', label: '晚自习后安排', type: 'textarea', full: true },
    ],
    filters: [{ key: 'boardingType', label: '类型', options: ['住校', '走读'] }],
  },
  morningEvening: {
    title: '早晚自习安排', tableName: 'morningEvening', subtitle: '自习时间、值班教师、出勤情况',
    fields: [
      { key: 'week', label: '周次' },
      { key: 'timeSlot', label: '时段', type: 'select', options: ['早自习', '晚自习'] },
      { key: 'dutyTeacher', label: '值班教师' },
      { key: 'attendance', label: '出勤情况', type: 'textarea', full: true },
    ],
    filters: [{ key: 'timeSlot', label: '时段', options: ['早自习', '晚自习'] }],
  },
  safetyHealth: {
    title: '安全与健康记录', tableName: 'safetyHealth',
    fields: [
      studentField,
      { key: 'health', label: '健康状况', type: 'textarea' },
      { key: 'disease', label: '特殊疾病' },
      { key: 'allergy', label: '过敏史' },
      { key: 'safetyTopic', label: '安全教育主题' },
      { key: 'drill', label: '演练情况', type: 'textarea', full: true },
    ],
  },
  parentMeetings: {
    title: '家长会记录', tableName: 'parentMeetings',
    fields: [
      dateField,
      { key: 'topic', label: '主题', required: true },
      { key: 'attendees', label: '参加人数', type: 'number' },
      { key: 'feedback', label: '家长反馈', type: 'textarea' },
      { key: 'followup', label: '需跟进事项', type: 'textarea' },
    ],
  },
  homeVisits: {
    title: '家访记录', tableName: 'homeVisits',
    fields: [
      dateField,
      studentField,
      { key: 'reason', label: '家访原因', type: 'textarea' },
      { key: 'parentOpinion', label: '家长意见', type: 'textarea' },
      { key: 'measures', label: '后续措施', type: 'textarea' },
    ],
  },
  familySituation: {
    title: '学生家庭情况分类', tableName: 'familySituation', subtitle: '单亲、留守、贫困等特殊标记',
    fields: [
      studentField,
      { key: 'category', label: '类型', type: 'select', options: OPTIONS.familyCategory },
      { key: 'detail', label: '具体情况', type: 'textarea', full: true },
    ],
    filters: [{ key: 'category', label: '类型', options: OPTIONS.familyCategory }],
  },
  notifications: {
    title: '家长群通知模板', tableName: 'notifications', subtitle: '常用通知，一键复制发送',
    fields: [
      { key: 'title', label: '标题', required: true },
      { key: 'category', label: '分类', type: 'select', options: ['日常通知', '活动通知', '紧急通知', '温馨提示'] },
      { key: 'content', label: '内容', type: 'textarea', full: true },
    ],
    defaultSort: { key: 'id' },
    rowActions: (row) => (
      <button className="p-1.5 rounded hover:bg-brand-50 text-brand-600" title="复制内容" onClick={() => copyText(row.content || '')}>
        <Copy size={15} />
      </button>
    ),
  },

  // ===== 学科协同 =====
  subjectTeachers: {
    title: '学科教师通讯录', tableName: 'subjectTeachers',
    fields: [
      { key: 'subject', label: '科目', type: 'subject', required: true },
      { key: 'name', label: '教师姓名', required: true },
      { key: 'phone', label: '联系方式' },
      { key: 'office', label: '办公室位置' },
      { key: 'note', label: '备注', full: true },
    ],
    filters: [{ key: 'subject', label: '科目', options: ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '其他'] }],
    defaultSort: { key: 'id' },
  },
  teachingProgress: {
    title: '教学进度共享', tableName: 'teachingProgress', subtitle: '各科进度、考试范围、测验安排总览',
    fields: [
      { key: 'subject', label: '科目', type: 'subject', required: true },
      { key: 'progress', label: '当前进度' },
      { key: 'examScope', label: '考试范围' },
      { key: 'testArrangement', label: '测验安排', type: 'textarea' },
      { key: 'updatedAt', label: '更新日期', type: 'date' },
    ],
    filters: [{ key: 'subject', label: '科目', options: ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '其他'] }],
  },
  homework: {
    title: '作业与考试协调', tableName: 'homework', subtitle: '记录各科作业量，自动预警作业过多',
    fields: [
      dateField,
      { key: 'subject', label: '科目', type: 'subject', required: true },
      { key: 'type', label: '类型', type: 'select', options: ['作业', '测验', '考试'] },
      { key: 'homework', label: '内容' },
      { key: 'estTime', label: '预计用时（分钟）', type: 'number' },
    ],
    filters: [{ key: 'type', label: '类型', options: ['作业', '测验', '考试'] }],
    summary: (rows) => {
      const byDate: Record<string, number> = {}
      rows.filter((r) => r.type !== '考试').forEach((r) => {
        if (!r.date) return
        byDate[r.date] = (byDate[r.date] || 0) + Number(r.estTime || 0)
      })
      const entries = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))
      const overloaded = entries.filter(([, t]) => t > 120)
      return (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="记录天数" value={entries.length} />
          <Stat label="作业超 2 小时的天数" value={overloaded.length} color={overloaded.length ? 'text-red-600' : 'text-emerald-600'} />
        </div>
      )
    },
  },
  meetings: {
    title: '学科协调会记录', tableName: 'meetings',
    fields: [
      dateField,
      { key: 'type', label: '类型', type: 'select', options: OPTIONS.meetingType },
      { key: 'participants', label: '参与教师' },
      { key: 'content', label: '讨论内容', type: 'textarea' },
      { key: 'decision', label: '决议', type: 'textarea' },
      { key: 'followup', label: '后续跟进', type: 'textarea' },
    ],
    filters: [{ key: 'type', label: '类型', options: OPTIONS.meetingType }],
  },

  // ===== 成绩进阶 / 学生发展 =====
  goals: {
    title: '目标管理', tableName: 'goals', subtitle: '为每个学生设定目标分数、大学与专业',
    fields: [
      studentField,
      { key: 'targetScore', label: '目标分数', type: 'number' },
      { key: 'currentScore', label: '当前总分', type: 'number' },
      { key: 'targetUniversity', label: '目标大学' },
      { key: 'targetMajor', label: '目标专业' },
      { key: 'note', label: '备注', full: true },
    ],
  },
  career: {
    title: '生涯规划与选科指导', tableName: 'career',
    fields: [
      studentField,
      { key: 'interests', label: '兴趣特长' },
      { key: 'careerTendency', label: '职业倾向' },
      { key: 'selectionIntent', label: '选科意向' },
      { key: 'assessment', label: '评估', type: 'textarea', full: true },
    ],
  },
  psychology: {
    title: '心理状态记录', tableName: 'psychology', subtitle: '情绪变化、心理辅导与重点关注',
    fields: [
      dateField,
      studentField,
      { key: 'status', label: '状态', type: 'select', options: OPTIONS.psychologicalStatus },
      { key: 'flag', label: '重点关注', type: 'boolean' },
      { key: 'emotion', label: '情绪变化', type: 'textarea' },
      { key: 'counseling', label: '辅导情况', type: 'textarea' },
    ],
    filters: [{ key: 'status', label: '状态', options: OPTIONS.psychologicalStatus }],
  },
  talks: {
    title: '谈心谈话记录', tableName: 'talks',
    fields: [
      dateField,
      studentField,
      { key: 'topic', label: '主题', required: true },
      { key: 'studentStatus', label: '学生状态', type: 'textarea' },
      { key: 'advice', label: '教师建议', type: 'textarea' },
      { key: 'followup', label: '后续跟进', type: 'textarea' },
    ],
  },
  comprehensive: {
    title: '综合素质评价档案', tableName: 'comprehensive', subtitle: '社会实践、志愿服务、获奖等',
    fields: [
      studentField,
      { key: 'type', label: '类型', type: 'select', options: OPTIONS.comprehensiveType },
      dateField,
      { key: 'content', label: '内容', type: 'textarea' },
      { key: 'proof', label: '佐证材料' },
    ],
    filters: [{ key: 'type', label: '类型', options: OPTIONS.comprehensiveType }],
  },

  // ===== 行政事务 =====
  collegeEntrance: {
    title: '高考报名与体检安排', tableName: 'collegeEntrance',
    fields: [
      { key: 'category', label: '类别', type: 'select', options: ['报名', '体检', '材料', '缴费'] },
      { key: 'item', label: '事项', required: true },
      { key: 'deadline', label: '截止日期', type: 'date' },
      { key: 'status', label: '状态', type: 'select', options: ['未开始', '进行中', '已完成'] },
      { key: 'note', label: '备注', full: true },
    ],
    filters: [{ key: 'status', label: '状态', options: ['未开始', '进行中', '已完成'] }],
  },
  funding: {
    title: '贫困资助与保险', tableName: 'funding',
    fields: [
      { key: 'type', label: '类型', type: 'select', options: OPTIONS.fundingType },
      studentField,
      dateField,
      { key: 'amount', label: '金额（元）', type: 'number' },
      { key: 'status', label: '状态', type: 'select', options: ['待审批', '已通过', '已发放', '未通过'] },
      { key: 'note', label: '备注', full: true },
    ],
    filters: [{ key: 'status', label: '状态', options: ['待审批', '已通过', '已发放', '未通过'] }],
  },

  // ===== 文档模板 =====
  docTemplates: {
    title: '文档模板', tableName: 'docTemplates', subtitle: '成绩分析、通知、签到表、请假条等',
    fields: [
      { key: 'name', label: '名称', required: true },
      { key: 'category', label: '分类', type: 'select', options: ['成绩', '通知', '日常', '家长会'] },
      { key: 'content', label: '内容', type: 'textarea', full: true },
    ],
    defaultSort: { key: 'id' },
    rowActions: (row) => (
      <button className="p-1.5 rounded hover:bg-brand-50 text-brand-600" title="复制内容" onClick={() => copyText(row.content || '')}>
        <Copy size={15} />
      </button>
    ),
  },
}

export function GenericPage({ configKey }: { configKey: string }) {
  const config = GENERIC[configKey]
  if (!config) return null
  return <EntityManager {...config} />
}

function Stat({ label, value, color = 'text-gray-900' }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}
