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
        'The title summarises the action — friendly tool label plus amounts and reference IDs. The CommandBar below adds run, task, approver role, and expiry context.',
    },
    {
      id: 'detail-evidence',
      target: '[data-tour="approval-evidence"]',
      placement: 'top',
      title: 'Evidence panel',
      body:
        'Read this first. The agent attaches the run summary, customer / charge metadata, and policy verdicts that triggered the gate. Decide based on this.',
    },
    {
      id: 'detail-decision',
      target: '[data-tour="approval-decision"]',
      placement: 'top',
      title: 'Approve or reject',
      body:
        'Both decisions are queued and written to the audit trail. The orchestrator resumes the suspended run on accept or terminates it on reject. Reject requires a reason (≥ 4 characters); approve is optional.',
    },
  ],
}
