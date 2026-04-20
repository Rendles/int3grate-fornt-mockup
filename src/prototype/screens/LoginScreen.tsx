import { useState } from 'react'
import { useAuth } from '../auth'
import { useRouter } from '../router'
import { users } from '../lib/fixtures'
import { Btn } from '../components/common'
import { IconAlert, IconArrowRight } from '../components/icons'

interface FieldErrors {
  email?: string
  password?: string
}

function validate(email: string, password: string): FieldErrors {
  const e: FieldErrors = {}
  if (!email.trim()) e.email = 'Required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Not a valid email address'
  if (!password) e.password = 'Required'
  return e
}

export default function LoginScreen() {
  const { login } = useAuth()
  const { navigate } = useRouter()
  const [email, setEmail] = useState('frontend@int3grate.ai')
  const [password, setPassword] = useState('demo')
  const [busy, setBusy] = useState(false)
  const [invalidCreds, setInvalidCreds] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({})

  const showEmailErr = (touched.email && fieldErrors.email) || undefined
  const showPasswordErr = (touched.password && fieldErrors.password) || undefined

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const errs = validate(email, password)
    setFieldErrors(errs)
    setTouched({ email: true, password: true })
    if (Object.keys(errs).length > 0) return
    setBusy(true)
    setInvalidCreds(false)
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setInvalidCreds(true)
    } finally {
      setBusy(false)
    }
  }

  const quickLogin = async (u: typeof users[number]) => {
    setEmail(u.email)
    setPassword('demo')
    setFieldErrors({})
    setTouched({})
    setBusy(true)
    setInvalidCreds(false)
    try {
      await login(u.email, 'demo')
      navigate('/')
    } catch {
      setInvalidCreds(true)
    } finally {
      setBusy(false)
    }
  }

  const updateEmail = (v: string) => {
    setEmail(v)
    if (touched.email) setFieldErrors(validate(v, password))
    if (invalidCreds) setInvalidCreds(false)
  }
  const updatePassword = (v: string) => {
    setPassword(v)
    if (touched.password) setFieldErrors(validate(email, v))
    if (invalidCreds) setInvalidCreds(false)
  }

  return (
    <div className="login">
      <div className="login__side">
        <div className="login__brand">
          <div className="sb__brand-mark">I</div>
          <span>Int3grate.ai</span>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase', marginLeft: 6 }}>
            Control Plane
          </span>
        </div>
        <h1 className="login__tagline">
          Let agents do work.<br />
          Keep humans <em>in control.</em>
        </h1>
        <div className="login__meta">
          <span>Region · eu-west-1</span>
          <span>Build · 2026.04.17-a7c</span>
          <span>Status · nominal</span>
        </div>
      </div>

      <div className="login__form-wrap">
        <form className="login__form" onSubmit={submit} noValidate>
          <div>
            <div className="page__eyebrow" style={{ marginBottom: 8 }}>SIGN IN</div>
            <h2>Welcome back.</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Authenticate with your workspace email to access the control plane.
            </p>
          </div>

          {invalidCreds && (
            <div className="banner banner--warn" role="alert">
              <span className="banner__icon"><IconAlert className="ic" /></span>
              <div style={{ flex: 1 }}>
                <div className="banner__title">Invalid credentials</div>
                <div className="banner__body">That email and password combination isn't recognised. Try again, or use one of the demo roles below.</div>
              </div>
            </div>
          )}

          <label>
            <div className="mono uppercase" style={{ color: 'var(--text-dim)', marginBottom: 6 }}>Email</div>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => updateEmail(e.target.value)}
              onBlur={() => {
                setTouched(t => ({ ...t, email: true }))
                setFieldErrors(validate(email, password))
              }}
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!showEmailErr}
              aria-describedby={showEmailErr ? 'login-email-err' : undefined}
              style={showEmailErr ? { borderColor: 'var(--danger-border)' } : undefined}
            />
            {showEmailErr && (
              <div id="login-email-err" className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
                <IconAlert className="ic ic--sm" />
                {showEmailErr}
              </div>
            )}
          </label>

          <label>
            <div className="mono uppercase" style={{ color: 'var(--text-dim)', marginBottom: 6 }}>Password</div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => updatePassword(e.target.value)}
              onBlur={() => {
                setTouched(t => ({ ...t, password: true }))
                setFieldErrors(validate(email, password))
              }}
              autoComplete="current-password"
              placeholder="••••••"
              aria-invalid={!!showPasswordErr}
              aria-describedby={showPasswordErr ? 'login-password-err' : undefined}
              style={showPasswordErr ? { borderColor: 'var(--danger-border)' } : undefined}
            />
            {showPasswordErr && (
              <div id="login-password-err" className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
                <IconAlert className="ic ic--sm" />
                {showPasswordErr}
              </div>
            )}
          </label>

          <Btn
            variant="primary"
            size="lg"
            onClick={() => submit()}
            disabled={busy}
            icon={busy ? undefined : <IconArrowRight />}
          >
            {busy ? (
              <span className="row row--sm">
                <span className="dot dot--accent dot--pulse" />
                signing in …
              </span>
            ) : 'Continue'}
          </Btn>

          <div className="login__roles">
            <div className="login__roles-label">— or hop in as a demo role —</div>
            <div className="login__roles-grid">
              {users.map(u => (
                <button
                  key={u.id}
                  type="button"
                  className="login__role"
                  onClick={() => quickLogin(u)}
                  disabled={busy}
                >
                  <div style={{ fontWeight: 500, color: 'var(--text)' }}>{u.name.split(' ')[0]}</div>
                  <div className="login__role-role">{u.role.replace('_', ' ')} · L{u.approval_level}</div>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
