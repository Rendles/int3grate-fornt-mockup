import { useEffect, useState } from 'react'
import { Badge, Button, Code, Flex, IconButton, Switch, Text } from '@radix-ui/themes'
import { Caption } from './common/caption'

import { api } from '../lib/api'
import type { Agent, ToolDefinition, ToolGrant, ToolGrantMode, ToolGrantScopeType } from '../lib/types'
import { Banner, LoadingList, NoAccessState } from './states'
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
      <Flex align="center" justify="between" gap="3" mb="3">
        <Caption as="div">
          {local.length} grants · {local.filter(g => g.approval_required).length} require approval
        </Caption>
        <Flex align="center" gap="2">
          {dirty && <Button variant="ghost" size="1" onClick={reset} disabled={saving}>Reset</Button>}
          <Button size="1" onClick={save} disabled={!dirty || saving}>
            <IconCheck />
            {saving ? 'saving…' : 'Save grants'}
          </Button>
        </Flex>
      </Flex>

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
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          <Text as="span" size="1" color="gray">tool_name</Text>
          <Text as="span" size="1" color="gray">scope</Text>
          <Text as="span" size="1" color="gray">mode</Text>
          <Text as="span" size="1" color="gray">approval</Text>
          <span />
        </div>
        {local.length === 0 ? (
          <Text as="div" size="1" color="gray" align="center" style={{ padding: '20px 16px' }}>
            No grants yet. Add one below.
          </Text>
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
              <Code variant="ghost" size="1">{g.tool_name}</Code>
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
              <Flex align="center" gap="2" asChild>
                <label>
                  <Switch
                    size="1"
                    checked={g.approval_required}
                    onCheckedChange={v => updateGrant(g.id, { approval_required: v })}
                  />
                  <Text size="2">{g.approval_required ? 'required' : 'auto'}</Text>
                </label>
              </Flex>
              <IconButton
                size="1"
                variant="ghost"
                color="red"
                onClick={() => removeGrant(g.id)}
                title="Remove grant"
                aria-label="Remove grant"
              >
                <IconX size={12} />
              </IconButton>
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
          <Button size="1" onClick={addGrant} disabled={!newTool.trim()}><IconPlus />Add</Button>
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
    return <Text as="div" size="1" color="gray">No grants configured.</Text>
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
          <Code variant="ghost" size="1">{g.tool_name}</Code>
          <Badge color="gray" variant="soft" radius="full" size="1">{g.scope_type}</Badge>
          <Badge color="gray" variant="soft" radius="full" size="1">{g.mode}</Badge>
          {g.approval_required
            ? <Badge color="amber" variant="soft" radius="full" size="1">approval</Badge>
            : <Badge color="gray" variant="outline" radius="full" size="1">auto</Badge>}
        </div>
      ))}
    </div>
  )
}
