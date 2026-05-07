/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, Workspace } from './lib/types'
import { api } from './lib/api'
import { setCurrentWorkspaceId } from './lib/workspace-context'

interface AuthValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (input: { name: string; email: string; password: string; workspaceName: string }) => Promise<User>
  logout: () => void
  // ── Workspace state (mock-only — see docs/agent-plans/
  // 2026-05-06-2200-workspaces-mock.md). Available once a user is
  // authenticated. Defaults to the first membership; switchWorkspace
  // mutates session storage + the workspace-context singleton so
  // api.list* methods see the new scope on their next call.
  myWorkspaces: Workspace[]
  workspacesLoading: boolean
  currentWorkspaceId: string | null
  switchWorkspace: (id: string) => void
  refreshWorkspaces: () => Promise<Workspace[]>
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
  // Selected workspace context. UI-only — backend has no workspace endpoints
  // yet. Persisted so switching survives page reloads.
  currentWorkspaceId?: string
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredSession
  } catch {
    return null
  }
}

function writeStoredSession(patch: Partial<StoredSession>): void {
  const current = readStoredSession() ?? {}
  const next: StoredSession = { ...current, ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const hasStoredSession = () => {
    try { return !!localStorage.getItem(STORAGE_KEY) } catch { return false }
  }
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(() => hasStoredSession())
  const [myWorkspaces, setMyWorkspaces] = useState<Workspace[]>([])
  const [workspacesLoading, setWorkspacesLoading] = useState<boolean>(false)
  const [currentWorkspaceId, setCurrentWorkspaceIdState] = useState<string | null>(null)

  // Pick the active workspace from the available list. Prefers the stored
  // selection if it's still a valid membership; otherwise falls back to the
  // first workspace; otherwise null. Always writes to storage and the
  // workspace-context singleton so api.list* methods observe the change.
  const applyCurrentWorkspace = useCallback((available: Workspace[], storedId: string | undefined) => {
    let nextId: string | null = null
    if (storedId && available.some(w => w.id === storedId)) {
      nextId = storedId
    } else if (available.length > 0) {
      nextId = available[0].id
    }
    setCurrentWorkspaceIdState(nextId)
    setCurrentWorkspaceId(nextId)
    writeStoredSession({ currentWorkspaceId: nextId ?? undefined })
  }, [])

  const refreshWorkspaces = useCallback(async (): Promise<Workspace[]> => {
    if (!user) {
      setMyWorkspaces([])
      applyCurrentWorkspace([], undefined)
      return []
    }
    setWorkspacesLoading(true)
    try {
      const list = await api.listWorkspaces(user.id)
      setMyWorkspaces(list.items)
      const stored = readStoredSession()
      applyCurrentWorkspace(list.items, stored?.currentWorkspaceId)
      return list.items
    } finally {
      setWorkspacesLoading(false)
    }
  }, [user, applyCurrentWorkspace])

  useEffect(() => {
    let cancelled = false
    // Wrap session-init in an async function so every code path (no-stored
    // session, missing credential, fetch success, fetch error) flows through
    // the same `finally` and only flips `loading` once. Synchronous
    // setLoading() calls inside an effect body trip react-hooks/set-state-in-effect.
    const init = async () => {
      try {
        const stored = readStoredSession()
        if (!stored) return
        const { token, userId } = stored
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

  // Whenever the authenticated user changes, refresh the workspace list.
  // Covers session-restore, login, register, and logout (sets to null).
  // The synchronous clear-on-logout branch trips set-state-in-effect; same
  // workaround used in retrain-dialog.tsx — this is a "snapshot user → state"
  // pattern, no cleaner expression in current React.
  useEffect(() => {
    if (!user) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setMyWorkspaces([])
      setCurrentWorkspaceIdState(null)
      setCurrentWorkspaceId(null)
      /* eslint-enable react-hooks/set-state-in-effect */
      return
    }
    let cancelled = false
    setWorkspacesLoading(true)
    api.listWorkspaces(user.id)
      .then(list => {
        if (cancelled) return
        setMyWorkspaces(list.items)
        const stored = readStoredSession()
        applyCurrentWorkspace(list.items, stored?.currentWorkspaceId)
      })
      .finally(() => {
        if (!cancelled) setWorkspacesLoading(false)
      })
    return () => { cancelled = true }
  }, [user, applyCurrentWorkspace])

  const login = useCallback(async (email: string, password: string) => {
    // Two-step per docs/gateway.yaml: POST /auth/login → LoginResponse, then
    // GET /me with the issued bearer to fetch the User profile.
    const { token } = await api.login(email, password)
    const u = await api.me(token)
    setUser(u)
    writeStoredSession({ token, userId: u.id })
    return u
  }, [])

  const register = useCallback(async (input: { name: string; email: string; password: string; workspaceName: string }) => {
    // Registration is not in docs/gateway.yaml — kept as a mock-only flow.
    // We still persist a session so the user lands logged in.
    const u = await api.register(input)
    setUser(u)
    writeStoredSession({ userId: u.id, token: undefined })
    return u
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setMyWorkspaces([])
    setCurrentWorkspaceIdState(null)
    setCurrentWorkspaceId(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const switchWorkspace = useCallback((id: string) => {
    if (!myWorkspaces.some(w => w.id === id)) return
    setCurrentWorkspaceIdState(id)
    setCurrentWorkspaceId(id)
    writeStoredSession({ currentWorkspaceId: id })
  }, [myWorkspaces])

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    login,
    register,
    logout,
    myWorkspaces,
    workspacesLoading,
    currentWorkspaceId,
    switchWorkspace,
    refreshWorkspaces,
  }), [user, loading, login, register, logout, myWorkspaces, workspacesLoading, currentWorkspaceId, switchWorkspace, refreshWorkspaces])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx)
  if (!v) throw new Error('useAuth outside provider')
  return v
}
