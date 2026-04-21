import { useEffect, useState } from 'react'
import { Code, DataList } from '@radix-ui/themes'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, MetaRow, Status, CommandBar, InfoHint } from '../components/common'
import { Banner, LoadingList, NoAccessState } from '../components/states'
import { IconPlay } from '../components/icons'
import { Link } from '../router'
import { api } from '../lib/api'
import type { Task } from '../lib/types'
import { absTime, ago } from '../lib/format'

export default function TaskDetailScreen({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<Task | null | undefined>(undefined)

  useEffect(() => {
    api.getTask(taskId).then(t => setTask(t ?? null))
  }, [taskId])

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
        { label: task.id.toUpperCase() },
      ]}
    >
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              {`TASK · ${task.id}`}{' '}
              <InfoHint>
                Loaded via <Code variant="ghost">GET /tasks/{'{id}'}</Code>. The task response doesn't include a run ID — open runs directly by ID.
              </InfoHint>
            </>
          }
          title={task.title ?? <>Untitled task</>}
          subtitle="Task metadata. To inspect the run, open it by ID."
          actions={
            <>
              <Status status={task.status} />
              <Btn
                variant="ghost"
                icon={<IconPlay />}
                href={`/tasks/new?agent=${task.assigned_agent_id}&type=${task.type}&title=${encodeURIComponent(task.title ?? '')}`}
                title="Dispatch a new task with the same agent and type"
              >
                Start another
              </Btn>
            </>
          }
        />

        <CommandBar
          parts={[
            { label: 'ID', value: task.id },
            { label: 'TYPE', value: task.type.replace('_', ' ') },
            { label: 'STATUS', value: task.status },
            { label: 'AGENT', value: task.assigned_agent_id ?? '—' },
            { label: 'VERSION', value: task.assigned_agent_version_id ?? '—' },
            { label: 'CREATED BY', value: task.created_by ?? '—' },
          ]}
        />

        <div style={{ height: 16 }} />
        <Banner tone="warn" title="Task concept is MVP-deferred (ADR-0003)">
          Gateway v0.2.0 marks <Code variant="ghost">/tasks/{'{id}'}</Code> as <Code variant="ghost">x-mvp-deferred</Code>. This screen is kept for design continuity; runs can exist without a task.
        </Banner>

        <div style={{ height: 20 }} />

        <div className="card">
          <div className="card__head">
            <div className="card__title row row--sm">
              Metadata{' '}
              <InfoHint>
                All fields stored on the Task. There is no run ID, step count, or spend on this record — those live on the run.
              </InfoHint>
            </div>
          </div>
          <div className="card__body">
            <DataList.Root size="2">
              <MetaRow label="id" value={<Code variant="ghost">{task.id}</Code>} />
              <MetaRow label="tenant_id" value={<Code variant="ghost">{task.tenant_id}</Code>} />
              <MetaRow label="domain_id" value={<Code variant="ghost">{task.domain_id ?? '—'}</Code>} />
              <MetaRow label="type" value={<Chip>{task.type.replace('_', ' ')}</Chip>} />
              <MetaRow label="status" value={<Status status={task.status} />} />
              <MetaRow
                label="assigned_agent_id"
                value={task.assigned_agent_id
                  ? <Link to={`/agents/${task.assigned_agent_id}`} className="mono">{task.assigned_agent_id}</Link>
                  : <Code variant="ghost" color="gray">—</Code>}
              />
              <MetaRow label="assigned_agent_version_id" value={<Code variant="ghost">{task.assigned_agent_version_id ?? '—'}</Code>} />
              <MetaRow label="created_by" value={<Code variant="ghost">{task.created_by ?? '—'}</Code>} />
              <MetaRow label="title" value={task.title ?? <span className="muted">null</span>} />
              <MetaRow label="created_at" value={<Code variant="ghost">{absTime(task.created_at)}</Code>} />
              <MetaRow label="updated_at" value={<Code variant="ghost">{absTime(task.updated_at)} · {ago(task.updated_at)}</Code>} />
            </DataList.Root>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
