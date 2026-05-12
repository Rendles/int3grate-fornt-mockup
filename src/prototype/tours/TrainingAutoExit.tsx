import { useEffect, useRef } from 'react'
import { useTour } from './useTour'
import { useTrainingMode } from './useTrainingMode'
import { useRouter } from '../router'

/**
 * Bridges TourProvider → TrainingModeProvider and the router. When a tour
 * transitions from active to inactive (Done, Skip tour, Esc, or the engine
 * completes the last step) this:
 *
 *   1. Exits training mode if it was active for that tour. Without this,
 *      the orange banner would only end on a manual click of "Exit
 *      training" — the providers don't otherwise share any signal.
 *   2. Navigates to /learn so the user lands back on the hub where they
 *      started the tour, can see the now-Completed card, and can pick the
 *      next one. If they are already on /learn (sidebar tour case) it's a
 *      no-op redirect.
 *
 * Lives inside TourProvider so it can read both contexts.
 *
 * Renders nothing.
 */
export function TrainingAutoExit() {
  const { activeTour } = useTour()
  const { active, exit } = useTrainingMode()
  const { navigate } = useRouter()
  const wasActiveTourRef = useRef(false)

  useEffect(() => {
    if (activeTour) {
      wasActiveTourRef.current = true
      return
    }
    // Tour just ended (or was never active). Only act if we know it was
    // running a moment ago — so we don't redirect on first mount.
    if (wasActiveTourRef.current) {
      wasActiveTourRef.current = false
      if (active) exit()
      navigate('/learn')
    }
    // navigate is intentionally excluded — RouterProvider rebuilds its
    // memoised value on every hash change, including the navigate() we
    // just called. Including it would re-fire this effect after the
    // redirect and never let us settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTour, active, exit])

  return null
}
