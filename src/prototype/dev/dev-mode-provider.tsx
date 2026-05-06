// Provider for the dev-mode toggle. State and helpers live in
// `./dev-mode.ts`; this file is component-only so Fast Refresh works.

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { DevModeContext, _setDevMode, useDevMode } from './dev-mode'
import type { DevMode } from './dev-mode'

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DevMode>('real')
  useEffect(() => { _setDevMode(mode) }, [mode])
  return (
    <DevModeContext.Provider value={{ mode, setMode }}>
      {children}
    </DevModeContext.Provider>
  )
}

// Forces children to fully unmount + remount when dev-mode changes.
// Without this, screens keep their already-fetched data on screen — the
// override only affects the *next* api call. Wrap whatever subtree should
// re-fetch on a mode change with this. `display: contents` keeps the
// extra wrapper out of the layout tree.
export function DevModeRemount({ children }: { children: ReactNode }) {
  const { mode } = useDevMode()
  return (
    <div style={{ display: 'contents' }} key={mode}>
      {children}
    </div>
  )
}
