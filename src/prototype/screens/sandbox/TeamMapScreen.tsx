// SANDBOX preview — design exploration only.
// /sandbox/team-map. Spatial view of recent asks between agents inside one
// workspace. Backend doesn't emit this data — see docs/backend-gaps.md § 1.16.
// Removable as a unit: route in index.tsx, sidebar entry in shell.tsx, this
// file, the canvas component, the seed `handoffs` block in fixtures.ts, and
// the § 1.16 entry in backend-gaps.md.

import { useEffect, useMemo, useState } from 'react'
import { Button, Flex, SegmentedControl, Text } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { MockBadge, PageHeader } from '../../components/common'
import { EmptyState, ErrorState, LoadingList } from '../../components/states'
import { TeamMapCanvas } from '../../components/team-map-canvas'
import { TeamMapSidePanel } from '../../components/team-map-side-panel'
import { api } from '../../lib/api'
import { agentPositions } from '../../lib/fixtures'
import type { Agent, Handoff } from '../../lib/types'

type TimeWindow = '24h' | '7d' | '30d'

const WINDOW_HOURS: Record<TimeWindow, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
}

const WINDOW_LABEL: Record<TimeWindow, string> = {
  '24h': 'Last 24h',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

export default function TeamMapScreen() {
  const [allHandoffs, setAllHandoffs] = useState<Handoff[] | null>(null)
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [errored, setErrored] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [windowKey, setWindowKey] = useState<TimeWindow>('7d')
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  // Captured at mount so render stays pure (window filter recomputes against
  // a stable "now" rather than calling Date.now() in render).
  const [now] = useState(() => Date.now())


  useEffect(() => {
    let cancelled = false
    Promise.all([api.listHandoffs(), api.listAgents()])
      .then(([h, a]) => {
        if (cancelled) return
        setErrored(false)
        setAllHandoffs(h.items)
        setAgents(a.items)
      })
      .catch(() => { if (!cancelled) setErrored(true) })
    return () => { cancelled = true }
  }, [reloadKey])

  // Window filter is UI-side: the api fetched everything in scope; switching
  // window only re-derives the visible subset, no re-request.
  const visible = useMemo<Handoff[]>(() => {
    if (!allHandoffs) return []
    const cutoff = new Date(now - WINDOW_HOURS[windowKey] * 3600_000).toISOString()
    return allHandoffs.filter(h => h.created_at >= cutoff)
  }, [allHandoffs, windowKey, now])

  // Anyone with a static position is a team member on the map. Drafts and
  // archived agents stay visible so the user sees the full team — historical
  // asks involving an archived agent shouldn't drop their card.
  const placedAgents = useMemo(
    () => (agents ?? []).filter(a => agentPositions[a.id] != null),
    [agents],
  )

  const agentById = useMemo(
    () => new Map(placedAgents.map(a => [a.id, a])),
    [placedAgents],
  )

  const selectedAgent = selectedAgentId ? agentById.get(selectedAgentId) ?? null : null

  const loading = !errored && (allHandoffs === null || agents === null)
  // Three empty-state branches per design doc § 13:
  //   case 1 — fewer than 2 placed members → show a promo placeholder, no
  //            canvas, no window toggle (nothing to filter).
  //   case 2 — 2+ members but no asks in the current window → render the
  //            canvas with cards but no edges + a hint + "Try last 30 days"
  //            when the user can still widen.
  const hasGraph = placedAgents.length >= 2
  const noEdgesInWindow = hasGraph && visible.length === 0

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'sandbox' }, { label: 'team map' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <Flex align="center" gap="2">
              <span>SANDBOX · TEAM MAP</span>
              <MockBadge
                kind="design"
                hint="Inter-agent asks aren't part of the backend yet — handoffs shown here are seeded in the prototype. See docs/backend-gaps.md § 1.16."
              />
            </Flex>
          }
          title={<>How your <em>team</em> works together.</>}
          subtitle="A spatial view of recent asks between your agents. Hover any line to see the latest exchange; click to open the run."
          actions={
            // Hide the window toggle in the < 2 agents case — there's nothing
            // to re-window. Loading / error states keep it hidden too so it
            // doesn't flash before we know how many agents we have.
            !loading && !errored && hasGraph ? (
              <SegmentedControl.Root
                size="2"
                value={windowKey}
                onValueChange={v => setWindowKey(v as TimeWindow)}
                aria-label="Time window"
              >
                <SegmentedControl.Item value="24h">{WINDOW_LABEL['24h']}</SegmentedControl.Item>
                <SegmentedControl.Item value="7d">{WINDOW_LABEL['7d']}</SegmentedControl.Item>
                <SegmentedControl.Item value="30d">{WINDOW_LABEL['30d']}</SegmentedControl.Item>
              </SegmentedControl.Root>
            ) : null
          }
        />

        {errored ? (
          <ErrorState
            title="Couldn't load the map"
            body="The handoffs request failed."
            onRetry={() => setReloadKey(k => k + 1)}
          />
        ) : loading ? (
          <LoadingList rows={3} />
        ) : !hasGraph ? (
          // Case 1 — workspace has fewer than 2 placed members. No edges
          // possible; this is a future-state announcement, not a blocker.
          <EmptyState
            title="Your team will appear here as it grows."
            body="When agents start working together, you'll see how they collaborate."
          />
        ) : (
          <Flex gap="3" align="start" wrap="wrap" mt="4">
            <div style={{ flex: '1 1 800px', minWidth: 0, overflowX: 'auto' }}>
              <TeamMapCanvas
                agents={placedAgents}
                handoffs={visible}
                positions={agentPositions}
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
              />
              {noEdgesInWindow ? (
                <Flex align="center" gap="3" mt="3" wrap="wrap">
                  <Text size="1" color="gray">
                    No collaboration in {WINDOW_LABEL[windowKey].toLowerCase()} yet.
                  </Text>
                  {windowKey !== '30d' && (
                    <Button
                      size="1"
                      variant="soft"
                      color="gray"
                      onClick={() => setWindowKey('30d')}
                    >
                      Try last 30 days
                    </Button>
                  )}
                </Flex>
              ) : (
                <Text as="div" size="1" color="gray" mt="3">
                  {visible.length} ask{visible.length === 1 ? '' : 's'} in {WINDOW_LABEL[windowKey].toLowerCase()}.
                </Text>
              )}
            </div>
            {selectedAgent && (
              <TeamMapSidePanel
                agent={selectedAgent}
                handoffs={visible}
                agentById={agentById}
                onClose={() => setSelectedAgentId(null)}
                windowLabel={WINDOW_LABEL[windowKey]}
              />
            )}
          </Flex>
        )}
      </div>
    </AppShell>
  )
}
