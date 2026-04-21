import { useEffect, useMemo, useState } from 'react'
import { Code } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status, InfoHint, Pagination } from '../components/common'
import { TextInput } from '../components/fields'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconAgent, IconArrowRight, IconLock, IconPlus } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent, AgentStatus } from '../lib/types'
import { ago } from '../lib/format'

const STATUSES: Array<AgentStatus | 'all'> = ['all', 'active', 'paused', 'draft', 'archived']

export default function AgentsScreen() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [filter, setFilter] = useState<AgentStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const canCreate = user?.role === 'admin' || user?.role === 'domain_admin'

  useEffect(() => {
    let cancelled = false
    api.listAgents()
      .then(a => {
        if (cancelled) return
        setAgents(a)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load agents')
      })
    return () => { cancelled = true }
  }, [reloadTick])

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
              ? <Btn variant="primary" href="/agents/new" icon={<IconPlus />}>New agent</Btn>
              : <Btn variant="ghost" disabled icon={<IconLock />} title="Admins only">New agent</Btn>
          }
        />

        <div className="row" style={{ gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="row row--sm">
            {STATUSES.map(f => (
              <button
                key={f}
                className={`chip${filter === f ? ' chip--accent' : ''}`}
                onClick={() => { setFilter(f); setPage(0) }}
                style={{ cursor: 'pointer' }}
              >
                {f}
                <Code variant="ghost" style={{ color: 'var(--gray-10)' }}>{counts[f] ?? 0}</Code>
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ width: 260 }}>
            <TextInput
              size="1"
              placeholder="Filter by name or description..."
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(0) }}
            />
          </div>
        </div>

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
          <div className="card" style={{ padding: 0 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 120px 130px 160px 120px 32px',
              gap: 14, padding: '10px 16px', background: 'var(--gray-3)',
              fontFamily: 'var(--code-font-family)', fontSize: 10, color: 'var(--gray-10)',
              textTransform: 'uppercase', letterSpacing: '0.14em',
              borderBottom: '1px solid var(--gray-6)',
            }}>
              <span>name · description</span>
              <span>status</span>
              <span>active version</span>
              <span>owner · domain</span>
              <span>updated</span>
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
                  <div style={{ fontSize: 13.5, color: 'var(--gray-12)' }}>{a.name}</div>
                  {a.description && (
                    <div className="agent-row__desc truncate" style={{ marginTop: 2 }}>{a.description}</div>
                  )}
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 4 }}>
                    {a.id}
                  </div>
                </div>
                <Status status={a.status} />
                <div>
                  {a.active_version ? (
                    <>
                      <Chip tone="accent">v{a.active_version.version}</Chip>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 4 }}>
                        {(a.active_version.model_chain_config as { primary?: string })?.primary ?? '—'}
                      </div>
                    </>
                  ) : (
                    <Chip tone="ghost">no active version</Chip>
                  )}
                </div>
                <div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--gray-12)' }}>
                    {a.owner_user_id ?? '—'}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 4 }}>
                    {a.domain_id ?? '—'}
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--gray-11)' }}>
                  {ago(a.updated_at)}
                </div>
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
