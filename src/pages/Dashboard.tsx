import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { CalendarDays, ListTodo, Cake, PhoneCall, Timer, BookOpen, Users, GraduationCap, ArrowRight } from 'lucide-react'
import { db } from '../db'
import { Card, Badge, EmptyState, StatCard } from '../components/ui'
import { todayStr, dayOfWeek, isEvenWeek, countdownText } from '../lib/utils'
import { WEEKDAYS } from '../lib/types'
import type { Course } from '../lib/types'

export default function Dashboard() {
  const courses = useLiveQuery(() => db.table('courses').toArray(), []) ?? []
  const todos = useLiveQuery(() => db.table('todos').toArray(), []) ?? []
  const students = useLiveQuery(() => db.table('students').toArray(), []) ?? []
  const communication = useLiveQuery(() => db.table('communication').toArray(), []) ?? []
  const countdowns = useLiveQuery(() => db.table('countdowns').toArray(), []) ?? []

  const today = todayStr()
  const dow = dayOfWeek(today)
  const even = isEvenWeek()

  // 今日课程
  const todayCourses = useMemo(() => {
    return (courses as Course[])
      .filter((c) => c.dayOfWeek === dow && (c.weekType === 'all' || (c.weekType === 'even' ? even : !even)))
      .sort((a, b) => a.period - b.period)
  }, [courses, dow, even])

  // 待办（今天 + 逾期未完成）
  const activeTodos = todos.filter((t) => !t.done)
  const todayTodos = activeTodos.filter((t) => t.date === today)
  const overdueTodos = activeTodos.filter((t) => t.date && t.date < today)

  // 今日生日
  const todayMd = today.slice(5)
  const birthdays = students.filter((s) => s.birthday && s.birthday.slice(5) === todayMd)

  // 今日沟通
  const todayComm = communication.filter((c) => c.date === today)

  return (
    <div>
      {/* 顶部问候 + 统计 */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">工作台总览</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {today} · {WEEKDAYS[dow - 1]} · {even ? '双周' : '单周'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="班级人数" value={students.length} sub="学生名单" color="text-brand-600" />
        <StatCard label="今日课程" value={todayCourses.length} sub={`${todayCourses.length} 节`} />
        <StatCard label="待办事项" value={activeTodos.length} sub={`逾期 ${overdueTodos.length} 项`} color={overdueTodos.length ? 'text-red-600' : undefined} />
        <StatCard label="今日沟通" value={todayComm.length} sub="家校沟通" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 今日课程 */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><BookOpen size={18} className="text-brand-600" />今日课程</h2>
            <Link to="/timetable" className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">课表 <ArrowRight size={12} /></Link>
          </div>
          {todayCourses.length === 0 ? (
            <EmptyState title="今天没有课" />
          ) : (
            <div className="space-y-2">
              {todayCourses.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                  <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">
                    {c.period}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{c.subject}</p>
                    <p className="text-xs text-gray-400">第{c.period}节{c.teacher ? ` · ${c.teacher}` : ''}</p>
                  </div>
                  {c.weekType !== 'all' && <Badge color="blue">{c.weekType === 'odd' ? '单周' : '双周'}</Badge>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 待办 */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><ListTodo size={18} className="text-brand-600" />待办事项</h2>
            <Link to="/todos" className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">全部 <ArrowRight size={12} /></Link>
          </div>
          {activeTodos.length === 0 ? (
            <EmptyState title="没有待办事项" />
          ) : (
            <div className="space-y-2">
              {[...todayTodos, ...overdueTodos, ...activeTodos.filter((t) => t.date !== today && t.date && t.date >= today)].slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{t.title}</p>
                    <p className="text-xs text-gray-400">{t.date || '未设日期'} · {t.category || '待办'}</p>
                  </div>
                  {t.priority && <Badge color={t.priority === '高' ? 'red' : t.priority === '中' ? 'amber' : 'gray'}>{t.priority}</Badge>}
                  {t.date && t.date < today && <Badge color="red">逾期</Badge>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 今日提醒汇总 */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><CalendarDays size={18} className="text-brand-600" />今日提醒</h2>
          </div>
          <div className="space-y-2">
            {birthdays.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50">
                <Cake size={18} className="text-amber-500 shrink-0" />
                <p className="text-sm text-gray-800">今天是 <span className="font-medium">{s.name}</span> 的生日 🎂</p>
              </div>
            ))}
            {todayComm.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-brand-50">
                <PhoneCall size={18} className="text-brand-600 shrink-0" />
                <p className="text-sm text-gray-800">预约沟通：{c.studentId ? '学生' : ''} {c.summary || '沟通记录'}</p>
              </div>
            ))}
            {birthdays.length === 0 && todayComm.length === 0 && todayTodos.length === 0 && (
              <EmptyState title="今天没有特别提醒" />
            )}
          </div>
        </Card>

        {/* 倒计时 */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Timer size={18} className="text-brand-600" />重要倒计时</h2>
            <Link to="/countdowns" className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">管理 <ArrowRight size={12} /></Link>
          </div>
          {countdowns.length === 0 ? (
            <EmptyState title="暂无倒计时" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {countdowns.slice(0, 6).map((c) => {
                const { days, text } = countdownText(c.date)
                return (
                  <div key={c.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.title}</p>
                    <p className="text-xs text-gray-400">{c.date}</p>
                    <p className="mt-1 text-lg font-bold" style={{ color: c.color || '#2563eb' }}>{days} <span className="text-xs font-normal text-gray-400">天</span></p>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* 快捷入口 */}
      <Card className="p-4 mt-4">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><GraduationCap size={18} className="text-brand-600" />快捷操作</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { to: '/scores', label: '录入成绩', icon: <Users size={18} /> },
            { to: '/todos', label: '添加待办', icon: <ListTodo size={18} /> },
            { to: '/communication', label: '记录沟通', icon: <PhoneCall size={18} /> },
            { to: '/seating', label: '座位安排', icon: <GraduationCap size={18} /> },
            { to: '/analysis', label: '成绩分析', icon: <BookOpen size={18} /> },
            { to: '/countdowns', label: '倒计时', icon: <Timer size={18} /> },
          ].map((q) => (
            <Link key={q.to + q.label} to={q.to} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-gray-50 hover:bg-brand-50 text-gray-600 hover:text-brand-700 transition-colors">
              {q.icon}
              <span className="text-xs">{q.label}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
