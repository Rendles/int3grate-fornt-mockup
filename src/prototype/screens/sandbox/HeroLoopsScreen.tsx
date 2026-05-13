// SANDBOX preview — design exploration only.
// Compare view: hosts all seven hero-loop variants behind a segmented
// switcher so they can be reviewed side-by-side without route-hopping.
// Only ONE loop is mounted at a time (each loop owns its own setTimeout
// chain — mounting all seven would 7× the timer work for no benefit);
// switching uses React's `key` to force a clean remount so the loop
// restarts from phase 0 every time.
//
// Reachable via #/sandbox/hero-loops and as a sidebar entry (preview badge).

import { useState } from 'react'
import { Flex, SegmentedControl, Text } from '@radix-ui/themes'

import { AppShell } from '../../components/shell'
import { MockBadge, PageHeader } from '../../components/common'

import { HeroLoop } from '../../components/hero-loop'
import { HeroChatLoop } from '../../components/hero-chat-loop'
import { HeroJourneyLoop } from '../../components/hero-journey-loop'
import { HeroRosterLoop } from '../../components/hero-roster-loop'
import { HeroOvernightLoop } from '../../components/hero-overnight-loop'
import { HeroLadderLoop } from '../../components/hero-ladder-loop'
import { HeroOnboardingLoop } from '../../components/hero-onboarding-loop'

type Variant =
  | 'approval'
  | 'chat'
  | 'journey'
  | 'roster'
  | 'overnight'
  | 'ladder'
  | 'onboarding'

interface VariantMeta {
  id: Variant
  number: number
  label: string
  caption: string
}

const VARIANTS: VariantMeta[] = [
  { id: 'approval',   number: 1, label: 'Approval',   caption: 'Single approval card scenario. Cursor clicks Approve, success state, next-incoming.' },
  { id: 'chat',       number: 2, label: 'Chat',       caption: 'Hire template → chat delegation → bullet response + CTA.' },
  { id: 'journey',    number: 3, label: 'Journey',    caption: 'Comprehensive ~21s walkthrough of 6 product surfaces in one continuous loop.' },
  { id: 'roster',     number: 4, label: 'Roster',     caption: 'Four agents in a 2×2 grid, each in a different state. No cursor — pure observer view.' },
  { id: 'overnight',  number: 5, label: 'Overnight',  caption: 'Clock 6 PM → 8 AM, activity ribbon fills, morning summary card (47 done · $284 spent).' },
  { id: 'ladder',     number: 6, label: 'Ladder',     caption: 'Three runs of the same task, each less ceremonial. Trust meter advances Supervised → Assisted → Autonomous.' },
  { id: 'onboarding', number: 7, label: 'Onboarding', caption: 'Empty dashboard → cursor clicks Hire → KPIs climb, cards drop in, activity feed fills. Fades back to empty.' },
]

function renderLoop(variant: Variant) {
  switch (variant) {
    case 'approval':   return <HeroLoop          key="approval"   />
    case 'chat':       return <HeroChatLoop      key="chat"       />
    case 'journey':    return <HeroJourneyLoop   key="journey"    />
    case 'roster':     return <HeroRosterLoop    key="roster"     />
    case 'overnight':  return <HeroOvernightLoop key="overnight"  />
    case 'ladder':     return <HeroLadderLoop    key="ladder"     />
    case 'onboarding': return <HeroOnboardingLoop key="onboarding" />
  }
}

export default function HeroLoopsScreen() {
  const [variant, setVariant] = useState<Variant>('approval')
  const meta = VARIANTS.find(v => v.id === variant)!

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'sandbox' }, { label: 'hero loops' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <Flex align="center" gap="2">
              <span>SANDBOX · HERO LOOPS</span>
              <MockBadge
                kind="design"
                hint="Compare view for all seven landing-hero variants. Switcher above lets you flip between them without route-hopping. Each variant is also reachable on its own at /sandbox/hero-<name>-loop and remains there for direct linking."
              />
            </Flex>
          }
          title={<>Landing hero — <em>compare all variants</em>.</>}
          subtitle="Seven scripted scenes for the marketing landing-page hero. Switch between them with the segmented control below. Each loop runs ~9–21 seconds; switching restarts the active loop from phase 0."
        />

        <Flex direction="column" align="center" gap="4" pt="4" pb="6">
          <SegmentedControl.Root
            value={variant}
            onValueChange={v => setVariant(v as Variant)}
            size="2"
          >
            {VARIANTS.map(v => (
              <SegmentedControl.Item key={v.id} value={v.id}>
                {v.number} · {v.label}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>

          <Text size="2" color="gray" style={{ maxWidth: 640, textAlign: 'center' }}>
            {meta.caption}
          </Text>

          <Flex justify="center" align="center" pt="3">
            {renderLoop(variant)}
          </Flex>
        </Flex>
      </div>
    </AppShell>
  )
}
