import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, X, ChevronDown, GraduationCap } from 'lucide-react'
import { NAV_GROUPS, MOBILE_TABS, type NavGroup } from '../lib/nav'
import { cn } from '../lib/utils'

function Logo() {
  return (
    <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-100">
      <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
        <GraduationCap size={18} />
      </div>
      <div className="leading-tight">
        <p className="font-bold text-gray-800 text-sm">教师工作平台</p>
        <p className="text-[10px] text-gray-400">教学 · 班级 · 一站式</p>
      </div>
    </div>
  )
}

function NavItemLink({ path, label, icon: Icon, onNavigate }: { path: string; label: string; icon: any; onNavigate?: () => void }) {
  return (
    <NavLink
      to={path}
      end={path === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
          isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50',
        )
      }
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

function GroupBlock({ group, onNavigate }: { group: NavGroup; onNavigate?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide"
      >
        <group.icon size={13} />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-0.5 px-1">
          {group.items.map((item) => (
            <NavItemLink key={item.path} {...item} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 桌面端侧边栏 */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-gray-200 bg-white z-30">
        <Logo />
        <nav className="flex-1 overflow-y-auto px-2 py-3 pb-8">
          {NAV_GROUPS.map((g) => <GroupBlock key={g.id} group={g} />)}
        </nav>
      </aside>

      {/* 移动端顶栏 */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 px-4 h-14 bg-white border-b border-gray-200">
        <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setDrawerOpen(true)}>
          <Menu size={20} />
        </button>
        <span className="font-semibold text-gray-800">教师工作平台</span>
      </header>

      {/* 移动端抽屉 */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
              <Logo />
              <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setDrawerOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3 pb-8">
              {NAV_GROUPS.map((g) => <GroupBlock key={g.id} group={g} onNavigate={() => setDrawerOpen(false)} />)}
            </nav>
          </div>
        </div>
      )}

      {/* 主内容 */}
      <main className="md:pl-64">
        <div className="mx-auto max-w-6xl px-3 sm:px-6 py-4 pb-24 md:pb-8">
          <Outlet />
        </div>
      </main>

      {/* 移动端底部导航 */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 grid grid-cols-5" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {MOBILE_TABS.map((t) => {
          const active = location.pathname === t.path || (t.path !== '/' && location.pathname.startsWith(t.path))
          return (
            <NavLink key={t.path} to={t.path} end={t.path === '/'} className="flex flex-col items-center gap-0.5 py-2">
              <t.icon size={20} className={active ? 'text-brand-600' : 'text-gray-400'} />
              <span className={cn('text-[10px]', active ? 'text-brand-600 font-medium' : 'text-gray-400')}>{t.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
