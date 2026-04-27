import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Code, DataList, Flex, Grid, Separator, Text } from '@radix-ui/themes'
import { AppShell } from '../components/shell'
import { PageHeader, MetaRow, MockBadge, Status, InfoHint } from '../components/common'
import { TextAreaField, TextInput } from '../components/fields'
import { Banner, LoadingList } from '../components/states'
import { IconAlert, IconArrowRight, IconCheck, IconPlay } from '../components/icons'
import { Link, useRouter } from '../router'
import { api } from '../lib/api'
import { domainLabel } from '../lib/format'
import type { Agent, Task, TaskType } from '../lib/types'

// Chat-type interactions live on /chats now (gateway (5).yaml). The picker
// here only surfaces non-chat types; visiting `?type=chat` redirects to the
// chat surface.
type DispatchableTaskType = Exclude<TaskType, 'chat'>
const DISPATCHABLE_TYPES: DispatchableTaskType[] = ['one_time', 'schedule']
const TYPE_DESC: Record<DispatchableTaskType, string> = {
  one_time: 'Fire-and-forget. Run once, return a result, end.',
  schedule: 'Recurring. Run on a cron / interval.',
}

interface FieldErrors {
  agent?: string
  input?: string
}

export default function TaskNewScreen() {
  const { search, navigate } = useRouter()

  const initialType = search.get('type')
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [agentId, setAgentId] = useState<string>(search.get('agent') ?? '')
  const [title, setTitle] = useState<string>(search.get('title') ?? '')
  const [input, setInput] = useState<string>(search.get('input') ?? '')
  const [type, setType] = useState<DispatchableTaskType>(
    initialType === 'one_time' || initialType === 'schedule' ? initialType : 'one_time',
  )
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [created, setCreated] = useState<Task | null>(null)

  // Old links still arrive with `?type=chat` — bounce them to the chat surface.
  useEffect(() => {
    if (initialType !== 'chat') return
    const params = new URLSearchParams()
    const agentParam = search.get('agent')
    if (agentParam) params.set('agent', agentParam)
    const titleParam = search.get('title')
    if (titleParam) params.set('title', titleParam)
    const qs = params.toString()
    navigate(qs ? `/chats/new?${qs}` : '/chats/new')
  }, [initialType, navigate, search])

  useEffect(() => {
    api.listAgents().then(res => {
      const list = res.items
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
              <MockBadge kind="deferred" />{' '}
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
              <Button asChild variant="ghost"><a href="#/tasks">Back to tasks</a></Button>
            ) : (
              <>
                <Button asChild variant="soft" color="gray" disabled={busy} size="2"><a href="#/tasks">Cancel</a></Button>
                <Button
                  onClick={submit}
                  disabled={busy || !agentRunnable}
                  title={!agentRunnable ? 'Agent must be active with an active version' : undefined}
                >
                  <IconPlay />
                  {busy ? 'dispatching…' : 'Start task'}
                </Button>
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
          <SuccessPanel task={created} agentName={agent?.name ?? '—'} />
        ) : (
          <>
            {saveError && (
              <Banner
                tone="warn"
                title="Couldn't start task"
                action={<Button variant="ghost" onClick={() => setSaveError(null)}>Dismiss</Button>}
              >
                {saveError}
              </Banner>
            )}

            {/* AGENT PICKER */}
            <div className="card">
              <div className="card__head">
                <Text as="div" size="2" weight="medium" className="card__title">Agent</Text>
                {agent && !agentRunnable && (
                  <Badge color="amber" variant="soft" radius="full" size="1">
                    {agent.status !== 'active' ? `${agent.status} · can't run` : 'no active version'}
                  </Badge>
                )}
              </div>
              <div className="card__body">
                <Flex direction="column" gap="2">
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
                          <Text as="div" size="2">{a.name}</Text>
                          {a.description && (
                            <Text as="div" size="1" color="gray" mt="1" className="truncate">
                              {a.description}
                            </Text>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Status status={a.status} />
                          {a.active_version && (
                            <Text as="div" size="1" color="gray" mt="1">
                              v{a.active_version.version}
                            </Text>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </Flex>
                {show('agent') && (
                  <Text as="div" size="1" color="red" mt="2">
                    <Flex align="center" gap="2">
                      <IconAlert className="ic ic--sm" /> {fieldErrors.agent}
                    </Flex>
                  </Text>
                )}
              </div>
            </div>

            <div style={{ height: 16 }} />

            {/* TYPE PICKER */}
            <div className="card">
              <div className="card__head">
                <Text as="div" size="2" weight="medium" className="card__title">Type</Text>
                <Text size="1" color="gray">
                  Need a chat? Use{' '}
                  <Link to={`/chats/new${agentId ? `?agent=${agentId}` : ''}`}>
                    <Text size="1" color="blue">Chats →</Text>
                  </Link>
                </Text>
              </div>
              <div className="card__body">
                <Grid columns="2" gap="4">
                  {DISPATCHABLE_TYPES.map(t => {
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
                        <Text as="div" size="4" mb="2">
                          {t.replace('_', ' ')}
                        </Text>
                        <Text as="div" size="1" color="gray" style={{ lineHeight: 1.5 }}>{TYPE_DESC[t]}</Text>
                      </button>
                    )
                  })}
                </Grid>
              </div>
            </div>

            <div style={{ height: 16 }} />

            <div className="card">
              <div className="card__body">
                <Grid columns={{ initial: '1', md: '240px 1fr' }} gap="5" py="5">
                  <Box>
                    <Text as="div" size="2" weight="medium">Title</Text>
                    <Text as="div" size="1" color="gray" mt="1">Optional — shows in task lists.</Text>
                  </Box>
                  <Box>
                    <TextInput
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Triage today's inbound leads"
                    />
                  </Box>
                </Grid>
                <Separator size="4" />
                <Grid columns={{ initial: '1', md: '240px 1fr' }} gap="5" py="5">
                  <Box>
                    <Text as="div" size="2" weight="medium">Input <Text as="span" color="red">*</Text></Text>
                    <Text as="div" size="1" color="gray" mt="1">Required. The message the agent will see.</Text>
                  </Box>
                  <Box>
                    <TextAreaField
                      style={{ minHeight: 140 }}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Describe what needs to happen…"
                      error={show('input') ? fieldErrors.input : undefined}
                    />
                  </Box>
                </Grid>
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

function SuccessPanel({ task, agentName }: { task: Task; agentName: string }) {
  return (
    <Flex direction="column" gap="4">
      <div
        className="card"
        style={{
          borderColor: 'var(--green-a6)',
          background: 'var(--green-a3)',
        }}
      >
        <div className="card__body">
          <Flex align="start" gap="4">
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
            <Box flexGrow="1">
              <Text as="div" size="7" style={{ letterSpacing: '-0.01em' }}>
                Task queued.
              </Text>
              <Text as="div" size="2" color="gray" mt="2" style={{ lineHeight: 1.5 }}>
                The orchestrator will pick it up shortly. Open the task detail to watch for run attachment.
              </Text>
            </Box>
          </Flex>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">Summary</Text>
          <Status status={task.status} />
        </div>
        <div className="card__body">
          <DataList.Root size="2">
            <MetaRow label="title" value={task.title ?? <Text color="gray">— untitled —</Text>} />
            <MetaRow label="agent" value={<Link to={`/agents/${task.assigned_agent_id}`}>{agentName}</Link>} />
            <MetaRow label="type" value={<Badge color="gray" variant="soft" radius="full" size="1">{task.type.replace('_', ' ')}</Badge>} />
            <MetaRow label="domain" value={domainLabel(task.domain_id)} />
          </DataList.Root>
        </div>
      </div>

      <Flex justify="end" gap="2">
        <Button asChild><a href={`#/tasks/${task.id}`}><IconArrowRight />Open task detail</a></Button>
      </Flex>
    </Flex>
  )
}
