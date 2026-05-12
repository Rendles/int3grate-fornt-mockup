// "Agent is thinking" indicator — three pulsing dots in an agent-side
// bubble. Same left-aligned + avatar shape as a real MessageBubble.

import { SCENE_AGENT } from '../scene-data'

interface TypingIndicatorProps {
  visible: boolean
}

export function TypingIndicator({ visible }: TypingIndicatorProps) {
  return (
    <div className={`hcl-typing${visible ? ' hcl-typing--visible' : ''}`} aria-hidden={!visible}>
      <div className="hcl-typing__avatar" aria-hidden>{SCENE_AGENT.initials}</div>
      <div className="hcl-typing__bubble" aria-label="Agent is thinking">
        <span className="hcl-typing__dot" />
        <span className="hcl-typing__dot" />
        <span className="hcl-typing__dot" />
      </div>
    </div>
  )
}
