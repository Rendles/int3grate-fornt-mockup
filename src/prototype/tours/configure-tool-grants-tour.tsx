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
        'Read-only is safest. Read & write lets the agent change things. Read & write (with approval) makes the agent ask before each write.',
    },
    {
      id: 'catalog',
      target: '[data-tour="grants-catalog"]',
      placement: 'top',
      title: 'Add a new permission',
      body:
        'Pick an app from the catalog. Already-permitted apps are hidden so you don’t add duplicates.',
    },
    {
      id: 'add',
      target: '[data-tour="grants-add"]',
      placement: 'top',
      title: 'Confirm',
      body:
        'This adds the permission to the list. It is not saved yet — you can change the access level before saving.',
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
