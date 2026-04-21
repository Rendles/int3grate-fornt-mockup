import { useEffect, useState } from 'react'
import { Code, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, Btn, Chip, Status, CommandBar, InfoHint } from '../components/common'
import { TextAreaField } from '../components/fields'
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
import type { ApprovalDecisionAccepted, ApprovalRequest, Run, RunStatus } from '../lib/types'
import { absTime, ago } from '../lib/format'

type Decision = 'approved' | 'rejected'

const RUN_TERMINAL: RunStatus[] = ['completed', 'completed_with_errors', 'failed', 'cancelled']
const isRunTerminal = (s: RunStatus): boolean => RUN_TERMINAL.includes(s)

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
  // Async resume (gateway v0.2.0): decision is queued, we poll approval + run.
  const [resume, setResume] = useState<ApprovalDecisionAccepted | null>(null)
  const [runAfter, setRunAfter] = useState<Run | null>(null)

  useEffect(() => {
    let cancelled = false
    api.getApproval(approvalId).then(a => {
      if (cancelled) return
      setApproval(a ?? null)
      if (a?.status === 'pending') {
        const d = search.get('decide')
        if (d === 'approved' || d === 'rejected') {
          setDecision(d)
          setReason('')
          setReasonTouched(false)
        }
      }
    })
    return () => { cancelled = true }
  }, [approvalId, search])

  // Polling: after 202-ack, wait for approval to flip, then for run to reach terminal.
  useEffect(() => {
    if (!resume) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tickRun = async (runId: string) => {
      if (cancelled) return
      const r = await api.getRun(runId)
      if (cancelled) return
      if (r) setRunAfter(r)
      if (r && isRunTerminal(r.status)) return
      timer = setTimeout(() => tickRun(runId), 1000)
    }

    const tickApproval = async () => {
      if (cancelled) return
      const fresh = await api.getApproval(approvalId)
      if (cancelled) return
      if (fresh) setApproval(fresh)
      if (fresh && fresh.status !== 'pending') {
        timer = setTimeout(() => tickRun(fresh.run_id), 600)
        return
      }
      timer = setTimeout(tickApproval, 800)
    }

    timer = setTimeout(tickApproval, 600)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [resume, approvalId])

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

  // Rejection requires a reason; approve is optional per the API spec.
  const reasonRequired = decision === 'rejected'
  const reasonInvalid = reasonRequired && reasonTouched && reason.trim().length < 4
  const canSubmit = decision !== null && (!reasonRequired || reason.trim().length >= 4) && !busy

  const userCanDecide = approval.status === 'pending' && !!user

  const doDecide = async () => {
    setReasonTouched(true)
    if (!decision || !user) return
    if (reasonRequired && reason.trim().length < 4) return

    setBusy(true)
    setSaveError(null)
    setConflict(null)
    try {
      const fresh = await api.getApproval(approvalId)
      if (fresh && fresh.status !== 'pending') {
        setConflict(fresh)
        setApproval(fresh)
        setDecision(null)
        setBusy(false)
        return
      }
      const ack = await api.decideApproval(approval.id, decision, reason.trim() || null, user.id)
      // v0.2.0: 202 queued — enter polling mode instead of assuming sync result.
      setResume(ack)
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
        { label: approval.id },
      ]}
    >
      <div className="page page--narrow">
        <PageHeader
          eyebrow={
            <>
              {`APPROVAL · ${approval.id}`}{' '}
              <InfoHint>
                Loaded via <Code variant="ghost">GET /approvals/{'{id}'}</Code>. Decision posts to <Code variant="ghost">POST /approvals/{'{id}'}/decision</Code> with <Code variant="ghost">{'{ decision, reason }'}</Code>.
              </InfoHint>
            </>
          }
          title={approval.requested_action}
          actions={
            <>
              <Status status={approval.status} />
              <Btn variant="ghost" size="sm" href={`/runs/${approval.run_id}`}>
                Open run <IconArrowRight className="ic ic--sm" />
              </Btn>
              {approval.task_id && (
                <Btn variant="ghost" size="sm" href={`/tasks/${approval.task_id}`}>
                  Open task <IconArrowRight className="ic ic--sm" />
                </Btn>
              )}
              <Btn variant="ghost" size="sm" href="/approvals">Back to inbox</Btn>
            </>
          }
        />

        <CommandBar
          parts={[
            { label: 'ID', value: approval.id },
            { label: 'RUN', value: approval.run_id, tone: 'accent' },
            { label: 'TASK', value: approval.task_id ?? 'standalone · no task' },
            { label: 'NEEDS', value: approval.approver_role ?? '—' },
            ...(approval.status === 'pending' && approval.expires_at
              ? [{ label: 'EXPIRES', value: ago(approval.expires_at), tone: 'warn' as const }]
              : []),
            ...(approval.resolved_at ? [{ label: 'RESOLVED', value: absTime(approval.resolved_at) }] : []),
          ]}
        />

        <div style={{ height: 20 }} />

        {conflict && (
          <>
            <Banner
              tone="danger"
              title={`Already resolved · ${conflict.status}`}
              action={<Btn variant="ghost" onClick={() => setConflict(null)}>Dismiss</Btn>}
            >
              Another approver decided this while you were reviewing.
              {conflict.approver_user_id && (
                <> Decided by <strong>{conflict.approver_user_id}</strong> at {absTime(conflict.resolved_at)}.</>
              )}
            </Banner>
            <div style={{ height: 16 }} />
          </>
        )}

        {resume && (
          <>
            <ResumeBanner ack={resume} approval={approval} run={runAfter} />
            <div style={{ height: 16 }} />
          </>
        )}

        {/* Pending · decision panel */}
        {approval.status === 'pending' && userCanDecide && !decision && !resume && (
          <DecisionIntroCard
            onApprove={() => setDecision('approved')}
            onReject={() => setDecision('rejected')}
          />
        )}

        {/* Pending · confirm panel */}
        {approval.status === 'pending' && userCanDecide && decision && !resume && (
          <DecisionConfirmCard
            approval={approval}
            decision={decision}
            reason={reason}
            reasonRequired={reasonRequired}
            reasonInvalid={!!reasonInvalid}
            userLabel={`${user!.name} · ${user!.email} · L${user!.approval_level}`}
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
          <ResolvedCard approval={approval} />
        )}

        <div style={{ height: 20 }} />

        {/* Metadata */}
        <div className="card">
          <div className="card__head"><div className="card__title">Approval fields</div></div>
          <div className="card__body">
            <MetaRow label="id" value={<Code variant="ghost">{approval.id}</Code>} />
            <MetaRow label="run_id" value={<Link to={`/runs/${approval.run_id}`}><Code variant="ghost">{approval.run_id}</Code></Link>} />
            <MetaRow
              label="task_id"
              value={approval.task_id
                ? <Link to={`/tasks/${approval.task_id}`}><Code variant="ghost">{approval.task_id}</Code></Link>
                : <Text color="gray">null · standalone run (ADR-0003)</Text>}
            />
            <MetaRow label="tenant_id" value={<Code variant="ghost">{approval.tenant_id}</Code>} />
            <MetaRow label="requested_action" value={approval.requested_action} />
            <MetaRow label="requested_by" value={<Code variant="ghost">{approval.requested_by ?? '—'}</Code>} />
            <MetaRow label="requested_by_name" value={approval.requested_by_name ?? <Text color="gray">null</Text>} />
            <MetaRow label="approver_role" value={<Chip>{approval.approver_role ?? '—'}</Chip>} />
            <MetaRow label="approver_user_id" value={<Code variant="ghost">{approval.approver_user_id ?? '—'}</Code>} />
            <MetaRow label="status" value={<Status status={approval.status} />} />
            <MetaRow label="reason" value={approval.reason ?? <Text color="gray">null</Text>} />
            <MetaRow label="expires_at" value={<Code variant="ghost">{approval.expires_at ? absTime(approval.expires_at) : '—'}</Code>} />
            <MetaRow label="resolved_at" value={<Code variant="ghost">{approval.resolved_at ? absTime(approval.resolved_at) : '—'}</Code>} />
            <MetaRow label="created_at" value={<Code variant="ghost">{absTime(approval.created_at)}</Code>} />
          </div>
        </div>

        {approval.evidence_ref && (
          <>
            <div style={{ height: 16 }} />
            <div className="card">
              <div className="card__head">
                <div className="card__title">evidence_ref</div>
                <Chip square>object</Chip>
              </div>
              <div className="card__body">
                <pre
                  style={{
                    fontFamily: 'var(--code-font-family)',
                    fontSize: 12,
                    color: 'var(--gray-12)',
                    background: 'var(--gray-3)',
                    border: '1px solid var(--gray-6)',
                    padding: 12,
                    borderRadius: 4,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {JSON.stringify(approval.evidence_ref, null, 2)}
                </pre>
              </div>
            </div>
          </>
        )}

      </div>
    </AppShell>
  )
}

function DecisionIntroCard({ onApprove, onReject }: { onApprove: () => void; onReject: () => void }) {
  return (
    <div
      className="card"
      style={{
        borderColor: 'var(--amber-a6)',
        background: 'linear-gradient(180deg, var(--amber-a3) 0%, transparent 80%)',
      }}
    >
      <div className="card__head">
        <div className="card__title" style={{ color: 'var(--amber-11)' }}>
          <IconApproval className="ic" />
          Your decision is required
        </div>
      </div>
      <div className="card__body">
        <p style={{ fontSize: 13.5, color: 'var(--gray-11)', marginBottom: 14, lineHeight: 1.55 }}>
          Your decision is written to the audit trail. Approving resumes the suspended run; rejecting stops the pending action.
        </p>
        <div className="grid grid--2" style={{ gap: 14 }}>
          <DecisionCTA
            tone="success"
            icon={<IconCheck />}
            title="Approve"
            sub="Resume the suspended run and execute the requested action."
            reasonHint="Reason optional"
            onClick={onApprove}
          />
          <DecisionCTA
            tone="danger"
            icon={<IconX />}
            title="Reject"
            sub="Stop the requested action. The run is terminated."
            reasonHint="Reason required"
            onClick={onReject}
          />
        </div>
      </div>
    </div>
  )
}

function DecisionCTA({
  tone, icon, title, sub, reasonHint, onClick,
}: {
  tone: 'success' | 'danger'
  icon: React.ReactNode
  title: string
  sub: string
  reasonHint: string
  onClick: () => void
}) {
  const color = tone === 'success' ? 'var(--green-11)' : 'var(--red-11)'
  const bg = tone === 'success' ? 'var(--green-a3)' : 'var(--red-a3)'
  const border = tone === 'success' ? 'var(--green-a6)' : 'var(--red-a6)'
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 16,
        borderRadius: 6,
        border: `1px solid ${border}`,
        background: bg,
        color: 'var(--gray-12)',
      }}
    >
      <div className="row" style={{ gap: 10, marginBottom: 10 }}>
        <span style={{ width: 32, height: 32, borderRadius: 4, border: `1px solid ${border}`, background: 'var(--gray-3)', color, display: 'grid', placeItems: 'center' }}>
          {icon}
        </span>
        <div style={{ fontFamily: 'var(--heading-font-family)', fontSize: 24, color }}>{title}</div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--gray-11)', lineHeight: 1.55, marginBottom: 10 }}>
        {sub}
      </div>
      <div style={{ fontSize: 10.5, color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {reasonHint}
      </div>
    </button>
  )
}

function DecisionConfirmCard({
  approval, decision, reason, reasonRequired, reasonInvalid, userLabel, busy, canSubmit, saveError,
  onChangeReason, onBlurReason, onCancel, onConfirm, onSwitch,
}: {
  approval: ApprovalRequest
  decision: Decision
  reason: string
  reasonRequired: boolean
  reasonInvalid: boolean
  userLabel: string
  busy: boolean
  canSubmit: boolean
  saveError: string | null
  onChangeReason: (v: string) => void
  onBlurReason: () => void
  onCancel: () => void
  onConfirm: () => void
  onSwitch: (d: Decision) => void
}) {
  const isApprove = decision === 'approved'
  const color = isApprove ? 'var(--green-11)' : 'var(--red-11)'
  const border = isApprove ? 'var(--green-a6)' : 'var(--red-a6)'
  const bg = isApprove ? 'var(--green-a3)' : 'var(--red-a3)'

  return (
    <div className="card" style={{ borderColor: border }}>
      <div className="card__head" style={{ background: bg }}>
        <div className="row" style={{ gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 4, border: `1px solid ${border}`, color, background: 'var(--gray-2)', display: 'grid', placeItems: 'center' }}>
            {isApprove ? <IconCheck /> : <IconX />}
          </span>
          <div>
            <div style={{ fontFamily: 'var(--heading-font-family)', fontSize: 22, color }}>
              {isApprove ? 'Approve' : 'Reject'} {approval.id}
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-10)', marginTop: 2 }}>
              {isApprove ? 'approving resumes the suspended run' : 'rejecting stops the requested action'}
            </div>
          </div>
        </div>
        <button
          onClick={() => onSwitch(isApprove ? 'rejected' : 'approved')}
          style={{
            fontSize: 10.5,
            color: 'var(--gray-10)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            padding: '6px 10px',
            border: '1px solid var(--gray-7)',
            borderRadius: 4,
            background: 'var(--gray-3)',
          }}
        >
          в†” switch to {isApprove ? 'reject' : 'approve'}
        </button>
      </div>

      <div className="card__body">
        <div className="card" style={{ background: 'var(--gray-3)', marginBottom: 14 }}>
          <div style={{ padding: 12 }}>
            <Caption as="div" style={{ fontSize: 9.5, marginBottom: 6 }}>
              What happens next
            </Caption>
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>
              {isApprove ? (
                <>
                  <IconPlay className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle', color: 'var(--green-11)', marginRight: 4 }} />
                  Run <Code variant="ghost">{approval.run_id}</Code> leaves the suspended state, the orchestrator executes the pending step.
                </>
              ) : (
                <>
                  <IconStop className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle', color: 'var(--red-11)', marginRight: 4 }} />
                  Run <Code variant="ghost">{approval.run_id}</Code> does NOT execute the pending action. The run terminates in the rejected state.
                </>
              )}
            </div>
          </div>
        </div>

        <label>
          <div className="row row--between" style={{ marginBottom: 6 }}>
            <Caption>
              reason {reasonRequired && <Text as="span" color="red">*</Text>}
            </Caption>
            <Code variant="ghost" style={{ fontSize: 10, color: 'var(--gray-10)' }}>
              {reasonRequired ? 'required for rejects' : 'optional'}
            </Code>
          </div>
          <TextAreaField
            style={{ minHeight: 90 }}
            placeholder={isApprove
              ? 'Optional context for the audit log'
              : 'Why are we rejecting? (at least 4 characters)'}
            value={reason}
            onChange={e => onChangeReason(e.target.value)}
            onBlur={onBlurReason}
            error={reasonInvalid ? 'At least 4 characters.' : undefined}
          />
        </label>

        <div style={{ fontSize: 11, color: 'var(--gray-10)', marginTop: 14, lineHeight: 1.6 }}>
          <span style={{ color: 'var(--gray-11)' }}>Signing as:</span> {userLabel}<br />
          <span style={{ color: 'var(--gray-11)' }}>Decision:</span> {decision}
        </div>

        {saveError && (
          <div style={{ marginTop: 12 }}>
            <Banner tone="danger" title="Decision couldn't be submitted">{saveError}</Banner>
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
              ? 'Approve · resume run'
              : 'Reject · stop action'}
        </Btn>
      </div>
    </div>
  )
}

function ResolvedCard({ approval }: { approval: ApprovalRequest }) {
  const toneColor =
    approval.status === 'approved' ? 'var(--green-11)' :
    approval.status === 'rejected' ? 'var(--red-11)' :
    'var(--gray-10)'
  const iconTone =
    approval.status === 'approved' ? <IconCheck /> :
    approval.status === 'rejected' ? <IconX /> :
    <IconLock />
  return (
    <div
      className="card"
      style={{
        borderColor:
          approval.status === 'approved' ? 'var(--green-a6)' :
          approval.status === 'rejected' ? 'var(--red-a6)' :
          undefined,
      }}
    >
      <div className="card__body">
        <div className="row" style={{ gap: 14 }}>
          <span style={{
            width: 40, height: 40, borderRadius: 6, display: 'grid', placeItems: 'center',
            color: toneColor, border: `1px solid ${toneColor}`, background: 'var(--gray-3)',
          }}>
            {iconTone}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--heading-font-family)', fontSize: 22, color: toneColor }}>
              {approval.status[0].toUpperCase() + approval.status.slice(1)}
            </div>
            {approval.approver_user_id && (
              <div style={{ fontSize: 11, color: 'var(--gray-10)', marginTop: 4 }}>
                by {approval.approver_user_id}
              </div>
            )}
            {approval.resolved_at && (
              <div style={{ fontSize: 11, color: 'var(--gray-10)', marginTop: 2 }}>
                {absTime(approval.resolved_at)}
              </div>
            )}
            {approval.reason && (
              <div style={{ fontSize: 13, color: 'var(--gray-11)', marginTop: 8, lineHeight: 1.55, fontStyle: 'italic' }}>
                "{approval.reason}"
              </div>
            )}
          </div>
          <Btn href={`/runs/${approval.run_id}`} variant="ghost" size="sm" icon={<IconArrowRight className="ic ic--sm" />}>
            Open run
          </Btn>
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row row--between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--gray-6)' }}>
      <Caption style={{ fontSize: 10.5 }}>{label}</Caption>
      <span style={{ fontSize: 12 }}>{value}</span>
    </div>
  )
}

function ResumeBanner({
  ack, approval, run,
}: {
  ack: ApprovalDecisionAccepted
  approval: ApprovalRequest
  run: Run | null
}) {
  const stage: 'queued' | 'resolved' | 'terminal' =
    run && isRunTerminal(run.status) ? 'terminal' :
    approval.status !== 'pending' ? 'resolved' :
    'queued'

  const label = ack.decision === 'approve' ? 'Approve' : 'Reject'

  if (stage === 'queued') {
    return (
      <Banner
        tone="info"
        icon={<IconApproval className="ic" />}
        title={<>{label} queued · <Code variant="ghost">status = queued</Code></>}
        action={<Chip tone="info" square>polling</Chip>}
      >
        Gateway accepted the decision (<Code variant="ghost">202 Accepted</Code>) and enqueued it for the orchestrator.
        Resume typically takes 8вЂ“15 s. Polling <Code variant="ghost">GET /approvals/{approval.id}</Code> and{' '}
        <Code variant="ghost">GET /runs/{approval.run_id}</Code>.
      </Banner>
    )
  }

  if (stage === 'resolved') {
    return (
      <Banner
        tone="info"
        icon={<IconPlay className="ic" />}
        title={<>Approval {approval.status} · run resuming</>}
        action={<Chip tone="accent" square>polling run</Chip>}
      >
        Orchestrator picked up the decision. Waiting for <Code variant="ghost">run {approval.run_id}</Code> to reach a terminal state…
      </Banner>
    )
  }

  // terminal
  if (!run) return null
  const tone: 'success' | 'warn' | 'danger' | 'ghost' =
    run.status === 'completed' ? 'success' :
    run.status === 'completed_with_errors' ? 'warn' :
    run.status === 'cancelled' ? 'ghost' :
    'danger'
  const icon =
    tone === 'success' ? <IconCheck className="ic" /> :
    tone === 'danger' ? <IconStop className="ic" /> :
    <IconAlert className="ic" />

  return (
    <Banner
      tone={tone}
      icon={icon}
      title={<>Run {run.status.replace(/_/g, ' ')}</>}
      action={
        <Btn href={`/runs/${run.id}`} variant="ghost" size="sm" icon={<IconArrowRight />}>
          Open run
        </Btn>
      }
    >
      {run.error_message ?? (
        run.status === 'completed'
          ? `Run ${run.id} finished after the decision was applied.`
          : `Run ${run.id} reached terminal state ${run.status}.`
      )}
    </Banner>
  )
}
