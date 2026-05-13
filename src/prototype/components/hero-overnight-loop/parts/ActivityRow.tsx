// Single row of the overnight activity ribbon. Three states:
//   hidden  — collapsed (max-height 0, opacity 0); row hasn't arrived yet.
//   visible — fully rendered.
//   gone    — collapsed (same idiom as hidden but transitions from visible);
//             row scrolled out the top.
//
// "needs-you" rows get an orange left-border accent + small orange pill
// beside the time.

import type { ActivityItem } from '../scene-data'
import type { RowState } from '../phases'

interface ActivityRowProps {
  item: ActivityItem
  state: RowState
}

export function ActivityRow({ item, state }: ActivityRowProps) {
  const cls = [
    'ho-row',
    `ho-row--${state}`,
    item.kind === 'needs-you' ? 'ho-row--needs' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls} aria-hidden={state !== 'visible'}>
      <div className="ho-row__avatar" aria-hidden>{item.initials}</div>
      <div className="ho-row__body">
        <div className="ho-row__name">{item.agentName}</div>
        <div className="ho-row__action">{item.action}</div>
      </div>
      <div className="ho-row__right">
        {item.kind === 'needs-you' && (
          <span className="ho-row__pill" aria-hidden>needs you</span>
        )}
        <span className="ho-row__time">{item.time}</span>
      </div>
    </div>
  )
}
