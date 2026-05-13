// Top strip of the ladder scene: agent identity (avatar + name + role).
// Single-line, sits above the trust meter.

import { SCENE_AGENT } from '../scene-data'

export function AgentStrip() {
  return (
    <div className="ld-agent">
      <div className="ld-agent__avatar" aria-hidden>{SCENE_AGENT.initials}</div>
      <div className="ld-agent__id">
        <div className="ld-agent__name">{SCENE_AGENT.name}</div>
        <div className="ld-agent__role">{SCENE_AGENT.role}</div>
      </div>
    </div>
  )
}
