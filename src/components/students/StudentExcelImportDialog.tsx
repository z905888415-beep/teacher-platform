import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { db, nowISO, type Student } from '../../db'
import { parseStudentExcelFile, type StudentImportPreview } from '../../lib/studentExcel'
import { useToast } from '../../contexts/ToastContext'
import { Button, EmptyState, Modal } from '../ui'

interface StudentExcelImportDialogProps {
  open: boolean
  classId?: number
  existingStudents: Student[]
  onClose: () => void
}

function importableStudent(student: Student, classId: number, stamp: string, id?: number): Student {
  return {
    ...(id == null ? {} : { id }),
    classId,
    studentNo: student.studentNo,
    name: student.name,
    gender: student.gender,
    birthday: student.birthday,
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    emergencyContact: student.emergencyContact,
    boarding: student.boarding || '走读',
    note: student.note,
    createdAt: student.createdAt || stamp,
    updatedAt: stamp,
  }
}

export function StudentExcelImportDialog({ open, classId, existingStudents, onClose }: StudentExcelImportDialogProps) {
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<StudentImportPreview | null>(null)
  const [previewClassId, setPreviewClassId] = useState<number | undefined>()
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setPreview(null)
      setPreviewClassId(undefined)
      setParsing(false)
      setSaving(false)
    }
  }, [open])

  useEffect(() => {
    if (preview && previewClassId !== classId) {
      setPreview(null)
      setPreviewClassId(undefined)
      showToast('班级已切换，请重新选择 Excel 文件')
    }
  }, [classId, preview, previewClassId, showToast])

  const close = () => {
    if (parsing || saving) return
    onClose()
  }

  const chooseFile = () => {
    if (classId == null) {
      showToast('请先在顶部选择班级')
      return
    }
    fileRef.current?.click()
  }

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setParsing(true)
    setPreview(null)
    setPreviewClassId(classId)
    const result = await parseStudentExcelFile(file, existingStudents)
    setPreview(result)
    setParsing(false)
  }

  const confirmImport = async () => {
    if (!preview || preview.validRows === 0 || classId == null || previewClassId !== classId) return
    setSaving(true)
    try {
      const stamp = nowISO()
      const existingById = new Map(existingStudents.filter((student) => student.id != null).map((student) => [student.id as number, student]))
      await db.transaction('rw', db.students, async () => {
        const records = preview.rows.map((action) => {
          const source = action.existingId == null ? undefined : existingById.get(action.existingId)
          const student: Student = {
            ...(source ?? {}),
            studentNo: action.studentNo,
            name: action.name,
            gender: action.gender,
            birthday: action.birthday,
            parentName: action.parentName,
            parentPhone: action.parentPhone,
            emergencyContact: action.emergencyContact,
            boarding: action.boarding || '走读',
            note: action.note,
            classId,
            createdAt: source?.createdAt ?? stamp,
            updatedAt: stamp,
          }
          return importableStudent(student, classId, stamp, action.existingId)
        })
        await db.students.bulkPut(records)
      })
      showToast(`已导入 ${preview.validRows} 条：新增 ${preview.addCount}，更新 ${preview.updateCount}，跳过 ${preview.skippedCount}`)
      onClose()
    } catch {
      showToast('导入失败，未写入学生信息')
    } finally {
      setSaving(false)
    }
  }

  const errorRows = preview?.errors.slice(0, 8) ?? []

  return (
    <Modal
      open={open}
      onClose={close}
      title="Excel 导入学生"
      footer={
        <>
          <Button onClick={close} disabled={parsing || saving}>取消</Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!preview || preview.validRows === 0 || classId == null || previewClassId !== classId}
            onClick={confirmImport}
          >
            确认导入 {preview?.validRows ?? 0} 条
          </Button>
        </>
      }
    >
      <input ref={fileRef} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={handleFile} />
      <div className="rounded-menu border border-brand-600/20 bg-brand-50/60 p-3 text-xs leading-5 text-ink-700">
        <div className="flex items-start gap-2">
          <FileSpreadsheet size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden />
          <p>导入目标固定为当前班级。请先下载模板或 40 人示例，按固定列顺序填写；文件只在本机解析，不会上传学生隐私数据。</p>
        </div>
        <Button className="mt-3" onClick={chooseFile} disabled={classId == null || parsing || saving}>
          <Upload size={14} /> {parsing ? '正在解析…' : '选择 Excel 文件'}
        </Button>
      </div>

      {!preview && !parsing && (
        <div className="mt-3">
          <EmptyState title="尚未选择文件" hint="支持 .xlsx 和 .xls；选择后会先预览，确认后才会写入当前班级。" />
        </div>
      )}

      {parsing && <p className="mt-4 text-center text-xs text-ink-500" role="status">正在读取文件，请稍候…</p>}

      {preview && (
        <div className="mt-4 space-y-3">
          <div className="rounded-menu border border-line bg-surface-muted/45 p-3">
            <p className="truncate text-sm font-semibold text-ink-900" title={preview.fileName}>{preview.fileName || '未命名文件'}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Stat label="有效行" value={preview.validRows} tone="text-success" />
              <Stat label="新增" value={preview.addCount} tone="text-brand-600" />
              <Stat label="更新" value={preview.updateCount} tone="text-brand-600" />
              <Stat label="错误行" value={preview.skippedCount} tone={preview.skippedCount > 0 ? 'text-danger-600' : 'text-ink-500'} />
            </div>
            <p className="mt-2 text-[11px] text-ink-500">共读取 {preview.totalRows} 行非空数据；错误行不会写入。</p>
          </div>

          {errorRows.length > 0 && (
            <div className="rounded-menu border border-danger-600/20 bg-danger-50/50 p-3">
              <p className="text-xs font-semibold text-danger-600">前 {errorRows.length} 条错误</p>
              <ul className="mt-1.5 space-y-1 text-[11px] leading-4 text-danger-600">
                {errorRows.map((error, index) => (
                  <li key={`${error.row}-${error.field}-${index}`}>第 {error.row} 行 / {error.field} / {error.reason}</li>
                ))}
              </ul>
              {preview.errors.length > errorRows.length && <p className="mt-1 text-[11px] text-danger-600">还有 {preview.errors.length - errorRows.length} 条错误未展开。</p>}
            </div>
          )}

          {preview.validRows === 0 && <p className="text-xs font-medium text-danger-600">没有可导入的有效数据，请修正错误后重新选择文件。</p>}
        </div>
      )}
    </Modal>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}
