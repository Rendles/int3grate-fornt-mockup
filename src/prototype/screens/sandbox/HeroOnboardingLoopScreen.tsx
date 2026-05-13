// SANDBOX preview — design exploration only.
// Hosts the <HeroOnboardingLoop /> scripted scene from
// src/prototype/components/hero-onboarding-loop/.
// Reachable via direct URL #/sandbox/hero-onboarding-loop — no sidebar entry.
// See docs/agent-plans/2026-05-13-2200-hero-variants-batch-2.md § 5 (Variant 7).

import { Flex } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { MockBadge, PageHeader } from '../../components/common'
import { HeroOnboardingLoop } from '../../components/hero-onboarding-loop'

export default function HeroOnboardingLoopScreen() {
  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'sandbox' }, { label: 'hero onboarding loop' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <Flex align="center" gap="2">
              <span>SANDBOX · HERO ONBOARDING LOOP</span>
              <MockBadge
                kind="design"
                hint="Seventh hero variant: origin story. Empty dashboard → cursor clicks 'Hire your first agent' → KPI strip slides in from above, activity feed from below, four agent cards drop into a 2×2 grid, KPIs climb to active=4 / done=7 / spend=$124. Holds, then fades back to empty. Sibling of the other hero variants. Self-contained — copy src/prototype/components/hero-onboarding-loop/ to the landing repo as-is."
              />
            </Flex>
          }
          title={<>Landing hero — <em>empty → buzzing</em>.</>}
          subtitle="~12-second loop. Origin story: empty dashboard with a centred Hire CTA → cursor clicks → dashboard wakes up (KPI strip + agent grid + activity feed all assemble) → KPIs climb → full state holds → fade back to empty. Respects reduced-motion."
        />

        <Flex justify="center" align="center" pt="6" pb="6">
          <HeroOnboardingLoop />
        </Flex>
      </div>
    </AppShell>
  )
}
