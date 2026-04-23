import type { ReactNode } from 'react'
import { IconButton, Tooltip } from '@radix-ui/themes'
import { IconHelp } from '../icons'

export function InfoHint({
  children,
  size = 13,
}: {
  children: ReactNode
  size?: number
}) {
  return (
    <Tooltip content={children}>
      <IconButton variant="ghost" color="gray" size="1" radius="full" aria-label="More information">
        <IconHelp size={size} />
      </IconButton>
    </Tooltip>
  )
}
