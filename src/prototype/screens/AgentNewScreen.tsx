import { useMemo, useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, Avatar, MockBadge } from '../components/common'
import { Banner, NoAccessState } from '../components/states'
import { IconAlert } from '../components/icons'
import { useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import { allUsers } from '../lib/fixtures'
import type { Agent } from '../lib/types'
import { roleLabel } from '../lib/format'

const TEMPLATES: { id: Agent['owner_team']; label: string; blurb: string; glyph: string }[] = [
  { id: 'sales', label: 'Sales · Lead Qualifier', blurb: 'Triage inbound, enrich, draft outreach.', glyph: 'LQ' },
  { id: 'support', label: 'Support · Refund Handler', blurb: 'Classify, refund up to policy cap, notify.', glyph: 'RR' },
  { id: 'finance', label: 'Finance · Invoice Reconciler', blurb: 'Match invoices to POs, flag discrepancies.', glyph: 'IR' },
  { id: 'admin', label: 'Platform · Access Provisioner', blurb: 'On/offboard SaaS accounts from templates.', glyph: 'AP' },
  { id: 'operations', label: 'Ops · Vendor Onboarder', blurb: 'W-9, banking, create vendor records.', glyph: 'VO' },
  { id: 'growth', label: 'Growth · Campaign Drafter', blurb: 'Generate emails and landing copy from briefs.', glyph: 'CD' },
]

const DOMAINS = [
  { id: 'dom_hq', name: 'HQ · Platform' },
  { id: 'dom_sales', name: 'Sales · Revenue' },
  { id: 'dom_support', name: 'Support · CX' },
]

export default function AgentNewScreen() {
  const { navigate } = useRouter()
  const { user } = useAuth()
  const users = useMemo(() => allUsers(), [])

  const isMember = user?.role === 'member'
  const isAdmin = user?.role === 'admin'

  const [template, setTemplate] = useState<string>('sales')
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [ownerId, setOwnerId] = useState<string>(user?.id ?? users[0]?.id ?? '')
  const [domainId, setDomainId] = useState<string>(user?.domain_id ?? 'dom_hq')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const nameError = !name.trim() ? 'Required' : name.trim().length < 3 ? 'Use at least 3 characters' : undefined
  const nameErrVisible = submitted && nameError

  // Keep domain synced to the selected owner unless admin is explicit.
  const selectedOwner = users.find(u => u.id === ownerId)
  const effectiveDomain = isAdmin ? domainId : (selectedOwner?.domain_id ?? domainId)

  if (isMember) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'new' }]}>
        <div className="page page--narrow">
          <PageHeader eyebrow="CREATE AGENT" title={<>Admins only</>} />
          <NoAccessState
            requiredRole="domain_admin or admin"
            body="Creating agents is restricted to admins on this tenant. You can still dispatch tasks to existing agents from the Tasks screen."
          />
          <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <Btn variant="ghost" href="/agents">Back to agents</Btn>
          </div>
        </div>
      </AppShell>
    )
  }

  const submit = async () => {
    setSubmitted(true)
    if (nameError) return
    setBusy(true)
    setErr(null)
    try {
      const a = await api.createAgent({ name: name.trim(), description: desc.trim(), owner_user_id: ownerId })
      setSuccess(true)
      setTimeout(() => navigate(`/agents/${a.id}`), 600)
    } catch (e) {
      setErr((e as Error).message ?? 'Could not create agent')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'new' }]}>
      <div className="page page--narrow">
        <PageHeader
          eyebrow="CREATE AGENT"
          title={<>Spin up a new <em>operator.</em></>}
          subtitle="Agents carry a name, an owner, and a starting description. Versions, tools, and approval policy are configured in the next steps."
          actions={
            <>
              <Btn variant="ghost" href="/agents" disabled={busy}>Cancel</Btn>
              <Btn variant="primary" onClick={submit} disabled={busy || success}>
                {busy ? 'creating…' : success ? 'created ✓' : 'Create draft'}
              </Btn>
            </>
          }
        />

        {success && (
          <Banner tone="info" title="Agent created · redirecting">
            The new agent is in <Chip>draft</Chip> state. Next step is creating its first version (instruction spec + model chain).
          </Banner>
        )}

        {err && (
          <div className="banner banner--warn" role="alert">
            <span className="banner__icon"><IconAlert className="ic" /></span>
            <div style={{ flex: 1 }}>
              <div className="banner__title">Couldn't create agent</div>
              <div className="banner__body">{err}</div>
            </div>
          </div>
        )}

        {!success && !err && (
          <Banner tone="info" title="What this does">
            <><span className="mono">POST /agents</span> creates the agent in <Chip>draft</Chip>. You'll then call <span className="mono">POST /agents/{'{agentId}'}/versions</span> to add v1 and activate it before any task can run.</>
          </Banner>
        )}

        <div style={{ height: 20 }} />

        <div className="card">
          <div className="card__head">
            <div className="card__title">Start from a template</div>
            <Chip>optional</Chip>
          </div>
          <div className="card__body">
            <div className="grid grid--3">
              {TEMPLATES.map(t => {
                const on = template === t.id
                return (
                  <button
                    key={t.id}
                    className="login__role"
                    style={{
                      textAlign: 'left',
                      padding: 14,
                      borderColor: on ? 'var(--accent-border)' : undefined,
                      background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                    }}
                    onClick={() => {
                      setTemplate(t.id ?? '')
                      if (!name) setName(t.label.split(' · ')[1] ?? t.label)
                      if (!desc) setDesc(t.blurb)
                    }}
                  >
                    <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                      <div className="agent-row__avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{t.glyph}</div>
                      <div style={{ fontSize: 13, color: 'var(--text)' }}>{t.label}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.blurb}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__body">
            <div className="form-row">
              <div>
                <div className="form-row__label">Name <span className="danger">*</span></div>
                <div className="form-row__hint">Shows up everywhere — pick something your team will recognise.</div>
              </div>
              <div className="form-row__control">
                <input
                  className="input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onBlur={() => setSubmitted(true)}
                  placeholder="Lead Qualifier"
                  aria-invalid={!!nameErrVisible}
                  style={nameErrVisible ? { borderColor: 'var(--danger-border)' } : undefined}
                />
                {nameErrVisible && (
                  <div className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
                    <IconAlert className="ic ic--sm" />
                    {nameError}
                  </div>
                )}
              </div>
            </div>
            <div className="form-row">
              <div>
                <div className="form-row__label">Description</div>
                <div className="form-row__hint">A one-liner the whole team sees in the agent list.</div>
              </div>
              <div className="form-row__control">
                <textarea className="input textarea" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Triages inbound leads and drafts personalised outreach." />
              </div>
            </div>
            <div className="form-row">
              <div>
                <div className="form-row__label row row--sm">
                  Owner <span className="danger">*</span>
                  <MockBadge size="xs" title="POST /agents doesn't accept owner_user_id — backend infers it from the caller" />
                </div>
                <div className="form-row__hint">Owner's tenant + domain seed agent scope. Approval level governs what the owner alone can auto-resolve.</div>
              </div>
              <div className="form-row__control">
                <div className="stack stack--sm">
                  {users.map(u => {
                    const on = ownerId === u.id
                    return (
                      <button
                        key={u.id}
                        className="login__role"
                        style={{
                          textAlign: 'left',
                          padding: 10,
                          display: 'grid',
                          gridTemplateColumns: '36px minmax(0, 1fr) 120px 100px',
                          gap: 12,
                          alignItems: 'center',
                          borderColor: on ? 'var(--accent-border)' : undefined,
                          background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                        }}
                        onClick={() => {
                          setOwnerId(u.id)
                          if (!isAdmin) setDomainId(u.domain_id)
                        }}
                      >
                        <Avatar initials={u.initials ?? u.name.slice(0, 2)} tone={u.avatar_tone ?? 'accent'} size={30} />
                        <div>
                          <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{u.name}</div>
                          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{u.email}</div>
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {roleLabel(u.role)}
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                          approval L{u.approval_level}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="form-row">
              <div>
                <div className="form-row__label">Domain</div>
                <div className="form-row__hint">
                  {isAdmin ? 'Admins can place this agent in any domain.' : 'Domain follows the selected owner. Only tenant admins can override.'}
                </div>
              </div>
              <div className="form-row__control">
                <select
                  className="select"
                  value={effectiveDomain}
                  onChange={e => setDomainId(e.target.value)}
                  disabled={!isAdmin}
                >
                  {DOMAINS.map(d => <option key={d.id} value={d.id}>{d.name} · {d.id}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 20 }} />

        <div className="banner" style={{ background: 'var(--surface)' }}>
          <div className="banner__body">
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              <span className="mono" style={{ color: 'var(--text-dim)' }}>next →</span> pick a model chain and write an instruction spec (Agent Version v1), then grant tools and configure approval rules.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
