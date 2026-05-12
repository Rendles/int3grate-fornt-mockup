// Synthetic cursor for the hero-chat-loop scene.
// Same SVG arrow shape as hero-loop's Cursor — copied (not imported)
// to keep this folder portable.
//
// Position is driven by CSS custom properties (--hcl-cursor-x / -y)
// with a CSS transition in HeroChatLoop.css. pointer-events: none —
// the cursor is purely visual.

import type { CSSProperties } from 'react'

interface CursorProps {
  /** X offset from stage top-left, in px. */
  x: number
  /** Y offset from stage top-left, in px. */
  y: number
}

export function Cursor({ x, y }: CursorProps) {
  const style = {
    '--hcl-cursor-x': `${x}px`,
    '--hcl-cursor-y': `${y}px`,
  } as CSSProperties

  return (
    <div className="hcl-cursor" style={style} aria-hidden>
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
