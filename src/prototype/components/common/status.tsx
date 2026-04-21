import type { CSSProperties } from 'react'
import { Box, Flex, Text } from '@radix-ui/themes'

type Tone = 'accent' | 'warn' | 'success' | 'danger' | 'info' | 'ghost'

const DOT_COLOR: Record<Tone, string> = {
  accent: 'var(--accent-9)',
  warn: 'var(--amber-11)',
  danger: 'var(--red-11)',
  success: 'var(--green-11)',
  info: 'var(--cyan-11)',
  ghost: 'var(--gray-10)',
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
}

export function Status({
  status,
}: {
  status:
    | 'active' | 'draft' | 'archived' | 'paused' | 'pending' | 'running' | 'suspended'
    | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled'
    | 'approved' | 'rejected' | 'expired'
}) {
  const s = STATUS_MAP[status]
  const color = DOT_COLOR[s.tone]
  const dotStyle: CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: 999,
    flexShrink: 0,
    background: s.dotted ? 'transparent' : color,
    border: s.dotted ? '1.5px dashed var(--amber-11)' : undefined,
    color,
  }
  return (
    <Flex align="center" gap="2">
      <Box asChild className={s.pulse ? 'status-pulse' : undefined}>
        <span style={dotStyle} />
      </Box>
      <Text size="1" style={{ whiteSpace: 'nowrap', color: 'var(--gray-12)' }}>
        {s.label}
      </Text>
    </Flex>
  )
}
