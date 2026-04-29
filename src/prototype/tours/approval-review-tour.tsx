import type { Tour } from './types'
import { APPROVAL_REVIEW_IDS } from './training-fixtures'

const detailPath = `/approvals/${APPROVAL_REVIEW_IDS.approvalId}`

export const approvalReviewTour: Tour = {
  id: 'approval-review',
  name: 'Review an approval',
  steps: [
    {
      id: 'sidebar-badge',
      target: '[data-tour="nav-approvals"]',
      placement: 'right',
      navigateTo: '/approvals',
      title: 'Approvals queue',
      body:
        'When an agent action needs human sign-off, it lands here. The amber badge counts pending decisions waiting on you.',
    },
    {
      id: 'queue-row',
      target: '[data-tour="approval-row"]',
      placement: 'bottom',
      title: 'Each row is one request',
      body:
        'You see what was requested, who triggered it, the approver role required, and how long it has been waiting. Click a row to open the full detail.',
    },
    {
      id: 'queue-filter',
      target: '[data-tour="approvals-filter"]',
      placement: 'bottom',
      title: 'Filter by status',
      body:
        'By default you only see pending requests. Switch to Approved / Rejected to audit past decisions, or All to see everything.',
    },
    {
      id: 'detail-action',
      target: '[data-tour="approval-action"]',
      placement: 'bottom',
      navigateTo: detailPath,
      title: 'What is being asked',
      body:
        'The title summarises what the agent wants to do — the friendly action name plus amounts and reference IDs.',
    },
    {
      id: 'detail-evidence',
      target: '[data-tour="approval-evidence"]',
      placement: 'top',
      title: 'Evidence panel',
      body:
        'Read this first. The agent attaches a short summary, customer / charge metadata, and the policy reason that triggered the request. Decide based on this.',
    },
    {
      id: 'detail-decision',
      target: '[data-tour="approval-decision"]',
      placement: 'top',
      title: 'Approve or reject',
      body:
        'Both decisions are written to the history log. On accept, the agent continues the action right away. On reject, the agent stops. Reject requires a reason (≥ 4 characters); approve is optional.',
    },
  ],
}
