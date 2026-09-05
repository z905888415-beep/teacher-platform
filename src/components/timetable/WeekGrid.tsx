import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CalendarCog, MoveRight, X } from 'lucide-react'
import type { WeekCourse, WeekSchedule } from '../../lib/timetable'
import { slotKey } from '../../lib/timetable'
import {
  moveCoursePermanent,
  moveCourseWeekly,
  overwritePermanent,
  overwriteWeekly,
  swapCoursesPermanent,
  swapCoursesWeekly,
} from '../../services/timetable'
import { useToast } from '../../contexts/ToastContext'
import { Button, Select } from '../ui'
import { CourseCard, CourseDragPreview } from './CourseCard'
import { MoveScopePopover, type MoveTarget } from './MoveScopePopover'
import { CourseEditor, type CourseEditorTarget } from './CourseEditor'

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
const DAY_SHORT = ['', '一', '二', '三', '四', '五', '六', '日']

/** 调课动作（仅本周 / 长期 / 交换 / 覆盖），统一带撤销 Toast；课表网格与移动端列表共用 */
export function useCourseMoveActions(weekStart: string) {
  const { showToast } = useToast()

  return useMemo(
    () => ({
      async move(course: WeekCourse, day: number, period: number, scope: 'week' | 'future') {
        if (scope === 'week') {
          const rollback = await moveCourseWeekly(course.templateId, weekStart, day, period)
          showToast('课程已调整（仅本周）', { undo: rollback })
        } else {
          const rollback = await moveCoursePermanent(course.templateId, day, period)
          showToast('课程已长期调整，后续周次同步更新', { undo: rollback })
        }
      },
      async swap(course: WeekCourse, other: WeekCourse, scope: 'week' | 'future') {
        if (scope === 'week') {
          const rollback = await swapCoursesWeekly(course.templateId, other.templateId, weekStart)
          showToast('两节课程已交换（仅本周）', { undo: rollback })
        } else {
          const rollback = await swapCoursesPermanent(course.templateId, other.templateId)
          showToast('两节课程已长期交换', { undo: rollback })
        }
      },
      async overwrite(course: WeekCourse, other: WeekCourse, day: number, period: number, scope: 'week' | 'future') {
        if (scope === 'week') {
          const rollback = await overwriteWeekly(course.templateId, other.templateId, weekStart, day, period)
          showToast('已覆盖目标课程（仅本周）', { undo: rollback })
        } else {
          const rollback = await overwritePermanent(course.templateId, other.templateId, day, period)
          showToast('已长期覆盖目标课程', { undo: rollback })
        }
      },
    }),
    [showToast, weekStart],
  )
}

interface WeekGridProps {
  weekStart: string
  weekNo: number
  schedule: WeekSchedule
  days: number[]
  periodCount: number
  /** 用于标记今天所在列，如 '2026-08-31' */
  todayISODate: string
  /** 下一节将要开始的课程位置（F23） */
  nextSlot?: { day: number; period: number } | null
  /** 编辑模式开关（F27）：关闭后禁止拖动 */
  interactive?: boolean
}

/** 周课表网格：首页与「我的课表」共用（UI 规范 18.2），支持拖动 / 键盘移动 / 点击编辑 */
export function WeekGrid({
  weekStart,
  weekNo,
  schedule,
  days,
  periodCount,
  todayISODate,
  nextSlot,
  interactive = true,
}: WeekGridProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const cellRefs = useRef(new Map<string, HTMLDivElement>())
  const [pending, setPending] = useState<{ course: WeekCourse; target: MoveTarget } | null>(null)
  const [moving, setMoving] = useState<WeekCourse | null>(null)
  const [draggingCourse, setDraggingCourse] = useState<WeekCourse | null>(null)
  const [editorTarget, setEditorTarget] = useState<CourseEditorTarget | null>(null)
  const actions = useCourseMoveActions(weekStart)

  const getCellElement = useCallback((cellKey: string) => cellRefs.current.get(cellKey) ?? null, [])

  const dayDates = useMemo(() => {
    const map = new Map<number, string>()
    const [y, m, d] = weekStart.split('-').map(Number)
    for (const day of days) {
      const date = new Date(y, m - 1, d + day - 1)
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      map.set(day, iso)
    }
    return map
  }, [weekStart, days])

  const coursesAt = useCallback(
    (day: number, period: number, excludeId?: number): WeekCourse[] =>
      (schedule.slots.get(slotKey(day, period)) ?? []).filter((c) => c.templateId !== excludeId),
    [schedule],
  )

  const beginMove = useCallback(
    (course: WeekCourse, day: number, period: number) => {
      const head = coursesAt(day, period, course.templateId)[0]
      setPending({
        course,
        target: {
          day,
          period,
          cellKey: slotKey(day, period),
          occupied: head ? { templateId: head.templateId, subject: head.subject, className: head.className } : null,
        },
      })
      setMoving(null)
    },
    [coursesAt],
  )

  const handleCellActivate = (day: number, period: number) => {
    if (moving) {
      beginMove(moving, day, period)
      return
    }
    const existing = coursesAt(day, period)[0]
    setEditorTarget({ templateId: existing ? existing.templateId : null, day, period })
  }

  const handleCourseOpen = (course: WeekCourse) => {
    if (moving) {
      beginMove(moving, course.day, course.period)
      return
    }
    setEditorTarget({ templateId: course.templateId, day: course.day, period: course.period })
  }

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingCourse((event.active.data.current?.course as WeekCourse | undefined) ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingCourse(null)
    const course = event.active.data.current?.course as WeekCourse | undefined
    if (!course || !event.over) return
    const overId = String(event.over.id)
    if (!overId.startsWith('cell-')) return
    const [day, period] = overId.slice(5).split('-').map(Number)
    if (day === course.day && period === course.period) return
    beginMove(course, day, period)
  }

  const closePending = () => setPending(null)

  const handleMove = (scope: 'week' | 'future') => {
    if (!pending) return
    void actions.move(pending.course, pending.target.day, pending.target.period, scope)
    closePending()
  }

  const handleSwap = (scope: 'week' | 'future') => {
    if (!pending?.target.occupied) return
    const other = coursesAt(pending.target.day, pending.target.period, pending.course.templateId).find(
      (c) => c.templateId === pending.target.occupied?.templateId,
    )
    if (other) void actions.swap(pending.course, other, scope)
    closePending()
  }

  const handleOverwrite = (scope: 'week' | 'future') => {
    if (!pending?.target.occupied) return
    const other = coursesAt(pending.target.day, pending.target.period, pending.course.templateId).find(
      (c) => c.templateId === pending.target.occupied?.templateId,
    )
    if (other) {
      void actions.overwrite(pending.course, other, pending.target.day, pending.target.period, scope)
    }
    closePending()
  }

  return (
    <div className="relative">
      {moving && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-menu border border-brand-600/30 bg-brand-50 px-3 py-2 text-xs text-brand-600">
          <span className="flex items-center gap-1.5 font-semibold">
            <MoveRight size={14} aria-hidden />
            正在移动「{moving.subject}」：点击目标格放置课程
          </span>
          <button type="button" onClick={() => setMoving(null)} aria-label="取消移动" className="grid h-6 w-6 place-items-center rounded-full hover:bg-white">
            <X size={14} />
          </button>
        </div>
      )}

      <DndContext
        sensors={interactive ? sensors : []}
        onDragStart={handleDragStart}
        onDragCancel={() => setDraggingCourse(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="relative overflow-x-auto">
          <div className="min-w-[560px]">
            {/* 表头 */}
            <div
              className="grid border-b border-line"
              style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}
            >
              <div className="grid h-11 place-items-center text-[11px] font-semibold text-ink-500">节次</div>
              {days.map((day) => {
                const iso = dayDates.get(day)
                const isToday = iso === todayISODate
                return (
                  <div
                    key={day}
                    role="columnheader"
                    className={`grid h-11 place-items-center gap-0 text-[11px] font-semibold ${
                      isToday ? 'border-t-2 border-brand-600 text-brand-600' : 'text-ink-500'
                    }`}
                  >
                    {DAY_NAMES[day]}
                    {iso && <span className="ml-1 tabular-nums">{Number(iso.slice(8))}</span>}
                  </div>
                )
              })}
            </div>

            {/* 课程格 */}
            {Array.from({ length: periodCount }, (_, index) => index + 1).map((period) => (
              <div
                key={period}
                className="grid border-b border-line last:border-b-0"
                style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}
              >
                <div className="grid min-h-[76px] place-items-center border-r border-line text-[11px] tabular-nums text-ink-500">
                  {String(period).padStart(2, '0')}
                </div>
                {days.map((day) => {
                  const courses = schedule.slots.get(slotKey(day, period)) ?? []
                  const vacant = schedule.vacant.get(slotKey(day, period))
                  return (
                    <GridCell
                      key={day}
                      cellKey={slotKey(day, period)}
                      registerRef={(el) => {
                        if (el) cellRefs.current.set(slotKey(day, period), el)
                        else cellRefs.current.delete(slotKey(day, period))
                      }}
                      onActivate={() => handleCellActivate(day, period)}
                      occupied={courses.length > 0}
                      keyboardTarget={Boolean(moving)}
                    >
                      {courses.map((course) => (
                        <CourseCard
                          key={course.templateId}
                          course={course}
                          onOpen={handleCourseOpen}
                          onMoveRequest={(c) => {
                            setMoving(c)
                          }}
                        />
                      ))}
                      {vacant && courses.length === 0 && (
                        <div className="flex h-full min-h-[64px] items-center justify-center rounded-menu border border-dashed border-line-strong/50 px-1 text-center text-[10px] leading-4 text-ink-500">
                          {vacant.label}
                        </div>
                      )}
                    </GridCell>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        {typeof document !== 'undefined'
          ? createPortal(
              <DragOverlay dropAnimation={null}>
                {draggingCourse ? <CourseDragPreview course={draggingCourse} /> : null}
              </DragOverlay>,
              document.body,
            )
          : null}
      </DndContext>

      {pending && (
        <MoveScopePopover
          source={{
            subject: pending.course.subject,
            className: pending.course.className,
            day: pending.course.day,
            period: pending.course.period,
          }}
          target={pending.target}
          getCellElement={getCellElement}
          onCancel={closePending}
          onMove={handleMove}
          onSwap={handleSwap}
          onOverwrite={handleOverwrite}
        />
      )}

      <CourseEditor target={editorTarget} onClose={() => setEditorTarget(null)} />
      <span className="sr-only">当前为第 {weekNo} 教学周</span>
    </div>
  )
}

function GridCell({
  cellKey,
  registerRef,
  onActivate,
  occupied,
  keyboardTarget,
  children,
}: {
  cellKey: string
  registerRef: (el: HTMLDivElement | null) => void
  onActivate: () => void
  occupied: boolean
  keyboardTarget: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${cellKey}` })
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  const focusable = keyboardTarget || !occupied

  return (
    <div
      ref={(el) => {
        setNodeRef(el)
        registerRef(el)
      }}
      data-cell={cellKey}
      role={focusable ? 'button' : undefined}
      tabIndex={focusable ? 0 : undefined}
      aria-label={keyboardTarget ? '移动到此格' : occupied ? undefined : '添加课程'}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (!focusable) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onActivate()
        }
      }}
      className={`relative min-h-[76px] cursor-pointer border-r border-line p-1.5 transition-colors duration-100 last:border-r-0 ${
        hasChildren ? '' : 'hover:bg-[#FAFBFE]'
      } ${
        isOver
          ? occupied
            ? 'bg-danger-50 shadow-[inset_0_0_0_2px_#B42318]'
            : 'bg-brand-50 shadow-[inset_0_0_0_2px_#002FA7]'
          : ''
      }`}
    >
      {children}
      {!hasChildren && !occupied && (
        <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[10px] font-semibold text-brand-600 md:flex">
          {isOver ? '移动到这里' : '添加课程'}
        </span>
      )}
      {isOver && occupied && (
        <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[10px] font-semibold text-danger-600">
          已有课程
        </span>
      )}
    </div>
  )
}

/** 移动端：当天课程列表 + 长按/按钮选择目标位置调课（F20，UI 规范 14：<768px 不缩放周表） */
export function MobileCourseList({
  schedule,
  day,
  periodCount,
  weekStart,
}: {
  schedule: WeekSchedule
  day: number
  periodCount: number
  weekStart: string
}) {
  const actions = useCourseMoveActions(weekStart)
  const [pickerCourse, setPickerCourse] = useState<WeekCourse | null>(null)
  const [targetDay, setTargetDay] = useState(day)
  const [targetPeriod, setTargetPeriod] = useState(1)
  const [pending, setPending] = useState<{ course: WeekCourse; target: MoveTarget } | null>(null)

  const courses = Array.from({ length: periodCount }, (_, i) => i + 1).flatMap((period) =>
    (schedule.slots.get(slotKey(day, period)) ?? []).map((course) => ({ course, period })),
  )

  const openPicker = (course: WeekCourse) => {
    setPickerCourse(course)
    setTargetDay(day)
    setTargetPeriod(course.period === periodCount ? 1 : course.period + 1)
  }

  const confirmTarget = () => {
    if (!pickerCourse) return
    const occupied = (schedule.slots.get(slotKey(targetDay, targetPeriod)) ?? []).filter(
      (c) => c.templateId !== pickerCourse.templateId,
    )
    const head = occupied[0]
    setPending({
      course: pickerCourse,
      target: {
        day: targetDay,
        period: targetPeriod,
        cellKey: '',
        occupied: head ? { templateId: head.templateId, subject: head.subject, className: head.className } : null,
      },
    })
    setPickerCourse(null)
  }

  return (
    <div className="md:hidden">
      {courses.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-500">今天没有课程安排</p>
      ) : (
        <ul className="grid gap-2">
          {courses.map(({ course, period }) => (
            <li
              key={course.templateId}
              className={`flex items-center gap-3 rounded-menu border border-line bg-white px-3 py-2 ${
                course.isCurrent ? 'ring-2 ring-brand-600' : ''
              }`}
            >
              <span className="w-7 text-center text-xs tabular-nums text-ink-500">{String(period).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink-900">
                  {course.subject}
                  {course.tags.map((tag) => (
                    <span key={tag} className="ml-1.5 align-middle text-[9px] font-bold text-brand-600">
                      {tag}
                    </span>
                  ))}
                </span>
                <span className="block text-[11px] text-ink-500">
                  {course.className}
                  {course.room ? ` · ${course.room}` : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => openPicker(course)}
                className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-line px-3 text-xs font-semibold text-brand-600"
              >
                <CalendarCog size={14} aria-hidden />
                调课
              </button>
            </li>
          ))}
        </ul>
      )}

      {pickerCourse && (
        <div className="mt-2 rounded-card border border-brand-600/30 bg-brand-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold text-brand-600">
              移动「{pickerCourse.subject}」：选择目标位置
            </p>
            <button type="button" aria-label="取消" onClick={() => setPickerCourse(null)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-white">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select aria-label="目标星期" value={String(targetDay)} onChange={(event) => setTargetDay(Number(event.target.value))}>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  周{DAY_SHORT[d]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="目标节次"
              value={String(targetPeriod)}
              onChange={(event) => setTargetPeriod(Number(event.target.value))}
            >
              {Array.from({ length: periodCount }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>
                  第 {p} 节
                </option>
              ))}
            </Select>
          </div>
          <Button variant="primary" className="mt-2 w-full" onClick={confirmTarget}>
            下一步
          </Button>
        </div>
      )}

      {pending && (
        <MoveScopePopover
          source={{
            subject: pending.course.subject,
            className: pending.course.className,
            day: pending.course.day,
            period: pending.course.period,
          }}
          target={pending.target}
          getCellElement={() => null}
          onCancel={() => setPending(null)}
          onMove={(scope) => {
            void actions.move(pending.course, pending.target.day, pending.target.period, scope)
            setPending(null)
          }}
          onSwap={(scope) => {
            const other = (schedule.slots.get(slotKey(pending.target.day, pending.target.period)) ?? []).find(
              (c) => c.templateId === pending.target.occupied?.templateId,
            )
            if (other) void actions.swap(pending.course, other, scope)
            setPending(null)
          }}
          onOverwrite={(scope) => {
            const other = (schedule.slots.get(slotKey(pending.target.day, pending.target.period)) ?? []).find(
              (c) => c.templateId === pending.target.occupied?.templateId,
            )
            if (other) {
              void actions.overwrite(pending.course, other, pending.target.day, pending.target.period, scope)
            }
            setPending(null)
          }}
        />
      )}
    </div>
  )
}
