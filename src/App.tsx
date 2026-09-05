import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './contexts/ToastContext'
import { ClassProvider } from './contexts/ClassContext'
import { LayoutWithProviders } from './components/Layout'
import { LockGate } from './components/LockGate'
import { Dashboard } from './pages/Dashboard'
import { Timetable } from './pages/Timetable'
import { Todos } from './pages/Todos'
import { Calendar } from './pages/Calendar'
import { Attendance } from './pages/Attendance'
import { Seating } from './pages/Seating'
import { Communication } from './pages/Communication'
import { ClassRecords } from './pages/ClassRecords'
import { Resources } from './pages/Resources'
import { Homework } from './pages/Homework'
import { Scores } from './pages/Scores'
import { Documents } from './pages/Documents'
import { Settings } from './pages/Settings'
import { NotFound } from './pages/NotFound'

const Students = lazy(() => import('./pages/Students').then((module) => ({ default: module.Students })))

function PageLoading() {
  return (
    <div role="status" className="rounded-card border border-line bg-white p-6 text-sm text-ink-500">
      正在加载学生信息…
    </div>
  )
}

export function App() {
  return (
    <ToastProvider>
      <ClassProvider>
        <HashRouter>
          <LockGate>
            <Routes>
              <Route element={<LayoutWithProviders />}>
                <Route index element={<Dashboard />} />
                <Route path="/timetable" element={<Timetable />} />
                <Route path="/todos" element={<Todos />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route
                  path="/students"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <Students />
                    </Suspense>
                  }
                />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/seating" element={<Seating />} />
                <Route path="/communication" element={<Communication />} />
                <Route path="/records" element={<ClassRecords />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/homework" element={<Homework />} />
                <Route path="/scores" element={<Scores />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </LockGate>
        </HashRouter>
      </ClassProvider>
    </ToastProvider>
  )
}
