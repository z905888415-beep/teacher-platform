import { db, nowISO, type SchoolClass } from '../db'
import { todayISO, addDays, mondayOf } from '../lib/dates'

/** 首次启动写入民办初中数学教师示例数据（可随时清空重来） */
export async function ensureSeedData(): Promise<void> {
  const seeded = await db.settings.get('seededAt')
  if (seeded) return

  const stamp = nowISO()
  const today = todayISO()
  const lastMonday = addDays(mondayOf(today), -7)

  await db.transaction('rw', db.tables, async () => {
    const class3: SchoolClass = {
      name: '初二（3）班',
      grade: '初二',
      isHomeroom: 1,
      archived: 0,
      createdAt: stamp,
      updatedAt: stamp,
    }
    const class5: SchoolClass = {
      name: '初二（5）班',
      grade: '初二',
      isHomeroom: 0,
      archived: 0,
      createdAt: stamp,
      updatedAt: stamp,
    }
    const class3Id = await db.classes.add(class3)
    const class5Id = await db.classes.add(class5)

    const studentNames: [string, string, string, string][] = [
      ['陈晓明', '男', '陈先生', '138****2401'],
      ['李雨桐', '女', '李女士', '139****8372'],
      ['王子涵', '男', '王女士', '137****5518'],
      ['刘思远', '男', '刘先生', '135****9034'],
      ['张一诺', '女', '张先生', '136****4462'],
      ['赵梓豪', '男', '赵女士', '133****7789'],
    ]
    const studentIds: number[] = []
    for (let i = 0; i < studentNames.length; i += 1) {
      const [name, gender, parentName, parentPhone] = studentNames[i]
      const id = await db.students.add({
        classId: class3Id,
        studentNo: String(i + 1).padStart(2, '0'),
        name,
        gender,
        parentName,
        parentPhone,
        boarding: i % 3 === 0 ? '住宿' : '走读',
        createdAt: stamp,
        updatedAt: stamp,
      })
      studentIds.push(id)
    }

    const course = (
      subject: string,
      teachingClassId: number,
      dayOfWeek: number,
      period: number,
      room: string,
      weekType: 'all' | 'odd' | 'even' = 'all',
    ) => ({
      subject,
      teachingClassId,
      dayOfWeek,
      period,
      room,
      weekType,
      createdAt: stamp,
      updatedAt: stamp,
    })

    await db.courseTemplates.bulkAdd([
      course('数学', class3Id, 1, 2, '203'),
      course('班会', class3Id, 1, 4, '203'),
      course('数学', class3Id, 2, 1, '203'),
      course('数学', class5Id, 2, 3, '205', 'odd'),
      course('数学', class5Id, 3, 1, '205'),
      course('数学', class3Id, 3, 4, '203'),
      course('数学', class5Id, 4, 1, '205'),
      course('数学', class3Id, 4, 5, '203'),
      course('数学', class3Id, 5, 2, '203'),
    ])

    await db.todos.bulkAdd([
      {
        title: '整理单元测验错题',
        dueAt: addDays(today, -1),
        priority: 'high',
        category: '教学',
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        title: '批改初二（3）班作业',
        dueAt: today,
        priority: 'normal',
        category: '教学',
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        title: '确认明天值日分组',
        dueAt: today,
        priority: 'normal',
        category: '班务',
        createdAt: stamp,
        updatedAt: stamp,
      },
    ])

    await db.calendarEvents.bulkAdd([
      { title: '教研组会议', startAt: addDays(today, 3), type: '会议', createdAt: stamp, updatedAt: stamp },
      { title: '数学单元测验', startAt: addDays(today, 7), type: '考试', createdAt: stamp, updatedAt: stamp },
      { title: '校运动会', startAt: addDays(today, 18), type: '活动', createdAt: stamp, updatedAt: stamp },
      {
        title: '国庆放假',
        startAt: `${new Date().getFullYear()}-10-01`,
        endAt: `${new Date().getFullYear()}-10-07`,
        type: '放假',
        createdAt: stamp,
        updatedAt: stamp,
      },
    ])

    await db.leaves.add({
      studentId: studentIds[1],
      startAt: today,
      endAt: today,
      type: '病假',
      reason: '感冒发烧，家长已电话确认',
      parentConfirmed: 1,
      createdAt: stamp,
    })

    const followupTodoId = await db.todos.add({
      title: '跟进李雨桐家长沟通',
      dueAt: addDays(today, 3),
      priority: 'normal',
      category: '家校',
      relatedStudentId: studentIds[1],
      createdAt: stamp,
      updatedAt: stamp,
    })
    await db.communications.bulkAdd([
      {
        studentId: studentIds[1],
        date: addDays(today, -1),
        method: '电话',
        summary: '家长反映最近作业时间偏长，已沟通分层布置',
        needFollowup: 1,
        followupDate: addDays(today, 3),
        followupTodoId,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        studentId: studentIds[3],
        date: addDays(today, -2),
        method: '微信',
        summary: '确认月考后家长会时间',
        needFollowup: 0,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ])

    await db.homework.add({
      classId: class3Id,
      date: today,
      content: '《一元一次方程》练习 第 3 题 — 第 8 题',
      estimatedMinutes: 30,
      graded: 0,
      needReview: 0,
      createdAt: stamp,
      updatedAt: stamp,
    })

    const exam1Id = await db.exams.add({
      classId: class3Id,
      name: '数学入学摸底',
      type: '月考',
      date: addDays(today, -14),
      fullScore: 100,
      createdAt: stamp,
    })
    const exam2Id = await db.exams.add({
      classId: class3Id,
      name: '数学单元测验（一）',
      type: '单元测验',
      date: addDays(today, -7),
      fullScore: 100,
      createdAt: stamp,
    })
    const exam1Scores = [92, 85, 78, 54, 88, 69]
    const exam2Scores = [95, 82, 81, 61, 90, 73]
    await db.mathScores.bulkAdd([
      ...exam1Scores.map((score, i) => ({ examId: exam1Id, studentId: studentIds[i], score })),
      ...exam2Scores.map((score, i) => ({ examId: exam2Id, studentId: studentIds[i], score })),
    ])

    await db.resources.bulkAdd([
      {
        title: '一元一次方程 · 教案',
        type: '教案',
        grade: '初二',
        volume: '上册',
        chapter: '第三章',
        link: 'D:\\备课资料\\一元一次方程\\教案.docx',
        note: '含分层练习设计',
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        title: '去括号解方程 · 课件',
        type: '课件',
        grade: '初二',
        volume: '上册',
        chapter: '第三章',
        link: 'D:\\备课资料\\一元一次方程\\课件.pptx',
        createdAt: stamp,
        updatedAt: stamp,
      },
    ])

    await db.dutyAssignments.bulkAdd([
      { classId: class3Id, groupName: '第一组', members: '陈晓明、李雨桐、王子涵', weekday: 1, task: '教室清扫' },
      { classId: class3Id, groupName: '第二组', members: '刘思远、张一诺', weekday: 2, task: '走廊保洁' },
      { classId: class3Id, groupName: '第三组', members: '赵梓豪、陈晓明', weekday: 3, task: '黑板讲台' },
    ])

    await db.seatVersions.add({
      classId: class3Id,
      name: '当前座位表',
      rows: 3,
      cols: 2,
      seats: JSON.stringify({
        '0-0': studentIds[0],
        '0-1': studentIds[1],
        '1-0': studentIds[2],
        '1-1': studentIds[3],
        '2-0': studentIds[4],
        '2-1': studentIds[5],
      }),
      createdAt: stamp,
    })

    await db.classRecords.add({
      classId: class3Id,
      date: lastMonday,
      type: '班会',
      content: '班会主题：新学期学习习惯养成，明确作业与预习要求。',
      studentIds: JSON.stringify([]),
      createdAt: stamp,
    })

    await db.notificationTemplates.add({
      title: '家长会通知',
      content:
        '各位家长好：本周五下午 4:00 在本班教室召开家长会，请提前安排时间参加。如有特殊情况无法到场，请提前与我联系。',
      createdAt: stamp,
      updatedAt: stamp,
    })

    await db.settings.bulkPut([
      { key: 'seededAt', value: stamp },
      { key: 'currentClassId', value: String(class3Id) },
      { key: 'semesterName', value: '第一学期' },
      { key: 'semesterLabel', value: '2026–2027 学年第一学期' },
      { key: 'semesterStart', value: `${new Date().getFullYear()}-08-31` },
      { key: 'periodCount', value: '6' },
      { key: 'periodTimes', value: '' },
      { key: 'showWeekend', value: '0' },
      { key: 'sidebarCollapsed', value: '0' },
    ])
  })
}
