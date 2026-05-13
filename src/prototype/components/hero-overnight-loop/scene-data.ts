// Hardcoded mini-fixtures for the hero-overnight-loop scene.
// Intentionally NOT importing from lib/fixtures.ts — this folder must be
// portable. When the scene is copied to the landing repo, only the files
// in this directory should travel with it.
//
// Activity ordered chronologically (oldest first). Each phase declares an
// [earliestIndex, latestIndex] window into this array — older rows scroll
// out the top of the ribbon as newer rows arrive at the bottom.

export type ActivityKind = 'done' | 'needs-you'

export interface ActivityItem {
  id: string
  initials: string
  agentName: string
  action: string
  time: string
  kind: ActivityKind
}

export const SCENE_ACTIVITY: ActivityItem[] = [
  { id: '1', initials: 'RR', agentName: 'Refund Resolver',     action: 'Refund issued — $412',          time: '8:43 PM',  kind: 'done' },
  { id: '2', initials: 'LQ', agentName: 'Lead Qualifier',      action: 'Drafted 8 outreach emails',     time: '9:12 PM',  kind: 'done' },
  { id: '3', initials: 'KS', agentName: 'Knowledge Base Sync', action: 'Synced 14 runbook pages',       time: '10:34 PM', kind: 'done' },
  { id: '4', initials: 'AP', agentName: 'Access Provisioner',  action: 'Provisioned 2 new users',       time: '12:18 AM', kind: 'done' },
  { id: '5', initials: 'RR', agentName: 'Refund Resolver',     action: 'Refund $812 · awaiting OK',     time: '2:05 AM',  kind: 'needs-you' },
  { id: '6', initials: 'KS', agentName: 'Knowledge Base Sync', action: 'Synced 8 KB articles',          time: '3:40 AM',  kind: 'done' },
  { id: '7', initials: 'LQ', agentName: 'Lead Qualifier',      action: 'Qualified 4 new leads',         time: '5:12 AM',  kind: 'done' },
  { id: '8', initials: 'RR', agentName: 'Refund Resolver',     action: 'Refund issued — $189',          time: '6:55 AM',  kind: 'done' },
]

export const SCENE_HEADER = {
  eyebrow: 'OVERNIGHT',
  caption: 'While you slept',
}

export interface SummaryMetric {
  label: string
  value: string
  tone: 'done' | 'pending' | 'spend'
}

export const SCENE_SUMMARY = {
  eyebrow: 'MORNING SUMMARY',
  time: '8:00 AM',
  metrics: [
    { label: 'tasks done', value: '47',   tone: 'done' },
    { label: 'need you',   value: '6',    tone: 'pending' },
    { label: 'spent',      value: '$284', tone: 'spend' },
  ] as SummaryMetric[],
}
