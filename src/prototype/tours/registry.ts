import type { Tour } from './types'
import { sidebarTour } from './sidebar-tour'
import { approvalReviewTour } from './approval-review-tour'
import { startAChatTour } from './start-a-chat-tour'
import { configureToolGrantsTour } from './configure-tool-grants-tour'
import { hireAnAgentTour } from './hire-an-agent-tour'

/**
 * Single source of truth for "what tours exist". Consumed by the Learning
 * Center page (Phase 2) and any future tour-listing UI. New tours are
 * registered here at the bottom of their file's commit, not at the
 * call site that launches them.
 */

export type TourAudience = 'all' | 'admin' | 'domain_admin'
export type TourGroup = 'getting-started' | 'core-workflows' | 'admin-setup'

export interface TourEntry {
  tour: Tour
  audience: TourAudience
  group: TourGroup
  description: string
  durationLabel: string
  // null for tours that don't depend on data (e.g. sidebar overview).
  // Otherwise the id of a scenario in TRAINING_SCENARIOS that gets
  // entered when the tour starts and exited when the tour ends.
  scenarioId: string | null
}

export const TOURS: TourEntry[] = [
  {
    tour: sidebarTour,
    audience: 'all',
    group: 'getting-started',
    description: 'Quick tour of the main menu and what each section is for.',
    durationLabel: '~2 min · 9 steps',
    scenarioId: null,
  },
  {
    tour: approvalReviewTour,
    audience: 'domain_admin',
    group: 'core-workflows',
    description:
      'Walk through reviewing a pending approval — what to read, how to decide, what happens after.',
    durationLabel: '~2 min · 6 steps',
    scenarioId: 'approval-review',
  },
  {
    tour: startAChatTour,
    audience: 'all',
    group: 'getting-started',
    description:
      'Learn how to choose an active agent, open their Talk area, and start a new chat.',
    durationLabel: '~2 min · 5 steps',
    scenarioId: 'start-a-chat',
  },
  {
    tour: hireAnAgentTour,
    audience: 'domain_admin',
    group: 'getting-started',
    description:
      'Learn how to choose a starter role and understand what happens before an agent joins your team.',
    durationLabel: '~2 min · 5 steps',
    scenarioId: null,
  },
  {
    tour: configureToolGrantsTour,
    audience: 'domain_admin',
    group: 'admin-setup',
    description:
      'Learn how to set what an agent can access — pick a permission, choose its access level, and decide when human approval is required.',
    durationLabel: '~2 min · 7 steps',
    scenarioId: 'configure-tool-grants',
  },
]
