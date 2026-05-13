// SANDBOX preview — design exploration only.
// Hosts the <HeroOvernightLoop /> scripted scene from
// src/prototype/components/hero-overnight-loop/.
// Reachable via direct URL #/sandbox/hero-overnight-loop — no sidebar entry.
// See docs/agent-plans/2026-05-13-2200-hero-variants-batch-2.md § 5 (Variant 5).

import { Flex } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { MockBadge, PageHeader } from '../../components/common'
import { HeroOvernightLoop } from '../../components/hero-overnight-loop'

export default function HeroOvernightLoopScreen() {
  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'sandbox' }, { label: 'hero overnight loop' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <Flex align="center" gap="2">
              <span>SANDBOX · HERO OVERNIGHT LOOP</span>
              <MockBadge
                kind="design"
                hint="Fifth hero variant: time-compressed overnight. Clock runs 6 PM → 8 AM, activity ribbon fills, morning summary slides in with the hard ROI numbers (47 tasks · 6 need you · $284 spent). Sibling of the other hero variants. Self-contained — copy src/prototype/components/hero-overnight-loop/ to the landing repo as-is."
              />
            </Flex>
          }
          title={<>Landing hero — <em>overnight ribbon</em>.</>}
          subtitle="~12.5-second loop. Clock advances 6 PM → 8 AM, activity rows arrive from below (oldest scroll out the top), stage warms at sunrise, morning summary card slides up at 8 AM with the night's totals. Respects reduced-motion."
        />

        <Flex justify="center" align="center" pt="6" pb="6">
          <HeroOvernightLoop />
        </Flex>
      </div>
    </AppShell>
  )
}
