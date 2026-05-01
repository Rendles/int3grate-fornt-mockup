import { useState } from 'react'
import { Button, Code, Flex, Heading, Text } from '@radix-ui/themes'

import { useAuth } from '../auth'
import { useRouter } from '../router'
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
          Let agents do work.<br />
          Keep humans <em>in control.</em>
        </Heading>
        <Text as="div" size="1" color="gray" className="login__meta">
          <span>Region · eu-west-1</span>
          <span>Build · 2026.04.17-a7c</span>
          <span>Status · nominal</span>
        </Text>
      </div>

      <div className="login__form-wrap">
        <form className="login__form" onSubmit={submit} noValidate>
          <div>
            <Text as="div" size="1" className="page__eyebrow" mb="2" style={{ color: 'var(--gray-10)' }}>SIGN IN</Text>
            <Heading as="h2" size="8" weight="regular" className="login__form-heading">Welcome back.</Heading>
            <Text as="p" size="2" mt="1" style={{ color: 'var(--gray-10)' }}>
              Authenticate with your workspace email to access the control plane.
            </Text>
          </div>

          {invalidCreds && (
            <Banner tone="warn" title="Invalid credentials">
              That email and password combination isn't recognised.
            </Banner>
          )}

          <TextInput
            id="login-email"
            size="3"
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
            size="3"
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

          <Button size="3" type="submit" disabled={busy}>
            {busy ? (
              <Flex align="center" gap="2">
                <span
                  className="status-pulse"
                  style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent-9)', color: 'var(--accent-9)', display: 'inline-block' }}
                />
                signing in …
              </Flex>
            ) : (
              <>
                <IconArrowRight />
                Continue
              </>
            )}
          </Button>

          {/* "Create account" hidden until POST /auth/register exists on the
              backend. See docs/handoff-prep.md § 1.1. Restore together with
              the /register route in src/prototype/index.tsx when re-enabling.
          <Flex align="center" justify="between" gap="2">
            <Text size="1" color="gray">New to Int3grate.ai?</Text>
            <Button asChild variant="ghost"><a href="#/register">Create account</a></Button>
          </Flex>
          */}
        </form>
      </div>
    </div>
  )
}
