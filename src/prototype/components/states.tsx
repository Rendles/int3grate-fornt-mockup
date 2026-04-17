import type { ReactNode } from 'react'
import { IconAlert, IconInfo, IconLock, IconTask } from './icons'
import { Btn } from './common'

export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string
  body?: string
  icon?: ReactNode
  action?: { label: string; href?: string; onClick?: () => void }
}) {
  return (
    <div className="state">
      <div className="state__icon">{icon ?? <IconTask />}</div>
      <div className="state__title">{title}</div>
      {body && <p className="state__body">{body}</p>}
      {action && (
        <div className="state__actions">
          <Btn variant="primary" href={action.href} onClick={action.onClick}>
            {action.label}
          </Btn>
        </div>
      )}
    </div>
  )
}

export function LoadingList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="stack stack--sm">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 48 }} />
      ))}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  body = 'The request could not be completed. Try again, or contact your workspace admin.',
  onRetry,
}: {
  title?: string
  body?: string
  onRetry?: () => void
}) {
  return (
    <div className="state" style={{ borderColor: 'var(--danger-border)' }}>
      <div className="state__icon" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>
        <IconAlert />
      </div>
      <div className="state__title">{title}</div>
      <p className="state__body">{body}</p>
      {onRetry && (
        <div className="state__actions">
          <Btn onClick={onRetry}>Retry</Btn>
        </div>
      )}
    </div>
  )
}

export function NoAccessState({
  requiredRole = 'Admin',
  body,
}: {
  requiredRole?: string
  body?: string
}) {
  return (
    <div className="state" style={{ borderColor: 'var(--border-2)' }}>
      <div className="state__icon" style={{ color: 'var(--warn)', borderColor: 'var(--warn-border)' }}>
        <IconLock />
      </div>
      <div className="state__title">You need {requiredRole} access</div>
      <p className="state__body">{body ?? 'This view is restricted by role. Ask a workspace admin to grant access or switch roles.'}</p>
    </div>
  )
}

export function Banner({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: 'warn' | 'info'
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={`banner banner--${tone}`}>
      <span className="banner__icon">{tone === 'warn' ? <IconAlert className="ic" /> : <IconInfo className="ic" />}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="banner__title">{title}</div>
        <div className="banner__body">{children}</div>
      </div>
      {action}
    </div>
  )
}

export function PlannedRibbon({ label = 'planned · not yet wired to backend' }: { label?: string }) {
  return (
    <div className="pg-ribbon">
      <span className="pg-ribbon__dot" />
      {label}
    </div>
  )
}
