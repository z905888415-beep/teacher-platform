import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Todo } from '../../db'
import { todayISO } from '../../lib/dates'
import { groupTodos } from '../../lib/todos'
import { setTodoDone } from '../../services/todos'
import { Badge } from '../ui'
import { TodoDrawer } from './TodoDrawer'

interface TodoRowProps {
  todo: Todo
  overdue?: boolean
  onToggle: (todo: Todo, done: boolean) => void
  onEdit: (todo: Todo) => void
}

function TodoRow({ todo, overdue, onToggle, onEdit }: TodoRowProps) {
  return (
    <div
      className={`flex min-h-[48px] items-start gap-2.5 border-t border-line py-2 first:border-t-0 ${
        overdue ? 'border-l-2 border-l-danger-600 pl-2' : ''
      }`}
    >
      <input
        type="checkbox"
        aria-label={`完成待办：${todo.title}`}
        checked={Boolean(todo.doneAt)}
        onChange={(event) => onToggle(todo, event.target.checked)}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#002FA7]"
      />
      <button type="button" onClick={() => onEdit(todo)} className="min-w-0 flex-1 text-left">
        <span
          className={`line-clamp-2 block text-xs leading-[18px] ${
            todo.doneAt ? 'text-ink-500 line-through' : overdue ? 'font-semibold text-danger-600' : 'text-ink-900'
          }`}
        >
          {todo.title}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] leading-4 text-ink-500">
          <span>{todo.category}</span>
          {todo.dueAt && <span>· {todo.dueAt.slice(5).replace('-', '/')}</span>}
          {overdue && <span className="font-semibold text-danger-600">· 已逾期</span>}
        </span>
      </button>
    </div>
  )
}

/** 首页今日待办：固定显示 逾期 / 今天 / 本周 三组（UI 规范 6.4） */
export function TodoSummary() {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Todo | null>(null)

  const todos = useLiveQuery(
    async () => {
      const rows = await db.todos.toArray()
      return rows.filter((t) => !t.doneAt && !t.archivedAt)
    },
    [],
    [] as Todo[],
  )!

  const today = todayISO()
  const { overdue, today: dueToday, week: dueThisWeek } = groupTodos(todos, today)

  const handleToggle = async (todo: Todo, done: boolean) => {
    if (todo.id == null) return
    await setTodoDone(todo.id, done)
  }

  const groups: [string, Todo[], boolean][] = [
    ['逾期', overdue, true],
    ['今天', dueToday, false],
    ['本周', dueThisWeek, false],
  ]

  return (
    <>
      {groups.map(([label, items, isOverdue]) => (
        <div key={label}>
          <p className="mb-1 mt-3 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.04em] text-ink-500 first:mt-0">
            {label}
            {items.length > 0 && (
              <Badge variant={isOverdue && items.length > 0 ? 'danger' : 'default'}>{items.length}</Badge>
            )}
          </p>
          {items.length === 0 ? (
            <p className="border-t border-line py-2.5 text-[11px] text-ink-500">
              {label === '逾期' ? '没有逾期待办' : label === '今天' ? '今天暂无待办' : '本周暂无更多待办'}
            </p>
          ) : (
            items.map((todo) => (
              <TodoRow key={todo.id} todo={todo} overdue={isOverdue} onToggle={handleToggle} onEdit={(t) => { setEditing(t); setEditorOpen(true) }} />
            ))
          )}
        </div>
      ))}

      <TodoDrawer
        open={editorOpen}
        todo={editing}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
      />
    </>
  )
}
