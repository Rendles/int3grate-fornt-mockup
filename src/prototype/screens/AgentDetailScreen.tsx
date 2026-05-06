import { useEffect, useState } from 'react'
import { Badge, Box, Button, DataList, Flex, Grid, Text } from '@radix-ui/themes'
import { AppShell } from '../components/shell'
import { Avatar, Caption, PageHeader, MetaRow, Status, Tabs } from '../components/common'
import { Banner, EmptyState, LoadingList, NoAccessState } from '../components/states'
import { IconArrowRight, IconPlus, IconRun } from '../components/icons'
import { GrantsEditor } from '../components/grants-editor'
import { ChatPanel } from '../components/chat-panel'
import { RetrainDialog } from '../components/retrain-dialog'
import { Link, useRouter } from '../router'
import { api } from '../lib/api'
import { useAuth } from '../auth'
import type { Agent, AgentVersion, Chat, RunListItem, ToolGrant } from '../lib/types'
import { absTime, ago, domainLabel, money, num, stageLabel } from '../lib/format'
import { statusLabel } from '../components/common/status-label'

type AgentTab = 'overview' | 'talk' | 'grants' | 'activity' | 'settings' | 'advanced'

export default function AgentDetailScreen({
  agentId,
  tab,
  chatId,
}: {
  agentId: string
  tab: AgentTab
  chatId?: string
}) {
  const { user } = useAuth()
  const [agent, setAgent] = useState<Agent | null | undefined>(undefined)
  const [grants, setGrants] = useState<ToolGrant[] | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [runs, setRuns] = useState<RunListItem[]>([])
  const [retrainOpen, setRetrainOpen] = useState(false)

  useEffect(() => {
    api.getAgent(agentId).then(a => setAgent(a ?? null))
    api.getGrants(agentId).then(setGrants)
    api.listRuns({ limit: 100 }).then(r => setRuns(r.items.filter(it => it.agent_id === agentId)))
  }, [agentId])

  // After retrain succeeds, the agent's embedded `active_version` and
  // `updated_at` change server-side. Refetch to pull the fresh state so
  // both Overview (brief preview) and Advanced (version + created_at)
  // re-render with the new values.
  const handleRetrained = () => {
    api.getAgent(agentId).then(a => setAgent(a ?? null))
  }

  useEffect(() => {
    if (!user) return
    api.listChats({ id: user.id, role: user.role }, { agent_id: agentId, limit: 50 })
      .then(res => setChats(res.items))
  }, [agentId, user, chatId])

  if (agent === null) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'team', to: '/agents' }, { label: 'not found' }]}>
        <div className="page">
          <NoAccessState
            requiredRole="access to this agent"
            body="This agent could not be loaded. It may have been deleted or you may not have access."
          />
        </div>
      </AppShell>
    )
  }

  if (agent === undefined) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'team', to: '/agents' }, { label: 'loading…' }]}>
        <div className="page"><LoadingList rows={6} /></div>
      </AppShell>
    )
  }

  const canEdit = !!user && (user.role === 'admin' || user.role === 'domain_admin')
  const activeVersion = agent.active_version
  const canTalk = agent.status === 'active' && activeVersion != null

  const tabs: { key: AgentTab; label: string; count?: number | string; href: string; dataTour?: string }[] = [
    { key: 'overview', label: 'Overview', href: `/agents/${agent.id}` },
    { key: 'talk', label: 'Talk to', count: chats.length || undefined, href: `/agents/${agent.id}/talk` },
    { key: 'grants', label: 'Permissions', count: grants?.length ?? '—', href: `/agents/${agent.id}/grants`, dataTour: 'agent-tab-grants' },
    { key: 'activity', label: 'Activity', count: runs.length || undefined, href: `/agents/${agent.id}/activity` },
    { key: 'settings', label: 'Settings', href: `/agents/${agent.id}/settings` },
    { key: 'advanced', label: 'Advanced', href: `/agents/${agent.id}/advanced` },
  ]

  return (
    <AppShell
      crumbs={[
        { label: 'home', to: '/' },
        { label: 'team', to: '/agents' },
        { label: agent.name },
      ]}
    >
      <div className="page page--wide">
        <PageHeader
          eyebrow="AGENT"
          title={
            <Flex align="center" gap="3">
              <Avatar initials={agent.name.slice(0, 2).toUpperCase()} size={36} />
              <span>{agent.name}</span>
            </Flex>
          }
          subtitle={agent.description ?? ''}
          actions={
            <>
              <Status status={agent.status} />
            </>
          }
        />

        <Tabs items={tabs} active={tab} />
        <Box mt="5" />

        {tab === 'overview' && (
          <OverviewTab
            agent={agent}
            version={activeVersion}
            recentRuns={runs.slice(0, 4)}
            canEdit={canEdit}
            onRetrain={() => setRetrainOpen(true)}
          />
        )}
        {tab === 'talk' && <TalkToTab agent={agent} chats={chats} canTalk={canTalk} chatId={chatId} />}
        {tab === 'grants' && (
          <GrantsEditor agent={agent} grants={grants} canEdit={canEdit} onChange={setGrants} />
        )}
        {tab === 'activity' && <ActivityTab agent={agent} runs={runs} />}
        {tab === 'settings' && (
          <SettingsTab agent={agent} />
        )}
        {tab === 'advanced' && (
          <AdvancedTab
            agent={agent}
            version={activeVersion}
            canEdit={canEdit}
            onRetrain={() => setRetrainOpen(true)}
          />
        )}
      </div>

      <RetrainDialog
        open={retrainOpen}
        onOpenChange={setRetrainOpen}
        agent={agent}
        currentVersion={activeVersion}
        onRetrained={handleRetrained}
      />
    </AppShell>
  )
}

// ────────────────────────────────────────────────────────── Overview tab
// Slimmed down: status hero + last activity preview + apps used + Talk-to CTA.
// Heavy config detail moved to Advanced.

function OverviewTab({
  agent,
  version,
  recentRuns,
  canEdit,
  onRetrain,
}: {
  agent: Agent
  version: AgentVersion | null
  recentRuns: RunListItem[]
  canEdit: boolean
  onRetrain: () => void
}) {
  if (!version) {
    return (
      <div className="card">
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">Not configured yet</Text>
          {canEdit && (
            <Button size="1" onClick={onRetrain}><IconPlus />Set up brief</Button>
          )}
        </div>
        <div className="card__body">
          <Text as="div" size="2" color="gray" mb="4">
            This agent doesn't have a setup yet. {canEdit ? 'Give them a brief to make them runnable.' : 'An admin needs to give them a brief.'}
          </Text>
        </div>
      </div>
    )
  }

  const stats: { label: string; value: string }[] = [
    { label: 'Total spent', value: agent.total_spend_usd != null ? money(agent.total_spend_usd, { compact: true }) : '—' },
    { label: 'Activities', value: agent.runs_count != null ? num(agent.runs_count) : '—' },
    { label: 'Team', value: domainLabel(agent.domain_id) },
  ]

  return (
    <Flex direction="column" gap="4">
      <div className="card">
        <Box p="4">
          <Caption mb="2">What this agent does</Caption>
          <Text as="div" size="2" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {version.instruction_spec.length > 320
              ? version.instruction_spec.slice(0, 320).trim() + '…'
              : version.instruction_spec}
          </Text>
          {version.instruction_spec.length > 320 && (
            <Button asChild variant="ghost" size="1" mt="3">
              <a href={`#/agents/${agent.id}/advanced`}>
                Read full brief
                <IconArrowRight className="ic ic--sm" />
              </a>
            </Button>
          )}
        </Box>
      </div>

      <Grid columns={{ initial: '1', sm: '3' }} gap="3">
        {stats.map(s => (
          <Box key={s.label} className="card" p="4">
            <Text as="div" size="1" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              {s.label}
            </Text>
            <Text as="div" size="6" weight="medium" mt="2">{s.value}</Text>
          </Box>
        ))}
      </Grid>

      <div className="card">
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">
            <IconRun className="ic" />
            Recent activity
          </Text>
          <Button asChild variant="ghost" color="gray" size="1">
            <a href={`#/agents/${agent.id}/activity`}>
              <IconArrowRight className="ic ic--sm" />
              All activity
            </a>
          </Button>
        </div>
        {recentRuns.length === 0 ? (
          <Box p="4">
            <Text as="div" size="2" color="gray">No activity yet.</Text>
          </Box>
        ) : (
          <Flex direction="column">
            {recentRuns.map((r, i) => (
              <Link
                key={r.id}
                to={`/activity/${r.id}`}
                className="agent-row"
                style={{
                  gridTemplateColumns: 'minmax(0, 1fr) auto auto 24px',
                  gap: '14px',
                  borderBottom: i === recentRuns.length - 1 ? 0 : '1px solid var(--gray-a3)',
                }}
              >
                <Box minWidth="0">
                  <Text as="div" size="2" className="truncate">
                    {statusLabel(r.status)}
                  </Text>
                  <Text as="div" size="1" color="gray" mt="1">
                    {ago(r.created_at)}
                    {r.suspended_stage && ` · ${stageLabel(r.suspended_stage)}`}
                  </Text>
                </Box>
                <Status status={r.status} />
                <Text as="span" size="1" color="gray">
                  {money(r.total_cost_usd, { cents: r.total_cost_usd < 100 })}
                </Text>
                <IconArrowRight className="ic" />
              </Link>
            ))}
          </Flex>
        )}
      </div>
    </Flex>
  )
}

// ────────────────────────────────────────────────────────── Talk-to tab
// Two-column layout always: sidebar with past chats on the left, ChatPanel
// (draft or embed) on the right. Sidebar persists across chat switches so the
// user keeps their context — only the right pane remounts when chatId changes.

function TalkToTab({ agent, chats, canTalk, chatId }: { agent: Agent; chats: Chat[]; canTalk: boolean; chatId?: string }) {
  const { navigate } = useRouter()

  if (!canTalk) {
    return (
      <Banner tone="warn" title={agent.status !== 'active' ? `${agent.name} is paused` : 'Not configured yet'}>
        {agent.status !== 'active'
          ? 'Ask a workspace admin to resume this agent before starting a chat.'
          : 'Create a setup before talking to this agent.'}
      </Banner>
    )
  }

  return (
    <div
      data-tour="agent-talk-tab-content"
      style={{
        display: 'grid',
        gridTemplateColumns: '280px minmax(0, 1fr)',
        gap: 16,
        alignItems: 'start',
      }}
    >
      {/* Sidebar — list of past chats with this agent + new-chat trigger. */}
      <aside
        style={{
          background: 'var(--gray-2)',
          border: '1px solid var(--gray-a3)',
          borderRadius: 8,
          overflow: 'hidden',
          position: 'sticky',
          top: 16,
        }}
      >
        <Flex
          align="center"
          justify="between"
          gap="2"
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--gray-a3)',
            background: 'var(--gray-a2)',
          }}
        >
          <Caption>Conversations</Caption>
          <Button asChild variant={chatId ? 'soft' : 'solid'} size="1">
            <Link to={`/agents/${agent.id}/talk`}>
              <IconPlus />New
            </Link>
          </Button>
        </Flex>

        <Flex
          direction="column"
          style={{
            maxHeight: 'calc(100svh - 320px)',
            overflowY: 'auto',
          }}
        >
          {chats.length === 0 ? (
            <Text as="div" size="1" color="gray" style={{ padding: '14px 12px' }}>
              No chats yet. Send a message to start one.
            </Text>
          ) : (
            chats.map((c, i) => {
              const active = chatId === c.id
              return (
                <Link
                  key={c.id}
                  to={`/agents/${agent.id}/talk/${c.id}`}
                  style={{
                    display: 'block',
                    padding: '10px 12px',
                    background: active ? 'var(--accent-a3)' : 'transparent',
                    borderLeft: active ? '3px solid var(--accent-9)' : '3px solid transparent',
                    borderBottom: i === chats.length - 1 ? 0 : '1px solid var(--gray-a3)',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  <Text as="div" size="2" weight={active ? 'medium' : 'regular'} className="truncate">
                    {c.title ?? 'Conversation'}
                  </Text>
                  <Flex align="center" gap="2" mt="1">
                    <Text size="1" color="gray">{ago(c.updated_at)}</Text>
                    {c.status !== 'active' && <Status status={c.status} />}
                  </Flex>
                </Link>
              )
            })
          )}
        </Flex>
      </aside>

      {/* Main pane — ChatPanel in draft (no chatId) or embed (chatId set). */}
      <div className="chat-detail chat-detail--embed">
        {chatId ? (
          <ChatPanel key={chatId} chatId={chatId} mode="embed" />
        ) : (
          <ChatPanel
            mode="draft"
            agent={agent}
            agentVersion={agent.active_version!}
            onCreated={(newChatId) =>
              navigate(`/agents/${agent.id}/talk/${newChatId}`, { replace: true })
            }
            emptyHint={`Say something to ${agent.name.split(' ')[0]} — your chat starts when you send the first message.`}
          />
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────── Activity tab
// Per-agent run feed. Same vocabulary as /activity.

function ActivityTab({ agent, runs }: { agent: Agent; runs: RunListItem[] }) {
  if (runs.length === 0) {
    return (
      <EmptyState
        icon={<IconRun />}
        title="No activity yet"
        body={`Once ${agent.name} starts working, its activity will appear here.`}
      />
    )
  }
  return (
    <div className="card card--flush">
      <Flex direction="column">
        {runs.map((r, i) => (
          <Link
            key={r.id}
            to={`/activity/${r.id}`}
            className="agent-row"
            style={{
              gridTemplateColumns: 'minmax(0, 1fr) auto auto 24px',
              gap: '14px',
              borderBottom: i === runs.length - 1 ? 0 : '1px solid var(--gray-a3)',
            }}
          >
            <Box minWidth="0">
              <Text as="div" size="2" className="truncate">
                {statusLabel(r.status)}
              </Text>
              <Text as="div" size="1" color="gray" mt="1">
                {ago(r.created_at)}
                {r.suspended_stage && ` · ${stageLabel(r.suspended_stage)}`}
              </Text>
            </Box>
            <Status status={r.status} />
            <Text as="span" size="1" color="gray">
              {money(r.total_cost_usd, { cents: r.total_cost_usd < 100 })}
            </Text>
            <IconArrowRight className="ic" />
          </Link>
        ))}
      </Flex>
    </div>
  )
}

// ────────────────────────────────────────────────────────── Settings tab
// Read-only profile card. Pause / Fire / Resume actions are not surfaced
// here — those would need PATCH /agents/{id} which the live spec doesn't
// expose. See docs/backend-gaps.md and the Manage-employment note below.

function SettingsTab({
  agent,
}: {
  agent: Agent
}) {
  return (
    <Flex direction="column" gap="4">
      <div className="card">
        <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">Agent details</Text></div>
        <div className="card__body">
          <DataList.Root size="2">
            <MetaRow label="name" value={agent.name} />
            <MetaRow label="description" value={agent.description ?? <Text color="gray">—</Text>} />
            <MetaRow label="status" value={<Status status={agent.status} />} />
            <MetaRow label="team" value={domainLabel(agent.domain_id)} />
            <MetaRow label="created" value={absTime(agent.created_at)} />
            <MetaRow label="updated" value={`${absTime(agent.updated_at)} · ${ago(agent.updated_at)}`} />
          </DataList.Root>
        </div>
      </div>

      {/* "Manage employment" card (Pause / Fire placeholder) hidden until
          backend ships PATCH /agents/{id} or POST /agents/{id}/pause + DELETE
          /agents/{id}. See docs/handoff-prep.md § 2.2. Restore the card here
          when endpoints exist; remove the disabled-buttons pattern in favour
          of real wiring. */}
    </Flex>
  )
}

// ────────────────────────────────────────────────────────── Advanced tab
// Limited to fields the live OpenAPI actually defines on AgentVersion:
// `version`, `is_active`, `created_at`, `instruction_spec`. The four
// `*_config` objects (model_chain_config / memory_scope_config /
// tool_scope_config / approval_rules) are spec'd as
// `object additionalProperties: true` — their internal shape is NOT
// fixed by the contract, so we don't render speculated fields here.
// `GET /internal/agents/{id}/grants/snapshot` exists but is x-internal
// (orchestrator-only), so the UI doesn't call it. See docs/backend-gaps.md.

function AdvancedTab({
  agent,
  version,
  canEdit,
  onRetrain,
}: {
  agent: Agent
  version: AgentVersion | null
  canEdit: boolean
  onRetrain: () => void
}) {
  if (!version) {
    return (
      <Banner tone="info" title="No setup to inspect">
        This agent hasn't been configured yet. Once a setup exists, advanced details appear here.
      </Banner>
    )
  }
  return (
    <Flex direction="column" gap="4">
      <ActiveVersionCard
        version={version}
        canEdit={canEdit}
        agentName={agent.name}
        onRetrain={onRetrain}
      />
      <InstructionsCard text={version.instruction_spec} />
      <Banner tone="info" title="Setup history is single-version for now">
        Only the current setup is shown. Retraining replaces the current brief and archives the previous version.
      </Banner>
    </Flex>
  )
}

function ActiveVersionCard({
  version, canEdit, agentName, onRetrain,
}: {
  version: AgentVersion
  canEdit: boolean
  agentName: string
  onRetrain: () => void
}) {
  const firstName = agentName.split(' ')[0] || agentName
  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Current setup</Text>
        <Flex align="center" gap="2">
          <Badge color="blue" variant="soft" radius="full" size="1">v{version.version}</Badge>
          {canEdit && (
            <Button variant="ghost" size="1" onClick={onRetrain}>
              Retrain {firstName}
            </Button>
          )}
        </Flex>
      </div>
      <div className="card__body">
        <DataList.Root size="2">
          <MetaRow label="version" value={`v${version.version}`} />
          <MetaRow label="status" value={version.is_active ? 'Active' : 'Inactive'} />
          <MetaRow label="created" value={absTime(version.created_at)} />
        </DataList.Root>
      </div>
    </div>
  )
}

function InstructionsCard({ text }: { text: string }) {
  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Brief</Text>
        <Text size="1" color="gray">setup brief</Text>
      </div>
      <div className="card__body">
        <Text
          as="div"
          size="2"
          style={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
            fontStyle: 'italic',
            borderLeft: '3px solid var(--accent-a6)',
            paddingLeft: 14,
            color: 'var(--gray-12)',
          }}
        >
          {text}
        </Text>
      </div>
    </div>
  )
}

