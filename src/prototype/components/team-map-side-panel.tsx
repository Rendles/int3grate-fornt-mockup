// Side panel for /sandbox/team-map. Shown when a team member is selected on
// the canvas; aggregates the visible window of asks involving that agent
// into quick stats + top collaborators + the latest 3 asks.

import { useMemo } from 'react'
import { Badge, Flex, IconButton, Text } from '@radix-ui/themes'

import { Avatar } from './common'
import { useRouter } from '../router'
import { ago } from '../lib/format'
import type { Agent, Handoff, HandoffStatus } from '../lib/types'

const STATUS_BADGE: Record<HandoffStatus, { label: string; color: 'orange' | 'gray' | 'red' }> = {
  pending:   { label: 'Waiting',   color: 'orange' },
  answered:  { label: 'Answered',  color: 'gray' },
  timed_out: { label: 'No answer', color: 'red' },
  declined:  { label: 'Declined',  color: 'red' },
}

interface TeamMapSidePanelProps {
  agent: Agent
  handoffs: Handoff[]
  agentById: Map<string, Agent>
  onClose: () => void
  windowLabel: string
}

interface CollaboratorRow {
  partnerId: string
  count: number
}

export function TeamMapSidePanel({
  agent,
  handoffs,
  agentById,
  onClose,
  windowLabel,
}: TeamMapSidePanelProps) {
  const { navigate } = useRouter()

  const sent = useMemo(
    () => handoffs.filter(h => h.from_agent_id === agent.id),
    [handoffs, agent.id],
  )
  const received = useMemo(
    () => handoffs.filter(h => h.to_agent_id === agent.id),
    [handoffs, agent.id],
  )
  const pendingSent = sent.filter(h => h.status === 'pending').length
  const pendingReceived = received.filter(h => h.status === 'pending').length

  // Top collaborators across both directions, by total count.
  const collaborators = useMemo<CollaboratorRow[]>(() => {
    const counts = new Map<string, number>()
    for (const h of [...sent, ...received]) {
      const partner = h.from_agent_id === agent.id ? h.to_agent_id : h.from_agent_id
      counts.set(partner, (counts.get(partner) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([partnerId, count]) => ({ partnerId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
  }, [sent, received, agent.id])

  // Latest 3 asks involving this agent, newest first. handoffs are already
  // newest-first per the api but we re-sort defensively here.
  const latest = useMemo(
    () =>
      [...sent, ...received]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 3),
    [sent, received],
  )

  const totalAsks = sent.length + received.length

  return (
    <aside className="team-map-panel" aria-label={`${agent.name} details`}>
      <Flex align="start" justify="between" gap="2">
        <Flex align="center" gap="2" minWidth="0">
          <Avatar initials={agent.name.slice(0, 2).toUpperCase()} size={32} />
          <div style={{ minWidth: 0 }}>
            <Text as="div" size="2" weight="medium" className="truncate">{agent.name}</Text>
            <Text as="div" size="1" color="gray" className="truncate">
              {agent.status === 'active' ? 'Active'
                : agent.status === 'paused' ? 'Paused'
                : agent.status === 'archived' ? 'Off the team'
                : 'Draft'}
            </Text>
          </div>
        </Flex>
        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          onClick={onClose}
          aria-label="Close details"
        >
          ✕
        </IconButton>
      </Flex>

      {totalAsks === 0 ? (
        <Text as="div" size="1" color="gray" mt="3">
          No asks involving {agent.name} in {windowLabel.toLowerCase()}.
        </Text>
      ) : (
        <>
          <div className="team-map-panel__section">
            <Text as="div" size="1" color="gray" mb="1" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              In {windowLabel.toLowerCase()}
            </Text>
            <Flex direction="column" gap="1">
              <Flex justify="between">
                <Text size="2" color="gray">Asked others</Text>
                <Text size="2">
                  {sent.length}
                  {pendingSent > 0 && (
                    <Text size="1" color="orange" ml="1">· {pendingSent} waiting</Text>
                  )}
                </Text>
              </Flex>
              <Flex justify="between">
                <Text size="2" color="gray">Asked by others</Text>
                <Text size="2">
                  {received.length}
                  {pendingReceived > 0 && (
                    <Text size="1" color="orange" ml="1">· {pendingReceived} waiting on them</Text>
                  )}
                </Text>
              </Flex>
            </Flex>
          </div>

          {collaborators.length > 0 && (
            <div className="team-map-panel__section">
              <Text as="div" size="1" color="gray" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Most asks with
              </Text>
              <Flex direction="column" gap="1">
                {collaborators.map(c => {
                  const partner = agentById.get(c.partnerId)
                  return (
                    <Flex key={c.partnerId} justify="between" align="center" gap="2">
                      <Text size="2" className="truncate" style={{ minWidth: 0, flex: 1 }}>
                        {partner ? partner.name : c.partnerId}
                      </Text>
                      <Badge size="1" color="gray" variant="soft" radius="full">{c.count}</Badge>
                    </Flex>
                  )
                })}
              </Flex>
            </div>
          )}

          <div className="team-map-panel__section">
            <Text as="div" size="1" color="gray" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Latest
            </Text>
            <Flex direction="column" gap="2">
              {latest.map(h => {
                const isOutbound = h.from_agent_id === agent.id
                const partnerId = isOutbound ? h.to_agent_id : h.from_agent_id
                const partner = agentById.get(partnerId)
                const meta = STATUS_BADGE[h.status]
                return (
                  <button
                    key={h.id}
                    type="button"
                    className="team-map-panel__item"
                    onClick={() => navigate(`/activity/${h.run_id}`)}
                  >
                    <Flex align="center" gap="2" mb="1">
                      <Text size="1" color="gray">{isOutbound ? 'asked' : 'asked by'}</Text>
                      <Text size="2" weight="medium" className="truncate">
                        {partner ? partner.name : partnerId}
                      </Text>
                    </Flex>
                    <Text as="div" size="1" color="gray" className="team-map-panel__item-summary">
                      {h.summary}
                    </Text>
                    <Flex gap="2" align="center" mt="1" wrap="wrap">
                      <Badge size="1" color={meta.color} variant="soft" radius="full">{meta.label}</Badge>
                      <Text size="1" color="gray">{ago(h.created_at)}</Text>
                    </Flex>
                  </button>
                )
              })}
            </Flex>
          </div>
        </>
      )}
    </aside>
  )
}
