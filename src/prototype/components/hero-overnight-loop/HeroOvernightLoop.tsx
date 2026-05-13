// Scripted scene for the marketing landing-page hero — variant 5 (Overnight Ribbon).
//
// Time-compressed overnight: clock advances 6 PM → 8 AM. Activity rows
// arrive at the bottom of the ribbon as time advances; the visible window
// saturates at 5 rows and oldest scroll out the top. At sunrise the stage
// panel warms with a soft orange radial glow; at 8 AM a morning summary
// card slides into the reserved bottom slot.
//
// Differentiation from other hero loops:
//  - Only variant with a strong temporal narrative (the time passing IS
//    the story).
//  - Only variant that ends on a hard ROI number ("47 tasks · $284 spent").
//  - No synthetic cursor; the viewer is the boss waking up to the report.
//
// PORTABILITY CONTRACT: zero dependencies on the rest of src/prototype.
// Brand tokens inlined as CSS variables in HeroOvernightLoop.css. Copy
// this folder verbatim to hand off.

import { useEffect, useState } from 'react'

import './HeroOvernightLoop.css'
import { ActivityRow } from './parts/ActivityRow'
import { ClockStrip } from './parts/ClockStrip'
import { SummaryCard } from './parts/SummaryCard'
import { PHASES, rowStateAt, viewForPhase } from './phases'
import { SCENE_ACTIVITY } from './scene-data'

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

export function HeroOvernightLoop() {
  const phaseIndex = usePhaseLoop()
  const phase = PHASES[phaseIndex]
  const view = viewForPhase(phase.name)

  const stageCls = `hero-overnight__stage hero-overnight__stage--${view.daypart}`

  return (
    <div className="hero-overnight" aria-label="int3grate.ai overnight preview">
      <div className={stageCls}>
        <ClockStrip clock={view.clock} daypart={view.daypart} />

        <div className="ho-ribbon">
          {SCENE_ACTIVITY.map((item, i) => (
            <ActivityRow
              key={item.id}
              item={item}
              state={rowStateAt(i, view)}
            />
          ))}
        </div>

        <div className="ho-summary-slot">
          <SummaryCard visible={view.summaryVisible} />
        </div>
      </div>
    </div>
  )
}
