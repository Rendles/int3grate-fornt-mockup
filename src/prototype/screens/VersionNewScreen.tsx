import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Toggle } from '../components/common'
import { Banner, LoadingList, NoAccessState } from '../components/states'
import { IconAlert, IconPlus, IconX } from '../components/icons'
import { useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type {
  Agent,
  ApprovalLevel,
  ApprovalRule,
  AgentVersion,
  MemoryScopeConfig,
  ModelChainConfig,
  ToolScopeConfig,
} from '../lib/types'

const MODELS = [
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'gpt-5-mini',
  'gpt-5',
]

const STARTER_PROMPT = `You are {AGENT_NAME}.

Primary objective:
— (what the agent should accomplish)

Hard rules:
— Never take actions that require approval without an explicit ApprovalRequest being granted.
— When the user's request is ambiguous, ask for clarification before using tools.
— Always cite the source of any factual claim you make.

Tools you may request:
— (surfaced automatically from tool grants)

Tone: direct, operator-friendly, concise.
`

const DEFAULT_MEMORY: MemoryScopeConfig = {
  user_facts: true,
  session_only: false,
  domain_shared: true,
  retention_days: 30,
}
const DEFAULT_TOOL_SCOPE: ToolScopeConfig = {
  inherits_from_agent: true,
  overrides: [],
  denylist: [],
}
const DEFAULT_MODEL: ModelChainConfig = {
  primary: MODELS[0],
  fallbacks: [],
  max_tokens: 4096,
  temperature: 0.4,
}

interface FieldErrors {
  instruction?: string
  primary?: string
  maxTokens?: string
  temperature?: string
}

export default function VersionNewScreen({ agentId }: { agentId: string }) {
  const { navigate } = useRouter()
  const { user } = useAuth()

  const canEdit = !!user && (user.role === 'admin' || user.role === 'domain_admin')

  const [agent, setAgent] = useState<Agent | null>(null)
  const [activeVersion, setActiveVersion] = useState<AgentVersion | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [instruction, setInstruction] = useState('')
  const [notes, setNotes] = useState('')
  const [memory, setMemory] = useState<MemoryScopeConfig>(DEFAULT_MEMORY)
  const [toolScope, setToolScope] = useState<ToolScopeConfig>(DEFAULT_TOOL_SCOPE)
  const [model, setModel] = useState<ModelChainConfig>(DEFAULT_MODEL)
  const [approvalRules, setApprovalRules] = useState<ApprovalRule[]>([])

  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.getAgent(agentId),
      api.listAgentVersions(agentId),
    ]).then(([a, versions]) => {
      if (cancelled) return
      setAgent(a ?? null)
      const active = versions.find(v => v.is_active) ?? null
      setActiveVersion(active)
      // Fork: prefill everything from the active version
      if (active) {
        setInstruction(active.instruction_spec)
        setMemory({ ...active.memory_scope_config })
        setToolScope({
          inherits_from_agent: active.tool_scope_config.inherits_from_agent,
          overrides: [...active.tool_scope_config.overrides],
          denylist: [...active.tool_scope_config.denylist],
        })
        setModel({
          primary: active.model_chain_config.primary,
          fallbacks: [...active.model_chain_config.fallbacks],
          max_tokens: active.model_chain_config.max_tokens,
          temperature: active.model_chain_config.temperature,
        })
        setApprovalRules(active.approval_rules.map(r => ({ ...r })))
      } else if (a) {
        setInstruction(STARTER_PROMPT.replace('{AGENT_NAME}', a.name))
      }
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [agentId])

  const fieldErrors = useMemo<FieldErrors>(() => {
    const e: FieldErrors = {}
    if (!instruction.trim()) e.instruction = 'Required'
    else if (instruction.trim().length < 20) e.instruction = 'Instruction spec should be more than a sentence'
    if (!model.primary) e.primary = 'Pick a primary model'
    if (!Number.isFinite(model.max_tokens) || model.max_tokens < 1) e.maxTokens = 'Must be ≥ 1'
    else if (model.max_tokens > 200000) e.maxTokens = 'Unrealistically large — pick under 200000'
    if (!Number.isFinite(model.temperature) || model.temperature < 0) e.temperature = 'Must be ≥ 0'
    else if (model.temperature > 2) e.temperature = 'Must be ≤ 2'
    return e
  }, [instruction, model])

  const show = (key: keyof FieldErrors) => submitted && fieldErrors[key]
  const valid = Object.keys(fieldErrors).length === 0

  const submit = async (activate: boolean) => {
    setSubmitted(true)
    if (!valid) return
    setBusy(true)
    setSaveError(null)
    try {
      const v = await api.createAgentVersion(agentId, {
        instruction_spec: instruction,
        model_chain_config: model,
        memory_scope_config: memory,
        tool_scope_config: toolScope,
        approval_rules: approvalRules,
        notes,
      })
      if (activate) await api.activateVersion(agentId, v.id)
      navigate(`/agents/${agentId}/versions`)
    } catch (e) {
      setSaveError((e as Error).message ?? 'Could not create version')
    } finally {
      setBusy(false)
    }
  }

  const resetToActive = () => {
    if (!activeVersion) return
    setInstruction(activeVersion.instruction_spec)
    setMemory({ ...activeVersion.memory_scope_config })
    setToolScope({ ...activeVersion.tool_scope_config, overrides: [...activeVersion.tool_scope_config.overrides], denylist: [...activeVersion.tool_scope_config.denylist] })
    setModel({ ...activeVersion.model_chain_config, fallbacks: [...activeVersion.model_chain_config.fallbacks] })
    setApprovalRules(activeVersion.approval_rules.map(r => ({ ...r })))
  }

  const addOverride = () => {
    const name = prompt('Tool name to allow (e.g. apollo.enrich_contact)')
    if (name) setToolScope(s => ({ ...s, overrides: [...s.overrides, name] }))
  }
  const addDenied = () => {
    const name = prompt('Tool name to deny (e.g. email.send_without_draft)')
    if (name) setToolScope(s => ({ ...s, denylist: [...s.denylist, name] }))
  }
  const addFallback = () => {
    const m = prompt('Fallback model id (e.g. claude-sonnet-4-6)')
    if (m) setModel(s => ({ ...s, fallbacks: [...s.fallbacks, m] }))
  }
  const addRule = () => {
    const id = `rule_${Math.random().toString(36).slice(2, 8)}`
    setApprovalRules(rs => [...rs, { id, when: 'tool = email.send', required_approver_level: 3, note: '' }])
  }
  const updateRule = (id: string, patch: Partial<ApprovalRule>) => {
    setApprovalRules(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
  }
  const removeRule = (id: string) => {
    setApprovalRules(rs => rs.filter(r => r.id !== id))
  }

  if (!canEdit) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: agent?.name ?? '…', to: `/agents/${agentId}` }, { label: 'new version' }]}>
        <div className="page page--narrow">
          <PageHeader eyebrow="NEW VERSION" title={<>Admins only</>} />
          <NoAccessState
            requiredRole="domain_admin or admin"
            body="Creating versions is restricted to admins on this tenant."
          />
        </div>
      </AppShell>
    )
  }

  if (!loaded || !agent) {
    return <AppShell crumbs={[{ label: '...', to: '/' }]}><div className="page"><LoadingList rows={4} /></div></AppShell>
  }

  const nextVer = (activeVersion?.version_number ?? 0) + 1

  return (
    <AppShell
      crumbs={[
        { label: 'home', to: '/' },
        { label: 'agents', to: '/agents' },
        { label: agent.name, to: `/agents/${agent.id}` },
        { label: 'versions', to: `/agents/${agent.id}/versions` },
        { label: 'new' },
      ]}
    >
      <div className="page page--narrow">
        <PageHeader
          eyebrow={`AGENT · ${agent.name.toUpperCase()}`}
          title={<>New <em>version</em> <span style={{ color: 'var(--text-muted)', fontSize: 26, marginLeft: 6 }}>v{nextVer}</span></>}
          subtitle={activeVersion
            ? `Forking from v${activeVersion.version_number}. Changes below produce a new immutable version — the current active stays exactly as it is.`
            : 'This is the first version for this agent. Define its instruction spec, model chain, memory scope, tool scope, and approval rules.'
          }
          actions={
            <>
              <Btn variant="ghost" href={`/agents/${agent.id}/versions`} disabled={busy}>Cancel</Btn>
              {activeVersion && (
                <Btn variant="ghost" onClick={resetToActive} disabled={busy}>Reset to v{activeVersion.version_number}</Btn>
              )}
              <Btn variant="ghost" onClick={() => submit(false)} disabled={busy}>Save as draft</Btn>
              <Btn variant="primary" onClick={() => submit(true)} disabled={busy}>
                {busy ? 'creating…' : `Save & activate v${nextVer}`}
              </Btn>
            </>
          }
        />

        <Banner tone="warn" title="Versions are immutable once created">
          <>
            After save, this version cannot be edited. To change behaviour you'd fork a new version from it. Only one version is active at a time — activating this one retires{' '}
            {activeVersion ? <Chip tone="ghost">v{activeVersion.version_number}</Chip> : 'any prior active version'}.
          </>
        </Banner>

        {activeVersion && (
          <>
            <div style={{ height: 10 }} />
            <Banner tone="info" title={`Forked from v${activeVersion.version_number}`}>
              <>
                All fields pre-filled from the current active version. Edit anything — when you save, the orchestrator creates <span className="mono">v{nextVer}</span> with your changes and leaves <span className="mono">v{activeVersion.version_number}</span> untouched.
              </>
            </Banner>
          </>
        )}

        {saveError && (
          <>
            <div style={{ height: 10 }} />
            <div className="banner banner--warn" role="alert">
              <span className="banner__icon"><IconAlert className="ic" style={{ color: 'var(--danger)' }} /></span>
              <div style={{ flex: 1 }}>
                <div className="banner__title" style={{ color: 'var(--danger)' }}>Failed to save version</div>
                <div className="banner__body">{saveError}</div>
              </div>
            </div>
          </>
        )}

        {submitted && !valid && (
          <>
            <div style={{ height: 10 }} />
            <div className="banner banner--warn" role="alert">
              <span className="banner__icon"><IconAlert className="ic" /></span>
              <div style={{ flex: 1 }}>
                <div className="banner__title">Fix validation errors</div>
                <div className="banner__body">Some required fields need attention — look for the inline messages below.</div>
              </div>
            </div>
          </>
        )}

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head">
            <div className="card__title">Instruction spec</div>
            <Chip tone="accent">field · instruction_spec</Chip>
          </div>
          <div className="card__body">
            <textarea
              className="input textarea input--mono"
              style={{
                minHeight: 260,
                fontSize: 12,
                lineHeight: 1.65,
                borderColor: show('instruction') ? 'var(--danger-border)' : undefined,
              }}
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              aria-invalid={!!show('instruction')}
            />
            <div className="row row--between" style={{ marginTop: 6 }}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                {instruction.length} chars · ~{Math.ceil(instruction.length / 4)} tokens
              </span>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>markdown supported</span>
            </div>
            {show('instruction') && (
              <div className="row row--sm" style={{ marginTop: 8, color: 'var(--danger)', fontSize: 11.5 }}>
                <IconAlert className="ic ic--sm" /> {fieldErrors.instruction}
              </div>
            )}
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head">
            <div className="card__title">Model chain</div>
            <Chip tone="accent">field · model_chain_config</Chip>
          </div>
          <div className="card__body">
            <div className="form-row">
              <div>
                <div className="form-row__label">Primary <span className="danger">*</span></div>
                <div className="form-row__hint">First model the orchestrator will try.</div>
              </div>
              <div className="form-row__control">
                <select
                  className="select"
                  value={model.primary}
                  onChange={e => setModel(s => ({ ...s, primary: e.target.value }))}
                  style={show('primary') ? { borderColor: 'var(--danger-border)' } : undefined}
                >
                  {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {show('primary') && <ErrHint msg={fieldErrors.primary!} />}
              </div>
            </div>
            <div className="form-row">
              <div>
                <div className="form-row__label">Fallbacks</div>
                <div className="form-row__hint">Used if the primary is rate-limited or returns an error.</div>
              </div>
              <div className="form-row__control">
                <div className="row row--wrap row--sm" style={{ marginBottom: 8 }}>
                  {model.fallbacks.map(f => (
                    <Chip key={f}>
                      {f}
                      <button onClick={() => setModel(s => ({ ...s, fallbacks: s.fallbacks.filter(x => x !== f) }))} style={{ marginLeft: 4, color: 'var(--text-dim)' }}>×</button>
                    </Chip>
                  ))}
                  {model.fallbacks.length === 0 && <span className="mono muted" style={{ fontSize: 11 }}>no fallbacks configured</span>}
                </div>
                <Btn variant="ghost" size="sm" icon={<IconPlus />} onClick={addFallback}>Add fallback</Btn>
              </div>
            </div>
            <div className="form-row">
              <div><div className="form-row__label">Max tokens · temperature</div></div>
              <div className="form-row__control">
                <div className="row">
                  <div>
                    <input
                      className="input input--mono"
                      style={{ width: 140, borderColor: show('maxTokens') ? 'var(--danger-border)' : undefined }}
                      type="number"
                      min={1}
                      value={model.max_tokens}
                      onChange={e => setModel(s => ({ ...s, max_tokens: Number(e.target.value) }))}
                    />
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>max_tokens</div>
                    {show('maxTokens') && <ErrHint msg={fieldErrors.maxTokens!} />}
                  </div>
                  <div>
                    <input
                      className="input input--mono"
                      style={{ width: 100, borderColor: show('temperature') ? 'var(--danger-border)' : undefined }}
                      type="number"
                      step={0.1}
                      min={0}
                      max={2}
                      value={model.temperature}
                      onChange={e => setModel(s => ({ ...s, temperature: Number(e.target.value) }))}
                    />
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>temperature (0–2)</div>
                    {show('temperature') && <ErrHint msg={fieldErrors.temperature!} />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head">
            <div className="card__title">Memory scope</div>
            <Chip tone="accent">field · memory_scope_config</Chip>
          </div>
          <div className="card__body">
            <div className="form-row">
              <div><div className="form-row__label">User facts</div><div className="form-row__hint">Persist facts about the person initiating the task.</div></div>
              <div className="form-row__control"><Toggle on={memory.user_facts} onChange={v => setMemory(s => ({ ...s, user_facts: v }))} label={memory.user_facts ? 'on' : 'off'} /></div>
            </div>
            <div className="form-row">
              <div><div className="form-row__label">Session only</div><div className="form-row__hint">Discard memory when the session ends.</div></div>
              <div className="form-row__control"><Toggle on={memory.session_only} onChange={v => setMemory(s => ({ ...s, session_only: v }))} label={memory.session_only ? 'on' : 'off'} /></div>
            </div>
            <div className="form-row">
              <div><div className="form-row__label">Domain shared</div><div className="form-row__hint">Allow read-access to domain-scoped memory.</div></div>
              <div className="form-row__control"><Toggle on={memory.domain_shared} onChange={v => setMemory(s => ({ ...s, domain_shared: v }))} label={memory.domain_shared ? 'on' : 'off'} /></div>
            </div>
            <div className="form-row">
              <div><div className="form-row__label">Retention (days)</div></div>
              <div className="form-row__control">
                <input className="input input--mono" style={{ width: 140 }} type="number" min={0} value={memory.retention_days} onChange={e => setMemory(s => ({ ...s, retention_days: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head">
            <div className="card__title">Tool scope</div>
            <Chip tone="accent">field · tool_scope_config</Chip>
          </div>
          <div className="card__body">
            <div className="form-row">
              <div><div className="form-row__label">Inherit from agent</div><div className="form-row__hint">Use the tool grants configured on the parent agent.</div></div>
              <div className="form-row__control"><Toggle on={toolScope.inherits_from_agent} onChange={v => setToolScope(s => ({ ...s, inherits_from_agent: v }))} label={toolScope.inherits_from_agent ? 'inherit' : 'custom only'} /></div>
            </div>
            <div className="form-row">
              <div><div className="form-row__label">Allowed overrides</div><div className="form-row__hint">Additional tools this version may invoke beyond agent scope.</div></div>
              <div className="form-row__control">
                <div className="row row--wrap row--sm" style={{ marginBottom: 8 }}>
                  {toolScope.overrides.map(o => (
                    <Chip key={o} tone="accent">
                      + {o}
                      <button onClick={() => setToolScope(s => ({ ...s, overrides: s.overrides.filter(x => x !== o) }))} style={{ marginLeft: 4, color: 'var(--text-dim)' }}>×</button>
                    </Chip>
                  ))}
                  {toolScope.overrides.length === 0 && <span className="mono muted" style={{ fontSize: 11 }}>none</span>}
                </div>
                <Btn variant="ghost" size="sm" icon={<IconPlus />} onClick={addOverride}>Allow tool</Btn>
              </div>
            </div>
            <div className="form-row">
              <div><div className="form-row__label">Denylist</div><div className="form-row__hint">Tools this version explicitly must not call.</div></div>
              <div className="form-row__control">
                <div className="row row--wrap row--sm" style={{ marginBottom: 8 }}>
                  {toolScope.denylist.map(d => (
                    <Chip key={d} tone="danger">
                      − {d}
                      <button onClick={() => setToolScope(s => ({ ...s, denylist: s.denylist.filter(x => x !== d) }))} style={{ marginLeft: 4, color: 'var(--text-dim)' }}>×</button>
                    </Chip>
                  ))}
                  {toolScope.denylist.length === 0 && <span className="mono muted" style={{ fontSize: 11 }}>none</span>}
                </div>
                <Btn variant="ghost" size="sm" icon={<IconPlus />} onClick={addDenied}>Deny tool</Btn>
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head">
            <div className="card__title">Approval rules</div>
            <div className="row">
              <Chip tone="accent">field · approval_rules</Chip>
              <Btn variant="ghost" size="sm" icon={<IconPlus />} onClick={addRule}>Add rule</Btn>
            </div>
          </div>
          <div className="card__body stack stack--sm">
            {approvalRules.length === 0 ? (
              <div className="muted" style={{ fontSize: 12.5 }}>
                No rules. Without rules, the version relies on per-grant <span className="mono">approval_required</span> flags alone.
              </div>
            ) : approvalRules.map(r => (
              <div key={r.id} className="card" style={{ background: 'var(--surface-2)' }}>
                <div style={{ padding: 12 }}>
                  <div className="row row--between" style={{ marginBottom: 8 }}>
                    <span className="mono uppercase muted">Condition</span>
                    <button onClick={() => removeRule(r.id)} className="mono" style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                      <IconX className="ic ic--sm" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> remove
                    </button>
                  </div>
                  <input
                    className="input input--mono"
                    style={{ marginBottom: 8 }}
                    value={r.when}
                    onChange={e => updateRule(r.id, { when: e.target.value })}
                    placeholder="tool = email.send"
                  />
                  <div className="grid grid--2" style={{ gap: 12, marginBottom: 8 }}>
                    <div>
                      <div className="mono uppercase muted" style={{ marginBottom: 4, fontSize: 9.5 }}>Required approver level</div>
                      <select
                        className="select"
                        value={r.required_approver_level}
                        onChange={e => updateRule(r.id, { required_approver_level: Number(e.target.value) as ApprovalLevel })}
                      >
                        <option value={1}>L1 · self</option>
                        <option value={2}>L2 · senior member</option>
                        <option value={3}>L3 · domain admin</option>
                        <option value={4}>L4 · tenant admin</option>
                      </select>
                    </div>
                    <div>
                      <div className="mono uppercase muted" style={{ marginBottom: 4, fontSize: 9.5 }}>Note</div>
                      <input className="input" value={r.note} onChange={e => updateRule(r.id, { note: e.target.value })} placeholder="Why this rule exists" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head"><div className="card__title">Release notes</div></div>
          <div className="card__body">
            <textarea className="input textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tightened ICP scoring for mid-market. Blocked auto-send on outreach." />
          </div>
        </div>

        <div style={{ height: 20 }} />
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'right' }}>
          endpoint · <span className="accent">POST /agents/{'{agentId}'}/versions</span>
          {' · '}
          <span className="accent">POST /agents/{'{agentId}'}/versions/{'{verId}'}/activate</span>
        </div>
      </div>
    </AppShell>
  )
}

function ErrHint({ msg }: { msg: string }) {
  return (
    <div className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
      <IconAlert className="ic ic--sm" /> {msg}
    </div>
  )
}
