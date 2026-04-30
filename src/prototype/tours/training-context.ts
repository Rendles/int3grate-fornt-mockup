import { createContext } from 'react'

/**
 * Training-mode context. While `active`, the API layer (lib/api.ts) is asked
 * to back its reads from the named scenario's fixture set instead of the
 * real fixture arrays — see docs/plans/tours.md "Training mode" section.
 *
 * Reading hook: `useTrainingMode` (in ./useTrainingMode).
 */
export interface TrainingModeValue {
  active: boolean
  scenarioId: string | null
  enter: (scenarioId: string) => void
  exit: () => void
}

export const TrainingModeContext = createContext<TrainingModeValue | null>(null)
