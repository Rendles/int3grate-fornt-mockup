import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Code, Dialog, Flex, Grid, Text, TextField, VisuallyHidden } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Avatar, Caption, PageHeader, Status, WorkspaceContextPill, WorkspaceFilter } from '../components/common'
import { TextInput } from '../components/fields'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconAgent, IconArrowRight, IconChat, IconLock, IconPlus, IconSearch } from '../components/icons'
import { QuickHireGrid } from '../components/quick-hire-grid'
import { WelcomeChatFlow } from '../components/welcome-chat-flow'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import { AGENT_STATUS_FILTERS } from '../lib/filters'
import type { AgentStatusFilter } from '../lib/filters'
import type { Agent, RunListItem } from '../lib/types'
import { ago } from '../lib/format'
import { shouldShowWorkspacePill, useScopeFilter } from '../lib/scope-filter'

export default function AgentsScreen() {
  const { user, myWorkspaces } = useAuth()
  const { filter: workspaceFilter } = useScopeFilter()
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [runs, setRuns] = useState<RunListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [filter, setFilter] = useState<AgentStatusFilter>('all')
  const [query, setQuery] = useState('')
  // Hire dialog — opened from PageHeader button or in-grid HireTile.
  // Hosts <WelcomeChatFlow variant="compact"> and refreshes the agents
  // list whenever it closes (so a freshly hired agent appears without
  // a manual reload).
  const [hireOpen, setHireOpen] = useState(false)

  const canCreate = user?.role === 'admin' || user?.role === 'domain_admin'

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.listAgents({ workspace_ids: workspaceFilter }),
      api.listRuns({ limit: 100, workspace_ids: workspaceFilter }),
    ])
      .then(([a, r]) => {
        if (cancelled) return
        setAgents(a.items)
        setRuns(r.items)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load your agents')
      })
    return () => { cancelled = true }
  }, [reloadTick, workspaceFilter])

  // agent_id → most-recent run timestamp. Lets us show "last seen 2h ago".
  const lastRunByAgent = useMemo(() => {
    const m = new Map<string, RunListItem>()
    for (const r of runs) {
      if (!r.agent_id) continue
      const prev = m.get(r.agent_id)
      if (!prev || r.created_at > prev.created_at) m.set(r.agent_id, r)
    }
    return m
  }, [runs])

  const filtered = useMemo(() => {
    if (!agents) return []
    return agents.filter(a => {
      if (filter !== 'all' && a.status !== filter) return false
      if (query) {
        const q = query.toLowerCase()
        if (!(a.name.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [agents, filter, query])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: agents?.length ?? 0 }
    ;(agents ?? []).forEach(a => { c[a.status] = (c[a.status] ?? 0) + 1 })
    return c
  }, [agents])

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow="TEAM"
          title={<>Your <em>team.</em></>}
          subtitle="Configure your agents and what apps they can use."
          actions={
            canCreate
              ? <Button onClick={() => setHireOpen(true)}><IconPlus />Hire an agent</Button>
              : <Button variant="ghost" disabled title="Admins only"><IconLock />Hire an agent</Button>
          }
        />

        <Flex direction="column" gap="2" mb="4">
          <WorkspaceFilter />
          {agents && agents.length > 0 && (
            <Flex align="center" gap="2" wrap="wrap">
              <Flex align="center" gap="2">
                {AGENT_STATUS_FILTERS.map(f => {
                  const isActive = filter === f
                  return (
                    <Button
                      key={f}
                      type="button"
                      size="2"
                      variant="soft"
                      color={isActive ? 'cyan' : 'gray'}
                      onClick={() => { setFilter(f) }}
                    >
                      <span style={{ textTransform: 'capitalize' }}>{f}</span>
                      <Code variant="ghost" size="1" color="gray">{counts[f] ?? 0}</Code>
                    </Button>
                  )
                })}
              </Flex>
              <Box flexGrow="1" />
              <Box width="260px">
                <TextInput
                  size="2"
                  placeholder="Filter by name or description..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                >
                  <TextField.Slot side="left">
                    <IconSearch className="ic ic--sm" />
                  </TextField.Slot>
                </TextInput>
              </Box>
            </Flex>
          )}
        </Flex>

        {error ? (
          <ErrorState
            title="Couldn't load your agents"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : !agents ? (
          <LoadingList rows={6} />
        ) : agents.length === 0 ? (
          canCreate ? (
            <Box mt="2">
              <Caption>Pick a starter template</Caption>
              <Text as="div" size="2" color="gray" mt="1" mb="3">
                Hire your first agent in two clicks. You can rename, retrain, or fire later.
              </Text>
              <QuickHireGrid mode="embedded" />
            </Box>
          ) : (
            <EmptyState
              icon={<IconAgent />}
              title="No agents yet"
              body="Ask a workspace admin to hire your first agent."
            />
          )
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconAgent />}
            title="No agents match these filters"
            body="Try a different status filter or clear the search."
          />
        ) : (
          <Grid columns={{ initial: '1', sm: '2', lg: '3' }} gap="3">
            {filtered.map(a => (
              <AssistantCard
                key={a.id}
                agent={a}
                lastRun={lastRunByAgent.get(a.id) ?? null}
                showWorkspacePill={shouldShowWorkspacePill(workspaceFilter, myWorkspaces.length)}
              />
            ))}
            {canCreate && filter === 'all' && !query && (
              <HireTile onClick={() => setHireOpen(true)} />
            )}
          </Grid>
        )}

      </div>

      {/* Hire dialog — same chat-style flow as the welcome onboarding
          but in compact variant (skips the welcome pitch). On close we
          refresh the agents list so a freshly hired agent appears
          immediately. */}
      <Dialog.Root
        open={hireOpen}
        onOpenChange={(open) => {
          setHireOpen(open)
          if (!open) setReloadTick(t => t + 1)
        }}
      >
        <Dialog.Content
          size="2"
          maxWidth="780px"
          style={{ padding: 0 }}
          // Prevent the focus trap from auto-focusing the first
          // chip on open — that would trigger its HoverCard preview
          // (focus = open) and the preview wouldn't dismiss until the
          // user manually hovers it.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Re-apply .prototype-root inside the portal so our scoped
              styles (welcome-*, .ic, button resets, theme tokens) match
              what the WelcomeChatFlow looks like everywhere else. The
              page-background + min-height that .prototype-root normally
              brings would fight the dialog overlay, so we override them
              inline. */}
          <div
            className="prototype-root"
            style={{ minHeight: 'auto', background: 'transparent' }}
          >
            <VisuallyHidden>
              <Dialog.Title>Hire a new agent</Dialog.Title>
              <Dialog.Description>
                Pick a role from the picker, customise it if you'd like,
                and hire to add to your team.
              </Dialog.Description>
            </VisuallyHidden>
            <WelcomeChatFlow
              variant="compact"
              onClose={() => setHireOpen(false)}
            />
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </AppShell>
  )
}

function AssistantCard({
  agent,
  lastRun,
  showWorkspacePill,
}: {
  agent: Agent
  lastRun: RunListItem | null
  showWorkspacePill: boolean
}) {
  const canTalk = agent.status === 'active' && agent.active_version != null
  return (
    <div
      className="card"
      data-tour="team-agent-card"
      style={{ padding: 16, gap: 12, display: 'flex', flexDirection: 'column' }}
    >
      <Flex align="center" gap="3" minWidth="0">
        <Avatar initials={agent.name.slice(0, 2).toUpperCase()} size={36} />
        <Box minWidth="0" flexGrow="1">
          <Text as="div" size="3" weight="medium" className="truncate">{agent.name}</Text>
          {agent.description && (
            <Text as="div" size="1" color="gray" mt="1" className="truncate">
              {agent.description}
            </Text>
          )}
        </Box>
      </Flex>

      <Flex align="center" justify="between" gap="2" wrap="wrap">
        <Flex align="center" gap="2" wrap="wrap">
          <Status status={agent.status} />
          <WorkspaceContextPill agentId={agent.id} show={showWorkspacePill} />
        </Flex>
        <Text size="1" color="gray">
          {lastRun ? `last active ${ago(lastRun.created_at)}` : 'no activity yet'}
        </Text>
      </Flex>

      <Flex gap="2" mt="2">
        <Button asChild size="2" variant="soft" disabled={!canTalk} style={{ flex: 1 }}>
          <a href={canTalk ? `#/agents/${agent.id}/talk` : undefined}>
            <IconChat />
            Talk to
          </a>
        </Button>
        <Button asChild size="2" variant="soft" color="gray" style={{ flex: 1 }}>
          <a href={`#/agents/${agent.id}`}>
            <IconArrowRight className="ic ic--sm" />
            Manage
          </a>
        </Button>
      </Flex>
    </div>
  )
}

function HireTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card card--tile"
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 160,
        gap: 8,
        color: 'var(--accent-11)',
        border: '1px dashed var(--gray-7)',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'center',
      }}
    >
      <IconPlus />
      <Text size="2" weight="medium">Hire a new agent</Text>
      <Text size="1" color="gray">Pick a role and configure access</Text>
    </button>
  )
}
