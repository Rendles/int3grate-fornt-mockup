import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Code, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, Status, InfoHint, Pagination } from '../components/common'
import { Banner, EmptyState, ErrorState, LoadingList } from '../components/states'
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
                List from <Code variant="ghost">GET /tasks</Code>. Status filter is applied server-side. Runs and step details are fetched separately.
              </InfoHint>
            </>
          }
          title={<>Work <em>in motion.</em></>}
          subtitle="Each task is dispatched to an agent. Runs are fetched separately."
          actions={
            <Button asChild><a href="#/tasks/new"><IconPlus />Create task</a></Button>
          }
        />

        <Banner tone="warn" title="Task concept is MVP-deferred (ADR-0003)">
          Gateway v0.2.0 marks <Code variant="ghost">/tasks/*</Code> as <Code variant="ghost">x-mvp-deferred</Code>. Runs can exist without a task; these screens remain in the prototype for design continuity.
        </Banner>
        <div style={{ height: 16 }} />

        <Flex align="center" gap="2" mb="4" wrap="wrap">
          <Caption mr="1">status</Caption>
          {STATUSES.map(s => (
            <Badge
              key={s}
              asChild
              color={status === s ? 'blue' : 'gray'}
              variant={status === s ? 'soft' : 'outline'}
              radius="full"
              size="1"
            >
              <button type="button" onClick={() => { setStatus(s); setPage(0) }}>
                {s} <Code variant="ghost" style={{ color: 'var(--gray-10)' }}>{counts[s] ?? 0}</Code>
              </button>
            </Badge>
          ))}
        </Flex>

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
              background: 'var(--gray-3)',
              borderBottom: '1px solid var(--gray-6)',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 80px 130px 140px 140px 120px 32px',
              gap: 14,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}>
              <Text as="span" size="1" color="gray">id · title</Text>
              <Text as="span" size="1" color="gray">type</Text>
              <Text as="span" size="1" color="gray">status</Text>
              <Text as="span" size="1" color="gray">agent · version</Text>
              <Text as="span" size="1" color="gray">created by</Text>
              <Text as="span" size="1" color="gray">updated</Text>
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
                  <Text as="div" size="1" color="gray">{t.id}</Text>
                  <Text as="div" size="2" mt="1" className="truncate">
                    {t.title ?? <Text color="gray">— untitled —</Text>}
                  </Text>
                </div>
                <Badge
                  color={t.type === 'schedule' ? 'cyan' : t.type === 'chat' ? 'blue' : 'gray'}
                  variant={t.type === 'schedule' || t.type === 'chat' ? 'soft' : 'outline'}
                  radius="full"
                  size="1"
                >
                  {t.type.replace('_', ' ')}
                </Badge>
                <Status status={t.status} />
                <div>
                  <Text as="div" size="1" className="truncate">{t.assigned_agent_id ?? '—'}</Text>
                  <Text as="div" size="1" color="gray" mt="1">{t.assigned_agent_version_id ?? '—'}</Text>
                </div>
                <Text as="div" size="1" className="truncate">
                  {t.created_by ?? '—'}
                </Text>
                <Text as="div" size="1" color="gray">
                  {ago(t.updated_at)}
                </Text>
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
