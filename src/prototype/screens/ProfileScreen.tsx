import { AppShell } from '../components/shell'
import { PageHeader, Avatar, Btn, Chip } from '../components/common'
import { Banner } from '../components/states'
import { useAuth } from '../auth'
import { users } from '../lib/fixtures'
import { roleLabel } from '../lib/format'

export default function ProfileScreen() {
  const { user, switchRole, logout } = useAuth()
  if (!user) return null

  const initials = (u: { initials?: string; name: string }) => u.initials ?? u.name.slice(0, 2).toUpperCase()

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'profile' }]}>
      <div className="page page--narrow">
        <PageHeader
          eyebrow="PROFILE"
          title={<>Hello, <em>{user.name.split(' ')[0]}.</em></>}
          subtitle="Your identity inside this tenant. Role-switching here is a prototype helper and does not mirror how role assignment will work in production."
          actions={<Btn variant="ghost" onClick={logout}>Sign out</Btn>}
        />

        <div className="card">
          <div className="card__head">
            <div className="card__title">Identity</div>
            <Chip square tone="accent">GET /me</Chip>
          </div>
          <div className="card__body">
            <div className="row" style={{ gap: 20 }}>
              <Avatar initials={initials(user)} tone={user.avatar_tone ?? 'accent'} size={64} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>
                  {user.name}
                </div>
                <div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>{user.email}</div>
                <div className="row row--sm" style={{ marginTop: 10 }}>
                  <Chip tone="accent">{roleLabel(user.role)}</Chip>
                  <Chip tone="info">approval · L{user.approval_level}</Chip>
                  {user.team && <Chip>{user.team}</Chip>}
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
          <div className="card__head">
            <div className="card__title">Scope</div>
          </div>
          <div className="card__body">
            <div className="grid grid--2">
              <div>
                <div className="mono uppercase muted" style={{ marginBottom: 4 }}>Tenant</div>
                <div>{user.tenant_name ?? user.tenant_id}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  tenant_id · {user.tenant_id}
                </div>
              </div>
              <div>
                <div className="mono uppercase muted" style={{ marginBottom: 4 }}>Domain</div>
                <div>{user.domain_name ?? user.domain_id}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  domain_id · {user.domain_id}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head"><div className="card__title">Approval authority</div></div>
          <div className="card__body">
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
              Approval rules attached to agent versions and tool grants require approvers at or above a given <span className="mono">approval_level</span>.
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
                      {lvl === 1 ? 'self' : lvl === 2 ? 'senior member' : lvl === 3 ? 'domain admin' : 'tenant admin'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <Banner tone="info" title="Prototype helper · switch demo role">
          Use the buttons below to re-auth as another persona. In production this would be gated by SSO / RBAC and is not exposed to users.
        </Banner>

        <div style={{ height: 12 }} />

        <div className="card">
          <div className="card__body">
            <div className="grid grid--3">
              {users.map(u => {
                const active = u.id === user.id
                return (
                  <button
                    key={u.id}
                    className="login__role"
                    style={{
                      textAlign: 'left',
                      padding: 14,
                      borderColor: active ? 'var(--accent-border)' : undefined,
                      background: active ? 'var(--accent-soft)' : 'var(--surface)',
                    }}
                    onClick={() => switchRole(u.id)}
                  >
                    <div className="row" style={{ gap: 12, marginBottom: 10 }}>
                      <Avatar initials={initials(u)} tone={u.avatar_tone ?? 'accent'} size={30} />
                      <div>
                        <div style={{ color: 'var(--text)', fontSize: 13 }}>{u.name}</div>
                        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          {roleLabel(u.role)} · L{u.approval_level}
                        </div>
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 6 }}>
                      {u.domain_name ?? u.domain_id}
                    </div>
                    {active && (
                      <div className="mono uppercase" style={{ color: 'var(--accent)', marginTop: 8 }}>
                        current session
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
