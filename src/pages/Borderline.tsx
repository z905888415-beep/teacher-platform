import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Target, Trash2, Eye, Pencil } from 'lucide-react'
import { db } from '../db'
import { Card, Button, Modal, Select, Textarea, Field, PageHeader, EmptyState, Badge, StatCard } from '../components/ui'

const STATUS_COLOR: Record<string, string> = { 跟踪中: 'amber', 已提升: 'green', 已退出: 'gray' }

export default function Borderline() {
  const records = useLiveQuery(() => db.table('borderline').toArray(), []) ?? []
  const students = useLiveQuery(() => db.table('students').toArray(), []) ?? []
  const scores = useLiveQuery(() => db.table('scores').toArray(), []) ?? []
  const exams = useLiveQuery(() => db.table('exams').toArray(), []) ?? []

  const [editing, setEditing] = useState<any | null>(null)
  const [detail, setDetail] = useState<any | null>(null)

  const nameMap = useMemo(() => new Map(students.map((s) => [s.id, s.name])), [students])
  const examMap = useMemo(() => new Map(exams.map((e) => [e.id, e.name])), [exams])

  const tracking = records.filter((r) => r.status === '跟踪中').length
  const improved = records.filter((r) => r.status === '已提升').length

  const updateStatus = async (id: number, status: string) => {
    await db.table('borderline').update(id, { status })
  }

  const remove = async (id: number) => {
    await db.table('borderline').delete(id)
  }

  const detailScores = useMemo(() => {
    if (!detail) return []
    return scores.filter((s) => s.studentId === detail.studentId && s.examId === detail.examId)
      .sort((a, b) => b.score - a.score)
  }, [detail, scores])

  return (
    <div>
      <PageHeader
        title="临界生学科跟踪"
        subtitle="一本线 / 本科线临界生「一生一策」，跟踪各科变化"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="跟踪总人数" value={records.length} />
        <StatCard label="跟踪中" value={tracking} color="text-amber-600" />
        <StatCard label="已提升" value={improved} color="text-emerald-600" />
        <StatCard label="已退出" value={records.length - tracking - improved} />
      </div>

      {records.length === 0 ? (
        <Card><EmptyState icon={<Target size={40} />} title="暂无临界生跟踪记录" description="前往「成绩分析 → 临界生」筛选并加入跟踪" /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-3 py-2.5">学生</th><th className="px-3 py-2.5">考试</th><th className="px-3 py-2.5">总分</th>
                <th className="px-3 py-2.5">临界线</th><th className="px-3 py-2.5">状态</th><th className="px-3 py-2.5 w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="px-3 py-2.5 font-medium">{nameMap.get(r.studentId) || r.studentId}</td>
                  <td className="px-3 py-2.5 text-gray-500">{examMap.get(r.examId) || '—'}</td>
                  <td className="px-3 py-2.5">{r.total}</td>
                  <td className="px-3 py-2.5 text-gray-500">{r.line}</td>
                  <td className="px-3 py-2.5">
                    <Select value={r.status || '跟踪中'} onChange={(e) => updateStatus(r.id, e.target.value)} className="w-28">
                      {['跟踪中', '已提升', '已退出'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded hover:bg-brand-50 text-brand-600" onClick={() => setDetail(r)}><Eye size={15} /></button>
                      <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => setEditing(r)}><Pencil size={15} /></button>
                      <button className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => remove(r.id)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* 编辑备注 */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`跟踪记录 · ${editing ? nameMap.get(editing.studentId) : ''}`} size="md"
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>关闭</Button><Button onClick={async () => { await db.table('borderline').update(editing.id, { note: editing.note }); setEditing(null) }}>保存</Button></>}>
        <div className="space-y-3">
          <Field label="跟踪情况 / 薄弱点 / 任课教师建议">
            <Textarea rows={5} value={editing?.note || ''} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="记录各科薄弱点、任课教师建议、后续措施…" />
          </Field>
        </div>
      </Modal>

      {/* 各科详情 */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`各科成绩 · ${detail ? nameMap.get(detail.studentId) : ''}`} size="sm">
        <div className="space-y-2">
          {detailScores.length === 0 ? <p className="text-sm text-gray-400">该考试暂无各科成绩</p> : detailScores.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-700">{s.subject}</span>
              <span className="text-sm font-semibold text-gray-800">{s.score}</span>
            </div>
          ))}
          {detail?.note && <p className="mt-2 text-xs text-gray-500 p-2 bg-amber-50 rounded">📝 {detail.note}</p>}
        </div>
      </Modal>
    </div>
  )
}
