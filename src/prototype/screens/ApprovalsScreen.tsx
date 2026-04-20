import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Chip, Status, InfoHint } from '../components/common'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
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
                List from <span className="mono">GET /approvals</span>. Status filter is applied server-side. Decide via <span className="mono">POST /approvals/{'{id}'}/decision</span>.
              </InfoHint>
            </>
          }
          title={<>Decisions <em>owed.</em></>}
          subtitle="Approval requests created by the orchestrator when a policy or tool grant requires a human decision."
        />

        <PolicyBanner />

        <div className="row" style={{ gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <span className="mono uppercase muted" style={{ marginRight: 4 }}>status</span>
          {STATUSES.map(f => (
            <button
              key={f}
              className={`chip${statusFilter === f ? (f === 'pending' ? ' chip--warn' : ' chip--accent') : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setStatusFilter(f)}
            >
              {f}{' '}
              <span className="mono" style={{ color: 'var(--text-dim)' }}>{counts[f] ?? 0}</span>
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
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: '130px minmax(0, 1fr) 160px 130px 120px 120px 28px',
              gap: 14,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-dim)',
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
            {approvals.map(a => {
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
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--text)' }}>{a.id}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>{ago(a.created_at)}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 13, color: 'var(--text)' }}>{a.requested_action}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                      run {a.run_id} · task {a.task_id}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12 }}>{a.requested_by_name ?? '—'}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>{a.requested_by ?? '—'}</div>
                  </div>
                  <div>
                    <Chip>{a.approver_role ?? '—'}</Chip>
                    {a.approver_user_id && (
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>{a.approver_user_id}</div>
                    )}
                  </div>
                  <div>
                    <Status status={a.status} />
                    {isPending && a.expires_at ? (
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>
                        expires {ago(a.expires_at)}
                      </div>
                    ) : a.resolved_at ? (
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>
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
          </div>
        )}

      </div>
    </AppShell>
  )
}

function PolicyBanner() {
  return (
    <div className="banner banner--info" style={{ marginBottom: 16 }}>
      <span className="banner__icon"><IconApproval className="ic" /></span>
      <div style={{ flex: 1 }}>
        <div className="banner__title">Approval is a policy, not an AI decision</div>
        <div className="banner__body">
          The orchestrator creates an approval request whenever a grant or rule requires a human decision. The agent doesn't choose — it's gated.
        </div>
      </div>
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
  const color = tone === 'success' ? 'var(--success)' : 'var(--danger)'
  const bg = tone === 'success' ? 'var(--success-soft)' : 'var(--danger-soft)'
  const border = tone === 'success' ? 'var(--success-border)' : 'var(--danger-border)'
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
