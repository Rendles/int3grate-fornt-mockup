import type { SVGProps } from 'react'

/* =============================================================
   Legacy hand-rolled icons — kept during migration to Hugeicons.
   New code should use <Icon icon={...} /> from './icon' with icons
   from @hugeicons/core-free-icons.
   ============================================================= */

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

type P = { className?: string; size?: number; style?: React.CSSProperties }
const wrap = (children: React.ReactNode) =>
  function Icon({ className = 'ic', size, style }: P) {
    const merged = size ? { width: size, height: size, ...style } : style
    return (
      <svg {...base} className={className} style={merged}>
        {children}
      </svg>
    )
  }

export const IconHome = wrap(<><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></>)

export const IconAgent = wrap(
  <>
    <rect x="3.5" y="6" width="17" height="12" rx="2" />
    <path d="M8 10v2M16 10v2" />
    <path d="M12 3v3M7 18v2M17 18v2" />
  </>
)

export const IconTask = wrap(
  <>
    <path d="M4 6h16M4 12h10M4 18h7" />
    <circle cx="19" cy="18" r="2.2" />
  </>
)

export const IconApproval = wrap(
  <>
    <path d="M20 6L9 17l-5-5" />
  </>
)

export const IconSpend = wrap(
  <>
    <path d="M12 2v20M17 6.5c0-2-2.2-3-5-3s-5 1-5 3 2 3 5 3 5 1 5 3-2 3-5 3-5-1-5-3" />
  </>
)

export const IconIntegration = wrap(
  <>
    <path d="M14 4h4a2 2 0 0 1 2 2v4M10 20H6a2 2 0 0 1-2-2v-4" />
    <rect x="8" y="8" width="8" height="8" rx="1.5" />
  </>
)

export const IconPlus = wrap(<><path d="M12 5v14M5 12h14" /></>)

export const IconArrowRight = wrap(<><path d="M5 12h14M13 5l7 7-7 7" /></>)

export const IconX = wrap(<><path d="M18 6L6 18M6 6l12 12" /></>)
export const IconCheck = wrap(<><path d="M20 6L9 17l-5-5" /></>)

export const IconAlert = wrap(
  <>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4M12 17v.01" />
  </>
)

export const IconInfo = wrap(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8v.01" />
  </>
)

export const IconPlay = wrap(<><path d="M5 3l14 9-14 9V3z" /></>)
export const IconPause = wrap(<><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>)
export const IconStop = wrap(<><rect x="5" y="5" width="14" height="14" rx="1.5" /></>)

export const IconLock = wrap(<><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>)

export const IconEye = wrap(
  <>
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
    <circle cx="12" cy="12" r="3" />
  </>
)

export const IconEyeOff = wrap(
  <>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6 0 9.5 7 9.5 7a16.5 16.5 0 0 1-3.1 3.8" />
    <path d="M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7a10.3 10.3 0 0 0 4.4-1" />
    <path d="M9.9 9.9A3 3 0 0 0 14.1 14.1" />
  </>
)

export const IconLogout = wrap(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></>)

export const IconSun = wrap(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>
)

export const IconMoon = wrap(<><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></>)

export const IconHelp = wrap(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5" />
    <path d="M12 16.5h.01" strokeLinecap="round" />
  </>
)

export const IconTool = wrap(<><path d="M14.7 6.3a4 4 0 0 0-5.6 5.6L3 18l3 3 6.1-6.1a4 4 0 0 0 5.6-5.6l-2.8 2.8-2-.7-.7-2 2.5-3.1z"/></>)
