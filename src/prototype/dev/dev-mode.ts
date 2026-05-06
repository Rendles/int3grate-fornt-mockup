// Dev-mode state — flips every read endpoint into a synthetic state
// (empty list / hung promise / forced error) so we can inspect the
// matching screen state without touching fixtures. Module-level mutable
// is read by lib/api.ts; the React context provider in
// `./DevModeProvider.tsx` drives its updates.
//
// Session-only: state is NOT persisted. Page refresh resets to 'real'.

import { createContext, useContext } from 'react'

export type DevMode = 'real' | 'empty' | 'loading' | 'error'

let _mode: DevMode = 'real'

// Read by lib/api.ts at the top of every read method. Stays at 'real'
// until DevModeProvider mounts and the user picks something else.
export function getDevMode(): DevMode {
  return _mode
}

export function _setDevMode(m: DevMode): void {
  _mode = m
}

export interface DevModeValue {
  mode: DevMode
  setMode: (m: DevMode) => void
}

export const DevModeContext = createContext<DevModeValue>({
  mode: 'real',
  setMode: () => {},
})

export function useDevMode(): DevModeValue {
  return useContext(DevModeContext)
}
