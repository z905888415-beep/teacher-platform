import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Scale } from 'lucide-react'
import { db } from '../db'
import { Card, PageHeader, Select, EmptyState, Badge } from '../components/ui'
import { cn } from '../lib/utils'

// 选科走班管理：新高考 3+1+2 / 3+3 模式，按选科组合管理学生。
const COMBO_COLORS = ['bg-brand-50 text-brand-700', 'bg-emerald-50 text-emerald-700', 'bg-amber-50 text-amber-700', 'bg-purple-50 text-purple-700', 'bg-rose-50 text-rose-700']

export default function Selection() {
  const students = useLiveQuery(() => db.table('students').toArray(), []) ?? []

  const combos = useMemo(() => {
    const map = new Map<string, any[]>()
    students.forEach((s) => {
      const key = s.selection || '未选科'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    })
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [students])

  const change = async (id: number, selection: string) => {
    await db.table('students').update(id, { selection })
  }

  return (
    <div>
      <PageHeader title="选科走班管理" subtitle={`共 ${students.length} 名学生 · ${combos.length} 种组合`} />

      {students.length === 0 ? (
        <Card><EmptyState icon={<Scale size={40} />} title="暂无学生" description="请先添加学生" /></Card>
      ) : (
        <>
          {/* 组合概览 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            {combos.map(([combo, list], i) => (
              <Card key={combo} className="p-4">
                <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-semibold', COMBO_COLORS[i % COMBO_COLORS.length])}>{combo}</span>
                <p className="mt-2 text-2xl font-bold text-gray-800">{list.length} <span className="text-sm font-normal text-gray-400">人</span></p>
              </Card>
            ))}
          </div>

          {/* 学生列表 */}
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-500"><th className="px-3 py-2.5">学号</th><th className="px-3 py-2.5">姓名</th><th className="px-3 py-2.5">性别</th><th className="px-3 py-2.5">选科组合</th></tr></thead>
              <tbody>
                {[...students].sort((a, b) => (a.studentNo || '').localeCompare(b.studentNo || '')).map((s) => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="px-3 py-2.5 text-gray-500">{s.studentNo}</td>
                    <td className="px-3 py-2.5 font-medium">{s.name}</td>
                    <td className="px-3 py-2.5 text-gray-500">{s.gender}</td>
                    <td className="px-3 py-2.5">
                      <Select value={s.selection || ''} onChange={(e) => change(s.id, e.target.value)} className="w-32">
                        <option value="">未选科</option>
                        {['物化生', '物化地', '物化政', '物生地', '物生政', '物地政', '史政地', '史政生', '史地生', '史化生'].map((c) => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
