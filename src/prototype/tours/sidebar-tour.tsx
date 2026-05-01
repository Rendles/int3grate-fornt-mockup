import type { Tour } from './types'

export const sidebarTour: Tour = {
  id: 'sidebar-overview',
  name: 'Sidebar overview',
  steps: [
    {
      id: 'brand',
      target: '[data-tour="sb-brand"]',
      placement: 'right',
      title: 'Welcome to Int3grate',
      body: 'Quick tour of your control panel. Use ← / → to step, Esc to leave.',
    },
    {
      id: 'home',
      target: '[data-tour="nav-home"]',
      placement: 'right',
      title: 'Your home',
      body: 'Approvals waiting for you, recent activity, and your agents at a glance — your daily starting point.',
    },
    {
      id: 'approvals',
      target: '[data-tour="nav-approvals"]',
      placement: 'right',
      title: 'Approvals queue',
      body: 'When an agent action needs human sign-off, it lands here. The amber badge shows how many are waiting.',
    },
    {
      id: 'activity',
      target: '[data-tour="nav-activity"]',
      placement: 'right',
      title: 'Activity',
      body: 'Live ribbon of what your agents did. Open it to see recent actions, sentence by sentence.',
    },
    {
      id: 'team',
      target: '[data-tour="nav-assistants"]',
      placement: 'right',
      title: 'Team',
      body: 'Hire, train, and monitor your agents here. Each agent has its own setup, app permissions, and approval rules.',
    },
    {
      id: 'costs',
      target: '[data-tour="nav-costs"]',
      placement: 'right',
      title: 'Costs',
      body: 'What your agents are spending. See the trend, top spenders, and break it down by agent.',
    },
    {
      id: 'footer',
      target: '[data-tour="sb-footer"]',
      placement: 'right',
      title: 'Your profile',
      body: 'Role, approval level, and sign-out — all live here. That’s the whole tour, you’re ready.',
    },
  ],
}
