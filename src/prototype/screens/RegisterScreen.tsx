import { useState } from 'react'
import { useAuth } from '../auth'
import { useRouter } from '../router'
import { Btn } from '../components/common'
import { IconAlert, IconArrowRight } from '../components/icons'
import logo from '../../assets/logo.svg'

interface FieldErrors {
  name?: string
  workspaceName?: string
  email?: string
  password?: string
  confirmPassword?: string
}

interface RegisterForm {
  name: string
  workspaceName: string
  email: string
  password: string
  confirmPassword: string
}

function validate(form: RegisterForm): FieldErrors {
  const e: FieldErrors = {}
  if (!form.name.trim()) e.name = 'Required'
  else if (form.name.trim().length < 2) e.name = 'Use at least 2 characters'
  if (!form.workspaceName.trim()) e.workspaceName = 'Required'
  else if (form.workspaceName.trim().length < 2) e.workspaceName = 'Use at least 2 characters'
  if (!form.email.trim()) e.email = 'Required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Not a valid email address'
  if (!form.password) e.password = 'Required'
  else if (form.password.length < 8) e.password = 'At least 8 characters'
  if (!form.confirmPassword) e.confirmPassword = 'Required'
  else if (form.confirmPassword !== form.password) e.confirmPassword = 'Passwords do not match'
  return e
}

export default function RegisterScreen() {
  const { register } = useAuth()
  const { navigate } = useRouter()
  const [name, setName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FieldErrors, boolean>>>({})

  const form: RegisterForm = { name, workspaceName, email, password, confirmPassword }
  const showNameErr = (touched.name && fieldErrors.name) || undefined
  const showWorkspaceErr = (touched.workspaceName && fieldErrors.workspaceName) || undefined
  const showEmailErr = (touched.email && fieldErrors.email) || undefined
  const showPasswordErr = (touched.password && fieldErrors.password) || undefined
  const showConfirmErr = (touched.confirmPassword && fieldErrors.confirmPassword) || undefined

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const errs = validate(form)
    setFieldErrors(errs)
    setTouched({
      name: true,
      workspaceName: true,
      email: true,
      password: true,
      confirmPassword: true,
    })
    if (Object.keys(errs).length > 0) return
    setBusy(true)
    setCreateError(null)
    try {
      await register({
        name: name.trim(),
        workspaceName: workspaceName.trim(),
        email: email.trim().toLowerCase(),
        password,
      })
      navigate('/')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create account')
    } finally {
      setBusy(false)
    }
  }

  const markTouched = (field: keyof FieldErrors) => {
    setTouched(t => ({ ...t, [field]: true }))
    setFieldErrors(validate(form))
  }

  const updateName = (v: string) => {
    setName(v)
    if (touched.name) setFieldErrors(validate({ ...form, name: v }))
    if (createError) setCreateError(null)
  }

  const updateWorkspaceName = (v: string) => {
    setWorkspaceName(v)
    if (touched.workspaceName) setFieldErrors(validate({ ...form, workspaceName: v }))
    if (createError) setCreateError(null)
  }

  const updateEmail = (v: string) => {
    setEmail(v)
    if (touched.email) setFieldErrors(validate({ ...form, email: v }))
    if (createError) setCreateError(null)
  }

  const updatePassword = (v: string) => {
    setPassword(v)
    if (touched.password || touched.confirmPassword) {
      setFieldErrors(validate({ ...form, password: v }))
    }
    if (createError) setCreateError(null)
  }

  const updateConfirmPassword = (v: string) => {
    setConfirmPassword(v)
    if (touched.confirmPassword) setFieldErrors(validate({ ...form, confirmPassword: v }))
    if (createError) setCreateError(null)
  }

  return (
    <div className="login">
      <div className="login__side">
        <div className="login__brand">
          <div className="sb__brand-mark" style={{ width: 28, height: 28 }}>
            <img src={logo} alt="" />
          </div>
          <span>Int3grate.ai</span>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase', marginLeft: 6 }}>
            Control Plane
          </span>
        </div>
        <h1 className="login__tagline">
          Start with a workspace.<br />
          Keep agents <em>accountable.</em>
        </h1>
        <div className="login__meta">
          <span>Tenant / new workspace</span>
          <span>Role / tenant admin</span>
          <span>Session / local mock</span>
        </div>
      </div>

      <div className="login__form-wrap">
        <form className="login__form" onSubmit={submit} noValidate>
          <div>
            <div className="page__eyebrow" style={{ marginBottom: 8 }}>SIGN UP</div>
            <h2>Create account.</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Create a workspace owner account for the control plane.
            </p>
          </div>

          {createError && (
            <div className="banner banner--warn" role="alert">
              <span className="banner__icon"><IconAlert className="ic" /></span>
              <div style={{ flex: 1 }}>
                <div className="banner__title">Could not create account</div>
                <div className="banner__body">{createError}</div>
              </div>
            </div>
          )}

          <label>
            <div className="mono uppercase" style={{ color: 'var(--text-dim)', marginBottom: 6 }}>Name</div>
            <input
              className="input"
              type="text"
              value={name}
              onChange={e => updateName(e.target.value)}
              onBlur={() => markTouched('name')}
              autoComplete="name"
              placeholder="Ada Fernsby"
              aria-invalid={!!showNameErr}
              aria-describedby={showNameErr ? 'register-name-err' : undefined}
              style={showNameErr ? { borderColor: 'var(--danger-border)' } : undefined}
            />
            {showNameErr && (
              <div id="register-name-err" className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
                <IconAlert className="ic ic--sm" />
                {showNameErr}
              </div>
            )}
          </label>

          <label>
            <div className="mono uppercase" style={{ color: 'var(--text-dim)', marginBottom: 6 }}>Workspace</div>
            <input
              className="input"
              type="text"
              value={workspaceName}
              onChange={e => updateWorkspaceName(e.target.value)}
              onBlur={() => markTouched('workspaceName')}
              autoComplete="organization"
              placeholder="Acme Operations"
              aria-invalid={!!showWorkspaceErr}
              aria-describedby={showWorkspaceErr ? 'register-workspace-err' : undefined}
              style={showWorkspaceErr ? { borderColor: 'var(--danger-border)' } : undefined}
            />
            {showWorkspaceErr && (
              <div id="register-workspace-err" className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
                <IconAlert className="ic ic--sm" />
                {showWorkspaceErr}
              </div>
            )}
          </label>

          <label>
            <div className="mono uppercase" style={{ color: 'var(--text-dim)', marginBottom: 6 }}>Email</div>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => updateEmail(e.target.value)}
              onBlur={() => markTouched('email')}
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!showEmailErr}
              aria-describedby={showEmailErr ? 'register-email-err' : undefined}
              style={showEmailErr ? { borderColor: 'var(--danger-border)' } : undefined}
            />
            {showEmailErr && (
              <div id="register-email-err" className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
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
              onBlur={() => markTouched('password')}
              autoComplete="new-password"
              placeholder="8+ characters"
              aria-invalid={!!showPasswordErr}
              aria-describedby={showPasswordErr ? 'register-password-err' : undefined}
              style={showPasswordErr ? { borderColor: 'var(--danger-border)' } : undefined}
            />
            {showPasswordErr && (
              <div id="register-password-err" className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
                <IconAlert className="ic ic--sm" />
                {showPasswordErr}
              </div>
            )}
          </label>

          <label>
            <div className="mono uppercase" style={{ color: 'var(--text-dim)', marginBottom: 6 }}>Confirm password</div>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={e => updateConfirmPassword(e.target.value)}
              onBlur={() => markTouched('confirmPassword')}
              autoComplete="new-password"
              placeholder="Repeat password"
              aria-invalid={!!showConfirmErr}
              aria-describedby={showConfirmErr ? 'register-confirm-err' : undefined}
              style={showConfirmErr ? { borderColor: 'var(--danger-border)' } : undefined}
            />
            {showConfirmErr && (
              <div id="register-confirm-err" className="row row--sm" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 11.5 }}>
                <IconAlert className="ic ic--sm" />
                {showConfirmErr}
              </div>
            )}
          </label>

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
                creating account...
              </span>
            ) : 'Create account'}
          </Btn>

          <div className="row row--sm" style={{ justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12.5 }}>
            <span>Already have an account?</span>
            <Btn variant="ghost" href="/login">Sign in</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}
