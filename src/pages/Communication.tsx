import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { db, nowISO, type Communication, type NotificationTemplate, type Student } from '../db'
import { todayISO } from '../lib/dates'
import { Badge, Button, Drawer, EmptyState, Field, Input, Panel, Select, Textarea } from '../components/ui'
import { useToast } from '../contexts/ToastContext'
import { useClassManager } from '../contexts/ClassContext'
import { deleteCommunicationRecord, saveCommunicationRecord } from '../services/communications'

const METHODS = ['电话', '微信', '面谈', '家长会', '家访']

function CommunicationDrawer({
  open,
  onClose,
  students,
  record,
}: {
  open: boolean
  onClose: () => void
  students: Student[]
  record: Communication | null
}) {
  const { showToast } = useToast()
  const [studentId, setStudentId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState(METHODS[0])
  const [summary, setSummary] = useState('')
  const [needFollowup, setNeedFollowup] = useState(false)
  const [followupDate, setFollowupDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (record) {
      setStudentId(String(record.studentId))
      setDate(record.date)
      setMethod(record.method)
      setSummary(record.summary)
      setNeedFollowup(record.needFollowup === 1)
      setFollowupDate(record.followupDate ?? '')
    } else {
      setStudentId(students[0] ? String(students[0].id) : '')
      setDate(todayISO())
      setMethod(METHODS[0])
      setSummary('')
      setNeedFollowup(false)
      setFollowupDate('')
    }
  }, [open, record, students])

  const handleSave = async () => {
    if (!summary.trim()) {
      setError('请填写沟通摘要')
      return
    }
    if (!studentId) {
      setError('请选择学生')
      return
    }
    if (needFollowup && !followupDate) {
      setError('请选择跟进日期')
      return
    }
    setSaving(true)
    const sid = Number(studentId)
    const student = students.find((item) => item.id === sid)
    try {
      await saveCommunicationRecord(
        {
          studentId: sid,
          studentName: student?.name ?? '',
          date,
          method,
          summary: summary.trim(),
          needFollowup,
          followupDate: needFollowup ? followupDate : undefined,
        },
        record,
      )
      showToast(
        record
          ? '沟通记录已更新，跟进待办已同步'
          : needFollowup
            ? '沟通已记录，并生成跟进待办'
            : '沟通已记录',
      )
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={record ? '编辑沟通记录' : '记录家校沟通'}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <Field label="学生" htmlFor="comm-student" error={error ?? undefined}>
        <Select id="comm-student" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
          <option value="">请选择</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="沟通日期" htmlFor="comm-date">
          <Input id="comm-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="方式" htmlFor="comm-method">
          <Select id="comm-method" value={method} onChange={(event) => setMethod(event.target.value)}>
            {METHODS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="沟通摘要" htmlFor="comm-summary">
        <Textarea
          id="comm-summary"
          value={summary}
          placeholder="沟通主要内容"
          onChange={(event) => {
            setSummary(event.target.value)
            setError(null)
          }}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          checked={needFollowup}
          onChange={(event) => setNeedFollowup(event.target.checked)}
          className="h-4 w-4 accent-[#002FA7]"
        />
        需要跟进
      </label>
      {needFollowup && (
        <div className="mt-3">
          <Field label="跟进日期" htmlFor="comm-followup" hint="设置后将自动生成一条「家校」待办。">
            <Input id="comm-followup" type="date" value={followupDate} onChange={(event) => setFollowupDate(event.target.value)} />
          </Field>
        </div>
      )}
      <p className="text-[11px] leading-4 text-ink-500">本工作台不直接发送微信或短信，请复制摘要到常用渠道联系家长。</p>
    </Drawer>
  )
}

function TemplateDrawer({
  open,
  template,
  onClose,
}: {
  open: boolean
  template: NotificationTemplate | null
  onClose: () => void
}) {
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setTitle(template?.title ?? '')
    setContent(template?.content ?? '')
  }, [open, template])

  const handleSave = async () => {
    if (!title.trim()) {
      setError('请填写模板名称')
      return
    }
    setSaving(true)
    const stamp = nowISO()
    if (template?.id != null) {
      await db.notificationTemplates.update(template.id, { title: title.trim(), content: content.trim(), updatedAt: stamp })
      showToast('模板已更新')
    } else {
      await db.notificationTemplates.add({ title: title.trim(), content: content.trim(), createdAt: stamp, updatedAt: stamp })
      showToast('模板已保存')
    }
    setSaving(false)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={template ? '编辑通知模板' : '新增通知模板'}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <Field label="模板名称" error={error ?? undefined} htmlFor="tpl-title">
        <Input
          id="tpl-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            setError(null)
          }}
        />
      </Field>
      <Field label="内容" htmlFor="tpl-content" hint="支持粘贴到家长群前自行修改细节。">
        <Textarea id="tpl-content" value={content} className="min-h-[180px]" onChange={(event) => setContent(event.target.value)} />
      </Field>
    </Drawer>
  )
}

export function Communication() {
  const { currentClass } = useClassManager()
  const { showToast } = useToast()
  const [tab, setTab] = useState<'records' | 'templates'>('records')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Communication | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)

  const classId = currentClass?.id
  const students = useLiveQuery(
    async () => (classId == null ? [] : db.students.where('classId').equals(classId).toArray()),
    [classId],
    [] as Student[],
  )!
  const records = useLiveQuery(async () => db.communications.orderBy('date').reverse().toArray(), [], [])!
  const templates = useLiveQuery(async () => db.notificationTemplates.toArray(), [], [])!

  const studentName = (id: number) => students.find((s) => s.id === id)?.name ?? '（未知学生）'
  const classStudentIds = new Set(students.map((s) => s.id))
  const visibleRecords = records.filter((record) => classStudentIds.has(record.studentId))

  const copyTemplate = async (template: NotificationTemplate) => {
    try {
      await navigator.clipboard.writeText(template.content)
      showToast('模板已复制')
    } catch {
      showToast('复制失败，请手动选择文本复制', { error: true })
    }
  }

  return (
    <>
      <Panel
        title={`家校沟通 · ${currentClass?.name ?? ''}`}
        subtitle="沟通内容默认不出现在首页，只显示「某学生有待跟进沟通」"
        actions={
          tab === 'records' ? (
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null)
                setDrawerOpen(true)
              }}
            >
              <Plus size={14} /> 记录沟通
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                setEditingTemplate(null)
                setTemplateOpen(true)
              }}
            >
              <Plus size={14} /> 新增模板
            </Button>
          )
        }
        bodyClassName="p-0"
      >
        <div className="flex gap-1 border-b border-line px-4 py-2.5">
          {(
            [
              ['records', '沟通记录'],
              ['templates', '通知模板'],
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

        {tab === 'records' ? (
          visibleRecords.length === 0 ? (
            <div className="p-5">
              <EmptyState title="暂无沟通记录" hint="点击「记录沟通」保存第一条，可勾选「需要跟进」自动生成待办。" />
            </div>
          ) : (
            <ol className="px-4 py-3">
              {visibleRecords.map((record) => (
                <li key={record.id} className="relative border-l-2 border-line pb-4 pl-4 last:pb-0">
                  <span aria-hidden className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-brand-600" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] tabular-nums text-ink-500">{record.date}</span>
                    <button
                      type="button"
                      className="text-sm font-semibold text-ink-900 hover:text-brand-600"
                      onClick={() => {
                        setEditing(record)
                        setDrawerOpen(true)
                      }}
                    >
                      {studentName(record.studentId)}
                    </button>
                    <Badge>{record.method}</Badge>
                    {record.needFollowup === 1 && <Badge variant="blue">需要跟进</Badge>}
                    {record.followupDate && <span className="text-[11px] text-ink-500">跟进：{record.followupDate}</span>}
                    <button
                      type="button"
                      aria-label="删除记录"
                      onClick={async () => {
                        if (record.id == null) return
                        await deleteCommunicationRecord(record)
                        showToast('沟通记录已删除')
                      }}
                      className="ml-auto grid h-8 w-8 place-items-center rounded-menu text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-ink-700">{record.summary}</p>
                </li>
              ))}
            </ol>
          )
        ) : templates.length === 0 ? (
          <div className="p-5">
            <EmptyState title="暂无通知模板" hint="保存常用的家长群通知，一键复制。" />
          </div>
        ) : (
          <ul className="grid gap-3 p-4">
            {templates.map((template) => (
              <li key={template.id} className="rounded-card border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-sm font-bold text-ink-900 hover:text-brand-600"
                    onClick={() => {
                      setEditingTemplate(template)
                      setTemplateOpen(true)
                    }}
                  >
                    {template.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyTemplate(template)}
                    className="inline-flex h-9 items-center gap-1 rounded-ui border border-line px-3 text-xs font-semibold text-ink-700 hover:border-line-strong"
                  >
                    <Copy size={13} /> 复制
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-700">{template.content}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <CommunicationDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditing(null)
        }}
        students={students}
        record={editing}
      />
      <TemplateDrawer
        open={templateOpen}
        template={editingTemplate}
        onClose={() => {
          setTemplateOpen(false)
          setEditingTemplate(null)
        }}
      />
    </>
  )
}
