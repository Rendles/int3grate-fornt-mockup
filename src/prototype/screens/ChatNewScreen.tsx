import { useEffect, useState } from 'react'
import { Badge, Box, Button, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader, Status } from '../components/common'
import { LoadingList } from '../components/states'
import { IconArrowRight } from '../components/icons'
import { useRouter } from '../router'
import { api } from '../lib/api'
import type { Agent } from '../lib/types'

/**
 * Agent picker for the global "Start a chat" entry on HomeScreen — used when
 * the user has not chosen an agent yet. Picking an agent navigates to
 * `/agents/:id/talk`, where the chat is composed and lazily created on first
 * send (see ChatPanel's draft mode).
 *
 * Deep-links of the form `#/chats/new?agent=<id>` (legacy) bypass the picker
 * and redirect straight to the agent's draft-chat tab.
 */
export default function ChatNewScreen() {
  const { navigate, search } = useRouter()
  const presetAgentId = search.get('agent')

  const [agents, setAgents] = useState<Agent[] | null>(null)

  useEffect(() => {
    if (presetAgentId) {
      navigate(`/agents/${presetAgentId}/talk`, { replace: true })
      return
    }
    api.listAgents().then(res => setAgents(res.items))
  }, [presetAgentId, navigate])

  // While the redirect is firing, render nothing extra to avoid a flash.
  if (presetAgentId) return null

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'team', to: '/agents' }, { label: 'new chat' }]}>
      <div className="page page--narrow">
        <PageHeader
          eyebrow="NEW CHAT"
          title={<>Pick an <em>agent.</em></>}
          subtitle="Choose who you want to chat with. The conversation starts when you send your first message."
          actions={
            <Button asChild variant="soft" color="gray">
              <a href="#/agents">Cancel</a>
            </Button>
          }
        />

        {!agents ? (
          <LoadingList rows={4} />
        ) : (
          <div className="card">
            <div className="card__body">
              <Flex direction="column" gap="2">
                {agents
                  .filter(a => a.status !== 'archived')
                  .map(a => {
                    const runnable = a.status === 'active' && !!a.active_version
                    return (
                      <button
                        key={a.id}
                        className="login__role"
                        disabled={!runnable}
                        style={{
                          textAlign: 'left',
                          padding: 12,
                          background: 'var(--gray-3)',
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto 24px',
                          gap: 14,
                          alignItems: 'center',
                          opacity: runnable ? 1 : 0.6,
                          cursor: runnable ? 'pointer' : 'not-allowed',
                        }}
                        onClick={() => {
                          if (runnable) navigate(`/agents/${a.id}/talk`)
                        }}
                      >
                        <Box minWidth="0">
                          <Text as="div" size="2" weight="medium">{a.name}</Text>
                          {a.description && (
                            <Text as="div" size="1" color="gray" mt="1" className="truncate">{a.description}</Text>
                          )}
                        </Box>
                        <Flex align="center" gap="2">
                          <Status status={a.status} />
                          {!runnable && a.status === 'active' && (
                            <Badge color="amber" variant="soft" radius="full" size="1">no setup</Badge>
                          )}
                        </Flex>
                        <IconArrowRight className="ic" />
                      </button>
                    )
                  })}
              </Flex>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
