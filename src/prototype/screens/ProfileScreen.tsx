import { AppShell } from '../components/shell'
import { Code, Text } from '@radix-ui/themes'

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
                Loaded via <Code variant="ghost">GET /me</Code>. Only your own user record is exposed by the gateway.
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
                <div style={{ fontSize: 20, fontFamily: 'var(--heading-font-family)', letterSpacing: '-0.01em' }}>
                  {user.name}
                </div>
                <div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>{user.email}</div>
                <div className="row row--sm" style={{ marginTop: 10 }}>
                  <Chip tone="accent">{roleLabel(user.role)}</Chip>
                  <Chip tone="info">approval · L{user.approval_level}</Chip>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text as="div" size="1" color="gray" className="uppercase" style={{ marginBottom: 4 }}>User ID</Text>
                <div className="mono" style={{ fontSize: 12, color: 'var(--gray-12)' }}>{user.id}</div>
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
                <Text as="div" size="1" color="gray" className="uppercase" style={{ marginBottom: 4 }}>Tenant ID</Text>
                <div className="mono">{user.tenant_id}</div>
              </div>
              <div>
                <Text as="div" size="1" color="gray" className="uppercase" style={{ marginBottom: 4 }}>Domain ID</Text>
                <div className="mono">{user.domain_id ?? '—'}</div>
              </div>
              <div>
                <Text as="div" size="1" color="gray" className="uppercase" style={{ marginBottom: 4 }}>Created</Text>
                <div className="mono">{absTime(user.created_at)}</div>
              </div>
              <div>
                <Text as="div" size="1" color="gray" className="uppercase" style={{ marginBottom: 4 }}>Role</Text>
                <div>{roleLabel(user.role)}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head"><div className="card__title">Approval authority</div></div>
          <div className="card__body">
            <p style={{ fontSize: 12.5, color: 'var(--gray-11)', marginBottom: 14 }}>
              Your <Code variant="ghost">approval_level</Code> is <Code variant="ghost">{user.approval_level}</Code>.
              Rules attached to agent versions route requests to whichever level they need.
            </p>
            <div className="grid grid--4" style={{ gap: 8 }}>
              {[1, 2, 3, 4].map(lvl => {
                const on = user.approval_level >= lvl
                return (
                  <div key={lvl} style={{
                    padding: 10,
                    border: `1px solid ${on ? 'var(--accent-a7)' : 'var(--gray-7)'}`,
                    borderRadius: 4,
                    background: on ? 'var(--accent-a3)' : 'var(--gray-3)',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: 'var(--heading-font-family)', fontSize: 24, color: on ? 'var(--accent-9)' : 'var(--gray-10)' }}>L{lvl}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--gray-10)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
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
