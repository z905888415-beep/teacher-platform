import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Printer } from 'lucide-react'
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
  parsePeriodTimes,
  WEEKDAY_NAMES,
  parseISODate,
} from '../lib/dates'
import { computeWeekSchedule } from '../lib/timetable'
import { useSetting, setSetting } from '../hooks/useSetting'
import { useClassManager } from '../contexts/ClassContext'
import { WeekGrid, MobileCourseList } from '../components/timetable/WeekGrid'
import { Button, Panel } from '../components/ui'

export function Timetable() {
  const { currentClass } = useClassManager()
  const [weekOffset, setWeekOffset] = useState(0)

  const semesterStart = useSetting('semesterStart', `${new Date().getFullYear()}-08-31`)
  const periodCount = Number(useSetting('periodCount', '6')) || 6
  const showWeekend = useSetting('showWeekend', '0') === '1'
  const periodTimesRaw = useSetting('periodTimes', '')
  const periodTimes = useMemo(() => parsePeriodTimes(periodTimesRaw, periodCount), [periodTimesRaw, periodCount])

  const templates = useLiveQuery(() => db.courseTemplates.toArray(), [], [])!
  const adjustments = useLiveQuery(() => db.courseAdjustments.toArray(), [], [])!
  const classes = useLiveQuery(() => db.classes.toArray(), [], [])!

  const today = todayISO()
  const weekStart = addDays(mondayOf(today), weekOffset * 7)
  const weekNo = teachingWeek(weekStart, semesterStart)
  const weekEnd = addDays(weekStart, 4)
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const currentSlot = weekOffset === 0
    ? (() => {
        const period = currentPeriod(periodTimes, now)
        const day = now.getDay()
        return period && day >= 1 && day <= 5 ? { day, period } : null
      })()
    : null
  // F23：下一节“即将开始”
  const nextSlot = weekOffset === 0
    ? (() => {
        const day = now.getDay()
        if (day < 1 || day > 5) return null
        for (let period = 1; period <= periodCount; period += 1) {
          const range = periodRange(periodTimes, period)
          if (range && minutesOf(range.start) > nowMinutes) return { day, period }
        }
        return null
      })()
    : null

  const schedule = useMemo(
    () => computeWeekSchedule(templates, adjustments, classes, weekStart, weekNo, currentSlot, nextSlot),
    [templates, adjustments, classes, weekStart, weekNo, currentSlot, nextSlot],
  )

  const todayDay = now.getDay()
  const mobileDay = todayDay >= 1 && todayDay <= 5 ? todayDay : 1
  const rangeLabel = `${weekStart.slice(5).replace('-', '/')} – ${weekEnd.slice(5).replace('-', '/')}`
  const editMode = useSetting('timetableEditMode', '1') === '1'

  return (
    <>
      <Panel
        title="我的课表"
        subtitle={`第 ${weekNo} 周（${weekParityLabel(weekNo)}）· ${rangeLabel} · 当前管理：${currentClass?.name ?? ''}`}
        actions={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-700">
              <input
                type="checkbox"
                checked={editMode}
                onChange={(event) => setSetting('timetableEditMode', event.target.checked ? '1' : '0')}
                className="h-4 w-4 accent-[#002FA7]"
              />
              编辑模式
            </label>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-1 rounded-ui border border-line px-3 text-xs font-semibold text-ink-700 hover:border-line-strong"
            >
              <Printer size={14} /> 打印
            </button>
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
          </div>
        }
        bodyClassName="p-2.5 sm:p-3"
      >
        <div className="hidden md:block">
          <WeekGrid
            weekStart={weekStart}
            weekNo={weekNo}
            schedule={schedule}
            days={showWeekend ? [1, 2, 3, 4, 5, 6, 0].filter((d) => (showWeekend ? true : d <= 5)) : [1, 2, 3, 4, 5]}
            periodCount={periodCount}
            todayISODate={today}
            nextSlot={nextSlot}
            interactive={editMode}
          />
        </div>
        <MobileCourseList schedule={schedule} day={mobileDay} periodCount={periodCount} weekStart={weekStart} />
      </Panel>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 min-[768px]:grid-cols-2">
        <Panel title="今日课程" bodyClassName="px-4 pb-4">
          <ul>
            {Array.from({ length: periodCount }, (_, i) => i + 1)
              .flatMap((period) =>
                (schedule.slots.get(`${mobileDay}-${period}`) ?? []).map((course) => ({ course, period })),
              )
              .map(({ course, period }) => (
                <li key={course.templateId} className="flex items-center gap-3 border-t border-line py-2 first:border-t-0">
                  <span className="w-8 text-xs tabular-nums text-ink-500">第 {period} 节</span>
                  <span className="flex-1 text-sm font-semibold text-ink-900">{course.subject}</span>
                  <span className="text-[11px] text-ink-500">
                    {course.className}
                    {course.room ? ` · ${course.room}` : ''}
                  </span>
                </li>
              ))}
            {Array.from({ length: periodCount }, (_, i) => i + 1).every(
              (period) => (schedule.slots.get(`${mobileDay}-${period}`) ?? []).length === 0,
            ) && <li className="py-3 text-xs text-ink-500">今天暂无课程</li>}
          </ul>
        </Panel>
        <Panel title="本周概览" bodyClassName="px-4 pb-4">
          <div className="grid grid-cols-5 gap-2 pt-1">
            {[1, 2, 3, 4, 5].map((day) => {
              const count = Array.from({ length: periodCount }, (_, i) => i + 1).reduce(
                (sum, period) => sum + (schedule.slots.get(`${day}-${period}`)?.length ?? 0),
                0,
              )
              const iso = addDays(weekStart, day - 1)
              return (
                <div key={day} className="rounded-menu border border-line px-2 py-3 text-center">
                  <p className={`text-[11px] ${iso === today ? 'font-bold text-brand-600' : 'text-ink-500'}`}>
                    {WEEKDAY_NAMES[parseISODate(iso).getDay()]}
                  </p>
                  <p className={`mt-1 text-lg font-bold tabular-nums ${count === 0 ? 'text-ink-500' : 'text-ink-900'}`}>
                    {count}
                  </p>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-ink-500">
            拖动课程卡调整位置；单击课程编辑内容；点击「移」或按 M 键进入移动模式后，点击目标格即可键盘完成调课。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setSetting('showWeekend', showWeekend ? '0' : '1')
              }}
            >
              {showWeekend ? '隐藏周末' : '显示周末'}
            </Button>
          </div>
        </Panel>
      </div>
    </>
  )
}
