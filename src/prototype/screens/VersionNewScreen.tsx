import { useEffect, useState } from 'react'
import { Box, Button, Flex, Grid, Separator, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader, InfoHint } from '../components/common'
import { SelectField, TextAreaField, TextInput } from '../components/fields'
import { Banner, LoadingList, NoAccessState } from '../components/states'
import { useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent } from '../lib/types'

const MODELS = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5']

const STARTER_PROMPT = `You are {AGENT_NAME}.

Primary objective:
— (what the agent should accomplish)

Hard rules:
— Never take actions that require approval without an explicit ApprovalRequest being granted.
— When the user's request is ambiguous, ask for clarification before using tools.

Tone: direct, operator-friendly, concise.
`

export default function VersionNewScreen({ agentId }: { agentId: string }) {
  const { navigate } = useRouter()
  const { user } = useAuth()
  const canEdit = !!user && (user.role === 'admin' || user.role === 'domain_admin')

  const [agent, setAgent] = useState<Agent | null | undefined>(undefined)
  const [instruction, setInstruction] = useState('')
  const [primary, setPrimary] = useState(MODELS[1])
  const [maxTokens, setMaxTokens] = useState(4096)
  const [temperature, setTemperature] = useState(0.3)
  const [activateImmediately, setActivateImmediately] = useState(true)

  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    api.getAgent(agentId).then(a => {
      setAgent(a ?? null)
      if (a?.active_version?.instruction_spec) {
        setInstruction(a.active_version.instruction_spec)
        const mc = a.active_version.model_chain_config as { primary?: string; max_tokens?: number; temperature?: number }
        if (mc.primary) setPrimary(mc.primary)
        if (typeof mc.max_tokens === 'number') setMaxTokens(mc.max_tokens)
        if (typeof mc.temperature === 'number') setTemperature(mc.temperature)
      } else if (a) {
        setInstruction(STARTER_PROMPT.replace('{AGENT_NAME}', a.name))
      }
    })
  }, [agentId])

  if (!canEdit) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'team', to: '/agents' }, { label: agent?.name ?? '…', to: `/agents/${agentId}` }, { label: 'new version' }]}>
        <div className="page page--narrow">
          <PageHeader eyebrow="NEW SETUP" title={<>Admins only</>} />
          <NoAccessState
            requiredRole="Team Admin or Workspace Admin"
            body="Only admins can create a new setup for an agent."
          />
        </div>
      </AppShell>
    )
  }

  if (agent === undefined) {
    return <AppShell crumbs={[{ label: '...', to: '/' }]}><div className="page"><LoadingList rows={4} /></div></AppShell>
  }
  if (agent === null) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'team', to: '/agents' }, { label: 'not found' }]}>
        <div className="page">
          <NoAccessState requiredRole="access to this agent" body="The agent you're looking for could not be loaded. It may have been removed or the link is incorrect." />
        </div>
      </AppShell>
    )
  }

  const instructionError = !instruction.trim() ? 'Required' : instruction.trim().length < 1 ? 'Required' : undefined
  const showInstructionErr = submitted && instructionError

  const submit = async () => {
    setSubmitted(true)
    if (instructionError) return
    setBusy(true)
    setSaveError(null)
    try {
      const v = await api.createAgentVersion(agent.id, {
        instruction_spec: instruction.trim(),
        model_chain_config: {
          primary,
          fallbacks: [],
          max_tokens: maxTokens,
          temperature,
        },
        memory_scope_config: {},
        tool_scope_config: {},
        approval_rules: {},
      })
      if (activateImmediately) {
        await api.activateVersion(agent.id, v.id)
      }
      navigate(`/agents/${agent.id}`)
    } catch (e) {
      setSaveError((e as Error).message ?? 'Failed to create version')
    } finally {
      setBusy(false)
    }
  }

  const nextVer = (agent.active_version?.version ?? 0) + 1

  return (
    <AppShell
      crumbs={[
        { label: 'home', to: '/' },
        { label: 'team', to: '/agents' },
        { label: agent.name, to: `/agents/${agent.id}` },
        { label: 'new version' },
      ]}
    >
      <div className="page page--narrow">
        <PageHeader
          eyebrow={
            <>
              NEW SETUP{' '}
              <InfoHint>
                If you check "activate immediately", the new setup replaces the current one. Otherwise it stays as a draft until you activate it.
              </InfoHint>
            </>
          }
          title={<>New <em>setup</em> <Text as="span" size="7" color="gray" ml="2">v{nextVer}</Text></>}
          subtitle={agent.active_version
            ? `Forking from v${agent.active_version.version}. Changes below produce a new immutable setup.`
            : 'This is the first setup for this agent.'}
          actions={
            <>
              <Button asChild variant="soft" color="gray" disabled={busy}><a href={`#/agents/${agent.id}`}>Cancel</a></Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? 'creating…' : activateImmediately ? `Create & activate v${nextVer}` : `Create v${nextVer}`}
              </Button>
            </>
          }
        />

        {saveError && (
          <Banner
            tone="warn"
            title="Couldn't create version"
            action={<Button variant="ghost" onClick={() => setSaveError(null)}>Dismiss</Button>}
          >
            {saveError}
          </Banner>
        )}

        <div className="card">
          <div className="card__head">
            <Text as="div" size="2" weight="medium" className="card__title">instruction_spec <Text as="span" color="red">*</Text></Text>
          </div>
          <div className="card__body">
            <TextAreaField
              style={{
                minHeight: 260,
                lineHeight: 1.5,
              }}
              size="2"
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              error={showInstructionErr ? instructionError : undefined}
            />
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">model_chain_config</Text></div>
          <div className="card__body">
            <Grid columns={{ initial: '1', md: '240px 1fr' }} gap="5" py="5">
              <Box>
                <Text as="div" size="2" weight="medium">Primary model</Text>
                <Text as="div" size="1" color="gray" mt="1">Model the agent uses by default.</Text>
              </Box>
              <Box>
                <SelectField
                  value={primary}
                  onChange={setPrimary}
                  options={MODELS.map(m => ({ value: m }))}
                />
              </Box>
            </Grid>
            <Separator size="4" />
            <Grid columns={{ initial: '1', md: '240px 1fr' }} gap="5" py="5">
              <Box>
                <Text as="div" size="2" weight="medium">max_tokens</Text>
                <Text as="div" size="1" color="gray" mt="1">Output budget.</Text>
              </Box>
              <Box>
                <TextInput
                  type="number"
                  value={maxTokens}
                  min={64}
                  max={32000}
                  onChange={e => setMaxTokens(Number(e.target.value))}
                />
              </Box>
            </Grid>
            <Separator size="4" />
            <Grid columns={{ initial: '1', md: '240px 1fr' }} gap="5" py="5">
              <Box>
                <Text as="div" size="2" weight="medium">temperature</Text>
                <Text as="div" size="1" color="gray" mt="1">0 = deterministic, 1 = exploratory.</Text>
              </Box>
              <Box>
                <TextInput
                  type="number"
                  step={0.1}
                  min={0}
                  max={1}
                  value={temperature}
                  onChange={e => setTemperature(Number(e.target.value))}
                />
              </Box>
            </Grid>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="card">
          <div className="card__body">
            <Flex asChild align="center" gap="3" style={{ cursor: 'pointer' }}>
              <label>
                <input
                  type="checkbox"
                  checked={activateImmediately}
                  onChange={e => setActivateImmediately(e.target.checked)}
                />
                <Box>
                  <Text as="div" size="2">Activate immediately after create</Text>
                  <Text as="div" size="1" color="gray" mt="1">
                    Set this version as the active one right after it's created.
                  </Text>
                </Box>
              </label>
            </Flex>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
