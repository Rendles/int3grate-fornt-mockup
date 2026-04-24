import { useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money } from '../../lib/format'

// SAVINGS BANNER — cumulative value generated over 30 days.
// Data is synthesized until the backend exposes two fields:
//   Agent.baseline_human_minutes  and  Tenant.hourly_rate_usd.
// When those land, swap buildSavings() for real bucketed data.

function buildSavings(days = 30) {
  const out: { value: number; date: Date }[] = []
  const today = new Date()
  const BASELINE_MINUTES = 38
  const HOURLY_RATE = 75
  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - (days - 1 - i))
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6
    const seed = ((i * 131 + 37) % 997) / 997
    const growth = 1 + i * 0.012
    const dailyTasks = Math.round(
      (isWeekend ? 22 : 68) * (0.75 + seed * 0.5) * growth,
    )
    const value = Math.round((dailyTasks * BASELINE_MINUTES / 60) * HOURLY_RATE)
    out.push({ value, date: d })
  }
  return out
}

interface ChartPoint {
  date: Date
  value: number
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function SavingsBanner() {
  const chartData = useMemo<ChartPoint[]>(() => {
    let acc = 0
    return buildSavings(30).map(d => {
      acc += d.value
      return { date: d.date, value: acc }
    })
  }, [])

  const n = chartData.length
  const totalValue = chartData[n - 1].value
  const yTicks = [totalValue * 0.33, totalValue * 0.66]
  const xTickIndices = [0, Math.floor((n - 1) / 2), n - 1]

  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const hoverPoint = hoverIdx != null ? chartData[hoverIdx] : null

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const idx = Math.round((x / rect.width) * (n - 1))
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)))
  }

  return (
    <div
      ref={containerRef}
      className="card card--flush sv-a"
      onMouseMove={handleMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <div className="sv-a__chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="sv-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-a6)" />
                <stop offset="100%" stopColor="var(--accent-a1)" />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--gray-a4)"
              strokeDasharray="2 4"
            />
            <XAxis dataKey="date" hide padding={{ left: 0, right: 0 }} />
            <YAxis hide domain={[0, totalValue]} ticks={yTicks} />
            <Tooltip
              cursor={{ stroke: 'var(--accent-a8)', strokeWidth: 1 }}
              content={() => null}
            />
            <Area
              type="linear"
              dataKey="value"
              stroke="var(--accent-9)"
              strokeWidth={1.5}
              fill="url(#sv-grad)"
              isAnimationActive={false}
              dot={false}
              activeDot={{
                r: 4.5,
                fill: 'var(--accent-9)',
                stroke: 'var(--color-panel-solid)',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="sv-a__overlay">
        <div className="sv-a__label">Savings · 30 days</div>
        <div className="sv-a__value">{money(totalValue, { compact: false })}</div>
      </div>

      <div className="sv-a__y-axis">
        {[0.33, 0.66].map(t => (
          <span key={t} style={{ bottom: `${t * 100}%` }}>
            {money(totalValue * t, { compact: true })}
          </span>
        ))}
      </div>

      <div className="sv-a__x-axis">
        {xTickIndices.map((idx, i) => (
          <span
            key={idx}
            style={{
              left: `${(idx / (n - 1)) * 100}%`,
              transform:
                i === 0
                  ? 'translateX(0)'
                  : i === xTickIndices.length - 1
                    ? 'translateX(-100%)'
                    : 'translateX(-50%)',
            }}
          >
            {fmtDate(chartData[idx].date)}
          </span>
        ))}
      </div>

      {hoverPoint && (
        <div className="sv-a__tooltip">
          <div className="sv-a__tooltip-date">{fmtDate(hoverPoint.date)}</div>
          <div className="sv-a__tooltip-value">
            {money(hoverPoint.value, { compact: false })}
          </div>
        </div>
      )}
    </div>
  )
}
