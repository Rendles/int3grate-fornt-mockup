import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Code, Flex, Grid, Text, TextField } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Avatar, PageHeader, Status } from '../components/common'
import { TextInput } from '../components/fields'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconAgent, IconArrowRight, IconChat, IconLock, IconPlus, IconSearch } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import { AGENT_STATUS_FILTERS } from '../lib/filters'
import type { AgentStatusFilter } from '../lib/filters'
import type { Agent, RunListItem } from '../lib/types'
import { ago } from '../lib/format'

export default function AgentsScreen() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [runs, setRuns] = useState<RunListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [filter, setFilter] = useState<AgentStatusFilter>('all')
  const [query, setQuery] = useState('')

  const canCreate = user?.role === 'admin' || user?.role === 'domain_admin'

  useEffect(() => {
    let cancelled = false
    Promise.all([api.listAgents(), api.listRuns({ limit: 100 })])
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
  }, [reloadTick])

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
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'team' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow="TEAM"
          title={<>Your <em>team.</em></>}
          subtitle="Configure your agents and what apps they can use."
          actions={
            canCreate
              ? <Button asChild><a href="#/agents/new"><IconPlus />Hire an agent</a></Button>
              : <Button variant="ghost" disabled title="Admins only"><IconLock />Hire an agent</Button>
          }
        />

        <Flex align="center" gap="2" mb="4" wrap="wrap">
          <Flex align="center" gap="2">
            {AGENT_STATUS_FILTERS.map(f => {
              const isActive = filter === f
              return (
                <Button
                  key={f}
                  type="button"
                  size="2"
                  variant="soft"
                  color={isActive ? 'blue' : 'gray'}
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

        {error ? (
          <ErrorState
            title="Couldn't load your agents"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : !agents ? (
          <LoadingList rows={6} />
        ) : agents.length === 0 ? (
          <EmptyState
            icon={<IconAgent />}
            title="No agents yet"
            body="Hire your first agent and give it a role, instructions, and access to apps."
            action={canCreate ? { label: 'Hire an agent', href: '/agents/new' } : undefined}
          />
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
              />
            ))}
            {canCreate && filter === 'all' && !query && (
              <HireTile />
            )}
          </Grid>
        )}

      </div>
    </AppShell>
  )
}

function AssistantCard({ agent, lastRun }: { agent: Agent; lastRun: RunListItem | null }) {
  const canTalk = agent.status === 'active' && agent.active_version != null
  return (
    <div
      className="card"
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

      <Flex align="center" justify="between" gap="2">
        <Status status={agent.status} />
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

function HireTile() {
  return (
    <Link
      to="/agents/new"
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
      }}
    >
      <IconPlus />
      <Text size="2" weight="medium">Hire a new agent</Text>
      <Text size="1" color="gray">Pick a role and configure access</Text>
    </Link>
  )
}
