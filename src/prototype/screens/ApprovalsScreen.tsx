import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Code, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, Status, InfoHint, Pagination } from '../components/common'
import { Banner, EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconApproval, IconArrowRight, IconCheck, IconX } from '../components/icons'
import { Link, useRouter } from '../router'
import { api } from '../lib/api'
import { APPROVAL_STATUS_FILTERS } from '../lib/filters'
import type { ApprovalStatusFilter } from '../lib/filters'
import type { ApprovalRequest, User } from '../lib/types'
import { ago, approverRoleLabel, prettifyRequestedAction } from '../lib/format'

export default function ApprovalsScreen() {
  const { navigate } = useRouter()
  const [approvals, setApprovals] = useState<ApprovalRequest[] | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [statusFilter, setStatusFilter] = useState<ApprovalStatusFilter>('pending')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.listApprovals(statusFilter === 'all' ? undefined : { status: statusFilter }),
      api.listUsers(),
    ])
      .then(([list, u]) => {
        if (cancelled) return
        setApprovals(list.items)
        setUsers(u)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load approvals')
      })
    return () => { cancelled = true }
  }, [statusFilter, reloadTick])

  const userName = (id: string | null) =>
    (id && users.find(u => u.id === id)?.name) || null

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: approvals?.length ?? 0 }
    ;(approvals ?? []).forEach(a => { c[a.status] = (c[a.status] ?? 0) + 1 })
    return c
  }, [approvals])

  const pageStart = page * pageSize
  const pageItems = (approvals ?? []).slice(pageStart, pageStart + pageSize)

  const quickDecide = (id: string, decision: 'approved' | 'rejected') => {
    navigate(`/approvals/${id}?decide=${decision}`)
  }

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'approvals' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              APPROVALS{' '}
              <InfoHint>
                List from <Code variant="ghost">GET /approvals</Code>. Status filter is applied server-side. Decide via <Code variant="ghost">POST /approvals/{'{id}'}/decision</Code>.
              </InfoHint>
            </>
          }
          title={<>Decisions <em>owed.</em></>}
          subtitle="Approval requests created by the orchestrator when a policy or tool grant requires a human decision."
        />

        <PolicyBanner />

        <Flex align="center" gap="2" mb="4" wrap="wrap">
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
            title={statusFilter === 'pending' ? 'All caught up' : `No ${statusFilter === 'all' ? '' : statusFilter} approvals`}
          />
        ) : (
          <div className="card card--table">
            <div className="table-head" style={{ gridTemplateColumns: '110px minmax(0, 1fr) 160px 140px 130px 120px 28px' }}>
              <Text as="span" size="1" color="gray">created</Text>
              <Text as="span" size="1" color="gray">requested action</Text>
              <Text as="span" size="1" color="gray">requested by</Text>
              <Text as="span" size="1" color="gray">approver</Text>
              <Text as="span" size="1" color="gray">status · expires</Text>
              <Text as="span" size="1" color="gray">quick decide</Text>
              <span />
            </div>
            {pageItems.map(a => {
              const isPending = a.status === 'pending'
              const approverName = userName(a.approver_user_id)
              return (
                <Link
                  key={a.id}
                  to={`/approvals/${a.id}`}
                  className="agent-row"
                  style={{
                    gridTemplateColumns: '110px minmax(0, 1fr) 160px 140px 130px 120px 28px',
                  }}
                >
                  <Text as="div" size="1" color="gray">{ago(a.created_at)}</Text>
                  <Text as="div" size="2" className="truncate" style={{ minWidth: 0 }}>
                    {prettifyRequestedAction(a.requested_action)}
                  </Text>
                  <Text as="div" size="1" className="truncate">
                    {a.requested_by_name ?? userName(a.requested_by) ?? '—'}
                  </Text>
                  <div>
                    <Badge color="gray" variant="soft" radius="full" size="1">{approverRoleLabel(a.approver_role)}</Badge>
                    {approverName && (
                      <Text as="div" size="1" color="gray" mt="1" className="truncate">{approverName}</Text>
                    )}
                  </div>
                  <div>
                    <Status status={a.status} />
                    {isPending && a.expires_at ? (
                      <Text as="div" size="1" color="gray" mt="1">
                        expires {ago(a.expires_at)}
                      </Text>
                    ) : a.resolved_at ? (
                      <Text as="div" size="1" color="gray" mt="1">
                        resolved {ago(a.resolved_at)}
                      </Text>
                    ) : null}
                  </div>
                  <div>
                    {isPending ? (
                      <Flex align="center" gap="1">
                        <QuickActionButton
                          tone="success"
                          title="Approve"
                          onClick={() => quickDecide(a.id, 'approved')}
                          icon={<IconCheck />}
                        />
                        <QuickActionButton
                          tone="danger"
                          title="Reject"
                          onClick={() => quickDecide(a.id, 'rejected')}
                          icon={<IconX />}
                        />
                      </Flex>
                    ) : (
                      <Text size="1" color="gray">resolved</Text>
                    )}
                  </div>
                  <IconArrowRight className="ic" />
                </Link>
              )
            })}
            <Pagination
              page={page}
              pageSize={pageSize}
              total={approvals.length}
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
      <Banner tone="info" title="Approval is a policy, not an AI decision" icon={<IconApproval className="ic" />}>
        The orchestrator creates an approval request whenever a grant or rule requires a human decision. The agent doesn't choose — it's gated.
      </Banner>
    </Box>
  )
}

function QuickActionButton({
  tone, title, onClick, icon,
}: {
  tone: 'success' | 'danger'
  title: string
  onClick: () => void
  icon: React.ReactNode
}) {
  const color = tone === 'success' ? 'var(--green-11)' : 'var(--red-11)'
  const bg = tone === 'success' ? 'var(--green-a3)' : 'var(--red-a3)'
  const border = tone === 'success' ? 'var(--green-a6)' : 'var(--red-a6)'
  return (
    <button
      title={title}
      onClick={e => { e.preventDefault(); e.stopPropagation(); onClick() }}
      style={{
        width: 28,
        height: 28,
        borderRadius: 4,
        border: `1px solid ${border}`,
        background: bg,
        color,
        display: 'grid',
        placeItems: 'center',
        transition: 'transform 80ms, background 120ms',
      }}
    >
      {icon}
    </button>
  )
}
