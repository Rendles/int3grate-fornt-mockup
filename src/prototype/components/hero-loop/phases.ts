// Phase table for the hero-loop scripted scene.
//
// The state machine in HeroLoop.tsx advances through these phases on a
// rolling setTimeout, looping at the end. Cursor position (Step 5) and
// per-phase visual state (Step 6) are derived from `name`.
//
// Total loop ≈ 9.0s. Durations are tuned for two simultaneous concerns:
//   1. Cursor glides (cursor-to-tile, cursor-to-approve) need long enough
//      that the eye can track them. 1200–1400ms each.
//   2. Click beats and outro are punctuation — kept short (200–600ms).
//
// Adjust here only — every downstream consumer reads from this single
// source of truth.

export interface Phase {
  name: PhaseName
  duration: number
}

export type PhaseName =
  | 'idle'
  | 'cursor-to-tile'
  | 'tile-click'
  | 'approval-enter'
  | 'cursor-to-approve'
  | 'approve-click'
  | 'success'
  | 'next-incoming'
  | 'outro'

export const PHASES: Phase[] = [
  { name: 'idle',              duration: 1200 },
  { name: 'cursor-to-tile',    duration: 1200 },
  { name: 'tile-click',        duration: 200 },
  { name: 'approval-enter',    duration: 1400 },
  { name: 'cursor-to-approve', duration: 1400 },
  { name: 'approve-click',     duration: 200 },
  { name: 'success',           duration: 1400 },
  { name: 'next-incoming',     duration: 1400 },
  { name: 'outro',             duration: 600 },
]

export const TOTAL_LOOP_MS = PHASES.reduce((sum, p) => sum + p.duration, 0)
