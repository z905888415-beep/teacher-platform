import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, Trash2, Printer, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '../db'
import { Card, Button, Modal, Input, PageHeader, EmptyState } from '../components/ui'
import { cn } from '../lib/utils'

interface DutyGroup {
  id?: number
  kind: 'group'
  name: string
  members: string[]
}

export default function Duty() {
  const students = useLiveQuery(() => db.table('students').toArray(), []) ?? []
  const groups = useLiveQuery(() => db.table('duty').toArray(), []) ?? ([] as DutyGroup[])
  const [weekOffset, setWeekOffset] = useState(0)
  const [editing, setEditing] = useState<DutyGroup | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<DutyGroup | null>(null)

  const groupList = useMemo(() => groups.filter((g) => g.kind === 'group').sort((a, b) => (a.id || 0) - (b.id || 0)), [groups])

  // 每周轮换：第 weekOffset 周，周 i 由第 (i + offset) % n 组值日
  const schedule = useMemo(() => {
    if (!groupList.length) return []
    return [1, 2, 3, 4, 5].map((wd) => {
      const idx = (((wd - 1 + weekOffset) % groupList.length) + groupList.length) % groupList.length
      return { weekday: wd, group: groupList[idx] }
    })
  }, [groupList, weekOffset])

  const print = () => {
    const w = window.open('', '_blank', 'width=800,height=600')
    if (!w) return
    const rows = schedule.map((s) => `<tr><td>${['周一', '周二', '周三', '周四', '周五'][s.weekday - 1]}</td><td>${s.group.name}</td><td>${s.group.members.join('、')}</td></tr>`).join('')
    w.document.write(`<html><head><title>值日安排表</title><meta charset="utf-8"><style>body{font-family:sans-serif;padding:24px}h1{font-size:18px;text-align:center}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #333;padding:8px;text-align:center}th{background:#f0f0f0}</style></head><body><h1>值日安排表（第 ${Math.abs(weekOffset) + 1} 周）</h1><table><thead><tr><th>星期</th><th>值日小组</th><th>成员</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`)
    w.document.close()
  }

  return (
    <div>
      <PageHeader
        title="值日安排"
        subtitle="按组生成每周值日表，支持轮换与打印"
        actions={
          <div className="flex gap-2">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(weekOffset - 1)}><ChevronLeft size={14} /></Button>
              <span className="text-sm text-gray-600 px-1">第 {Math.abs(weekOffset) + 1} 周</span>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(weekOffset + 1)}><ChevronRight size={14} /></Button>
            </div>
            <Button variant="outline" size="sm" onClick={print} disabled={!schedule.length}><Printer size={14} />打印</Button>
            <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}><Plus size={14} />新增小组</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 值日小组 */}
        <Card className="p-4">
          <h3 className="font-semibold text-gray-800 mb-3">值日小组</h3>
          {groupList.length === 0 ? (
            <EmptyState title="暂无值日小组" description="点击右上角新增小组，选择成员后自动生成值日表" />
          ) : (
            <div className="space-y-2">
              {groupList.map((g) => (
                <div key={g.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{g.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{g.members.join('、') || '暂无成员'}</p>
                  </div>
                  <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => { setEditing(g); setModalOpen(true) }}><Pencil size={14} /></button>
                  <button className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => setDeleting(g)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 本周值日表 */}
        <Card className="p-4">
          <h3 className="font-semibold text-gray-800 mb-3">本周值日表</h3>
          {schedule.length === 0 ? (
            <EmptyState title="请先创建值日小组" />
          ) : (
            <div className="space-y-2">
              {schedule.map((s) => (
                <div key={s.weekday} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                  <span className={cn('w-12 h-12 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0', s.weekday === 1 ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700')}>
                    {['周一', '周二', '周三', '周四', '周五'][s.weekday - 1]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{s.group.name}</p>
                    <p className="text-xs text-gray-500 truncate">{s.group.members.join('、')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <GroupModal
        key={editing?.id || 'new'}
        open={modalOpen}
        initial={editing}
        students={students}
        onClose={() => setModalOpen(false)}
      />

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="删除小组" size="sm"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>取消</Button><Button variant="danger" onClick={async () => { await db.table('duty').delete(deleting!.id!); setDeleting(null) }}>删除</Button></>}>
        <p className="text-sm text-gray-600">确定删除 {deleting?.name}？</p>
      </Modal>
    </div>
  )
}

function GroupModal({ open, initial, students, onClose }: { open: boolean; initial: DutyGroup | null; students: any[]; onClose: () => void }) {
  const [name, setName] = useState(initial?.name || '')
  const [members, setMembers] = useState<number[]>(() => (initial?.members || []).map((m) => students.find((s) => s.name === m)?.id).filter(Boolean) as number[])

  const toggle = (id: number) => {
    setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))
  }

  const save = async () => {
    if (!name.trim()) return alert('请填写小组名称')
    const memberNames = members.map((id) => students.find((s) => s.id === id)?.name).filter(Boolean) as string[]
    if (initial?.id) await db.table('duty').update(initial.id, { name: name.trim(), members: memberNames })
    else await db.table('duty').add({ kind: 'group', name: name.trim(), members: memberNames })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? '编辑小组' : '新增值日小组'} size="md"
      footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={save}>保存</Button></>}>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">小组名称</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：第一组" />
        </label>
        <div>
          <span className="mb-1 block text-xs font-medium text-gray-600">选择成员（已选 {members.length} 人）</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={cn('px-2.5 py-1.5 rounded-lg text-sm border transition-colors', members.includes(s.id) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300')}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
