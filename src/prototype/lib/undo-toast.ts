// Shared types + helpers for the undo-toast UX. The component itself lives
// in `components/undo-toast.tsx` — split here so the toast can be triggered
// from screens (or from non-component modules in the future) without React
// Fast Refresh complaining about mixed exports.

export interface UndoToast {
  id: string
  approvalId: string
  decision: 'approved' | 'rejected'
  agentName: string
  actionVerb: string
  expiresAt: number
}

export function makeToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function nowMs(): number {
  return Date.now()
}
