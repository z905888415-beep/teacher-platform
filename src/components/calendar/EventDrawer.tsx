import { useEffect, useState } from 'react'
import { db, nowISO, type CalendarEvent, type EventType } from '../../db'
import { todayISO } from '../../lib/dates'
import { Button, Drawer, Field, Input, Select, Textarea } from '../ui'
import { useToast } from '../../contexts/ToastContext'

const EVENT_TYPES: EventType[] = ['考试', '放假', '活动', '会议', '其他']

/** 校历事项新增 / 编辑抽屉（开发文档 6.4） */
export function EventDrawer({
  open,
  event,
  defaultDate,
  onClose,
}: {
  open: boolean
  event: CalendarEvent | null
  defaultDate?: string
  onClose: () => void
}) {
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState(todayISO())
  const [endAt, setEndAt] = useState('')
  const [type, setType] = useState<EventType>('考试')
  const [note, setNote] = useState('')
  const [createTodo, setCreateTodo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (event) {
      setTitle(event.title)
      setStartAt(event.startAt)
      setEndAt(event.endAt ?? '')
      setType(event.type)
      setNote(event.note ?? '')
      setCreateTodo(false)
    } else {
      setTitle('')
      setStartAt(defaultDate ?? todayISO())
      setEndAt('')
      setType('考试')
      setNote('')
      setCreateTodo(false)
    }
  }, [open, event, defaultDate])

  const handleSave = async () => {
    if (!title.trim()) {
      setError('请填写事项名称')
      return
    }
    setSaving(true)
    const stamp = nowISO()
    const payload = {
      title: title.trim(),
      startAt,
      endAt: endAt || undefined,
      type,
      note: note.trim() || undefined,
    }
    if (event?.id != null) {
      await db.calendarEvents.update(event.id, { ...payload, updatedAt: stamp })
      showToast('校历事项已更新')
    } else {
      const eventId = await db.calendarEvents.add({ ...payload, createdAt: stamp, updatedAt: stamp })
      // F18：勾选后同时生成一条关联的教学待办
      if (createTodo) {
        await db.todos.add({
          title: title.trim(),
          dueAt: startAt,
          priority: 'normal',
          category: '教学',
          relatedEventId: eventId,
          note: note.trim() || undefined,
          createdAt: stamp,
          updatedAt: stamp,
        })
        showToast('校历事项已新增，并生成待办')
      } else {
        showToast('校历事项已新增')
      }
    }
    setSaving(false)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={event ? '编辑校历事项' : '新增校历事项'}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <Field label="事项名称" error={error ?? undefined} htmlFor="event-title">
        <Input
          id="event-title"
          value={title}
          autoFocus
          autoComplete="off"
          placeholder="例如：数学单元测验"
          onChange={(event) => {
            setTitle(event.target.value)
            setError(null)
          }}
        />
      </Field>
      <Field label="类型" htmlFor="event-type">
        <Select id="event-type" value={type} onChange={(event) => setType(event.target.value as EventType)}>
          {EVENT_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="开始日期" htmlFor="event-start">
          <Input id="event-start" type="date" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
        </Field>
        <Field label="结束日期（可选）" htmlFor="event-end">
          <Input id="event-end" type="date" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
        </Field>
      </div>
      <Field label="备注（可选）" htmlFor="event-note">
        <Textarea id="event-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      {!event && (
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={createTodo}
            onChange={(event) => setCreateTodo(event.target.checked)}
            className="h-4 w-4 accent-[#002FA7]"
          />
          同时创建一条待办（日期为事项开始日）
        </label>
      )}
    </Drawer>
  )
}
