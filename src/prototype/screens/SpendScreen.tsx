import { useEffect, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Chip, InfoHint } from '../components/common'
import { EmptyState, ErrorState, LoadingList, NoAccessState } from '../components/states'
import { IconAgent, IconArrowRight, IconSpend } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { SpendDashboard, SpendGroupBy, SpendRange } from '../lib/types'
import { money, num, shortDate } from '../lib/format'

const RANGES: SpendRange[] = ['1d', '7d', '30d', '90d']
const GROUPINGS: SpendGroupBy[] = ['agent', 'user']

const TABLE_COLS = 'minmax(0, 1fr) 120px 80px 90px 90px 110px'

export default function SpendScreen() {
  const { user } = useAuth()
  const [data, setData] = useState<SpendDashboard | null>(null)
  const [range, setRange] = useState<SpendRange>('7d')
  const [groupBy, setGroupBy] = useState<SpendGroupBy>('agent')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const canView = !!user && (user.role === 'admin' || user.role === 'domain_admin')

  useEffect(() => {
    if (!canView) return
    let cancelled = false
    api.getSpend(range, groupBy)
      .then(d => {
        if (cancelled) return
        setData(d)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load')
      })
    return () => { cancelled = true }
  }, [range, groupBy, canView, reloadTick])

  const crumbs = [{ label: 'home', to: '/' }, { label: 'spend' }]

  if (!canView) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="page">
          <NoAccessState
            requiredRole="Admin or Domain Admin"
            body="Spend analytics are scoped to admins."
          />
        </div>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="page">
          <ErrorState title="Couldn't load spend" body={error} onRetry={() => setReloadTick(t => t + 1)} />
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
  const totalTokensIn = items.reduce((s, r) => s + r.total_tokens_in, 0)
  const totalTokensOut = items.reduce((s, r) => s + r.total_tokens_out, 0)
  const totalRuns = items.reduce((s, r) => s + r.run_count, 0)
  const sorted = [...items].sort((a, b) => b.total_usd - a.total_usd)
  const maxSpend = Math.max(...items.map(r => r.total_usd), 0.0001)
  const empty = items.length === 0

  return (
    <AppShell crumbs={crumbs}>
      <div className="page page--wide" style={{ opacity: stale ? 0.55 : 1, transition: 'opacity 180ms' }}>
        <PageHeader
          eyebrow={
            <>
              {`SPEND · ${data.range} · ${data.group_by}`}{' '}
              <InfoHint>
                Loaded via <span className="mono">GET /dashboard/spend</span> with <span className="mono">range</span> and <span className="mono">group_by</span> parameters. Only cost and token aggregates are returned.
              </InfoHint>
            </>
          }
          title={<>{money(data.total_usd, { compact: true })} <em>spent</em></>}
          subtitle="Aggregated spend by agent or by user."
        />

        {/* Controls */}
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
          <span className="mono uppercase muted" style={{ marginRight: 4 }}>group_by</span>
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

        {/* Summary cards — all derived from the response */}
        <div className="grid grid--3" style={{ marginBottom: 18 }}>
          <div className="card card--metric">
            <div className="card__body">
              <div className="metric__label">Total spend</div>
              <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                <div className="metric__value">{money(data.total_usd, { compact: true })}</div>
                <span className="metric__unit">USD</span>
              </div>
              <div className="metric__delta">across the selected window</div>
            </div>
          </div>
          <div className="card card--metric">
            <div className="card__body">
              <div className="metric__label">Total runs</div>
              <div className="metric__value">{num(totalRuns)}</div>
              <div className="metric__delta">across {items.length} {groupBy}{items.length === 1 ? '' : 's'}</div>
            </div>
          </div>
          <div className="card card--metric">
            <div className="card__body">
              <div className="metric__label">tokens · in / out</div>
              <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                <div className="metric__value">{num(Math.round((totalTokensIn + totalTokensOut) / 1000))}</div>
                <span className="metric__unit">k</span>
              </div>
              <div className="metric__delta">
                in {num(Math.round(totalTokensIn / 1000))}k · out {num(Math.round(totalTokensOut / 1000))}k
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal bars — derived from items */}
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
        {empty ? (
          <EmptyState
            icon={<IconSpend />}
            title={`No spend in the ${data.range} window`}
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
              <span style={{ textAlign: 'right' }}>spend</span>
              <span style={{ textAlign: 'right' }}>runs</span>
              <span style={{ textAlign: 'right' }}>tokens in</span>
              <span style={{ textAlign: 'right' }}>tokens out</span>
              <span style={{ textAlign: 'right' }}>date</span>
            </div>
            {items.map(r => {
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
                      {r.id}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 13, color: 'var(--text)', textAlign: 'right' }}>
                    {money(r.total_usd, { cents: r.total_usd < 100 })}
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>
                    {num(r.run_count)}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                    {num(r.total_tokens_in)}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                    {num(r.total_tokens_out)}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
                    {r.spend_date ? shortDate(r.spend_date) : '—'}
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
                    <IconArrowRight className="ic" style={{ display: 'none' }} />
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

      </div>
    </AppShell>
  )
}
