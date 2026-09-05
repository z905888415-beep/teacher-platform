import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { db, nowISO, type NotificationTemplate } from '../db'
import { Badge, Button, Drawer, EmptyState, Field, Input, Panel, Textarea } from '../components/ui'
import { useToast } from '../contexts/ToastContext'

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
      setError('请填写文档名称')
      return
    }
    setSaving(true)
    const stamp = nowISO()
    if (template?.id != null) {
      await db.notificationTemplates.update(template.id, { title: title.trim(), content: content.trim(), updatedAt: stamp })
      showToast('文档已更新')
    } else {
      await db.notificationTemplates.add({ title: title.trim(), content: content.trim(), createdAt: stamp, updatedAt: stamp })
      showToast('文档已保存')
    }
    setSaving(false)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={template ? '编辑文档' : '新增常用文档'}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <Field label="名称" error={error ?? undefined} htmlFor="doc-title">
        <Input
          id="doc-title"
          value={title}
          placeholder="例如：期末评语模板"
          onChange={(event) => {
            setTitle(event.target.value)
            setError(null)
          }}
        />
      </Field>
      <Field label="内容" htmlFor="doc-content" hint="保存通知、评语、表格文字模板，使用时一键复制。">
        <Textarea id="doc-content" value={content} className="min-h-[200px]" onChange={(event) => setContent(event.target.value)} />
      </Field>
    </Drawer>
  )
}

export function Documents() {
  const { showToast } = useToast()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<NotificationTemplate | null>(null)

  const templates = useLiveQuery(async () => db.notificationTemplates.toArray(), [], [])!

  const copy = async (template: NotificationTemplate) => {
    try {
      await navigator.clipboard.writeText(template.content)
      showToast('已复制到剪贴板')
    } catch {
      showToast('复制失败，请手动选择文本复制', { error: true })
    }
  }

  return (
    <>
      <Panel
        title="常用文档"
        subtitle="可复制的通知、评语和表格模板"
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null)
              setDrawerOpen(true)
            }}
          >
            <Plus size={14} /> 新增文档
          </Button>
        }
        bodyClassName="p-0"
      >
        {templates.length === 0 ? (
          <div className="p-5">
            <EmptyState title="暂无常用文档" hint="把常用的通知、评语存在这里，随取随用。" />
          </div>
        ) : (
          <ul className="grid gap-3 p-4">
            {templates.map((template) => (
              <li key={template.id} className="rounded-card border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm font-bold text-ink-900 hover:text-brand-600"
                    onClick={() => {
                      setEditing(template)
                      setDrawerOpen(true)
                    }}
                  >
                    {template.title}
                    <Badge>模板</Badge>
                  </button>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copy(template)}
                      className="inline-flex h-9 items-center gap-1 rounded-ui border border-line px-3 text-xs font-semibold text-ink-700 hover:border-line-strong"
                    >
                      <Copy size={13} /> 复制
                    </button>
                    <button
                      type="button"
                      aria-label="删除文档"
                      onClick={async () => {
                        if (template.id == null) return
                        await db.notificationTemplates.delete(template.id)
                        showToast('文档已删除')
                      }}
                      className="grid h-9 w-9 place-items-center rounded-menu text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-700">{template.content}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <TemplateDrawer
        open={drawerOpen}
        template={editing}
        onClose={() => {
          setDrawerOpen(false)
          setEditing(null)
        }}
      />
    </>
  )
}
