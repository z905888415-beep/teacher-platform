import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Pencil, CheckCircle2, Circle } from 'lucide-react'
import { db } from '../db'
import { Card, Button, Modal, Input, Select, Field, PageHeader, Badge, EmptyState, SearchInput } from '../components/ui'
import { cn, todayStr } from '../lib/utils'

export default function Todos() {
  const todos = useLiveQuery(() => db.table('todos').toArray(), []) ?? []
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('active')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const today = todayStr()

  const toggle = async (t: any) => {
    await db.table('todos').update(t.id, { done: !t.done })
  }

  const remove = async (id: number) => {
    await db.table('todos').delete(id)
  }

  const filtered = useMemo(() => {
    let list = todos
    if (filter === 'active') list = list.filter((t) => !t.done)
    if (filter === 'done') list = list.filter((t) => t.done)
    if (query.trim()) list = list.filter((t) => (t.title || '').toLowerCase().includes(query.trim().toLowerCase()))
    return list
  }, [todos, filter, query])

  const groups = useMemo(() => {
    const overdue = filtered.filter((t) => !t.done && t.date && t.date < today)
    const todayItems = filtered.filter((t) => !t.done && t.date === today)
    const future = filtered.filter((t) => !t.done && (!t.date || t.date > today))
    const done = filtered.filter((t) => t.done)
    const sortBy = (a: any, b: any) => {
      const pa = a.priority === '高' ? 0 : a.priority === '中' ? 1 : 2
      const pb = b.priority === '高' ? 0 : b.priority === '中' ? 1 : 2
      return pa - pb || (a.date || '9999').localeCompare(b.date || '9999')
    }
    return [
      { label: '已逾期', color: 'text-red-600', items: overdue.sort(sortBy) },
      { label: '今天', color: 'text-brand-600', items: todayItems.sort(sortBy) },
      { label: '待办', color: 'text-gray-600', items: future.sort(sortBy) },
      { label: '已完成', color: 'text-emerald-600', items: done },
    ]
  }, [filtered, today])

  const openAdd = () => { setEditing(null); setModalOpen(true) }

  return (
    <div>
      <PageHeader
        title="待办事项"
        subtitle={`共 ${todos.filter((t) => !t.done).length} 项待办`}
        actions={<Button size="sm" onClick={openAdd}><Plus size={15} />添加待办</Button>}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <SearchInput value={query} onChange={setQuery} placeholder="搜索待办…" />
        <div className="flex gap-1">
          {([['active', '未完成'], ['done', '已完成'], ['all', '全部']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn('px-3 py-1.5 text-sm rounded-lg', filter === k ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState title="暂无待办" description="点击右上角添加待办事项" /></Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => g.items.length > 0 && (
            <div key={g.label}>
              <h3 className={cn('text-xs font-semibold mb-2', g.color)}>{g.label} · {g.items.length}</h3>
              <div className="space-y-2">
                {g.items.map((t) => (
                  <Card key={t.id} className={cn('p-3 flex items-center gap-3', t.done && 'opacity-60')}>
                    <button onClick={() => toggle(t)} className="shrink-0 text-gray-300 hover:text-brand-500">
                      {t.done ? <CheckCircle2 size={22} className="text-emerald-500" /> : <Circle size={22} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm text-gray-800', t.done && 'line-through')}>{t.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t.date || '未设日期'}{t.category ? ` · ${t.category}` : ''}
                      </p>
                    </div>
                    {t.priority && <Badge color={t.priority === '高' ? 'red' : t.priority === '中' ? 'amber' : 'gray'}>{t.priority}</Badge>}
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400" onClick={() => { setEditing(t); setModalOpen(true) }}><Pencil size={15} /></button>
                    <button className="p-1.5 rounded hover:bg-red-50 text-red-400" onClick={() => remove(t.id)}><Trash2 size={15} /></button>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TodoModal open={modalOpen} initial={editing} onClose={() => setModalOpen(false)} />
    </div>
  )
}

function TodoModal({ open, initial, onClose }: { open: boolean; initial: any; onClose: () => void }) {
  const [form, setForm] = useState(() => ({
    title: initial?.title || '',
    date: initial?.date || '',
    priority: initial?.priority || '中',
    category: initial?.category || '教学',
  }))

  const save = async () => {
    if (!form.title.trim()) return
    if (initial?.id) await db.table('todos').update(initial.id, form)
    else await db.table('todos').add({ ...form, done: false })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? '编辑待办' : '添加待办'}
      footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={save}>保存</Button></>}>
      <div className="space-y-3">
        <Field label="标题" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="要做什么？" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="日期"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="优先级">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {['高', '中', '低'].map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="分类">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {['教学', '班务', '行政', '家校', '个人'].map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
