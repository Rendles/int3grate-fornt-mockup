import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status, Tabs, Sparkbar, CommandBar, Avatar, MockBadge, BackendGapBanner } from '../components/common'
import { Banner, LoadingList, NoAccessState } from '../components/states'
import {
  IconAgent, IconArrowRight, IconPlay, IconPlus, IconClock, IconLock, IconChat, IconTask, IconRoute,
} from '../components/icons'
import { GrantsEditor } from '../components/grants-editor'
import { api } from '../lib/api'
import { useAuth } from '../auth'
import { Link } from '../router'
import type { Agent, AgentVersion, SpendRow, Task, TaskType, ToolGrant, User } from '../lib/types'
import { ago, money, num, absTime, modeLabel, toolDisplay } from '../lib/format'
import { allUsers } from '../lib/fixtures'

export default function AgentDetailScreen({
  agentId,
  tab,
}: {
  agentId: string
  tab: 'overview' | 'versions' | 'grants' | 'settings'
}) {
  const { user } = useAuth()
  const [agent, setAgent] = useState<Agent | null | undefined>(undefined)
  const [versions, setVersions] = useState<AgentVersion[] | null>(null)
  const [grants, setGrants] = useState<ToolGrant[] | null>(null)
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [spendRow, setSpendRow] = useState<SpendRow | null>(null)
  const users = useMemo(() => allUsers(), [])

  useEffect(() => {
    api.getAgent(agentId).then(a => setAgent(a ?? null))
    api.listAgentVersions(agentId).then(setVersions)
    api.getGrants(agentId).then(setGrants)
    api.listTasks({ agentId }).then(setTasks)
    api.getSpend('30d', 'agent').then(s => {
      setSpendRow(s.items.find(r => r.id === agentId) ?? null)
    })
  }, [agentId])

  if (agent === null) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'not found' }]}>
        <div className="page">
          <NoAccessState
            requiredRole="visibility into this agent"
            body={`Agent ${agentId} could not be loaded. It may be archived or outside your current domain.`}
          />
        </div>
      </AppShell>
    )
  }

  if (agent === undefined) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'loading...' }]}>
        <div className="page"><LoadingList rows={6} /></div>
      </AppShell>
    )
  }

  const canEdit = !!user && (user.role === 'admin' || user.role === 'domain_admin')
  const owner = users.find(u => u.id === agent.owner_user_id)
  const activeVersion = versions?.find(v => v.id === agent.active_version) ?? null

  const tabs = [
    { key: 'overview', label: 'Overview', href: `/agents/${agent.id}` },
    { key: 'versions', label: 'Versions', count: versions?.length ?? '—', href: `/agents/${agent.id}/versions` },
    { key: 'grants', label: 'Tool grants', count: grants?.length ?? '—', href: `/agents/${agent.id}/grants` },
    { key: 'settings', label: 'Settings', href: `/agents/${agent.id}/settings` },
  ]

  return (
    <AppShell
      crumbs={[
        { label: 'home', to: '/' },
        { label: 'agents', to: '/agents' },
        { label: agent.name },
      ]}
    >
      <div className="page page--wide">
        <PageHeader
          eyebrow={<>{`AGENT · ${agent.id.toUpperCase()}`}</>}
          title={<>{agent.name}{' '}<em style={{ fontSize: 24, marginLeft: 4, color: 'var(--text-muted)' }}>— {agent.owner_team ?? agent.domain_id}</em></>}
          subtitle={agent.description}
          actions={
            <>
              <Status status={agent.status} />
              {activeVersion && <Chip tone="accent">{activeVersion.label ?? `v${activeVersion.version_number}`}</Chip>}
              <Btn variant="primary" icon={<IconPlay />} href={`/tasks/new?agent=${agent.id}`} disabled={agent.status !== 'active'}>
                Start task
              </Btn>
            </>
          }
        />

        <CommandBar
          parts={[
            { label: 'AGT', value: agent.id },
            { label: 'TENANT', value: agent.tenant_id },
            { label: 'DOMAIN', value: agent.domain_id },
            { label: 'ACTIVE VER', value: agent.active_version ?? '—', tone: agent.active_version ? 'accent' : 'warn' },
            { label: 'TOOLS', value: `${agent.tools_granted ?? 0} · ${agent.tools_requiring_approval ?? 0} gated` },
            { label: 'SPEND MTD', value: money(agent.monthly_spend_usd ?? 0, { cents: (agent.monthly_spend_usd ?? 0) < 100 }) },
            { label: 'LAST RUN', value: ago(agent.last_run_at ?? null) },
          ]}
        />

        <div style={{ height: 20 }} />

        <BackendGapBanner
          title="Several signals on this agent detail are UI-only"
          fields={[
            'tools_granted / requiring_approval counts (derived)',
            'spend MTD + cap bar',
            'last_run_at',
            'runs_7d + success rate',
            'runs trend sparkbar',
            '28d activity chart',
            'GET /agents/{id}/versions (version history shim)',
            '?agent_id filter on /tasks',
          ]}
          body={<>GET /agents/{'{id}'} returns <span className="mono">{'{id, tenant_id, domain_id, owner_user_id, name, description, status, active_version, created_at, updated_at}'}</span>. Aggregates below are either derived or fixture-only.</>}
        />

        <div style={{ height: 12 }} />

        <Tabs items={tabs} active={tab} />

        {tab === 'overview' && (
          <OverviewTab
            agent={agent}
            versions={versions}
            grants={grants}
            tasks={tasks}
            spendRow={spendRow}
            owner={owner}
            users={users}
            canEdit={canEdit}
          />
        )}
        {tab === 'versions' && <VersionsTab agent={agent} versions={versions} users={users} canEdit={canEdit} onChange={setVersions} />}
        {tab === 'grants' && <GrantsEditor agent={agent} grants={grants} canEdit={canEdit} onChange={setGrants} />}
        {tab === 'settings' && <SettingsTab agent={agent} owner={owner} />}
      </div>
    </AppShell>
  )
}

// ─────────────────────────────────────────────── OVERVIEW

function OverviewTab({
  agent, versions, grants, tasks, spendRow, owner, users, canEdit,
}: {
  agent: Agent
  versions: AgentVersion[] | null
  grants: ToolGrant[] | null
  tasks: Task[] | null
  spendRow: SpendRow | null
  owner: User | undefined
  users: User[]
  canEdit: boolean
}) {
  const active = versions?.find(v => v.id === agent.active_version)
  const activeCreatedBy = users.find(u => u.id === active?.created_by)

  const trend = useMemo(() => {
    const seed = agent.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
    return Array.from({ length: 28 }, (_, i) => {
      const r = Math.abs(Math.sin(seed + i * 12.9898) * 43758.5453) % 1
      return Math.max(0.5, (agent.runs_7d ?? 1) * (0.5 + Math.sin(i / 3) * 0.4 + r * 0.3) / 4)
    })
  }, [agent.id, agent.runs_7d])

  const grantStats = useMemo(() => {
    const g = grants ?? []
    return {
      total: g.length,
      read: g.filter(x => x.mode === 'read').length,
      write: g.filter(x => x.mode === 'write').length,
      readWrite: g.filter(x => x.mode === 'read_write').length,
      approval: g.filter(x => x.approval_required).length,
      highestRisk: g
        .filter(x => x.approval_required)
        .sort((a, b) => riskWeight(b) - riskWeight(a))
        .slice(0, 4),
    }
  }, [grants])

  const recentTasks = useMemo(() => (tasks ?? []).slice(0, 5), [tasks])
  const taskStats = useMemo(() => {
    const t = tasks ?? []
    return {
      completed: t.filter(x => x.status === 'completed').length,
      failed: t.filter(x => x.status === 'failed').length,
      running: t.filter(x => x.status === 'running').length,
      pending: t.filter(x => x.status === 'pending').length,
    }
  }, [tasks])

  return (
    <div className="split">
      <div className="stack">
        {/* ── Active version */}
        <div className="card">
          <div className="card__head">
            <div className="card__title">Active version</div>
            {agent.active_version ? (
              <Link to={`/agents/${agent.id}/versions`} className="btn btn--ghost btn--sm">See all versions</Link>
            ) : (
              canEdit
                ? <Btn variant="primary" size="sm" href={`/agents/${agent.id}/versions/new`} icon={<IconPlus />}>Create v1</Btn>
                : <Chip tone="warn">no active version</Chip>
            )}
          </div>
          <div className="card__body">
            {active ? <VersionCard version={active} createdBy={activeCreatedBy} /> : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="state__icon" style={{ margin: '0 auto 10px' }}><IconAgent /></div>
                <div style={{ fontSize: 13, marginBottom: 16 }}>
                  This agent has no active version. {canEdit ? 'Create one to unlock task runs.' : 'An admin needs to create one.'}
                </div>
                {canEdit && <Btn variant="primary" href={`/agents/${agent.id}/versions/new`}>Create v1</Btn>}
              </div>
            )}
          </div>
        </div>

        {/* ── Start Task panel */}
        <StartTaskPanel agentId={agent.id} canRun={agent.status === 'active'} />

        {/* ── Recent activity (tasks + runs) */}
        <div className="card">
          <div className="card__head">
            <div className="card__title">
              Recent activity
              <Chip square tone="accent">GET /tasks?agentId={agent.id}</Chip>
            </div>
            <Link to={`/tasks?agent=${agent.id}`} className="btn btn--ghost btn--sm">
              All tasks <IconArrowRight className="ic ic--sm" />
            </Link>
          </div>
          <div className="card__body" style={{ padding: tasks === null ? 18 : 0 }}>
            {tasks === null ? (
              <LoadingList rows={4} />
            ) : recentTasks.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No tasks dispatched to this agent yet.
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px 130px 90px 40px 24px', gap: 12, padding: '8px 18px', background: 'var(--surface-2)', fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.14em', borderBottom: '1px solid var(--border)' }}>
                  <span>task</span><span>status</span><span>updated · spend</span><span>type</span><span>run</span><span />
                </div>
                {recentTasks.map(t => (
                  <Link
                    key={t.id}
                    to={t.run_id ? `/runs/${t.run_id}` : `/tasks/${t.id}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) 120px 130px 90px 40px 24px',
                      gap: 12,
                      padding: '12px 18px',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 120ms',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="truncate" style={{ fontSize: 13, color: 'var(--text)' }}>{t.title}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                        {t.id.toUpperCase()} · by {t.created_by_name}
                      </div>
                    </div>
                    <Status status={t.status} />
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {ago(t.updated_at)} · {money(t.spend_usd ?? 0, { cents: true })}
                    </div>
                    <Chip>{t.type.replace('_', ' ')}</Chip>
                    {t.run_id ? (
                      <span className="mono" style={{ fontSize: 10, color: 'var(--accent)' }} title={t.run_id}>
                        <IconRoute className="ic ic--sm" />
                      </span>
                    ) : (
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>—</span>
                    )}
                    <IconArrowRight className="ic ic--sm" />
                  </Link>
                ))}
              </div>
            )}
          </div>
          {tasks && tasks.length > 0 && (
            <div className="card__foot">
              <div className="row row--sm" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                <span><span className="mono success">{taskStats.completed}</span> completed</span>
                <span>·</span>
                <span><span className="mono danger">{taskStats.failed}</span> failed</span>
                <span>·</span>
                <span><span className="mono info">{taskStats.running}</span> running</span>
                <span>·</span>
                <span><span className="mono muted">{taskStats.pending}</span> pending</span>
              </div>
              <Link to={`/tasks?agent=${agent.id}`} className="btn btn--ghost btn--sm">See all →</Link>
            </div>
          )}
        </div>

        {/* ── Runs trend */}
        <div className="card mock-outline">
          <div className="card__head">
            <div className="card__title row row--sm">Runs · last 28 days <MockBadge /></div>
            <Chip>derived locally</Chip>
          </div>
          <div className="card__body">
            <div className="grid grid--3" style={{ marginBottom: 18 }}>
              <Metric label="Runs · 7d" value={num(agent.runs_7d ?? 0)} hint="7-day window" />
              <Metric label="Success rate" value={`${Math.round((agent.success_rate_7d ?? 0) * 100)}%`} hint={(agent.runs_7d ?? 0) ? `${(agent.runs_7d ?? 0) - Math.round((agent.runs_7d ?? 0) * (agent.success_rate_7d ?? 0))} failed` : ''} />
              <Metric label="Avg cost / run" value={money((agent.monthly_spend_usd ?? 0) / Math.max(agent.runs_7d ?? 1, 1), { cents: true })} hint="monthly estimate" />
            </div>
            <Sparkbar values={trend} accent height={72} />
          </div>
        </div>
      </div>

      {/* ── Right column */}
      <div className="stack">
        <div className="card">
          <div className="card__head"><div className="card__title">Owner</div></div>
          <div className="card__body">
            {owner ? (
              <div className="row" style={{ gap: 12 }}>
                <Avatar initials={owner.initials ?? owner.name.slice(0, 2)} tone={owner.avatar_tone ?? 'accent'} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5 }}>{owner.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{owner.email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono uppercase muted" style={{ marginBottom: 2 }}>Approval</div>
                  <Chip tone="accent">L{owner.approval_level}</Chip>
                </div>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>Owner not found · {agent.owner_user_id}</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <div className="card__title">Tool grants</div>
            <Link to={`/agents/${agent.id}/grants`} className="btn btn--ghost btn--sm">
              {canEdit ? 'Manage' : 'View'} <IconArrowRight className="ic ic--sm" />
            </Link>
          </div>
          <div className="card__body">
            {!grants ? <LoadingList rows={3} /> : (
              <>
                <div className="grid grid--4" style={{ gap: 8, marginBottom: 14 }}>
                  <GrantStat label="Total" value={grantStats.total} />
                  <GrantStat label="Read" value={grantStats.read} tone="info" />
                  <GrantStat label="Write" value={grantStats.write + grantStats.readWrite} tone="accent" />
                  <GrantStat label="Gated" value={grantStats.approval} tone="warn" />
                </div>
                {grantStats.highestRisk.length > 0 && (
                  <>
                    <div className="mono uppercase muted" style={{ marginBottom: 6 }}>Highest-risk grants</div>
                    <div className="stack stack--sm">
                      {grantStats.highestRisk.map(g => {
                        const d = toolDisplay(g.tool_name)
                        return (
                          <div key={g.id} className="row row--between" style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--warn-border)', borderRadius: 4 }}>
                            <div className="row row--sm" style={{ minWidth: 0 }}>
                              <IconLock className="ic ic--sm" style={{ color: 'var(--warn)' }} />
                              <div style={{ minWidth: 0 }}>
                                <div className="truncate" style={{ fontSize: 12 }}>{d.provider} <span className="muted">· {d.action}</span></div>
                                <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                                  {g.scope_type} · {modeLabel(g.mode)}
                                </div>
                              </div>
                            </div>
                            <Chip tone="warn">approval</Chip>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="card mock-outline">
          <div className="card__head">
            <div className="card__title row row--sm">Spend · 30d <MockBadge title="monthly_spend_usd / cap not on Agent" /></div>
          </div>
          <div className="card__body">
            {agent.monthly_spend_cap_usd && (
              <>
                <div className="row row--between" style={{ marginBottom: 10 }}>
                  <span className="metric__label">Month-to-date</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    cap {money(agent.monthly_spend_cap_usd)}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, letterSpacing: '-0.02em' }}>
                  {money(agent.monthly_spend_usd ?? 0, { cents: (agent.monthly_spend_usd ?? 0) < 100 })}
                </div>
                <div className="spend-row__bar-track" style={{ marginTop: 14 }}>
                  <div
                    className="spend-row__bar-fill"
                    style={{
                      width: `${Math.min(100, ((agent.monthly_spend_usd ?? 0) / agent.monthly_spend_cap_usd) * 100)}%`,
                      background: (agent.monthly_spend_usd ?? 0) / agent.monthly_spend_cap_usd > 0.85
                        ? 'linear-gradient(90deg, var(--warn), var(--danger))' : undefined,
                    }}
                  />
                </div>
                <div className="row row--between" style={{ marginTop: 8, fontSize: 11 }}>
                  <span className="mono muted">{Math.round(((agent.monthly_spend_usd ?? 0) / agent.monthly_spend_cap_usd) * 100)}% used</span>
                  <span className="mono muted">{money(agent.monthly_spend_cap_usd - (agent.monthly_spend_usd ?? 0))} left</span>
                </div>
              </>
            )}

            {spendRow && (
              <>
                <div className="hr" />
                <div className="grid grid--2" style={{ gap: 12 }}>
                  <div>
                    <div className="mono uppercase muted" style={{ marginBottom: 4 }}>Runs · 30d</div>
                    <div style={{ fontSize: 18, fontFamily: 'var(--font-serif)' }}>{num(spendRow.run_count)}</div>
                  </div>
                  <div>
                    <div className="mono uppercase muted" style={{ marginBottom: 4 }}>Tokens · 30d</div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>
                      {num(Math.round(spendRow.tokens_in / 1000))}k in
                    </div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>
                      {num(Math.round(spendRow.tokens_out / 1000))}k out
                    </div>
                  </div>
                </div>
              </>
            )}

            {!agent.monthly_spend_cap_usd && !spendRow && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No spend data available.</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card__head"><div className="card__title">Metadata</div></div>
          <div className="card__body" style={{ fontSize: 12.5 }}>
            <MetaRow label="Agent ID" value={<span className="mono">{agent.id}</span>} />
            <MetaRow label="Tenant" value={<span className="mono">{agent.tenant_id}</span>} />
            <MetaRow label="Domain" value={<span className="mono">{agent.domain_id}</span>} />
            <MetaRow label="Created" value={`${ago(agent.created_at)} · by ${owner?.name ?? agent.owner_user_id}`} />
            <MetaRow label="Updated" value={ago(agent.updated_at)} />
            <MetaRow label="Versions" value={`${agent.version_count ?? 0} (${versions?.filter(v => !v.is_active).length ?? 0} inactive)`} />
          </div>
        </div>
      </div>
    </div>
  )
}

function StartTaskPanel({ agentId, canRun }: { agentId: string; canRun: boolean }) {
  const types: { type: TaskType; title: string; blurb: string; icon: React.ReactNode }[] = [
    { type: 'chat', title: 'Chat', blurb: 'Conversational back-and-forth. The agent waits for your replies.', icon: <IconChat /> },
    { type: 'one_time', title: 'One-time', blurb: 'Fire-and-forget run. Agent returns a single result.', icon: <IconTask /> },
    { type: 'schedule', title: 'Schedule', blurb: 'Recurring run on a cron / interval. Pause anytime.', icon: <IconClock /> },
  ]
  return (
    <div className="card">
      <div className="card__head">
        <div className="card__title">Start a task</div>
        {canRun ? <Chip tone="accent">active</Chip> : <Chip tone="warn">agent not active</Chip>}
      </div>
      <div className="card__body">
        <div className="grid grid--3" style={{ gap: 10 }}>
          {types.map(t => (
            <Link
              key={t.type}
              to={canRun ? `/tasks/new?agent=${agentId}&type=${t.type}` : `/agents/${agentId}`}
              className="login__role"
              style={{
                padding: 14,
                textAlign: 'left',
                opacity: canRun ? 1 : 0.45,
                cursor: canRun ? 'pointer' : 'not-allowed',
              }}
              onClick={canRun ? undefined : () => { /* no-op */ }}
            >
              <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                <div className="grant__icon">{t.icon}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--text)' }}>{t.title}</div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.blurb}</div>
            </Link>
          ))}
        </div>
        {!canRun && (
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, textAlign: 'center' }}>
            Activate a version to enable task dispatch.
          </div>
        )}
      </div>
    </div>
  )
}

function GrantStat({ label, value, tone }: { label: string; value: number; tone?: 'info' | 'accent' | 'warn' }) {
  const color =
    tone === 'info' ? 'var(--info)' :
    tone === 'accent' ? 'var(--accent)' :
    tone === 'warn' ? 'var(--warn)' :
    'var(--text)'
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', border: '1px solid var(--border-2)', borderRadius: 4, background: 'var(--surface-2)' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color, letterSpacing: '-0.01em' }}>{value}</div>
      <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 2 }}>
        {label}
      </div>
    </div>
  )
}

function riskWeight(g: ToolGrant): number {
  const cat = String(g.config.category ?? '')
  let w = 0
  if (g.approval_required) w += 10
  if (cat === 'payments') w += 5
  if (cat === 'infra') w += 5
  if (g.mode === 'write' || g.mode === 'read_write') w += 2
  if (g.scope_type === 'agent') w += 1
  return w
}

// ─────────────────────────────────────────────── VERSIONS / GRANTS / SETTINGS

function VersionCard({ version, createdBy }: { version: AgentVersion; createdBy?: User }) {
  return (
    <>
      <div className="row row--between" style={{ marginBottom: 16 }}>
        <div className="row row--wrap">
          <Chip tone="accent">v{version.version_number}{version.is_active ? ' · active' : ''}</Chip>
          <Chip>model · {version.model_chain_config.primary}</Chip>
          {version.model_chain_config.fallbacks.length > 0 && (
            <Chip>fallback · {version.model_chain_config.fallbacks.join(', ')}</Chip>
          )}
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {version.activated_at ? `activated ${ago(version.activated_at)}` : 'not activated'}
        </span>
      </div>

      <div className="row" style={{ gap: 12, marginBottom: 14, fontSize: 12 }}>
        <span className="mono uppercase muted">Created</span>
        <span className="mono">{absTime(version.created_at)}</span>
        <span className="mono uppercase muted">by</span>
        {createdBy ? (
          <span className="row row--sm">
            <Avatar initials={createdBy.initials ?? createdBy.name.slice(0, 2)} tone={createdBy.avatar_tone ?? 'accent'} size={18} />
            <span>{createdBy.name}</span>
          </span>
        ) : (
          <span className="mono" style={{ color: 'var(--text-dim)' }}>{version.created_by}</span>
        )}
      </div>

      <div className="mono uppercase muted" style={{ marginBottom: 8 }}>Instruction spec</div>
      <pre style={{
        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        padding: 14, borderRadius: 4, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.65,
        maxHeight: 220, overflow: 'auto',
      }}>
        {version.instruction_spec}
      </pre>

      <div className="grid grid--3" style={{ marginTop: 16, gap: 12 }}>
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div style={{ padding: 12 }}>
            <div className="mono uppercase muted" style={{ marginBottom: 6 }}>Memory scope</div>
            <MemoryScopeChips config={version.memory_scope_config} />
          </div>
        </div>
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div style={{ padding: 12 }}>
            <div className="mono uppercase muted" style={{ marginBottom: 6 }}>Tool scope</div>
            <ToolScopeChips config={version.tool_scope_config} />
          </div>
        </div>
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div style={{ padding: 12 }}>
            <div className="mono uppercase muted" style={{ marginBottom: 6 }}>Model chain</div>
            <div style={{ fontSize: 12 }}>primary · <span className="mono accent">{version.model_chain_config.primary}</span></div>
            {version.model_chain_config.fallbacks.map(f => (
              <div key={f} style={{ fontSize: 11 }}>fallback · <span className="mono muted">{f}</span></div>
            ))}
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
              max_tokens {version.model_chain_config.max_tokens} · temp {version.model_chain_config.temperature}
            </div>
          </div>
        </div>
      </div>

      {version.approval_rules.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="mono uppercase muted" style={{ marginBottom: 8 }}>Approval rules</div>
          <div className="stack stack--sm">
            {version.approval_rules.map(rule => (
              <div key={rule.id} className="card" style={{ background: 'var(--surface-2)' }}>
                <div style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>{rule.when}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{rule.note}</div>
                  </div>
                  <Chip tone="accent">L{rule.required_approver_level}</Chip>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function MemoryScopeChips({ config }: { config: AgentVersion['memory_scope_config'] }) {
  const flags: Array<[string, boolean]> = [
    ['user_facts', config.user_facts],
    ['session_only', config.session_only],
    ['domain_shared', config.domain_shared],
  ]
  return (
    <div className="row row--wrap row--sm">
      {flags.map(([k, on]) => (
        <Chip key={k} tone={on ? 'accent' : 'ghost'}>{on ? '✓' : '·'} {k}</Chip>
      ))}
      <Chip>retention · {config.retention_days}d</Chip>
    </div>
  )
}

function ToolScopeChips({ config }: { config: AgentVersion['tool_scope_config'] }) {
  return (
    <div className="row row--wrap row--sm">
      <Chip tone={config.inherits_from_agent ? 'accent' : 'ghost'}>{config.inherits_from_agent ? '✓' : '·'} inherit</Chip>
      {config.overrides.map(o => <Chip key={`o-${o}`} tone="accent">+ {o}</Chip>)}
      {config.denylist.map(d => <Chip key={`d-${d}`} tone="danger">− {d}</Chip>)}
      {config.overrides.length === 0 && config.denylist.length === 0 && (
        <span className="mono muted" style={{ fontSize: 10.5 }}>no overrides</span>
      )}
    </div>
  )
}

function VersionsTab({
  agent, versions, users, canEdit, onChange,
}: {
  agent: Agent
  versions: AgentVersion[] | null
  users: User[]
  canEdit: boolean
  onChange: (v: AgentVersion[]) => void
}) {
  const activate = async (id: string) => {
    await api.activateVersion(agent.id, id)
    const next = await api.listAgentVersions(agent.id)
    onChange(next)
  }

  return (
    <div>
      <Banner tone="warn" title="Version history is a prototype shim">
        Backend exposes <span className="mono">POST /agents/{'{id}'}/versions</span> and
        <span className="mono"> POST /agents/{'{id}'}/versions/{'{verId}'}/activate</span>, but there is no
        <span className="mono"> GET /agents/{'{id}'}/versions</span> endpoint yet. This list is rendered from local fixtures.
      </Banner>
      <div style={{ height: 16 }} />
      <div className="row row--between" style={{ marginBottom: 12 }}>
        <div className="mono uppercase muted">{versions?.length ?? 0} versions · newest first</div>
        <Btn variant="primary" size="sm" icon={<IconPlus />} href={`/agents/${agent.id}/versions/new`} disabled={!canEdit}>
          Draft new version
        </Btn>
      </div>
      {!versions ? <LoadingList rows={3} /> : versions.length === 0 ? (
        <div className="state">
          <div className="state__title">No versions yet</div>
          <p className="state__body">Create v1 to make this agent runnable.</p>
          {canEdit && <Btn variant="primary" href={`/agents/${agent.id}/versions/new`}>Create v1</Btn>}
        </div>
      ) : (
        <div className="stack">
          {versions.map(v => {
            const creator = users.find(u => u.id === v.created_by)
            return (
              <div key={v.id} className="card">
                <div className="card__head">
                  <div className="row row--wrap">
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24, letterSpacing: '-0.01em' }}>v{v.version_number}</span>
                    <Chip tone={v.is_active ? 'accent' : 'ghost'}>{v.is_active ? 'active' : v.activated_at ? 'retired' : 'draft'}</Chip>
                    <Chip>{v.model_chain_config.primary}</Chip>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.approval_rules.length} approval rules</span>
                  </div>
                  <div className="row">
                    {creator && (
                      <span className="row row--sm" title={creator.email}>
                        <Avatar initials={creator.initials ?? creator.name.slice(0, 2)} tone={creator.avatar_tone ?? 'accent'} size={18} />
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{creator.name.split(' ')[0]}</span>
                      </span>
                    )}
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      <IconClock className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                      {' '}created {absTime(v.created_at)}
                    </span>
                    {!v.is_active && canEdit && !v.activated_at && (
                      <Btn variant="primary" size="sm" onClick={() => activate(v.id)}>Activate</Btn>
                    )}
                  </div>
                </div>
                <div className="card__body">
                  {v.notes && (
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>{v.notes}</div>
                  )}
                  <pre style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text)',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    padding: '10px 14px', borderRadius: 4, margin: 0, whiteSpace: 'pre-wrap',
                    maxHeight: 120, overflow: 'auto', lineHeight: 1.55,
                  }}>
                    {v.instruction_spec.slice(0, 400)}{v.instruction_spec.length > 400 ? '…' : ''}
                  </pre>
                  <div className="grid grid--3" style={{ marginTop: 12, gap: 10 }}>
                    <div className="card" style={{ background: 'var(--surface-2)' }}>
                      <div style={{ padding: 10 }}>
                        <div className="mono uppercase muted" style={{ marginBottom: 4, fontSize: 9.5 }}>Memory</div>
                        <MemoryScopeChips config={v.memory_scope_config} />
                      </div>
                    </div>
                    <div className="card" style={{ background: 'var(--surface-2)' }}>
                      <div style={{ padding: 10 }}>
                        <div className="mono uppercase muted" style={{ marginBottom: 4, fontSize: 9.5 }}>Tools</div>
                        <ToolScopeChips config={v.tool_scope_config} />
                      </div>
                    </div>
                    <div className="card" style={{ background: 'var(--surface-2)' }}>
                      <div style={{ padding: 10 }}>
                        <div className="mono uppercase muted" style={{ marginBottom: 4, fontSize: 9.5 }}>Approvals</div>
                        <div className="mono" style={{ fontSize: 11 }}>
                          {v.approval_rules.length === 0 ? (
                            <span className="muted">none</span>
                          ) : v.approval_rules.slice(0, 2).map(r => (
                            <div key={r.id} style={{ marginBottom: 2 }}>
                              <span className="accent">L{r.required_approver_level}</span> · {r.when.slice(0, 40)}
                            </div>
                          ))}
                          {v.approval_rules.length > 2 && (
                            <div className="muted">+{v.approval_rules.length - 2} more</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SettingsTab({ agent, owner }: { agent: Agent; owner: User | undefined }) {
  return (
    <div className="stack">
      <Banner tone="warn" title="Writes aren't wired up — backend is missing PATCH /agents and DELETE /agents">
        Edits and archival will become available when the backend exposes <span className="mono">PATCH /agents/{'{id}'}</span> and <span className="mono">DELETE /agents/{'{id}'}</span>. Fields below are read-only.
      </Banner>

      <div className="card">
        <div className="card__head"><div className="card__title">Identity</div></div>
        <div className="card__body">
          <div className="form-row">
            <div><div className="form-row__label">Display name</div></div>
            <div className="form-row__control"><input className="input" value={agent.name} disabled readOnly /></div>
          </div>
          <div className="form-row">
            <div><div className="form-row__label">Description</div></div>
            <div className="form-row__control"><textarea className="input textarea" value={agent.description} disabled readOnly /></div>
          </div>
          <div className="form-row">
            <div><div className="form-row__label">Owner</div></div>
            <div className="form-row__control">
              <input className="input" value={owner ? `${owner.name} · ${owner.email}` : agent.owner_user_id} disabled readOnly />
            </div>
          </div>
          <div className="form-row">
            <div><div className="form-row__label">Tenant / Domain</div></div>
            <div className="form-row__control">
              <input className="input input--mono" value={`${agent.tenant_id} / ${agent.domain_id}`} disabled readOnly />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__head"><div className="card__title">Budgets & limits</div></div>
        <div className="card__body">
          <div className="form-row">
            <div>
              <div className="form-row__label">Monthly cap (USD)</div>
              <div className="form-row__hint">Orchestrator blocks new runs once cap is reached.</div>
            </div>
            <div className="form-row__control">
              <input className="input input--mono" value={agent.monthly_spend_cap_usd ?? ''} disabled readOnly />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'var(--danger-border)' }}>
        <div className="card__head"><div className="card__title" style={{ color: 'var(--danger)' }}>Danger zone</div></div>
        <div className="card__body stack stack--sm">
          <div className="row row--between">
            <div>
              <div style={{ fontSize: 13 }}>Archive agent</div>
              <div className="muted" style={{ fontSize: 12 }}>Stops all runs and hides the agent from teammates.</div>
            </div>
            <Btn variant="danger" disabled>Archive (planned)</Btn>
          </div>
          <div className="row row--between">
            <div>
              <div style={{ fontSize: 13 }}>Delete agent</div>
              <div className="muted" style={{ fontSize: 12 }}>Permanently removes the agent, all versions, grants, and task history.</div>
            </div>
            <Btn variant="danger" disabled>Delete (planned)</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="metric__label">{label}</div>
      <div className="metric__value">{value}</div>
      {hint && <div className="metric__delta">{hint}</div>}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row row--between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
      <span className="mono uppercase muted" style={{ fontSize: 10.5 }}>{label}</span>
      <span style={{ fontSize: 12 }}>{value}</span>
    </div>
  )
}
