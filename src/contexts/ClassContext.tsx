import { createContext, useContext, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowISO, type SchoolClass } from '../db'
import { collectClassRelations, uniqueClassNameError } from '../lib/classes'
import { getSetting, setSetting } from '../hooks/useSetting'
import { useToast } from './ToastContext'

interface ClassContextValue {
  classes: SchoolClass[]
  archivedClasses: SchoolClass[]
  currentClass: SchoolClass | null
  currentClassId: number | null
  ready: boolean
  setCurrentClassId: (id: number) => Promise<void>
  addClass: (name: string, grade?: string) => Promise<string | null>
  renameClass: (id: number, name: string) => Promise<string | null>
  deleteClass: (id: number) => Promise<{ error?: string; blockedBy?: string[] }>
  archiveClass: (id: number) => Promise<void>
  restoreClass: (id: number) => Promise<void>
}

const ClassContext = createContext<ClassContextValue | null>(null)

export function useClassManager(): ClassContextValue {
  const value = useContext(ClassContext)
  if (!value) throw new Error('ClassContext 缺少 Provider')
  return value
}

export function ClassProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast()

  const allClasses = useLiveQuery(async () => db.classes.orderBy('id').toArray(), []) ?? []
  const classes = allClasses.filter((c) => !c.archived)
  const archivedClasses = allClasses.filter((c) => c.archived === 1)
  const currentClassIdStored = useLiveQuery(() => getSetting('currentClassId'), [])
  const ready = useLiveQuery(async () => (await db.classes.count()) > 0, []) ?? false

  const currentClassId = (() => {
    if (classes.length === 0) return null
    const parsed = Number(currentClassIdStored)
    if (Number.isFinite(parsed) && classes.some((c) => c.id === parsed)) return parsed
    return classes[0].id ?? null
  })()
  const currentClass = classes.find((c) => c.id === currentClassId) ?? null

  const value: ClassContextValue = {
    classes,
    archivedClasses,
    currentClass,
    currentClassId,
    ready,
    async setCurrentClassId(id) {
      await setSetting('currentClassId', String(id))
    },
    async addClass(name, grade) {
      const error = uniqueClassNameError(name, allClasses)
      if (error) return error
      const stamp = nowISO()
      const id = await db.classes.add({
        name: name.trim(),
        grade: grade?.trim() || undefined,
        isHomeroom: 0,
        archived: 0,
        createdAt: stamp,
        updatedAt: stamp,
      })
      await setSetting('currentClassId', String(id))
      showToast(`已添加并切换到${name.trim()}`)
      return null
    },
    async renameClass(id, name) {
      const error = uniqueClassNameError(name, allClasses, id)
      if (error) return error
      await db.classes.update(id, { name: name.trim(), updatedAt: nowISO() })
      showToast(`已重命名为${name.trim()}`)
      return null
    },
    async deleteClass(id) {
      if (classes.length <= 1) return { error: '至少需要保留一个班级' }
      const target = classes.find((c) => c.id === id)
      if (!target) return { error: '班级不存在' }

      const blockedBy = await collectClassRelations(id)
      if (blockedBy.length > 0) {
        return { error: `该班级仍有关联数据（${blockedBy.join('、')}），请先迁移或归档`, blockedBy }
      }

      await db.classes.delete(id)
      const rest = classes.filter((c) => c.id !== id)
      if (currentClassId === id && rest[0]?.id != null) {
        await setSetting('currentClassId', String(rest[0].id))
      }
      showToast(`已删除${target.name}`)
      return {}
    },
    async archiveClass(id) {
      await db.classes.update(id, { archived: 1, updatedAt: nowISO() })
      const rest = classes.filter((c) => c.id !== id)
      if (currentClassId === id && rest[0]?.id != null) {
        await setSetting('currentClassId', String(rest[0].id))
      }
      showToast('班级已归档，可在数据与设置中查看并恢复')
    },
    async restoreClass(id) {
      await db.classes.update(id, { archived: 0, updatedAt: nowISO() })
      await setSetting('currentClassId', String(id))
      showToast('班级已恢复并切换为当前班级')
    },
  }

  return <ClassContext.Provider value={value}>{children}</ClassContext.Provider>
}
