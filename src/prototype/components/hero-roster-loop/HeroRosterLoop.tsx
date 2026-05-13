// Scripted scene for the marketing landing-page hero — variant 4 (Team Roster).
//
// Differentiation from the existing three hero loops:
//  - No synthetic cursor. The viewer is the observer watching their team.
//    The other three loops all show "you click X, the UI responds" — this
//    one shows "your team works in parallel while you watch".
//  - Initial frame holds ONE OF EACH state at a glance (working /
//    needs-you / done / idle) — the parallelism reads instantly.
//  - 12 phases × ~1.0s each = ~12.5s loop. Each phase mutates exactly one
//    agent; the other three continue their CSS-driven micro-animations.
//
// PORTABILITY CONTRACT: this folder has zero dependencies on the rest of
// src/prototype. Brand tokens are inlined as CSS variables in
// HeroRosterLoop.css. To hand off to the landing repo, copy this folder
// verbatim.

import { useEffect, useMemo, useRef, useState } from 'react'

import './HeroRosterLoop.css'
import { AgentCard } from './parts/AgentCard'
import { Header } from './parts/Header'
import { PHASES } from './phases'
import { statesForPhase } from './phases'
import { SCENE_AGENTS } from './scene-data'

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

export function HeroRosterLoop() {
  const phaseIndex = usePhaseLoop()
  const phase = PHASES[phaseIndex]
  const states = statesForPhase(phase.name)

  const pendingCount = useMemo(
    () => (Object.values(states) as string[]).filter(s => s === 'needs-you').length,
    [states],
  )

  // Brief 420ms flash on the pending pill whenever the count changes. Using
  // a ref instead of state for "previous count" so the effect doesn't
  // re-trigger itself.
  const prevPendingRef = useRef(pendingCount)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (pendingCount !== prevPendingRef.current) {
      prevPendingRef.current = pendingCount
      setFlash(true)
      const t = window.setTimeout(() => setFlash(false), 420)
      return () => window.clearTimeout(t)
    }
  }, [pendingCount])

  return (
    <div className="hero-roster" aria-label="int3grate.ai team preview">
      <div className="hero-roster__stage">
        <Header pendingCount={pendingCount} flash={flash} />
        <div className="hr-grid">
          {SCENE_AGENTS.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              state={states[agent.id]}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
