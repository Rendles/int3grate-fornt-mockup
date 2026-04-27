import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Code, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, InfoHint, Pagination } from '../components/common'
import { SelectField } from '../components/fields'
import { EmptyState, ErrorState, LoadingList, NoAccessState } from '../components/states'
import { IconAudit } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent, AuditEvent } from '../lib/types'
import { absTime, durationMs, money, num, shortRef, toolLabel } from '../lib/format'

type SourceFilter = 'all' | 'runs' | 'chats'
const SOURCES: SourceFilter[] = ['all', 'runs', 'chats']

const PAGE_SIZE_DEFAULT = 20
const TABLE_COLS = '160px 130px 110px minmax(0, 1fr) 100px 100px 100px'

const STEP_TYPE_LABEL: Record<string, string> = {
  llm: 'LLM',
  tool_call: 'Tool call',
  approval_wait: 'Approval wait',
  system: 'System',
  chat_message: 'Chat message',
  chat_tool_call: 'Chat tool',
}

function statusTone(status: string): 'green' | 'amber' | 'red' | 'cyan' | 'gray' {
  if (status === 'ok' || status === 'completed') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'pending' || status === 'blocked') return 'amber'
  if (status === 'running') return 'cyan'
  return 'gray'
}

export default function AuditScreen() {
  const { user } = useAuth()
  const canView = !!user && (user.role === 'admin' || user.role === 'domain_admin')

  const [items, setItems] = useState<AuditEvent[] | null>(null)
  const [total, setTotal] = useState(0)
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentId, setAgentId] = useState<string>('all')
  const [source, setSource] = useState<SourceFilter>('all')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT)

  const crumbs = [{ label: 'home', to: '/' }, { label: 'audit' }]

  useEffect(() => {
    if (!canView) return
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
        setError((e as Error).message ?? 'Failed to load audit')
      })
    return () => { cancelled = true }
    // agents is intentionally excluded — we cache it on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, source, page, pageSize, reloadTick, canView])

  const agentName = (id: string) => agents.find(a => a.id === id)?.name ?? '—'

  const agentOptions = useMemo(
    () => [
      { value: 'all', label: 'Any agent' },
      ...agents.map(a => ({ value: a.id, label: a.name })),
    ],
    [agents],
  )

  if (!canView) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="page">
          <NoAccessState
            requiredRole="Admin or Domain Admin"
            body="The audit timeline is restricted to admins."
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell crumbs={crumbs}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              AUDIT{' '}
              <InfoHint>
                Loaded via <Code variant="ghost">GET /audit</Code>. Step-level events from runs and chats, with cost attribution. Run / chat filters are mutually exclusive (gateway returns 422 if both are set).
              </InfoHint>
            </>
          }
          title={<>Step <em>timeline.</em></>}
          subtitle="Every llm call, tool call, and approval-wait across the tenant. Newest first."
        />

        <Flex align="center" gap="3" mb="4" wrap="wrap">
          <Caption mr="1">source</Caption>
          {SOURCES.map(s => {
            const isActive = source === s
            return (
              <Button
                key={s}
                type="button"
                size="2"
                variant="soft"
                color={isActive ? 'blue' : 'gray'}
                onClick={() => { setSource(s); setPage(0) }}
              >
                <span style={{ textTransform: 'capitalize' }}>{s}</span>
              </Button>
            )
          })}
          <Box width="220px" ml="2">
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
            title="Couldn't load audit"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : !items ? (
          <LoadingList rows={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<IconAudit />}
            title={source === 'chats' ? 'No chat events yet' : 'No audit events match these filters'}
            body={source === 'chats' ? 'Chat surface lands in a future build — only run-sourced events are recorded today.' : undefined}
          />
        ) : (
          <div className="card card--table">
            <div className="table-head" style={{ gridTemplateColumns: TABLE_COLS }}>
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
                style={{ gridTemplateColumns: TABLE_COLS, cursor: 'default' }}
              >
                <Box style={{ minWidth: 0 }}>
                  <Text as="div" size="1" color="gray">{absTime(e.created_at)}</Text>
                  {e.run_id && (
                    <Link to={`/runs/${e.run_id}`}>
                      <Text size="1" color="blue">run {shortRef(e.run_id)}</Text>
                    </Link>
                  )}
                  {e.chat_id && (
                    <Link to={`/chats/${e.chat_id}`}>
                      <Text size="1" color="blue">chat {shortRef(e.chat_id)}</Text>
                    </Link>
                  )}
                </Box>
                <Text as="span" size="1">{STEP_TYPE_LABEL[e.step_type] ?? e.step_type}</Text>
                <Badge color={statusTone(e.status)} variant="soft" radius="full" size="1">
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
      </div>
    </AppShell>
  )
}
