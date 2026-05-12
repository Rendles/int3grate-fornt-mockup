// 3 MetricCard-style tiles, mirroring the Home /AdminView KPI strip:
// Active agents · Pending approvals (orange-toned, focal) · Spend · today.
//
// The Pending value animates: 5 in idle/expanded phases, 4 after the
// approve click (success/next-incoming). The KPI tile flashes briefly
// when its value changes — the only KPI motion in the scene.

import { SCENE_KPI } from '../scene-data'

interface KpiStripProps {
  /** Override the displayed Pending value. */
  pendingCount: number
  /** Pulse the orange Pending tile (idle-ish phases). */
  pendingPulse: boolean
  /** Dim all tiles while the queue is the focal area. */
  dim: boolean
  /** Flash the pending tile (200ms) when the value just changed. */
  pendingFlash: boolean
}

export function KpiStrip({ pendingCount, pendingPulse, dim, pendingFlash }: KpiStripProps) {
  const k = SCENE_KPI

  const wrapCls = `hl-kpi${dim ? ' hl-kpi--dim' : ''}`
  const pendingCls = [
    'hl-kpi__tile',
    'hl-kpi__tile--warn',
    pendingPulse ? 'hl-kpi__tile--pulse' : '',
    pendingFlash ? 'hl-kpi__tile--flash' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapCls}>
      <div className="hl-kpi__tile">
        <div className="hl-kpi__label">Active agents</div>
        <div className="hl-kpi__value">{k.activeAgents}</div>
        <div className="hl-kpi__caption">{k.activeAgentsCaption}</div>
      </div>

      <div className={pendingCls}>
        <div className="hl-kpi__label">Pending approvals</div>
        <div className="hl-kpi__value">{pendingCount}</div>
        <div className="hl-kpi__caption">{k.pendingCaption}</div>
      </div>

      <div className="hl-kpi__tile">
        <div className="hl-kpi__label">Spend · today</div>
        <div className="hl-kpi__value">{k.spendValue}</div>
        <div className="hl-kpi__caption">{k.spendCaption}</div>
      </div>
    </div>
  )
}
