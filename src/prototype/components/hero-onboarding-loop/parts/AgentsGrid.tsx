// 2×2 grid of agent cards. Cards "drop in" one-by-one as phases advance;
// per-card visibility is driven by index < agentsVisible (each card has a
// hidden / visible state with translateY + opacity transition).

import { SCENE_AGENTS } from '../scene-data'

interface AgentsGridProps {
  visible: boolean
  agentsVisible: number
}

export function AgentsGrid({ visible, agentsVisible }: AgentsGridProps) {
  const wrapCls = `ob-grid-wrap${visible ? ' ob-grid-wrap--visible' : ' ob-grid-wrap--hidden'}`

  return (
    <div className={wrapCls} aria-hidden={!visible}>
      <div className="ob-grid">
        {SCENE_AGENTS.map((a, i) => {
          const cardVisible = i < agentsVisible
          const cardCls = `ob-card${cardVisible ? ' ob-card--visible' : ' ob-card--hidden'}`
          return (
            <div key={a.id} className={cardCls} aria-hidden={!cardVisible}>
              <div className="ob-card__avatar" aria-hidden>{a.initials}</div>
              <div className="ob-card__id">
                <div className="ob-card__name">{a.name}</div>
                <div className="ob-card__role">{a.role}</div>
              </div>
              <div className="ob-card__dot" aria-hidden />
            </div>
          )
        })}
      </div>
    </div>
  )
}
