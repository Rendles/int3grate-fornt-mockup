import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status, CommandBar, Avatar } from '../components/common'
import { LoadingList, NoAccessState, Banner } from '../components/states'
import { IconArrowRight, IconPlay, IconRoute } from '../components/icons'
import { Link } from '../router'
import { api } from '../lib/api'
import type { Task, Run } from '../lib/types'
import { absTime, ago, durationMs, money, num } from '../lib/format'
import { allUsers } from '../lib/fixtures'

export default function TaskDetailScreen({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<Task | null | undefined>(undefined)
  const [run, setRun] = useState<Run | null>(null)
  const users = useMemo(() => allUsers(), [])

  useEffect(() => {
    api.getTask(taskId).then(t => {
      setTask(t ?? null)
      if (t?.run_id) api.getRun(t.run_id).then(r => setRun(r ?? null))
    })
  }, [taskId])

  if (task === null) {
    return (
      <AppShell crumbs={[{ label: 'app', to: '/' }, { label: 'tasks', to: '/tasks' }, { label: 'not found' }]}>
        <div className="page"><NoAccessState requiredRole="access to this task" body={`Task ${taskId} could not be loaded.`} /></div>
      </AppShell>
    )
  }
  if (task === undefined) {
    return (
      <AppShell crumbs={[{ label: '...', to: '/' }]}><div className="page"><LoadingList rows={4} /></div></AppShell>
    )
  }

  const starter = users.find(u => u.id === task.created_by)

  return (
    <AppShell
      crumbs={[
        { label: 'app', to: '/' },
        { label: 'tasks', to: '/tasks' },
        { label: task.id.toUpperCase() },
      ]}
    >
      <div className="page page--wide">
        <PageHeader
          eyebrow={`TASK · ${task.id.toUpperCase()} · ${task.type.replace('_', ' ').toUpperCase()}`}
          title={<>{task.title}</>}
          subtitle={task.user_input}
          actions={
            <>
              <Status status={task.status} />
              <Btn
                variant="ghost"
                icon={<IconPlay />}
                href={`/tasks/new?agent=${task.assigned_agent_id}&type=${task.type}&title=${encodeURIComponent(task.title)}&input=${encodeURIComponent(task.user_input)}`}
                title="Dispatch a new task with the same agent, type, and input"
              >
                Start another
              </Btn>
              {task.run_id && (
                <Btn href={`/runs/${task.run_id}`} variant="primary" icon={<IconRoute />}>
                  Open run timeline
                </Btn>
              )}
            </>
          }
        />

        <CommandBar
          parts={[
            { label: 'TASK', value: task.id },
            { label: 'TYPE', value: task.type.replace('_', ' ') },
            { label: 'AGT', value: task.agent_name ?? task.assigned_agent_id },
            { label: 'VER', value: task.assigned_agent_version_id || '—' },
            { label: 'RUN', value: task.run_id?.toUpperCase() ?? '—', tone: task.run_id ? 'accent' : 'warn' },
            { label: 'STEPS', value: num(task.steps_count ?? 0) },
            { label: 'SPEND', value: money(task.spend_usd ?? 0, { cents: true }) },
            { label: 'PRIORITY', value: task.priority ?? 'normal', tone: task.priority === 'urgent' ? 'warn' : undefined },
          ]}
        />

        <div style={{ height: 20 }} />

        <div className="split">
          <div className="stack">
            <div className="card">
              <div className="card__head">
                <div className="card__title">User input</div>
                {task.type === 'schedule' && task.schedule_cron && <Chip>cron · {task.schedule_cron}</Chip>}
              </div>
              <div className="card__body">
                <pre style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  padding: 14, borderRadius: 4, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6,
                }}>
                  {task.user_input}
                </pre>
              </div>
            </div>

            {task.result_summary && (
              <div className="card" style={{ borderColor: task.status === 'failed' ? 'var(--danger-border)' : 'var(--success-border)' }}>
                <div className="card__head">
                  <div className="card__title">{task.status === 'failed' ? 'Failure note' : 'Result summary'}</div>
                  <Chip tone={task.status === 'failed' ? 'danger' : 'success'}>{task.status}</Chip>
                </div>
                <div className="card__body">
                  <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{task.result_summary}</div>
                </div>
              </div>
            )}

            {run && run.status === 'suspended' && (
              <Banner tone="warn" title="Run is suspended waiting on human approval">
                <>Stage: <span className="mono">{run.suspended_stage}</span>. An ApprovalRequest was created — decide it to resume.</>
              </Banner>
            )}

            {!task.run_id && (
              <div className="card">
                <div className="card__body">
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                    No run has been started for this task. {task.status === 'pending' ? 'The orchestrator picks up pending tasks shortly.' : 'Task is in ' + task.status + ' state.'}
                  </div>
                  <Btn variant="primary" icon={<IconPlay />}>Start now (mock)</Btn>
                </div>
              </div>
            )}

            {run && (
              <div className="card">
                <div className="card__head">
                  <div className="card__title">Steps · preview</div>
                  <Link to={`/runs/${run.id}`} className="btn btn--ghost btn--sm">Full timeline <IconArrowRight className="ic ic--sm" /></Link>
                </div>
                <div className="card__body">
                  <div className="timeline">
                    {run.steps.slice(0, 5).map(s => (
                      <div key={s.id} className="timeline__item">
                        <span className={`timeline__dot timeline__dot--${s.status === 'ok' ? 'success' : s.status === 'failed' ? 'danger' : s.status === 'pending' ? 'warn' : s.status === 'blocked' ? 'warn' : 'accent'}`} />
                        <div className="timeline__head">
                          <span className="timeline__kind">{s.step_type.replace('_', ' ')}</span>
                          <span className="timeline__title">{s.title ?? s.step_type}</span>
                          <span className="timeline__time">{durationMs(s.duration_ms)}</span>
                        </div>
                        {s.detail && <div className="timeline__body">{s.detail}</div>}
                      </div>
                    ))}
                    {run.steps.length > 5 && (
                      <div style={{ padding: '10px 0 0 40px', fontSize: 11, color: 'var(--text-dim)' }}>
                        … +{run.steps.length - 5} more steps
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="stack">
            <div className="card">
              <div className="card__head"><div className="card__title">Provenance</div></div>
              <div className="card__body">
                <div className="row" style={{ gap: 12, marginBottom: 16 }}>
                  <Avatar initials={starter?.initials ?? 'U'} tone={starter?.avatar_tone ?? 'accent'} size={38} />
                  <div>
                    <div style={{ fontSize: 13 }}>{task.created_by_name ?? task.created_by}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{task.created_by}</div>
                  </div>
                </div>
                <MetaRow label="Agent" value={<Link to={`/agents/${task.assigned_agent_id}`}>{task.agent_name ?? task.assigned_agent_id}</Link>} />
                <MetaRow label="Version" value={<span className="mono">{task.assigned_agent_version_id}</span>} />
                <MetaRow label="Tenant" value={<span className="mono">{task.tenant_id}</span>} />
                <MetaRow label="Domain" value={<span className="mono">{task.domain_id}</span>} />
                <MetaRow label="Type" value={<Chip>{task.type}</Chip>} />
                <MetaRow label="Created" value={absTime(task.created_at)} />
                <MetaRow label="Last update" value={ago(task.updated_at)} />
                <MetaRow label="Duration" value={durationMs(task.duration_ms ?? null)} />
              </div>
            </div>

            <div className="card">
              <div className="card__head"><div className="card__title">Cost & resources</div></div>
              <div className="card__body">
                <Metric label="Total spend" value={money(task.spend_usd ?? 0, { cents: true })} />
                {run && (
                  <>
                    <Metric label="Tokens in" value={num(run.total_tokens_in)} />
                    <Metric label="Tokens out" value={num(run.total_tokens_out)} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="metric__label">{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  )
}
