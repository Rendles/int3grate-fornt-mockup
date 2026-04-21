import type { CSSProperties } from 'react'

export function Status({
  status,
}: {
  status:
    | 'active'
    | 'draft'
    | 'archived'
    | 'paused'
    | 'pending'
    | 'running'
    | 'suspended'
    | 'completed'
    | 'completed_with_errors'
    | 'failed'
    | 'cancelled'
    | 'approved'
    | 'rejected'
    | 'expired'
}) {
  const map: Record<string, { tone: 'accent' | 'warn' | 'success' | 'danger' | 'info' | 'ghost'; label: string; pulse?: boolean; dotted?: boolean }> = {
    active: { tone: 'accent', label: 'Active' },
    draft: { tone: 'ghost', label: 'Draft' },
    archived: { tone: 'ghost', label: 'Archived' },
    paused: { tone: 'warn', label: 'Paused' },
    pending: { tone: 'warn', label: 'Pending', pulse: true },
    running: { tone: 'info', label: 'Running', pulse: true },
    suspended: { tone: 'warn', label: 'Suspended', pulse: true },
    completed: { tone: 'success', label: 'Completed' },
    completed_with_errors: { tone: 'warn', label: 'Completed · with errors', dotted: true },
    failed: { tone: 'danger', label: 'Failed' },
    cancelled: { tone: 'ghost', label: 'Cancelled' },
    approved: { tone: 'success', label: 'Approved' },
    rejected: { tone: 'danger', label: 'Rejected' },
    expired: { tone: 'ghost', label: 'Expired' },
  }
  const s = map[status]
  const dotStyle: CSSProperties = {}
  if (s.tone === 'ghost') dotStyle.background = 'var(--gray-10)'
  if (s.dotted) {
    dotStyle.background = 'transparent'
    dotStyle.border = `1.5px dashed var(--amber-11)`
  }
  return (
    <span className="row row--sm">
      <span
        className={`dot dot--${s.tone === 'ghost' ? 'accent' : s.tone}${s.pulse ? ' dot--pulse' : ''}`}
        style={Object.keys(dotStyle).length ? dotStyle : undefined}
      />
      <span className="nowrap" style={{ fontSize: 12, color: 'var(--gray-12)' }}>
        {s.label}
      </span>
    </span>
  )
}
