import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, Target, Plus } from 'lucide-react'
import { db } from '../db'
import { Card, Select, Field, Input, Button, PageHeader, EmptyState, StatCard, Badge, Tabs } from '../components/ui'
import { ChartCard, TrendChart, BarComp, RadarComp } from '../components/charts'
import {
  analyzeExam, examSubjects, radarData, studentVector, studentTrend, classAvgTrend,
  detectBias, borderlineStudents, subjectContribution, scoreBands, rankMap, type SubjectStat,
} from '../lib/stats'
import { SUBJECTS } from '../lib/types'
import { percent, round } from '../lib/utils'

type TabKey = 'class' | 'student' | 'compare' | 'bias' | 'borderline' | 'ranking' | 'contribution' | 'bands'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'class', label: '班级分析' },
  { key: 'student', label: '个人分析' },
  { key: 'compare', label: '学科对比' },
  { key: 'ranking', label: '排名与赋分' },
  { key: 'bands', label: '分数段' },
  { key: 'bias', label: '偏科预警' },
  { key: 'borderline', label: '临界生' },
  { key: 'contribution', label: '贡献率' },
]

export default function Analysis({ initialTab = 'class' }: { initialTab?: TabKey }) {
  const scores = useLiveQuery(() => db.table('scores').toArray(), []) ?? []
  const students = useLiveQuery(() => db.table('students').toArray(), []) ?? []
  const exams = useLiveQuery(() => db.table('exams').toArray(), []) ?? []
  const summaries = useLiveQuery(() => db.table('examSummaries').toArray(), []) ?? []

  const [examId, setExamId] = useState<number | ''>('')
  const [tab, setTab] = useState<TabKey>(initialTab)
  const [studentId, setStudentId] = useState<number | ''>('')
  const [distSubject, setDistSubject] = useState('总分')
  const [trendSubject, setTrendSubject] = useState('总分')
  const [line, setLine] = useState(500)
  const [buffer, setBuffer] = useState(15)

  const sortedExams = useMemo(() => [...exams].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [exams])
  const nameMap = useMemo(() => new Map(students.map((s) => [s.id, s.name])), [students])

  useEffect(() => {
    if (examId === '' && sortedExams.length) setExamId(sortedExams[0].id)
    if (studentId === '' && students.length) setStudentId(students[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedExams.length, students.length])

  const analysis = useMemo(() => (examId ? analyzeExam(scores, examId as number) : null), [scores, examId])
  const subjects = examId ? examSubjects(scores, examId as number) : []

  const totalSummary = useMemo(() => {
    if (!analysis) return null
    const totals = analysis.studentTotals.map((t) => t.total)
    const full = analysis.totalFullMark
    const pass = totals.filter((t) => t >= full * 0.6).length
    const excellent = totals.filter((t) => t >= full * 0.85).length
    return { count: totals.length, pass, excellent }
  }, [analysis])

  return (
    <div>
      <PageHeader
        title="成绩分析"
        subtitle="班级 / 个人 / 学科多维度分析"
        actions={
          <div className="flex items-center gap-2">
            <Select value={examId} onChange={(e) => setExamId(e.target.value ? Number(e.target.value) : '')} className="w-auto min-w-[180px]">
              <option value="">选择考试</option>
              {sortedExams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </div>
        }
      />

      <div className="mb-4"><Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} /></div>

      {!analysis ? (
        <Card><EmptyState icon={<BarChart3 size={40} />} title="暂无成绩数据" description="请先在「学生成绩」中录入成绩" /></Card>
      ) : (
        <>
          {tab === 'class' && <ClassTab analysis={analysis} scores={scores} exams={exams} examId={examId as number} distSubject={distSubject} setDistSubject={setDistSubject} totalSummary={totalSummary!} />}
          {tab === 'student' && <StudentTab scores={scores} exams={exams} examId={examId as number} students={students} studentId={studentId} setStudentId={setStudentId} trendSubject={trendSubject} setTrendSubject={setTrendSubject} />}
          {tab === 'compare' && <CompareTab analysis={analysis} scores={scores} examId={examId as number} />}
          {tab === 'ranking' && <RankingTab analysis={analysis} scores={scores} examId={examId as number} students={students} summaries={summaries} nameMap={nameMap} />}
          {tab === 'bands' && <BandsTab analysis={analysis} />}
          {tab === 'bias' && <BiasTab scores={scores} examId={examId as number} nameMap={nameMap} />}
          {tab === 'borderline' && <BorderlineTab analysis={analysis} nameMap={nameMap} line={line} setLine={setLine} buffer={buffer} setBuffer={setBuffer} examId={examId as number} />}
          {tab === 'contribution' && <ContributionTab analysis={analysis} />}
        </>
      )}
    </div>
  )
}

// ===== 班级分析 =====
function ClassTab({ analysis, scores, exams, examId, distSubject, setDistSubject, totalSummary }: any) {
  const distData = useMemo(() => {
    if (distSubject === '总分') return scoreBands(analysis.studentTotals.map((t: any) => t.total), analysis.totalFullMark).map((b) => ({ name: b.band, value: b.count }))
    const stat: SubjectStat | undefined = analysis.subjectStats.find((s: SubjectStat) => s.subject === distSubject)
    return stat ? stat.distribution.map((d) => ({ name: d.range, value: d.count })) : []
  }, [distSubject, analysis])

  const trend = useMemo(() => classAvgTrend(scores, exams), [scores, exams])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="平均分" value={analysis.totalAvg} sub={`满分 ${analysis.totalFullMark}`} color="text-brand-600" />
        <StatCard label="最高分" value={analysis.totalMax} />
        <StatCard label="最低分" value={analysis.totalMin} />
        <StatCard label="及格率" value={percent((totalSummary.pass / totalSummary.count) * 100)} sub={`优秀率 ${percent((totalSummary.excellent / totalSummary.count) * 100)}`} color="text-emerald-600" />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="px-3 py-2.5">科目</th><th className="px-3 py-2.5">人数</th><th className="px-3 py-2.5">平均分</th>
              <th className="px-3 py-2.5">最高</th><th className="px-3 py-2.5">最低</th><th className="px-3 py-2.5">及格率</th><th className="px-3 py-2.5">优秀率</th>
            </tr>
          </thead>
          <tbody>
            {analysis.subjectStats.map((s: SubjectStat) => (
              <tr key={s.subject} className="border-b border-gray-50">
                <td className="px-3 py-2.5 font-medium">{s.subject}</td>
                <td className="px-3 py-2.5 text-gray-500">{s.count}</td>
                <td className="px-3 py-2.5 font-semibold text-brand-600">{s.avg}</td>
                <td className="px-3 py-2.5 text-gray-500">{s.max}</td>
                <td className="px-3 py-2.5 text-gray-500">{s.min}</td>
                <td className="px-3 py-2.5">{percent(s.passRate)}</td>
                <td className="px-3 py-2.5">{percent(s.excellentRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="分数段分布">
          <div className="mb-2"><Select value={distSubject} onChange={(e) => setDistSubject(e.target.value)} className="w-32"><option value="总分">总分</option>{analysis.subjects.map((s: string) => <option key={s} value={s}>{s}</option>)}</Select></div>
          <BarComp data={distData} height={210} />
        </ChartCard>
        <ChartCard title="历次考试平均分趋势">
          <TrendChart data={trend} dataKey="avg" name="平均分" height={210} />
        </ChartCard>
      </div>
    </div>
  )
}

// ===== 个人分析 =====
function StudentTab({ scores, exams, examId, students, studentId, setStudentId, trendSubject, setTrendSubject }: any) {
  const radar = useMemo(() => radarData(scores, examId, studentId || null), [scores, examId, studentId])
  const vector = useMemo(() => (studentId ? studentVector(scores, examId, studentId) : {}), [scores, examId, studentId])
  const totalTrend = useMemo(() => (studentId ? studentTrend(scores, exams, studentId) : []), [scores, exams, studentId])
  const subjTrend = useMemo(() => (studentId && trendSubject !== '总分' ? studentTrend(scores, exams, studentId, trendSubject) : []), [scores, exams, studentId, trendSubject])
  const subjects = examSubjects(scores, examId)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="w-64">
          <Field label="选择学生">
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : '')}>
              {students.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="w-32">
          <Field label="趋势科目">
            <Select value={trendSubject} onChange={(e) => setTrendSubject(e.target.value)}>
              <option value="总分">总分</option>
              {subjects.map((s: string) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="强弱科雷达图">
          <RadarComp data={radar} height={220} />
        </ChartCard>
        <ChartCard title={trendSubject === '总分' ? '总分趋势' : `${trendSubject}趋势`}>
          <TrendChart data={trendSubject === '总分' ? totalTrend : subjTrend} dataKey="value" name={trendSubject} height={220} />
        </ChartCard>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-500">{subjects.map((s: string) => <th key={s} className="px-3 py-2.5">{s}</th>)}<th className="px-3 py-2.5 font-semibold">总分</th></tr></thead>
          <tbody>
            <tr>
              {subjects.map((s: string) => <td key={s} className="px-3 py-2.5 font-medium">{vector[s] ?? '—'}</td>)}
              <td className="px-3 py-2.5 font-bold text-brand-600">{Object.values(vector).reduce((a: any, b: any) => a + b, 0)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ===== 学科对比 =====
function CompareTab({ analysis, scores, examId }: any) {
  const radar = useMemo(() => radarData(scores, examId, null), [scores, examId])
  const barData = analysis.subjectStats.map((s: SubjectStat) => ({ name: s.subject, 平均分: s.avg, 及格率: s.passRate }))
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="各科平均分雷达图"><RadarComp data={radar} height={240} /></ChartCard>
      <ChartCard title="各科平均分 / 及格率">
        <div style={{ height: 240 }}>
          <BarComp data={barData} xKey="name" yKey="平均分" height={120} />
          <BarComp data={barData} xKey="name" yKey="及格率" color="#16a34a" height={110} />
        </div>
      </ChartCard>
    </div>
  )
}

// ===== 排名与赋分 =====
function RankingTab({ analysis, examId, students, summaries, nameMap }: any) {
  const ranks = useMemo(() => rankMap(analysis.studentTotals), [analysis])
  const summaryMap = useMemo(() => {
    const m = new Map<number, any>()
    summaries.filter((s: any) => s.examId === examId).forEach((s: any) => m.set(s.studentId, s))
    return m
  }, [summaries, examId])

  const saveSummary = async (studentId: number, key: string, val: string) => {
    const v = val === '' ? null : Number(val)
    const existing = summaryMap.get(studentId)
    if (existing) await db.table('examSummaries').update(existing.id, { [key]: v })
    else await db.table('examSummaries').add({ examId, studentId, [key]: v })
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
            <th className="px-3 py-2.5">姓名</th>
            <th className="px-3 py-2.5">原始总分</th>
            <th className="px-3 py-2.5">班级排名</th>
            <th className="px-3 py-2.5">年级排名</th>
            <th className="px-3 py-2.5">组合排名</th>
            <th className="px-3 py-2.5">赋分后总分</th>
          </tr>
        </thead>
        <tbody>
          {analysis.studentTotals.map((t: any) => {
            const sum = summaryMap.get(t.studentId)
            const classRank = sum?.classRank ?? ranks.get(t.studentId)
            return (
              <tr key={t.studentId} className="border-b border-gray-50">
                <td className="px-3 py-2.5 font-medium">{nameMap.get(t.studentId) || t.studentId}</td>
                <td className="px-3 py-2.5 font-semibold text-brand-600">{t.total}</td>
                <td className="px-3 py-2.5"><Input key={`${examId}-${t.studentId}-c`} type="number" className="w-20" defaultValue={classRank ?? ''} onBlur={(e) => saveSummary(t.studentId, 'classRank', e.target.value)} /></td>
                <td className="px-3 py-2.5"><Input key={`${examId}-${t.studentId}-g`} type="number" className="w-20" defaultValue={sum?.gradeRank ?? ''} onBlur={(e) => saveSummary(t.studentId, 'gradeRank', e.target.value)} /></td>
                <td className="px-3 py-2.5"><Input key={`${examId}-${t.studentId}-m`} type="number" className="w-20" defaultValue={sum?.comboRank ?? ''} onBlur={(e) => saveSummary(t.studentId, 'comboRank', e.target.value)} /></td>
                <td className="px-3 py-2.5"><Input key={`${examId}-${t.studentId}-t`} type="number" className="w-20" defaultValue={sum?.total ?? ''} onBlur={(e) => saveSummary(t.studentId, 'total', e.target.value)} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="p-3 text-xs text-gray-400">💡 原始总分与班级排名自动计算；「班级排名 / 年级排名 / 组合排名 / 赋分后总分」批量导入时会自动填入，也可手动修改（失焦即保存）。</p>
    </Card>
  )
}

// ===== 分数段 =====
function BandsTab({ analysis }: any) {
  const bands = scoreBands(analysis.studentTotals.map((t: any) => t.total), analysis.totalFullMark)
  const data = bands.map((b) => ({ name: b.band, value: b.count }))
  const max = Math.max(1, ...bands.map((b) => b.count))
  return (
    <div className="space-y-4">
      <ChartCard title="总分分数段人数分布"><BarComp data={data} height={240} /></ChartCard>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {bands.map((b) => (
          <Card key={b.band} className="p-3 text-center">
            <p className="text-xs text-gray-500">{b.band}分</p>
            <p className="text-xl font-bold text-gray-800">{b.count} <span className="text-xs font-normal text-gray-400">人</span></p>
            <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-brand-500" style={{ width: `${(b.count / max) * 100}%` }} /></div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ===== 偏科预警 =====
function BiasTab({ scores, examId, nameMap }: any) {
  const bias = useMemo(() => detectBias(scores, examId), [scores, examId])
  return (
    <Card className="overflow-x-auto">
      {bias.length === 0 ? <EmptyState title="未发现明显偏科" description="当前考试各科成绩较为均衡" /> : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-500"><th className="px-3 py-2.5">学生</th><th className="px-3 py-2.5">薄弱科目</th><th className="px-3 py-2.5">得分</th><th className="px-3 py-2.5">班平均</th><th className="px-3 py-2.5">差距</th></tr></thead>
          <tbody>
            {bias.map((b, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="px-3 py-2.5 font-medium">{nameMap.get(b.studentId) || b.studentId}</td>
                <td className="px-3 py-2.5"><Badge color="amber">{b.subject}</Badge></td>
                <td className="px-3 py-2.5">{b.score}</td>
                <td className="px-3 py-2.5 text-gray-500">{b.subjectAvg}</td>
                <td className="px-3 py-2.5 text-red-500">-{b.gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

// ===== 临界生 =====
function BorderlineTab({ analysis, nameMap, line, setLine, buffer, setBuffer, examId }: any) {
  const list = useMemo(() => borderlineStudents(analysis, line, buffer), [analysis, line, buffer])
  const addToTrack = async (studentId: number, total: number, delta: number) => {
    await db.table('borderline').add({ studentId, examId, line, total, delta, status: '跟踪中', note: '' })
    alert('已加入临界生跟踪表')
  }
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-36"><Field label="临界线（分）"><Input type="number" value={line} onChange={(e) => setLine(Number(e.target.value))} /></Field></div>
          <div className="w-36"><Field label="浮动区间（分）"><Input type="number" value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} /></Field></div>
          <div className="text-sm text-gray-500 pb-2">共 <span className="font-bold text-brand-600">{list.length}</span> 名临界生（{line}±{buffer} 分）</div>
        </div>
      </Card>
      <Card className="overflow-x-auto">
        {list.length === 0 ? <EmptyState title="该区间暂无学生" /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-500"><th className="px-3 py-2.5">学生</th><th className="px-3 py-2.5">总分</th><th className="px-3 py-2.5">距临界线</th><th className="px-3 py-2.5"></th></tr></thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.studentId} className="border-b border-gray-50">
                  <td className="px-3 py-2.5 font-medium">{nameMap.get(b.studentId) || b.studentId}</td>
                  <td className="px-3 py-2.5">{b.total}</td>
                  <td className="px-3 py-2.5"><Badge color={b.delta >= 0 ? 'green' : 'red'}>{b.delta >= 0 ? '+' : ''}{b.delta}</Badge></td>
                  <td className="px-3 py-2.5 text-right"><Button variant="secondary" size="sm" onClick={() => addToTrack(b.studentId, b.total, b.delta)}><Plus size={13} />加入跟踪</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ===== 贡献率 =====
function ContributionTab({ analysis }: any) {
  const contribution = subjectContribution(analysis.subjectStats)
  const data = contribution.map((c) => ({ name: c.subject, value: c.contribution }))
  return (
    <div className="space-y-4">
      <ChartCard title="各科对总分的贡献率（%）"><BarComp data={data} height={240} color="#8b5cf6" /></ChartCard>
      <Card className="p-4 text-sm text-gray-600">
        <p>贡献率 = 该科平均分 ÷ 各科平均分之和。贡献率偏低的科目即为拉低总分的「短板学科」，可在多学科协同中协调任课教师重点突破。</p>
      </Card>
    </div>
  )
}
