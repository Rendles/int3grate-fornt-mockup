import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Flex, Grid, Heading, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, MockBadge, PageHeader, Pagination } from '../components/common'
import { EmptyState, ErrorState, LoadingList, NoAccessState } from '../components/states'
import { IconArrowRight, IconSpend } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { SpendDashboard, SpendGroupBy, SpendRange } from '../lib/types'
import { money, num, pct, shortDate } from '../lib/format'

const RANGES: SpendRange[] = ['1d', '7d', '30d', '90d']
const GROUPINGS: SpendGroupBy[] = ['agent', 'user']

export default function SpendScreen() {
  const { user } = useAuth()
  const [spendWeek, setSpendWeek] = useState<SpendDashboard | null>(null)
  const [spendMonth, setSpendMonth] = useState<SpendDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const canView = !!user && (user.role === 'admin' || user.role === 'domain_admin')

  useEffect(() => {
    if (!canView) return
    let cancelled = false
    Promise.all([api.getSpend('7d', 'agent'), api.getSpend('30d', 'agent')])
      .then(([w, m]) => {
        if (cancelled) return
        setSpendWeek(w)
        setSpendMonth(m)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load')
      })
    return () => { cancelled = true }
  }, [canView, reloadTick])

  const crumbs = [{ label: 'home', to: '/' }, { label: 'costs' }]

  if (!canView) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="page">
          <NoAccessState
            requiredRole="Workspace Admin or Team Admin"
            body="Cost details are only available to admins."
          />
        </div>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="page">
          <ErrorState title="Couldn't load costs" body={error} onRetry={() => setReloadTick(t => t + 1)} />
        </div>
      </AppShell>
    )
  }

  if (!spendWeek || !spendMonth) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="page"><LoadingList rows={6} /></div>
      </AppShell>
    )
  }

  const prevWeekTotal = Math.max(0, (spendMonth.total_usd - spendWeek.total_usd) * (7 / 23))
  const trendPct = prevWeekTotal > 0
    ? ((spendWeek.total_usd - prevWeekTotal) / prevWeekTotal) * 100
    : null

  const sortedAgents = [...spendWeek.items].sort((a, b) => b.total_usd - a.total_usd)
  const empty = spendWeek.items.length === 0

  const trendColor =
    trendPct == null ? 'var(--gray-10)'
    : trendPct > 5 ? 'var(--amber-11)'
    : trendPct < -5 ? 'var(--green-11)'
    : 'var(--gray-10)'

  return (
    <AppShell crumbs={crumbs}>
      <div className="page">
        <PageHeader
          eyebrow="COSTS"
          title={
            <Flex align="baseline" gap="3" wrap="wrap">
              <span>{money(spendWeek.total_usd, { compact: true })}</span>
              <Text as="span" size="3" color="gray" weight="regular">spent this week</Text>
            </Flex>
          }
          subtitle={trendPct != null
            ? <span style={{ color: trendColor }}>{pct(trendPct, 1)} vs previous week</span>
            : 'No previous-week baseline yet.'}
        />

        {empty ? (
          <EmptyState
            icon={<IconSpend />}
            title="No costs in the last 7 days"
            body="Your agents haven't run anything in this period."
          />
        ) : (
          <Flex direction="column" gap="4">
            <CostsByAssistantCard agents={sortedAgents} total={spendWeek.total_usd} />
            <FourWeekTrend spendMonth={spendMonth} spendWeek={spendWeek} />
            <SimpleAssistantTable items={sortedAgents} />
          </Flex>
        )}

        <Box mt="5">
          <AdvancedAccordion />
        </Box>

      </div>
    </AppShell>
  )
}

// ────────────────────────────────────────────── Costs by agent
// Plan section 7.7: simple horizontal bar chart per agent.

function CostsByAssistantCard({
  agents,
  total,
}: {
  agents: SpendDashboard['items']
  total: number
}) {
  const max = Math.max(...agents.map(a => a.total_usd), 0.0001)
  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Costs by agent</Text>
        <Text size="1" color="gray">{agents.length} {agents.length === 1 ? 'agent' : 'agents'}</Text>
      </div>
      <Box p="4">
        <Flex direction="column" gap="2">
          {agents.map(a => {
            const share = a.total_usd / max
            const pctOfTotal = total > 0 ? (a.total_usd / total) * 100 : 0
            return (
              <Flex key={a.id} align="center" gap="3">
                <Text size="2" className="truncate" style={{ width: 160, flexShrink: 0 }}>
                  {a.label}
                </Text>
                <Box flexGrow="1" className="spend-row__bar-track" style={{ height: 10 }}>
                  <Box className="spend-row__bar-fill" style={{ width: `${Math.max(2, share * 100)}%` }} />
                </Box>
                <Text size="1" style={{
                  textAlign: 'right',
                  width: 110,
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {money(a.total_usd, { compact: true })}{' '}
                  <Text color="gray">· {pctOfTotal.toFixed(1)}%</Text>
                </Text>
              </Flex>
            )
          })}
        </Flex>
      </Box>
    </div>
  )
}

// ────────────────────────────────────────────── 4-week trend
// Synthesised client-side: gateway exposes only aggregate ranges, not
// week-by-week buckets. We split (30d − 7d) across the previous 3 weeks
// with a deterministic shape, then add the real 7d as the latest point.
// Marked with MockBadge so it's clear this is derived, not raw backend data.

function FourWeekTrend({
  spendMonth,
  spendWeek,
}: {
  spendMonth: SpendDashboard
  spendWeek: SpendDashboard
}) {
  const data = useMemo(() => {
    const previous = Math.max(0, spendMonth.total_usd - spendWeek.total_usd)
    // Slight uptrend toward the most recent of the past 3 weeks; total stays
    // honest (sums to spendMonth.total_usd − spendWeek.total_usd).
    const w1 = previous * 0.30
    const w2 = previous * 0.34
    const w3 = previous * 0.36
    const w4 = spendWeek.total_usd
    return [
      { label: '4w ago', value: w1 },
      { label: '3w ago', value: w2 },
      { label: '2w ago', value: w3 },
      { label: 'this week', value: w4 },
    ]
  }, [spendMonth, spendWeek])

  const max = Math.max(...data.map(d => d.value), 1)
  const W = 720
  const H = 120
  const PAD_X = 24
  const PAD_Y = 14

  // Build the SVG line path over four equally-spaced points.
  const pts = data.map((d, i) => {
    const x = PAD_X + (i / (data.length - 1)) * (W - PAD_X * 2)
    const y = H - PAD_Y - (d.value / max) * (H - PAD_Y * 2)
    return { x, y, label: d.label, value: d.value }
  })
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${H - PAD_Y} L ${pts[0].x.toFixed(1)} ${H - PAD_Y} Z`

  return (
    <div className="card">
      <div className="card__head">
        <Flex align="center" gap="2">
          <Text as="div" size="2" weight="medium" className="card__title">Trend · last 4 weeks</Text>
          <MockBadge kind="design" hint="Per-week split is approximated client-side from the 7d and 30d totals — gateway doesn't expose week buckets yet." />
        </Flex>
      </div>
      <Box p="4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weekly cost trend" style={{ display: 'block', width: '100%', height: 'auto' }}>
          <path d={areaPath} fill="var(--accent-a3)" />
          <path d={linePath} fill="none" stroke="var(--accent-9)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={3.5} fill="var(--accent-9)" />
              <text
                x={p.x}
                y={p.y - 10}
                textAnchor="middle"
                fontSize="11"
                fill="var(--gray-12)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {money(p.value, { compact: true })}
              </text>
              <text
                x={p.x}
                y={H - 2}
                textAnchor="middle"
                fontSize="10"
                fill="var(--gray-10)"
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </Box>
    </div>
  )
}

// ────────────────────────────────────────────── Simple bottom table
// Agent · activities · cost. No tokens, no group_by switch. Clicks to
// the agent detail.

function SimpleAssistantTable({ items }: { items: SpendDashboard['items'] }) {
  const cols = 'minmax(0, 1fr) 120px 140px 24px'
  return (
    <div className="card card--flush">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">All agents</Text>
        <Text size="1" color="gray">last 7 days</Text>
      </div>
      <div className="table-head" style={{ gridTemplateColumns: cols }}>
        <Text as="span" size="1" color="gray">agent</Text>
        <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>activities</Text>
        <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>cost</Text>
        <span />
      </div>
      <Flex direction="column">
        {items.map((r, i) => (
          <Link
            key={r.id}
            to={`/agents/${r.id}`}
            className="agent-row"
            style={{
              gridTemplateColumns: cols,
              gap: '14px',
              borderBottom: i === items.length - 1 ? 0 : '1px solid var(--gray-a3)',
            }}
          >
            <Text as="div" size="2" className="truncate">{r.label}</Text>
            <Text as="div" size="1" color="gray" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {num(r.run_count)}
            </Text>
            <Text as="div" size="2" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {money(r.total_usd, { cents: r.total_usd < 100 })}
            </Text>
            <IconArrowRight className="ic" />
          </Link>
        ))}
      </Flex>
    </div>
  )
}

// ────────────────────────────────────────────── Advanced view
// Power-user accordion: original range toggle + group_by + tokens-aware table.

function AdvancedAccordion() {
  const [open, setOpen] = useState(false)
  return (
    <details className="card" style={{ padding: '14px 18px' }} open={open}>
      <summary
        style={{ cursor: 'pointer', listStyle: 'none' }}
        onClick={e => { e.preventDefault(); setOpen(o => !o) }}
      >
        <Flex align="center" justify="between">
          <Flex align="center" gap="2">
            <Text as="span" size="2" weight="medium">Advanced view</Text>
            <Text as="span" size="1" color="gray">range, group by, tokens</Text>
          </Flex>
          <IconArrowRight
            className="ic"
            style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}
          />
        </Flex>
      </summary>
      {open && <AdvancedView />}
    </details>
  )
}

function AdvancedView() {
  const [data, setData] = useState<SpendDashboard | null>(null)
  const [range, setRange] = useState<SpendRange>('30d')
  const [groupBy, setGroupBy] = useState<SpendGroupBy>('agent')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.getSpend(range, groupBy)
      .then(d => { if (!cancelled) { setData(d); setError(null) } })
      .catch(e => { if (!cancelled) setError((e as Error).message ?? 'Failed to load') })
    return () => { cancelled = true }
  }, [range, groupBy])

  if (error) {
    return <Box mt="3"><ErrorState title="Couldn't load advanced view" body={error} /></Box>
  }
  if (!data) {
    return <Box mt="3"><LoadingList rows={3} /></Box>
  }

  const items = data.items
  const totalTokensIn = items.reduce((s, r) => s + r.total_tokens_in, 0)
  const totalTokensOut = items.reduce((s, r) => s + r.total_tokens_out, 0)
  const pageStart = page * pageSize
  const pageItems = items.slice(pageStart, pageStart + pageSize)
  const cols = 'minmax(0, 1fr) 100px 100px 110px 110px 100px'

  return (
    <Box mt="3">
      <Flex align="center" gap="2" mb="3" wrap="wrap">
        <Caption mr="1">range</Caption>
        {RANGES.map(r => {
          const isActive = range === r
          return (
            <Button
              key={r}
              type="button"
              size="1"
              variant="soft"
              color={isActive ? 'blue' : 'gray'}
              onClick={() => { setRange(r); setPage(0) }}
            >
              {r}
            </Button>
          )
        })}
        <span style={{ width: 1, height: 18, background: 'var(--gray-a3)', margin: '0 6px' }} />
        <Caption mr="1">group by</Caption>
        {GROUPINGS.map(g => {
          const isActive = groupBy === g
          return (
            <Button
              key={g}
              type="button"
              size="1"
              variant="soft"
              color={isActive ? 'blue' : 'gray'}
              onClick={() => { setGroupBy(g); setPage(0) }}
            >
              <span style={{ textTransform: 'capitalize' }}>{g}</span>
            </Button>
          )
        })}
      </Flex>

      <Grid columns="3" gap="3" mb="4">
        <StatBlock
          label="Total"
          value={money(data.total_usd, { compact: true })}
          sub={`${num(items.length)} ${groupBy}${items.length === 1 ? '' : 's'}`}
        />
        <StatBlock
          label="Activities"
          value={num(items.reduce((s, r) => s + r.run_count, 0))}
          sub={`across ${data.range}`}
        />
        <StatBlock
          label="Tokens"
          value={`${num(Math.round((totalTokensIn + totalTokensOut) / 1000))}k`}
          sub={`in ${num(Math.round(totalTokensIn / 1000))}k · out ${num(Math.round(totalTokensOut / 1000))}k`}
        />
      </Grid>

      <div className="card card--table">
        <div className="table-head" style={{ gridTemplateColumns: cols }}>
          <Text as="span" size="1" color="gray">{groupBy === 'agent' ? 'agent' : groupBy}</Text>
          <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>cost</Text>
          <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>activities</Text>
          <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>tokens in</Text>
          <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>tokens out</Text>
          <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>date</Text>
        </div>
        {pageItems.map(r => (
          <div key={r.id} className="spend-row" style={{ gridTemplateColumns: cols }}>
            <Text as="div" size="2" className="truncate">{r.label}</Text>
            <Text as="div" size="2" style={{ textAlign: 'right' }}>{money(r.total_usd, { cents: r.total_usd < 100 })}</Text>
            <Text as="div" size="1" color="gray" style={{ textAlign: 'right' }}>{num(r.run_count)}</Text>
            <Text as="div" size="1" color="gray" style={{ textAlign: 'right' }}>{num(r.total_tokens_in)}</Text>
            <Text as="div" size="1" color="gray" style={{ textAlign: 'right' }}>{num(r.total_tokens_out)}</Text>
            <Text as="div" size="1" color="gray" style={{ textAlign: 'right' }}>{r.spend_date ? shortDate(r.spend_date) : '—'}</Text>
          </div>
        ))}
        <Pagination
          page={page}
          pageSize={pageSize}
          total={items.length}
          onPageChange={setPage}
          onPageSizeChange={n => { setPageSize(n); setPage(0) }}
          label={`${groupBy}s`}
        />
      </div>
    </Box>
  )
}

function StatBlock({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Box className="card" p="3">
      <Text as="div" size="1" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {label}
      </Text>
      <Heading size="5" weight="medium" mt="1">{value}</Heading>
      <Text as="div" size="1" color="gray" mt="1">{sub}</Text>
    </Box>
  )
}
