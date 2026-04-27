import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Code, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader, Status, InfoHint, Pagination } from '../components/common'
import { TextInput } from '../components/fields'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconAgent, IconArrowRight, IconLock, IconPlus } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent, AgentStatus, User } from '../lib/types'
import { ago, domainLabel } from '../lib/format'

const STATUSES: Array<AgentStatus | 'all'> = ['all', 'active', 'paused', 'draft', 'archived']

export default function AgentsScreen() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [filter, setFilter] = useState<AgentStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const canCreate = user?.role === 'admin' || user?.role === 'domain_admin'

  useEffect(() => {
    let cancelled = false
    Promise.all([api.listAgents(), api.listUsers()])
      .then(([a, u]) => {
        if (cancelled) return
        setAgents(a.items)
        setUsers(u)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load agents')
      })
    return () => { cancelled = true }
  }, [reloadTick])

  const ownerName = (id: string | null) =>
    (id && users.find(u => u.id === id)?.name) || '—'

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

  const pageStart = page * pageSize
  const pageItems = filtered.slice(pageStart, pageStart + pageSize)

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              AGENTS{' '}
              <InfoHint>
                List from <Code variant="ghost">GET /agents</Code>. Each row is one agent record returned by the gateway.
              </InfoHint>
            </>
          }
          title={<>Your <em>fleet.</em></>}
          subtitle="Configure what agents are and what they may touch."
          actions={
            canCreate
              ? <Button asChild><a href="#/agents/new"><IconPlus />New agent</a></Button>
              : <Button variant="ghost" disabled title="Admins only"><IconLock />New agent</Button>
          }
        />

        <Flex align="center" gap="2" mb="4" wrap="wrap">
          <Flex align="center" gap="2">
            {STATUSES.map(f => {
              const isActive = filter === f
              return (
                <Button
                  key={f}
                  type="button"
                  size="2"
                  variant="soft"
                  color={isActive ? 'blue' : 'gray'}
                  onClick={() => { setFilter(f); setPage(0) }}
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
              onChange={e => { setQuery(e.target.value); setPage(0) }}
            />
          </Box>
        </Flex>

        {error ? (
          <ErrorState
            title="Couldn't load agents"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : !agents ? (
          <LoadingList rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconAgent />}
            title="No agents match these filters"
            action={canCreate ? { label: 'Create an agent', href: '/agents/new' } : undefined}
          />
        ) : (
          <div className="card card--table">
            <div className="table-head" style={{ gridTemplateColumns: 'minmax(0, 1fr) 120px 130px 160px 120px 32px' }}>
              <Text as="span" size="1" color="gray">name · description</Text>
              <Text as="span" size="1" color="gray">status</Text>
              <Text as="span" size="1" color="gray">active version</Text>
              <Text as="span" size="1" color="gray">owner · domain</Text>
              <Text as="span" size="1" color="gray">updated</Text>
              <span />
            </div>
            {pageItems.map(a => (
              <Link
                key={a.id}
                to={`/agents/${a.id}`}
                className="agent-row"
                style={{ gridTemplateColumns: 'minmax(0, 1fr) 120px 130px 160px 120px 32px' }}
              >
                <div style={{ minWidth: 0 }}>
                  <Text as="div" size="2">{a.name}</Text>
                  {a.description && (
                    <Text as="div" size="1" color="gray" mt="1" className="truncate">{a.description}</Text>
                  )}
                </div>
                <Status status={a.status} />
                <div>
                  {a.active_version ? (
                    <>
                      <Badge color="blue" variant="soft" radius="full" size="1">v{a.active_version.version}</Badge>
                      <Text as="div" size="1" color="gray" mt="1">
                        {(a.active_version.model_chain_config as { primary?: string })?.primary ?? '—'}
                      </Text>
                    </>
                  ) : (
                    <Badge color="gray" variant="outline" radius="full" size="1">no active version</Badge>
                  )}
                </div>
                <div>
                  <Text as="div" size="1">
                    {ownerName(a.owner_user_id)}
                  </Text>
                  <Text as="div" size="1" color="gray" mt="1">
                    {domainLabel(a.domain_id)}
                  </Text>
                </div>
                <Text as="div" size="1" color="gray">
                  {ago(a.updated_at)}
                </Text>
                <IconArrowRight className="ic" />
              </Link>
            ))}
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={n => { setPageSize(n); setPage(0) }}
              label="agents"
            />
          </div>
        )}

      </div>
    </AppShell>
  )
}
