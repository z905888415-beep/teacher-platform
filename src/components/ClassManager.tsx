import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Badge, Button, Field, Input, Modal } from './ui'
import { useClassManager } from '../contexts/ClassContext'
import { collectClassRelations } from '../lib/classes'

interface ClassActionsValue {
  openAddClass: () => void
  openRenameClass: () => void
  openDeleteClass: () => void
}

const ClassActionsContext = createContext<ClassActionsValue>({
  openAddClass: () => {},
  openRenameClass: () => {},
  openDeleteClass: () => {},
})

export function useClassActions(): ClassActionsValue {
  return useContext(ClassActionsContext)
}

/** 班级添加 / 删除对话框：顶栏与首页课表区共用同一入口（UI 规范 6.7） */
export function ClassActionsProvider({ children }: { children: ReactNode }) {
  const [addOpen, setAddOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const location = useLocation()

  // F06：切换页面时关闭弹层，避免挡住后续页面
  useEffect(() => {
    setAddOpen(false)
    setRenameOpen(false)
    setDeleteOpen(false)
  }, [location.pathname])

  return (
    <ClassActionsContext.Provider
      value={{
        openAddClass: () => setAddOpen(true),
        openRenameClass: () => setRenameOpen(true),
        openDeleteClass: () => setDeleteOpen(true),
      }}
    >
      {children}
      <AddClassDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <RenameClassDialog open={renameOpen} onClose={() => setRenameOpen(false)} />
      <DeleteClassDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </ClassActionsContext.Provider>
  )
}

export function AddClassDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addClass } = useClassManager()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setName('')
    setError(null)
    setSaving(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const message = await addClass(name)
    setSaving(false)
    if (message) {
      setError(message)
      return
    }
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="添加班级"
      footer={
        <>
          <Button
            onClick={() => {
              reset()
              onClose()
            }}
          >
            取消
          </Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            添加
          </Button>
        </>
      }
    >
      <Field label="班级名称" error={error ?? undefined} hint="添加后可在课程编辑中选择该班级。" htmlFor="add-class-name">
        <Input
          id="add-class-name"
          value={name}
          placeholder="例如：初二（6）班"
          autoComplete="off"
          autoFocus
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSave()
          }}
        />
      </Field>
    </Modal>
  )
}

export function RenameClassDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { renameClass, currentClass } = useClassManager()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName(currentClass?.name ?? '')
  }, [open, currentClass?.name])

  const handleSave = async () => {
    if (!currentClass?.id) return
    setSaving(true)
    const message = await renameClass(currentClass.id, name)
    setSaving(false)
    if (message) {
      setError(message)
      return
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="重命名班级"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <Field label="班级名称" error={error ?? undefined} htmlFor="rename-class-name">
        <Input
          id="rename-class-name"
          value={name}
          autoComplete="off"
          autoFocus
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSave()
          }}
        />
      </Field>
    </Modal>
  )
}

export function DeleteClassDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { deleteClass, archiveClass, currentClass } = useClassManager()
  const [error, setError] = useState<string | null>(null)
  const [blockedBy, setBlockedBy] = useState<string[]>([])
  const [confirmStep, setConfirmStep] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !currentClass?.id) return
    void collectClassRelations(currentClass.id).then((items) => {
      setBlockedBy(items)
      if (items.length > 0) setError(`该班级仍有关联数据（${items.join('、')}），请先迁移或归档`)
    })
  }, [open, currentClass?.id])

  const reset = () => {
    setError(null)
    setBlockedBy([])
    setConfirmStep(false)
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!currentClass?.id) return
    setSaving(true)
    const result = await deleteClass(currentClass.id)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      setBlockedBy(result.blockedBy ?? [])
      return
    }
    reset()
    onClose()
  }

  const handleArchive = async () => {
    if (!currentClass?.id) return
    await archiveClass(currentClass.id)
    reset()
    onClose()
  }

  if (!currentClass) return null

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="删除班级"
      footer={
        <>
          <Button
            onClick={() => {
              reset()
              onClose()
            }}
          >
            取消
          </Button>
          {blockedBy.length > 0 ? (
            <Button variant="primary" onClick={handleArchive}>
              归档该班级
            </Button>
          ) : confirmStep ? (
            <Button variant="danger" loading={saving} onClick={handleDelete}>
              确认删除
            </Button>
          ) : (
            <Button variant="dangerSoft" onClick={() => setConfirmStep(true)}>
              删除班级
            </Button>
          )}
        </>
      }
    >
      {blockedBy.length > 0 ? (
        <div className="space-y-3">
          <p>
            「<strong className="text-ink-900">{currentClass.name}</strong>」仍有关联数据，不能直接删除：
          </p>
          <p className="flex flex-wrap gap-1.5">
            {blockedBy.map((item) => (
              <Badge key={item} variant="danger">
                {item}
              </Badge>
            ))}
          </p>
          {error && <p className="text-xs font-medium text-danger-600">{error}</p>}
          <p className="text-xs leading-5 text-ink-500">建议先迁移学生与成绩，或将班级归档。归档后班级从选择器隐藏，数据保留。</p>
        </div>
      ) : confirmStep ? (
        <p>
          <strong className="text-danger-600">再次确认：</strong>
          将删除「<strong className="text-ink-900">{currentClass.name}</strong>」，删除后不可恢复。
        </p>
      ) : (
        <p>
          确定删除「<strong className="text-ink-900">{currentClass.name}</strong>」吗？
          仅当没有任何关联学生、课程和其他业务数据时才能删除。
        </p>
      )}
    </Modal>
  )
}
