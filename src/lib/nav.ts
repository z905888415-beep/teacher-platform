import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Database,
  FileText,
  Grid3x3,
  LayoutDashboard,
  MessagesSquare,
  NotebookPen,
  ScrollText,
  UserCheck,
  Users,
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

/** 一级入口分组与二级页面（开发文档 5.1 + 原型导航） */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'work',
    label: '工作',
    items: [{ path: '/', label: '工作台', icon: LayoutDashboard }],
  },
  {
    key: 'teaching',
    label: '教学',
    items: [
      { path: '/timetable', label: '我的课表', icon: CalendarDays },
      { path: '/resources', label: '备课资料', icon: BookOpen },
      { path: '/homework', label: '作业记录', icon: NotebookPen },
      { path: '/scores', label: '数学成绩', icon: BarChart3 },
    ],
  },
  {
    key: 'class',
    label: '班级',
    items: [
      { path: '/students', label: '学生与家长', icon: Users },
      { path: '/attendance', label: '出勤与请假', icon: UserCheck },
      { path: '/seating', label: '座位与值日', icon: Grid3x3 },
      { path: '/communication', label: '家校沟通', icon: MessagesSquare },
      { path: '/records', label: '班级记录', icon: ScrollText },
    ],
  },
  {
    key: 'other',
    label: '其他',
    items: [
      { path: '/documents', label: '常用文档', icon: FileText },
      { path: '/settings', label: '数据与设置', icon: Database },
    ],
  },
]

/** 移动端底部导航（开发文档 5.2） */
export const MOBILE_TABS: NavItem[] = [
  { path: '/', label: '工作台', icon: LayoutDashboard },
  { path: '/timetable', label: '课表', icon: CalendarDays },
  { path: '/todos', label: '待办', icon: NotebookPen },
  { path: '/students', label: '班级', icon: Users },
  { path: '/settings', label: '我的', icon: Database },
]

export function findNav(path: string): { group: NavGroup; item: NavItem } | null {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((entry) => entry.path === path)
    if (item) return { group, item }
  }
  return null
}
