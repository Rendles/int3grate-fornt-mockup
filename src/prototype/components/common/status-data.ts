export type StatusTone = 'accent' | 'warn' | 'success' | 'danger' | 'info' | 'ghost'

export interface StatusMeta {
  tone: StatusTone
  label: string
  pulse?: boolean
  dotted?: boolean
}

export const STATUS_VALUES = [
  'active',
  'draft',
  'archived',
  'paused',
  'pending',
  'running',
  'suspended',
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled',
  'approved',
  'rejected',
  'expired',
  'closed',
] as const

export type StatusValue = typeof STATUS_VALUES[number]

export const STATUS_MAP: Record<StatusValue, StatusMeta> = {
  active: { tone: 'accent', label: 'Active' },
  draft: { tone: 'ghost', label: 'Draft' },
  archived: { tone: 'ghost', label: 'Archived' },
  paused: { tone: 'warn', label: 'Paused' },
  pending: { tone: 'warn', label: 'Pending', pulse: true },
  running: { tone: 'info', label: 'Running', pulse: true },
  suspended: { tone: 'warn', label: 'Suspended', pulse: true },
  completed: { tone: 'success', label: 'Completed' },
  completed_with_errors: { tone: 'warn', label: 'Completed · with errors', dotted: true },
  failed: { tone: 'danger', label: 'Got stuck — needs help' },
  cancelled: { tone: 'ghost', label: 'Cancelled' },
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Rejected' },
  expired: { tone: 'ghost', label: 'Expired' },
  closed: { tone: 'ghost', label: 'Closed' },
}
