import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Code, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, MockBadge, PageHeader, Status } from '../components/common'
import { statusLabel } from '../components/common/status-label'
import { TextAreaField } from '../components/fields'
import { Banner, LoadingList, NoAccessState } from '../components/states'
import {
  IconAgent,
  IconAlert,
  IconApproval,
  IconArrowLeft,
  IconArrowRight,
  IconChat,
  IconCheck,
  IconLock,
  IconPlay,
  IconStop,
  IconX,
} from '../components/icons'
import { Link, useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type {
  Agent,
  ApprovalDecisionAccepted,
  ApprovalRequest,
  Run,
  RunDetail,
  RunStatus,
  RunStep,
  Task,
  User,
} from '../lib/types'
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

  // Polling: after 202-ack, wait for approval to flip, then run terminal.
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

  const agent = useMemo(() => {
    if (!runContext?.agent_version_id) return null
    return agents.find(a => a.active_version?.id === runContext.agent_version_id) ?? null
  }, [runContext, agents])

  if (approval === null) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'approvals', to: '/approvals' }, { label: 'not found' }]}>
        <div className="page"><NoAccessState requiredRole="access to this approval" body="This approval request could not be found. It may have already been resolved or the link may be incorrect." /></div>
      </AppShell>
    )
  }
  if (approval === undefined) {
    return <AppShell crumbs={[{ label: '...', to: '/' }]}><div className="page"><LoadingList rows={4} /></div></AppShell>
  }

  const reasonRequired = decision === 'rejected'
  const reasonInvalid = reasonRequired && reasonTouched && reason.trim().length < 4
  const canSubmit = decision !== null && (!reasonRequired || reason.trim().length >= 4) && !busy
  const userCanDecide = approval.status === 'pending' && !!user
  const agentName = agent?.name ?? 'Agent'
  const actionVerb = prettifyRequestedAction(approval.requested_action)

  const doDecide = async (d: Decision, reasonText: string) => {
    if (!user) return
    const requiresReason = d === 'rejected'
    if (requiresReason && reasonText.length < 4) return

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
      const ack = await api.decideApproval(approval.id, d, reasonText || null, user.id)
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

  const submitFromConfirmCard = () => {
    setReasonTouched(true)
    if (!decision) return
    void doDecide(decision, reason.trim())
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
                APPROVAL REQUEST{' '}
                <MockBadge kind="design" hint="GET /approvals/{id} isn't in the gateway spec yet — single-fetch is mocked locally. The list endpoint is real." />
              </>
            }
            title={<><Text as="span">{agentName} wants to </Text><em>{actionVerb.toLowerCase()}</em></>}
            subtitle={
              taskContext?.title ? (
                <>In task: <Link to={`/tasks/${taskContext.id}`}>{taskContext.title}</Link></>
              ) : undefined
            }
            actions={
              <>
                {agent && (
                  <Button asChild size="1" variant="ghost" color="gray">
                    <Link to={`/agents/${agent.id}`}>
                      <IconAgent className="ic ic--sm" />
                      View agent
                    </Link>
                  </Button>
                )}
                {agent && (
                  <Button asChild size="1" variant="ghost" color="gray">
                    <Link to={`/agents/${agent.id}/talk`}>
                      <IconChat className="ic ic--sm" />
                      Open chat
                    </Link>
                  </Button>
                )}
                <Status status={approval.status} />
              </>
            }
          />
        </div>

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
            <Box mt="4" />
          </>
        )}

        {resume && (
          <>
            <ResumeBanner ack={resume} approval={approval} run={runAfter} />
            <Box mt="4" />
          </>
        )}

        {/* Pending · review + decision panel */}
        {approval.status === 'pending' && userCanDecide && !decision && !resume && (
          <div data-tour="approval-decision">
            <ReviewCard
              approval={approval}
              run={runContext}
              agentName={agentName}
              busy={busy}
              onApprove={() => setDecision('approved')}
              onReject={() => setDecision('rejected')}
              onQuickApprove={() => doDecide('approved', '')}
            />
          </div>
        )}

        {/* Pending · confirm panel (after user clicked Approve / Reject) */}
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
            onConfirm={submitFromConfirmCard}
          />
        )}

        {/* Resolved state */}
        {approval.status !== 'pending' && !conflict && (
          <ResolvedCard approval={approval} approverName={userName(approval.approver_user_id)} />
        )}

        {/* What the agent did so far — inline, always visible */}
        <div data-tour="approval-evidence">
          <PriorActivitySection run={runContext} />
        </div>

        {/* Backend metadata + raw evidence — collapsible */}
        <TechnicalDetailsAccordion approval={approval} userName={userName} />
      </div>
    </AppShell>
  )
}

// ────────────────────────────────────────────── ReviewCard
// Plan section 7.2 — the main "supervisor decision" panel. Structured copy
// (Why / What to check / What happens if approve / What happens if reject)
// and two big primary buttons: "Approve action" / "Reject action".

function ReviewCard({
  approval,
  run,
  agentName,
  busy,
  onApprove,
  onReject,
  onQuickApprove,
}: {
  approval: ApprovalRequest
  run: RunDetail | null
  agentName: string
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onQuickApprove: () => void
}) {
  const policyReason = useMemo(() => {
    if (!run) return null
    for (let i = run.steps.length - 1; i >= 0; i--) {
      const s = run.steps[i]
      if (s.step_type !== 'validation') continue
      const out = s.output_ref as { verdict?: string; reason?: string } | null
      if (out?.verdict === 'approval_required' && typeof out.reason === 'string') {
        return out.reason
      }
    }
    return null
  }, [run])

  const evidenceEntries = approval.evidence_ref
    ? Object.entries(approval.evidence_ref).filter(([, v]) => v != null)
    : []

  return (
    <div className="card" style={{ borderColor: 'var(--amber-a6)' }}>
      <Flex justify="end" px="4" pt="3">
        <Button
          size="1"
          variant="ghost"
          color="green"
          onClick={onQuickApprove}
          disabled={busy}
          title="Approve without adding a reason"
          aria-label="Quick approve — submit without adding a reason"
          style={{ minHeight: 24 }}
        >
          <IconCheck className="ic ic--sm" />
          Quick approve
        </Button>
      </Flex>
      <div className="card__body" style={{ padding: '16px 24px 8px' }}>
        <Section title="Why approval is needed">
          <Text as="p" size="2" style={{ lineHeight: 1.6 }}>
            {policyReason ?? `This kind of action is set to require your approval before ${agentName} can run it.`}
          </Text>
        </Section>

        {evidenceEntries.length > 0 && (
          <Section title="What you should check">
            <Flex direction="column" gap="2">
              {evidenceEntries.map(([k, v]) => (
                <Flex
                  key={k}
                  align="start"
                  gap="3"
                  py="2"
                  style={{ borderTop: '1px dashed var(--gray-a3)' }}
                >
                  <Text size="2" color="gray" style={{ flex: '0 0 35%' }}>{humanKey(k)}</Text>
                  <Box style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <FactValue value={v} />
                  </Box>
                </Flex>
              ))}
            </Flex>
          </Section>
        )}

        <Section title="What happens if you approve">
          <Flex align="start" gap="2">
            <Box style={{ color: 'var(--green-11)', paddingTop: 2 }}>
              <IconPlay className="ic ic--sm" />
            </Box>
            <Text as="p" size="2" style={{ lineHeight: 1.6 }}>
              {agentName} will run this action right away and continue with the task.
            </Text>
          </Flex>
        </Section>

        <Section title="What happens if you reject">
          <Flex align="start" gap="2">
            <Box style={{ color: 'var(--red-11)', paddingTop: 2 }}>
              <IconStop className="ic ic--sm" />
            </Box>
            <Text as="p" size="2" style={{ lineHeight: 1.6 }}>
              {agentName} will not run this action. The current task will stop.
            </Text>
          </Flex>
        </Section>
      </div>

      <Flex
        gap="3"
        p="4"
        wrap="wrap"
        style={{ borderTop: '1px solid var(--gray-a3)' }}
      >
        <Button
          size="3"
          color="green"
          onClick={onApprove}
          style={{ flex: '1 1 200px', minWidth: 200 }}
        >
          <IconCheck />
          Approve action
        </Button>
        <Button
          size="3"
          color="red"
          variant="soft"
          onClick={onReject}
          style={{ flex: '1 1 200px', minWidth: 200 }}
        >
          <IconX />
          Reject action
        </Button>
      </Flex>

      <Box px="4" pb="3">
        <Text as="div" size="1" color="gray" style={{ lineHeight: 1.5 }}>
          Triggered {ago(approval.created_at)}{approval.requested_by_name ? ` by ${approval.requested_by_name}` : ''}.
          {' '}{approval.expires_at ? `Auto-expires ${ago(approval.expires_at)}.` : ''}
        </Text>
      </Box>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box mb="5">
      <Text
        as="div"
        size="1"
        weight="medium"
        mb="2"
        style={{ color: 'var(--gray-12)', textTransform: 'uppercase', letterSpacing: '0.12em' }}
      >
        {title}
      </Text>
      {children}
    </Box>
  )
}

function FactValue({ value }: { value: unknown }) {
  if (typeof value === 'boolean') return <Text size="2">{value ? 'Yes' : 'No'}</Text>
  if (typeof value === 'number') return <Text size="2">{value.toLocaleString('en-US')}</Text>
  if (typeof value === 'string') {
    return <Text size="2" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{value}</Text>
  }
  return (
    <Code variant="ghost" size="1" style={{ whiteSpace: 'pre-wrap' }}>
      {JSON.stringify(value)}
    </Code>
  )
}

// ────────────────────────────────────────────── DecisionConfirmCard
// The "are you sure + reason" step that comes after the user clicks
// Approve action / Reject action in ReviewCard. Reject still requires a
// reason ≥ 4 chars (audit / compliance); approve is optional.

function DecisionConfirmCard({
  decision, reason, reasonRequired, reasonInvalid, userLabel, busy, canSubmit, saveError,
  onChangeReason, onBlurReason, onCancel, onConfirm,
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
}) {
  const isApprove = decision === 'approved'
  const color = isApprove ? 'var(--green-11)' : 'var(--red-11)'
  const border = isApprove ? 'var(--green-a6)' : 'var(--red-a6)'

  return (
    <div className="card" style={{ borderColor: border }}>
      <div className="card__head">
        <Flex align="center" gap="3">
          <span style={{
            width: 28, height: 28, borderRadius: 6, border: `1px solid ${border}`,
            color, background: 'var(--gray-2)', display: 'grid', placeItems: 'center',
          }}>
            {isApprove ? <IconCheck /> : <IconX />}
          </span>
          <Text as="div" size="3" weight="medium" style={{ color }}>
            {isApprove ? 'Confirm — approve this action' : 'Confirm — reject this action'}
          </Text>
        </Flex>
      </div>

      <div className="card__body">
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
          <Text as="span" color="gray">Signing as:</Text> {userLabel}
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
          color={isApprove ? 'green' : 'red'}
          onClick={onConfirm}
          disabled={!canSubmit}
          size="3"
        >
          {isApprove ? <IconCheck /> : <IconX />}
          {busy
            ? 'submitting…'
            : isApprove
              ? 'Approve action'
              : 'Reject action'}
        </Button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────── ResolvedCard
// Already-decided approvals just show the outcome inline.

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
        </Flex>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────── ResumeBanner
// Three-stage lifecycle while the orchestrator processes our decision:
// queued → resolved → terminal. Same logic as before, with action-centric copy.

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

  const verb = ack.decision === 'approve' ? 'Approve' : 'Reject'

  if (stage === 'queued') {
    return (
      <Banner
        tone="info"
        icon={<IconApproval className="ic" />}
        title={`${verb} action queued`}
        action={<Badge color="cyan" variant="soft" radius="small" size="1">waiting</Badge>}
      >
        Your decision is recorded. Your agent will resume shortly — usually within 8–15 seconds.
      </Banner>
    )
  }

  if (stage === 'resolved') {
    return (
      <Banner
        tone="info"
        icon={<IconPlay className="ic" />}
        title={`Action ${statusLabel(approval.status).toLowerCase()} · agent resuming`}
        action={<Badge color="blue" variant="soft" radius="small" size="1">running</Badge>}
      >
        Your decision is being applied. Waiting for the activity to finish…
      </Banner>
    )
  }

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
      title={`Activity ${statusLabel(run.status).toLowerCase()}`}
    >
      {run.error_message ?? (
        run.status === 'completed'
          ? 'The action was carried out and the activity finished.'
          : `The activity finished as ${statusLabel(run.status).toLowerCase()}.`
      )}
    </Banner>
  )
}

// ────────────────────────────────────────────── PriorActivitySection
// What the agent has done so far on this task. Always visible (no accordion);
// the parent task is surfaced in the page hero, so this section only renders
// when there are real steps to show.

function PriorActivitySection({ run }: { run: RunDetail | null }) {
  const leadingSteps = useMemo(
    () =>
      (run?.steps ?? []).filter(
        s => s.step_type === 'tool_call' || s.step_type === 'validation' || s.step_type === 'llm_call',
      ),
    [run],
  )
  if (leadingSteps.length === 0) return null
  return (
    <Box mt="5">
      <div className="card" style={{ padding: '14px 18px' }}>
        <Flex align="center" justify="between" mb="3">
          <Text as="span" size="2" weight="medium">What the agent did so far</Text>
          <Text as="span" size="1" color="gray">
            {leadingSteps.length} step{leadingSteps.length === 1 ? '' : 's'}
          </Text>
        </Flex>
        <Flex direction="column" gap="2">
          {leadingSteps.map(s => <StepLine key={s.id} step={s} />)}
        </Flex>
      </div>
    </Box>
  )
}

function StepLine({ step }: { step: RunStep }) {
  const tone = stepTone(step.status)
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
        {stepIcon(step.status)}
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
    return step.model_name ? `Reasoned (${step.model_name})` : 'Reasoned'
  }
  return step.step_type.replace(/_/g, ' ')
}

function stepDetail(step: RunStep): string | null {
  if (step.step_type === 'tool_call') {
    const out = step.output_ref as Record<string, unknown> | null
    if (!out) return null
    if (typeof out.amount_usd === 'number') {
      return `Result: $${out.amount_usd}${typeof out.status === 'string' ? ` · ${out.status}` : ''}`
    }
    if (typeof out.exit_date === 'string') return `Exit date: ${out.exit_date}`
    if (typeof out.loaded === 'number') return `Loaded ${out.loaded} record${out.loaded === 1 ? '' : 's'}`
    if (typeof out.enriched === 'number') return `Enriched ${out.enriched} contact${out.enriched === 1 ? '' : 's'}`
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

// ────────────────────────────────────────────── TechnicalDetailsAccordion
// Backend metadata + raw evidence dump. Phase 1 banished API endpoints from
// InfoHints; this is the one place where a power user can still inspect the
// raw approval object. Always collapsed.

function TechnicalDetailsAccordion({
  approval,
  userName,
}: {
  approval: ApprovalRequest
  userName: (id: string | null | undefined) => string | null
}) {
  return (
    <Box mt="3">
      <details className="card" style={{ padding: '14px 18px' }}>
        <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
          <Text as="span" size="2" weight="medium">Technical details</Text>
        </summary>
        <Box mt="3">
          <Flex direction="column" gap="1">
            <DetailRow label="Activity">
              <Link to={`/activity/${approval.run_id}`}>{shortRef(approval.run_id)}</Link>
            </DetailRow>
            {approval.task_id && (
              <DetailRow label="Task">
                <Link to={`/tasks/${approval.task_id}`}>{shortRef(approval.task_id)}</Link>
              </DetailRow>
            )}
            <DetailRow label="Action key" value={approval.requested_action} />
            <DetailRow label="Approver role" value={approverRoleLabel(approval.approver_role)} />
            {approval.approver_user_id && (
              <DetailRow label="Approver" value={userName(approval.approver_user_id) ?? '—'} />
            )}
            <DetailRow label="Created" value={absTime(approval.created_at)} />
            {approval.expires_at && <DetailRow label="Expires" value={absTime(approval.expires_at)} />}
            {approval.resolved_at && <DetailRow label="Resolved" value={absTime(approval.resolved_at)} />}
            {approval.reason && <DetailRow label="Reason" value={approval.reason} />}
          </Flex>
          {approval.evidence_ref && Object.keys(approval.evidence_ref).length > 0 && (
            <Box mt="4">
              <Caption as="div" mb="2">Raw evidence</Caption>
              <Code
                variant="ghost"
                size="1"
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block' }}
              >
                {JSON.stringify(approval.evidence_ref, null, 2)}
              </Code>
            </Box>
          )}
          <Box mt="4">
            <Button asChild variant="ghost" size="1">
              <a href={`#/activity/${approval.run_id}`}>
                <IconArrowRight className="ic ic--sm" />
                Open full activity record
              </a>
            </Button>
          </Box>
        </Box>
      </details>
    </Box>
  )
}

function DetailRow({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Flex align="center" justify="between" gap="3" py="1" style={{ borderBottom: '1px dashed var(--gray-a3)' }}>
      <Caption>{label}</Caption>
      <Text as="span" size="1">{children ?? value}</Text>
    </Flex>
  )
}
