// Module-level holder for the active workspace id. Written by AuthProvider
// on session restore / login / switch / logout; read by api.list* methods
// to scope returned data (Step 3 of docs/agent-plans/2026-05-06-2200-
// workspaces-mock.md). Mirrors how the current mock api treats the bearer
// token implicitly — no per-call workspace_id parameter, just a module
// singleton.
//
// When the real backend lands workspace endpoints, this module gets dropped
// and the `X-Workspace-Id` header (or whatever the spec settles on) is set
// on the http client by the auth layer instead.

let currentWorkspaceId: string | null = null

export function getCurrentWorkspaceId(): string | null {
  return currentWorkspaceId
}

export function setCurrentWorkspaceId(id: string | null): void {
  currentWorkspaceId = id
}
