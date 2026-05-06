// SANDBOX preview — design exploration for two-click agent creation.
// Reachable via direct URL #/app/sandbox/quick-hire and a "preview"
// sidebar entry. See docs/agent-plans/2026-05-05-1100-quick-hire-sandbox.md
// and docs/agent-plans/2026-05-05-1230-empty-state-quick-hire-onboarding.md
// for context. The actual grid logic lives in
// src/prototype/components/quick-hire-grid.tsx — this screen is just a
// standalone host for design iteration.

import { Flex } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { MockBadge, PageHeader } from '../../components/common'
import { QuickHireGrid } from '../../components/quick-hire-grid'

export default function QuickHireScreen() {
  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'sandbox' }, { label: 'quick hire' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <Flex align="center" gap="2">
              <span>SANDBOX · QUICK HIRE</span>
              <MockBadge
                kind="design"
                hint="Sandbox preview of a two-click hire flow. Hires created here go through the same API path as /agents/new and will appear on the real /agents list."
              />
            </Flex>
          }
          title={<>Hire an agent in <em>two clicks</em>.</>}
          subtitle="Pick a role, review the summary, confirm. No multi-step wizard."
        />

        <QuickHireGrid mode="standalone" />
      </div>
    </AppShell>
  )
}
