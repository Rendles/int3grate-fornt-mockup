import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Code, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, Status, InfoHint, Pagination } from '../components/common'
import { Banner, EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconApproval, IconArrowRight, IconCheck, IconX } from '../components/icons'
import { Link, useRouter } from '../router'
import { api } from '../lib/api'
import type { ApprovalRequest, ApprovalStatus } from '../lib/types'
import { ago } from '../lib/format'

type StatusFilter = ApprovalStatus | 'all'
const STATUSES: StatusFilter[] = ['all', 'pending', 'approved', 'rejected', 'expired', 'cancelled']

export default function ApprovalsScreen() {
  const { navigate } = useRouter()
  const [approvals, setApprovals] = useState<ApprovalRequest[] | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    let cancelled = false
    api.listApprovals(statusFilter === 'all' ? undefined : { status: statusFilter })
      .then(list => {
        if (cancelled) return
        setApprovals(list)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load approvals')
      })
    return () => { cancelled = true }
  }, [statusFilter, reloadTick])

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
          {STATUSES.map(f => (
            <Badge
              key={f}
              asChild
              color={statusFilter === f ? (f === 'pending' ? 'amber' : 'blue') : 'gray'}
              variant={statusFilter === f ? 'soft' : 'outline'}
              radius="full"
              size="1"
            >
              <button type="button" onClick={() => { setStatusFilter(f); setPage(0) }}>
                {f}{' '}
                <Code variant="ghost" style={{ color: 'var(--gray-10)' }}>{counts[f] ?? 0}</Code>
              </button>
            </Badge>
          ))}
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
          <div className="card" style={{ padding: 0 }}>
            <div style={{
              padding: '10px 16px',
              background: 'var(--gray-3)',
              borderBottom: '1px solid var(--gray-6)',
              display: 'grid',
              gridTemplateColumns: '130px minmax(0, 1fr) 160px 130px 120px 120px 28px',
              gap: 14,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}>
              <Text as="span" size="1" color="gray">id · created</Text>
              <Text as="span" size="1" color="gray">requested action</Text>
              <Text as="span" size="1" color="gray">requested by</Text>
              <Text as="span" size="1" color="gray">approver role</Text>
              <Text as="span" size="1" color="gray">status · expires</Text>
              <Text as="span" size="1" color="gray">quick decide</Text>
              <span />
            </div>
            {pageItems.map(a => {
              const isPending = a.status === 'pending'
              return (
                <Link
                  key={a.id}
                  to={`/approvals/${a.id}`}
                  className="agent-row"
                  style={{
                    gridTemplateColumns: '130px minmax(0, 1fr) 160px 130px 120px 120px 28px',
                  }}
                >
                  <div>
                    <Text as="div" size="1">{a.id}</Text>
                    <Text as="div" size="1" color="gray" mt="1">{ago(a.created_at)}</Text>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Text as="div" size="2" className="truncate">{a.requested_action}</Text>
                    <Text as="div" size="1" color="gray" mt="1">
                      run {a.run_id} · {a.task_id ? `task ${a.task_id}` : 'standalone'}
                    </Text>
                  </div>
                  <div>
                    <Text as="div" size="1">{a.requested_by_name ?? '—'}</Text>
                    <Text as="div" size="1" color="gray" mt="1">{a.requested_by ?? '—'}</Text>
                  </div>
                  <div>
                    <Badge color="gray" variant="soft" radius="full" size="1">{a.approver_role ?? '—'}</Badge>
                    {a.approver_user_id && (
                      <Text as="div" size="1" color="gray" mt="1">{a.approver_user_id}</Text>
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
