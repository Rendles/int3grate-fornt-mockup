import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Code, Dialog, Flex, Grid, Text, TextField } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Avatar, Caption, MockBadge, PageHeader } from '../components/common'
import { TextInput } from '../components/fields'
import { Banner, EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconArrowRight, IconCheck, IconPlus, IconSearch, IconTool } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import { appLabel, appPrefix, policyModeLabel, toolLabel } from '../lib/format'
import type { Agent, ToolDefinition, ToolGrant } from '../lib/types'

type ConnectionFilter = 'all' | 'connected' | 'not_connected'

interface AppCard {
  prefix: string
  name: string
  tools: ToolDefinition[]
  // Agents that have any grant on a tool of this app.
  usedBy: Array<{ agent: Agent; grants: ToolGrant[] }>
}

export default function ToolsScreen() {
  const { user } = useAuth()
  const canConnect = !!user && (user.role === 'admin' || user.role === 'domain_admin')
  const [tools, setTools] = useState<ToolDefinition[] | null>(null)
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [grantsByAgent, setGrantsByAgent] = useState<Record<string, ToolGrant[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ConnectionFilter>('all')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [t, a] = await Promise.all([api.listTools(), api.listAgents()])
        if (cancelled) return
        const all = await Promise.all(
          a.items.map(ag => api.getGrants(ag.id).then(g => [ag.id, g] as const)),
        )
        if (cancelled) return
        const map: Record<string, ToolGrant[]> = {}
        for (const [id, g] of all) map[id] = g
        setTools(t)
        setAgents(a.items)
        setGrantsByAgent(map)
        setError(null)
      } catch (e) {
        if (!cancelled) setError((e as Error).message ?? 'Failed to load apps')
      }
    }
    run()
    return () => { cancelled = true }
  }, [reloadTick])

  const apps = useMemo<AppCard[]>(() => {
    if (!tools || !agents) return []
    const groups = new Map<string, ToolDefinition[]>()
    for (const t of tools) {
      const p = appPrefix(t.name)
      const existing = groups.get(p) ?? []
      existing.push(t)
      groups.set(p, existing)
    }
    const out: AppCard[] = []
    for (const [prefix, list] of groups) {
      const usedBy: Array<{ agent: Agent; grants: ToolGrant[] }> = []
      for (const ag of agents) {
        const matches = (grantsByAgent[ag.id] ?? []).filter(g => appPrefix(g.tool_name) === prefix)
        if (matches.length > 0) usedBy.push({ agent: ag, grants: matches })
      }
      out.push({
        prefix,
        name: appLabel(prefix),
        tools: list.sort((a, b) => a.name.localeCompare(b.name)),
        usedBy,
      })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }, [tools, agents, grantsByAgent])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return apps.filter(app => {
      if (filter === 'connected' && app.usedBy.length === 0) return false
      if (filter === 'not_connected' && app.usedBy.length > 0) return false
      if (!q) return true
      return app.name.toLowerCase().includes(q)
        || app.tools.some(t => t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q))
    })
  }, [apps, query, filter])

  const counts = useMemo(() => ({
    all: apps.length,
    connected: apps.filter(a => a.usedBy.length > 0).length,
    not_connected: apps.filter(a => a.usedBy.length === 0).length,
  }), [apps])

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'apps' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              APPS{' '}
              <MockBadge kind="design" hint="Connected / Not connected status is derived client-side from existing agent permissions. Real OAuth state needs an integration registry on the backend, which isn't in the spec yet." />
            </>
          }
          title={<>Connected <em>apps.</em></>}
          subtitle="Services your agents can use. Reading is usually safe. Writing changes data and can require your approval."
        />

        {error ? (
          <ErrorState
            title="Couldn't load apps"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : !tools || !agents ? (
          <LoadingList rows={6} />
        ) : (
          <>
            <Flex align="center" gap="2" mb="4" wrap="wrap">
              <Flex align="center" gap="2" wrap="wrap">
                <Caption mr="1">filter</Caption>
                {([
                  { key: 'all', label: 'All', count: counts.all },
                  { key: 'connected', label: 'Connected', count: counts.connected },
                  { key: 'not_connected', label: 'Not connected', count: counts.not_connected },
                ] as const).map(b => {
                  const isActive = filter === b.key
                  return (
                    <Button
                      key={b.key}
                      type="button"
                      size="2"
                      variant="soft"
                      color={isActive ? 'blue' : 'gray'}
                      onClick={() => setFilter(b.key)}
                    >
                      <span>{b.label}</span>
                      <Code variant="ghost" size="1" color="gray">{b.count}</Code>
                    </Button>
                  )
                })}
              </Flex>
              <Box flexGrow="1" />
              <Box width="260px">
                <TextInput
                  size="2"
                  placeholder="Filter apps…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                >
                  <TextField.Slot side="left">
                    <IconSearch className="ic ic--sm" />
                  </TextField.Slot>
                </TextInput>
              </Box>
            </Flex>

            {filtered.length === 0 ? (
              <EmptyState
                icon={<IconTool />}
                title="No apps match these filters"
                body="Try clearing your search or selecting a different filter."
              />
            ) : (
              <Grid columns={{ initial: '1', sm: '2', lg: '3' }} gap="3">
                {canConnect && filter !== 'connected' && <ConnectAppTile />}
                {filtered.map(app => <AppTile key={app.prefix} app={app} />)}
              </Grid>
            )}

            <Box mt="5">
              <Banner tone="info" title="Apps are connected through agent permissions">
                An app shows as Connected when at least one agent has permission to use it.
                Open the agent's Permissions tab to grant or revoke access.
              </Banner>
            </Box>
          </>
        )}
      </div>
    </AppShell>
  )
}

function AppTile({ app }: { app: AppCard }) {
  const connected = app.usedBy.length > 0
  const writeCount = app.tools.filter(t => t.default_mode !== 'read_only' && t.default_mode !== 'denied').length
  const approvalCount = app.tools.filter(t => t.default_mode === 'requires_approval').length

  // Default policy summary: if every tool has the same default, show that
  // single label. Otherwise show "mixed" — the per-app default isn't a single
  // verdict and the user has to expand to see per-tool detail.
  const uniqueDefaults = new Set(app.tools.map(t => t.default_mode))
  const defaultSummary = uniqueDefaults.size === 1
    ? policyModeLabel([...uniqueDefaults][0]!)
    : 'mixed'

  return (
    <div className="card" style={{ padding: 16, gap: 12, display: 'flex', flexDirection: 'column' }}>
      <Flex align="center" gap="3">
        <Avatar initials={app.name.slice(0, 2).toUpperCase()} size={36} />
        <Box minWidth="0" flexGrow="1">
          <Text as="div" size="3" weight="medium" className="truncate">{app.name}</Text>
          <Text as="div" size="1" color="gray" mt="1">
            {app.tools.length === 1 ? '1 tool' : `${app.tools.length} tools`} · default {defaultSummary}
          </Text>
        </Box>
      </Flex>

      <Flex align="center" gap="2" wrap="wrap">
        {connected ? (
          <Badge color="green" variant="soft" radius="full" size="1">Connected</Badge>
        ) : (
          <Badge color="gray" variant="outline" radius="full" size="1">Not connected</Badge>
        )}
        {writeCount > 0 && (
          <Badge color="amber" variant="soft" radius="full" size="1">
            {writeCount} write {writeCount === 1 ? 'tool' : 'tools'}
          </Badge>
        )}
        {approvalCount > 0 && (
          <Badge color="amber" variant="outline" radius="full" size="1">
            {approvalCount} need approval
          </Badge>
        )}
      </Flex>

      <Box>
        <Text as="div" size="1" color="gray" mb="1" style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {connected ? 'Used by' : 'Available'}
        </Text>
        {connected ? (
          <Flex direction="column" gap="1">
            {app.usedBy.slice(0, 3).map(({ agent, grants }) => (
              <Flex key={agent.id} align="center" justify="between" gap="2">
                <Link to={`/agents/${agent.id}/grants`} style={{ minWidth: 0 }}>
                  <Text as="span" size="2" className="truncate">{agent.name}</Text>
                </Link>
                <Text as="span" size="1" color="gray">
                  {grants.length === 1 ? '1 permission' : `${grants.length} permissions`}
                </Text>
              </Flex>
            ))}
            {app.usedBy.length > 3 && (
              <Text size="1" color="gray">+{app.usedBy.length - 3} more</Text>
            )}
          </Flex>
        ) : (
          <Text size="2" color="gray">No agent has permission to use {app.name} yet.</Text>
        )}
      </Box>

      <details>
        <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
          <Flex align="center" gap="2">
            <Text as="span" size="1" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              What this app can do
            </Text>
            <IconArrowRight className="ic ic--sm" />
          </Flex>
        </summary>
        <Box mt="2">
          <Flex direction="column" gap="1">
            {app.tools.map(t => (
              <Flex key={t.name} align="center" justify="between" gap="2">
                <Text as="span" size="2">{toolLabel(t.name)}</Text>
                <Badge
                  color={t.default_mode === 'read_only' ? 'cyan' : t.default_mode === 'requires_approval' ? 'amber' : 'red'}
                  variant="soft"
                  radius="small"
                  size="1"
                >
                  {policyModeLabel(t.default_mode)}
                </Badge>
              </Flex>
            ))}
          </Flex>
        </Box>
      </details>
    </div>
  )
}

// ──────────────────────────────────────────── Connect new app tile + modal
// Plan section 7.6 / 11.3: a CTA tile on the Apps page so users have an
// obvious place to start an app connection. The actual OAuth flow needs a
// backend integration registry which the gateway spec doesn't expose yet,
// so this is a placeholder modal — clicking Authorize on a service shows
// "connection placeholder" message rather than wiring real credentials.

const SUGGESTED_SERVICES = [
  { id: 'gmail', name: 'Gmail', description: 'Send and read email on your behalf.' },
  { id: 'google_sheets', name: 'Google Sheets', description: 'Read and update spreadsheets.' },
  { id: 'hubspot', name: 'HubSpot', description: 'Read contacts, update deals.' },
  { id: 'pipedrive', name: 'Pipedrive', description: 'CRM contacts and pipeline.' },
  { id: 'notion', name: 'Notion', description: 'Read and update pages.' },
  { id: 'github', name: 'GitHub', description: 'Read repos, file issues, comment on PRs.' },
] as const

function ConnectAppTile() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="card card--tile"
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 200,
          color: 'var(--accent-11)',
          border: '1px dashed var(--gray-7)',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        <IconPlus />
        <Text size="2" weight="medium">Connect a new app</Text>
        <Text size="1" color="gray" style={{ textAlign: 'center', maxWidth: 200, lineHeight: 1.5 }}>
          Pick a service to grant access to your agents.
        </Text>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content maxWidth="520px">
          <Dialog.Title>
            <Flex align="center" gap="2">
              Connect a new app <MockBadge kind="design" hint="Real OAuth wiring is pending — gateway integration registry isn't in the spec yet. This dialog walks through the placeholder flow." />
            </Flex>
          </Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            Pick the service you want your agents to use. We'll send you to the service to authorise access.
          </Dialog.Description>
          <ConnectServiceList onClose={() => setOpen(false)} />
          <Flex justify="end" gap="2" mt="3">
            <Dialog.Close>
              <Button variant="soft" color="gray">Done</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}

function ConnectServiceList({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [authorised, setAuthorised] = useState<string | null>(null)

  const authorise = (id: string) => {
    setBusy(id)
    setAuthorised(null)
    setTimeout(() => {
      setBusy(null)
      setAuthorised(id)
    }, 1500)
  }

  void onClose // not auto-closing — user clicks Done to close
  return (
    <Flex direction="column" gap="2">
      {SUGGESTED_SERVICES.map(s => {
        const isBusy = busy === s.id
        const isAuthorised = authorised === s.id
        return (
          <Flex
            key={s.id}
            align="center"
            gap="3"
            p="3"
            style={{
              border: '1px solid var(--gray-a3)',
              borderRadius: 8,
              background: isAuthorised ? 'var(--green-a2)' : 'transparent',
            }}
          >
            <Avatar initials={s.name.slice(0, 2).toUpperCase()} size={28} />
            <Box flexGrow="1" minWidth="0">
              <Text as="div" size="2" weight="medium">{s.name}</Text>
              <Text as="div" size="1" color="gray" mt="1">{s.description}</Text>
            </Box>
            {isAuthorised ? (
              <Badge color="green" variant="soft" radius="full" size="1">
                <IconCheck className="ic ic--sm" /> Placeholder OK
              </Badge>
            ) : (
              <Button size="1" variant="soft" disabled={isBusy} onClick={() => authorise(s.id)}>
                {isBusy ? 'Authorising…' : 'Authorise'}
              </Button>
            )}
          </Flex>
        )
      })}
      {authorised && (
        <Box mt="2" p="3" style={{ background: 'var(--blue-a3)', borderRadius: 8 }}>
          <Text as="div" size="1" style={{ lineHeight: 1.5 }}>
            <strong>Connection placeholder.</strong> The real OAuth flow is pending — once the backend integration registry ships, this dialog will redirect you to the service's consent page and persist the credentials.
          </Text>
        </Box>
      )}
    </Flex>
  )
}
