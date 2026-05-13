// Phase table for the hero-roster-loop scripted scene.
//
// 12 phases × ~1.0s each = ~12.5s loop. Unlike the other three hero loops,
// there is no single cursor focal point — the viewer is the observer
// watching their digital team. Each phase mutates ONE agent's state; the
// other three keep their previous state (and their CSS-driven micro-
// animations — progress shimmer, pulse dot — continue running).
//
// Initial frame (p0) deliberately shows ONE OF EACH state simultaneously
// (working / needs-you / done / idle), so the parallelism reads at a glance
// before any phase transition fires.
//
// Adjust here only — every downstream consumer reads from this single
// source of truth.

import type { AgentId, AgentState } from './scene-data'

export interface Phase {
  name: PhaseName
  duration: number
}

export type PhaseName =
  | 'p0-idle'
  | 'p1-ks-start'
  | 'p2-rr-done'
  | 'p3-lq-pending'
  | 'p4-ap-idle'
  | 'p5-ks-pending'
  | 'p6-lq-done'
  | 'p7-ap-start'
  | 'p8-ks-done'
  | 'p9-rr-start'
  | 'p10-lq-idle'
  | 'p11-outro'

export const PHASES: Phase[] = [
  { name: 'p0-idle',        duration: 1200 },
  { name: 'p1-ks-start',    duration: 1000 },
  { name: 'p2-rr-done',     duration: 1100 },
  { name: 'p3-lq-pending',  duration: 1100 },
  { name: 'p4-ap-idle',     duration: 1000 },
  { name: 'p5-ks-pending',  duration: 1100 },
  { name: 'p6-lq-done',     duration: 1100 },
  { name: 'p7-ap-start',    duration: 1000 },
  { name: 'p8-ks-done',     duration: 1100 },
  { name: 'p9-rr-start',    duration: 1000 },
  { name: 'p10-lq-idle',    duration: 1000 },
  { name: 'p11-outro',      duration: 800 },
]

export const TOTAL_LOOP_MS = PHASES.reduce((sum, p) => sum + p.duration, 0)

// Each phase declares the full {lq, rr, ap, ks} state vector. Explicit
// switch beats incremental mutation — at a glance you can see what each
// agent is doing at each phase, and there's no order-dependence between
// phases (a re-render mid-loop produces the right frame).
//
// Pending-count rhythm over the loop (count of 'needs-you'):
//   p0:1 → p1:1 → p2:0 → p3:1 → p4:1 → p5:2 → p6:1 → p7:1 → p8:0 → p9:0 → p10:0 → p11:0
// → drama in the first half, calm in the second; loop-reset re-introduces
// the orange pill, giving the viewer a fresh hook on every cycle.
export function statesForPhase(name: PhaseName): Record<AgentId, AgentState> {
  switch (name) {
    case 'p0-idle':       return { lq: 'working',   rr: 'needs-you', ap: 'done',    ks: 'idle'      }
    case 'p1-ks-start':   return { lq: 'working',   rr: 'needs-you', ap: 'done',    ks: 'working'   }
    case 'p2-rr-done':    return { lq: 'working',   rr: 'done',      ap: 'done',    ks: 'working'   }
    case 'p3-lq-pending': return { lq: 'needs-you', rr: 'done',      ap: 'done',    ks: 'working'   }
    case 'p4-ap-idle':    return { lq: 'needs-you', rr: 'done',      ap: 'idle',    ks: 'working'   }
    case 'p5-ks-pending': return { lq: 'needs-you', rr: 'done',      ap: 'idle',    ks: 'needs-you' }
    case 'p6-lq-done':    return { lq: 'done',      rr: 'done',      ap: 'idle',    ks: 'needs-you' }
    case 'p7-ap-start':   return { lq: 'done',      rr: 'done',      ap: 'working', ks: 'needs-you' }
    case 'p8-ks-done':    return { lq: 'done',      rr: 'done',      ap: 'working', ks: 'done'      }
    case 'p9-rr-start':   return { lq: 'done',      rr: 'working',   ap: 'working', ks: 'done'      }
    case 'p10-lq-idle':   return { lq: 'idle',      rr: 'working',   ap: 'working', ks: 'done'      }
    case 'p11-outro':     return { lq: 'idle',      rr: 'working',   ap: 'working', ks: 'done'      }
  }
}
