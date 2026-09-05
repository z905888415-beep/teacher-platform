import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Eye, EyeOff, FileSpreadsheet, FileDown, Plus, Trash2, Upload } from 'lucide-react'
import { db, nowISO, type Student } from '../db'
import { parseCSV } from '../lib/csv'
import { downloadStudentExample40, downloadStudentExport, downloadStudentTemplate } from '../lib/studentExcel'
import { Badge, Button, Drawer, EmptyState, Field, Input, Modal, Panel, Select, Textarea } from '../components/ui'
import { StudentExcelImportDialog } from '../components/students/StudentExcelImportDialog'
import { useToast } from '../contexts/ToastContext'
import { useClassManager } from '../contexts/ClassContext'

interface StudentDraft {
  studentNo: string
  name: string
  gender: string
  birthday: string
  parentName: string
  parentPhone: string
  emergencyContact: string
  boarding: string
  note: string
}

const EMPTY_DRAFT: StudentDraft = {
  studentNo: '',
  name: '',
  gender: '男',
  birthday: '',
  parentName: '',
  parentPhone: '',
  emergencyContact: '',
  boarding: '走读',
  note: '',
}

function StudentFormDrawer({
  open,
  student,
  classId,
  onClose,
}: {
  open: boolean
  student: Student | null
  classId: number
  onClose: () => void
}) {
  const { showToast } = useToast()
  const [draft, setDraft] = useState<StudentDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (student) {
      setDraft({
        studentNo: student.studentNo ?? '',
        name: student.name,
        gender: student.gender ?? '男',
        birthday: student.birthday ?? '',
        parentName: student.parentName ?? '',
        parentPhone: student.parentPhone ?? '',
        emergencyContact: student.emergencyContact ?? '',
        boarding: student.boarding ?? '走读',
        note: student.note ?? '',
      })
    } else {
      setDraft(EMPTY_DRAFT)
    }
  }, [open, student])

  const update = (patch: Partial<StudentDraft>) => setDraft((prev) => ({ ...prev, ...patch }))

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setError('请填写学生姓名')
      return
    }
    if (!classId) {
      setError('请先在顶部选择班级')
      return
    }
    setSaving(true)
    const stamp = nowISO()
    const payload = {
      studentNo: draft.studentNo.trim() || undefined,
      name: draft.name.trim(),
      gender: draft.gender,
      birthday: draft.birthday || undefined,
      parentName: draft.parentName.trim() || undefined,
      parentPhone: draft.parentPhone.trim() || undefined,
      emergencyContact: draft.emergencyContact.trim() || undefined,
      boarding: draft.boarding,
      note: draft.note.trim() || undefined,
    }
    if (student?.id != null) {
      await db.students.update(student.id, { ...payload, updatedAt: stamp })
      showToast('学生信息已更新')
    } else {
      await db.students.add({ ...payload, classId, createdAt: stamp, updatedAt: stamp })
      showToast('学生已添加')
    }
    setSaving(false)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={student ? '学生详情' : '新增学生'}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="姓名" error={error ?? undefined} htmlFor="student-name">
          <Input id="student-name" value={draft.name} onChange={(event) => update({ name: event.target.value })} />
        </Field>
        <Field label="班内编号" htmlFor="student-no">
          <Input id="student-no" value={draft.studentNo} placeholder="例如：01" onChange={(event) => update({ studentNo: event.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="性别" htmlFor="student-gender">
          <Select id="student-gender" value={draft.gender} onChange={(event) => update({ gender: event.target.value })}>
            <option value="男">男</option>
            <option value="女">女</option>
          </Select>
        </Field>
        <Field label="生日" htmlFor="student-birthday">
          <Input id="student-birthday" type="date" value={draft.birthday} onChange={(event) => update({ birthday: event.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="家长姓名" htmlFor="student-parent">
          <Input id="student-parent" value={draft.parentName} onChange={(event) => update({ parentName: event.target.value })} />
        </Field>
        <Field label="家长电话" htmlFor="student-phone">
          <Input id="student-phone" value={draft.parentPhone} onChange={(event) => update({ parentPhone: event.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="紧急联系人" htmlFor="student-emergency">
          <Input id="student-emergency" value={draft.emergencyContact} onChange={(event) => update({ emergencyContact: event.target.value })} />
        </Field>
        <Field label="住宿类型" htmlFor="student-boarding">
          <Select id="student-boarding" value={draft.boarding} onChange={(event) => update({ boarding: event.target.value })}>
            <option value="走读">走读</option>
            <option value="住宿">住宿</option>
            <option value="午托">午托</option>
          </Select>
        </Field>
      </div>
      <Field label="敏感备注（仅详情可见，列表不展示）" htmlFor="student-note">
        <Textarea id="student-note" value={draft.note} onChange={(event) => update({ note: event.target.value })} />
      </Field>
    </Drawer>
  )
}

/** CSV 粘贴导入：首行表头需包含「姓名」 */
function ImportDialog({ open, onClose, classId }: { open: boolean; onClose: () => void; classId: number }) {
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const rows = text.trim() ? parseCSV(text) : []
  const header = rows[0] ?? []
  const nameIndex = header.findIndex((cell) => cell.includes('姓名'))
  const invalid = text.trim() && nameIndex === -1 ? '首行需要包含「姓名」列' : null
  const importCount = nameIndex >= 0 ? rows.slice(1).filter((row) => row[nameIndex]?.trim()).length : 0

  const handleImport = async () => {
    if (invalid || importCount === 0) {
      setError('没有可导入的数据')
      return
    }
    const index = (label: string) => header.findIndex((cell) => cell.includes(label))
    const noIndex = index('编号')
    const parentIndex = index('家长')
    const phoneIndex = index('电话')
    const boardingIndex = index('住宿')
    const stamp = nowISO()
    let count = 0
    for (const row of rows.slice(1)) {
      const name = row[nameIndex]?.trim()
      if (!name) continue
      await db.students.add({
        classId,
        name,
        studentNo: noIndex >= 0 ? row[noIndex]?.trim() || undefined : undefined,
        parentName: parentIndex >= 0 ? row[parentIndex]?.trim() || undefined : undefined,
        parentPhone: phoneIndex >= 0 ? row[phoneIndex]?.trim() || undefined : undefined,
        boarding: boardingIndex >= 0 ? row[boardingIndex]?.trim() || '走读' : '走读',
        createdAt: stamp,
        updatedAt: stamp,
      })
      count += 1
    }
    showToast(`已导入 ${count} 名学生`)
    setText('')
    setError(null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="粘贴 CSV 导入学生"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={handleImport}>
            导入
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs leading-5 text-ink-500">
        从 Excel 复制后直接粘贴。首行写列名，需包含「姓名」，支持：姓名、班内编号、家长姓名、家长电话、住宿类型。
      </p>
      <Textarea
        value={text}
        placeholder={'姓名,班内编号,家长姓名,家长电话,住宿类型\n张三,07,张先生,13800000000,走读'}
        onChange={(event) => {
          setText(event.target.value)
          setError(null)
        }}
        className="min-h-[160px] font-mono text-xs"
      />
      {invalid && <p className="mt-2 text-xs text-danger-600">{invalid}</p>}
      {!invalid && importCount > 0 && (
        <p className="mt-2 text-xs text-ink-500">
          将导入 <strong className="text-ink-900">{importCount}</strong> 名学生。
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger-600">{error}</p>}
    </Modal>
  )
}

export function Students() {
  const { currentClass } = useClassManager()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [phoneVisible, setPhoneVisible] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [excelImportOpen, setExcelImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [deleteInfo, setDeleteInfo] = useState('')

  const classId = currentClass?.id
  const students = useLiveQuery(
    async () => {
      if (classId == null) return []
      const rows = await db.students.where('classId').equals(classId).toArray()
      return rows.sort(
        (a, b) => (a.studentNo ?? '').localeCompare(b.studentNo ?? '', 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN'),
      )
    },
    [classId],
    [] as Student[],
  )!

  const keyword = search.trim()
  const filtered = students.filter(
    (student) => student.name.includes(keyword) || (student.parentName ?? '').includes(keyword),
  )

  const openDelete = async (student: Student) => {
    if (student.id == null) return
    const [attendanceCount, leaveCount, commCount, scoreCount] = await Promise.all([
      db.attendance.where('studentId').equals(student.id).count(),
      db.leaves.where('studentId').equals(student.id).count(),
      db.communications.where('studentId').equals(student.id).count(),
      db.mathScores.where('studentId').equals(student.id).count(),
    ])
    const total = attendanceCount + leaveCount + commCount + scoreCount
    setDeleteInfo(
      total > 0
        ? `该学生有 ${total} 条关联记录（出勤、请假、沟通、成绩），删除学生后这些记录保留，但不再关联到人。`
        : '该学生暂无关联记录。',
    )
    setDeleteTarget(student)
  }

  const confirmDelete = async () => {
    if (deleteTarget?.id == null) return
    await db.students.delete(deleteTarget.id)
    showToast('学生已删除')
    setDeleteTarget(null)
  }

  const openNew = () => {
    setEditing(null)
    setDrawerOpen(true)
  }

  const openExcelImport = () => {
    if (classId == null) {
      showToast('请先在顶部选择班级')
      return
    }
    setExcelImportOpen(true)
  }

  const exportCurrentClass = () => {
    if (currentClass == null || classId == null) {
      showToast('请先在顶部选择班级')
      return
    }
    downloadStudentExport(currentClass.name, students)
    showToast(`已导出「${currentClass.name}」${students.length} 名学生`)
  }

  return (
    <Panel
      title={`学生与家长 · ${currentClass?.name ?? ''}`}
      subtitle={`${students.length} 名学生 · 电话默认部分隐藏，点「显示」后本次会话内可见 · 敏感备注不在列表展示 · Excel 仅在本机解析`}
      actions={
        <>
          <Button onClick={openExcelImport} disabled={classId == null}>
            <FileSpreadsheet size={14} /> Excel 导入
          </Button>
          <Button onClick={() => setImportOpen(true)} disabled={classId == null}>
            <Upload size={14} /> 粘贴导入
          </Button>
          <Button onClick={exportCurrentClass} disabled={classId == null}>
            <Download size={14} /> 导出当前班
          </Button>
          <Button onClick={downloadStudentTemplate}>
            <FileDown size={14} /> 下载模板
          </Button>
          <Button onClick={downloadStudentExample40}>
            <FileDown size={14} /> 40 人示例
          </Button>
          <Button variant="primary" onClick={openNew} disabled={classId == null}>
            <Plus size={14} /> 新增学生
          </Button>
        </>
      }
      bodyClassName="p-0"
    >
      <div className="border-b border-line px-4 py-2.5">
        <Input
          value={search}
          placeholder="搜索学生姓名或家长姓名"
          aria-label="搜索学生"
          className="max-w-[280px]"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title={keyword ? '没有匹配的学生' : '当前班级暂无学生'}
            hint={keyword ? '试试更换关键字，或清除搜索。' : '手动新增，或下载模板后使用 Excel 导入。'}
            action={
              keyword ? (
                <Button onClick={() => setSearch('')}>清除搜索</Button>
              ) : (
                <Button variant="primary" onClick={openNew}>
                  新增学生
                </Button>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-semibold text-ink-500">
                  <th scope="col" className="px-4 py-2.5 font-semibold">编号</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">姓名</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">家长</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">电话</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">住宿</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id} className="border-b border-line last:border-b-0 hover:bg-[#FAFBFE]">
                    <td className="px-4 py-2.5 tabular-nums text-ink-500">{student.studentNo ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        className="font-semibold text-ink-900 hover:text-brand-600"
                        onClick={() => {
                          setEditing(student)
                          setDrawerOpen(true)
                        }}
                      >
                        {student.name}
                      </button>
                      <span className="ml-2 text-[11px] text-ink-500">{student.gender}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-700">{student.parentName ?? '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums text-ink-700">
                      {student.parentPhone
                        ? phoneVisible
                          ? student.parentPhone
                          : `${student.parentPhone.slice(0, 3)}****${student.parentPhone.slice(-2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={student.boarding === '住宿' ? 'blue' : 'default'}>{student.boarding ?? '走读'}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setPhoneVisible((v) => !v)}
                        aria-label={phoneVisible ? '隐藏电话' : '显示电话'}
                        title={phoneVisible ? '隐藏电话' : '显示电话'}
                        className="mr-1 inline-grid h-9 w-9 place-items-center rounded-menu text-ink-500 hover:bg-surface-muted hover:text-ink-900"
                      >
                        {phoneVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button
                        type="button"
                        aria-label={`删除：${student.name}`}
                        onClick={() => openDelete(student)}
                        className="inline-grid h-9 w-9 place-items-center rounded-menu text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid grid-cols-1 gap-2 p-4 md:hidden">
            {filtered.map((student) => (
              <li key={student.id} className="rounded-menu border border-line p-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="text-sm font-bold text-ink-900"
                    onClick={() => {
                      setEditing(student)
                      setDrawerOpen(true)
                    }}
                  >
                    {student.name}
                    <span className="ml-2 text-[11px] font-normal text-ink-500">{student.studentNo ?? ''}</span>
                  </button>
                  <Badge variant={student.boarding === '住宿' ? 'blue' : 'default'}>{student.boarding ?? '走读'}</Badge>
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  家长：{student.parentName ?? '—'} · {student.parentPhone ?? '—'}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <StudentFormDrawer
        open={drawerOpen}
        student={editing}
        classId={editing?.classId ?? classId ?? 0}
        onClose={() => {
          setDrawerOpen(false)
          setEditing(null)
        }}
      />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} classId={classId ?? 0} />
      <StudentExcelImportDialog
        open={excelImportOpen}
        classId={classId}
        existingStudents={students}
        onClose={() => setExcelImportOpen(false)}
      />

      <Modal
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="删除学生"
        footer={
          <>
            <Button onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="danger" onClick={confirmDelete}>
              删除
            </Button>
          </>
        }
      >
        确定删除「<strong className="text-ink-900">{deleteTarget?.name}</strong>」吗？{deleteInfo}
      </Modal>
    </Panel>
  )
}
