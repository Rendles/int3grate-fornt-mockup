// SANDBOX preview — design exploration only.
// Hosts the <HeroLoop /> scripted scene from src/prototype/components/hero-loop/.
// Reachable via direct URL #/sandbox/hero-loop — no sidebar entry by design.
// See docs/agent-plans/2026-05-12-2148-hero-loop-embed.md for the full plan.

import { Flex } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { MockBadge, PageHeader } from '../../components/common'
import { HeroLoop } from '../../components/hero-loop'

export default function HeroLoopScreen() {
  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'sandbox' }, { label: 'hero loop' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <Flex align="center" gap="2">
              <span>SANDBOX · HERO LOOP</span>
              <MockBadge
                kind="design"
                hint="Scripted scene for the landing-page hero. Self-contained — copy src/prototype/components/hero-loop/ to the landing repo as-is. Brand tokens inlined; zero deps on the rest of the prototype."
              />
            </Flex>
          }
          title={<>Landing hero — <em>scripted scene</em>.</>}
          subtitle="9-second loop. Cursor glides, approval card appears, Approve gets clicked, success state, next-incoming. Plays muted; respects reduced-motion."
        />

        <Flex justify="center" align="center" pt="6" pb="6">
          <HeroLoop />
        </Flex>
      </div>
    </AppShell>
  )
}
