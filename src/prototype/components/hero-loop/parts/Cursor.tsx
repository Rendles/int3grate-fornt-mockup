// Synthetic cursor for the hero-loop scene.
//
// Position is driven by CSS custom properties (--hl-cursor-x / -y) so that
// Step 5 can introduce a CSS transition on .hl-cursor's transform without
// touching this component. For Step 3 this is just a parked SVG arrow at
// a fixed rest position over the stage.
//
// pointer-events: none — the cursor is purely visual; nothing it overlaps
// should become unclickable.

import type { CSSProperties } from 'react'

interface CursorProps {
  /** X offset from stage top-left, in px. */
  x: number
  /** Y offset from stage top-left, in px. */
  y: number
}

export function Cursor({ x, y }: CursorProps) {
  const style = {
    '--hl-cursor-x': `${x}px`,
    '--hl-cursor-y': `${y}px`,
  } as CSSProperties

  return (
    <div className="hl-cursor" style={style} aria-hidden>
      <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
        <path
          d="M 2 1 L 2 18 L 6 14.5 L 8.5 21 L 11.5 19.8 L 9 13.5 L 14 13.5 Z"
          fill="#FFFFFF"
          stroke="rgba(0, 0, 0, 0.6)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
