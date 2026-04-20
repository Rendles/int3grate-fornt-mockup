import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status, InfoHint, Pagination } from '../components/common'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconArrowRight, IconPlus, IconTask } from '../components/icons'
import { Link } from '../router'
import { api } from '../lib/api'
import type { Task, TaskStatus } from '../lib/types'
import { ago } from '../lib/format'

const STATUSES: Array<TaskStatus | 'all'> = ['all', 'pending', 'running', 'completed', 'failed', 'cancelled']

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [status, setStatus] = useState<TaskStatus | 'all'>('all')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    let cancelled = false
    api.listTasks(status === 'all' ? undefined : { status })
      .then(t => {
        if (cancelled) return
        setTasks(t)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load tasks')
      })
    return () => { cancelled = true }
  }, [status, reloadTick])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tasks?.length ?? 0 }
    ;(tasks ?? []).forEach(t => { c[t.status] = (c[t.status] ?? 0) + 1 })
    return c
  }, [tasks])

  const pageStart = page * pageSize
  const pageItems = (tasks ?? []).slice(pageStart, pageStart + pageSize)

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'tasks' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              TASKS{' '}
              <InfoHint>
                List from <span className="mono">GET /tasks</span>. Status filter is applied server-side. Runs and step details are fetched separately.
              </InfoHint>
            </>
          }
          title={<>Work <em>in motion.</em></>}
          subtitle="Each task is dispatched to an agent. Runs are fetched separately."
          actions={
            <Btn variant="primary" href="/tasks/new" icon={<IconPlus />}>Create task</Btn>
          }
        />

        <div className="row" style={{ gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <span className="mono uppercase muted" style={{ marginRight: 4 }}>status</span>
          {STATUSES.map(s => (
            <button
              key={s}
              className={`chip${status === s ? ' chip--accent' : ''}`}
              onClick={() => { setStatus(s); setPage(0) }}
              style={{ cursor: 'pointer' }}
            >
              {s} <span className="mono" style={{ color: 'var(--text-dim)' }}>{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>

        {error ? (
          <ErrorState
            title="Couldn't load tasks"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : !tasks ? (
          <LoadingList rows={6} />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<IconTask />}
            title={status === 'all' ? 'No tasks yet' : `No ${status} tasks`}
            action={{ label: 'Create a task', href: '/tasks/new' }}
          />
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div style={{
              padding: '10px 16px',
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 80px 130px 140px 140px 120px 32px',
              gap: 14,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}>
              <span>id · title</span>
              <span>type</span>
              <span>status</span>
              <span>agent · version</span>
              <span>created by</span>
              <span>updated</span>
              <span />
            </div>
            {pageItems.map(t => (
              <Link
                key={t.id}
                to={`/tasks/${t.id}`}
                className="agent-row"
                style={{ gridTemplateColumns: 'minmax(0, 1fr) 80px 130px 140px 140px 120px 32px' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t.id}</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }} className="truncate">
                    {t.title ?? <span className="muted">— untitled —</span>}
                  </div>
                </div>
                <Chip tone={t.type === 'schedule' ? 'info' : t.type === 'chat' ? 'accent' : 'ghost'}>
                  {t.type.replace('_', ' ')}
                </Chip>
                <Status status={t.status} />
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <div className="truncate">{t.assigned_agent_id ?? '—'}</div>
                  <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>{t.assigned_agent_version_id ?? '—'}</div>
                </div>
                <div className="mono truncate" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t.created_by ?? '—'}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {ago(t.updated_at)}
                </div>
                <IconArrowRight className="ic" />
              </Link>
            ))}
            <Pagination
              page={page}
              pageSize={pageSize}
              total={tasks.length}
              onPageChange={setPage}
              onPageSizeChange={n => { setPageSize(n); setPage(0) }}
              label="tasks"
            />
          </div>
        )}

      </div>
    </AppShell>
  )
}
