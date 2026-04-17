/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from './lib/types'
import { api } from './lib/api'

interface AuthValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  switchRole: (userId: string) => Promise<void>
}

const AuthCtx = createContext<AuthValue | null>(null)
const STORAGE_KEY = 'proto.session.v1'

export function AuthProvider({ children }: { children: ReactNode }) {
  const hasStoredSession = () => {
    try { return !!localStorage.getItem(STORAGE_KEY) } catch { return false }
  }
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(() => hasStoredSession())

  useEffect(() => {
    let cancelled = false
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const { userId } = JSON.parse(raw) as { userId: string }
        api.me(userId)
          .then(u => { if (!cancelled) setUser(u) })
          .catch(() => {})
          .finally(() => { if (!cancelled) setLoading(false) })
      }
    } catch {
      /* no session */
    }
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.login(email, password)
    setUser(u)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId: u.id }))
    return u
  }, [])

  const switchRole = useCallback(async (userId: string) => {
    const u = await api.me(userId)
    setUser(u)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId: u.id }))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const value = useMemo<AuthValue>(() => ({ user, loading, login, logout, switchRole }), [user, loading, login, logout, switchRole])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx)
  if (!v) throw new Error('useAuth outside provider')
  return v
}
