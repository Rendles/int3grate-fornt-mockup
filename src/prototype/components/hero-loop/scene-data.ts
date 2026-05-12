// Hardcoded mini-fixtures for the hero-loop scene.
// Intentionally NOT importing from lib/fixtures.ts — this folder must be
// portable. When the scene is copied to the landing repo, only the files
// in this directory should travel with it.
//
// Names match canonical agents in lib/fixtures.ts so the marketing surface
// stays in sync with what a real user would see if they logged in.

export interface QueueItem {
  id: string
  initials: string
  agentName: string
  actionVerb: string
  context: string
  ago: string
  /** Used by the success state to render "Refund issued — $412" cleanly. */
  successHeadline: string
}

// Greeting — neutral, name-free. The landing should not bind to a fictional
// persona; "Maria" lives in product UX research, not on the marketing site.
export const SCENE_GREETING = {
  primary: 'Good morning',
  secondary: 'Tuesday · 8:42 AM',
}

// KPI strip values. The Pending count is the only animated value (decrements
// from initial → after-approve in the success/next-incoming phases, resets
// on loop). Spend uses today's number to give the dashboard a "live" feel.
export const SCENE_KPI = {
  activeAgents: 5,
  pendingInitial: 5,
  pendingAfterApprove: 4,
  activeAgentsCaption: '7 on the team',
  pendingCaption: 'needs you',
  spendValue: '$284',
  spendCaption: 'today · vs $245 yesterday',
}

// The queue is rendered as 4 rows always (RR, LQ, AP, NEXT). The 4th row is
// collapsed (max-height 0) in most phases and reveals when the queue rotates
// in the next-incoming phase — giving the "queue keeps moving" effect.
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
    id: 'lq',
    initials: 'LQ',
    agentName: 'Lead Qualifier',
    actionVerb: 'Email 8 personalised leads',
    context: 'matched ICP · drafts ready',
    ago: '12m ago',
    successHeadline: 'Sent — 8 emails',
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
    id: 'next',
    initials: 'KS',
    agentName: 'Knowledge Base Sync',
    actionVerb: 'Sync 14 runbook pages',
    context: 'updated since Friday',
    ago: '2h ago',
    successHeadline: 'Synced',
  },
]
