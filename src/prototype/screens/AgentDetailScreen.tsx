import { useEffect, useState } from 'react'
import { Badge, Button, Code, DataList, Flex, Grid, Text } from '@radix-ui/themes'
import { AppShell } from '../components/shell'
import { Caption, PageHeader, MetaRow, Status, Tabs, CommandBar, InfoHint } from '../components/common'
import { Banner, LoadingList, NoAccessState } from '../components/states'
import { IconPlay, IconPlus } from '../components/icons'
import { GrantsEditor } from '../components/grants-editor'
import { api } from '../lib/api'
import { useAuth } from '../auth'
import type { Agent, AgentVersion, GrantsSnapshot, ToolGrant } from '../lib/types'
import { absTime, ago, toolLabel } from '../lib/format'

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

  useEffect(() => {
    api.getAgent(agentId).then(a => setAgent(a ?? null))
    api.getGrants(agentId).then(setGrants)
  }, [agentId])

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
              {`AGENT · ${agent.id}`}{' '}
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
                <a href={`#/tasks/new?agent=${agent.id}`}>
                  <IconPlay />
                  Start task
                </a>
              </Button>
            </>
          }
        />

        <CommandBar
          parts={[
            { label: 'ID', value: agent.id },
            { label: 'TENANT', value: agent.tenant_id },
            { label: 'DOMAIN', value: agent.domain_id ?? '—' },
            { label: 'OWNER', value: agent.owner_user_id ?? '—' },
            { label: 'ACTIVE VER', value: activeVersion ? `v${activeVersion.version}` : '—', tone: activeVersion ? 'accent' : 'warn' },
            { label: 'UPDATED', value: ago(agent.updated_at) },
          ]}
        />

        <div style={{ height: 20 }} />

        <Tabs items={tabs} active={tab} />

        {tab === 'overview' && <OverviewTab agent={agent} version={activeVersion} canEdit={canEdit} />}
        {tab === 'grants' && (
          <Flex direction="column" gap="3">
            <GrantsEditor agent={agent} grants={grants} canEdit={canEdit} onChange={setGrants} />
            <PolicySnapshotPanel agentId={agent.id} grantsVersion={grants?.length ?? 0} />
          </Flex>
        )}
        {tab === 'settings' && <SettingsTab agent={agent} />}
      </div>
    </AppShell>
  )
}

function OverviewTab({ agent, version, canEdit }: { agent: Agent; version: AgentVersion | null; canEdit: boolean }) {
  return (
    <Flex direction="column" gap="4">
      <div className="card">
        <div className="card__head">
          <Text as="div" size="2" weight="medium" className="card__title">Active version</Text>
          {version ? (
            <Badge color="blue" variant="soft" radius="full" size="1">v{version.version}</Badge>
          ) : (
            canEdit
              ? <Button asChild size="1"><a href={`#/agents/${agent.id}/versions/new`}><IconPlus />Create v1</a></Button>
              : <Badge color="amber" variant="soft" radius="full" size="1">no active version</Badge>
          )}
        </div>
        <div className="card__body">
          {version ? (
            <div>
              <DataList.Root size="2">
                <MetaRow label="id" value={<Code variant="ghost">{version.id}</Code>} />
                <MetaRow label="version" value={<Code variant="ghost">{version.version}</Code>} />
                <MetaRow label="is_active" value={version.is_active ? 'true' : 'false'} />
                <MetaRow label="created_by" value={<Code variant="ghost">{version.created_by ?? '—'}</Code>} />
                <MetaRow label="created_at" value={<Code variant="ghost">{absTime(version.created_at)}</Code>} />
              </DataList.Root>
              <Caption as="div" mt="4" mb="2">instruction_spec</Caption>
              <Code asChild size="1" variant="soft">
                <pre
                  style={{
                    padding: 12,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5,
                  }}
                >
                  {version.instruction_spec}
                </pre>
              </Code>
              <Grid columns="2" gap="3" mt="4">
                <JsonPanel title="memory_scope_config" value={version.memory_scope_config} />
                <JsonPanel title="tool_scope_config" value={version.tool_scope_config} />
                <JsonPanel title="approval_rules" value={version.approval_rules} />
                <JsonPanel title="model_chain_config" value={version.model_chain_config} />
              </Grid>
              {canEdit && (
                <Flex justify="end" mt="4">
                  <Button asChild variant="ghost" size="1">
                    <a href={`#/agents/${agent.id}/versions/new`}>
                      <IconPlus />
                      New version
                    </a>
                  </Button>
                </Flex>
              )}
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <Text as="div" size="2" color="gray" mb="4">
                This agent has no active version. {canEdit ? 'Create one to make it runnable.' : 'An admin needs to create one.'}
              </Text>
              {canEdit && (
                <Button asChild><a href={`#/agents/${agent.id}/versions/new`}>Create v1</a></Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Banner tone="info" title="Only the active version is exposed">
        Version history isn't listable in this build. You can still create a new version and activate it.
      </Banner>
    </Flex>
  )
}

function SettingsTab({ agent }: { agent: Agent }) {
  return (
    <Flex direction="column" gap="4">
      <div className="card">
        <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">Agent metadata</Text></div>
        <div className="card__body">
          <MetaRow label="id" value={<Code variant="ghost">{agent.id}</Code>} />
          <MetaRow label="name" value={agent.name} />
          <MetaRow label="description" value={agent.description ?? <Text color="gray">null</Text>} />
          <MetaRow label="status" value={<Status status={agent.status} />} />
          <MetaRow label="tenant_id" value={<Code variant="ghost">{agent.tenant_id}</Code>} />
          <MetaRow label="domain_id" value={<Code variant="ghost">{agent.domain_id ?? '—'}</Code>} />
          <MetaRow label="owner_user_id" value={<Code variant="ghost">{agent.owner_user_id ?? '—'}</Code>} />
          <MetaRow label="created_at" value={<Code variant="ghost">{absTime(agent.created_at)}</Code>} />
          <MetaRow label="updated_at" value={<Code variant="ghost">{absTime(agent.updated_at)} · {ago(agent.updated_at)}</Code>} />
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
              <Text as="span" size="1" color="gray">policy_mode</Text>
              <Text as="span" size="1" color="gray">scopes</Text>
            </div>
            {snapshot.grants.map((g, i) => (
              <div
                key={`${g.tool}-${i}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 180px minmax(0, 1fr)',
                  gap: 14,
                  padding: '10px 16px',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--gray-a3)',
                }}
              >
                <Text as="div" size="2">{toolLabel(g.tool)}</Text>
                <span>
                  <Badge
                    color={g.mode === 'read_only' ? 'cyan' : g.mode === 'requires_approval' ? 'amber' : 'red'}
                    variant="soft"
                    radius="small"
                    size="1"
                  >
                    {g.mode}
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
              issued_at {absTime(snapshot.issued_at)} · tenant {snapshot.tenant_id}
            </Text>
          </>
        )}
      </div>
    </div>
  )
}

function JsonPanel({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <div>
      <Caption as="div" mb="2">{title}</Caption>
      <Code asChild size="1" variant="soft">
        <pre
          style={{
            padding: 10,
            margin: 0,
            whiteSpace: 'pre-wrap',
            overflow: 'auto',
            maxHeight: 180,
          }}
        >
          {JSON.stringify(value, null, 2)}
        </pre>
      </Code>
    </div>
  )
}
