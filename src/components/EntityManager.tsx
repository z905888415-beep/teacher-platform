import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, Download, Upload, Printer, Pencil, Trash2, ChevronLeft, ChevronRight, FileSpreadsheet, FileJson, Inbox } from 'lucide-react'
import { db, tbl } from '../db'
import { Button, Card, Input, Select, Textarea, Modal, ConfirmDialog, Badge, EmptyState, PageHeader, Field } from './ui'
import { cn, download, formatNum } from '../lib/utils'
import { exportTableCsv, exportTableExcel, readSpreadsheet } from '../lib/data-io'

// ============ 字段驱动的通用 CRUD 管理器 ============
// 一个组件覆盖平台上大多数「列表 + 增删改查 + 导入导出」模块，
// 通过 fields 描述每个字段的类型 / 展示方式，大幅减少重复代码。

export type FieldType = 'text' | 'number' | 'textarea' | 'date' | 'select' | 'boolean' | 'url' | 'student' | 'exam' | 'subject'

export interface Field {
  key: string
  label: string
  type?: FieldType
  options?: string[]
  required?: boolean
  placeholder?: string
  full?: boolean // 表单中占整行
  listOnly?: boolean // 不出现在表单（仅列表展示）
}

interface FilterDef {
  key: string
  label: string
  options: string[]
}

export interface EntityManagerProps {
  title: string
  tableName: string
  fields: Field[]
  subtitle?: string
  icon?: ReactNode
  searchKeys?: string[]
  defaultSort?: { key: string; desc?: boolean }
  filters?: FilterDef[]
  allowImport?: boolean
  allowExport?: boolean
  allowAdd?: boolean
  allowDelete?: boolean
  printTitle?: string
  toolbar?: ReactNode
  summary?: (rows: any[]) => ReactNode
  rowActions?: (row: any) => ReactNode
  emptyText?: string
}

const PAGE_SIZE = 20

export function EntityManager(props: EntityManagerProps) {
  const {
    title, tableName, fields, subtitle, icon, searchKeys = [], defaultSort,
    filters = [], allowImport = true, allowExport = true, allowAdd = true,
    allowDelete = true, printTitle, toolbar, summary, rowActions, emptyText,
  } = props

  const rows = useLiveQuery(() => tbl(tableName).toArray(), [tableName]) ?? []
  const students = useLiveQuery(() => db.table('students').toArray(), []) ?? []
  const exams = useLiveQuery(() => db.table('exams').toArray(), []) ?? []

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s.name])), [students])
  const examMap = useMemo(() => new Map(exams.map((e) => [e.id, e.name])), [exams])

  const [query, setQuery] = useState('')
  const [filterVals, setFilterVals] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<{ key: string; desc: boolean }>(
    defaultSort ? { key: defaultSort.key, desc: defaultSort.desc ?? true } : { key: 'id', desc: true },
  )
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<any | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 展示值解析
  const displayValue = (row: any, f: Field): ReactNode => {
    const v = row[f.key]
    if (f.type === 'student') {
      const id = Number(v)
      return studentMap.get(id) || '未指定'
    }
    if (f.type === 'exam') return examMap.get(Number(v)) || '未指定'
    if (f.type === 'boolean') return v ? '是' : '否'
    if (f.type === 'url' && v) {
      return (
        <a href={v} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline truncate block max-w-[200px]" onClick={(e) => e.stopPropagation()}>
          {v}
        </a>
      )
    }
    if (f.type === 'number' && v !== '' && v !== null && v !== undefined) return formatNum(Number(v))
    return v ?? ''
  }

  // 搜索 + 过滤 + 排序 + 分页
  const processed = useMemo(() => {
    let list = [...rows]
    // 搜索：匹配字段值 + 解析后的学生/考试名
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((row) => {
        const haystack = fields
          .map((f) => {
            const v = row[f.key]
            if (f.type === 'student') return `${v} ${studentMap.get(Number(v)) || ''}`
            if (f.type === 'exam') return `${v} ${examMap.get(Number(v)) || ''}`
            return v
          })
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
    }
    for (const f of filters) {
      if (filterVals[f.key]) list = list.filter((row) => String(row[f.key]) === filterVals[f.key])
    }
    list.sort((a, b) => {
      const va = a[sort.key]
      const vb = b[sort.key]
      if (va === vb) return 0
      if (va === null || va === undefined) return 1
      if (vb === null || vb === undefined) return -1
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'zh-CN')
      return sort.desc ? -cmp : cmp
    })
    return list
  }, [rows, query, filterVals, sort, fields, studentMap, examMap])

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = processed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const toggleSort = (key: string) => {
    if (sort.key === key) setSort({ key, desc: !sort.desc })
    else setSort({ key, desc: true })
  }

  const save = async (data: any) => {
    const clean: any = {}
    fields.forEach((f) => {
      const v = data[f.key]
      if (f.type === 'number' && v !== '' && v !== null && v !== undefined) clean[f.key] = Number(v)
      else clean[f.key] = v === undefined ? null : v
    })
    if (editing?.id) await tbl(tableName).update(editing.id, clean)
    else await tbl(tableName).add(clean)
    setModalOpen(false)
    setEditing(null)
  }

  const remove = async () => {
    if (deleting?.id) await tbl(tableName).delete(deleting.id)
    setDeleting(null)
  }

  // 导入（CSV / Excel / JSON）
  const onImportFile = async (file: File) => {
    try {
      let data: Record<string, string>[]
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(await file.text())
        data = Array.isArray(parsed) ? parsed : parsed.rows || parsed.data || []
      } else {
        data = await readSpreadsheet(file)
      }
      if (!data.length) return alert('未读取到数据')
      // 表头 → 字段映射（按 label 或 key）
      const headers = Object.keys(data[0])
      const mapCol = (h: string) => fields.find((f) => f.label === h || f.key === h)
      const nameToId = new Map(students.map((s) => [s.name, s.id]))
      const noToId = new Map(students.map((s) => [s.studentNo, s.id]))
      const toAdd: any[] = []
      data.forEach((row) => {
        const item: any = {}
        headers.forEach((h) => {
          const f = mapCol(h)
          if (!f) return
          let v: any = row[h]
          if (f.type === 'number') v = parseFloat(v)
          if (f.type === 'student') {
            const id = nameToId.get(String(v).trim()) ?? noToId.get(String(v).trim())
            v = id ?? null
          }
          if (v !== '' && v !== undefined) item[f.key] = v
        })
        if (Object.keys(item).length) toAdd.push(item)
      })
      await tbl(tableName).bulkAdd(toAdd)
      alert(`成功导入 ${toAdd.length} 条记录`)
    } catch (e: any) {
      alert(`导入失败：${e.message}`)
    }
  }

  const exportRows = () => {
    const labelMap = new Map<number, string>()
    students.forEach((s) => labelMap.set(s.id, s.name))
    const examLabelMap = new Map<number, string>()
    exams.forEach((e) => examLabelMap.set(e.id, e.name))
    const out = processed.map((row) => {
      const o: any = {}
      fields.forEach((f) => {
        const v = row[f.key]
        if (f.type === 'student') o[f.label] = studentMap.get(Number(v)) || ''
        else if (f.type === 'exam') o[f.label] = examLabelMap.get(Number(v)) || ''
        else o[f.label] = v ?? ''
      })
      return o
    })
    const base = title
    exportTableCsv(`${base}.csv`, out)
    exportTableExcel(base, out)
  }

  const print = () => {
    if (!printTitle) return
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    const headers = fields.map((f) => `<th>${f.label}</th>`).join('')
    const body = processed
      .map(
        (row) =>
          `<tr>${fields.map((f) => `<td>${escapeHtml(String(displayValue(row, f) ?? ''))}</td>`).join('')}</tr>`,
      )
      .join('')
    w.document.write(`<html><head><title>${printTitle}</title><meta charset="utf-8"><style>body{font-family:sans-serif;padding:24px}h1{font-size:18px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5}</style></head><body><h1>${printTitle}</h1><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>{window.print()}<\/script></body></html>`)
    w.document.close()
  }

  const activeFilters = filters.filter((f) => filterVals[f.key])

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {printTitle && <Button variant="outline" size="sm" onClick={print}><Printer size={15} />打印</Button>}
            {allowExport && (
              <Button variant="outline" size="sm" onClick={exportRows}><Download size={15} />导出</Button>
            )}
            {allowImport && (
              <>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={15} />导入</Button>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.json" className="hidden" onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])} />
              </>
            )}
            {allowAdd && (
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}><Plus size={15} />新增</Button>
            )}
            {toolbar}
          </>
        }
      />

      {summary && <div className="mb-4">{summary(processed)}</div>}

      {/* 工具栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder="搜索…" className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <Select
              key={f.key}
              value={filterVals[f.key] || ''}
              onChange={(e) => { setFilterVals({ ...filterVals, [f.key]: e.target.value }); setPage(1) }}
              className="w-auto min-w-[110px]"
            >
              <option value="">{f.label}：全部</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          ))}
        </div>
        {activeFilters.length > 0 && (
          <button className="text-xs text-brand-600 hover:underline" onClick={() => { setFilterVals({}); setQuery(''); setPage(1) }}>清除筛选</button>
        )}
      </div>

      {/* 列表 */}
      {paged.length === 0 ? (
        <Card>
          <EmptyState icon={<Inbox size={40} />} title={emptyText || '暂无数据'} description="点击右上角「新增」或「导入」开始使用" />
        </Card>
      ) : (
        <>
          {/* 桌面表格 */}
          <Card className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  {fields.filter((f) => !f.listOnly).map((f) => (
                    <th key={f.key} className="px-3 py-2.5 font-medium cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(f.key)}>
                      {f.label}{sort.key === f.key && <span className="ml-1 text-brand-500">{sort.desc ? '↓' : '↑'}</span>}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-medium w-28">操作</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    {fields.filter((f) => !f.listOnly).map((f) => (
                      <td key={f.key} className="px-3 py-2.5 text-gray-700 whitespace-nowrap max-w-[220px] truncate">
                        {displayValue(row, f)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => { setEditing(row); setModalOpen(true) }}><Pencil size={15} /></button>
                        {allowDelete && <button className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => setDeleting(row)}><Trash2 size={15} /></button>}
                        {rowActions?.(row)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* 移动端卡片 */}
          <div className="md:hidden space-y-2">
            {paged.map((row) => (
              <Card key={row.id} className="p-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    {fields.filter((f) => !f.listOnly).slice(0, 4).map((f) => (
                      <div key={f.key} className="flex gap-2 text-sm">
                        <span className="text-gray-400 text-xs shrink-0">{f.label}:</span>
                        <span className="text-gray-700 truncate">{displayValue(row, f)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => { setEditing(row); setModalOpen(true) }}><Pencil size={15} /></button>
                    {allowDelete && <button className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => setDeleting(row)}><Trash2 size={15} /></button>}
                    {rowActions?.(row)}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
            <span>共 {processed.length} 条 · 第 {safePage}/{totalPages} 页</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={15} /></Button>
              <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}><ChevronRight size={15} /></Button>
            </div>
          </div>
        </>
      )}

      {/* 新增/编辑弹窗 */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        title={editing?.id ? `编辑${title}` : `新增${title}`}
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalOpen(false); setEditing(null) }}>取消</Button>
            <Button onClick={() => { const form = document.getElementById('entity-form') as HTMLFormElement; form?.requestSubmit() }}>保存</Button>
          </>
        }
      >
        <FieldForm fields={fields} initial={editing} students={students} exams={exams} onSubmit={save} />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="删除确认"
        message="确定要删除这条记录吗？此操作不可撤销。"
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
      />
    </div>
  )
}

// ============ 字段驱动表单 ============
export function FieldForm({
  fields, initial, students, exams, onSubmit,
}: {
  fields: Field[]
  initial?: any
  students: any[]
  exams: any[]
  onSubmit: (data: any) => void
}) {
  const [data, setData] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {}
    fields.forEach((f) => {
      init[f.key] = initial?.[f.key] ?? (f.type === 'boolean' ? false : '')
    })
    return init
  })

  const set = (key: string, value: any) => setData((d) => ({ ...d, [key]: value }))

  return (
    <form
      id="entity-form"
      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      onSubmit={(e) => { e.preventDefault(); onSubmit(data) }}
    >
      {fields.filter((f) => !f.listOnly).map((f) => {
        const val = data[f.key]
        const input =
          f.type === 'textarea' ? (
            <Textarea rows={4} value={val ?? ''} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
          ) : f.type === 'select' || f.type === 'boolean' ? (
            <Select value={val ?? ''} onChange={(e) => set(f.key, f.type === 'boolean' ? e.target.value === '是' : e.target.value)}>
              <option value="">请选择</option>
              {f.type === 'boolean' ? ['是', '否'].map((o) => <option key={o} value={o}>{o}</option>) : (f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          ) : f.type === 'student' ? (
            <Select value={val ?? ''} onChange={(e) => set(f.key, e.target.value ? Number(e.target.value) : null)}>
              <option value="">请选择学生</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}（{s.studentNo}）</option>)}
            </Select>
          ) : f.type === 'exam' ? (
            <Select value={val ?? ''} onChange={(e) => set(f.key, e.target.value ? Number(e.target.value) : null)}>
              <option value="">请选择考试</option>
              {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          ) : f.type === 'subject' ? (
            <Select value={val ?? ''} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">请选择科目</option>
              {['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '其他'].map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          ) : (
            <Input
              type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'url' ? 'url' : 'text'}
              value={val ?? ''}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          )
        return (
          <Field key={f.key} label={f.label} required={f.required} className={f.full ? 'sm:col-span-2' : ''}>
            {input}
          </Field>
        )
      })}
    </form>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}
