import {
  Home, LayoutDashboard, LayoutGrid, CalendarDays, ListTodo, GraduationCap, Users, PenLine,
  BarChart3, FolderOpen, FileText, BookOpen, ClipboardList, ClipboardCheck, Crown, PhoneCall,
  Award, CalendarRange, HeartPulse, MessageSquare, Wallet, BookMarked, UserCheck, DoorOpen, Moon,
  ShieldCheck, Send, TrendingUp, PieChart, AlertTriangle, Target, Scale, ListChecks, Heart,
  Sparkles, Briefcase, Timer, Database, Cloud, Lock, Wrench, Monitor, Activity, Compass, Clock,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  id: string
  label: string
  icon: LucideIcon
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'main', label: '主工作台', icon: Home,
    items: [
      { path: '/', label: '工作台总览', icon: LayoutDashboard },
      { path: '/timetable', label: '我的课表', icon: LayoutGrid },
      { path: '/calendar', label: '学期校历', icon: CalendarDays },
      { path: '/todos', label: '待办事项', icon: ListTodo },
    ],
  },
  {
    id: 'teaching', label: '教学工作台', icon: GraduationCap,
    items: [
      { path: '/students', label: '学生名单', icon: Users },
      { path: '/scores', label: '学生成绩', icon: PenLine },
      { path: '/analysis', label: '成绩分析', icon: BarChart3 },
      { path: '/resources', label: '备课资源', icon: FolderOpen },
      { path: '/templates', label: '备课模板', icon: FileText },
      { path: '/teaching-records', label: '教学记录', icon: BookOpen },
    ],
  },
  {
    id: 'homeroom', label: '班主任工作台', icon: ClipboardList,
    items: [
      { path: '/roster', label: '学生花名册', icon: Users },
      { path: '/seating', label: '座位安排', icon: LayoutGrid },
      { path: '/duty', label: '值日安排', icon: ClipboardCheck },
      { path: '/cadres', label: '班干部安排', icon: Crown },
      { path: '/communication', label: '家校沟通', icon: PhoneCall },
      { path: '/summaries', label: '班级总结', icon: FileText },
      { path: '/rewards', label: '奖惩记录', icon: Award },
      { path: '/leaves', label: '请假记录', icon: CalendarRange },
      { path: '/concerns', label: '学生关注', icon: HeartPulse },
      { path: '/class-meetings', label: '班会记录', icon: MessageSquare },
      { path: '/class-fund', label: '班费管理', icon: Wallet },
      { path: '/class-log', label: '班级日志', icon: BookMarked },
      { path: '/attendance', label: '考勤管理', icon: UserCheck },
      { path: '/dormitory', label: '宿舍走读', icon: DoorOpen },
      { path: '/morning-evening', label: '早晚自习', icon: Moon },
      { path: '/safety-health', label: '安全健康', icon: ShieldCheck },
      { path: '/parent-meetings', label: '家长会记录', icon: Users },
      { path: '/home-visits', label: '家访记录', icon: Home },
      { path: '/family-situation', label: '家庭情况', icon: Heart },
      { path: '/notifications', label: '通知模板', icon: Send },
    ],
  },
  {
    id: 'coordination', label: '学科协同', icon: UserCheck,
    items: [
      { path: '/subject-teachers', label: '学科教师通讯录', icon: UserCheck },
      { path: '/teaching-progress', label: '教学进度共享', icon: TrendingUp },
      { path: '/homework', label: '作业与考试协调', icon: ClipboardList },
      { path: '/subject-compare', label: '学科成绩对比', icon: PieChart },
      { path: '/bias', label: '偏科预警', icon: AlertTriangle },
      { path: '/meetings', label: '学科协调会', icon: MessageSquare },
      { path: '/borderline', label: '临界生跟踪', icon: Target },
    ],
  },
  {
    id: 'advanced', label: '成绩进阶', icon: BarChart3,
    items: [
      { path: '/selection', label: '选科走班', icon: Scale },
      { path: '/ranking', label: '赋分与排名', icon: ListChecks },
      { path: '/goals', label: '目标管理', icon: Target },
      { path: '/contribution', label: '学科贡献率', icon: PieChart },
      { path: '/score-bands', label: '分数段统计', icon: Activity },
    ],
  },
  {
    id: 'development', label: '学生发展', icon: Heart,
    items: [
      { path: '/career', label: '生涯规划', icon: Compass },
      { path: '/psychology', label: '心理状态', icon: HeartPulse },
      { path: '/talks', label: '谈心谈话', icon: MessageSquare },
      { path: '/comprehensive', label: '综合素质评价', icon: Award },
    ],
  },
  {
    id: 'admin', label: '行政事务', icon: Briefcase,
    items: [
      { path: '/records', label: '学籍信息', icon: FileText },
      { path: '/college-entrance', label: '高考报名体检', icon: Clock },
      { path: '/funding', label: '贫困资助保险', icon: Wallet },
      { path: '/countdowns', label: '重要事项倒计时', icon: Timer },
    ],
  },
  {
    id: 'tools', label: '常用工具', icon: Wrench,
    items: [
      { path: '/tools/ai', label: 'AI 工具', icon: Sparkles },
      { path: '/tools/office', label: '办公软件', icon: Monitor },
      { path: '/tools/doc', label: '文档模板', icon: FileText },
      { path: '/tools/file', label: '文件工具', icon: FolderOpen },
    ],
  },
  {
    id: 'settings', label: '数据与设置', icon: Database,
    items: [
      { path: '/settings/data', label: '数据管理', icon: Database },
      { path: '/settings/cloud', label: '云同步', icon: Cloud },
      { path: '/settings/security', label: '密码保护', icon: Lock },
    ],
  },
]

// 移动端底部导航（5 个主要入口）
export const MOBILE_TABS: NavItem[] = [
  { path: '/', label: '工作台', icon: LayoutDashboard },
  { path: '/scores', label: '成绩', icon: PenLine },
  { path: '/roster', label: '班级', icon: Users },
  { path: '/tools/ai', label: '工具', icon: Sparkles },
  { path: '/settings/data', label: '我的', icon: Database },
]
