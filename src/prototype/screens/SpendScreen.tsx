import { useEffect, useState } from 'react'
import { Badge, Box, Code, Flex, Grid, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, InfoHint, MetricCard, Pagination } from '../components/common'
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
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

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
  const pageStart = page * pageSize
  const pageItems = items.slice(pageStart, pageStart + pageSize)
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
                Loaded via <Code variant="ghost">GET /dashboard/spend</Code> with <Code variant="ghost">range</Code> and <Code variant="ghost">group_by</Code> parameters. Only cost and token aggregates are returned.
              </InfoHint>
            </>
          }
          title={<>{money(data.total_usd, { compact: true })} <em>spent</em></>}
          subtitle="Aggregated spend by agent or by user."
        />

        {/* Controls */}
        <Flex align="center" gap="2" mb="4" wrap="wrap">
          <Caption mr="1">range</Caption>
          {RANGES.map(r => (
            <Badge
              key={r}
              asChild
              color={range === r ? 'blue' : 'gray'}
              variant={range === r ? 'soft' : 'outline'}
              radius="full"
              size="1"
            >
              <button type="button" onClick={() => { setRange(r); setPage(0) }}>
                {r}
              </button>
            </Badge>
          ))}
          <span style={{ width: 1, height: 16, background: 'var(--gray-6)', margin: '0 6px' }} />
          <Caption mr="1">group_by</Caption>
          {GROUPINGS.map(g => (
            <Badge
              key={g}
              asChild
              color={groupBy === g ? 'blue' : 'gray'}
              variant={groupBy === g ? 'soft' : 'outline'}
              radius="full"
              size="1"
            >
              <button type="button" onClick={() => { setGroupBy(g); setPage(0) }}>
                {g}
              </button>
            </Badge>
          ))}
        </Flex>

        {/* Summary cards — all derived from the response */}
        <Grid columns="3" gap="4" mb="4">
          <MetricCard
            label="Total spend"
            value={money(data.total_usd, { compact: true })}
            unit="USD"
            delta="across the selected window"
          />
          <MetricCard
            label="Total runs"
            value={num(totalRuns)}
            delta={`across ${items.length} ${groupBy}${items.length === 1 ? '' : 's'}`}
          />
          <MetricCard
            label="tokens · in / out"
            value={num(Math.round((totalTokensIn + totalTokensOut) / 1000))}
            unit="k"
            delta={`in ${num(Math.round(totalTokensIn / 1000))}k · out ${num(Math.round(totalTokensOut / 1000))}k`}
          />
        </Grid>

        {/* Horizontal bars — derived from items */}
        {!empty && (
          <Box asChild mb="4">
            <div className="card">
            <div className="card__head">
              <Text as="div" size="2" weight="medium" className="card__title">Spend by {groupBy}</Text>
              <Badge color="gray" variant="soft" radius="full" size="1">{items.length} {groupBy}{items.length === 1 ? '' : 's'}</Badge>
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
                    <Text as="div" size="1" className="truncate">{r.label}</Text>
                    <div className="spend-row__bar-track" style={{ height: 14 }}>
                      <div
                        className="spend-row__bar-fill"
                        style={{ width: `${Math.max(2, share * 100)}%` }}
                      />
                    </div>
                    <Text as="div" size="1" style={{ textAlign: 'right' }}>
                      {money(r.total_usd, { compact: true })}{' '}
                      <Text color="gray">· {pctOfTotal.toFixed(1)}%</Text>
                    </Text>
                  </div>
                )
              })}
            </div>
            </div>
          </Box>
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
                background: 'var(--gray-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
              }}
            >
              <Text as="span" size="1" color="gray">{groupBy}</Text>
              <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>spend</Text>
              <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>runs</Text>
              <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>tokens in</Text>
              <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>tokens out</Text>
              <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>date</Text>
            </div>
            {pageItems.map(r => {
              const rowInner = (
                <>
                  <div style={{ minWidth: 0 }}>
                    <Flex align="center" gap="2">
                      {groupBy === 'agent' && (
                        <span style={{ color: 'var(--gray-10)' }}>
                          <IconAgent className="ic ic--sm" />
                        </span>
                      )}
                      <Text as="div" size="2" className="truncate">{r.label}</Text>
                    </Flex>
                    <Text as="div" size="1" color="gray" mt="1">
                      {r.id}
                    </Text>
                  </div>
                  <Text as="div" size="2" style={{ textAlign: 'right' }}>
                    {money(r.total_usd, { cents: r.total_usd < 100 })}
                  </Text>
                  <Text as="div" size="1" style={{ textAlign: 'right' }}>
                    {num(r.run_count)}
                  </Text>
                  <Text as="div" size="1" color="gray" style={{ textAlign: 'right' }}>
                    {num(r.total_tokens_in)}
                  </Text>
                  <Text as="div" size="1" color="gray" style={{ textAlign: 'right' }}>
                    {num(r.total_tokens_out)}
                  </Text>
                  <Text as="div" size="1" color="gray" style={{ textAlign: 'right' }}>
                    {r.spend_date ? shortDate(r.spend_date) : '—'}
                  </Text>
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
            <Pagination
              page={page}
              pageSize={pageSize}
              total={items.length}
              onPageChange={setPage}
              onPageSizeChange={n => { setPageSize(n); setPage(0) }}
              label={`${groupBy}s`}
            />
          </div>
        )}

      </div>
    </AppShell>
  )
}
