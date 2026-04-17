import { useMemo, useState } from 'react'
import { api } from '../lib/api'
import { toolCatalog } from '../lib/fixtures'
import type {
  Agent,
  ToolGrant,
  ToolGrantMode,
  ToolGrantScopeType,
} from '../lib/types'
import { ago, money, modeLabel, num, toolDisplay } from '../lib/format'
import { Banner, LoadingList, NoAccessState } from './states'
import { Btn, Chip, Toggle } from './common'
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconLock,
  IconPlus,
  IconTool,
  IconX,
} from './icons'

interface Diff {
  added: ToolGrant[]
  removed: ToolGrant[]
  changed: { before: ToolGrant; after: ToolGrant; fields: string[] }[]
}

function computeDiff(baseline: ToolGrant[], current: ToolGrant[]): Diff {
  const byId = (list: ToolGrant[]) => new Map(list.map(g => [g.id, g]))
  const b = byId(baseline)
  const c = byId(current)
  const added: ToolGrant[] = []
  const removed: ToolGrant[] = []
  const changed: Diff['changed'] = []
  current.forEach(g => { if (!b.has(g.id)) added.push(g) })
  baseline.forEach(g => { if (!c.has(g.id)) removed.push(g) })
  current.forEach(g => {
    const prev = b.get(g.id)
    if (!prev) return
    const fields: string[] = []
    if (prev.mode !== g.mode) fields.push('mode')
    if (prev.approval_required !== g.approval_required) fields.push('approval_required')
    if (prev.scope_type !== g.scope_type) fields.push('scope_type')
    if (prev.scope_id !== g.scope_id) fields.push('scope_id')
    if (JSON.stringify(prev.config) !== JSON.stringify(g.config)) fields.push('config')
    if (fields.length) changed.push({ before: prev, after: g, fields })
  })
  return { added, removed, changed }
}

function riskTone(g: ToolGrant): 'read' | 'write-gated' | 'write-open' {
  if (g.mode === 'read') return 'read'
  if (g.approval_required) return 'write-gated'
  return 'write-open'
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
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Sync when parent refetches
  if (grants !== baseline) {
    setBaseline(grants)
    setLocal(grants)
    setExpanded(null)
    setSaveError(null)
    setValidationError(null)
  }

  const diff = useMemo<Diff>(
    () => computeDiff(baseline ?? [], local ?? []),
    [baseline, local]
  )
  const groupedByCategory = useMemo(() => {
    if (!local) return [] as Array<[string, ToolGrant[]]>
    const by: Record<string, ToolGrant[]> = {}
    local.forEach(g => {
      const cat = String(g.config.category ?? 'other')
      by[cat] ??= []
      by[cat].push(g)
    })
    Object.values(by).forEach(list => list.sort((a, b) => riskOrder(a) - riskOrder(b)))
    return Object.entries(by).sort(([a], [b]) => catOrder(a) - catOrder(b))
  }, [local])
  const dirty = diff.added.length + diff.removed.length + diff.changed.length > 0
  const writesWithoutApproval = (local ?? []).filter(g => (g.mode === 'write' || g.mode === 'read_write') && !g.approval_required)

  if (!canEdit && grants && grants.length > 0) {
    return <ViewOnlyGrants agent={agent} grants={grants} />
  }
  if (!canEdit) {
    return <NoAccessState requiredRole="domain_admin or admin" body="Tool grants are editable by admins only. Members can view an agent's grants on the agent detail page." />
  }

  const update = (id: string, patch: Partial<ToolGrant>) => {
    if (!local) return
    setLocal(local.map(g => g.id === id ? { ...g, ...patch } : g))
  }
  const updateConfig = (id: string, patch: Partial<ToolGrant['config']>) => {
    if (!local) return
    setLocal(local.map(g => g.id === id ? { ...g, config: { ...g.config, ...patch } } : g))
  }
  const remove = (id: string) => {
    if (!local) return
    setLocal(local.filter(g => g.id !== id))
  }
  const addFromCatalog = (key: string) => {
    const tpl = toolCatalog.find(t => t.key === key)
    if (!tpl || !local) return
    if (local.some(g => g.tool_name === tpl.tool_name)) {
      setValidationError(`${tpl.tool_name} is already granted.`)
      return
    }
    const grant: ToolGrant = {
      id: `grt_${agent.id}_new_${Date.now()}`,
      agent_id: agent.id,
      tool_name: tpl.tool_name,
      scope_type: tpl.default_scope_type,
      scope_id: tpl.default_scope_id,
      mode: tpl.default_mode,
      approval_required: tpl.default_approval_required,
      config: {
        provider: tpl.provider,
        category: tpl.category as ToolGrant['config']['category'],
        notes: tpl.description,
      },
      granted: true,
      last_invoked_at: null,
    }
    setLocal([...local, grant])
    setValidationError(null)
    setShowAdd(false)
    setExpanded(grant.id)
  }

  const cancelChanges = () => {
    setLocal(baseline)
    setExpanded(null)
    setSaveError(null)
    setValidationError(null)
  }

  const validate = (): string | null => {
    if (!local) return null
    for (const g of local) {
      if (!g.tool_name.trim()) return `Grant ${g.id} has no tool name.`
      if (!g.scope_id.trim()) return `Grant ${g.tool_name} needs a scope_id.`
      const cfg = g.config
      if (cfg.rate_limit_per_day != null && Number(cfg.rate_limit_per_day) < 0)
        return `${g.tool_name}: rate_limit_per_day must be ≥ 0.`
      if (cfg.max_spend_per_call_usd != null && Number(cfg.max_spend_per_call_usd) < 0)
        return `${g.tool_name}: max_spend_per_call_usd must be ≥ 0.`
    }
    return null
  }

  const openSave = () => {
    const err = validate()
    if (err) { setValidationError(err); return }
    setValidationError(null)
    setShowConfirm(true)
  }

  const doSave = async () => {
    if (!local) return
    setSaving(true)
    setSaveError(null)
    try {
      const next = await api.setGrants(agent.id, local)
      setBaseline(next)
      setLocal(next)
      onChange(next)
      setShowConfirm(false)
    } catch (e) {
      setSaveError((e as Error).message ?? 'Failed to save grants.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Banner tone="info" title="Approval is a human policy, not an AI decision">
        Toggling <strong>Approval required</strong> on any grant means the orchestrator suspends the run whenever the agent attempts that tool. An <span className="mono">ApprovalRequest</span> is created and a designated human has to decide. Agents never choose whether to ask.
      </Banner>

      {writesWithoutApproval.length > 0 && (
        <>
          <div style={{ height: 10 }} />
          <Banner tone="warn" title={`${writesWithoutApproval.length} write tool${writesWithoutApproval.length === 1 ? '' : 's'} without approval`}>
            These grants allow the agent to take real-world actions with no human in the loop. Make sure that's intentional.
          </Banner>
        </>
      )}

      {dirty && (
        <>
          <div style={{ height: 12 }} />
          <div
            className="banner"
            style={{
              borderColor: 'var(--accent-border)',
              background: 'var(--accent-soft)',
              position: 'sticky',
              top: 56,
              zIndex: 5,
            }}
          >
            <span className="banner__icon"><IconAlert className="ic" style={{ color: 'var(--accent)' }} /></span>
            <div style={{ flex: 1 }}>
              <div className="banner__title" style={{ color: 'var(--accent)' }}>
                Unsaved changes · {diff.added.length} added · {diff.removed.length} removed · {diff.changed.length} changed
              </div>
              <div className="banner__body">
                Grants aren't persisted until you save. <span className="mono">PUT /agents/{agent.id}/grants</span> will replace the full set.
              </div>
            </div>
            <div className="row">
              <Btn variant="ghost" onClick={cancelChanges} disabled={saving}>Cancel changes</Btn>
              <Btn variant="primary" onClick={openSave} disabled={saving} icon={<IconCheck />}>
                Review & save
              </Btn>
            </div>
          </div>
        </>
      )}

      {validationError && (
        <>
          <div style={{ height: 12 }} />
          <div className="banner banner--warn" role="alert">
            <span className="banner__icon"><IconAlert className="ic" /></span>
            <div style={{ flex: 1 }}>
              <div className="banner__title">Validation error</div>
              <div className="banner__body">{validationError}</div>
            </div>
          </div>
        </>
      )}

      {saveError && (
        <>
          <div style={{ height: 12 }} />
          <div className="banner banner--warn" role="alert">
            <span className="banner__icon"><IconAlert className="ic" style={{ color: 'var(--danger)' }} /></span>
            <div style={{ flex: 1 }}>
              <div className="banner__title" style={{ color: 'var(--danger)' }}>Save failed</div>
              <div className="banner__body">{saveError}</div>
            </div>
            <Btn variant="ghost" onClick={() => setSaveError(null)}>Dismiss</Btn>
          </div>
        </>
      )}

      <div style={{ height: 16 }} />
      <div className="row row--between" style={{ marginBottom: 14 }}>
        <div className="mono uppercase muted">
          {local?.length ?? 0} tools · {local?.filter(g => g.mode === 'read').length ?? 0} read · {local?.filter(g => g.mode !== 'read').length ?? 0} write · {local?.filter(g => g.approval_required).length ?? 0} gated
        </div>
        <Btn variant="ghost" icon={<IconPlus />} onClick={() => setShowAdd(true)}>
          Add grant
        </Btn>
      </div>

      {local === null ? (
        <LoadingList rows={6} />
      ) : local.length === 0 ? (
        <div className="state">
          <div className="state__icon"><IconTool /></div>
          <div className="state__title">No tool grants yet</div>
          <p className="state__body">This agent can't call any tools. Add at least one grant to let it do work — even reading CRM contacts requires an explicit grant.</p>
          <div className="state__actions">
            <Btn variant="primary" onClick={() => setShowAdd(true)} icon={<IconPlus />}>Add first grant</Btn>
          </div>
        </div>
      ) : (
        groupedByCategory.map(([cat, list]) => (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div className="mono uppercase muted" style={{ padding: '6px 2px' }}>{CAT_LABEL[cat] ?? cat}</div>
            <div className="card" style={{ padding: 0 }}>
              {list.map(g => (
                <GrantRow
                  key={g.id}
                  grant={g}
                  isExpanded={expanded === g.id}
                  onToggleExpanded={() => setExpanded(expanded === g.id ? null : g.id)}
                  onUpdate={patch => update(g.id, patch)}
                  onUpdateConfig={patch => updateConfig(g.id, patch)}
                  onRemove={() => remove(g.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <div className="mono" style={{ marginTop: 20, fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'right' }}>
        endpoint · <span className="accent">GET /agents/{'{agentId}'}/grants</span> · write via <span className="accent">PUT</span> (full replace — not merge)
      </div>

      {showAdd && (
        <AddGrantModal
          existing={local ?? []}
          onClose={() => setShowAdd(false)}
          onPick={addFromCatalog}
        />
      )}

      {showConfirm && local && baseline && (
        <ConfirmSaveModal
          agent={agent}
          diff={diff}
          saving={saving}
          error={saveError}
          onCancel={() => { setShowConfirm(false); setSaveError(null) }}
          onConfirm={doSave}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────── Grant row

function GrantRow({
  grant, isExpanded, onToggleExpanded, onUpdate, onUpdateConfig, onRemove,
}: {
  grant: ToolGrant
  isExpanded: boolean
  onToggleExpanded: () => void
  onUpdate: (patch: Partial<ToolGrant>) => void
  onUpdateConfig: (patch: Partial<ToolGrant['config']>) => void
  onRemove: () => void
}) {
  const d = toolDisplay(grant.tool_name)
  const tone = riskTone(grant)
  const toneStyle: React.CSSProperties =
    tone === 'read'
      ? { borderLeft: '3px solid var(--border-2)' }
      : tone === 'write-gated'
        ? { borderLeft: '3px solid var(--accent)' }
        : { borderLeft: '3px solid var(--warn)' }

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        background: tone === 'write-open' ? 'rgba(255,179,71,0.03)' : 'transparent',
        ...toneStyle,
      }}
    >
      <div
        className="grant"
        style={{ gridTemplateColumns: '40px minmax(0, 1fr) 120px 110px 150px 120px 32px' }}
      >
        <div className="grant__icon">
          {tone === 'read'
            ? <IconTool className="ic" style={{ color: 'var(--text-muted)' }} />
            : grant.approval_required
              ? <IconLock className="ic" style={{ color: 'var(--accent)' }} />
              : <IconAlert className="ic" style={{ color: 'var(--warn)' }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="row row--sm" style={{ marginBottom: 2 }}>
            <span className="grant__name">{d.provider} <span className="muted">· {d.action}</span></span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>{grant.tool_name}</span>
          </div>
          <div className="row row--sm" style={{ marginTop: 4 }}>
            <RiskChip tone={tone} />
            {tone === 'write-open' && (
              <Chip tone="warn">
                <IconAlert className="ic ic--sm" /> write without approval
              </Chip>
            )}
            {grant.last_invoked_at && (
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                used {ago(grant.last_invoked_at)}
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="mono uppercase muted" style={{ marginBottom: 4, fontSize: 9.5 }}>Mode</div>
          <select
            className="select"
            style={{ fontSize: 11, padding: '4px 22px 4px 8px' }}
            value={grant.mode}
            onChange={e => onUpdate({ mode: e.target.value as ToolGrantMode })}
          >
            <option value="read">read</option>
            <option value="write">write</option>
            <option value="read_write">read + write</option>
          </select>
        </div>
        <div>
          <div className="mono uppercase muted" style={{ marginBottom: 4, fontSize: 9.5 }}>Scope</div>
          <select
            className="select"
            style={{ fontSize: 11, padding: '4px 22px 4px 8px' }}
            value={grant.scope_type}
            onChange={e => onUpdate({ scope_type: e.target.value as ToolGrantScopeType })}
          >
            <option value="tenant">tenant</option>
            <option value="domain">domain</option>
            <option value="agent">agent</option>
          </select>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{grant.scope_id}</div>
        </div>
        <div>
          <div className="mono uppercase" style={{ marginBottom: 4, fontSize: 9.5, color: grant.approval_required ? 'var(--accent)' : 'var(--text-dim)', letterSpacing: '0.14em' }}>
            Approval required
          </div>
          <Toggle
            on={grant.approval_required}
            onChange={v => onUpdate({ approval_required: v })}
            label={grant.approval_required ? 'gated' : 'auto'}
          />
        </div>
        <div>
          <div className="mono uppercase muted" style={{ marginBottom: 4, fontSize: 9.5 }}>Config</div>
          <div className="mono" style={{ fontSize: 10.5 }}>
            {grant.config.max_spend_per_call_usd != null ? `${money(Number(grant.config.max_spend_per_call_usd), { cents: true })} / call` : '—'}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
            {grant.config.rate_limit_per_day != null ? `${num(Number(grant.config.rate_limit_per_day))} / day` : 'no rate cap'}
          </div>
          <button
            onClick={onToggleExpanded}
            className="mono"
            style={{ color: 'var(--text-dim)', fontSize: 10.5, marginTop: 4 }}
          >
            {isExpanded ? '▲ hide' : '▼ edit'}
          </button>
        </div>
        <button
          title="Remove grant"
          onClick={onRemove}
          style={{
            color: 'var(--text-dim)',
            border: '1px solid transparent',
            width: 28,
            height: 28,
            borderRadius: 4,
            display: 'grid',
            placeItems: 'center',
            transition: 'border-color 120ms, color 120ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger-border)'; e.currentTarget.style.color = 'var(--danger)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >
          <IconX className="ic ic--sm" />
        </button>
      </div>

      {isExpanded && (
        <div style={{ padding: '10px 16px 14px', background: 'var(--surface-2)' }}>
          <div className="grid grid--3" style={{ gap: 12 }}>
            <div>
              <div className="mono uppercase muted" style={{ marginBottom: 4, fontSize: 9.5 }}>Rate limit / day</div>
              <input
                className="input input--mono"
                type="number"
                min={0}
                value={grant.config.rate_limit_per_day ?? ''}
                onChange={e => onUpdateConfig({ rate_limit_per_day: e.target.value === '' ? undefined : Number(e.target.value) })}
                placeholder="no cap"
              />
            </div>
            <div>
              <div className="mono uppercase muted" style={{ marginBottom: 4, fontSize: 9.5 }}>Max spend / call (USD)</div>
              <input
                className="input input--mono"
                type="number"
                min={0}
                step={0.01}
                value={grant.config.max_spend_per_call_usd ?? ''}
                onChange={e => onUpdateConfig({ max_spend_per_call_usd: e.target.value === '' ? undefined : Number(e.target.value) })}
                placeholder="no cap"
              />
            </div>
            <div>
              <div className="mono uppercase muted" style={{ marginBottom: 4, fontSize: 9.5 }}>Scope ID</div>
              <input
                className="input input--mono"
                value={grant.scope_id}
                onChange={e => onUpdate({ scope_id: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="mono uppercase muted" style={{ marginBottom: 4, fontSize: 9.5 }}>Notes</div>
              <textarea
                className="input textarea"
                style={{ minHeight: 60 }}
                value={(grant.config.notes as string) ?? ''}
                onChange={e => onUpdateConfig({ notes: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RiskChip({ tone }: { tone: 'read' | 'write-gated' | 'write-open' }) {
  if (tone === 'read') return <Chip tone="ghost">low risk · read-only</Chip>
  if (tone === 'write-gated') return <Chip tone="accent"><IconLock className="ic ic--sm" /> gated write</Chip>
  return <Chip tone="warn">unchecked write</Chip>
}

// ─────────────────────────────────────────────── View-only variant (for members)

function ViewOnlyGrants({ agent, grants }: { agent: Agent; grants: ToolGrant[] }) {
  const grouped = useMemo(() => {
    const by: Record<string, ToolGrant[]> = {}
    grants.forEach(g => {
      const cat = String(g.config.category ?? 'other')
      by[cat] ??= []
      by[cat].push(g)
    })
    return Object.entries(by).sort(([a], [b]) => catOrder(a) - catOrder(b))
  }, [grants])

  return (
    <div>
      <Banner tone="info" title="Read-only view">
        You can see this agent's grants, but editing is restricted to <Chip tone="accent">domain_admin</Chip> or <Chip tone="accent">admin</Chip>. Ask a workspace admin if you need a change.
      </Banner>
      <div style={{ height: 12 }} />
      <div className="mono uppercase muted" style={{ marginBottom: 10 }}>
        {grants.length} tools · {grants.filter(g => g.approval_required).length} gated
      </div>
      {grouped.map(([cat, list]) => (
        <div key={cat} style={{ marginBottom: 18 }}>
          <div className="mono uppercase muted" style={{ padding: '6px 2px' }}>{CAT_LABEL[cat] ?? cat}</div>
          <div className="card" style={{ padding: 0 }}>
            {list.map(g => {
              const d = toolDisplay(g.tool_name)
              const tone = riskTone(g)
              return (
                <div
                  key={g.id}
                  className="grant"
                  style={{
                    gridTemplateColumns: '40px minmax(0, 1fr) 120px 150px 140px',
                    borderLeft: `3px solid ${tone === 'read' ? 'var(--border-2)' : tone === 'write-gated' ? 'var(--accent)' : 'var(--warn)'}`,
                  }}
                >
                  <div className="grant__icon">
                    {tone === 'read' ? <IconTool className="ic" />
                      : g.approval_required ? <IconLock className="ic" style={{ color: 'var(--accent)' }} />
                        : <IconAlert className="ic" style={{ color: 'var(--warn)' }} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="grant__name">{d.provider} <span className="muted">· {d.action}</span></div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>{g.tool_name}</div>
                  </div>
                  <Chip>{modeLabel(g.mode)}</Chip>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {g.scope_type} · {g.scope_id}
                  </div>
                  {g.approval_required
                    ? <Chip tone="accent"><IconLock className="ic ic--sm" /> approval</Chip>
                    : tone === 'write-open'
                      ? <Chip tone="warn"><IconAlert className="ic ic--sm" /> unchecked write</Chip>
                      : <Chip>auto</Chip>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div className="mono" style={{ marginTop: 20, fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'right' }}>
        agent · <span className="mono">{agent.id}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────── Add Grant modal

function AddGrantModal({
  existing, onClose, onPick,
}: {
  existing: ToolGrant[]
  onClose: () => void
  onPick: (key: string) => void
}) {
  const [query, setQuery] = useState('')
  const existingSet = new Set(existing.map(g => g.tool_name))

  const filtered = toolCatalog.filter(t => {
    if (existingSet.has(t.tool_name)) return false
    if (!query) return true
    const q = query.toLowerCase()
    return (
      t.tool_name.toLowerCase().includes(q) ||
      t.provider.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    )
  })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Add a tool grant</div>
          <div style={{ marginTop: 8 }}>
            <input
              className="input"
              placeholder="Search by name, provider, category…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="modal__body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {existing.length > 0 ? 'No matching tools. All tools matching your query are already granted.' : 'No matching tools.'}
            </div>
          ) : filtered.map(t => {
            const risk = t.risk_hint
            const d = toolDisplay(t.tool_name)
            return (
              <button
                key={t.key}
                onClick={() => onPick(t.key)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px minmax(0, 1fr) 100px 80px',
                  gap: 12,
                  padding: '12px 20px',
                  textAlign: 'left',
                  width: '100%',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  transition: 'background 120ms',
                  borderLeft: `3px solid ${risk === 'high' ? 'var(--warn)' : risk === 'medium' ? 'var(--accent-border)' : 'var(--border-2)'}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div className="grant__icon" style={{ width: 28, height: 28 }}><IconTool className="ic ic--sm" /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>{d.provider} <span className="muted">· {d.action}</span></div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>{t.tool_name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{t.description}</div>
                </div>
                <Chip tone={risk === 'high' ? 'warn' : risk === 'medium' ? 'accent' : 'ghost'}>{risk} risk</Chip>
                <div className="row row--sm" style={{ justifyContent: 'flex-end', color: 'var(--accent)', fontSize: 12 }}>
                  add <IconArrowRight className="ic ic--sm" />
                </div>
              </button>
            )
          })}
        </div>
        <div className="modal__foot">
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────── Confirm + diff modal

function ConfirmSaveModal({
  agent, diff, saving, error, onCancel, onConfirm,
}: {
  agent: Agent
  diff: Diff
  saving: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={saving ? undefined : onCancel}>
      <div
        className="modal"
        style={{ maxWidth: 700 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="modal__title">Confirm policy changes</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.55 }}>
            <span className="mono">PUT /agents/{agent.id}/grants</span> replaces the full grant set. What you see below is exactly what will be sent.
          </div>
        </div>
        <div className="modal__body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {error && (
            <div className="banner banner--warn" role="alert" style={{ marginBottom: 16 }}>
              <span className="banner__icon"><IconAlert className="ic" style={{ color: 'var(--danger)' }} /></span>
              <div style={{ flex: 1 }}>
                <div className="banner__title" style={{ color: 'var(--danger)' }}>Save failed</div>
                <div className="banner__body">{error}</div>
              </div>
            </div>
          )}

          <DiffSection
            title="Added grants"
            items={diff.added}
            tone="success"
            render={g => <GrantDiffRow grant={g} kind="added" />}
          />
          <DiffSection
            title="Removed grants"
            items={diff.removed}
            tone="danger"
            render={g => <GrantDiffRow grant={g} kind="removed" />}
          />
          <DiffSection
            title="Changed grants"
            items={diff.changed}
            tone="warn"
            render={c => <ChangedRow before={c.before} after={c.after} fields={c.fields} />}
          />
          {diff.added.length + diff.removed.length + diff.changed.length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              No changes to save.
            </div>
          )}
        </div>
        <div className="modal__foot">
          <Btn variant="ghost" onClick={onCancel} disabled={saving}>Back to editor</Btn>
          <Btn
            variant="primary"
            onClick={onConfirm}
            disabled={saving || (diff.added.length + diff.removed.length + diff.changed.length === 0)}
            icon={saving ? undefined : <IconCheck />}
          >
            {saving ? 'saving…' : 'Save policy'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

function DiffSection<T>({
  title, items, tone, render,
}: {
  title: string
  items: T[]
  tone: 'success' | 'danger' | 'warn'
  render: (item: T) => React.ReactNode
}) {
  if (items.length === 0) return null
  const color = tone === 'success' ? 'var(--success)' : tone === 'danger' ? 'var(--danger)' : 'var(--warn)'
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="mono uppercase" style={{ fontSize: 10.5, color, letterSpacing: '0.14em', marginBottom: 6 }}>
        {title} · {items.length}
      </div>
      <div className="stack stack--sm">
        {items.map((item, i) => (
          <div key={i}>{render(item)}</div>
        ))}
      </div>
    </div>
  )
}

function GrantDiffRow({ grant, kind }: { grant: ToolGrant; kind: 'added' | 'removed' }) {
  const d = toolDisplay(grant.tool_name)
  const color = kind === 'added' ? 'var(--success)' : 'var(--danger)'
  const bg = kind === 'added' ? 'var(--success-soft)' : 'var(--danger-soft)'
  return (
    <div style={{
      padding: 10,
      background: bg,
      border: `1px solid ${color}`,
      borderLeftWidth: 3,
      borderRadius: 4,
      fontSize: 12,
    }}>
      <div className="row" style={{ gap: 8 }}>
        <span className="mono" style={{ color, fontWeight: 600 }}>
          {kind === 'added' ? '+' : '−'}
        </span>
        <span>{d.provider} <span className="muted">· {d.action}</span></span>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{grant.tool_name}</span>
      </div>
      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
        mode={grant.mode} · scope={grant.scope_type}/{grant.scope_id} · approval_required={String(grant.approval_required)}
      </div>
    </div>
  )
}

function ChangedRow({
  before, after, fields,
}: {
  before: ToolGrant
  after: ToolGrant
  fields: string[]
}) {
  const d = toolDisplay(after.tool_name)
  return (
    <div style={{
      padding: 10,
      background: 'var(--warn-soft)',
      border: '1px solid var(--warn-border)',
      borderLeftWidth: 3,
      borderRadius: 4,
      fontSize: 12,
    }}>
      <div className="row" style={{ gap: 8 }}>
        <span className="mono" style={{ color: 'var(--warn)', fontWeight: 600 }}>Δ</span>
        <span>{d.provider} <span className="muted">· {d.action}</span></span>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{after.tool_name}</span>
      </div>
      <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
        {fields.map(f => (
          <div key={f} className="mono" style={{ fontSize: 10.5 }}>
            <span style={{ color: 'var(--text-dim)' }}>{f}:</span>{' '}
            <span style={{ color: 'var(--danger)', textDecoration: 'line-through' }}>{describe(f, before)}</span>
            {' '}<span style={{ color: 'var(--text-dim)' }}>→</span>{' '}
            <span style={{ color: 'var(--success)' }}>{describe(f, after)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function describe(field: string, g: ToolGrant): string {
  if (field === 'mode') return g.mode
  if (field === 'approval_required') return String(g.approval_required)
  if (field === 'scope_type') return g.scope_type
  if (field === 'scope_id') return g.scope_id
  if (field === 'config') return JSON.stringify(g.config)
  return ''
}

// ─────────────────────────────────────────────── Category helpers

const CAT_LABEL: Record<string, string> = {
  llm: 'LLM inference',
  data: 'Data & enrichment',
  crm: 'CRM',
  comms: 'Communication',
  calendar: 'Calendar',
  payments: 'Payments & finance',
  infra: 'Infrastructure',
  docs: 'Docs & knowledge',
  search: 'Search',
  other: 'Other',
}

function catOrder(c: string): number {
  const order: Record<string, number> = {
    llm: 0, data: 1, crm: 2, docs: 3, calendar: 4, comms: 5, search: 6, payments: 7, infra: 8, other: 9,
  }
  return order[c] ?? 10
}

function riskOrder(g: ToolGrant): number {
  if (g.mode === 'read') return 0
  if (g.approval_required) return 1
  return 2
}
