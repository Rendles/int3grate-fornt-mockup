import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status, Sparkbar, Avatar } from '../components/common'
import { EmptyState, LoadingList } from '../components/states'
import { IconAgent, IconArrowRight, IconFilter, IconLock, IconPlay, IconPlus } from '../components/icons'
import { Link, useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import { allUsers, agentVersions as fxVersions } from '../lib/fixtures'
import type { Agent, AgentStatus, User } from '../lib/types'
import { ago, money, num, pct } from '../lib/format'

const STATUSES: Array<AgentStatus | 'all'> = ['all', 'active', 'paused', 'draft', 'archived']

export default function AgentsScreen() {
  const { user } = useAuth()
  const { navigate } = useRouter()
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [filter, setFilter] = useState<AgentStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const users = useMemo(() => allUsers(), [])

  const canCreate = user?.role === 'admin' || user?.role === 'domain_admin'

  useEffect(() => {
    api.listAgents().then(setAgents)
  }, [])

  const filtered = useMemo(() => {
    if (!agents) return []
    return agents.filter(a => {
      if (filter !== 'all' && a.status !== filter) return false
      if (query) {
        const q = query.toLowerCase()
        if (!(a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))) return false
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
    <AppShell crumbs={[{ label: 'app', to: '/' }, { label: 'agents' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow="AGENTS"
          title={<>Your <em>fleet.</em></>}
          subtitle="Each agent is an operator you configure: its role, the tools it may touch, and whose permission it needs to take action."
          actions={
            <>
              <Btn variant="ghost" icon={<IconFilter />}>Filters</Btn>
              {canCreate ? (
                <Btn variant="primary" href="/agents/new" icon={<IconPlus />}>New agent</Btn>
              ) : (
                <Btn variant="ghost" disabled icon={<IconLock />} title="Admins only">New agent</Btn>
              )}
            </>
          }
        />

        <div className="row" style={{ gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="row row--sm">
            {STATUSES.map(f => (
              <button
                key={f}
                className={`chip${filter === f ? ' chip--accent' : ''}`}
                onClick={() => setFilter(f)}
                style={{ cursor: 'pointer' }}
              >
                {f}
                <span className="mono" style={{ color: 'var(--text-dim)' }}>{counts[f] ?? 0}</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <input
            className="input"
            style={{ width: 260, padding: '6px 10px', fontSize: 12 }}
            placeholder="Search by name or description..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {!agents ? (
          <LoadingList rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconAgent />}
            title="No agents match these filters"
            body="Either loosen the filter set, or spin up a new agent from a template to get moving."
            action={canCreate ? { label: 'Create an agent', href: '/agents/new' } : undefined}
          />
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '40px minmax(0, 1fr) 110px 140px 130px 120px 90px',
              gap: 14, padding: '10px 16px', background: 'var(--surface-2)',
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)',
              textTransform: 'uppercase', letterSpacing: '0.14em',
              borderBottom: '1px solid var(--border)',
            }}>
              <span />
              <span>agent · version · model</span>
              <span>status · 7d ok</span>
              <span>owner</span>
              <span>spend · month</span>
              <span>grants</span>
              <span>actions</span>
            </div>
            {filtered.map(a => {
              const owner = users.find(u => u.id === a.owner_user_id)
              const activeVer = fxVersions.find(v => v.id === a.active_version)
              const grantBreakdown = null // we show summary as chips below
              void grantBreakdown
              return (
                <AgentRow
                  key={a.id}
                  agent={a}
                  owner={owner}
                  versionLabel={activeVer ? `v${activeVer.version_number}` : undefined}
                  model={activeVer?.model_chain_config.primary}
                  canManagePermissions={!!canCreate}
                  onManagePermissions={() => navigate(`/agents/${a.id}/grants`)}
                  onStartTask={() => navigate(`/tasks/new?agent=${a.id}`)}
                />
              )
            })}
          </div>
        )}

        <div style={{ height: 20 }} />
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'right' }}>
          endpoint · <span className="accent">GET /agents</span>
          {' · '}
          no <span className="warn">PATCH</span> / <span className="warn">DELETE</span> /agents yet — editing and archival are disabled
        </div>
      </div>
    </AppShell>
  )
}

function AgentRow({
  agent, owner, versionLabel, model, canManagePermissions, onManagePermissions, onStartTask,
}: {
  agent: Agent
  owner: User | undefined
  versionLabel?: string
  model?: string
  canManagePermissions: boolean
  onManagePermissions: () => void
  onStartTask: () => void
}) {
  const canRun = agent.status === 'active'
  return (
    <Link
      to={`/agents/${agent.id}`}
      className="agent-row"
      style={{ gridTemplateColumns: '40px minmax(0, 1fr) 110px 140px 130px 120px 90px' }}
    >
      <div className="agent-row__avatar" style={{ color: `var(--${agent.tone ?? 'accent'})` }}>
        {agent.glyph ?? agent.name.slice(0, 2).toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="agent-row__name">
          <span>{agent.name}</span>
          {agent.owner_team && <Chip>{agent.owner_team}</Chip>}
        </div>
        <div className="agent-row__desc">{agent.description}</div>
        <div className="row row--sm" style={{ marginTop: 6 }}>
          {versionLabel ? (
            <Chip tone="accent">{versionLabel}</Chip>
          ) : (
            <Chip tone="ghost">no active version</Chip>
          )}
          {model && <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{model}</span>}
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>updated {ago(agent.updated_at)}</span>
        </div>
      </div>
      <div>
        <Status status={agent.status} />
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>
          {num(agent.runs_7d ?? 0)} runs · {Math.round((agent.success_rate_7d ?? 0) * 100)}%
        </div>
      </div>
      <OwnerCell owner={owner} />
      <div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>
          {money(agent.monthly_spend_usd ?? 0, { cents: (agent.monthly_spend_usd ?? 0) < 100 })}
        </div>
        {agent.monthly_spend_cap_usd && (
          <>
            <div className="spend-row__bar-track" style={{ marginTop: 4 }}>
              <div className="spend-row__bar-fill" style={{ width: `${Math.min(100, ((agent.monthly_spend_usd ?? 0) / agent.monthly_spend_cap_usd) * 100)}%` }} />
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
              {pct(((agent.monthly_spend_usd ?? 0) / agent.monthly_spend_cap_usd) * 100 - 100, 0)} to cap
            </div>
          </>
        )}
      </div>
      <div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>
          {agent.tools_granted ?? 0} total
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--warn)', marginTop: 3 }}>
          {agent.tools_requiring_approval ?? 0} gated
        </div>
        <Sparkbar
          values={(agent.runs_7d ?? 0) > 0 ? [5, 8, 6, 9, 12, 11, 14].map(n => n * ((agent.runs_7d ?? 0) / 40)) : [0, 0, 0, 0, 0, 0, 0]}
          accent={agent.status === 'active'}
          height={18}
        />
      </div>
      <div className="row row--sm" style={{ justifyContent: 'flex-end' }}>
        <RowAction
          title={canRun ? 'Start task' : 'Agent not active'}
          disabled={!canRun}
          onClick={onStartTask}
          icon={<IconPlay />}
        />
        <RowAction
          title={canManagePermissions ? 'Manage permissions' : 'Admins only'}
          disabled={!canManagePermissions}
          onClick={onManagePermissions}
          icon={canManagePermissions ? <IconLock /> : <IconLock />}
        />
        <IconArrowRight className="ic" />
      </div>
    </Link>
  )
}

function RowAction({
  title, disabled, onClick, icon,
}: {
  title: string
  disabled?: boolean
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      className="tb__action"
      title={title}
      disabled={disabled}
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) onClick()
      }}
      style={{
        padding: '4px 6px',
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {icon}
    </button>
  )
}

function OwnerCell({ owner }: { owner: User | undefined }) {
  if (!owner) {
    return <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>—</span>
  }
  return (
    <div className="row row--sm">
      <Avatar initials={owner.initials ?? owner.name.slice(0, 2).toUpperCase()} tone={owner.avatar_tone ?? 'accent'} size={22} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text)' }} className="truncate">{owner.name}</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>L{owner.approval_level} · {owner.role.replace('_', ' ')}</div>
      </div>
    </div>
  )
}
