// Hardcoded mini-fixtures for the hero-onboarding-loop scene.
// Intentionally NOT importing from lib/fixtures.ts — this folder must be
// portable. When the scene is copied to the landing repo, only the files
// in this directory should travel with it.
//
// Four agents that drop into the 2×2 grid as the loop progresses; four
// activity rows that trickle into the feed.

export interface AgentScene {
  id: string
  initials: string
  name: string
  role: string
}

export const SCENE_AGENTS: AgentScene[] = [
  { id: 'lq', initials: 'LQ', name: 'Lead Qualifier',      role: 'Sales'    },
  { id: 'rr', initials: 'RR', name: 'Refund Resolver',     role: 'Support'  },
  { id: 'ap', initials: 'AP', name: 'Access Provisioner',  role: 'IT Ops'   },
  { id: 'ks', initials: 'KS', name: 'Knowledge Base Sync', role: 'Docs'     },
]

export interface ActivityItem {
  id: string
  initials: string
  agentName: string
  action: string
  ago: string
}

export const SCENE_ACTIVITY: ActivityItem[] = [
  { id: '1', initials: 'LQ', agentName: 'Lead Qualifier',      action: 'Drafted 8 outreach emails',     ago: '2m ago'  },
  { id: '2', initials: 'AP', agentName: 'Access Provisioner',  action: 'Provisioned 1 new user',        ago: '5m ago'  },
  { id: '3', initials: 'KS', agentName: 'Knowledge Base Sync', action: 'Synced 14 runbook pages',       ago: '8m ago'  },
  { id: '4', initials: 'RR', agentName: 'Refund Resolver',     action: 'Refund issued — $412',          ago: '11m ago' },
]

export const SCENE_GREETING = {
  primary: 'Good morning',
  secondary: 'Tuesday · 8:42 AM',
}

export const SCENE_CTA = {
  caption: 'Your team is empty',
  buttonLabel: 'Hire your first agent',
  hint: 'Onboard your first hire in 60 seconds.',
}

// KPI labels are shared; values are computed per-phase.
export const KPI_LABELS = {
  active: 'on the team',
  done: 'done today',
  spend: 'today',
}
