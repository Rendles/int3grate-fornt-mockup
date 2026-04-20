import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status, Avatar, MockBadge, BackendGapBanner } from '../components/common'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconArrowRight, IconPlus, IconRoute, IconTask } from '../components/icons'
import { Link, useRouter } from '../router'
import { api } from '../lib/api'
import type { Agent, Task, TaskStatus, TaskType } from '../lib/types'
import { ago, durationMs, money } from '../lib/format'
import { agentVersions as fxVersions, allUsers } from '../lib/fixtures'

const STATUSES: TaskStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled']
const TYPES: Array<TaskType | 'all'> = ['all', 'chat', 'one_time', 'schedule']

export default function TasksScreen() {
  const { navigate } = useRouter()
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [status, setStatus] = useState<TaskStatus | 'all'>('all')
  const [type, setType] = useState<TaskType | 'all'>('all')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const users = useMemo(() => allUsers(), [])

  useEffect(() => {
    let cancelled = false
    setError(null)
    setTasks(null)
    // GET /tasks supports status filter server-side — we still filter by type client-side since the backend does not support it.
    Promise.all([
      api.listTasks(status === 'all' ? undefined : { status }),
      api.listAgents(),
    ])
      .then(([t, a]) => {
        if (cancelled) return
        setTasks(t)
        setAgents(a)
      })
      .catch(e => { if (!cancelled) setError((e as Error).message ?? 'Failed to load tasks') })
    return () => { cancelled = true }
  }, [status, reloadTick])

  const filtered = useMemo(() => {
    if (!tasks) return []
    return tasks.filter(t => (type === 'all' ? true : t.type === type))
  }, [tasks, type])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    ;(tasks ?? []).forEach(t => { c[t.status] = (c[t.status] ?? 0) + 1 })
    return c
  }, [tasks])

  // note about client-side vs backend filter scope (see below)
  const hasServerStatusFilter = status !== 'all'

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'tasks' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow="TASKS"
          title={<>Work <em>in motion.</em></>}
          subtitle="Each task is a unit of work you dispatch to an agent. Tasks spawn runs; runs stream steps — tool calls, memory reads, approval gates."
          actions={
            <Btn variant="primary" href="/tasks/new" icon={<IconPlus />}>
              Create task
            </Btn>
          }
        />

        <BackendGapBanner
          title="Several columns shown here aren't in /tasks response"
          fields={[
            'user_input preview',
            'priority',
            'duration',
            'steps count',
            'per-task spend',
            'run link (task has no run_id)',
            'agent name (denormalized)',
          ]}
          body={<>GET /tasks returns <span className="mono">{'{id, tenant_id, domain_id, type, status, created_by, assigned_agent_id, assigned_agent_version_id, title, created_at, updated_at}'}</span>. No run_id, no step / spend aggregates on the task.</>}
        />

        <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className="mono uppercase muted" style={{ marginRight: 4 }}>status</span>
          <button className={`chip${status === 'all' ? ' chip--accent' : ''}`} onClick={() => setStatus('all')} style={{ cursor: 'pointer' }}>
            all <span className="mono" style={{ color: 'var(--text-dim)' }}>{tasks?.length ?? 0}</span>
          </button>
          {STATUSES.map(s => (
            <button key={s} className={`chip${status === s ? ' chip--accent' : ''}`} onClick={() => setStatus(s)} style={{ cursor: 'pointer' }}>
              {s} <span className="mono" style={{ color: 'var(--text-dim)' }}>{counts[s] ?? 0}</span>
            </button>
          ))}
          {hasServerStatusFilter && (
            <Chip square>
              <span className="mono" style={{ fontSize: 10 }}>?status=</span>{status}
            </Chip>
          )}
        </div>

        <div className="row" style={{ gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <span className="mono uppercase muted" style={{ marginRight: 4 }}>type</span>
          {TYPES.map(t => (
            <button key={t} className={`chip${type === t ? ' chip--accent' : ''}`} onClick={() => setType(t)} style={{ cursor: 'pointer' }}>
              {t.replace('_', ' ')}
            </button>
          ))}
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginLeft: 8 }}>client-side · backend filters status only</span>
        </div>

        {error ? (
          <ErrorState
            title="Couldn't load tasks"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : !tasks ? (
          <LoadingList rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconTask />}
            title={status === 'all' ? 'No tasks yet' : `No ${status} tasks`}
            body="Kick off a task and dispatch it to one of your agents. The run timeline will appear here."
            action={{ label: 'Create a task', href: '/tasks/new' }}
          />
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div style={{
              padding: '10px 16px',
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: '40px minmax(0, 1fr) 80px 190px 140px 130px 90px 70px 32px',
              gap: 14,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}>
              <span />
              <span className="row row--sm">task · input <MockBadge size="xs" title="user_input preview not part of GET /tasks response" /></span>
              <span>type</span>
              <span>agent · version</span>
              <span>creator · updated</span>
              <span>status</span>
              <span className="row row--sm">spend <MockBadge size="xs" /></span>
              <span className="row row--sm">run <MockBadge size="xs" title="task.run_id not in backend" /></span>
              <span />
            </div>
            {filtered.map(t => {
              const agent = agents.find(a => a.id === t.assigned_agent_id)
              const version = fxVersions.find(v => v.id === t.assigned_agent_version_id)
              const starter = users.find(u => u.id === t.created_by)
              const href = t.run_id ? `/runs/${t.run_id}` : `/tasks/${t.id}`
              return (
                <Link
                  key={t.id}
                  to={href}
                  className="agent-row"
                  style={{ gridTemplateColumns: '40px minmax(0, 1fr) 80px 190px 140px 130px 90px 70px 32px' }}
                >
                  <div className="agent-row__avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                    {agent?.glyph ?? '··'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t.id.toUpperCase()}</span>
                      {t.priority && t.priority !== 'normal' && (
                        <Chip tone={t.priority === 'urgent' ? 'danger' : 'warn'}>{t.priority}</Chip>
                      )}
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500, marginTop: 2 }}>{t.title}</div>
                    <div className="truncate" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {t.user_input}
                    </div>
                  </div>
                  <Chip tone={t.type === 'schedule' ? 'info' : t.type === 'chat' ? 'accent' : 'ghost'}>
                    {t.type.replace('_', ' ')}
                  </Chip>
                  <div style={{ minWidth: 0 }}>
                    {agent ? (
                      <button
                        onClick={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          navigate(`/agents/${agent.id}`)
                        }}
                        style={{
                          textAlign: 'left',
                          color: 'var(--text)',
                          fontSize: 12.5,
                          padding: 0,
                          textDecoration: 'none',
                        }}
                        onMouseEnter={ev => { ev.currentTarget.style.textDecoration = 'underline' }}
                        onMouseLeave={ev => { ev.currentTarget.style.textDecoration = 'none' }}
                      >
                        {agent.name}
                      </button>
                    ) : (
                      <span className="mono muted">{t.assigned_agent_id}</span>
                    )}
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 3 }}>
                      {version ? `v${version.version_number} · ${version.model_chain_config.primary}` : t.assigned_agent_version_id || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="row row--sm">
                      <Avatar initials={starter?.initials ?? 'U'} tone={starter?.avatar_tone ?? 'accent'} size={16} />
                      <span style={{ fontSize: 12, color: 'var(--text)' }} className="truncate">{t.created_by_name ?? t.created_by}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 3 }}>
                      {ago(t.updated_at)}
                    </div>
                  </div>
                  <div>
                    <Status status={t.status} />
                    {t.duration_ms != null && (
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>
                        {durationMs(t.duration_ms)} · {t.steps_count ?? 0} steps
                      </div>
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>
                    {money(t.spend_usd ?? 0, { cents: true })}
                  </div>
                  <div>
                    {t.run_id ? (
                      <button
                        onClick={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          navigate(`/runs/${t.run_id}`)
                        }}
                        className="mono"
                        style={{ fontSize: 11, color: 'var(--accent)', display: 'inline-flex', gap: 4, alignItems: 'center' }}
                        title={`Open run ${t.run_id}`}
                      >
                        <IconRoute className="ic ic--sm" /> run
                      </button>
                    ) : (
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>—</span>
                    )}
                  </div>
                  <IconArrowRight className="ic" />
                </Link>
              )
            })}
          </div>
        )}

        <div style={{ height: 20 }} />
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'right' }}>
          endpoint · <span className="accent">GET /tasks?status={status === 'all' ? '—' : status}</span>
          {' '}· <span className="warn">no agent_id filter supported server-side</span>
        </div>
      </div>
    </AppShell>
  )
}
