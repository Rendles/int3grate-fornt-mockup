// SANDBOX preview — see screens/sandbox/TeamMapScreen.tsx for the surface
// rationale and removability notes.
//
// Renders agents as compact cards at static positions and recent asks as
// edges between them. One edge per pair regardless of direction; the latest
// ask in the pair drives the visual style and the hover summary.

import { useMemo, useState } from 'react'
import { Badge, Flex, Text } from '@radix-ui/themes'

import { Avatar } from './common'
import { useRouter } from '../router'
import { ago } from '../lib/format'
import type { Agent, Handoff, HandoffStatus } from '../lib/types'

const CANVAS_W = 1200
const CANVAS_H = 620
const CARD_W = 188
const CARD_H = 76
// Hit-target line width (transparent, sits over the visible stroke). Picked
// to stay clearly hoverable on a 2px stroke without making adjacent edges
// hard to disambiguate.
const HIT_WIDTH = 14

// Aggregate priority across handoffs in one pair. Higher number wins —
// pending dominates so the user immediately spots in-flight asks; timed_out
// next; declined; answered last (the calm baseline).
const STATUS_PRIORITY: Record<HandoffStatus, number> = {
  pending: 4,
  timed_out: 3,
  declined: 2,
  answered: 1,
}

const STATUS_COPY: Record<HandoffStatus, { label: string; color: 'orange' | 'gray' | 'red' }> = {
  pending:   { label: 'Waiting',   color: 'orange' },
  answered:  { label: 'Answered',  color: 'gray' },
  timed_out: { label: 'No answer', color: 'red' },
  declined:  { label: 'Declined',  color: 'red' },
}

interface PairAggregate {
  pairKey: string         // unordered "min|max" key
  count: number
  state: HandoffStatus    // dominant status across the pair (drives the visible stroke)
  latest: Handoff         // direction + summary + run_id of the latest ask
  // Canonical pair endpoints (lex-min / lex-max) and per-direction flags. Used
  // to decide which arrowheads to render: aToB → arrow at b end, bToA → at a.
  aId: string
  bId: string
  aToB: boolean
  bToA: boolean
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function aggregatePairs(handoffs: Handoff[]): PairAggregate[] {
  const map = new Map<string, PairAggregate>()
  for (const h of handoffs) {
    const key = pairKey(h.from_agent_id, h.to_agent_id)
    const aId = h.from_agent_id < h.to_agent_id ? h.from_agent_id : h.to_agent_id
    const bId = h.from_agent_id < h.to_agent_id ? h.to_agent_id : h.from_agent_id
    const isAToB = h.from_agent_id === aId
    const cur = map.get(key)
    if (!cur) {
      map.set(key, {
        pairKey: key,
        count: 1,
        state: h.status,
        latest: h,
        aId,
        bId,
        aToB: isAToB,
        bToA: !isAToB,
      })
      continue
    }
    cur.count += 1
    if (STATUS_PRIORITY[h.status] > STATUS_PRIORITY[cur.state]) cur.state = h.status
    if (h.created_at > cur.latest.created_at) cur.latest = h
    if (isAToB) cur.aToB = true
    else cur.bToA = true
  }
  return Array.from(map.values())
}

// Distance from a card centre to its rectangle border along a unit direction
// (ux, uy). Solves t such that (ux·t, uy·t) lands on the card boundary —
// whichever wall (left/right vs top/bottom) the ray hits first wins.
function cardEdgeDistance(ux: number, uy: number): number {
  const tx = ux !== 0 ? CARD_W / 2 / Math.abs(ux) : Infinity
  const ty = uy !== 0 ? CARD_H / 2 / Math.abs(uy) : Infinity
  return Math.min(tx, ty)
}

// Edge endpoints insetted to each card's actual rectangle border + a small
// buffer so arrowheads render just outside the card. Returns null if the
// cards overlap so much that the line would have negative length (defensive
// — shouldn't happen with a sane layout).
const EDGE_BUFFER = 6
function insetLine(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x1: number; y1: number; x2: number; y2: number } | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return null
  const ux = dx / len
  const uy = dy / len
  // Same-size cards on both ends → same edge distance for from and to.
  const edgeDist = cardEdgeDistance(ux, uy)
  const total = (edgeDist + EDGE_BUFFER) * 2
  if (len <= total) return null
  return {
    x1: from.x + ux * (edgeDist + EDGE_BUFFER),
    y1: from.y + uy * (edgeDist + EDGE_BUFFER),
    x2: to.x - ux * (edgeDist + EDGE_BUFFER),
    y2: to.y - uy * (edgeDist + EDGE_BUFFER),
  }
}

function strokeWidth(count: number): number {
  // 1 ask = 2px; +0.5px per extra ask, cap at 6px (≈ 8 asks in a pair).
  return Math.min(2 + (count - 1) * 0.5, 6)
}

// Difference between two ISO timestamps as a short human string ("4m", "2h").
// Always non-negative; pure (no Date.now). Used for "answered Xm later".
function durationLabel(startIso: string, endIso: string): string {
  const ms = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime())
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

interface TeamMapCanvasProps {
  agents: Agent[]
  handoffs: Handoff[]
  positions: Record<string, { x: number; y: number }>
  selectedAgentId: string | null
  onSelectAgent: (agentId: string | null) => void
}

export function TeamMapCanvas({
  agents,
  handoffs,
  positions,
  selectedAgentId,
  onSelectAgent,
}: TeamMapCanvasProps) {
  const { navigate } = useRouter()
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const placedAgents = useMemo(
    () => agents.filter(a => positions[a.id] != null),
    [agents, positions],
  )

  const placedIds = useMemo(
    () => new Set(placedAgents.map(a => a.id)),
    [placedAgents],
  )

  const agentById = useMemo(
    () => new Map(placedAgents.map(a => [a.id, a])),
    [placedAgents],
  )

  // Drop edges where either endpoint isn't placed (shouldn't happen with
  // well-seeded fixtures, but defends future adds).
  const visibleHandoffs = useMemo(
    () => handoffs.filter(h => placedIds.has(h.from_agent_id) && placedIds.has(h.to_agent_id)),
    [handoffs, placedIds],
  )

  const pairs = useMemo(() => aggregatePairs(visibleHandoffs), [visibleHandoffs])

  const hoveredPair = hoveredKey ? pairs.find(p => p.pairKey === hoveredKey) ?? null : null

  return (
    <div className="team-map" style={{ width: CANVAS_W, height: CANVAS_H }}>
      <svg
        className="team-map__edges"
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width={CANVAS_W}
        height={CANVAS_H}
      >
        <defs>
          {/* One filled-triangle marker per status colour. orient="auto" gives
              a marker-end pointing along the line; markerStart uses the
              auto-start-reverse variant so the same shape flips for arrows
              at the line origin. */}
          {(['answered', 'pending', 'timed_out', 'declined'] as HandoffStatus[]).map(s => (
            <marker
              key={s}
              id={`team-map-arrow-${s}`}
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                className={`team-map__arrow team-map__arrow--${s}`}
              />
            </marker>
          ))}
        </defs>
        {pairs.map(p => {
          // Canonical orientation: a is lex-min, b is lex-max. markerEnd at b
          // corresponds to a→b direction; markerStart at a (auto-start-reverse)
          // covers b→a. Bidirectional pairs get arrows at both ends.
          const aPos = positions[p.aId]
          const bPos = positions[p.bId]
          if (!aPos || !bPos) return null
          const inset = insetLine(aPos, bPos)
          if (!inset) return null
          const isHovered = hoveredKey === p.pairKey
          return (
            <g key={p.pairKey}>
              {/* Visible stroke + arrowheads. */}
              <line
                x1={inset.x1}
                y1={inset.y1}
                x2={inset.x2}
                y2={inset.y2}
                className={
                  `team-map__edge team-map__edge--${p.state}` + (isHovered ? ' team-map__edge--hover' : '')
                }
                strokeWidth={strokeWidth(p.count)}
                markerEnd={p.aToB ? `url(#team-map-arrow-${p.state})` : undefined}
                markerStart={p.bToA ? `url(#team-map-arrow-${p.state})` : undefined}
              />
              {/* Hit target — transparent, wider, sits on top so hover reads
                  reliably regardless of how thin the visible stroke is. */}
              <line
                x1={inset.x1}
                y1={inset.y1}
                x2={inset.x2}
                y2={inset.y2}
                className="team-map__edge-hit"
                strokeWidth={HIT_WIDTH}
                onMouseEnter={() => setHoveredKey(p.pairKey)}
                onMouseLeave={() => setHoveredKey(prev => (prev === p.pairKey ? null : prev))}
                onClick={() => navigate(`/activity/${p.latest.run_id}`)}
              />
            </g>
          )
        })}
      </svg>

      {placedAgents.map(a => {
        const pos = positions[a.id]
        const isSelected = a.id === selectedAgentId
        return (
          <div
            key={a.id}
            className={`team-map__node${isSelected ? ' team-map__node--selected' : ''}`}
            style={{
              left: pos.x,
              top: pos.y,
              width: CARD_W,
              height: CARD_H,
            }}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => onSelectAgent(isSelected ? null : a.id)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelectAgent(isSelected ? null : a.id)
              }
            }}
          >
            <Avatar initials={a.name.slice(0, 2).toUpperCase()} size={32} />
            <div className="team-map__node-meta">
              <Text as="div" size="2" weight="medium" className="truncate">{a.name}</Text>
              <Text as="div" size="1" color="gray" className="truncate">
                {a.status === 'active' ? 'Active'
                  : a.status === 'paused' ? 'Paused'
                  : a.status === 'archived' ? 'Off the team'
                  : 'Draft'}
              </Text>
            </div>
          </div>
        )
      })}

      {hoveredPair && (
        <EdgeTooltip
          pair={hoveredPair}
          fromAgent={agentById.get(hoveredPair.latest.from_agent_id) ?? null}
          toAgent={agentById.get(hoveredPair.latest.to_agent_id) ?? null}
          positions={positions}
        />
      )}
    </div>
  )
}

function EdgeTooltip({
  pair,
  fromAgent,
  toAgent,
  positions,
}: {
  pair: PairAggregate
  fromAgent: Agent | null
  toAgent: Agent | null
  positions: Record<string, { x: number; y: number }>
}) {
  const from = positions[pair.latest.from_agent_id]
  const to = positions[pair.latest.to_agent_id]
  if (!from || !to || !fromAgent || !toAgent) return null
  // Anchor at edge midpoint; CSS centers and offsets above so it doesn't
  // sit on top of either card.
  const cx = (from.x + to.x) / 2
  const cy = (from.y + to.y) / 2
  const meta = STATUS_COPY[pair.state]
  const answeredIn =
    pair.latest.status === 'answered' && pair.latest.resolved_at
      ? durationLabel(pair.latest.created_at, pair.latest.resolved_at)
      : null
  return (
    <div
      className="team-map__tooltip"
      style={{ left: cx, top: cy }}
      role="tooltip"
    >
      <Text size="2" weight="medium">
        {fromAgent.name} <Text color="gray">asked</Text> {toAgent.name}
      </Text>
      <Text size="2" color="gray" mt="1" as="div">
        {pair.latest.summary}
      </Text>
      <Flex gap="2" align="center" mt="2" wrap="wrap">
        <Badge size="1" color={meta.color} variant="soft" radius="full">{meta.label}</Badge>
        <Text size="1" color="gray">{ago(pair.latest.created_at)}</Text>
        {answeredIn && (
          <Text size="1" color="gray">· back in {answeredIn}</Text>
        )}
        {pair.count > 1 && (
          <Text size="1" color="gray">· {pair.count} asks total</Text>
        )}
      </Flex>
    </div>
  )
}
