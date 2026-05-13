// SANDBOX preview — design exploration only.
// Reachable through direct URL #/app/sandbox/team-bridge — not linked from
// the sidebar. Used to discuss a "control room" alternative to the current
// list-heavy Home/Team. See docs/agent-plans/2026-05-02-1500-team-bridge-sandbox.md
// for the full plan and rationale. Safe to delete the entire screens/sandbox/
// folder + the route in index.tsx if the direction is rejected.

import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Flex, Grid, Text } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { Avatar, MockBadge, PageHeader } from '../../components/common'
import { ErrorState, LoadingList } from '../../components/states'
import { IconApproval, IconArrowRight, IconChat, IconRun } from '../../components/icons'
import { statusLabel } from '../../components/common/status-label'
import { Link } from '../../router'
import { ago, approverRoleLabel, prettifyRequestedAction } from '../../lib/format'
import type { RunStatus } from '../../lib/types'
import { api } from '../../lib/api'
import type { Agent, ApprovalRequest, RunListItem } from '../../lib/types'

// ─── Live status taxonomy ─────────────────────────────────────────────
// SANDBOX synthesize: the backend does NOT yet expose a per-agent live
// status. We derive it on the client from real runs + approvals data.
// See docs/backend-gaps.md §1.2 / §2.2 — production would want either
// an `agent.current_state` denormalised field or a dedicated endpoint.

type LiveStatus = 'working' | 'waiting' | 'stuck' | 'idle'

const STATUS_META: Record<LiveStatus, { label: string; color: string; tint: string }> = {
  working: { label: 'Working', color: 'var(--jade-9)', tint: 'var(--jade-a3)' },
  waiting: { label: 'Waiting on you', color: 'var(--orange-9)', tint: 'var(--orange-a3)' },
  stuck: { label: 'Got stuck', color: 'var(--red-9)', tint: 'var(--red-a3)' },
  idle: { label: 'Idle', color: 'var(--gray-9)', tint: 'var(--gray-a3)' },
}

interface AgentSnapshot {
  agent: Agent
  status: LiveStatus
  activity: string
  doneToday: number
  pendingNow: number
}

// SANDBOX: derive an agent's snapshot from real run + approval data.
function buildSnapshot(
  agent: Agent,
  runs: RunListItem[],
  approvals: ApprovalRequest[],
): AgentSnapshot {
  const myRuns = runs
    .filter(r => r.agent_id === agent.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const myRunIds = new Set(myRuns.map(r => r.id))
  // Chat-source approvals (gateway 0.2.0) have run_id == null; this screen
  // surfaces only run-anchored approvals — chat-source UI is Tier 3.
  const myPending = approvals.filter(a => a.status === 'pending' && a.run_id != null && myRunIds.has(a.run_id))

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todayIso = startOfToday.toISOString()
  const myToday = myRuns.filter(r => r.created_at >= todayIso)
  const doneToday = myToday.filter(r =>
    r.status === 'completed' || r.status === 'completed_with_errors',
  ).length

  // Priority: action items first (waiting), then most-recent failure (stuck),
  // then in-flight work (working), else idle. Non-active agents collapse to
  // idle. Crucially `stuck` only fires if the LATEST run failed — historical
  // failures don't keep an agent permanently red.
  const latest = myRuns[0]
  let status: LiveStatus = 'idle'
  let activity = ''

  if (agent.status !== 'active') {
    status = 'idle'
    activity =
      agent.status === 'paused' ? 'Paused — not picking up new work.'
        : agent.status === 'draft' ? 'Not hired yet — finish setup to put them to work.'
          : 'Off the team.'
  } else if (myPending.length > 0) {
    status = 'waiting'
    const first = myPending[0]
    const more = myPending.length - 1
    activity = more > 0
      ? `Waiting on ${prettifyRequestedAction(first.requested_action)} (+${more} more).`
      : `Waiting on ${prettifyRequestedAction(first.requested_action)}.`
  } else if (latest?.status === 'failed') {
    status = 'stuck'
    activity = `Got stuck on the last activity ${ago(latest.created_at)}. Needs a hand.`
  } else if (latest?.status === 'running' || latest?.status === 'pending') {
    status = 'working'
    activity = `Working on an activity — started ${ago(latest.created_at)}.`
  } else if (latest) {
    status = 'idle'
    activity = `Available. Last active ${ago(latest.created_at)}.`
  } else {
    status = 'idle'
    activity = 'Available. No activity yet.'
  }

  return {
    agent,
    status,
    activity,
    doneToday,
    pendingNow: myPending.length,
  }
}

export default function TeamBridgeScreen() {
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [approvals, setApprovals] = useState<ApprovalRequest[] | null>(null)
  const [runs, setRuns] = useState<RunListItem[] | null>(null)
  const [errored, setErrored] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<LiveStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const [a, ap, r] = await Promise.all([
        api.listAgents(),
        api.listApprovals({ status: 'pending' }),
        api.listRuns({ limit: 100 }),
      ])
      if (cancelled) return
      setErrored(false)
      setAgents(a.items)
      setApprovals(ap.items)
      setRuns(r.items)
    }
    run().catch(() => { if (!cancelled) setErrored(true) })
    return () => { cancelled = true }
  }, [reloadKey])

  const liveAgents = useMemo(
    () => (agents ?? []).filter(a => a.status !== 'archived'),
    [agents],
  )

  // Snapshot per agent. Computed once per data refresh.
  const snapshots = useMemo<AgentSnapshot[]>(() => {
    if (!runs || !approvals) return []
    return liveAgents
      .map(a => buildSnapshot(a, runs, approvals))
      .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status])
  }, [liveAgents, runs, approvals])

  const counts = useMemo(() => {
    const c: Record<LiveStatus, number> = { working: 0, waiting: 0, stuck: 0, idle: 0 }
    snapshots.forEach(s => { c[s.status]++ })
    return c
  }, [snapshots])

  const visibleSnapshots = useMemo(
    () => filter ? snapshots.filter(s => s.status === filter) : snapshots,
    [snapshots, filter],
  )

  const loading = !errored && (!agents || !approvals || !runs)

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'sandbox' }, { label: 'team bridge' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <Flex align="center" gap="2">
              <span>SANDBOX · TEAM BRIDGE</span>
              <MockBadge
                kind="design"
                hint="Sandbox preview. Live agent status, current activity, and today's counts are synthesized in the prototype — they would need backend support (per-agent live state) to be real-time. See docs/handoff-prep.md and backend-gaps.md §1.2 / §2.2 for context."
              />
            </Flex>
          }
          title={<>Your <em>team</em> at a glance.</>}
          subtitle="A control-room view of who's working, who needs you, and what just happened. This is a design preview — nothing here writes back."
        />

        {errored ? (
          <ErrorState
            title="Couldn't load the bridge"
            body="One of the calls (agents / approvals / runs) failed."
            onRetry={() => setReloadKey(k => k + 1)}
          />
        ) : loading ? (
          <LoadingList rows={4} />
        ) : (
          <>
            <StatusRail
              counts={counts}
              total={liveAgents.length}
              active={filter}
              onSelect={setFilter}
            />

            <Grid
              columns={{ initial: '1', lg: '1fr 320px' }}
              gap="4"
              mt="4"
              align="start"
            >
              <Box minWidth="0">
                {visibleSnapshots.length === 0 ? (
                  <FilteredEmpty filter={filter} onClear={() => setFilter(null)} />
                ) : (
                  <Grid columns={{ initial: '1', sm: '2', xl: '3' }} gap="3">
                    {visibleSnapshots.map(s => (
                      <AgentTile key={s.agent.id} snapshot={s} />
                    ))}
                  </Grid>
                )}

                <Box mt="3">
                  <ActivityTicker runs={runs!} agents={liveAgents} />
                </Box>
              </Box>

              <ApprovalsDeck approvals={approvals!} agents={liveAgents} runs={runs!} />
            </Grid>
          </>
        )}
      </div>
    </AppShell>
  )
}

// ─── Status rail ──────────────────────────────────────────────────────

const STATUS_PRIORITY: Record<LiveStatus, number> = {
  stuck: 0,
  waiting: 1,
  working: 2,
  idle: 3,
}

function StatusRail({
  counts,
  total,
  active,
  onSelect,
}: {
  counts: Record<LiveStatus, number>
  total: number
  active: LiveStatus | null
  onSelect: (s: LiveStatus | null) => void
}) {
  const order: LiveStatus[] = ['working', 'waiting', 'stuck', 'idle']
  const shown = active ? counts[active] : total
  return (
    <Flex
      align="stretch"
      gap="2"
      wrap="wrap"
      style={{
        padding: 4,
        borderRadius: 8,
        background: 'var(--gray-a2)',
        border: '1px solid var(--gray-a4)',
      }}
    >
      {order.map(k => (
        <StatusPill
          key={k}
          status={k}
          count={counts[k]}
          active={active === k}
          onClick={() => onSelect(active === k ? null : k)}
        />
      ))}
      <Flex align="center" gap="2" px="3" ml="auto">
        <Text size="1" color="gray" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {active ? `${shown} of ${total} shown` : `${total} on the team`}
        </Text>
        {active && (
          <Button
            size="1"
            variant="ghost"
            color="gray"
            onClick={() => onSelect(null)}
          >
            Clear
          </Button>
        )}
      </Flex>
    </Flex>
  )
}

function StatusPill({
  status,
  count,
  active,
  onClick,
}: {
  status: LiveStatus
  count: number
  active: boolean
  onClick: () => void
}) {
  const meta = STATUS_META[status]
  const empty = count === 0
  const dim = empty && !active
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty && !active}
      aria-pressed={active}
      style={{
        all: 'unset',
        cursor: empty && !active ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 6,
        background: active ? meta.tint : (dim ? 'transparent' : meta.tint),
        opacity: dim ? 0.55 : 1,
        boxShadow: active ? `inset 0 0 0 1px ${meta.color}` : 'none',
        transition: 'background 120ms ease, box-shadow 120ms ease',
        minWidth: 0,
      }}
    >
      <Box
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: meta.color,
          flexShrink: 0,
        }}
      />
      <Text size="2" weight="medium" style={{ minWidth: '1.5ch', textAlign: 'right' }}>
        {count}
      </Text>
      <Text size="2" color={dim ? 'gray' : undefined}>
        {meta.label}
      </Text>
    </button>
  )
}

function FilteredEmpty({
  filter,
  onClear,
}: {
  filter: LiveStatus | null
  onClear: () => void
}) {
  const meta = filter ? STATUS_META[filter] : null
  return (
    <div
      className="card"
      style={{
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        textAlign: 'center',
      }}
    >
      <Text as="div" size="3" weight="medium">
        No agents are {meta?.label.toLowerCase() ?? 'in this state'} right now.
      </Text>
      <Text as="div" size="2" color="gray">
        Quiet on this front. Clear the filter to see the rest of the team.
      </Text>
      <Button size="2" variant="soft" color="gray" onClick={onClear}>
        Show all agents
      </Button>
    </div>
  )
}

// ─── Agent tile ───────────────────────────────────────────────────────

function AgentTile({ snapshot }: { snapshot: AgentSnapshot }) {
  const { agent, status, activity, doneToday, pendingNow } = snapshot
  const meta = STATUS_META[status]
  const canTalk = agent.status === 'active' && agent.active_version != null

  return (
    <div
      className="card card--hover"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Status accent band along the top edge — gives the grid its
          at-a-glance "what's red, what's green" character. */}
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 3,
          background: meta.color,
          opacity: status === 'idle' ? 0.35 : 1,
        }}
      />

      <Flex align="center" gap="3" minWidth="0">
        <Avatar initials={agent.name.slice(0, 2).toUpperCase()} size={44} />
        <Box minWidth="0" flexGrow="1">
          <Text as="div" size="3" weight="medium" className="truncate">
            {agent.name}
          </Text>
          {agent.description && (
            <Text as="div" size="1" color="gray" className="truncate" mt="1">
              {agent.description}
            </Text>
          )}
        </Box>
      </Flex>

      <Flex align="center" gap="2">
        <Box
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: meta.color,
            flexShrink: 0,
          }}
        />
        <Text
          size="1"
          weight="medium"
          style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          {meta.label}
        </Text>
      </Flex>

      <Text
        as="div"
        size="2"
        color="gray"
        style={{
          minHeight: 38,
          lineHeight: 1.4,
        }}
      >
        {activity}
      </Text>

      <Flex
        align="center"
        gap="3"
        style={{
          paddingTop: 10,
          borderTop: '1px solid var(--gray-a4)',
        }}
      >
        <Text size="1" color="gray" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          today
        </Text>
        <Text size="1">
          <Text weight="medium">{doneToday}</Text> done
          {pendingNow > 0 && (
            <>
              {' · '}
              <Text weight="medium" style={{ color: 'var(--orange-11)' }}>{pendingNow}</Text> waiting
            </>
          )}
        </Text>
      </Flex>

      <Flex gap="2">
        <Button asChild size="2" variant="soft" disabled={!canTalk} style={{ flex: 1 }}>
          <a href={canTalk ? `#/agents/${agent.id}/talk` : undefined}>
            <IconChat />
            Talk
          </a>
        </Button>
        <Button asChild size="2" variant="soft" color="gray" style={{ flex: 1 }}>
          <a href={`#/agents/${agent.id}`}>
            <IconArrowRight className="ic ic--sm" />
            Manage
          </a>
        </Button>
      </Flex>
    </div>
  )
}

// ─── Approvals deck ───────────────────────────────────────────────────
// Right rail. Stacked card view of every pending approval, with the agent
// resolved via approval.run_id → run.agent_id → agent.name. Sticky on
// large screens so the queue stays visible while scrolling the agent grid.

function ApprovalsDeck({
  approvals,
  agents,
  runs,
}: {
  approvals: ApprovalRequest[]
  agents: Agent[]
  runs: RunListItem[]
}) {
  const pending = approvals.filter(a => a.status === 'pending')

  // approval.run_id → agent — for the per-card "from {Agent}" line.
  const agentByApproval = useMemo(() => {
    const runById = new Map(runs.map(r => [r.id, r]))
    const agentById = new Map(agents.map(a => [a.id, a]))
    const m = new Map<string, Agent>()
    for (const ap of pending) {
      // Chat-source approvals lack a run_id; skip — handled in Tier 3.
      if (!ap.run_id) continue
      const r = runById.get(ap.run_id)
      const ag = r?.agent_id ? agentById.get(r.agent_id) : undefined
      if (ag) m.set(ap.id, ag)
    }
    return m
  }, [pending, runs, agents])

  return (
    <Box
      style={{
        position: 'sticky',
        top: 64,
        alignSelf: 'start',
      }}
    >
      <div className="card card--flush" style={{ borderColor: pending.length > 0 ? 'var(--orange-a6)' : undefined }}>
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">
            <IconApproval className="ic" />
            Needs you
          </Text>
          <Badge
            color={pending.length > 0 ? 'orange' : 'gray'}
            variant={pending.length > 0 ? 'soft' : 'outline'}
            radius="full"
            size="1"
          >
            {pending.length}
          </Badge>
        </div>

        {pending.length === 0 ? (
          <div className="card__body">
            <Text as="div" size="2" color="gray">
              Nothing waiting on your decision.
            </Text>
          </div>
        ) : (
          <div className="card__body">
            <Flex direction="column" gap="2">
              {pending.slice(0, 6).map(ap => {
                const ag = agentByApproval.get(ap.id)
                return (
                  <Link key={ap.id} to={`/approvals/${ap.id}`} className="card card--tile card--hover">
                    <div style={{ padding: '10px 28px 10px 12px' }}>
                      <Flex align="center" justify="between" gap="2" mb="1">
                        <Text size="1" weight="medium" className="truncate" style={{ minWidth: 0 }}>
                          {prettifyRequestedAction(ap.requested_action)}
                        </Text>
                        {ap.approver_role && (
                          <Badge color="gray" variant="soft" radius="full" size="1">
                            {approverRoleLabel(ap.approver_role)}
                          </Badge>
                        )}
                      </Flex>
                      <Text as="div" size="1" color="gray" className="truncate">
                        {ag ? `from ${ag.name}` : (ap.requested_by_name ?? '—')} · {ago(ap.created_at)}
                      </Text>
                    </div>
                    <IconArrowRight className="ic ic--sm card--tile__arrow" />
                  </Link>
                )
              })}
              {pending.length > 6 && (
                <Button asChild variant="ghost" color="gray" size="1" style={{ margin: 0 }}>
                  <a href="#/approvals">+{pending.length - 6} more · Open queue</a>
                </Button>
              )}
              {pending.length <= 6 && (
                <Button asChild variant="ghost" color="gray" size="1" style={{ margin: 0 }}>
                  <a href="#/approvals">Open queue</a>
                </Button>
              )}
            </Flex>
          </div>
        )}
      </div>
    </Box>
  )
}

// ─── Activity ticker ──────────────────────────────────────────────────
// Compact bottom strip of recent runs — the "what just happened" channel.
// Tighter than the Recent activity card on Home (smaller avatars, single
// line per row) so it reads as a stream, not a queue.

const RUN_TONE: Record<RunStatus, string> = {
  completed: 'var(--jade-9)',
  completed_with_errors: 'var(--orange-9)',
  failed: 'var(--red-9)',
  suspended: 'var(--orange-9)',
  running: 'var(--cyan-9)',
  pending: 'var(--cyan-9)',
  cancelled: 'var(--gray-9)',
}

function ActivityTicker({ runs, agents }: { runs: RunListItem[]; agents: Agent[] }) {
  const recent = useMemo(
    () => runs
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 8),
    [runs],
  )
  const agentById = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents])

  return (
    <div className="card card--flush">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">
          <IconRun className="ic" />
          Just now on the floor
        </Text>
        <Button asChild variant="ghost" color="gray" size="1">
          <a href="#/activity"><IconArrowRight className="ic ic--sm" />All activity</a>
        </Button>
      </div>

      {recent.length === 0 ? (
        <div className="card__body">
          <Text as="div" size="2" color="gray">
            Quiet floor — no activity yet.
          </Text>
        </div>
      ) : (
        <div className="card__body" style={{ paddingTop: 6, paddingBottom: 6 }}>
          {recent.map(r => {
            const ag = r.agent_id ? agentById.get(r.agent_id) : undefined
            return (
              <Link
                key={r.id}
                to={`/activity/${r.id}`}
                className="card--hover"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 4px',
                  borderRadius: 6,
                  minWidth: 0,
                }}
              >
                <Box
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: RUN_TONE[r.status] ?? 'var(--gray-9)',
                    flexShrink: 0,
                  }}
                />
                <Avatar initials={(ag?.name ?? 'AG').slice(0, 2).toUpperCase()} size={20} />
                <Text size="1" weight="medium" className="truncate" style={{ minWidth: 0, flexShrink: 1 }}>
                  {ag?.name ?? 'Agent'}
                </Text>
                <Text size="1" color="gray" className="truncate" style={{ minWidth: 0, flexShrink: 2 }}>
                  · {statusLabel(r.status)}
                </Text>
                <Box flexGrow="1" />
                <Text size="1" color="gray" style={{ flexShrink: 0 }}>
                  {ago(r.created_at)}
                </Text>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
