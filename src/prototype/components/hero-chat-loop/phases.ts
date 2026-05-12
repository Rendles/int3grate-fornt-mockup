// Phase table for the hero-chat-loop scripted scene.
//
// Phase 4 (creation beat added): 12 phases × 10s total. Two-view scene:
// picker (phases 0–2) → hire-transition (3) → chat (4–10) → outro (11).
//
// Adjust here only — every downstream consumer reads from this single
// source of truth.

export interface Phase {
  name: PhaseName
  duration: number
}

export type PhaseName =
  | 'idle'
  | 'cursor-to-template'
  | 'template-click'
  | 'hire-transition'
  | 'cursor-to-input'
  | 'typing'
  | 'cursor-to-send'
  | 'send-click'
  | 'thinking'
  | 'agent-responds'
  | 'action-cta'
  | 'outro'

// All durations bumped 20% (2026-05-13 user feedback) — total 12.0s loop.
export const PHASES: Phase[] = [
  { name: 'idle',               duration: 960 },
  { name: 'cursor-to-template', duration: 1200 },
  { name: 'template-click',     duration: 240 },
  { name: 'hire-transition',    duration: 840 },
  { name: 'cursor-to-input',    duration: 960 },
  { name: 'typing',             duration: 2400 },
  { name: 'cursor-to-send',     duration: 720 },
  { name: 'send-click',         duration: 240 },
  { name: 'thinking',           duration: 960 },
  { name: 'agent-responds',     duration: 1440 },
  { name: 'action-cta',         duration: 1320 },
  { name: 'outro',              duration: 720 },
]

export const TOTAL_LOOP_MS = PHASES.reduce((sum, p) => sum + p.duration, 0)
