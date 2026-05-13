// Three-tile KPI strip — slides in from above when the dashboard wakes up.
// Each tile flashes briefly when its value changes (handled in
// HeroOnboardingLoop via a key on the value span — Element identity change
// forces re-mount and re-fires the CSS keyframe).

import type { KpiValues } from '../phases'
import { KPI_LABELS } from '../scene-data'

interface KpiStripProps {
  visible: boolean
  kpi: KpiValues
}

export function KpiStrip({ visible, kpi }: KpiStripProps) {
  const cls = `ob-kpi${visible ? ' ob-kpi--visible' : ' ob-kpi--hidden'}`

  return (
    <div className={cls} aria-hidden={!visible}>
      <div className="ob-kpi__tile">
        <div className="ob-kpi__value" key={`active-${kpi.active}`}>{kpi.active}</div>
        <div className="ob-kpi__label">{KPI_LABELS.active}</div>
      </div>
      <div className="ob-kpi__tile">
        <div className="ob-kpi__value" key={`done-${kpi.done}`}>{kpi.done}</div>
        <div className="ob-kpi__label">{KPI_LABELS.done}</div>
      </div>
      <div className="ob-kpi__tile ob-kpi__tile--spend">
        <div className="ob-kpi__value" key={`spend-${kpi.spend}`}>{kpi.spend}</div>
        <div className="ob-kpi__label">{KPI_LABELS.spend}</div>
      </div>
    </div>
  )
}
