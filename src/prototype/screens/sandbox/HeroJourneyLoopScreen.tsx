// SANDBOX preview — design exploration only.
// Hosts the <HeroJourneyLoop /> scripted scene from
// src/prototype/components/hero-journey-loop/.
// Reachable via direct URL #/sandbox/hero-journey-loop — no sidebar entry.
// See docs/agent-plans/2026-05-12-2148-hero-loop-embed.md § 9e for the plan.

import { Flex } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { MockBadge, PageHeader } from '../../components/common'
import { HeroJourneyLoop } from '../../components/hero-journey-loop'

export default function HeroJourneyLoopScreen() {
  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'sandbox' }, { label: 'hero journey loop' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <Flex align="center" gap="2">
              <span>SANDBOX · HERO JOURNEY LOOP</span>
              <MockBadge
                kind="design"
                hint="Third hero variant: comprehensive ~20s walkthrough of the full product (dashboard → approve → hire → chat → response → activity). Sibling of /sandbox/hero-loop and /sandbox/hero-chat-loop. Self-contained — see src/prototype/components/hero-journey-loop/."
              />
            </Flex>
          }
          title={<>Landing hero — <em>comprehensive journey</em>.</>}
          subtitle="Comprehensive ~21 s walkthrough of the full product in one continuous scripted loop: dashboard → approve → hire → chat → response → activity → updated dashboard. Self-contained component; brand tokens inlined for landing-team handoff."
        />

        <Flex justify="center" align="center" pt="6" pb="6">
          <HeroJourneyLoop />
        </Flex>
      </div>
    </AppShell>
  )
}
