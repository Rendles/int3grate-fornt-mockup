import type { ComponentProps } from 'react'
import { Badge, Flex, Text } from '@radix-ui/themes'
import { STATUS_MAP } from './status-data'
import type { StatusTone, StatusValue } from './status-data'

type BadgeColor = NonNullable<ComponentProps<typeof Badge>['color']>

const TONE_COLOR: Record<StatusTone, BadgeColor> = {
  accent: 'cyan',
  warn: 'orange',
  danger: 'red',
  success: 'jade',
  info: 'cyan',
  ghost: 'gray',
}

export function Status({
  status,
}: {
  status: StatusValue
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
