import { useState } from 'react'
import { Code, Text } from '@radix-ui/themes'

import { useAuth } from '../auth'
import { useRouter } from '../router'
import { Btn } from '../components/common'
import { PasswordField, TextInput } from '../components/fields'
import { Banner } from '../components/states'
import { IconArrowRight } from '../components/icons'
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
          <Code variant="ghost" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--gray-10)', textTransform: 'uppercase', marginLeft: 6 }}>
            Control Plane
          </Code>
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
            <Text as="p" color="gray" style={{ fontSize: 13, marginTop: 4 }}>
              Create a workspace owner account for the control plane.
            </Text>
          </div>

          {createError && (
            <Banner tone="warn" title="Could not create account">
              {createError}
            </Banner>
          )}

          <TextInput
            id="register-name"
            label="Name"
            type="text"
            value={name}
            onChange={e => updateName(e.target.value)}
            onBlur={() => markTouched('name')}
            autoComplete="name"
            placeholder="Ada Fernsby"
            error={showNameErr}
          />

          <TextInput
            id="register-workspace"
            label="Workspace"
            type="text"
            value={workspaceName}
            onChange={e => updateWorkspaceName(e.target.value)}
            onBlur={() => markTouched('workspaceName')}
            autoComplete="organization"
            placeholder="Acme Operations"
            error={showWorkspaceErr}
          />

          <TextInput
            id="register-email"
            label="Email"
            type="email"
            value={email}
            onChange={e => updateEmail(e.target.value)}
            onBlur={() => markTouched('email')}
            autoComplete="email"
            placeholder="you@company.com"
            error={showEmailErr}
          />

          <PasswordField
            id="register-password"
            label="Password"
            value={password}
            onChange={e => updatePassword(e.target.value)}
            onBlur={() => markTouched('password')}
            autoComplete="new-password"
            placeholder="8+ characters"
            error={showPasswordErr}
          />

          <PasswordField
            id="register-confirm"
            label="Confirm password"
            value={confirmPassword}
            onChange={e => updateConfirmPassword(e.target.value)}
            onBlur={() => markTouched('confirmPassword')}
            autoComplete="new-password"
            placeholder="Repeat password"
            error={showConfirmErr}
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
                <span
                  className="status-pulse"
                  style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent-9)', color: 'var(--accent-9)', display: 'inline-block' }}
                />
                creating account...
              </span>
            ) : 'Create account'}
          </Btn>

          <div className="row row--sm" style={{ justifyContent: 'space-between', color: 'var(--gray-11)', fontSize: 12.5 }}>
            <span>Already have an account?</span>
            <Btn variant="ghost" href="/login">Sign in</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}
