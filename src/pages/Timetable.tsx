import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { db } from '../db'
import { Card, Button, Modal, Input, Select, Field, PageHeader } from '../components/ui'
import { isEvenWeek, mondayOf, fmtDate } from '../lib/utils'
import { SUBJECTS, WEEKDAYS } from '../lib/types'
import type { Course } from '../lib/types'

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]
const DAYS = [1, 2, 3, 4, 5, 6, 7]

const SUBJECT_COLORS: Record<string, string> = {
  语文: '#f59e0b', 数学: '#2563eb', 英语: '#16a34a', 物理: '#8b5cf6', 化学: '#06b6d4',
  生物: '#10b981', 政治: '#ef4444', 历史: '#f97316', 地理: '#14b8a6', 体育: '#64748b',
  班会: '#ec4899', 信息技术: '#3b82f6', 美术: '#a855f7', 音乐: '#f472b6',
}

function subjectColor(subject: string): string {
  if (SUBJECT_COLORS[subject]) return SUBJECT_COLORS[subject]
  let h = 0
  for (const ch of subject) h = (h * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${h}, 65%, 45%)`
}

export default function Timetable() {
  const courses = useLiveQuery(() => db.table('courses').toArray(), []) ?? ([] as Course[])
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekFilter, setWeekFilter] = useState<'auto' | 'all' | 'odd' | 'even'>('auto')
  const [editing, setEditing] = useState<Course | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<Course | null>(null)

  const monday = mondayOf()
  monday.setDate(monday.getDate() + weekOffset * 7)
  const even = isEvenWeek(weekOffset)

  const weekLabel = () => {
    const d = new Date(monday)
    return `${fmtDate(d)} 起${weekFilter === 'all' ? '' : weekFilter === 'odd' ? '（只看单周）' : weekFilter === 'even' ? '（只看双周）' : even ? '（双周）' : '（单周）'}`
  }

  const visibleCourses = useMemo(() => {
    return courses.filter((c) => {
      if (weekFilter === 'all') return true
      if (weekFilter === 'odd') return c.weekType === 'all' || c.weekType === 'odd'
      if (weekFilter === 'even') return c.weekType === 'all' || c.weekType === 'even'
      return c.weekType === 'all' || (c.weekType === 'even' ? even : !even)
    })
  }, [courses, weekFilter, even])

  const cell = (day: number, period: number): Course[] =>
    visibleCourses.filter((c) => c.dayOfWeek === day && c.period === period)

  const openAdd = (day: number, period: number) => {
    setEditing({ dayOfWeek: day, period, subject: '', weekType: 'all' })
    setModalOpen(true)
  }

  const save = async (data: Course) => {
    if (data.id) await db.table('courses').update(data.id, data)
    else await db.table('courses').add(data)
    setModalOpen(false)
    setEditing(null)
  }

  const remove = async () => {
    if (deleting?.id) await db.table('courses').delete(deleting.id)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="我的课表"
        subtitle={weekLabel()}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(weekOffset - 1)}><ChevronLeft size={15} /></Button>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}><RotateCcw size={14} />本周</Button>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(weekOffset + 1)}><ChevronRight size={15} /></Button>
            </div>
            <Select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value as any)} className="w-auto">
              <option value="auto">跟随周次</option>
              <option value="all">全部</option>
              <option value="odd">只看单周</option>
              <option value="even">只看双周</option>
            </Select>
          </div>
        }
      />

      <Card className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th className="p-2 text-xs text-gray-400 font-medium w-12">节次</th>
              {DAYS.map((d) => (
                <th key={d} className={`p-2 text-xs font-medium ${d >= 6 ? 'text-gray-400' : 'text-gray-600'}`}>{WEEKDAYS[d - 1]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p}>
                <td className="p-1.5 text-center text-xs text-gray-400 border-t border-gray-100 align-top">
                  <div className="mt-1">{p}</div>
                </td>
                {DAYS.map((d) => {
                  const list = cell(d, p)
                  return (
                    <td key={d} className="p-1 border-t border-l border-gray-100 align-top" style={{ height: 72 }}>
                      <div className="flex flex-col gap-1">
                        {list.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { setEditing(c); setModalOpen(true) }}
                            className="text-left p-1.5 rounded-md text-xs leading-tight transition-transform hover:scale-[1.02]"
                            style={{ backgroundColor: subjectColor(c.subject) + '1a', color: subjectColor(c.subject) }}
                          >
                            <span className="font-medium">{c.subject}</span>
                            {c.weekType !== 'all' && <span className="ml-1 text-[10px] opacity-70">{c.weekType === 'odd' ? '单' : '双'}</span>}
                            {c.note && <span className="block text-[10px] opacity-70">📌{c.note}</span>}
                          </button>
                        ))}
                        <button
                          onClick={() => openAdd(d, p)}
                          className="p-1.5 rounded-md text-xs text-gray-300 hover:text-brand-500 hover:bg-brand-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ opacity: list.length ? undefined : 0 }}
                        >
                          <Plus size={12} className="hidden sm:block" />
                        </button>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-3 text-xs text-gray-400">💡 点击课程可编辑；点击空白格（桌面端）可添加课程。支持单双周与调课备注。</p>

      <CourseModal
        key={editing ? `${editing.dayOfWeek}-${editing.period}-${editing.id ?? 'new'}` : 'closed'}
        open={modalOpen}
        initial={editing}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSave={save}
        onDelete={editing?.id ? () => setDeleting(editing) : undefined}
      />

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="删除课程" size="sm"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>取消</Button><Button variant="danger" onClick={remove}>删除</Button></>}>
        <p className="text-sm text-gray-600">确定删除 {deleting?.subject}（第{deleting?.period}节）？</p>
      </Modal>
    </div>
  )
}

function CourseModal({ open, initial, onClose, onSave, onDelete }: {
  open: boolean
  initial: Course | null
  onClose: () => void
  onSave: (c: Course) => void
  onDelete?: () => void
}) {
  const [data, setData] = useState<Course>(() => ({
    dayOfWeek: initial?.dayOfWeek || 1,
    period: initial?.period || 1,
    subject: initial?.subject || '',
    teacher: initial?.teacher || '',
    weekType: initial?.weekType || 'all',
    note: initial?.note || '',
    id: initial?.id,
  }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${initial?.id ? '编辑' : '添加'}课程 · ${WEEKDAYS[data.dayOfWeek - 1]} 第${data.period}节`}
      footer={
        <>
          {onDelete && <Button variant="danger" className="mr-auto" onClick={onDelete}><Trash2 size={15} />删除</Button>}
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => onSave(data)}>保存</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="科目" required>
          <Input list="subject-list" value={data.subject} onChange={(e) => setData({ ...data, subject: e.target.value })} placeholder="如：数学" />
          <datalist id="subject-list">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="星期">
            <Select value={data.dayOfWeek} onChange={(e) => setData({ ...data, dayOfWeek: Number(e.target.value) })}>
              {DAYS.map((d) => <option key={d} value={d}>{WEEKDAYS[d - 1]}</option>)}
            </Select>
          </Field>
          <Field label="节次">
            <Select value={data.period} onChange={(e) => setData({ ...data, period: Number(e.target.value) })}>
              {PERIODS.map((p) => <option key={p} value={p}>第{p}节</option>)}
            </Select>
          </Field>
          <Field label="单双周">
            <Select value={data.weekType} onChange={(e) => setData({ ...data, weekType: e.target.value as any })}>
              <option value="all">每周</option>
              <option value="odd">单周</option>
              <option value="even">双周</option>
            </Select>
          </Field>
          <Field label="任课教师">
            <Input value={data.teacher || ''} onChange={(e) => setData({ ...data, teacher: e.target.value })} />
          </Field>
        </div>
        <Field label="调课备注">
          <Input value={data.note || ''} onChange={(e) => setData({ ...data, note: e.target.value })} placeholder="如：与周三第3节对调" />
        </Field>
      </div>
    </Modal>
  )
}
