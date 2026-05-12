// Chat message bubble — agent (left, with avatar) or user (right, no avatar).
// Visibility is controlled by the parent via the `visible` prop; the bubble
// fades + slides up when shown. Multiple states share the bubble shape:
//
//   agent + intro line       → simple text body
//   agent + bulleted response → intro + <ul>
//   user                      → just text, right-aligned, violet-tinted

import type { ReactNode } from 'react'

interface MessageBubbleProps {
  speaker: 'agent' | 'user'
  visible: boolean
  /** Agent variant only — shows the LQ initials avatar on the left. */
  initials?: string
  children: ReactNode
}

export function MessageBubble({ speaker, visible, initials, children }: MessageBubbleProps) {
  const cls = [
    'hcl-msg',
    `hcl-msg--${speaker}`,
    visible ? 'hcl-msg--visible' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      {speaker === 'agent' && (
        <div className="hcl-msg__avatar" aria-hidden>{initials ?? '··'}</div>
      )}
      <div className="hcl-msg__bubble">{children}</div>
    </div>
  )
}
