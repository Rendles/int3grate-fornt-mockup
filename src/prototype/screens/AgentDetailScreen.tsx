import { useEffect, useState } from 'react'
import { Badge, Box, Button, DataList, Flex, Grid, Text } from '@radix-ui/themes'
import { AppShell } from '../components/shell'
import { Avatar, Caption, PageHeader, MetaRow, Status, Tabs, InfoHint } from '../components/common'
import { Banner, EmptyState, LoadingList, NoAccessState } from '../components/states'
import { IconArrowRight, IconChat, IconPlus, IconRun } from '../components/icons'
import { GrantsEditor } from '../components/grants-editor'
import { ChatPanel } from '../components/chat-panel'
import { Link } from '../router'
import { api } from '../lib/api'
import { useAuth } from '../auth'
import type { Agent, AgentVersion, Chat, GrantsSnapshot, RunListItem, ToolGrant } from '../lib/types'
import { absTime, ago, domainLabel, money, num, policyModeLabel, stageLabel, toolLabel } from '../lib/format'
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

  useEffect(() => {
    api.getAgent(agentId).then(a => setAgent(a ?? null))
    api.getGrants(agentId).then(setGrants)
    api.listRuns({ limit: 100 }).then(r => setRuns(r.items.filter(it => it.agent_id === agentId)))
  }, [agentId])

  useEffect(() => {
    if (!user) return
    api.listChats({ id: user.id, role: user.role }, { agent_id: agentId, limit: 50 })
      .then(res => setChats(res.items))
  }, [agentId, user])

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
              <Button asChild disabled={!canTalk}>
                <a href={canTalk ? `#/agents/${agent.id}/talk` : undefined} data-tour="agent-talk-cta">
                  <IconChat />
                  Talk to {agent.name.split(' ')[0]}
                </a>
              </Button>
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
            grantsVersion={grants?.length ?? 0}
            canEdit={canEdit}
          />
        )}
      </div>
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
}: {
  agent: Agent
  version: AgentVersion | null
  recentRuns: RunListItem[]
  canEdit: boolean
}) {
  if (!version) {
    return (
      <div className="card">
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">Not configured yet</Text>
          {canEdit && (
            <Button asChild size="1"><a href={`#/agents/${agent.id}/versions/new`}><IconPlus />Create v1</a></Button>
          )}
        </div>
        <div className="card__body">
          <Text as="div" size="2" color="gray" mb="4">
            This agent doesn't have a setup yet. {canEdit ? 'Create one to make it runnable.' : 'An admin needs to create one.'}
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
                    {r.suspended_stage ? 'Waiting for your approval' : 'Activity'}
                  </Text>
                  <Text as="div" size="1" color="gray" mt="1">
                    {ago(r.created_at)}
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
// Recent chats with this agent + "Start new chat" CTA.

function TalkToTab({ agent, chats, canTalk, chatId }: { agent: Agent; chats: Chat[]; canTalk: boolean; chatId?: string }) {
  if (!canTalk) {
    return (
      <Banner tone="warn" title={agent.status !== 'active' ? `${agent.name} is paused` : 'Not configured yet'}>
        {agent.status !== 'active'
          ? 'Resume the agent in Settings to start a chat.'
          : 'Create a setup before talking to this agent.'}
      </Banner>
    )
  }

  // Embedded mode — a specific chat is selected via /agents/:id/talk/:chatId.
  // Render the chat panel inline above the past-chats list so the user can
  // both keep talking and jump to other conversations.
  if (chatId) {
    return (
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between" gap="2" wrap="wrap">
          <Caption>Conversation</Caption>
          <Button asChild variant="ghost" color="gray" size="1">
            <Link to={`/agents/${agent.id}/talk`}>← All chats with {agent.name.split(' ')[0]}</Link>
          </Button>
        </Flex>
        <div className="chat-detail chat-detail--embed">
          {/* `key` forces a fresh mount when chat changes, so loading state
              shows immediately instead of briefly displaying the previous
              chat's messages. */}
          <ChatPanel key={chatId} chatId={chatId} mode="embed" />
        </div>
      </Flex>
    )
  }

  return (
    <Flex direction="column" gap="3">
      <div className="card" data-tour="agent-talk-tab-content" style={{ borderColor: 'var(--accent-a6)' }}>
        <Flex align="center" gap="3" p="4" wrap="wrap">
          <Box style={{ color: 'var(--accent-9)' }}>
            <IconChat size={22} />
          </Box>
          <Box flexGrow="1" minWidth="0">
            <Text as="div" size="3" weight="medium">Start a new chat</Text>
            <Text as="div" size="2" color="gray" mt="1">
              Replies stream in real time. Each chat is locked to one model — open a new one to switch.
            </Text>
          </Box>
          <Button asChild size="2">
            <a href={`#/chats/new?agent=${agent.id}`}>
              <IconChat />
              New chat
            </a>
          </Button>
        </Flex>
      </div>

      {chats.length === 0 ? (
        <EmptyState
          icon={<IconChat />}
          title="No chats yet"
          body={`Open a new chat to talk to ${agent.name}.`}
        />
      ) : (
        <div className="card card--flush">
          <div className="card__head">
            <Text as="div" size="2" weight="medium" className="card__title">Past chats</Text>
            <Text size="1" color="gray">{chats.length}</Text>
          </div>
          <Flex direction="column">
            {chats.map((c, i) => (
              <Link
                key={c.id}
                to={`/agents/${agent.id}/talk/${c.id}`}
                className="agent-row"
                style={{
                  gridTemplateColumns: 'minmax(0, 1fr) auto auto auto 24px',
                  gap: '14px',
                  borderBottom: i === chats.length - 1 ? 0 : '1px solid var(--gray-a3)',
                }}
              >
                <Box minWidth="0">
                  <Text as="div" size="2" weight="medium" className="truncate">
                    {c.title ?? `Conversation`}
                  </Text>
                  <Text as="div" size="1" color="gray" mt="1">
                    {ago(c.updated_at)}
                  </Text>
                </Box>
                <Badge color="gray" variant="soft" radius="full" size="1" style={{ fontFamily: 'var(--font-mono)' }}>
                  {c.model}
                </Badge>
                <Status status={c.status} />
                <Text size="1" color="gray">{money(c.total_cost_usd, { cents: c.total_cost_usd < 100 })}</Text>
                <IconArrowRight className="ic" />
              </Link>
            ))}
          </Flex>
        </div>
      )}
    </Flex>
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
// Profile-ish card + Pause / Fire actions (planned).

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
// All the technical config knobs power users care about: model chain, memory,
// tool scope, approval rules, raw brief, policy snapshot.

function AdvancedTab({
  agent,
  version,
  grantsVersion,
  canEdit,
}: {
  agent: Agent
  version: AgentVersion | null
  grantsVersion: number
  canEdit: boolean
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
        agentId={agent.id}
      />
      <InstructionsCard text={version.instruction_spec} />
      <Grid columns={{ initial: '1', md: '2' }} gap="4">
        <ModelChainCard config={version.model_chain_config} />
        <MemoryScopeCard config={version.memory_scope_config} />
      </Grid>
      <Grid columns={{ initial: '1', md: '2' }} gap="4">
        <ToolScopeCard config={version.tool_scope_config} agentId={agent.id} />
        <ApprovalRulesCard config={version.approval_rules} />
      </Grid>
      <PolicySnapshotPanel agentId={agent.id} grantsVersion={grantsVersion} />
      <Banner tone="info" title="Setup history is single-version for now">
        Only the current setup is shown. Re-creating a setup activates the new one and archives the previous.
      </Banner>
    </Flex>
  )
}

// ─────────────────────────────────────────────────────────────────
// Config cards (kept from the previous Overview tab, now used in Advanced)
// ─────────────────────────────────────────────────────────────────

function ActiveVersionCard({
  version, canEdit, agentId,
}: {
  version: AgentVersion
  canEdit: boolean
  agentId: string
}) {
  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Current setup</Text>
        <Flex align="center" gap="2">
          <Badge color="blue" variant="soft" radius="full" size="1">v{version.version}</Badge>
          {canEdit && (
            <Button asChild variant="ghost" size="1">
              <a href={`#/agents/${agentId}/versions/new`}><IconPlus />New setup</a>
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

function ModelChainCard({ config }: { config: Record<string, unknown> }) {
  const primary = typeof config.primary === 'string' ? config.primary : null
  const fallbacks = Array.isArray(config.fallbacks)
    ? (config.fallbacks.filter(f => typeof f === 'string') as string[])
    : []
  const maxTokens = typeof config.max_tokens === 'number' ? config.max_tokens : null
  const temperature = typeof config.temperature === 'number' ? config.temperature : null
  const tempHint = temperature == null
    ? null
    : temperature <= 0.2
      ? 'deterministic'
      : temperature <= 0.5
        ? 'focused'
        : temperature <= 0.8
          ? 'balanced'
          : 'exploratory'

  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Model</Text>
      </div>
      <div className="card__body">
        <Flex direction="column" gap="3">
          <Flex align="center" justify="between" gap="3">
            <Caption>Primary</Caption>
            {primary
              ? <ModelBadge name={primary} variant="solid" />
              : <Text size="1" color="gray">—</Text>}
          </Flex>
          <Flex align="center" justify="between" gap="3">
            <Caption>Fallbacks</Caption>
            {fallbacks.length === 0 ? (
              <Text size="1" color="gray">none</Text>
            ) : (
              <Flex gap="1" wrap="wrap" justify="end">
                {fallbacks.map(f => <ModelBadge key={f} name={f} variant="soft" />)}
              </Flex>
            )}
          </Flex>
          <Flex align="center" justify="between" gap="3">
            <Caption>Response length limit</Caption>
            <Text size="2">{maxTokens != null ? num(maxTokens) : '—'}</Text>
          </Flex>
          <Flex align="center" justify="between" gap="3">
            <Caption>Creativity</Caption>
            <Flex align="center" gap="2">
              <Text size="2">{temperature != null ? temperature.toFixed(1) : '—'}</Text>
              {tempHint && <Text size="1" color="gray">· {tempHint}</Text>}
            </Flex>
          </Flex>
        </Flex>
      </div>
    </div>
  )
}

function ModelBadge({ name, variant }: { name: string; variant: 'solid' | 'soft' }) {
  return (
    <Badge
      color="blue"
      variant={variant === 'solid' ? 'solid' : 'soft'}
      radius="small"
      size="1"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      {name}
    </Badge>
  )
}

function MemoryScopeCard({ config }: { config: Record<string, unknown> }) {
  const userFacts = config.user_facts === true
  const sessionOnly = config.session_only === true
  const domainShared = config.domain_shared === true
  const retentionDays = typeof config.retention_days === 'number' ? config.retention_days : null

  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Memory</Text>
      </div>
      <div className="card__body">
        <Flex direction="column" gap="3">
          <ToggleRow on={userFacts} label="Remembers user facts" hint="Saves things the user shares about themselves between sessions." />
          <ToggleRow on={sessionOnly} label="Session-only" hint="If on, memory is wiped when the session ends." />
          <ToggleRow on={domainShared} label="Shared across team" hint="Other agents on the same team can read what this one remembers." />
          <Flex align="center" justify="between" gap="3">
            <Caption>Retention</Caption>
            <Text size="2">
              {retentionDays != null ? `${retentionDays} ${retentionDays === 1 ? 'day' : 'days'}` : '—'}
            </Text>
          </Flex>
        </Flex>
      </div>
    </div>
  )
}

function ToggleRow({ on, label, hint }: { on: boolean; label: string; hint?: string }) {
  return (
    <Flex align="center" justify="between" gap="3">
      <Flex align="center" gap="2" minWidth="0">
        <Text size="2">{label}</Text>
        {hint && <InfoHint>{hint}</InfoHint>}
      </Flex>
      {on
        ? <Badge color="green" variant="soft" radius="full" size="1">On</Badge>
        : <Badge color="gray" variant="outline" radius="full" size="1">Off</Badge>}
    </Flex>
  )
}

function ToolScopeCard({ config, agentId }: { config: Record<string, unknown>; agentId: string }) {
  const inherits = config.inherits_from_agent === true
  const overrides = Array.isArray(config.overrides)
    ? (config.overrides.filter(o => typeof o === 'string') as string[])
    : []
  const denylist = Array.isArray(config.denylist)
    ? (config.denylist.filter(d => typeof d === 'string') as string[])
    : []

  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Apps</Text>
        <Button asChild variant="ghost" size="1">
          <a href={`#/agents/${agentId}/grants`}>Open permissions</a>
        </Button>
      </div>
      <div className="card__body">
        <Flex direction="column" gap="3">
          <ToggleRow
            on={inherits}
            label="Uses agent's permissions"
            hint="When on, this setup sees every app permission granted to the agent unless explicitly overridden below."
          />
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Caption>Overrides</Caption>
            {overrides.length === 0 ? (
              <Text size="1" color="gray">none</Text>
            ) : (
              <Flex gap="1" wrap="wrap" justify="end">
                {overrides.map(o => (
                  <Badge key={o} color="blue" variant="soft" radius="small" size="1">{toolLabel(o)}</Badge>
                ))}
              </Flex>
            )}
          </Flex>
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Caption>Denylist</Caption>
            {denylist.length === 0 ? (
              <Text size="1" color="gray">none</Text>
            ) : (
              <Flex gap="1" wrap="wrap" justify="end">
                {denylist.map(d => (
                  <Badge key={d} color="red" variant="soft" radius="small" size="1">{toolLabel(d)}</Badge>
                ))}
              </Flex>
            )}
          </Flex>
        </Flex>
      </div>
    </div>
  )
}

interface ApprovalRule {
  id?: string
  when?: string
  required_approver_level?: number
}

function ApprovalRulesCard({ config }: { config: Record<string, unknown> }) {
  const rawRules = Array.isArray(config.rules) ? config.rules : []
  const rules: ApprovalRule[] = rawRules.filter(
    (r): r is ApprovalRule => typeof r === 'object' && r != null,
  )

  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Approval rules</Text>
        {rules.length > 0 && (
          <Badge color="amber" variant="soft" radius="full" size="1">{rules.length}</Badge>
        )}
      </div>
      <div className="card__body">
        {rules.length === 0 ? (
          <Text as="div" size="2" color="gray">
            No rules configured — this agent runs without human approval gates.
          </Text>
        ) : (
          <Flex direction="column" gap="3">
            {rules.map((r, i) => (
              <ApprovalRuleRow key={r.id ?? i} rule={r} />
            ))}
          </Flex>
        )}
      </div>
    </div>
  )
}

function ApprovalRuleRow({ rule }: { rule: ApprovalRule }) {
  const when = rule.when ?? '—'
  const m = /^([a-z0-9_]+(?:\.[a-z0-9_]+)+)(.*)$/i.exec(when)
  const toolPart = m?.[1] ?? null
  const conditionPart = m?.[2]?.trim() ?? null
  const level = rule.required_approver_level

  return (
    <Flex
      align="center"
      justify="between"
      gap="3"
      wrap="wrap"
      style={{
        padding: '10px 12px',
        background: 'var(--amber-a2)',
        border: '1px solid var(--amber-a4)',
        borderRadius: 4,
      }}
    >
      <Flex align="center" gap="2" wrap="wrap" minWidth="0">
        <Text size="1" color="gray">When</Text>
        {toolPart ? (
          <Badge color="blue" variant="soft" radius="small" size="1">{toolLabel(toolPart)}</Badge>
        ) : (
          <Text size="2">{when}</Text>
        )}
        {conditionPart && (
          <Text size="2" color="gray" style={{ fontFamily: 'var(--font-mono)' }}>{conditionPart}</Text>
        )}
        <Text size="1" color="gray">runs</Text>
      </Flex>
      <Flex align="center" gap="2">
        <Text size="1" color="gray">needs</Text>
        {level != null
          ? <Badge color="amber" variant="soft" radius="full" size="1">Level {level} approver</Badge>
          : <Text size="2" color="gray">approver</Text>}
      </Flex>
    </Flex>
  )
}

function PolicySnapshotPanel({ agentId, grantsVersion }: { agentId: string; grantsVersion: number }) {
  const [snapshot, setSnapshot] = useState<GrantsSnapshot | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.getGrantsSnapshot(agentId)
      .then(s => { if (!cancelled) setSnapshot(s) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [agentId, grantsVersion, tick])

  const loading = !snapshot || snapshot.agent_id !== agentId

  return (
    <div
      className="card"
      style={{
        borderStyle: 'dashed',
        borderColor: 'var(--gray-7)',
        background: 'color-mix(in oklab, var(--gray-10) 4%, var(--gray-2))',
      }}
    >
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">
          Policy snapshot{' '}
          <Badge color="gray" variant="outline" radius="small" size="1">internal</Badge>{' '}
          <InfoHint>
            The exact set of permissions and rules pinned for one activity at the moment it starts. Useful for admins verifying what an agent is operating under. Most users never need this view.
          </InfoHint>
        </Text>
        <Flex align="center" gap="2">
          {snapshot && <Badge color="gray" variant="outline" radius="small" size="1">version {snapshot.version}</Badge>}
          <Button variant="ghost" size="1" onClick={() => setTick(t => t + 1)}>Refresh</Button>
        </Flex>
      </div>
      <div className="card__body" style={{ padding: 0 }}>
        {loading || !snapshot ? (
          <div style={{ padding: 20 }}><LoadingList rows={3} /></div>
        ) : snapshot.grants.length === 0 ? (
          <Text as="div" size="1" color="gray" align="center" style={{ padding: 20 }}>
            No effective policy entries — this agent has no permissions.
          </Text>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 180px minmax(0, 1fr)',
                gap: 14,
                padding: '10px 16px',
                background: 'var(--gray-a2)',
                borderBottom: '1px solid var(--gray-a3)',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
              }}
            >
              <Text as="span" size="1" color="gray">app</Text>
              <Text as="span" size="1" color="gray">policy</Text>
              <Text as="span" size="1" color="gray">scopes</Text>
            </div>
            {snapshot.grants.map((g, i) => (
              <div
                key={`${g.tool_name}-${i}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 180px minmax(0, 1fr)',
                  gap: 14,
                  padding: '10px 16px',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--gray-a3)',
                }}
              >
                <Text as="div" size="2">{toolLabel(g.tool_name)}</Text>
                <span>
                  <Badge
                    color={g.mode === 'read_only' ? 'cyan' : g.mode === 'requires_approval' ? 'amber' : 'red'}
                    variant="soft"
                    radius="small"
                    size="1"
                  >
                    {policyModeLabel(g.mode)}
                  </Badge>
                </span>
                <Text as="span" size="1" color="gray">
                  {g.scopes && g.scopes.length > 0
                    ? g.scopes.join(', ')
                    : '—'}
                </Text>
              </div>
            ))}
            <Text
              as="div"
              size="1"
              color="gray"
              style={{
                padding: '8px 16px',
                background: 'var(--gray-a2)',
                borderTop: '1px solid var(--gray-a3)',
              }}
            >
              issued {absTime(snapshot.issued_at)}
            </Text>
          </>
        )}
      </div>
    </div>
  )
}
