import { HugeiconsIcon } from '@hugeicons/react'
import type { HugeiconsIconProps } from '@hugeicons/react'

/* =============================================================
   Icon wrapper around @hugeicons/react.
   Usage:
     import { Icon } from '../components/icon'
     import { Home01Icon } from '@hugeicons/core-free-icons'
     <Icon icon={Home01Icon} />                   // 14×14 via `.ic`
     <Icon icon={Home01Icon} className="ic ic--lg" />
   Sizing is driven by the `.ic` CSS class (prototype.css) so the new
   icons render at the same scale as the legacy set during migration.
   ============================================================= */

export type IconProps = Omit<HugeiconsIconProps, 'ref'>

export function Icon({ className = 'ic', ...rest }: IconProps) {
  return <HugeiconsIcon className={className} {...rest} />
}
