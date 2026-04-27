import { useEffect, useState } from 'react'
import { Badge, Button, Flex, IconButton, Select, Switch, Text } from '@radix-ui/themes'
import { Caption } from './common/caption'

import { api } from '../lib/api'
import { grantModeLabel, toolLabel } from '../lib/format'
import type { Agent, ToolDefinition, ToolGrant, ToolGrantMode, ToolGrantScopeType } from '../lib/types'
import { Banner, LoadingList, NoAccessState } from './states'
import { IconAlert, IconCheck, IconPlus, IconX } from './icons'

const MODES: ToolGrantMode[] = ['read', 'write', 'read_write']
const SCOPES: ToolGrantScopeType[] = ['tenant', 'domain', 'agent']

// Same template for header + rows so columns line up regardless of inputs.
const GRID_COLS = 'minmax(0, 1fr) 150px 170px 160px 36px'

/**
 * Compact Radix Select sized to fill its grid cell. Differs from `SelectField`
 * (which is a form-style wrapper with label + hint + error chrome) — here we
 * skip the chrome so the trigger sits cleanly in a table row, vertically
 * centered with the surrounding Switch and IconButton.
 */
function InlineSelect({
  value,
  onChange,
  options,
  tour,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  tour?: string
}) {
  return (
    <Select.Root value={value} onValueChange={onChange} size="2">
      <Select.Trigger
        variant="surface"
        data-tour={tour}
        style={{ width: '100%', justifyContent: 'space-between' }}
      />
      <Select.Content position="popper" sideOffset={4}>
        {options.map(opt => (
          <Select.Item key={opt.value} value={opt.value}>
            {opt.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  )
}

/**
 * Catalog tool picker for adding grants. Replaces the native <input list>
 * /<datalist> combo because the OS-rendered popup ignored our styles, was
 * too narrow, and produced a stray indicator on Chromium.
 *
 * Uses Radix Select. Already-granted tools are hidden so the same tool can't
 * be added twice. Tool description renders as a second line under the name.
 */
function CatalogPicker({
  value,
  onChange,
  catalog,
  granted,
  tour,
}: {
  value: string
  onChange: (v: string) => void
  catalog: ToolDefinition[]
  granted: string[]
  tour?: string
}) {
  const grantedSet = new Set(granted)
  const available = catalog.filter(t => !grantedSet.has(t.name))
  const exhausted = catalog.length > 0 && available.length === 0

  return (
    <Select.Root
      value={value || undefined}
      onValueChange={onChange}
      size="2"
      disabled={catalog.length === 0 || exhausted}
    >
      <Select.Trigger
        variant="surface"
        className="catalog-trigger"
        data-tour={tour}
        placeholder={
          catalog.length === 0
            ? 'Loading tool catalog…'
            : exhausted
              ? 'Every catalog tool is already granted'
              : 'Pick a tool to grant…'
        }
        style={{ width: '100%', justifyContent: 'space-between' }}
      />
      <Select.Content position="popper" sideOffset={4} style={{ maxHeight: 320 }}>
        {available.map(t => (
          <Select.Item key={t.name} value={t.name} className="catalog-item">
            <span className="catalog-item__name">{toolLabel(t.name)}</span>
            {t.description && (
              <span className="catalog-item__desc">{t.description}</span>
            )}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  )
}

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
          <Button size="1" onClick={save} disabled={!dirty || saving} data-tour="grants-save">
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

      <div className="card card--table">
        <div className="table-head" style={{ gridTemplateColumns: GRID_COLS }}>
          <Text as="span" size="1" color="gray">tool</Text>
          <Text as="span" size="1" color="gray">scope</Text>
          <Text as="span" size="1" color="gray">access</Text>
          <Text as="span" size="1" color="gray">approval</Text>
          <span />
        </div>
        {local.length === 0 ? (
          <Text as="div" size="2" color="gray" align="center" style={{ padding: '24px 16px' }}>
            No grants yet. Add one below.
          </Text>
        ) : (
          local.map(g => (
            <div
              key={g.id}
              className="grants-row"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <Text size="2" data-tour="grants-tool-cell">{toolLabel(g.tool_name)}</Text>
              <InlineSelect
                value={g.scope_type}
                onChange={v => updateGrant(g.id, { scope_type: v as ToolGrantScopeType })}
                options={SCOPES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                tour="grants-scope-type"
              />
              <InlineSelect
                value={g.mode}
                onChange={v => updateGrant(g.id, { mode: v as ToolGrantMode })}
                options={MODES.map(m => ({ value: m, label: grantModeLabel(m) }))}
                tour="grants-mode"
              />
              <Flex align="center" gap="2" asChild>
                <label style={{ cursor: 'pointer' }} data-tour="grants-policy">
                  <Switch
                    size="2"
                    checked={g.approval_required}
                    onCheckedChange={v => updateGrant(g.id, { approval_required: v })}
                  />
                  <Text size="2">{g.approval_required ? 'Required' : 'Auto'}</Text>
                </label>
              </Flex>
              <IconButton
                size="2"
                variant="ghost"
                color="red"
                onClick={() => removeGrant(g.id)}
                title="Remove grant"
                aria-label="Remove grant"
              >
                <IconX />
              </IconButton>
            </div>
          ))
        )}

        <div className="grants-add">
          <CatalogPicker
            value={newTool}
            onChange={setNewTool}
            catalog={catalog}
            granted={local.map(g => g.tool_name)}
            tour="grants-catalog"
          />
          <Button size="2" onClick={addGrant} disabled={!newTool.trim()} data-tour="grants-add">
            <IconPlus />
            Add grant
          </Button>
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
    return <Text as="div" size="2" color="gray">No grants configured.</Text>
  }
  const cols = 'minmax(0, 1fr) 110px 130px 120px'
  return (
    <div className="card card--table">
      <div className="table-head" style={{ gridTemplateColumns: cols }}>
        <Text as="span" size="1" color="gray">tool</Text>
        <Text as="span" size="1" color="gray">scope</Text>
        <Text as="span" size="1" color="gray">access</Text>
        <Text as="span" size="1" color="gray">approval</Text>
      </div>
      {grants.map(g => (
        <div
          key={g.id}
          className="grants-row grants-row--readonly"
          style={{ gridTemplateColumns: cols }}
        >
          <Text size="2">{toolLabel(g.tool_name)}</Text>
          <Badge color="gray" variant="soft" radius="full" size="1">{g.scope_type.charAt(0).toUpperCase() + g.scope_type.slice(1)}</Badge>
          <Badge color="gray" variant="soft" radius="full" size="1">{grantModeLabel(g.mode)}</Badge>
          {g.approval_required
            ? <Badge color="amber" variant="soft" radius="full" size="1">Approval</Badge>
            : <Badge color="gray" variant="outline" radius="full" size="1">Auto</Badge>}
        </div>
      ))}
    </div>
  )
}
