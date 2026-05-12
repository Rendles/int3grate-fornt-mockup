// Chat message bubble — agent (left, with avatar) or user (right, no avatar).
// Visibility is controlled by the parent via the `visible` prop; the bubble
// fades + slides up when shown.

import type { ReactNode } from 'react'

interface MessageBubbleProps {
  speaker: 'agent' | 'user'
  visible: boolean
  /** Agent variant only — shows the initials avatar on the left. */
  initials?: string
  children: ReactNode
}

export function MessageBubble({ speaker, visible, initials, children }: MessageBubbleProps) {
  const cls = [
    'hjl-msg',
    `hjl-msg--${speaker}`,
    visible ? 'hjl-msg--visible' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      {speaker === 'agent' && (
        <div className="hjl-msg__avatar" aria-hidden>{initials ?? '··'}</div>
      )}
      <div className="hjl-msg__bubble">{children}</div>
    </div>
  )
}
