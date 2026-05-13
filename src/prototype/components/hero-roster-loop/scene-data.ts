// Hardcoded mini-fixtures for the hero-roster-loop scene.
// Intentionally NOT importing from lib/fixtures.ts — this folder must be
// portable. When the scene is copied to the landing repo, only the files
// in this directory should travel with it.
//
// Names match canonical agents in lib/fixtures.ts so the marketing surface
// stays in sync with what a real user would see if they logged in.

export type AgentState = 'working' | 'needs-you' | 'done' | 'idle'

export type AgentId = 'lq' | 'rr' | 'ap' | 'ks'

export interface StateContent {
  task: string
  meta: string
}

export interface AgentScene {
  id: AgentId
  initials: string
  name: string
  role: string
  states: Record<AgentState, StateContent>
}

// Header strip. Neutral time/title — the landing must not bind to a fictional
// persona (no "Hey Maria"); "Your team" is the right framing per
// docs/ux-spec.md § 8.
export const SCENE_HEADER = {
  title: 'Your team',
  time: 'Tuesday · 8:42 AM',
}

// Four agents, four states each. The state-content map is exhaustive — the
// phase machine in phases.ts only chooses which state each agent shows.
export const SCENE_AGENTS: AgentScene[] = [
  {
    id: 'lq',
    initials: 'LQ',
    name: 'Lead Qualifier',
    role: 'Sales',
    states: {
      working:     { task: 'Drafting outreach to 12 leads…',  meta: 'matched ICP · personalising' },
      'needs-you': { task: '12 personalised drafts ready',    meta: 'your OK to send' },
      done:        { task: 'Sent — 12 emails',                meta: 'all delivered · 11:02 AM' },
      idle:        { task: 'Standing by',                     meta: 'waiting on new leads' },
    },
  },
  {
    id: 'rr',
    initials: 'RR',
    name: 'Refund Resolver',
    role: 'Support',
    states: {
      working:     { task: 'Reviewing 3 open disputes…',      meta: 'checking Stripe history' },
      'needs-you': { task: 'Refund $412 on order #44021',     meta: 'duplicate charge confirmed' },
      done:        { task: 'Refund issued — $412',            meta: 'customer notified' },
      idle:        { task: 'Standing by',                     meta: 'no open disputes' },
    },
  },
  {
    id: 'ap',
    initials: 'AP',
    name: 'Access Provisioner',
    role: 'IT Ops',
    states: {
      working:     { task: 'Provisioning Okta access…',       meta: 'role · sales_ae' },
      'needs-you': { task: 'Grant admin to new hire',         meta: 'elevated access · review' },
      done:        { task: 'Provisioned 1 user',              meta: 'welcome email sent' },
      idle:        { task: 'Standing by',                     meta: 'no requests queued' },
    },
  },
  {
    id: 'ks',
    initials: 'KS',
    name: 'Knowledge Base Sync',
    role: 'Docs',
    states: {
      working:     { task: 'Syncing 14 runbook pages…',       meta: 'Notion → Confluence' },
      'needs-you': { task: 'Resolve 3 page conflicts',        meta: 'edits diverged Friday' },
      done:        { task: 'Synced — 14 pages',               meta: 'all up to date' },
      idle:        { task: 'Standing by',                     meta: 'next sync 3:00 PM' },
    },
  },
]

export const STATE_LABEL: Record<AgentState, string> = {
  working: 'working',
  'needs-you': 'needs you',
  done: 'done',
  idle: 'idle',
}
