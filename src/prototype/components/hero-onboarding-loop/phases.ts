// Phase table for the hero-onboarding-loop scripted scene.
//
// 12 phases × ~12s loop. Origin story: empty dashboard → cursor clicks
// "Hire your first agent" → KPI strip slides down from above + activity
// feed slides up from below + four agent cards drop into a 2×2 grid +
// KPIs climb (active 0→4, done 0→7, spend $0→$124) → full state holds →
// fades back to empty. Loop.
//
// Adjust here only — every downstream consumer reads from this single
// source of truth.

export interface Phase {
  name: PhaseName
  duration: number
}

export type PhaseName =
  | 'p0-empty-hold'
  | 'p1-cursor-arrive'
  | 'p2-cta-click'
  | 'p3-transition'
  | 'p4-card1-in'
  | 'p5-card2-in'
  | 'p6-card3-in'
  | 'p7-card4-in'
  | 'p8-activity-fill'
  | 'p9-tick-up'
  | 'p10-full-hold'
  | 'p11-outro'

export const PHASES: Phase[] = [
  { name: 'p0-empty-hold',     duration: 1400 },
  { name: 'p1-cursor-arrive',  duration: 1200 },
  { name: 'p2-cta-click',      duration: 400  },
  { name: 'p3-transition',     duration: 500  },
  { name: 'p4-card1-in',       duration: 800  },
  { name: 'p5-card2-in',       duration: 700  },
  { name: 'p6-card3-in',       duration: 900  },
  { name: 'p7-card4-in',       duration: 900  },
  { name: 'p8-activity-fill',  duration: 1100 },
  { name: 'p9-tick-up',        duration: 1200 },
  { name: 'p10-full-hold',     duration: 1900 },
  { name: 'p11-outro',         duration: 900  },
]

export const TOTAL_LOOP_MS = PHASES.reduce((sum, p) => sum + p.duration, 0)

export type CursorPhase = 'hidden' | 'idle' | 'hover-cta' | 'press-cta'

export interface KpiValues {
  active: number
  done: number
  spend: string
}

export interface ViewState {
  ctaVisible: boolean
  ctaPressed: boolean
  kpiVisible: boolean
  gridVisible: boolean
  activityVisible: boolean
  agentsVisible: number   // 0..4
  activityRows: number    // 0..4
  kpi: KpiValues
  cursor: CursorPhase
}

const KPI_EMPTY: KpiValues = { active: 0, done: 0, spend: '$0' }

export function viewForPhase(name: PhaseName): ViewState {
  switch (name) {
    case 'p0-empty-hold':
      return { ctaVisible: true,  ctaPressed: false, kpiVisible: false, gridVisible: false, activityVisible: false, agentsVisible: 0, activityRows: 0, kpi: KPI_EMPTY,                              cursor: 'idle' }
    case 'p1-cursor-arrive':
      return { ctaVisible: true,  ctaPressed: false, kpiVisible: false, gridVisible: false, activityVisible: false, agentsVisible: 0, activityRows: 0, kpi: KPI_EMPTY,                              cursor: 'hover-cta' }
    case 'p2-cta-click':
      return { ctaVisible: true,  ctaPressed: true,  kpiVisible: false, gridVisible: false, activityVisible: false, agentsVisible: 0, activityRows: 0, kpi: KPI_EMPTY,                              cursor: 'press-cta' }
    case 'p3-transition':
      return { ctaVisible: false, ctaPressed: false, kpiVisible: true,  gridVisible: true,  activityVisible: true,  agentsVisible: 0, activityRows: 0, kpi: KPI_EMPTY,                              cursor: 'hidden' }
    case 'p4-card1-in':
      return { ctaVisible: false, ctaPressed: false, kpiVisible: true,  gridVisible: true,  activityVisible: true,  agentsVisible: 1, activityRows: 0, kpi: { active: 1, done: 0, spend: '$0'   }, cursor: 'hidden' }
    case 'p5-card2-in':
      return { ctaVisible: false, ctaPressed: false, kpiVisible: true,  gridVisible: true,  activityVisible: true,  agentsVisible: 2, activityRows: 0, kpi: { active: 2, done: 0, spend: '$0'   }, cursor: 'hidden' }
    case 'p6-card3-in':
      return { ctaVisible: false, ctaPressed: false, kpiVisible: true,  gridVisible: true,  activityVisible: true,  agentsVisible: 3, activityRows: 1, kpi: { active: 3, done: 1, spend: '$12'  }, cursor: 'hidden' }
    case 'p7-card4-in':
      return { ctaVisible: false, ctaPressed: false, kpiVisible: true,  gridVisible: true,  activityVisible: true,  agentsVisible: 4, activityRows: 2, kpi: { active: 4, done: 2, spend: '$34'  }, cursor: 'hidden' }
    case 'p8-activity-fill':
      return { ctaVisible: false, ctaPressed: false, kpiVisible: true,  gridVisible: true,  activityVisible: true,  agentsVisible: 4, activityRows: 4, kpi: { active: 4, done: 4, spend: '$78'  }, cursor: 'hidden' }
    case 'p9-tick-up':
      return { ctaVisible: false, ctaPressed: false, kpiVisible: true,  gridVisible: true,  activityVisible: true,  agentsVisible: 4, activityRows: 4, kpi: { active: 4, done: 7, spend: '$124' }, cursor: 'hidden' }
    case 'p10-full-hold':
      return { ctaVisible: false, ctaPressed: false, kpiVisible: true,  gridVisible: true,  activityVisible: true,  agentsVisible: 4, activityRows: 4, kpi: { active: 4, done: 7, spend: '$124' }, cursor: 'hidden' }
    case 'p11-outro':
      // Transition back to empty: CTA fades in, KPI/grid/activity fade out.
      return { ctaVisible: true,  ctaPressed: false, kpiVisible: false, gridVisible: false, activityVisible: false, agentsVisible: 0, activityRows: 0, kpi: KPI_EMPTY,                              cursor: 'hidden' }
  }
}

// Cursor target positions in stage-local px. Stage is 500×600 with 20px
// padding. CTA button is centered in the main area; in empty mode main
// stretches because KPI/activity are collapsed, so CTA sits near vertical
// middle of stage.
export const CURSOR_POSITIONS: Record<CursorPhase, { x: number; y: number }> = {
  hidden:      { x: 440, y: 30  },
  idle:        { x: 440, y: 30  },
  'hover-cta': { x: 240, y: 290 },
  'press-cta': { x: 240, y: 290 },
}
