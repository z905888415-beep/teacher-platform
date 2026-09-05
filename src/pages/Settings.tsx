import { useEffect, useRef, useState } from 'react'
import { Download, LockKeyhole, RotateCcw, Trash2, Upload } from 'lucide-react'
import { db } from '../db'
import { ensureSeedData } from '../db/seed'
import { backupSummary, clearAllData, exportBackup, downloadBackup, parseBackup, restoreBackup, BackupError, formatIssues } from '../lib/backup'
import { hashPassword, verifyPassword } from '../lib/crypto'
import { setSetting, useSetting } from '../hooks/useSetting'
import { Badge, Button, Field, Input, Modal, Panel, Select } from '../components/ui'
import { useToast } from '../contexts/ToastContext'
import { DEFAULT_PERIOD_TIMES } from '../lib/dates'
import { useClassManager } from '../contexts/ClassContext'

export function Settings() {
  const { showToast } = useToast()
  const { archivedClasses, restoreClass } = useClassManager()
  const semesterLabel = useSetting('semesterLabel', '2026–2027 学年第一学期')
  const semesterStart = useSetting('semesterStart', `${new Date().getFullYear()}-08-31`)
  const periodCount = useSetting('periodCount', '6')
  const periodTimesRaw = useSetting('periodTimes', '')
  const passwordHash = useSetting('passwordHash', '')

  const fileRef = useRef<HTMLInputElement>(null)
  const [periodDraft, setPeriodDraft] = useState(periodTimesRaw)
  const [periodError, setPeriodError] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<{
    text: string
    counts: { name: string; count: number }[]
    converted: string[]
    ignored: { name: string; count: number; reason: string }[]
    issues: string[]
  } | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [disablePw, setDisablePw] = useState('')

  const handleExport = async () => {
    const backup = await exportBackup()
    downloadBackup(backup)
    showToast('备份已导出，请注意备份文件包含学生与家长信息')
  }

  useEffect(() => {
    setPeriodDraft(periodTimesRaw)
  }, [periodTimesRaw])

  const savePeriodTimes = () => {
    if (!periodDraft.trim()) {
      setPeriodError(null)
      void setSetting('periodTimes', '')
      showToast('已改回默认节次时间')
      return
    }
    try {
      const parsed = JSON.parse(periodDraft) as unknown
      if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string' || !item.includes('-'))) {
        setPeriodError('请输入字符串数组，例如 ["08:00-08:45","08:55-09:40"]')
        return
      }
      setPeriodError(null)
      void setSetting('periodTimes', JSON.stringify(parsed))
      showToast('节次时间已保存')
    } catch {
      setPeriodError('JSON 不完整，未保存。首页将继续使用默认节次时间。')
    }
  }

  const handleFile = async (file: File) => {
    try {
      const text = await file.text()
      const { backup, summary } = parseBackup(text)
      setImportPreview({
        text,
        counts: backupSummary(backup),
        converted: summary.converted,
        ignored: summary.ignored,
        issues: summary.issues.map((issue) => `${issue.table} 第 ${issue.row} 行「${issue.field}」：${issue.message}`),
      })
    } catch (error) {
      const message =
        error instanceof BackupError
          ? error.issues.length
            ? formatIssues(error.issues)
            : error.message
          : error instanceof Error
            ? error.message
            : '备份文件解析失败'
      showToast(message, { error: true })
    }
  }

  const confirmRestore = async () => {
    if (!importPreview) return
    try {
      const { backup, summary } = parseBackup(importPreview.text)
      if (summary.issues.some((issue) => issue.message === '记录不是对象')) {
        showToast(formatIssues(summary.issues), { error: true })
        return
      }
      await restoreBackup(backup)
      const extra = [
        ...summary.converted,
        ...summary.ignored.map((item) => `忽略 ${item.name} ${item.count} 条`),
      ]
      showToast(extra.length ? `备份已恢复。${extra.join('；')}` : '备份已恢复')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '恢复失败，请根据提示检查表、行和字段', { error: true })
    }
    setImportPreview(null)
  }

  const handleSetPassword = async () => {
    if (pw1.length < 4) {
      setPwError('密码至少 4 位')
      return
    }
    if (pw1 !== pw2) {
      setPwError('两次输入的密码不一致')
      return
    }
    await setSetting('passwordHash', await hashPassword(pw1))
    setPw1('')
    setPw2('')
    setPwError(null)
    showToast('访问密码已开启，下次打开应用生效')
  }

  const handleDisablePassword = async () => {
    const stored = passwordHash
    if (!stored) return
    if (!(await verifyPassword(disablePw, stored))) {
      showToast('密码不正确', { error: true })
      return
    }
    await setSetting('passwordHash', '')
    sessionStorage.removeItem('tw-unlocked')
    setDisablePw('')
    showToast('访问密码已关闭')
  }

  const handleResetSample = async () => {
    await clearAllData()
    // F01：清除种子标记，ensureSeedData 才会重新灌入示例数据
    await db.settings.delete('seededAt')
    await db.settings.bulkPut([
      { key: 'semesterLabel', value: semesterLabel },
      { key: 'semesterStart', value: semesterStart },
      { key: 'periodCount', value: periodCount },
      { key: 'periodTimes', value: periodTimesRaw },
      { key: 'passwordHash', value: passwordHash },
    ])
    await ensureSeedData()
    setResetOpen(false)
    showToast('示例数据已重置')
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 min-[900px]:grid-cols-2">
      <Panel title="学期与课表" bodyClassName="p-4">
        <Field label="当前学期" htmlFor="set-semester">
          <Select
            id="set-semester"
            value={semesterLabel}
            onChange={(event) => setSetting('semesterLabel', event.target.value)}
          >
            <option value="2026–2027 学年第一学期">2026–2027 学年第一学期</option>
            <option value="2026–2027 学年第二学期">2026–2027 学年第二学期</option>
          </Select>
        </Field>
        <Field label="学期开始日期" htmlFor="set-start" hint="用于计算教学周次与单双周。">
          <Input id="set-start" type="date" value={semesterStart} onChange={(event) => setSetting('semesterStart', event.target.value)} />
        </Field>
        <Field label="每天节次数量" htmlFor="set-periods" hint="课表格按此数量显示（4–9 节）。">
          <Select
            id="set-periods"
            value={periodCount}
            onChange={(event) => setSetting('periodCount', event.target.value)}
          >
            {[4, 5, 6, 7, 8, 9].map((count) => (
              <option key={count} value={String(count)}>
                {count} 节
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="节次时间（JSON，可选）"
          htmlFor="set-times"
          error={periodError ?? undefined}
          hint={`留空使用默认时间：${DEFAULT_PERIOD_TIMES[0]} … 修改后点保存，非法 JSON 不会写入。`}
        >
          <Input
            id="set-times"
            value={periodDraft}
            placeholder='例如 ["08:00-08:45","08:55-09:40"]'
            onChange={(event) => {
              setPeriodDraft(event.target.value)
              setPeriodError(null)
            }}
          />
        </Field>
        <Button onClick={savePeriodTimes}>保存节次时间</Button>
      </Panel>

      <Panel title="归档班级" subtitle="归档后班级从选择器隐藏，数据保留，可在此恢复" bodyClassName="p-4">
        {archivedClasses.length === 0 ? (
          <p className="text-xs text-ink-500">没有归档班级</p>
        ) : (
          <ul className="grid gap-2">
            {archivedClasses.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-menu border border-line px-3 py-2">
                <span className="text-sm font-semibold text-ink-900">{item.name}</span>
                <Button
                  onClick={() => {
                    if (item.id != null) void restoreClass(item.id)
                  }}
                >
                  恢复
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="备份与恢复" subtitle="数据保存在本机 IndexedDB；导出文件包含学生与家长信息，请妥善保管" bodyClassName="p-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={handleExport}>
            <Download size={14} /> 导出完整备份（JSON）
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> 导入备份
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFile(file)
              event.target.value = ''
            }}
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-ink-500">
          恢复将覆盖当前全部数据，导入前会先显示备份内容预览；旧版本备份中无法识别的表会被忽略，不会导致恢复失败。
        </p>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="dangerSoft" onClick={() => setClearOpen(true)}>
            <Trash2 size={14} /> 清空全部数据
          </Button>
          <Button variant="secondary" onClick={() => setResetOpen(true)}>
            <RotateCcw size={14} /> 重置为示例数据
          </Button>
        </div>
      </Panel>

      <Panel title="访问密码" subtitle="仅用于应用访问保护，不作为强加密" bodyClassName="p-4">
        {passwordHash ? (
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm text-ink-700">
              <LockKeyhole size={15} className="text-brand-600" /> 已开启访问密码 <Badge variant="blue">生效中</Badge>
            </p>
            <Field label="关闭密码：输入当前密码" htmlFor="pw-disable">
              <Input
                id="pw-disable"
                type="password"
                value={disablePw}
                autoComplete="current-password"
                onChange={(event) => setDisablePw(event.target.value)}
              />
            </Field>
            <Button variant="dangerSoft" onClick={handleDisablePassword}>
              关闭访问密码
            </Button>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="新密码" htmlFor="pw-new">
                <Input id="pw-new" type="password" value={pw1} autoComplete="new-password" onChange={(event) => setPw1(event.target.value)} />
              </Field>
              <Field label="确认密码" htmlFor="pw-confirm">
                <Input id="pw-confirm" type="password" value={pw2} autoComplete="new-password" onChange={(event) => setPw2(event.target.value)} />
              </Field>
            </div>
            {pwError && <p className="mb-3 text-xs text-danger-600">{pwError}</p>}
            <Button variant="primary" onClick={handleSetPassword}>
              开启访问密码
            </Button>
          </div>
        )}
      </Panel>

      <Panel title="关于" bodyClassName="p-4">
        <ul className="grid gap-2 text-xs leading-5 text-ink-500">
          <li>· 本地优先：所有数据保存在本机浏览器 IndexedDB，不依赖学校统一信息系统。</li>
          <li>· 离线可用：断网时除云备份外的核心功能均可正常使用。</li>
          <li>· 隐私：默认不上传任何学生数据；导出备份时请注意文件包含家长联系方式。</li>
          <li>· 版本：0.1.0（P0 日常工作台）。</li>
        </ul>
      </Panel>

      {/* 恢复预览确认 */}
      <Modal
        open={importPreview != null}
        onClose={() => setImportPreview(null)}
        title="确认恢复备份"
        footer={
          <>
            <Button onClick={() => setImportPreview(null)}>取消</Button>
            <Button variant="danger" onClick={confirmRestore}>
              覆盖并恢复
            </Button>
          </>
        }
      >
        <p className="mb-3">恢复将清空当前数据并写入备份内容。备份包含：</p>
        <ul className="mb-3 grid grid-cols-2 gap-1.5">
          {importPreview?.counts.map((item) => (
            <li key={item.name} className="flex justify-between rounded-menu border border-line px-2.5 py-1 text-xs">
              <span className="text-ink-500">{item.name}</span>
              <span className="font-semibold tabular-nums text-ink-900">{item.count}</span>
            </li>
          ))}
        </ul>
        {importPreview?.converted && importPreview.converted.length > 0 && (
          <p className="mb-2 text-xs text-ink-700">转换：{importPreview.converted.join('；')}</p>
        )}
        {importPreview?.ignored && importPreview.ignored.length > 0 && (
          <p className="mb-2 text-xs text-ink-500">
            已忽略：{importPreview.ignored.map((item) => `${item.name}（${item.reason}）`).join('；')}
          </p>
        )}
        {importPreview?.issues && importPreview.issues.length > 0 && (
          <p className="mb-2 text-xs text-danger-600">字段问题：{importPreview.issues.slice(0, 6).join('；')}</p>
        )}
        <p className="text-xs text-danger-600">此操作不可撤销，建议先导出当前数据。</p>
      </Modal>

      <Modal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="清空全部数据"
        footer={
          <>
            <Button onClick={() => setClearOpen(false)}>取消</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await clearAllData()
                setClearOpen(false)
                showToast('已清空全部业务数据')
              }}
            >
              确认清空
            </Button>
          </>
        }
      >
        将删除班级、学生、课表、待办、校历等全部业务数据（保留学期设置与密码）。此操作不可恢复，建议先导出备份。
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="重置为示例数据"
        footer={
          <>
            <Button onClick={() => setResetOpen(false)}>取消</Button>
            <Button variant="danger" onClick={handleResetSample}>
              重置
            </Button>
          </>
        }
      >
        将清空全部业务数据并重新写入一套初中数学教师示例数据（初二（3）班、初二（5）班）。
      </Modal>
    </div>
  )
}
