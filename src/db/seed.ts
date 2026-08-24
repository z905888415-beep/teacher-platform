import { db } from './index'

// 首次启动时注入一份「高一（1）班」示例数据，方便快速体验各功能。
// 用户可在「数据与设置 → 数据管理」中一键清除或再次导入示例数据。

const NAMES = [
  '王梓涵', '李雨桐', '张一诺', '刘子墨', '陈思远', '杨欣怡',
  '赵浩然', '黄静怡', '周子轩', '吴佳琪', '徐志豪', '孙梦瑶',
]

const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物']
const FULL_MARKS: Record<string, number> = { 语文: 150, 数学: 150, 英语: 150, 物理: 100, 化学: 100, 生物: 100 }

// 稳定的伪随机（避免每次刷新数据不同）
function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function seedStudents(): Promise<number[]> {
  const ids: number[] = []
  const rng = mulberry(20240101)
  for (let i = 0; i < NAMES.length; i++) {
    const gender = i % 2 === 0 ? '男' : '女'
    const id = (await db.table('students').add({
      classId: '高一（1）班',
      studentNo: `20240${String(101 + i)}`,
      name: NAMES[i],
      gender,
      birthday: `20${String(2007 + (i % 3)).slice(2)}-0${(i % 9) + 1}-1${i % 9}`,
      parentName: `${NAMES[i][0]}先生`,
      parentPhone: `1380000${String(1000 + i).slice(0, 4)}`,
      address: '示范市第一中学',
      emergencyContact: `1380000${String(1000 + i).slice(0, 4)}`,
      selection: i % 3 === 0 ? '物化生' : i % 3 === 1 ? '物化地' : '物生地',
      dorm: `3栋${Math.floor(i / 4) + 1}0${(i % 4) + 1}`,
      boardingType: i % 5 === 0 ? '走读' : '住校',
      health: '良好',
      familySituation: i % 6 === 0 ? '留守' : '',
    }) as number)
    ids.push(id)
  }
  return ids
}

async function seedExamsAndScores(studentIds: number[]): Promise<void> {
  const rng = mulberry(42)
  const examDefs = [
    { name: '期中考试', type: '期中', date: '2025-04-25' },
    { name: '期末考试', type: '期末', date: '2025-07-03' },
    { name: '第一次月考', type: '月考', date: '2025-10-10' },
  ]
  for (const def of examDefs) {
    const examId = await db.table('exams').add(def)
    for (const studentId of studentIds) {
      for (const subject of SUBJECTS) {
        const full = FULL_MARKS[subject]
        // 每人有稳定的基础水平，再加每次考试的波动
        const base = full * (0.55 + rng() * 0.4)
        const score = Math.round(Math.min(full, Math.max(20, base)))
        await db.table('scores').add({ studentId, examId, subject, score, fullMark: full })
      }
    }
  }
}

async function seedCourses(): Promise<void> {
  const week: Record<number, string[]> = {
    1: ['语文', '数学', '英语', '物理', '化学', '生物'],
    2: ['数学', '英语', '语文', '化学', '生物', '物理'],
    3: ['英语', '物理', '数学', '语文', '体育', '化学'],
    4: ['物理', '化学', '英语', '数学', '生物', '语文'],
    5: ['化学', '语文', '物理', '英语', '数学', '班会'],
  }
  for (const day of [1, 2, 3, 4, 5]) {
    for (const period of [1, 2, 3, 4, 5, 6]) {
      const subject = week[day][period - 1]
      await db.table('courses').add({
        dayOfWeek: day,
        period,
        subject,
        teacher: `${subject}老师`,
        weekType: 'all',
      })
    }
  }
}

async function seedMisc(): Promise<void> {
  const today = new Date()
  const ymd = (offset: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    return d.toISOString().slice(0, 10)
  }
  // 待办
  await db.table('todos').bulkAdd([
    { title: '批改期中试卷', date: ymd(0), priority: '高', done: false, category: '教学' },
    { title: '准备家长会发言稿', date: ymd(1), priority: '中', done: false, category: '班务' },
    { title: '提交教学进度表', date: ymd(2), priority: '高', done: false, category: '行政' },
    { title: '联系王梓涵家长沟通学习状态', date: ymd(0), priority: '中', done: false, category: '家校' },
  ])
  // 校历
  await db.table('events').bulkAdd([
    { date: ymd(3), type: '考试', title: '月考' },
    { date: ymd(10), type: '活动', title: '秋季运动会' },
    { date: ymd(20), type: '节假日', title: '国庆假期' },
  ])
  // 倒计时
  await db.table('countdowns').bulkAdd([
    { title: '高考', date: '2027-06-07', color: '#ef4444' },
    { title: '期末', date: '2026-01-20', color: '#f59e0b' },
    { title: '一模', date: '2026-03-05', color: '#2563eb' },
  ])
  // 工具链接
  await db.table('aiTools').bulkAdd([
    { name: 'DeepSeek', url: 'https://chat.deepseek.com', category: '对话' },
    { name: 'Kimi', url: 'https://kimi.moonshot.cn', category: '对话' },
    { name: '文心一言', url: 'https://yiyan.baidu.com', category: '对话' },
    { name: 'ChatGPT', url: 'https://chat.openai.com', category: '对话' },
  ])
  await db.table('officeTools').bulkAdd([
    { name: 'WPS 在线', url: 'https://www.kdocs.cn', category: '文档' },
    { name: '腾讯文档', url: 'https://docs.qq.com', category: '文档' },
    { name: '飞书文档', url: 'https://www.feishu.cn/product/docs', category: '文档' },
  ])
  await db.table('docTemplates').bulkAdd([
    { name: '成绩分析报告模板', category: '成绩', content: '本次【考试名称】平均分【__】分，及格率【__】%，优秀率【__】%。\n\n一、整体情况：\n二、亮点：\n三、存在问题：\n四、改进措施：' },
    { name: '家长会通知模板', category: '通知', content: '各位家长好！兹定于【日期】【时间】在【地点】召开家长会，请准时参加。' },
    { name: '请假条模板', category: '日常', content: '【学生姓名】同学因【原因】需请假【天数】天（【起止日期】），请批准。' },
  ])
  // 学科教师通讯录
  await db.table('subjectTeachers').bulkAdd(
    SUBJECTS.map((s, i) => ({ subject: s, name: `${s}老师`, phone: `1390000${String(1000 + i)}`, office: `教学楼${i + 1}层` })),
  )
  // 班干部
  await db.table('cadres').bulkAdd([
    { position: '班长', studentId: null, studentName: '王梓涵', term: '2025-2026学年', duty: '班级日常管理' },
    { position: '学习委员', studentId: null, studentName: '李雨桐', term: '2025-2026学年', duty: '作业收发、学习督促' },
    { position: '劳动委员', studentId: null, studentName: '张一诺', term: '2025-2026学年', duty: '卫生值日安排' },
  ])
}

export async function seedDemoData(): Promise<void> {
  const existing = await db.table('students').count()
  if (existing > 0) return // 已有数据则不覆盖
  const studentIds = await seedStudents()
  await seedExamsAndScores(studentIds)
  await seedCourses()
  await seedMisc()
  await db.table('settings').put({ key: 'seeded', value: true })
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
}
