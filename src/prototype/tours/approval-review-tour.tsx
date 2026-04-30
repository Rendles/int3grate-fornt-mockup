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
        'You see what the agent wants to do, who asked for it, who can approve it, and how long it has been waiting. Open a row for the full context.',
    },
    {
      id: 'queue-filter',
      target: '[data-tour="approvals-filter"]',
      placement: 'bottom',
      title: 'Filter by status',
      body:
        'By default you only see pending requests. Switch to Approved, Rejected, or All when you want to review older decisions.',
    },
    {
      id: 'detail-action',
      target: '[data-tour="approval-action"]',
      placement: 'bottom',
      navigateTo: detailPath,
      title: 'What is being asked',
      body:
        'The title summarises what the agent wants to do, with the key amount and customer detail you need for a decision.',
    },
    {
      id: 'detail-evidence',
      target: '[data-tour="approval-evidence"]',
      placement: 'top',
      title: 'Evidence panel',
      body:
        'Read this first. The agent explains the request, the customer or charge involved, and why it needs your approval.',
    },
    {
      id: 'detail-decision',
      target: '[data-tour="approval-decision"]',
      placement: 'top',
      title: 'Approve or reject',
      body:
        'Your choice is saved for the team. Approve lets the agent continue; reject stops this request and asks you for a short reason.',
    },
  ],
}
