import { createContext } from 'react'
import type { Tour } from './types'

export interface TourContextValue {
  activeTour: Tour | null
  stepIndex: number
  startTour: (tour: Tour) => void
  endTour: (markCompleted?: boolean) => void
  next: () => void
  prev: () => void
  isCompleted: (tourId: string) => boolean
  // First-login welcome toast state. `welcomePromptShown` is reactive so
  // dismissing the toast in one place removes it everywhere.
  welcomePromptShown: boolean
  markWelcomePromptShown: () => void
}

export const TourContext = createContext<TourContextValue | null>(null)
