import { useEffect, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, MockBadge, BackendGapBanner } from '../components/common'
import { Banner, EmptyState, ErrorState, LoadingList, NoAccessState } from '../components/states'
import { IconAgent, IconArrowDown, IconArrowRight, IconArrowUp, IconSpend } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { SpendDashboard, SpendGroupBy, SpendRange } from '../lib/types'
import { money, num, pct, shortDate } from '../lib/format'

const RANGES: SpendRange[] = ['1d', '7d', '30d', '90d']
const GROUPINGS: SpendGroupBy[] = ['agent', 'user']

const TABLE_COLS = 'minmax(0, 1fr) 110px 70px 90px 92px 92px'

export default function SpendScreen() {
  const { user } = useAuth()
  const [data, setData] = useState<SpendDashboard | null>(null)
  const [range, setRange] = useState<SpendRange>('30d')
  const [groupBy, setGroupBy] = useState<SpendGroupBy>('agent')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const canView = !!user && (user.role === 'admin' || user.role === 'domain_admin')

  useEffect(() => {
    if (!canView) return
    let cancelled = false
    setError(null)
    setData(null)
    api.getSpend(range, groupBy)
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError((e as Error).message ?? 'Failed to load') })
    return () => { cancelled = true }
  }, [range, groupBy, canView, reloadTick])

  const crumbs = [{ label: 'home', to: '/' }, { label: 'spend' }]

  if (!canView) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="page">
          <NoAccessState
            requiredRole="Admin or Domain Admin"
            body="Spend analytics are scoped to admins. Members don't see tenant-wide cost rollups."
          />
        </div>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="page">
          <ErrorState
            title="Couldn't load spend"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        </div>
      </AppShell>
    )
  }

  if (!data) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="page"><LoadingList rows={6} /></div>
      </AppShell>
    )
  }

  const stale = data.range !== range || data.group_by !== groupBy
  const items = data.items
  const totalTokensIn = items.reduce((s, r) => s + r.tokens_in, 0)
  const totalTokensOut = items.reduce((s, r) => s + r.tokens_out, 0)
  const totalTokens = totalTokensIn + totalTokensOut
  const sorted = [...items].sort((a, b) => b.total_usd - a.total_usd)
  const topItem = sorted[0] ?? null
  const maxSpend = Math.max(...items.map(r => r.total_usd), 0.0001)
  const empty = items.length === 0

  return (
    <AppShell crumbs={crumbs}>
      <div className="page page--wide" style={{ opacity: stale ? 0.55 : 1, transition: 'opacity 180ms' }}>
        <PageHeader
          eyebrow={<>{`SPEND · ${(data.window_label ?? data.range).toUpperCase()} · GROUPED BY ${data.group_by.toUpperCase()}`}</>}
          title={<>{money(data.total_usd, { compact: true })} <em>spent</em></>}
          subtitle={
            <>
              Across {num(data.total_runs ?? 0)} runs in the {data.window_label ?? data.range} window. Spend analytics —
              cost and throughput only, not business value or ROI.
            </>
          }
          actions={
            <Btn
              variant="ghost"
              disabled
              title="Planned · CSV export not yet wired to backend"
            >
              Export CSV · planned
            </Btn>
          }
        />

        <BackendGapBanner
          title="Several spend metrics here aren't returned by /dashboard/spend"
          fields={[
            'total_runs',
            'avg cost per run',
            'period-over-period delta %',
            'window label',
            '"most expensive" callout',
            'share-of-total bar',
            'spend_date per row',
          ]}
          body={<>Backend response is <span className="mono">{'{range, group_by, total_usd, items[SpendRow]}'}</span>. Each SpendRow: <span className="mono">id, label, total_usd, total_tokens_in, total_tokens_out, run_count, spend_date</span>. Everything else is derived client-side.</>}
        />

        {/* Controls ── range + group_by */}
        <div className="row" style={{ gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
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

        {/* Summary cards */}
        <div className="grid grid--4" style={{ marginBottom: 18 }}>
          <div className="card card--metric">
            <div className="card__body">
              <div className="metric__label">Total spend · {data.range}</div>
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
              <div className="metric__label row row--sm">Total runs <MockBadge size="xs" /></div>
              <div className="metric__value">{num(data.total_runs ?? 0)}</div>
              <div className={`metric__delta ${(data.total_runs_delta_pct ?? 0) >= 0 ? 'metric__delta--up' : 'metric__delta--down'}`}>
                {(data.total_runs_delta_pct ?? 0) >= 0 ? <IconArrowUp className="ic ic--sm" /> : <IconArrowDown className="ic ic--sm" />}
                {pct(data.total_runs_delta_pct ?? 0)} vs prior period
              </div>
            </div>
          </div>
          <div className="card card--metric">
            <div className="card__body">
              <div className="metric__label row row--sm">Avg cost / run <MockBadge size="xs" /></div>
              <div className="metric__value">{money(data.avg_cost_per_run_usd ?? 0, { cents: true })}</div>
              <div className="metric__delta">
                {num(data.total_runs ?? 0)} runs · {money(data.total_usd, { compact: true })} total
              </div>
            </div>
          </div>
          <div className="card card--metric">
            <div className="card__body">
              <div className="metric__label">Total tokens</div>
              <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                <div className="metric__value">{num(Math.round(totalTokens / 1000))}</div>
                <span className="metric__unit">k</span>
              </div>
              <div className="metric__delta">
                in {num(Math.round(totalTokensIn / 1000))}k · out {num(Math.round(totalTokensOut / 1000))}k
              </div>
            </div>
          </div>
        </div>

        {/* Most expensive · callout */}
        {topItem && !empty && (
          <div className="card mock-outline" style={{ marginBottom: 18, borderColor: 'var(--warn-border)' }}>
            <div className="card__body">
              <div className="row row--between" style={{ gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="mono uppercase muted" style={{ fontSize: 10.5, marginBottom: 4 }}>
                    most expensive {groupBy} · this {data.range}
                  </div>
                  <div className="row row--sm" style={{ gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--text)' }}>
                      {topItem.label}
                    </div>
                    <Chip tone="warn">{Math.round((topItem.total_usd / Math.max(data.total_usd, 0.0001)) * 100)}% of total</Chip>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    {topItem.sub_label ? `${topItem.sub_label} · ` : ''}
                    {num(topItem.run_count)} runs · {money(topItem.run_count > 0 ? topItem.total_usd / topItem.run_count : 0, { cents: true })} avg/run
                  </div>
                </div>
                <div className="row row--sm" style={{ gap: 14 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--warn)' }}>
                    {money(topItem.total_usd, { compact: true })}
                  </div>
                  {groupBy === 'agent' && (
                    <Btn variant="ghost" size="sm" href={`/agents/${topItem.id}`}>
                      Open agent <IconArrowRight className="ic ic--sm" />
                    </Btn>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Spend by group · horizontal bar chart */}
        {!empty && (
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card__head">
              <div className="card__title">Spend by {groupBy}</div>
              <Chip>{items.length} {groupBy}{items.length === 1 ? '' : 's'}</Chip>
            </div>
            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map(r => {
                const share = r.total_usd / maxSpend
                const pctOfTotal = data.total_usd > 0 ? (r.total_usd / data.total_usd) * 100 : 0
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '180px minmax(0, 1fr) 150px',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <div className="truncate" style={{ fontSize: 12.5 }}>{r.label}</div>
                    <div className="spend-row__bar-track" style={{ height: 14 }}>
                      <div
                        className="spend-row__bar-fill"
                        style={{ width: `${Math.max(2, share * 100)}%` }}
                      />
                    </div>
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--text)', textAlign: 'right' }}>
                      {money(r.total_usd, { compact: true })}{' '}
                      <span className="muted">· {pctOfTotal.toFixed(1)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Breakdown table */}
        <div className="row row--between" style={{ marginBottom: 10 }}>
          <div className="mono uppercase muted">
            breakdown · {items.length} {groupBy}{items.length === 1 ? '' : 's'} · total {money(data.total_usd, { compact: true })}
          </div>
        </div>

        {empty ? (
          <EmptyState
            icon={<IconSpend />}
            title={`No spend in the ${data.window_label ?? data.range} window`}
            body="Once runs are attributed to agents or users, rollups land here. Try a wider range or check back after new runs complete."
          />
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div
              className="spend-row"
              style={{
                gridTemplateColumns: TABLE_COLS,
                background: 'var(--surface-2)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
              }}
            >
              <span>{groupBy}</span>
              <span style={{ textAlign: 'right' }}>total</span>
              <span style={{ textAlign: 'right' }}>runs</span>
              <span className="row row--sm" style={{ justifyContent: 'flex-end' }}>avg/run <MockBadge size="xs" /></span>
              <span style={{ textAlign: 'right' }}>tokens in</span>
              <span style={{ textAlign: 'right' }}>tokens out</span>
            </div>
            {items.map(r => {
              const avg = r.run_count > 0 ? r.total_usd / r.run_count : 0
              const rowInner = (
                <>
                  <div style={{ minWidth: 0 }}>
                    <div className="row row--sm">
                      {groupBy === 'agent' && (
                        <span style={{ color: 'var(--text-dim)' }}>
                          <IconAgent className="ic ic--sm" />
                        </span>
                      )}
                      <div className="truncate" style={{ fontSize: 13, color: 'var(--text)' }}>{r.label}</div>
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                      {r.sub_label ?? r.kind ?? groupBy}
                      {r.spend_date ? ` · ${shortDate(r.spend_date)}` : ''}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 13, color: 'var(--text)', textAlign: 'right' }}>
                    {money(r.total_usd, { cents: r.total_usd < 100 })}
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>
                    {num(r.run_count)}
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
                    {money(avg, { cents: true })}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                    {num(Math.round(r.tokens_in / 1000))}k
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                    {num(Math.round(r.tokens_out / 1000))}k
                  </div>
                </>
              )

              if (groupBy === 'agent') {
                return (
                  <Link
                    key={r.id}
                    to={`/agents/${r.id}`}
                    className="spend-row"
                    style={{
                      gridTemplateColumns: TABLE_COLS,
                      color: 'inherit',
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {rowInner}
                  </Link>
                )
              }
              return (
                <div
                  key={r.id}
                  className="spend-row"
                  style={{ gridTemplateColumns: TABLE_COLS }}
                >
                  {rowInner}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ height: 20 }} />

        <Banner tone="info" title="Dashboard shape">
          <>
            <span className="mono">GET /dashboard/spend</span> with <span className="mono">{'{range, group_by}'}</span> returns
            <span className="mono"> {'{total_usd, items[...]}'}</span>. Each row carries
            <span className="mono"> total_usd</span>,
            <span className="mono"> run_count</span>,
            <span className="mono"> tokens_in</span>,
            <span className="mono"> tokens_out</span>,
            <span className="mono"> spend_date</span>. Supported group-by values: <Chip>agent</Chip> <Chip>user</Chip>.
          </>
        </Banner>
      </div>
    </AppShell>
  )
}
