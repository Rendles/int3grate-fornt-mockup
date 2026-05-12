// 3 MetricCard-style tiles mirroring Home /AdminView's KPI strip.
// Active agents · Pending approvals (warn-toned, focal) · Spend · today.
//
// The Pending value animates: 5 in the early phases, 4 after the
// approve click. The Pending tile flashes briefly when the value changes.

import type { KpiValues } from '../scene-data'

interface KpiStripProps {
  values: KpiValues
  /** Pulse the orange Pending tile (idle-ish phases). */
  pendingPulse: boolean
  /** Dim all tiles while the queue is the focal area. */
  dim: boolean
  /** Flash the Pending tile (420ms) when the value just changed. */
  pendingFlash: boolean
}

export function KpiStrip({ values, pendingPulse, dim, pendingFlash }: KpiStripProps) {
  const wrapCls = `hjl-kpi${dim ? ' hjl-kpi--dim' : ''}`
  const pendingCls = [
    'hjl-kpi__tile',
    'hjl-kpi__tile--warn',
    pendingPulse ? 'hjl-kpi__tile--pulse' : '',
    pendingFlash ? 'hjl-kpi__tile--flash' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapCls}>
      <div className="hjl-kpi__tile">
        <div className="hjl-kpi__label">Active agents</div>
        <div className="hjl-kpi__value">{values.activeAgents}</div>
        <div className="hjl-kpi__caption">{values.activeAgentsCaption}</div>
      </div>

      <div className={pendingCls}>
        <div className="hjl-kpi__label">Pending approvals</div>
        <div className="hjl-kpi__value">{values.pendingCount}</div>
        <div className="hjl-kpi__caption">{values.pendingCaption}</div>
      </div>

      <div className="hjl-kpi__tile">
        <div className="hjl-kpi__label">Spend · today</div>
        <div className="hjl-kpi__value">{values.spend}</div>
        <div className="hjl-kpi__caption">{values.spendCaption}</div>
      </div>
    </div>
  )
}
