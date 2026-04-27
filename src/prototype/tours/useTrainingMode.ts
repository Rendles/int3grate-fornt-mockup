import { useContext } from 'react'
import { TrainingModeContext } from './training-context'

export function useTrainingMode() {
  const v = useContext(TrainingModeContext)
  if (!v) throw new Error('useTrainingMode must be used inside <TrainingModeProvider>')
  return v
}
