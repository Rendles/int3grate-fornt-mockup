// Top strip of the chat view: agent identity. Mirrors the agent header on
// /agents/:id/talk in the real product — avatar + name + caption + small
// "live" dot.

import { SCENE_AGENT } from '../scene-data'

export function AgentHeader() {
  const a = SCENE_AGENT
  return (
    <div className="hjl-header">
      <div className="hjl-header__avatar" aria-hidden>{a.initials}</div>
      <div className="hjl-header__id">
        <div className="hjl-header__name">{a.name}</div>
        <div className="hjl-header__caption">{a.caption}</div>
      </div>
      <span className="hjl-header__dot" aria-hidden />
    </div>
  )
}
