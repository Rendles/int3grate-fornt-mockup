// Single agent card in the 2×2 roster grid.
//
// State-driven everything. The parent (HeroRosterLoop) computes which state
// this agent is in for the current phase; this component looks up the
// task/meta copy from the agent's state map and applies CSS classes so the
// top-border accent, status pill colour, ✓ icon visibility, progress-strip
// visibility, and corner pulse dot all light up in the right state.

import { STATE_LABEL, type AgentScene, type AgentState } from '../scene-data'

interface AgentCardProps {
  agent: AgentScene
  state: AgentState
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 8.5 6.5 12 13 5" />
    </svg>
  )
}

export function AgentCard({ agent, state }: AgentCardProps) {
  const content = agent.states[state]
  const cls = `hr-card hr-card--${state}`
  const isDone = state === 'done'

  return (
    <div className={cls} data-target={`card-${agent.id}`}>
      <div className="hr-card__top">
        <div className="hr-card__avatar" aria-hidden>{agent.initials}</div>
        <div className="hr-card__id">
          <div className="hr-card__name">{agent.name}</div>
          <div className="hr-card__role">{agent.role}</div>
        </div>
        <div className="hr-card__pill" aria-hidden>{STATE_LABEL[state]}</div>
      </div>

      <div className="hr-card__body">
        <div className="hr-card__task">
          {isDone && (
            <span className="hr-card__check" aria-hidden>
              <CheckIcon />
            </span>
          )}
          <span className="hr-card__task-text">{content.task}</span>
        </div>
        <div className="hr-card__meta">{content.meta}</div>
      </div>

      <div className="hr-card__progress" aria-hidden>
        <div className="hr-card__progress-bar" />
      </div>
    </div>
  )
}
