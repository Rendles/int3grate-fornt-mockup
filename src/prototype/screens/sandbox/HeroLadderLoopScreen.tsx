// SANDBOX preview — design exploration only.
// Hosts the <HeroLadderLoop /> scripted scene from
// src/prototype/components/hero-ladder-loop/.
// Reachable via direct URL #/sandbox/hero-ladder-loop — no sidebar entry.
// See docs/agent-plans/2026-05-13-2200-hero-variants-batch-2.md § 5 (Variant 6).

import { Flex } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { MockBadge, PageHeader } from '../../components/common'
import { HeroLadderLoop } from '../../components/hero-ladder-loop'

export default function HeroLadderLoopScreen() {
  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'sandbox' }, { label: 'hero ladder loop' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <Flex align="center" gap="2">
              <span>SANDBOX · HERO LADDER LOOP</span>
              <MockBadge
                kind="design"
                hint="Sixth hero variant: trust ladder. One agent runs the same task type 3 times across 3 days. Each run shows progressively less ceremony — full approval card → rule-based auto-approve → silent. Cursor visible only in Run 1. Trust meter at top advances Supervised → Assisted → Autonomous. Sibling of the other hero variants. Self-contained — copy src/prototype/components/hero-ladder-loop/ to the landing repo as-is."
              />
            </Flex>
          }
          title={<>Landing hero — <em>trust ladder</em>.</>}
          subtitle="~12-second loop. The agent earns autonomy across three runs of the same refund task. Cursor visible only in Run 1 — its disappearance across the loop is part of the message. Respects reduced-motion."
        />

        <Flex justify="center" align="center" pt="6" pb="6">
          <HeroLadderLoop />
        </Flex>
      </div>
    </AppShell>
  )
}
