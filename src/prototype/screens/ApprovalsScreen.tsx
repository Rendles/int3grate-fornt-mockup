import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Code, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Avatar, Caption, PageHeader, Status, Pagination } from '../components/common'
import { Banner, EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconApproval, IconArrowRight } from '../components/icons'
import { Link } from '../router'
import { api } from '../lib/api'
import { APPROVAL_STATUS_FILTERS } from '../lib/filters'
import type { ApprovalStatusFilter } from '../lib/filters'
import type { Agent, ApprovalRequest, RunListItem } from '../lib/types'
import { ago, prettifyRequestedAction } from '../lib/format'

// Default sort: oldest first. Plan section 7.2 — supervisor should never see
// stale requests pile up at the bottom of the list. The API returns newest
// first; we reverse on the client.
function sortOldestFirst(items: ApprovalRequest[]): ApprovalRequest[] {
  return [...items].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export default function ApprovalsScreen() {
  const [approvals, setApprovals] = useState<ApprovalRequest[] | null>(null)
  const [runs, setRuns] = useState<RunListItem[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [statusFilter, setStatusFilter] = useState<ApprovalStatusFilter>('pending')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.listApprovals(statusFilter === 'all' ? undefined : { status: statusFilter }),
      api.listRuns({ limit: 100 }),
      api.listAgents(),
    ])
      .then(([list, r, a]) => {
        if (cancelled) return
        setApprovals(list.items)
        setRuns(r.items)
        setAgents(a.items)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load approvals')
      })
    return () => { cancelled = true }
  }, [statusFilter, reloadTick])

  // run_id → agent_id → agent.name. Lets us name the agent that triggered
  // each approval without an N+1 fetch.
  const agentNameByRun = useMemo(() => {
    const m = new Map<string, string>()
    const byAgent = new Map<string, Agent>()
    for (const a of agents) byAgent.set(a.id, a)
    for (const r of runs) {
      if (!r.agent_id) continue
      const a = byAgent.get(r.agent_id)
      if (a) m.set(r.id, a.name)
    }
    return m
  }, [runs, agents])

  const sorted = useMemo(
    () => sortOldestFirst(approvals ?? []),
    [approvals],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: approvals?.length ?? 0 }
    ;(approvals ?? []).forEach(a => { c[a.status] = (c[a.status] ?? 0) + 1 })
    return c
  }, [approvals])

  const pageStart = page * pageSize
  const pageItems = sorted.slice(pageStart, pageStart + pageSize)

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'approvals' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow="APPROVALS"
          title={<>Pending <em>approvals.</em></>}
          subtitle="Actions your agents want to take that need your approval."
        />

        <PolicyBanner />

        <Flex align="center" gap="2" mb="4" wrap="wrap" data-tour="approvals-filter">
          <Caption mr="1">status</Caption>
          {APPROVAL_STATUS_FILTERS.map(f => {
            const isActive = statusFilter === f
            const activeColor = f === 'pending' ? 'amber' : 'blue'
            return (
              <Button
                key={f}
                type="button"
                size="2"
                variant="soft"
                color={isActive ? activeColor : 'gray'}
                onClick={() => { setStatusFilter(f); setPage(0) }}
              >
                <span style={{ textTransform: 'capitalize' }}>{f}</span>
                <Code variant="ghost" size="1" color="gray">{counts[f] ?? 0}</Code>
              </Button>
            )
          })}
        </Flex>

        {error ? (
          <ErrorState
            title="Couldn't load approvals"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : !approvals ? (
          <LoadingList rows={4} />
        ) : approvals.length === 0 ? (
          <EmptyState
            icon={<IconApproval />}
            title={statusFilter === 'pending' ? 'All caught up' : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}approval requests`}
            body={
              statusFilter === 'pending'
                ? 'Nothing is waiting for your decision. We\'ll show requests here when an agent wants to do something that needs your sign-off.'
                : 'Switch the filter to Pending to see what\'s waiting on you right now.'
            }
          />
        ) : (
          <div className="card card--flush">
            <Flex direction="column">
              {pageItems.map((a, i) => (
                <Link
                  key={a.id}
                  to={`/approvals/${a.id}`}
                  data-tour="approval-row"
                  className="agent-row"
                  style={{
                    gridTemplateColumns: 'auto minmax(0, 1fr) 100px 110px 24px',
                    gap: '14px',
                    alignItems: 'center',
                    borderBottom: i === pageItems.length - 1 ? 0 : '1px solid var(--gray-a3)',
                  }}
                >
                  <Avatar
                    initials={(agentNameByRun.get(a.run_id) ?? 'AG').slice(0, 2).toUpperCase()}
                    size={32}
                  />
                  <Box minWidth="0">
                    <Text as="div" size="2" weight="medium" className="truncate">
                      {agentNameByRun.get(a.run_id) ?? 'Agent'}
                      <Text as="span" size="2" color="gray">
                        {' '}wants to{' '}
                      </Text>
                      <Text as="span" size="2" className="truncate">
                        {prettifyRequestedAction(a.requested_action).toLowerCase()}
                      </Text>
                    </Text>
                    {a.requested_by_name && (
                      <Text as="div" size="1" color="gray" mt="1">
                        Triggered by {a.requested_by_name}
                      </Text>
                    )}
                  </Box>
                  <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>
                    {ago(a.created_at)}
                  </Text>
                  <Status status={a.status} />
                  <IconArrowRight className="ic" />
                </Link>
              ))}
            </Flex>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={sorted.length}
              onPageChange={setPage}
              onPageSizeChange={n => { setPageSize(n); setPage(0) }}
              label="approvals"
            />
          </div>
        )}

      </div>
    </AppShell>
  )
}

function PolicyBanner() {
  return (
    <Box mb="4">
      <Banner tone="info" title="Approval is your call, not the agent's" icon={<IconApproval className="ic" />}>
        An approval request appears whenever a permission or rule says a human has to decide. Your agents can't bypass it — every important action goes to you.
      </Banner>
    </Box>
  )
}
