import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Code, DataList, Flex, Switch, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Avatar, Caption, MetaRow, MockBadge, PageHeader, Pagination, Tabs } from '../components/common'
import { SelectField } from '../components/fields'
import { EmptyState, ErrorState, LoadingList, NoAccessState } from '../components/states'
import { IconAudit, IconLock } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent, AuditEvent, User } from '../lib/types'
import { absTime, ago, durationMs, money, num, roleLabel, shortRef, tenantLabel, toolLabel } from '../lib/format'

export type SettingsTab =
  | 'workspace'
  | 'team'
  | 'history'
  | 'developer'
  | 'diagnostic'

const SETTINGS_TABS: { key: SettingsTab; label: string; href: string }[] = [
  { key: 'workspace', label: 'Workspace', href: '/settings' },
  { key: 'team', label: 'Team members', href: '/settings/team' },
  { key: 'history', label: 'History log', href: '/settings/history' },
  { key: 'developer', label: 'Developer details', href: '/settings/developer' },
  { key: 'diagnostic', label: 'Diagnostic mode', href: '/settings/diagnostic' },
]

export default function SettingsScreen({ tab }: { tab: SettingsTab }) {
  const { user } = useAuth()
  const canView = !!user && (user.role === 'admin' || user.role === 'domain_admin')

  if (!canView) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'settings' }]}>
        <div className="page">
          <NoAccessState
            requiredRole="Workspace Admin or Team Admin"
            body="Settings is only visible to admins."
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      crumbs={[
        { label: 'home', to: '/' },
        { label: 'settings' },
      ]}
    >
      <div className="page page--wide">
        <PageHeader
          eyebrow="SETTINGS"
          title={<>Workspace <em>settings.</em></>}
          subtitle="Configure your workspace, manage team access, and inspect technical details."
        />

        <Tabs items={SETTINGS_TABS} active={tab} />
        <Box mt="5" />

        {tab === 'workspace' && <WorkspaceTab user={user!} />}
        {tab === 'team' && <TeamTab />}
        {tab === 'history' && <HistoryLogTab />}
        {tab === 'developer' && <DeveloperDetailsTab />}
        {tab === 'diagnostic' && <DiagnosticModeTab />}
      </div>
    </AppShell>
  )
}

// ────────────────────────────────────────────── Workspace tab

function WorkspaceTab({ user }: { user: User }) {
  return (
    <Flex direction="column" gap="4">
      <div className="card">
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">Workspace</Text>
          <MockBadge kind="design" hint="Editing workspace name and billing isn't backed by the gateway spec yet — kept here as a placeholder." />
        </div>
        <div className="card__body">
          <DataList.Root size="2">
            <MetaRow label="name" value={tenantLabel(user.tenant_id)} />
            <MetaRow label="owner" value={user.name} />
            <MetaRow label="plan" value={<Badge color="blue" variant="soft" radius="full" size="1">Pro</Badge>} />
            <MetaRow label="created" value="—" />
          </DataList.Root>
        </div>
      </div>

      <div className="card">
        <div className="card__body">
          <Flex align="center" justify="between" gap="3" py="2">
            <Box>
              <Text as="div" size="2">Manage billing</Text>
              <Text as="div" size="1" color="gray" mt="1">Stripe customer portal for receipts, payment methods, and plan changes.</Text>
            </Box>
            <Button color="gray" variant="soft" disabled>
              Open billing (planned)
            </Button>
          </Flex>
          <Flex align="center" justify="between" gap="3" py="2" style={{ borderTop: '1px dashed var(--gray-a3)' }}>
            <Box>
              <Text as="div" size="2">Rename workspace</Text>
              <Text as="div" size="1" color="gray" mt="1">Visible to everyone on your team.</Text>
            </Box>
            <Button color="gray" variant="soft" disabled>
              Rename (planned)
            </Button>
          </Flex>
          <Flex align="center" justify="between" gap="3" py="2" style={{ borderTop: '1px dashed var(--gray-a3)' }}>
            <Box>
              <Text as="div" size="2">Close workspace</Text>
              <Text as="div" size="1" color="gray" mt="1">Permanently removes everything. Workspace owners only.</Text>
            </Box>
            <Button color="red" disabled>Close (planned)</Button>
          </Flex>
        </div>
      </div>
    </Flex>
  )
}

// ────────────────────────────────────────────── Team members tab

function TeamTab() {
  const [users, setUsers] = useState<User[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.listUsers()
      .then(u => { if (!cancelled) { setUsers(u); setError(null) } })
      .catch(e => { if (!cancelled) setError((e as Error).message ?? 'Failed to load team') })
    return () => { cancelled = true }
  }, [])

  if (error) return <ErrorState title="Couldn't load team" body={error} />
  if (!users) return <LoadingList rows={4} />

  return (
    <Flex direction="column" gap="4">
      <div className="card card--flush">
        <div className="card__head">
          <Flex align="center" gap="2">
            <Text as="div" size="2" weight="medium" className="card__title">Team members</Text>
            <MockBadge kind="design" hint="GET /users isn't in the gateway spec — the user list is mocked locally. Same data is used everywhere the UI resolves an owner / requester / approver name." />
          </Flex>
          <Text size="1" color="gray">{users.length} {users.length === 1 ? 'person' : 'people'}</Text>
        </div>
        <Flex direction="column">
          {users.map((u, i) => (
            <Flex
              key={u.id}
              align="center"
              gap="3"
              p="4"
              style={{ borderBottom: i === users.length - 1 ? 0 : '1px solid var(--gray-a3)' }}
            >
              <Avatar initials={u.name.slice(0, 2).toUpperCase()} size={32} />
              <Box flexGrow="1" minWidth="0">
                <Text as="div" size="2" weight="medium" className="truncate">{u.name}</Text>
                <Text as="div" size="1" color="gray" mt="1" className="truncate">{u.email}</Text>
              </Box>
              <Badge color="gray" variant="soft" radius="full" size="1">
                {roleLabel(u.role)}
              </Badge>
              {u.approval_level != null && (
                <Badge color="amber" variant="soft" radius="full" size="1">
                  L{u.approval_level} approver
                </Badge>
              )}
            </Flex>
          ))}
        </Flex>
      </div>

      <Flex justify="end">
        <Button color="gray" variant="soft" disabled>
          <IconLock />
          Invite member (planned)
        </Button>
      </Flex>
    </Flex>
  )
}

// ────────────────────────────────────────────── History log tab
// Was the standalone /audit screen. Moved here per Phase 1 plan section 5.

const HISTORY_TABLE_COLS = '160px 130px 110px minmax(0, 1fr) 100px 100px 100px'
const HISTORY_PAGE_SIZE_DEFAULT = 20

const STEP_TYPE_LABEL: Record<string, string> = {
  llm: 'LLM',
  tool_call: 'Tool call',
  approval_wait: 'Approval wait',
  system: 'System',
  chat_message: 'Chat message',
  chat_tool_call: 'Chat tool',
}

type HistorySource = 'all' | 'runs' | 'chats'
const HISTORY_SOURCES: HistorySource[] = ['all', 'runs', 'chats']

function historyStatusTone(status: string): 'green' | 'amber' | 'red' | 'cyan' | 'gray' {
  if (status === 'ok' || status === 'completed') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'pending' || status === 'blocked') return 'amber'
  if (status === 'running') return 'cyan'
  return 'gray'
}

function HistoryLogTab() {
  const [items, setItems] = useState<AuditEvent[] | null>(null)
  const [total, setTotal] = useState(0)
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentId, setAgentId] = useState<string>('all')
  const [source, setSource] = useState<HistorySource>('all')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZE_DEFAULT)

  useEffect(() => {
    let cancelled = false
    const limit = pageSize
    const offset = page * pageSize
    Promise.all([
      api.listAudit({
        agent_id: agentId === 'all' ? undefined : agentId,
        limit,
        offset,
      }),
      agents.length === 0 ? api.listAgents().then(r => r.items) : Promise.resolve(agents),
    ])
      .then(([list, ags]) => {
        if (cancelled) return
        let visible = list.items
        if (source === 'runs') visible = visible.filter(e => e.run_id !== null)
        else if (source === 'chats') visible = visible.filter(e => e.chat_id !== null)
        setItems(visible)
        setTotal(list.total)
        setAgents(ags)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load history')
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, source, page, pageSize, reloadTick])

  const agentName = (id: string) => agents.find(a => a.id === id)?.name ?? '—'

  const agentOptions = useMemo(
    () => [
      { value: 'all', label: 'Any agent' },
      ...agents.map(a => ({ value: a.id, label: a.name })),
    ],
    [agents],
  )

  return (
    <>
      <Flex align="center" gap="3" mb="4" wrap="wrap">
        <Caption mr="1">source</Caption>
        {HISTORY_SOURCES.map(s => {
          const isActive = source === s
          return (
            <Button
              key={s}
              type="button"
              size="2"
              variant="soft"
              color={isActive ? 'blue' : 'gray'}
              onClick={() => { setSource(s); setPage(0) }}
            >
              <span style={{ textTransform: 'capitalize' }}>{s}</span>
            </Button>
          )
        })}
        <Box width="240px" ml="2">
          <SelectField
            size="2"
            value={agentId}
            onChange={v => { setAgentId(v); setPage(0) }}
            options={agentOptions}
          />
        </Box>
      </Flex>

      {error ? (
        <ErrorState
          title="Couldn't load history"
          body={error}
          onRetry={() => setReloadTick(t => t + 1)}
        />
      ) : !items ? (
        <LoadingList rows={6} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IconAudit />}
          title={source === 'chats' ? 'No chat history yet' : 'No events match these filters'}
          body={source === 'chats'
            ? 'Chat conversations will appear here once your agents start chatting.'
            : 'Try selecting a different agent or source.'}
        />
      ) : (
        <div className="card card--table">
          <div className="table-head" style={{ gridTemplateColumns: HISTORY_TABLE_COLS }}>
            <Text as="span" size="1" color="gray">when</Text>
            <Text as="span" size="1" color="gray">step type</Text>
            <Text as="span" size="1" color="gray">status</Text>
            <Text as="span" size="1" color="gray">agent · model / tool</Text>
            <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>duration</Text>
            <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>tokens</Text>
            <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>cost</Text>
          </div>
          {items.map(e => (
            <div
              key={e.id}
              className="agent-row"
              style={{ gridTemplateColumns: HISTORY_TABLE_COLS, cursor: 'default' }}
            >
              <Box style={{ minWidth: 0 }}>
                <Text as="div" size="1" color="gray">{absTime(e.created_at)}</Text>
                {e.run_id && (
                  <Link to={`/activity/${e.run_id}`}>
                    <Text size="1" color="blue">activity {shortRef(e.run_id)}</Text>
                  </Link>
                )}
                {e.chat_id && (
                  <Link to={`/chats/${e.chat_id}`}>
                    <Text size="1" color="blue">chat {shortRef(e.chat_id)}</Text>
                  </Link>
                )}
              </Box>
              <Text as="span" size="1">{STEP_TYPE_LABEL[e.step_type] ?? e.step_type}</Text>
              <Badge color={historyStatusTone(e.status)} variant="soft" radius="full" size="1">
                {e.status}
              </Badge>
              <Box style={{ minWidth: 0 }}>
                <Text as="div" size="2" className="truncate">{agentName(e.agent_id)}</Text>
                <Text as="div" size="1" color="gray" mt="1" className="truncate">
                  {e.tool_name ? toolLabel(e.tool_name) : e.model_name ?? '—'}
                </Text>
              </Box>
              <Text as="div" size="1" color="gray" style={{ textAlign: 'right' }}>
                {durationMs(e.duration_ms)}
              </Text>
              <Text as="div" size="1" color="gray" style={{ textAlign: 'right' }}>
                {e.tokens_in != null || e.tokens_out != null
                  ? `${num(e.tokens_in ?? 0)}/${num(e.tokens_out ?? 0)}`
                  : '—'}
              </Text>
              <Text as="div" size="1" style={{ textAlign: 'right' }}>
                {e.cost_usd != null ? money(e.cost_usd, { cents: true }) : '—'}
              </Text>
            </div>
          ))}
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={n => { setPageSize(n); setPage(0) }}
            label="events"
          />
        </div>
      )}
    </>
  )
}

// ────────────────────────────────────────────── Developer details tab
// Plan section 5: hides API endpoints, raw IDs, policy snapshots away from
// the main UI but keeps them available to power users who specifically
// look here.

const DEV_ENDPOINTS: { area: string; method: string; path: string; note: string }[] = [
  { area: 'Auth', method: 'POST', path: '/auth/login', note: 'Returns bearer token + expires_at; client then calls GET /me.' },
  { area: 'Auth', method: 'GET', path: '/me', note: 'Resolves current user from bearer token.' },
  { area: 'Agents', method: 'GET', path: '/agents', note: 'Paginated; tenant-scoped.' },
  { area: 'Agents', method: 'POST', path: '/agents/{id}/versions/{verId}/activate', note: 'Activates a setup. New activations replace previous.' },
  { area: 'Permissions', method: 'PUT', path: '/agents/{id}/grants', note: 'ReplaceToolGrantsRequest — gateway re-assigns scope/id.' },
  { area: 'Approvals', method: 'POST', path: '/approvals/{id}/decision', note: 'Async — returns 202 queued; orchestrator resumes the run.' },
  { area: 'Activity', method: 'GET', path: '/dashboard/runs', note: 'Lightweight projection with denormalised agent_id.' },
  { area: 'Costs', method: 'GET', path: '/spend', note: 'Range 1d/7d/30d/90d, group_by agent/user.' },
  { area: 'Audit', method: 'GET', path: '/audit', note: 'Tenant-scoped audit timeline; run_id and chat_id are mutually exclusive.' },
]

function DeveloperDetailsTab() {
  return (
    <Flex direction="column" gap="4">
      <div className="card">
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">API endpoints</Text>
          <MockBadge kind="design" hint="Reference list — pulled from the gateway OpenAPI spec. Useful for engineers wiring custom integrations." />
        </div>
        <div className="card__body" style={{ padding: 0 }}>
          {DEV_ENDPOINTS.map((e, i) => (
            <div
              key={`${e.method}-${e.path}`}
              style={{
                padding: '12px 18px',
                display: 'grid',
                gridTemplateColumns: '120px 80px minmax(0, 1fr)',
                gap: 14,
                alignItems: 'start',
                borderBottom: i === DEV_ENDPOINTS.length - 1 ? 0 : '1px solid var(--gray-a3)',
              }}
            >
              <Text size="1" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {e.area}
              </Text>
              <Code variant="ghost" size="1">
                {e.method}
              </Code>
              <Box minWidth="0">
                <Code variant="soft" size="1" style={{ display: 'inline-block' }}>{e.path}</Code>
                <Text as="div" size="1" color="gray" mt="1" style={{ lineHeight: 1.5 }}>
                  {e.note}
                </Text>
              </Box>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">Raw identifiers</Text>
        </div>
        <div className="card__body">
          <Text as="div" size="2" color="gray" style={{ lineHeight: 1.6 }}>
            Internal IDs follow the pattern <Code variant="ghost">prefix_handle</Code>:
            <br />
            <Code variant="ghost" size="1">agt_*</Code> agent · <Code variant="ghost" size="1">ver_*</Code> setup version ·{' '}
            <Code variant="ghost" size="1">grt_*</Code> permission · <Code variant="ghost" size="1">apr_*</Code> approval ·{' '}
            <Code variant="ghost" size="1">cht_*</Code> chat · <Code variant="ghost" size="1">run_*</Code> activity ·{' '}
            <Code variant="ghost" size="1">tsk_*</Code> task · <Code variant="ghost" size="1">usr_*</Code> user.
          </Text>
          <Text as="div" size="2" color="gray" mt="3" style={{ lineHeight: 1.6 }}>
            UI surfaces translate these into human references via the <Code variant="ghost" size="1">shortRef()</Code> helper.
          </Text>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">Where to inspect raw config</Text>
        </div>
        <div className="card__body">
          <Text as="div" size="2" style={{ lineHeight: 1.6 }}>
            Open any agent → <strong>Advanced</strong> tab. There you'll see the full setup version, instruction brief, model chain, memory scope, tool scope, approval rules, and a policy snapshot.
          </Text>
        </div>
      </div>
    </Flex>
  )
}

// ────────────────────────────────────────────── Diagnostic mode tab
// Toggle that adds technical hints back into the main UI for engineers
// running a demo. Saved in localStorage; doesn't actually affect rendering
// in this build — kept as a placeholder per plan section 5 / 11.

const DIAGNOSTIC_KEY = 'proto.diagnostic.v1'

function readDiagnostic(): boolean {
  try { return localStorage.getItem(DIAGNOSTIC_KEY) === '1' } catch { return false }
}

function DiagnosticModeTab() {
  const [on, setOn] = useState<boolean>(() => readDiagnostic())

  const toggle = (next: boolean) => {
    setOn(next)
    try {
      if (next) localStorage.setItem(DIAGNOSTIC_KEY, '1')
      else localStorage.removeItem(DIAGNOSTIC_KEY)
    } catch { /* storage may be unavailable */ }
  }

  return (
    <Flex direction="column" gap="4">
      <div className="card">
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">Diagnostic mode</Text>
          <MockBadge kind="design" hint="Toggle is wired to localStorage but UI hints aren't yet rendered conditionally — placeholder for the engineer-demo mode in plan section 11." />
        </div>
        <div className="card__body">
          <Flex align="center" justify="between" gap="3" py="2">
            <Box flexGrow="1">
              <Text as="div" size="2" weight="medium">Show technical hints in the main UI</Text>
              <Text as="div" size="1" color="gray" mt="1" style={{ lineHeight: 1.55 }}>
                When on, the standard screens get extra inline hints with API endpoints, raw IDs, and internal step types — useful for engineers running a demo or debugging integration issues. End users normally keep this off.
              </Text>
            </Box>
            <Switch size="3" checked={on} onCheckedChange={toggle} />
          </Flex>
          {on && (
            <Box mt="3" p="3" style={{ background: 'var(--blue-a3)', borderRadius: 8 }}>
              <Text as="div" size="1" color="gray" style={{ lineHeight: 1.55 }}>
                Diagnostic mode is recorded in your browser. The conditional rendering of hints is planned for a follow-up build — for now this is a placeholder switch.
              </Text>
            </Box>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">Session</Text>
        </div>
        <div className="card__body">
          <DataList.Root size="2">
            <MetaRow label="diagnostic flag" value={on ? 'On' : 'Off'} />
            <MetaRow label="last toggle" value={ago(new Date().toISOString())} />
          </DataList.Root>
        </div>
      </div>
    </Flex>
  )
}
