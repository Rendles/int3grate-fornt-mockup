/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, Workspace } from './lib/types'
import { api } from './lib/api'
import {
  setActiveWorkspaceId,
  setAllUserWorkspaceIds,
} from './lib/workspace-context'

interface AuthValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (input: { name: string; email: string; password: string; workspaceName: string }) => Promise<User>
  logout: () => void
  // ── Workspace state. The user has ONE active workspace (single-active
  // model) plus a list of all memberships. Each list page has its own
  // page-level filter that defaults to the active workspace but can be
  // broadened. See docs/agent-plans/2026-05-08-0030-page-filters-vs-
  // global-scope.md for the rationale.
  myWorkspaces: Workspace[]
  workspacesLoading: boolean
  activeWorkspaceId: string | null
  setActiveWorkspace: (id: string) => void
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
  // Active workspace id. UI-only — backend has no workspace endpoints yet.
  // Persisted so the choice survives page reloads.
  activeWorkspaceId?: string
  // Legacy fields, kept readable for migration only. We don't write them
  // anymore; readStoredSession promotes them into activeWorkspaceId on read.
  selectedWorkspaceIds?: string[]
  currentWorkspaceId?: string
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    // One-time migration. Two prior shapes can appear in legacy storage:
    //   - `selectedWorkspaceIds: string[]` (the multi-scope iteration);
    //     take the first id as the new active.
    //   - `currentWorkspaceId: string` (the original single-id field).
    if (!parsed.activeWorkspaceId) {
      if (parsed.selectedWorkspaceIds && parsed.selectedWorkspaceIds.length > 0) {
        parsed.activeWorkspaceId = parsed.selectedWorkspaceIds[0]
      } else if (parsed.currentWorkspaceId) {
        parsed.activeWorkspaceId = parsed.currentWorkspaceId
      }
    }
    delete parsed.selectedWorkspaceIds
    delete parsed.currentWorkspaceId
    return parsed
  } catch {
    return null
  }
}

function writeStoredSession(patch: Partial<StoredSession>): void {
  const current = readStoredSession() ?? {}
  const next: StoredSession = { ...current, ...patch }
  delete next.selectedWorkspaceIds
  delete next.currentWorkspaceId
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
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null)
  // Per-session guard against duplicate auto-creates. We bootstrap a
  // "Main" workspace when GET /workspaces returns an empty list (first
  // login of a brand-new user — see docs/plans/workspaces-redesign-
  // spec.md § 6). The ref makes the bootstrap happen at most once per
  // authenticated user, even if the workspace effect re-runs.
  const autoCreatedForUserRef = useRef<string | null>(null)

  // Pick the active workspace from the available memberships:
  //   1. Stored id, if it's still a valid membership.
  //   2. Otherwise the first available workspace.
  //   3. Otherwise null.
  // Always writes through to storage and BOTH workspace-context singletons
  // (active id + full membership list) so api.list* methods observe the
  // change on their next call.
  const applyActiveWorkspace = useCallback((available: Workspace[], storedId: string | undefined) => {
    let nextId: string | null = null
    if (storedId && available.some(w => w.id === storedId)) {
      nextId = storedId
    } else if (available.length > 0) {
      nextId = available[0].id
    }
    setActiveWorkspaceIdState(nextId)
    setActiveWorkspaceId(nextId)
    setAllUserWorkspaceIds(available.map(w => w.id))
    writeStoredSession({ activeWorkspaceId: nextId ?? undefined })
  }, [])

  const refreshWorkspaces = useCallback(async (): Promise<Workspace[]> => {
    if (!user) {
      setMyWorkspaces([])
      applyActiveWorkspace([], undefined)
      return []
    }
    setWorkspacesLoading(true)
    try {
      const list = await api.listWorkspaces(user.id)
      setMyWorkspaces(list.items)
      const stored = readStoredSession()
      applyActiveWorkspace(list.items, stored?.activeWorkspaceId)
      return list.items
    } finally {
      setWorkspacesLoading(false)
    }
  }, [user, applyActiveWorkspace])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const stored = readStoredSession()
        if (!stored) return
        const { token, userId } = stored
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
  // First-login bootstrap: if a freshly-authenticated user has zero
  // memberships we auto-create a default "Main" workspace so they never
  // land in a useless empty state. Guarded by autoCreatedForUserRef so
  // we don't loop if the effect re-runs.
  useEffect(() => {
    if (!user) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setMyWorkspaces([])
      setActiveWorkspaceIdState(null)
      setActiveWorkspaceId(null)
      setAllUserWorkspaceIds([])
      /* eslint-enable react-hooks/set-state-in-effect */
      autoCreatedForUserRef.current = null
      return
    }
    let cancelled = false
    setWorkspacesLoading(true)
    const userId = user.id
    const run = async () => {
      try {
        let list = await api.listWorkspaces(userId)
        if (cancelled) return
        if (list.items.length === 0 && autoCreatedForUserRef.current !== userId) {
          autoCreatedForUserRef.current = userId
          try {
            await api.createWorkspace({ name: 'Main' }, userId)
            list = await api.listWorkspaces(userId)
          } catch {
            // Auto-create is best-effort. If it fails the user lands on
            // the empty workspace state and can create one manually via
            // the switcher — same recovery path as before.
          }
          if (cancelled) return
        }
        setMyWorkspaces(list.items)
        const stored = readStoredSession()
        applyActiveWorkspace(list.items, stored?.activeWorkspaceId)
      } finally {
        if (!cancelled) setWorkspacesLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [user, applyActiveWorkspace])

  const login = useCallback(async (email: string, password: string) => {
    const { token } = await api.login(email, password)
    const u = await api.me(token)
    setUser(u)
    writeStoredSession({ token, userId: u.id })
    return u
  }, [])

  const register = useCallback(async (input: { name: string; email: string; password: string; workspaceName: string }) => {
    const u = await api.register(input)
    setUser(u)
    writeStoredSession({ userId: u.id, token: undefined })
    return u
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setMyWorkspaces([])
    setActiveWorkspaceIdState(null)
    setActiveWorkspaceId(null)
    setAllUserWorkspaceIds([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const setActiveWorkspace = useCallback((id: string) => {
    if (!myWorkspaces.some(w => w.id === id)) return
    setActiveWorkspaceIdState(id)
    setActiveWorkspaceId(id)
    writeStoredSession({ activeWorkspaceId: id })
  }, [myWorkspaces])

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    login,
    register,
    logout,
    myWorkspaces,
    workspacesLoading,
    activeWorkspaceId,
    setActiveWorkspace,
    refreshWorkspaces,
  }), [
    user, loading, login, register, logout,
    myWorkspaces, workspacesLoading,
    activeWorkspaceId, setActiveWorkspace, refreshWorkspaces,
  ])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx)
  if (!v) throw new Error('useAuth outside provider')
  return v
}
