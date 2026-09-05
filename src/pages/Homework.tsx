import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { db, nowISO, type Homework } from '../db'
import { todayISO } from '../lib/dates'
import { Badge, Button, Drawer, EmptyState, Field, Input, Modal, Panel, Select, Textarea } from '../components/ui'
import { useToast } from '../contexts/ToastContext'
import { useClassManager } from '../contexts/ClassContext'

function HomeworkDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { classes, currentClass } = useClassManager()
  const { showToast } = useToast()
  const [classId, setClassId] = useState(() => String(currentClass?.id ?? ''))
  const [date, setDate] = useState(todayISO())
  const [content, setContent] = useState('')
  const [minutes, setMinutes] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!content.trim()) {
      setError('请填写作业内容')
      return
    }
    setSaving(true)
    await db.homework.add({
      classId: Number(classId) || currentClass?.id || 0,
      date,
      content: content.trim(),
      estimatedMinutes: minutes ? Number(minutes) : undefined,
      dueAt: dueAt || undefined,
      graded: 0,
      needReview: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    })
    showToast('作业已记录')
    setSaving(false)
    setError(null)
    setContent('')
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title="记录作业" footer={
      <>
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" loading={saving} onClick={handleSave}>保存</Button>
      </>
    }>
      <Field label="授课班级" htmlFor="hw-class">
        <Select id="hw-class" value={classId} onChange={(event) => setClassId(event.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="布置日期" htmlFor="hw-date">
        <Input id="hw-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </Field>
      <Field label="作业内容" error={error ?? undefined} htmlFor="hw-content">
        <Textarea
          id="hw-content"
          value={content}
          placeholder="例如：课本 P42 第 3–8 题"
          onChange={(event) => {
            setContent(event.target.value)
            setError(null)
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="预计用时（分钟）" htmlFor="hw-minutes">
          <Input id="hw-minutes" type="number" min={0} value={minutes} onChange={(event) => setMinutes(event.target.value)} />
        </Field>
        <Field label="提交截止（可选）" htmlFor="hw-due">
          <Input id="hw-due" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </Field>
      </div>
      <p className="text-[11px] leading-4 text-ink-500">首页只提醒待批改作业，不展示全班逐人提交状态。</p>
    </Drawer>
  )
}

export function Homework() {
  const { classes, currentClass } = useClassManager()
  const { showToast } = useToast()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scope, setScope] = useState<'current' | 'all'>('current')
  const [onlyUngraded, setOnlyUngraded] = useState(false)
  const [copySource, setCopySource] = useState<Homework | null>(null)
  const [copyTarget, setCopyTarget] = useState('')

  const homework = useLiveQuery(async () => db.homework.orderBy('date').reverse().toArray(), [], [])!
  const className = (id: number) => classes.find((c) => c.id === id)?.name ?? '未分配班级'
  // F04：默认只看当前班，可切换到全部教学班
  let list = scope === 'all' ? homework : homework.filter((item) => item.classId === currentClass?.id)
  if (onlyUngraded) list = list.filter((item) => item.graded === 0)

  // F14：复制作业到其他班级，生成一条独立记录
  const confirmCopy = async () => {
    if (!copySource?.id) return
    const targetId = Number(copyTarget)
    if (!targetId) {
      showToast('请选择目标班级', { error: true })
      return
    }
    await db.homework.add({
      classId: targetId,
      date: todayISO(),
      content: copySource.content,
      estimatedMinutes: copySource.estimatedMinutes,
      dueAt: copySource.dueAt,
      graded: 0,
      needReview: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    })
    showToast(`已复制到${className(targetId)}`)
    setCopySource(null)
  }

  return (
    <>
      <Panel
        title="作业记录"
        subtitle="记录作业内容与批改状态，可标记“需讲评”"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1" role="group" aria-label="作业范围">
              {(
                [
                  ['current', '当前班'],
                  ['all', '全部教学班'],
                ] as [typeof scope, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setScope(key)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    scope === key ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line text-ink-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOnlyUngraded(!onlyUngraded)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                onlyUngraded ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line text-ink-500'
              }`}
            >
              只看待批改
            </button>
            <Button variant="primary" onClick={() => setDrawerOpen(true)}>
              <Plus size={14} /> 记录作业
            </Button>
          </div>
        }
        bodyClassName="p-0"
      >
        {list.length === 0 ? (
          <div className="p-5">
            <EmptyState title="暂无作业记录" hint="点击「记录作业」保存第一条，可从上一班级复制同一份作业。" />
          </div>
        ) : (
          <ul className="px-4 py-2">
            {list.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 border-t border-line py-3 first:border-t-0">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-[11px] tabular-nums text-ink-500">{item.date}</span>
                    <Badge variant="blue">{className(item.classId)}</Badge>
                    {item.graded === 0 ? <Badge variant="danger">待批改</Badge> : <Badge variant="success">已批改</Badge>}
                    {item.needReview === 1 && <Badge variant="blue">需讲评</Badge>}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-ink-900">{item.content}</p>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    {item.estimatedMinutes ? `预计 ${item.estimatedMinutes} 分钟` : ''}
                    {item.dueAt ? ` · 截止 ${item.dueAt}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCopySource(item)
                      setCopyTarget('')
                    }}
                    className="rounded-ui border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink-700 hover:border-line-strong"
                  >
                    复制到其他班
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (item.id == null) return
                      await db.homework.update(item.id, { graded: item.graded === 0 ? 1 : 0, updatedAt: nowISO() })
                      showToast(item.graded === 0 ? '已标记为已批改' : '已改回待批改')
                    }}
                    className="rounded-ui border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink-700 hover:border-line-strong"
                  >
                    {item.graded === 0 ? '标记批改' : '撤销批改'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (item.id == null) return
                      await db.homework.update(item.id, { needReview: item.needReview === 0 ? 1 : 0, updatedAt: nowISO() })
                    }}
                    className={`rounded-ui border px-2.5 py-1.5 text-[11px] font-semibold ${
                      item.needReview === 1 ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line text-ink-500'
                    }`}
                  >
                    需讲评
                  </button>
                  <button
                    type="button"
                    aria-label="删除作业"
                    onClick={async () => {
                      if (item.id == null) return
                      await db.homework.delete(item.id)
                      showToast('作业记录已删除')
                    }}
                    className="grid h-9 w-9 place-items-center rounded-menu text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <HomeworkDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <Modal
        open={copySource != null}
        onClose={() => setCopySource(null)}
        title="复制作业到其他班"
        footer={
          <>
            <Button onClick={() => setCopySource(null)}>取消</Button>
            <Button variant="primary" onClick={confirmCopy}>
              复制
            </Button>
          </>
        }
      >
        <Field label="目标班级" htmlFor="hw-copy-target">
          <Select id="hw-copy-target" value={copyTarget} onChange={(event) => setCopyTarget(event.target.value)}>
            <option value="">请选择</option>
            {classes
              .filter((c) => c.id !== copySource?.classId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>
        <p className="text-[11px] leading-4 text-ink-500">
          将复制「{copySource?.content}」，日期为今天，批改状态重置为待批改。
        </p>
      </Modal>
    </>
  )
}
