// Activity view — fourth surface of the journey scene. Cross-faded into
// after the chat beat, then crossed back to the dashboard (updated state)
// for the loop reset.
//
// Visual model: eyebrow + 3 recent activity rows. Top row marked "fresh"
// to anchor the eye on the most recent event (the one we just produced
// in the chat view). No per-row animation — the whole view fades as a
// unit during view transitions.

import { SCENE_ACTIVITY } from '../scene-data'

export function ActivityTicker() {
  return (
    <div className="hjl-activity">
      <div className="hjl-activity__head">
        <div className="hjl-activity__eyebrow">RECENT ACTIVITY</div>
        <div className="hjl-activity__hint">across your team</div>
      </div>

      <div className="hjl-activity__list">
        {SCENE_ACTIVITY.map((item, i) => (
          <div
            key={`${item.initials}-${i}`}
            className={`hjl-act${i === 0 ? ' hjl-act--fresh' : ''}`}
          >
            <div className="hjl-act__avatar" aria-hidden>{item.initials}</div>
            <div className="hjl-act__body">
              <div className="hjl-act__agent">{item.agent}</div>
              <div className="hjl-act__action">{item.action}</div>
            </div>
            <div className="hjl-act__ago">{item.ago}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
