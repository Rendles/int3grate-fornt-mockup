// Morning summary card. Slides up from below into a pre-reserved bottom
// slot at phase 'morning-summary-enter'. Three stat blocks side-by-side:
// done (jade), need-you (orange), spent (white/neutral).

import { SCENE_SUMMARY } from '../scene-data'

interface SummaryCardProps {
  visible: boolean
}

export function SummaryCard({ visible }: SummaryCardProps) {
  const cls = `ho-summary ho-summary--${visible ? 'visible' : 'hidden'}`
  return (
    <div className={cls} aria-hidden={!visible}>
      <div className="ho-summary__head">
        <span className="ho-summary__eyebrow">{SCENE_SUMMARY.eyebrow}</span>
        <span className="ho-summary__time">{SCENE_SUMMARY.time}</span>
      </div>
      <div className="ho-summary__metrics">
        {SCENE_SUMMARY.metrics.map(m => (
          <div key={m.label} className={`ho-summary__metric ho-summary__metric--${m.tone}`}>
            <div className="ho-summary__value">{m.value}</div>
            <div className="ho-summary__label">{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
