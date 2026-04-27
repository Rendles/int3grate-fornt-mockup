import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Code } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader, InfoHint } from '../components/common'
import { ErrorState, LoadingList } from '../components/states'
import { IconChat } from '../components/icons'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent, ApprovalRequest, SpendDashboard, Task } from '../lib/types'
import { AdminView } from './home/AdminView'
import { MemberView } from './home/MemberView'

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
      setTasks(t.items)
      setApprovals(a.items)
      setAgents(ag.items)
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
              <Button asChild variant="soft" color="gray"><a href="#/approvals">Approvals</a></Button>
              <Button asChild><a href="#/chats/new"><IconChat />Start a chat</a></Button>
            </>
          }
        />

        {loading ? (
          <Box mt="5"><LoadingList rows={8} /></Box>
        ) : isMember ? (
          <MemberView
            myTasks={myTasks}
            myApprovals={myApprovalRequests}
            agents={agents!}
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
