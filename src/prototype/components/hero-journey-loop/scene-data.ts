// Hardcoded mini-fixtures for the hero-journey-loop scene.
// Intentionally NOT importing from lib/fixtures.ts — this folder must be
// portable. When the scene is copied to the landing repo, only the files
// in this directory should travel with it.
//
// Names match canonical agents/templates in the real product so the
// marketing surface stays in sync with what a real user would see.

// ─── Top strip ────────────────────────────────────────────────────────

export const SCENE_GREETING = {
  primary: 'Good morning',
  secondary: 'Tuesday · 8:42 AM',
}

// ─── KPI strip ────────────────────────────────────────────────────────

export interface KpiValues {
  activeAgents: number
  activeAgentsCaption: string
  pendingCount: number
  pendingCaption: string
  spend: string
  spendCaption: string
}

// Initial dashboard state (start of loop).
export const SCENE_KPI_INITIAL: KpiValues = {
  activeAgents: 5,
  activeAgentsCaption: '7 on the team',
  pendingCount: 5,
  pendingCaption: 'needs you',
  spend: '$284',
  spendCaption: 'today · vs $245 yesterday',
}

// After approve (pending −1) and hire (active +1) — used at the end of
// the loop when the journey returns to the dashboard view.
export const SCENE_KPI_UPDATED: KpiValues = {
  activeAgents: 6,
  activeAgentsCaption: '8 on the team',
  pendingCount: 4,
  pendingCaption: 'needs you',
  spend: '$284',
  spendCaption: 'today · vs $245 yesterday',
}

// ─── Queue ────────────────────────────────────────────────────────────

export interface QueueItem {
  id: string
  initials: string
  agentName: string
  actionVerb: string
  context: string
  ago: string
  successHeadline: string
}

// 4 items in DOM. RR is the focal one that gets approved. After approve,
// queue rotates: RR collapses, TT/AP move up, IR reveals (was hidden).
export const SCENE_QUEUE: QueueItem[] = [
  {
    id: 'rr',
    initials: 'RR',
    agentName: 'Refund Resolver',
    actionVerb: 'Refund $412 on order #44021',
    context: 'duplicate charge · ch_3P8fL2',
    ago: '8s ago',
    successHeadline: 'Refund issued — $412',
  },
  {
    id: 'tt',
    initials: 'TT',
    agentName: 'Ticket Triage',
    actionVerb: 'Reply to ticket #1843',
    context: 'returning customer · billing question',
    ago: '14m ago',
    successHeadline: 'Reply sent',
  },
  {
    id: 'ap',
    initials: 'AP',
    agentName: 'Access Provisioner',
    actionVerb: 'Provision 1 new hire · Okta',
    context: 'role template "sales_ae"',
    ago: '1h ago',
    successHeadline: 'Provisioned',
  },
  {
    id: 'ir',
    initials: 'IR',
    agentName: 'Invoice Reconciler',
    actionVerb: 'Match 23 invoices',
    context: 'monthly close',
    ago: '2h ago',
    successHeadline: 'Matched',
  },
]

// ─── Hire button ──────────────────────────────────────────────────────

export const SCENE_HIRE_LABEL = 'Hire'

// ─── Templates (used from P5.2 onwards) ──────────────────────────────

export interface SceneTemplate {
  id: string
  initials: string
  name: string
  pitch: string
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  { id: 'sales',     initials: 'SA', name: 'Sales Agent',      pitch: 'Finds leads, sends intros, follows up' },
  { id: 'marketing', initials: 'MA', name: 'Marketing Agent',  pitch: 'Drafts campaigns, schedules posts' },
  { id: 'support',   initials: 'CS', name: 'Customer Support', pitch: 'Answers FAQs, escalates the rest' },
  { id: 'custom',    initials: '+',  name: 'Custom Agent',     pitch: 'Start blank and brief everything yourself' },
]

export const PICKER_CLICKED_ID = 'sales'

// ─── Chat (used from P5.3 onwards) ────────────────────────────────────

export const SCENE_AGENT = {
  name: 'Lead Qualifier',
  initials: 'LQ',
  caption: 'just hired · ready to work',
}

export const SCENE_WELCOME = "Hi! I'm Lead Qualifier. Tell me what you need."

export const SCENE_USER_MESSAGE = 'Find 5 leads in US fintech'

export const SCENE_RESPONSE = {
  intro: 'Found 5 matches in US fintech:',
  bullets: [
    'Acme Pay — VP Sales',
    'Globex Finance — Head of Growth',
    'Stark Capital — CRO',
    '+2 more',
  ],
}

export const SCENE_CTA = '8 personalised drafts ready for you'
export const SCENE_INPUT_PLACEHOLDER = 'Type a message…'

// ─── Activity ticker (used from P5.4 onwards) ────────────────────────

export interface ActivityItem {
  initials: string
  agent: string
  action: string
  ago: string
}

export const SCENE_ACTIVITY: ActivityItem[] = [
  { initials: 'LQ', agent: 'Lead Qualifier',       action: 'Drafted 8 personalised emails',  ago: 'just now' },
  { initials: 'KS', agent: 'Knowledge Base Sync',  action: 'Synced 14 runbook pages',         ago: '1m ago' },
  { initials: 'IR', agent: 'Invoice Reconciler',   action: 'Matched 23 invoices to POs',      ago: '4m ago' },
]
