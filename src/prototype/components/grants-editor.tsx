import { useEffect, useState } from 'react'
import { Badge, Button, Flex, IconButton, Select, Text } from '@radix-ui/themes'
import { Caption } from './common/caption'

import { api } from '../lib/api'
import { appLabel, appPrefix, toolLabel } from '../lib/format'
import type { Agent, ToolDefinition, ToolGrant, ToolGrantMode } from '../lib/types'
import { Banner, LoadingList, NoAccessState } from './states'
import { IconAlert, IconCheck, IconPlus, IconX } from './icons'

// Plan section 7.5 collapses the underlying mode (read|write|read_write) +
// approval_required:bool axes into a single tri-state PermissionLevel. The
// data model stays the same — we just don't expose every cell of the matrix
// in the UI. Power users who need finer-grained settings use the API.
type PermissionLevel = 'read' | 'write_auto' | 'write_approval'

const PERMISSION_OPTIONS: { value: PermissionLevel; label: string; hint: string }[] = [
  { value: 'read', label: 'Read only', hint: 'Can read data, never write.' },
  { value: 'write_auto', label: 'Read & write (auto)', hint: 'Can read and write without your approval.' },
  { value: 'write_approval', label: 'Read & write (with approval)', hint: 'Can read; writes need your approval first.' },
]

function levelFromGrant(g: { mode: ToolGrantMode; approval_required: boolean }): PermissionLevel {
  if (g.mode === 'read') return 'read'
  return g.approval_required ? 'write_approval' : 'write_auto'
}

function applyLevel(level: PermissionLevel): { mode: ToolGrantMode; approval_required: boolean } {
  if (level === 'read') return { mode: 'read', approval_required: false }
  if (level === 'write_auto') return { mode: 'read_write', approval_required: false }
  return { mode: 'read_write', approval_required: true }
}

const GRID_COLS = 'minmax(0, 1fr) 220px 36px'

function PermissionSelect({
  value,
  onChange,
  tour,
}: {
  value: PermissionLevel
  onChange: (v: PermissionLevel) => void
  tour?: string
}) {
  return (
    <Select.Root value={value} onValueChange={v => onChange(v as PermissionLevel)} size="2">
      <Select.Trigger
        variant="surface"
        data-tour={tour}
        style={{ width: '100%', justifyContent: 'space-between' }}
      />
      <Select.Content position="popper" sideOffset={4}>
        {PERMISSION_OPTIONS.map(opt => (
          <Select.Item key={opt.value} value={opt.value}>
            {opt.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  )
}

/**
 * Catalog tool picker for adding grants. Already-granted tools are hidden so
 * the same tool can't be added twice. Tool name + app + description show up
 * inside the popup; the trigger shows just the tool name once selected.
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
            ? 'Loading apps…'
            : exhausted
              ? 'Every app is already permitted'
              : 'Pick an app permission to add…'
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
  // compare during render and call setState inside the branch.
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
          body="Only admins can manage permissions. You can still see what's permitted below."
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

  const updateLevel = (id: string, level: PermissionLevel) => {
    const patch = applyLevel(level)
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
        // New permissions default to "Read only" — the safest option. Admins
        // can step up to write or write-with-approval per row.
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

  const writeAutoCount = local.filter(g => levelFromGrant(g) === 'write_auto').length

  return (
    <div>
      <Flex align="center" justify="between" gap="3" mb="3">
        <Caption as="div">
          {local.length} {local.length === 1 ? 'permission' : 'permissions'}
          {' · '}
          {local.filter(g => g.approval_required).length} require approval
        </Caption>
        <Flex align="center" gap="2">
          {dirty && <Button variant="ghost" size="1" onClick={reset} disabled={saving}>Reset</Button>}
          <Button size="1" onClick={save} disabled={!dirty || saving} data-tour="grants-save">
            <IconCheck />
            {saving ? 'saving…' : 'Save permissions'}
          </Button>
        </Flex>
      </Flex>

      {saveError && (
        <Banner tone="warn" title="Couldn't save permissions">
          {saveError}
        </Banner>
      )}

      <div className="card card--table">
        <div className="table-head" style={{ gridTemplateColumns: GRID_COLS }}>
          <Text as="span" size="1" color="gray">app · what</Text>
          <Text as="span" size="1" color="gray">permission</Text>
          <span />
        </div>
        {local.length === 0 ? (
          <Text as="div" size="2" color="gray" align="center" style={{ padding: '24px 16px' }}>
            No permissions yet. Pick one below to give this agent access.
          </Text>
        ) : (
          local.map(g => (
            <div
              key={g.id}
              className="grants-row"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <ToolNameCell name={g.tool_name} />
              <PermissionSelect
                value={levelFromGrant(g)}
                onChange={level => updateLevel(g.id, level)}
                tour="grants-mode"
              />
              <IconButton
                size="2"
                variant="ghost"
                color="red"
                onClick={() => removeGrant(g.id)}
                title="Remove permission"
                aria-label="Remove permission"
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
            Add permission
          </Button>
        </div>
      </div>

      {writeAutoCount > 0 && (
        <>
          <div style={{ height: 12 }} />
          <Banner tone="warn" title={`${writeAutoCount} ${writeAutoCount === 1 ? 'permission lets' : 'permissions let'} this agent write without approval`}>
            <Flex align="center" gap="2">
              <IconAlert className="ic ic--sm" />
              <Text as="span" size="2">
                Switch to <strong>Read &amp; write (with approval)</strong> if you want a human to confirm every write.
              </Text>
            </Flex>
          </Banner>
        </>
      )}

    </div>
  )
}

function ToolNameCell({ name }: { name: string }) {
  const prefix = appPrefix(name)
  const app = appLabel(prefix)
  const action = toolLabel(name).replace(`${app} · `, '')
  return (
    <Flex direction="column" minWidth="0">
      <Text as="span" size="2" weight="medium" className="truncate">{app}</Text>
      <Text as="span" size="1" color="gray" className="truncate">
        {action === toolLabel(name) ? '—' : action}
      </Text>
    </Flex>
  )
}

function ReadOnlyGrants({ grants }: { grants: ToolGrant[] }) {
  if (grants.length === 0) {
    return <Text as="div" size="2" color="gray">No permissions configured.</Text>
  }
  const cols = 'minmax(0, 1fr) 220px'
  return (
    <div className="card card--table">
      <div className="table-head" style={{ gridTemplateColumns: cols }}>
        <Text as="span" size="1" color="gray">app · what</Text>
        <Text as="span" size="1" color="gray">permission</Text>
      </div>
      {grants.map(g => {
        const level = levelFromGrant(g)
        const meta = PERMISSION_OPTIONS.find(o => o.value === level)!
        return (
          <div
            key={g.id}
            className="grants-row grants-row--readonly"
            style={{ gridTemplateColumns: cols }}
          >
            <ToolNameCell name={g.tool_name} />
            <Badge
              color={level === 'read' ? 'cyan' : level === 'write_approval' ? 'amber' : 'red'}
              variant="soft"
              radius="full"
              size="1"
            >
              {meta.label}
            </Badge>
          </div>
        )
      })}
    </div>
  )
}
