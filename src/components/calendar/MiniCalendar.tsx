import { useMemo } from 'react'
import type { CalendarEvent } from '../../db'
import { todayISO, toISODate } from '../../lib/dates'

const WEEK_HEADERS = ['一', '二', '三', '四', '五', '六', '日']

interface MiniCalendarProps {
  events: CalendarEvent[]
  month: { year: number; month: number }
  onMonthChange: (month: { year: number; month: number }) => void
  selected: string | null
  onSelect: (iso: string) => void
}

/** 迷你校历：今天蓝色实心圆，选中非今天蓝色描边，事项用底部 3px 圆点（UI 规范 6.5） */
export function MiniCalendar({ events, month, selected, onSelect }: Omit<MiniCalendarProps, 'onMonthChange'>) {
  const today = todayISO()

  const { leadingBlanks, daysInMonth, eventDays } = useMemo(() => {
    const first = new Date(month.year, month.month - 1, 1)
    const startWeekday = (first.getDay() + 6) % 7
    const total = new Date(month.year, month.month, 0).getDate()
    const days = new Set(
      events
        .filter((event) => event.startAt.startsWith(`${month.year}-${String(month.month).padStart(2, '0')}`))
        .map((event) => Number(event.startAt.slice(8, 10))),
    )
    return { leadingBlanks: startWeekday, daysInMonth: total, eventDays: days }
  }, [events, month])

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-0.5 text-center">
        {WEEK_HEADERS.map((label) => (
          <span key={label} className="py-1 text-[10px] text-ink-500">
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const iso = toISODate(new Date(month.year, month.month - 1, day))
          const isToday = iso === today
          const isSelected = iso === selected && !isToday
          return (
            <button
              key={iso}
              type="button"
              aria-label={`${month.month} 月 ${day} 日${eventDays.has(day) ? '，有事项' : ''}`}
              onClick={() => onSelect(iso)}
              className={`relative mx-auto grid aspect-square w-full max-w-[34px] min-w-[32px] place-items-center rounded-full text-[11px] tabular-nums transition-colors ${
                isToday
                  ? 'bg-brand-600 font-bold text-white'
                  : isSelected
                    ? 'text-brand-600 shadow-[inset_0_0_0_1.5px_#002FA7]'
                    : 'text-ink-700 hover:bg-surface-muted'
              }`}
            >
              {day}
              {eventDays.has(day) && (
                <span
                  aria-hidden
                  className={`absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full ${
                    isToday ? 'bg-white' : 'bg-ink-700'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
