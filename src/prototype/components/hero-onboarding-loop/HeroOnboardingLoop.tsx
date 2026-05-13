// Scripted scene for the marketing landing-page hero — variant 7 (Empty → Buzzing).
//
// Origin story. Stage starts empty: greeting + centered "Hire your first
// agent" CTA. Cursor approaches, clicks. The CTA fades, KPI strip slides
// down from above, activity feed slides up from below, four agent cards
// drop into a 2×2 grid one-by-one. KPI numbers climb: active 0→4,
// done 0→7, spend $0→$124. State holds, then fades back to empty. Loop.
//
// Differentiation from existing five hero loops:
//  - Only variant with a strong before/after narrative (empty → buzzing).
//  - Recruits the "I want to see myself getting started" empathy hook.
//  - The CTA is on-screen during the empty hold — closest any of the six
//    loops gets to a literal "click me" prompt.
//
// PORTABILITY CONTRACT: zero dependencies on the rest of src/prototype.
// Brand tokens inlined as CSS variables in HeroOnboardingLoop.css. Copy
// this folder verbatim to hand off.

import { useEffect, useState } from 'react'

import './HeroOnboardingLoop.css'
import { ActivityFeed } from './parts/ActivityFeed'
import { AgentsGrid } from './parts/AgentsGrid'
import { CtaCard } from './parts/CtaCard'
import { Cursor } from './parts/Cursor'
import { Greeting } from './parts/Greeting'
import { KpiStrip } from './parts/KpiStrip'
import { CURSOR_POSITIONS, PHASES, viewForPhase } from './phases'

function usePhaseLoop() {
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhaseIndex(i => (i + 1) % PHASES.length)
    }, PHASES[phaseIndex].duration)
    return () => window.clearTimeout(timer)
  }, [phaseIndex])

  return phaseIndex
}

export function HeroOnboardingLoop() {
  const phaseIndex = usePhaseLoop()
  const phase = PHASES[phaseIndex]
  const view = viewForPhase(phase.name)
  const cursorPos = CURSOR_POSITIONS[view.cursor]
  const cursorVisible = view.cursor !== 'hidden'

  return (
    <div className="hero-onboarding" aria-label="int3grate.ai onboarding preview">
      <div className="hero-onboarding__stage">
        <Greeting />

        <KpiStrip visible={view.kpiVisible} kpi={view.kpi} />

        <div className="ob-main">
          <CtaCard visible={view.ctaVisible} pressed={view.ctaPressed} />
          <AgentsGrid visible={view.gridVisible} agentsVisible={view.agentsVisible} />
        </div>

        <ActivityFeed visible={view.activityVisible} rowsVisible={view.activityRows} />

        <Cursor x={cursorPos.x} y={cursorPos.y} visible={cursorVisible} />
      </div>
    </div>
  )
}
