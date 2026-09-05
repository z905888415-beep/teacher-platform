/** 课程色板：同一课名始终同一颜色；未知课名使用稳定的备用色 */
const COURSE_COLORS: Record<string, [string, string]> = {
  数学: ['#002FA7', '#EDF2FF'],
  语文: ['#C24E00', '#FFF3EA'],
  英语: ['#177245', '#EAF7F0'],
  物理: ['#6C3AAE', '#F3ECFC'],
  化学: ['#007A78', '#E7F7F6'],
  生物: ['#5F6F2C', '#F2F5E7'],
  道德与法治: ['#B42318', '#FDECEA'],
  历史: ['#8A4B08', '#FFF4E5'],
  地理: ['#006D8F', '#E8F7FC'],
  体育: ['#3F6B47', '#EDF5EE'],
  班会: ['#A61E69', '#FCECF5'],
  自习: ['#5B6573', '#F1F2F4'],
}

const FALLBACK_COLORS: [string, string][] = [
  ['#315B7D', '#EBF3F8'],
  ['#76520E', '#FBF4E5'],
  ['#695C9A', '#F1EEFA'],
  ['#286B61', '#EAF6F3'],
]

export function courseColors(subject: string): [string, string] {
  const direct = COURSE_COLORS[subject]
  if (direct) return direct
  const hash = [...subject].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

export const COURSE_NAME_OPTIONS = Object.keys(COURSE_COLORS)
