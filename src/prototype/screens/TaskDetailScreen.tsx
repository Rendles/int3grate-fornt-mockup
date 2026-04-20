import { useEffect, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status, CommandBar } from '../components/common'
import { LoadingList, NoAccessState, Banner } from '../components/states'
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
          eyebrow={`TASK · ${task.id} · GET /tasks/{id}`}
          title={task.title ?? <>Untitled task</>}
          subtitle={
            <>
              Task metadata from <span className="mono">GET /tasks/{'{id}'}</span>. To inspect the run, open it directly by ID —
              the Task response doesn't carry run_id.
            </>
          }
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

        <div style={{ height: 20 }} />

        <Banner tone="info" title="What the Task schema contains">
          Gateway Task has <span className="mono">id, tenant_id, domain_id, type, status, created_by, assigned_agent_id, assigned_agent_version_id, title, created_at, updated_at</span>.
          No run_id, no steps, no spend. Open a run directly via <span className="mono">GET /runs/{'{id}'}</span>.
        </Banner>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head"><div className="card__title">Metadata</div></div>
          <div className="card__body">
            <MetaRow label="id" value={<span className="mono">{task.id}</span>} />
            <MetaRow label="tenant_id" value={<span className="mono">{task.tenant_id}</span>} />
            <MetaRow label="domain_id" value={<span className="mono">{task.domain_id ?? '—'}</span>} />
            <MetaRow label="type" value={<Chip>{task.type.replace('_', ' ')}</Chip>} />
            <MetaRow label="status" value={<Status status={task.status} />} />
            <MetaRow
              label="assigned_agent_id"
              value={task.assigned_agent_id
                ? <Link to={`/agents/${task.assigned_agent_id}`} className="mono">{task.assigned_agent_id}</Link>
                : <span className="mono muted">—</span>}
            />
            <MetaRow label="assigned_agent_version_id" value={<span className="mono">{task.assigned_agent_version_id ?? '—'}</span>} />
            <MetaRow label="created_by" value={<span className="mono">{task.created_by ?? '—'}</span>} />
            <MetaRow label="title" value={task.title ?? <span className="muted">null</span>} />
            <MetaRow label="created_at" value={<span className="mono">{absTime(task.created_at)}</span>} />
            <MetaRow label="updated_at" value={<span className="mono">{absTime(task.updated_at)} · {ago(task.updated_at)}</span>} />
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
