import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { db, nowISO, type Resource } from '../db'
import { Badge, Button, Drawer, EmptyState, Field, Input, Panel, Select, Textarea } from '../components/ui'
import { useToast } from '../contexts/ToastContext'

const TYPES: Resource['type'][] = ['教案', '课件', '试题', '微课', '反思']

function ResourceDrawer({ open, resource, onClose }: { open: boolean; resource: Resource | null; onClose: () => void }) {
  const { showToast } = useToast()
  const [draft, setDraft] = useState<{
    title: string
    type: Resource['type']
    grade: string
    volume: string
    chapter: string
    link: string
    note: string
    courseTemplateId: string
  }>({
    title: '',
    type: '教案',
    grade: '',
    volume: '',
    chapter: '',
    link: '',
    note: '',
    courseTemplateId: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const courses = useLiveQuery(async () => {
    const [rows, classes] = await Promise.all([db.courseTemplates.toArray(), db.classes.toArray()])
    const nameById = new Map(classes.map((c) => [c.id ?? 0, c.name]))
    return rows
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.period - b.period)
      .map((course) => ({
        id: course.id ?? 0,
        label: `周${['', '一', '二', '三', '四', '五', '六', '日'][course.dayOfWeek]}第 ${course.period} 节 · ${course.subject} · ${nameById.get(course.teachingClassId) ?? '未分配班级'}`,
      }))
  }, [], [])!

  useEffect(() => {
    if (!open) return
    setError(null)
    setDraft({
      title: resource?.title ?? '',
      type: resource?.type ?? '教案',
      grade: resource?.grade ?? '',
      volume: resource?.volume ?? '',
      chapter: resource?.chapter ?? '',
      link: resource?.link ?? '',
      note: resource?.note ?? '',
      courseTemplateId: resource?.courseTemplateId ? String(resource.courseTemplateId) : '',
    })
  }, [open, resource])

  const update = (patch: Partial<typeof draft>) => setDraft((prev) => ({ ...prev, ...patch }))

  const handleSave = async () => {
    if (!draft.title.trim()) {
      setError('请填写资料名称')
      return
    }
    setSaving(true)
    const stamp = nowISO()
    const payload = {
      title: draft.title.trim(),
      type: draft.type,
      grade: draft.grade.trim() || undefined,
      volume: draft.volume.trim() || undefined,
      chapter: draft.chapter.trim() || undefined,
      link: draft.link.trim() || undefined,
      note: draft.note.trim() || undefined,
      courseTemplateId: draft.courseTemplateId ? Number(draft.courseTemplateId) : undefined,
    }
    if (resource?.id != null) {
      await db.resources.update(resource.id, { ...payload, updatedAt: stamp })
      showToast('备课资料已更新')
    } else {
      await db.resources.add({ ...payload, createdAt: stamp, updatedAt: stamp })
      showToast('备课资料已保存')
    }
    setSaving(false)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={resource ? '编辑备课资料' : '新增备课资料'}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <Field label="资料名称" error={error ?? undefined} htmlFor="res-title">
        <Input id="res-title" value={draft.title} onChange={(event) => update({ title: event.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="类型" htmlFor="res-type">
          <Select id="res-type" value={draft.type} onChange={(event) => update({ type: event.target.value as Resource['type'] })}>
            {TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="年级" htmlFor="res-grade">
          <Input id="res-grade" value={draft.grade} placeholder="初二" onChange={(event) => update({ grade: event.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="册别" htmlFor="res-volume">
          <Input id="res-volume" value={draft.volume} placeholder="上册" onChange={(event) => update({ volume: event.target.value })} />
        </Field>
        <Field label="章节" htmlFor="res-chapter">
          <Input id="res-chapter" value={draft.chapter} placeholder="第三章" onChange={(event) => update({ chapter: event.target.value })} />
        </Field>
      </div>
      <Field label="本地路径或网络链接" htmlFor="res-link" hint="首版不内置文档编辑器，只管理资料位置和备注。">
        <Input id="res-link" value={draft.link} placeholder="D:\备课资料\… 或 https://…" onChange={(event) => update({ link: event.target.value })} />
      </Field>
      <Field label="关联课程（可选）" htmlFor="res-course">
        <Select
          id="res-course"
          value={draft.courseTemplateId}
          onChange={(event) => update({ courseTemplateId: event.target.value })}
        >
          <option value="">不关联</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="备注（可选）" htmlFor="res-note">
        <Textarea id="res-note" value={draft.note} onChange={(event) => update({ note: event.target.value })} />
      </Field>
    </Drawer>
  )
}

export function Resources() {
  const { showToast } = useToast()
  const [filter, setFilter] = useState<'全部' | Resource['type']>('全部')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Resource | null>(null)

  const resources = useLiveQuery(async () => {
    const rows = await db.resources.toArray()
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [], [])!
  const courseLabels = useLiveQuery(async () => {
    const [rows, classes] = await Promise.all([db.courseTemplates.toArray(), db.classes.toArray()])
    const nameById = new Map(classes.map((c) => [c.id ?? 0, c.name]))
    return new Map<number, string>(
      rows.map((course) => [
        course.id ?? 0,
        `周${['', '一', '二', '三', '四', '五', '六', '日'][course.dayOfWeek]}第${course.period}节 ${course.subject}`,
      ]),
    )
  }, [], new Map<number, string>())!
  const filtered = filter === '全部' ? resources : resources.filter((item) => item.type === filter)

  return (
    <>
      <Panel
        title="备课资料"
        subtitle="教案、课件、试题、微课链接与教学反思统一管理"
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null)
              setDrawerOpen(true)
            }}
          >
            <Plus size={14} /> 新增资料
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
          {(['全部', ...TYPES] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                filter === item ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line text-ink-500 hover:border-line-strong'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState title="暂无备课资料" hint="保存本地文件路径或网络链接，方便课前快速打开。" />
          </div>
        ) : (
          <ul className="grid gap-2 p-4">
            {filtered.map((resource) => (
              <li key={resource.id} className="flex items-start justify-between gap-3 rounded-menu border border-line px-4 py-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setEditing(resource)
                    setDrawerOpen(true)
                  }}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink-900">{resource.title}</span>
                    <Badge variant="blue">{resource.type}</Badge>
                    {resource.courseTemplateId != null && courseLabels.get(resource.courseTemplateId) && (
                      <Badge>{courseLabels.get(resource.courseTemplateId)}</Badge>
                    )}
                    {resource.grade && <Badge>{[resource.grade, resource.volume, resource.chapter].filter(Boolean).join(' · ')}</Badge>}
                  </span>
                  {resource.link && <span className="mt-1 block truncate text-[11px] text-ink-500">{resource.link}</span>}
                  {resource.note && <span className="mt-0.5 block text-[11px] leading-4 text-ink-500">{resource.note}</span>}
                </button>
                <span className="flex shrink-0 items-center gap-1">
                  {resource.link && /^https?:/.test(resource.link) && (
                    <a
                      href={resource.link}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="打开链接"
                      title="打开链接"
                      className="grid h-9 w-9 place-items-center rounded-menu text-ink-500 hover:bg-surface-muted hover:text-brand-600"
                    >
                      <ExternalLink size={15} />
                    </a>
                  )}
                  <button
                    type="button"
                    aria-label="删除资料"
                    onClick={async () => {
                      if (resource.id == null) return
                      await db.resources.delete(resource.id)
                      showToast('备课资料已删除')
                    }}
                    className="grid h-9 w-9 place-items-center rounded-menu text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ResourceDrawer
        open={drawerOpen}
        resource={editing}
        onClose={() => {
          setDrawerOpen(false)
          setEditing(null)
        }}
      />
    </>
  )
}
