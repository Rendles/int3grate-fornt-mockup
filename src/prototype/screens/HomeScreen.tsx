import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Code, Flex, Grid, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader, MetricCard, Status, InfoHint } from '../components/common'
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
              <Button asChild variant='ghost' color='gray'><a href="#/approvals">Approvals</a></Button>
              <Button asChild><a href="#/tasks/new"><IconPlay />Start a task</a></Button>
            </>
          }
        />

        {loading ? (
          <Box mt="5"><LoadingList rows={8} /></Box>
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
      <Grid columns="4" gap="4" mb="5">
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
      </Grid>

      <Grid columns={{ initial: '1', lg: '2fr 1fr' }} gap="4">
        <div className="card">
          <div className="card__head">
            <Text as="div" size="2" weight="medium" className="card__title">Recent tasks</Text>
            <Button asChild variant="ghost" size="1">
              <a href="#/tasks"><IconArrowRight className="ic ic--sm" />All tasks</a>
            </Button>
          </div>
          {recentTasks.length === 0 ? (
            <div className="card__body">
              <Text as="div" size="2" color="gray" align="center" style={{ padding: '30px 0' }}>
                No tasks yet. <Link to="/tasks/new"><Text color="blue">Dispatch a task →</Text></Link>
              </Text>
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
                    <Text as="div" size="2" className="truncate">
                      {t.title ?? <Text color="gray">untitled</Text>}
                    </Text>
                    <Text as="div" size="1" color="gray" mt="1">
                      {t.id} · {ago(t.updated_at)}
                    </Text>
                  </div>
                  <Status status={t.status} />
                  <Text as="div" size="1" color="gray" className="truncate">
                    {t.assigned_agent_id ?? '—'}
                  </Text>
                  <Badge color="gray" variant="soft" radius="full" size="1">{t.type.replace('_', ' ')}</Badge>
                  <IconArrowRight className="ic" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ borderColor: pendingApprovals.length > 0 ? 'var(--amber-a6)' : undefined }}>
          <div className="card__head">
            <Text as="div" size="2" weight="medium" className="card__title">
              <IconApproval className="ic" />
              Pending approvals
            </Text>
            <Badge color={pendingApprovals.length > 0 ? 'amber' : 'gray'} variant={pendingApprovals.length > 0 ? 'soft' : 'outline'} radius="full" size="1">{pendingApprovals.length}</Badge>
          </div>
          {pendingApprovals.length === 0 ? (
            <div className="card__body">
              <Text as="div" size="2" color="gray" style={{ padding: '14px 0' }}>
                Queue is clear.
              </Text>
            </div>
          ) : (
            <div className="card__body"><Flex direction="column" gap="2">
              {pendingApprovals.slice(0, 4).map(a => (
                <Link key={a.id} to={`/approvals/${a.id}`} className="card" style={{ display: 'block', background: 'var(--gray-3)' }}>
                  <div style={{ padding: '10px 12px' }}>
                    <Flex align="center" justify="between" gap="3" mb="1">
                      <Code variant="ghost" size="1" color="gray">{a.id}</Code>
                      <Badge color="gray" variant="soft" radius="full" size="1">{a.approver_role ?? '—'}</Badge>
                    </Flex>
                    <Text as="div" size="1" weight="medium" className="truncate" mb="1">
                      {a.requested_action}
                    </Text>
                    <Text as="div" size="1" color="gray">
                      {a.requested_by_name ?? a.requested_by ?? '—'} · {ago(a.created_at)}
                    </Text>
                  </div>
                </Link>
              ))}
              <Button asChild variant="ghost" size="1"><a href="#/approvals">Open queue</a></Button>
            </Flex></div>
          )}
        </div>
      </Grid>
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
    <Grid columns={{ initial: '1', lg: '1fr 1fr' }} gap="4">
      <div className="card">
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">My tasks</Text>
          <Button asChild variant="ghost" size="1"><a href="#/tasks"><IconArrowRight className="ic ic--sm" />All tasks</a></Button>
        </div>
        {myTasks.length === 0 ? (
          <div className="card__body">
            <Text as="div" size="2" color="gray" align="center" style={{ padding: '30px 0' }}>
              You haven't started any tasks. <Link to="/tasks/new"><Text color="blue">Create one →</Text></Link>
            </Text>
          </div>
        ) : (
          <div>
            {myTasks.map(t => (
              <Link key={t.id} to={`/tasks/${t.id}`} className="agent-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) 120px 80px 20px' }}>
                <div style={{ minWidth: 0 }}>
                  <Text as="div" size="2" className="truncate">
                    {t.title ?? <Text color="gray">untitled</Text>}
                  </Text>
                  <Text as="div" size="1" color="gray" mt="1">
                    {t.id} · {ago(t.updated_at)}
                  </Text>
                </div>
                <Status status={t.status} />
                <Badge color="gray" variant="soft" radius="full" size="1">{t.type.replace('_', ' ')}</Badge>
                <IconArrowRight className="ic" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">My approval requests</Text></div>
        {myApprovals.length === 0 ? (
          <div className="card__body">
            <Text as="div" size="2" color="gray" style={{ padding: '14px 0' }}>
              You haven't triggered any approvals.
            </Text>
          </div>
        ) : (
          <div className="card__body"><Flex direction="column" gap="2">
            {myApprovals.slice(0, 6).map(a => (
              <Link key={a.id} to={`/approvals/${a.id}`} className="card" style={{ display: 'block', background: 'var(--gray-3)' }}>
                <div style={{ padding: '10px 12px' }}>
                  <Flex align="center" justify="between" gap="3" mb="1">
                    <Code variant="ghost" size="1" color="gray">{a.id}</Code>
                    <Status status={a.status} />
                  </Flex>
                  <Text as="div" size="1" weight="medium" className="truncate">{a.requested_action}</Text>
                  <Text as="div" size="1" color="gray" mt="1">
                    {ago(a.created_at)}
                  </Text>
                </div>
              </Link>
            ))}
          </Flex></div>
        )}
      </div>
    </Grid>
  )
}

