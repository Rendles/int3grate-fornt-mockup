import { useState } from 'react'
import { Code } from '@radix-ui/themes'

import { useAuth } from '../auth'
import { useRouter } from '../router'
import { Btn } from '../components/common'
import { PasswordField, TextInput } from '../components/fields'
import { Banner } from '../components/states'
import { IconArrowRight } from '../components/icons'
import logo from '../../assets/logo.svg'

interface FieldErrors {
  email?: string
  password?: string
}

function validate(email: string, password: string): FieldErrors {
  const e: FieldErrors = {}
  if (!email.trim()) e.email = 'Required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Not a valid email address'
  if (!password) e.password = 'Required'
  else if (password.length < 8) e.password = 'At least 8 characters'
  return e
}

export default function LoginScreen() {
  const { login } = useAuth()
  const { navigate } = useRouter()
  const [email, setEmail] = useState('frontend@int3grate.ai')
  const [password, setPassword] = useState('demo1234')
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
          <div className="sb__brand-mark" style={{ width: 28, height: 28 }}>
            <img src={logo} alt="" />
          </div>
          <span>Int3grate.ai</span>
          <Code variant="ghost" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--gray-10)', textTransform: 'uppercase', marginLeft: 6 }}>
            Control Plane
          </Code>
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
            <Banner tone="warn" title="Invalid credentials">
              That email and password combination isn't recognised.
            </Banner>
          )}

          <TextInput
            id="login-email"
            label="Email"
            type="email"
            value={email}
            onChange={e => updateEmail(e.target.value)}
            onBlur={() => {
              setTouched(t => ({ ...t, email: true }))
              setFieldErrors(validate(email, password))
            }}
            autoComplete="email"
            placeholder="you@company.com"
            error={showEmailErr}
          />

          <PasswordField
            id="login-password"
            label="Password"
            value={password}
            onChange={e => updatePassword(e.target.value)}
            onBlur={() => {
              setTouched(t => ({ ...t, password: true }))
              setFieldErrors(validate(email, password))
            }}
            autoComplete="current-password"
            placeholder="••••••"
            error={showPasswordErr}
          />

          <Btn
            variant="primary"
            size="lg"
            type="submit"
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

          <div className="row row--sm" style={{ justifyContent: 'space-between', color: 'var(--gray-11)', fontSize: 12.5 }}>
            <span>New to Int3grate.ai?</span>
            <Btn variant="ghost" href="/register">Create account</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}
