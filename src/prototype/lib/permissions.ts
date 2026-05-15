import type { ApprovalRequest, User } from './types'

// Can `user` decide `approval`? Mirrors the role check the gateway runs
// before accepting `POST /approvals/{id}/decision`:
//   - admin       → can decide anything
//   - domain_admin → can decide approvals whose approver_role !== 'admin'
//   - member       → cannot decide anything (real backend returns 403)
//
// Used by every UI that surfaces an Approve / Reject control — chat-panel
// SuspendedCard, /approvals card + table inline actions, /approvals/:id
// detail panel. Gating in the UI keeps us honest: we don't show buttons
// that would 403 on submit.
export function canDecideApproval(
  user: User | null | undefined,
  approval: ApprovalRequest,
): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'domain_admin') return approval.approver_role !== 'admin'
  return false
}
