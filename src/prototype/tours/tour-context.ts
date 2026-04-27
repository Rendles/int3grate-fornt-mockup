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
}

export const TourContext = createContext<TourContextValue | null>(null)
