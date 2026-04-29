/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from './lib/types'
import { api } from './lib/api'

interface AuthValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (input: { name: string; email: string; password: string; workspaceName: string }) => Promise<User>
  logout: () => void
}

const AuthCtx = createContext<AuthValue | null>(null)
const STORAGE_KEY = 'proto.session.v1'

interface StoredSession {
  // The real gateway returns an opaque JWT in LoginResponse.token. We persist
  // it and re-attach as the bearer credential on every request. `userId` is
  // also stored so legacy sessions (pre-token migration) keep working until
  // they expire naturally.
  token?: string
  userId?: string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const hasStoredSession = () => {
    try { return !!localStorage.getItem(STORAGE_KEY) } catch { return false }
  }
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(() => hasStoredSession())

  useEffect(() => {
    let cancelled = false
    // Wrap session-init in an async function so every code path (no-stored
    // session, missing credential, fetch success, fetch error) flows through
    // the same `finally` and only flips `loading` once. Synchronous
    // setLoading() calls inside an effect body trip react-hooks/set-state-in-effect.
    const init = async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const { token, userId } = JSON.parse(raw) as StoredSession
        // Prefer token (post-migration sessions); fall back to userId if a
        // legacy session is still in storage. Mock api.me accepts both.
        const credential = token ?? userId
        if (!credential) return
        const u = await api.me(credential).catch(() => null)
        if (!cancelled && u) setUser(u)
      } catch {
        /* no session */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    // Two-step per docs/gateway.yaml: POST /auth/login → LoginResponse, then
    // GET /me with the issued bearer to fetch the User profile.
    const { token } = await api.login(email, password)
    const u = await api.me(token)
    setUser(u)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, userId: u.id } satisfies StoredSession))
    return u
  }, [])

  const register = useCallback(async (input: { name: string; email: string; password: string; workspaceName: string }) => {
    // Registration is not in docs/gateway.yaml — kept as a mock-only flow.
    // We still persist a session so the user lands logged in.
    const u = await api.register(input)
    setUser(u)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId: u.id } satisfies StoredSession))
    return u
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const value = useMemo<AuthValue>(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx)
  if (!v) throw new Error('useAuth outside provider')
  return v
}
