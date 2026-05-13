// SANDBOX preview — design exploration only.
// Hosts the <HeroRosterLoop /> scripted scene from
// src/prototype/components/hero-roster-loop/.
// Reachable via direct URL #/sandbox/hero-roster-loop — no sidebar entry.
// See docs/agent-plans/2026-05-13-2200-hero-variants-batch-2.md § 5 (Variant 4).

import { Flex } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { MockBadge, PageHeader } from '../../components/common'
import { HeroRosterLoop } from '../../components/hero-roster-loop'

export default function HeroRosterLoopScreen() {
  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'sandbox' }, { label: 'hero roster loop' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <Flex align="center" gap="2">
              <span>SANDBOX · HERO ROSTER LOOP</span>
              <MockBadge
                kind="design"
                hint="Fourth hero variant: four named agents in a 2×2 grid, each in their own state. The viewer is the observer — no cursor. Initial frame holds one of each state (working / needs-you / done / idle). Sibling of /sandbox/hero-loop, hero-chat-loop, hero-journey-loop. Self-contained — copy src/prototype/components/hero-roster-loop/ to the landing repo as-is."
              />
            </Flex>
          }
          title={<>Landing hero — <em>team roster</em>.</>}
          subtitle="~12.5-second loop. Parallel team view: four agents work in parallel, each transitioning through working / needs-you / done / idle on its own timeline. No synthetic cursor — the viewer is the boss watching their digital team. Respects reduced-motion."
        />

        <Flex justify="center" align="center" pt="6" pb="6">
          <HeroRosterLoop />
        </Flex>
      </div>
    </AppShell>
  )
}
