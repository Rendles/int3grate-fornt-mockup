// Hook that runs the production hire chain for a starter template:
//   createAgent → createVersion → setGrants → activateVersion
// And optionally one extra step for the welcome-chat onboarding flow:
//   createChat with a seed assistant greeting.
//
// Exposed as a hook so the QuickHireGrid component (used inside /agents
// empty-state and the /sandbox/quick-hire screen) and the
// /sandbox/welcome-chat screen share the exact same chain — no duplication
// drift between them.

import { useState } from 'react'

import { useAuth } from '../auth'
import { api } from './api'
import type { AssistantTemplate } from './templates'

export interface HireResult {
  agentId: string
  // Populated only when `withSeedChat: true` was passed AND the chat
  // creation succeeded. Falsy means the caller should land on a draft chat.
  chatId?: string
}

export interface HireOptions {
  // When true, after the agent is active also create a chat seeded with
  // `template.welcomeMessage`. Failure to create the chat is non-fatal —
  // the agent stays hired, and the result simply has no chatId.
  withSeedChat?: boolean
}

export function useHireTemplate() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hire = async (
    template: AssistantTemplate,
    options: HireOptions = {},
  ): Promise<HireResult> => {
    if (busy) throw new Error('hire already in progress')
    setBusy(true)
    setError(null)
    try {
      const agent = await api.createAgent({
        name: template.defaultName,
        description: template.shortPitch,
        domain_id: user?.domain_id ?? null,
      })
      const v = await api.createAgentVersion(agent.id, {
        instruction_spec: template.defaultInstructions,
        model_chain_config: { primary: template.defaultModel ?? 'claude-haiku-4-5' },
        approval_rules: {},
        memory_scope_config: {},
        tool_scope_config: { inherits_from_agent: true },
      })
      if (template.defaultGrants.length > 0) {
        await api.setGrants(agent.id, { grants: template.defaultGrants })
      }
      await api.activateVersion(agent.id, v.id)

      let chatId: string | undefined
      if (options.withSeedChat && user && template.welcomeMessage) {
        try {
          const chat = await api.createChat(
            {
              agent_version_id: v.id,
              seed_assistant_message: template.welcomeMessage,
            },
            user,
          )
          chatId = chat.id
        } catch {
          // Agent is already active; just no greeting. Caller falls back
          // to /agents/:id/talk (draft mode).
        }
      }

      // Caller is expected to navigate immediately, but reset busy in case
      // they don't (or the navigate is async).
      setBusy(false)
      return { agentId: agent.id, chatId }
    } catch (e) {
      const message = (e as Error).message ?? 'Could not hire agent'
      setError(message)
      setBusy(false)
      throw e
    }
  }

  const clearError = () => setError(null)

  return { hire, busy, error, clearError }
}
