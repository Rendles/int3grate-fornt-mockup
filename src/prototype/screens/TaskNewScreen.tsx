import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status } from '../components/common'
import { Banner, LoadingList } from '../components/states'
import { IconAlert, IconArrowRight, IconCheck, IconPlay } from '../components/icons'
import { Link, useRouter } from '../router'
import { api } from '../lib/api'
import type { Agent, Task, TaskType } from '../lib/types'

const TYPE_DESC: Record<TaskType, string> = {
  chat: 'Conversational back-and-forth. The agent waits for your replies.',
  one_time: 'Fire-and-forget. Run once, return a result, end.',
  schedule: 'Recurring. Run on a cron / interval.',
}

interface FieldErrors {
  agent?: string
  input?: string
}

export default function TaskNewScreen() {
  const { search } = useRouter()

  const initialType = search.get('type')
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [agentId, setAgentId] = useState<string>(search.get('agent') ?? '')
  const [title, setTitle] = useState<string>(search.get('title') ?? '')
  const [input, setInput] = useState<string>(search.get('input') ?? '')
  const [type, setType] = useState<TaskType>(
    initialType === 'chat' || initialType === 'one_time' || initialType === 'schedule' ? initialType : 'chat',
  )
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [created, setCreated] = useState<Task | null>(null)

  useEffect(() => {
    api.listAgents().then(list => {
      setAgents(list)
      if (!agentId && list.length) {
        setAgentId(list.find(a => a.status === 'active')?.id ?? list[0].id)
      }
    })
  }, [agentId])

  const agent = useMemo(() => agents?.find(a => a.id === agentId) ?? null, [agents, agentId])
  const agentRunnable = agent?.status === 'active' && !!agent.active_version

  const fieldErrors = useMemo<FieldErrors>(() => {
    const e: FieldErrors = {}
    if (!agentId) e.agent = 'Pick an agent'
    if (!input.trim()) e.input = 'Required'
    else if (input.trim().length < 1) e.input = 'Required'
    return e
  }, [agentId, input])
  const valid = Object.keys(fieldErrors).length === 0
  const show = (key: keyof FieldErrors) => submitted && fieldErrors[key]

  const submit = async () => {
    setSubmitted(true)
    if (!valid || !agent || !agentRunnable) return
    setBusy(true)
    setSaveError(null)
    try {
      const t = await api.createTask({
        agent_id: agent.id,
        user_input: input.trim(),
        type,
        title: title.trim() || undefined,
      })
      setCreated(t)
    } catch (e) {
      setSaveError((e as Error).message ?? 'Failed to create task')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'tasks', to: '/tasks' }, { label: created ? 'created' : 'new' }]}>
      <div className="page page--narrow">
        <PageHeader
          eyebrow="POST /tasks"
          title={created ? <><em>Dispatched</em></> : <>Dispatch <em>a task.</em></>}
          subtitle={
            created
              ? 'Task queued. Open its detail to watch the orchestrator attach a run.'
              : 'POST /tasks requires an agent and user_input. The backend starts a run but Task response does not return run_id.'
          }
          actions={
            created ? (
              <Btn variant="ghost" href="/tasks">Back to tasks</Btn>
            ) : (
              <>
                <Btn variant="ghost" href="/tasks" disabled={busy}>Cancel</Btn>
                <Btn
                  variant="primary"
                  icon={<IconPlay />}
                  onClick={submit}
                  disabled={busy || !agentRunnable}
                  title={!agentRunnable ? 'Agent must be active with an active version' : undefined}
                >
                  {busy ? 'dispatching…' : 'Start task'}
                </Btn>
              </>
            )
          }
        />

        {!agents ? (
          <LoadingList rows={4} />
        ) : created ? (
          <SuccessPanel task={created} />
        ) : (
          <>
            {saveError && (
              <div className="banner banner--warn" role="alert">
                <span className="banner__icon"><IconAlert className="ic" style={{ color: 'var(--danger)' }} /></span>
                <div style={{ flex: 1 }}>
                  <div className="banner__title" style={{ color: 'var(--danger)' }}>Couldn't start task</div>
                  <div className="banner__body">{saveError}</div>
                </div>
                <Btn variant="ghost" onClick={() => setSaveError(null)}>Dismiss</Btn>
              </div>
            )}

            {/* AGENT PICKER */}
            <div className="card">
              <div className="card__head">
                <div className="card__title">Agent · agent_id</div>
                {agent && !agentRunnable && (
                  <Chip tone="warn">
                    {agent.status !== 'active' ? `${agent.status} · can't run` : 'no active version'}
                  </Chip>
                )}
              </div>
              <div className="card__body">
                <div className="stack stack--sm">
                  {agents.filter(a => a.status !== 'archived').map(a => {
                    const on = a.id === agentId
                    return (
                      <button
                        key={a.id}
                        className="login__role"
                        style={{
                          textAlign: 'left',
                          padding: 12,
                          borderColor: on ? 'var(--accent-border)' : undefined,
                          background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) 100px',
                          gap: 14,
                          alignItems: 'center',
                          opacity: a.status === 'paused' ? 0.75 : 1,
                        }}
                        onClick={() => setAgentId(a.id)}
                      >
                        <div style={{ minWidth: 0, textAlign: 'left' }}>
                          <div style={{ color: 'var(--text)', fontSize: 13 }}>{a.name}</div>
                          <div className="mono truncate" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                            {a.id}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Status status={a.status} />
                          {a.active_version && (
                            <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 3 }}>
                              v{a.active_version.version}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
                {show('agent') && (
                  <div className="row row--sm" style={{ marginTop: 8, color: 'var(--danger)', fontSize: 11.5 }}>
                    <IconAlert className="ic ic--sm" /> {fieldErrors.agent}
                  </div>
                )}
              </div>
            </div>

            <div style={{ height: 16 }} />

            {/* TYPE PICKER */}
            <div className="card">
              <div className="card__head"><div className="card__title">Type</div></div>
              <div className="card__body">
                <div className="grid grid--3">
                  {(['chat', 'one_time', 'schedule'] as TaskType[]).map(t => {
                    const on = type === t
                    return (
                      <button
                        key={t}
                        className="login__role"
                        style={{
                          textAlign: 'left',
                          padding: 14,
                          borderColor: on ? 'var(--accent-border)' : undefined,
                          background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                        }}
                        onClick={() => setType(t)}
                      >
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>
                          {t.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{TYPE_DESC[t]}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ height: 16 }} />

            <div className="card">
              <div className="card__body">
                <div className="form-row">
                  <div>
                    <div className="form-row__label">Title</div>
                    <div className="form-row__hint">Optional — shows in task lists.</div>
                  </div>
                  <div className="form-row__control">
                    <input
                      className="input"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Triage today's inbound leads"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div>
                    <div className="form-row__label">user_input <span className="danger">*</span></div>
                    <div className="form-row__hint">Required. The message the agent will see.</div>
                  </div>
                  <div className="form-row__control">
                    <textarea
                      className="input textarea"
                      style={{
                        minHeight: 140,
                        borderColor: show('input') ? 'var(--danger-border)' : undefined,
                      }}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Describe what needs to happen…"
                      aria-invalid={!!show('input')}
                    />
                    {show('input') && (
                      <div className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
                        <IconAlert className="ic ic--sm" /> {fieldErrors.input}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ height: 16 }} />
            <Banner tone="info" title="What POST /tasks returns">
              The endpoint responds with the Task (id, type, status=pending, created_at, …). run_id is not part of the
              Task schema — open the task detail to find the run once the orchestrator attaches one.
            </Banner>

            <div style={{ height: 20 }} />
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'right' }}>
              endpoint · <span className="accent">POST /tasks</span>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

function SuccessPanel({ task }: { task: Task }) {
  return (
    <div className="stack">
      <div
        className="card"
        style={{
          borderColor: 'var(--success-border)',
          background: 'var(--success-soft)',
        }}
      >
        <div className="card__body">
          <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <div
              className="state__icon"
              style={{
                background: 'var(--success-soft)',
                borderColor: 'var(--success-border)',
                color: 'var(--success)',
                margin: 0,
              }}
            >
              <IconCheck />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                Task queued.
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                The orchestrator will pick it up shortly. Open the task detail to watch for run attachment.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <div className="card__title">Response</div>
          <Status status={task.status} />
        </div>
        <div className="card__body">
          <MetaRow label="task id" value={<span className="mono">{task.id}</span>} />
          <MetaRow label="agent_id" value={<Link to={`/agents/${task.assigned_agent_id}`}><span className="mono">{task.assigned_agent_id}</span></Link>} />
          <MetaRow label="version_id" value={<span className="mono">{task.assigned_agent_version_id ?? '—'}</span>} />
          <MetaRow label="type" value={<Chip>{task.type.replace('_', ' ')}</Chip>} />
          <MetaRow label="tenant_id" value={<span className="mono">{task.tenant_id}</span>} />
          <MetaRow label="domain_id" value={<span className="mono">{task.domain_id ?? '—'}</span>} />
        </div>
      </div>

      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="primary" href={`/tasks/${task.id}`} icon={<IconArrowRight />}>Open task detail</Btn>
      </div>
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
