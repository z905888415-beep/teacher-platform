import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Upload } from 'lucide-react'
import { db, nowISO, type Exam, type ExamType, type Student } from '../db'
import { todayISO } from '../lib/dates'
import { computeStats, computeRanks, clampScore, PASS_LINE, EXCELLENT_LINE } from '../lib/scores'
import { parseCSV } from '../lib/csv'
import { Badge, Button, Drawer, EmptyState, Field, Input, Modal, Panel, Select, Textarea } from '../components/ui'
import { useToast } from '../contexts/ToastContext'
import { useClassManager } from '../contexts/ClassContext'

const EXAM_TYPES: ExamType[] = ['随堂测验', '单元测验', '月考', '期中', '期末']

/** 历次平均分折线图：仅使用品牌蓝与透明度（UI 规范 11.2） */
function TrendChart({ points, labels }: { points: number[]; labels: string[] }) {
  if (points.length < 2) {
    return <p className="py-6 text-center text-xs text-ink-500">至少两次考试后显示趋势折线</p>
  }
  const width = 560
  const height = 160
  const pad = 28
  const min = Math.min(...points, 40)
  const max = Math.max(...points, 100)
  const scaleX = (index: number) => pad + (index * (width - pad * 2)) / (points.length - 1)
  const scaleY = (value: number) => height - pad - ((value - min) / (max - min || 1)) * (height - pad * 2)
  const path = points.map((value, index) => `${index === 0 ? 'M' : 'L'}${scaleX(index)},${scaleY(value)}`).join(' ')

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="历次平均分趋势折线图">
        <line x1={pad} y1={scaleY(PASS_LINE)} x2={width - pad} y2={scaleY(PASS_LINE)} stroke="#B7BFD0" strokeDasharray="4 4" strokeWidth={1} />
        <text x={pad - 6} y={scaleY(PASS_LINE) + 4} fontSize={10} fill="#8B93A5" textAnchor="end">
          及格
        </text>
        <path d={path} fill="none" stroke="#002FA7" strokeWidth={2} />
        {points.map((value, index) => (
          <g key={index}>
            <circle cx={scaleX(index)} cy={scaleY(value)} r={3.5} fill="#002FA7" opacity={index === points.length - 1 ? 1 : 0.45} />
            <text x={scaleX(index)} y={height - 8} fontSize={10} fill="#8B93A5" textAnchor="middle">
              {labels[index]}
            </text>
            <text x={scaleX(index)} y={scaleY(value) - 10} fontSize={11} fill="#111827" fontWeight={700} textAnchor="middle">
              {value.toFixed(1)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 text-[11px] leading-4 text-ink-500">
        最近一次平均分 {points[points.length - 1].toFixed(1)} 分，较上次
        {points[points.length - 1] >= points[points.length - 2] ? '上升' : '下降'}{' '}
        {Math.abs(points[points.length - 1] - points[points.length - 2]).toFixed(1)} 分。
      </figcaption>
    </figure>
  )
}

function ExamDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentClass } = useClassManager()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [type, setType] = useState<ExamType>('单元测验')
  const [date, setDate] = useState(todayISO())
  const [fullScore, setFullScore] = useState('100')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setType('单元测验')
    setDate(todayISO())
    setFullScore('100')
    setError(null)
  }, [open])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('请填写考试名称')
      return
    }
    setSaving(true)
    await db.exams.add({
      classId: currentClass?.id ?? 0,
      name: name.trim(),
      type,
      date,
      fullScore: Number(fullScore) || 100,
      createdAt: nowISO(),
    })
    showToast('考试已创建，可以录入成绩')
    setSaving(false)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="新建考试"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            创建
          </Button>
        </>
      }
    >
      <Field label="考试名称" error={error ?? undefined} htmlFor="exam-name">
        <Input
          id="exam-name"
          value={name}
          placeholder="例如：数学单元测验（二）"
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="类型" htmlFor="exam-type">
          <Select id="exam-type" value={type} onChange={(event) => setType(event.target.value as ExamType)}>
            {EXAM_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="满分" htmlFor="exam-full">
          <Input id="exam-full" type="number" min={1} value={fullScore} onChange={(event) => setFullScore(event.target.value)} />
        </Field>
      </div>
      <Field label="考试日期" htmlFor="exam-date">
        <Input id="exam-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </Field>
      <p className="text-[11px] leading-4 text-ink-500">只录入数学原始分，满分按考试单独设置。</p>
    </Drawer>
  )
}

export function Scores() {
  const { currentClass } = useClassManager()
  const { showToast } = useToast()
  const [examId, setExamId] = useState<number | null>(null)
  const [examDrawerOpen, setExamDrawerOpen] = useState(false)
  const [deleteExam, setDeleteExam] = useState<Exam | null>(null)
  const [draftScores, setDraftScores] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [trendStudentId, setTrendStudentId] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importReport, setImportReport] = useState<string | null>(null)

  const classId = currentClass?.id
  const exams = useLiveQuery(
    async () => (classId == null ? [] : db.exams.where('classId').equals(classId).toArray()),
    [classId],
    [] as Exam[],
  )!
  const students = useLiveQuery(
    async () => (classId == null ? [] : db.students.where('classId').equals(classId).toArray()),
    [classId],
    [] as Student[],
  )!
  const scores = useLiveQuery(async () => db.mathScores.toArray(), [], [])!

  useEffect(() => {
    setExamId(null)
    setTrendStudentId('')
  }, [classId])

  useEffect(() => {
    if (examId != null && exams.some((exam) => exam.id === examId)) return
    setExamId(exams.length > 0 ? (exams[exams.length - 1].id ?? null) : null)
  }, [exams, examId])

  const currentExam = exams.find((exam) => exam.id === examId) ?? null

  // F12：名次（同分并列）
  const ranks = useMemo(() => {
    const map = new Map<number, number>()
    if (!currentExam) return map
    for (const score of scores) {
      if (score.examId === currentExam.id && score.score != null) map.set(score.studentId, score.score)
    }
    return computeRanks(map)
  }, [currentExam, scores])

  useEffect(() => {
    if (!currentExam?.id) return
    const existing: Record<number, string> = {}
    for (const score of scores) {
      if (score.examId === currentExam.id && score.studentId != null) {
        existing[score.studentId] = score.score == null ? '' : String(score.score)
      }
    }
    setDraftScores(existing)
  }, [currentExam?.id, scores])

  const examScoresOf = (exam: Exam) =>
    scores
      .filter((score) => score.examId === exam.id && score.score != null)
      .map((score) => score.score as number)

  const stats = currentExam ? computeStats(examScoresOf(currentExam)) : null

  const trend = useMemo(() => {
    const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date))
    const points: number[] = []
    const labels: string[] = []
    for (const exam of sorted) {
      const list = examScoresOf(exam)
      if (list.length === 0) continue
      points.push(list.reduce((acc, value) => acc + value, 0) / list.length)
      labels.push(exam.date.slice(5))
    }
    return { points, labels }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exams, scores])

  const handleSaveScores = async () => {
    if (!currentExam?.id) return
    setSaving(true)
    const stamp = nowISO()
    for (const student of students) {
      const raw = draftScores[student.id ?? -1]
      const existing = scores.find((score) => score.examId === currentExam.id && score.studentId === student.id)
      if (raw == null || raw.trim() === '') {
        if (existing?.id != null) await db.mathScores.delete(existing.id)
        continue
      }
      const capped = clampScore(raw, currentExam.fullScore)
      if (capped == null) continue
      if (existing?.id != null) {
        await db.mathScores.update(existing.id, { score: capped })
      } else {
        await db.mathScores.add({ examId: currentExam.id, studentId: student.id ?? 0, score: capped })
      }
      void stamp
    }
    showToast('成绩已保存')
    setSaving(false)
  }

  const statCards: [string, string][] = stats
    ? [
        ['平均分', stats.average.toFixed(1)],
        ['中位数', stats.median.toFixed(1)],
        ['及格率', `${Math.round(stats.passRate * 100)}%`],
        ['优秀率', `${Math.round(stats.excellentRate * 100)}%`],
      ]
    : []

  return (
    <>
      <div className="grid grid-cols-1 gap-3.5">
        <Panel
          title={`数学成绩 · ${currentClass?.name ?? ''}`}
          subtitle="仅保留平均分、中位数、及格率、优秀率、名次与个人趋势"
          actions={
            <div className="flex items-center gap-2">
              <Select
                aria-label="选择考试"
                className="h-9 shrink-0 rounded-ui text-[13px]"
                style={{ width: 190 }}
                value={examId ?? ''}
                onChange={(event) => setExamId(Number(event.target.value))}
              >
                {exams.length === 0 && <option value="">暂无考试</option>}
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}（{exam.date}）
                  </option>
                ))}
              </Select>
              <Button onClick={() => { setImportText(''); setImportReport(null); setImportOpen(true) }}>
                <Upload size={14} /> 粘贴导入
              </Button>
              <Button variant="primary" onClick={() => setExamDrawerOpen(true)}>
                <Plus size={14} /> 新建考试
              </Button>
            </div>
          }
          bodyClassName="p-4"
        >
          {exams.length === 0 ? (
            <EmptyState
              title="还没有考试"
              hint="先创建一场考试（单元测验、月考、期中等），再录入或导入成绩。"
              action={
                <Button variant="primary" onClick={() => setExamDrawerOpen(true)}>
                  新建考试
                </Button>
              }
            />
          ) : (
            currentExam && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="blue">{currentExam.type}</Badge>
                <span className="text-sm font-semibold text-ink-900">{currentExam.name}</span>
                <span className="text-[11px] text-ink-500">
                  {currentExam.date} · 满分 {currentExam.fullScore}
                </span>
                <button
                  type="button"
                  onClick={() => setDeleteExam(currentExam)}
                  className="ml-auto inline-flex h-9 items-center gap-1 rounded-ui border border-danger-600/25 bg-danger-50 px-3 text-xs font-semibold text-danger-600"
                >
                  <Trash2 size={13} /> 删除考试
                </button>
              </div>
            )
          )}
        </Panel>

        {currentExam && stats && (
          <>
            <div className="grid grid-cols-2 gap-3.5 min-[768px]:grid-cols-4">
              {statCards.map(([label, value]) => (
                <div key={label} className="rounded-card border border-line bg-white px-5 py-4 shadow-panel">
                  <p className="text-[10px] font-bold tracking-[0.04em] text-ink-500">{label}</p>
                  <p className="mt-1.5 text-[22px] font-bold tabular-nums text-ink-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3.5 min-[1024px]:grid-cols-2">
              <Panel title="历次平均分" bodyClassName="p-4">
                <TrendChart points={trend.points} labels={trend.labels} />
                <p className="mt-2 text-xs leading-5 text-ink-500">
                  文字摘要：共 {trend.points.length} 次考试，班级平均分在 {Math.min(...trend.points.filter(Boolean)).toFixed(1)} –{' '}
                  {Math.max(...trend.points).toFixed(1)} 分之间波动；及格线为 {PASS_LINE} 分。
                </p>
              </Panel>
              <Panel title="分数概况" bodyClassName="p-4">
                <ul className="grid gap-2 text-sm">
                  {[
                    ['最高分', `${stats.max} 分`],
                    ['最低分', `${stats.min} 分`],
                    ['已录入人数', `${stats.count} 人`],
                    ['缺录人数', `${students.length - stats.count} 人`],
                  ].map(([label, value]) => (
                    <li key={label} className="flex items-center justify-between border-t border-line py-2 first:border-t-0">
                      <span className="text-ink-500">{label}</span>
                      <span className="font-semibold tabular-nums text-ink-900">{value}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <Panel
              title="个人趋势"
              subtitle="F12：单名学生历次成绩（仅品牌蓝）"
              actions={
                <Select
                  aria-label="选择学生查看个人趋势"
                  className="h-8 rounded-ui text-xs"
                  style={{ width: 150, fontSize: 12 }}
                  value={trendStudentId}
                  onChange={(event) => setTrendStudentId(event.target.value)}
                >
                  <option value="">选择学生</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </Select>
              }
              bodyClassName="p-4"
            >
              {(() => {
                const sid = Number(trendStudentId)
                const student = students.find((s) => s.id === sid)
                if (!student) return <p className="py-4 text-center text-xs text-ink-500">选择学生后查看其历次成绩走势</p>
                const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date))
                const points: number[] = []
                const labels: string[] = []
                for (const exam of sorted) {
                  const score = scores.find((s) => s.examId === exam.id && s.studentId === sid && s.score != null)
                  if (score?.score != null) {
                    points.push(score.score)
                    labels.push(exam.date.slice(5))
                  }
                }
                if (points.length < 2) {
                  return <p className="py-6 text-center text-xs text-ink-500">{student.name} 至少需要两次成绩才能显示趋势</p>
                }
                return (
                  <>
                    <TrendChart points={points} labels={labels} />
                    <p className="mt-2 text-xs leading-5 text-ink-500">
                      文字摘要：{student.name} 最近一次 {points[points.length - 1]} 分，较上次
                      {points[points.length - 1] >= points[points.length - 2] ? '上升' : '下降'}{' '}
                      {Math.abs(points[points.length - 1] - points[points.length - 2])} 分；历史区间{' '}
                      {Math.min(...points)} – {Math.max(...points)} 分。
                    </p>
                  </>
                )
              })()}
            </Panel>
          </>
        )}

        {currentExam && students.length > 0 && (
          <Panel
            title="录入成绩"
            subtitle="低于及格线的成绩只使用红色文字，不整行标红"
            actions={
              <Button variant="primary" loading={saving} onClick={handleSaveScores}>
                保存成绩
              </Button>
            }
            bodyClassName="p-0"
          >
            <div className="hidden md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] font-semibold text-ink-500">
                    <th scope="col" className="px-4 py-2.5 font-semibold">姓名</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">名次</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      成绩（满分 {currentExam.fullScore}）
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => {
                    const raw = draftScores[student.id ?? -1] ?? ''
                    const value = Number(raw)
                    const failed = raw !== '' && Number.isFinite(value) && value < PASS_LINE
                    const rank = ranks.get(student.id ?? -1)
                    return (
                      <tr key={student.id} className="border-b border-line last:border-b-0">
                        <td className="px-4 py-2">
                          <span className="font-semibold text-ink-900">{student.name}</span>
                          <span className="ml-2 text-[11px] text-ink-500">班内序号 {index + 1}</span>
                        </td>
                        <td className="px-4 py-2 tabular-nums text-ink-700">{rank ?? '—'}</td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={currentExam.fullScore}
                            aria-label={`${student.name} 的成绩`}
                            value={raw}
                            onChange={(event) =>
                              setDraftScores((prev) => ({ ...prev, [student.id ?? -1]: event.target.value }))
                            }
                            className={`h-9 w-28 ${failed ? 'border-danger-600/50 font-semibold text-danger-600' : ''}`}
                          />
                        </td>
                        <td className="px-4 py-2 text-right text-[11px] text-ink-500">
                          {failed ? '低于及格线' : raw !== '' && Number.isFinite(value) && value >= EXCELLENT_LINE ? '优秀' : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* 移动端录入列表 */}
            <ul className="grid gap-2 p-4 md:hidden">
              {students.map((student) => {
                const raw = draftScores[student.id ?? -1] ?? ''
                const rank = ranks.get(student.id ?? -1)
                return (
                  <li key={student.id} className="flex items-center justify-between gap-3 rounded-menu border border-line px-3 py-2">
                    <span className="text-sm font-semibold text-ink-900">
                      {student.name}
                      {rank != null && <span className="ml-1.5 text-[11px] font-normal text-ink-500">第 {rank} 名</span>}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={currentExam.fullScore}
                      aria-label={`${student.name} 的成绩`}
                      value={raw}
                      onChange={(event) => setDraftScores((prev) => ({ ...prev, [student.id ?? -1]: event.target.value }))}
                      className="h-10 w-24"
                    />
                  </li>
                )
              })}
            </ul>
          </Panel>
        )}
      </div>

      <ExamDrawer open={examDrawerOpen} onClose={() => setExamDrawerOpen(false)} />

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="粘贴导入成绩"
        footer={
          <>
            <Button onClick={() => setImportOpen(false)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!currentExam) return
                const rows = parseCSV(importText)
                if (rows.length === 0) {
                  setImportReport('没有可导入的数据')
                  return
                }
                const header = rows[0]
                const hasHeader = header.some((cell) => cell.includes('姓名'))
                const nameIdx = hasHeader ? header.findIndex((cell) => cell.includes('姓名')) : 0
                const scoreIdx = hasHeader
                  ? header.findIndex((cell) => cell.includes('成绩') || cell.includes('分数'))
                  : 1
                const body = hasHeader ? rows.slice(1) : rows
                const next = { ...draftScores }
                const unmatched: string[] = []
                let matched = 0
                for (const row of body) {
                  const name = row[nameIdx]?.trim()
                  const scoreText = row[scoreIdx]?.trim()
                  if (!name || !scoreText) continue
                  const student = students.find((s) => s.name === name)
                  const capped = clampScore(scoreText, currentExam.fullScore)
                  if (!student?.id || capped == null) {
                    unmatched.push(name)
                    continue
                  }
                  next[student.id] = String(capped)
                  matched += 1
                }
                setDraftScores(next)
                setImportReport(
                  `已匹配 ${matched} 人${unmatched.length > 0 ? `；未匹配：${unmatched.join('、')}` : ''}。点击「保存成绩」后写入。`,
                )
              }}
            >
              解析并填入
            </Button>
          </>
        }
      >
        <p className="mb-3 text-xs leading-5 text-ink-500">
          从 Excel 复制后粘贴，两列「姓名,成绩」。按姓名匹配当前班学生，先填入表格，点「保存成绩」才写库。
        </p>
        <Textarea
          value={importText}
          placeholder={'姓名,成绩\n陈晓明,92\n李雨桐,85'}
          className="min-h-[140px] font-mono text-xs"
          onChange={(event) => {
            setImportText(event.target.value)
            setImportReport(null)
          }}
        />
        {importReport && <p className="mt-2 text-xs leading-5 text-ink-700">{importReport}</p>}
      </Modal>

      <Modal
        open={deleteExam != null}
        onClose={() => setDeleteExam(null)}
        title="删除考试"
        footer={
          <>
            <Button onClick={() => setDeleteExam(null)}>取消</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (deleteExam?.id == null) return
                await db.transaction('rw', db.exams, db.mathScores, async () => {
                  await db.mathScores.where('examId').equals(deleteExam.id!).delete()
                  await db.exams.delete(deleteExam.id!)
                })
                showToast('考试与成绩已删除')
                setExamId(null)
                setDeleteExam(null)
              }}
            >
              删除
            </Button>
          </>
        }
      >
        确定删除「{deleteExam?.name}」及全部已录入成绩吗？此操作不可恢复。
      </Modal>
    </>
  )
}
