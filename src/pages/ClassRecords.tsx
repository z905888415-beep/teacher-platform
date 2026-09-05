import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { db, nowISO, type ClassRecord, type ClassRecordType } from '../db'
import { todayISO } from '../lib/dates'
import { Badge, Button, Drawer, EmptyState, Field, Input, Panel, Select, Textarea } from '../components/ui'
import { useToast } from '../contexts/ToastContext'
import { useClassManager } from '../contexts/ClassContext'

const RECORD_TYPES: ClassRecordType[] = ['班会', '班级事件', '表扬', '纪律', '卫生', '活动']

function RecordDrawer({
  open,
  onClose,
  students,
  classId,
}: {
  open: boolean
  onClose: () => void
  students: { id: number; name: string }[]
  classId: number
}) {
  const { showToast } = useToast()
  const [date, setDate] = useState(todayISO())
  const [type, setType] = useState<ClassRecordType>('班会')
  const [content, setContent] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDate(todayISO())
    setType('班会')
    setContent('')
    setSelectedStudents([])
    setError(null)
  }, [open])

  const handleSave = async () => {
    if (!content.trim()) {
      setError('请填写记录内容')
      return
    }
    setSaving(true)
    await db.classRecords.add({
      classId,
      date,
      type,
      content: content.trim(),
      studentIds: JSON.stringify(selectedStudents),
      createdAt: nowISO(),
    })
    showToast('班级记录已保存')
    setSaving(false)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="新增班级记录"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="日期" htmlFor="record-date">
          <Input id="record-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="类型" htmlFor="record-type">
          <Select id="record-type" value={type} onChange={(event) => setType(event.target.value as ClassRecordType)}>
            {RECORD_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="内容" error={error ?? undefined} htmlFor="record-content">
        <Textarea
          id="record-content"
          value={content}
          placeholder="记录这次班会 / 事件 / 表扬的经过"
          onChange={(event) => {
            setContent(event.target.value)
            setError(null)
          }}
        />
      </Field>
      {students.length > 0 && (
        <Field label="相关学生（可选）" htmlFor="record-students">
          <div id="record-students" className="flex flex-wrap gap-2">
            {students.map((student) => {
              const checked = selectedStudents.includes(student.id)
              return (
                <label
                  key={student.id}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold ${
                    checked ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line text-ink-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(event) =>
                      setSelectedStudents((prev) =>
                        event.target.checked ? [...prev, student.id] : prev.filter((id) => id !== student.id),
                      )
                    }
                  />
                  {student.name}
                </label>
              )
            })}
          </div>
        </Field>
      )}
    </Drawer>
  )
}

export function ClassRecords() {
  const { currentClass } = useClassManager()
  const { showToast } = useToast()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filter, setFilter] = useState<'全部' | ClassRecordType>('全部')

  const classId = currentClass?.id
  const records = useLiveQuery(
    async () => (classId == null ? [] : db.classRecords.where('classId').equals(classId).toArray()),
    [classId],
    [] as ClassRecord[],
  )!
  const students = useLiveQuery(
    async () => (classId == null ? [] : db.students.where('classId').equals(classId).toArray()),
    [classId],
    [] as { id: number; name: string }[],
  )!

  const studentName = (id: number) => students.find((s) => s.id === id)?.name

  const filtered = (filter === '全部' ? records : records.filter((record) => record.type === filter)).sort((a, b) =>
    b.date.localeCompare(a.date),
  )

  const byMonth = new Map<string, ClassRecord[]>()
  for (const record of filtered) {
    const month = record.date.slice(0, 7)
    byMonth.set(month, [...(byMonth.get(month) ?? []), record])
  }

  return (
    <Panel
      title={`班级记录 · ${currentClass?.name ?? ''}`}
      subtitle="按月分组的时间线，不含积分、排行榜或红黑榜"
      actions={
        <Button variant="primary" onClick={() => setDrawerOpen(true)}>
          <Plus size={14} /> 新增记录
        </Button>
      }
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
        {(['全部', ...RECORD_TYPES] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              filter === item ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line text-ink-500 hover:border-line-strong'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="p-5">
          <EmptyState title="暂无班级记录" hint="班会、班级事件、表扬、纪律、卫生、活动都可以记在这里。" />
        </div>
      ) : (
        <div className="px-4 py-3">
          {[...byMonth.entries()].map(([month, items]) => (
            <section key={month} className="mb-5 last:mb-0">
              <h3 className="mb-2 text-xs font-bold text-ink-900">{month.replace('-', ' 年 ')} 月</h3>
              <ol>
                {items.map((record) => {
                  const relatedIds = JSON.parse(record.studentIds || '[]') as number[]
                  return (
                    <li key={record.id} className="relative border-l-2 border-line pb-4 pl-4 last:pb-0">
                      <span aria-hidden className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-brand-600" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] tabular-nums text-ink-500">{record.date.slice(5)}</span>
                        <Badge variant={record.type === '表扬' ? 'success' : record.type === '纪律' ? 'danger' : 'blue'}>
                          {record.type}
                        </Badge>
                        <button
                          type="button"
                          aria-label="删除记录"
                          onClick={async () => {
                            if (record.id == null) return
                            await db.classRecords.delete(record.id)
                            showToast('班级记录已删除')
                          }}
                          className="ml-auto grid h-8 w-8 place-items-center rounded-menu text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="mt-1 text-sm leading-5 text-ink-700">{record.content}</p>
                      {relatedIds.length > 0 && (
                        <p className="mt-1 text-[11px] text-brand-600">
                          相关学生：{relatedIds.map((id) => studentName(id) ?? '已删除').join('、')}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      <RecordDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        students={students.map((s) => ({ id: s.id ?? 0, name: s.name }))}
        classId={classId ?? 0}
      />
    </Panel>
  )
}
