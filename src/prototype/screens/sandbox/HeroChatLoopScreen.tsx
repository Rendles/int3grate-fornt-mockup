// SANDBOX preview — design exploration only.
// Hosts the <HeroChatLoop /> scripted scene from src/prototype/components/hero-chat-loop/.
// Reachable via direct URL #/sandbox/hero-chat-loop — no sidebar entry by design.
// See docs/agent-plans/2026-05-12-2148-hero-loop-embed.md § 9c for the full plan.

import { Flex } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { MockBadge, PageHeader } from '../../components/common'
import { HeroChatLoop } from '../../components/hero-chat-loop'

export default function HeroChatLoopScreen() {
  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'sandbox' }, { label: 'hero chat loop' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <Flex align="center" gap="2">
              <span>SANDBOX · HERO CHAT LOOP</span>
              <MockBadge
                kind="design"
                hint="Second hero variant: agent joins → user delegates via chat → agent responds. Sibling of /sandbox/hero-loop. Self-contained — copy src/prototype/components/hero-chat-loop/ to the landing repo as-is."
              />
            </Flex>
          }
          title={<>Landing hero — <em>chat scene</em>.</>}
          subtitle="9.4-second loop. Agent joins, user types a delegation, agent thinks, responds with a bullet list, drops a CTA. Respects reduced-motion."
        />

        <Flex justify="center" align="center" pt="6" pb="6">
          <HeroChatLoop />
        </Flex>
      </div>
    </AppShell>
  )
}
