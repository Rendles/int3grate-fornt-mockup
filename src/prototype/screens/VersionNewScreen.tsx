import { useEffect, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip } from '../components/common'
import { Banner, LoadingList, NoAccessState } from '../components/states'
import { IconAlert } from '../components/icons'
import { useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent } from '../lib/types'

const MODELS = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'gpt-5-mini', 'gpt-5']

const STARTER_PROMPT = `You are {AGENT_NAME}.

Primary objective:
— (what the agent should accomplish)

Hard rules:
— Never take actions that require approval without an explicit ApprovalRequest being granted.
— When the user's request is ambiguous, ask for clarification before using tools.

Tone: direct, operator-friendly, concise.
`

export default function VersionNewScreen({ agentId }: { agentId: string }) {
  const { navigate } = useRouter()
  const { user } = useAuth()
  const canEdit = !!user && (user.role === 'admin' || user.role === 'domain_admin')

  const [agent, setAgent] = useState<Agent | null | undefined>(undefined)
  const [instruction, setInstruction] = useState('')
  const [primary, setPrimary] = useState(MODELS[1])
  const [maxTokens, setMaxTokens] = useState(4096)
  const [temperature, setTemperature] = useState(0.3)
  const [activateImmediately, setActivateImmediately] = useState(true)

  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    api.getAgent(agentId).then(a => {
      setAgent(a ?? null)
      if (a?.active_version?.instruction_spec) {
        setInstruction(a.active_version.instruction_spec)
        const mc = a.active_version.model_chain_config as { primary?: string; max_tokens?: number; temperature?: number }
        if (mc.primary) setPrimary(mc.primary)
        if (typeof mc.max_tokens === 'number') setMaxTokens(mc.max_tokens)
        if (typeof mc.temperature === 'number') setTemperature(mc.temperature)
      } else if (a) {
        setInstruction(STARTER_PROMPT.replace('{AGENT_NAME}', a.name))
      }
    })
  }, [agentId])

  if (!canEdit) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: agent?.name ?? '…', to: `/agents/${agentId}` }, { label: 'new version' }]}>
        <div className="page page--narrow">
          <PageHeader eyebrow="POST /agents/{id}/versions" title={<>Admins only</>} />
          <NoAccessState
            requiredRole="domain_admin or admin"
            body="Creating versions is restricted to admins."
          />
        </div>
      </AppShell>
    )
  }

  if (agent === undefined) {
    return <AppShell crumbs={[{ label: '...', to: '/' }]}><div className="page"><LoadingList rows={4} /></div></AppShell>
  }
  if (agent === null) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'not found' }]}>
        <div className="page">
          <NoAccessState requiredRole="access" body={`Agent ${agentId} could not be loaded.`} />
        </div>
      </AppShell>
    )
  }

  const instructionError = !instruction.trim() ? 'Required' : instruction.trim().length < 1 ? 'Required' : undefined
  const showInstructionErr = submitted && instructionError

  const submit = async () => {
    setSubmitted(true)
    if (instructionError) return
    setBusy(true)
    setSaveError(null)
    try {
      const v = await api.createAgentVersion(agent.id, {
        instruction_spec: instruction.trim(),
        model_chain_config: {
          primary,
          fallbacks: [],
          max_tokens: maxTokens,
          temperature,
        },
        memory_scope_config: {},
        tool_scope_config: {},
        approval_rules: {},
      })
      if (activateImmediately) {
        await api.activateVersion(agent.id, v.id)
      }
      navigate(`/agents/${agent.id}`)
    } catch (e) {
      setSaveError((e as Error).message ?? 'Failed to create version')
    } finally {
      setBusy(false)
    }
  }

  const nextVer = (agent.active_version?.version ?? 0) + 1

  return (
    <AppShell
      crumbs={[
        { label: 'home', to: '/' },
        { label: 'agents', to: '/agents' },
        { label: agent.name, to: `/agents/${agent.id}` },
        { label: 'new version' },
      ]}
    >
      <div className="page page--narrow">
        <PageHeader
          eyebrow={`POST /agents/${agent.id}/versions`}
          title={<>New <em>version</em> <span style={{ color: 'var(--text-muted)', fontSize: 26, marginLeft: 6 }}>v{nextVer}</span></>}
          subtitle={agent.active_version
            ? `Forking from v${agent.active_version.version}. Changes below produce a new immutable version.`
            : 'This is the first version for this agent.'}
          actions={
            <>
              <Btn variant="ghost" href={`/agents/${agent.id}`} disabled={busy}>Cancel</Btn>
              <Btn variant="primary" onClick={submit} disabled={busy}>
                {busy ? 'creating…' : activateImmediately ? `Create & activate v${nextVer}` : `Create v${nextVer}`}
              </Btn>
            </>
          }
        />

        {saveError && (
          <div className="banner banner--warn" role="alert">
            <span className="banner__icon"><IconAlert className="ic" /></span>
            <div style={{ flex: 1 }}>
              <div className="banner__title">Couldn't create version</div>
              <div className="banner__body">{saveError}</div>
            </div>
            <Btn variant="ghost" onClick={() => setSaveError(null)}>Dismiss</Btn>
          </div>
        )}

        <div className="card">
          <div className="card__head">
            <div className="card__title">instruction_spec <span className="danger">*</span></div>
          </div>
          <div className="card__body">
            <textarea
              className="input textarea"
              style={{
                minHeight: 260,
                fontFamily: 'var(--font-mono)',
                fontSize: 12.5,
                lineHeight: 1.5,
                borderColor: showInstructionErr ? 'var(--danger-border)' : undefined,
              }}
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
            />
            {showInstructionErr && (
              <div className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
                <IconAlert className="ic ic--sm" /> {instructionError}
              </div>
            )}
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head"><div className="card__title">model_chain_config</div></div>
          <div className="card__body">
            <div className="form-row">
              <div>
                <div className="form-row__label">Primary model</div>
                <div className="form-row__hint">Model the agent uses by default.</div>
              </div>
              <div className="form-row__control">
                <select
                  className="select"
                  value={primary}
                  onChange={e => setPrimary(e.target.value)}
                >
                  {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div>
                <div className="form-row__label">max_tokens</div>
                <div className="form-row__hint">Output budget.</div>
              </div>
              <div className="form-row__control">
                <input
                  type="number"
                  className="input"
                  value={maxTokens}
                  min={64}
                  max={32000}
                  onChange={e => setMaxTokens(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="form-row">
              <div>
                <div className="form-row__label">temperature</div>
                <div className="form-row__hint">0 = deterministic, 1 = exploratory.</div>
              </div>
              <div className="form-row__control">
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={1}
                  className="input"
                  value={temperature}
                  onChange={e => setTemperature(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__body">
            <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={activateImmediately}
                onChange={e => setActivateImmediately(e.target.checked)}
              />
              <span>
                <div style={{ fontSize: 13 }}>Activate immediately after create</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                  Calls <span className="mono">POST /agents/{'{id}'}/versions/{'{verId}'}/activate</span> right after creation.
                </div>
              </span>
            </label>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <Banner tone="info" title="What the backend accepts">
          <>
            <span className="mono">POST /agents/{'{id}'}/versions</span> requires <Chip>instruction_spec</Chip> and accepts
            <Chip>memory_scope_config</Chip> <Chip>tool_scope_config</Chip> <Chip>approval_rules</Chip> <Chip>model_chain_config</Chip> as generic objects.
            This form currently submits empty objects for the first three.
          </>
        </Banner>
      </div>
    </AppShell>
  )
}
