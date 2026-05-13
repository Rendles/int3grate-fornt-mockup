// Hardcoded mini-fixtures for the hero-ladder-loop scene.
// Intentionally NOT importing from lib/fixtures.ts — this folder must be
// portable. When the scene is copied to the landing repo, only the files
// in this directory should travel with it.
//
// One agent (Refund Resolver) runs the same TASK TYPE three times across
// three days. Each run shows progressively less ceremony — the trust
// progression IS the visual story.

export type TrustLevel = 'supervised' | 'assisted' | 'autonomous'

export const SCENE_AGENT = {
  initials: 'RR',
  name: 'Refund Resolver',
  role: 'Support',
}

export interface RunCopy {
  label: string
  time: string
  headline: string
  context?: string
  ruleCaption?: string
  doneCaption: string
}

export const RUN1: RunCopy = {
  label: 'Run 1',
  time: 'Aug 14 · 9:02 AM',
  headline: 'Refund $412 · order #44021',
  context: 'duplicate charge · ch_3P8fL2',
  doneCaption: 'Approved by you · $412 refunded',
}

export const RUN2: RunCopy = {
  label: 'Run 2',
  time: 'Aug 17 · 11:34 AM',
  headline: 'Refund $189 · order #44103',
  ruleCaption: 'Rule applies · auto-approving',
  doneCaption: 'Auto-approved by rule · $189 refunded',
}

export const RUN3: RunCopy = {
  label: 'Run 3',
  time: 'Aug 19 · 2:08 PM',
  headline: 'Refund $266 · order #44158',
  doneCaption: 'Trusted · ran without asking · $266 refunded',
}

export const TRUST_LEVELS: TrustLevel[] = ['supervised', 'assisted', 'autonomous']

export const TRUST_LABELS: Record<TrustLevel, string> = {
  supervised: 'supervised',
  assisted: 'assisted',
  autonomous: 'autonomous',
}

export const TRUST_CAPTIONS: Record<TrustLevel, string> = {
  supervised: 'Your OK required on every action',
  assisted:   'Learned a rule · auto-approving similar',
  autonomous: 'Trusted · runs without asking',
}
