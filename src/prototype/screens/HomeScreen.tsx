import { useEffect, useMemo, useState } from 'react'
import { Code, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, MetricCard, Status, InfoHint } from '../components/common'
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
          eyebrow={
            <>
              {nowDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
              {' · TENANT '}{user?.tenant_id ?? '—'}
              {!isMember && (
                <>
                  {' '}
                  <InfoHint>
                    Dashboard tiles are derived from{' '}
                    <Code variant="ghost">GET /agents</Code>,{' '}
                    <Code variant="ghost">GET /tasks</Code>,{' '}
                    <Code variant="ghost">GET /approvals</Code>, and{' '}
                    <Code variant="ghost">GET /dashboard/spend</Code>.
                  </InfoHint>
                </>
              )}
            </>
          }
          title={<>Good {nowDate.getHours() < 12 ? 'morning' : nowDate.getHours() < 18 ? 'afternoon' : 'evening'}, <em>{user?.name.split(' ')[0]}.</em></>}
          subtitle={isMember
            ? 'Your tasks and approval requests.'
            : 'Fleet-wide counts, live approvals, and spend this week.'}
          actions={
            <>
              <Btn variant='primary' href="/approvals">Approvals</Btn>
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
        <MetricCard
          label="Active agents"
          value={num(activeAgents.length)}
          delta={`${agents.length} total`}
          href="/agents"
          icon={<IconAgent />}
        />
        <MetricCard
          label="Tasks"
          value={num(tasks.length)}
          delta={`${failedTasks.length} failed`}
          href="/tasks"
          icon={<IconTask />}
        />
        <MetricCard
          label="Pending approvals"
          value={num(pendingApprovals.length)}
          delta={pendingApprovals.length > 0 ? 'needs a human decision' : 'queue clear'}
          href="/approvals"
          icon={<IconApproval />}
          tone={pendingApprovals.length > 0 ? 'warn' : undefined}
        />
        <MetricCard
          label="Spend · 7d"
          value={money(spend.total_usd, { compact: true })}
          delta={`${spend.items.length} ${spend.group_by}s`}
          href="/spend"
          icon={<IconSpend />}
        />
      </div>

      <div className="split">
        <div className="card">
          <div className="card__head">
            <div className="card__title">Recent tasks</div>
            <Btn href="/tasks" variant="ghost" size="sm" icon={<IconArrowRight className="ic ic--sm" />}>
              All tasks
            </Btn>
          </div>
          {recentTasks.length === 0 ? (
            <div className="card__body">
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--gray-11)', fontSize: 13 }}>
                No tasks yet. <Link to="/tasks/new"><Text color="blue">Dispatch a task →</Text></Link>
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
                    <div className="truncate" style={{ fontSize: 13, color: 'var(--gray-12)' }}>
                      {t.title ?? <Text color="gray">untitled</Text>}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 2 }}>
                      {t.id} · {ago(t.updated_at)}
                    </div>
                  </div>
                  <Status status={t.status} />
                  <div className="truncate" style={{ fontSize: 11, color: 'var(--gray-11)' }}>
                    {t.assigned_agent_id ?? '—'}
                  </div>
                  <Chip>{t.type.replace('_', ' ')}</Chip>
                  <IconArrowRight className="ic" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ borderColor: pendingApprovals.length > 0 ? 'var(--amber-a6)' : undefined }}>
          <div className="card__head">
            <div className="card__title">
              <IconApproval className="ic" />
              Pending approvals
            </div>
            <Chip tone={pendingApprovals.length > 0 ? 'warn' : 'ghost'}>{pendingApprovals.length}</Chip>
          </div>
          {pendingApprovals.length === 0 ? (
            <div className="card__body">
              <div style={{ fontSize: 13, color: 'var(--gray-11)', padding: '14px 0' }}>
                Queue is clear.
              </div>
            </div>
          ) : (
            <div className="card__body stack stack--sm">
              {pendingApprovals.slice(0, 4).map(a => (
                <Link key={a.id} to={`/approvals/${a.id}`} className="card" style={{ display: 'block', background: 'var(--gray-3)' }}>
                  <div style={{ padding: '10px 12px' }}>
                    <div className="row row--between" style={{ marginBottom: 4 }}>
                      <Code variant="ghost" style={{ fontSize: 10.5, color: 'var(--gray-10)' }}>{a.id}</Code>
                      <Chip>{a.approver_role ?? '—'}</Chip>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--gray-12)', marginBottom: 4 }} className="truncate">
                      {a.requested_action}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--gray-11)' }}>
                      {a.requested_by_name ?? a.requested_by ?? '—'} · {ago(a.created_at)}
                    </div>
                  </div>
                </Link>
              ))}
              <Btn href="/approvals" variant="ghost" size="sm">Open queue</Btn>
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
          <Btn href="/tasks" variant="ghost" size="sm" icon={<IconArrowRight className="ic ic--sm" />}>All tasks</Btn>
        </div>
        {myTasks.length === 0 ? (
          <div className="card__body">
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--gray-11)', fontSize: 13 }}>
              You haven't started any tasks. <Link to="/tasks/new"><Text color="blue">Create one →</Text></Link>
            </div>
          </div>
        ) : (
          <div>
            {myTasks.map(t => (
              <Link key={t.id} to={`/tasks/${t.id}`} className="agent-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) 120px 80px 20px' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="truncate" style={{ fontSize: 13, color: 'var(--gray-12)' }}>
                    {t.title ?? <Text color="gray">untitled</Text>}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 2 }}>
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
            <div style={{ fontSize: 13, color: 'var(--gray-11)', padding: '14px 0' }}>
              You haven't triggered any approvals.
            </div>
          </div>
        ) : (
          <div className="card__body stack stack--sm">
            {myApprovals.slice(0, 6).map(a => (
              <Link key={a.id} to={`/approvals/${a.id}`} className="card" style={{ display: 'block', background: 'var(--gray-3)' }}>
                <div style={{ padding: '10px 12px' }}>
                  <div className="row row--between" style={{ marginBottom: 4 }}>
                    <Code variant="ghost" style={{ fontSize: 10.5, color: 'var(--gray-10)' }}>{a.id}</Code>
                    <Status status={a.status} />
                  </div>
                  <div className="truncate" style={{ fontSize: 12.5, color: 'var(--gray-12)' }}>{a.requested_action}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--gray-11)', marginTop: 2 }}>
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

