import { useState } from 'react'
import { AppShell } from '../components/shell'
import { PageHeader, Btn, Chip, InfoHint } from '../components/common'
import { Banner, NoAccessState } from '../components/states'
import { IconAlert } from '../components/icons'
import { useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'

const DOMAINS = [
  { id: 'dom_hq', name: 'HQ · Platform' },
  { id: 'dom_sales', name: 'Sales · Revenue' },
  { id: 'dom_support', name: 'Support · CX' },
]

export default function AgentNewScreen() {
  const { navigate } = useRouter()
  const { user } = useAuth()

  const isMember = user?.role === 'member'
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [domainId, setDomainId] = useState<string>(user?.domain_id ?? 'dom_hq')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const nameError = !name.trim() ? 'Required' : name.trim().length < 3 ? 'Use at least 3 characters' : undefined
  const nameErrVisible = submitted && nameError

  if (isMember) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'new' }]}>
        <div className="page page--narrow">
          <PageHeader eyebrow="CREATE AGENT" title={<>Admins only</>} />
          <NoAccessState
            requiredRole="domain_admin or admin"
            body="Creating agents is restricted to admins."
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
      const a = await api.createAgent({
        name: name.trim(),
        description: desc.trim() || undefined,
        domain_id: domainId,
      })
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
          eyebrow={
            <>
              CREATE AGENT{' '}
              <InfoHint>
                <span className="mono">POST /agents</span> accepts <span className="mono">name</span>, <span className="mono">description</span>, and <span className="mono">domain_id</span>. Owner is inferred from the caller.
              </InfoHint>
            </>
          }
          title={<>New <em>agent.</em></>}
          subtitle="Name, description, domain. Owner is inferred from you."
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
            The new agent is in <Chip>draft</Chip>. Next step is creating its first version.
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

        <div style={{ height: 20 }} />

        <div className="card">
          <div className="card__body">
            <div className="form-row">
              <div>
                <div className="form-row__label">Name <span className="danger">*</span></div>
                <div className="form-row__hint">1–200 characters. Shown everywhere.</div>
              </div>
              <div className="form-row__control">
                <input
                  className="input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onBlur={() => setSubmitted(true)}
                  placeholder="Lead Qualifier"
                  maxLength={200}
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
                <div className="form-row__hint">Optional. One-line summary.</div>
              </div>
              <div className="form-row__control">
                <textarea
                  className="input textarea"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Triages inbound leads and drafts personalised outreach."
                />
              </div>
            </div>
            <div className="form-row">
              <div>
                <div className="form-row__label">Domain</div>
                <div className="form-row__hint">
                  Scope to a domain (nullable for tenant-wide).
                </div>
              </div>
              <div className="form-row__control">
                <select
                  className="select"
                  value={domainId}
                  onChange={e => setDomainId(e.target.value)}
                >
                  {DOMAINS.map(d => <option key={d.id} value={d.id}>{d.name} · {d.id}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
