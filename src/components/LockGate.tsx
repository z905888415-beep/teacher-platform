import { useEffect, useState, type ReactNode } from 'react'
import { LockKeyhole } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { verifyPassword } from '../lib/crypto'
import { Button, Field, Input } from './ui'

/** 访问密码锁：开启后每次打开应用需先解锁（会话内只解锁一次） */
export function LockGate({ children }: { children: ReactNode }) {
  const passwordHash = useLiveQuery(async () => (await db.settings.get('passwordHash'))?.value ?? '', [])
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('tw-unlocked') === '1')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!passwordHash) setUnlocked(true)
  }, [passwordHash])

  if (!passwordHash || unlocked) return <>{children}</>

  const handleUnlock = async () => {
    setChecking(true)
    const ok = await verifyPassword(password, passwordHash)
    setChecking(false)
    if (ok) {
      sessionStorage.setItem('tw-unlocked', '1')
      setUnlocked(true)
    } else {
      setError('密码不正确')
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="w-full max-w-[360px] rounded-panel border border-line bg-white p-6 shadow-panel">
        <p className="flex items-center gap-2 text-base font-bold text-ink-900">
          <LockKeyhole size={18} className="text-brand-600" /> 工作台已锁定
        </p>
        <p className="mt-1 text-xs leading-5 text-ink-500">请输入访问密码解锁。数据保存在本机，密码仅用于访问保护。</p>
        <div className="mt-4">
          <Field label="访问密码" error={error ?? undefined} htmlFor="lock-password">
            <Input
              id="lock-password"
              type="password"
              autoFocus
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleUnlock()
              }}
            />
          </Field>
          <Button variant="primary" loading={checking} onClick={handleUnlock} className="w-full">
            解锁
          </Button>
        </div>
      </div>
    </div>
  )
}
