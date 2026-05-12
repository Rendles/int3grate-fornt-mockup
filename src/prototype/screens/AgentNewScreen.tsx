import { useEffect, useRef, useState } from 'react'
import { Box, Button, DropdownMenu, Flex, Grid, Heading, Slider, Spinner, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Avatar, Caption, PageHeader } from '../components/common'
import { SelectField, TextAreaField, TextInput } from '../components/fields'
import { Banner, NoAccessState } from '../components/states'
import {
  IconAgent,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChat,
  IconHome,
} from '../components/icons'
import { GrantsForm, type GrantDraft } from '../components/grants-editor'
import { useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent, Workspace } from '../lib/types'
import {
  FEATURED_TEMPLATES,
  NON_FEATURED_TEMPLATES,
  getTemplate,
  type AssistantTemplate,
} from '../lib/templates'

type Phase = 'welcome' | 'name' | 'apps' | 'review' | 'success'
type WizardPhase = Extract<Phase, 'name' | 'apps' | 'review'>

const MODEL_OPTIONS = [
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7 — heavy reasoning' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced default' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fast & cheap' },
]
const DEFAULT_MODEL = 'claude-haiku-4-5'

export default function AgentNewScreen() {
  const { navigate } = useRouter()
  const {
    user,
    activeWorkspaceId,
    myWorkspaces,
  } = useAuth()

  const isMember = user?.role === 'member'

  const [phase, setPhase] = useState<Phase>('welcome')
  const [template, setTemplate] = useState<AssistantTemplate | null>(null)
  const [name, setName] = useState('')
  // pickedGrants is the live draft the wizard collects across steps. Initialised
  // from the chosen template's defaultGrants on pickTemplate; the user can
  // tweak per-tool levels and add/remove rows in step 2 ("Allow access").
  // Flushed via api.setGrants on Hire (after createAgent + activateVersion).
  const [pickedGrants, setPickedGrants] = useState<GrantDraft[]>([])
  const [showAllRoles, setShowAllRoles] = useState(false)

  // Advanced settings (initialised when template is picked).
  const [instructions, setInstructions] = useState('')
  const [model, setModel] = useState<string>(DEFAULT_MODEL)
  const [creativity, setCreativity] = useState<number>(0.5)
  const [maxTokens, setMaxTokens] = useState<number>(2048)

  // Local target workspace for THIS hire only — independent from the
  // global active workspace (see docs/plans/workspaces-redesign-spec.md
  // § 5). Initialised from activeWorkspaceId on mount; the user can
  // override per-hire via the [Change] dropdown in the wizard header
  // without touching global state. We don't follow activeWorkspaceId
  // after the user has picked, but we DO adopt it once if it was null
  // at mount time (workspace list still loading).
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(activeWorkspaceId)
  const targetAdoptedRef = useRef<boolean>(activeWorkspaceId !== null)
  useEffect(() => {
    if (!targetAdoptedRef.current && activeWorkspaceId) {
      targetAdoptedRef.current = true
      setTargetWorkspaceId(activeWorkspaceId)
    }
  }, [activeWorkspaceId])

  // Hire flow state.
  const [busy, setBusy] = useState(false)
  const [hireError, setHireError] = useState<string | null>(null)
  const [hiredAgent, setHiredAgent] = useState<Agent | null>(null)
  // Workspace the freshly hired agent landed in — captured during hire
  // and used on the success page. Always equals the user's target
  // selection at hire time (no auto-create surprises).
  const [hiredWorkspace, setHiredWorkspace] = useState<Workspace | null>(null)

  // Optional `?template=<id>` deep-link — used by the welcome-chat
  // "Modify before hire" button. When present, skip the welcome phase and
  // land directly on phase='name' with the template pre-filled. Inlined
  // here (rather than calling `pickTemplate`) so the hook stays above
  // the member-guard early return — Rules of Hooks.
  useEffect(() => {
    const hash = window.location.hash
    const queryStart = hash.indexOf('?')
    if (queryStart < 0) return
    const params = new URLSearchParams(hash.slice(queryStart + 1))
    const templateId = params.get('template')
    if (!templateId) return
    const t = getTemplate(templateId)
    if (!t) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setTemplate(t)
    setName(t.defaultName)
    setInstructions(t.defaultInstructions)
    setModel(t.defaultModel ?? DEFAULT_MODEL)
    setPickedGrants(t.defaultGrants.map(g => ({
      tool_name: g.tool_name,
      mode: g.mode,
      approval_required: g.approval_required,
    })))
    setPhase('name')
    /* eslint-enable react-hooks/set-state-in-effect */
    // Run once on mount.
  }, [])

  if (isMember) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'hire' }]}>
        <div className="page page--narrow">
          <PageHeader eyebrow="HIRE AN AGENT" title={<>Admins only</>} />
          <NoAccessState
            requiredRole="Team Admin or Workspace Admin"
            body="Only admins can hire new agents."
          />
          <Flex justify="center" mt="3">
            <Button asChild variant="ghost"><a href="#/agents">Back to agents</a></Button>
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
    // Pre-fill grants from the template's curated defaults. Custom template
    // ships with an empty defaultGrants — in that case the editor opens empty
    // and the user picks tools manually from the catalog.
    setPickedGrants(t.defaultGrants.map(g => ({
      tool_name: g.tool_name,
      mode: g.mode,
      approval_required: g.approval_required,
    })))
    setHireError(null)
    setPhase('name')
  }

  const goBackToWelcome = () => {
    setTemplate(null)
    setPhase('welcome')
  }

  const goToApps = () => setPhase('apps')
  const goToReview = () => setPhase('review')

  const hire = async () => {
    if (!template || !name.trim() || !user || !targetWorkspaceId) return
    setBusy(true)
    setHireError(null)
    try {
      // Target workspace is the user's explicit local choice from the
      // wizard header (defaults to active workspace, can be overridden
      // via [Change]). No template-driven auto-create branch — the
      // user always sees and controls where the new agent lands.
      const targetWorkspace = await api.getWorkspace(targetWorkspaceId)
      if (!targetWorkspace) {
        throw new Error('Pick a workspace before hiring — open the workspace switcher in the sidebar.')
      }

      const agent = await api.createAgent({
        name: name.trim(),
        description: template.shortPitch,
        domain_id: user.domain_id ?? null,
      })
      // Override createAgent's auto-pin (which uses the global active
      // workspace) with our explicit local target. Always called so the
      // post-hire promise is consistent.
      await api.setAgentWorkspace(agent.id, targetWorkspace.id)
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
      // Backend-confirmed flow (2026-05-02): createAgent → createVersion →
      // setGrants → activateVersion. Always end on activation — there's no
      // valid intermediate state, and there's no API path to re-enter setup
      // for a draft agent without a usable backend list-versions endpoint.
      if (pickedGrants.length > 0) {
        await api.setGrants(agent.id, { grants: pickedGrants })
      }
      await api.activateVersion(agent.id, v.id)
      // Re-fetch so the success page sees the post-activation status
      // (active_version populated, status flipped to 'active').
      const fresh = await api.getAgent(agent.id)
      setHiredAgent(fresh ?? agent)
      setHiredWorkspace(targetWorkspace)
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
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'hire' }]}>
        <div className="page page--narrow">
          <Flex justify="end" mt="2">
            <HiringIntoHeader
              targetWorkspaceId={targetWorkspaceId}
              onPick={setTargetWorkspaceId}
              myWorkspaces={myWorkspaces}
            />
          </Flex>
          <Flex
            direction="column"
            align="center"
            gap="3"
            mb="6"
            mt="4"
            style={{ textAlign: 'center' }}
            data-tour="hire-welcome-intro"
          >
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

          <Grid columns={{ initial: '1', sm: '2' }} gap="3" data-tour="hire-featured-roles">
            {FEATURED_TEMPLATES.map((t, index) => (
              <RoleCard
                key={t.id}
                template={t}
                onPick={pickTemplate}
                prominent
                dataTour={index === 0 ? 'hire-featured-role-card' : undefined}
              />
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
              <Button
                variant="ghost"
                onClick={() => setShowAllRoles(true)}
                data-tour="hire-see-all-roles"
              >
                See all roles
              </Button>
            )}
            <Button asChild variant="ghost" color="gray">
              <a href="#/agents" data-tour="hire-skip-explore">Skip and explore</a>
            </Button>
          </Flex>
        </div>
      </AppShell>
    )
  }

  // ─────────────────────────────────────── PREVIEW phase
  // ─────────────────────────────────────── WIZARD STEPS
  if (template && (phase === 'name' || phase === 'apps' || phase === 'review')) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'hire' }, { label: template.defaultName }]}>
        <div className="page page--narrow">
          <Flex direction="column" gap="3" mb="5">
            <Flex align="center" justify="between" wrap="wrap" gap="3">
              <StepProgress phase={phase} />
              <Flex align="center" gap="3" wrap="wrap">
                <HiringIntoHeader
                  targetWorkspaceId={targetWorkspaceId}
                  onPick={setTargetWorkspaceId}
                  myWorkspaces={myWorkspaces}
                />
                <Button asChild variant="ghost" color="gray" size="1">
                  <a href="#/agents">Cancel</a>
                </Button>
              </Flex>
            </Flex>
            <Heading size="8" weight="regular" className="page__title">
              {phase === 'name' && <>Name your <em>agent.</em></>}
              {phase === 'apps' && <>Allow <em>access.</em></>}
              {phase === 'review' && <>Review and <em>hire.</em></>}
            </Heading>
            <Text size="2" color="gray">
              {phase === 'name' && 'You can rename later.'}
              {phase === 'apps' && `Choose which apps ${template.defaultName} can use. You can change this on the agent's Permissions tab later.`}
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
            <>
              <GrantsForm grants={pickedGrants} onChange={setPickedGrants} />
              <Flex justify="between" mt="4" gap="2" wrap="wrap">
                <Button variant="ghost" color="gray" onClick={() => setPhase('name')}>
                  <IconArrowLeft className="ic ic--sm" /> Back
                </Button>
                <Button size="3" onClick={goToReview}>
                  Continue
                  <IconArrowRight className="ic ic--sm" />
                </Button>
              </Flex>
            </>
          )}

          {phase === 'review' && (
            <ReviewStep
              template={template}
              name={name}
              pickedGrants={pickedGrants}
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
              targetWorkspaceId={targetWorkspaceId}
              myWorkspaces={myWorkspaces}
            />
          )}
        </div>
      </AppShell>
    )
  }

  // ─────────────────────────────────────── SUCCESS phase
  if (phase === 'success' && hiredAgent && template) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: hiredAgent.name }]}>
        <div className="page page--narrow">
          <Flex direction="column" align="center" gap="3" mt="6" style={{ textAlign: 'center' }}>
            <Box style={{
              width: 56, height: 56, borderRadius: 999,
              background: 'var(--jade-a3)', color: 'var(--jade-11)',
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
                {hiredWorkspace && (
                  <BulletItem>
                    {hiredAgent.name} is now in your <strong>{hiredWorkspace.name}</strong> workspace.
                    {hiredWorkspace.id !== activeWorkspaceId && (
                      <> Switch to it from the sidebar at any time.</>
                    )}
                  </BulletItem>
                )}
                <BulletItem>
                  {hiredAgent.name} has {pickedGrants.length} {pickedGrants.length === 1 ? 'permission' : 'permissions'} ready to use.
                </BulletItem>
                <BulletItem>
                  When it wants to do something that needs your approval, you'll see it on the Approvals page.
                </BulletItem>
                <BulletItem>
                  You can talk to {hiredAgent.name} any time from the Agents page.
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
  dataTour,
}: {
  template: AssistantTemplate
  onPick: (t: AssistantTemplate) => void
  prominent: boolean
  dataTour?: string
}) {
  return (
    <button
      className="role-card"
      data-tour={dataTour}
      onClick={() => onPick(template)}
      style={{
        textAlign: 'left',
        padding: prominent ? 20 : 14,
        borderRadius: 14,
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
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

function StepProgress({ phase }: { phase: WizardPhase }) {
  const steps: WizardPhase[] = ['name', 'apps', 'review']
  const labels: Record<WizardPhase, string> = {
    name: 'Name',
    apps: 'Access',
    review: 'Review',
  }
  const activeIndex = steps.indexOf(phase)
  return (
    <Flex align="center" gap="2" wrap="wrap">
      {steps.map((s, i) => {
        const done = i < activeIndex
        const active = i === activeIndex
        const color = active ? 'var(--accent-11)' : done ? 'var(--jade-11)' : 'var(--gray-10)'
        return (
          <Flex key={s} align="center" gap="2">
            <Box
              style={{
                width: 22, height: 22, borderRadius: 999,
                border: `1px solid ${active ? 'var(--accent-a7)' : done ? 'var(--jade-a7)' : 'var(--gray-a5)'}`,
                background: done ? 'var(--jade-a3)' : active ? 'var(--accent-a3)' : 'transparent',
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

function grantsBreakdown(grants: GrantDraft[]) {
  let read = 0
  let writeAuto = 0
  let writeApproval = 0
  for (const g of grants) {
    if (g.mode === 'read') read++
    else if (g.approval_required) writeApproval++
    else writeAuto++
  }
  return { read, writeAuto, writeApproval }
}

function ReviewStep({
  template,
  name,
  pickedGrants,
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
  targetWorkspaceId,
  myWorkspaces,
}: {
  template: AssistantTemplate
  name: string
  pickedGrants: GrantDraft[]
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
  targetWorkspaceId: string | null
  myWorkspaces: Workspace[]
}) {
  const b = grantsBreakdown(pickedGrants)
  // Target workspace is the user's explicit pick from the wizard
  // header. No template-driven auto-create — what the user sees here
  // is exactly where the hire will land.
  const targetWorkspace = targetWorkspaceId
    ? myWorkspaces.find(w => w.id === targetWorkspaceId) ?? null
    : null
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
              <SummaryRow
                label="Workspace"
                value={
                  <Text size="2" weight="medium">
                    {targetWorkspace?.name ?? '—'}
                  </Text>
                }
              />
              <SummaryRow
                label="Permissions"
                value={
                  pickedGrants.length === 0 ? (
                    <Text size="2" color="gray">none</Text>
                  ) : (
                    <Flex direction="column" gap="1" align="end">
                      <Text size="2" weight="medium">
                        {pickedGrants.length} {pickedGrants.length === 1 ? 'permission' : 'permissions'}
                      </Text>
                      {b.read > 0 && (
                        <Text size="1" color="gray">{b.read} read-only</Text>
                      )}
                      {b.writeApproval > 0 && (
                        <Text size="1" color="gray">{b.writeApproval} write (with approval)</Text>
                      )}
                      {b.writeAuto > 0 && (
                        <Text size="1" color="gray">{b.writeAuto} write (auto)</Text>
                      )}
                    </Flex>
                  )
                }
              />
            </Flex>
          </Box>
        </div>

        {pickedGrants.length === 0 && (
          <Banner tone="info" title="No permissions picked">
            {name || template.defaultName} will be hired without any app permissions. You can allow access from its Permissions tab any time.
          </Banner>
        )}

        <div className="card">
          <Box p="4">
            <Text as="div" size="2" weight="medium" mb="2">
              Brief: what {name.trim() || template.defaultName} should do
            </Text>
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
        </div>

        <details className="card advanced-toggle" style={{ padding: '14px 18px' }}>
          <summary className="advanced-toggle__summary">
            <Flex align="center" justify="between" gap="3">
              <Text as="span" size="2" weight="medium">Advanced settings</Text>
              <Flex align="center" justify="end" gap="2" wrap="wrap">
                <Text as="span" size="1" color="gray">model, creativity, response length</Text>
                <IconArrowRight className="advanced-toggle__chevron ic ic--sm" />
              </Flex>
            </Flex>
          </summary>
          <Box mt="4">
            <Flex direction="column" gap="4">
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

        {!targetWorkspace && (
          <Banner tone="warn" title="Pick a workspace first">
            Open the workspace switcher in the sidebar, or create one on the <a href="#/workspaces">workspaces page</a>.
          </Banner>
        )}
      </Flex>

      <Flex justify="between" mt="4" gap="2" wrap="wrap">
        <Button variant="ghost" color="gray" onClick={onBack} disabled={busy}>
          <IconArrowLeft className="ic ic--sm" /> Back
        </Button>
        <Button size="3" onClick={onHire} disabled={busy || !targetWorkspace}>
          {busy ? (
            <>
              <Spinner size="1" />
              Hiring…
            </>
          ) : (
            <>Hire <span className="cta-name">{name.trim() || template.defaultName}</span></>
          )}
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

// Small wizard-header strip that names the workspace this hire will
// land in and lets the user override per-hire without touching global
// state. Hidden when myWorkspaces.length <= 1 — nothing to change.
function HiringIntoHeader({
  targetWorkspaceId,
  onPick,
  myWorkspaces,
}: {
  targetWorkspaceId: string | null
  onPick: (id: string) => void
  myWorkspaces: Workspace[]
}) {
  const target = targetWorkspaceId
    ? myWorkspaces.find(w => w.id === targetWorkspaceId) ?? null
    : null
  const canChange = myWorkspaces.length > 1

  if (!canChange) {
    if (myWorkspaces.length === 0) return null
    return (
      <Flex align="center" gap="2">
        <Text size="1" color="gray">Hiring into:</Text>
        <Text size="2" weight="medium">{target?.name ?? myWorkspaces[0].name}</Text>
      </Flex>
    )
  }

  return (
    <Flex align="center" gap="2" wrap="wrap">
      <Text size="1" color="gray">Hiring into:</Text>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Button variant="ghost" size="1" color="gray">
            <Text size="2" weight="medium">{target?.name ?? 'Pick a workspace'}</Text>
            <DropdownMenu.TriggerIcon />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content variant="soft" sideOffset={4}>
          <DropdownMenu.Label>Pick a workspace</DropdownMenu.Label>
          {myWorkspaces.map(ws => {
            const isPicked = ws.id === targetWorkspaceId
            return (
              <DropdownMenu.Item
                key={ws.id}
                onSelect={() => { if (!isPicked) onPick(ws.id) }}
              >
                <Flex align="center" gap="2" width="100%">
                  <Text as="span" size="2" className="truncate" style={{ flexGrow: 1 }}>
                    {ws.name}
                  </Text>
                  {isPicked && <IconCheck size={12} />}
                </Flex>
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
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

