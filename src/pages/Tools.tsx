import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, Trash2, ExternalLink, Wrench } from 'lucide-react'
import { db } from '../db'
import { Card, Button, Modal, Input, Field, PageHeader, EmptyState, ConfirmDialog } from '../components/ui'

export default function ToolsPage({ tableName, title, subtitle }: { tableName: string; title: string; subtitle?: string }) {
  const tools = useLiveQuery(() => db.table(tableName).toArray(), [tableName]) ?? []
  const [editing, setEditing] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<any | null>(null)

  const categories = useMemo(() => [...new Set(tools.map((t) => t.category).filter(Boolean))] as string[], [tools])

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={<Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}><Plus size={15} />添加</Button>}
      />

      {tools.length === 0 ? (
        <Card><EmptyState icon={<Wrench size={40} />} title="暂无工具" description="点击右上角添加常用工具链接" /></Card>
      ) : (
        <div className="space-y-5">
          {categories.map((cat) => (
            <div key={cat}>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">{cat}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {tools.filter((t) => t.category === cat).map((t) => (
                  <div key={t.id} className="group relative">
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-800 truncate">{t.name}</p>
                        <ExternalLink size={14} className="text-gray-300 group-hover:text-brand-500" />
                      </div>
                      {t.note && <p className="mt-1 text-xs text-gray-400 truncate">{t.note}</p>}
                    </a>
                    <div className="absolute top-2 right-2 hidden group-hover:flex gap-0.5">
                      <button className="p-1 rounded bg-white shadow text-gray-500 hover:text-brand-600" onClick={() => { setEditing(t); setModalOpen(true) }}><Pencil size={13} /></button>
                      <button className="p-1 rounded bg-white shadow text-gray-500 hover:text-red-500" onClick={() => setDeleting(t)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ToolModal key={editing?.id || 'new'} open={modalOpen} initial={editing} tableName={tableName} onClose={() => setModalOpen(false)} />
      <ConfirmDialog open={!!deleting} title="删除工具" message={`确定删除「${deleting?.name}」？`} onCancel={() => setDeleting(null)} onConfirm={async () => { await db.table(tableName).delete(deleting.id); setDeleting(null) }} />
    </div>
  )
}

function ToolModal({ open, initial, tableName, onClose }: { open: boolean; initial: any; tableName: string; onClose: () => void }) {
  const [form, setForm] = useState(() => ({ name: initial?.name || '', url: initial?.url || '', category: initial?.category || '', note: initial?.note || '' }))
  const save = async () => {
    if (!form.name.trim() || !form.url.trim()) return alert('请填写名称和链接')
    if (initial?.id) await db.table(tableName).update(initial.id, form)
    else await db.table(tableName).add(form)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? '编辑工具' : '添加工具'} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={save}>保存</Button></>}>
      <div className="space-y-3">
        <Field label="名称" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：DeepSeek" /></Field>
        <Field label="链接" required><Input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></Field>
        <Field label="分类"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="如：对话 / 绘画 / 写作" list="tool-cats" /><datalist id="tool-cats">{['对话', '绘画', '写作', '办公', '文档', '文件处理', 'PDF', '图片'].map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="备注"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
