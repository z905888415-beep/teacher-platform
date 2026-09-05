import { useCallback, useEffect, useMemo, useRef, useState, Children, isValidElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Loader2, X } from 'lucide-react'

/* ---------------------------------- Button ---------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft' | 'text'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'h-11 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 md:h-9 md:rounded-ui',
  secondary:
    'h-11 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink-700 hover:border-line-strong md:h-9 md:rounded-ui',
  ghost: 'h-11 rounded-ui px-3 text-sm font-semibold text-ink-700 hover:bg-surface-muted md:h-9',
  danger: 'h-11 rounded-ui bg-danger-600 px-4 text-sm font-semibold text-white hover:bg-danger-600/90 md:h-9',
  dangerSoft:
    'h-11 rounded-full border border-danger-600/25 bg-danger-50 px-4 text-sm font-semibold text-danger-600 hover:border-danger-600/50 md:h-9 md:rounded-ui',
  text: 'text-sm font-semibold text-brand-600 hover:text-brand-700',
}

export function Button({ variant = 'secondary', loading, className = '', children, disabled, ...rest }: ButtonProps) {
  const isPill = variant === 'primary' || variant === 'secondary' || variant === 'dangerSoft'
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-45 ${
        isPill ? '' : 'rounded-ui'
      } ${BUTTON_STYLES[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

/* ---------------------------------- Panel ---------------------------------- */

interface PanelProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  bodyClassName?: string
  headerClassName?: string
  children: ReactNode
}

/** 极简内容块：细边框 + 留白 + 极轻阴影（UI 规范 12.2） */
export function Panel({ title, subtitle, actions, bodyClassName = 'p-5', headerClassName = '', children }: PanelProps) {
  return (
    <section className="overflow-hidden rounded-panel border border-line bg-white shadow-panel">
      {(title || actions) && (
        <header
          className={`flex min-h-[54px] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-2.5 sm:px-5 ${headerClassName}`}
        >
          <div className="min-w-0">
            {title && <PanelTitle>{title}</PanelTitle>}
            {subtitle && <p className="mt-0.5 text-[11px] leading-4 text-ink-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-ink-900">
      <span aria-hidden className="h-4 w-[5px] rounded-full bg-brand-600" />
      {children}
    </h2>
  )
}

/* ---------------------------------- Badge ---------------------------------- */

type BadgeVariant = 'default' | 'blue' | 'danger' | 'success'

export function Badge({ variant = 'default', children }: { variant?: BadgeVariant; children: ReactNode }) {
  const styles: Record<BadgeVariant, string> = {
    default: 'border-line bg-surface-muted text-ink-700',
    blue: 'border-brand-600/40 bg-brand-50 text-brand-600',
    danger: 'border-danger-600/40 bg-danger-50 text-danger-600',
    success: 'border-success/40 bg-[#EAF7F0] text-success',
  }
  return (
    <span className={`inline-flex h-5 items-center rounded-full border px-1.5 text-[11px] font-semibold leading-none ${styles[variant]}`}>
      {children}
    </span>
  )
}

/* ---------------------------------- Drawer ---------------------------------- */

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}

/** 右侧抽屉：普通新增编辑使用（UI 规范 12.5）；移动端占满屏幕 */
export function Drawer({ open, onClose, title, children, footer, width = 420 }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-[rgb(17_19_24/36%)]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-drag"
        style={{
          maxWidth: width,
          animation: 'drawer-in 180ms cubic-bezier(.2,.8,.2,1)',
          borderRadius: '22px 22px 22px 22px',
        }}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <h2 className="text-base font-bold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            title="关闭"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-500 hover:bg-surface-muted hover:text-ink-900"
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------------------------- Modal ---------------------------------- */

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** 仅用于必须中断流程的确认（UI 规范 12.6） */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[75] grid place-items-center p-4">
      <div className="absolute inset-0 bg-[rgb(17_19_24/36%)]" onClick={onClose} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full max-w-[440px] rounded-[22px] border border-line bg-white p-5 shadow-drag"
        style={{ animation: 'block-in 200ms cubic-bezier(.2,.8,.2,1)' }}
      >
        <h2 className="text-base font-bold text-ink-900">{title}</h2>
        <div className="mt-3 text-sm leading-6 text-ink-700">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------------------------- Form ---------------------------------- */

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: ReactNode
  error?: string
  hint?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-ink-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] leading-4 text-ink-500">{hint}</p>}
      {error && (
        <p className="mt-1 text-[11px] font-medium leading-4 text-danger-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

const CONTROL_CLASS =
  'w-full rounded-ui border border-line bg-white px-3 text-sm text-ink-900 placeholder:text-ink-500/70 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25 disabled:text-ink-500'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`h-10 md:h-10 ${CONTROL_CLASS} ${className}`} style={{ fontSize: 16 }} {...rest} />
}

/* ---------------------------------- Select ---------------------------------- */

interface SelectOptionItem {
  value: string
  label: ReactNode
  disabled: boolean
}

interface PopupPosition {
  x: number
  y: number
  width: number
  maxHeight: number
}

/**
 * 自定义下拉：触发器沿用输入控件样式，选项列表通过 Portal 渲染到 body，
 * 替代原生 select 的系统菜单（选中项品牌蓝实心，悬停浅灰，圆角 12px）。
 * onChange 保持 { target: { value } } 形状，现有调用方无需修改。
 */
export function Select({
  className = '',
  children,
  value,
  onChange,
  disabled,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [pos, setPos] = useState<PopupPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const options = useMemo<SelectOptionItem[]>(() => {
    const list: SelectOptionItem[] = []
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return
      const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean }
      list.push({ value: String(props.value ?? ''), label: props.children, disabled: Boolean(props.disabled) })
    })
    return list
  }, [children])

  const selectedValue = String(value ?? '')
  const selected = options.find((opt) => opt.value === selectedValue)

  const place = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = Math.max(rect.width, 190)
    const popupHeight = popupRef.current?.offsetHeight ?? 200
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < popupHeight + 16 && rect.top > spaceBelow
    let x = rect.left
    x = Math.max(8, Math.min(x, window.innerWidth - width - 8))
    let y = openUp ? rect.top - popupHeight - 6 : rect.bottom + 6
    y = Math.max(8, Math.min(y, window.innerHeight - popupHeight - 8))
    setPos({ x, y, width, maxHeight: Math.min(304, openUp ? rect.top - 14 : spaceBelow - 14) })
  }, [])

  const openPopup = () => {
    if (disabled || options.length === 0) return
    const currentIndex = options.findIndex((opt) => opt.value === selectedValue)
    setHighlight(currentIndex >= 0 ? currentIndex : 0)
    setOpen(true)
  }

  const choose = (opt: SelectOptionItem) => {
    if (opt.disabled) return
    setOpen(false)
    triggerRef.current?.focus()
    if (opt.value !== selectedValue) {
      onChange?.({ target: { value: opt.value } } as unknown as React.ChangeEvent<HTMLSelectElement>)
    }
  }

  useEffect(() => {
    if (!open) return
    place()
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      setOpen(false)
    }
    const onScroll = (event: Event) => {
      if (popupRef.current && event.target instanceof Node && popupRef.current.contains(event.target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
    function close() {
      setOpen(false)
    }
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const node = popupRef.current?.querySelector(`[data-option-index="${highlight}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [open, highlight])

  const heightClass = /\bh-\d+\b/.test(className) ? '' : 'h-10'
  const ariaLabel = (rest as { 'aria-label'?: string })['aria-label']

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={rest.id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => (open ? setOpen(false) : openPopup())}
        onKeyDown={(event) => {
          if (!open) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openPopup()
            }
            return
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setHighlight((index) => Math.min(options.length - 1, index + 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlight((index) => Math.max(0, index - 1))
          } else if (event.key === 'Home') {
            event.preventDefault()
            setHighlight(0)
          } else if (event.key === 'End') {
            event.preventDefault()
            setHighlight(options.length - 1)
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            const opt = options[highlight]
            if (opt) choose(opt)
          }
        }}
        className={`flex ${heightClass} w-full items-center justify-between gap-2 rounded-ui border border-line bg-white px-3 text-sm text-ink-900 transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
        style={{ fontSize: 16, ...(rest.style as React.CSSProperties) }}
      >
        <span className={`min-w-0 flex-1 truncate text-left ${selected ? '' : 'text-ink-900'}`}>
          {selected ? selected.label : ''}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={`shrink-0 text-ink-500 transition-transform duration-100 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={popupRef}
            role="listbox"
            aria-label={ariaLabel}
            className="fixed z-[80] overflow-y-auto overscroll-contain rounded-menu border border-line bg-white p-1 shadow-drag"
            style={{
              left: pos?.x ?? -9999,
              top: pos?.y ?? -9999,
              width: pos?.width ?? 190,
              maxHeight: pos?.maxHeight ?? 280,
              visibility: pos ? 'visible' : 'hidden',
              animation: 'block-in 140ms cubic-bezier(.2,.8,.2,1)',
            }}
          >
            {options.length === 0 && <p className="px-3 py-2 text-xs text-ink-500">暂无选项</p>}
            {options.map((opt, index) => {
              const isSelected = opt.value === selectedValue
              const isHighlighted = index === highlight
              return (
                <button
                  key={opt.value || `opt-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-option-index={index}
                  disabled={opt.disabled}
                  onClick={() => choose(opt)}
                  onMouseEnter={() => setHighlight(index)}
                  className={`flex h-9 w-full items-center rounded-menu px-3 text-left text-sm ${
                    isSelected
                      ? 'bg-brand-600 font-semibold text-white'
                      : isHighlighted
                        ? 'bg-surface-muted text-ink-900'
                        : 'text-ink-700'
                  } ${opt.disabled ? 'cursor-not-allowed opacity-45' : ''}`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`min-h-[88px] py-2 ${CONTROL_CLASS} ${className}`} style={{ fontSize: 16 }} {...rest} />
}

/* ---------------------------------- States ---------------------------------- */

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line px-6 py-10 text-center">
      <p className="text-sm font-semibold text-ink-700">{title}</p>
      {hint && <p className="max-w-[320px] text-xs leading-5 text-ink-500">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-ui bg-surface-muted ${className}`} />
}

/* ---------------------------------- Page head ---------------------------------- */

export function PageHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow?: string
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-overview border border-line bg-white px-6 py-5 shadow-panel sm:px-8">
      <div>
        {eyebrow && (
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-brand-600">
            <span aria-hidden className="h-[5px] w-[18px] rounded-full bg-brand-600" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-[28px] sm:leading-9">{title}</h1>
      </div>
      {aside && <div className="max-w-[260px]">{aside}</div>}
    </div>
  )
}
