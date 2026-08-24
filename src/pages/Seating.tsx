import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Save, RotateCcw, ArrowLeftRight, ArrowUpDown, GitCommit, Trash2, LayoutGrid } from 'lucide-react'
import { db } from '../db'
import { Card, Button, Modal, Input, Field, PageHeader, EmptyState, Select, Badge } from '../components/ui'
import { cn } from '../lib/utils'

interface SeatSnapshot {
  id?: number
  version: string
  rows: number
  cols: number
  grid: Record<number, number>
  createdAt: string
}

export default function Seating() {
  const students = useLiveQuery(() => db.table('students').toArray(), []) ?? []
  const snapshots = useLiveQuery(() => db.table('seats').toArray(), []) ?? ([] as SeatSnapshot[])

  const latest = useMemo(() => [...snapshots].sort((a, b) => (b.id || 0) - (a.id || 0))[0], [snapshots])

  const [rows, setRows] = useState(latest?.rows || 6)
  const [cols, setCols] = useState(latest?.cols || 4)
  const [grid, setGrid] = useState<Record<number, number>>(latest?.grid || {})
  const [dragging, setDragging] = useState<number | null>(null)
  const [pickSeat, setPickSeat] = useState<number | null>(null)

  const nameMap = useMemo(() => new Map(students.map((s) => [s.id, s.name])), [students])
  const assigned = useMemo(() => new Set(Object.values(grid)), [grid])
  const unassigned = useMemo(() => students.filter((s) => !assigned.has(s.id)), [students, assigned])

  // 切换历史版本
  const loadSnapshot = (s: SeatSnapshot) => {
    setRows(s.rows)
    setCols(s.cols)
    setGrid(s.grid)
  }

  const seatIndex = (r: number, c: number) => r * cols + c

  const swap = (a: number, b: number) => {
    setGrid((g) => {
      const next = { ...g }
      const av = next[a]
      next[a] = next[b]
      next[b] = av
      return next
    })
  }

  const onDrop = (target: number) => {
    if (dragging === null) return
    if (dragging === target) return
    swap(dragging, target)
    setDragging(null)
  }

  const rotateHorizontal = () => { // 左右调换
    setGrid((g) => {
      const next: Record<number, number> = {}
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        next[seatIndex(r, c)] = g[seatIndex(r, cols - 1 - c)]
      }
      return next
    })
  }

  const rotateVertical = () => { // 前后调换
    setGrid((g) => {
      const next: Record<number, number> = {}
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        next[seatIndex(r, c)] = g[seatIndex(rows - 1 - r, c)]
      }
      return next
    })
  }

  const rotateGroup = () => { // 组间轮换（每列右移一位）
    setGrid((g) => {
      const next: Record<number, number> = {}
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        next[seatIndex(r, c)] = g[seatIndex(r, (c + 1) % cols)]
      }
      return next
    })
  }

  const resetGrid = () => {
    setGrid({})
    setRows(6)
    setCols(4)
  }

  const save = async () => {
    const version = `座位表 v${snapshots.length + 1}`
    await db.table('seats').add({ version, rows, cols, grid, createdAt: new Date().toISOString() })
  }

  const restore = async (id: number) => {
    await db.table('seats').delete(id)
  }

  const assign = async (studentId: number) => {
    if (pickSeat === null) return
    setGrid((g) => {
      const next = { ...g }
      // 若该生已在其它座位，先移除
      Object.keys(next).forEach((k) => { if (next[Number(k)] === studentId) delete next[Number(k)] })
      next[pickSeat] = studentId
      return next
    })
    setPickSeat(null)
  }

  return (
    <div>
      <PageHeader
        title="座位安排与轮换"
        subtitle="拖拽调整位置，一键轮换，保存历史版本"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={rotateHorizontal}><ArrowLeftRight size={14} />左右调换</Button>
            <Button variant="outline" size="sm" onClick={rotateVertical}><ArrowUpDown size={14} />前后调换</Button>
            <Button variant="outline" size="sm" onClick={rotateGroup}><RotateCcw size={14} />组间轮换</Button>
            <Button variant="outline" size="sm" onClick={resetGrid}><Trash2 size={14} />清空</Button>
            <Button size="sm" onClick={save}><Save size={14} />保存版本</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 座位表 */}
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center gap-3 mb-3 text-sm text-gray-500">
            <Field label="排数"><Input type="number" value={rows} min={1} max={12} onChange={(e) => setRows(Number(e.target.value))} className="w-20" /></Field>
            <Field label="列数（组）"><Input type="number" value={cols} min={1} max={10} onChange={(e) => setCols(Number(e.target.value))} className="w-20" /></Field>
            <span className="text-xs text-gray-400">👆 点击空座位分配学生，拖拽已坐学生可调换</span>
          </div>

          <div className="flex items-center justify-center mb-3">
            <div className="px-4 py-1 rounded-md bg-gray-800 text-white text-xs">讲 台</div>
          </div>

          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: rows * cols }).map((_, idx) => {
              const sid = grid[idx]
              const student = sid ? students.find((s) => s.id === sid) : null
              return (
                <div
                  key={idx}
                  draggable={!!sid}
                  onDragStart={() => setDragging(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(idx)}
                  onClick={() => !sid && setPickSeat(idx)}
                  className={cn(
                    'aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-center transition-colors select-none',
                    sid ? 'bg-brand-50 border-brand-300 cursor-grab active:cursor-grabbing' : 'border-dashed border-gray-200 hover:border-brand-300 cursor-pointer',
                    dragging === idx && 'opacity-40',
                  )}
                >
                  {student ? (
                    <>
                      <span className="text-xs font-medium text-brand-700 leading-tight px-1">{student.name}</span>
                      <span className="text-[9px] text-gray-400">{student.selection}</span>
                    </>
                  ) : (
                    <span className="text-gray-300 text-lg">+</span>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* 历史版本 + 未分配 */}
        <div className="space-y-3">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2"><GitCommit size={16} className="text-brand-600" />历史版本</h3>
            {snapshots.length === 0 ? <p className="text-sm text-gray-400">尚无保存的座位版本</p> : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {[...snapshots].sort((a, b) => (b.id || 0) - (a.id || 0)).map((s) => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                    <button className="flex-1 text-left text-sm text-gray-700 hover:text-brand-600" onClick={() => loadSnapshot(s)}>{s.version}</button>
                    <span className="text-[10px] text-gray-400">{s.createdAt?.slice(0, 10)}</span>
                    <button className="p-1 text-red-400 hover:bg-red-50 rounded" onClick={() => restore(s.id!)}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2"><LayoutGrid size={16} className="text-brand-600" />未分配学生</h3>
            {unassigned.length === 0 ? <p className="text-sm text-gray-400">所有学生均已入座</p> : (
              <div className="flex flex-wrap gap-1.5">
                {unassigned.map((s) => <Badge key={s.id} color="blue">{s.name}</Badge>)}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 分配学生弹窗 */}
      <Modal open={pickSeat !== null} onClose={() => setPickSeat(null)} title="选择学生" size="sm">
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {unassigned.map((s) => (
            <button key={s.id} onClick={() => assign(s.id)} className="w-full flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-brand-50 text-left">
              <span className="text-sm font-medium text-gray-800">{s.name}</span>
              <span className="text-xs text-gray-400">{s.studentNo}</span>
            </button>
          ))}
          {unassigned.length === 0 && <p className="text-sm text-gray-400">没有未分配的学生</p>}
        </div>
      </Modal>
    </div>
  )
}
