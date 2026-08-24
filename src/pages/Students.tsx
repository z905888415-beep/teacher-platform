import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Download, Upload, Pencil, Trash2, Users } from 'lucide-react'
import { db } from '../db'
import { Card, Button, Modal, Input, Select, Textarea, Field, PageHeader, EmptyState, SearchInput, ConfirmDialog, Badge } from '../components/ui'
import { exportTableCsv, exportTableExcel, readSpreadsheet } from '../lib/data-io'
import { GENDERS, SUBJECTS } from '../lib/types'

type TabKey = 'basic' | 'roster' | 'records'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'basic', label: '学生名单' },
  { key: 'roster', label: '花名册' },
  { key: 'records', label: '学籍信息' },
]

const TAB_COLS: Record<TabKey, { key: string; label: string }[]> = {
  basic: [
    { key: 'studentNo', label: '学号' }, { key: 'name', label: '姓名' },
    { key: 'gender', label: '性别' }, { key: 'selection', label: '选科' },
    { key: 'classId', label: '班级' },
  ],
  roster: [
    { key: 'name', label: '姓名' }, { key: 'parentName', label: '家长' },
    { key: 'parentPhone', label: '家长电话' }, { key: 'address', label: '住址' },
    { key: 'emergencyContact', label: '紧急联系人' },
  ],
  records: [
    { key: 'name', label: '姓名' }, { key: 'regNo', label: '学籍号' },
    { key: 'idCard', label: '身份证号' }, { key: 'hukou', label: '户籍' },
    { key: 'classId', label: '班级' },
  ],
}

export default function StudentPage({ initialTab = 'basic' }: { initialTab?: TabKey }) {
  const students = useLiveQuery(() => db.table('students').toArray(), []) ?? []
  const [tab, setTab] = useState<TabKey>(initialTab)
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<any | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const classes = useMemo(() => [...new Set(students.map((s) => s.classId).filter(Boolean))], [students])

  const filtered = useMemo(() => {
    let list = students
    if (classFilter) list = list.filter((s) => s.classId === classFilter)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((s) =>
        [s.name, s.studentNo, s.selection, s.parentName, s.parentPhone, s.regNo, s.idCard].some((v) => (v || '').toLowerCase().includes(q)),
      )
    }
    return [...list].sort((a, b) => (a.studentNo || '').localeCompare(b.studentNo || ''))
  }, [students, query, classFilter])

  const cols = TAB_COLS[tab]

  const onImport = async (file: File) => {
    try {
      const data = await readSpreadsheet(file)
      const mapped = data.map((row) => {
        const item: any = {}
        const pick = (keys: string[]) => keys.forEach((k) => { if (row[k] !== undefined && row[k] !== '') item[k] = row[k] })
        pick(['studentNo', 'name', 'gender', 'classId', 'selection', 'birthday', 'remark', 'parentName', 'parentPhone', 'address', 'emergencyContact', 'familySituation', 'regNo', 'idCard', 'hukou', 'health', 'allergy', 'dorm', 'boardingType', 'pickup'])
        // 兼容中文字段名
        const zhMap: Record<string, string> = { 学号: 'studentNo', 姓名: 'name', 性别: 'gender', 班级: 'classId', 选科: 'selection', 家长: 'parentName', '家长电话': 'parentPhone', 住址: 'address', 学籍号: 'regNo', 身份证号: 'idCard' }
        Object.entries(zhMap).forEach(([zh, en]) => { if (row[zh] !== undefined && row[zh] !== '' && item[en] === undefined) item[en] = row[zh] })
        return item
      }).filter((i) => i.name)
      if (!mapped.length) return alert('未识别到有效学生数据（需要「姓名」列）')
      await db.table('students').bulkAdd(mapped)
      alert(`成功导入 ${mapped.length} 名学生`)
    } catch (e: any) {
      alert(`导入失败：${e.message}`)
    }
  }

  const onExport = () => {
    const out = filtered.map((s) => ({
      学号: s.studentNo, 姓名: s.name, 性别: s.gender, 班级: s.classId, 选科: s.selection,
      家长: s.parentName, 家长电话: s.parentPhone, 住址: s.address, 紧急联系人: s.emergencyContact,
      学籍号: s.regNo, 身份证号: s.idCard, 户籍: s.hukou, 宿舍: s.dorm, 类型: s.boardingType,
    }))
    exportTableCsv('学生名单.csv', out)
    exportTableExcel('学生名单', out)
  }

  return (
    <div>
      <PageHeader
        title="学生管理"
        subtitle={`共 ${students.length} 名学生${classFilter ? ` · ${classFilter}` : ''}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={onExport}><Download size={15} />导出</Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={15} />导入</Button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}><Plus size={15} />新增学生</Button>
          </>
        }
      />

      {/* Tab */}
      <div className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <SearchInput value={query} onChange={setQuery} placeholder="搜索姓名 / 学号 / 电话…" />
        <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="w-auto min-w-[140px]">
          <option value="">全部班级</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={<Users size={40} />} title="暂无学生" description="点击右上角新增或导入学生名单" /></Card>
      ) : (
        <>
          {/* 桌面表格 */}
          <Card className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  {cols.map((c) => <th key={c.key} className="px-3 py-2.5 font-medium whitespace-nowrap">{c.label}</th>)}
                  <th className="px-3 py-2.5 w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => { setEditing(s); setModalOpen(true) }}>
                    {cols.map((c) => <td key={c.key} className="px-3 py-2.5 text-gray-700 truncate max-w-[180px]">{s[c.key] || '—'}</td>)}
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => { setEditing(s); setModalOpen(true) }}><Pencil size={15} /></button>
                        <button className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => setDeleting(s)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* 移动端卡片 */}
          <div className="md:hidden space-y-2">
            {filtered.map((s) => (
              <Card key={s.id} className="p-3" onClick={() => { setEditing(s); setModalOpen(true) }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-sm font-semibold">{s.name?.slice(0, 1)}</div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.studentNo}{s.selection ? ` · ${s.selection}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => { setEditing(s); setModalOpen(true) }}><Pencil size={15} /></button>
                    <button className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => setDeleting(s)}><Trash2 size={15} /></button>
                  </div>
                </div>
                {tab === 'roster' && (
                  <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-500">
                    <span>家长：{s.parentName || '—'}</span>
                    <span>电话：{s.parentPhone || '—'}</span>
                  </div>
                )}
                {tab === 'records' && (
                  <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-500">
                    <span>学籍号：{s.regNo || '—'}</span>
                    <span>户籍：{s.hukou || '—'}</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      <StudentForm open={modalOpen} initial={editing} onClose={() => setModalOpen(false)} />
      <ConfirmDialog open={!!deleting} title="删除学生" message={`确定删除 ${deleting?.name} 吗？相关成绩、沟通记录等也会失去关联。`} onCancel={() => setDeleting(null)} onConfirm={async () => { await db.table('students').delete(deleting.id); setDeleting(null) }} />
    </div>
  )
}

function StudentForm({ open, initial, onClose }: { open: boolean; initial: any; onClose: () => void }) {
  const [form, setForm] = useState<any>(() => initial ? { ...initial } : { gender: '男', boardingType: '住校', classId: '高一（1）班' })
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name?.trim() || !form.studentNo?.trim()) return alert('请填写姓名和学号')
    const data = { ...form, name: form.name.trim(), studentNo: form.studentNo.trim() }
    if (initial?.id) await db.table('students').update(initial.id, data)
    else await db.table('students').add(data)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? '编辑学生' : '新增学生'} size="lg"
      footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={save}>保存</Button></>}>
      <div className="space-y-4">
        <section>
          <h4 className="text-xs font-semibold text-gray-400 mb-2">基本信息</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="姓名" required><Input value={form.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="学号" required><Input value={form.studentNo || ''} onChange={(e) => set('studentNo', e.target.value)} /></Field>
            <Field label="性别"><Select value={form.gender || ''} onChange={(e) => set('gender', e.target.value)}>{GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}</Select></Field>
            <Field label="班级"><Input value={form.classId || ''} onChange={(e) => set('classId', e.target.value)} /></Field>
            <Field label="选科组合"><Input value={form.selection || ''} onChange={(e) => set('selection', e.target.value)} placeholder="如：物化生" list="selection-list" /><datalist id="selection-list">{['物化生', '物化地', '物生地', '史政地', '史政生'].map((s) => <option key={s} value={s} />)}</datalist></Field>
            <Field label="生日"><Input type="date" value={form.birthday || ''} onChange={(e) => set('birthday', e.target.value)} /></Field>
          </div>
          <div className="mt-3"><Field label="备注"><Input value={form.remark || ''} onChange={(e) => set('remark', e.target.value)} /></Field></div>
        </section>

        <section>
          <h4 className="text-xs font-semibold text-gray-400 mb-2">家庭信息（花名册）</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="家长姓名"><Input value={form.parentName || ''} onChange={(e) => set('parentName', e.target.value)} /></Field>
            <Field label="家长电话"><Input value={form.parentPhone || ''} onChange={(e) => set('parentPhone', e.target.value)} /></Field>
            <Field label="紧急联系人"><Input value={form.emergencyContact || ''} onChange={(e) => set('emergencyContact', e.target.value)} /></Field>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="家庭住址"><Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
            <Field label="家庭情况">
              <Select value={form.familySituation || ''} onChange={(e) => set('familySituation', e.target.value)}>
                <option value="">无特殊</option>
                {['单亲', '留守', '贫困', '父母离异', '亲子关系紧张'].map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
        </section>

        <section>
          <h4 className="text-xs font-semibold text-gray-400 mb-2">学籍 / 健康 / 宿舍</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="学籍号"><Input value={form.regNo || ''} onChange={(e) => set('regNo', e.target.value)} /></Field>
            <Field label="身份证号"><Input value={form.idCard || ''} onChange={(e) => set('idCard', e.target.value)} /></Field>
            <Field label="户籍"><Input value={form.hukou || ''} onChange={(e) => set('hukou', e.target.value)} /></Field>
            <Field label="类型"><Select value={form.boardingType || ''} onChange={(e) => set('boardingType', e.target.value)}>{['住校', '走读'].map((b) => <option key={b} value={b}>{b}</option>)}</Select></Field>
            <Field label="宿舍"><Input value={form.dorm || ''} onChange={(e) => set('dorm', e.target.value)} /></Field>
            <Field label="接送方式"><Input value={form.pickup || ''} onChange={(e) => set('pickup', e.target.value)} /></Field>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="健康状况"><Input value={form.health || ''} onChange={(e) => set('health', e.target.value)} /></Field>
            <Field label="过敏史 / 特殊疾病"><Input value={form.allergy || ''} onChange={(e) => set('allergy', e.target.value)} /></Field>
          </div>
        </section>
      </div>
    </Modal>
  )
}
