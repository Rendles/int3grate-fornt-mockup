import { useMemo } from 'react'
import { Flex, Text, Tooltip } from '@radix-ui/themes'
import { IconAgent } from '../../components/icons'
import { MockBadge } from '../../components/common'

// ACTIVITY HEATMAP — 7 days × 24 hours of fleet run volume.
// Data is synthesized deterministically (no real /runs endpoint in the proto)
// to show a believable weekday-business-hours pattern.

const DAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildActivityGrid(): number[][] {
  const grid: number[][] = []
  const today = new Date()
  for (let d = 0; d < 7; d++) {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - d))
    const dow = date.getDay()
    const isWeekend = dow === 0 || dow === 6
    const row: number[] = []
    for (let h = 0; h < 24; h++) {
      const businessPeak = Math.exp(-((h - 14) ** 2) / 22)
      const nightDamp = h >= 22 || h < 6 ? 0.18 : 1
      const base = (isWeekend ? 1.4 : 5.5) * businessPeak * nightDamp
      // Deterministic pseudo-random per (day, hour).
      const seed = ((d * 131 + h * 37 + 19) % 997) / 997
      row.push(Math.max(0, Math.round(base * (0.55 + seed * 1.3))))
    }
    grid.push(row)
  }
  return grid
}

function cellStep(count: number, max: number): number {
  if (count === 0) return 0
  const r = count / Math.max(1, max)
  if (r < 0.15) return 1
  if (r < 0.35) return 2
  if (r < 0.6) return 3
  if (r < 0.82) return 4
  return 5
}

const STEP_COLOR = [
  'var(--gray-a2)',
  'var(--accent-a3)',
  'var(--accent-a5)',
  'var(--accent-a7)',
  'var(--accent-a9)',
  'var(--accent-a11)',
] as const

export function ActivityHeatmap() {
  const grid = useMemo(() => buildActivityGrid(), [])
  const max = useMemo(() => Math.max(...grid.flat(), 1), [grid])

  const dayLabels = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (6 - i))
      return DAY_ABBREV[d.getDay()]
    })
  }, [])

  return (
    <div className="card card--flush">
      <div className="card__head">
        <Flex align="center" gap="2">
          <Text as="div" size="2" weight="medium" className="card__title">
            <IconAgent className="ic" />
            Team activity · 7 days
          </Text>
          <MockBadge kind="design" hint="Activity heatmap is synthesized client-side. Backend doesn't expose hourly action aggregates yet." />
        </Flex>
        <div className="heatmap__legend">
          <span>less</span>
          <div className="heatmap__legend-scale">
            {STEP_COLOR.map((c, i) => (
              <span key={i} style={{ background: c }} />
            ))}
          </div>
          <span>more</span>
        </div>
      </div>
      <div className="heatmap">
        <div className="heatmap__hours">
          <span />
          <div className="heatmap__hour-ticks">
            {[0, 6, 12, 18, 23].map(h => (
              <span key={h} style={{ gridColumn: `${h + 1} / span 1` }}>
                {h.toString().padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>
        {grid.map((row, day) => (
          <div key={day} className="heatmap__row">
            <span className="heatmap__day">{dayLabels[day]}</span>
            <div className="heatmap__cells">
              {row.map((count, hour) => (
                <Tooltip
                  key={hour}
                  content={`${count} actions · ${dayLabels[day]} ${hour.toString().padStart(2, '0')}:00`}
                >
                  <span
                    className="heatmap__cell"
                    style={{ background: STEP_COLOR[cellStep(count, max)] }}
                  />
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
