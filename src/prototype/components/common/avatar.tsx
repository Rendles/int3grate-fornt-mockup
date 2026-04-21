import type { ComponentProps } from 'react'
import { Avatar as RadixAvatar } from '@radix-ui/themes'

type Tone = 'accent' | 'info' | 'warn' | 'success' | 'danger'
type AvatarColor = NonNullable<ComponentProps<typeof RadixAvatar>['color']>
type AvatarSize = NonNullable<ComponentProps<typeof RadixAvatar>['size']>

const TONE_COLOR: Record<Tone, AvatarColor> = {
  accent: 'blue',
  info: 'cyan',
  warn: 'amber',
  success: 'green',
  danger: 'red',
}

// Map arbitrary pixel sizes from the old API to Radix Avatar's 1–9 scale
// (16 / 20 / 24 / 28 / 32 / 40 / 48 / 56 / 64 px).
function nearestSize(px: number): AvatarSize {
  if (px <= 18) return '1'
  if (px <= 22) return '2'
  if (px <= 26) return '3'
  if (px <= 30) return '4'
  if (px <= 36) return '5'
  if (px <= 44) return '6'
  if (px <= 52) return '7'
  if (px <= 60) return '8'
  return '9'
}

export function Avatar({
  initials,
  tone = 'accent',
  size = 24,
}: {
  initials: string
  tone?: string
  size?: number
}) {
  const color = TONE_COLOR[tone as Tone] ?? 'blue'
  return (
    <RadixAvatar
      fallback={initials}
      color={color}
      size={nearestSize(size)}
      variant="soft"
      radius="small"
    />
  )
}
