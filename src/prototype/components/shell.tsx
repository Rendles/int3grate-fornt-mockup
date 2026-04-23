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
  IconHome,
  IconIntegration,
  IconLogout,
  IconMoon,
  IconSpend,
  IconSun,
  IconTask,
  IconTool,
} from './icons'
import { Avatar } from './common'
import { roleLabel } from '../lib/format'

interface NavItem {
  key: string
  label: string
  to: string
  icon: ReactNode
  badge?: { count: number | string; tone?: 'accent' | 'warn' | 'muted' }
  note?: string
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
      note: 'deferred',
    },
    {
      key: 'approvals',
      label: 'Approvals',
      to: '/approvals',
      icon: <IconApproval />,
      badge: pendingApprovals > 0 ? { count: pendingApprovals, tone: 'warn' } : undefined,
    },
    { key: 'tools', label: 'Tools', to: '/tools', icon: <IconTool /> },
    { key: 'spend', label: 'Spend', to: '/spend', icon: <IconSpend /> },
    { key: 'components', label: 'Components', to: '/components', icon: <IconIntegration /> },
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
          <Text as="div" size="5" weight="medium" className="sb__brand-name">Int3grate.ai</Text>
          <Text as="div" size="1" className="sb__brand-sub">CONTROL · v0.7</Text>
        </div>
      </div>

      {user && (
        <div className="sb__tenant">
          <Text as="div" size="1" className="sb__tenant-label">Tenant / Domain</Text>
          <div className="sb__tenant-body">
            <div>
              <Text as="div" size="2" weight="medium" className="sb__tenant-name">{user.tenant_id}</Text>
              <Text as="div" size="1" className="sb__tenant-domain">{user.domain_id ?? '—'}</Text>
            </div>
            <Link to="/profile" className="sb__tenant-switch">
              <Text size="1">open</Text>
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
            <Text as="span" size="2">{item.label}</Text>
            {item.note && (
              <Badge
                color="gray"
                variant="outline"
                radius="small"
                size="1"
                title="MVP-deferred per ADR-0003"
                style={{ letterSpacing: '0.14em', textTransform: 'uppercase', borderStyle: 'dashed' }}
              >
                {item.note}
              </Badge>
            )}
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
        <div className="sb__footer">
          <Link to="/profile" className="sb__user">
            <Avatar initials={user.name.slice(0, 2).toUpperCase()} size={30} />
            <Box flexGrow="1" minWidth="0">
              <Text as="div" size="1" className="truncate">{user.name}</Text>
              <Text as="div" size="1" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {roleLabel(user.role)} · L{user.approval_level}
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
        background: 'var(--gray-2)',
        borderBottom: '1px solid var(--gray-6)',
      }}
    >
      <header>
        <Flex asChild align="center" gap="2" flexGrow="1">
          <nav aria-label="Breadcrumb">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1
              const label = (
                <Text size="1" color={isLast ? undefined : 'gray'}>
                  {c.label}
                </Text>
              )
              return (
                <Fragment key={i}>
                  {i > 0 && (
                    <Text size="1" color="gray">
                      /
                    </Text>
                  )}
                  {c.to ? <Link to={c.to}>{label}</Link> : label}
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
