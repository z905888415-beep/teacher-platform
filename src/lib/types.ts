// 核心数据类型定义。多数通用实体使用动态字段（Record<string, unknown>），
// 这里仅对需要强类型交互的核心实体做明确声明，便于在成绩、座位、课表等
// 复杂页面中获得类型安全与编辑器提示。

/** 学生（学生名单 + 花名册 + 学籍 + 家庭 + 宿舍等字段合一） */
export interface Student {
  id?: number
  classId?: string
  studentNo: string // 学号
  name: string
  gender?: '男' | '女'
  birthday?: string // 用于生日提醒，YYYY-MM-DD
  remark?: string
  // 花名册
  parentName?: string
  parentPhone?: string
  address?: string
  emergencyContact?: string
  // 学籍
  regNo?: string
  idCard?: string
  hukou?: string
  // 选科 / 家庭 / 健康 / 宿舍
  selection?: string // 选科组合，如「物化生」
  familySituation?: string
  health?: string
  allergy?: string
  dorm?: string
  boardingType?: '住校' | '走读'
  pickup?: string
}

/** 考试 / 测验 */
export interface Exam {
  id?: number
  name: string
  type: string // 周考 / 月考 / 期中 / 期末 / 模拟考…
  date?: string
  fullMark?: number
}

/** 单条成绩 */
export interface Score {
  id?: number
  studentId: number
  examId: number
  subject: string
  score: number
  fullMark?: number
  gradeRank?: number // 年级排名
  classRank?: number // 班级排名
  comboRank?: number // 组合内排名
  assigned?: number // 赋分
}

/** 课表条目 */
export interface Course {
  id?: number
  dayOfWeek: number // 1=周一 … 7=周日
  period: number // 节次 1-8
  subject: string
  teacher?: string
  weekType: 'all' | 'odd' | 'even' // 单双周
  note?: string // 调课备注
}

/** 应用设置（key-value） */
export interface SettingItem {
  key: string
  value: unknown
}

export const SUBJECTS = [
  '语文', '数学', '英语', '物理', '化学', '生物',
  '政治', '历史', '地理', '信息技术', '通用技术', '体育', '美术', '音乐',
]

// 高考默认科目满分（语数英 150，选考科目 100）。可在「学生成绩 → 科目满分」中修改。
export const DEFAULT_SUBJECT_FULL_MARKS: Record<string, number> = {
  语文: 150, 数学: 150, 英语: 150,
  物理: 100, 化学: 100, 生物: 100,
  历史: 100, 政治: 100, 地理: 100,
}

export const EXAM_TYPES = ['周考', '月考', '期中', '期末', '模拟考', '联考', '随堂测验', '其他']

export const GENDERS = ['男', '女']

// 班干部 / 值日 / 座位等通用常量
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
export const WEEKDAYS_SHORT = ['一', '二', '三', '四', '五', '六', '日']

// 常用可选值（下拉框）
export const OPTIONS: Record<string, string[]> = {
  resourceCategory: ['课件', '教案', '试题', '视频', '文档', '其他'],
  templateCategory: ['教案', '教学设计', '课件大纲', '学案', '其他'],
  teachingRecordType: ['上课日志', '教学反思', '听课记录', '作业布置', '批改记录'],
  communicationMethod: ['电话', '微信', '短信', '面谈', '家长会', '家访'],
  summaryType: ['周总结', '月总结', '学期总结'],
  rewardType: ['表扬', '批评', '违纪', '奖励', '其他'],
  concernType: ['健康情况', '心理关注', '特殊家庭', '学习困难', '其他'],
  meetingType: ['学科协调会', '备课组会', '年级组会', '其他'],
  classLogCategory: ['纪律', '卫生', '课堂表现', '好人好事', '班级大事'],
  fundingType: ['贫困资助', '医疗保险', '意外险', '其他'],
  attendanceType: ['迟到', '早退', '缺勤', '请假'],
  leaveType: ['事假', '病假', '公假', '其他'],
  comprehensiveType: ['社会实践', '志愿服务', '研究性学习', '获奖情况', '社团活动', '其他'],
  familyCategory: ['单亲', '留守', '贫困', '父母离异', '亲子关系紧张', '其他'],
  psychologicalStatus: ['良好', '一般', '需关注', '重点跟进'],
}
