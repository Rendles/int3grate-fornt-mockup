import { useEffect, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Status, Tabs, CommandBar, InfoHint, PolicyModeChip } from '../components/common'
import { Banner, LoadingList, NoAccessState } from '../components/states'
import { IconPlay, IconPlus } from '../components/icons'
import { GrantsEditor } from '../components/grants-editor'
import { api } from '../lib/api'
import { useAuth } from '../auth'
import type { Agent, AgentVersion, GrantsSnapshot, ToolGrant } from '../lib/types'
import { absTime, ago } from '../lib/format'

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
                Loaded via <span className="mono">GET /agents/{'{id}'}</span>. The active version is embedded in the response.
              </InfoHint>
            </>
          }
          title={agent.name}
          subtitle={agent.description ?? ''}
          actions={
            <>
              <Status status={agent.status} />
              {activeVersion && <Chip tone="accent">v{activeVersion.version}</Chip>}
              <Btn
                variant="primary"
                icon={<IconPlay />}
                href={`/tasks/new?agent=${agent.id}`}
                disabled={agent.status !== 'active'}
              >
                Start task
              </Btn>
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
          <div className="stack">
            <GrantsEditor agent={agent} grants={grants} canEdit={canEdit} onChange={setGrants} />
            <div style={{ height: 12 }} />
            <PolicySnapshotPanel agentId={agent.id} grantsVersion={grants?.length ?? 0} />
          </div>
        )}
        {tab === 'settings' && <SettingsTab agent={agent} />}
      </div>
    </AppShell>
  )
}

function OverviewTab({ agent, version, canEdit }: { agent: Agent; version: AgentVersion | null; canEdit: boolean }) {
  return (
    <div className="stack">
      <div className="card">
        <div className="card__head">
          <div className="card__title">Active version</div>
          {version ? (
            <Chip tone="accent">v{version.version}</Chip>
          ) : (
            canEdit
              ? <Btn variant="primary" size="sm" href={`/agents/${agent.id}/versions/new`} icon={<IconPlus />}>Create v1</Btn>
              : <Chip tone="warn">no active version</Chip>
          )}
        </div>
        <div className="card__body">
          {version ? (
            <div>
              <MetaRow label="id" value={<span className="mono">{version.id}</span>} />
              <MetaRow label="version" value={<span className="mono">{version.version}</span>} />
              <MetaRow label="is_active" value={version.is_active ? 'true' : 'false'} />
              <MetaRow label="created_by" value={<span className="mono">{version.created_by ?? '—'}</span>} />
              <MetaRow label="created_at" value={<span className="mono">{absTime(version.created_at)}</span>} />
              <div className="mono uppercase muted" style={{ marginTop: 16, marginBottom: 6 }}>instruction_spec</div>
              <pre
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--text)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  padding: 12,
                  borderRadius: 4,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {version.instruction_spec}
              </pre>
              <div className="grid grid--2" style={{ gap: 12, marginTop: 14 }}>
                <JsonPanel title="memory_scope_config" value={version.memory_scope_config} />
                <JsonPanel title="tool_scope_config" value={version.tool_scope_config} />
                <JsonPanel title="approval_rules" value={version.approval_rules} />
                <JsonPanel title="model_chain_config" value={version.model_chain_config} />
              </div>
              {canEdit && (
                <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                  <Btn variant="ghost" size="sm" href={`/agents/${agent.id}/versions/new`} icon={<IconPlus />}>
                    New version
                  </Btn>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 13, marginBottom: 16 }}>
                This agent has no active version. {canEdit ? 'Create one to make it runnable.' : 'An admin needs to create one.'}
              </div>
              {canEdit && (
                <Btn variant="primary" href={`/agents/${agent.id}/versions/new`}>Create v1</Btn>
              )}
            </div>
          )}
        </div>
      </div>

      <Banner tone="info" title="Only the active version is exposed">
        Version history isn't listable in this build. You can still create a new version and activate it.
      </Banner>
    </div>
  )
}

function SettingsTab({ agent }: { agent: Agent }) {
  return (
    <div className="stack">
      <div className="card">
        <div className="card__head"><div className="card__title">Agent metadata</div></div>
        <div className="card__body">
          <MetaRow label="id" value={<span className="mono">{agent.id}</span>} />
          <MetaRow label="name" value={agent.name} />
          <MetaRow label="description" value={agent.description ?? <span className="muted">null</span>} />
          <MetaRow label="status" value={<Status status={agent.status} />} />
          <MetaRow label="tenant_id" value={<span className="mono">{agent.tenant_id}</span>} />
          <MetaRow label="domain_id" value={<span className="mono">{agent.domain_id ?? '—'}</span>} />
          <MetaRow label="owner_user_id" value={<span className="mono">{agent.owner_user_id ?? '—'}</span>} />
          <MetaRow label="created_at" value={<span className="mono">{absTime(agent.created_at)}</span>} />
          <MetaRow label="updated_at" value={<span className="mono">{absTime(agent.updated_at)} · {ago(agent.updated_at)}</span>} />
        </div>
      </div>

      <Banner tone="warn" title="Editing and archiving are not yet available">
        Agent records can be created and viewed in this build. Editing, archiving, and deletion are planned.
      </Banner>

      <div className="card">
        <div className="card__body">
          <div className="row row--between" style={{ padding: '8px 0' }}>
            <div>
              <div style={{ fontSize: 13 }}>Archive agent</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>Planned.</div>
            </div>
            <Btn variant="danger" disabled>Archive (planned)</Btn>
          </div>
          <div className="row row--between" style={{ padding: '8px 0' }}>
            <div>
              <div style={{ fontSize: 13 }}>Delete agent</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>Planned.</div>
            </div>
            <Btn variant="danger" disabled>Delete (planned)</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row row--between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
      <span className="mono uppercase muted" style={{ fontSize: 10.5 }}>{label}</span>
      <span style={{ fontSize: 12 }}>{value}</span>
    </div>
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
        borderColor: 'var(--border-2)',
        background: 'color-mix(in oklab, var(--text-dim) 4%, var(--surface))',
      }}
    >
      <div className="card__head">
        <div className="card__title">
          Policy snapshot{' '}
          <Chip tone="ghost" square>internal</Chip>{' '}
          <InfoHint>
            Rendered from <span className="mono">GET /internal/agents/{'{id}'}/grants/snapshot</span>{' '}
            (<span className="mono">x-internal: true</span>, service-to-service only).
            The orchestrator calls this at run start to pin policy for the lifetime of a run.
            <br /><br />
            Shown here only so operators can preview what the orchestrator sees.
            Not reachable from end-user clients.
          </InfoHint>
        </div>
        <div className="row row--sm">
          {snapshot && <Chip tone="ghost" square>version {snapshot.version}</Chip>}
          <Btn variant="ghost" size="sm" onClick={() => setTick(t => t + 1)}>Refresh</Btn>
        </div>
      </div>
      <div className="card__body" style={{ padding: 0 }}>
        {loading || !snapshot ? (
          <div style={{ padding: 20 }}><LoadingList rows={3} /></div>
        ) : snapshot.grants.length === 0 ? (
          <div style={{ padding: 20, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
            No effective policy entries — this agent has no grants.
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 180px minmax(0, 1fr)',
                gap: 14,
                padding: '10px 16px',
                background: 'var(--surface-2)',
                borderBottom: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
              }}
            >
              <span>tool</span>
              <span>policy_mode</span>
              <span>scopes</span>
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
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span className="mono" style={{ fontSize: 12 }}>{g.tool}</span>
                <span><PolicyModeChip mode={g.mode} /></span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {g.scopes && g.scopes.length > 0
                    ? g.scopes.join(', ')
                    : <span className="muted">—</span>}
                </span>
              </div>
            ))}
            <div
              className="mono"
              style={{
                padding: '8px 16px',
                fontSize: 10.5,
                color: 'var(--text-dim)',
                background: 'var(--surface-2)',
                borderTop: '1px solid var(--border)',
              }}
            >
              issued_at {absTime(snapshot.issued_at)} · tenant {snapshot.tenant_id}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function JsonPanel({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <div>
      <div className="mono uppercase muted" style={{ fontSize: 9.5, marginBottom: 6 }}>{title}</div>
      <pre
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          padding: 10,
          borderRadius: 4,
          margin: 0,
          whiteSpace: 'pre-wrap',
          overflow: 'auto',
          maxHeight: 180,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}
