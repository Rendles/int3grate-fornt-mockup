import { useEffect, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Sparkbar } from '../components/common'
import { Banner, LoadingList } from '../components/states'
import { IconArrowDown, IconArrowUp, IconFilter } from '../components/icons'
import { api } from '../lib/api'
import type { SpendDashboard, SpendGroupBy, SpendRange } from '../lib/types'
import { money, num, pct } from '../lib/format'

const RANGES: SpendRange[] = ['1d', '7d', '30d', '90d']
const GROUPINGS: SpendGroupBy[] = ['agent', 'user']

export default function SpendScreen() {
  const [data, setData] = useState<SpendDashboard | null>(null)
  const [range, setRange] = useState<SpendRange>('30d')
  const [groupBy, setGroupBy] = useState<SpendGroupBy>('agent')

  useEffect(() => {
    let cancelled = false
    api.getSpend(range, groupBy).then(d => {
      if (!cancelled) setData(d)
    })
    return () => { cancelled = true }
  }, [range, groupBy])

  const stale = data && (data.range !== range || data.group_by !== groupBy)

  if (!data) {
    return (
      <AppShell crumbs={[{ label: 'app', to: '/' }, { label: 'spend' }]}>
        <div className="page"><LoadingList rows={6} /></div>
      </AppShell>
    )
  }

  const capPct = data.cap_usd ? Math.round((data.total_usd / data.cap_usd) * 100) : 0
  const burnArr = data.burn_per_day ?? []
  const maxBurn = Math.max(...burnArr, 0.001)

  return (
    <AppShell crumbs={[{ label: 'app', to: '/' }, { label: 'spend' }]}>
      <div className="page page--wide" style={{ opacity: stale ? 0.55 : 1, transition: 'opacity 180ms' }}>
        <PageHeader
          eyebrow={<>{`SPEND · ${data.window_label?.toUpperCase() ?? data.range.toUpperCase()}`}</>}
          title={<>Who's <em>burning</em>, and on what.</>}
          subtitle="Rolled up across agents or users. Caps are advisory in this prototype — in production the orchestrator gates runs once caps are reached."
          actions={
            <>
              <Btn variant="ghost" icon={<IconFilter />}>Window · {data.range}</Btn>
              <Btn variant="ghost">Export CSV</Btn>
            </>
          }
        />

        <div className="row" style={{ gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <span className="mono uppercase muted" style={{ marginRight: 4 }}>range</span>
          {RANGES.map(r => (
            <button
              key={r}
              className={`chip${range === r ? ' chip--accent' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
          <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 6px' }} />
          <span className="mono uppercase muted" style={{ marginRight: 4 }}>group by</span>
          {GROUPINGS.map(g => (
            <button
              key={g}
              className={`chip${groupBy === g ? ' chip--accent' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setGroupBy(g)}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="grid grid--4" style={{ marginBottom: 24 }}>
          <div className="card card--metric">
            <div className="card__body">
              <div className="metric__label">Total · {data.range}</div>
              <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                <div className="metric__value">{money(data.total_usd, { compact: true })}</div>
                <span className="metric__unit">USD</span>
              </div>
              <div className={`metric__delta ${(data.total_spend_delta_pct ?? 0) >= 0 ? 'metric__delta--up' : 'metric__delta--down'}`}>
                {(data.total_spend_delta_pct ?? 0) >= 0 ? <IconArrowUp className="ic ic--sm" /> : <IconArrowDown className="ic ic--sm" />}
                {pct(data.total_spend_delta_pct ?? 0)} vs prior period
              </div>
            </div>
          </div>
          <div className="card card--metric">
            <div className="card__body">
              <div className="metric__label">Runs</div>
              <div className="metric__value">{num(data.total_runs ?? 0)}</div>
              <div className={`metric__delta ${(data.total_runs_delta_pct ?? 0) >= 0 ? 'metric__delta--up' : 'metric__delta--down'}`}>
                {(data.total_runs_delta_pct ?? 0) >= 0 ? <IconArrowUp className="ic ic--sm" /> : <IconArrowDown className="ic ic--sm" />}
                {pct(data.total_runs_delta_pct ?? 0)} vs prior period
              </div>
            </div>
          </div>
          <div className="card card--metric">
            <div className="card__body">
              <div className="metric__label">Avg cost per run</div>
              <div className="metric__value">{money(data.avg_cost_per_run_usd ?? 0, { cents: true })}</div>
              <div className="metric__delta">{num(data.total_runs ?? 0)} runs · ${Math.round(data.total_usd)} total</div>
            </div>
          </div>
          <div className="card card--metric" style={{ borderColor: capPct >= 80 ? 'var(--warn-border)' : undefined }}>
            <div className="card__body">
              <div className="metric__label">Cap utilisation</div>
              <div className="metric__value" style={{ color: capPct >= 85 ? 'var(--warn)' : 'var(--text)' }}>
                {capPct}<span className="metric__unit">%</span>
              </div>
              <div className="spend-row__bar-track" style={{ marginTop: 10 }}>
                <div
                  className="spend-row__bar-fill"
                  style={{
                    width: `${Math.min(100, capPct)}%`,
                    background: capPct >= 85 ? 'linear-gradient(90deg, var(--warn), var(--danger))' : undefined,
                  }}
                />
              </div>
              <div className="metric__delta">of {money(data.cap_usd ?? 0)} period cap</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card__head">
            <div className="card__title">Daily burn · {data.window_label}</div>
            <Chip tone="accent">range · {data.range}</Chip>
          </div>
          <div className="card__body">
            <div className="chart-bars" style={{ height: 220 }}>
              {burnArr.map((v, i) => (
                <div key={i} className="chart-bar" style={{ height: `${(v / maxBurn) * 100}%`, opacity: i === burnArr.length - 1 ? 1 : 0.6 + (i / burnArr.length) * 0.4 }} title={`Day ${i + 1}: ${money(v, { cents: true })}`} />
              ))}
            </div>
            <div className="row row--between" style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)' }}>
              <span className="mono">day 1</span>
              <span className="mono">today</span>
            </div>
          </div>
        </div>

        <div className="row row--between" style={{ marginBottom: 14 }}>
          <div className="mono uppercase muted">
            grouped by {groupBy} · {data.items.length} rows · total {money(data.total_usd, { compact: true })}
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="spend-row" style={{ background: 'var(--surface-2)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            <span>{groupBy}</span>
            <span style={{ textAlign: 'right' }}>spend</span>
            <span style={{ textAlign: 'right' }}>runs</span>
            <span style={{ textAlign: 'right' }}>delta</span>
            <span>trend · 14d</span>
            <span style={{ textAlign: 'right' }}>tokens</span>
          </div>
          {data.items.map(r => (
            <div key={r.id} className="spend-row">
              <div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{r.label}</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                  {r.sub_label ?? r.kind ?? groupBy}
                </div>
              </div>
              <div>
                <div className="mono" style={{ fontSize: 13, color: 'var(--text)', textAlign: 'right' }}>
                  {money(r.total_usd, { cents: r.total_usd < 100 })}
                </div>
                {r.cap_usd && (
                  <div className="spend-row__bar-track" style={{ marginTop: 6 }}>
                    <div className="spend-row__bar-fill" style={{ width: `${Math.min(100, (r.total_usd / r.cap_usd) * 100)}%` }} />
                  </div>
                )}
              </div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>
                {num(r.run_count)}
              </div>
              <div className={`mono${(r.delta_pct ?? 0) > 0 ? ' warn' : (r.delta_pct ?? 0) < 0 ? ' success' : ''}`} style={{ fontSize: 11, textAlign: 'right' }}>
                {pct(r.delta_pct ?? 0)}
              </div>
              <Sparkbar values={r.trend ?? []} accent={(r.delta_pct ?? 0) >= 10} height={22} />
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                {num(Math.round(r.tokens_in / 1000))}k / {num(Math.round(r.tokens_out / 1000))}k
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: 24 }} />

        <Banner tone="info" title="Dashboard shape">
          <>
            <span className="mono">GET /dashboard/spend</span> returns <span className="mono">{'{range, group_by, total_usd, items}'}</span>. Each row carries <span className="mono">total_usd</span>, <span className="mono">tokens_in/out</span>, <span className="mono">run_count</span>, <span className="mono">spend_date</span>. Currently supported group-by values: <Chip>agent</Chip> <Chip>user</Chip>.
          </>
        </Banner>
      </div>
    </AppShell>
  )
}
