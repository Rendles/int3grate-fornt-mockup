// Module-level holders for workspace context. Written by AuthProvider on
// session restore / login / switch / logout; read by api.list* methods to
// scope returned data. Mirrors how the current mock api treats the bearer
// token implicitly — no per-call workspace_id parameter, just a module
// singleton.
//
// Two pieces:
//
//   1. activeWorkspaceId — the user's CURRENT workspace ("where I'm
//      working today"). Drives hire / create flows, default home, and the
//      WorkspaceRemount keying. Single id.
//
//   2. allUserWorkspaceIds — every workspace the user is a member of.
//      Used by api list methods as the "no filter" fallback so an
//      unscoped call (e.g. the sidebar approval badge) sees the full
//      visible scope without each caller threading the membership list.
//
// When the real backend lands, both get dropped — bearer-scoped queries
// + a per-call workspace_id[] parameter take over.

let activeWorkspaceId: string | null = null
let allUserWorkspaceIds: string[] = []

export function getActiveWorkspaceId(): string | null {
  return activeWorkspaceId
}

export function setActiveWorkspaceId(id: string | null): void {
  activeWorkspaceId = id
}

export function getAllUserWorkspaceIds(): string[] {
  return allUserWorkspaceIds
}

export function setAllUserWorkspaceIds(ids: string[]): void {
  // Defensive copy.
  allUserWorkspaceIds = ids.slice()
}
