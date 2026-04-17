import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Dot, Status, Sparkbar } from '../components/common'
import { Banner, ErrorState, LoadingList, NoAccessState } from '../components/states'
import {
  IconAgent,
  IconAlert,
  IconApproval,
  IconArrowRight,
  IconArrowUp,
  IconArrowDown,
  IconPlay,
  IconSpend,
  IconTask,
  IconLock,
} from '../components/icons'
import { Link, useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type {
  Agent,
  ApprovalRequest,
  SpendDashboard,
  SpendGroupBy,
  SpendRange,
  Task,
} from '../lib/types'
import { ago, money, num, pct } from '../lib/format'
import { allUsers } from '../lib/fixtures'

const RANGES: SpendRange[] = ['1d', '7d', '30d', '90d']
const RANGE_LABEL: Record<SpendRange, string> = { '1d': 'today', '7d': '7 days', '30d': '30 days', '90d': '90 days' }

export default function HomeScreen() {
  const { user } = useAuth()
  const { search } = useRouter()
  const forceState = search.get('mode')
  const isMember = user?.role === 'member'

  const [range, setRange] = useState<SpendRange>('30d')
  const [groupBy, setGroupBy] = useState<SpendGroupBy>('agent')

  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [approvals, setApprovals] = useState<ApprovalRequest[] | null>(null)
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [spendAgent, setSpendAgent] = useState<SpendDashboard | null>(null)
  const [spendUser, setSpendUser] = useState<SpendDashboard | null>(null)
  const [errored, setErrored] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [loadedAt, setLoadedAt] = useState<number>(0)

  const users = useMemo(() => allUsers(), [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (forceState === 'error') throw new Error('simulated error')
      const [t, a, ag, sa, su] = await Promise.all([
        api.listTasks(),
        api.listApprovals(),
        api.listAgents(),
        api.getSpend(range, 'agent'),
        api.getSpend(range, 'user'),
      ])
      if (cancelled) return
      setErrored(false)
      setTasks(t)
      setApprovals(a)
      setAgents(ag)
      setSpendAgent(sa)
      setSpendUser(su)
      setLoadedAt(Date.now())
    }
    run().catch(() => { if (!cancelled) setErrored(true) })
    return () => { cancelled = true }
  }, [range, forceState, reloadKey])

  const isEmpty = forceState === 'empty'
  const loading = !errored && !isEmpty && (!tasks || !approvals || !agents || !spendAgent || !spendUser)

  const spendPrimary = groupBy === 'agent' ? spendAgent : spendUser

  const DAY = 86_400_000
  const { runsToday, runs7d } = useMemo(() => {
    const list = tasks ?? []
    if (!loadedAt) return { runsToday: 0, runs7d: 0 }
    return {
      runsToday: list.filter(t => t.run_id && loadedAt - new Date(t.created_at).getTime() < DAY).length,
      runs7d: list.filter(t => t.run_id && loadedAt - new Date(t.created_at).getTime() < 7 * DAY).length,
    }
  }, [tasks, loadedAt])
  const pendingApprovals = (approvals ?? []).filter(a => a.status === 'pending')
  const failedRuns = (tasks ?? []).filter(t => t.status === 'failed').length
  const activeAgents = (agents ?? []).filter(a => a.status === 'active').length
  const pausedAgents = (agents ?? []).filter(a => a.status === 'paused').length
  const draftAgents = (agents ?? []).filter(a => a.status === 'draft').length
  const liveTasks = (tasks ?? []).filter(t => t.status === 'running' || t.status === 'pending').slice(0, 5)
  const recentTasks = (tasks ?? []).slice(0, 5)
  const mostExpensive = useMemo(() => {
    if (!agents) return null
    return [...agents].sort((a, b) => (b.monthly_spend_usd ?? 0) - (a.monthly_spend_usd ?? 0))[0] ?? null
  }, [agents])

  const nowDate = new Date()

  const crumbs = [{ label: 'app', to: '/' }, { label: 'dashboard' }]

  // ───── error state
  if (errored) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="page">
          <PageHeader
            eyebrow="DASHBOARD"
            title={<>Good {nowDate.getHours() < 12 ? 'morning' : nowDate.getHours() < 18 ? 'afternoon' : 'evening'}.</>}
          />
          <ErrorState
            title="Couldn't load dashboard data"
            body="One of the backend calls failed (or was simulated with ?mode=error). Check your connection and retry."
            onRetry={() => { setReloadKey(k => k + 1) }}
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell crumbs={crumbs}>
      <div className="page">
        <PageHeader
          eyebrow={`${nowDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()} · ${user?.tenant_name ?? user?.tenant_id}`}
          title={<>Good {nowDate.getHours() < 12 ? 'morning' : nowDate.getHours() < 18 ? 'afternoon' : 'evening'}, <em>{user?.name.split(' ')[0]}.</em></>}
          subtitle={isMember
            ? 'This is your personal work — the tasks you started and the approvals waiting on your team. Fleet analytics are gated to admins.'
            : 'Where your agents are burning time and money, what\'s waiting on a human, and which runs didn\'t make it through the last period.'}
          actions={
            <>
              <Btn variant="ghost" href="/approvals">Approvals</Btn>
              <Btn variant="primary" href="/tasks/new" icon={<IconPlay />}>Start a task</Btn>
            </>
          }
        />

        <RangeControls
          range={range}
          groupBy={groupBy}
          onRange={setRange}
          onGroupBy={setGroupBy}
          canSwitchGroupBy={!isMember}
        />

        {loading ? (
          <div style={{ marginTop: 24 }}><LoadingList rows={8} /></div>
        ) : isEmpty ? (
          <EmptyDashboard />
        ) : isMember ? (
          <MemberDashboard
            user={user!}
            tasks={tasks!}
            approvals={approvals!}
            agents={agents!}
            users={users}
          />
        ) : (
          <>
            {/* hero KPIs (4) */}
            <div className="grid grid--4" style={{ marginBottom: 12 }}>
              <MetricCard
                label={`Total spend · ${RANGE_LABEL[range]}`}
                value={money(spendPrimary?.total_usd ?? 0, { compact: true })}
                sub={
                  <>
                    {(spendPrimary?.total_spend_delta_pct ?? 0) >= 0 ? <IconArrowUp className="ic ic--sm" /> : <IconArrowDown className="ic ic--sm" />}
                    {pct(spendPrimary?.total_spend_delta_pct ?? 0)} vs prior
                  </>
                }
                subTone={(spendPrimary?.total_spend_delta_pct ?? 0) >= 0 ? 'up' : 'down'}
                href="/spend"
                icon={<IconSpend />}
              />
              <MetricCard
                label="Active agents"
                value={num(activeAgents)}
                sub={`${(agents ?? []).length} total · ${pausedAgents} paused · ${draftAgents} draft`}
                href="/agents"
                icon={<IconAgent />}
              />
              <MetricCard
                label="Waiting approval"
                value={num(pendingApprovals.length)}
                sub={pendingApprovals.length > 0 ? 'needs a human decision' : 'queue clear'}
                subTone={pendingApprovals.length > 0 ? 'warn' : undefined}
                href="/approvals"
                icon={<IconApproval />}
                pulse={pendingApprovals.length > 0}
                tone={pendingApprovals.length > 0 ? 'warn' : undefined}
              />
              <MetricCard
                label="Failed runs · all-time"
                value={num(failedRuns)}
                sub={failedRuns > 0 ? 'review & rerun' : 'no failures on record'}
                subTone={failedRuns > 0 ? 'danger' : undefined}
                href="/tasks"
                icon={<IconAlert />}
                tone={failedRuns > 0 ? 'danger' : undefined}
              />
            </div>

            {/* secondary row */}
            <div className="grid grid--3" style={{ marginBottom: 20 }}>
              <div className="card card--metric">
                <div className="card__body">
                  <div className="metric__label">Runs · today</div>
                  <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                    <div className="metric__value">{num(runsToday)}</div>
                    {runsToday > 0 && <Dot tone="success" pulse />}
                  </div>
                  <div className="metric__delta">dispatched in the last 24h</div>
                </div>
              </div>
              <div className="card card--metric">
                <div className="card__body">
                  <div className="metric__label">Runs · 7d</div>
                  <div className="metric__value">{num(runs7d)}</div>
                  <div className="metric__delta">tasks with a run started this week</div>
                </div>
              </div>
              <div className="card card--metric" style={{ borderColor: mostExpensive ? 'var(--accent-border)' : undefined }}>
                <div className="card__body">
                  <div className="metric__label">Most expensive agent</div>
                  {mostExpensive ? (
                    <Link to={`/agents/${mostExpensive.id}`} style={{ display: 'block' }}>
                      <div className="row" style={{ gap: 10 }}>
                        <div className="agent-row__avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{mostExpensive.glyph}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, letterSpacing: '-0.01em', color: 'var(--text)' }}>
                            {money(mostExpensive.monthly_spend_usd ?? 0, { compact: true })}
                          </div>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {mostExpensive.name} · {mostExpensive.owner_team}
                          </div>
                        </div>
                        <IconArrowRight className="ic" />
                      </div>
                    </Link>
                  ) : <div className="muted" style={{ fontSize: 12 }}>—</div>}
                </div>
              </div>
            </div>

            {/* live runs + approvals */}
            <div className="split" style={{ marginBottom: 20 }}>
              <LiveRunsCard liveTasks={liveTasks} agents={agents ?? []} recentTasks={recentTasks} />
              <div className="stack">
                <PendingApprovalsCard approvals={pendingApprovals.slice(0, 4)} />
                <BurnChartCard spend={spendPrimary!} />
              </div>
            </div>

            {/* spend breakdown (both agent + user, side by side) */}
            <div className="grid grid--2" style={{ gap: 16 }}>
              <SpendTableCard
                title="Spend · by agent"
                endpoint={`GET /dashboard/spend?group_by=agent&range=${range}`}
                data={spendAgent}
                clickable
                highlighted={groupBy === 'agent'}
                onSelect={() => setGroupBy('agent')}
              />
              <SpendTableCard
                title="Spend · by user"
                endpoint={`GET /dashboard/spend?group_by=user&range=${range}`}
                data={spendUser}
                clickable={false}
                highlighted={groupBy === 'user'}
                onSelect={() => setGroupBy('user')}
              />
            </div>

            <div style={{ height: 16 }} />
            <Banner tone="info" title="Reading the dashboard">
              Hero cards link out to their detail surface. Spend breakdown comes from <span className="mono">GET /dashboard/spend</span> — range and <span className="mono">group_by</span> are the only supported filters. Runs list is currently scoped per-task (no global <span className="mono">GET /runs</span>).
            </Banner>
          </>
        )}
      </div>
    </AppShell>
  )
}

// ─────────────────────────────────────────────── components

function RangeControls({
  range, groupBy, onRange, onGroupBy, canSwitchGroupBy,
}: {
  range: SpendRange
  groupBy: SpendGroupBy
  onRange: (r: SpendRange) => void
  onGroupBy: (g: SpendGroupBy) => void
  canSwitchGroupBy: boolean
}) {
  return (
    <div className="row" style={{ gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
      <div className="row row--sm">
        <span className="mono uppercase muted" style={{ marginRight: 4 }}>range</span>
        {RANGES.map(r => (
          <button
            key={r}
            className={`chip${range === r ? ' chip--accent' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => onRange(r)}
          >
            {r}
          </button>
        ))}
      </div>
      {canSwitchGroupBy && (
        <>
          <span style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <div className="row row--sm">
            <span className="mono uppercase muted" style={{ marginRight: 4 }}>focus</span>
            {(['agent', 'user'] as SpendGroupBy[]).map(g => (
              <button
                key={g}
                className={`chip${groupBy === g ? ' chip--accent' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onGroupBy(g)}
              >
                by {g}
              </button>
            ))}
          </div>
        </>
      )}
      <div style={{ flex: 1 }} />
      <Link to="/spend" className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        open full spend view →
      </Link>
    </div>
  )
}

function MetricCard({
  label, value, sub, href, icon, pulse, subTone, tone,
}: {
  label: string
  value: string
  sub: React.ReactNode
  href: string
  icon: React.ReactNode
  pulse?: boolean
  subTone?: 'up' | 'down' | 'warn' | 'danger'
  tone?: 'warn' | 'danger'
}) {
  const borderMap: Record<string, string> = {
    warn: 'var(--warn-border)',
    danger: 'var(--danger-border)',
  }
  return (
    <Link
      to={href}
      className="card card--metric"
      style={{
        display: 'block',
        borderColor: tone ? borderMap[tone] : undefined,
      }}
    >
      <div className="card__body">
        <div className="row row--between">
          <div className="metric__label">{label}</div>
          <div style={{ color: 'var(--text-dim)' }}>{icon}</div>
        </div>
        <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
          <div className="metric__value">{value}</div>
          {pulse && <Dot tone="warn" pulse />}
        </div>
        <div
          className="metric__delta"
          style={{
            color:
              subTone === 'up' ? 'var(--success)' :
              subTone === 'down' ? 'var(--danger)' :
              subTone === 'warn' ? 'var(--warn)' :
              subTone === 'danger' ? 'var(--danger)' :
              undefined,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {sub}
        </div>
      </div>
    </Link>
  )
}

function LiveRunsCard({
  liveTasks, agents, recentTasks,
}: { liveTasks: Task[]; agents: Agent[]; recentTasks: Task[] }) {
  const rows = liveTasks.length > 0 ? liveTasks : recentTasks

  return (
    <div className="card">
      <div className="card__head">
        <div className="card__title">
          {liveTasks.length > 0 ? 'Live runs' : 'Recent runs'}
          <span className="card__eyebrow">· {liveTasks.length > 0 ? 'updating every 5s (mocked)' : 'from the last few hours'}</span>
        </div>
        <Link to="/tasks" className="btn btn--ghost btn--sm">
          Open task list <IconArrowRight className="ic ic--sm" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="card__body">
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No runs yet. <Link to="/tasks/new" className="accent">Dispatch a task →</Link>
          </div>
        </div>
      ) : (
        <div>
          {rows.map(t => {
            const href = t.run_id ? `/runs/${t.run_id}` : `/tasks/${t.id}`
            const agent = agents.find(a => a.id === t.assigned_agent_id)
            return (
              <Link
                key={t.id}
                to={href}
                className="agent-row"
                style={{ gridTemplateColumns: '38px minmax(0, 1fr) 130px 120px 80px 20px' }}
              >
                <div className="agent-row__avatar" style={{ width: 30, height: 30, fontSize: 10.5 }}>
                  {agent?.glyph ?? '··'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="agent-row__name" style={{ fontSize: 13 }}>
                    <span className="truncate">{t.title}</span>
                  </div>
                  <div className="agent-row__desc">
                    {t.agent_name} · by {t.created_by_name} · {ago(t.updated_at)}
                  </div>
                </div>
                <Status status={t.status} />
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t.steps_count ?? 0} steps · {money(t.spend_usd ?? 0, { cents: true })}
                </div>
                <Chip>{t.type.replace('_', ' ')}</Chip>
                <IconArrowRight className="ic" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PendingApprovalsCard({ approvals }: { approvals: ApprovalRequest[] }) {
  if (approvals.length === 0) {
    return (
      <div className="card">
        <div className="card__head">
          <div className="card__title">
            <IconApproval className="ic" />
            Waiting on you
          </div>
          <Chip>0</Chip>
        </div>
        <div className="card__body">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '14px 0' }}>
            Queue clear. When an agent requests a gated action, it will show up here.
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="card" style={{ borderColor: 'var(--warn-border)' }}>
      <div className="card__head">
        <div className="card__title">
          <IconApproval className="ic" style={{ color: 'var(--warn)' }} />
          Waiting on <em className="warn">you</em>
        </div>
        <Chip tone="warn">{approvals.length}</Chip>
      </div>
      <div className="card__body stack stack--sm">
        {approvals.map(a => (
          <Link key={a.id} to={`/approvals/${a.id}`} className="card" style={{ display: 'block', background: 'var(--surface-2)' }}>
            <div style={{ padding: '10px 12px' }}>
              <div className="row row--between" style={{ marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{a.id.toUpperCase()}</span>
                <Chip tone={a.risk === 'high' ? 'danger' : a.risk === 'medium' ? 'warn' : 'ghost'}>{a.risk ?? 'low'}</Chip>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 4 }} className="truncate">{a.requested_action}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                L{a.required_approver_level} · {a.agent_name} · {ago(a.created_at)}
              </div>
            </div>
          </Link>
        ))}
        <Link to="/approvals" className="btn btn--ghost btn--sm" style={{ justifyContent: 'center' }}>
          Open approvals queue
        </Link>
      </div>
    </div>
  )
}

function BurnChartCard({ spend }: { spend: SpendDashboard }) {
  const arr = spend.burn_per_day ?? []
  const max = Math.max(...arr, 0.001)
  return (
    <div className="card">
      <div className="card__head">
        <div className="card__title">Daily burn · {spend.window_label}</div>
        <Chip tone="accent">range · {spend.range}</Chip>
      </div>
      <div className="card__body">
        <div className="chart-bars" style={{ height: 120 }}>
          {arr.map((v, i) => (
            <div
              key={i}
              className="chart-bar"
              style={{ height: `${(v / max) * 100}%`, opacity: i === arr.length - 1 ? 1 : 0.65 }}
              title={`Day ${i + 1}: ${money(v, { cents: true })}`}
            />
          ))}
        </div>
        <div className="row row--between" style={{ marginTop: 10 }}>
          <div>
            <div className="mono uppercase muted" style={{ marginBottom: 2 }}>Cap used</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20 }}>
              {Math.round((spend.total_usd / (spend.cap_usd ?? 1)) * 100)}%
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono uppercase muted" style={{ marginBottom: 2 }}>Cap</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>{money(spend.cap_usd ?? 0)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SpendTableCard({
  title, endpoint, data, clickable, highlighted, onSelect,
}: {
  title: string
  endpoint: string
  data: SpendDashboard | null
  clickable: boolean
  highlighted: boolean
  onSelect: () => void
}) {
  return (
    <div className="card" style={{ borderColor: highlighted ? 'var(--accent-border)' : undefined }}>
      <div className="card__head">
        <button onClick={onSelect} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="card__title">{title}</div>
          {highlighted && <Chip tone="accent">focus</Chip>}
        </button>
        <Chip square>{endpoint}</Chip>
      </div>
      <div className="card__body" style={{ padding: 0 }}>
        {!data || data.items.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
            No spend recorded in this period.
          </div>
        ) : (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 84px 90px 60px 60px',
              gap: 10, padding: '8px 18px', fontFamily: 'var(--font-mono)', fontSize: 9.5,
              color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.14em',
              borderBottom: '1px solid var(--border)', background: 'var(--surface-2)',
            }}>
              <span>{data.group_by}</span>
              <span style={{ textAlign: 'right' }}>spend</span>
              <span>trend</span>
              <span style={{ textAlign: 'right' }}>runs</span>
              <span style={{ textAlign: 'right' }}>delta</span>
            </div>
            {data.items.slice(0, 6).map(r => {
              const RowInner = (
                <>
                  <div style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 12.5, color: 'var(--text)' }}>{r.label}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                      {r.sub_label ?? r.kind ?? data.group_by}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>
                    {money(r.total_usd, { cents: r.total_usd < 100 })}
                  </div>
                  <div><Sparkbar values={r.trend ?? []} accent={(r.delta_pct ?? 0) >= 10} height={20} /></div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text)', textAlign: 'right' }}>
                    {num(r.run_count)}
                  </div>
                  <div className={`mono${(r.delta_pct ?? 0) > 0 ? ' warn' : (r.delta_pct ?? 0) < 0 ? ' success' : ''}`} style={{ fontSize: 10.5, textAlign: 'right' }}>
                    {pct(r.delta_pct ?? 0)}
                  </div>
                </>
              )
              const style: React.CSSProperties = {
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 84px 90px 60px 60px',
                gap: 10,
                padding: '10px 18px',
                alignItems: 'center',
                borderBottom: '1px solid var(--border)',
                transition: 'background 120ms',
              }
              if (clickable) return <Link key={r.id} to={`/agents/${r.id}`} style={style}>{RowInner}</Link>
              return <div key={r.id} style={style}>{RowInner}</div>
            })}
          </div>
        )}
      </div>
      {data && data.items.length > 6 && (
        <div className="card__foot">
          <span>{data.items.length - 6} more</span>
          <Link to="/spend" className="btn btn--ghost btn--sm">Full breakdown →</Link>
        </div>
      )}
    </div>
  )
}

function MemberDashboard({
  user, tasks, approvals, agents, users,
}: {
  user: { id: string; approval_level: number; role: string }
  tasks: Task[]
  approvals: ApprovalRequest[]
  agents: Agent[]
  users: ReturnType<typeof allUsers>
}) {
  const myTasks = tasks.filter(t => t.created_by === user.id).slice(0, 8)
  const activeTasks = myTasks.filter(t => t.status === 'running' || t.status === 'pending')
  const myApprovalRequests = approvals.filter(a => a.requested_by === user.id)
  const myPending = myApprovalRequests.filter(a => a.status === 'pending')
  void users

  return (
    <>
      <div className="grid grid--3" style={{ marginBottom: 20 }}>
        <div className="card card--metric">
          <div className="card__body">
            <div className="metric__label">My active tasks</div>
            <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
              <div className="metric__value">{num(activeTasks.length)}</div>
              {activeTasks.length > 0 && <Dot tone="success" pulse />}
            </div>
            <div className="metric__delta">of {num(myTasks.length)} total you created</div>
          </div>
        </div>
        <div className="card card--metric">
          <div className="card__body">
            <div className="metric__label">My approvals pending</div>
            <div className="metric__value">{num(myPending.length)}</div>
            <div className="metric__delta">waiting on a {myPending[0]?.approver_role ?? 'reviewer'}</div>
          </div>
        </div>
        <div className="card card--metric">
          <div className="card__body">
            <div className="metric__label">Your approval level</div>
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <div className="metric__value" style={{ color: 'var(--accent)' }}>L{user.approval_level}</div>
              <span className="mono muted">/ 4</span>
            </div>
            <div className="metric__delta">members can resolve up to L2 rules</div>
          </div>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <div className="card__head">
            <div className="card__title">My tasks</div>
            <Link to="/tasks" className="btn btn--ghost btn--sm">All my tasks <IconArrowRight className="ic ic--sm" /></Link>
          </div>
          {myTasks.length === 0 ? (
            <div className="card__body">
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                You haven't started any tasks. <Link to="/tasks/new" className="accent">Create one →</Link>
              </div>
            </div>
          ) : (
            <div>
              {myTasks.map(t => {
                const agent = agents.find(a => a.id === t.assigned_agent_id)
                return (
                  <Link key={t.id} to={t.run_id ? `/runs/${t.run_id}` : `/tasks/${t.id}`} className="agent-row" style={{ gridTemplateColumns: '34px minmax(0, 1fr) 120px 120px 70px' }}>
                    <div className="agent-row__avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{agent?.glyph ?? '··'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="truncate" style={{ fontSize: 13, color: 'var(--text)' }}>{t.title}</div>
                      <div className="agent-row__desc">{t.agent_name} · {ago(t.created_at)}</div>
                    </div>
                    <Status status={t.status} />
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.steps_count ?? 0} steps</div>
                    <Chip>{t.type.replace('_', ' ')}</Chip>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card__head"><div className="card__title">My approval requests</div></div>
            {myApprovalRequests.length === 0 ? (
              <div className="card__body">
                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '14px 0' }}>
                  You haven't triggered any approvals.
                </div>
              </div>
            ) : (
              <div className="card__body stack stack--sm">
                {myApprovalRequests.slice(0, 4).map(a => (
                  <Link key={a.id} to={`/approvals/${a.id}`} className="card" style={{ display: 'block', background: 'var(--surface-2)' }}>
                    <div style={{ padding: '10px 12px' }}>
                      <div className="row row--between" style={{ marginBottom: 4 }}>
                        <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{a.id.toUpperCase()}</span>
                        <Status status={a.status} />
                      </div>
                      <div className="truncate" style={{ fontSize: 12.5, color: 'var(--text)' }}>{a.requested_action}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {a.agent_name} · {ago(a.created_at)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ borderColor: 'var(--border-2)' }}>
            <div className="card__head">
              <div className="card__title">
                <IconLock className="ic" style={{ color: 'var(--text-dim)' }} />
                Analytics are admin-only
              </div>
            </div>
            <div className="card__body">
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Fleet-wide spend, failed-run health, and spend-by-user breakdowns require <Chip tone="accent">domain_admin</Chip> or higher. Ask an admin if you need visibility for a specific decision.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function EmptyDashboard() {
  return (
    <div className="stack stack--lg" style={{ marginTop: 24 }}>
      <NoAccessState
        requiredRole="data"
        body="No tasks have been dispatched and no agents are running. Create your first agent to begin."
      />
      <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
        <Btn href="/agents/new" variant="primary" icon={<IconAgent />}>Create agent</Btn>
        <Btn href="/tasks/new" variant="ghost" icon={<IconTask />}>Start a task</Btn>
      </div>
    </div>
  )
}
