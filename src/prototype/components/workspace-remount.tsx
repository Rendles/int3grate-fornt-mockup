import type { ReactNode } from 'react'

import { useAuth } from '../auth'

// Forces children to fully unmount + remount when the active workspace
// changes. Workspace filtering happens in the api layer (Step 3), but list
// screens cache results in component state — without a remount they keep
// showing the previous workspace's data until the user navigates away and
// back. Same trick used by DevModeRemount for dev-mode toggles.
//
// `display: contents` keeps the extra wrapper out of the layout tree.
export function WorkspaceRemount({ children }: { children: ReactNode }) {
  const { currentWorkspaceId } = useAuth()
  return (
    <div style={{ display: 'contents' }} key={currentWorkspaceId ?? '__none__'}>
      {children}
    </div>
  )
}
