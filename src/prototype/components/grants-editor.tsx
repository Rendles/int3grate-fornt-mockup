import { useEffect, useState } from 'react'
import { Code, Text } from '@radix-ui/themes'
import { Caption } from './common/caption'

import { api } from '../lib/api'
import type { Agent, ToolDefinition, ToolGrant, ToolGrantMode, ToolGrantScopeType } from '../lib/types'
import { Banner, LoadingList, NoAccessState } from './states'
import { Btn, Chip, Toggle } from './common'
import { SelectField, TextInput } from './fields'
import { IconAlert, IconCheck, IconPlus, IconX } from './icons'

const MODES: ToolGrantMode[] = ['read', 'write', 'read_write']
const SCOPES: ToolGrantScopeType[] = ['tenant', 'domain', 'agent']

export function GrantsEditor({
  agent, grants, canEdit, onChange,
}: {
  agent: Agent
  grants: ToolGrant[] | null
  canEdit: boolean
  onChange: (next: ToolGrant[]) => void
}) {
  const [baseline, setBaseline] = useState<ToolGrant[] | null>(grants)
  const [local, setLocal] = useState<ToolGrant[] | null>(grants)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [newTool, setNewTool] = useState('')
  const [catalog, setCatalog] = useState<ToolDefinition[]>([])

  useEffect(() => {
    let cancelled = false
    api.listTools().then(list => { if (!cancelled) setCatalog(list) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // React-recommended pattern for syncing external state into internal state:
  // compare during render and call setState inside the branch. React bails out
  // before the render commits, so there's no extra re-render.
  if (grants !== baseline) {
    setBaseline(grants)
    setLocal(grants)
    setSaveError(null)
  }

  if (!canEdit) {
    return (
      <div>
        <NoAccessState
          requiredRole="domain_admin or admin"
          body="Only admins can manage tool grants. You can still view what's granted below."
        />
        <div style={{ height: 12 }} />
        {local && <ReadOnlyGrants grants={local} />}
      </div>
    )
  }

  if (!local || !baseline) {
    return <LoadingList rows={4} />
  }

  const dirty = JSON.stringify(local) !== JSON.stringify(baseline)

  const updateGrant = (id: string, patch: Partial<ToolGrant>) => {
    setLocal(prev => prev ? prev.map(g => g.id === id ? { ...g, ...patch } : g) : prev)
  }

  const removeGrant = (id: string) => {
    setLocal(prev => prev ? prev.filter(g => g.id !== id) : prev)
  }

  const addGrant = () => {
    const name = newTool.trim()
    if (!name) return
    setLocal(prev => prev ? [
      ...prev,
      {
        id: `grt_new_${Date.now()}`,
        scope_type: 'agent',
        scope_id: agent.id,
        tool_name: name,
        mode: 'read',
        approval_required: false,
        config: {},
      },
    ] : prev)
    setNewTool('')
  }

  const reset = () => {
    setLocal(baseline)
    setSaveError(null)
  }

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      // Strip server-assigned fields: spec body is ReplaceToolGrantsRequest.
      const body = {
        grants: local.map(g => ({
          tool_name: g.tool_name,
          mode: g.mode,
          approval_required: g.approval_required,
          config: g.config,
        })),
      }
      const next = await api.setGrants(agent.id, body)
      setBaseline(next)
      setLocal(next)
      onChange(next)
    } catch (e) {
      setSaveError((e as Error).message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="row row--between" style={{ marginBottom: 12 }}>
        <Caption as="div">
          {local.length} grants · {local.filter(g => g.approval_required).length} require approval
        </Caption>
        <div className="row row--sm">
          {dirty && <Btn variant="ghost" size="sm" onClick={reset} disabled={saving}>Reset</Btn>}
          <Btn
            variant="primary"
            size="sm"
            onClick={save}
            disabled={!dirty || saving}
            icon={<IconCheck />}
          >
            {saving ? 'saving…' : 'Save grants'}
          </Btn>
        </div>
      </div>

      {saveError && (
        <Banner tone="warn" title="Couldn't save grants">
          {saveError}
        </Banner>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 130px 110px 110px 32px',
            gap: 12,
            padding: '10px 16px',
            background: 'var(--gray-3)',
            borderBottom: '1px solid var(--gray-6)',
            fontFamily: 'var(--code-font-family)',
            fontSize: 10,
            color: 'var(--gray-10)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          <span>tool_name</span>
          <span>scope</span>
          <span>mode</span>
          <span>approval</span>
          <span />
        </div>
        {local.length === 0 ? (
          <div style={{ padding: '20px 16px', color: 'var(--gray-11)', fontSize: 12.5, textAlign: 'center' }}>
            No grants yet. Add one below.
          </div>
        ) : (
          local.map(g => (
            <div
              key={g.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 130px 110px 110px 32px',
                gap: 12,
                padding: '10px 16px',
                alignItems: 'center',
                borderBottom: '1px solid var(--gray-6)',
              }}
            >
              <Code variant="ghost" style={{ fontSize: 12 }}>{g.tool_name}</Code>
              <SelectField
                size="1"
                value={g.scope_type}
                onChange={v => updateGrant(g.id, { scope_type: v as ToolGrantScopeType })}
                options={SCOPES.map(s => ({ value: s }))}
              />
              <SelectField
                size="1"
                value={g.mode}
                onChange={v => updateGrant(g.id, { mode: v as ToolGrantMode })}
                options={MODES.map(m => ({ value: m }))}
              />
              <Toggle
                on={g.approval_required}
                onChange={v => updateGrant(g.id, { approval_required: v })}
                label={g.approval_required ? 'required' : 'auto'}
              />
              <button
                onClick={() => removeGrant(g.id)}
                title="Remove grant"
                className="tb__action"
                style={{ color: 'var(--red-11)' }}
              >
                <IconX className="ic ic--sm" />
              </button>
            </div>
          ))
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 8,
            padding: '10px 16px',
            background: 'var(--gray-3)',
            borderTop: '1px solid var(--gray-6)',
          }}
        >
          <TextInput
            size="1"
            placeholder="tool_name (e.g. stripe.refund, slack.post_message)"
            value={newTool}
            onChange={e => setNewTool(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addGrant() }}
            list={`tool-catalog-${agent.id}`}
          />
          <datalist id={`tool-catalog-${agent.id}`}>
            {catalog.map(t => (
              <option key={t.name} value={t.name}>{t.description ?? ''}</option>
            ))}
          </datalist>
          <Btn size="sm" icon={<IconPlus />} onClick={addGrant} disabled={!newTool.trim()}>Add</Btn>
        </div>
      </div>

      {local.some(g => (g.mode === 'write' || g.mode === 'read_write') && !g.approval_required) && (
        <>
          <div style={{ height: 12 }} />
          <Banner tone="warn" title="Write access without approval">
            <>
              <IconAlert className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
              {' '}Some write grants don't require approval. The orchestrator will execute them without a human in the loop.
            </>
          </Banner>
        </>
      )}

    </div>
  )
}

function ReadOnlyGrants({ grants }: { grants: ToolGrant[] }) {
  if (grants.length === 0) {
    return <Text as="div" color="gray" style={{ fontSize: 12.5 }}>No grants configured.</Text>
  }
  return (
    <div className="card" style={{ padding: 0 }}>
      {grants.map(g => (
        <div
          key={g.id}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 100px 100px 100px',
            gap: 12,
            padding: '10px 16px',
            alignItems: 'center',
            borderBottom: '1px solid var(--gray-6)',
          }}
        >
          <Code variant="ghost" style={{ fontSize: 12 }}>{g.tool_name}</Code>
          <Chip>{g.scope_type}</Chip>
          <Chip>{g.mode}</Chip>
          {g.approval_required ? <Chip tone="warn">approval</Chip> : <Chip tone="ghost">auto</Chip>}
        </div>
      ))}
    </div>
  )
}
