import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Avatar, Caption, MockBadge, PageHeader } from '../components/common'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconArrowRight, IconRun } from '../components/icons'
import { Link } from '../router'
import { api } from '../lib/api'
import type { Agent, RunDetail, RunListItem, RunStatus, RunToolError } from '../lib/types'
import { ago, appLabel, appPrefix, durationMs, money, num, stageLabel, toolLabel } from '../lib/format'

type DateRange = 'today' | '7d' | '30d' | 'all'

interface ToneSpec {
  bg: string
  fg: string
}

const TONE: Record<'success' | 'warn' | 'error' | 'info' | 'muted', ToneSpec> = {
  success: { bg: 'var(--green-9)', fg: 'var(--green-11)' },
  warn:    { bg: 'var(--amber-9)', fg: 'var(--amber-11)' },
  error:   { bg: 'var(--red-9)',   fg: 'var(--red-11)' },
  info:    { bg: 'var(--blue-9)',  fg: 'var(--blue-11)' },
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

// Plan section 7.3: each entry is a human sentence ("[agent] [verb]
// [object] · [time]"). RunListItem alone doesn't carry verbs/objects, so we
// derive the sentence from status. The lazy-loaded RunDetail (on expand)
// fills in app names + a short outcome line.
function runHeadline(r: RunListItem, agentName: string): string {
  const name = agentName || 'Agent'
  switch (r.status) {
    case 'completed': return `${name} finished an activity`
    case 'completed_with_errors': return `${name} finished — some apps failed`
    case 'failed': return `${name} got stuck — needs help`
    case 'cancelled': return `${name} cancelled the activity`
    case 'suspended': return `${name} is waiting for your approval`
    case 'running': return `${name} is working on something`
    case 'pending': return `${name} is starting an activity`
    default: return `${name} ran an activity`
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

function dateRangeFilter(iso: string, range: DateRange, now: Date): boolean {
  if (range === 'all') return true
  const t = new Date(iso).getTime()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  if (range === 'today') return t >= todayStart.getTime()
  const cutoff = new Date(todayStart)
  cutoff.setDate(cutoff.getDate() - (range === '7d' ? 7 : 30))
  return t >= cutoff.getTime()
}

export default function RunsScreen() {
  const [items, setItems] = useState<RunListItem[] | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentFilter, setAgentFilter] = useState<string | 'all'>('all')
  const [dateFilter, setDateFilter] = useState<DateRange>('7d')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [details, setDetails] = useState<Record<string, RunDetail | 'loading' | 'error'>>({})
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    let cancelled = false
    Promise.all([api.listRuns({ limit: 100 }), api.listAgents()])
      .then(([list, ags]) => {
        if (cancelled) return
        setItems(list.items)
        setAgents(ags.items)
        setNow(new Date())
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load activity')
      })
    return () => { cancelled = true }
  }, [reloadTick])

  const agentName = (id: string | null) =>
    (id && agents.find(a => a.id === id)?.name) || 'Agent'

  // Agents that have at least one entry in the loaded list — only those
  // appear in the filter row, so we don't show empty chips.
  const agentsInList = useMemo(() => {
    if (!items) return []
    const seen = new Set<string>()
    for (const r of items) {
      if (r.agent_id) seen.add(r.agent_id)
    }
    return agents.filter(a => seen.has(a.id))
  }, [items, agents])

  const filtered = useMemo(() => {
    if (!items) return []
    return items.filter(r => {
      if (agentFilter !== 'all' && r.agent_id !== agentFilter) return false
      if (!dateRangeFilter(r.created_at, dateFilter, now)) return false
      return true
    })
  }, [items, agentFilter, dateFilter, now])

  // Group by date bucket. Order is fixed (Today → Yesterday → This week → Earlier).
  const grouped = useMemo(() => {
    const groups: Record<'today' | 'yesterday' | 'week' | 'earlier', RunListItem[]> = {
      today: [], yesterday: [], week: [], earlier: [],
    }
    for (const r of filtered) {
      groups[dateGroup(r.created_at, now)].push(r)
    }
    return groups
  }, [filtered, now])

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
          eyebrow={
            <>
              ACTIVITY{' '}
              <MockBadge kind="design" hint="Each row's headline (e.g. 'Sales Agent finished an activity') is derived client-side from RunStatus. Backend doesn't return a per-run summary field yet — once it does, we replace the templated sentence with real text." />
            </>
          }
          title={<>What your <em>agents did.</em></>}
          subtitle="A timeline of activities. Click an entry to see what happened."
        />

        {error ? (
          <ErrorState
            title="Couldn't load activity"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : !items ? (
          <LoadingList rows={6} />
        ) : (
          <>
            <Filters
              agentsInList={agentsInList}
              agentFilter={agentFilter}
              onAgentFilter={setAgentFilter}
              dateFilter={dateFilter}
              onDateFilter={setDateFilter}
            />

            {filtered.length === 0 ? (
              <EmptyState
                icon={<IconRun />}
                title={items.length === 0 ? 'No activity yet' : 'No matching activity'}
                body={
                  items.length === 0
                    ? 'Once your agents start working, their activity will appear here.'
                    : 'Try a different agent filter or a wider date range.'
                }
              />
            ) : (
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
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}

// ────────────────────────────────────────────── Filters

function Filters({
  agentsInList,
  agentFilter,
  onAgentFilter,
  dateFilter,
  onDateFilter,
}: {
  agentsInList: Agent[]
  agentFilter: string | 'all'
  onAgentFilter: (v: string | 'all') => void
  dateFilter: DateRange
  onDateFilter: (v: DateRange) => void
}) {
  return (
    <Flex direction="column" gap="3" mb="5">
      <Flex align="center" gap="2" wrap="wrap">
        <Caption mr="1">agent</Caption>
        <FilterChip active={agentFilter === 'all'} onClick={() => onAgentFilter('all')}>
          All
        </FilterChip>
        {agentsInList.map(a => (
          <FilterChip
            key={a.id}
            active={agentFilter === a.id}
            onClick={() => onAgentFilter(a.id)}
            icon={<Avatar initials={a.name.slice(0, 2).toUpperCase()} size={18} />}
          >
            {a.name}
          </FilterChip>
        ))}
      </Flex>

      <Flex align="center" gap="2" wrap="wrap">
        <Caption mr="1">when</Caption>
        {(['today', '7d', '30d', 'all'] as DateRange[]).map(r => (
          <FilterChip
            key={r}
            active={dateFilter === r}
            onClick={() => onDateFilter(r)}
          >
            {r === 'today' ? 'Today' : r === 'all' ? 'All time' : `Last ${r}`}
          </FilterChip>
        ))}
      </Flex>
    </Flex>
  )
}

function FilterChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      size="2"
      variant="soft"
      color={active ? 'blue' : 'gray'}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
    </Button>
  )
}

// ────────────────────────────────────────────── Activity row

function ActivityRow({
  run,
  agentName,
  isExpanded,
  detail,
  onToggle,
}: {
  run: RunListItem
  agentName: string
  isExpanded: boolean
  detail: RunDetail | 'loading' | 'error' | undefined
  onToggle: () => void
}) {
  const tone = statusTone(run.status)
  const headline = runHeadline(run, agentName)

  return (
    <div
      className="card"
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
          <Text as="div" size="2" weight="medium" className="truncate">
            {headline}
          </Text>
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
    <Box style={{ padding: '10px 12px', background: 'var(--amber-a3)', borderRadius: 8 }}>
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
