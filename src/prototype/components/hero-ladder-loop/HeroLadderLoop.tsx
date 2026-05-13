// Scripted scene for the marketing landing-page hero — variant 6 (Trust Ladder).
//
// One agent runs the same TASK TYPE three times across three days.
// Each run shows progressively less ceremony — the trust progression IS
// the visual story:
//   Run 1: full approval card. Cursor visible, clicks Approve.
//   Run 2: compact card with rule chip. Cursor gone — auto-approves.
//   Run 3: appears already done. Silent. No cursor.
// Trust meter at top advances Supervised → Assisted → Autonomous.
//
// The disappearance of the cursor across the loop is itself part of the
// message: the agent needs you less over time. This is the most
// conceptually-distinct variant — none of the existing four loops tell
// a "growing autonomy" story.
//
// PORTABILITY CONTRACT: zero dependencies on the rest of src/prototype.
// Brand tokens inlined as CSS variables in HeroLadderLoop.css. Copy this
// folder verbatim to hand off.

import { useEffect, useState } from 'react'

import './HeroLadderLoop.css'
import { AgentStrip } from './parts/AgentStrip'
import { Cursor } from './parts/Cursor'
import { Run1Card, Run2Card, Run3Card } from './parts/Runs'
import { TrustMeter } from './parts/TrustMeter'
import { CURSOR_POSITIONS, PHASES, viewForPhase } from './phases'
import { TRUST_CAPTIONS } from './scene-data'

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

export function HeroLadderLoop() {
  const phaseIndex = usePhaseLoop()
  const phase = PHASES[phaseIndex]
  const view = viewForPhase(phase.name)
  const cursorPos = CURSOR_POSITIONS[view.cursor]
  const cursorVisible = view.cursor !== 'hidden'

  return (
    <div className="hero-ladder" aria-label="int3grate.ai trust ladder preview">
      <div className="hero-ladder__stage">
        <AgentStrip />

        <TrustMeter level={view.trustLevel} />

        <div className="ld-caption" key={view.trustLevel}>
          {TRUST_CAPTIONS[view.trustLevel]}
        </div>

        <div className="ld-runs">
          <Run1Card state={view.run1} approvePressed={view.approvePressed} />
          <Run2Card state={view.run2} />
          <Run3Card state={view.run3} />
        </div>

        <Cursor x={cursorPos.x} y={cursorPos.y} visible={cursorVisible} />
      </div>
    </div>
  )
}
