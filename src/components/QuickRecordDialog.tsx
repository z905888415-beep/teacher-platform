import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, nowISO, type EventType, type TodoCategory } from '../db'
import { todayISO } from '../lib/dates'
import { Button, Field, Input, Modal, Select, Textarea } from './ui'
import { useToast } from '../contexts/ToastContext'
import { useClassManager } from '../contexts/ClassContext'

type RecordType = '待办' | '临时调课' | '请假' | '家校沟通' | '校历事项'

const RECORD_TYPES: RecordType[] = ['待办', '临时调课', '请假', '家校沟通', '校历事项']

interface StudentOption {
  id: number
  name: string
  classId: number
}

/** 首页右上角「新增记录」统一入口（开发文档 6.5） */
export function QuickRecordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { classes, currentClassId } = useClassManager()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [type, setType] = useState<RecordType>('待办')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayISO())
  const [studentId, setStudentId] = useState('')
  const [extra, setExtra] = useState('')
  const [students, setStudents] = useState<StudentOption[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDate(todayISO())
    setTitle('')
    setExtra('')
    setType('待办')
    db.students
      .where('classId')
      .equals(currentClassId ?? -1)
      .toArray()
      .then((rows) => {
        setStudents(rows.map((s) => ({ id: s.id ?? 0, name: s.name, classId: s.classId })))
        setStudentId(rows[0] ? String(rows[0].id) : '')
      })
  }, [open, currentClassId])

  const needsStudent = type === '请假' || type === '家校沟通'
  const needsTitle = type !== '请假'

  const handleSave = async () => {
    if (needsTitle && !title.trim()) {
      showToast('请填写标题', { error: true })
      return
    }
    if (needsStudent && !studentId) {
      showToast('当前班级暂无学生，请先在「学生与家长」中添加', { error: true })
      return
    }
    setSaving(true)
    const stamp = nowISO()
    try {
      if (type === '待办') {
        await db.todos.add({
          title: title.trim(),
          dueAt: date,
          priority: 'normal',
          category: '教学' as TodoCategory,
          note: extra.trim() || undefined,
          createdAt: stamp,
          updatedAt: stamp,
        })
        showToast('待办已新增')
      } else if (type === '临时调课') {
        navigate('/timetable')
        showToast('请在课表中拖动课程完成临时调课')
      } else if (type === '请假') {
        await db.leaves.add({
          studentId: Number(studentId),
          startAt: date,
          endAt: extra.trim() || date,
          type: '病假',
          parentConfirmed: 0,
          createdAt: stamp,
        })
        showToast('请假已登记')
      } else if (type === '家校沟通') {
        await db.communications.add({
          studentId: Number(studentId),
          date,
          method: '电话',
          summary: title.trim(),
          needFollowup: 0,
          createdAt: stamp,
          updatedAt: stamp,
        })
        showToast('家校沟通已记录')
      } else {
        await db.calendarEvents.add({
          title: title.trim(),
          startAt: date,
          type: '其他' as EventType,
          note: extra.trim() || undefined,
          createdAt: stamp,
          updatedAt: stamp,
        })
        showToast('校历事项已新增')
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const classStudents = students.filter((s) => s.classId === currentClassId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新增记录"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <Field label="记录类型" htmlFor="quick-type">
        <Select id="quick-type" value={type} onChange={(event) => setType(event.target.value as RecordType)}>
          {RECORD_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>

      {needsStudent && (
        <Field label="学生（当前班级）" htmlFor="quick-student">
          <Select id="quick-student" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            {classStudents.length === 0 && <option value="">暂无学生</option>}
            {classStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {needsTitle && (
        <Field label={type === '校历事项' ? '事项名称' : type === '家校沟通' ? '沟通摘要' : '标题'} htmlFor="quick-title">
          <Input
            id="quick-title"
            value={title}
            placeholder="请输入内容"
            autoComplete="off"
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
      )}

      <Field label={type === '请假' ? '请假日期' : '日期'} htmlFor="quick-date">
        <Input id="quick-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </Field>

      {type === '请假' && (
        <Field label="结束日期（可选，默认当天）" htmlFor="quick-leave-end">
          <Input
            id="quick-leave-end"
            type="date"
            value={extra}
            onChange={(event) => setExtra(event.target.value)}
          />
        </Field>
      )}

      {(type === '待办' || type === '校历事项') && (
        <Field label="备注（可选）" htmlFor="quick-note">
          <Textarea
            id="quick-note"
            value={extra}
            placeholder="补充说明"
            onChange={(event) => setExtra(event.target.value)}
          />
        </Field>
      )}

      {type === '临时调课' && (
        <p className="text-xs leading-5 text-ink-500">
          临时调课在课表中完成：拖动课程卡到目标格，选择「仅本周」即可，不会影响基础课表。
        </p>
      )}
      {classes.length === 0 && <p className="text-xs text-danger-600">请先添加班级。</p>}
    </Modal>
  )
}
