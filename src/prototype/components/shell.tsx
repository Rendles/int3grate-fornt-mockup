import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useRouter } from '../router'
import { useAuth } from '../auth'
import { useTheme } from '../theme'
import { api } from '../lib/api'
import logo from '../../assets/logo.svg'
import {
  IconAgent,
  IconApproval,
  IconHome,
  IconLogout,
  IconMoon,
  IconSpend,
  IconSun,
  IconTask,
} from './icons'
import { Avatar } from './common'
import { roleLabel } from '../lib/format'

interface NavItem {
  key: string
  label: string
  to: string
  icon: ReactNode
  badge?: { count: number | string; tone?: 'accent' | 'warn' | 'muted' }
}

export function Sidebar() {
  const { user } = useAuth()
  const { path } = useRouter()
  const [pendingApprovals, setPendingApprovals] = useState<number>(0)
  const [activeTasks, setActiveTasks] = useState<number>(0)

  useEffect(() => {
    api.listApprovals({ status: 'pending' }).then(list => setPendingApprovals(list.length))
    api.listTasks().then(list =>
      setActiveTasks(list.filter(t => t.status === 'pending' || t.status === 'running').length)
    )
  }, [])

  const items: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', to: '/', icon: <IconHome /> },
    { key: 'agents', label: 'Agents', to: '/agents', icon: <IconAgent /> },
    {
      key: 'tasks',
      label: 'Tasks',
      to: '/tasks',
      icon: <IconTask />,
      badge: activeTasks > 0 ? { count: activeTasks, tone: 'muted' } : undefined,
    },
    {
      key: 'approvals',
      label: 'Approvals',
      to: '/approvals',
      icon: <IconApproval />,
      badge: pendingApprovals > 0 ? { count: pendingApprovals, tone: 'warn' } : undefined,
    },
    { key: 'spend', label: 'Spend', to: '/spend', icon: <IconSpend /> },
  ]

  const isActive = (to: string) => {
    if (to === '/') return path === '/'
    return path.startsWith(to)
  }

  return (
    <nav className="shell__sidebar" aria-label="Main">
      <div className="sb__brand">
        <div className="sb__brand-mark">
          <img src={logo} alt="" />
        </div>
        <div>
          <div className="sb__brand-name">Int3grate.ai</div>
          <div className="sb__brand-sub">CONTROL · v0.7</div>
        </div>
      </div>

      {user && (
        <div className="sb__tenant">
          <div className="sb__tenant-label">Tenant / Domain</div>
          <div className="sb__tenant-body">
            <div>
              <div className="sb__tenant-name mono">{user.tenant_id}</div>
              <div className="sb__tenant-domain mono">{user.domain_id ?? '—'}</div>
            </div>
            <Link to="/profile" className="sb__tenant-switch">
              open
            </Link>
          </div>
        </div>
      )}

      <div className="sb__nav">
        {items.map(item => (
          <Link
            key={item.key}
            to={item.to}
            className={`sb__item${isActive(item.to) ? ' sb__item--active' : ''}`}
          >
            <span className="sb__item-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.badge && (
              <span
                className={`sb__item-badge${
                  item.badge.tone === 'warn'
                    ? ' sb__item-badge--warn'
                    : item.badge.tone === 'muted'
                      ? ' sb__item-badge--muted'
                      : ''
                }`}
              >
                {item.badge.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {user && (
        <div className="sb__footer">
          <Link to="/profile" className="sb__user">
            <Avatar initials={user.name.slice(0, 2).toUpperCase()} size={30} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="sb__user-name truncate">{user.name}</div>
              <div className="sb__user-role">{roleLabel(user.role)} · L{user.approval_level}</div>
            </div>
          </Link>
        </div>
      )}
    </nav>
  )
}

export function Topbar({
  crumbs,
}: {
  crumbs: { label: string; to?: string }[]
}) {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  return (
    <header className="shell__topbar">
      <nav className="tb__crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span className="tb__crumb-sep">/</span>}
            {c.to ? (
              <Link to={c.to} className={i === crumbs.length - 1 ? 'tb__crumb--last' : ''}>
                {c.label}
              </Link>
            ) : (
              <span className={i === crumbs.length - 1 ? 'tb__crumb--last' : ''}>{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="tb__spacer" />

      {user && (
        <div className="tb__meta">
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {user.email}
          </span>
        </div>
      )}

      <button
        className="tb__action"
        onClick={toggle}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <IconSun className="ic ic--sm" /> : <IconMoon className="ic ic--sm" />}
      </button>

      <button className="tb__action" onClick={logout} title="Sign out">
        <IconLogout className="ic ic--sm" />
      </button>
    </header>
  )
}

export function AppShell({
  crumbs,
  children,
}: {
  crumbs: { label: string; to?: string }[]
  children: ReactNode
}) {
  return (
    <div className="shell">
      <Sidebar />
      <Topbar crumbs={crumbs} />
      <main className="shell__main">{children}</main>
    </div>
  )
}
