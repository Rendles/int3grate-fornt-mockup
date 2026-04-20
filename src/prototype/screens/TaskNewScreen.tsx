import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status, MockBadge } from '../components/common'
import { Banner, LoadingList } from '../components/states'
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconLock,
  IconPlay,
  IconRoute,
} from '../components/icons'
import { Link, useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent, AgentVersion, Task, TaskType, ToolGrant } from '../lib/types'
import { allUsers } from '../lib/fixtures'

const SAMPLES: Record<string, { title: string; input: string; type: TaskType }[]> = {
  agt_lead_qualifier: [
    { title: 'Triage today\'s inbound', input: 'Process form submissions since 09:00. Score against ICP, enrich, draft outreach for top 10.', type: 'one_time' },
    { title: 'Rescore stalled leads · daily', input: 'Re-score leads that haven\'t been touched in 30 days against the current ICP.', type: 'schedule' },
  ],
  agt_refund_resolver: [
    { title: 'Resolve a refund request', input: 'Customer email attached. Investigate, apply policy, issue refund if under cap.', type: 'one_time' },
    { title: 'Chat · policy explainer', input: 'Explain current refund policy to a support agent in conversation.', type: 'chat' },
  ],
  agt_invoice_reconciler: [
    { title: 'Reconcile Oct batch', input: 'Reconcile 24 invoices from Quickbooks batch #oct-2026 against purchase orders.', type: 'one_time' },
  ],
  agt_deal_writer: [
    { title: 'Summarise last week\'s Northwind calls', input: 'Pull transcripts from Gong, summarise into deal-stage note, post to Slack.', type: 'one_time' },
    { title: 'Chat · tweak a deal note', input: 'Iterate on a generated deal note until it reads well.', type: 'chat' },
  ],
  agt_vendor_onboarder: [
    { title: 'Onboard new vendor', input: 'Vendor W-9 attached. Validate details, create vendor in finance systems, set Net-30 terms.', type: 'one_time' },
  ],
  agt_access_provisioner: [
    { title: 'Offboard employee', input: 'Employee ID {ID}. Revoke access to Okta, Slack, GitHub, Notion, AWS, Stripe.', type: 'one_time' },
  ],
  agt_campaign_drafter: [
    { title: 'Draft campaign sequence', input: 'Brief attached. Produce a 4-email nurture sequence for enterprise prospects.', type: 'one_time' },
  ],
  agt_kb_sync: [
    { title: 'Nightly KB diff', input: 'Compare internal runbook to public KB. Propose diffs.', type: 'schedule' },
  ],
}

const TYPE_DESC: Record<TaskType, string> = {
  chat: 'Conversational back-and-forth. The agent waits for your replies.',
  one_time: 'Fire-and-forget. Run once, return a result, end.',
  schedule: 'Recurring. Run on a cron / interval.',
}

const DOMAINS = [
  { id: 'dom_hq', name: 'HQ · Platform' },
  { id: 'dom_sales', name: 'Sales · Revenue' },
  { id: 'dom_support', name: 'Support · CX' },
]

interface FieldErrors {
  agent?: string
  title?: string
  input?: string
}

export default function TaskNewScreen() {
  const { search } = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const users = useMemo(() => allUsers(), [])

  const initialType = (search.get('type') as TaskType | null)
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [agentId, setAgentId] = useState<string>(search.get('agent') ?? '')
  const [title, setTitle] = useState<string>(search.get('title') ?? '')
  const [input, setInput] = useState<string>(search.get('input') ?? '')
  const [type, setType] = useState<TaskType>(
    initialType === 'chat' || initialType === 'one_time' || initialType === 'schedule' ? initialType : 'one_time'
  )
  const [priority, setPriority] = useState<Task['priority']>('normal')
  const [domainOverride, setDomainOverride] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [created, setCreated] = useState<Task | null>(null)

  // Agent-specific data (tracked alongside which agent they belong to, so we can show loading while refetching)
  const [agentData, setAgentData] = useState<{ agentId: string; version: AgentVersion | null; grants: ToolGrant[] } | null>(null)

  useEffect(() => {
    api.listAgents().then(list => {
      setAgents(list)
      if (!agentId && list.length) {
        setAgentId(list.find(a => a.status === 'active')?.id ?? list[0].id)
      }
    })
  }, [agentId])

  useEffect(() => {
    if (!agentId) return
    let cancelled = false
    Promise.all([
      api.listAgentVersions(agentId),
      api.getGrants(agentId),
    ]).then(([vs, gs]) => {
      if (cancelled) return
      setAgentData({
        agentId,
        version: vs.find(v => v.is_active) ?? null,
        grants: gs,
      })
    })
    return () => { cancelled = true }
  }, [agentId])

  const agent = useMemo(() => agents?.find(a => a.id === agentId) ?? null, [agents, agentId])
  const owner = useMemo(() => users.find(u => u.id === agent?.owner_user_id), [users, agent])
  const samples = agent ? (SAMPLES[agent.id] ?? []) : []
  const currentAgentData = agentData?.agentId === agentId ? agentData : null
  const activeVersion = currentAgentData?.version ?? null
  const grants = currentAgentData?.grants ?? null
  const gatedGrants = (grants ?? []).filter(g => g.approval_required)
  const agentRunnable = agent?.status === 'active' && !!activeVersion

  const fieldErrors = useMemo<FieldErrors>(() => {
    const e: FieldErrors = {}
    if (!agentId) e.agent = 'Pick an agent'
    if (!title.trim()) e.title = 'Required'
    if (!input.trim()) e.input = 'Required'
    else if (input.trim().length < 10) e.input = 'Add more detail — at least 10 characters'
    return e
  }, [agentId, title, input])
  const valid = Object.keys(fieldErrors).length === 0
  const show = (key: keyof FieldErrors) => submitted && fieldErrors[key]

  const submit = async () => {
    setSubmitted(true)
    if (!valid || !agent || !agentRunnable) return
    setBusy(true)
    setSaveError(null)
    try {
      const t = await api.createTask({
        assigned_agent_id: agent.id,
        title: title.trim(),
        user_input: input.trim(),
        type,
        priority,
      })
      setCreated(t)
    } catch (e) {
      setSaveError((e as Error).message ?? 'Failed to create task')
    } finally {
      setBusy(false)
    }
  }

  const startAnother = () => {
    setCreated(null)
    setSubmitted(false)
    setTitle('')
    setInput('')
  }

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'tasks', to: '/tasks' }, { label: created ? 'created' : 'new' }]}>
      <div className="page page--narrow">
        <PageHeader
          eyebrow="CREATE TASK · START AGENT"
          title={created ? <><em>Dispatched</em></> : <>Dispatch <em>a task.</em></>}
          subtitle={
            created
              ? 'The task has been queued. If the orchestrator started a run, you can jump to its timeline below.'
              : 'Pick an agent, give it work to do, set the task type. The backend queues a run and the task detail follows the run timeline as steps stream in.'
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
          <SuccessPanel task={created} onStartAnother={startAnother} />
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

            {submitted && !valid && (
              <div className="banner banner--warn" role="alert">
                <span className="banner__icon"><IconAlert className="ic" /></span>
                <div style={{ flex: 1 }}>
                  <div className="banner__title">Fix validation errors</div>
                  <div className="banner__body">Check the inline messages below.</div>
                </div>
              </div>
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
                          borderColor: on ? 'var(--accent-border)' : undefined,
                          background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                          display: 'grid',
                          gridTemplateColumns: '40px minmax(0, 1fr) 100px',
                          gap: 14,
                          alignItems: 'center',
                          opacity: a.status === 'paused' ? 0.75 : 1,
                        }}
                        onClick={() => setAgentId(a.id)}
                      >
                        <div className="agent-row__avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{a.glyph ?? '··'}</div>
                        <div style={{ minWidth: 0, textAlign: 'left' }}>
                          <div className="row" style={{ gap: 8 }}>
                            <span style={{ color: 'var(--text)', fontSize: 13 }}>{a.name}</span>
                            {a.owner_team && <Chip>{a.owner_team}</Chip>}
                          </div>
                          <div className="agent-row__desc truncate" style={{ marginTop: 2 }}>{a.description}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Status status={a.status} />
                          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 3 }}>
                            {a.tools_granted ?? 0} tools · {a.tools_requiring_approval ?? 0} gated
                          </div>
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

            {/* ACTIVE VERSION / WARNINGS */}
            {agent && <AgentCapsule agent={agent} version={activeVersion} owner={owner} gatedGrants={gatedGrants} />}

            <div style={{ height: 16 }} />

            {/* TYPE PICKER */}
            <div className="card">
              <div className="card__head"><div className="card__title">Task type</div></div>
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

            {samples.length > 0 && (
              <>
                <div style={{ height: 16 }} />
                <div className="card">
                  <div className="card__head">
                    <div className="card__title">Quick starters</div>
                    <Chip>samples for {agent?.name}</Chip>
                  </div>
                  <div className="card__body">
                    <div className="stack stack--sm">
                      {samples.map((s, i) => (
                        <button
                          key={i}
                          className="login__role"
                          style={{ textAlign: 'left', padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 90px 16px', gap: 10, alignItems: 'center' }}
                          onClick={() => { setTitle(s.title); setInput(s.input); setType(s.type) }}
                        >
                          <div>
                            <div style={{ color: 'var(--text)', fontSize: 12.5 }}>{s.title}</div>
                            <div className="truncate" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{s.input}</div>
                          </div>
                          <Chip>{s.type.replace('_', ' ')}</Chip>
                          <IconArrowRight className="ic" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div style={{ height: 16 }} />

            <div className="card">
              <div className="card__body">
                <div className="form-row">
                  <div>
                    <div className="form-row__label">Title <span className="danger">*</span></div>
                    <div className="form-row__hint">Surfaces in the task list.</div>
                  </div>
                  <div className="form-row__control">
                    <input
                      className="input"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Triage today's inbound leads"
                      aria-invalid={!!show('title')}
                      style={show('title') ? { borderColor: 'var(--danger-border)' } : undefined}
                    />
                    {show('title') && (
                      <div className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
                        <IconAlert className="ic ic--sm" /> {fieldErrors.title}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-row">
                  <div>
                    <div className="form-row__label">Input · user_input <span className="danger">*</span></div>
                    <div className="form-row__hint">Be specific — the agent only sees this plus its instruction spec.</div>
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
                <div className="form-row">
                  <div>
                    <div className="form-row__label row row--sm">
                      Priority <MockBadge size="xs" title="priority is not part of POST /tasks in gateway.yaml" />
                    </div>
                    <div className="form-row__hint">Affects scheduling and how approvals are routed.</div>
                  </div>
                  <div className="form-row__control">
                    <div className="row">
                      {(['normal', 'high', 'urgent'] as Task['priority'][]).map(p => (
                        <button
                          key={p}
                          className={`chip${priority === p ? (p === 'urgent' ? ' chip--danger' : p === 'high' ? ' chip--warn' : ' chip--accent') : ''}`}
                          style={{ cursor: 'pointer', padding: '4px 10px' }}
                          onClick={() => setPriority(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="form-row">
                    <div>
                      <div className="form-row__label">Domain override</div>
                      <div className="form-row__hint">By default the task is scoped to the agent's domain. Tenant admins can override for cross-domain work.</div>
                    </div>
                    <div className="form-row__control">
                      <select
                        className="select"
                        value={domainOverride ?? ''}
                        onChange={e => setDomainOverride(e.target.value || null)}
                      >
                        <option value="">— use agent's domain ({agent?.domain_id ?? '—'}) —</option>
                        {DOMAINS.map(d => <option key={d.id} value={d.id}>{d.name} · {d.id}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ height: 16 }} />
            <Banner tone="info" title="What happens next">
              <>
                <span className="mono">POST /tasks</span> creates the task (<Chip>pending</Chip>) and the backend starts a run. The response returns the Task, not the full RunDetail — so once created, you'll see a confirmation with the task ID and a link to its detail.
              </>
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

// ─────────────────────────────────────────────── Agent capsule (version + warnings)

function AgentCapsule({
  agent, version, owner, gatedGrants,
}: {
  agent: Agent
  version: AgentVersion | null
  owner: ReturnType<typeof allUsers>[number] | undefined
  gatedGrants: ToolGrant[]
}) {
  const isRunnable = agent.status === 'active' && !!version
  return (
    <>
      <div style={{ height: 12 }} />
      <div
        className="card"
        style={{
          borderColor: !isRunnable ? 'var(--warn-border)' : agent.status === 'paused' ? 'var(--warn-border)' : undefined,
          background: !isRunnable ? 'var(--warn-soft)' : undefined,
        }}
      >
        <div className="card__body">
          <div className="row" style={{ gap: 14 }}>
            <div className="agent-row__avatar" style={{ width: 42, height: 42, fontSize: 13 }}>{agent.glyph ?? '··'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--text)' }}>{agent.name}</span>
                <Status status={agent.status} />
                {version ? (
                  <Chip tone="accent">v{version.version_number} · {version.model_chain_config.primary}</Chip>
                ) : (
                  <Chip tone="warn">no active version</Chip>
                )}
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {agent.tenant_id} · {agent.domain_id} · owner {owner?.name ?? agent.owner_user_id}
              </div>
            </div>
            {version && (
              <Link to={`/agents/${agent.id}/versions`} className="btn btn--ghost btn--sm">
                version <IconArrowRight className="ic ic--sm" />
              </Link>
            )}
          </div>

          {/* Warnings */}
          {!version && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="warn" title="This agent has no active version">
                Create a version before starting a task. Without one, the orchestrator can't pick a model or prompt.
              </Banner>
            </div>
          )}
          {agent.status === 'paused' && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="warn" title="Agent is paused">
                Paused agents can't pick up new tasks. Resume the agent or pick a different one.
              </Banner>
            </div>
          )}
          {agent.status === 'archived' && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="warn" title="Agent is archived">
                Archived agents are retained for audit but can't run. Pick an active agent.
              </Banner>
            </div>
          )}
          {agent.status === 'draft' && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="warn" title="Agent is still in draft">
                Activate the agent before dispatching tasks.
              </Banner>
            </div>
          )}

          {isRunnable && gatedGrants.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="info" title={`This agent has ${gatedGrants.length} approval-gated tool${gatedGrants.length === 1 ? '' : 's'}`}>
                <>
                  <div style={{ marginBottom: 8 }}>
                    The run may suspend mid-execution and ask a human to approve one of:
                  </div>
                  <div className="row row--wrap row--sm">
                    {gatedGrants.slice(0, 6).map(g => (
                      <Chip key={g.id} tone="warn">
                        <IconLock className="ic ic--sm" /> {g.tool_name}
                      </Chip>
                    ))}
                    {gatedGrants.length > 6 && <Chip>+{gatedGrants.length - 6} more</Chip>}
                  </div>
                </>
              </Banner>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────── Success panel

function SuccessPanel({ task, onStartAnother }: { task: Task; onStartAnother: () => void }) {
  const hasRun = !!task.run_id
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
                {hasRun ? 'Run started.' : 'Task queued.'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                {hasRun
                  ? <>The orchestrator picked it up and a run is in progress. Watch steps stream in on the run timeline.</>
                  : <><span className="mono">POST /tasks</span> returned the task with <span className="mono">run_id = null</span>. The orchestrator will pick it up shortly — open the task detail to watch for the run ID.</>
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <div className="card__title">What was created</div>
          <Status status={task.status} />
        </div>
        <div className="card__body">
          <MetaRow label="Task ID" value={<span className="mono">{task.id}</span>} />
          <MetaRow label="Agent" value={<Link to={`/agents/${task.assigned_agent_id}`}>{task.agent_name ?? task.assigned_agent_id}</Link>} />
          <MetaRow label="Version" value={<span className="mono">{task.assigned_agent_version_id || '—'}</span>} />
          <MetaRow label="Type" value={<Chip>{task.type.replace('_', ' ')}</Chip>} />
          <MetaRow label="Priority" value={<Chip tone={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warn' : 'ghost'}>{task.priority ?? 'normal'}</Chip>} />
          <MetaRow label="Scope" value={<span className="mono">{task.tenant_id} / {task.domain_id}</span>} />
          <MetaRow label="Run" value={task.run_id ? <span className="mono accent">{task.run_id}</span> : <span className="mono muted">pending — no run_id yet</span>} />
        </div>
      </div>

      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onStartAnother}>Start another</Btn>
        {hasRun ? (
          <Btn variant="primary" href={`/runs/${task.run_id}`} icon={<IconRoute />}>Open run timeline</Btn>
        ) : (
          <Btn variant="primary" href={`/tasks/${task.id}`} icon={<IconArrowRight />}>Open task detail</Btn>
        )}
      </div>

      <Banner tone="info" title="Why there may not be a run_id yet">
        <span className="mono">POST /tasks</span> returns a Task object, not the full RunDetail — so the UI only jumps straight to a run timeline when the returned Task includes a <span className="mono">run_id</span>. Otherwise the task detail will update as soon as the orchestrator attaches a run.
      </Banner>
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
