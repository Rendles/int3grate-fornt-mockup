import { useEffect, useMemo, useState } from 'react'
import { Code, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader, Chip, Status, InfoHint, Pagination } from '../components/common'
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

        <div className="row" style={{ gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <Text size="1" color="gray" className="uppercase" style={{ marginRight: 4 }}>status</Text>
          {STATUSES.map(f => (
            <button
              key={f}
              className={`chip${statusFilter === f ? (f === 'pending' ? ' chip--warn' : ' chip--accent') : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => { setStatusFilter(f); setPage(0) }}
            >
              {f}{' '}
              <Code variant="ghost" style={{ color: 'var(--gray-10)' }}>{counts[f] ?? 0}</Code>
            </button>
          ))}
        </div>

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
              fontFamily: 'var(--code-font-family)',
              fontSize: 10,
              color: 'var(--gray-10)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}>
              <span>id · created</span>
              <span>requested action</span>
              <span>requested by</span>
              <span>approver role</span>
              <span>status · expires</span>
              <span>quick decide</span>
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
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--gray-12)' }}>{a.id}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 2 }}>{ago(a.created_at)}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 13, color: 'var(--gray-12)' }}>{a.requested_action}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 2 }}>
                      run {a.run_id} · {a.task_id ? `task ${a.task_id}` : 'standalone'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>{a.requested_by_name ?? '—'}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 2 }}>{a.requested_by ?? '—'}</div>
                  </div>
                  <div>
                    <Chip>{a.approver_role ?? '—'}</Chip>
                    {a.approver_user_id && (
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 4 }}>{a.approver_user_id}</div>
                    )}
                  </div>
                  <div>
                    <Status status={a.status} />
                    {isPending && a.expires_at ? (
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 4 }}>
                        expires {ago(a.expires_at)}
                      </div>
                    ) : a.resolved_at ? (
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 4 }}>
                        resolved {ago(a.resolved_at)}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    {isPending ? (
                      <div className="row row--sm" style={{ gap: 4 }}>
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
                      </div>
                    ) : (
                      <span className="mono muted" style={{ fontSize: 10.5 }}>resolved</span>
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
    <div style={{ marginBottom: 16 }}>
      <Banner tone="info" title="Approval is a policy, not an AI decision" icon={<IconApproval className="ic" />}>
        The orchestrator creates an approval request whenever a grant or rule requires a human decision. The agent doesn't choose — it's gated.
      </Banner>
    </div>
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
