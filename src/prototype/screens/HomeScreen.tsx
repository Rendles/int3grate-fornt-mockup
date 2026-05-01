import { useEffect, useMemo, useState } from 'react'
import { Box, Button } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader } from '../components/common'
import { ErrorState, LoadingList } from '../components/states'
import { IconChat } from '../components/icons'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent, ApprovalRequest, RunListItem, SpendDashboard } from '../lib/types'
import { AdminView } from './home/AdminView'

export default function HomeScreen() {
  const { user } = useAuth()

  const [approvals, setApprovals] = useState<ApprovalRequest[] | null>(null)
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [spend, setSpend] = useState<SpendDashboard | null>(null)
  const [recentRuns, setRecentRuns] = useState<RunListItem[] | null>(null)
  const [errored, setErrored] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const [a, ag, s, r] = await Promise.all([
        api.listApprovals(),
        api.listAgents(),
        api.getSpend('7d', 'agent'),
        api.listRuns({ limit: 5 }),
      ])
      if (cancelled) return
      setErrored(false)
      setApprovals(a.items)
      setAgents(ag.items)
      setSpend(s)
      setRecentRuns(r.items)
    }
    run().catch(() => { if (!cancelled) setErrored(true) })
    return () => { cancelled = true }
  }, [reloadKey])

  const loading = !errored && (!approvals || !agents || !spend || !recentRuns)

  const nowDate = new Date()

  const pendingApprovals = useMemo(
    () => (approvals ?? []).filter(a => a.status === 'pending'),
    [approvals],
  )
  const activeAgents = useMemo(
    () => (agents ?? []).filter(a => a.status === 'active'),
    [agents],
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
          eyebrow={nowDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
          title={<>Good {nowDate.getHours() < 12 ? 'morning' : nowDate.getHours() < 18 ? 'afternoon' : 'evening'}, <em>{user?.name.split(' ')[0]}.</em></>}
          subtitle="Team-wide counts, live approvals, and spend this week."
          actions={
            <>
              <Button asChild variant="soft" color="gray"><a href="#/approvals">Approvals</a></Button>
              <Button asChild><a href="#/chats/new"><IconChat />Start a chat</a></Button>
            </>
          }
        />

        {loading ? (
          <Box mt="5"><LoadingList rows={8} /></Box>
        ) : (
          <AdminView
            agents={agents!}
            activeAgents={activeAgents}
            pendingApprovals={pendingApprovals}
            recentRuns={recentRuns!}
            spend={spend!}
          />
        )}
      </div>
    </AppShell>
  )
}
