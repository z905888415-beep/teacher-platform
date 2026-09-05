import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui'

export interface MoveTarget {
  day: number
  period: number
  /** 目标格 data-cell 键，用于实时测量锚点位置 */
  cellKey: string
  /** 目标格已有课程（冲突时提供交换 / 覆盖） */
  occupied?: { templateId: number; subject: string; className: string } | null
}

interface MoveScopePopoverProps {
  source: { subject: string; className: string; day: number; period: number }
  target: MoveTarget
  getCellElement: (cellKey: string) => HTMLElement | null
  onCancel: () => void
  onMove: (scope: 'week' | 'future') => void
  onSwap: (scope: 'week' | 'future') => void
  onOverwrite: (scope: 'week' | 'future') => void
}

const DAY_NAMES = ['', '一', '二', '三', '四', '五', '六', '日']
const POPOVER_WIDTH = 240

/**
 * 拖动结束后的锚定弹层：靠近目标格显示，不使用居中模态框（UI 规范 6.3 / 7.4）。
 * 通过 Portal 挂到 body，避免落在带 transform 的动画容器内导致 fixed 定位失效；
 * 打开时按目标格实时测量位置，滚动 / 缩放跟随重算。
 */
export function MoveScopePopover({
  source,
  target,
  getCellElement,
  onCancel,
  onMove,
  onSwap,
  onOverwrite,
}: MoveScopePopoverProps) {
  const [overwriteOpen, setOverwriteOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const measure = useCallback(() => {
    const cell = getCellElement(target.cellKey)
    if (!cell) {
      setPos({ x: Math.max(8, window.innerWidth / 2 - POPOVER_WIDTH / 2), y: 120 })
      return
    }
    const rect = cell.getBoundingClientRect()
    const height = ref.current?.offsetHeight ?? 230
    let x = rect.left + rect.width / 2 - POPOVER_WIDTH / 2
    x = Math.max(8, Math.min(x, window.innerWidth - POPOVER_WIDTH - 8))
    let y = rect.bottom + 6
    if (y + height > window.innerHeight - 8) {
      y = rect.top - height - 6
    }
    setPos({ x, y: Math.max(8, y) })
  }, [getCellElement, target.cellKey])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onCancel()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [onCancel, measure])

  const targetLabel = `周${DAY_NAMES[target.day]} 第 ${target.period} 节`
  const sourceLabel = `周${DAY_NAMES[source.day]} 第 ${source.period} 节 · ${source.subject}`

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="选择调整范围"
      className="fixed z-[60] rounded-card border border-line bg-white p-3 shadow-drag"
      style={{
        left: pos?.x ?? -9999,
        top: pos?.y ?? -9999,
        width: POPOVER_WIDTH,
        visibility: pos ? 'visible' : 'hidden',
        animation: 'block-in 160ms cubic-bezier(.2,.8,.2,1)',
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {target.occupied ? (
        <p className="mb-2 text-xs font-bold leading-[18px] text-ink-900">
          {targetLabel}已有课程：{target.occupied.subject}（{target.occupied.className}）
        </p>
      ) : (
        <p className="mb-2 text-xs font-bold leading-[18px] text-ink-900">将 {sourceLabel} 移到 {targetLabel}</p>
      )}

      {overwriteOpen && target.occupied ? (
        <div className="grid gap-1.5">
          <p className="text-[11px] leading-4 text-danger-600">
            覆盖 {targetLabel} 的「{target.occupied.subject}」（{target.occupied.className}）属于高风险操作：原课程将被替换。请选择覆盖范围并确认。
          </p>
          <Button variant="dangerSoft" onClick={() => onOverwrite('week')}>
            仅本周覆盖（原课本周取消）
          </Button>
          <Button variant="dangerSoft" onClick={() => onOverwrite('future')}>
            从本周起覆盖（原课永久删除）
          </Button>
          <Button onClick={() => setOverwriteOpen(false)}>返回</Button>
        </div>
      ) : target.occupied ? (
        <div className="grid gap-1.5">
          <Button variant="primary" onClick={() => onSwap('week')}>
            交换两节课
          </Button>
          <Button variant="secondary" onClick={() => onSwap('future')}>
            交换两节课（从本周起）
          </Button>
          <button
            type="button"
            onClick={() => setOverwriteOpen(true)}
            className="mt-1 text-[11px] font-semibold text-danger-600/80 underline underline-offset-2 hover:text-danger-600"
          >
            覆盖目标课程…
          </button>
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
        </div>
      ) : (
        <div className="grid gap-1.5">
          <Button variant="primary" onClick={() => onMove('week')}>
            仅本周
          </Button>
          <Button variant="secondary" onClick={() => onMove('future')}>
            从本周起
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
        </div>
      )}
    </div>,
    document.body,
  )
}
