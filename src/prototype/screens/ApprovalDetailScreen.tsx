import { useEffect, useState } from 'react'
import { Badge, Box, Button, Code, Flex, Grid, Separator, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, Status, CommandBar, InfoHint } from '../components/common'
import { statusLabel } from '../components/common/status-label'
import { TextAreaField } from '../components/fields'
import { Banner, LoadingList, NoAccessState } from '../components/states'
import {
  IconAlert,
  IconApproval,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLock,
  IconPlay,
  IconStop,
  IconX,
} from '../components/icons'
import { Link, useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent, ApprovalDecisionAccepted, ApprovalRequest, Run, RunDetail, RunStatus, RunStep, Task, User } from '../lib/types'
import { absTime, ago, approverRoleLabel, humanKey, prettifyRequestedAction, shortRef, toolLabel } from '../lib/format'

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
  const [users, setUsers] = useState<User[]>([])
  // Context for the "what am I approving?" summary — the run that paused on
  // this approval, the originating task (if any), and the catalog of agents
  // (for resolving agent_version_id → agent name).
  const [runContext, setRunContext] = useState<RunDetail | null>(null)
  const [taskContext, setTaskContext] = useState<Task | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])

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
      if (a) {
        api.getRun(a.run_id).then(r => { if (!cancelled && r) setRunContext(r) })
        if (a.task_id) {
          api.getTask(a.task_id).then(t => { if (!cancelled && t) setTaskContext(t) })
        }
      }
    })
    api.listUsers().then(u => { if (!cancelled) setUsers(u) })
    api.listAgents().then(res => { if (!cancelled) setAgents(res.items) })
    return () => { cancelled = true }
  }, [approvalId, search])

  const userName = (id: string | null | undefined) =>
    (id && users.find(u => u.id === id)?.name) || null

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
        { label: 'request' },
      ]}
    >
      <div className="page page--narrow">
        <div data-tour="approval-action">
        <PageHeader
          eyebrow={
            <>
              APPROVAL{' '}
              <InfoHint>
                Loaded via <Code variant="ghost">GET /approvals/{'{id}'}</Code>. Decision posts to <Code variant="ghost">POST /approvals/{'{id}'}/decision</Code> with <Code variant="ghost">{'{ decision, reason }'}</Code>.
              </InfoHint>
            </>
          }
          title={prettifyRequestedAction(approval.requested_action)}
          actions={
            // Direct children of PageHeader's wrapping Flex so each item can
            // wrap to a new row independently when the title eats the width.
            <>
              <Status status={approval.status} />
              <Separator orientation="vertical" size="1" />
              <Button asChild variant="soft" color="gray" size="1">
                <a href={`#/runs/${approval.run_id}`}>
                  Open run <IconArrowRight className="ic ic--sm" />
                </a>
              </Button>
              {approval.task_id && (
                <Button asChild variant="soft" color="gray" size="1">
                  <a href={`#/tasks/${approval.task_id}`}>
                    Open task <IconArrowRight className="ic ic--sm" />
                  </a>
                </Button>
              )}
            </>
          }
        />
        </div>

        <CommandBar
          parts={[
            { label: 'RUN', value: shortRef(approval.run_id), tone: 'accent' },
            { label: 'TASK', value: approval.task_id ? shortRef(approval.task_id) : 'standalone' },
            { label: 'NEEDS', value: approverRoleLabel(approval.approver_role) },
            ...(approval.status === 'pending' && approval.expires_at
              ? [{ label: 'EXPIRES', value: ago(approval.expires_at), tone: 'warn' as const }]
              : []),
            ...(approval.resolved_at ? [{ label: 'RESOLVED', value: absTime(approval.resolved_at) }] : []),
          ]}
        />

        <div style={{ height: 20 }} />

        <div data-tour="approval-evidence">
          <ApprovalContextCard
            approval={approval}
            run={runContext}
            task={taskContext}
            agents={agents}
            requestedByName={approval.requested_by_name ?? userName(approval.requested_by) ?? null}
          />
        </div>

        <div style={{ height: 20 }} />

        {conflict && (
          <>
            <Banner
              tone="danger"
              title={`Already ${conflict.status}`}
              action={<Button variant="ghost" onClick={() => setConflict(null)}>Dismiss</Button>}
            >
              Another approver decided this while you were reviewing.
              {conflict.approver_user_id && (
                <> Decided by <strong>{userName(conflict.approver_user_id) ?? '—'}</strong> at {absTime(conflict.resolved_at)}.</>
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
          <div data-tour="approval-decision">
          <DecisionIntroCard
            onApprove={() => setDecision('approved')}
            onReject={() => setDecision('rejected')}
          />
          </div>
        )}

        {/* Pending · confirm panel */}
        {approval.status === 'pending' && userCanDecide && decision && !resume && (
          <DecisionConfirmCard
            decision={decision}
            reason={reason}
            reasonRequired={reasonRequired}
            reasonInvalid={!!reasonInvalid}
            userLabel={`${user!.name} · ${user!.email}${user!.approval_level != null ? ` · L${user!.approval_level}` : ''}`}
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
          <ResolvedCard approval={approval} approverName={userName(approval.approver_user_id)} />
        )}

        <div style={{ height: 20 }} />

        {/* Metadata */}
        <div className="card">
          <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">Details</Text></div>
          <div className="card__body">
            <MetaRow
              label="run"
              value={<Link to={`/runs/${approval.run_id}`}>{shortRef(approval.run_id)}</Link>}
            />
            <MetaRow
              label="task"
              value={approval.task_id
                ? <Link to={`/tasks/${approval.task_id}`}>{shortRef(approval.task_id)}</Link>
                : <Text color="gray">— · standalone run</Text>}
            />
            <MetaRow label="action" value={prettifyRequestedAction(approval.requested_action)} />
            <MetaRow label="requested by" value={approval.requested_by_name ?? userName(approval.requested_by) ?? <Text color="gray">—</Text>} />
            <MetaRow label="approver role" value={<Badge color="gray" variant="soft" radius="full" size="1">{approverRoleLabel(approval.approver_role)}</Badge>} />
            <MetaRow label="approver" value={userName(approval.approver_user_id) ?? <Text color="gray">—</Text>} />
            <MetaRow label="status" value={<Status status={approval.status} />} />
            <MetaRow label="reason" value={approval.reason ?? <Text color="gray">—</Text>} />
            <MetaRow label="expires" value={approval.expires_at ? absTime(approval.expires_at) : '—'} />
            <MetaRow label="resolved" value={approval.resolved_at ? absTime(approval.resolved_at) : '—'} />
            <MetaRow label="created" value={absTime(approval.created_at)} />
          </div>
        </div>

        {approval.evidence_ref && (
          <>
            <div style={{ height: 16 }} />
            <div className="card">
              <div className="card__head">
                <Text as="div" size="2" weight="medium" className="card__title">Evidence</Text>
                <Text size="1" color="gray">context for this decision</Text>
              </div>
              <div className="card__body">
                <EvidenceList data={approval.evidence_ref} />
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
        <Text as="div" size="2" weight="medium" className="card__title" style={{ color: 'var(--amber-11)' }}>
          <IconApproval className="ic" />
          Your decision is required
        </Text>
      </div>
      <div className="card__body">
        <Text as="p" size="2" color="gray" mb="4" style={{ lineHeight: 1.55 }}>
          Your decision is written to the audit trail. Approving resumes the suspended run; rejecting stops the pending action.
        </Text>
        <Grid columns="2" gap="4">
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
        </Grid>
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
      <Flex align="center" gap="3" mb="3">
        <span style={{ width: 32, height: 32, borderRadius: 4, border: `1px solid ${border}`, background: 'var(--gray-3)', color, display: 'grid', placeItems: 'center' }}>
          {icon}
        </span>
        <Text as="div" size="6" style={{ color }}>{title}</Text>
      </Flex>
      <Text as="div" size="1" color="gray" mb="3" style={{ lineHeight: 1.55 }}>
        {sub}
      </Text>
      <Text as="div" size="1" style={{ color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {reasonHint}
      </Text>
    </button>
  )
}

function DecisionConfirmCard({
  decision, reason, reasonRequired, reasonInvalid, userLabel, busy, canSubmit, saveError,
  onChangeReason, onBlurReason, onCancel, onConfirm, onSwitch,
}: {
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
        <Flex align="center" gap="3">
          <span style={{ width: 30, height: 30, borderRadius: 4, border: `1px solid ${border}`, color, background: 'var(--gray-2)', display: 'grid', placeItems: 'center' }}>
            {isApprove ? <IconCheck /> : <IconX />}
          </span>
          <Box>
            <Text as="div" size="6" style={{ color }}>
              {isApprove ? 'Approve request' : 'Reject request'}
            </Text>
            <Text as="div" size="1" color="gray" mt="1">
              {isApprove ? 'approving resumes the suspended run' : 'rejecting stops the requested action'}
            </Text>
          </Box>
        </Flex>
        <button
          onClick={() => onSwitch(isApprove ? 'rejected' : 'approved')}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--gray-7)',
            borderRadius: 4,
            background: 'var(--gray-3)',
          }}
        >
          <Text size="1" color="gray" style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            ↔ switch to {isApprove ? 'reject' : 'approve'}
          </Text>
        </button>
      </div>

      <div className="card__body">
        <div className="card" style={{ background: 'var(--gray-3)', marginBottom: 14 }}>
          <div style={{ padding: 12 }}>
            <Caption as="div" mb="2">
              What happens next
            </Caption>
            <Text as="div" size="2" style={{ lineHeight: 1.55 }}>
              {isApprove ? (
                <>
                  <IconPlay className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle', color: 'var(--green-11)', marginRight: 4 }} />
                  The run leaves the suspended state and the orchestrator executes the pending step.
                </>
              ) : (
                <>
                  <IconStop className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle', color: 'var(--red-11)', marginRight: 4 }} />
                  The run does NOT execute the pending action. It terminates in the rejected state.
                </>
              )}
            </Text>
          </div>
        </div>

        <label>
          <Flex align="center" justify="between" gap="3" mb="2">
            <Caption>
              reason {reasonRequired && <Text as="span" color="red">*</Text>}
            </Caption>
            <Code variant="ghost" size="1" color="gray">
              {reasonRequired ? 'required for rejects' : 'optional'}
            </Code>
          </Flex>
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

        <Text as="div" size="1" color="gray" mt="4" style={{ lineHeight: 1.6 }}>
          <Text as="span" color="gray">Signing as:</Text> {userLabel}<br />
          <Text as="span" color="gray">Decision:</Text> {isApprove ? 'Approve' : 'Reject'}
        </Text>

        {saveError && (
          <Box mt="3">
            <Banner tone="danger" title="Decision couldn't be submitted">{saveError}</Banner>
          </Box>
        )}
      </div>

      <div className="card__foot">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          <IconArrowLeft className="ic ic--sm" /> Back
        </Button>
        <Button
          color={isApprove ? undefined : 'red'}
          onClick={onConfirm}
          disabled={!canSubmit}
        >
          {isApprove ? <IconCheck /> : <IconX />}
          {busy
            ? 'submitting…'
            : isApprove
              ? 'Approve · resume run'
              : 'Reject · stop action'}
        </Button>
      </div>
    </div>
  )
}

function ResolvedCard({ approval, approverName }: { approval: ApprovalRequest; approverName: string | null }) {
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
        <Flex align="center" gap="4">
          <span style={{
            width: 40, height: 40, borderRadius: 6, display: 'grid', placeItems: 'center',
            color: toneColor, border: `1px solid ${toneColor}`, background: 'var(--gray-3)',
          }}>
            {iconTone}
          </span>
          <Box flexGrow="1">
            <Text as="div" size="6" style={{ color: toneColor }}>
              {statusLabel(approval.status)}
            </Text>
            {approverName && (
              <Text as="div" size="1" color="gray" mt="1">
                by {approverName}
              </Text>
            )}
            {approval.resolved_at && (
              <Text as="div" size="1" color="gray" mt="1">
                {absTime(approval.resolved_at)}
              </Text>
            )}
            {approval.reason && (
              <Text as="div" size="2" color="gray" mt="2" style={{ lineHeight: 1.55, fontStyle: 'italic' }}>
                "{approval.reason}"
              </Text>
            )}
          </Box>
          <Button asChild variant="ghost" size="1">
            <a href={`#/runs/${approval.run_id}`}>
              <IconArrowRight className="ic ic--sm" />
              Open run
            </a>
          </Button>
        </Flex>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Flex align="center" justify="between" gap="3" py="1" style={{ borderBottom: '1px dashed var(--gray-a3)' }}>
      <Caption>{label}</Caption>
      <Text as="span" size="1">{value}</Text>
    </Flex>
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
        title={`${label} queued`}
        action={<Badge color="cyan" variant="soft" radius="small" size="1">waiting</Badge>}
      >
        Your decision is recorded. The orchestrator will resume the run shortly — usually within 8–15 seconds.
      </Banner>
    )
  }

  if (stage === 'resolved') {
    return (
      <Banner
        tone="info"
        icon={<IconPlay className="ic" />}
        title={`Approval ${statusLabel(approval.status).toLowerCase()} · run resuming`}
        action={<Badge color="blue" variant="soft" radius="small" size="1">running</Badge>}
      >
        The orchestrator picked up the decision. Waiting for the run to finish…
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
      title={`Run ${statusLabel(run.status).toLowerCase()}`}
      action={
        <Button asChild variant="ghost" size="1">
          <a href={`#/runs/${run.id}`}>
            <IconArrowRight />
            Open run
          </a>
        </Button>
      }
    >
      {run.error_message ?? (
        run.status === 'completed'
          ? 'The run finished after the decision was applied.'
          : `The run finished as ${statusLabel(run.status).toLowerCase()}.`
      )}
    </Banner>
  )
}

// ─────────────────────────────────────────────────────────────────
// ApprovalContextCard — the "why am I being asked to approve this?"
// summary. Pulls the agent (via run.agent_version_id), the originating
// task (if any), the policy reason from the run's validation step, and
// a compact timeline of what the agent already did before pausing.
// All synthesized from existing data — nothing is invented.
// ─────────────────────────────────────────────────────────────────

function ApprovalContextCard({
  approval, run, task, agents, requestedByName,
}: {
  approval: ApprovalRequest
  run: RunDetail | null
  task: Task | null
  agents: Agent[]
  requestedByName: string | null
}) {
  // Resolve agent through agent_version_id. Works for currently-active
  // versions; falls back to null when the version has been superseded.
  const agent = run?.agent_version_id
    ? agents.find(a => a.active_version?.id === run.agent_version_id) ?? null
    : null

  // Steps that lead up to the approval, in chronological order, filtered
  // to the ones a human would actually want to read (skip memory I/O).
  const leadingSteps = (run?.steps ?? [])
    .filter(s => s.step_type === 'tool_call' || s.step_type === 'validation' || s.step_type === 'llm_call')
    .filter(s => s.step_type !== 'approval_gate')

  // The most recent validation step with a verdict explains *why* approval
  // was required (e.g. "amount > $200 cap").
  const policyReason = (() => {
    for (let i = (run?.steps.length ?? 0) - 1; i >= 0; i--) {
      const s = run!.steps[i]
      if (s.step_type !== 'validation') continue
      const out = s.output_ref as { verdict?: string; reason?: string } | null
      if (out?.verdict === 'approval_required' && typeof out.reason === 'string') {
        return out.reason
      }
    }
    return null
  })()

  const hasContext = agent || task || policyReason || leadingSteps.length > 0
  if (!hasContext) return null

  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Context</Text>
        <Text size="1" color="gray">what you're being asked to approve</Text>
      </div>
      <div className="card__body">
        <Flex direction="column" gap="3">
          {agent && (
            <ContextRow label="Agent">
              <Link to={`/agents/${agent.id}`}>{agent.name}</Link>
              {agent.description && (
                <Text size="1" color="gray" mt="1" as="div">
                  {agent.description}
                </Text>
              )}
            </ContextRow>
          )}
          {task && (
            <ContextRow label="Task">
              <Link to={`/tasks/${task.id}`}>{task.title ?? '— untitled —'}</Link>
            </ContextRow>
          )}
          {!task && approval.task_id == null && (
            <ContextRow label="Task">
              <Text size="2" color="gray">Standalone run · no parent task</Text>
            </ContextRow>
          )}
          {requestedByName && (
            <ContextRow label="Started by">
              <Text size="2">{requestedByName}</Text>
            </ContextRow>
          )}
          {policyReason && (
            <ContextRow label="Why approval">
              <Text size="2">{policyReason}</Text>
            </ContextRow>
          )}
        </Flex>

        {leadingSteps.length > 0 && (
          <>
            <Caption as="div" mt="5" mb="2">What the agent did so far</Caption>
            <Flex direction="column" gap="2">
              {leadingSteps.map(s => <StepLine key={s.id} step={s} />)}
            </Flex>
          </>
        )}
      </div>
    </div>
  )
}

function ContextRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Flex align="start" gap="3">
      <Text size="1" color="gray" style={{ flex: '0 0 110px', paddingTop: 2 }}>{label}</Text>
      <Box style={{ flex: '1 1 auto', minWidth: 0 }}>{children}</Box>
    </Flex>
  )
}

function StepLine({ step }: { step: RunStep }) {
  const tone = stepTone(step.status)
  const icon = stepIcon(step.status)
  return (
    <Flex
      align="start"
      gap="3"
      style={{
        padding: '8px 10px',
        background: 'var(--gray-a2)',
        borderRadius: 8,
      }}
    >
      <span
        style={{
          width: 18, height: 18, borderRadius: '50%',
          background: tone.bg, color: tone.fg,
          display: 'grid', placeItems: 'center', flexShrink: 0,
          fontSize: 11, fontWeight: 600, lineHeight: 1, marginTop: 2,
        }}
        aria-label={step.status}
      >
        {icon}
      </span>
      <Box style={{ flex: '1 1 auto', minWidth: 0 }}>
        <Text as="div" size="2">{stepHeadline(step)}</Text>
        {stepDetail(step) && (
          <Text as="div" size="1" color="gray" mt="1" style={{ lineHeight: 1.5 }}>
            {stepDetail(step)}
          </Text>
        )}
      </Box>
    </Flex>
  )
}

function stepTone(status: string): { bg: string; fg: string } {
  if (status === 'ok') return { bg: 'var(--green-a4)', fg: 'var(--green-11)' }
  if (status === 'failed') return { bg: 'var(--red-a4)', fg: 'var(--red-11)' }
  if (status === 'blocked') return { bg: 'var(--amber-a4)', fg: 'var(--amber-11)' }
  if (status === 'pending') return { bg: 'var(--blue-a4)', fg: 'var(--blue-11)' }
  return { bg: 'var(--gray-a4)', fg: 'var(--gray-11)' }
}

function stepIcon(status: string): string {
  if (status === 'ok') return '✓'
  if (status === 'failed') return '✕'
  if (status === 'blocked') return '⏸'
  if (status === 'pending') return '⋯'
  return '·'
}

function stepHeadline(step: RunStep): string {
  if (step.step_type === 'tool_call' && step.tool_name) {
    return toolLabel(step.tool_name)
  }
  if (step.step_type === 'validation') {
    const verdict = (step.output_ref as { verdict?: string } | null)?.verdict
    if (verdict === 'approval_required') return 'Policy check — needs approval'
    if (verdict === 'pass') return 'Policy check — passed'
    if (verdict === 'block') return 'Policy check — blocked'
    return 'Policy check'
  }
  if (step.step_type === 'llm_call') {
    return step.model_name ? `Agent reasoned (${step.model_name})` : 'Agent reasoned'
  }
  return step.step_type.replace(/_/g, ' ')
}

function stepDetail(step: RunStep): string | null {
  if (step.step_type === 'tool_call') {
    const out = step.output_ref as Record<string, unknown> | null
    if (!out) return null
    // Pull out the most reader-friendly summary we can find.
    if (typeof out.amount_usd === 'number') {
      return `Result: $${out.amount_usd}${typeof out.status === 'string' ? ` · ${out.status}` : ''}`
    }
    if (typeof out.exit_date === 'string') {
      return `Exit date: ${out.exit_date}`
    }
    if (typeof out.loaded === 'number') {
      return `Loaded ${out.loaded} record${out.loaded === 1 ? '' : 's'}`
    }
    if (typeof out.enriched === 'number') {
      return `Enriched ${out.enriched} contact${out.enriched === 1 ? '' : 's'}`
    }
    return null
  }
  if (step.step_type === 'validation') {
    const out = step.output_ref as { reason?: string } | null
    return out?.reason ?? null
  }
  if (step.step_type === 'llm_call') {
    const out = step.output_ref as { plan?: string } | null
    if (typeof out?.plan === 'string') return `Plan: ${out.plan}`
    return null
  }
  return null
}

// ─────────────────────────────────────────────────────────────────
// EvidenceList — render the approval.evidence_ref object as a friendly
// key/value list. Snake-case keys become "Sentence case" labels; scalar
// values render directly; nested objects/arrays still fall back to
// pretty-printed JSON, but inline rather than as a wall of text.
// ─────────────────────────────────────────────────────────────────

function EvidenceList({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) {
    return <Text as="div" size="2" color="gray">No additional context.</Text>
  }
  return (
    <Flex direction="column" gap="2">
      {entries.map(([k, v]) => (
        <Flex
          key={k}
          align="start"
          justify="between"
          gap="3"
          py="2"
          style={{ borderBottom: '1px dashed var(--gray-a3)' }}
        >
          <Text size="2" color="gray" style={{ flex: '0 0 40%' }}>{humanKey(k)}</Text>
          <Box style={{ flex: '1 1 auto', textAlign: 'right', minWidth: 0 }}>
            <EvidenceValue value={v} />
          </Box>
        </Flex>
      ))}
    </Flex>
  )
}

function EvidenceValue({ value }: { value: unknown }) {
  if (value == null) {
    return <Text size="2" color="gray">—</Text>
  }
  if (typeof value === 'boolean') {
    return <Text size="2">{value ? 'Yes' : 'No'}</Text>
  }
  if (typeof value === 'number') {
    return <Text size="2">{value.toLocaleString('en-US')}</Text>
  }
  if (typeof value === 'string') {
    return <Text size="2" style={{ wordBreak: 'break-word' }}>{value}</Text>
  }
  // Objects / arrays — small inline JSON for low-frequency complex values.
  return (
    <Code variant="ghost" size="1" style={{ whiteSpace: 'pre-wrap' }}>
      {JSON.stringify(value)}
    </Code>
  )
}
