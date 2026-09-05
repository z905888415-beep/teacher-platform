import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { db, nowISO, type CourseTemplate } from '../../db'
import { COURSE_NAME_OPTIONS } from '../../lib/courseColors'
import { addCourse, deleteCourse, updateCourse } from '../../services/timetable'
import { useClassManager } from '../../contexts/ClassContext'
import { useToast } from '../../contexts/ToastContext'
import { Button, Drawer, Field, Input, Modal, Select, Textarea } from '../ui'

export interface CourseEditorTarget {
  /** 编辑已有课程时为课程 id；新增时为 null */
  templateId: number | null
  day: number
  period: number
}

interface CourseDraft {
  subject: string
  teachingClassId: string
  room: string
  weekType: 'all' | 'odd' | 'even'
  note: string
}

const EMPTY_DRAFT: CourseDraft = {
  subject: '数学',
  teachingClassId: '',
  room: '',
  weekType: 'all',
  note: '',
}

/** 课程编辑抽屉：单击课程卡或空白格进入；保存后按新课名立即换色（UI 规范 6.3） */
export function CourseEditor({
  target,
  onClose,
}: {
  target: CourseEditorTarget | null
  onClose: () => void
}) {
  const { classes } = useClassManager()
  const { showToast } = useToast()
  const [draft, setDraft] = useState<CourseDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!target) return
    setConfirmDelete(false)
    setError(null)
    if (target.templateId == null) {
      setDraft({ ...EMPTY_DRAFT, teachingClassId: String(classes[0]?.id ?? '') })
    } else {
      db.courseTemplates.get(target.templateId).then((course) => {
        if (!course) return
        setDraft({
          subject: course.subject,
          teachingClassId: String(course.teachingClassId || classes[0]?.id || ''),
          room: course.room ?? '',
          weekType: course.weekType,
          note: course.note ?? '',
        })
      })
    }
  }, [target, classes])

  if (!target) return null

  const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const isNew = target.templateId == null

  const handleSave = async () => {
    if (!draft.subject.trim()) {
      setError('请填写课名')
      return
    }
    setSaving(true)
    const templateId = target.templateId
    const payload = {
      subject: draft.subject.trim(),
      teachingClassId: Number(draft.teachingClassId) || 0,
      dayOfWeek: target.day,
      period: target.period,
      weekType: draft.weekType,
      room: draft.room.trim() || undefined,
      note: draft.note.trim() || undefined,
    }
    if (templateId == null) {
      await addCourse(payload)
      showToast('课程已添加')
    } else {
      await updateCourse(templateId, payload)
      showToast('课程信息已更新')
    }
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (target.templateId == null) return
    await deleteCourse(target.templateId)
    setConfirmDelete(false)
    showToast('课程已删除')
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? `新增课程 · ${DAY_NAMES[target.day]} 第 ${target.period} 节` : '编辑课程'}
      footer={
        <>
          {!isNew && (
            <Button variant="dangerSoft" onClick={() => setConfirmDelete(true)} aria-label="删除课程">
              <Trash2 size={14} /> 删除
            </Button>
          )}
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <Field label="课名" error={error ?? undefined} hint="同一课名自动使用同一颜色。" htmlFor="course-subject">
        <Input
          id="course-subject"
          list="course-name-options"
          value={draft.subject}
          autoComplete="off"
          onChange={(event) => setDraft((prev) => ({ ...prev, subject: event.target.value }))}
        />
        <datalist id="course-name-options">
          {COURSE_NAME_OPTIONS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </Field>

      <Field label="班级" htmlFor="course-class" hint="没有对应班级时选择「未分配班级」。">
        <Select
          id="course-class"
          value={draft.teachingClassId}
          onChange={(event) => setDraft((prev) => ({ ...prev, teachingClassId: event.target.value }))}
        >
          <option value="0">未分配班级</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="教室（可选）" htmlFor="course-room">
        <Input
          id="course-room"
          value={draft.room}
          placeholder="例如：203"
          autoComplete="off"
          onChange={(event) => setDraft((prev) => ({ ...prev, room: event.target.value }))}
        />
      </Field>

      <Field label="单双周" htmlFor="course-week-type">
        <Select
          id="course-week-type"
          value={draft.weekType}
          onChange={(event) => setDraft((prev) => ({ ...prev, weekType: event.target.value as CourseDraft['weekType'] }))}
        >
          <option value="all">每周</option>
          <option value="odd">单周</option>
          <option value="even">双周</option>
        </Select>
      </Field>

      <Field label="备注（可选）" htmlFor="course-note">
        <Textarea
          id="course-note"
          value={draft.note}
          onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
        />
      </Field>

      <p className="text-[11px] leading-4 text-ink-500">
        位置：{DAY_NAMES[target.day]} 第 {target.period} 节。如需调整位置，请在课表中拖动课程卡。
      </p>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="删除课程"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>取消</Button>
            <Button variant="danger" onClick={handleDelete}>
              删除
            </Button>
          </>
        }
      >
        确定删除这节「{draft.subject}」课程吗？相关的本周调课记录也会一并删除。
      </Modal>
    </Drawer>
  )
}
