// Hook that runs the production hire chain for a starter template:
//   resolveWorkspace → createAgent → setAgentWorkspace → createVersion →
//   setGrants → activateVersion
// And optionally one extra step for the welcome-chat onboarding flow:
//   createChat with a seed assistant greeting.
//
// Exposed as a hook so the QuickHireGrid component (used inside /agents
// empty-state) and the welcome-chat flow share the exact same chain —
// no duplication drift between them.
//
// One-click hire: target is always the user's current active workspace.
// Callers that need explicit workspace override (the full /agents/new
// wizard) reach for the api directly. See docs/plans/workspaces-redesign-
// spec.md § 5 for the rationale.

import { useState } from 'react'

import { useAuth } from '../auth'
import { api } from './api'
import type { AssistantTemplate } from './templates'
import type { Workspace } from './types'

export interface HireResult {
  agentId: string
  // Populated only when `withSeedChat: true` was passed AND the chat
  // creation succeeded. Falsy means the caller should land on a draft chat.
  chatId?: string
  // The workspace the new agent ended up in. Always equals the user's
  // active workspace at hire time.
  workspace: Workspace
}

export interface HireOptions {
  // When true, after the agent is active also create a chat seeded with
  // `template.welcomeMessage`. Failure to create the chat is non-fatal —
  // the agent stays hired, and the result simply has no chatId.
  withSeedChat?: boolean
}

export function useHireTemplate() {
  const { user, activeWorkspaceId } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hire = async (
    template: AssistantTemplate,
    options: HireOptions = {},
  ): Promise<HireResult> => {
    if (busy) throw new Error('hire already in progress')
    if (!user) throw new Error('Must be signed in to hire')
    setBusy(true)
    setError(null)
    try {
      // Step 1 — resolve target workspace. One-click hire always lands
      // in the user's current active workspace. No template-driven
      // auto-create branch — quick-hire surfaces don't have UI to pick
      // a different target; users who want to choose go through the
      // full /agents/new wizard.
      if (!activeWorkspaceId) {
        throw new Error(
          'Pick a workspace before hiring — open the workspace switcher in the sidebar.',
        )
      }
      const targetWorkspace = await api.getWorkspace(activeWorkspaceId)
      if (!targetWorkspace) {
        throw new Error('Active workspace is no longer available.')
      }

      // Step 2 — create the agent. createAgent auto-pins to the current
      // workspace; we still call setAgentWorkspace explicitly below so
      // the contract stays "after hire, agent is in result.workspace".
      const agent = await api.createAgent({
        name: template.defaultName,
        description: template.shortPitch,
        domain_id: user.domain_id ?? null,
      })

      // Step 3 — explicitly set the agent's workspace.
      await api.setAgentWorkspace(agent.id, targetWorkspace.id)

      // Step 4-6 — version + grants + activation.
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

      // Step 7 — optional welcome chat (mock-only seed message — see
      // docs/backend-gaps.md § 1.12).
      let chatId: string | undefined
      if (options.withSeedChat && template.welcomeMessage) {
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
      return {
        agentId: agent.id,
        chatId,
        workspace: targetWorkspace,
      }
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
