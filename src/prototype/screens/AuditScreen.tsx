import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, Pagination } from '../components/common'
import { SelectField } from '../components/fields'
import { EmptyState, ErrorState, LoadingList, NoAccessState } from '../components/states'
import { IconAudit } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent, AuditEvent } from '../lib/types'
import { absTime, durationMs, money, num, shortRef, toolLabel } from '../lib/format'

const HISTORY_TABLE_COLS = '160px 130px 110px minmax(0, 1fr) 100px 100px 100px'
const HISTORY_PAGE_SIZE_DEFAULT = 20

const STEP_TYPE_LABEL: Record<string, string> = {
  llm: 'LLM',
  tool_call: 'Tool call',
  approval_wait: 'Approval wait',
  system: 'System',
  chat_message: 'Chat message',
  chat_tool_call: 'Chat tool',
}

type HistorySource = 'all' | 'runs' | 'chats'
const HISTORY_SOURCES: HistorySource[] = ['all', 'runs', 'chats']

function historyStatusTone(status: string): 'jade' | 'orange' | 'red' | 'cyan' | 'gray' {
  if (status === 'ok' || status === 'completed') return 'jade'
  if (status === 'failed') return 'red'
  if (status === 'pending' || status === 'blocked') return 'orange'
  if (status === 'running') return 'cyan'
  return 'gray'
}

export default function AuditScreen() {
  const { user } = useAuth()
  const canView = !!user && (user.role === 'admin' || user.role === 'domain_admin')

  if (!canView) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'audit' }]}>
        <div className="page">
          <NoAccessState
            requiredRole="Workspace Admin or Team Admin"
            body="The audit log is only visible to admins."
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'audit' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow="AUDIT"
          title="Audit log"
          subtitle="Per-step record of what your agents and team did. Filter by source or agent."
        />
        <AuditTable />
      </div>
    </AppShell>
  )
}

function AuditTable() {
  const [items, setItems] = useState<AuditEvent[] | null>(null)
  const [total, setTotal] = useState(0)
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentId, setAgentId] = useState<string>('all')
  const [source, setSource] = useState<HistorySource>('all')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZE_DEFAULT)

  useEffect(() => {
    let cancelled = false
    const limit = pageSize
    const offset = page * pageSize
    Promise.all([
      api.listAudit({
        agent_id: agentId === 'all' ? undefined : agentId,
        limit,
        offset,
      }),
      agents.length === 0 ? api.listAgents().then(r => r.items) : Promise.resolve(agents),
    ])
      .then(([list, ags]) => {
        if (cancelled) return
        let visible = list.items
        if (source === 'runs') visible = visible.filter(e => e.run_id !== null)
        else if (source === 'chats') visible = visible.filter(e => e.chat_id !== null)
        setItems(visible)
        setTotal(list.total)
        setAgents(ags)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load audit log')
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, source, page, pageSize, reloadTick])

  const agentName = (id: string) => agents.find(a => a.id === id)?.name ?? '—'

  const agentOptions = useMemo(
    () => [
      { value: 'all', label: 'Any agent' },
      ...agents.map(a => ({ value: a.id, label: a.name })),
    ],
    [agents],
  )

  return (
    <>
      <Flex align="center" gap="3" mb="4" wrap="wrap">
        <Caption mr="1">source</Caption>
        {HISTORY_SOURCES.map(s => {
          const isActive = source === s
          return (
            <Button
              key={s}
              type="button"
              size="2"
              variant="soft"
              color={isActive ? 'cyan' : 'gray'}
              onClick={() => { setSource(s); setPage(0) }}
            >
              <span style={{ textTransform: 'capitalize' }}>{s}</span>
            </Button>
          )
        })}
        <Box width="240px" ml="2">
          <SelectField
            size="2"
            value={agentId}
            onChange={v => { setAgentId(v); setPage(0) }}
            options={agentOptions}
          />
        </Box>
      </Flex>

      {error ? (
        <ErrorState
          title="Couldn't load audit log"
          body={error}
          onRetry={() => setReloadTick(t => t + 1)}
        />
      ) : !items ? (
        <LoadingList rows={6} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IconAudit />}
          title={source === 'chats' ? 'No chat history yet' : 'No events match these filters'}
          body={source === 'chats'
            ? 'Chat conversations will appear here once your agents start chatting.'
            : 'Try selecting a different agent or source.'}
        />
      ) : (
        <div className="card card--table">
          <div className="table-head" style={{ gridTemplateColumns: HISTORY_TABLE_COLS }}>
            <Text as="span" size="1" color="gray">when</Text>
            <Text as="span" size="1" color="gray">step type</Text>
            <Text as="span" size="1" color="gray">status</Text>
            <Text as="span" size="1" color="gray">agent · model / tool</Text>
            <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>duration</Text>
            <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>tokens</Text>
            <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>cost</Text>
          </div>
          {items.map(e => (
            <div
              key={e.id}
              className="agent-row"
              style={{ gridTemplateColumns: HISTORY_TABLE_COLS, cursor: 'default' }}
            >
              <Box style={{ minWidth: 0 }}>
                <Text as="div" size="1" color="gray">{absTime(e.created_at)}</Text>
                {e.run_id && (
                  <Link to={`/activity/${e.run_id}`}>
                    <Text size="1" color="cyan">activity {shortRef(e.run_id)}</Text>
                  </Link>
                )}
                {e.chat_id && (
                  <Link to={`/chats/${e.chat_id}`}>
                    <Text size="1" color="cyan">chat {shortRef(e.chat_id)}</Text>
                  </Link>
                )}
              </Box>
              <Text as="span" size="1">{STEP_TYPE_LABEL[e.step_type] ?? e.step_type}</Text>
              <Badge color={historyStatusTone(e.status)} variant="soft" radius="full" size="1">
                {e.status}
              </Badge>
              <Box style={{ minWidth: 0 }}>
                <Text as="div" size="2" className="truncate">{agentName(e.agent_id)}</Text>
                <Text as="div" size="1" color="gray" mt="1" className="truncate">
                  {e.tool_name ? toolLabel(e.tool_name) : e.model_name ?? '—'}
                </Text>
              </Box>
              <Text as="div" size="1" color="gray" style={{ textAlign: 'right' }}>
                {durationMs(e.duration_ms)}
              </Text>
              <Text as="div" size="1" color="gray" style={{ textAlign: 'right' }}>
                {e.tokens_in != null || e.tokens_out != null
                  ? `${num(e.tokens_in ?? 0)}/${num(e.tokens_out ?? 0)}`
                  : '—'}
              </Text>
              <Text as="div" size="1" style={{ textAlign: 'right' }}>
                {e.cost_usd != null ? money(e.cost_usd, { cents: true }) : '—'}
              </Text>
            </div>
          ))}
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={n => { setPageSize(n); setPage(0) }}
            label="events"
          />
        </div>
      )}
    </>
  )
}
