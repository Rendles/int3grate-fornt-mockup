import type { ReactNode } from 'react'
import { Link } from '../router'

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

export function Dot({
  tone = 'accent',
  pulse,
}: {
  tone?: 'accent' | 'warn' | 'danger' | 'success' | 'info'
  pulse?: boolean
}) {
  return <span className={`dot dot--${tone}${pulse ? ' dot--pulse' : ''}`} />
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

export function Breadcrumbs({
  parts,
}: {
  parts: { label: string; to?: string }[]
}) {
  return (
    <nav className="tb__crumbs">
      {parts.map((p, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span className="tb__crumb-sep">/</span>}
          {p.to ? (
            <Link to={p.to} className={i === parts.length - 1 ? 'tb__crumb--last' : ''}>
              {p.label}
            </Link>
          ) : (
            <span className={i === parts.length - 1 ? 'tb__crumb--last' : ''}>{p.label}</span>
          )}
        </span>
      ))}
    </nav>
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

export function Sparkbar({
  values,
  accent,
  height = 28,
}: {
  values: number[]
  accent?: boolean
  height?: number
}) {
  const max = Math.max(...values, 0.001)
  return (
    <div className="spark" style={{ height }}>
      {values.map((v, i) => (
        <span
          key={i}
          className={`spark-bar${accent ? ' spark-bar--accent' : ''}`}
          style={{ height: `${Math.max(6, (v / max) * 100)}%`, opacity: accent ? 1 : 0.5 + (i / values.length) * 0.5 }}
        />
      ))}
    </div>
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

export function MockBadge({
  label = 'ui-only',
  size = 'sm',
  title,
}: {
  label?: string
  size?: 'sm' | 'xs'
  title?: string
}) {
  return (
    <span
      className={`mock-badge${size === 'xs' ? ' mock-badge--xs' : ''}`}
      title={title ?? 'Shown on the UI but not returned by the gateway API yet'}
    >
      {label}
    </span>
  )
}

export function BackendGapBanner({
  title = 'Some fields on this screen aren\'t in the backend yet',
  body,
  fields,
}: {
  title?: string
  body?: ReactNode
  fields: string[]
}) {
  return (
    <div className="mock-gap-banner" role="note">
      <div className="mock-gap-banner__icon" aria-hidden>!</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mock-gap-banner__title">{title}</div>
        <div className="mock-gap-banner__body">
          {body ?? <>Populated from fixtures for the mockup. Each item below is tagged inline with the <span className="mock-badge mock-badge--xs" style={{ marginLeft: 2, marginRight: 2 }}>ui-only</span> pill.</>}
        </div>
        <div className="mock-gap-banner__chips">
          {fields.map(f => (
            <span key={f} className="mock-badge mock-badge--xs">{f}</span>
          ))}
        </div>
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
