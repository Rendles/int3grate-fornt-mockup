import type { ComponentProps } from 'react'
import { Badge, Flex, Text } from '@radix-ui/themes'
import { humanKey } from '../../lib/format'

type BadgeColor = NonNullable<ComponentProps<typeof Badge>['color']>
type Tone = 'accent' | 'warn' | 'success' | 'danger' | 'info' | 'ghost'

const TONE_COLOR: Record<Tone, BadgeColor> = {
  accent: 'blue',
  warn: 'amber',
  danger: 'red',
  success: 'green',
  info: 'cyan',
  ghost: 'gray',
}

const STATUS_MAP: Record<string, { tone: Tone; label: string; pulse?: boolean; dotted?: boolean }> = {
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
  closed: { tone: 'ghost', label: 'Closed' },
}

// Friendly label-only accessor for the same map. Use when you need a string
// (e.g. CommandBar `value`) rather than the full <Status> pill JSX. Falls
// back to humanKey() for statuses outside the canonical entity set.
export function statusLabel(s: string): string {
  return STATUS_MAP[s]?.label ?? humanKey(s)
}

export function Status({
  status,
}: {
  status:
    | 'active' | 'draft' | 'archived' | 'paused' | 'pending' | 'running' | 'suspended'
    | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled'
    | 'approved' | 'rejected' | 'expired' | 'closed'
}) {
  const s = STATUS_MAP[status]
  const color = TONE_COLOR[s.tone]
  // Dotted variant (completed_with_errors) uses Badge outline; everything else is soft.
  // The pulse animation remains a CSS extension (keyframes in prototype.css) since
  // Radix does not expose a "pulsing" state on Badge.
  return (
    <Flex align="center" gap="2">
      <Badge
        color={color}
        variant={s.dotted ? 'outline' : 'soft'}
        radius="full"
        size="1"
        className={s.pulse ? 'status-pulse' : undefined}
      >
        <Text size="1">{s.label}</Text>
      </Badge>
    </Flex>
  )
}
