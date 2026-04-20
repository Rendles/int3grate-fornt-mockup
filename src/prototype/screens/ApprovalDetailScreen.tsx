import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status, Avatar, CommandBar, MockBadge, BackendGapBanner } from '../components/common'
import { Banner, LoadingList, NoAccessState } from '../components/states'
import {
  IconAlert,
  IconApproval,
  IconArrowRight,
  IconCheck,
  IconLock,
  IconPause,
  IconPlay,
  IconStop,
  IconX,
} from '../components/icons'
import { Link, useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { ApprovalRequest } from '../lib/types'
import { ago, absTime, money } from '../lib/format'
import { allUsers } from '../lib/fixtures'

type Decision = 'approve' | 'reject'

function isHighRisk(a: ApprovalRequest): boolean {
  if (a.risk === 'high') return true
  if ((a.monetary_value_usd ?? 0) >= 1000) return true
  // write actions on sensitive categories (infra, payments) with no explicit risk
  return false
}

export default function ApprovalDetailScreen({ approvalId }: { approvalId: string }) {
  const { user } = useAuth()
  const { search } = useRouter()
  const [approval, setApproval] = useState<ApprovalRequest | null | undefined>(undefined)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  const [reasonTouched, setReasonTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ApprovalRequest | null>(null)
  const users = useMemo(() => allUsers(), [])

  useEffect(() => {
    let cancelled = false
    api.getApproval(approvalId).then(a => {
      if (cancelled) return
      setApproval(a ?? null)
      if (a?.status === 'pending') {
        const d = search.get('decide')
        if (d === 'approve' || d === 'reject') {
          setDecision(d)
          setReason('')
          setReasonTouched(false)
        }
      }
    })
    return () => { cancelled = true }
  }, [approvalId, search])

  if (approval === null) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'approvals', to: '/approvals' }, { label: 'not found' }]}>
        <div className="page"><NoAccessState requiredRole="visibility into this approval" body={`Approval ${approvalId} could not be loaded.`} /></div>
      </AppShell>
    )
  }
  if (approval === undefined) {
    return <AppShell crumbs={[{ label: '...', to: '/' }]}><div className="page"><LoadingList rows={4} /></div></AppShell>
  }

  const requester = users.find(u => u.id === approval.requested_by)
  const approver = users.find(u => u.id === approval.approver_user_id)
  const highRisk = isHighRisk(approval)
  const userCanDecide =
    approval.status === 'pending' &&
    !!user &&
    user.approval_level >= (approval.required_approver_level ?? 3)

  const reasonRequired = decision === 'reject' || (decision === 'approve' && highRisk)
  const reasonInvalid = reasonRequired && reasonTouched && reason.trim().length < 4
  const canSubmit = decision !== null && (!reasonRequired || reason.trim().length >= 4) && !busy

  const doDecide = async () => {
    setReasonTouched(true)
    if (!decision || !user) return
    if (reasonRequired && reason.trim().length < 4) return

    setBusy(true)
    setSaveError(null)
    setConflict(null)
    try {
      // Re-check server state before sending — if someone else resolved it meanwhile, surface a conflict state.
      const fresh = await api.getApproval(approvalId)
      if (fresh && fresh.status !== 'pending') {
        setConflict(fresh)
        setApproval(fresh)
        setDecision(null)
        setBusy(false)
        return
      }
      const updated = await api.decideApproval(approval.id, decision, reason, user.id)
      setApproval(updated)
      setDecision(null)
      setReason('')
      setReasonTouched(false)
    } catch (e) {
      const err = e as Error & { code?: string; current?: ApprovalRequest }
      if (err.code === 'already_resolved' && err.current) {
        setConflict(err.current)
        setApproval(err.current)
        setDecision(null)
      } else {
        setSaveError(err.message ?? 'Failed to submit decision')
      }
    } finally {
      setBusy(false)
    }
  }

  const cancelDecision = () => {
    setDecision(null)
    setReason('')
    setReasonTouched(false)
    setSaveError(null)
  }

  return (
    <AppShell
      crumbs={[
        { label: 'home', to: '/' },
        { label: 'approvals', to: '/approvals' },
        { label: approval.id.toUpperCase() },
      ]}
    >
      <div className="page page--narrow">
        <PageHeader
          eyebrow={<>{`APPROVAL · ${approval.id.toUpperCase()}`}</>}
          title={<>{approval.requested_action}</>}
          subtitle={approval.policy_reason}
          actions={
            <>
              <Status status={approval.status} />
              {approval.risk && (
                <span className="row row--sm">
                  <Chip tone={approval.risk === 'high' ? 'danger' : approval.risk === 'medium' ? 'warn' : 'ghost'}>{approval.risk} risk</Chip>
                  <MockBadge size="xs" />
                </span>
              )}
              {approval.monetary_value_usd != null && (
                <span className="row row--sm">
                  <Chip tone="accent">{money(approval.monetary_value_usd)}</Chip>
                  <MockBadge size="xs" />
                </span>
              )}
              <Btn variant="ghost" size="sm" href={`/runs/${approval.run_id}`}>
                Open run <IconArrowRight className="ic ic--sm" />
              </Btn>
              <Btn variant="ghost" size="sm" href={`/tasks/${approval.task_id}`}>
                Open task <IconArrowRight className="ic ic--sm" />
              </Btn>
              <Btn variant="ghost" size="sm" href="/approvals">Back to inbox</Btn>
            </>
          }
        />

        <BackendGapBanner
          title="Context fields here aren't on the ApprovalRequest schema"
          fields={[
            'policy_reason',
            'impact_scope',
            'required_approver_level',
            'risk chip',
            'monetary_value_usd',
            'agent_id / agent_name',
            'tool_name',
            'payload key-value diff (evidence_ref is just an object ref)',
          ]}
          body={<>Backend returns <span className="mono">requested_action, requested_by, approver_role, status, reason, evidence_ref, expires_at, resolved_at</span>. Everything else is invented for the mockup so the operator has a full decision surface.</>}
        />

        <CommandBar
          parts={[
            { label: 'APPROVAL', value: approval.id },
            { label: 'RUN', value: approval.run_id, tone: 'accent' },
            { label: 'TASK', value: approval.task_id },
            { label: 'NEEDS', value: `${approval.approver_role} · L${approval.required_approver_level ?? '?'}` },
            ...(approval.status === 'pending' ? [{ label: 'EXPIRES', value: ago(approval.expires_at), tone: 'warn' as const }] : []),
            ...(approval.resolved_at ? [{ label: 'RESOLVED', value: absTime(approval.resolved_at) }] : []),
          ]}
        />

        <div style={{ height: 20 }} />

        {/* Conflict — someone else already resolved while we were deciding */}
        {conflict && (
          <>
            <div className="banner banner--warn" role="alert" style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-soft)' }}>
              <span className="banner__icon"><IconAlert className="ic" style={{ color: 'var(--danger)' }} /></span>
              <div style={{ flex: 1 }}>
                <div className="banner__title" style={{ color: 'var(--danger)' }}>
                  Already resolved · {conflict.status}
                </div>
                <div className="banner__body">
                  Another approver decided this request while you were reviewing. Your decision was not submitted.
                  {conflict.approver_user_id && (
                    <> Decided by <strong>{users.find(u => u.id === conflict.approver_user_id)?.name ?? conflict.approver_user_id}</strong> at {absTime(conflict.resolved_at)}.</>
                  )}
                </div>
              </div>
              <Btn variant="ghost" onClick={() => setConflict(null)}>Dismiss</Btn>
            </div>
            <div style={{ height: 16 }} />
          </>
        )}

        {approval.status === 'pending' && user && !userCanDecide && (
          <>
            <Banner tone="warn" title="You can't decide this request">
              <>
                You are <Chip>L{user.approval_level}</Chip> but this request needs <Chip>L{approval.required_approver_level}</Chip> or higher
                {approval.approver_role ? <> (<Chip>{approval.approver_role}</Chip>)</> : ''}. Routing it to {approver?.name ?? 'an eligible approver'}.
              </>
            </Banner>
            <div style={{ height: 16 }} />
          </>
        )}

        {/* Pending · action panel */}
        {approval.status === 'pending' && userCanDecide && !decision && (
          <DecisionIntroCard
            approval={approval}
            highRisk={highRisk}
            onApprove={() => setDecision('approve')}
            onReject={() => setDecision('reject')}
          />
        )}

        {/* Pending · confirm pane */}
        {approval.status === 'pending' && userCanDecide && decision && (
          <DecisionConfirmCard
            approval={approval}
            decision={decision}
            reason={reason}
            reasonRequired={reasonRequired}
            reasonInvalid={!!reasonInvalid}
            user={user!}
            busy={busy}
            canSubmit={canSubmit}
            saveError={saveError}
            onChangeReason={v => { setReason(v); setReasonTouched(true) }}
            onBlurReason={() => setReasonTouched(true)}
            onCancel={cancelDecision}
            onConfirm={doDecide}
            onSwitch={d => { setDecision(d); setReason(''); setReasonTouched(false); setSaveError(null) }}
          />
        )}

        {/* Resolved state */}
        {approval.status !== 'pending' && !conflict && (
          <ResolvedCard approval={approval} decider={approver} />
        )}

        <div style={{ height: 20 }} />

        {/* Evidence & context */}
        <div className="card">
          <div className="card__head">
            <div className="card__title">Requested action</div>
            {approval.tool_name && <Chip>tool · <span className="mono">{approval.tool_name}</span></Chip>}
          </div>
          <div className="card__body">
            <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>
              {approval.requested_action}
            </div>
            {approval.impact_scope && (
              <>
                <div className="row row--sm" style={{ marginBottom: 4 }}>
                  <span className="mono uppercase muted">Impact scope</span>
                  <MockBadge size="xs" />
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>{approval.impact_scope}</div>
              </>
            )}
            {approval.payload && Object.keys(approval.payload).length > 0 && (
              <>
                <div className="mono uppercase muted" style={{ marginBottom: 6 }}>
                  Evidence · <span className="mono" style={{ color: 'var(--text)' }}>{approval.evidence_ref ?? 'payload'}</span>
                </div>
                <div className="approval__diff">
                  {Object.entries(approval.payload).map(([k, v]) => (
                    <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10, padding: '2px 0' }}>
                      <span style={{ color: 'var(--text-dim)' }}>{k}</span>
                      <span style={{ color: 'var(--text)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head"><div className="card__title">Context</div></div>
          <div className="card__body">
            <div className="grid grid--2" style={{ gap: 16 }}>
              <div>
                <div className="mono uppercase muted" style={{ marginBottom: 4 }}>Requested by</div>
                <div className="row row--sm">
                  <Avatar initials={requester?.initials ?? 'U'} tone={requester?.avatar_tone ?? 'accent'} size={22} />
                  <span>{approval.requested_by_name}</span>
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  {absTime(approval.created_at)}
                </div>
              </div>
              <div>
                <div className="mono uppercase muted" style={{ marginBottom: 4 }}>Needs approver</div>
                {approver ? (
                  <div className="row row--sm">
                    <Avatar initials={approver.initials ?? '?'} tone={approver.avatar_tone ?? 'accent'} size={22} />
                    <span>{approver.name}</span>
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>Any {approval.approver_role} · L{approval.required_approver_level}</div>
                )}
              </div>
              <div>
                <div className="row row--sm" style={{ marginBottom: 4 }}>
                  <span className="mono uppercase muted">Agent</span>
                  <MockBadge size="xs" title="Derived via run → version → agent; not on ApprovalRequest" />
                </div>
                <Link to={`/agents/${approval.agent_id}`}>
                  {approval.agent_name ?? approval.agent_id}
                </Link>
              </div>
              <div>
                <div className="mono uppercase muted" style={{ marginBottom: 4 }}>Run / Task</div>
                <div className="row row--sm">
                  <Link to={`/runs/${approval.run_id}`} className="mono">{approval.run_id}</Link>
                  <span className="muted">·</span>
                  <Link to={`/tasks/${approval.task_id}`} className="mono">{approval.task_id}</Link>
                </div>
              </div>
              <div>
                <div className="row row--sm" style={{ marginBottom: 4 }}>
                  <span className="mono uppercase muted">Policy reason</span>
                  <MockBadge size="xs" title="Not on ApprovalRequest — would come from the tool-grant / approval-rule that triggered this request" />
                </div>
                <div style={{ fontSize: 12.5 }}>{approval.policy_reason}</div>
              </div>
              <div>
                <div className="mono uppercase muted" style={{ marginBottom: 4 }}>Evidence ref</div>
                <div className="mono" style={{ fontSize: 12 }}>{approval.evidence_ref ?? '—'}</div>
                {approval.evidence_ref && (
                  <Link to={`/runs/${approval.run_id}`} className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                    jump to step <IconArrowRight className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {approval.status !== 'pending' && (
          <>
            <div style={{ height: 16 }} />
            <DecisionHistoryCard approval={approval} decider={approver} />
          </>
        )}

        <div style={{ height: 16 }} />

        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'right' }}>
          endpoint · <span className="accent">POST /approvals/{approval.id}/decision</span>
          {' '}· <span className="muted">{approval.status === 'pending' ? 'awaiting decision' : 'decided'}</span>
        </div>
      </div>
    </AppShell>
  )
}

// ─────────────────────────────────────────────── Decision intro (pick approve or reject)

function DecisionIntroCard({
  approval, highRisk, onApprove, onReject,
}: {
  approval: ApprovalRequest
  highRisk: boolean
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div
      className="card"
      style={{
        borderColor: 'var(--warn-border)',
        background: 'linear-gradient(180deg, var(--warn-soft) 0%, transparent 80%)',
      }}
    >
      <div className="card__head">
        <div className="card__title" style={{ color: 'var(--warn)' }}>
          <IconApproval className="ic" />
          Your decision is required
        </div>
        {highRisk && (
          <Chip tone="danger">
            <IconAlert className="ic ic--sm" /> high risk
          </Chip>
        )}
      </div>
      <div className="card__body">
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.55 }}>
          {highRisk
            ? 'This is a high-risk action. Your decision is written to the audit trail, attached to the originating run step, and cannot be edited after submit.'
            : 'Your decision is written to the audit trail and attached to the originating run step.'}
        </p>
        <div className="grid grid--2" style={{ gap: 14 }}>
          <DecisionCTA
            tone="success"
            icon={<IconCheck />}
            title="Approve"
            sub={<>Resume the <Chip>suspended</Chip> run and let the orchestrator call <span className="mono">{approval.tool_name ?? 'the tool'}</span>.</>}
            onClick={onApprove}
            reasonHint={highRisk ? 'Reason required for high-risk actions' : 'Reason optional'}
          />
          <DecisionCTA
            tone="danger"
            icon={<IconX />}
            title="Reject"
            sub={<>Stop the requested action. The run remains <Chip>suspended</Chip> and the agent is told not to retry without a new grant or rule change.</>}
            onClick={onReject}
            reasonHint="Reason required"
          />
        </div>
      </div>
    </div>
  )
}

function DecisionCTA({
  tone, icon, title, sub, onClick, reasonHint,
}: {
  tone: 'success' | 'danger'
  icon: React.ReactNode
  title: string
  sub: React.ReactNode
  onClick: () => void
  reasonHint: string
}) {
  const color = tone === 'success' ? 'var(--success)' : 'var(--danger)'
  const bg = tone === 'success' ? 'var(--success-soft)' : 'var(--danger-soft)'
  const border = tone === 'success' ? 'var(--success-border)' : 'var(--danger-border)'
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 16,
        borderRadius: 6,
        border: `1px solid ${border}`,
        background: bg,
        color: 'var(--text)',
        transition: 'transform 120ms, background 120ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div className="row" style={{ gap: 10, marginBottom: 10 }}>
        <span style={{ width: 32, height: 32, borderRadius: 4, border: `1px solid ${border}`, background: 'var(--surface-2)', color, display: 'grid', placeItems: 'center' }}>
          {icon}
        </span>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color }}>{title}</div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 10 }}>
        {sub}
      </div>
      <div className="mono" style={{ fontSize: 10.5, color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {reasonHint}
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────── Confirm pane (reason + final submit)

function DecisionConfirmCard({
  approval, decision, reason, reasonRequired, reasonInvalid, user, busy, canSubmit, saveError,
  onChangeReason, onBlurReason, onCancel, onConfirm, onSwitch,
}: {
  approval: ApprovalRequest
  decision: Decision
  reason: string
  reasonRequired: boolean
  reasonInvalid: boolean
  user: { id: string; name: string; email: string; approval_level: number }
  busy: boolean
  canSubmit: boolean
  saveError: string | null
  onChangeReason: (v: string) => void
  onBlurReason: () => void
  onCancel: () => void
  onConfirm: () => void
  onSwitch: (d: Decision) => void
}) {
  const isApprove = decision === 'approve'
  const color = isApprove ? 'var(--success)' : 'var(--danger)'
  const border = isApprove ? 'var(--success-border)' : 'var(--danger-border)'
  const bg = isApprove ? 'var(--success-soft)' : 'var(--danger-soft)'

  return (
    <div className="card" style={{ borderColor: border }}>
      <div className="card__head" style={{ background: bg }}>
        <div className="row" style={{ gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 4, border: `1px solid ${border}`, color, background: 'var(--surface)', display: 'grid', placeItems: 'center' }}>
            {isApprove ? <IconCheck /> : <IconX />}
          </span>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color }}>
              {isApprove ? 'Approve' : 'Reject'} {approval.id.toUpperCase()}
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              {isApprove
                ? 'approving resumes the suspended run'
                : 'rejecting stops the requested action'}
            </div>
          </div>
        </div>
        <button
          onClick={() => onSwitch(isApprove ? 'reject' : 'approve')}
          className="mono"
          style={{ fontSize: 10.5, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase' }}
        >
          ↔ switch to {isApprove ? 'reject' : 'approve'}
        </button>
      </div>

      <div className="card__body">
        <div className="card" style={{ background: 'var(--surface-2)', marginBottom: 14 }}>
          <div style={{ padding: 12 }}>
            <div className="mono uppercase muted" style={{ fontSize: 9.5, marginBottom: 6 }}>
              What this means
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>
              {isApprove ? (
                <>
                  <IconPlay className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle', color: 'var(--success)', marginRight: 4 }} />
                  Run <span className="mono">{approval.run_id}</span> will leave <Chip>suspended</Chip>, the orchestrator will execute <span className="mono">{approval.tool_name ?? 'the pending tool call'}</span>, and the remaining steps will run to completion.
                </>
              ) : (
                <>
                  <IconStop className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle', color: 'var(--danger)', marginRight: 4 }} />
                  Run <span className="mono">{approval.run_id}</span> will NOT execute <span className="mono">{approval.tool_name ?? 'the pending tool call'}</span>. The run is terminated in rejected state; requester sees your reason on the task detail.
                </>
              )}
            </div>
          </div>
        </div>

        <label>
          <div className="row row--between" style={{ marginBottom: 6 }}>
            <span className="mono uppercase muted">
              Reason {reasonRequired && <span className="danger">*</span>}
            </span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              {reasonRequired
                ? (isApprove ? 'required for high-risk approvals' : 'required for rejects')
                : 'optional · recorded in audit log'}
            </span>
          </div>
          <textarea
            className="input textarea"
            style={{
              minHeight: 90,
              borderColor: reasonInvalid ? 'var(--danger-border)' : undefined,
            }}
            placeholder={isApprove
              ? 'Why is it safe to resume this run? (e.g. "Verified refund history — valid dupe.")'
              : 'Why are we stopping this? (e.g. "Customer is on legal hold; escalate to CS director.")'}
            value={reason}
            onChange={e => onChangeReason(e.target.value)}
            onBlur={onBlurReason}
            aria-invalid={reasonInvalid}
          />
          {reasonInvalid && (
            <div className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
              <IconAlert className="ic ic--sm" /> Please explain your decision (at least 4 characters)
            </div>
          )}
        </label>

        <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 14, lineHeight: 1.6 }}>
          <span style={{ color: 'var(--text-muted)' }}>Signing as:</span> {user.name} ({user.email}) · L{user.approval_level}<br />
          <span style={{ color: 'var(--text-muted)' }}>Decision time:</span> {absTime(new Date().toISOString())}
        </div>

        {saveError && (
          <div style={{ marginTop: 12 }}>
            <div className="banner banner--warn" role="alert">
              <span className="banner__icon"><IconAlert className="ic" style={{ color: 'var(--danger)' }} /></span>
              <div style={{ flex: 1 }}>
                <div className="banner__title" style={{ color: 'var(--danger)' }}>Decision couldn't be submitted</div>
                <div className="banner__body">{saveError}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card__foot">
        <Btn variant="ghost" onClick={onCancel} disabled={busy}>
          <IconPause className="ic ic--sm" /> Back
        </Btn>
        <Btn
          variant={isApprove ? 'primary' : 'danger'}
          onClick={onConfirm}
          disabled={!canSubmit}
          icon={isApprove ? <IconCheck /> : <IconX />}
        >
          {busy
            ? 'submitting…'
            : isApprove
              ? 'Approve & resume suspended run'
              : 'Reject & stop the action'}
        </Btn>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────── Resolved state

function ResolvedCard({ approval, decider }: { approval: ApprovalRequest; decider: ReturnType<typeof allUsers>[number] | undefined }) {
  const toneColor =
    approval.status === 'approved' ? 'var(--success)' :
    approval.status === 'rejected' ? 'var(--danger)' :
    'var(--text-dim)'
  const iconTone =
    approval.status === 'approved' ? <IconCheck /> :
    approval.status === 'rejected' ? <IconX /> :
    <IconLock />
  return (
    <div
      className="card"
      style={{
        borderColor:
          approval.status === 'approved' ? 'var(--success-border)' :
          approval.status === 'rejected' ? 'var(--danger-border)' :
          undefined,
      }}
    >
      <div className="card__body">
        <div className="row" style={{ gap: 14 }}>
          <span style={{
            width: 40, height: 40, borderRadius: 6, display: 'grid', placeItems: 'center',
            color: toneColor, border: `1px solid ${toneColor}`, background: 'var(--surface-2)',
          }}>
            {iconTone}
          </span>
          <div style={{ flex: 1 }}>
            <div className="row row--sm" style={{ marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: toneColor }}>
                {approval.status[0].toUpperCase() + approval.status.slice(1)}
              </span>
              {decider && (
                <>
                  <span className="mono muted">·</span>
                  <Avatar initials={decider.initials ?? '?'} tone={decider.avatar_tone ?? 'accent'} size={20} />
                  <span style={{ fontSize: 13 }}>{decider.name}</span>
                </>
              )}
            </div>
            {approval.resolved_at && (
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {absTime(approval.resolved_at)}
              </div>
            )}
            {approval.reason && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.55, fontStyle: 'italic' }}>
                "{approval.reason}"
              </div>
            )}
          </div>
          <Link to={`/runs/${approval.run_id}`} className="btn btn--ghost btn--sm">
            Open run <IconArrowRight className="ic ic--sm" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────── Decision history

function DecisionHistoryCard({ approval, decider }: { approval: ApprovalRequest; decider: ReturnType<typeof allUsers>[number] | undefined }) {
  return (
    <div className="card">
      <div className="card__head">
        <div className="card__title">Decision history</div>
        <Chip>1 decision</Chip>
      </div>
      <div className="card__body">
        <div className="timeline" style={{ paddingLeft: 2 }}>
          <div className="timeline__item" style={{ paddingLeft: 34 }}>
            <span className={`timeline__dot timeline__dot--${approval.status === 'approved' ? 'success' : approval.status === 'rejected' ? 'danger' : 'accent'}`} />
            <div className="timeline__head">
              <span className="timeline__kind">CREATED</span>
              <span className="timeline__title">Request opened by {approval.requested_by_name}</span>
              <span className="timeline__time">{absTime(approval.created_at)}</span>
            </div>
            <div className="timeline__body">Triggered by <span className="mono">{approval.tool_name ?? 'a policy rule'}</span>: {approval.policy_reason}</div>
          </div>
          {approval.resolved_at && (
            <div className="timeline__item" style={{ paddingLeft: 34 }}>
              <span className={`timeline__dot timeline__dot--${approval.status === 'approved' ? 'success' : approval.status === 'rejected' ? 'danger' : 'accent'}`} />
              <div className="timeline__head">
                <span className="timeline__kind" style={{
                  color:
                    approval.status === 'approved' ? 'var(--success)' :
                    approval.status === 'rejected' ? 'var(--danger)' :
                    undefined,
                }}>
                  {approval.status.toUpperCase()}
                </span>
                <span className="timeline__title">
                  Decided by {decider?.name ?? approval.approver_user_id ?? 'unknown'}
                </span>
                <span className="timeline__time">{absTime(approval.resolved_at)}</span>
              </div>
              {approval.reason && <div className="timeline__body">"{approval.reason}"</div>}
            </div>
          )}
          {approval.status === 'expired' && (
            <div className="timeline__item" style={{ paddingLeft: 34 }}>
              <span className="timeline__dot timeline__dot--warn" />
              <div className="timeline__head">
                <span className="timeline__kind" style={{ color: 'var(--warn)' }}>EXPIRED</span>
                <span className="timeline__title">Timed out before a decision was made</span>
                <span className="timeline__time">{absTime(approval.expires_at)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
