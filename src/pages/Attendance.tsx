import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { db, nowISO, type AttendanceType, type LeaveRecord, type Student } from '../db'
import { todayISO } from '../lib/dates'
import { Badge, Button, Drawer, EmptyState, Field, Input, Modal, Panel, Select, Textarea } from '../components/ui'
import { useToast } from '../contexts/ToastContext'
import { useClassManager } from '../contexts/ClassContext'

const ABSENCE_TYPES: AttendanceType[] = ['迟到', '早退', '缺勤']

/** 记录异常出勤 */
function AttendanceDrawer({
  open,
  onClose,
  students,
  existing,
}: {
  open: boolean
  onClose: () => void
  students: Student[]
  existing: { studentId: number; type: AttendanceType } | null
}) {
  const { showToast } = useToast()
  const [studentId, setStudentId] = useState('')
  const [type, setType] = useState<AttendanceType>('迟到')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (existing) {
      setStudentId(String(existing.studentId))
      setType(existing.type)
    }
  }, [existing])

  const handleSave = async () => {
    if (!studentId) {
      showToast('请选择学生', { error: true })
      return
    }
    setSaving(true)
    const stamp = nowISO()
    const sid = Number(studentId)
    const old = await db.attendance.where('studentId').equals(sid).toArray()
    const todayRow = old.find((row) => row.date === todayISO())
    if (todayRow?.id != null) {
      await db.attendance.update(todayRow.id, { type, note: note.trim() || undefined, createdAt: stamp })
    } else {
      await db.attendance.add({ studentId: sid, date: todayISO(), type, note: note.trim() || undefined, createdAt: stamp })
    }
    showToast('出勤异常已记录')
    setSaving(false)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="记录出勤异常"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <Field label="学生" htmlFor="att-student">
        <Select id="att-student" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
          <option value="">请选择</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="异常类型" htmlFor="att-type">
        <Select id="att-type" value={type} onChange={(event) => setType(event.target.value as AttendanceType)}>
          {ABSENCE_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="备注（可选）" htmlFor="att-note">
        <Textarea id="att-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <p className="text-[11px] leading-4 text-ink-500">名单默认全部「正常」，只有异常项会写入记录。</p>
    </Drawer>
  )
}

/** 登记请假 */
function LeaveDrawer({ open, onClose, students }: { open: boolean; onClose: () => void; students: Student[] }) {
  const { showToast } = useToast()
  const [studentId, setStudentId] = useState('')
  const [type, setType] = useState<LeaveRecord['type']>('病假')
  const [startAt, setStartAt] = useState(todayISO())
  const [endAt, setEndAt] = useState(todayISO())
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!studentId) {
      showToast('请选择学生', { error: true })
      return
    }
    if ((endAt || startAt) < startAt) {
      showToast('结束日期不能早于开始日期', { error: true })
      return
    }
    setSaving(true)
    await db.leaves.add({
      studentId: Number(studentId),
      startAt,
      endAt: endAt || startAt,
      type,
      reason: reason.trim() || undefined,
      parentConfirmed: confirmed ? 1 : 0,
      createdAt: nowISO(),
    })
    showToast('请假已登记')
    setSaving(false)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="登记请假"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <Field label="学生" htmlFor="leave-student">
        <Select id="leave-student" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
          <option value="">请选择</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="请假类型" htmlFor="leave-type">
        <Select id="leave-type" value={type} onChange={(event) => setType(event.target.value as LeaveRecord['type'])}>
          <option value="病假">病假</option>
          <option value="事假">事假</option>
          <option value="其他">其他</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="开始日期" htmlFor="leave-start">
          <Input id="leave-start" type="date" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
        </Field>
        <Field label="结束日期" htmlFor="leave-end">
          <Input id="leave-end" type="date" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
        </Field>
      </div>
      <Field label="原因（可选）" htmlFor="leave-reason">
        <Textarea id="leave-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="h-4 w-4 accent-[#002FA7]" />
        家长已确认
      </label>
    </Drawer>
  )
}

export function Attendance() {
  const { currentClass } = useClassManager()
  const { showToast } = useToast()
  const [tab, setTab] = useState<'today' | 'leaves'>('today')
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [deleteLeave, setDeleteLeave] = useState<LeaveRecord | null>(null)

  const today = todayISO()
  const classId = currentClass?.id
  const students = useLiveQuery(
    async () => (classId == null ? [] : db.students.where('classId').equals(classId).toArray()),
    [classId],
    [] as Student[],
  )!
  const attendance = useLiveQuery(async () => db.attendance.where('date').equals(today).toArray(), [], [])!
  const leaves = useLiveQuery(async () => db.leaves.orderBy('startAt').reverse().toArray(), [], [])!

  // F03：请假只显示当前班级学生的记录，切班后不出现「未知学生」
  const classStudentIds = new Set(students.map((s) => s.id))
  const visibleLeaves = leaves.filter((leave) => classStudentIds.has(leave.studentId))

  const studentName = (id: number) => students.find((s) => s.id === id)?.name ?? '（未知学生）'
  const abnormalToday = attendance.filter((row) => students.some((s) => s.id === row.studentId))

  const removeAbnormal = async (studentId: number | undefined) => {
    if (studentId == null) return
    const row = attendance.find((item) => item.studentId === studentId)
    if (row?.id != null) {
      await db.attendance.delete(row.id)
      showToast('已恢复为正常')
    }
  }

  return (
    <>
      <Panel
        title={`出勤与请假 · ${currentClass?.name ?? ''}`}
        subtitle={`今天是 ${today} · 名单默认「正常」，只对异常项写记录`}
        actions={
          <>
            <Button onClick={() => setAttendanceOpen(true)}>
              <Plus size={14} /> 记录异常
            </Button>
            <Button variant="primary" onClick={() => setLeaveOpen(true)}>
              <Plus size={14} /> 登记请假
            </Button>
          </>
        }
        bodyClassName="p-0"
      >
        <div className="flex gap-1 border-b border-line px-4 py-2.5">
          {(
            [
              ['today', `当日出勤${abnormalToday.length > 0 ? `（异常 ${abnormalToday.length}）` : ''}`],
              ['leaves', '请假记录'],
            ] as [typeof tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                tab === key ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-surface-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'today' ? (
          students.length === 0 ? (
            <div className="p-5">
              <EmptyState title="当前班级暂无学生" hint="先在「学生与家长」中添加学生，再记录出勤。" />
            </div>
          ) : (
            <ul className="px-4 py-2">
              {students.map((student) => {
                const record = attendance.find((row) => row.studentId === student.id)
                return (
                  <li key={student.id} className="flex min-h-[48px] items-center justify-between gap-2 border-t border-line py-2 first:border-t-0">
                    <span className="text-sm text-ink-900">
                      {student.name}
                      <span className="ml-2 text-[11px] text-ink-500">{student.boarding ?? ''}</span>
                    </span>
                    {record ? (
                      <span className="flex items-center gap-2">
                        <Badge variant="danger">{record.type}</Badge>
                        <button type="button" onClick={() => removeAbnormal(student.id)} className="text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                          恢复正常
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-500">正常</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )
        ) : visibleLeaves.length === 0 ? (
          <div className="p-5">
            <EmptyState title="暂无请假记录" hint="点击右上角「登记请假」记录第一条。" />
          </div>
        ) : (
          <ul className="px-4 py-2">
            {visibleLeaves.map((leave) => {
              const active = leave.startAt <= today && leave.endAt >= today
              return (
                <li key={leave.id} className="flex items-start justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">
                      {studentName(leave.studentId)}
                      <Badge variant={leave.type === '病假' ? 'danger' : 'default'}>
                        {leave.type}
                      </Badge>
                      {active && (
                        <Badge variant="blue">进行中</Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {leave.startAt} 至 {leave.endAt} · 家长{leave.parentConfirmed ? '已' : '未'}确认
                      {leave.reason ? ` · ${leave.reason}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="删除请假记录"
                    onClick={() => setDeleteLeave(leave)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-menu text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <AttendanceDrawer
        open={attendanceOpen}
        onClose={() => setAttendanceOpen(false)}
        students={students}
        existing={null}
      />
      <LeaveDrawer open={leaveOpen} onClose={() => setLeaveOpen(false)} students={students} />

      <Modal
        open={deleteLeave != null}
        onClose={() => setDeleteLeave(null)}
        title="删除请假记录"
        footer={
          <>
            <Button onClick={() => setDeleteLeave(null)}>取消</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (deleteLeave?.id != null) await db.leaves.delete(deleteLeave.id)
                showToast('请假记录已删除')
                setDeleteLeave(null)
              }}
            >
              删除
            </Button>
          </>
        }
      >
        确定删除「{deleteLeave ? studentName(deleteLeave.studentId) : ''}」的请假记录吗？
      </Modal>
    </>
  )
}
