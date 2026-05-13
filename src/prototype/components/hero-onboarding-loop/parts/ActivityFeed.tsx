// Bottom activity feed — slides up from below when the dashboard wakes
// up. Rows fade in as activityRows advances 0 → 4.

import { SCENE_ACTIVITY } from '../scene-data'

interface ActivityFeedProps {
  visible: boolean
  rowsVisible: number
}

export function ActivityFeed({ visible, rowsVisible }: ActivityFeedProps) {
  const wrapCls = `ob-activity${visible ? ' ob-activity--visible' : ' ob-activity--hidden'}`

  return (
    <div className={wrapCls} aria-hidden={!visible}>
      <div className="ob-activity__head">
        <span className="ob-activity__title">Activity</span>
      </div>
      <div className="ob-activity__rows">
        {SCENE_ACTIVITY.map((row, i) => {
          const rowVisible = i < rowsVisible
          const cls = `ob-activity__row${rowVisible ? ' ob-activity__row--visible' : ' ob-activity__row--hidden'}`
          return (
            <div key={row.id} className={cls} aria-hidden={!rowVisible}>
              <div className="ob-activity__avatar" aria-hidden>{row.initials}</div>
              <div className="ob-activity__body">
                <span className="ob-activity__name">{row.agentName}</span>
                <span className="ob-activity__sep" aria-hidden>·</span>
                <span className="ob-activity__action">{row.action}</span>
              </div>
              <div className="ob-activity__ago">{row.ago}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
