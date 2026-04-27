import type { ReactNode } from 'react'
import { Badge, Box, Code, Flex, IconButton, Text } from '@radix-ui/themes'

import { Fragment, useEffect, useState } from 'react'
import { Link, useRouter } from '../router'
import { useAuth } from '../auth'
import { useTheme } from '../theme'
import { api } from '../lib/api'
import logo from '../../assets/logo.svg'
import {
  IconAgent,
  IconApproval,
  IconAudit,
  IconChat,
  IconHelp,
  IconHome,
  IconLogout,
  IconMoon,
  IconRun,
  IconSpend,
  IconSun,
  IconTask,
  IconTool,
} from './icons'
import { Avatar, MockBadge } from './common'
import { roleLabel } from '../lib/format'
import { useTour } from '../tours/useTour'

interface NavItem {
  key: string
  label: string
  to: string
  icon: ReactNode
  badge?: { count: number | string; tone?: 'accent' | 'warn' | 'muted' }
  mockKind?: 'design' | 'deferred'
}

export function Sidebar() {
  const { user } = useAuth()
  const { path } = useRouter()
  const [pendingApprovals, setPendingApprovals] = useState<number>(0)
  const [activeTasks, setActiveTasks] = useState<number>(0)
  const [activeChats, setActiveChats] = useState<number>(0)

  useEffect(() => {
    api.listApprovals({ status: 'pending' }).then(list => setPendingApprovals(list.total))
    api.listTasks().then(list =>
      setActiveTasks(list.items.filter(t => t.status === 'pending' || t.status === 'running').length)
    )
    if (user) {
      api.listChats({ id: user.id, role: user.role }, { limit: 100 }).then(list =>
        setActiveChats(list.items.filter(c => c.status === 'active').length)
      )
    }
  }, [user])

  const isAdmin = user?.role === 'admin' || user?.role === 'domain_admin'
  const items: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', to: '/', icon: <IconHome /> },
    { key: 'agents', label: 'Agents', to: '/agents', icon: <IconAgent /> },
    {
      key: 'chats',
      label: 'Chats',
      to: '/chats',
      icon: <IconChat />,
      badge: activeChats > 0 ? { count: activeChats, tone: 'accent' } : undefined,
    },
    {
      key: 'tasks',
      label: 'Tasks',
      to: '/tasks',
      icon: <IconTask />,
      badge: activeTasks > 0 ? { count: activeTasks, tone: 'muted' } : undefined,
      mockKind: 'deferred',
    },
    {
      key: 'approvals',
      label: 'Approvals',
      to: '/approvals',
      icon: <IconApproval />,
      badge: pendingApprovals > 0 ? { count: pendingApprovals, tone: 'warn' } : undefined,
    },
    { key: 'runs', label: 'Runs', to: '/runs', icon: <IconRun /> },
    { key: 'tools', label: 'Tools', to: '/tools', icon: <IconTool /> },
    { key: 'spend', label: 'Spend', to: '/spend', icon: <IconSpend /> },
    ...(isAdmin
      ? [{ key: 'audit', label: 'Audit', to: '/audit', icon: <IconAudit /> } as NavItem]
      : []),
  ]

  const isActive = (to: string) => {
    if (to === '/') return path === '/'
    return path.startsWith(to)
  }

  return (
    <nav className="shell__sidebar" aria-label="Main">
      <div className="sb__brand" data-tour="sb-brand">
        <div className="sb__brand-mark">
          <img src={logo} alt="" />
        </div>
        <div>
          <Text as="div" size="5" weight="medium" className="sb__brand-name">Int3grate.ai</Text>
          <Text as="div" size="1" className="sb__brand-sub">CONTROL · v0.7</Text>
        </div>
      </div>

      <div className="sb__nav">
        {items.map(item => (
          <Link
            key={item.key}
            to={item.to}
            data-tour={`nav-${item.key}`}
            className={`sb__item${isActive(item.to) ? ' sb__item--active' : ''}`}
          >
            <span className="sb__item-icon">{item.icon}</span>
            <Text as="span" size="2">{item.label}</Text>
            {item.mockKind && <MockBadge kind={item.mockKind} />}
            {item.badge && (
              <Badge
                color={item.badge.tone === 'warn' ? 'amber' : item.badge.tone === 'muted' ? 'gray' : 'blue'}
                variant={item.badge.tone === 'muted' ? 'outline' : 'soft'}
                radius="full"
                size="1"
                className="sb__item-badge"
              >
                {item.badge.count}
              </Badge>
            )}
          </Link>
        ))}
      </div>

      {user && (
        <div className="sb__footer" data-tour="sb-footer">
          <Link to="/profile" className="sb__user">
            <Avatar initials={user.name.slice(0, 2).toUpperCase()} size={30} />
            <Box flexGrow="1" minWidth="0">
              <Text as="div" size="1" className="truncate">{user.name}</Text>
              <Text as="div" size="1" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {roleLabel(user.role)}{user.approval_level != null ? ` · L${user.approval_level}` : ''}
              </Text>
            </Box>
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
  const { navigate } = useRouter()
  const { activeTour } = useTour()

  // Global "?" hotkey opens the Learning Center. Skipped when a tour is
  // already running (the tour engine owns the keyboard) and when the focus
  // is inside an editable field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?') return
      if (activeTour) return
      const target = e.target as HTMLElement | null
      if (target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.isContentEditable
      )) return
      e.preventDefault()
      navigate('/learn')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTour, navigate])

  return (
    <Flex
      asChild
      align="center"
      gap={{ initial: '2', md: '4' }}
      px={{ initial: '3', md: '5' }}
      gridArea="topbar"
      position="sticky"
      top="0"
      style={{
        zIndex: 10,
        background: 'var(--color-panel-solid)',
      }}
    >
      <header>
        <Flex asChild align="center" gap="2" flexGrow="1">
          <nav aria-label="Breadcrumb">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1
              return (
                <Fragment key={i}>
                  {i > 0 && (
                    <Text size="1" color="gray">
                      /
                    </Text>
                  )}
                  {c.to ? (
                    <Text size="1" color={isLast ? undefined : 'gray'} asChild>
                      <Link to={c.to}>{c.label}</Link>
                    </Text>
                  ) : (
                    <Text size="1" color={isLast ? undefined : 'gray'}>
                      {c.label}
                    </Text>
                  )}
                </Fragment>
              )
            })}
          </nav>
        </Flex>

        {user && (
          <Box display={{ initial: 'none', md: 'block' }}>
            <Code variant="ghost" size="1" color="gray">
              {user.email}
            </Code>
          </Box>
        )}

        <IconButton
          variant="ghost"
          size="1"
          onClick={() => navigate('/learn')}
          title="Open Learning Center (?)"
          aria-label="Open Learning Center"
        >
          <IconHelp size={14} />
        </IconButton>

        <IconButton
          variant="ghost"
          size="1"
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <IconSun size={14} /> : <IconMoon size={14} />}
        </IconButton>

        <IconButton
          variant="ghost"
          size="1"
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
        >
          <IconLogout size={14} />
        </IconButton>
      </header>
    </Flex>
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
