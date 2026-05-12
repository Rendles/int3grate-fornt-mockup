// Phase table for the hero-journey-loop scripted scene.
//
// 23 phases × ~20.9s loop. Walks through 6 product surfaces in order:
//   dashboard (idle → expand → approve → success → rotate)
//   → hire wizard (picker → click)
//   → chat (welcome → type → send → think → respond → cta)
//   → activity ticker
//   → dashboard (updated state)
//   → outro
//
// Adjust here only — every downstream consumer reads from this single
// source of truth.

export interface Phase {
  name: PhaseName
  duration: number
}

export type PhaseName =
  | 'idle'
  | 'cursor-to-pending-row'
  | 'expand-pending'
  | 'cursor-to-approve'
  | 'approve-click'
  | 'success'
  | 'post-approve'
  | 'hire-click'
  | 'wizard-enter'
  | 'cursor-to-template'
  | 'template-click'
  | 'hire-transition'
  | 'chat-welcome-dwell'
  | 'cursor-to-input'
  | 'typing'
  | 'cursor-to-send'
  | 'send-click'
  | 'thinking'
  | 'agent-responds'
  | 'drafts-cta'
  | 'activity-flash'
  | 'return-and-update'
  | 'outro'

export const PHASES: Phase[] = [
  { name: 'idle',                  duration: 1000 },
  { name: 'cursor-to-pending-row', duration: 1200 },
  { name: 'expand-pending',        duration: 1200 },
  { name: 'cursor-to-approve',     duration: 1200 },
  { name: 'approve-click',         duration: 240 },
  { name: 'success',               duration: 1200 },
  { name: 'post-approve',          duration: 1400 },
  { name: 'hire-click',            duration: 240 },
  { name: 'wizard-enter',          duration: 600 },
  { name: 'cursor-to-template',    duration: 1000 },
  { name: 'template-click',        duration: 240 },
  { name: 'hire-transition',       duration: 700 },
  { name: 'chat-welcome-dwell',    duration: 700 },
  { name: 'cursor-to-input',       duration: 800 },
  { name: 'typing',                duration: 1800 },
  { name: 'cursor-to-send',        duration: 600 },
  { name: 'send-click',            duration: 240 },
  { name: 'thinking',              duration: 800 },
  { name: 'agent-responds',        duration: 1200 },
  { name: 'drafts-cta',            duration: 1000 },
  { name: 'activity-flash',        duration: 1400 },
  { name: 'return-and-update',     duration: 1400 },
  { name: 'outro',                 duration: 600 },
]

export const TOTAL_LOOP_MS = PHASES.reduce((sum, p) => sum + p.duration, 0)
