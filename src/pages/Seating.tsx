import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Pencil, Plus, Printer, Sparkles, Trash2 } from 'lucide-react'
import { db, nowISO, type DutyAssignment, type SeatVersion, type Student } from '../db'
import { WEEKDAY_NAMES } from '../lib/dates'
import {
  autoArrangeStudents,
  clipSeatMap,
  DEFAULT_SEATING_COLS,
  DEFAULT_SEATING_ROWS,
  nextDutyGroupName,
  normalizeDimensions,
  parseDutyMemberNames,
  placeStudent,
  sortStudentsForSeating,
  swapSeatAssignments,
  type SeatMap,
} from '../lib/seating'
import { Badge, Button, Drawer, EmptyState, Field, Input, Modal, Panel, Select } from '../components/ui'
import { useToast } from '../contexts/ToastContext'
import { useClassManager } from '../contexts/ClassContext'

function useSeatMap(classId: number | null | undefined) {
  return useLiveQuery(async () => {
    if (classId == null) return null
    const rows = await db.seatVersions.where('classId').equals(classId).toArray()
    return rows.find((row) => row.name === '当前座位表') ?? null
  }, [classId])
}

function parseStoredSeatMap(value: string | undefined): SeatMap {
  if (!value) return new Map()
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return new Map()
    const map: SeatMap = new Map()
    for (const [key, rawId] of Object.entries(parsed)) {
      const id = Number(rawId)
      if (Number.isInteger(id) && id > 0) map.set(key, id)
    }
    return map
  } catch {
    return new Map()
  }
}

/** 座位格：可拖动 + 可放置，拖到另一格即交换；单击保留两步点击交换。 */
function SeatCell({
  seatKey,
  name,
  isSelected,
  isArrangeTarget,
  onSelect,
}: {
  seatKey: string
  name?: string
  isSelected: boolean
  isArrangeTarget: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `seat-${seatKey}`,
    data: { seatKey },
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `seat-${seatKey}` })
  const [r, c] = seatKey.split('-').map(Number)

  return (
    <button
      ref={(element) => {
        setDragRef(element)
        setDropRef(element)
      }}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`座位 ${r + 1} 排 ${c + 1} 列：${name ?? '空位'}。${
        isArrangeTarget ? '当前可安排学生到此座位。' : '点击选中后点另一座位交换，或直接拖动。'
      }`}
      aria-pressed={isSelected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={`grid h-11 min-w-[88px] cursor-grab touch-none select-none place-items-center rounded-menu border text-sm transition-colors active:cursor-grabbing ${
        isOver || isArrangeTarget ? 'bg-brand-50 shadow-[inset_0_0_0_2px_#002FA7]' : ''
      } ${
        isSelected
          ? 'border-brand-600 shadow-[inset_0_0_0_1.5px_#002FA7] text-brand-600'
          : name
            ? 'border-line bg-white text-ink-900 hover:border-line-strong'
            : 'border-dashed border-line-strong/60 text-ink-500 hover:border-brand-600/40'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      {name ?? '空位'}
    </button>
  )
}

/** 未入座学生：既可点击选中，也可直接拖到上方座位。 */
function UnseatedStudentChip({
  student,
  selected,
  onSelect,
}: {
  student: Student & { id: number }
  selected: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `student-${student.id}`,
    data: { studentId: student.id },
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-pressed={selected}
      aria-label={`${student.studentNo ? `${student.studentNo} · ` : ''}${student.name}，可拖到座位`}
      onClick={onSelect}
      className={`touch-none select-none rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors active:cursor-grabbing ${
        selected
          ? 'cursor-grab border-brand-600 bg-brand-600 text-white'
          : 'cursor-grab border-line bg-white text-ink-700 hover:border-brand-600 hover:text-brand-600'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      {student.studentNo ? `${student.studentNo} · ` : ''}{student.name}
    </button>
  )
}

interface DutyFormValue {
  groupName: string
  weekday: number
  task: string
  memberIds: number[]
}

function DutyEditor({
  open,
  onClose,
  students,
  existing,
  defaultGroupName,
  onSave,
}: {
  open: boolean
  onClose: () => void
  students: Student[]
  existing: DutyAssignment | null
  defaultGroupName: string
  onSave: (value: DutyFormValue) => Promise<void>
}) {
  const { showToast } = useToast()
  const [groupName, setGroupName] = useState(defaultGroupName)
  const [weekday, setWeekday] = useState(1)
  const [task, setTask] = useState('教室清扫')
  const [memberIds, setMemberIds] = useState<number[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const orderedStudents = useMemo(() => sortStudentsForSeating(students), [students])

  useEffect(() => {
    if (!open) return
    const studentByName = new Map(students.map((student) => [student.name, student.id]))
    const selectedIds = existing
      ? parseDutyMemberNames(existing.members)
          .map((name) => studentByName.get(name))
          .filter((id): id is number => id != null)
      : []
    setGroupName(existing?.groupName ?? defaultGroupName)
    setWeekday(existing?.weekday ?? 1)
    setTask(existing?.task ?? '教室清扫')
    setMemberIds([...new Set(selectedIds)])
    setErrors({})
  }, [defaultGroupName, existing, open, students])

  const toggleStudent = (studentId: number) => {
    setMemberIds((current) =>
      current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId],
    )
    setErrors((current) => ({ ...current, members: '' }))
  }

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {}
    if (!groupName.trim()) nextErrors.groupName = '请填写组名'
    if (!task.trim()) nextErrors.task = '请填写值日任务'
    if (memberIds.length === 0) nextErrors.members = '请至少选择 1 名成员'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      await onSave({ groupName: groupName.trim(), weekday, task: task.trim(), memberIds })
      onClose()
    } catch {
      showToast('值日组保存失败，请稍后重试', { error: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={existing ? '编辑值日组' : '添加值日组'}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <Field label="组名" error={errors.groupName} htmlFor="duty-group-name">
        <Input
          id="duty-group-name"
          value={groupName}
          onChange={(event) => {
            setGroupName(event.target.value)
            setErrors((current) => ({ ...current, groupName: '' }))
          }}
          placeholder="例如：第 1 组"
        />
      </Field>
      <Field label="值日星期" htmlFor="duty-weekday">
        <Select id="duty-weekday" value={String(weekday)} onChange={(event) => setWeekday(Number(event.target.value))}>
          {[1, 2, 3, 4, 5].map((day) => (
            <option key={day} value={day}>
              {WEEKDAY_NAMES[day]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="值日任务" error={errors.task} htmlFor="duty-task">
        <Input
          id="duty-task"
          value={task}
          onChange={(event) => {
            setTask(event.target.value)
            setErrors((current) => ({ ...current, task: '' }))
          }}
          placeholder="例如：擦黑板、扫地、整理讲台"
        />
      </Field>
      <Field label="值日成员（可多选）" error={errors.members} hint="成员会以姓名保存到现有值日数据中">
        {orderedStudents.length === 0 ? (
          <p className="rounded-menu border border-dashed border-line px-3 py-4 text-xs text-ink-500">当前班级暂无学生</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {orderedStudents.map((student) => {
              if (student.id == null) return null
              const checked = memberIds.includes(student.id)
              return (
                <label
                  key={student.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-menu border px-2.5 py-2 text-xs font-semibold transition-colors ${
                    checked ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line text-ink-700 hover:border-line-strong'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStudent(student.id as number)}
                    className="h-4 w-4 accent-[#002FA7]"
                  />
                  <span className="min-w-0 truncate">{student.name}</span>
                </label>
              )
            })}
          </div>
        )}
      </Field>
    </Drawer>
  )
}

/** 座位表与值日表：支持自动排座、未入座安排、交换、值日组编辑及黑白打印。 */
export function Seating() {
  const { currentClass } = useClassManager()
  const { showToast } = useToast()
  const [tab, setTab] = useState<'seats' | 'duty'>('seats')
  const [rows, setRows] = useState(DEFAULT_SEATING_ROWS)
  const [cols, setCols] = useState(DEFAULT_SEATING_COLS)
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null)
  const [arrangingStudentId, setArrangingStudentId] = useState<number | null>(null)
  const [dragPreview, setDragPreview] = useState<{ label: string; kind: 'seat' | 'student' } | null>(null)
  const [clearSeatsOpen, setClearSeatsOpen] = useState(false)
  const [deleteDuty, setDeleteDuty] = useState<DutyAssignment | null>(null)
  const [dutyDrawerOpen, setDutyDrawerOpen] = useState(false)
  const [editingDuty, setEditingDuty] = useState<DutyAssignment | null>(null)
  const seatVersion = useSeatMap(currentClass?.id)

  const classId = currentClass?.id
  const students = useLiveQuery(
    async () => (classId == null ? [] : db.students.where('classId').equals(classId).toArray()),
    [classId],
    [] as Student[],
  )!
  const duties = useLiveQuery(
    async () => (classId == null ? [] : db.dutyAssignments.where('classId').equals(classId).toArray()),
    [classId],
    [] as DutyAssignment[],
  )!

  const seatMap = useMemo(() => parseStoredSeatMap(seatVersion?.seats), [seatVersion?.seats])
  const studentIds = useMemo(() => students.map((student) => student.id).filter((id): id is number => id != null), [students])
  const visibleSeatState = useMemo(
    () => clipSeatMap(seatMap, rows, cols, studentIds),
    [cols, rows, seatMap, studentIds],
  )
  const visibleSeatMap = visibleSeatState.seats
  const orderedStudents = useMemo(() => sortStudentsForSeating(students), [students])
  const studentName = (id?: number) => students.find((student) => student.id === id)?.name
  const unseated = orderedStudents.filter((student) => student.id != null && ![...visibleSeatMap.values()].includes(student.id))
  const overflowNames = [...new Set(visibleSeatState.overflowStudentIds.map((id) => studentName(id)).filter(Boolean))] as string[]
  const unassignedSeatCount = Math.max(0, rows * cols - visibleSeatMap.size)
  const arrangingStudent = arrangingStudentId == null ? null : students.find((student) => student.id === arrangingStudentId)

  useEffect(() => {
    if (seatVersion) {
      const dimensions = normalizeDimensions(seatVersion.rows, seatVersion.cols)
      setRows(dimensions.rows)
      setCols(dimensions.cols)
    } else {
      setRows(DEFAULT_SEATING_ROWS)
      setCols(DEFAULT_SEATING_COLS)
    }
    setSelectedSeat(null)
    setArrangingStudentId(null)
  }, [classId, seatVersion?.id, seatVersion?.rows, seatVersion?.cols])

  const saveSeatLayout = async (
    source: SeatMap,
    targetRows: number,
    targetCols: number,
    successMessage?: string,
  ) => {
    if (classId == null) return
    const dimensions = normalizeDimensions(targetRows, targetCols)
    const clipped = clipSeatMap(source, dimensions.rows, dimensions.cols, studentIds)
    const currentVersion: SeatVersion | null =
      seatVersion?.id != null
        ? seatVersion
        : (await db.seatVersions.where('classId').equals(classId).toArray()).find((row) => row.name === '当前座位表') ?? null
    const stamp = nowISO()
    const payload = {
      rows: dimensions.rows,
      cols: dimensions.cols,
      seats: JSON.stringify(Object.fromEntries(clipped.seats)),
      createdAt: stamp,
    }
    if (currentVersion?.id != null) {
      await db.seatVersions.update(currentVersion.id, payload)
    } else {
      await db.seatVersions.add({ classId, name: '当前座位表', ...payload })
    }
    setRows(dimensions.rows)
    setCols(dimensions.cols)
    if (clipped.overflowStudentIds.length > 0) {
      const names = [...new Set(clipped.overflowStudentIds.map((id) => studentName(id)).filter(Boolean))]
      showToast(
        names.length > 0 ? `${names.join('、')}已退回未入座（座位表缩小后越界）` : '越界座位已清理并退回未入座',
        { error: true },
      )
    } else if (successMessage) {
      showToast(successMessage)
    }
  }

  const handleAutoArrange = async () => {
    if (classId == null) return
    const result = autoArrangeStudents(students, rows, cols)
    if ('error' in result) {
      showToast(result.error, { error: true })
      return
    }
    await saveSeatLayout(result.seats, result.rows, result.cols, `已按学号排座，共 ${students.length} 人`)
    setSelectedSeat(null)
    setArrangingStudentId(null)
  }

  const swapSeats = async (keyA: string, keyB: string) => {
    await saveSeatLayout(swapSeatAssignments(seatMap, keyA, keyB), rows, cols, '座位已交换')
  }

  const placeStudentAt = async (studentId: number, targetKey: string) => {
    const targetStudentId = visibleSeatMap.get(targetKey)
    const targetName = studentName(targetStudentId)
    const name = studentName(studentId) ?? '学生'
    await saveSeatLayout(
      placeStudent(seatMap, studentId, targetKey),
      rows,
      cols,
      targetName ? `已安排${name}，${targetName}退回未入座` : `已安排${name}`,
    )
    setArrangingStudentId(null)
    setSelectedSeat(null)
  }

  const placeSelectedStudent = async (targetKey: string) => {
    if (arrangingStudentId == null) return
    await placeStudentAt(arrangingStudentId, targetKey)
  }

  const handleSeatClick = async (key: string) => {
    if (arrangingStudentId != null) {
      await placeSelectedStudent(key)
      return
    }
    if (!selectedSeat) {
      setSelectedSeat(key)
      return
    }
    if (selectedSeat === key) {
      setSelectedSeat(null)
      return
    }
    await swapSeats(selectedSeat, key)
    setSelectedSeat(null)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const handleSeatDragStart = (event: DragStartEvent) => {
    const studentId = event.active.data.current?.studentId as number | undefined
    if (studentId != null) {
      const student = students.find((item) => item.id === studentId)
      setDragPreview({
        label: `${student?.studentNo ? `${student.studentNo} · ` : ''}${student?.name ?? '学生'}`,
        kind: 'student',
      })
      return
    }
    const seatKey = event.active.data.current?.seatKey as string | undefined
    setDragPreview({ label: studentName(seatKey ? visibleSeatMap.get(seatKey) : undefined) ?? '空位', kind: 'seat' })
  }

  const handleSeatDragEnd = async (event: DragEndEvent) => {
    setDragPreview(null)
    const from = event.active.data.current?.seatKey as string | undefined
    const studentId = event.active.data.current?.studentId as number | undefined
    const to = event.over ? String(event.over.id).replace('seat-', '') : undefined
    if (!to) return
    if (studentId != null) {
      await placeStudentAt(studentId, to)
      return
    }
    if (!from || from === to) return
    await swapSeats(from, to)
    setSelectedSeat(null)
    setArrangingStudentId(null)
  }

  const saveDuty = async ({ groupName, weekday, task, memberIds }: DutyFormValue) => {
    if (classId == null) return
    const members = orderedStudents
      .filter((student) => student.id != null && memberIds.includes(student.id))
      .map((student) => student.name)
      .join('、')
    if (!members) throw new Error('成员不能为空')
    if (editingDuty?.id != null) {
      await db.dutyAssignments.update(editingDuty.id, { groupName, weekday, task, members })
      showToast('值日组已更新')
    } else {
      await db.dutyAssignments.add({ classId, groupName, weekday, task, members })
      showToast('值日组已添加')
    }
  }

  const openAddDuty = () => {
    setEditingDuty(null)
    setDutyDrawerOpen(true)
  }

  const openEditDuty = (duty: DutyAssignment) => {
    setEditingDuty(duty)
    setDutyDrawerOpen(true)
  }

  const sortedDuties = [...duties].sort((a, b) => a.weekday - b.weekday || (a.id ?? 0) - (b.id ?? 0))

  return (
    <>
      <Panel
        title={`座位与值日 · ${currentClass?.name ?? ''}`}
        actions={
          <div className="flex items-center gap-1">
            {(
              [
                ['seats', '座位表'],
                ['duty', '值日表'],
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
        }
        bodyClassName="p-4"
      >
        {tab === 'seats' ? (
          students.length === 0 ? (
            <EmptyState title="当前班级暂无学生" hint="先在「学生与家长」中添加学生，再来排座位。" />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
                <div>
                  <p className="text-sm font-semibold text-ink-900">座位安排</p>
                  <p className="mt-0.5 text-[11px] text-ink-500">默认 5 列，最多 10 × 10；可拖动或点击两个座位交换</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleAutoArrange}>
                    <Sparkles size={14} /> 一键按编号排座
                  </Button>
                  <Button variant="dangerSoft" onClick={() => setClearSeatsOpen(true)}>
                    <Trash2 size={14} /> 清空排座
                  </Button>
                  <Button variant="primary" onClick={() => window.print()}>
                    <Printer size={14} /> 打印
                  </Button>
                </div>
              </div>

              {arrangingStudent && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-menu border border-brand-600/30 bg-brand-50 px-3 py-2 text-xs text-brand-600" role="status">
                  <span>正在安排「{arrangingStudent.name}」，请点击一个座位；已有学生会退回未入座</span>
                  <button
                    type="button"
                    onClick={() => setArrangingStudentId(null)}
                    className="font-semibold underline underline-offset-2"
                  >
                    取消安排
                  </button>
                </div>
              )}

              {overflowNames.length > 0 && (
                <div className="mb-3 rounded-menu border border-warning/30 bg-[#FFF8E7] px-3 py-2 text-xs text-warning" role="alert">
                  {overflowNames.join('、')}目前位于表格之外，保存或排座时会退回未入座。
                </div>
              )}

              <DndContext
                sensors={sensors}
                onDragStart={handleSeatDragStart}
                onDragCancel={() => setDragPreview(null)}
                onDragEnd={handleSeatDragEnd}
              >
                <div className="print-block overflow-x-auto">
                  <p aria-hidden className="mx-auto mb-3 w-2/3 min-w-[240px] border-b-2 border-ink-900 pb-1 text-center text-xs font-bold text-ink-900">
                    讲台
                  </p>
                  <div
                    className="mx-auto grid w-fit gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(88px, 1fr))` }}
                  >
                    {Array.from({ length: rows * cols }, (_, index) => {
                      const row = Math.floor(index / cols)
                      const col = index % cols
                      const key = `${row}-${col}`
                      const name = studentName(visibleSeatMap.get(key))
                      return (
                        <SeatCell
                          key={key}
                          seatKey={key}
                          name={name}
                          isSelected={selectedSeat === key}
                          isArrangeTarget={arrangingStudentId != null}
                          onSelect={() => void handleSeatClick(key)}
                        />
                      )
                    })}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 print:hidden lg:grid-cols-[auto_1fr]">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-ink-700">
                      行数
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={rows}
                        onChange={(event) => setRows(normalizeDimensions(Number(event.target.value), cols).rows)}
                        className="h-8 w-16"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-ink-700">
                      列数
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={cols}
                        onChange={(event) => setCols(normalizeDimensions(rows, Number(event.target.value)).cols)}
                        className="h-8 w-16"
                      />
                    </label>
                    <Button
                      onClick={async () => {
                        await saveSeatLayout(seatMap, rows, cols, '座位表已保存')
                      }}
                    >
                      保存座位表
                    </Button>
                  </div>

                  <div className="min-w-0 rounded-menu border border-line bg-surface-muted px-3 py-2 text-[11px] leading-5 text-ink-500">
                    <span>当前 {rows} 行 × {cols} 列，空位 {unassignedSeatCount} 个</span>
                    <span className="mx-1.5 text-line-strong">·</span>
                    <span>未入座 {unseated.length} 人</span>
                    {selectedSeat && !arrangingStudentId && <span className="ml-2 text-brand-600">已选中一个座位，请再点一个座位交换</span>}
                  </div>
                </div>

                <section className="mt-3 rounded-card border border-line bg-surface-muted p-3 print:hidden" aria-labelledby="unseated-title">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 id="unseated-title" className="text-xs font-bold text-ink-900">未入座学生</h3>
                      <p className="mt-0.5 text-[11px] text-ink-500">拖动姓名到上方座位，或点击姓名后再点座位；目标有人时会自动替换</p>
                    </div>
                    <Badge variant={unseated.length > 0 ? 'danger' : 'success'}>{unseated.length} 人</Badge>
                  </div>
                  {unseated.length === 0 ? (
                    <p className="mt-3 text-xs text-success">全部学生已经安排座位</p>
                  ) : (
                    <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                      {unseated.map((student) => {
                        if (student.id == null) return null
                        const selected = arrangingStudentId === student.id
                        return (
                          <UnseatedStudentChip
                            key={student.id}
                            student={student as Student & { id: number }}
                            selected={selected}
                            onSelect={() => {
                              setArrangingStudentId(selected ? null : student.id ?? null)
                              setSelectedSeat(null)
                            }}
                          />
                        )
                      })}
                    </div>
                  )}
                </section>
                {typeof document !== 'undefined'
                  ? createPortal(
                      <DragOverlay dropAnimation={null}>
                        {dragPreview ? (
                          <div
                            aria-hidden
                            className={`min-w-[96px] rotate-1 rounded-menu border px-3 py-2 text-center text-xs font-bold shadow-panel ring-1 ring-black/5 ${
                              dragPreview.kind === 'student'
                                ? 'border-brand-600 bg-brand-600 text-white'
                                : 'border-line bg-white text-ink-900'
                            }`}
                          >
                            {dragPreview.label}
                          </div>
                        ) : null}
                      </DragOverlay>,
                      document.body,
                    )
                  : null}
              </DndContext>
            </>
          )
        ) : (
          <div>
            <div className="hidden print:block print:mb-4">
              <h1 className="text-xl font-bold text-black">{currentClass?.name ?? ''} · 值日表</h1>
            </div>
            <div className="mb-3 flex justify-end gap-2 print:hidden">
              <Button onClick={openAddDuty}>
                <Plus size={14} /> 添加值日组
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                <Printer size={14} /> 打印值日表
              </Button>
            </div>
            {duties.length === 0 ? (
              <EmptyState title="暂无值日安排" hint="添加值日组并选择成员与任务。" />
            ) : (
              <>
                <div className="print:hidden">
                  <ul className="grid gap-2">
                    {[1, 2, 3, 4, 5].map((weekday) => {
                      const dayDuties = sortedDuties.filter((duty) => duty.weekday === weekday)
                      if (dayDuties.length === 0) return null
                      return (
                        <li key={weekday} className="rounded-menu border border-line p-3">
                          <p className="text-xs font-bold text-ink-900">每周{WEEKDAY_NAMES[weekday].slice(1)}</p>
                          <div className="mt-2 grid gap-2">
                            {dayDuties.map((duty) => (
                              <div key={duty.id} className="flex flex-wrap items-center gap-2 rounded-menu bg-surface-muted px-2.5 py-2 text-sm">
                                <Badge variant="blue">{duty.groupName}</Badge>
                                <span className="min-w-0 text-ink-700">{duty.members || '未填写成员'}</span>
                                <span className="text-[11px] text-ink-500">{duty.task || '未填写任务'}</span>
                                <span className="ml-auto flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    aria-label={`编辑：${duty.groupName}`}
                                    onClick={() => openEditDuty(duty)}
                                    className="grid h-8 w-8 place-items-center rounded-menu text-ink-500 hover:bg-white hover:text-brand-600"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`删除：${duty.groupName}`}
                                    onClick={() => setDeleteDuty(duty)}
                                    className="grid h-8 w-8 place-items-center rounded-menu text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </span>
                              </div>
                            ))}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
                <table className="hidden w-full border-collapse text-left text-sm print:table">
                  <thead>
                    <tr className="border-b-2 border-black text-black">
                      <th className="px-2 py-2">星期</th>
                      <th className="px-2 py-2">组名</th>
                      <th className="px-2 py-2">成员</th>
                      <th className="px-2 py-2">任务</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDuties.map((duty) => (
                      <tr key={duty.id} className="border-b border-black text-black">
                        <td className="px-2 py-2">{WEEKDAY_NAMES[duty.weekday] ?? `周${duty.weekday}`}</td>
                        <td className="px-2 py-2">{duty.groupName}</td>
                        <td className="px-2 py-2">{duty.members}</td>
                        <td className="px-2 py-2">{duty.task}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </Panel>

      <DutyEditor
        open={dutyDrawerOpen}
        onClose={() => setDutyDrawerOpen(false)}
        students={students}
        existing={editingDuty}
        defaultGroupName={nextDutyGroupName(duties)}
        onSave={saveDuty}
      />

      <Modal
        open={clearSeatsOpen}
        onClose={() => setClearSeatsOpen(false)}
        title="清空排座"
        footer={
          <>
            <Button onClick={() => setClearSeatsOpen(false)}>取消</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await saveSeatLayout(new Map(), rows, cols, '已清空排座，学生均回到未入座')
                setClearSeatsOpen(false)
                setSelectedSeat(null)
                setArrangingStudentId(null)
              }}
            >
              清空排座
            </Button>
          </>
        }
      >
        清空后当前班级的全部座位安排都会移除，学生需要重新排座。确定继续吗？
      </Modal>

      <Modal
        open={deleteDuty != null}
        onClose={() => setDeleteDuty(null)}
        title="删除值日组"
        footer={
          <>
            <Button onClick={() => setDeleteDuty(null)}>取消</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (deleteDuty?.id != null) await db.dutyAssignments.delete(deleteDuty.id)
                showToast('值日组已删除')
                setDeleteDuty(null)
              }}
            >
              删除
            </Button>
          </>
        }
      >
        确定删除「{deleteDuty?.groupName ?? ''}」吗？删除后无法恢复。
      </Modal>
    </>
  )
}
