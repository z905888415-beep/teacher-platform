import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Save, Upload, PenLine, Settings2 } from 'lucide-react'
import { db, getSubjectFullMarks, setSubjectFullMarks } from '../db'
import { Card, Button, Modal, Input, Select, Field, PageHeader, EmptyState } from '../components/ui'
import { readSpreadsheet } from '../lib/data-io'
import { SUBJECTS, EXAM_TYPES, DEFAULT_SUBJECT_FULL_MARKS } from '../lib/types'

const MAIN_SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理']

export default function Scores() {
  const students = useLiveQuery(() => db.table('students').toArray(), []) ?? []
  const exams = useLiveQuery(() => db.table('exams').toArray(), []) ?? []
  const scores = useLiveQuery(() => db.table('scores').toArray(), []) ?? []

  const [examId, setExamId] = useState<number | ''>('')
  const [subject, setSubject] = useState('数学')
  const [entries, setEntries] = useState<Record<number, string>>({})
  const [examModal, setExamModal] = useState(false)
  const [markModal, setMarkModal] = useState(false)
  const [fullMarks, setFullMarks] = useState<Record<string, number>>(DEFAULT_SUBJECT_FULL_MARKS)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const sortedExams = useMemo(() => [...exams].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [exams])
  const sortedStudents = useMemo(() => [...students].sort((a, b) => (a.studentNo || '').localeCompare(b.studentNo || '')), [students])
  const currentExam = exams.find((e) => e.id === examId)

  useEffect(() => {
    ;(async () => {
      const marks = await getSubjectFullMarks()
      setFullMarks(marks)
    })()
  }, [])

  // 载入已录成绩（切换考试/科目时重置）
  useEffect(() => {
    if (!examId) { setEntries({}); return }
    const map: Record<number, string> = {}
    scores.filter((s) => s.examId === examId && s.subject === subject).forEach((s) => { map[s.studentId] = String(s.score) })
    setEntries(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, subject])

  const fullMarkOf = (subj: string) => fullMarks[subj] || currentExam?.fullMark || 100

  const save = async () => {
    if (!examId) return alert('请先选择考试')
    setSaving(true)
    try {
      const fullMark = fullMarkOf(subject)
      await db.transaction('rw', db.table('scores'), async () => {
        await db.table('scores').where({ examId, subject }).delete()
        const rows: any[] = []
        Object.entries(entries).forEach(([sid, val]) => {
          const score = parseFloat(val)
          if (Number.isNaN(score)) return
          rows.push({ studentId: Number(sid), examId, subject, score, fullMark })
        })
        await db.table('scores').bulkAdd(rows)
      })
      alert(`已保存 ${subject} 成绩 ${Object.values(entries).filter((v) => v !== '').length} 条（满分 ${fullMark}）`)
    } finally {
      setSaving(false)
    }
  }

  // 批量导入：支持「原始分 + 每科赋分 + 总分 + 班级/年级/组合排名」
  const onImport = async (file: File) => {
    try {
      if (!examId) return alert('请先选择目标考试')
      const data = await readSpreadsheet(file)
      const headers = Object.keys(data[0] || {})
      const nameToId = new Map(students.map((s) => [s.name, s.id]))
      const noToId = new Map(students.map((s) => [s.studentNo, s.id]))

      const subjectCols: string[] = []
      const assignedCols: { header: string; subject: string }[] = []
      const specialCols: Record<string, string> = {}

      headers.forEach((h) => {
        const t = h.trim()
        if (SUBJECTS.includes(t)) { subjectCols.push(h); return }
        const m = t.match(/^(.+?)[（( _]*赋分[)）]?$/)
        if (m && SUBJECTS.includes(m[1])) { assignedCols.push({ header: h, subject: m[1] }); return }
        if (/总分/.test(t) && !/赋分/.test(t) && !/原始/.test(t)) specialCols.total = h
        else if (/班级排名|班排名|班级名次|班名次/.test(t)) specialCols.classRank = h
        else if (/年级排名|年排名|年级名次|年名次/.test(t)) specialCols.gradeRank = h
        else if (/组合排名|组合名次|组合内排名/.test(t)) specialCols.comboRank = h
      })

      let scoreCount = 0
      let summaryCount = 0
      await db.transaction('rw', [db.table('scores'), db.table('examSummaries')], async () => {
        for (const row of data) {
          const sid = noToId.get(String(row['学号'] || '').trim()) ?? nameToId.get(String(row['姓名'] || row['名字'] || '').trim())
          if (!sid) continue

          for (const h of subjectCols) {
            const v = parseFloat(row[h])
            if (Number.isNaN(v)) continue
            const subj = h.trim()
            await db.table('scores').where({ examId, subject: subj, studentId: sid }).delete()
            await db.table('scores').add({ studentId: sid, examId, subject: subj, score: v, fullMark: fullMarkOf(subj) })
            scoreCount++
          }
          for (const { header, subject: subj } of assignedCols) {
            const v = parseFloat(row[header])
            if (Number.isNaN(v)) continue
            const existing = await db.table('scores').where({ examId, subject: subj, studentId: sid }).first()
            if (existing) await db.table('scores').update(existing.id, { assigned: v })
            else await db.table('scores').add({ studentId: sid, examId, subject: subj, score: v, fullMark: fullMarkOf(subj), assigned: v })
            scoreCount++
          }

          const summary: any = { examId, studentId: sid }
          const num = (k: string) => { const v = parseFloat(row[specialCols[k]]); return Number.isNaN(v) ? undefined : v }
          if (specialCols.total) summary.total = num('total')
          if (specialCols.classRank) summary.classRank = num('classRank')
          if (specialCols.gradeRank) summary.gradeRank = num('gradeRank')
          if (specialCols.comboRank) summary.comboRank = num('comboRank')
          if (Object.keys(summary).length > 2) {
            const existing = await db.table('examSummaries').where({ examId, studentId: sid }).first()
            if (existing) await db.table('examSummaries').update(existing.id, summary)
            else await db.table('examSummaries').add(summary)
            summaryCount++
          }
        }
      })
      alert(`导入完成：成绩 ${scoreCount} 条${summaryCount ? `，总分/排名 ${summaryCount} 人` : ''}\n\n识别到科目：${subjectCols.map((h) => h.trim()).join('、') || '无'}${assignedCols.length ? `\n识别到赋分列：${assignedCols.map((a) => a.subject).join('、')}` : ''}`)
    } catch (e: any) {
      alert(`导入失败：${e.message}`)
    }
  }

  return (
    <div>
      <PageHeader
        title="学生成绩"
        subtitle="手动录入或批量导入（原始分 / 赋分 / 总分 / 排名）"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setMarkModal(true)}><Settings2 size={15} />科目满分</Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={15} />批量导入</Button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => setExamModal(true)}><Plus size={15} />新建考试</Button>
          </>
        }
      />

      {/* 选择器 */}
      <Card className="p-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Field label="考试">
              <Select value={examId} onChange={(e) => setExamId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">请选择考试</option>
                {sortedExams.map((e) => <option key={e.id} value={e.id}>{e.name}（{e.type}）</option>)}
              </Select>
            </Field>
          </div>
          <div className="w-36">
            <Field label="科目">
              <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
                {MAIN_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex items-end">
            <Button onClick={save} disabled={!examId || saving}><Save size={15} />{saving ? '保存中…' : '保存全部'}</Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {subject} 满分 <span className="font-medium text-brand-600">{fullMarkOf(subject)}</span> 分
          · 点「科目满分」可自定义每科满分（语数英默认 150，其余 100）
        </p>
      </Card>

      {!examId ? (
        <Card><EmptyState icon={<PenLine size={40} />} title="请先选择考试" description="选择考试和科目后即可录入成绩" /></Card>
      ) : sortedStudents.length === 0 ? (
        <Card><EmptyState title="暂无学生" description="请先到「学生名单」添加学生" /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-3 py-2.5 font-medium">学号</th>
                <th className="px-3 py-2.5 font-medium">姓名</th>
                <th className="px-3 py-2.5 font-medium">选科</th>
                <th className="px-3 py-2.5 font-medium">{subject}成绩（满分 {fullMarkOf(subject)}）</th>
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map((s) => (
                <tr key={s.id} className="border-b border-gray-50">
                  <td className="px-3 py-2 text-gray-500">{s.studentNo}</td>
                  <td className="px-3 py-2 font-medium text-gray-800">{s.name}</td>
                  <td className="px-3 py-2 text-gray-500">{s.selection || '—'}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      value={entries[s.id] ?? ''}
                      onChange={(e) => setEntries({ ...entries, [s.id]: e.target.value })}
                      placeholder="分数"
                      className="w-28"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ExamModal open={examModal} onClose={() => setExamModal(false)} />
      <FullMarkModal open={markModal} fullMarks={fullMarks} onClose={() => setMarkModal(false)} onSave={(m) => setFullMarks(m)} />
    </div>
  )
}

function ExamModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', type: '月考', date: '', fullMark: 100 })
  const save = async () => {
    if (!form.name.trim()) return alert('请填写考试名称')
    await db.table('exams').add({ name: form.name.trim(), type: form.type, date: form.date, fullMark: Number(form.fullMark) || 100 })
    onClose()
    setForm({ name: '', type: '月考', date: '', fullMark: 100 })
  }
  return (
    <Modal open={open} onClose={onClose} title="新建考试" size="sm"
      footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={save}>创建</Button></>}>
      <div className="space-y-3">
        <Field label="考试名称" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：第二次月考" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="类型"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
          <Field label="日期"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        </div>
        <Field label="兜底满分（科目满分未设置时使用）"><Input type="number" value={form.fullMark} onChange={(e) => setForm({ ...form, fullMark: Number(e.target.value) })} /></Field>
      </div>
    </Modal>
  )
}

function FullMarkModal({ open, fullMarks, onClose, onSave }: { open: boolean; fullMarks: Record<string, number>; onClose: () => void; onSave: (m: Record<string, number>) => void }) {
  const [marks, setMarks] = useState<Record<string, number>>(fullMarks)

  const save = async () => {
    await setSubjectFullMarks(marks)
    onSave(marks)
    alert('✅ 科目满分已保存，之后导入/录入的成绩将按此满分记录')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="科目满分设置" size="sm"
      footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={save}>保存</Button></>}>
      <div className="space-y-2">
        <p className="text-xs text-gray-400 mb-2">按高考标准设置各科满分，分析中的及格率/优秀率/雷达图将据此计算。</p>
        <div className="grid grid-cols-3 gap-2">
          {MAIN_SUBJECTS.map((s) => (
            <Field key={s} label={s}>
              <Input type="number" value={marks[s] ?? 100} onChange={(e) => setMarks({ ...marks, [s]: Number(e.target.value) })} />
            </Field>
          ))}
        </div>
      </div>
    </Modal>
  )
}
