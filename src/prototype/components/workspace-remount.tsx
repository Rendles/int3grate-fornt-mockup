import type { ReactNode } from 'react'

import { useAuth } from '../auth'

// Forces children to fully unmount + remount when the active workspace
// changes. Workspace filtering happens in the api layer, but list screens
// cache results in component state — without a remount they keep showing
// the previous workspace's data until the user navigates away and back.
// Same trick used by DevModeRemount for dev-mode toggles.
//
// Single-active model: we key on activeWorkspaceId. The global scope
// filter (lib/scope-filter.tsx) lives ABOVE this remount in the tree —
// it deliberately survives the unmount, so switching active workspace
// does not reset what list screens are showing. See docs/plans/
// workspaces-redesign-spec.md § 2.3 + § 10.3 for the rationale (active
// and filter are independent slices of state).
//
// `display: contents` keeps the extra wrapper out of the layout tree.
export function WorkspaceRemount({ children }: { children: ReactNode }) {
  const { activeWorkspaceId } = useAuth()
  return (
    <div style={{ display: 'contents' }} key={activeWorkspaceId ?? '__none__'}>
      {children}
    </div>
  )
}
