import { AppShell } from '../components/shell'
import { PageHeader, Avatar, Btn, Chip, InfoHint } from '../components/common'
import { useAuth } from '../auth'
import { roleLabel, absTime } from '../lib/format'

export default function ProfileScreen() {
  const { user, logout } = useAuth()
  if (!user) return null

  const initials = user.name.slice(0, 2).toUpperCase()

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'profile' }]}>
      <div className="page page--narrow">
        <PageHeader
          eyebrow={
            <>
              PROFILE{' '}
              <InfoHint>
                Loaded via <span className="mono">GET /me</span>. Only your own user record is exposed by the gateway.
              </InfoHint>
            </>
          }
          title={<>Hello, <em>{user.name.split(' ')[0]}.</em></>}
          actions={<Btn variant="ghost" onClick={logout}>Sign out</Btn>}
        />

        <div className="card">
          <div className="card__head">
            <div className="card__title">Identity</div>
          </div>
          <div className="card__body">
            <div className="row" style={{ gap: 20 }}>
              <Avatar initials={initials} size={64} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>
                  {user.name}
                </div>
                <div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>{user.email}</div>
                <div className="row row--sm" style={{ marginTop: 10 }}>
                  <Chip tone="accent">{roleLabel(user.role)}</Chip>
                  <Chip tone="info">approval · L{user.approval_level}</Chip>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono uppercase muted" style={{ marginBottom: 4 }}>User ID</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>{user.id}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head"><div className="card__title">Scope</div></div>
          <div className="card__body">
            <div className="grid grid--2">
              <div>
                <div className="mono uppercase muted" style={{ marginBottom: 4 }}>Tenant ID</div>
                <div className="mono">{user.tenant_id}</div>
              </div>
              <div>
                <div className="mono uppercase muted" style={{ marginBottom: 4 }}>Domain ID</div>
                <div className="mono">{user.domain_id ?? '—'}</div>
              </div>
              <div>
                <div className="mono uppercase muted" style={{ marginBottom: 4 }}>Created</div>
                <div className="mono">{absTime(user.created_at)}</div>
              </div>
              <div>
                <div className="mono uppercase muted" style={{ marginBottom: 4 }}>Role</div>
                <div>{roleLabel(user.role)}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head"><div className="card__title">Approval authority</div></div>
          <div className="card__body">
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
              Your <span className="mono">approval_level</span> is <span className="mono">{user.approval_level}</span>.
              Rules attached to agent versions route requests to whichever level they need.
            </p>
            <div className="grid grid--4" style={{ gap: 8 }}>
              {[1, 2, 3, 4].map(lvl => {
                const on = user.approval_level >= lvl
                return (
                  <div key={lvl} style={{
                    padding: 10,
                    border: `1px solid ${on ? 'var(--accent-border)' : 'var(--border-2)'}`,
                    borderRadius: 4,
                    background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: on ? 'var(--accent)' : 'var(--text-dim)' }}>L{lvl}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
                      {on ? 'can decide' : 'above you'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
