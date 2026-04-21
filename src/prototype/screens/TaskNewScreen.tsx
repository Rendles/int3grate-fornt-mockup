import { useEffect, useMemo, useState } from 'react'
import { Code, DataList, Text } from '@radix-ui/themes'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, MetaRow, Status, InfoHint } from '../components/common'
import { TextAreaField, TextInput } from '../components/fields'
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
          eyebrow={
            <>
              DISPATCH TASK{' '}
              <InfoHint>
                Creates a task via <Code variant="ghost">POST /tasks</Code>. Requires an agent and user_input. The orchestrator attaches a run asynchronously — the task response doesn't include a run_id.
              </InfoHint>
            </>
          }
          title={created ? <><em>Dispatched</em></> : <>Dispatch <em>a task.</em></>}
          subtitle={
            created
              ? 'Task queued. Open its detail to watch the orchestrator attach a run.'
              : 'Pick an agent, describe what it should do, fire it off.'
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

        <Banner tone="warn" title="Task concept is MVP-deferred (ADR-0003)">
          Gateway v0.2.0 marks <Code variant="ghost">POST /tasks</Code> as <Code variant="ghost">x-mvp-deferred</Code>. The production path will dispatch runs directly; this form remains for design continuity.
        </Banner>
        <div style={{ height: 16 }} />

        {!agents ? (
          <LoadingList rows={4} />
        ) : created ? (
          <SuccessPanel task={created} />
        ) : (
          <>
            {saveError && (
              <Banner
                tone="warn"
                title="Couldn't start task"
                action={<Btn variant="ghost" onClick={() => setSaveError(null)}>Dismiss</Btn>}
              >
                {saveError}
              </Banner>
            )}

            {/* AGENT PICKER */}
            <div className="card">
              <div className="card__head">
                <div className="card__title">Agent</div>
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
                          borderColor: on ? 'var(--accent-a7)' : undefined,
                          background: on ? 'var(--accent-a3)' : 'var(--gray-3)',
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) 100px',
                          gap: 14,
                          alignItems: 'center',
                          opacity: a.status === 'paused' ? 0.75 : 1,
                        }}
                        onClick={() => setAgentId(a.id)}
                      >
                        <div style={{ minWidth: 0, textAlign: 'left' }}>
                          <div style={{ color: 'var(--gray-12)', fontSize: 13 }}>{a.name}</div>
                          <div className="truncate" style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 2 }}>
                            {a.id}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Status status={a.status} />
                          {a.active_version && (
                            <div style={{ fontSize: 10.5, color: 'var(--gray-10)', marginTop: 3 }}>
                              v{a.active_version.version}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
                {show('agent') && (
                  <div className="row row--sm" style={{ marginTop: 8, color: 'var(--red-11)', fontSize: 11.5 }}>
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
                          borderColor: on ? 'var(--accent-a7)' : undefined,
                          background: on ? 'var(--accent-a3)' : 'var(--gray-3)',
                        }}
                        onClick={() => setType(t)}
                      >
                        <div style={{ fontFamily: 'var(--heading-font-family)', fontSize: 18, color: 'var(--gray-12)', marginBottom: 6 }}>
                          {t.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--gray-11)', lineHeight: 1.5 }}>{TYPE_DESC[t]}</div>
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
                    <TextInput
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Triage today's inbound leads"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div>
                    <div className="form-row__label">Input <Text as="span" color="red">*</Text></div>
                    <div className="form-row__hint">Required. The message the agent will see.</div>
                  </div>
                  <div className="form-row__control">
                    <TextAreaField
                      style={{ minHeight: 140 }}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Describe what needs to happen…"
                      error={show('input') ? fieldErrors.input : undefined}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ height: 16 }} />
            <Banner tone="info" title="What gets created">
              A pending Task is created and the orchestrator picks it up shortly. You won't see a run ID until the orchestrator attaches one — open the task detail to watch for it.
            </Banner>
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
          borderColor: 'var(--green-a6)',
          background: 'var(--green-a3)',
        }}
      >
        <div className="card__body">
          <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <div
              className="state__icon"
              style={{
                background: 'var(--green-a3)',
                borderColor: 'var(--green-a6)',
                color: 'var(--green-11)',
                margin: 0,
              }}
            >
              <IconCheck />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--heading-font-family)', fontSize: 26, color: 'var(--gray-12)', letterSpacing: '-0.01em' }}>
                Task queued.
              </div>
              <div style={{ fontSize: 13, color: 'var(--gray-11)', marginTop: 6, lineHeight: 1.5 }}>
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
          <DataList.Root size="2">
            <MetaRow label="task id" value={<Code variant="ghost">{task.id}</Code>} />
            <MetaRow label="agent_id" value={<Link to={`/agents/${task.assigned_agent_id}`}><Code variant="ghost">{task.assigned_agent_id}</Code></Link>} />
            <MetaRow label="version_id" value={<Code variant="ghost">{task.assigned_agent_version_id ?? '—'}</Code>} />
            <MetaRow label="type" value={<Chip>{task.type.replace('_', ' ')}</Chip>} />
            <MetaRow label="tenant_id" value={<Code variant="ghost">{task.tenant_id}</Code>} />
            <MetaRow label="domain_id" value={<Code variant="ghost">{task.domain_id ?? '—'}</Code>} />
          </DataList.Root>
        </div>
      </div>

      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="primary" href={`/tasks/${task.id}`} icon={<IconArrowRight />}>Open task detail</Btn>
      </div>
    </div>
  )
}
