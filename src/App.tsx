import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import { seedDemoData } from './db/seed'
import { getSetting } from './db'

import Dashboard from './pages/Dashboard'
import Timetable from './pages/Timetable'
import Calendar from './pages/Calendar'
import Todos from './pages/Todos'
import StudentPage from './pages/Students'
import Scores from './pages/Scores'
import Analysis from './pages/Analysis'
import Seating from './pages/Seating'
import Duty from './pages/Duty'
import Selection from './pages/Selection'
import Borderline from './pages/Borderline'
import ToolsPage from './pages/Tools'
import Countdown from './pages/Countdown'
import { DataSettings, CloudSettings, SecuritySettings, SecurityLock } from './pages/Settings'
import { GenericPage } from './pages/generic'

// 应用入口：首次启动注入示例数据，按需做密码保护。
export default function App() {
  const [ready, setReady] = useState(false)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        await seedDemoData()
        const pwd = await getSetting<string>('password', '')
        if (pwd) setLocked(true)
      } finally {
        setReady(true)
      }
    })()
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-gray-500">正在加载…</p>
        </div>
      </div>
    )
  }

  if (locked) {
    return <SecurityLock onUnlock={() => setLocked(false)} />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/timetable" element={<Timetable />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/todos" element={<Todos />} />

        <Route path="/students" element={<StudentPage initialTab="basic" />} />
        <Route path="/roster" element={<StudentPage initialTab="roster" />} />
        <Route path="/records" element={<StudentPage initialTab="records" />} />
        <Route path="/scores" element={<Scores />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/subject-compare" element={<Analysis initialTab="compare" />} />
        <Route path="/bias" element={<Analysis initialTab="bias" />} />
        <Route path="/ranking" element={<Analysis initialTab="ranking" />} />
        <Route path="/contribution" element={<Analysis initialTab="contribution" />} />
        <Route path="/score-bands" element={<Analysis initialTab="bands" />} />

        <Route path="/resources" element={<GenericPage configKey="resources" />} />
        <Route path="/templates" element={<GenericPage configKey="templates" />} />
        <Route path="/teaching-records" element={<GenericPage configKey="teachingRecords" />} />

        <Route path="/seating" element={<Seating />} />
        <Route path="/duty" element={<Duty />} />
        <Route path="/cadres" element={<GenericPage configKey="cadres" />} />
        <Route path="/communication" element={<GenericPage configKey="communication" />} />
        <Route path="/summaries" element={<GenericPage configKey="summaries" />} />
        <Route path="/rewards" element={<GenericPage configKey="rewards" />} />
        <Route path="/leaves" element={<GenericPage configKey="leaves" />} />
        <Route path="/concerns" element={<GenericPage configKey="concerns" />} />
        <Route path="/class-meetings" element={<GenericPage configKey="classMeetings" />} />
        <Route path="/class-fund" element={<GenericPage configKey="classFund" />} />
        <Route path="/class-log" element={<GenericPage configKey="classLog" />} />
        <Route path="/attendance" element={<GenericPage configKey="attendance" />} />
        <Route path="/dormitory" element={<GenericPage configKey="dormitory" />} />
        <Route path="/morning-evening" element={<GenericPage configKey="morningEvening" />} />
        <Route path="/safety-health" element={<GenericPage configKey="safetyHealth" />} />
        <Route path="/parent-meetings" element={<GenericPage configKey="parentMeetings" />} />
        <Route path="/home-visits" element={<GenericPage configKey="homeVisits" />} />
        <Route path="/family-situation" element={<GenericPage configKey="familySituation" />} />
        <Route path="/notifications" element={<GenericPage configKey="notifications" />} />

        <Route path="/subject-teachers" element={<GenericPage configKey="subjectTeachers" />} />
        <Route path="/teaching-progress" element={<GenericPage configKey="teachingProgress" />} />
        <Route path="/homework" element={<GenericPage configKey="homework" />} />
        <Route path="/meetings" element={<GenericPage configKey="meetings" />} />
        <Route path="/borderline" element={<Borderline />} />

        <Route path="/selection" element={<Selection />} />
        <Route path="/goals" element={<GenericPage configKey="goals" />} />
        <Route path="/career" element={<GenericPage configKey="career" />} />
        <Route path="/psychology" element={<GenericPage configKey="psychology" />} />
        <Route path="/talks" element={<GenericPage configKey="talks" />} />
        <Route path="/comprehensive" element={<GenericPage configKey="comprehensive" />} />

        <Route path="/college-entrance" element={<GenericPage configKey="collegeEntrance" />} />
        <Route path="/funding" element={<GenericPage configKey="funding" />} />
        <Route path="/countdowns" element={<Countdown />} />

        <Route path="/tools/ai" element={<ToolsPage tableName="aiTools" title="AI 工具" subtitle="常用 AI 助手入口，如 ChatGPT、Kimi、DeepSeek、文心一言等" />} />
        <Route path="/tools/office" element={<ToolsPage tableName="officeTools" title="办公软件" subtitle="WPS、Office 在线、腾讯文档、飞书等" />} />
        <Route path="/tools/doc" element={<GenericPage configKey="docTemplates" />} />
        <Route path="/tools/file" element={<ToolsPage tableName="fileTools" title="文件工具" subtitle="格式转换、PDF 处理、图片压缩等在线工具" />} />

        <Route path="/settings/data" element={<DataSettings />} />
        <Route path="/settings/cloud" element={<CloudSettings />} />
        <Route path="/settings/security" element={<SecuritySettings />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
