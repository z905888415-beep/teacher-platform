import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Database, Cloud, Lock, Download, Upload, Trash2, RefreshCw, Sparkles, KeyRound, ShieldCheck } from 'lucide-react'
import { db, getSetting, setSetting } from '../db'
import { exportAllJson, importAllJson, type ExportPayload } from '../lib/data-io'
import { clearAllData, seedDemoData } from '../db/seed'
import { webdavPut, webdavGet, webdavTest, type WebDavConfig } from '../lib/webdav'
import { Card, Button, Input, Field, PageHeader, Badge } from '../components/ui'

// ============ 数据管理 ============
export function DataSettings() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const counts = useLiveQuery(async () => {
    const tables = ['students', 'scores', 'exams', 'todos', 'courses', 'events', 'communication', 'borderline']
    const result: Record<string, number> = {}
    for (const t of tables) result[t] = await db.table(t).count()
    return result
  }, []) ?? {}

  const onImport = async (file: File) => {
    if (!confirm('导入将覆盖当前数据（默认清空后恢复）。确定继续？')) return
    setBusy(true)
    try {
      const n = await importAllJson(file, { clear: true })
      alert(`成功恢复 ${n} 条记录`)
    } catch (e: any) {
      alert(`导入失败：${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="数据管理" subtitle="本地数据导入导出与备份" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Database size={18} className="text-brand-600" />本地数据</h3>
          <div className="grid grid-cols-4 gap-3 my-4">
            {[['学生', counts.students], ['成绩', counts.scores], ['考试', counts.exams], ['待办', counts.todos]].map(([k, v]) => (
              <div key={k as string} className="text-center p-2 rounded-lg bg-gray-50">
                <p className="text-lg font-bold text-gray-800">{v ?? 0}</p>
                <p className="text-xs text-gray-400">{k}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mb-3">所有数据仅保存在本机浏览器（IndexedDB），不上传到任何服务器，充分保护隐私。</p>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Sparkles size={18} className="text-amber-500" />备份与恢复</h3>
          <div className="space-y-3 mt-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportAllJson}><Download size={15} />导出全部数据（JSON）</Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={15} />{busy ? '恢复中…' : '从备份恢复'}</Button>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              <Button variant="secondary" size="sm" onClick={async () => { await seedDemoData(); alert('已载入示例数据（若已有数据则不覆盖）') }}><RefreshCw size={14} />载入示例数据</Button>
              <Button variant="danger" size="sm" onClick={async () => { if (confirm('确定清空所有数据？此操作不可撤销！')) { await clearAllData(); alert('已清空') } }}><Trash2 size={14} />清空所有数据</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ============ 云同步 ============
export function CloudSettings() {
  const [cfg, setCfg] = useState<WebDavConfig>({ url: '', username: '', password: '', autoBackup: false, intervalDays: 7 })
  const [status, setStatus] = useState('')

  useEffect(() => {
    ;(async () => {
      const saved = await getSetting<WebDavConfig>('webdav')
      if (saved) setCfg(saved)
    })()
  }, [])

  const save = async () => {
    await setSetting('webdav', cfg)
    setStatus('✅ 配置已保存')
    setTimeout(() => setStatus(''), 2000)
  }

  const test = async () => {
    setStatus('正在连接…')
    const ok = await webdavTest(cfg)
    setStatus(ok ? '✅ 连接成功，可正常上传' : '❌ 连接失败，请检查地址与账号密码（需服务端支持 CORS）')
  }

  const backup = async () => {
    setStatus('正在备份…')
    try {
      const tables: Record<string, unknown[]> = {}
      const names = ['students', 'scores', 'exams', 'courses', 'events', 'todos', 'communication', 'cadres', 'seats', 'duty', 'rewards', 'leaves', 'concerns', 'classFund', 'classLog', 'attendance', 'goals', 'career', 'psychology', 'talks', 'comprehensive', 'borderline', 'countdowns', 'aiTools', 'officeTools', 'docTemplates', 'fileTools', 'subjectTeachers', 'teachingProgress', 'homework', 'meetings', 'templates', 'resources', 'teachingRecords', 'classMeetings', 'dormitory', 'morningEvening', 'safetyHealth', 'parentMeetings', 'homeVisits', 'familySituation', 'notifications', 'collegeEntrance', 'funding', 'examSummaries']
      for (const n of names) tables[n] = await db.table(n).toArray()
      const payload: ExportPayload = { app: 'teacher-platform', version: 1, exportedAt: new Date().toISOString(), tables }
      await webdavPut(cfg, `backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload))
      setStatus('✅ 备份成功')
    } catch (e: any) {
      setStatus(`❌ 备份失败：${e.message}`)
    }
  }

  const restore = async () => {
    setStatus('正在恢复…')
    try {
      const filename = prompt('请输入备份文件名（如 backup-2026-08-24.json）：', `backup-${new Date().toISOString().slice(0, 10)}.json`)
      if (!filename) return
      const text = await webdavGet(cfg, filename)
      const payload = JSON.parse(text) as ExportPayload
      await db.transaction('rw', db.tables, async () => {
        for (const [name, rows] of Object.entries(payload.tables)) {
          if (rows?.length) await db.table(name).bulkPut(rows)
        }
      })
      setStatus('✅ 恢复成功')
    } catch (e: any) {
      setStatus(`❌ 恢复失败：${e.message}`)
    }
  }

  return (
    <div>
      <PageHeader title="云同步（WebDAV）" subtitle="连接坚果云等 WebDAV，实现多设备备份" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4"><Cloud size={18} className="text-brand-600" />服务器配置</h3>
          <div className="space-y-3">
            <Field label="WebDAV 地址" hint="坚果云：https://dav.jianguoyun.com/dav/">
              <Input value={cfg.url} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} placeholder="https://dav.jianguoyun.com/dav/" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="账号"><Input value={cfg.username} onChange={(e) => setCfg({ ...cfg, username: e.target.value })} /></Field>
              <Field label="应用密码"><Input type="password" value={cfg.password} onChange={(e) => setCfg({ ...cfg, password: e.target.value })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={cfg.autoBackup} onChange={(e) => setCfg({ ...cfg, autoBackup: e.target.checked })} />
              自动备份
            </label>
            {cfg.autoBackup && (
              <Field label="备份间隔（天）"><Input type="number" value={cfg.intervalDays} onChange={(e) => setCfg({ ...cfg, intervalDays: Number(e.target.value) })} /></Field>
            )}
            <Button onClick={save}>保存配置</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4"><ShieldCheck size={18} className="text-emerald-600" />操作</h3>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={test}>测试连接</Button>
              <Button onClick={backup}><Cloud size={15} />立即备份</Button>
              <Button variant="outline" onClick={restore}><Download size={15} />从云端恢复</Button>
            </div>
            {status && <p className={`text-sm ${status.startsWith('✅') ? 'text-emerald-600' : status.startsWith('❌') ? 'text-red-500' : 'text-gray-500'}`}>{status}</p>}
            <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
              💡 提示：坚果云需在「账户信息 → 安全选项」中生成第三方应用密码。浏览器访问 WebDAV 需服务端允许跨域（坚果云支持）。
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ============ 密码保护 ============
export function SecuritySettings() {
  const [pwd, setPwdState] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [hasPwd, setHasPwd] = useState(false)

  useLiveQuery(async () => {
    const p = await getSetting<string>('password', '')
    setHasPwd(!!p)
  }, [])

  const enablePassword = async () => {
    if (!pwd) return alert('请输入密码')
    if (pwd !== confirmPwd) return alert('两次输入的密码不一致')
    await setSetting('password', pwd)
    alert('✅ 密码已设置，下次打开将要求验证')
    setPwdState(''); setConfirmPwd(''); setHasPwd(true)
  }

  const removePwd = async () => {
    if (!window.confirm('确定移除密码保护？')) return
    await setSetting('password', '')
    setHasPwd(false)
    alert('已移除密码')
  }

  return (
    <div>
      <PageHeader title="密码保护" subtitle="设置访问密码，保护本地数据" />
      <Card className="p-5 max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={18} className="text-brand-600" />
          <h3 className="font-semibold text-gray-800">访问密码</h3>
          {hasPwd ? <Badge color="green">已启用</Badge> : <Badge>未启用</Badge>}
        </div>
        {hasPwd ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">已设置密码保护。移除后可取消。</p>
            <Button variant="danger" onClick={removePwd}><Trash2 size={15} />移除密码</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="设置密码"><Input type="password" value={pwd} onChange={(e) => setPwdState(e.target.value)} placeholder="4 位以上" /></Field>
            <Field label="确认密码"><Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} /></Field>
            <Button onClick={enablePassword}><KeyRound size={15} />启用密码保护</Button>
          </div>
        )}
      </Card>
    </div>
  )
}

// ============ 密码解锁（应用入口） ============
export function SecurityLock({ onUnlock }: { onUnlock: () => void }) {
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState(false)

  const unlock = async () => {
    const real = await getSetting<string>('password', '')
    if (pwd === real) onUnlock()
    else { setError(true); setPwd('') }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center text-white mb-3"><Lock size={26} /></div>
          <h1 className="text-lg font-bold text-gray-800">教师工作平台</h1>
          <p className="text-sm text-gray-400">请输入访问密码</p>
        </div>
        <input
          type="password"
          value={pwd}
          onChange={(e) => { setPwd(e.target.value); setError(false) }}
          onKeyDown={(e) => e.key === 'Enter' && unlock()}
          placeholder="密码"
          autoFocus
          className={`w-full rounded-xl border px-4 py-3 text-center text-lg outline-none ${error ? 'border-red-400' : 'border-gray-300 focus:border-brand-500'}`}
        />
        {error && <p className="mt-2 text-sm text-red-500 text-center">密码错误，请重试</p>}
        <button onClick={unlock} className="w-full mt-4 bg-brand-600 text-white rounded-xl py-3 font-medium hover:bg-brand-700">解锁</button>
      </div>
    </div>
  )
}
