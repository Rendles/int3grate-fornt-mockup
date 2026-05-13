// Phase table for the hero-overnight-loop scripted scene.
//
// 12 phases × ~1.0s each = ~12.5s loop. Time-compressed overnight: clock
// advances 6PM → 8AM. Activity rows fade in at the bottom of the ribbon
// as time advances; once the visible window saturates at 5 rows, oldest
// scrolls out the top. At sunrise the stage panel warms; at 8AM a
// "morning summary" card slides up into a pre-reserved bottom slot.
//
// Adjust here only — every downstream consumer reads from this single
// source of truth.

export interface Phase {
  name: PhaseName
  duration: number
}

export type PhaseName =
  | 'sunset-hold'
  | 'evening-1'
  | 'evening-2'
  | 'late-1'
  | 'midnight'
  | 'witching-1'
  | 'witching-2'
  | 'predawn'
  | 'sunrise'
  | 'morning-summary-enter'
  | 'morning-hold'
  | 'outro'

export const PHASES: Phase[] = [
  { name: 'sunset-hold',          duration: 1100 },
  { name: 'evening-1',            duration: 1000 },
  { name: 'evening-2',            duration: 1000 },
  { name: 'late-1',               duration: 1000 },
  { name: 'midnight',             duration: 1000 },
  { name: 'witching-1',           duration: 1100 },
  { name: 'witching-2',           duration: 1000 },
  { name: 'predawn',              duration: 1000 },
  { name: 'sunrise',              duration: 900 },
  { name: 'morning-summary-enter', duration: 1100 },
  { name: 'morning-hold',         duration: 1700 },
  { name: 'outro',                duration: 700 },
]

export const TOTAL_LOOP_MS = PHASES.reduce((sum, p) => sum + p.duration, 0)

export type Daypart = 'sunset' | 'night' | 'dawn' | 'morning'

export interface ViewState {
  clock: string
  daypart: Daypart
  /** -1 if ribbon is empty; else first visible index into SCENE_ACTIVITY */
  earliestIndex: number
  /** -1 if ribbon is empty; else last visible index into SCENE_ACTIVITY */
  latestIndex: number
  summaryVisible: boolean
}

// Visible window slides from [0..0] up to a saturated [3..7]. The earliest
// 3 rows scroll out as the latest 3 arrive — the ribbon feels alive without
// growing taller.
export function viewForPhase(name: PhaseName): ViewState {
  switch (name) {
    case 'sunset-hold':           return { clock: '6:00 PM',  daypart: 'sunset',  earliestIndex: -1, latestIndex: -1, summaryVisible: false }
    case 'evening-1':             return { clock: '8:43 PM',  daypart: 'night',   earliestIndex: 0,  latestIndex: 0,  summaryVisible: false }
    case 'evening-2':             return { clock: '9:12 PM',  daypart: 'night',   earliestIndex: 0,  latestIndex: 1,  summaryVisible: false }
    case 'late-1':                return { clock: '10:34 PM', daypart: 'night',   earliestIndex: 0,  latestIndex: 2,  summaryVisible: false }
    case 'midnight':              return { clock: '12:18 AM', daypart: 'night',   earliestIndex: 0,  latestIndex: 3,  summaryVisible: false }
    case 'witching-1':            return { clock: '2:05 AM',  daypart: 'night',   earliestIndex: 0,  latestIndex: 4,  summaryVisible: false }
    case 'witching-2':            return { clock: '3:40 AM',  daypart: 'night',   earliestIndex: 1,  latestIndex: 5,  summaryVisible: false }
    case 'predawn':               return { clock: '5:12 AM',  daypart: 'night',   earliestIndex: 2,  latestIndex: 6,  summaryVisible: false }
    case 'sunrise':               return { clock: '6:55 AM',  daypart: 'dawn',    earliestIndex: 3,  latestIndex: 7,  summaryVisible: false }
    case 'morning-summary-enter': return { clock: '7:30 AM',  daypart: 'morning', earliestIndex: 3,  latestIndex: 7,  summaryVisible: true  }
    case 'morning-hold':          return { clock: '8:00 AM',  daypart: 'morning', earliestIndex: 3,  latestIndex: 7,  summaryVisible: true  }
    case 'outro':                 return { clock: '8:00 AM',  daypart: 'morning', earliestIndex: 3,  latestIndex: 7,  summaryVisible: true  }
  }
}

export type RowState = 'hidden' | 'visible' | 'gone'

export function rowStateAt(index: number, view: ViewState): RowState {
  if (view.earliestIndex === -1) return 'hidden'
  if (index < view.earliestIndex) return 'gone'
  if (index > view.latestIndex) return 'hidden'
  return 'visible'
}
