import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Code, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, InfoHint, Pagination, Status } from '../components/common'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconArrowRight, IconChat, IconPlus } from '../components/icons'
import { Link } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import { CHAT_STATUS_FILTERS } from '../lib/filters'
import type { ChatStatusFilter } from '../lib/filters'
import type { Agent, Chat } from '../lib/types'
import { ago, money } from '../lib/format'

const PAGE_SIZE_DEFAULT = 10
const TABLE_COLS = 'minmax(0, 1fr) 160px 130px 120px 110px 110px 32px'

export default function ChatsScreen() {
  const { user } = useAuth()
  const [items, setItems] = useState<Chat[] | null>(null)
  const [total, setTotal] = useState(0)
  const [agents, setAgents] = useState<Agent[]>([])
  const [statusFilter, setStatusFilter] = useState<ChatStatusFilter>('all')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([
      api.listChats(
        { id: user.id, role: user.role },
        { limit: pageSize, offset: page * pageSize },
      ),
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
        setError((e as Error).message ?? 'Failed to load chats')
      })
    return () => { cancelled = true }
  }, [user, page, pageSize, reloadTick])

  const agentName = (id: string) => agents.find(a => a.id === id)?.name ?? '—'

  const filtered = useMemo(() => {
    if (!items) return null
    if (statusFilter === 'all') return items
    return items.filter(c => c.status === statusFilter)
  }, [items, statusFilter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items?.length ?? 0 }
    ;(items ?? []).forEach(ch => { c[ch.status] = (c[ch.status] ?? 0) + 1 })
    return c
  }, [items])

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'chats' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              CHATS{' '}
              <InfoHint>
                List from <Code variant="ghost">GET /chats</Code>. Members see their own chats; admins see all chats in the tenant.
              </InfoHint>
            </>
          }
          title={<>Conversations <em>in flight.</em></>}
          subtitle="Real-time SSE chats with agents. Each chat is bound to one agent version + model."
          actions={
            <Button asChild><a href="#/chats/new"><IconPlus />New chat</a></Button>
          }
        />

        <Flex align="center" gap="2" mb="4" wrap="wrap">
          <Caption mr="1">status</Caption>
          {CHAT_STATUS_FILTERS.map(s => {
            const isActive = statusFilter === s
            return (
              <Button
                key={s}
                type="button"
                size="2"
                variant="soft"
                color={isActive ? 'blue' : 'gray'}
                onClick={() => { setStatusFilter(s); setPage(0) }}
              >
                <span style={{ textTransform: 'capitalize' }}>{s}</span>
                <Code variant="ghost" size="1" color="gray">{counts[s] ?? 0}</Code>
              </Button>
            )
          })}
        </Flex>

        {error ? (
          <ErrorState
            title="Couldn't load chats"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : !filtered ? (
          <LoadingList rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconChat />}
            title={statusFilter === 'all' ? 'No chats yet' : `No ${statusFilter} chats`}
            action={{ label: 'Start a chat', href: '/chats/new' }}
          />
        ) : (
          <div className="card card--table">
            <div className="table-head" style={{ gridTemplateColumns: TABLE_COLS }}>
              <Text as="span" size="1" color="gray">title</Text>
              <Text as="span" size="1" color="gray">agent</Text>
              <Text as="span" size="1" color="gray">model</Text>
              <Text as="span" size="1" color="gray">status</Text>
              <Text as="span" size="1" color="gray" style={{ textAlign: 'right' }}>spend</Text>
              <Text as="span" size="1" color="gray">updated</Text>
              <span />
            </div>
            {filtered.map(c => (
              <Link
                key={c.id}
                to={`/chats/${c.id}`}
                className="agent-row"
                style={{ gridTemplateColumns: TABLE_COLS }}
              >
                <Text as="div" size="2" className="truncate" style={{ minWidth: 0 }}>
                  {c.title ?? <Text color="gray">— untitled —</Text>}
                </Text>
                <Text as="div" size="1" className="truncate">{agentName(c.agent_id)}</Text>
                <Badge color="gray" variant="soft" radius="full" size="1" style={{ fontFamily: 'var(--font-mono)' }}>
                  {c.model}
                </Badge>
                <Status status={c.status} />
                <Text as="div" size="2" style={{ textAlign: 'right' }}>
                  {money(c.total_cost_usd, { cents: c.total_cost_usd < 100 })}
                </Text>
                <Text as="div" size="1" color="gray">{ago(c.updated_at)}</Text>
                <IconArrowRight className="ic" />
              </Link>
            ))}
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={n => { setPageSize(n); setPage(0) }}
              label="chats"
            />
          </div>
        )}

        <Box mt="3">
          <Text as="div" size="1" color="gray">
            {user?.role === 'member'
              ? 'You only see chats you started.'
              : 'Admin scope — you see every chat in the tenant.'}
          </Text>
        </Box>
      </div>
    </AppShell>
  )
}
