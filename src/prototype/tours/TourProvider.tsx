import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { TourContext } from './tour-context'
import type { TourContextValue } from './tour-context'
import type { Tour, ToursPersistedState } from './types'

const STORAGE_KEY = 'proto.tours.v1'

function readPersisted(): ToursPersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { completed: [] }
    const parsed = JSON.parse(raw) as ToursPersistedState
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      welcomePromptShown: parsed.welcomePromptShown === true ? true : undefined,
    }
  } catch {
    return { completed: [] }
  }
}

function writePersisted(state: ToursPersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage may be unavailable (private mode etc.) — silently ignore.
  }
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [activeTour, setActiveTour] = useState<Tour | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  // Persisted state held as React state (rather than a ref) so completion
  // and welcome-flag flips re-render subscribers (e.g. /learn cards picking
  // up "Completed" status, or WelcomeToast disappearing on dismiss).
  // `writePersisted` is called outside the updater to avoid Strict Mode
  // double-invocation — even if it ran twice, the write is idempotent.
  const [persisted, setPersisted] = useState<ToursPersistedState>(() => readPersisted())

  const markCompleted = useCallback((tourId: string) => {
    setPersisted(prev => {
      if (prev.completed.includes(tourId)) return prev
      const next = { ...prev, completed: [...prev.completed, tourId] }
      writePersisted(next)
      return next
    })
  }, [])

  const markWelcomePromptShown = useCallback(() => {
    setPersisted(prev => {
      if (prev.welcomePromptShown === true) return prev
      const next = { ...prev, welcomePromptShown: true }
      writePersisted(next)
      return next
    })
  }, [])

  const startTour = useCallback((tour: Tour) => {
    setActiveTour(tour)
    setStepIndex(0)
  }, [])

  const endTour = useCallback((mark = false) => {
    if (mark && activeTour) markCompleted(activeTour.id)
    setActiveTour(null)
    setStepIndex(0)
  }, [activeTour, markCompleted])

  // NOTE: do not call setState inside another setState updater — Strict Mode
  // double-invokes updaters in dev, which would queue the nested update twice
  // and cause the step to advance by 2 on each click.
  const next = useCallback(() => {
    if (!activeTour) return
    if (stepIndex >= activeTour.steps.length - 1) {
      markCompleted(activeTour.id)
      setActiveTour(null)
      setStepIndex(0)
    } else {
      setStepIndex(stepIndex + 1)
    }
  }, [activeTour, stepIndex, markCompleted])

  const prev = useCallback(() => {
    setStepIndex(idx => Math.max(0, idx - 1))
  }, [])

  const isCompleted = useCallback(
    (tourId: string) => persisted.completed.includes(tourId),
    [persisted],
  )

  // Lock body scroll while a tour is active so the spotlight stays anchored.
  useEffect(() => {
    if (!activeTour) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [activeTour])

  const welcomePromptShown = persisted.welcomePromptShown === true

  const value = useMemo<TourContextValue>(
    () => ({
      activeTour,
      stepIndex,
      startTour,
      endTour,
      next,
      prev,
      isCompleted,
      welcomePromptShown,
      markWelcomePromptShown,
    }),
    [activeTour, stepIndex, startTour, endTour, next, prev, isCompleted, welcomePromptShown, markWelcomePromptShown],
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}
