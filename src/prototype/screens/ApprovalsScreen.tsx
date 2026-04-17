import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Chip, Status, Avatar } from '../components/common'
import { EmptyState, LoadingList } from '../components/states'
import { IconApproval, IconArrowRight, IconCheck, IconFilter, IconX } from '../components/icons'
import { Link, useRouter } from '../router'
import { api } from '../lib/api'
import type { ApprovalLevel, ApprovalRequest, ApprovalStatus } from '../lib/types'
import { ago, money } from '../lib/format'
import { allUsers } from '../lib/fixtures'

type StatusFilter = ApprovalStatus | 'all'
const STATUSES: StatusFilter[] = ['all', 'pending', 'approved', 'rejected', 'expired', 'cancelled']

type LevelFilter = ApprovalLevel | 'all'
const LEVELS: LevelFilter[] = ['all', 1, 2, 3, 4]

type DateFilter = 'any' | '24h' | '7d' | '30d'
const DATE_LABEL: Record<DateFilter, string> = { any: 'any time', '24h': 'last 24h', '7d': 'last 7d', '30d': 'last 30d' }

export default function ApprovalsScreen() {
  const { navigate } = useRouter()
  const [approvals, setApprovals] = useState<ApprovalRequest[] | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [requesterFilter, setRequesterFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('any')
  const [loadedAt, setLoadedAt] = useState<number>(0)
  const users = useMemo(() => allUsers(), [])

  useEffect(() => {
    api.listApprovals().then(list => {
      setApprovals(list)
      setLoadedAt(Date.now())
    })
  }, [])

  const agentOptions = useMemo(() => {
    const seen = new Map<string, string>()
    ;(approvals ?? []).forEach(a => {
      if (a.agent_id && a.agent_name) seen.set(a.agent_id, a.agent_name)
    })
    return Array.from(seen.entries())
  }, [approvals])

  const requesterOptions = useMemo(() => {
    const seen = new Map<string, string>()
    ;(approvals ?? []).forEach(a => seen.set(a.requested_by, a.requested_by_name))
    return Array.from(seen.entries())
  }, [approvals])

  const filtered = useMemo(() => {
    if (!approvals || !loadedAt) return []
    const dayMs = 86_400_000
    const cutoff = dateFilter === 'any'
      ? 0
      : loadedAt - (dateFilter === '24h' ? dayMs : dateFilter === '7d' ? 7 * dayMs : 30 * dayMs)
    return approvals.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (agentFilter !== 'all' && a.agent_id !== agentFilter) return false
      if (levelFilter !== 'all' && a.required_approver_level !== levelFilter) return false
      if (requesterFilter !== 'all' && a.requested_by !== requesterFilter) return false
      if (cutoff > 0 && new Date(a.created_at).getTime() < cutoff) return false
      return true
    })
  }, [approvals, statusFilter, agentFilter, levelFilter, requesterFilter, dateFilter, loadedAt])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: approvals?.length ?? 0 }
    ;(approvals ?? []).forEach(a => { c[a.status] = (c[a.status] ?? 0) + 1 })
    return c
  }, [approvals])

  const hasOtherFilters = agentFilter !== 'all' || levelFilter !== 'all' || requesterFilter !== 'all' || dateFilter !== 'any'
  const clearOtherFilters = () => {
    setAgentFilter('all')
    setLevelFilter('all')
    setRequesterFilter('all')
    setDateFilter('any')
  }

  const quickDecide = (id: string, decision: 'approve' | 'reject') => {
    navigate(`/approvals/${id}?decide=${decision}`)
  }

  return (
    <AppShell crumbs={[{ label: 'app', to: '/' }, { label: 'approvals' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow="APPROVALS"
          title={<>Decisions <em>owed.</em></>}
          subtitle="Approvals are triggered by grants and the approval rules on the active version — not by the agent. When a tool or condition requires sign-off, the run suspends and the request lands here."
        />

        <PolicyBanner />

        {/* Status row */}
        <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
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

        {/* Additional filters */}
        <div className="row" style={{ gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="mono uppercase muted" style={{ marginRight: 4 }}>
            <IconFilter className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />
            filters
          </span>
          <select
            className="select"
            style={{ fontSize: 11, padding: '4px 22px 4px 8px', width: 180 }}
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
          >
            <option value="all">agent · all</option>
            {agentOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select
            className="select"
            style={{ fontSize: 11, padding: '4px 22px 4px 8px', width: 170 }}
            value={requesterFilter}
            onChange={e => setRequesterFilter(e.target.value)}
          >
            <option value="all">requester · all</option>
            {requesterOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <div className="row row--sm">
            <span className="mono uppercase muted" style={{ fontSize: 9.5 }}>level</span>
            {LEVELS.map(l => (
              <button
                key={String(l)}
                className={`chip${levelFilter === l ? ' chip--accent' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setLevelFilter(l)}
              >
                {l === 'all' ? 'all' : `L${l}`}
              </button>
            ))}
          </div>
          <div className="row row--sm">
            <span className="mono uppercase muted" style={{ fontSize: 9.5 }}>date</span>
            {(Object.keys(DATE_LABEL) as DateFilter[]).map(d => (
              <button
                key={d}
                className={`chip${dateFilter === d ? ' chip--accent' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setDateFilter(d)}
              >
                {DATE_LABEL[d]}
              </button>
            ))}
          </div>
          {hasOtherFilters && (
            <button
              className="mono"
              style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}
              onClick={clearOtherFilters}
            >
              clear filters
            </button>
          )}
        </div>

        <div style={{ height: 16 }} />

        {!approvals ? (
          <LoadingList rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconApproval />}
            title={statusFilter === 'pending' ? 'All caught up' : `No ${statusFilter === 'all' ? '' : statusFilter} approvals match these filters`}
            body={statusFilter === 'pending' ? 'The approval queue is clear. When an agent requests a gated action, it lands here.' : 'Loosen the filters or switch the status tab.'}
          />
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div style={{
              padding: '10px 16px',
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: '110px minmax(0, 1fr) 140px 140px 120px 110px 140px 28px',
              gap: 14,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}>
              <span>id · created</span>
              <span>action summary</span>
              <span>requester</span>
              <span>approver · level</span>
              <span>status</span>
              <span>value / risk</span>
              <span>quick decide</span>
              <span />
            </div>
            {filtered.map(a => {
              const requester = users.find(u => u.id === a.requested_by)
              const approver = users.find(u => u.id === a.approver_user_id)
              const isPending = a.status === 'pending'
              return (
                <Link
                  key={a.id}
                  to={`/approvals/${a.id}`}
                  className="agent-row"
                  style={{
                    gridTemplateColumns: '110px minmax(0, 1fr) 140px 140px 120px 110px 140px 28px',
                    borderLeft: isPending
                      ? `3px solid ${a.risk === 'high' ? 'var(--danger)' : a.risk === 'medium' ? 'var(--warn)' : 'var(--border-2)'}`
                      : '3px solid transparent',
                  }}
                >
                  <div>
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--text)' }}>{a.id.toUpperCase()}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>{ago(a.created_at)}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 13, color: 'var(--text)' }}>{a.requested_action}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {a.agent_name && <span>{a.agent_name}</span>}
                      {a.tool_name && <> · <span style={{ color: 'var(--text-dim)' }}>{a.tool_name}</span></>}
                    </div>
                  </div>
                  <div className="row row--sm">
                    <Avatar initials={requester?.initials ?? 'U'} tone={requester?.avatar_tone ?? 'accent'} size={18} />
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.requested_by_name}</span>
                  </div>
                  <div>
                    {approver ? (
                      <div className="row row--sm">
                        <Avatar initials={approver.initials ?? 'U'} tone={approver.avatar_tone ?? 'accent'} size={18} />
                        <span style={{ fontSize: 12 }}>{approver.name.split(' ')[0]}</span>
                      </div>
                    ) : (
                      <span className="mono muted" style={{ fontSize: 11 }}>unassigned</span>
                    )}
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                      {a.approver_role} · L{a.required_approver_level ?? '?'}
                    </div>
                  </div>
                  <div>
                    <Status status={a.status} />
                    {isPending ? (
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>
                        expires {ago(a.expires_at)}
                      </div>
                    ) : (
                      a.resolved_at && (
                        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>
                          resolved {ago(a.resolved_at)}
                        </div>
                      )
                    )}
                  </div>
                  <div>
                    {a.monetary_value_usd != null && (
                      <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>
                        {money(a.monetary_value_usd)}
                      </div>
                    )}
                    {a.risk && (
                      <Chip tone={a.risk === 'high' ? 'danger' : a.risk === 'medium' ? 'warn' : 'ghost'}>{a.risk}</Chip>
                    )}
                  </div>
                  <div>
                    {isPending ? (
                      <div className="row row--sm" style={{ gap: 4 }}>
                        <QuickActionButton
                          tone="success"
                          title="Approve"
                          onClick={() => quickDecide(a.id, 'approve')}
                          icon={<IconCheck />}
                        />
                        <QuickActionButton
                          tone="danger"
                          title="Reject"
                          onClick={() => quickDecide(a.id, 'reject')}
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

        <div style={{ height: 20 }} />
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'right' }}>
          endpoint · <span className="accent">GET /approvals</span> · decide via <span className="accent">POST /approvals/{'{approvalId}'}/decision</span>
        </div>
      </div>
    </AppShell>
  )
}

function PolicyBanner() {
  return (
    <div className="banner banner--info" style={{ marginBottom: 20 }}>
      <span className="banner__icon">
        <IconApproval className="ic" />
      </span>
      <div style={{ flex: 1 }}>
        <div className="banner__title">Approval is a policy, not an AI decision</div>
        <div className="banner__body">
          Every request here was triggered because a human set <span className="mono">approval_required = true</span> on a ToolGrant or wrote a rule on the active agent version. The agent doesn't choose whether to ask — the orchestrator enforces it.
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
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.07)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {icon}
    </button>
  )
}

