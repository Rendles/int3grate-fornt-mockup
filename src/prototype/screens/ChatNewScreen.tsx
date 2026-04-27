import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Code, Flex, Grid, Separator, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader, InfoHint, Status } from '../components/common'
import { SelectField, TextInput } from '../components/fields'
import { Banner, LoadingList } from '../components/states'
import { IconAlert, IconChat } from '../components/icons'
import { useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import type { Agent } from '../lib/types'

const MODELS = [
  { value: 'claude-opus-4-7', label: 'claude-opus-4-7 — heavy reasoning' },
  { value: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6 — balanced default' },
  { value: 'claude-haiku-4-5', label: 'claude-haiku-4-5 — fast / cheap' },
]

export default function ChatNewScreen() {
  const { navigate, search } = useRouter()
  const { user } = useAuth()

  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [agentId, setAgentId] = useState<string>(search.get('agent') ?? '')
  const [model, setModel] = useState<string>('')
  const [title, setTitle] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api.listAgents().then(res => {
      const list = res.items
      setAgents(list)
      if (!agentId && list.length) {
        setAgentId(list.find(a => a.status === 'active')?.id ?? list[0].id)
      }
    })
  }, [agentId])

  const agent = useMemo(() => agents?.find(a => a.id === agentId) ?? null, [agents, agentId])
  const version = agent?.active_version ?? null
  const runnable = agent?.status === 'active' && !!version

  // Default the model dropdown to the version's primary model when version changes.
  useEffect(() => {
    if (!version) return
    const primary = (version.model_chain_config as { primary?: string })?.primary
    if (primary) setModel(primary)
  }, [version])

  const submit = async () => {
    setSubmitted(true)
    if (!agentId || !version || !user || !runnable) return
    setBusy(true)
    setErr(null)
    try {
      const chat = await api.createChat(
        {
          agent_version_id: version.id,
          model: model || undefined,
          title: title.trim() || undefined,
        },
        user,
      )
      navigate(`/chats/${chat.id}`)
    } catch (e) {
      setErr((e as Error).message ?? 'Could not start chat')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'chats', to: '/chats' }, { label: 'new' }]}>
      <div className="page page--narrow">
        <PageHeader
          eyebrow={
            <>
              NEW CHAT{' '}
              <InfoHint>
                Creates a chat via <Code variant="ghost">POST /chat</Code>. Bound to one <Code variant="ghost">agent_version_id</Code> + <Code variant="ghost">model</Code> for its lifetime — to switch models, open a new chat.
              </InfoHint>
            </>
          }
          title={<>Start a <em>chat.</em></>}
          subtitle="Pick an agent, optionally pick the model. The model is fixed once the chat opens."
          actions={
            <>
              <Button asChild variant="soft" disabled={busy} color='gray'><a href="#/chats">Cancel</a></Button>
              <Button onClick={submit} disabled={busy || !runnable}>
                <IconChat />
                {busy ? 'opening…' : 'Open chat'}
              </Button>
            </>
          }
        />

        {err && (
          <Banner tone="warn" title="Couldn't start chat" action={<Button variant="ghost" onClick={() => setErr(null)}>Dismiss</Button>}>
            {err}
          </Banner>
        )}

        {!agents ? (
          <LoadingList rows={4} />
        ) : (
          <>
            {/* AGENT PICKER */}
            <div className="card">
              <div className="card__head">
                <Text as="div" size="2" weight="medium" className="card__title">Agent</Text>
                {agent && !runnable && (
                  <Badge color="amber" variant="soft" radius="full" size="1">
                    {agent.status !== 'active' ? `${agent.status} · can't chat` : 'no active version'}
                  </Badge>
                )}
              </div>
              <div className="card__body">
                <Flex direction="column" gap="2">
                  {agents.filter(a => a.status !== 'archived').map(a => {
                    const on = a.id === agentId
                    return (
                      <button
                        key={a.id}
                        className="login__role"
                        style={{
                          textAlign: 'left',
                          padding: 12,
                          borderColor: on ? 'var(--accent-a7)' : undefined,
                          background: on ? 'var(--accent-a3)' : 'var(--gray-3)',
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) 100px',
                          gap: 14,
                          alignItems: 'center',
                          opacity: a.status === 'paused' ? 0.75 : 1,
                        }}
                        onClick={() => setAgentId(a.id)}
                      >
                        <div style={{ minWidth: 0, textAlign: 'left' }}>
                          <Text as="div" size="2">{a.name}</Text>
                          {a.description && (
                            <Text as="div" size="1" color="gray" mt="1" className="truncate">{a.description}</Text>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Status status={a.status} />
                          {a.active_version && (
                            <Text as="div" size="1" color="gray" mt="1">v{a.active_version.version}</Text>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </Flex>
                {submitted && !agentId && (
                  <Text as="div" size="1" color="red" mt="2">
                    <Flex align="center" gap="2">
                      <IconAlert className="ic ic--sm" /> Pick an agent
                    </Flex>
                  </Text>
                )}
              </div>
            </div>

            <div style={{ height: 16 }} />

            <div className="card">
              <div className="card__body">
                <Grid columns={{ initial: '1', md: '240px 1fr' }} gap="5" py="5">
                  <Box>
                    <Text as="div" size="2" weight="medium">Title</Text>
                    <Text as="div" size="1" color="gray" mt="1">Optional. Shown in the chat list.</Text>
                  </Box>
                  <Box>
                    <TextInput
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder={agent ? `Conversation with ${agent.name}` : 'Quick question'}
                    />
                  </Box>
                </Grid>
                <Separator size="4" />
                <Grid columns={{ initial: '1', md: '240px 1fr' }} gap="5" py="5">
                  <Box>
                    <Text as="div" size="2" weight="medium">Model</Text>
                    <Text as="div" size="1" color="gray" mt="1">
                      Defaults to the agent version's primary model. Fixed once the chat opens.
                    </Text>
                  </Box>
                  <Box>
                    <SelectField
                      value={model || undefined}
                      onChange={setModel}
                      options={MODELS}
                      placeholder="Use agent default"
                    />
                  </Box>
                </Grid>
              </div>
            </div>

            <div style={{ height: 16 }} />
            <Banner tone="info" title="Chats can't be reopened">
              Once closed, a chat is read-only — open a new chat to keep talking. Messages stay around for audit.
            </Banner>
          </>
        )}
      </div>
    </AppShell>
  )
}
