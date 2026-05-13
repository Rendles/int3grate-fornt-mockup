import type { ReactNode } from 'react'
import { Badge, Box, Code, DropdownMenu, Flex, IconButton, Text } from '@radix-ui/themes'

import { Fragment, useEffect, useState } from 'react'
import { Link, useRouter } from '../router'
import { useAuth } from '../auth'
import { useTheme } from '../theme'
import { api } from '../lib/api'
import logoFullDark from '../../assets/brand/logo-full.svg'
import logoFullLight from '../../assets/brand/logo-full-onlight.svg'
import logoMark from '../../assets/brand/logo-mark.svg'
import {
  IconAgent,
  IconApproval,
  // IconAudit — restore when re-enabling the Audit nav item below.
  // IconAudit,
  IconBug,
  // IconChat — restore when re-enabling Welcome chat sandbox nav item
  IconHelp,
  IconHome,
  IconLogout,
  IconMoon,
  IconRun,
  // IconSettings — restore when re-enabling Settings nav item below.
  // IconSettings,
  IconSpend,
  IconSun,
  // IconTool — restore when re-enabling Apps nav item below.
  // IconTool,
} from './icons'
import { useDevMode } from '../dev/dev-mode'
import type { DevMode } from '../dev/dev-mode'
import { Avatar } from './common'
import { roleLabel } from '../lib/format'
import { useTour } from '../tours/useTour'
import { WorkspaceSwitcher } from './workspace-switcher'

interface NavItem {
  key: string
  label: string
  to: string
  icon: ReactNode
  badge?: { count: number | string; tone?: 'accent' | 'warn' | 'muted' }
  /** Render a thin divider above this item to set it apart visually. */
  dividerAbove?: boolean
}

export function Sidebar() {
  const { user } = useAuth()
  const { path } = useRouter()
  const [pendingApprovals, setPendingApprovals] = useState<number>(0)

  // The badge counts pending approvals across ALL user memberships,
  // matching the default scope of every list screen (filter == [] →
  // union of memberships). We omit `workspace_ids` so the api falls
  // back to the user's full membership list — see lib/api.ts and
  // docs/plans/workspaces-redesign-spec.md § 9.
  useEffect(() => {
    api.listApprovals({ status: 'pending' }).then(list => setPendingApprovals(list.total))
  }, [])

  // Restore when re-enabling any admin-only nav item below (Settings / Audit).
  // const isAdmin = user?.role === 'admin' || user?.role === 'domain_admin'
  const items: NavItem[] = [
    { key: 'home', label: 'Home', to: '/', icon: <IconHome /> },
    {
      key: 'approvals',
      label: 'Approvals',
      to: '/approvals',
      icon: <IconApproval />,
      badge: pendingApprovals > 0 ? { count: pendingApprovals, tone: 'warn' } : undefined,
    },
    { key: 'activity', label: 'Activity', to: '/activity', icon: <IconRun /> },
    { key: 'assistants', label: 'Agents', to: '/agents', icon: <IconAgent /> },
    // Apps nav item hidden in MVP — per-agent permissions cover the same need.
    // See docs/handoff-prep.md (Apps hide entry). Restore together with the
    // /apps route in index.tsx when re-enabling.
    // { key: 'apps', label: 'Apps', to: '/apps', icon: <IconTool /> },
    { key: 'costs', label: 'Costs', to: '/costs', icon: <IconSpend /> },
    // Welcome chat sandbox route removed — delete this nav item together
    // with the /sandbox/welcome-chat route in index.tsx and the
    // screens/sandbox/ folder when the experiment is closed.
    {
      key: 'team-bridge',
      label: 'Team Bridge',
      to: '/sandbox/team-bridge',
      icon: <IconAgent />,
      badge: { count: 'preview', tone: 'muted' },
      dividerAbove: true,
    },
    {
      key: 'team-map',
      label: 'Team Map',
      to: '/sandbox/team-map',
      icon: <IconAgent />,
      badge: { count: 'preview', tone: 'muted' },
      // dividerAbove not needed — team-bridge already provides the sandbox
      // section divider.
    },
    // Settings is hidden in MVP; the Audit log was extracted into its own
    // top-level admin route. See docs/handoff-prep.md (Settings hide entry).
    // Restore this nav item together with the /settings/* routes in
    // index.tsx when re-enabling.
    // ...(isAdmin
    //   ? [{ key: 'settings', label: 'Settings', to: '/settings', icon: <IconSettings /> } as NavItem]
    //   : []),
    // Audit nav item rolled back into Activity (no toggle, single grouped
    // view). The /audit route is commented out in index.tsx; AuditScreen
    // file is preserved. Restore this nav item if a separate compliance
    // surface is needed again.
    // ...(isAdmin
    //   ? [{ key: 'audit', label: 'Audit', to: '/audit', icon: <IconAudit /> } as NavItem]
    //   : []),
  ]

  const isActive = (to: string) => {
    if (to === '/') return path === '/'
    return path.startsWith(to)
  }

  return (
    <nav className="shell__sidebar" aria-label="Main">
      <div className="sb__brand" data-tour="sb-brand">
        <picture className="sb__brand-logo sb__brand-logo--full">
          <img src={logoFullDark} alt="Int3grate.ai" className="sb__brand-logo-img sb__brand-logo-img--dark" />
          <img src={logoFullLight} alt="Int3grate.ai" className="sb__brand-logo-img sb__brand-logo-img--light" />
        </picture>
        <div className="sb__brand-logo sb__brand-logo--mini" aria-hidden>
          <img src={logoMark} alt="" />
        </div>
      </div>

      <WorkspaceSwitcher />

      <div className="sb__nav">
        {items.map(item => (
          <Fragment key={item.key}>
            {item.dividerAbove && (
              <div
                aria-hidden
                style={{
                  height: 1,
                  margin: '8px 12px 4px',
                  background: 'var(--gray-a4)',
                }}
              />
            )}
            <Link
              to={item.to}
              data-tour={`nav-${item.key}`}
              className={`sb__item${isActive(item.to) ? ' sb__item--active' : ''}`}
            >
              <span className="sb__item-icon">{item.icon}</span>
              <Text as="span" size="2">{item.label}</Text>
              {item.badge && (
                <Badge
                  color={item.badge.tone === 'warn' ? 'orange' : item.badge.tone === 'muted' ? 'gray' : 'cyan'}
                  variant={item.badge.tone === 'muted' ? 'outline' : 'soft'}
                  radius="full"
                  size="1"
                  className="sb__item-badge"
                >
                  {item.badge.count}
                </Badge>
              )}
            </Link>
          </Fragment>
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

        <DevModeMenu />

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

// ─── DevModeMenu ────────────────────────────────────────────────────────
// Topbar dropdown for forcing every read endpoint into a synthetic state
// (empty / loading / error). Session-only — refresh resets to 'real'.
// Trigger glows orange when a non-real mode is active so it's never invisible
// that the data on screen is fake.

const DEV_MODES: { id: DevMode; label: string; hint: string }[] = [
  { id: 'real', label: 'Real data', hint: 'Use fixtures as usual' },
  { id: 'empty', label: 'Empty', hint: 'All list endpoints return []' },
  { id: 'loading', label: 'Loading', hint: 'All read endpoints hang forever' },
  { id: 'error', label: 'Error', hint: 'All read endpoints throw' },
]

function DevModeMenu() {
  const { mode, setMode } = useDevMode()
  const isActive = mode !== 'real'
  const current = DEV_MODES.find(m => m.id === mode)
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <IconButton
          variant={isActive ? 'soft' : 'ghost'}
          color={isActive ? 'orange' : undefined}
          size="1"
          title={`Dev: forcing ${current?.label.toLowerCase() ?? 'real'} state`}
          aria-label="Dev mode menu"
        >
          <IconBug size={14} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content size="1">
        <DropdownMenu.Label>Force page state</DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={mode} onValueChange={v => setMode(v as DevMode)}>
          {DEV_MODES.map(opt => (
            <DropdownMenu.RadioItem
              key={opt.id}
              value={opt.id}
              title={opt.hint}
              style={{ minWidth: 160 }}
            >
              {opt.label}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}

