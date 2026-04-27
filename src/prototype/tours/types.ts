import type { ReactNode } from 'react'

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TourStep {
  id: string
  target: string
  title: string
  body: ReactNode
  placement?: TourPlacement
  spotlightPadding?: number
  // Cross-screen support: when set, the engine navigates to this hash
  // route before resolving `target`. Tour data writes the literal path;
  // for dynamic routes (e.g. /approvals/:id) the tour resolves the id
  // at definition time from the scenario's seeded fixtures rather than
  // at runtime. Steps with `navigateTo` get a longer retry budget for
  // target resolution since the destination has to render first.
  navigateTo?: string
}

export interface Tour {
  id: string
  name: string
  steps: TourStep[]
}

export interface ToursPersistedState {
  completed: string[]
  // Whether the first-login welcome toast (pointing the user at /learn) has
  // already been shown and dismissed/clicked. Optional so that persisted
  // state from before this flag was added still parses cleanly — undefined
  // is treated as "not yet shown".
  welcomePromptShown?: boolean
}
