import { useEffect, useState } from 'react'
import { Box, Button, DataList, Dialog, DropdownMenu, Flex, Grid, IconButton, Text, TextField } from '@radix-ui/themes'
import { Edit02Icon } from '@hugeicons/core-free-icons'
import { AppShell } from '../components/shell'
import { Avatar, Caption, MockBadge, PageHeader, MetaRow, Status, Tabs } from '../components/common'
import { Banner, EmptyState, LoadingList, NoAccessState } from '../components/states'
import { Icon } from '../components/icon'
import { IconArrowRight, IconPlus, IconRun } from '../components/icons'
import { GrantsEditor } from '../components/grants-editor'
import { ChatPanel } from '../components/chat-panel'
import { RetrainDialog } from '../components/retrain-dialog'
import { VersionHistory } from '../components/version-history'
import { TextAreaField } from '../components/fields'
import { useUser } from '../lib/user-lookup'
import { Link, useRouter } from '../router'
import { api } from '../lib/api'
import { useAuth } from '../auth'
import type { Agent, AgentVersion, Chat, RunListItem, ToolGrant, Workspace } from '../lib/types'
import { absTime, ago, money, num, stageLabel, workspaceLabel } from '../lib/format'
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
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'not found' }]}>
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
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'loading…' }]}>
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
        { label: 'agents', to: '/agents' },
        { label: agent.name },
      ]}
    >
      <div className="page page--wide">
        <PageHeader
          eyebrow="AGENT"
          title={
            <EditableAgentName agent={agent} canEdit={canEdit} onSaved={handleRetrained} />
          }
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
            onAgentSaved={handleRetrained}
          />
        )}
        {tab === 'talk' && <TalkToTab agent={agent} chats={chats} canTalk={canTalk} chatId={chatId} />}
        {tab === 'grants' && (
          <GrantsEditor agent={agent} grants={grants} canEdit={canEdit} onChange={setGrants} />
        )}
        {tab === 'activity' && <ActivityTab agent={agent} runs={runs} />}
        {tab === 'settings' && (
          <SettingsTab agent={agent} canEdit={canEdit} onAgentSaved={handleRetrained} />
        )}
        {tab === 'advanced' && (
          <AdvancedTab
            agent={agent}
            version={activeVersion}
            canEdit={canEdit}
            onRetrain={() => setRetrainOpen(true)}
            onActivated={handleRetrained}
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
  onAgentSaved,
}: {
  agent: Agent
  version: AgentVersion | null
  recentRuns: RunListItem[]
  canEdit: boolean
  onRetrain: () => void
  onAgentSaved: () => void
}) {
  if (!version) {
    return (
      <Flex direction="column" gap="4">
        <AboutCard agent={agent} canEdit={canEdit} onSaved={onAgentSaved} />
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
      </Flex>
    )
  }

  const stats: { label: string; value: string }[] = [
    { label: 'Total spent', value: agent.total_spend_usd != null ? money(agent.total_spend_usd, { compact: true }) : '—' },
    { label: 'Activities', value: agent.runs_count != null ? num(agent.runs_count) : '—' },
    { label: 'Workspace', value: workspaceLabel(agent.domain_id) },
  ]

  return (
    <Flex direction="column" gap="4">
      <AboutCard agent={agent} canEdit={canEdit} onSaved={onAgentSaved} />
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
  canEdit,
  onAgentSaved,
}: {
  agent: Agent
  canEdit: boolean
  onAgentSaved: () => void
}) {
  const ownerName = useUser(agent.owner_user_id)?.name
  return (
    <Flex direction="column" gap="4">
      <div className="card">
        <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">Agent details</Text></div>
        <div className="card__body">
          <DataList.Root size="2">
            <MetaRow label="status" value={<Status status={agent.status} />} />
            <MetaRow
              label="owner"
              value={ownerName ?? <Text color="gray">Not assigned</Text>}
            />
            <MetaRow label="created" value={absTime(agent.created_at)} />
            <MetaRow label="updated" value={`${absTime(agent.updated_at)} · ${ago(agent.updated_at)}`} />
          </DataList.Root>
        </div>
      </div>

      <WorkspaceCard agent={agent} />

      <ManageEmploymentCard agent={agent} canEdit={canEdit} onSaved={onAgentSaved} />
    </Flex>
  )
}

// Workspace card — `agent.domain_id` IS the workspace FK in spec
// (docs/handoff-prep.md § 0.1: backend `domain` ≡ frontend `workspace`),
// and PATCH /agents/{id} now exists to mutate it (gateway 0.3.0 —
// setAgentWorkspace is a thin wrapper). The remaining spec-gap is the
// picker source: no `Workspace` schema and no `/workspaces` endpoints
// exist in spec, so the list of workspaces in the "Move to…" dropdown
// comes from client-side fixtures (see docs/backend-gaps.md § 1.15).
// MockBadge flags this honestly.
function WorkspaceCard({ agent }: { agent: Agent }) {
  const { myWorkspaces } = useAuth()
  const [current, setCurrent] = useState<Workspace | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.getAgentWorkspace(agent.id)
      .then(w => { if (!cancelled) setCurrent(w) })
      .catch(() => { if (!cancelled) setCurrent(null) })
    return () => { cancelled = true }
  }, [agent.id, reloadKey])

  const otherWorkspaces = myWorkspaces.filter(w => w.id !== current?.id)

  const onMove = async (targetId: string) => {
    if (busy || targetId === current?.id) return
    setBusy(true)
    try {
      await api.setAgentWorkspace(agent.id, targetId)
      setReloadKey(k => k + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card__head">
        <Flex align="center" gap="2">
          <Text as="span" size="2" weight="medium" className="card__title">Workspace</Text>
          <MockBadge
            kind="design"
            hint="The workspace picker is mock — no `Workspace` schema and no `/workspaces` endpoints exist in the backend spec, so the list is fed from client-side fixtures. The PATCH /agents/{id} call that moves the agent IS real (gateway 0.3.0). See docs/backend-gaps.md § 1.15."
          />
        </Flex>
      </div>
      <div className="card__body">
        {current === undefined ? (
          <Text size="2" color="gray">Loading…</Text>
        ) : current === null ? (
          <Banner tone="warn" title="Not assigned to a workspace">
            {agent.name} isn't pinned to a workspace. Pick one to make them
            visible to the right team.
          </Banner>
        ) : (
          <Flex direction="column" gap="3">
            <DataList.Root size="2">
              <MetaRow
                label="current"
                value={<Text size="2" weight="medium">{current.name}</Text>}
              />
              {current.description && (
                <MetaRow
                  label="about"
                  value={<Text size="2" color="gray">{current.description}</Text>}
                />
              )}
            </DataList.Root>
            <Flex justify="end">
              {otherWorkspaces.length === 0 ? (
                <Text size="1" color="gray">
                  No other workspaces to move them to.
                </Text>
              ) : (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    <Button variant="soft" color="gray" disabled={busy}>
                      {busy ? 'Moving…' : 'Move to…'}
                      <DropdownMenu.TriggerIcon />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content size="1">
                    <DropdownMenu.Label>Move to workspace</DropdownMenu.Label>
                    {otherWorkspaces.map(w => (
                      <DropdownMenu.Item
                        key={w.id}
                        onSelect={() => onMove(w.id)}
                      >
                        {w.name}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              )}
            </Flex>
          </Flex>
        )}
      </div>
    </div>
  )
}

// Manage employment card — Pause / Resume / Fire actions. Backed by
// PATCH /agents/{id}/status (gateway 0.3.0). Legal transitions are
// enforced server-side; we only surface the buttons that match the
// current state. Member role sees the card read-only (no buttons).
// Resume is instant (no dialog — reverting a pause is non-destructive).
// Pause needs a one-step confirm; Fire needs strong wording (history
// stays — no typed-confirmation, but red action button).
function ManageEmploymentCard({
  agent,
  canEdit,
  onSaved,
}: {
  agent: Agent
  canEdit: boolean
  onSaved: () => void
}) {
  type DialogKind = 'pause' | 'fire' | null
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstName = agent.name.split(' ')[0] || agent.name

  const transition = async (status: 'active' | 'paused' | 'archived') => {
    setBusy(true)
    setError(null)
    try {
      await api.patchAgentStatus(agent.id, { status })
      setDialog(null)
      onSaved()
    } catch (err) {
      setError((err as Error).message || 'Failed to update status')
    } finally {
      setBusy(false)
    }
  }

  const body = (() => {
    if (agent.status === 'draft') {
      return (
        <Text as="div" size="2" color="gray">
          This agent doesn't have a brief yet. Set one up to activate them.
        </Text>
      )
    }
    if (agent.status === 'archived') {
      return (
        <Text as="div" size="2" color="gray">
          {agent.name} was fired {ago(agent.updated_at)}. Their past activity stays in your history.
        </Text>
      )
    }
    return (
      <Flex direction="column" gap="4">
        {agent.status === 'active' ? (
          <EmploymentAction
            title="Pause employment"
            description="Pausing stops new activity. You can resume them any time."
            actionLabel="Pause"
            onAction={() => setDialog('pause')}
            disabled={!canEdit || busy}
            hide={!canEdit}
          />
        ) : (
          <EmploymentAction
            title="Resume employment"
            description={`${firstName} is currently paused. Resume to let them take on new work again.`}
            actionLabel="Resume"
            onAction={() => transition('active')}
            disabled={!canEdit || busy}
            hide={!canEdit}
          />
        )}

        {canEdit && <Box style={{ height: 1, background: 'var(--gray-a3)' }} />}

        <EmploymentAction
          title={`Fire ${agent.name}`}
          description="Removes them from your team. Their past activity stays in your history, but they can't be brought back."
          actionLabel={`Fire ${firstName}`}
          actionColor="red"
          onAction={() => setDialog('fire')}
          disabled={!canEdit || busy}
          hide={!canEdit}
        />

        {error && <Text as="div" size="1" color="red">{error}</Text>}
      </Flex>
    )
  })()

  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Manage employment</Text>
      </div>
      <div className="card__body">
        {body}
      </div>

      <Dialog.Root open={dialog === 'pause'} onOpenChange={open => { if (!open && !busy) setDialog(null) }}>
        <Dialog.Content size="2" maxWidth="440px">
          <Dialog.Title>Pause {agent.name}?</Dialog.Title>
          <Dialog.Description size="2" mb="3" color="gray">
            They will stop taking on new work. You can resume them any time.
          </Dialog.Description>
          <Flex gap="2" justify="end" mt="4">
            <Dialog.Close>
              <Button variant="soft" color="gray" disabled={busy}>Cancel</Button>
            </Dialog.Close>
            <Button onClick={() => transition('paused')} disabled={busy}>
              {busy ? 'Pausing…' : 'Pause'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={dialog === 'fire'} onOpenChange={open => { if (!open && !busy) setDialog(null) }}>
        <Dialog.Content size="2" maxWidth="460px">
          <Dialog.Title>Fire {agent.name}?</Dialog.Title>
          <Dialog.Description size="2" mb="3" color="gray">
            They will stop working immediately. Their past activity stays in your history, but they can't be brought back.
          </Dialog.Description>
          <Flex gap="2" justify="end" mt="4">
            <Dialog.Close>
              <Button variant="soft" color="gray" disabled={busy}>Cancel</Button>
            </Dialog.Close>
            <Button color="red" onClick={() => transition('archived')} disabled={busy}>
              {busy ? 'Firing…' : `Fire ${firstName}`}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  )
}

function EmploymentAction({
  title,
  description,
  actionLabel,
  actionColor,
  onAction,
  disabled,
  hide,
}: {
  title: string
  description: string
  actionLabel: string
  actionColor?: 'red'
  onAction: () => void
  disabled: boolean
  hide: boolean
}) {
  return (
    <Flex direction="column" gap="2">
      <Text as="div" size="2" weight="medium">{title}</Text>
      <Text as="div" size="2" color="gray">{description}</Text>
      {!hide && (
        <Flex>
          <Button
            variant="soft"
            color={actionColor ?? 'gray'}
            size="2"
            onClick={onAction}
            disabled={disabled}
          >
            {actionLabel}
          </Button>
        </Flex>
      )}
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
  onActivated,
}: {
  agent: Agent
  version: AgentVersion | null
  canEdit: boolean
  onRetrain: () => void
  onActivated: () => void
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
      <InstructionsCard text={version.instruction_spec} />
      <VersionHistory
        agentId={agent.id}
        agentName={agent.name}
        canEdit={canEdit}
        onRetrain={onRetrain}
        onActivated={onActivated}
      />
    </Flex>
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

// Inline-editable agent name. Lives inside PageHeader's `title` ReactNode
// on AgentDetail. Pencil icon shows on hover (admin/domain_admin only).
// Empty name disables Save (server also enforces 1-200 chars per spec).
function EditableAgentName({
  agent,
  canEdit,
  onSaved,
}: {
  agent: Agent
  canEdit: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(agent.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = () => {
    setValue(agent.name)
    setError(null)
    setEditing(true)
  }
  const cancel = () => { setEditing(false); setError(null) }
  const save = async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (trimmed === agent.name) { setEditing(false); return }
    setBusy(true)
    setError(null)
    try {
      await api.patchAgent(agent.id, { name: trimmed })
      onSaved()
      setEditing(false)
    } catch (err) {
      setError((err as Error).message || 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <Flex align="center" gap="3" wrap="wrap">
        <Avatar initials={agent.name.slice(0, 2).toUpperCase()} size={36} />
        <Box width={{ initial: '220px', sm: '360px' }}>
          <TextField.Root
            size="3"
            value={value}
            onChange={e => setValue(e.target.value)}
            maxLength={200}
            autoFocus
            disabled={busy}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); save() }
              if (e.key === 'Escape') { e.preventDefault(); cancel() }
            }}
          />
        </Box>
        <Button onClick={save} disabled={busy || !value.trim()} size="2">
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="soft" color="gray" onClick={cancel} disabled={busy} size="2">
          Cancel
        </Button>
        {error && <Text as="span" size="1" color="red">{error}</Text>}
      </Flex>
    )
  }

  return (
    <Flex align="center" gap="3" className="agent-title">
      <Avatar initials={agent.name.slice(0, 2).toUpperCase()} size={36} />
      <span>{agent.name}</span>
      {canEdit && (
        <IconButton
          variant="ghost"
          color="gray"
          size="2"
          onClick={startEdit}
          aria-label="Rename agent"
          className="agent-title__edit"
        >
          <Icon icon={Edit02Icon} className="ic ic--sm" />
        </IconButton>
      )}
    </Flex>
  )
}

// About card on Overview — describes what the agent does in Maria-facing
// language (separate from `instruction_spec`, which is the LLM brief on
// Advanced). Admin / domain_admin can edit through PATCH /agents/{id}
// (description field, nullable per spec). Empty save clears to null.
function AboutCard({
  agent,
  canEdit,
  onSaved,
}: {
  agent: Agent
  canEdit: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(agent.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = () => {
    setValue(agent.description ?? '')
    setError(null)
    setEditing(true)
  }
  const cancel = () => { setEditing(false); setError(null) }
  const save = async () => {
    const trimmed = value.trim()
    const next = trimmed || null
    if (next === (agent.description ?? null)) { setEditing(false); return }
    setBusy(true)
    setError(null)
    try {
      await api.patchAgent(agent.id, { description: next })
      onSaved()
      setEditing(false)
    } catch (err) {
      setError((err as Error).message || 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">About</Text>
        {canEdit && !editing && (
          <Button variant="ghost" size="1" onClick={startEdit}>Edit</Button>
        )}
      </div>
      <div className="card__body">
        {editing ? (
          <Flex direction="column" gap="3">
            <TextAreaField
              value={value}
              onChange={e => setValue(e.target.value)}
              disabled={busy}
              rows={3}
              placeholder="What does this agent do?"
            />
            {error && <Text as="div" size="1" color="red">{error}</Text>}
            <Flex gap="2" justify="end">
              <Button variant="soft" color="gray" onClick={cancel} disabled={busy} size="1">Cancel</Button>
              <Button onClick={save} disabled={busy} size="1">
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </Flex>
          </Flex>
        ) : (
          <Text as="div" size="2" color={agent.description ? undefined : 'gray'}>
            {agent.description ?? '—'}
          </Text>
        )}
      </div>
    </div>
  )
}

