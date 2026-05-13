// Synthetic cursor for the hero-ladder-loop scene.
// Same SVG arrow + transform-driven positioning as the other hero loops,
// scoped under the .hero-ladder root via CSS variables (--ld-cursor-x/y).
// Visibility is class-driven so we can fade it out in autonomous phases.

import type { CSSProperties } from 'react'

interface CursorProps {
  x: number
  y: number
  visible: boolean
}

export function Cursor({ x, y, visible }: CursorProps) {
  const style = {
    '--ld-cursor-x': `${x}px`,
    '--ld-cursor-y': `${y}px`,
  } as CSSProperties

  return (
    <div
      className={`ld-cursor${visible ? '' : ' ld-cursor--hidden'}`}
      style={style}
      aria-hidden
    >
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
