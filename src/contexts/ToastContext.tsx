import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

export interface ToastOptions {
  /** 可撤销操作提供回滚函数，5 秒内有效 */
  undo?: () => Promise<void> | void
  error?: boolean
}

interface ToastState {
  id: number
  message: string
  undo?: () => Promise<void> | void
  error: boolean
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}

const AUTO_DISMISS_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const counter = useRef(0)

  const dismiss = useCallback(() => {
    setToast(null)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      counter.current += 1
      setToast({ id: counter.current, message, undo: options?.undo, error: options?.error ?? false })
      if (timerRef.current) clearTimeout(timerRef.current)
      // 错误提示不自动消失，需用户关闭或撤销（UI 规范 12.7）
      if (!options?.error) {
        timerRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS)
      }
    },
    [],
  )

  const handleUndo = async () => {
    if (!toast?.undo) return
    await toast.undo()
    dismiss()
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-[84px] z-[90] flex items-center justify-between gap-4 rounded-menu bg-ink-900 px-4 py-3 text-sm text-white shadow-drag sm:inset-x-auto sm:bottom-6 sm:right-6 sm:min-w-[280px]"
          style={{ animation: 'toast-in 160ms ease-out' }}
        >
          <span className="flex min-w-0 items-center gap-2">
            {toast.error ? (
              <XCircle size={16} className="shrink-0 text-danger-50" aria-hidden />
            ) : (
              <CheckCircle2 size={16} className="shrink-0 text-brand-50" aria-hidden />
            )}
            <span className="truncate">{toast.message}</span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            {toast.undo && (
              <button type="button" onClick={handleUndo} className="font-semibold underline underline-offset-2">
                撤销
              </button>
            )}
            {toast.error && (
              <button type="button" onClick={dismiss} aria-label="关闭提示" className="font-semibold underline underline-offset-2">
                关闭
              </button>
            )}
          </span>
        </div>
      )}
    </ToastContext.Provider>
  )
}
