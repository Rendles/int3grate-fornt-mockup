import { useEffect, useState } from 'react'
import { Badge, Button, Code, DataList, Text } from '@radix-ui/themes'
import { AppShell } from '../components/shell'
import { PageHeader, MetaRow, MockBadge, Status, CommandBar, InfoHint } from '../components/common'
import { Banner, LoadingList, NoAccessState } from '../components/states'
import { IconPlay } from '../components/icons'
import { Link } from '../router'
import { api } from '../lib/api'
import type { Agent, Task, User } from '../lib/types'
import { absTime, ago, domainLabel } from '../lib/format'

export default function TaskDetailScreen({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<Task | null | undefined>(undefined)
  const [agents, setAgents] = useState<Agent[]>([])
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    api.getTask(taskId).then(t => setTask(t ?? null))
    api.listAgents().then(list => setAgents(list.items))
    api.listUsers().then(setUsers)
  }, [taskId])

  const agentName = (id: string | null | undefined) =>
    (id && agents.find(a => a.id === id)?.name) || '—'
  const userName = (id: string | null | undefined) =>
    (id && users.find(u => u.id === id)?.name) || '—'

  if (task === null) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'tasks', to: '/tasks' }, { label: 'not found' }]}>
        <div className="page"><NoAccessState requiredRole="access to this task" body={`Task ${taskId} could not be loaded.`} /></div>
      </AppShell>
    )
  }
  if (task === undefined) {
    return (
      <AppShell crumbs={[{ label: '...', to: '/' }]}><div className="page"><LoadingList rows={4} /></div></AppShell>
    )
  }

  return (
    <AppShell
      crumbs={[
        { label: 'home', to: '/' },
        { label: 'tasks', to: '/tasks' },
        { label: 'task' },
      ]}
    >
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              TASK{' '}
              <MockBadge kind="deferred" />{' '}
              <InfoHint>
                Loaded via <Code variant="ghost">GET /tasks/{'{id}'}</Code>. The task response doesn't include a run ID — open runs directly by ID.
              </InfoHint>
            </>
          }
          title={task.title ?? <>Untitled task</>}
          subtitle="Task details. To inspect the run, open it from the timeline."
          actions={
            <>
              <Status status={task.status} />
              <Button asChild variant="solid" title="Dispatch a new task with the same agent and type">
                <a href={`#/tasks/new?agent=${task.assigned_agent_id}&type=${task.type}&title=${encodeURIComponent(task.title ?? '')}`}>
                  <IconPlay />
                  Start another
                </a>
              </Button>
            </>
          }
        />

        <CommandBar
          parts={[
            { label: 'TYPE', value: task.type.replace('_', ' ') },
            { label: 'STATUS', value: task.status },
            { label: 'AGENT', value: agentName(task.assigned_agent_id) },
            { label: 'CREATED BY', value: userName(task.created_by) },
            { label: 'DOMAIN', value: domainLabel(task.domain_id) },
          ]}
        />

        <div style={{ height: 16 }} />
        <Banner tone="warn" title="Task concept is MVP-deferred (ADR-0003)">
          Gateway v0.2.0 marks <Code variant="ghost">/tasks/{'{id}'}</Code> as <Code variant="ghost">x-mvp-deferred</Code>. This screen is kept for design continuity; runs can exist without a task.
        </Banner>

        <div style={{ height: 20 }} />

        <div className="card">
          <div className="card__head">
            <Text as="div" size="2" weight="medium" className="card__title">
              Details{' '}
              <InfoHint>
                All fields stored on the task. Step count and spend are tracked on the run instead.
              </InfoHint>
            </Text>
          </div>
          <div className="card__body">
            <DataList.Root size="2">
              <MetaRow label="domain" value={domainLabel(task.domain_id)} />
              <MetaRow label="type" value={<Badge color="gray" variant="soft" radius="full" size="1">{task.type.replace('_', ' ')}</Badge>} />
              <MetaRow label="status" value={<Status status={task.status} />} />
              <MetaRow
                label="agent"
                value={task.assigned_agent_id
                  ? <Link to={`/agents/${task.assigned_agent_id}`}>{agentName(task.assigned_agent_id)}</Link>
                  : <Text color="gray">—</Text>}
              />
              <MetaRow label="created by" value={userName(task.created_by)} />
              <MetaRow label="title" value={task.title ?? <Text color="gray">—</Text>} />
              <MetaRow label="created" value={absTime(task.created_at)} />
              <MetaRow label="updated" value={`${absTime(task.updated_at)} · ${ago(task.updated_at)}`} />
            </DataList.Root>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
