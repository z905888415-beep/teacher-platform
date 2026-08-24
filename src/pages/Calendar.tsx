import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { db } from '../db'
import { Card, Button, Modal, Input, Select, Field, PageHeader } from '../components/ui'
import { cn } from '../lib/utils'

const EVENT_TYPES: Record<string, { label: string; color: string }> = {
  节假日: { label: '节假日', color: 'bg-red-100 text-red-700' },
  考试: { label: '考试', color: 'bg-amber-100 text-amber-700' },
  活动: { label: '学校活动', color: 'bg-blue-100 text-blue-700' },
}

export default function Calendar() {
  const events = useLiveQuery(() => db.table('events').toArray(), []) ?? []
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState<string | null>(null) // YYYY-MM-DD
  const [modalOpen, setModalOpen] = useState(false)

  const move = (delta: number) => {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m)
    setYear(y)
  }

  const days = useMemo(() => {
    const first = new Date(year, month, 1)
    const startDow = first.getDay() === 0 ? 7 : first.getDay()
    const total = new Date(year, month + 1, 0).getDate()
    const cells: (string | null)[] = []
    for (let i = 1; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= total; d++) cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    return cells
  }, [year, month])

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {}
    events.forEach((e) => {
      if (!e.date) return
      ;(map[e.date] ||= []).push(e)
    })
    return map
  }, [events])

  const selectedEvents = selected ? eventsByDate[selected] || [] : []

  const openDay = (date: string) => { setSelected(date); setModalOpen(true) }

  return (
    <div>
      <PageHeader
        title="学期校历"
        subtitle={`${year}年${month + 1}月`}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => move(-1)}><ChevronLeft size={15} /></Button>
            <Button variant="outline" size="sm" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }}>今天</Button>
            <Button variant="outline" size="sm" onClick={() => move(1)}><ChevronRight size={15} /></Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 月历 */}
        <Card className="lg:col-span-2 p-3">
          <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
            {['一', '二', '三', '四', '五', '六', '日'].map((w, i) => <div key={i} className="py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, i) => {
              if (!date) return <div key={i} />
              const list = eventsByDate[date] || []
              const isToday = date === new Date().toISOString().slice(0, 10)
              return (
                <button
                  key={date}
                  onClick={() => openDay(date)}
                  className={cn(
                    'min-h-[64px] rounded-lg border p-1 text-left transition-colors hover:border-brand-300',
                    isToday ? 'border-brand-400 bg-brand-50' : 'border-gray-100 bg-white',
                  )}
                >
                  <span className={cn('text-xs', isToday ? 'font-bold text-brand-700' : 'text-gray-500')}>{Number(date.slice(8))}</span>
                  <div className="mt-0.5 space-y-0.5">
                    {list.slice(0, 2).map((e) => (
                      <div key={e.id} className={cn('text-[10px] px-1 py-0.5 rounded truncate', EVENT_TYPES[e.type]?.color || 'bg-gray-100 text-gray-600')}>
                        {e.title}
                      </div>
                    ))}
                    {list.length > 2 && <div className="text-[10px] text-gray-400">+{list.length - 2}</div>}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex gap-3 mt-3 text-xs text-gray-500">
            {Object.entries(EVENT_TYPES).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1"><span className={cn('w-2.5 h-2.5 rounded', v.color.split(' ')[0])} />{v.label}</span>
            ))}
          </div>
        </Card>

        {/* 日程列表 */}
        <div className="space-y-3">
          <Card className="p-4">
            <h3 className="font-semibold text-gray-800 text-sm mb-2">近期事项</h3>
            {events.length === 0 ? (
              <p className="text-sm text-gray-400">暂无校历事项，点击日历任意日期添加。</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {[...events].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((e) => (
                  <button key={e.id} onClick={() => { setSelected(e.date); setModalOpen(true) }} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-left">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded shrink-0', EVENT_TYPES[e.type]?.color || 'bg-gray-100 text-gray-600')}>{EVENT_TYPES[e.type]?.label || e.type}</span>
                    <span className="flex-1 text-sm text-gray-700 truncate">{e.title}</span>
                    <span className="text-xs text-gray-400 shrink-0">{e.date}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <EventModal
        key={selected || 'none'}
        open={modalOpen}
        date={selected}
        events={selectedEvents}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}

function EventModal({ open, date, events, onClose }: { open: boolean; date: string | null; events: any[]; onClose: () => void }) {
  const [form, setForm] = useState<{ title: string; type: string }>({ title: '', type: '节假日' })
  const [addMode, setAddMode] = useState(false)

  const save = async () => {
    if (!date || !form.title.trim()) return
    await db.table('events').add({ date, title: form.title.trim(), type: form.type })
    setForm({ title: '', type: '节假日' })
    setAddMode(false)
  }

  const remove = async (id: number) => {
    await db.table('events').delete(id)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${date || ''} 事项`}
      footer={
        <>
          <Button variant="outline" onClick={() => { setAddMode(false); onClose() }}>关闭</Button>
          {addMode && <Button onClick={save}><Plus size={15} />保存</Button>}
        </>
      }
    >
      <div className="space-y-3">
        {events.length === 0 && !addMode && <p className="text-sm text-gray-400">当天暂无事项。</p>}
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded', EVENT_TYPES[e.type]?.color || 'bg-gray-100 text-gray-600')}>{EVENT_TYPES[e.type]?.label || e.type}</span>
            <span className="flex-1 text-sm text-gray-700">{e.title}</span>
            <button className="p-1 text-red-400 hover:bg-red-50 rounded" onClick={() => remove(e.id)}><Trash2 size={14} /></button>
          </div>
        ))}
        {addMode ? (
          <div className="space-y-2">
            <Field label="标题" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="如：月考" /></Field>
            <Field label="类型">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setAddMode(true)}><Plus size={15} />添加事项</Button>
        )}
      </div>
    </Modal>
  )
}
