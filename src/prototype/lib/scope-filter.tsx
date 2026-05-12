/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { useAuth } from '../auth'

// Global scope filter — single source of truth for what list screens
// (/agents, /activity, /approvals, /costs) currently show. Independent
// from activeWorkspaceId: switching active never touches filter and
// vice versa. See docs/plans/workspaces-redesign-spec.md § 2.
//
// Semantics:
//   filter === []           → "all workspaces" (union of memberships).
//                             Default for new sessions.
//   filter === [wsA, wsB]   → explicit subset.
//
// Persisted in localStorage["proto.scope.v1"] as { userId, filter }.
// The userId tag guards against demo-login leaks on the same device:
// when stored userId mismatches the current user we drop the value
// and start fresh.

const STORAGE_KEY = 'proto.scope.v1'

export const WORKSPACE_SEARCH_THRESHOLD = 10

interface ScopeFilterValue {
  filter: string[]
  setFilter: (next: string[]) => void
}

interface StoredScope {
  userId: string
  filter: string[]
}

const ScopeFilterCtx = createContext<ScopeFilterValue | null>(null)

function readStoredScope(): StoredScope | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredScope
    if (typeof parsed?.userId !== 'string') return null
    if (!Array.isArray(parsed?.filter)) return null
    if (!parsed.filter.every(id => typeof id === 'string')) return null
    return parsed
  } catch {
    return null
  }
}

function writeStoredScope(value: StoredScope): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function ScopeFilterProvider({ children }: { children: ReactNode }) {
  const { user, myWorkspaces } = useAuth()
  const userId = user?.id ?? null

  const [filter, setFilterState] = useState<string[]>(() => {
    if (!user) return []
    const stored = readStoredScope()
    if (stored && stored.userId === user.id) return stored.filter
    return []
  })

  // Re-hydrate when the authenticated user changes (login, logout, demo
  // account swap on the same browser). Mismatched userId in storage is
  // discarded — that's the whole point of the userId tag.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!user) {
      setFilterState([])
      return
    }
    const stored = readStoredScope()
    if (stored && stored.userId === user.id) {
      setFilterState(stored.filter)
    } else {
      setFilterState([])
      writeStoredScope({ userId: user.id, filter: [] })
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user])

  // Validate filter against the user's current memberships. Drop ids
  // the user no longer belongs to (workspace deleted, member removed).
  // Empty result stays empty — that's the valid "all workspaces" state.
  useEffect(() => {
    if (filter.length === 0) return
    const valid = new Set(myWorkspaces.map(w => w.id))
    const cleaned = filter.filter(id => valid.has(id))
    if (cleaned.length !== filter.length) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setFilterState(cleaned)
      if (userId) writeStoredScope({ userId, filter: cleaned })
    }
  }, [filter, myWorkspaces, userId])

  const setFilter = useCallback((next: string[]) => {
    setFilterState(next)
    if (userId) writeStoredScope({ userId, filter: next })
  }, [userId])

  const value = useMemo<ScopeFilterValue>(() => ({ filter, setFilter }), [filter, setFilter])

  return <ScopeFilterCtx.Provider value={value}>{children}</ScopeFilterCtx.Provider>
}

export function useScopeFilter(): ScopeFilterValue {
  const v = useContext(ScopeFilterCtx)
  if (!v) throw new Error('useScopeFilter outside ScopeFilterProvider')
  return v
}

// Show rule for the WorkspaceContextPill — display only when the
// current list view actually spans more than one workspace, otherwise
// the pill is just noise. See spec § 4.7.
export function shouldShowWorkspacePill(filter: string[], totalWorkspaces: number): boolean {
  if (filter.length === 0) return totalWorkspaces > 1
  return filter.length > 1
}
