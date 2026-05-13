// Phase table for the hero-ladder-loop scripted scene.
//
// 11 phases × ~1.0s each = ~12s loop. Three sequential "runs" of the same
// task type, each with progressively less ceremony:
//   Run 1: full approval card, cursor clicks Approve.
//   Run 2: compact card with rule chip, auto-approves.
//   Run 3: appears already done — silent.
// Trust meter at top advances Supervised → Assisted → Autonomous between
// runs. The DISAPPEARANCE of the cursor across the loop is itself part of
// the message: the agent needs you less over time.
//
// Adjust here only — every downstream consumer reads from this single
// source of truth.

import type { TrustLevel } from './scene-data'

export interface Phase {
  name: PhaseName
  duration: number
}

export type PhaseName =
  | 'p0-intro'
  | 'p1-run1-arrive'
  | 'p2-cursor-to-approve'
  | 'p3-approve-click'
  | 'p4-run1-done-tick'
  | 'p5-run2-arrive'
  | 'p6-run2-rule-hold'
  | 'p7-run2-done-tick'
  | 'p8-run3-arrive'
  | 'p9-final-hold'
  | 'p10-outro'

export const PHASES: Phase[] = [
  { name: 'p0-intro',              duration: 1000 },
  { name: 'p1-run1-arrive',        duration: 900  },
  { name: 'p2-cursor-to-approve',  duration: 1200 },
  { name: 'p3-approve-click',      duration: 400  },
  { name: 'p4-run1-done-tick',     duration: 1300 },
  { name: 'p5-run2-arrive',        duration: 900  },
  { name: 'p6-run2-rule-hold',     duration: 1400 },
  { name: 'p7-run2-done-tick',     duration: 1100 },
  { name: 'p8-run3-arrive',        duration: 900  },
  { name: 'p9-final-hold',         duration: 2200 },
  { name: 'p10-outro',             duration: 700  },
]

export const TOTAL_LOOP_MS = PHASES.reduce((sum, p) => sum + p.duration, 0)

export type Run1State = 'hidden' | 'expanded' | 'done'
export type Run2State = 'hidden' | 'countdown' | 'done'
export type Run3State = 'hidden' | 'visible'
export type CursorPhase = 'hidden' | 'idle' | 'hover-approve' | 'press-approve'

export interface ViewState {
  trustLevel: TrustLevel
  run1: Run1State
  run2: Run2State
  run3: Run3State
  cursor: CursorPhase
  approvePressed: boolean
}

export function viewForPhase(name: PhaseName): ViewState {
  switch (name) {
    case 'p0-intro':              return { trustLevel: 'supervised', run1: 'hidden',   run2: 'hidden',    run3: 'hidden',  cursor: 'idle',          approvePressed: false }
    case 'p1-run1-arrive':        return { trustLevel: 'supervised', run1: 'expanded', run2: 'hidden',    run3: 'hidden',  cursor: 'idle',          approvePressed: false }
    case 'p2-cursor-to-approve':  return { trustLevel: 'supervised', run1: 'expanded', run2: 'hidden',    run3: 'hidden',  cursor: 'hover-approve', approvePressed: false }
    case 'p3-approve-click':      return { trustLevel: 'supervised', run1: 'expanded', run2: 'hidden',    run3: 'hidden',  cursor: 'press-approve', approvePressed: true  }
    case 'p4-run1-done-tick':     return { trustLevel: 'assisted',   run1: 'done',     run2: 'hidden',    run3: 'hidden',  cursor: 'hidden',        approvePressed: false }
    case 'p5-run2-arrive':        return { trustLevel: 'assisted',   run1: 'done',     run2: 'countdown', run3: 'hidden',  cursor: 'hidden',        approvePressed: false }
    case 'p6-run2-rule-hold':     return { trustLevel: 'assisted',   run1: 'done',     run2: 'countdown', run3: 'hidden',  cursor: 'hidden',        approvePressed: false }
    case 'p7-run2-done-tick':     return { trustLevel: 'autonomous', run1: 'done',     run2: 'done',      run3: 'hidden',  cursor: 'hidden',        approvePressed: false }
    case 'p8-run3-arrive':        return { trustLevel: 'autonomous', run1: 'done',     run2: 'done',      run3: 'visible', cursor: 'hidden',        approvePressed: false }
    case 'p9-final-hold':         return { trustLevel: 'autonomous', run1: 'done',     run2: 'done',      run3: 'visible', cursor: 'hidden',        approvePressed: false }
    case 'p10-outro':             return { trustLevel: 'autonomous', run1: 'done',     run2: 'done',      run3: 'visible', cursor: 'hidden',        approvePressed: false }
  }
}

// Cursor target positions in stage-local px. Stage is 500×600 with 20px
// padding; layout puts Run 1's Approve button at ~(84, 230) when the card
// is expanded. Verify visually if layout drifts.
export const CURSOR_POSITIONS: Record<CursorPhase, { x: number; y: number }> = {
  hidden:           { x: 440, y: 30  },
  idle:             { x: 440, y: 30  },
  'hover-approve':  { x: 84,  y: 230 },
  'press-approve':  { x: 84,  y: 230 },
}
