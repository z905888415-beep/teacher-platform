import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '../db'
import {
  addDays,
  currentPeriod,
  minutesOf,
  mondayOf,
  periodRange,
  teachingWeek,
  todayISO,
  weekParityLabel,
  daysUntil,
  parsePeriodTimes,
} from '../lib/dates'
import { computeWeekSchedule } from '../lib/timetable'
import { getSetting, useSetting } from '../hooks/useSetting'
import { useClassManager } from '../contexts/ClassContext'
import { useClassActions } from '../components/ClassManager'
import { WeekGrid, MobileCourseList } from '../components/timetable/WeekGrid'
import { TodoSummary } from '../components/todos/TodoSummary'
import { TodoDrawer } from '../components/todos/TodoDrawer'
import { MiniCalendar } from '../components/calendar/MiniCalendar'
import { EventDrawer } from '../components/calendar/EventDrawer'
import { Button, Panel, Skeleton } from '../components/ui'
import type { CalendarEvent } from '../db'

export function Dashboard() {
  const { currentClass, classes } = useClassManager()
  const { openAddClass, openRenameClass, openDeleteClass } = useClassActions()
  const [weekOffset, setWeekOffset] = useState(0)
  const [todoDrawerOpen, setTodoDrawerOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(todayISO())
  const [eventDrawerOpen, setEventDrawerOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [navMonth, setNavMonth] = useState<{ year: number; month: number } | null>(null)

  const semesterStart = useSetting('semesterStart', `${new Date().getFullYear()}-08-31`)
  const periodCount = Number(useSetting('periodCount', '6')) || 6
  const periodTimesRaw = useSetting('periodTimes', '')
  const periodTimes = useMemo(() => parsePeriodTimes(periodTimesRaw, periodCount), [periodTimesRaw, periodCount])

  const templates = useLiveQuery(() => db.courseTemplates.toArray())
  const adjustments = useLiveQuery(() => db.courseAdjustments.toArray())
  const classesTable = useLiveQuery(() => db.classes.toArray())
  const events = useLiveQuery(
    () => db.calendarEvents.orderBy('startAt').toArray(),
    [],
    [] as CalendarEvent[],
  )!
  const students = useLiveQuery(() => db.students.toArray(), [], [])!
  const leaves = useLiveQuery(() => db.leaves.toArray(), [], [])!
  const communications = useLiveQuery(() => db.communications.toArray(), [], [])!
  const homework = useLiveQuery(() => db.homework.toArray(), [], [])!

  const today = todayISO()
  const weekStart = addDays(mondayOf(today), weekOffset * 7)
  const weekNo = teachingWeek(weekStart, semesterStart)
  const weekLabel = `第 ${weekNo} 周 · ${weekParityLabel(weekNo)}`
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const currentSlot = weekOffset === 0 ? (() => {
    const period = currentPeriod(periodTimes, now)
    const day = now.getDay()
    return period && day >= 1 && day <= 5 ? { day, period } : null
  })() : null
  // F23：下一节“即将开始”——今天下一个开始时间晚于当前的节次
  const nextSlot = weekOffset === 0 ? (() => {
    const day = now.getDay()
    if (day < 1 || day > 5) return null
    for (let period = 1; period <= periodCount; period += 1) {
      const range = periodRange(periodTimes, period)
      if (range && minutesOf(range.start) > nowMinutes) return { day, period }
    }
    return null
  })() : null

  // F25：首屏加载用与内容同结构的 Skeleton，不用全屏转圈
  const ready = templates !== undefined && adjustments !== undefined && classesTable !== undefined

  const schedule = useMemo(
    () =>
      computeWeekSchedule(templates ?? [], adjustments ?? [], classesTable ?? [], weekStart, weekNo, currentSlot, nextSlot),
    [templates, adjustments, classesTable, weekStart, weekNo, currentSlot, nextSlot],
  )

  const todayDay = new Date().getDay()
  const mobileDay = todayDay >= 1 && todayDay <= 5 ? todayDay : 1

  const studentName = (id: number) => students.find((s) => s.id === id)?.name ?? '学生'
  const classStudentIds = new Set(students.filter((s) => s.classId === currentClass?.id).map((s) => s.id ?? -1))

  const activeLeaves = leaves.filter(
    (leave) => leave.startAt <= today && leave.endAt >= today && classStudentIds.has(leave.studentId),
  )
  const followups = communications.filter((item) => item.needFollowup === 1 && classStudentIds.has(item.studentId))
  const ungraded = homework.filter((item) => item.classId === currentClass?.id && item.graded === 0)

  const upcomingEvents = events
    .filter((event) => (event.endAt ?? event.startAt) >= today)
    .slice(0, 4)
  const viewMonth = navMonth ?? { year: now.getFullYear(), month: now.getMonth() + 1 }

  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 min-[768px]:grid-cols-2 min-[900px]:grid-cols-12">
        {/* 本周课表 */}
        <div
          className="col-span-1 min-[900px]:col-span-8"
          style={{ animation: 'block-in 420ms cubic-bezier(.2,.8,.2,1) 60ms both' }}
        >
          <Panel
            title="本周课表"
            subtitle={`显示全部教学班 · 当前管理：${currentClass?.name ?? '—'} · ${weekLabel}`}
            actions={
              <>
                <div className="flex items-center gap-2.5">
                  <button type="button" onClick={openAddClass} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    添加班级
                  </button>
                  <button type="button" onClick={openRenameClass} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    重命名
                  </button>
                  <button
                    type="button"
                    onClick={openDeleteClass}
                    disabled={classes.length <= 1}
                    title={classes.length <= 1 ? '至少保留一个班级' : `删除${currentClass?.name ?? ''}`}
                    className="text-xs font-semibold text-danger-600 hover:text-danger-600/80 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    删除班级
                  </button>
                </div>
                <div className="flex items-center gap-1" role="group" aria-label="课表周次切换">
                  <button
                    type="button"
                    onClick={() => setWeekOffset((v) => v - 1)}
                    className="rounded-full px-2.5 py-1.5 text-[11px] text-ink-700 hover:bg-surface-muted"
                  >
                    上一周
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekOffset(0)}
                    className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${
                      weekOffset === 0 ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-surface-muted'
                    }`}
                  >
                    本周
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekOffset((v) => v + 1)}
                    className="rounded-full px-2.5 py-1.5 text-[11px] text-ink-700 hover:bg-surface-muted"
                  >
                    下一周
                  </button>
                </div>
                <Link to="/timetable" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                  完整课表
                </Link>
              </>
            }
            bodyClassName="p-2.5 sm:p-3"
          >
            <div className="hidden md:block">
              {ready ? (
                <WeekGrid
                  weekStart={weekStart}
                  weekNo={weekNo}
                  schedule={schedule}
                  days={[1, 2, 3, 4, 5]}
                  periodCount={periodCount}
                  todayISODate={today}
                  nextSlot={nextSlot}
                />
              ) : (
                <div className="grid gap-2" aria-label="课表加载中">
                  <Skeleton className="h-8 w-full" />
                  {Array.from({ length: periodCount }, (_, i) => (
                    <Skeleton key={i} className="h-[68px] w-full" />
                  ))}
                </div>
              )}
            </div>
            <MobileCourseList schedule={schedule} day={mobileDay} periodCount={periodCount} weekStart={weekStart} />
          </Panel>
        </div>

        {/* 右栏：待办 + 校历 */}
        <div
          className="col-span-1 grid content-start gap-3.5 min-[900px]:col-span-4"
          style={{ animation: 'block-in 420ms cubic-bezier(.2,.8,.2,1) 110ms both' }}
        >
          <Panel
            title="今日待办"
            actions={
              <>
                <button
                  type="button"
                  onClick={() => setTodoDrawerOpen(true)}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  新增待办
                </button>
                <Link to="/todos" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                  查看全部
                </Link>
              </>
            }
            bodyClassName="px-4 pb-3 pt-1"
          >
            <TodoSummary />
          </Panel>

          <Panel
            title="校历"
            actions={
              <>
                <button
                  type="button"
                  onClick={() => setEventDrawerOpen(true)}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  title={`在${selectedDate ?? '选中日期'}新增事项`}
                >
                  ＋新增事项
                </button>
                <Link to="/calendar" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                  查看全部
                </Link>
              </>
            }
            bodyClassName="px-4 pb-4 pt-1"
          >
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-bold text-ink-900">
                {viewMonth.year} 年 {viewMonth.month} 月
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="上一月"
                  onClick={() => shiftMonth(viewMonth, -1, setNavMonth)}
                  className="grid h-7 w-7 place-items-center rounded-full text-ink-500 hover:bg-surface-muted"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setNavMonth(null)}
                  className="rounded-full px-2 py-1 text-[11px] font-semibold text-brand-600 hover:bg-brand-50"
                >
                  今天
                </button>
                <button
                  type="button"
                  aria-label="下一月"
                  onClick={() => shiftMonth(viewMonth, 1, setNavMonth)}
                  className="grid h-7 w-7 place-items-center rounded-full text-ink-500 hover:bg-surface-muted"
                >
                  <ChevronRight size={15} />
                </button>
              </span>
            </div>
            <MiniCalendar
              events={events}
              month={viewMonth}
              selected={selectedDate}
              onSelect={(iso) => {
                if (iso === selectedDate) {
                  setEditingEvent(null)
                  setEventDrawerOpen(true)
                } else {
                  setSelectedDate(iso)
                }
              }}
            />
            <ul className="mt-2.5">
              {upcomingEvents.length === 0 && <li className="py-2 text-[11px] text-ink-500">近期没有校历事项</li>}
              {upcomingEvents.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEvent(event)
                      setEventDrawerOpen(true)
                    }}
                    className="flex w-full items-center justify-between gap-2 border-t border-line py-2 text-left text-[11px] first:border-t-0"
                  >
                    <span className="min-w-0 truncate text-ink-900">
                      {event.title}
                      <span className="ml-1.5 text-ink-500">{event.type}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-brand-600">{daysUntil(event.startAt)} 天</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* 班务提醒条 */}
        <div
          className="col-span-full grid grid-cols-1 gap-3.5 min-[768px]:grid-cols-3"
          style={{ animation: 'block-in 420ms cubic-bezier(.2,.8,.2,1) 160ms both' }}
        >
          {activeLeaves.length + followups.length + ungraded.length === 0 ? (
            <div className="col-span-full rounded-card border border-line bg-white px-5 py-4 text-sm text-ink-500 shadow-panel">
              今天没有需要处理的班务
            </div>
          ) : (
            <>
              <SummaryCard
                label="今日请假"
                value={activeLeaves.length}
                detail={
                  activeLeaves.length > 0
                    ? `${activeLeaves[0].type} ${activeLeaves.length} 人：${activeLeaves.slice(0, 2).map((l) => studentName(l.studentId)).join('、')}${activeLeaves.length > 2 ? ' 等' : ''}`
                    : '今天没有请假记录'
                }
                highlight={activeLeaves.length > 0}
              />
              <SummaryCard
                label="待跟进沟通"
                value={followups.length}
                detail={
                  followups.length > 0
                    ? followups
                        .slice(0, 2)
                        .map((item) => studentName(item.studentId))
                        .join('、') + (followups.length > 2 ? ` 等 ${followups.length} 人` : '')
                    : '没有待跟进的沟通'
                }
              />
              <SummaryCard
                label="待批改作业"
                value={ungraded.length}
                detail={
                  ungraded.length > 0
                    ? `最新：${ungraded[0].content}`
                    : '作业都已批改'
                }
              />
            </>
          )}
        </div>
      </div>

      <TodoDrawer open={todoDrawerOpen} todo={null} onClose={() => setTodoDrawerOpen(false)} />
      <EventDrawer
        open={eventDrawerOpen}
        event={editingEvent}
        defaultDate={selectedDate ?? today}
        onClose={() => {
          setEventDrawerOpen(false)
          setEditingEvent(null)
        }}
      />
    </>
  )
}

function shiftMonth(
  month: { year: number; month: number },
  delta: number,
  setter: (month: { year: number; month: number } | null) => void,
) {
  const date = new Date(month.year, month.month - 1 + delta, 1)
  setter({ year: date.getFullYear(), month: date.getMonth() + 1 })
}

function SummaryCard({
  label,
  value,
  detail,
  highlight,
}: {
  label: string
  value: number
  detail: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-card border px-5 py-4 shadow-panel ${
        highlight ? 'border-[#D9E2FF] bg-brand-50' : 'border-line bg-white'
      }`}
    >
      <p className={`text-[10px] font-bold tracking-[0.04em] ${highlight ? 'text-brand-600' : 'text-ink-500'}`}>{label}</p>
      <p className={`mt-1.5 text-[22px] font-bold tabular-nums ${highlight ? 'text-brand-600' : 'text-ink-900'}`}>{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-ink-500" title={detail}>
        {detail}
      </p>
    </div>
  )
}
