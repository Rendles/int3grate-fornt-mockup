import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status, CommandBar } from '../components/common'
import { LoadingList, NoAccessState, Banner, EmptyState } from '../components/states'
import {
  IconAlert,
  IconArrowRight,
  IconChevronDown,
  IconCopy,
  IconPause,
  IconPlay,
  IconStop,
  IconTask,
} from '../components/icons'
import { Link } from '../router'
import { api } from '../lib/api'
import type { Run, RunStep, RunStepStatus, RunStepType, Task } from '../lib/types'
import { absTime, ago, durationMs, money, num } from '../lib/format'

const STEP_TONE: Record<RunStepStatus, 'success' | 'accent' | 'warn' | 'danger' | 'info'> = {
  ok: 'success',
  running: 'info',
  pending: 'warn',
  blocked: 'warn',
  failed: 'danger',
  skipped: 'accent',
}

const STEP_KIND_LABEL: Record<RunStepType, string> = {
  llm_call: 'LLM CALL',
  tool_call: 'TOOL CALL',
  memory_read: 'MEMORY READ',
  memory_write: 'MEMORY WRITE',
  approval_gate: 'APPROVAL GATE',
  validation: 'VALIDATION',
}

const STEP_KIND_COLOR: Record<RunStepType, string> = {
  llm_call: 'var(--info)',
  tool_call: 'var(--accent)',
  memory_read: 'var(--text-muted)',
  memory_write: 'var(--text-muted)',
  approval_gate: 'var(--warn)',
  validation: 'var(--success)',
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through */ }
  return false
}

export default function RunDetailScreen({ runId }: { runId: string }) {
  const [run, setRun] = useState<Run | null | undefined>(undefined)
  const [task, setTask] = useState<Task | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set())
  const [copiedRef, setCopiedRef] = useState<string | null>(null)

  useEffect(() => {
    api.getRun(runId).then(r => {
      setRun(r ?? null)
      if (r) api.getTask(r.task_id).then(t => setTask(t ?? null))
    })
  }, [runId])

  if (run === null) {
    return (
      <AppShell crumbs={[{ label: 'app', to: '/' }, { label: 'runs' }, { label: 'not found' }]}>
        <div className="page">
          <NoAccessState
            requiredRole="access to this run"
            body={`Run ${runId} could not be loaded. It may be outside your domain or the ID is invalid.`}
          />
        </div>
      </AppShell>
    )
  }
  if (run === undefined) {
    return (
      <AppShell crumbs={[{ label: '...', to: '/' }]}><div className="page"><LoadingList rows={4} /></div></AppShell>
    )
  }

  const live = run.status === 'running' || run.status === 'suspended'
  const selectedStep = run.steps.find(s => s.id === selectedStepId) ?? null
  const failedStep = run.steps.find(s => s.status === 'failed') ?? null

  const toggleExpanded = (id: string) => {
    setExpandedStepIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectStep = (id: string) => {
    setSelectedStepId(prev => (prev === id ? null : id))
    setExpandedStepIds(prev => {
      const next = new Set(prev)
      if (!next.has(id)) next.add(id)
      return next
    })
  }

  const handleCopy = async (refId: string) => {
    const ok = await copyToClipboard(refId)
    if (ok) {
      setCopiedRef(refId)
      setTimeout(() => setCopiedRef(c => (c === refId ? null : c)), 1400)
    }
  }

  return (
    <AppShell
      crumbs={[
        { label: 'app', to: '/' },
        { label: 'tasks', to: '/tasks' },
        task ? { label: task.title.slice(0, 40), to: `/tasks/${task.id}` } : { label: 'task' },
        { label: run.id.toUpperCase() },
      ]}
    >
      <div className="page page--wide">
        <PageHeader
          eyebrow={<>{`RUN · ${run.id.toUpperCase()} · ${run.agent_name ?? ''} ${run.version_label ?? run.agent_version_id}`}</>}
          title={<>{task?.title ?? 'Run timeline'}</>}
          subtitle={task?.user_input}
          actions={
            <>
              <Status status={run.status} />
              {live && <Btn variant="ghost" icon={<IconPause />}>Pause</Btn>}
              {live && <Btn variant="danger" icon={<IconStop />}>Stop run</Btn>}
              <Btn variant="ghost" href="/tasks">All tasks</Btn>
              {task && <Btn variant="ghost" href={`/tasks/${task.id}`}>Task detail</Btn>}
              {task && (
                <Btn
                  variant="ghost"
                  icon={<IconPlay />}
                  href={`/tasks/new?agent=${task.assigned_agent_id}&type=${task.type}&title=${encodeURIComponent(task.title)}&input=${encodeURIComponent(task.user_input)}`}
                >
                  Start another
                </Btn>
              )}
            </>
          }
        />

        <CommandBar
          parts={[
            { label: 'RUN', value: run.id },
            { label: 'AGT VER', value: run.agent_version_id, tone: 'accent' },
            { label: 'STATUS', value: run.status, tone: run.status === 'failed' ? 'warn' : run.status === 'suspended' ? 'warn' : undefined },
            { label: 'STEPS', value: num(run.steps.length) },
            { label: 'TOKENS', value: `${num(run.total_tokens_in)} in · ${num(run.total_tokens_out)} out` },
            { label: 'SPEND', value: money(run.total_cost_usd, { cents: true }) },
            { label: 'DURATION', value: durationMs(run.duration_ms ?? null) },
            ...(run.suspended_stage ? [{ label: 'SUSPENDED AT', value: run.suspended_stage, tone: 'warn' as const }] : []),
          ]}
        />

        {run.status === 'suspended' && (() => {
          const approvalStep = run.steps.find(s => s.approval_id)
          return (
            <>
              <div style={{ height: 16 }} />
              <Banner tone="warn" title="Run suspended · waiting on approval">
                <>
                  The orchestrator stopped the run at stage <span className="mono">{run.suspended_stage}</span>. An approval rule matched — a human needs to decide before the run resumes.
                  {approvalStep?.approval_id && (
                    <>
                      {' '}<Link to={`/approvals/${approvalStep.approval_id}`} className="accent">
                        Open approval <IconArrowRight className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                      </Link>
                    </>
                  )}
                </>
              </Banner>
            </>
          )
        })()}

        {run.status === 'failed' && (run.error_message || failedStep) && (
          <>
            <div style={{ height: 16 }} />
            <div
              className="card"
              style={{
                borderColor: 'var(--danger-border)',
                background: 'var(--danger-soft)',
              }}
            >
              <div style={{ padding: '14px 18px' }}>
                <div className="row row--between" style={{ marginBottom: 8 }}>
                  <div className="row row--sm">
                    <IconAlert className="ic" style={{ color: 'var(--danger)' }} />
                    <span className="mono uppercase" style={{ color: 'var(--danger)', fontSize: 11, letterSpacing: '0.14em' }}>
                      RUN FAILED
                    </span>
                  </div>
                  {failedStep && (
                    <button
                      onClick={() => selectStep(failedStep.id)}
                      className="mono"
                      style={{ fontSize: 11, color: 'var(--text-muted)' }}
                    >
                      jump to step {failedStep.step_index} <IconArrowRight className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                    </button>
                  )}
                </div>
                {run.error_message && (
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text)' }}>
                    {run.error_message}
                  </div>
                )}
                {failedStep && (
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                    failed at step {failedStep.step_index} · <span style={{ color: STEP_KIND_COLOR[failedStep.step_type] }}>{STEP_KIND_LABEL[failedStep.step_type]}</span>
                    {failedStep.tool_name ? <> · <span style={{ color: 'var(--text-muted)' }}>{failedStep.tool_name}</span></> : null}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div style={{ height: 20 }} />

        <div className="split split--3">
          {/* ─── Timeline */}
          <div className="card">
            <div className="card__head">
              <div className="card__title">
                Step timeline
                <Chip>{run.steps.length} steps</Chip>
              </div>
              <div className="row row--sm">
                <Chip tone={live ? 'warn' : run.status === 'failed' ? 'danger' : 'accent'}>
                  {live ? 'live · mocked' : run.status}
                </Chip>
                {run.steps.length > 0 && (
                  <button
                    className="mono"
                    style={{ fontSize: 10.5, color: 'var(--text-dim)' }}
                    onClick={() => setExpandedStepIds(
                      expandedStepIds.size === run.steps.length
                        ? new Set()
                        : new Set(run.steps.map(s => s.id))
                    )}
                  >
                    {expandedStepIds.size === run.steps.length ? 'collapse all' : 'expand all'}
                  </button>
                )}
              </div>
            </div>
            <div className="card__body" style={{ padding: run.steps.length === 0 ? 20 : '4px 14px 18px' }}>
              {run.steps.length === 0 ? (
                <EmptyState
                  icon={<IconTask />}
                  title="No steps yet"
                  body={
                    run.status === 'pending'
                      ? 'Run is queued. Steps will stream in once the orchestrator picks it up.'
                      : 'This run has no recorded steps. It may have been cancelled before the first step ran.'
                  }
                />
              ) : (
                <div className="timeline" style={{ paddingLeft: 2 }}>
                  {run.steps.map(s => (
                    <StepRow
                      key={s.id}
                      step={s}
                      selected={selectedStepId === s.id}
                      expanded={expandedStepIds.has(s.id)}
                      onSelect={() => selectStep(s.id)}
                      onToggle={() => toggleExpanded(s.id)}
                      onCopy={handleCopy}
                      copiedRef={copiedRef}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── Side panel */}
          <div className="stack">
            {selectedStep ? (
              <StepDetailPanel
                step={selectedStep}
                run={run}
                onClose={() => setSelectedStepId(null)}
                onCopy={handleCopy}
                copiedRef={copiedRef}
              />
            ) : (
              <RunMetadataPanel run={run} task={task} />
            )}
          </div>
        </div>

        <div style={{ height: 16 }} />
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'right' }}>
          endpoint · <span className="accent">GET /runs/{run.id}</span> · no global <span className="warn">GET /runs</span> list
        </div>
      </div>
    </AppShell>
  )
}

// ─────────────────────────────────────────────── Timeline step

function StepRow({
  step, selected, expanded, onSelect, onToggle, onCopy, copiedRef,
}: {
  step: RunStep
  selected: boolean
  expanded: boolean
  onSelect: () => void
  onToggle: () => void
  onCopy: (text: string) => void
  copiedRef: string | null
}) {
  const tone = STEP_TONE[step.status]
  const pulse = step.status === 'running' || step.status === 'pending'
  return (
    <div
      className="timeline__item"
      style={{
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 40,
        background: selected ? 'var(--accent-soft)' : undefined,
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
        marginLeft: -2,
        borderRight: '1px solid transparent',
        transition: 'background 120ms',
      }}
    >
      <span className={`timeline__dot timeline__dot--${tone}${pulse ? ' dot--pulse' : ''}`} />
      <button
        onClick={onSelect}
        style={{
          display: 'block',
          textAlign: 'left',
          width: '100%',
          padding: 0,
        }}
      >
        <div className="timeline__head">
          <span className="mono uppercase" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', minWidth: 18, textAlign: 'right' }}>
            {step.step_index.toString().padStart(2, '0')}
          </span>
          <span
            className="timeline__kind"
            style={{ color: STEP_KIND_COLOR[step.step_type], borderColor: 'transparent' }}
          >
            {STEP_KIND_LABEL[step.step_type]}
          </span>
          <span className="timeline__title">{step.title ?? step.step_type}</span>
          {step.model_name && <Chip>{step.model_name}</Chip>}
          {step.tool_name && <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{step.tool_name}</span>}
          <span className="timeline__time">{durationMs(step.duration_ms)}</span>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle() }}
            style={{ color: 'var(--text-dim)', padding: 2 }}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <IconChevronDown
              className="ic ic--sm"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 120ms' }}
            />
          </button>
        </div>
        {!expanded && step.detail && (
          <div className="timeline__body truncate" style={{ paddingRight: 20 }}>{step.detail}</div>
        )}
      </button>

      {expanded && (
        <div style={{ marginTop: 6 }}>
          {step.detail && <div className="timeline__body">{step.detail}</div>}
          {step.payload && (
            <div className="timeline__payload">
              {Object.entries(step.payload).map(([k, v]) => (
                <div key={k} className="timeline__payload-row">
                  <span className="timeline__payload-key">{k}</span>
                  <span className="timeline__payload-val">{v}</span>
                </div>
              ))}
            </div>
          )}
          {(step.input_ref || step.output_ref) && (
            <div className="row" style={{ marginTop: 8, gap: 12, flexWrap: 'wrap' }}>
              {step.input_ref && <RefChip label="input_ref" value={step.input_ref} copied={copiedRef === step.input_ref} onCopy={onCopy} />}
              {step.output_ref && <RefChip label="output_ref" value={step.output_ref} copied={copiedRef === step.output_ref} onCopy={onCopy} />}
              {step.tokens_in != null && step.tokens_out != null && (
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                  tokens · <span style={{ color: 'var(--text-muted)' }}>{num(step.tokens_in)} in / {num(step.tokens_out)} out</span>
                </span>
              )}
              {step.cost_usd != null && step.cost_usd > 0 && (
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                  cost · <span style={{ color: 'var(--text-muted)' }}>{money(step.cost_usd, { cents: true })}</span>
                </span>
              )}
            </div>
          )}
          {step.approval_id && (
            <div style={{ marginTop: 10 }}>
              <Link
                to={`/approvals/${step.approval_id}`}
                className="btn btn--sm"
                style={{ background: 'var(--warn-soft)', borderColor: 'var(--warn-border)', color: 'var(--warn)' }}
              >
                Open approval {step.approval_id.toUpperCase()} <IconArrowRight className="ic ic--sm" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RefChip({
  label, value, copied, onCopy,
}: {
  label: string
  value: string
  copied: boolean
  onCopy: (text: string) => void
}) {
  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); onCopy(value) }}
      className="mono"
      title="Copy to clipboard"
      style={{
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center',
        padding: '3px 8px',
        border: '1px solid var(--border-2)',
        borderRadius: 4,
        background: copied ? 'var(--success-soft)' : 'var(--surface-2)',
        fontSize: 10.5,
      }}
    >
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{value}</span>
      {copied
        ? <span style={{ color: 'var(--success)', fontSize: 10 }}>copied!</span>
        : <IconCopy className="ic ic--sm" style={{ color: 'var(--text-dim)' }} />}
    </button>
  )
}

// ─────────────────────────────────────────────── Step detail panel (when a step is selected)

function StepDetailPanel({
  step, run, onClose, onCopy, copiedRef,
}: {
  step: RunStep
  run: Run
  onClose: () => void
  onCopy: (text: string) => void
  copiedRef: string | null
}) {
  const tone = STEP_TONE[step.status]
  const toneColor =
    tone === 'success' ? 'var(--success)' :
    tone === 'danger' ? 'var(--danger)' :
    tone === 'warn' ? 'var(--warn)' :
    tone === 'info' ? 'var(--info)' :
    'var(--accent)'
  return (
    <>
      <div
        className="card"
        style={{
          borderColor: step.status === 'failed' ? 'var(--danger-border)' : step.status === 'blocked' || step.status === 'pending' ? 'var(--warn-border)' : 'var(--accent-border)',
        }}
      >
        <div className="card__head">
          <div className="card__title">
            <span className="mono uppercase" style={{ fontSize: 10, color: STEP_KIND_COLOR[step.step_type], letterSpacing: '0.14em' }}>
              STEP {step.step_index.toString().padStart(2, '0')} · {STEP_KIND_LABEL[step.step_type]}
            </span>
          </div>
          <button
            className="tb__action"
            title="Close panel"
            onClick={onClose}
            style={{ padding: '4px 6px', fontSize: 10 }}
          >
            ✕
          </button>
        </div>
        <div className="card__body">
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, lineHeight: 1.2, marginBottom: 10 }}>
            {step.title ?? step.step_type}
          </div>
          <div className="row row--sm" style={{ marginBottom: 14 }}>
            <span
              className="dot"
              style={{
                background: toneColor,
                width: 8,
                height: 8,
                borderRadius: 999,
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{step.status}</span>
          </div>

          {step.detail && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 14 }}>
              {step.detail}
            </div>
          )}

          <MetaRow label="Type" value={<span className="mono" style={{ color: STEP_KIND_COLOR[step.step_type] }}>{STEP_KIND_LABEL[step.step_type]}</span>} />
          <MetaRow label="Status" value={<span className="mono">{step.status}</span>} />
          {step.model_name && <MetaRow label="Model" value={<Chip>{step.model_name}</Chip>} />}
          {step.tool_name && <MetaRow label="Tool" value={<span className="mono" style={{ color: 'var(--text)' }}>{step.tool_name}</span>} />}
          <MetaRow label="Duration" value={<span className="mono">{durationMs(step.duration_ms)}</span>} />
          {step.cost_usd != null && <MetaRow label="Cost" value={<span className="mono">{money(step.cost_usd, { cents: true })}</span>} />}
          {step.tokens_in != null && <MetaRow label="Tokens in" value={<span className="mono">{num(step.tokens_in)}</span>} />}
          {step.tokens_out != null && <MetaRow label="Tokens out" value={<span className="mono">{num(step.tokens_out)}</span>} />}
          <MetaRow label="Created" value={<span className="mono">{absTime(step.created_at)}</span>} />
          {step.completed_at && <MetaRow label="Completed" value={<span className="mono">{absTime(step.completed_at)}</span>} />}

          <div className="hr" />

          <div className="mono uppercase muted" style={{ marginBottom: 6 }}>Refs</div>
          <div className="stack stack--sm">
            {step.input_ref && <RefChip label="input_ref" value={step.input_ref} copied={copiedRef === step.input_ref} onCopy={onCopy} />}
            {step.output_ref && <RefChip label="output_ref" value={step.output_ref} copied={copiedRef === step.output_ref} onCopy={onCopy} />}
            {!step.input_ref && !step.output_ref && (
              <div className="mono muted" style={{ fontSize: 11 }}>no refs attached</div>
            )}
          </div>

          {step.status === 'failed' && run.error_message && (
            <>
              <div className="hr" />
              <div className="mono uppercase" style={{ color: 'var(--danger)', letterSpacing: '0.14em', marginBottom: 4 }}>
                Error
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55 }}>
                {run.error_message}
              </div>
            </>
          )}

          {step.payload && Object.keys(step.payload).length > 0 && (
            <>
              <div className="hr" />
              <div className="mono uppercase muted" style={{ marginBottom: 6 }}>Payload</div>
              <div className="timeline__payload" style={{ marginTop: 0 }}>
                {Object.entries(step.payload).map(([k, v]) => (
                  <div key={k} className="timeline__payload-row">
                    <span className="timeline__payload-key">{k}</span>
                    <span className="timeline__payload-val">{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step.approval_id && (
            <>
              <div className="hr" />
              <Link
                to={`/approvals/${step.approval_id}`}
                className="btn btn--sm"
                style={{ background: 'var(--warn-soft)', borderColor: 'var(--warn-border)', color: 'var(--warn)', justifyContent: 'center', width: '100%' }}
              >
                Open approval {step.approval_id.toUpperCase()} <IconArrowRight className="ic ic--sm" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="card">
        <div className="card__head"><div className="card__title">Links</div></div>
        <div className="card__body stack stack--sm">
          <Link to={`/runs/${run.id}`} className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
            /runs/{run.id}
          </Link>
          <Link to={`/tasks/${run.task_id}`} className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
            /tasks/{run.task_id}
          </Link>
          {run.agent_id && (
            <Link to={`/agents/${run.agent_id}/versions`} className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
              /agents/{run.agent_id}/versions
            </Link>
          )}
        </div>
      </div>
    </>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row row--between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
      <span className="mono uppercase muted" style={{ fontSize: 10.5 }}>{label}</span>
      <span style={{ fontSize: 12 }}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────── Default panel (no step selected)

function RunMetadataPanel({ run, task }: { run: Run; task: Task | null }) {
  const stepsByKind = useMemo(() => {
    const counts: Record<RunStepType, number> = {
      llm_call: 0, tool_call: 0, memory_read: 0, memory_write: 0, approval_gate: 0, validation: 0,
    }
    run.steps.forEach(s => { counts[s.step_type]++ })
    return counts
  }, [run.steps])

  const approvalSteps = run.steps.filter(s => s.approval_id)

  return (
    <>
      <div className="card">
        <div className="card__head">
          <div className="card__title">Run metadata</div>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>select a step for detail →</span>
        </div>
        <div className="card__body">
          <MetaRow label="Task" value={task ? <Link to={`/tasks/${task.id}`}>{task.id.toUpperCase()}</Link> : '—'} />
          <MetaRow label="Agent version" value={
            run.agent_id
              ? <Link to={`/agents/${run.agent_id}/versions`} className="mono">{run.agent_version_id}</Link>
              : <span className="mono">{run.agent_version_id}</span>
          } />
          {run.agent_id && run.agent_name && (
            <MetaRow label="Agent" value={<Link to={`/agents/${run.agent_id}`}>{run.agent_name}</Link>} />
          )}
          <MetaRow label="Started" value={<span className="mono">{absTime(run.started_at)}</span>} />
          <MetaRow label="Ended" value={<span className="mono">{absTime(run.ended_at)}</span>} />
          <MetaRow label="Status" value={<Status status={run.status} />} />
          {run.suspended_stage && (
            <MetaRow label="Suspended at" value={<span className="mono warn">{run.suspended_stage}</span>} />
          )}
        </div>
      </div>

      <div className="card">
        <div className="card__head"><div className="card__title">Cost & resources</div></div>
        <div className="card__body">
          <div className="metric__label">Total spend</div>
          <div className="metric__value">{money(run.total_cost_usd, { cents: true })}</div>
          <div className="hr" />
          <MetaRow label="Tokens in" value={<span className="mono">{num(run.total_tokens_in)}</span>} />
          <MetaRow label="Tokens out" value={<span className="mono">{num(run.total_tokens_out)}</span>} />
          <MetaRow label="Duration" value={<span className="mono">{durationMs(run.duration_ms ?? null)}</span>} />
        </div>
      </div>

      <div className="card">
        <div className="card__head"><div className="card__title">Step kinds</div></div>
        <div className="card__body">
          {(Object.keys(STEP_KIND_LABEL) as RunStepType[]).map(kind => {
            const count = stepsByKind[kind]
            if (count === 0) return null
            return (
              <div key={kind} className="row row--between" style={{ padding: '4px 0', fontSize: 11.5 }}>
                <span className="mono" style={{ color: STEP_KIND_COLOR[kind] }}>{STEP_KIND_LABEL[kind]}</span>
                <span className="mono" style={{ color: 'var(--text)' }}>{count}</span>
              </div>
            )
          })}
          {run.steps.length === 0 && (
            <div className="mono muted" style={{ fontSize: 11 }}>no steps yet</div>
          )}
        </div>
      </div>

      {approvalSteps.length > 0 && (
        <div className="card">
          <div className="card__head">
            <div className="card__title">Human touchpoints</div>
            <Chip tone="warn">{approvalSteps.length}</Chip>
          </div>
          <div className="card__body stack stack--sm">
            {approvalSteps.map(s => (
              <Link
                key={s.id}
                to={`/approvals/${s.approval_id}`}
                className="row"
                style={{
                  gap: 10,
                  padding: '8px 10px',
                  border: '1px solid var(--warn-border)',
                  background: 'var(--warn-soft)',
                  borderRadius: 4,
                }}
              >
                <span className={`dot dot--${STEP_TONE[s.status]}`} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text)' }} className="truncate">{s.title ?? 'Approval request'}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{s.approval_id} · {ago(s.created_at)}</div>
                </div>
                <IconArrowRight className="ic ic--sm" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
