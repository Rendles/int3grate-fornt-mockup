import { useEffect, useState } from 'react'
import { Badge, Button, Code, Flex, Grid, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, Status, CommandBar, InfoHint } from '../components/common'
import { statusLabel } from '../components/common/status-label'
import { LoadingList, NoAccessState, Banner } from '../components/states'
import { IconAlert, IconArrowRight } from '../components/icons'
import { Link } from '../router'
import { api } from '../lib/api'
import type { Run, RunStep, RunStepType, RunToolError } from '../lib/types'
import { absTime, durationMs, errorKindLabel, money, num, runStepStatusLabel, shortRef, stageLabel, toolErrorStatusLabel, toolLabel, workspaceLabel } from '../lib/format'

const STEP_KIND_LABEL: Record<RunStepType, string> = {
  llm_call: 'LLM call',
  tool_call: 'Tool call',
  memory_read: 'Memory read',
  memory_write: 'Memory write',
  approval_gate: 'Approval gate',
  validation: 'Validation',
  agent_call: 'Agent call',
}

type ToneColor = { color: 'jade' | 'orange' | 'red' | 'cyan' | 'gray'; variant: 'soft' | 'outline' }
function statusTone(status: string): ToneColor {
  if (status === 'ok') return { color: 'jade', variant: 'soft' }
  if (status === 'failed') return { color: 'red', variant: 'soft' }
  if (status === 'blocked' || status === 'pending') return { color: 'orange', variant: 'soft' }
  if (status === 'running') return { color: 'cyan', variant: 'soft' }
  return { color: 'gray', variant: 'outline' }
}

export default function RunDetailScreen({ runId }: { runId: string }) {
  const [run, setRun] = useState<Run | null | undefined>(undefined)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.getRun(runId).then(r => setRun(r ?? null))
  }, [runId])

  if (run === null) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'activity' }, { label: 'not found' }]}>
        <div className="page">
          <NoAccessState
            requiredRole="access to this activity"
            body="This activity entry could not be loaded. It may have been deleted or you may not have access."
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
        { label: 'activity', to: '/activity' },
        { label: 'technical view' },
      ]}
    >
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              TECHNICAL VIEW{' '}
              <Badge color="gray" variant="outline" radius="small" size="1">advanced</Badge>
            </>
          }
          title={<>Activity <em>timeline.</em></>}
          subtitle="Full step-by-step record. Most users don't need this view — the friendly summary lives on the Activity page."
          actions={
            <>
              <Status status={run.status} />
              <Button asChild variant="soft" color="gray" size="2">
                <a href="#/activity">Back to Activity</a>
              </Button>
            </>
          }
        />

        <CommandBar
          parts={[
            { label: 'TASK', value: run.task_id ? shortRef(run.task_id) : 'standalone' },
            { label: 'STATUS', value: statusLabel(run.status), tone: run.status === 'failed' || run.status === 'suspended' || run.status === 'completed_with_errors' ? 'warn' : undefined },
            ...(run.error_kind && run.error_kind !== 'none'
              ? [{ label: 'ERROR', value: errorKindLabel(run.error_kind), tone: 'warn' as const }]
              : []),
            { label: 'STEPS', value: num(run.steps.length) },
            { label: 'TOKENS', value: `${num(run.total_tokens_in)} in · ${num(run.total_tokens_out)} out` },
            { label: 'COST', value: money(run.total_cost_usd, { cents: true }) },
            ...(run.suspended_stage ? [{ label: 'WAITING ON', value: stageLabel(run.suspended_stage), tone: 'warn' as const }] : []),
          ]}
        />

        {run.status === 'suspended' && (
          <>
            <div style={{ height: 16 }} />
            <Banner tone="warn" title="Waiting for your approval">
              <>
                Your agent paused at <strong>{stageLabel(run.suspended_stage)}</strong> and is waiting for you to approve or reject the action.
              </>
            </Banner>
          </>
        )}

        {run.status === 'failed' && run.error_message && (
          <>
            <div style={{ height: 16 }} />
            <div className="card" style={{ borderColor: 'var(--red-a6)', background: 'var(--red-a3)' }}>
              <div style={{ padding: '14px 18px' }}>
                <Flex align="center" gap="2" mb="2">
                  <IconAlert className="ic" style={{ color: 'var(--red-11)' }} />
                  <Text as="span" size="5" style={{ color: 'var(--red-11)' }}>Activity failed</Text>
                  {run.error_kind && run.error_kind !== 'none' && (
                    <Badge color="red" variant="soft" radius="small" size="1">{errorKindLabel(run.error_kind)}</Badge>
                  )}
                </Flex>
                <Text as="div" size="2" style={{ lineHeight: 1.55 }}>{run.error_message}</Text>
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
                borderColor: 'var(--orange-a6)',
                background: 'var(--orange-a3)',
                borderStyle: 'dashed',
              }}
            >
              <div style={{ padding: '14px 18px' }}>
                <Flex align="center" gap="2" mb="2">
                  <IconAlert className="ic" style={{ color: 'var(--orange-11)' }} />
                  <Text as="span" size="5" style={{ color: 'var(--orange-11)' }}>
                    Completed with errors
                  </Text>
                  {run.error_kind && run.error_kind !== 'none' && (
                    <Badge color="orange" variant="soft" radius="small" size="1">{errorKindLabel(run.error_kind)}</Badge>
                  )}
                </Flex>
                <Text as="div" size="2" style={{ lineHeight: 1.55 }}>
                  {run.error_message ?? 'The activity produced agent output, but one or more app calls failed.'}
                </Text>
                {run.tool_errors && run.tool_errors.length > 0 && (
                  <Text as="div" size="1" color="gray" mt="2">
                    {run.tool_errors.length} tool error{run.tool_errors.length === 1 ? '' : 's'} · see below
                  </Text>
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
            <Text as="div" size="2" weight="medium" className="card__title">Steps · {run.steps.length}</Text>
          </div>
          <div className="card__body" style={{ padding: 0 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '130px 90px minmax(0, 1fr) 110px 90px 90px 20px',
              gap: 12,
              padding: '8px 16px',
              background: 'var(--gray-a2)',
              borderBottom: '1px solid var(--gray-a3)',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
            }}>
              <Text as="span" size="1" color="gray">step</Text>
              <Text as="span" size="1" color="gray">status</Text>
              <Text as="span" size="1" color="gray">model / tool</Text>
              <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>duration</Text>
              <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>tokens</Text>
              <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>cost</Text>
              <span />
            </div>
            {run.steps.map(step => (
              <StepRow key={step.id} step={step} expanded={expanded.has(step.id)} onToggle={() => toggle(step.id)} />
            ))}
          </div>
        </div>

        <div style={{ height: 20 }} />

        <div className="card">
          <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">Activity details</Text></div>
          <div className="card__body">
            <MetaRow label="workspace" value={workspaceLabel(run.domain_id)} />
            <MetaRow
              label="task"
              value={run.task_id
                ? <Link to={`/tasks/${run.task_id}`}>{shortRef(run.task_id)}</Link>
                : <Text color="gray">— · standalone run</Text>}
            />
            <MetaRow label="status" value={<Status status={run.status} />} />
            {run.error_kind && run.error_kind !== 'none' && (
              <MetaRow label="error" value={errorKindLabel(run.error_kind)} />
            )}
            {run.suspended_stage && (
              <MetaRow label="waiting on" value={stageLabel(run.suspended_stage)} />
            )}
            <MetaRow label="started" value={run.started_at ? absTime(run.started_at) : '—'} />
            <MetaRow label="ended" value={run.ended_at ? absTime(run.ended_at) : '—'} />
            <MetaRow label="cost" value={money(run.total_cost_usd, { cents: true })} />
            <MetaRow label="tokens in" value={num(run.total_tokens_in)} />
            <MetaRow label="tokens out" value={num(run.total_tokens_out)} />
            <MetaRow label="created" value={absTime(run.created_at)} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function StepRow({ step, expanded, onToggle }: { step: RunStep; expanded: boolean; onToggle: () => void }) {
  const tone = statusTone(step.status)
  return (
    <div style={{ borderBottom: '1px solid var(--gray-a3)' }}>
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
          color: 'var(--gray-12)',
        }}
      >
        <Text as="span" size="1" color="gray">
          {STEP_KIND_LABEL[step.step_type]}
        </Text>
        <Badge color={tone.color} variant={tone.variant} radius="full" size="1">{runStepStatusLabel(step.status)}</Badge>
        <Text as="div" size="1" className="truncate">
          {step.model_name ?? (step.tool_name ? toolLabel(step.tool_name) : <Text color="gray">—</Text>)}
        </Text>
        <Code variant="ghost" size="1" color="gray" style={{ textAlign: 'right' }}>
          {durationMs(step.duration_ms)}
        </Code>
        <Code variant="ghost" size="1" color="gray" style={{ textAlign: 'right' }}>
          {step.tokens_in != null || step.tokens_out != null
            ? `${num(step.tokens_in ?? 0)}/${num(step.tokens_out ?? 0)}`
            : '—'}
        </Code>
        <Code variant="ghost" size="1" color="gray" style={{ textAlign: 'right' }}>
          {step.cost_usd != null ? money(step.cost_usd, { cents: true }) : '—'}
        </Code>
        <IconArrowRight className="ic" style={{ transform: expanded ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }} />
      </button>
      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          <Grid columns="2" gap="3">
            <JsonPanel title="input" value={step.input_ref} />
            <JsonPanel title="output" value={step.output_ref} />
          </Grid>
          <Text as="div" size="1" color="gray" mt="3">
            created {absTime(step.created_at)}
            {step.completed_at ? ` · completed ${absTime(step.completed_at)}` : ''}
          </Text>
        </div>
      )}
    </div>
  )
}

function JsonPanel({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  return (
    <div>
      <Caption as="div" mb="2">{title}</Caption>
      <Code asChild size="1" variant="soft" color={value ? undefined : 'gray'}>
        <pre
          style={{
            padding: 10,
            margin: 0,
            whiteSpace: 'pre-wrap',
            overflow: 'auto',
            maxHeight: 200,
          }}
        >
          {value ? JSON.stringify(value, null, 2) : 'null'}
        </pre>
      </Code>
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

function ToolErrorsCard({ errors }: { errors: RunToolError[] }) {
  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">App errors · {errors.length}</Text>
        <InfoHint>
          Shown when the activity finished with errors, or when an app call failed.
        </InfoHint>
      </div>
      <div className="card__body" style={{ padding: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 120px minmax(0, 1fr) 160px',
            gap: 12,
            padding: '8px 16px',
            background: 'var(--gray-a2)',
            borderBottom: '1px solid var(--gray-a3)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          <Text as="span" size="1" color="gray">tool</Text>
          <Text as="span" size="1" color="gray">status</Text>
          <Text as="span" size="1" color="gray">message</Text>
          <Text as="span" size="1" color="gray">at</Text>
        </div>
        {errors.map((e, i) => {
          const color = e.status === 'timeout' ? 'orange' : e.status === 'denied' ? 'gray' : 'red'
          const variant = e.status === 'denied' ? 'outline' : 'soft'
          return (
            <div
              key={`${e.tool}-${i}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '220px 120px minmax(0, 1fr) 160px',
                gap: 12,
                padding: '10px 16px',
                borderBottom: '1px solid var(--gray-a3)',
                alignItems: 'start',
              }}
            >
              <Text as="div" size="2">{toolLabel(e.tool)}</Text>
              <Badge color={color} variant={variant} radius="full" size="1">{toolErrorStatusLabel(e.status)}</Badge>
              <Text as="span" size="1" color="gray" style={{ lineHeight: 1.55 }}>
                {e.message ?? '—'}
              </Text>
              <Text as="div" size="1" color="gray">{e.at ? absTime(e.at) : '—'}</Text>
            </div>
          )
        })}
      </div>
    </div>
  )
}
