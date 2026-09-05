import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { db, type CalendarEvent, type EventType } from '../db'
import { todayISO, toISODate, WEEKDAY_SHORT } from '../lib/dates'
import { Badge, Button, EmptyState, Panel } from '../components/ui'
import { EventDrawer } from '../components/calendar/EventDrawer'
import { useToast } from '../contexts/ToastContext'

/** 月历格：最多 3 个事项，超出显示“另有 N 项”（UI 规范 9） */
function MonthGrid({
  year,
  month,
  events,
  onOpenEvent,
  onNewEvent,
}: {
  year: number
  month: number
  events: CalendarEvent[]
  onOpenEvent: (event: CalendarEvent) => void
  onNewEvent: (iso: string) => void
}) {
  const today = todayISO()
  const startWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()

  const byDay = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    const map = new Map<number, CalendarEvent[]>()
    for (const event of events) {
      if (!event.startAt.startsWith(prefix)) continue
      const day = Number(event.startAt.slice(8, 10))
      map.set(day, [...(map.get(day) ?? []), event])
    }
    return map
  }, [events, year, month])

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line text-center text-[11px] font-semibold text-ink-500">
        {WEEKDAY_SHORT.map((label, index) => (
          <div key={label} className="py-2">
            {['一', '二', '三', '四', '五', '六', '日'][index]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: startWeekday }, (_, i) => (
          <div key={`blank-${i}`} className="min-h-[96px] border-b border-r border-line bg-surface-muted/40" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const iso = toISODate(new Date(year, month - 1, day))
          const items = byDay.get(day) ?? []
          const isToday = iso === today
          return (
            <div key={iso} className="min-h-[96px] border-b border-r border-line p-1.5">
              <button
                type="button"
                onClick={() => onNewEvent(iso)}
                title="新增事项"
                className={`group flex h-6 w-6 items-center justify-center rounded-full text-[11px] tabular-nums ${
                  isToday ? 'bg-brand-600 font-bold text-white' : 'text-ink-700 hover:bg-brand-50 hover:text-brand-600'
                }`}
              >
                {day}
                <Plus size={10} className="absolute hidden text-brand-600 group-hover:block" aria-hidden />
              </button>
              <div className="mt-1 grid gap-0.5">
                {items.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onOpenEvent(event)}
                    className="truncate rounded-menu px-1.5 py-0.5 text-left text-[11px] text-brand-600 hover:bg-brand-50"
                    title={`${event.title}（${event.type}）`}
                  >
                    {event.title}
                  </button>
                ))}
                {items.length > 3 && (
                  <span className="px-1.5 text-[10px] text-ink-500">另有 {items.length - 3} 项</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Calendar() {
  const { showToast } = useToast()
  const now = new Date()
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [defaultDate, setDefaultDate] = useState<string | undefined>()

  const events = useLiveQuery(() => db.calendarEvents.orderBy('startAt').toArray(), [], [])!

  const shift = (delta: number) => {
    const date = new Date(view.year, view.month - 1 + delta, 1)
    setView({ year: date.getFullYear(), month: date.getMonth() + 1 })
  }

  const removeEvent = async (event: CalendarEvent) => {
    if (event.id == null) return
    await db.calendarEvents.delete(event.id)
    showToast('校历事项已删除')
  }

  const monthPrefix = `${view.year}-${String(view.month).padStart(2, '0')}`
  const monthEvents = events.filter((event) => event.startAt.startsWith(monthPrefix))

  return (
    <div className="grid grid-cols-1 gap-3.5 min-[1024px]:grid-cols-12">
      <div className="min-[1024px]:col-span-8">
        <Panel
          title={`${view.year} 年 ${view.month} 月`}
          actions={
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="上一月"
                onClick={() => shift(-1)}
                className="grid h-8 w-8 place-items-center rounded-full text-ink-500 hover:bg-surface-muted"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setView({ year: now.getFullYear(), month: now.getMonth() + 1 })}
                className="rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-brand-600 hover:bg-brand-50"
              >
                今天
              </button>
              <button
                type="button"
                aria-label="下一月"
                onClick={() => shift(1)}
                className="grid h-8 w-8 place-items-center rounded-full text-ink-500 hover:bg-surface-muted"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          }
          bodyClassName="p-0"
        >
          <MonthGrid
            year={view.year}
            month={view.month}
            events={events}
            onOpenEvent={(event) => {
              setEditing(event)
              setDrawerOpen(true)
            }}
            onNewEvent={(iso) => {
              setEditing(null)
              setDefaultDate(iso)
              setDrawerOpen(true)
            }}
          />
        </Panel>
      </div>

      <div className="min-[1024px]:col-span-4">
        <Panel
          title="本月事项"
          actions={
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null)
                setDefaultDate(todayISO())
                setDrawerOpen(true)
              }}
            >
              <Plus size={14} /> 新增事项
            </Button>
          }
          bodyClassName="px-4 pb-4"
        >
          {monthEvents.length === 0 ? (
            <EmptyState title="本月暂无事项" hint="点击左侧日历的任意日期即可新增。" />
          ) : (
            <ul>
              {monthEvents.map((event) => (
                <li key={event.id} className="border-t border-line py-2.5 first:border-t-0">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(event)
                        setDrawerOpen(true)
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-semibold text-ink-900">{event.title}</span>
                      <span className="mt-0.5 block text-[11px] text-ink-500">
                        {event.startAt}
                        {event.endAt && event.endAt !== event.startAt ? ` 至 ${event.endAt}` : ''} · {event.type}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`删除：${event.title}`}
                      onClick={() => removeEvent(event)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-menu text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                    >
                      ×
                    </button>
                  </div>
                  {event.note && <p className="mt-1 text-[11px] leading-4 text-ink-500">{event.note}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex flex-wrap gap-1.5">
            {(['考试', '放假', '活动', '会议'] as EventType[]).map((type) => (
              <Badge key={type}>{type}</Badge>
            ))}
          </p>
        </Panel>
      </div>

      <EventDrawer
        open={drawerOpen}
        event={editing}
        defaultDate={defaultDate}
        onClose={() => {
          setDrawerOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}
