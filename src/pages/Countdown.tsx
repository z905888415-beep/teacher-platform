import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Pencil, Timer } from 'lucide-react'
import { db } from '../db'
import { Card, Button, Modal, Input, Field, PageHeader, EmptyState, ConfirmDialog } from '../components/ui'
import { countdownText, todayStr } from '../lib/utils'

export default function Countdown() {
  const items = useLiveQuery(() => db.table('countdowns').toArray(), []) ?? []
  const [editing, setEditing] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<any | null>(null)

  const sorted = useMemo(() => [...items].sort((a, b) => (a.date || '').localeCompare(b.date || '')), [items])
  const next = sorted.find((c) => c.date >= todayStr())

  return (
    <div>
      <PageHeader
        title="重要事项倒计时"
        subtitle="高考、期中期末、一模二模等自动提醒"
        actions={<Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}><Plus size={15} />添加倒计时</Button>}
      />

      {next && (
        <Card className="p-6 mb-4 text-center" >
          <p className="text-xs text-gray-500">距离</p>
          <p className="text-3xl font-bold mt-1" style={{ color: next.color || '#2563eb' }}>{next.title}</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            <Timer size={16} className="text-gray-400" />
            <p className="text-gray-600">{countdownText(next.date).text}</p>
          </div>
          <p className="text-xs text-gray-400 mt-1">{next.date}</p>
        </Card>
      )}

      {items.length === 0 ? (
        <Card><EmptyState icon={<Timer size={40} />} title="暂无倒计时" description="添加高考、考试等重要时间节点" /></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sorted.map((c) => {
            const { days, text } = countdownText(c.date)
            const passed = days < 0
            return (
              <Card key={c.id} className="p-4 relative group">
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-gray-800">{c.title}</p>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                    <button className="p-1 rounded hover:bg-gray-100 text-gray-500" onClick={() => { setEditing(c); setModalOpen(true) }}><Pencil size={13} /></button>
                    <button className="p-1 rounded hover:bg-red-50 text-red-500" onClick={() => setDeleting(c)}><Trash2 size={13} /></button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">{c.date}</p>
                <p className={`mt-2 text-2xl font-bold ${passed ? 'text-gray-400' : ''}`} style={{ color: passed ? undefined : c.color || '#2563eb' }}>
                  {Math.abs(days)}<span className="text-xs font-normal text-gray-400"> 天</span>
                </p>
                <p className="text-[11px] text-gray-400">{text}</p>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing?.id ? '编辑倒计时' : '添加倒计时'} size="sm"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>取消</Button><Button onClick={async () => { if (!editing?.title || !editing?.date) return alert('请填写标题和日期'); if (editing.id) await db.table('countdowns').update(editing.id, editing); else await db.table('countdowns').add(editing); setModalOpen(false) }}>保存</Button></>}>
        <div className="space-y-3">
          <Field label="标题" required><Input value={editing?.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="如：高考" /></Field>
          <Field label="日期" required><Input type="date" value={editing?.date || ''} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></Field>
          <Field label="颜色">
            <div className="flex gap-2">
              {['#2563eb', '#ef4444', '#f59e0b', '#16a34a', '#8b5cf6'].map((c) => (
                <button key={c} onClick={() => setEditing({ ...editing, color: c })} className={`w-8 h-8 rounded-full ${editing?.color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="删除倒计时" message={`确定删除「${deleting?.title}」？`} onCancel={() => setDeleting(null)} onConfirm={async () => { await db.table('countdowns').delete(deleting.id); setDeleting(null) }} />
    </div>
  )
}
