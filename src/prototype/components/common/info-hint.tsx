import type { ReactNode } from 'react'
import { Tooltip } from '@radix-ui/themes'
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
      <button type="button" className="info-hint" aria-label="More information">
        <IconHelp size={size} className="info-hint__icon" />
      </button>
    </Tooltip>
  )
}
