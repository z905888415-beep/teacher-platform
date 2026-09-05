import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowISO, type Todo, type TodoCategory, type TodoPriority } from '../../db'
import { todayISO } from '../../lib/dates'
import { Button, Drawer, Field, Input, Select, Textarea } from '../ui'
import { useToast } from '../../contexts/ToastContext'

const CATEGORIES: TodoCategory[] = ['教学', '班务', '家校', '个人']
const PRIORITIES: [TodoPriority, string][] = [
  ['high', '高'],
  ['normal', '普通'],
  ['low', '低'],
]

interface StudentOption {
  id: number
  name: string
}

/** 新增 / 编辑待办抽屉：首屏只显示标题、日期、分类、优先级，低频字段收进“更多信息”（UI 规范 8） */
export function TodoDrawer({ open, todo, onClose }: { open: boolean; todo: Todo | null; onClose: () => void }) {
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState(todayISO())
  const [category, setCategory] = useState<TodoCategory>('教学')
  const [priority, setPriority] = useState<TodoPriority>('normal')
  const [relatedStudentId, setRelatedStudentId] = useState('')
  const [note, setNote] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const students = useLiveQuery(
    async () => (await db.students.toArray()).map((s) => ({ id: s.id ?? 0, name: s.name })),
    [],
    [] as StudentOption[],
  )!

  useEffect(() => {
    if (!open) return
    setError(null)
    setMoreOpen(false)
    if (todo) {
      setTitle(todo.title)
      setDueAt(todo.dueAt ?? todayISO())
      setCategory(todo.category)
      setPriority(todo.priority)
      setRelatedStudentId(todo.relatedStudentId ? String(todo.relatedStudentId) : '')
      setNote(todo.note ?? '')
    } else {
      setTitle('')
      setDueAt(todayISO())
      setCategory('教学')
      setPriority('normal')
      setRelatedStudentId('')
      setNote('')
    }
  }, [open, todo])

  const handleSave = async () => {
    if (!title.trim()) {
      setError('请填写待办标题')
      return
    }
    setSaving(true)
    const stamp = nowISO()
    const payload = {
      title: title.trim(),
      dueAt: dueAt || undefined,
      category,
      priority,
      relatedStudentId: relatedStudentId ? Number(relatedStudentId) : undefined,
      note: note.trim() || undefined,
    }
    if (todo?.id != null) {
      await db.todos.update(todo.id, { ...payload, updatedAt: stamp })
      showToast('待办已更新')
    } else {
      await db.todos.add({ ...payload, createdAt: stamp, updatedAt: stamp })
      showToast('待办已新增')
    }
    setSaving(false)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={todo ? '编辑待办' : '新增待办'}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <Field label="标题" error={error ?? undefined} htmlFor="todo-title">
        <Input
          id="todo-title"
          value={title}
          autoFocus
          autoComplete="off"
          placeholder="例如：批改初二（3）班作业"
          onChange={(event) => {
            setTitle(event.target.value)
            setError(null)
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="日期" htmlFor="todo-due">
          <Input id="todo-due" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </Field>
        <Field label="分类" htmlFor="todo-category">
          <Select id="todo-category" value={category} onChange={(event) => setCategory(event.target.value as TodoCategory)}>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="优先级" htmlFor="todo-priority">
        <Select id="todo-priority" value={priority} onChange={(event) => setPriority(event.target.value as TodoPriority)}>
          {PRIORITIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      {!moreOpen ? (
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          更多信息
        </button>
      ) : (
        <>
          <Field label="关联学生（可选）" htmlFor="todo-student">
            <Select
              id="todo-student"
              value={relatedStudentId}
              onChange={(event) => setRelatedStudentId(event.target.value)}
            >
              <option value="">不关联</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="备注（可选）" htmlFor="todo-note">
            <Textarea id="todo-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </>
      )}
    </Drawer>
  )
}
