import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { TrainingModeContext } from './training-context'
import type { TrainingModeValue } from './training-context'
import { __setTrainingMode } from '../lib/api'

// Auto-exit if the user wandered off mid-tour. The 15 min figure is a
// starting guess; revisit once real tours are in use (see TOURS_PLAN.md
// "Open questions").
const IDLE_TIMEOUT_MS = 15 * 60 * 1000

export function TrainingModeProvider({ children }: { children: ReactNode }) {
  const [scenarioId, setScenarioId] = useState<string | null>(null)
  // Single timer slot; restarted on every enter() and cleared on exit().
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const exit = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    setScenarioId(null)
    __setTrainingMode(null)
  }, [])

  const enter = useCallback((id: string) => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    setScenarioId(id)
    __setTrainingMode(id)
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null
      setScenarioId(null)
      __setTrainingMode(null)
    }, IDLE_TIMEOUT_MS)
  }, [])

  // Defensive: if the provider unmounts mid-tour (e.g. full app teardown
  // during HMR), drop the active scenario so the next mount doesn't
  // inherit stale module-level state.
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      __setTrainingMode(null)
    }
  }, [])

  const value = useMemo<TrainingModeValue>(
    () => ({
      active: scenarioId !== null,
      scenarioId,
      enter,
      exit,
    }),
    [scenarioId, enter, exit],
  )

  return <TrainingModeContext.Provider value={value}>{children}</TrainingModeContext.Provider>
}
