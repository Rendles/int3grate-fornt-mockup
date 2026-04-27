import type { Tour } from './types'
import { CONFIGURE_TOOL_GRANTS_IDS } from './training-fixtures'

export const configureToolGrantsTour: Tour = {
  id: 'configure-tool-grants',
  name: 'Configure tool grants',
  steps: [
    {
      id: 'catalog',
      target: '[data-tour="grants-catalog"]',
      placement: 'top',
      navigateTo: `/agents/${CONFIGURE_TOOL_GRANTS_IDS.agentId}/grants`,
      title: 'Pick a tool',
      body:
        'Use the catalog to add another tool grant. The training table already has one demo row, so you can see how a saved grant looks while you explore.',
    },
    {
      id: 'add',
      target: '[data-tour="grants-add"]',
      placement: 'top',
      title: 'Add the grant',
      body:
        'After you pick a tool, this button adds a new grant row. In Training mode, this only changes the sandbox data for the tour.',
    },
    {
      id: 'tool',
      target: '[data-tour="grants-tool-cell"]',
      placement: 'left',
      title: 'Read the granted tool',
      body:
        'Each row starts with the tool name. This tells you exactly which service or capability the agent can call.',
    },
    {
      id: 'scope',
      target: '[data-tour="grants-scope-type"]',
      placement: 'left',
      title: 'Set the scope',
      body:
        'Scope controls where the grant applies. Agent scope is the narrowest option; domain and tenant scopes are broader.',
    },
    {
      id: 'mode',
      target: '[data-tour="grants-mode"]',
      placement: 'left',
      title: 'Choose access level',
      body:
        'Access level decides what the agent can do with this tool. Read is safest, write can change data, and read and write allows both.',
    },
    {
      id: 'approval',
      target: '[data-tour="grants-policy"]',
      placement: 'left',
      title: 'Require approval',
      body:
        'Use approval for actions that should pause for a human decision. This is the human-in-the-loop safety switch for risky tool use.',
    },
    {
      id: 'save',
      target: '[data-tour="grants-save"]',
      placement: 'left',
      title: 'Save grants',
      body:
        'Save replaces the full grants list for this agent. During this tour, the save updates only the training sandbox and does not touch real data.',
    },
  ],
}
