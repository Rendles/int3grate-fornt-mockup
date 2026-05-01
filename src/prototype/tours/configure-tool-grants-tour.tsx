import type { Tour } from './types'
import { CONFIGURE_TOOL_GRANTS_IDS } from './training-fixtures'

const agentId = CONFIGURE_TOOL_GRANTS_IDS.agentId

export const configureToolGrantsTour: Tour = {
  id: 'configure-tool-grants',
  name: 'Set agent permissions',
  steps: [
    {
      id: 'open-permissions',
      target: '[data-tour="agent-tab-grants"]',
      placement: 'bottom',
      navigateTo: `/agents/${agentId}`,
      title: 'Where you set what an agent can do',
      body:
        'Each agent has its own list of permissions — which apps and actions it can use. Open the Permissions tab to manage them.',
    },
    {
      id: 'summary',
      target: '[data-tour="grants-summary"]',
      placement: 'bottom',
      navigateTo: `/agents/${agentId}/grants`,
      title: 'What is already permitted',
      body:
        'This row shows how many permissions are set and how many require your approval before the agent can act.',
    },
    {
      id: 'mode',
      target: '[data-tour="grants-mode"]',
      placement: 'left',
      title: 'Pick the access level',
      body:
        'Read is safest. Ask lets the agent write but waits for your approval each time. Auto lets it write without asking — use sparingly.',
    },
    {
      id: 'write-warning',
      target: '[data-tour="grants-write-warning"]',
      placement: 'top',
      title: 'Heads up: write without approval',
      body:
        'When a permission lets the agent write without asking, this warning shows up. Switch to Read & write (with approval) if you want a human to confirm every write.',
    },
    {
      id: 'save',
      target: '[data-tour="grants-save"]',
      placement: 'left',
      title: 'Save',
      body:
        'This replaces the agent’s full permission set. After saving, the agent uses the new permissions on its next action.',
    },
  ],
}
