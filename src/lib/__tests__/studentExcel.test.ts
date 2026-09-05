import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  STUDENT_EXCEL_COLUMNS,
  STUDENT_EXAMPLE_40,
  createStudentExample40Workbook,
  createStudentExportWorkbook,
  createStudentTemplateWorkbook,
  MAX_STUDENT_EXCEL_BYTES,
  parseStudentExcelFile,
  parseStudentExcelBuffer,
  studentToExcelRow,
  validateStudentImportRows,
  workbookToArrayBuffer,
} from '../studentExcel'

const headers = [...STUDENT_EXCEL_COLUMNS]

describe('student Excel templates and exports', () => {
  it('模板使用固定列顺序，包含两个示例行和填写说明 sheet', () => {
    const workbook = createStudentTemplateWorkbook()
    expect(workbook.SheetNames).toEqual(['学生导入模板', '填写说明'])
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['学生导入模板'], { header: 1, raw: false })
    expect(rows[0]).toEqual(headers)
    expect(rows.slice(1)).toHaveLength(2)
    expect(rows[1][0]).toBe('01')
    expect(rows[1][1]).toBe('张小明')
    expect(XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['填写说明'], { header: 1, raw: false }).length).toBeGreaterThan(1)
  })

  it('导出再解析时保留编号和电话的文本前导零', () => {
    const workbook = createStudentExportWorkbook([
      {
        studentNo: '01',
        name: '测试学生',
        gender: '女',
        birthday: '2012-03-01',
        parentName: '测试家长',
        parentPhone: '0013800138000',
        emergencyContact: '紧急联系人',
        boarding: '走读',
        note: '备注',
      },
    ])
    const preview = parseStudentExcelBuffer(workbookToArrayBuffer(workbook), [], '导出.xlsx')
    expect(preview.validRows).toBe(1)
    expect(preview.rows[0]).toMatchObject({ studentNo: '01', parentPhone: '0013800138000', name: '测试学生' })
    expect(studentToExcelRow(preview.rows[0])).toEqual(['01', '测试学生', '女', '2012-03-01', '测试家长', '0013800138000', '紧急联系人', '走读', '备注'])
  })
})

describe('student Excel validation', () => {
  it('校验姓名、性别、住宿类型、生日和文件内重复编号', () => {
    const preview = validateStudentImportRows(
      headers,
      [
        ['01', '张三', '男', '2012-02-29', '', '', '', '', ''],
        ['01', '李四', '女', '2012-02-28', '', '', '', '', ''],
        ['03', '', '男', '2012-01-01', '', '', '', '', ''],
        ['04', '王五', '其他', '2012-02-30', '', '', '', '走读走读', ''],
        ['05', '赵六', '', '', '', '', '', '', ''],
      ],
    )
    expect(preview.validRows).toBe(1)
    expect(preview.rows[0]).toMatchObject({ studentNo: '05', name: '赵六', boarding: '走读' })
    expect(preview.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, field: '班内编号' }),
      expect.objectContaining({ row: 3, field: '班内编号' }),
      expect.objectContaining({ row: 4, field: '姓名' }),
      expect.objectContaining({ row: 5, field: '性别' }),
      expect.objectContaining({ row: 5, field: '生日' }),
      expect.objectContaining({ row: 5, field: '住宿类型' }),
    ]))
  })

  it('命中当前班相同编号时标记为 update，其他行标记为 add', () => {
    const preview = validateStudentImportRows(
      headers,
      [
        ['07', '更新后的姓名', '女', '', '', '', '', '住宿', ''],
        ['08', '新学生', '男', '', '', '', '', '走读', ''],
        ['', '无编号学生', '', '', '', '', '', '', ''],
      ],
      [{ id: 101, studentNo: '07' }],
    )
    expect(preview.validRows).toBe(3)
    expect(preview.updateCount).toBe(1)
    expect(preview.addCount).toBe(2)
    expect(preview.rows[0].existingId).toBe(101)
    expect(preview.rows[2].existingId).toBeUndefined()
  })

  it('完全空白行会忽略，不计入错误或跳过数量', () => {
    const preview = validateStudentImportRows(headers, [
      ['', '', '', '', '', '', '', '', ''],
      ['09', '有效学生', '', '', '', '', '', '', ''],
    ])
    expect(preview.totalRows).toBe(1)
    expect(preview.validRows).toBe(1)
    expect(preview.skippedCount).toBe(0)
  })

  it('拒绝超过 10 MB 的文件并返回可定位错误', async () => {
    const oversized = {
      name: '过大.xlsx',
      size: MAX_STUDENT_EXCEL_BYTES + 1,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Blob & { name: string }
    const preview = await parseStudentExcelFile(oversized)
    expect(preview.validRows).toBe(0)
    expect(preview.errors[0]).toMatchObject({ row: 1, field: '文件', reason: '文件不能超过 10 MB' })
  })
})

describe('40 person student example', () => {
  it('包含 01–40 编号、唯一中文姓名，且全部可以通过导入校验', () => {
    expect(STUDENT_EXAMPLE_40).toHaveLength(40)
    expect(STUDENT_EXAMPLE_40[0].studentNo).toBe('01')
    expect(STUDENT_EXAMPLE_40[39].studentNo).toBe('40')
    expect(new Set(STUDENT_EXAMPLE_40.map((student) => student.name)).size).toBe(40)

    const workbook = createStudentExample40Workbook()
    const preview = parseStudentExcelBuffer(workbookToArrayBuffer(workbook), [], '学生信息-40人示例.xlsx')
    expect(preview.validRows).toBe(40)
    expect(preview.addCount).toBe(40)
    expect(preview.errors).toHaveLength(0)
  })
})
