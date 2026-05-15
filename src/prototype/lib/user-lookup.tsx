/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { useAuth } from '../auth'
import { useTrainingMode } from '../tours/useTrainingMode'
import { api } from './api'
import type { User } from './types'

// User-lookup context. Single fetch of `GET /users` on auth, cached as a Map.
// All UI surfaces that need to render a user's display name from a `user_id`
// (e.g. approval.requested_by) read through `useUser(userId)`.
//
// Member role is intentionally NOT loaded — backend gates /users to
// admin / domain_admin only. For members the Map stays empty and the hook
// returns undefined for any ID; callers degrade to copy without a name.
//
// Re-fetch triggers: user.id change (login/logout) and training scenario
// switch (scenarios may seed their own user list via tour fixtures).

const UserLookupContext = createContext<Map<string, User>>(new Map())

export function UserLookupProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { scenarioId } = useTrainingMode()
  const [users, setUsers] = useState<Map<string, User>>(new Map())

  useEffect(() => {
    let cancelled = false
    if (!user || user.role === 'member') {
      // Defer to a microtask so setState doesn't run synchronously inside
      // the effect body (react-hooks/set-state-in-effect).
      queueMicrotask(() => { if (!cancelled) setUsers(new Map()) })
      return () => { cancelled = true }
    }
    api.listUsers({ limit: 500 })
      .then(({ items }) => {
        if (!cancelled) setUsers(new Map(items.map(u => [u.id, u])))
      })
      .catch(() => {
        // 403 / network / dev-mode error — degrade to empty map; callers
        // already handle missing names with copy fallbacks.
        if (!cancelled) setUsers(new Map())
      })
    return () => { cancelled = true }
  }, [user, scenarioId])

  return (
    <UserLookupContext.Provider value={users}>
      {children}
    </UserLookupContext.Provider>
  )
}

export function useUser(userId: string | null | undefined): User | undefined {
  const users = useContext(UserLookupContext)
  if (!userId) return undefined
  return users.get(userId)
}

// Use when you need to resolve multiple user IDs (e.g. inside a .map()
// where calling `useUser` per row would violate the rules of hooks).
export function useUsers(): Map<string, User> {
  return useContext(UserLookupContext)
}
