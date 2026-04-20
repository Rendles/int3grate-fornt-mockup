import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '../router'
import { IconHelp } from './icons'

export function Avatar({
  initials,
  tone = 'accent',
  size = 24,
}: {
  initials: string
  tone?: string
  size?: number
}) {
  const toneColor: Record<string, string> = {
    accent: 'var(--accent)',
    info: 'var(--info)',
    warn: 'var(--warn)',
    success: 'var(--success)',
    danger: 'var(--danger)',
  }
  const bg = `color-mix(in oklab, ${toneColor[tone] ?? 'var(--accent)'} 18%, var(--surface-3))`
  const border = `color-mix(in oklab, ${toneColor[tone] ?? 'var(--accent)'} 40%, var(--border-2))`
  return (
    <span
      className="mono"
      style={{
        width: size,
        height: size,
        display: 'inline-grid',
        placeItems: 'center',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 4,
        fontSize: Math.max(9, size * 0.42),
        fontWeight: 600,
        color: toneColor[tone] ?? 'var(--accent)',
        flexShrink: 0,
        letterSpacing: 0,
      }}
    >
      {initials}
    </span>
  )
}

export function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean
  onChange?: (v: boolean) => void
  label?: string
  disabled?: boolean
}) {
  return (
    <label
      className={`toggle${on ? ' toggle--on' : ''}`}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      <span className="toggle__track">
        <span className="toggle__thumb" />
      </span>
      {label && <span className="toggle__label">{label}</span>}
    </label>
  )
}

export function Chip({
  tone,
  square,
  children,
}: {
  tone?: 'accent' | 'warn' | 'danger' | 'success' | 'info' | 'ghost'
  square?: boolean
  children: ReactNode
}) {
  const cls = ['chip']
  if (tone) cls.push(`chip--${tone}`)
  if (square) cls.push('chip--sq')
  return <span className={cls.join(' ')}>{children}</span>
}

export function Tabs({
  items,
  active,
  onSelect,
}: {
  items: { key: string; label: string; count?: number | string; href?: string }[]
  active: string
  onSelect?: (key: string) => void
}) {
  return (
    <div className="tabs">
      {items.map(t => {
        const cls = `tabs__item${active === t.key ? ' tabs__item--active' : ''}`
        const content = (
          <>
            <span>{t.label}</span>
            {t.count != null && <span className="tabs__count">{t.count}</span>}
          </>
        )
        if (t.href)
          return (
            <Link key={t.key} to={t.href} className={cls}>
              {content}
            </Link>
          )
        return (
          <button key={t.key} className={cls} onClick={() => onSelect?.(t.key)}>
            {content}
          </button>
        )
      })}
    </div>
  )
}

export function CommandBar({
  parts,
}: {
  parts: { label: string; value: string; tone?: 'accent' | 'warn' | 'muted' }[]
}) {
  return (
    <div className="command-bar">
      {parts.map((p, i) => (
        <div key={i}>
          <span>{p.label}</span>{' '}
          <span
            className={`command-bar__val${p.tone === 'accent' ? ' command-bar__val--accent' : ''}`}
            style={p.tone === 'warn' ? { color: 'var(--warn)' } : undefined}
          >
            {p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="page__header">
      <div className="page__header-info">
        {eyebrow && <div className="page__eyebrow">{eyebrow}</div>}
        <h1 className="page__title">{title}</h1>
        {subtitle && <p className="page__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page__actions">{actions}</div>}
    </header>
  )
}

export function Status({
  status,
}: {
  status:
    | 'active'
    | 'draft'
    | 'archived'
    | 'paused'
    | 'pending'
    | 'running'
    | 'suspended'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'approved'
    | 'rejected'
    | 'expired'
}) {
  const map: Record<string, { tone: 'accent' | 'warn' | 'success' | 'danger' | 'info' | 'ghost'; label: string; pulse?: boolean }> = {
    active: { tone: 'accent', label: 'Active' },
    draft: { tone: 'ghost', label: 'Draft' },
    archived: { tone: 'ghost', label: 'Archived' },
    paused: { tone: 'warn', label: 'Paused' },
    pending: { tone: 'warn', label: 'Pending', pulse: true },
    running: { tone: 'info', label: 'Running', pulse: true },
    suspended: { tone: 'warn', label: 'Suspended', pulse: true },
    completed: { tone: 'success', label: 'Completed' },
    failed: { tone: 'danger', label: 'Failed' },
    cancelled: { tone: 'ghost', label: 'Cancelled' },
    approved: { tone: 'success', label: 'Approved' },
    rejected: { tone: 'danger', label: 'Rejected' },
    expired: { tone: 'ghost', label: 'Expired' },
  }
  const s = map[status]
  return (
    <span className="row row--sm">
      <span className={`dot dot--${s.tone === 'ghost' ? 'accent' : s.tone}${s.pulse ? ' dot--pulse' : ''}`} style={s.tone === 'ghost' ? { background: 'var(--text-dim)' } : undefined} />
      <span className="nowrap" style={{ fontSize: 12, color: 'var(--text)' }}>
        {s.label}
      </span>
    </span>
  )
}

export function InfoHint({
  children,
  size = 13,
}: {
  children: ReactNode
  size?: number
}) {
  const iconRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'bottom' | 'top' } | null>(null)

  const compute = () => {
    const icon = iconRef.current
    if (!icon) return
    const rect = icon.getBoundingClientRect()
    const margin = 12
    const gap = 8
    const vw = window.innerWidth
    const vh = window.innerHeight

    const bubble = bubbleRef.current
    const bubbleW = bubble?.offsetWidth ?? 280
    const bubbleH = bubble?.offsetHeight ?? 80

    const cx = rect.left + rect.width / 2

    // Horizontal: centre on the icon, clamp to viewport.
    let left = cx - bubbleW / 2
    if (left < margin) left = margin
    if (left + bubbleW > vw - margin) left = vw - margin - bubbleW

    // Vertical: prefer below; flip above if not enough room.
    const spaceBelow = vh - rect.bottom - margin
    const spaceAbove = rect.top - margin
    const placement: 'bottom' | 'top' =
      spaceBelow >= bubbleH + gap || spaceBelow >= spaceAbove ? 'bottom' : 'top'
    const top = placement === 'bottom'
      ? rect.bottom + gap
      : rect.top - bubbleH - gap

    setPos({ top, left, placement })
  }

  const show = () => {
    setOpen(true)
    // compute after bubble mounts so we know its size
    requestAnimationFrame(compute)
  }
  const hide = () => setOpen(false)

  // Re-measure when the window changes size while open
  useLayoutEffect(() => {
    if (!open) return
    compute()
    const onResize = () => compute()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open])

  return (
    <>
      <span
        ref={iconRef}
        className="info-hint"
        tabIndex={0}
        role="button"
        aria-label="More information"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <IconHelp size={size} className="info-hint__icon" />
      </span>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={bubbleRef}
          className={`info-hint__bubble${pos ? ` info-hint__bubble--${pos.placement}` : ''}`}
          style={{
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            visibility: pos ? 'visible' : 'hidden',
          }}
        >
          {children}
        </div>,
        document.querySelector('.prototype-root') ?? document.body,
      )}
    </>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizes = [10, 25, 50],
  onPageSizeChange,
  label = 'rows',
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  pageSizes?: number[]
  onPageSizeChange?: (n: number) => void
  label?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const start = total === 0 ? 0 : safePage * pageSize + 1
  const end = Math.min((safePage + 1) * pageSize, total)

  return (
    <div className="pagination">
      <span className="pagination__info">
        {start}–{end} of {total} {label}
      </span>
      <div className="pagination__controls">
        {onPageSizeChange && (
          <label className="pagination__size">
            <span>rows/page</span>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizes.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <button
          className="pagination__nav"
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
          disabled={safePage <= 0}
          aria-label="Previous page"
        >
          ← prev
        </button>
        <span className="pagination__page">
          {safePage + 1} / {totalPages}
        </span>
        <button
          className="pagination__nav"
          onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
          disabled={safePage >= totalPages - 1}
          aria-label="Next page"
        >
          next →
        </button>
      </div>
    </div>
  )
}

export function Btn({
  children,
  variant = 'default',
  size,
  disabled,
  onClick,
  href,
  icon,
  title,
}: {
  children?: ReactNode
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'lg'
  disabled?: boolean
  onClick?: () => void
  href?: string
  icon?: ReactNode
  title?: string
}) {
  const cls = ['btn']
  if (variant !== 'default') cls.push(`btn--${variant}`)
  if (size) cls.push(`btn--${size}`)
  if (!children && icon) cls.push('btn--icon')
  const content = (
    <>
      {icon}
      {children}
    </>
  )
  if (href)
    return (
      <Link to={href} className={cls.join(' ')}>
        {content}
      </Link>
    )
  return (
    <button className={cls.join(' ')} onClick={onClick} disabled={disabled} title={title}>
      {content}
    </button>
  )
}
