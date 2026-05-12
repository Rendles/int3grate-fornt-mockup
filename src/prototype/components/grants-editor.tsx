import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Flex, IconButton, Text } from '@radix-ui/themes'
import { Caption } from './common/caption'

import { api } from '../lib/api'
import { appLabel, appPrefix, toolLabel } from '../lib/format'
import type { Agent, ToolDefinition, ToolGrant, ToolGrantMode, ToolPolicyMode } from '../lib/types'
import { Banner, LoadingList, NoAccessState } from './states'
import { IconAlert, IconArrowRight, IconCheck, IconLock, IconPlus, IconX } from './icons'

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

// Shape of an unsaved grant. Matches `ReplaceToolGrantsRequest.grants[]` in
// the gateway spec — no id / scope_* (gateway assigns those on save). Used by
// `GrantsForm` (controlled) so callers without an existing agent (e.g. the
// hire wizard at /agents/new) can still pick permissions before the agent
// exists. Persisted grants (`ToolGrant`) carry id + scope; map to/from this
// shape at the save boundary.
export type GrantDraft = {
  tool_name: string
  mode: ToolGrantMode
  approval_required: boolean
  config?: Record<string, unknown>
}

function levelFromGrant(g: { mode: ToolGrantMode; approval_required: boolean }): PermissionLevel {
  if (g.mode === 'read') return 'read'
  return g.approval_required ? 'write_approval' : 'write_auto'
}

function applyLevel(level: PermissionLevel): { mode: ToolGrantMode; approval_required: boolean } {
  if (level === 'read') return { mode: 'read', approval_required: false }
  if (level === 'write_auto') return { mode: 'read_write', approval_required: false }
  return { mode: 'read_write', approval_required: true }
}

// Compact 3-state level toggle used inside each tool row. Replaces the
// dropdown that lived here previously — clearer, single click, narrower.
const LEVEL_OPTIONS: { value: PermissionLevel; label: string; hint: string }[] = [
  { value: 'read', label: 'Read', hint: 'Read only' },
  { value: 'write_approval', label: 'Ask', hint: 'Read & write — confirm every write' },
  { value: 'write_auto', label: 'Auto', hint: 'Read & write — no confirmation' },
]

function policyModeToDraft(mode: ToolPolicyMode, tool_name: string): GrantDraft {
  if (mode === 'requires_approval') return { tool_name, mode: 'read_write', approval_required: true }
  // read_only and the denied fallback both map to read; denied is filtered upstream.
  return { tool_name, mode: 'read', approval_required: false }
}

type AppGroup = {
  prefix: string
  label: string
  rows: Array<{
    tool: ToolDefinition
    granted: GrantDraft | null
    isDenied: boolean
  }>
}

function groupCatalog(catalog: ToolDefinition[], grants: GrantDraft[]): AppGroup[] {
  const grantByName = new Map(grants.map(g => [g.tool_name, g]))
  const buckets = new Map<string, ToolDefinition[]>()
  for (const t of catalog) {
    const p = appPrefix(t.name)
    const arr = buckets.get(p) ?? []
    arr.push(t)
    buckets.set(p, arr)
  }
  const groups: AppGroup[] = []
  for (const [prefix, tools] of buckets) {
    tools.sort((a, b) => a.name.localeCompare(b.name))
    const rows = tools.map(tool => ({
      tool,
      granted: grantByName.get(tool.name) ?? null,
      isDenied: tool.default_mode === 'denied',
    }))
    // Allowed first, then not allowed, then denied at the bottom — eye lands
    // on what's already permitted without scanning.
    rows.sort((a, b) => {
      const score = (r: typeof a) => r.isDenied ? 2 : r.granted ? 0 : 1
      return score(a) - score(b)
    })
    groups.push({ prefix, label: appLabel(prefix), rows })
  }
  groups.sort((a, b) => a.label.localeCompare(b.label))
  return groups
}

function LevelToggle({
  value, onChange,
}: {
  value: PermissionLevel
  onChange: (v: PermissionLevel) => void
}) {
  return (
    <Flex
      gap="0"
      data-tour="grants-mode"
      style={{
        border: '1px solid var(--gray-a5)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {LEVEL_OPTIONS.map((opt, i) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: 0,
              borderLeft: i === 0 ? 0 : '1px solid var(--gray-a5)',
              background: active ? 'var(--accent-a3)' : 'transparent',
              color: active ? 'var(--accent-11)' : 'var(--gray-11)',
              fontWeight: active ? 500 : 400,
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </Flex>
  )
}

// Pure controlled grants editor. Knows nothing about save / agent.id /
// dirty tracking — caller owns all of that. Used both inside `GrantsEditor`
// (the /agents/:id/grants wrapper that saves on demand) and standalone in
// the hire wizard's "Allow access" step (where there's no agent yet and
// the picked grants flush via `api.setGrants` only on Hire).
//
// Layout: full-catalog grouped-by-app cards in a responsive grid. Each card
// auto-expands when at least one of its tools is granted; otherwise it
// renders as a collapsed header with bulk «Allow all». Per-tool: «Allow»
// button if not granted; LevelToggle + remove button if granted; muted
// «Restricted» chip if catalog marks it `denied`.
export function GrantsForm({
  grants, onChange, catalog: catalogProp,
}: {
  grants: GrantDraft[]
  onChange: (next: GrantDraft[]) => void
  catalog?: ToolDefinition[]
}) {
  const [fetchedCatalog, setFetchedCatalog] = useState<ToolDefinition[]>([])

  useEffect(() => {
    if (catalogProp) return
    let cancelled = false
    api.listTools().then(list => { if (!cancelled) setFetchedCatalog(list) }).catch(() => {})
    return () => { cancelled = true }
  }, [catalogProp])

  const catalog = catalogProp ?? fetchedCatalog
  const groups = useMemo(() => groupCatalog(catalog, grants), [catalog, grants])

  // Manually-toggled expand state. Default rule: an app is open if it has
  // any allowed tool. Once the user clicks the chevron, the manual choice
  // wins (so toggling a fully-empty card and adding nothing keeps it open).
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({})
  const isOpen = (group: AppGroup) => {
    if (group.prefix in manualOpen) return manualOpen[group.prefix]
    return group.rows.some(r => r.granted)
  }
  const toggleOpen = (prefix: string, current: boolean) => {
    setManualOpen(prev => ({ ...prev, [prefix]: !current }))
  }

  const updateLevel = (tool_name: string, level: PermissionLevel) => {
    const patch = applyLevel(level)
    onChange(grants.map(g => g.tool_name === tool_name ? { ...g, ...patch } : g))
  }

  const removeOne = (tool_name: string) => {
    onChange(grants.filter(g => g.tool_name !== tool_name))
  }

  const allowOne = (tool: ToolDefinition) => {
    if (tool.default_mode === 'denied') return
    if (grants.some(g => g.tool_name === tool.name)) return
    onChange([...grants, policyModeToDraft(tool.default_mode, tool.name)])
  }

  const allowAllInApp = (group: AppGroup) => {
    const toAdd: GrantDraft[] = []
    for (const row of group.rows) {
      if (row.isDenied) continue
      if (row.granted) continue
      toAdd.push(policyModeToDraft(row.tool.default_mode, row.tool.name))
    }
    if (toAdd.length === 0) return
    onChange([...grants, ...toAdd])
  }

  const removeAllInApp = (group: AppGroup) => {
    const remove = new Set(group.rows.map(r => r.tool.name))
    onChange(grants.filter(g => !remove.has(g.tool_name)))
  }

  const writeAutoCount = grants.filter(g => g.mode === 'read_write' && !g.approval_required).length

  return (
    <>
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 12,
          alignItems: 'start',
        }}
      >
        {groups.map(group => {
          const allowable = group.rows.filter(r => !r.isDenied)
          const allowedCount = allowable.filter(r => r.granted).length
          const allAllowed = allowedCount === allowable.length && allowable.length > 0
          const open = isOpen(group)

          return (
            <div
              key={group.prefix}
              className="card"
              style={{
                borderColor: allowedCount > 0 ? 'var(--jade-a6)' : undefined,
                overflow: 'hidden',
                background: allowedCount > 0 ? 'var(--jade-a2)' : 'var(--gray-2)',
              }}
            >
              <button
                type="button"
                onClick={() => toggleOpen(group.prefix, open)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 0,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Flex align="center" gap="3" justify="between">
                  <Flex align="center" gap="3" minWidth="0" flexGrow="1">
                    <Box style={{
                      color: 'var(--gray-10)',
                      display: 'flex',
                      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 120ms ease',
                    }}>
                      <IconArrowRight className="ic ic--sm" />
                    </Box>
                    <Box minWidth="0" flexGrow="1">
                      <Text as="div" size="3" weight="medium" className="truncate">{group.label}</Text>
                      <Text as="div" size="1" color="gray" mt="1">
                        {allowedCount} of {allowable.length} allowed
                        {group.rows.length > allowable.length && (
                          <span> · {group.rows.length - allowable.length} restricted</span>
                        )}
                      </Text>
                    </Box>
                  </Flex>
                  <Flex gap="1" align="center" onClick={e => e.stopPropagation()}>
                    {!allAllowed && allowable.length > 0 && (
                      <Button size="1" variant="soft" color="jade" onClick={() => allowAllInApp(group)}>
                        <IconPlus className="ic ic--sm" />
                        Allow all
                      </Button>
                    )}
                    {allowedCount > 0 && (
                      <Button size="1" variant="ghost" color="gray" onClick={() => removeAllInApp(group)}>
                        Remove all
                      </Button>
                    )}
                  </Flex>
                </Flex>
              </button>

              {open && (
                <Box style={{ borderTop: '1px solid var(--gray-a3)', background: 'var(--gray-2)' }}>
                  {group.rows.map((row, i) => {
                    const subname = toolLabel(row.tool.name).replace(`${group.label} · `, '')
                    const isLast = i === group.rows.length - 1
                    return (
                      <Flex
                        key={row.tool.name}
                        align="center"
                        justify="between"
                        gap="3"
                        style={{
                          padding: '10px 16px',
                          borderBottom: isLast ? undefined : '1px dashed var(--gray-a3)',
                          opacity: row.isDenied ? 0.55 : 1,
                          minHeight: 44,
                        }}
                      >
                        <Flex align="center" gap="2" minWidth="0" flexGrow="1">
                          <Text as="span" size="2" className="truncate">{subname}</Text>
                          {row.isDenied && (
                            <Badge color="gray" variant="soft" radius="full" size="1">
                              <IconLock className="ic ic--sm" />
                              Restricted
                            </Badge>
                          )}
                        </Flex>
                        <Box style={{ flex: '0 0 auto' }}>
                          {row.isDenied ? (
                            <Text as="span" size="1" color="gray">Not available</Text>
                          ) : row.granted ? (
                            <Flex gap="1" align="center">
                              <LevelToggle
                                value={levelFromGrant(row.granted)}
                                onChange={(level) => updateLevel(row.tool.name, level)}
                              />
                              <IconButton
                                size="1"
                                variant="ghost"
                                color="gray"
                                onClick={() => removeOne(row.tool.name)}
                                title="Remove"
                                aria-label="Remove permission"
                              >
                                <IconX />
                              </IconButton>
                            </Flex>
                          ) : (
                            <Button size="1" variant="soft" color="jade" onClick={() => allowOne(row.tool)}>
                              <IconPlus className="ic ic--sm" />
                              Allow
                            </Button>
                          )}
                        </Box>
                      </Flex>
                    )
                  })}
                </Box>
              )}
            </div>
          )
        })}
      </Box>

      {writeAutoCount > 0 && (
        <Box mt="3">
          <div data-tour="grants-write-warning">
            <Banner tone="warn" title={`${writeAutoCount} ${writeAutoCount === 1 ? 'permission writes' : 'permissions write'} without asking`}>
              <Flex align="center" gap="2">
                <IconAlert className="ic ic--sm" />
                <Text as="span" size="2">
                  Switch to <strong>Ask</strong> if you want a human to confirm every write.
                </Text>
              </Flex>
            </Banner>
          </div>
        </Box>
      )}
    </>
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

  // Bridge between this wrapper (ToolGrant[] with server-assigned ids) and
  // the controlled `<GrantsForm>` (GrantDraft[] without ids). Existing rows
  // keep their id; rows added via the form get a synthetic local id so we
  // can still key them in React. Save flushes the whole array as a draft;
  // the gateway response replaces local with freshly-assigned ids.
  const drafts: GrantDraft[] = local.map(g => ({
    tool_name: g.tool_name,
    mode: g.mode,
    approval_required: g.approval_required,
    config: g.config,
  }))

  const handleFormChange = (next: GrantDraft[]) => {
    const byName = new Map(local.map(g => [g.tool_name, g]))
    const merged: ToolGrant[] = next.map(d => {
      const existing = byName.get(d.tool_name)
      if (existing) {
        return { ...existing, mode: d.mode, approval_required: d.approval_required, config: d.config ?? existing.config }
      }
      return {
        id: `grt_new_${Date.now()}_${d.tool_name}`,
        scope_type: 'agent',
        scope_id: agent.id,
        tool_name: d.tool_name,
        mode: d.mode,
        approval_required: d.approval_required,
        config: d.config ?? {},
      }
    })
    setLocal(merged)
  }

  return (
    <div>
      <Flex align="center" justify="between" gap="3" mb="3" data-tour="grants-summary">
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

      <GrantsForm grants={drafts} onChange={handleFormChange} />
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
              color={level === 'read' ? 'cyan' : level === 'write_approval' ? 'orange' : 'red'}
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
