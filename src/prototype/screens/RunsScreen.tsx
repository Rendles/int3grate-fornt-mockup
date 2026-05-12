import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, WorkspaceContextPill, WorkspaceFilter } from '../components/common'
import { statusLabel } from '../components/common/status-label'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconArrowRight, IconRun } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent, RunDetail, RunListItem, RunStatus, RunToolError } from '../lib/types'
import { ago, appLabel, appPrefix, durationMs, money, num, stageLabel, toolLabel } from '../lib/format'
import { shouldShowWorkspacePill, useScopeFilter } from '../lib/scope-filter'

const PAGE_SIZE = 25

// Status values supported as chips. Order matches what users care about most:
// in-flight ones first, then terminals. `all` is rendered separately.
const STATUS_FILTERS: RunStatus[] = [
  'running',
  'suspended',
  'pending',
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled',
]

interface ToneSpec {
  bg: string
  fg: string
}

const TONE: Record<'success' | 'warn' | 'error' | 'info' | 'muted', ToneSpec> = {
  success: { bg: 'var(--jade-9)', fg: 'var(--jade-11)' },
  warn:    { bg: 'var(--orange-9)', fg: 'var(--orange-11)' },
  error:   { bg: 'var(--red-9)',   fg: 'var(--red-11)' },
  info:    { bg: 'var(--cyan-9)',  fg: 'var(--cyan-11)' },
  muted:   { bg: 'var(--gray-9)',  fg: 'var(--gray-11)' },
}

function statusTone(status: RunStatus): keyof typeof TONE {
  switch (status) {
    case 'completed': return 'success'
    case 'completed_with_errors': return 'warn'
    case 'failed': return 'error'
    case 'suspended': return 'warn'
    case 'running':
    case 'pending': return 'info'
    case 'cancelled':
    default: return 'muted'
  }
}

function dateGroup(iso: string, now: Date): 'today' | 'yesterday' | 'week' | 'earlier' {
  const t = new Date(iso).getTime()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6)
  if (t >= todayStart.getTime()) return 'today'
  if (t >= yesterdayStart.getTime()) return 'yesterday'
  if (t >= weekStart.getTime()) return 'week'
  return 'earlier'
}

const GROUP_LABEL: Record<'today' | 'yesterday' | 'week' | 'earlier', string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  earlier: 'Earlier',
}

export default function RunsScreen() {
  const { myWorkspaces } = useAuth()
  const { filter: workspaceFilter } = useScopeFilter()
  const [items, setItems] = useState<RunListItem[]>([])
  const [total, setTotal] = useState(0)
  const [agents, setAgents] = useState<Agent[]>([])
  const [statusFilter, setStatusFilter] = useState<RunStatus | 'all'>('all')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [details, setDetails] = useState<Record<string, RunDetail | 'loading' | 'error'>>({})
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [now, setNow] = useState<Date>(() => new Date())

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Initial load and reload-on-filter-change. Always resets pagination
  // back to page 0 and clears any expanded rows from a previous filter.
  // The reset setters here are intentional — switching status filter must
  // discard the previous accumulation and start a fresh fetch.
  useEffect(() => {
    let cancelled = false
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true)
    setPage(0)
    setExpanded(new Set())
    setDetails({})
    /* eslint-enable react-hooks/set-state-in-effect */
    Promise.all([
      api.listRuns({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: PAGE_SIZE,
        offset: 0,
        workspace_ids: workspaceFilter,
      }),
      // Agents lookup is for name resolution only; broaden to all user
      // memberships so a run from any in-scope workspace renders its
      // agent name correctly.
      agents.length === 0 ? api.listAgents().then(r => r.items) : Promise.resolve(agents),
    ])
      .then(([list, ags]) => {
        if (cancelled) return
        setItems(list.items)
        setTotal(list.total)
        setAgents(ags)
        setNow(new Date())
        setError(null)
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load activity')
        setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, reloadTick, workspaceFilter])

  // Append the next page. Guarded so concurrent triggers (scroll + click)
  // don't fire two parallel requests.
  const loadMore = async () => {
    if (loadingMore || loading) return
    if (items.length >= total) return
    setLoadingMore(true)
    const nextPage = page + 1
    try {
      const list = await api.listRuns({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: PAGE_SIZE,
        offset: nextPage * PAGE_SIZE,
        workspace_ids: workspaceFilter,
      })
      setItems(prev => [...prev, ...list.items])
      setPage(nextPage)
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load more')
    } finally {
      setLoadingMore(false)
    }
  }

  // Auto-load on scroll: IntersectionObserver fires loadMore when the
  // sentinel enters the viewport (with 200px pre-load margin).
  useEffect(() => {
    const target = sentinelRef.current
    if (!target) return
    if (items.length >= total) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) loadMore()
    }, { rootMargin: '200px' })
    observer.observe(target)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, total, statusFilter, loading, loadingMore])

  const agentName = (id: string | null) =>
    (id && agents.find(a => a.id === id)?.name) || 'Agent'

  // Group by date bucket. Each accumulated batch groups across all loaded
  // items — when more pages stream in via scroll, the same buckets just
  // grow naturally.
  const grouped = useMemo(() => {
    const groups: Record<'today' | 'yesterday' | 'week' | 'earlier', RunListItem[]> = {
      today: [], yesterday: [], week: [], earlier: [],
    }
    for (const r of items) {
      groups[dateGroup(r.created_at, now)].push(r)
    }
    return groups
  }, [items, now])

  const toggle = async (r: RunListItem) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(r.id)) next.delete(r.id)
      else next.add(r.id)
      return next
    })
    if (!details[r.id]) {
      setDetails(prev => ({ ...prev, [r.id]: 'loading' }))
      try {
        const detail = await api.getRun(r.id)
        if (detail) {
          setDetails(prev => ({ ...prev, [r.id]: detail }))
        } else {
          setDetails(prev => ({ ...prev, [r.id]: 'error' }))
        }
      } catch {
        setDetails(prev => ({ ...prev, [r.id]: 'error' }))
      }
    }
  }

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'activity' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow="ACTIVITY"
          title={<>What your <em>agents did.</em></>}
          subtitle="A timeline of activities. Click an entry to see what happened."
        />

        {error ? (
          <ErrorState
            title="Couldn't load activity"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : (
          <>
            <Flex direction="column" gap="2" mb="2">
              <WorkspaceFilter />
              <Filters
                statusFilter={statusFilter}
                onStatusFilter={setStatusFilter}
              />
            </Flex>

            {loading ? (
              <LoadingList rows={6} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={<IconRun />}
                title={total === 0 ? 'No activity yet' : 'No matching activity'}
                body={
                  total === 0
                    ? 'Once your agents start working, their activity will appear here.'
                    : 'Try a different status, or clear the filter.'
                }
              />
            ) : (
              <>
                <Flex direction="column" gap="5">
                  {(['today', 'yesterday', 'week', 'earlier'] as const).map(g => {
                    const list = grouped[g]
                    if (list.length === 0) return null
                    return (
                      <Box key={g}>
                        <Caption mb="3" as="div">{GROUP_LABEL[g]}</Caption>
                        <Flex direction="column" gap="2">
                          {list.map(r => (
                            <ActivityRow
                              key={r.id}
                              run={r}
                              agentName={agentName(r.agent_id)}
                              showWorkspacePill={shouldShowWorkspacePill(workspaceFilter, myWorkspaces.length)}
                              isExpanded={expanded.has(r.id)}
                              detail={details[r.id]}
                              onToggle={() => toggle(r)}
                            />
                          ))}
                        </Flex>
                      </Box>
                    )
                  })}
                </Flex>

                {items.length < total ? (
                  <Box ref={sentinelRef} mt="4" py="4" style={{ textAlign: 'center' }}>
                    {loadingMore ? (
                      <Text size="2" color="gray">Loading more…</Text>
                    ) : (
                      <Text size="2" color="gray">
                        Scroll for more · {items.length} of {total}
                      </Text>
                    )}
                  </Box>
                ) : total > 0 ? (
                  <Box mt="4" py="4" style={{ textAlign: 'center' }}>
                    <Text size="2" color="gray">
                      All caught up · {total} {total === 1 ? 'activity' : 'activities'}
                    </Text>
                  </Box>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}

// ────────────────────────────────────────────── Filters

function Filters({
  statusFilter,
  onStatusFilter,
}: {
  statusFilter: RunStatus | 'all'
  onStatusFilter: (v: RunStatus | 'all') => void
}) {
  return (
    <Flex align="center" gap="2" wrap="wrap" mb="5">
      <Caption mr="1">status</Caption>
      <FilterChip active={statusFilter === 'all'} onClick={() => onStatusFilter('all')}>
        All
      </FilterChip>
      {STATUS_FILTERS.map(s => (
        <FilterChip
          key={s}
          active={statusFilter === s}
          onClick={() => onStatusFilter(s)}
        >
          {statusLabel(s)}
        </FilterChip>
      ))}
    </Flex>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      size="2"
      variant="soft"
      color={active ? 'cyan' : 'gray'}
      onClick={onClick}
    >
      <span>{children}</span>
    </Button>
  )
}

// ────────────────────────────────────────────── Activity row

function ActivityRow({
  run,
  agentName,
  showWorkspacePill,
  isExpanded,
  detail,
  onToggle,
}: {
  run: RunListItem
  agentName: string
  showWorkspacePill: boolean
  isExpanded: boolean
  detail: RunDetail | 'loading' | 'error' | undefined
  onToggle: () => void
}) {
  const tone = statusTone(run.status)

  return (
    <div
      className={`card ${isExpanded ? '' : 'card--hover'}`}
      style={{
        padding: 0,
        borderColor: isExpanded ? 'var(--gray-a6)' : undefined,
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          color: 'var(--gray-12)',
          padding: '14px 18px',
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto 24px',
          gap: 14,
          alignItems: 'center',
        }}
      >
        <StatusDot tone={tone} />
        <Box minWidth="0">
          <Flex align="center" gap="2" wrap="wrap">
            <Text as="div" size="2" weight="medium" className="truncate">
              {agentName} · <Text as="span" size="2" color="gray" weight="regular">{statusLabel(run.status)}</Text>
            </Text>
            <WorkspaceContextPill agentId={run.agent_id} show={showWorkspacePill} />
          </Flex>
          <SecondaryLine run={run} />
        </Box>
        <Text as="span" size="1" color="gray">
          {ago(run.created_at)}
        </Text>
        <IconArrowRight
          className="ic"
          style={{
            transform: isExpanded ? 'rotate(90deg)' : undefined,
            transition: 'transform 120ms',
          }}
        />
      </button>

      {isExpanded && (
        <Box px="4" pb="4" style={{ borderTop: '1px dashed var(--gray-a3)', paddingTop: 14 }}>
          <ExpansionBody run={run} detail={detail} />
        </Box>
      )}
    </div>
  )
}

function StatusDot({ tone }: { tone: keyof typeof TONE }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: TONE[tone].bg,
        boxShadow: `0 0 0 3px var(--gray-2)`,
      }}
    />
  )
}

// Closed-state secondary line — just a hint at the most useful supplementary
// info, derived from the lightweight RunListItem. The full picture lives in
// the inline expansion (after lazy-loading RunDetail).
function SecondaryLine({ run }: { run: RunListItem }) {
  const stage = run.suspended_stage ? stageLabel(run.suspended_stage) : null
  const cost = run.total_cost_usd > 0
    ? money(run.total_cost_usd, { cents: run.total_cost_usd < 100 })
    : null
  const parts: string[] = []
  if (stage) parts.push(`Waiting on: ${stage}`)
  if (cost) parts.push(cost)

  if (parts.length === 0) return null
  return (
    <Text as="div" size="1" color="gray" mt="1">
      {parts.join(' · ')}
    </Text>
  )
}

// ────────────────────────────────────────────── Expansion body
// Plan section 7.3: "Detail view: для тех, кто хочет глубже — раскрывается
// на месте, показывает чуть больше контекста (какие apps использовались,
// сколько потратили на эту задачу). Без RunStep дерева."

function ExpansionBody({
  run,
  detail,
}: {
  run: RunListItem
  detail: RunDetail | 'loading' | 'error' | undefined
}) {
  // Hooks must run in the same order regardless of detail state, so derive
  // first and then branch on detail value below.
  const detailObj = typeof detail === 'object' && detail !== null ? detail : null

  const apps = useMemo(() => {
    if (!detailObj) return []
    const seen = new Set<string>()
    for (const s of detailObj.steps) {
      if (s.step_type === 'tool_call' && s.tool_name) {
        seen.add(appPrefix(s.tool_name))
      }
    }
    return [...seen]
  }, [detailObj])

  const outcome = useMemo(() => {
    if (!detailObj) return null
    if (detailObj.error_message) return detailObj.error_message
    if (run.status === 'suspended' && detailObj.suspended_stage) {
      return `Paused at ${stageLabel(detailObj.suspended_stage)} — needs your approval.`
    }
    const lastTool = [...detailObj.steps].reverse().find(s => s.step_type === 'tool_call')
    if (lastTool && lastTool.tool_name) {
      const name = toolLabel(lastTool.tool_name)
      if (lastTool.status === 'ok') return `Last action: ${name} succeeded.`
      if (lastTool.status === 'failed') return `Last action: ${name} failed.`
      if (lastTool.status === 'blocked') return `Last action: ${name} was blocked.`
    }
    return null
  }, [detailObj, run])

  if (detail === 'loading' || detail === undefined) {
    return <LoadingList rows={2} />
  }
  if (detail === 'error' || !detailObj) {
    return <Text as="div" size="2" color="gray">Couldn't load extra details for this entry.</Text>
  }

  const duration = run.started_at && run.ended_at
    ? new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()
    : null

  return (
    <Flex direction="column" gap="3">
      {outcome && (
        <Text as="div" size="2" style={{ lineHeight: 1.55 }}>
          {outcome}
        </Text>
      )}

      <Flex gap="4" wrap="wrap">
        <FactBlock label="Apps used">
          {apps.length === 0 ? (
            <Text size="2" color="gray">no apps</Text>
          ) : (
            <Flex gap="1" wrap="wrap">
              {apps.map(p => (
                <span
                  key={p}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'var(--gray-a3)',
                    fontSize: 12,
                  }}
                >
                  {appLabel(p)}
                </span>
              ))}
            </Flex>
          )}
        </FactBlock>
        <FactBlock label="Cost">
          <Text size="2">{money(run.total_cost_usd, { cents: true })}</Text>
        </FactBlock>
        <FactBlock label="Duration">
          <Text size="2">{durationMs(duration)}</Text>
        </FactBlock>
        <FactBlock label="Steps">
          <Text size="2">{num(detailObj.steps.length)}</Text>
        </FactBlock>
      </Flex>

      {detailObj.tool_errors && detailObj.tool_errors.length > 0 && (
        <ToolErrorsHint errors={detailObj.tool_errors} />
      )}

      <Flex>
        <Button asChild variant="ghost" size="1" color="gray">
          <Link to={`/activity/${run.id}`}>
            <IconArrowRight className="ic ic--sm" />
            Open technical view
          </Link>
        </Button>
      </Flex>
    </Flex>
  )
}

function FactBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text as="div" size="1" color="gray" mb="1" style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {label}
      </Text>
      {children}
    </Box>
  )
}

function ToolErrorsHint({ errors }: { errors: RunToolError[] }) {
  return (
    <Box style={{ padding: '10px 12px', background: 'var(--orange-a3)', borderRadius: 8 }}>
      <Text as="div" size="2" weight="medium" mb="1">
        {errors.length} app {errors.length === 1 ? 'error' : 'errors'}
      </Text>
      <Flex direction="column" gap="1">
        {errors.slice(0, 3).map((e, i) => (
          <Text key={i} as="div" size="1" color="gray" style={{ lineHeight: 1.5 }}>
            <strong>{toolLabel(e.tool)}</strong> — {e.message ?? 'failed'}
          </Text>
        ))}
        {errors.length > 3 && (
          <Text as="div" size="1" color="gray">
            +{errors.length - 3} more — see technical view.
          </Text>
        )}
      </Flex>
    </Box>
  )
}
