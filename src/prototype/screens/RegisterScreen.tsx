import { useState } from 'react'
import { Button, Code, Flex, Heading, Text } from '@radix-ui/themes'

import { useAuth } from '../auth'
import { useRouter } from '../router'
import { PasswordField, TextInput } from '../components/fields'
import { MockBadge } from '../components/common'
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
        <Heading as="h2" size="6" weight="regular" className="login__brand">
          <div className="sb__brand-mark" style={{ width: 28, height: 28 }}>
            <img src={logo} alt="" />
          </div>
          <Text as="span">Int3grate.ai</Text>
          <Code variant="ghost" size="1" color="gray" ml="2" style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Control Plane
          </Code>
        </Heading>
        <Heading as="h1" size="9" weight="regular" className="login__tagline">
          Start with a workspace.<br />
          Keep agents <em>accountable.</em>
        </Heading>
        <Text as="div" size="1" color="gray" className="login__meta">
          <span>Workspace</span>
          <span>Role / workspace admin</span>
          <span>Session / local mock</span>
        </Text>
      </div>

      <div className="login__form-wrap">
        <form className="login__form" onSubmit={submit} noValidate>
          <div>
            <Flex align="center" gap="2" mb="2">
              <Text as="span" size="1" color="gray" className="page__eyebrow">SIGN UP</Text>
              <MockBadge kind="design" hint="POST /auth/register is not in the gateway spec — registration is mock-only and runs entirely against in-memory fixtures." />
            </Flex>
            <Heading as="h2" size="8" weight="regular" className="login__form-heading">Create account.</Heading>
            <Text as="p" size="2" color="gray" mt="1">
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

          <Button size="3" type="submit" disabled={busy}>
            {busy ? (
              <Flex align="center" gap="2">
                <span
                  className="status-pulse"
                  style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent-9)', color: 'var(--accent-9)', display: 'inline-block' }}
                />
                creating account...
              </Flex>
            ) : (
              <>
                <IconArrowRight />
                Create account
              </>
            )}
          </Button>

          <Flex align="center" justify="between" gap="2">
            <Text size="1" color="gray">Already have an account?</Text>
            <Button asChild variant="ghost"><a href="#/login">Sign in</a></Button>
          </Flex>
        </form>
      </div>
    </div>
  )
}
