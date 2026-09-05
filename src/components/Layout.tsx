import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, Plus, WifiOff } from 'lucide-react'
import { NAV_GROUPS, MOBILE_TABS, findNav } from '../lib/nav'
import { setSetting, useSetting } from '../hooks/useSetting'
import { useClassManager } from '../contexts/ClassContext'
import { ClassActionsProvider, useClassActions } from './ClassManager'
import { QuickRecordDialog } from './QuickRecordDialog'
import { Button, Select } from './ui'

const FALLBACK_TITLES: Record<string, [string, string]> = {
  '/todos': ['工作台', '待办'],
  '/calendar': ['工作台', '校历'],
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = () => setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export function Layout() {
  const location = useLocation()
  const { classes, currentClass, currentClassId, setCurrentClassId } = useClassManager()
  const { openAddClass, openRenameClass, openDeleteClass } = useClassActions()
  const userCollapsed = useSetting('sidebarCollapsed', '0') === '1'
  const compact = useMediaQuery('(min-width: 768px) and (max-width: 899px)')
  const collapsed = userCollapsed || compact
  const semesterLabel = useSetting('semesterLabel', '2026–2027 学年第一学期')
  const [quickOpen, setQuickOpen] = useState(false)
  // F24：离线时顶栏短暂提示
  const [offlineHint, setOfflineHint] = useState(false)

  useEffect(() => {
    const goOnline = () => setOfflineHint(false)
    const goOffline = () => {
      setOfflineHint(true)
      window.setTimeout(() => setOfflineHint(false), 5000)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const nav = findNav(location.pathname)
  const [groupLabel, pageLabel] = FALLBACK_TITLES[location.pathname] ?? [
    nav?.group.label ?? '工作台',
    nav?.item.label ?? '工作台',
  ]

  const toggleCollapsed = () => {
    setSetting('sidebarCollapsed', userCollapsed ? '0' : '1')
  }

  return (
    <div className="min-h-screen bg-canvas">
      {offlineHint && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-3 z-[85] flex -translate-x-1/2 items-center gap-2 rounded-full bg-warning px-4 py-2 text-xs font-semibold text-white shadow-drag"
        >
          <WifiOff size={14} aria-hidden />
          当前离线，数据将保存在本机
        </div>
      )}
      {/* ---------------- 侧栏（桌面端） ---------------- */}
      <aside
        aria-label="主导航"
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-[#F1F3F8] md:flex ${
          collapsed ? 'w-16' : 'w-[232px]'
        }`}
      >
        <div className={`border-b border-line bg-white ${collapsed ? 'px-2 py-4 text-center' : 'px-5 py-5'}`}>
          <p className={`font-bold tracking-tight text-ink-900 ${collapsed ? 'text-sm' : 'text-[17px]'}`}>
            {collapsed ? '工作' : '初中教师工作台'}
          </p>
          {!collapsed && (
            <>
              <p className="mt-2 text-[11px] leading-[18px] text-ink-500">
                {semesterLabel}
                <br />
                当前班级：{currentClass?.name ?? '—'}
              </p>
            </>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <div className="grid content-start gap-[9px]">
            {NAV_GROUPS.map((group) => {
              const isActiveGroup = group.items.some((item) => item.path === location.pathname)
              return (
                <section
                  key={group.key}
                  className={`rounded-group p-2 transition-colors ${
                    isActiveGroup ? 'border border-[#D8E0F6] bg-white shadow-panel' : 'border border-transparent bg-white/56'
                  }`}
                >
                  {!collapsed && (
                    <p className="flex items-center justify-between px-2 pb-1.5 pt-1 text-[11px] font-semibold tracking-[0.08em] text-ink-700">
                      <span>{group.label}</span>
                      <span className="grid h-5 w-5 place-items-center rounded-full border border-line text-[10px] tabular-nums text-ink-500">
                        {group.items.length}
                      </span>
                    </p>
                  )}
                  <ul className="grid gap-[3px]">
                    {group.items.map((item) => {
                      const active = item.path === location.pathname
                      const Icon = item.icon
                      return (
                        <li key={item.path}>
                          <a
                            href={`#${item.path}`}
                            aria-current={active ? 'page' : undefined}
                            title={item.label}
                            className={`flex min-h-9 items-center rounded-menu text-[13px] transition-colors duration-100 ${
                              collapsed ? 'justify-center px-1' : 'relative py-2 pl-7 pr-2.5'
                            } ${
                              active
                                ? 'bg-brand-600 font-semibold text-white'
                                : 'text-ink-700 hover:translate-x-0.5 hover:bg-surface-muted hover:text-ink-900'
                            }`}
                          >
                            {collapsed ? (
                              <Icon size={18} aria-hidden />
                            ) : (
                              <>
                                <span
                                  aria-hidden
                                  className={`absolute left-3 h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : 'bg-[#C8CEDB]'}`}
                                />
                                {item.label}
                              </>
                            )}
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        </nav>

        <div className="border-t border-line px-3 py-2.5">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
            title={collapsed ? '展开侧栏' : '收起侧栏'}
            className="grid h-9 w-9 place-items-center rounded-menu text-ink-500 hover:bg-white hover:text-ink-900"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          {!collapsed && <p className="px-1 pb-1 text-[11px] text-ink-500">数据默认保存在本机</p>}
        </div>
      </aside>

      {/* ---------------- 主区域 ---------------- */}
      <div className={`min-h-screen ${collapsed ? 'md:pl-16' : 'md:pl-[232px]'}`}>
        {/* 桌面顶栏 */}
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-line bg-white/94 px-8 backdrop-blur md:flex">
          <p className="text-sm font-semibold text-ink-700">
            {groupLabel} <span className="mx-1 font-normal text-ink-500">/</span> {pageLabel}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5" aria-label="班级管理">
              <Select
                aria-label="当前班级"
                className="h-9 shrink-0 rounded-ui text-[13px]"
                style={{ width: 140 }}
                value={currentClassId ?? ''}
                onChange={(event) => setCurrentClassId(Number(event.target.value))}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Button onClick={openAddClass}>添加班级</Button>
              <Button onClick={openRenameClass} disabled={!currentClass}>
                重命名
              </Button>
              <Button variant="dangerSoft" onClick={openDeleteClass} disabled={classes.length <= 1} title={classes.length <= 1 ? '至少保留一个班级' : `删除${currentClass?.name ?? ''}`}>
                删除班级
              </Button>
            </div>
            <Select
              aria-label="当前学期"
              className="h-9 shrink-0 rounded-ui text-[13px]"
              style={{ width: 122 }}
              value={semesterLabel}
              onChange={(event) => {
                const label = event.target.value
                setSetting('semesterLabel', label)
              }}
            >
              <option value="2026–2027 学年第一学期">第一学期</option>
              <option value="2026–2027 学年第二学期">第二学期</option>
            </Select>
            <Button variant="primary" onClick={() => setQuickOpen(true)}>
              新增记录
            </Button>
          </div>
        </header>

        {/* 移动端顶栏 */}
        <MobileHeader title={pageLabel} onQuickRecord={() => setQuickOpen(true)} onAddClass={openAddClass} />

        <main className="mx-auto w-full max-w-[1440px] px-4 pb-24 pt-[72px] sm:px-8 sm:pb-10 sm:pt-8">
          <Outlet />
        </main>
      </div>

      {/* 移动端底部导航 */}
      <MobileNav pathname={location.pathname} />

      <QuickRecordDialog open={quickOpen} onClose={() => setQuickOpen(false)} />
    </div>
  )
}

function MobileHeader({
  title,
  onQuickRecord,
  onAddClass,
}: {
  title: string
  onQuickRecord: () => void
  onAddClass: () => void
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between rounded-b-[20px] border-b border-line bg-white/95 px-4 backdrop-blur md:hidden">
      <span className="text-sm font-bold text-ink-900">{title}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAddClass}
          className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-700"
        >
          添加班级
        </button>
        <button
          type="button"
          onClick={onQuickRecord}
          aria-label="新增记录"
          className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-white"
        >
          <Plus size={18} />
        </button>
      </div>
    </header>
  )
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="移动端导航"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-white md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {MOBILE_TABS.map((tab) => {
        const active =
          tab.path === '/' ? pathname === '/' || pathname === '/calendar' : pathname.startsWith(tab.path)
        const Icon = tab.icon
        return (
          <a
            key={tab.path}
            href={`#${tab.path}`}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[58px] flex-col items-center justify-center gap-0.5 border-t-[3px] text-[10px] ${
              active ? 'border-brand-600 font-semibold text-brand-600' : 'border-transparent text-ink-500'
            }`}
          >
            <Icon size={18} aria-hidden />
            {tab.label}
          </a>
        )
      })}
    </nav>
  )
}

export function LayoutWithProviders() {
  return (
    <ClassActionsProvider>
      <Layout />
    </ClassActionsProvider>
  )
}
