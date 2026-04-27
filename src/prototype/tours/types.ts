import type { ReactNode } from 'react'

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TourStep {
  id: string
  target: string
  title: string
  body: ReactNode
  placement?: TourPlacement
  spotlightPadding?: number
}

export interface Tour {
  id: string
  name: string
  steps: TourStep[]
}

export interface ToursPersistedState {
  completed: string[]
}
