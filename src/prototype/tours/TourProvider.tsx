import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Tour, ToursPersistedState } from './types'

const STORAGE_KEY = 'proto.tours.v1'

interface TourContextValue {
  activeTour: Tour | null
  stepIndex: number
  startTour: (tour: Tour) => void
  endTour: (markCompleted?: boolean) => void
  next: () => void
  prev: () => void
  isCompleted: (tourId: string) => boolean
}

const TourContext = createContext<TourContextValue | null>(null)

function readPersisted(): ToursPersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { completed: [] }
    const parsed = JSON.parse(raw) as ToursPersistedState
    return { completed: Array.isArray(parsed.completed) ? parsed.completed : [] }
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
  const persistedRef = useRef<ToursPersistedState>(readPersisted())

  const markCompleted = useCallback((tourId: string) => {
    const cur = persistedRef.current
    if (cur.completed.includes(tourId)) return
    const next: ToursPersistedState = { completed: [...cur.completed, tourId] }
    persistedRef.current = next
    writePersisted(next)
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

  const isCompleted = useCallback((tourId: string) => {
    return persistedRef.current.completed.includes(tourId)
  }, [])

  // Lock body scroll while a tour is active so the spotlight stays anchored.
  useEffect(() => {
    if (!activeTour) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [activeTour])

  const value = useMemo<TourContextValue>(
    () => ({ activeTour, stepIndex, startTour, endTour, next, prev, isCompleted }),
    [activeTour, stepIndex, startTour, endTour, next, prev, isCompleted],
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used inside <TourProvider>')
  return ctx
}
