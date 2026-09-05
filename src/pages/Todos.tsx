import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { db, nowISO, type Todo, type TodoCategory } from '../db'
import { addDays, todayISO } from '../lib/dates'
import { setTodoDone } from '../services/todos'
import { Badge, Button, EmptyState, Panel } from '../components/ui'
import { TodoDrawer } from '../components/todos/TodoDrawer'
import { useToast } from '../contexts/ToastContext'

type TabKey = 'all' | 'today' | 'week' | 'done'
const TABS: [TabKey, string][] = [
  ['all', '全部'],
  ['today', '今天'],
  ['week', '本周'],
  ['done', '已完成'],
]
const CATEGORIES: (TodoCategory | '全部')[] = ['全部', '教学', '班务', '家校', '个人']

export function Todos() {
  const { showToast } = useToast()
  const [tab, setTab] = useState<TabKey>('all')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('全部')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Todo | null>(null)
  const [selected, setSelected] = useState<number[]>([])

  const todos = useLiveQuery(() => db.todos.orderBy('dueAt').toArray(), [], [])!

  // F17：已完成超过 30 天的待办自动归档（保留数据，默认不展示）
  useEffect(() => {
    const stale = todos.filter(
      (todo) =>
        todo.doneAt &&
        !todo.archivedAt &&
        Date.now() - new Date(todo.doneAt).getTime() > 30 * 24 * 3600 * 1000,
    )
    if (stale.length === 0) return
    const stamp = nowISO()
    void db.todos.bulkUpdate(stale.map((todo) => ({ key: todo.id!, changes: { archivedAt: stamp } })))
  }, [todos])

  const today = todayISO()
  const weekEnd = addDays(today, 7)

  const filtered = useMemo(() => {
    let rows = todos.filter((t) => !t.archivedAt)
    if (category !== '全部') rows = rows.filter((t) => t.category === category)
    if (tab === 'done') rows = rows.filter((t) => t.doneAt)
    else if (tab === 'all') {
      // F29：「全部」包含未完成 + 已完成
    } else {
      rows = rows.filter((t) => !t.doneAt)
      if (tab === 'today') rows = rows.filter((t) => t.dueAt && t.dueAt <= today)
      if (tab === 'week') rows = rows.filter((t) => t.dueAt && t.dueAt <= weekEnd)
    }
    return rows
  }, [todos, tab, category, today, weekEnd])

  const toggleDone = async (todo: Todo, done: boolean) => {
    if (todo.id == null) return
    await setTodoDone(todo.id, done)
    if (done) showToast('待办已完成')
  }

  const removeTodo = async (todo: Todo) => {
    if (todo.id == null) return
    await db.todos.delete(todo.id)
    showToast('待办已删除')
  }

  const batchDone = async () => {
    for (const id of selected) {
      await setTodoDone(id, true)
    }
    showToast(`已完成 ${selected.length} 条待办`)
    setSelected([])
  }

  const batchDelete = async () => {
    await db.todos.bulkDelete(selected)
    showToast(`已删除 ${selected.length} 条待办`)
    setSelected([])
  }

  return (
    <Panel
      title="待办"
      actions={
        <Button variant="primary" onClick={() => { setEditing(null); setDrawerOpen(true) }}>
          <Plus size={14} /> 新增待办
        </Button>
      }
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex gap-1" role="tablist" aria-label="待办范围">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                tab === key ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-surface-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                category === item ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line text-ink-500 hover:border-line-strong'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-brand-50 px-4 py-2">
          <span className="text-xs font-semibold text-brand-600">已选 {selected.length} 条</span>
          <span className="flex gap-2">
            <Button onClick={batchDone}>批量完成</Button>
            <Button variant="dangerSoft" onClick={batchDelete}>
              批量删除
            </Button>
          </span>
        </div>
      )}

      <div className="px-4 py-2">
        {filtered.length === 0 ? (
          <EmptyState
            title="暂无待办"
            hint="从首页右上角或这里新增一条待办，先只写标题也可以。"
            action={
              <Button variant="primary" onClick={() => { setEditing(null); setDrawerOpen(true) }}>
                新增待办
              </Button>
            }
          />
        ) : (
          <ul>
            {filtered.map((todo) => {
              const overdue = !todo.doneAt && todo.dueAt != null && todo.dueAt < today
              return (
                <li
                  key={todo.id}
                  className={`flex min-h-[52px] items-start gap-2.5 border-t border-line py-2.5 first:border-t-0 ${
                    overdue ? 'border-l-2 border-l-danger-600 pl-2.5' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    aria-label={`选择：${todo.title}`}
                    checked={selected.includes(todo.id ?? -1)}
                    onChange={(event) =>
                      setSelected((prev) =>
                        event.target.checked ? [...prev, todo.id ?? -1] : prev.filter((id) => id !== todo.id),
                      )
                    }
                    className="mt-1 h-[18px] w-[18px] shrink-0 accent-[#002FA7]"
                  />
                  <input
                    type="checkbox"
                    aria-label={`完成待办：${todo.title}`}
                    checked={Boolean(todo.doneAt)}
                    onChange={(event) => toggleDone(todo, event.target.checked)}
                    className="mt-1 h-[18px] w-[18px] shrink-0 accent-[#002FA7]"
                  />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setEditing(todo); setDrawerOpen(true) }}>
                    <span
                      className={`block text-sm leading-5 ${
                        todo.doneAt ? 'text-ink-500 line-through' : overdue ? 'font-semibold text-danger-600' : 'text-ink-900'
                      }`}
                    >
                      {todo.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500">
                      <span>{todo.category}</span>
                      {todo.dueAt && <span>· {todo.dueAt}</span>}
                      {todo.priority === 'high' && !todo.doneAt && <Badge variant="danger">高优先</Badge>}
                      {overdue && <Badge variant="danger">逾期</Badge>}
                      {todo.note && <span>· {todo.note}</span>}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`删除：${todo.title}`}
                    onClick={() => removeTodo(todo)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-menu text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <TodoDrawer open={drawerOpen} todo={editing} onClose={() => { setDrawerOpen(false); setEditing(null) }} />
    </Panel>
  )
}
