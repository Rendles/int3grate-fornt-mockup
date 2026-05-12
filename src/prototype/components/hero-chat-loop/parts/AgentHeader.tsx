// Top strip: agent identity. Mirrors the agent header on /agents/:id/talk
// in the real product — avatar + name + caption + a small "live" dot.

import { SCENE_AGENT } from '../scene-data'

export function AgentHeader() {
  const a = SCENE_AGENT
  return (
    <div className="hcl-header">
      <div className="hcl-header__avatar" aria-hidden>{a.initials}</div>
      <div className="hcl-header__id">
        <div className="hcl-header__name">{a.name}</div>
        <div className="hcl-header__caption">{a.caption}</div>
      </div>
      <span className="hcl-header__dot" aria-hidden />
    </div>
  )
}
