import * as XLSX from 'xlsx/dist/xlsx.mini.min.js'
import type { Student } from '../db'

/** 学生 Excel 的固定列顺序；模板、导入和导出均以此为准。 */
export const STUDENT_EXCEL_COLUMNS = [
  '班内编号',
  '姓名',
  '性别',
  '生日',
  '家长姓名',
  '家长电话',
  '紧急联系人',
  '住宿类型',
  '备注',
] as const

export type StudentExcelColumn = (typeof STUDENT_EXCEL_COLUMNS)[number]

export interface StudentExcelRecord {
  studentNo?: string
  name: string
  gender?: string
  birthday?: string
  parentName?: string
  parentPhone?: string
  emergencyContact?: string
  boarding?: string
  note?: string
}

export interface StudentImportError {
  /** Excel 中的实际行号（表头为第 1 行）。 */
  row: number
  field: string
  reason: string
}

export interface StudentImportAction extends StudentExcelRecord {
  /** 命中当前班相同班内编号时填入，用于更新已有学生。 */
  existingId?: number
}

export interface StudentImportPreview {
  fileName?: string
  /** 不包含完全空白行的待处理数据行数。 */
  totalRows: number
  validRows: number
  addCount: number
  updateCount: number
  /** 无效数据行总数；完全空白行会被忽略。 */
  skippedCount: number
  errors: StudentImportError[]
  rows: StudentImportAction[]
}

const GENDERS = new Set(['男', '女'])
const BOARDING_TYPES = new Set(['走读', '住宿', '午托'])
export const MAX_STUDENT_EXCEL_BYTES = 10 * 1024 * 1024

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 将 Excel 单元格安全地变成文本，并尽量保持编号/电话的前导零。 */
export function studentCellToText(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatLocalDate(value)
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value).trim()
}

function emptyToUndefined(value: unknown): string | undefined {
  const text = studentCellToText(value)
  return text || undefined
}

function isValidBirthday(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function blankPreview(fileName?: string, errors: StudentImportError[] = []): StudentImportPreview {
  return {
    fileName,
    totalRows: 0,
    validRows: 0,
    addCount: 0,
    updateCount: 0,
    skippedCount: errors.length,
    errors,
    rows: [],
  }
}

function rowHasContent(row: unknown[]): boolean {
  return row.some((cell) => studentCellToText(cell) !== '')
}

function headerMap(headers: unknown[]): Map<StudentExcelColumn, number> {
  const map = new Map<StudentExcelColumn, number>()
  headers.forEach((header, index) => {
    const text = studentCellToText(header) as StudentExcelColumn
    if ((STUDENT_EXCEL_COLUMNS as readonly string[]).includes(text) && !map.has(text)) map.set(text, index)
  })
  return map
}

function readColumn(row: unknown[], indexes: Map<StudentExcelColumn, number>, column: StudentExcelColumn): string {
  const index = indexes.get(column)
  return index == null ? '' : studentCellToText(row[index])
}

/**
 * 对二维表格数据执行纯校验和新增/更新判定。
 * rows 的第一行应为表头，数据行的 Excel 行号从 2 开始。
 */
export function validateStudentImportRows(
  headers: unknown[],
  dataRows: unknown[][],
  existingStudents: Pick<Student, 'id' | 'studentNo'>[] = [],
  fileName?: string,
): StudentImportPreview {
  const indexes = headerMap(headers)
  const nonBlankRows = dataRows.filter(rowHasContent)
  const errors: StudentImportError[] = []
  const actions: StudentImportAction[] = []
  const duplicateRows = new Map<string, number[]>()

  if (!indexes.has('姓名')) {
    errors.push({ row: 1, field: '姓名', reason: '缺少必填的「姓名」列' })
    return {
      fileName,
      totalRows: nonBlankRows.length,
      validRows: 0,
      addCount: 0,
      updateCount: 0,
      skippedCount: nonBlankRows.length,
      errors,
      rows: [],
    }
  }

  dataRows.forEach((row, index) => {
    if (!rowHasContent(row)) return
    const rowNumber = index + 2
    const studentNo = readColumn(row, indexes, '班内编号')
    if (studentNo) duplicateRows.set(studentNo, [...(duplicateRows.get(studentNo) ?? []), rowNumber])
  })

  const existingByNo = new Map<string, number>()
  existingStudents.forEach((student) => {
    const studentNo = studentCellToText(student.studentNo)
    if (studentNo && student.id != null && !existingByNo.has(studentNo)) existingByNo.set(studentNo, student.id)
  })

  dataRows.forEach((row, index) => {
    if (!rowHasContent(row)) return
    const rowNumber = index + 2
    const rowErrors: StudentImportError[] = []
    const name = readColumn(row, indexes, '姓名')
    const gender = readColumn(row, indexes, '性别')
    const birthday = readColumn(row, indexes, '生日')
    const studentNo = readColumn(row, indexes, '班内编号')
    const boarding = readColumn(row, indexes, '住宿类型')

    if (!name) rowErrors.push({ row: rowNumber, field: '姓名', reason: '姓名不能为空' })
    if (gender && !GENDERS.has(gender)) {
      rowErrors.push({ row: rowNumber, field: '性别', reason: '只能填写“男”或“女”' })
    }
    if (birthday && !isValidBirthday(birthday)) {
      rowErrors.push({ row: rowNumber, field: '生日', reason: '必须是 YYYY-MM-DD 格式且为有效日期' })
    }
    if (boarding && !BOARDING_TYPES.has(boarding)) {
      rowErrors.push({ row: rowNumber, field: '住宿类型', reason: '只能填写“走读”“住宿”或“午托”' })
    }
    const duplicateAt = studentNo ? duplicateRows.get(studentNo) : undefined
    if (duplicateAt && duplicateAt.length > 1) {
      const otherRows = duplicateAt.filter((otherRow) => otherRow !== rowNumber).join('、')
      rowErrors.push({ row: rowNumber, field: '班内编号', reason: `文件内编号重复（与第 ${otherRows} 行重复）` })
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
      return
    }

    const action: StudentImportAction = {
      studentNo: emptyToUndefined(studentNo),
      name,
      gender: emptyToUndefined(gender),
      birthday: emptyToUndefined(birthday),
      parentName: emptyToUndefined(readColumn(row, indexes, '家长姓名')),
      parentPhone: emptyToUndefined(readColumn(row, indexes, '家长电话')),
      emergencyContact: emptyToUndefined(readColumn(row, indexes, '紧急联系人')),
      boarding: boarding || '走读',
      note: emptyToUndefined(readColumn(row, indexes, '备注')),
    }
    if (studentNo && existingByNo.has(studentNo)) action.existingId = existingByNo.get(studentNo)
    actions.push(action)
  })

  const invalidRows = new Set(errors.filter((error) => error.row > 1).map((error) => error.row)).size
  return {
    fileName,
    totalRows: nonBlankRows.length,
    validRows: actions.length,
    addCount: actions.filter((action) => action.existingId == null).length,
    updateCount: actions.filter((action) => action.existingId != null).length,
    skippedCount: invalidRows,
    errors,
    rows: actions,
  }
}

/** 读取工作簿第一个 sheet，并返回可供 UI 预览的结果。 */
export function parseStudentExcelBuffer(
  data: ArrayBuffer | Uint8Array,
  existingStudents: Pick<Student, 'id' | 'studentNo'>[] = [],
  fileName?: string,
): StudentImportPreview {
  try {
    const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: false, dateNF: 'yyyy-mm-dd' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) return blankPreview(fileName, [{ row: 1, field: '文件', reason: '工作簿没有可读取的工作表' }])
    const sheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: true,
      raw: false,
      dateNF: 'yyyy-mm-dd',
    })
    if (rows.length === 0) return blankPreview(fileName, [{ row: 1, field: '表头', reason: '工作表为空' }])
    return validateStudentImportRows(rows[0] ?? [], rows.slice(1), existingStudents, fileName)
  } catch {
    return blankPreview(fileName, [{ row: 1, field: '文件', reason: '文件无法读取，请确认是有效的 Excel 文件' }])
  }
}

export async function parseStudentExcelFile(
  file: Blob & { name?: string },
  existingStudents: Pick<Student, 'id' | 'studentNo'>[] = [],
): Promise<StudentImportPreview> {
  if (file.size > MAX_STUDENT_EXCEL_BYTES) {
    return blankPreview(file.name, [{ row: 1, field: '文件', reason: '文件不能超过 10 MB' }])
  }
  try {
    return parseStudentExcelBuffer(await file.arrayBuffer(), existingStudents, file.name)
  } catch {
    return blankPreview(file.name, [{ row: 1, field: '文件', reason: '文件无法读取，请确认是有效的 Excel 文件' }])
  }
}

export function studentToExcelRow(student: StudentExcelRecord): string[] {
  return [
    studentCellToText(student.studentNo),
    studentCellToText(student.name),
    studentCellToText(student.gender),
    studentCellToText(student.birthday),
    studentCellToText(student.parentName),
    studentCellToText(student.parentPhone),
    studentCellToText(student.emergencyContact),
    studentCellToText(student.boarding || '走读'),
    studentCellToText(student.note),
  ]
}

const TEMPLATE_ROWS: StudentExcelRecord[] = [
  {
    studentNo: '01',
    name: '张小明',
    gender: '男',
    birthday: '2012-03-12',
    parentName: '张建国',
    parentPhone: '13800138000',
    emergencyContact: '李阿姨 13900139000',
    boarding: '走读',
    note: '示例：可删除本行后填写',
  },
  {
    studentNo: '02',
    name: '李小雨',
    gender: '女',
    birthday: '2012-11-08',
    parentName: '李明',
    parentPhone: '13900139000',
    emergencyContact: '王老师 13700137000',
    boarding: '住宿',
    note: '示例：电话和编号请按文本填写',
  },
]

/** 固定的 40 人导入示例，编号和姓名便于演示后续更新规则。 */
export const STUDENT_EXAMPLE_40: readonly StudentExcelRecord[] = [
  { studentNo: '01', name: '张梓涵', gender: '女', birthday: '2012-03-12', parentName: '张建国', parentPhone: '13800138001', emergencyContact: '李芳 13900139001', boarding: '走读', note: '示例数据' },
  { studentNo: '02', name: '李昊宇', gender: '男', birthday: '2011-11-08', parentName: '李明', parentPhone: '13900139002', emergencyContact: '李梅 13700137002', boarding: '住宿', note: '示例数据' },
  { studentNo: '03', name: '王欣怡', gender: '女', birthday: '2012-05-21', parentName: '王海', parentPhone: '13800138003', emergencyContact: '王丽 13600136003', boarding: '午托', note: '示例数据' },
  { studentNo: '04', name: '刘子轩', gender: '男', birthday: '2012-01-17', parentName: '刘伟', parentPhone: '13900139004', emergencyContact: '刘芳 13500135004', boarding: '走读', note: '示例数据' },
  { studentNo: '05', name: '陈思远', gender: '男', birthday: '2011-09-02', parentName: '陈刚', parentPhone: '13800138005', emergencyContact: '陈静 13900139005', boarding: '住宿', note: '示例数据' },
  { studentNo: '06', name: '杨雨桐', gender: '女', birthday: '2012-07-14', parentName: '杨军', parentPhone: '13900139006', emergencyContact: '杨琴 13700137006', boarding: '走读', note: '示例数据' },
  { studentNo: '07', name: '赵嘉豪', gender: '男', birthday: '2011-12-26', parentName: '赵磊', parentPhone: '13800138007', emergencyContact: '赵娟 13600136007', boarding: '午托', note: '示例数据' },
  { studentNo: '08', name: '黄诗涵', gender: '女', birthday: '2012-04-09', parentName: '黄勇', parentPhone: '13900139008', emergencyContact: '黄敏 13500135008', boarding: '走读', note: '示例数据' },
  { studentNo: '09', name: '周明轩', gender: '男', birthday: '2012-10-19', parentName: '周斌', parentPhone: '13800138009', emergencyContact: '周洁 13900139009', boarding: '住宿', note: '示例数据' },
  { studentNo: '10', name: '吴佳怡', gender: '女', birthday: '2011-06-30', parentName: '吴强', parentPhone: '13900139010', emergencyContact: '吴芳 13700137010', boarding: '走读', note: '示例数据' },
  { studentNo: '11', name: '徐天佑', gender: '男', birthday: '2012-02-11', parentName: '徐林', parentPhone: '13800138011', emergencyContact: '徐丽 13600136011', boarding: '午托', note: '示例数据' },
  { studentNo: '12', name: '孙若琳', gender: '女', birthday: '2011-08-23', parentName: '孙凯', parentPhone: '13900139012', emergencyContact: '孙琴 13500135012', boarding: '住宿', note: '示例数据' },
  { studentNo: '13', name: '胡晨阳', gender: '男', birthday: '2012-12-05', parentName: '胡军', parentPhone: '13800138013', emergencyContact: '胡洁 13900139013', boarding: '走读', note: '示例数据' },
  { studentNo: '14', name: '朱婉清', gender: '女', birthday: '2012-06-16', parentName: '朱涛', parentPhone: '13900139014', emergencyContact: '朱兰 13700137014', boarding: '午托', note: '示例数据' },
  { studentNo: '15', name: '高铭泽', gender: '男', birthday: '2011-10-28', parentName: '高峰', parentPhone: '13800138015', emergencyContact: '高静 13600136015', boarding: '住宿', note: '示例数据' },
  { studentNo: '16', name: '林语嫣', gender: '女', birthday: '2012-01-09', parentName: '林平', parentPhone: '13900139016', emergencyContact: '林梅 13500135016', boarding: '走读', note: '示例数据' },
  { studentNo: '17', name: '何俊杰', gender: '男', birthday: '2012-08-02', parentName: '何勇', parentPhone: '13800138017', emergencyContact: '何芳 13900139017', boarding: '午托', note: '示例数据' },
  { studentNo: '18', name: '郭芷晴', gender: '女', birthday: '2011-03-24', parentName: '郭辉', parentPhone: '13900139018', emergencyContact: '郭琴 13700137018', boarding: '走读', note: '示例数据' },
  { studentNo: '19', name: '马浩然', gender: '男', birthday: '2012-09-13', parentName: '马超', parentPhone: '13800138019', emergencyContact: '马娟 13600136019', boarding: '住宿', note: '示例数据' },
  { studentNo: '20', name: '罗心妍', gender: '女', birthday: '2011-12-17', parentName: '罗刚', parentPhone: '13900139020', emergencyContact: '罗敏 13500135020', boarding: '走读', note: '示例数据' },
  { studentNo: '21', name: '梁宇辰', gender: '男', birthday: '2012-04-28', parentName: '梁伟', parentPhone: '13800138021', emergencyContact: '梁芳 13900139021', boarding: '午托', note: '示例数据' },
  { studentNo: '22', name: '宋安琪', gender: '女', birthday: '2011-07-06', parentName: '宋涛', parentPhone: '13900139022', emergencyContact: '宋丽 13700137022', boarding: '住宿', note: '示例数据' },
  { studentNo: '23', name: '郑博文', gender: '男', birthday: '2012-11-22', parentName: '郑强', parentPhone: '13800138023', emergencyContact: '郑洁 13600136023', boarding: '走读', note: '示例数据' },
  { studentNo: '24', name: '谢依诺', gender: '女', birthday: '2012-02-19', parentName: '谢军', parentPhone: '13900139024', emergencyContact: '谢梅 13500135024', boarding: '午托', note: '示例数据' },
  { studentNo: '25', name: '韩子墨', gender: '男', birthday: '2011-05-15', parentName: '韩东', parentPhone: '13800138025', emergencyContact: '韩芳 13900139025', boarding: '走读', note: '示例数据' },
  { studentNo: '26', name: '唐嘉宁', gender: '女', birthday: '2012-10-03', parentName: '唐磊', parentPhone: '13900139026', emergencyContact: '唐琴 13700137026', boarding: '住宿', note: '示例数据' },
  { studentNo: '27', name: '冯亦航', gender: '男', birthday: '2012-06-08', parentName: '冯刚', parentPhone: '13800138027', emergencyContact: '冯静 13600136027', boarding: '走读', note: '示例数据' },
  { studentNo: '28', name: '于思琪', gender: '女', birthday: '2011-09-27', parentName: '于勇', parentPhone: '13900139028', emergencyContact: '于敏 13500135028', boarding: '午托', note: '示例数据' },
  { studentNo: '29', name: '董泽宇', gender: '男', birthday: '2012-03-05', parentName: '董斌', parentPhone: '13800138029', emergencyContact: '董兰 13900139029', boarding: '住宿', note: '示例数据' },
  { studentNo: '30', name: '萧雅文', gender: '女', birthday: '2011-11-14', parentName: '萧海', parentPhone: '13900139030', emergencyContact: '萧丽 13700139030', boarding: '走读', note: '示例数据' },
  { studentNo: '31', name: '程远航', gender: '男', birthday: '2012-07-23', parentName: '程伟', parentPhone: '13800138031', emergencyContact: '程芳 13600136031', boarding: '午托', note: '示例数据' },
  { studentNo: '32', name: '曹梦瑶', gender: '女', birthday: '2011-02-07', parentName: '曹峰', parentPhone: '13900139032', emergencyContact: '曹梅 13500135032', boarding: '住宿', note: '示例数据' },
  { studentNo: '33', name: '袁嘉诚', gender: '男', birthday: '2012-12-19', parentName: '袁凯', parentPhone: '13800138033', emergencyContact: '袁琴 13900139033', boarding: '走读', note: '示例数据' },
  { studentNo: '34', name: '邓欣然', gender: '女', birthday: '2012-05-02', parentName: '邓强', parentPhone: '13900139034', emergencyContact: '邓娟 13700139034', boarding: '午托', note: '示例数据' },
  { studentNo: '35', name: '许凯文', gender: '男', birthday: '2011-08-18', parentName: '许勇', parentPhone: '13800138035', emergencyContact: '许敏 13600136035', boarding: '走读', note: '示例数据' },
  { studentNo: '36', name: '彭诗语', gender: '女', birthday: '2012-01-29', parentName: '彭辉', parentPhone: '13900139036', emergencyContact: '彭洁 13500139036', boarding: '住宿', note: '示例数据' },
  { studentNo: '37', name: '曾俊熙', gender: '男', birthday: '2012-09-08', parentName: '曾超', parentPhone: '13800138037', emergencyContact: '曾芳 13900139037', boarding: '走读', note: '示例数据' },
  { studentNo: '38', name: '钟雨薇', gender: '女', birthday: '2011-04-16', parentName: '钟林', parentPhone: '13900139038', emergencyContact: '钟丽 13700139038', boarding: '午托', note: '示例数据' },
  { studentNo: '39', name: '龚睿哲', gender: '男', birthday: '2012-10-31', parentName: '龚涛', parentPhone: '13800138039', emergencyContact: '龚琴 13600136039', boarding: '住宿', note: '示例数据' },
  { studentNo: '40', name: '方可馨', gender: '女', birthday: '2011-06-12', parentName: '方平', parentPhone: '13900139040', emergencyContact: '方梅 13500139040', boarding: '走读', note: '示例数据' },
]

const COLUMN_WIDTHS = [10, 14, 8, 14, 14, 18, 22, 12, 28]

function createStudentSheet(students: StudentExcelRecord[]): XLSX.WorkSheet {
  const rows = [Array.from(STUDENT_EXCEL_COLUMNS), ...students.map(studentToExcelRow)]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = COLUMN_WIDTHS.map((wch) => ({ wch }))
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 }
  sheet['!autofilter'] = { ref: `A1:I${Math.max(1, rows.length)}` }
  for (let row = 1; row < rows.length; row += 1) {
    for (const column of [0, 5]) {
      const address = XLSX.utils.encode_cell({ r: row, c: column })
      const cell = sheet[address]
      if (cell) {
        cell.t = 's'
        cell.z = '@'
      }
    }
  }
  return sheet
}

function createInstructionsSheet(): XLSX.WorkSheet {
  const rows = [
    ['字段', '填写说明'],
    ['姓名', '必填，不能留空。'],
    ['班内编号', '可选；建议作为文本填写，01、02 等前导零会被保留。'],
    ['生日', '可选；请填写 YYYY-MM-DD，例如 2012-03-12。'],
    ['性别', '可选；只能填写 男 或 女。'],
    ['住宿类型', '可选；只能填写 走读、住宿 或 午托，留空默认为走读。'],
    ['家长电话', '请作为文本填写，避免长数字或前导零被 Excel 改写。'],
    ['其他字段', '导入时会自动去除首尾空格，空值留空。'],
    ['导入规则', '班内编号命中当前班已有学生时更新，否则新增；文件内重复编号会被标为错误。'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = [{ wch: 16 }, { wch: 72 }]
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 }
  return sheet
}

export function createStudentTemplateWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, createStudentSheet(TEMPLATE_ROWS), '学生导入模板')
  XLSX.utils.book_append_sheet(workbook, createInstructionsSheet(), '填写说明')
  return workbook
}

export function createStudentExportWorkbook(students: StudentExcelRecord[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, createStudentSheet(students), '学生信息')
  return workbook
}

export function createStudentExample40Workbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, createStudentSheet([...STUDENT_EXAMPLE_40]), '学生导入示例')
  XLSX.utils.book_append_sheet(workbook, createInstructionsSheet(), '填写说明')
  return workbook
}

export function workbookToArrayBuffer(workbook: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

function safeFilePart(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, '_') || '当前班级'
}

function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([workbookToArrayBuffer(workbook)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadStudentTemplate(): void {
  downloadWorkbook(createStudentTemplateWorkbook(), '学生导入模板.xlsx')
}

export function downloadStudentExample40(): void {
  downloadWorkbook(createStudentExample40Workbook(), '学生信息-40人示例.xlsx')
}

export function downloadStudentExport(className: string, students: StudentExcelRecord[], date = new Date()): void {
  downloadWorkbook(createStudentExportWorkbook(students), `学生信息-${safeFilePart(className)}-${formatLocalDate(date)}.xlsx`)
}
