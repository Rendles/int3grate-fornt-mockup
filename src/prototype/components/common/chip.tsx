import type { ReactNode } from 'react'
import type { ComponentProps } from 'react'
import { Badge } from '@radix-ui/themes'
import type { ToolPolicyMode } from '../../lib/types'

type Tone = 'accent' | 'warn' | 'danger' | 'success' | 'info' | 'ghost'
type BadgeColor = NonNullable<ComponentProps<typeof Badge>['color']>

const TONE_COLOR: Record<Tone, BadgeColor> = {
  accent: 'blue',
  warn: 'amber',
  danger: 'red',
  success: 'green',
  info: 'cyan',
  ghost: 'gray',
}

export function Chip({
  tone,
  square,
  children,
}: {
  tone?: Tone
  square?: boolean
  children: ReactNode
}) {
  const color: BadgeColor = tone ? TONE_COLOR[tone] : 'gray'
  const variant = tone === 'ghost' ? 'outline' : 'soft'
  return (
    <Badge color={color} variant={variant} radius={square ? 'small' : 'full'} size="1">
      {children}
    </Badge>
  )
}

// Policy-axis chip for gateway v0.2.0 (read_only / requires_approval / denied).
// Distinct from the legacy CRUD-axis ToolGrant.mode, which uses plain Chip.
export function PolicyModeChip({ mode }: { mode: ToolPolicyMode }) {
  const tone = mode === 'read_only' ? 'info' : mode === 'requires_approval' ? 'warn' : 'danger'
  return <Chip tone={tone} square>{mode}</Chip>
}
