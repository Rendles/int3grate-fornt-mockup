import type { Tour } from './types'

export const hireAnAgentTour: Tour = {
  id: 'hire-an-agent',
  name: 'Hire an agent',
  steps: [
    {
      id: 'welcome',
      target: '[data-tour="hire-welcome-intro"]',
      placement: 'bottom',
      navigateTo: '/agents/new',
      title: 'Hire from a role',
      body:
        'This screen helps you add a new agent to your team. Start with the kind of help you need first.',
    },
    {
      id: 'featured-roles',
      target: '[data-tour="hire-featured-roles"]',
      placement: 'bottom',
      title: 'Start with a ready role',
      body:
        'These roles are useful starting points. Choose the one closest to the work you want the agent to help with.',
    },
    {
      id: 'role-card',
      target: '[data-tour="hire-featured-role-card"]',
      placement: 'bottom',
      title: 'Read the role card',
      body:
        'Each card shows the agent name and the work it is prepared for. Choosing one opens a preview before anything is hired.',
    },
    {
      id: 'more-roles',
      target: '[data-tour="hire-see-all-roles"]',
      placement: 'top',
      title: 'See more choices',
      body:
        'If the first choices do not fit, you can open more roles. You can still rename and train the agent later.',
    },
    {
      id: 'safe-exit',
      target: '[data-tour="hire-skip-explore"]',
      placement: 'top',
      title: 'You stay in control',
      body:
        'You can leave this screen without hiring anyone. When you are ready, come back and choose a role.',
    },
  ],
}
