import { useEffect, useState } from 'react'
import { Badge, Button, Code, DataList, Flex, Grid, Text } from '@radix-ui/themes'
import { AppShell } from '../components/shell'
import { Caption, PageHeader, MetaRow, MetricCard, Status, Tabs, CommandBar, InfoHint } from '../components/common'
import { Banner, LoadingList, NoAccessState } from '../components/states'
import { IconChat, IconPlus, IconSpend, IconTask } from '../components/icons'
import { GrantsEditor } from '../components/grants-editor'
import { api } from '../lib/api'
import { useAuth } from '../auth'
import type { Agent, AgentVersion, GrantsSnapshot, ToolGrant, User } from '../lib/types'
import { absTime, ago, domainLabel, money, num, policyModeLabel, toolLabel } from '../lib/format'

export default function AgentDetailScreen({
  agentId,
  tab,
}: {
  agentId: string
  tab: 'overview' | 'grants' | 'settings'
}) {
  const { user } = useAuth()
  const [agent, setAgent] = useState<Agent | null | undefined>(undefined)
  const [grants, setGrants] = useState<ToolGrant[] | null>(null)
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    api.getAgent(agentId).then(a => setAgent(a ?? null))
    api.getGrants(agentId).then(setGrants)
    api.listUsers().then(setUsers)
  }, [agentId])

  const userName = (id: string | null | undefined) =>
    (id && users.find(u => u.id === id)?.name) || '—'

  if (agent === null) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'not found' }]}>
        <div className="page">
          <NoAccessState
            requiredRole="visibility into this agent"
            body={`Agent ${agentId} could not be loaded.`}
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

  const tabs = [
    { key: 'overview', label: 'Overview', href: `/agents/${agent.id}` },
    { key: 'grants', label: 'Tool grants', count: grants?.length ?? '—', href: `/agents/${agent.id}/grants` },
    { key: 'settings', label: 'Settings', href: `/agents/${agent.id}/settings` },
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
          eyebrow={
            <>
              AGENT{' '}
              <InfoHint>
                Loaded via <Code variant="ghost">GET /agents/{'{id}'}</Code>. The active version is embedded in the response.
              </InfoHint>
            </>
          }
          title={agent.name}
          subtitle={agent.description ?? ''}
          actions={
            <>
              <Status status={agent.status} />
              {activeVersion && <Badge color="blue" variant="soft" radius="full" size="1">v{activeVersion.version}</Badge>}
              <Button asChild disabled={agent.status !== 'active'}>
                <a href={`#/chats/new?agent=${agent.id}`}>
                  <IconChat />
                  Start chat
                </a>
              </Button>
            </>
          }
        />

        <CommandBar
          parts={[
            { label: 'DOMAIN', value: domainLabel(agent.domain_id) },
            { label: 'OWNER', value: userName(agent.owner_user_id) },
            { label: 'ACTIVE VER', value: activeVersion ? `v${activeVersion.version}` : '—', tone: activeVersion ? 'accent' : 'warn' },
            { label: 'UPDATED', value: ago(agent.updated_at) },
          ]}
        />

        <div style={{ height: 20 }} />

        <Tabs items={tabs} active={tab} />

        {/* Breathing room between the tab strip (which has its own bottom-border
            anchor from Radix TabNav) and the tab content. Without it the
            content visually glues to the tabs; with a too-large gap the tabs
            float disconnected. 24px hits a comfortable middle. */}
        <div style={{ height: 24 }} />

        {tab === 'overview' && <OverviewTab agent={agent} version={activeVersion} canEdit={canEdit} authorName={userName(activeVersion?.created_by)} />}
        {tab === 'grants' && (
          <Flex direction="column" gap="3">
            <GrantsEditor agent={agent} grants={grants} canEdit={canEdit} onChange={setGrants} />
            <PolicySnapshotPanel agentId={agent.id} grantsVersion={grants?.length ?? 0} />
          </Flex>
        )}
        {tab === 'settings' && <SettingsTab agent={agent} ownerName={userName(agent.owner_user_id)} />}
      </div>
    </AppShell>
  )
}

function OverviewTab({ agent, version, canEdit, authorName }: { agent: Agent; version: AgentVersion | null; canEdit: boolean; authorName: string }) {
  const hasStats = agent.total_spend_usd != null || agent.runs_count != null
  return (
    <Flex direction="column" gap="4">
      {hasStats && (
        <Grid columns={{ initial: '1', md: '2' }} gap="4">
          <MetricCard
            label="Total spend"
            value={agent.total_spend_usd != null ? money(agent.total_spend_usd, { compact: true }) : '—'}
            unit={agent.total_spend_usd != null ? 'USD' : undefined}
            delta="across all runs"
            icon={<IconSpend />}
          />
          <MetricCard
            label="Runs"
            value={agent.runs_count != null ? num(agent.runs_count) : '—'}
            delta={agent.runs_count != null ? `${agent.runs_count === 1 ? 'run' : 'runs'} attributed to this agent` : 'no run history'}
            icon={<IconTask />}
          />
        </Grid>
      )}

      {version ? (
        <>
          <ActiveVersionCard
            version={version}
            authorName={authorName}
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
        </>
      ) : (
        <div className="card">
          <div className="card__head">
            <Text as="div" size="2" weight="medium" className="card__title">Active version</Text>
            {canEdit
              ? <Button asChild size="1"><a href={`#/agents/${agent.id}/versions/new`}><IconPlus />Create v1</a></Button>
              : <Badge color="amber" variant="soft" radius="full" size="1">no active version</Badge>}
          </div>
          <div className="card__body">
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <Text as="div" size="2" color="gray" mb="4">
                This agent has no active version. {canEdit ? 'Create one to make it runnable.' : 'An admin needs to create one.'}
              </Text>
              {canEdit && (
                <Button asChild><a href={`#/agents/${agent.id}/versions/new`}>Create v1</a></Button>
              )}
            </div>
          </div>
        </div>
      )}

      <Banner tone="info" title="Only the active version is exposed">
        Version history isn't listable in this build. You can still create a new version and activate it.
      </Banner>
    </Flex>
  )
}

// ─────────────────────────────────────────────────────────────────
// Overview cards
// ─────────────────────────────────────────────────────────────────

function ActiveVersionCard({
  version, authorName, canEdit, agentId,
}: {
  version: AgentVersion
  authorName: string
  canEdit: boolean
  agentId: string
}) {
  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Active version</Text>
        <Flex align="center" gap="2">
          <Badge color="blue" variant="soft" radius="full" size="1">v{version.version}</Badge>
          {canEdit && (
            <Button asChild variant="ghost" size="1">
              <a href={`#/agents/${agentId}/versions/new`}><IconPlus />New version</a>
            </Button>
          )}
        </Flex>
      </div>
      <div className="card__body">
        <DataList.Root size="2">
          <MetaRow label="version" value={`v${version.version}`} />
          <MetaRow label="status" value={version.is_active ? 'Active' : 'Inactive'} />
          <MetaRow label="created by" value={authorName} />
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
        <Text as="div" size="2" weight="medium" className="card__title">Instructions</Text>
        <Text size="1" color="gray">system prompt</Text>
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
            <Caption>Max tokens</Caption>
            <Text size="2">{maxTokens != null ? num(maxTokens) : '—'}</Text>
          </Flex>
          <Flex align="center" justify="between" gap="3">
            <Caption>Temperature</Caption>
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
          <ToggleRow on={domainShared} label="Shared across domain" hint="Other agents in the same domain can read what this one remembers." />
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
        <Text as="div" size="2" weight="medium" className="card__title">Tools</Text>
        <Button asChild variant="ghost" size="1">
          <a href={`#/agents/${agentId}/grants`}>Open grants</a>
        </Button>
      </div>
      <div className="card__body">
        <Flex direction="column" gap="3">
          <ToggleRow
            on={inherits}
            label="Uses agent's tool grants"
            hint="When on, this version sees every tool granted to the agent unless explicitly overridden below."
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
  // `when` can be a bare tool name like "email.send" or a guard expression like
  // "stripe.refund > 200". Render the tool part with its friendly label.
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

function SettingsTab({ agent, ownerName }: { agent: Agent; ownerName: string }) {
  return (
    <Flex direction="column" gap="4">
      <div className="card">
        <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">Agent details</Text></div>
        <div className="card__body">
          <DataList.Root size="2">
            <MetaRow label="name" value={agent.name} />
            <MetaRow label="description" value={agent.description ?? <Text color="gray">—</Text>} />
            <MetaRow label="status" value={<Status status={agent.status} />} />
            <MetaRow label="domain" value={domainLabel(agent.domain_id)} />
            <MetaRow label="owner" value={ownerName} />
            <MetaRow label="created" value={absTime(agent.created_at)} />
            <MetaRow label="updated" value={`${absTime(agent.updated_at)} · ${ago(agent.updated_at)}`} />
          </DataList.Root>
        </div>
      </div>

      <Banner tone="warn" title="Editing and archiving are not yet available">
        Agent records can be created and viewed in this build. Editing, archiving, and deletion are planned.
      </Banner>

      <div className="card">
        <div className="card__body">
          <Flex align="center" justify="between" gap="3" py="2">
            <div>
              <Text as="div" size="2">Archive agent</Text>
              <Text as="div" size="1" color="gray" mt="1">Planned.</Text>
            </div>
            <Button color="red" disabled>Archive (planned)</Button>
          </Flex>
          <Flex align="center" justify="between" gap="3" py="2">
            <div>
              <Text as="div" size="2">Delete agent</Text>
              <Text as="div" size="1" color="gray" mt="1">Planned.</Text>
            </div>
            <Button color="red" disabled>Delete (planned)</Button>
          </Flex>
        </div>
      </div>
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

  // Derived: covers initial load AND stale snapshot after agentId changes.
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
            Rendered from <Code variant="ghost">GET /internal/agents/{'{id}'}/grants/snapshot</Code>{' '}
            (<Code variant="ghost">x-internal: true</Code>, service-to-service only).
            The orchestrator calls this at run start to pin policy for the lifetime of a run.
            <br /><br />
            Shown here only so operators can preview what the orchestrator sees.
            Not reachable from end-user clients.
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
            No effective policy entries — this agent has no grants.
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
              <Text as="span" size="1" color="gray">tool</Text>
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

