import { useEffect, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status, CommandBar, InfoHint } from '../components/common'
import { LoadingList, NoAccessState, Banner } from '../components/states'
import { IconAlert, IconArrowRight } from '../components/icons'
import { Link } from '../router'
import { api } from '../lib/api'
import type { Run, RunStep, RunStepType, RunToolError } from '../lib/types'
import { absTime, durationMs, money, num } from '../lib/format'

const STEP_KIND_LABEL: Record<RunStepType, string> = {
  llm_call: 'LLM_CALL',
  tool_call: 'TOOL_CALL',
  memory_read: 'MEMORY_READ',
  memory_write: 'MEMORY_WRITE',
  approval_gate: 'APPROVAL_GATE',
  validation: 'VALIDATION',
}

function statusTone(status: string): 'success' | 'warn' | 'danger' | 'info' | 'ghost' {
  if (status === 'ok') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'blocked' || status === 'pending') return 'warn'
  if (status === 'running') return 'info'
  return 'ghost'
}

export default function RunDetailScreen({ runId }: { runId: string }) {
  const [run, setRun] = useState<Run | null | undefined>(undefined)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.getRun(runId).then(r => setRun(r ?? null))
  }, [runId])

  if (run === null) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'run' }, { label: 'not found' }]}>
        <div className="page">
          <NoAccessState
            requiredRole="access to this run"
            body={`Run ${runId} could not be loaded.`}
          />
        </div>
      </AppShell>
    )
  }
  if (run === undefined) {
    return <AppShell crumbs={[{ label: '...', to: '/' }]}><div className="page"><LoadingList rows={4} /></div></AppShell>
  }

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <AppShell
      crumbs={[
        { label: 'home', to: '/' },
        run.task_id
          ? { label: 'task', to: `/tasks/${run.task_id}` }
          : { label: 'standalone run' },
        { label: run.id.toUpperCase() },
      ]}
    >
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              {`RUN · ${run.id}`}{' '}
              <InfoHint>
                Loaded via <span className="mono">GET /runs/{'{id}'}</span>. Full step timeline included in the response.
              </InfoHint>
            </>
          }
          title={<>Run <em>timeline.</em></>}
          subtitle="Full step audit trail for this run."
          actions={
            <>
              <Status status={run.status} />
              {run.task_id && (
                <Btn variant="ghost" href={`/tasks/${run.task_id}`}>Task</Btn>
              )}
            </>
          }
        />

        <CommandBar
          parts={[
            { label: 'ID', value: run.id },
            { label: 'TASK', value: run.task_id ?? 'standalone · no task' },
            { label: 'AGT VER', value: run.agent_version_id ?? '—', tone: 'accent' },
            { label: 'STATUS', value: run.status, tone: run.status === 'failed' || run.status === 'suspended' || run.status === 'completed_with_errors' ? 'warn' : undefined },
            ...(run.error_kind && run.error_kind !== 'none'
              ? [{ label: 'ERROR_KIND', value: run.error_kind, tone: 'warn' as const }]
              : []),
            { label: 'STEPS', value: num(run.steps.length) },
            { label: 'TOKENS', value: `${num(run.total_tokens_in)} in · ${num(run.total_tokens_out)} out` },
            { label: 'SPEND', value: money(run.total_cost_usd, { cents: true }) },
            ...(run.suspended_stage ? [{ label: 'SUSPENDED', value: run.suspended_stage, tone: 'warn' as const }] : []),
          ]}
        />

        {run.status === 'suspended' && (
          <>
            <div style={{ height: 16 }} />
            <Banner tone="warn" title="Run is suspended">
              <>
                Orchestrator paused at <span className="mono">{run.suspended_stage}</span>. An approval_gate step is waiting for a human decision.
              </>
            </Banner>
          </>
        )}

        {run.status === 'failed' && run.error_message && (
          <>
            <div style={{ height: 16 }} />
            <div className="card" style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-soft)' }}>
              <div style={{ padding: '14px 18px' }}>
                <div className="row row--sm" style={{ marginBottom: 6 }}>
                  <IconAlert className="ic" style={{ color: 'var(--danger)' }} />
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--danger)' }}>Run failed</span>
                  {run.error_kind && run.error_kind !== 'none' && (
                    <Chip tone="danger" square>{run.error_kind}</Chip>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>{run.error_message}</div>
              </div>
            </div>
          </>
        )}

        {run.status === 'completed_with_errors' && (
          <>
            <div style={{ height: 16 }} />
            <div
              className="card"
              style={{
                borderColor: 'var(--warn-border)',
                background: 'var(--warn-soft)',
                borderStyle: 'dashed',
              }}
            >
              <div style={{ padding: '14px 18px' }}>
                <div className="row row--sm" style={{ marginBottom: 6, gap: 8 }}>
                  <IconAlert className="ic" style={{ color: 'var(--warn)' }} />
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--warn)' }}>
                    Completed with errors
                  </span>
                  {run.error_kind && run.error_kind !== 'none' && (
                    <Chip tone="warn" square>{run.error_kind}</Chip>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>
                  {run.error_message ?? 'The run produced assistant output, but one or more tool calls failed.'}
                </div>
                {run.tool_errors && run.tool_errors.length > 0 && (
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                    {run.tool_errors.length} tool error{run.tool_errors.length === 1 ? '' : 's'} · see below
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {run.tool_errors && run.tool_errors.length > 0 && (
          <>
            <div style={{ height: 20 }} />
            <ToolErrorsCard errors={run.tool_errors} />
          </>
        )}

        <div style={{ height: 20 }} />

        <div className="card">
          <div className="card__head">
            <div className="card__title">Steps · {run.steps.length}</div>
          </div>
          <div className="card__body" style={{ padding: 0 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '130px 90px minmax(0, 1fr) 110px 90px 90px 20px',
              gap: 12,
              padding: '8px 16px',
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
            }}>
              <span>step_type</span>
              <span>status</span>
              <span>model / tool</span>
              <span style={{ textAlign: 'right' }}>duration</span>
              <span style={{ textAlign: 'right' }}>tokens</span>
              <span style={{ textAlign: 'right' }}>cost</span>
              <span />
            </div>
            {run.steps.map(step => (
              <StepRow key={step.id} step={step} expanded={expanded.has(step.id)} onToggle={() => toggle(step.id)} />
            ))}
          </div>
        </div>

        <div style={{ height: 20 }} />

        <div className="card">
          <div className="card__head"><div className="card__title">Run metadata</div></div>
          <div className="card__body">
            <MetaRow label="id" value={<span className="mono">{run.id}</span>} />
            <MetaRow label="tenant_id" value={<span className="mono">{run.tenant_id}</span>} />
            <MetaRow label="domain_id" value={<span className="mono">{run.domain_id ?? '—'}</span>} />
            <MetaRow
              label="task_id"
              value={run.task_id
                ? <Link to={`/tasks/${run.task_id}`} className="mono">{run.task_id}</Link>
                : <span className="muted">null · standalone run (ADR-0003)</span>}
            />
            <MetaRow label="agent_version_id" value={<span className="mono">{run.agent_version_id ?? '—'}</span>} />
            <MetaRow label="status" value={<Status status={run.status} />} />
            <MetaRow label="error_kind" value={<span className="mono">{run.error_kind ?? '—'}</span>} />
            <MetaRow label="suspended_stage" value={<span className="mono">{run.suspended_stage ?? '—'}</span>} />
            <MetaRow label="started_at" value={<span className="mono">{run.started_at ? absTime(run.started_at) : '—'}</span>} />
            <MetaRow label="ended_at" value={<span className="mono">{run.ended_at ? absTime(run.ended_at) : '—'}</span>} />
            <MetaRow label="total_cost_usd" value={<span className="mono">{money(run.total_cost_usd, { cents: true })}</span>} />
            <MetaRow label="total_tokens_in" value={<span className="mono">{num(run.total_tokens_in)}</span>} />
            <MetaRow label="total_tokens_out" value={<span className="mono">{num(run.total_tokens_out)}</span>} />
            <MetaRow label="created_at" value={<span className="mono">{absTime(run.created_at)}</span>} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function StepRow({ step, expanded, onToggle }: { step: RunStep; expanded: boolean; onToggle: () => void }) {
  const tone = statusTone(step.status)
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: '130px 90px minmax(0, 1fr) 110px 90px 90px 20px',
          gap: 12,
          padding: '12px 16px',
          alignItems: 'center',
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          color: 'var(--text)',
        }}
      >
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {STEP_KIND_LABEL[step.step_type]}
        </span>
        <Chip tone={tone}>{step.status}</Chip>
        <div className="mono truncate" style={{ fontSize: 11.5, color: 'var(--text)' }}>
          {step.model_name ?? step.tool_name ?? <span className="muted">—</span>}
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
          {durationMs(step.duration_ms)}
        </span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
          {step.tokens_in != null || step.tokens_out != null
            ? `${num(step.tokens_in ?? 0)}/${num(step.tokens_out ?? 0)}`
            : '—'}
        </span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
          {step.cost_usd != null ? money(step.cost_usd, { cents: true }) : '—'}
        </span>
        <IconArrowRight className="ic" style={{ transform: expanded ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }} />
      </button>
      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          <div className="grid grid--2" style={{ gap: 12 }}>
            <JsonPanel title="input_ref" value={step.input_ref} />
            <JsonPanel title="output_ref" value={step.output_ref} />
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 10 }}>
            step_id · {step.id} · created {absTime(step.created_at)}
            {step.completed_at ? ` · completed ${absTime(step.completed_at)}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}

function JsonPanel({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  return (
    <div>
      <div className="mono uppercase muted" style={{ fontSize: 9.5, marginBottom: 6 }}>{title}</div>
      <pre
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: value ? 'var(--text)' : 'var(--text-dim)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          padding: 10,
          borderRadius: 4,
          margin: 0,
          whiteSpace: 'pre-wrap',
          overflow: 'auto',
          maxHeight: 200,
        }}
      >
        {value ? JSON.stringify(value, null, 2) : 'null'}
      </pre>
    </div>
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

function ToolErrorsCard({ errors }: { errors: RunToolError[] }) {
  return (
    <div className="card">
      <div className="card__head">
        <div className="card__title">Tool errors · {errors.length}</div>
        <InfoHint>
          Populated when <span className="mono">status = completed_with_errors</span>, or when a failed run's <span className="mono">error_kind</span> is <span className="mono">tool_error</span>.
        </InfoHint>
      </div>
      <div className="card__body" style={{ padding: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 120px minmax(0, 1fr) 160px',
            gap: 12,
            padding: '8px 16px',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          <span>tool</span>
          <span>status</span>
          <span>message</span>
          <span>at · tool_call_id</span>
        </div>
        {errors.map((e, i) => {
          const tone = e.status === 'timeout' ? 'warn' : e.status === 'denied' ? 'ghost' : 'danger'
          return (
            <div
              key={`${e.tool}-${i}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '220px 120px minmax(0, 1fr) 160px',
                gap: 12,
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'start',
              }}
            >
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--text)' }}>{e.tool}</span>
              <Chip tone={tone}>{e.status}</Chip>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                {e.message ?? <span className="muted">—</span>}
              </span>
              <div style={{ fontSize: 10.5 }}>
                <div className="mono" style={{ color: 'var(--text-dim)' }}>{e.at ? absTime(e.at) : '—'}</div>
                {e.tool_call_id && (
                  <div className="mono" style={{ color: 'var(--text-dim)', marginTop: 2 }}>{e.tool_call_id}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
