import { useMemo, useState } from 'react'
import { Badge, Box, Button, Flex, Grid, Heading, Slider, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Avatar, Caption, MockBadge, PageHeader } from '../components/common'
import { SelectField, TextAreaField, TextInput } from '../components/fields'
import { Banner, NoAccessState } from '../components/states'
import {
  IconAgent,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChat,
  IconHome,
  IconPlus,
} from '../components/icons'
import { useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent } from '../lib/types'
import { appLabel, appPrefix, toolLabel } from '../lib/format'
import {
  FEATURED_TEMPLATES,
  NON_FEATURED_TEMPLATES,
  type AssistantTemplate,
  type TemplateGrant,
} from '../lib/templates'

type Phase = 'welcome' | 'preview' | 'name' | 'apps' | 'review' | 'success'

const MODEL_OPTIONS = [
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7 — heavy reasoning' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced default' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fast & cheap' },
]
const DEFAULT_MODEL = 'claude-haiku-4-5'

export default function AgentNewScreen() {
  const { navigate } = useRouter()
  const { user } = useAuth()

  const isMember = user?.role === 'member'

  const [phase, setPhase] = useState<Phase>('welcome')
  const [template, setTemplate] = useState<AssistantTemplate | null>(null)
  const [name, setName] = useState('')
  const [connectedApps, setConnectedApps] = useState<Set<string>>(new Set())
  const [showAllRoles, setShowAllRoles] = useState(false)

  // Advanced settings (initialised when template is picked).
  const [instructions, setInstructions] = useState('')
  const [model, setModel] = useState<string>(DEFAULT_MODEL)
  const [creativity, setCreativity] = useState<number>(0.5)
  const [maxTokens, setMaxTokens] = useState<number>(2048)

  // Hire flow state.
  const [busy, setBusy] = useState(false)
  const [hireError, setHireError] = useState<string | null>(null)
  const [hiredAgent, setHiredAgent] = useState<Agent | null>(null)

  const requiredAppPrefixes = useMemo<string[]>(() => {
    if (!template) return []
    const seen = new Set<string>()
    for (const g of template.defaultGrants) seen.add(appPrefix(g.tool_name))
    return [...seen]
  }, [template])

  if (isMember) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'team', to: '/agents' }, { label: 'hire' }]}>
        <div className="page page--narrow">
          <PageHeader eyebrow="HIRE AN AGENT" title={<>Admins only</>} />
          <NoAccessState
            requiredRole="Team Admin or Workspace Admin"
            body="Only admins can hire new agents."
          />
          <Flex justify="center" mt="3">
            <Button asChild variant="ghost"><a href="#/agents">Back to team</a></Button>
          </Flex>
        </div>
      </AppShell>
    )
  }

  const pickTemplate = (t: AssistantTemplate) => {
    setTemplate(t)
    setName(t.defaultName)
    setInstructions(t.defaultInstructions)
    setModel(t.defaultModel ?? DEFAULT_MODEL)
    setConnectedApps(new Set())
    setHireError(null)
    setPhase('preview')
  }

  const goToWizard = () => setPhase('name')

  const goBackToWelcome = () => {
    setTemplate(null)
    setPhase('welcome')
  }

  const goToApps = () => setPhase('apps')
  const goToReview = () => setPhase('review')

  const toggleApp = (prefix: string) => {
    setConnectedApps(prev => {
      const next = new Set(prev)
      if (next.has(prefix)) next.delete(prefix)
      else next.add(prefix)
      return next
    })
  }

  // For the wizard's "Hire" CTA — keep enabled even when some apps aren't
  // connected, but show a warning. Plan section 8 step 2: "Можно пропустить —
  // будет warning, что без них агент не сможет работать."
  const skippedApps = requiredAppPrefixes.filter(p => !connectedApps.has(p))

  const hire = async () => {
    if (!template || !name.trim()) return
    setBusy(true)
    setHireError(null)
    try {
      const agent = await api.createAgent({
        name: name.trim(),
        description: template.shortPitch,
        domain_id: user?.domain_id ?? null,
      })
      const v = await api.createAgentVersion(agent.id, {
        instruction_spec: instructions.trim() || template.defaultInstructions,
        model_chain_config: {
          primary: model,
          temperature: creativity,
          max_tokens: maxTokens,
        },
        approval_rules: {},
        memory_scope_config: {},
        tool_scope_config: { inherits_from_agent: true },
      })
      await api.activateVersion(agent.id, v.id)
      const grants: TemplateGrant[] = template.defaultGrants.filter(g =>
        connectedApps.has(appPrefix(g.tool_name)),
      )
      if (grants.length > 0) {
        await api.setGrants(agent.id, { grants })
      }
      // Mock-only: createAgent returns status 'draft'. Activating v1 in the
      // mock doesn't auto-flip it — flip here so the new agent is usable
      // immediately (real backend likely transitions on POST /activate).
      const fresh = await api.getAgent(agent.id)
      if (fresh) {
        fresh.status = 'active'
        setHiredAgent(fresh)
      } else {
        setHiredAgent(agent)
      }
      setPhase('success')
    } catch (e) {
      setHireError((e as Error).message ?? 'Could not hire agent')
    } finally {
      setBusy(false)
    }
  }

  // ─────────────────────────────────────── WELCOME phase
  if (phase === 'welcome') {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'team', to: '/agents' }, { label: 'hire' }]}>
        <div className="page page--narrow">
          <Flex direction="column" align="center" gap="3" mb="6" mt="4" style={{ textAlign: 'center' }}>
            <Box style={{ color: 'var(--accent-9)' }}>
              <IconAgent size={36} />
            </Box>
            <Heading size="8" weight="regular" className="page__title">
              What do you need help with <em>first?</em>
            </Heading>
            <Text size="3" color="gray" style={{ maxWidth: 540, lineHeight: 1.55 }}>
              Pick a starter role. You can rename, retrain, or fire your agent any time.
            </Text>
          </Flex>

          <Grid columns={{ initial: '1', sm: '2' }} gap="3">
            {FEATURED_TEMPLATES.map(t => (
              <RoleCard key={t.id} template={t} onPick={pickTemplate} prominent />
            ))}
          </Grid>

          {showAllRoles && (
            <Box mt="4">
              <Caption mb="2" as="div">More roles</Caption>
              <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                {NON_FEATURED_TEMPLATES.map(t => (
                  <RoleCard key={t.id} template={t} onPick={pickTemplate} prominent={false} />
                ))}
              </Grid>
            </Box>
          )}

          <Flex justify="center" gap="4" mt="5" wrap="wrap">
            {!showAllRoles && (
              <Button variant="ghost" onClick={() => setShowAllRoles(true)}>
                See all roles
              </Button>
            )}
            <Button asChild variant="ghost" color="gray">
              <a href="#/agents">Skip and explore</a>
            </Button>
          </Flex>
        </div>
      </AppShell>
    )
  }

  // ─────────────────────────────────────── PREVIEW phase
  if (phase === 'preview' && template) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'team', to: '/agents' }, { label: 'hire' }, { label: template.defaultName }]}>
        <div className="page page--narrow">
          <Flex direction="column" align="center" gap="3" mb="5" mt="3" style={{ textAlign: 'center' }}>
            <Avatar initials={template.initials} size={48} />
            <Heading size="8" weight="regular" className="page__title">
              {template.defaultName}
            </Heading>
            <Text size="3" color="gray" style={{ maxWidth: 580, lineHeight: 1.6 }}>
              {template.longPitch}
            </Text>
          </Flex>

          <Flex direction="column" gap="4">
            <PreviewSection title="Will need access to">
              {requiredAppPrefixes.length === 0 ? (
                <Text as="div" size="2" color="gray">
                  Nothing yet — you'll pick apps in the next step.
                </Text>
              ) : (
                <Flex direction="column" gap="2">
                  {requiredAppPrefixes.map(p => (
                    <PreviewBullet key={p}>
                      <Text as="span" size="2" weight="medium">{appLabel(p)}</Text>
                      {' — '}
                      <Text as="span" size="2" color="gray">
                        {appReason(p)}
                      </Text>
                    </PreviewBullet>
                  ))}
                </Flex>
              )}
            </PreviewSection>

            <PreviewSection title="Will ask your approval before">
              {template.approvalCopy.length === 0 ? (
                <Text as="div" size="2" color="gray">
                  No approval gates by default — set them in step 3.
                </Text>
              ) : (
                <Flex direction="column" gap="2">
                  {template.approvalCopy.map((copy, i) => (
                    <PreviewBullet key={i}>
                      <Text as="span" size="2">{copy}</Text>
                    </PreviewBullet>
                  ))}
                </Flex>
              )}
            </PreviewSection>
          </Flex>

          <Flex justify="center" gap="3" mt="6" wrap="wrap">
            <Button variant="ghost" color="gray" onClick={goBackToWelcome}>
              <IconArrowLeft className="ic ic--sm" />
              Back
            </Button>
            <Button size="3" onClick={goToWizard}>
              <IconPlus />
              Hire {template.defaultName}
            </Button>
          </Flex>
        </div>
      </AppShell>
    )
  }

  // ─────────────────────────────────────── WIZARD STEPS
  if (template && (phase === 'name' || phase === 'apps' || phase === 'review')) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'team', to: '/agents' }, { label: 'hire' }, { label: template.defaultName }]}>
        <div className="page page--narrow">
          <Flex direction="column" gap="3" mb="5">
            <StepProgress phase={phase} />
            <Heading size="6" weight="regular">
              {phase === 'name' && <>Name your <em>agent.</em></>}
              {phase === 'apps' && (
                <>
                  Connect <em>apps.</em>{' '}
                  <Text as="span" size="2" weight="regular" style={{ verticalAlign: 'middle' }}>
                    <MockBadge kind="design" hint="Real OAuth wiring needs a backend integration registry that isn't in the spec yet. The Connect button below is a placeholder — clicking it just toggles a local state flag." />
                  </Text>
                </>
              )}
              {phase === 'review' && <>Review and <em>hire.</em></>}
            </Heading>
            <Text size="2" color="gray">
              {phase === 'name' && 'You can rename later.'}
              {phase === 'apps' && `${template.defaultName} works best when its apps are connected. You can skip and connect later.`}
              {phase === 'review' && 'Last look before this agent joins your team.'}
            </Text>
          </Flex>

          {phase === 'name' && (
            <NameStep
              name={name}
              onName={setName}
              templateName={template.defaultName}
              onNext={goToApps}
              onBack={goBackToWelcome}
            />
          )}

          {phase === 'apps' && (
            <AppsStep
              template={template}
              connectedApps={connectedApps}
              onToggle={toggleApp}
              onNext={goToReview}
              onBack={() => setPhase('name')}
            />
          )}

          {phase === 'review' && (
            <ReviewStep
              template={template}
              name={name}
              connectedApps={connectedApps}
              skippedApps={skippedApps}
              instructions={instructions}
              onInstructions={setInstructions}
              model={model}
              onModel={setModel}
              creativity={creativity}
              onCreativity={setCreativity}
              maxTokens={maxTokens}
              onMaxTokens={setMaxTokens}
              onBack={() => setPhase('apps')}
              onHire={hire}
              busy={busy}
              hireError={hireError}
            />
          )}
        </div>
      </AppShell>
    )
  }

  // ─────────────────────────────────────── SUCCESS phase
  if (phase === 'success' && hiredAgent && template) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'team', to: '/agents' }, { label: hiredAgent.name }]}>
        <div className="page page--narrow">
          <Flex direction="column" align="center" gap="3" mt="6" style={{ textAlign: 'center' }}>
            <Box style={{
              width: 56, height: 56, borderRadius: 999,
              background: 'var(--green-a3)', color: 'var(--green-11)',
              display: 'grid', placeItems: 'center',
            }}>
              <IconCheck size={26} />
            </Box>
            <Heading size="8" weight="regular" className="page__title">
              {hiredAgent.name} is <em>ready.</em>
            </Heading>
          </Flex>

          <div className="card" style={{ marginTop: 32 }}>
            <Box p="5">
              <Caption mb="3" as="div">What happens next</Caption>
              <Flex direction="column" gap="3">
                <BulletItem>
                  {hiredAgent.name} is now part of your team and will start working with the apps you connected.
                </BulletItem>
                <BulletItem>
                  When it wants to do something that needs your approval, you'll see it on the Approvals page.
                </BulletItem>
                <BulletItem>
                  You can talk to {hiredAgent.name} any time from the Team page.
                </BulletItem>
              </Flex>
            </Box>
          </div>

          <Flex justify="center" gap="3" mt="5" wrap="wrap">
            <Button asChild variant="soft" color="gray" size="3">
              <a href="#/"><IconHome />Go to Home</a>
            </Button>
            <Button asChild size="3">
              <a href={`#/agents/${hiredAgent.id}/talk`}><IconChat />Talk to {hiredAgent.name.split(' ')[0]}</a>
            </Button>
          </Flex>
        </div>
      </AppShell>
    )
  }

  // Fallback — phase value got out of sync. Reset to welcome.
  navigate('/agents/new')
  return null
}

// ──────────────────────────────────────────────────────── Local components

function RoleCard({
  template,
  onPick,
  prominent,
}: {
  template: AssistantTemplate
  onPick: (t: AssistantTemplate) => void
  prominent: boolean
}) {
  return (
    <button
      onClick={() => onPick(template)}
      style={{
        textAlign: 'left',
        padding: prominent ? 20 : 14,
        borderRadius: 14,
        border: '1px solid var(--gray-a3)',
        background: 'var(--color-panel-solid)',
        color: 'inherit',
        cursor: 'pointer',
        transition: 'border-color 120ms, background 120ms',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-a7)' }}
      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gray-a3)' }}
    >
      <Flex align="center" gap="3">
        <Avatar initials={template.initials} size={prominent ? 36 : 28} />
        <Box minWidth="0" flexGrow="1">
          <Text as="div" size={prominent ? '3' : '2'} weight="medium" className="truncate">{template.defaultName}</Text>
        </Box>
      </Flex>
      <Text as="div" size="2" color="gray" style={{ lineHeight: 1.55 }}>
        {template.shortPitch}
      </Text>
    </button>
  )
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <Box p="4">
        <Caption mb="3" as="div">{title}</Caption>
        {children}
      </Box>
    </div>
  )
}

function PreviewBullet({ children }: { children: React.ReactNode }) {
  return (
    <Flex align="start" gap="2">
      <Box style={{ color: 'var(--accent-9)', paddingTop: 4 }}>
        <IconCheck size={12} />
      </Box>
      <Box flexGrow="1" style={{ minWidth: 0, lineHeight: 1.55 }}>
        {children}
      </Box>
    </Flex>
  )
}

function StepProgress({ phase }: { phase: 'name' | 'apps' | 'review' }) {
  const steps: Array<'name' | 'apps' | 'review'> = ['name', 'apps', 'review']
  const labels: Record<typeof steps[number], string> = {
    name: 'Name',
    apps: 'Apps',
    review: 'Review',
  }
  const activeIndex = steps.indexOf(phase)
  return (
    <Flex align="center" gap="2" wrap="wrap">
      {steps.map((s, i) => {
        const done = i < activeIndex
        const active = i === activeIndex
        const color = active ? 'var(--accent-11)' : done ? 'var(--green-11)' : 'var(--gray-10)'
        return (
          <Flex key={s} align="center" gap="2">
            <Box
              style={{
                width: 22, height: 22, borderRadius: 999,
                border: `1px solid ${active ? 'var(--accent-a7)' : done ? 'var(--green-a7)' : 'var(--gray-a5)'}`,
                background: done ? 'var(--green-a3)' : active ? 'var(--accent-a3)' : 'transparent',
                color,
                display: 'grid', placeItems: 'center',
                fontSize: 11, fontWeight: 600,
              }}
            >
              {done ? <IconCheck size={11} /> : i + 1}
            </Box>
            <Text size="1" style={{ color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              {labels[s]}
            </Text>
            {i < steps.length - 1 && (
              <Box style={{ width: 28, height: 1, background: 'var(--gray-a5)' }} />
            )}
          </Flex>
        )
      })}
    </Flex>
  )
}

function NameStep({
  name,
  onName,
  templateName,
  onNext,
  onBack,
}: {
  name: string
  onName: (v: string) => void
  templateName: string
  onNext: () => void
  onBack: () => void
}) {
  const trimmed = name.trim()
  const error = !trimmed
    ? 'Required'
    : trimmed.length < 3
      ? 'Use at least 3 characters'
      : undefined
  return (
    <>
      <div className="card">
        <Box p="5">
          <Text as="div" size="2" weight="medium" mb="2">Name</Text>
          <TextInput
            value={name}
            onChange={e => onName(e.target.value)}
            placeholder={templateName}
            maxLength={200}
            error={error}
          />
          <Text as="div" size="1" color="gray" mt="2">
            Pre-filled with <Text as="span" weight="medium">{templateName}</Text>. Pick something memorable — your team will see it.
          </Text>
        </Box>
      </div>
      <Flex justify="between" mt="4" gap="2" wrap="wrap">
        <Button variant="ghost" color="gray" onClick={onBack}>
          <IconArrowLeft className="ic ic--sm" /> Back
        </Button>
        <Button size="3" onClick={onNext} disabled={!!error}>
          Continue
          <IconArrowRight className="ic ic--sm" />
        </Button>
      </Flex>
    </>
  )
}

function AppsStep({
  template,
  connectedApps,
  onToggle,
  onNext,
  onBack,
}: {
  template: AssistantTemplate
  connectedApps: Set<string>
  onToggle: (prefix: string) => void
  onNext: () => void
  onBack: () => void
}) {
  // Group template grants by app prefix.
  const groups = useMemo(() => {
    const map = new Map<string, TemplateGrant[]>()
    for (const g of template.defaultGrants) {
      const p = appPrefix(g.tool_name)
      const existing = map.get(p) ?? []
      existing.push(g)
      map.set(p, existing)
    }
    return [...map.entries()].map(([prefix, grants]) => ({ prefix, grants }))
  }, [template])

  if (groups.length === 0) {
    return (
      <>
        <Banner tone="info" title="No apps to connect for this template">
          A blank agent doesn't need any specific apps. You can grant permissions later from its Permissions tab.
        </Banner>
        <Flex justify="between" mt="4" gap="2" wrap="wrap">
          <Button variant="ghost" color="gray" onClick={onBack}>
            <IconArrowLeft className="ic ic--sm" /> Back
          </Button>
          <Button size="3" onClick={onNext}>
            Continue
            <IconArrowRight className="ic ic--sm" />
          </Button>
        </Flex>
      </>
    )
  }

  return (
    <>
      <Flex direction="column" gap="3">
        {groups.map(({ prefix, grants }) => {
          const connected = connectedApps.has(prefix)
          return (
            <div key={prefix} className="card" style={{ borderColor: connected ? 'var(--green-a6)' : undefined }}>
              <Flex align="center" gap="3" p="4" wrap="wrap">
                <Avatar initials={prefix.slice(0, 2).toUpperCase()} size={36} />
                <Box flexGrow="1" minWidth="0">
                  <Text as="div" size="3" weight="medium">{appLabel(prefix)}</Text>
                  <Text as="div" size="1" color="gray" mt="1">
                    {grants.length === 1 ? '1 permission' : `${grants.length} permissions`} for this agent
                  </Text>
                </Box>
                {connected ? (
                  <Flex gap="2" align="center">
                    <Badge color="green" variant="soft" radius="full" size="1">
                      <IconCheck className="ic ic--sm" /> Connected
                    </Badge>
                    <Button variant="ghost" color="gray" size="1" onClick={() => onToggle(prefix)}>
                      Disconnect
                    </Button>
                  </Flex>
                ) : (
                  <Button onClick={() => onToggle(prefix)}>
                    Connect
                  </Button>
                )}
              </Flex>
              <Box px="4" pb="4">
                <Flex direction="column" gap="1">
                  {grants.map(g => (
                    <Flex key={g.tool_name} align="center" justify="between" gap="2">
                      <Text as="span" size="2" color="gray">{toolLabel(g.tool_name).replace(`${appLabel(prefix)} · `, '')}</Text>
                      <Badge
                        color={g.approval_required ? 'amber' : g.mode === 'read' ? 'cyan' : 'red'}
                        variant="soft"
                        radius="full"
                        size="1"
                      >
                        {g.approval_required
                          ? 'Read & write (with approval)'
                          : g.mode === 'read'
                            ? 'Read only'
                            : 'Read & write (auto)'}
                      </Badge>
                    </Flex>
                  ))}
                </Flex>
              </Box>
            </div>
          )
        })}
      </Flex>

      <Flex justify="between" mt="4" gap="2" wrap="wrap">
        <Button variant="ghost" color="gray" onClick={onBack}>
          <IconArrowLeft className="ic ic--sm" /> Back
        </Button>
        <Button size="3" onClick={onNext}>
          Continue
          <IconArrowRight className="ic ic--sm" />
        </Button>
      </Flex>
    </>
  )
}

function ReviewStep({
  template,
  name,
  connectedApps,
  skippedApps,
  instructions,
  onInstructions,
  model,
  onModel,
  creativity,
  onCreativity,
  maxTokens,
  onMaxTokens,
  onBack,
  onHire,
  busy,
  hireError,
}: {
  template: AssistantTemplate
  name: string
  connectedApps: Set<string>
  skippedApps: string[]
  instructions: string
  onInstructions: (v: string) => void
  model: string
  onModel: (v: string) => void
  creativity: number
  onCreativity: (v: number) => void
  maxTokens: number
  onMaxTokens: (v: number) => void
  onBack: () => void
  onHire: () => void
  busy: boolean
  hireError: string | null
}) {
  const creativityLabel =
    creativity <= 0.2 ? 'deterministic'
    : creativity <= 0.5 ? 'focused'
    : creativity <= 0.8 ? 'balanced'
    : 'exploratory'

  return (
    <>
      <Flex direction="column" gap="3">
        <div className="card">
          <Box p="4">
            <Caption mb="3" as="div">Summary</Caption>
            <Flex direction="column" gap="2">
              <SummaryRow label="Name" value={<Text size="2" weight="medium">{name.trim()}</Text>} />
              <SummaryRow label="Role" value={<Text size="2">{template.defaultName}</Text>} />
              <SummaryRow
                label="Connected apps"
                value={
                  connectedApps.size === 0 ? (
                    <Text size="2" color="gray">none</Text>
                  ) : (
                    <Flex gap="1" wrap="wrap" justify="end">
                      {[...connectedApps].map(p => (
                        <Badge key={p} color="green" variant="soft" radius="full" size="1">{appLabel(p)}</Badge>
                      ))}
                    </Flex>
                  )
                }
              />
              <SummaryRow
                label="Approvals"
                value={
                  template.approvalCopy.length === 0 ? (
                    <Text size="2" color="gray">none</Text>
                  ) : (
                    <Flex direction="column" gap="1" align="end">
                      {template.approvalCopy.map((c, i) => (
                        <Text key={i} size="1" color="gray" style={{ textAlign: 'right' }}>{c}</Text>
                      ))}
                    </Flex>
                  )
                }
              />
            </Flex>
          </Box>
        </div>

        {skippedApps.length > 0 && (
          <Banner tone="warn" title={`${skippedApps.length} ${skippedApps.length === 1 ? 'app' : 'apps'} not connected`}>
            {name || template.defaultName} won't be able to use {skippedApps.map(p => appLabel(p)).join(', ')} until you connect {skippedApps.length === 1 ? 'it' : 'them'} from the Permissions tab. You can hire anyway and connect later.
          </Banner>
        )}

        <details className="card" style={{ padding: '14px 18px' }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
            <Flex align="center" justify="between">
              <Text as="span" size="2" weight="medium">Advanced settings</Text>
              <Text as="span" size="1" color="gray">brief, model, creativity, response length</Text>
            </Flex>
          </summary>
          <Box mt="4">
            <Flex direction="column" gap="4">
              <Box>
                <Text as="div" size="2" weight="medium" mb="2">Brief</Text>
                <TextAreaField
                  value={instructions}
                  onChange={e => onInstructions(e.target.value)}
                  placeholder={template.defaultInstructions}
                  style={{ minHeight: 180 }}
                />
                <Text as="div" size="1" color="gray" mt="1">
                  The brief your agent follows. Edit if you want a different tone or scope.
                </Text>
              </Box>

              <Box>
                <Text as="div" size="2" weight="medium" mb="2">Model</Text>
                <SelectField
                  value={model}
                  onChange={onModel}
                  options={MODEL_OPTIONS}
                />
              </Box>

              <Box>
                <Flex align="center" justify="between" gap="2" mb="2">
                  <Text as="span" size="2" weight="medium">Creativity</Text>
                  <Text size="1" color="gray">
                    {creativity.toFixed(1)} · {creativityLabel}
                  </Text>
                </Flex>
                <Slider
                  value={[creativity]}
                  onValueChange={vs => onCreativity(vs[0] ?? 0.5)}
                  min={0}
                  max={1}
                  step={0.1}
                />
                <Text as="div" size="1" color="gray" mt="2">
                  Higher = more creative answers. Lower = more deterministic and predictable.
                </Text>
              </Box>

              <Box>
                <Flex align="center" justify="between" gap="2" mb="2">
                  <Text as="span" size="2" weight="medium">Response length limit</Text>
                  <Text size="1" color="gray">{maxTokens.toLocaleString('en-US')} tokens</Text>
                </Flex>
                <Slider
                  value={[maxTokens]}
                  onValueChange={vs => onMaxTokens(vs[0] ?? 2048)}
                  min={256}
                  max={8192}
                  step={256}
                />
                <Text as="div" size="1" color="gray" mt="2">
                  Caps how long each AI reply can be. Larger = more thorough but slower and more expensive.
                </Text>
              </Box>
            </Flex>
          </Box>
        </details>

        {hireError && (
          <Banner tone="warn" title="Couldn't hire agent">
            {hireError}
          </Banner>
        )}
      </Flex>

      <Flex justify="between" mt="4" gap="2" wrap="wrap">
        <Button variant="ghost" color="gray" onClick={onBack} disabled={busy}>
          <IconArrowLeft className="ic ic--sm" /> Back
        </Button>
        <Button size="3" onClick={onHire} disabled={busy}>
          {busy ? 'Hiring…' : <>Hire {name.trim() || template.defaultName}</>}
        </Button>
      </Flex>
    </>
  )
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Flex align="start" justify="between" gap="3" py="2" style={{ borderTop: '1px dashed var(--gray-a3)' }}>
      <Text size="1" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '0.12em', minWidth: 130 }}>{label}</Text>
      <Box style={{ flex: '1 1 auto', minWidth: 0, textAlign: 'right' }}>{value}</Box>
    </Flex>
  )
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <Flex align="start" gap="3">
      <Box style={{ color: 'var(--accent-9)', paddingTop: 3 }}>
        <IconCheck size={14} />
      </Box>
      <Box flexGrow="1" style={{ minWidth: 0 }}>
        <Text size="2" style={{ lineHeight: 1.55 }}>{children}</Text>
      </Box>
    </Flex>
  )
}

// Plain-English explanation of why a template needs a given app prefix. Used
// on the preview screen — derives from the most-relevant grant for that app
// in the entire template catalog. Keeps the wizard's preview screen honest
// without forcing every template to write its own per-app explanation.
function appReason(prefix: string): string {
  const REASONS: Record<string, string> = {
    apollo: 'enrich lead profiles before reaching out',
    zoho_crm: 'read contact records and update deal pipeline',
    email: 'send messages on your behalf',
    web_search: 'pull public information from the web',
    slack: 'post status updates and messages',
    memory: 'remember context between sessions',
    kb: 'look things up in your knowledge base',
    quickbooks: 'pull invoice and revenue data',
    stripe: 'read charges and prepare refunds',
    okta: 'read user accounts and provision new ones',
    aws: 'revoke unused access',
    irs: 'verify business identity numbers',
  }
  return REASONS[prefix] ?? 'used by this agent'
}
