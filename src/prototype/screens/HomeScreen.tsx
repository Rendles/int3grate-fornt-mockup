import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status } from '../components/common'
import { ErrorState, LoadingList } from '../components/states'
import {
  IconAgent,
  IconApproval,
  IconArrowRight,
  IconPlay,
  IconSpend,
  IconTask,
} from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent, ApprovalRequest, SpendDashboard, Task } from '../lib/types'
import { ago, money, num } from '../lib/format'

export default function HomeScreen() {
  const { user } = useAuth()
  const isMember = user?.role === 'member'
  const isAdmin = user?.role === 'admin' || user?.role === 'domain_admin'

  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [approvals, setApprovals] = useState<ApprovalRequest[] | null>(null)
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [spend, setSpend] = useState<SpendDashboard | null>(null)
  const [errored, setErrored] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const [t, a, ag, s] = await Promise.all([
        api.listTasks(),
        api.listApprovals(),
        api.listAgents(),
        isAdmin ? api.getSpend('7d', 'agent') : Promise.resolve(null),
      ])
      if (cancelled) return
      setErrored(false)
      setTasks(t)
      setApprovals(a)
      setAgents(ag)
      setSpend(s)
    }
    run().catch(() => { if (!cancelled) setErrored(true) })
    return () => { cancelled = true }
  }, [reloadKey, isAdmin])

  const loading = !errored && (!tasks || !approvals || !agents || (isAdmin && !spend))

  const nowDate = new Date()

  const pendingApprovals = useMemo(
    () => (approvals ?? []).filter(a => a.status === 'pending'),
    [approvals],
  )
  const failedTasks = useMemo(
    () => (tasks ?? []).filter(t => t.status === 'failed'),
    [tasks],
  )
  const activeAgents = useMemo(
    () => (agents ?? []).filter(a => a.status === 'active'),
    [agents],
  )
  const recentTasks = useMemo(() => (tasks ?? []).slice(0, 6), [tasks])

  // Member view: filter to the current user's work
  const myApprovalRequests = useMemo(
    () => (approvals ?? []).filter(a => a.requested_by === user?.id),
    [approvals, user?.id],
  )
  const myTasks = useMemo(
    () => (tasks ?? []).filter(t => t.created_by === user?.id).slice(0, 6),
    [tasks, user?.id],
  )

  if (errored) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }]}>
        <div className="page">
          <PageHeader eyebrow="DASHBOARD" title={<>Good {nowDate.getHours() < 12 ? 'morning' : nowDate.getHours() < 18 ? 'afternoon' : 'evening'}.</>} />
          <ErrorState
            title="Couldn't load dashboard"
            body="One of the backend calls failed. Retry or try again later."
            onRetry={() => { setReloadKey(k => k + 1) }}
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }]}>
      <div className="page">
        <PageHeader
          eyebrow={`${nowDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()} · TENANT ${user?.tenant_id ?? '—'}`}
          title={<>Good {nowDate.getHours() < 12 ? 'morning' : nowDate.getHours() < 18 ? 'afternoon' : 'evening'}, <em>{user?.name.split(' ')[0]}.</em></>}
          subtitle={isMember
            ? 'Your tasks and approval requests.'
            : 'Tenant-level counts from GET /agents, GET /tasks, GET /approvals and GET /dashboard/spend.'}
          actions={
            <>
              <Btn variant="ghost" href="/approvals">Approvals</Btn>
              <Btn variant="primary" href="/tasks/new" icon={<IconPlay />}>Start a task</Btn>
            </>
          }
        />

        {loading ? (
          <div style={{ marginTop: 24 }}><LoadingList rows={8} /></div>
        ) : isMember ? (
          <MemberView
            myTasks={myTasks}
            myApprovals={myApprovalRequests}
          />
        ) : (
          <AdminView
            agents={agents!}
            activeAgents={activeAgents}
            tasks={tasks!}
            failedTasks={failedTasks}
            pendingApprovals={pendingApprovals}
            recentTasks={recentTasks}
            spend={spend!}
          />
        )}
      </div>
    </AppShell>
  )
}

function AdminView({
  agents, activeAgents, tasks, failedTasks, pendingApprovals, recentTasks, spend,
}: {
  agents: Agent[]
  activeAgents: Agent[]
  tasks: Task[]
  failedTasks: Task[]
  pendingApprovals: ApprovalRequest[]
  recentTasks: Task[]
  spend: SpendDashboard
}) {
  return (
    <>
      <div className="grid grid--4" style={{ marginBottom: 20 }}>
        <TileCard
          label="Active agents"
          value={num(activeAgents.length)}
          sub={`${agents.length} total`}
          href="/agents"
          icon={<IconAgent />}
        />
        <TileCard
          label="Tasks"
          value={num(tasks.length)}
          sub={`${failedTasks.length} failed`}
          href="/tasks"
          icon={<IconTask />}
        />
        <TileCard
          label="Pending approvals"
          value={num(pendingApprovals.length)}
          sub={pendingApprovals.length > 0 ? 'needs a human decision' : 'queue clear'}
          href="/approvals"
          icon={<IconApproval />}
          tone={pendingApprovals.length > 0 ? 'warn' : undefined}
        />
        <TileCard
          label="Spend · 7d"
          value={money(spend.total_usd, { compact: true })}
          sub={`${spend.items.length} ${spend.group_by}s`}
          href="/spend"
          icon={<IconSpend />}
        />
      </div>

      <div className="split">
        <div className="card">
          <div className="card__head">
            <div className="card__title">Recent tasks</div>
            <Link to="/tasks" className="btn btn--ghost btn--sm">
              All tasks <IconArrowRight className="ic ic--sm" />
            </Link>
          </div>
          {recentTasks.length === 0 ? (
            <div className="card__body">
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No tasks yet. <Link to="/tasks/new" className="accent">Dispatch a task →</Link>
              </div>
            </div>
          ) : (
            <div>
              {recentTasks.map(t => (
                <Link
                  key={t.id}
                  to={`/tasks/${t.id}`}
                  className="agent-row"
                  style={{ gridTemplateColumns: 'minmax(0, 1fr) 120px 130px 80px 20px' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 13, color: 'var(--text)' }}>
                      {t.title ?? <span className="muted">untitled</span>}
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                      {t.id} · {ago(t.updated_at)}
                    </div>
                  </div>
                  <Status status={t.status} />
                  <div className="mono truncate" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {t.assigned_agent_id ?? '—'}
                  </div>
                  <Chip>{t.type.replace('_', ' ')}</Chip>
                  <IconArrowRight className="ic" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ borderColor: pendingApprovals.length > 0 ? 'var(--warn-border)' : undefined }}>
          <div className="card__head">
            <div className="card__title">
              <IconApproval className="ic" />
              Pending approvals
            </div>
            <Chip tone={pendingApprovals.length > 0 ? 'warn' : 'ghost'}>{pendingApprovals.length}</Chip>
          </div>
          {pendingApprovals.length === 0 ? (
            <div className="card__body">
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '14px 0' }}>
                Queue is clear.
              </div>
            </div>
          ) : (
            <div className="card__body stack stack--sm">
              {pendingApprovals.slice(0, 4).map(a => (
                <Link key={a.id} to={`/approvals/${a.id}`} className="card" style={{ display: 'block', background: 'var(--surface-2)' }}>
                  <div style={{ padding: '10px 12px' }}>
                    <div className="row row--between" style={{ marginBottom: 4 }}>
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{a.id}</span>
                      <Chip>{a.approver_role ?? '—'}</Chip>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 4 }} className="truncate">
                      {a.requested_action}
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      {a.requested_by_name ?? a.requested_by ?? '—'} · {ago(a.created_at)}
                    </div>
                  </div>
                </Link>
              ))}
              <Link to="/approvals" className="btn btn--ghost btn--sm" style={{ justifyContent: 'center' }}>
                Open queue
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function MemberView({
  myTasks, myApprovals,
}: {
  myTasks: Task[]
  myApprovals: ApprovalRequest[]
}) {
  return (
    <div className="split">
      <div className="card">
        <div className="card__head">
          <div className="card__title">My tasks</div>
          <Link to="/tasks" className="btn btn--ghost btn--sm">All tasks <IconArrowRight className="ic ic--sm" /></Link>
        </div>
        {myTasks.length === 0 ? (
          <div className="card__body">
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              You haven't started any tasks. <Link to="/tasks/new" className="accent">Create one →</Link>
            </div>
          </div>
        ) : (
          <div>
            {myTasks.map(t => (
              <Link key={t.id} to={`/tasks/${t.id}`} className="agent-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) 120px 80px 20px' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="truncate" style={{ fontSize: 13, color: 'var(--text)' }}>
                    {t.title ?? <span className="muted">untitled</span>}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                    {t.id} · {ago(t.updated_at)}
                  </div>
                </div>
                <Status status={t.status} />
                <Chip>{t.type.replace('_', ' ')}</Chip>
                <IconArrowRight className="ic" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__head"><div className="card__title">My approval requests</div></div>
        {myApprovals.length === 0 ? (
          <div className="card__body">
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '14px 0' }}>
              You haven't triggered any approvals.
            </div>
          </div>
        ) : (
          <div className="card__body stack stack--sm">
            {myApprovals.slice(0, 6).map(a => (
              <Link key={a.id} to={`/approvals/${a.id}`} className="card" style={{ display: 'block', background: 'var(--surface-2)' }}>
                <div style={{ padding: '10px 12px' }}>
                  <div className="row row--between" style={{ marginBottom: 4 }}>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{a.id}</span>
                    <Status status={a.status} />
                  </div>
                  <div className="truncate" style={{ fontSize: 12.5, color: 'var(--text)' }}>{a.requested_action}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {ago(a.created_at)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TileCard({
  label, value, sub, href, icon, tone,
}: {
  label: string
  value: string
  sub: string
  href: string
  icon: React.ReactNode
  tone?: 'warn'
}) {
  const borderColor = tone === 'warn' ? 'var(--warn-border)' : undefined
  return (
    <Link
      to={href}
      className="card card--metric"
      style={{ display: 'block', borderColor }}
    >
      <div className="card__body">
        <div className="row row--between">
          <div className="metric__label">{label}</div>
          <div style={{ color: 'var(--text-dim)' }}>{icon}</div>
        </div>
        <div className="metric__value">{value}</div>
        <div className="metric__delta">{sub}</div>
      </div>
    </Link>
  )
}
