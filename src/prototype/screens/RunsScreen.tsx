import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Code, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, Status, InfoHint, Pagination } from '../components/common'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconArrowRight, IconRun } from '../components/icons'
import { Link } from '../router'
import { api } from '../lib/api'
import type { Agent, RunListItem, RunStatus } from '../lib/types'
import { ago, domainLabel, durationMs, money, num, shortRef, stageLabel } from '../lib/format'

const STATUSES: Array<RunStatus | 'all'> = [
  'all',
  'pending',
  'running',
  'suspended',
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled',
]

const PAGE_SIZE_DEFAULT = 10
const TABLE_COLS = '110px minmax(0, 1fr) 150px 130px 110px 110px 32px'

export default function RunsScreen() {
  const [items, setItems] = useState<RunListItem[] | null>(null)
  const [total, setTotal] = useState(0)
  const [agents, setAgents] = useState<Agent[]>([])
  const [status, setStatus] = useState<RunStatus | 'all'>('all')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT)

  useEffect(() => {
    let cancelled = false
    const limit = pageSize
    const offset = page * pageSize
    Promise.all([
      api.listRuns({
        status: status === 'all' ? undefined : status,
        limit,
        offset,
      }),
      api.listAgents(),
    ])
      .then(([list, ags]) => {
        if (cancelled) return
        setItems(list.items)
        setTotal(list.total)
        setAgents(ags.items)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load runs')
      })
    return () => { cancelled = true }
  }, [status, page, pageSize, reloadTick])

  const agentName = (id: string | null) =>
    (id && agents.find(a => a.id === id)?.name) || '—'

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: total }
    if (status !== 'all') c[status] = total
    return c
  }, [status, total])

  const runDuration = (r: RunListItem) => {
    if (!r.started_at) return null
    const end = r.ended_at ? new Date(r.ended_at).getTime() : Date.now()
    return end - new Date(r.started_at).getTime()
  }

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'runs' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              RUNS{' '}
              <InfoHint>
                List from <Code variant="ghost">GET /dashboard/runs</Code>. Each row is a slim run record (no step timeline) — open one to load the full audit trail.
              </InfoHint>
            </>
          }
          title={<>Execution <em>log.</em></>}
          subtitle="Every run, newest first. Filter by status; open one to inspect its step timeline."
        />

        <Flex align="center" gap="2" mb="4" wrap="wrap">
          <Caption mr="1">status</Caption>
          {STATUSES.map(s => {
            const isActive = status === s
            const tone = s === 'failed' || s === 'suspended' || s === 'completed_with_errors' ? 'amber' : 'blue'
            return (
              <Button
                key={s}
                type="button"
                size="2"
                variant="soft"
                color={isActive ? tone : 'gray'}
                onClick={() => { setStatus(s); setPage(0) }}
              >
                <span style={{ textTransform: 'capitalize' }}>{s.replace(/_/g, ' ')}</span>
                {counts[s] != null && (
                  <Code variant="ghost" size="1" color="gray">{counts[s]}</Code>
                )}
              </Button>
            )
          })}
        </Flex>

        {error ? (
          <ErrorState
            title="Couldn't load runs"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : !items ? (
          <LoadingList rows={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<IconRun />}
            title={status === 'all' ? 'No runs yet' : `No ${status.replace(/_/g, ' ')} runs`}
          />
        ) : (
          <div className="card card--table">
            <div className="table-head" style={{ gridTemplateColumns: TABLE_COLS }}>
              <Text as="span" size="1" color="gray">created</Text>
              <Text as="span" size="1" color="gray">agent · domain</Text>
              <Text as="span" size="1" color="gray">status</Text>
              <Text as="span" size="1" color="gray">waiting on</Text>
              <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>duration</Text>
              <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>spend</Text>
              <span />
            </div>
            {items.map(r => (
              <Link
                key={r.id}
                to={`/runs/${r.id}`}
                className="agent-row"
                style={{ gridTemplateColumns: TABLE_COLS }}
              >
                <Box>
                  <Text as="div" size="1" color="gray">{ago(r.created_at)}</Text>
                  <Text as="div" size="1" color="gray" mt="1">{shortRef(r.id)}</Text>
                </Box>
                <Box style={{ minWidth: 0 }}>
                  <Text as="div" size="2" className="truncate">{agentName(r.agent_id)}</Text>
                  <Text as="div" size="1" color="gray" mt="1">{domainLabel(r.domain_id)}</Text>
                </Box>
                <Status status={r.status} />
                <Text as="div" size="1" color="gray" className="truncate">
                  {r.suspended_stage ? stageLabel(r.suspended_stage) : '—'}
                </Text>
                <Text as="div" size="1" color="gray" style={{ textAlign: 'right' }}>
                  {durationMs(runDuration(r))}
                </Text>
                <Text as="div" size="2" style={{ textAlign: 'right' }}>
                  {money(r.total_cost_usd, { cents: r.total_cost_usd < 100 })}
                </Text>
                <IconArrowRight className="ic" />
              </Link>
            ))}
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={n => { setPageSize(n); setPage(0) }}
              label="runs"
            />
          </div>
        )}

        <Box mt="4">
          <Text as="div" size="1" color="gray">
            Showing {num(items?.length ?? 0)} of {num(total)} runs.
          </Text>
        </Box>
      </div>
    </AppShell>
  )
}
