import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Flex, Grid, Heading, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader } from '../components/common'
import { EmptyState, ErrorState, LoadingList, NoAccessState } from '../components/states'
import { IconArrowRight, IconSpend } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { SpendDashboard, SpendRange } from '../lib/types'
import { money, num } from '../lib/format'

const RANGES: SpendRange[] = ['1d', '7d', '30d', '90d']

function rangeLabel(r: SpendRange): string {
  if (r === '1d') return 'last 24 hours'
  if (r === '7d') return 'last 7 days'
  if (r === '30d') return 'last 30 days'
  return 'last 90 days'
}

export default function SpendScreen() {
  const { user } = useAuth()
  const [data, setData] = useState<SpendDashboard | null>(null)
  const [range, setRange] = useState<SpendRange>('7d')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const canView = !!user && (user.role === 'admin' || user.role === 'domain_admin')

  useEffect(() => {
    if (!canView) return
    let cancelled = false
    api.getSpend(range, 'agent')
      .then(d => { if (!cancelled) { setData(d); setError(null) } })
      .catch(e => { if (!cancelled) setError((e as Error).message ?? 'Failed to load') })
    return () => { cancelled = true }
  }, [canView, range, reloadTick])

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

  if (!data) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="page">
          <RangeToggle range={range} onRange={setRange} />
          <Box mt="4"><LoadingList rows={6} /></Box>
        </div>
      </AppShell>
    )
  }

  const sortedItems = [...data.items].sort((a, b) => b.total_usd - a.total_usd)
  const empty = sortedItems.length === 0
  const totalActivities = sortedItems.reduce((s, r) => s + r.run_count, 0)
  const totalTokens = sortedItems.reduce((s, r) => s + r.total_tokens_in + r.total_tokens_out, 0)
  const totalTokensIn = sortedItems.reduce((s, r) => s + r.total_tokens_in, 0)
  const totalTokensOut = sortedItems.reduce((s, r) => s + r.total_tokens_out, 0)

  return (
    <AppShell crumbs={crumbs}>
      <div className="page">
        <PageHeader
          eyebrow="COSTS"
          title={
            <Flex align="baseline" gap="3" wrap="wrap">
              <span>{money(data.total_usd, { compact: true })}</span>
              <Text as="span" size="3" color="gray" weight="regular">spent</Text>
            </Flex>
          }
          subtitle={rangeLabel(range)}
        />

        <RangeToggle range={range} onRange={setRange} />

        {empty ? (
          <Box mt="4">
            <EmptyState
              icon={<IconSpend />}
              title={`No costs in the ${rangeLabel(range)}`}
              body="Your agents haven't run anything in this period."
            />
          </Box>
        ) : (
          <Flex direction="column" gap="4" mt="4">
            <Grid columns={{ initial: '1', sm: '3' }} gap="3">
              <StatBlock
                label="Total"
                value={money(data.total_usd, { compact: true })}
                sub={`${num(sortedItems.length)} ${sortedItems.length === 1 ? 'agent' : 'agents'}`}
              />
              <StatBlock
                label="Activities"
                value={num(totalActivities)}
                sub={`across ${rangeLabel(range)}`}
              />
              <StatBlock
                label="Tokens"
                value={`${num(Math.round(totalTokens / 1000))}k`}
                sub={`in ${num(Math.round(totalTokensIn / 1000))}k · out ${num(Math.round(totalTokensOut / 1000))}k`}
              />
            </Grid>

            <CostsByAgent items={sortedItems} total={data.total_usd} />
          </Flex>
        )}
      </div>
    </AppShell>
  )
}

// ────────────────────────────────────────────── Range toggle

function RangeToggle({
  range, onRange,
}: {
  range: SpendRange
  onRange: (r: SpendRange) => void
}) {
  return (
    <Flex align="center" gap="2" wrap="wrap">
      <Caption mr="1">range</Caption>
      {RANGES.map(r => (
        <Button
          key={r}
          type="button"
          size="2"
          variant="soft"
          color={r === range ? 'blue' : 'gray'}
          onClick={() => onRange(r)}
        >
          {r}
        </Button>
      ))}
    </Flex>
  )
}

// ────────────────────────────────────────────── Stat block

function StatBlock({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card">
      <Box p="3">
        <Text as="div" size="1" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {label}
        </Text>
        <Heading size="5" weight="medium" mt="1">{value}</Heading>
        <Text as="div" size="1" color="gray" mt="1">{sub}</Text>
      </Box>
    </div>
  )
}

// ────────────────────────────────────────────── Costs list per agent
// One unified list: name + proportional bar + numbers. No bar/table dup.

function CostsByAgent({
  items, total,
}: {
  items: SpendDashboard['items']
  total: number
}) {
  const max = useMemo(() => Math.max(...items.map(a => a.total_usd), 0.0001), [items])
  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Costs by agent</Text>
        <Text size="1" color="gray">sorted by cost</Text>
      </div>
      <Flex direction="column">
        {items.map((r, i) => {
          const share = r.total_usd / max
          const pctOfTotal = total > 0 ? (r.total_usd / total) * 100 : 0
          const tokensSum = r.total_tokens_in + r.total_tokens_out
          return (
            <Link
              key={r.id}
              to={`/agents/${r.id}`}
              className="card--hover"
              style={{
                display: 'block',
                padding: '12px 18px',
                borderTop: i === 0 ? undefined : '1px solid var(--gray-a3)',
                borderRadius: 0,
              }}
            >
              <Flex align="center" gap="3" mb="2">
                <Text as="span" size="2" weight="medium" className="truncate" style={{ flexGrow: 1, minWidth: 0 }}>
                  {r.label}
                </Text>
                <Text as="span" size="2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {money(r.total_usd, { cents: r.total_usd < 100 })}
                </Text>
                <IconArrowRight className="ic ic--sm" style={{ color: 'var(--gray-10)' }} />
              </Flex>
              <Box className="spend-row__bar-track" style={{ height: 6, marginBottom: 8 }}>
                <Box className="spend-row__bar-fill" style={{ width: `${Math.max(2, share * 100)}%` }} />
              </Box>
              <Flex align="center" gap="3" wrap="wrap">
                <Text as="span" size="1" color="gray">
                  {pctOfTotal.toFixed(1)}% of total
                </Text>
                <Text as="span" size="1" color="gray">·</Text>
                <Text as="span" size="1" color="gray">
                  {num(r.run_count)} {r.run_count === 1 ? 'activity' : 'activities'}
                </Text>
                <Text as="span" size="1" color="gray">·</Text>
                <Text as="span" size="1" color="gray">
                  {num(Math.round(tokensSum / 1000))}k tokens
                </Text>
              </Flex>
            </Link>
          )
        })}
      </Flex>
    </div>
  )
}
