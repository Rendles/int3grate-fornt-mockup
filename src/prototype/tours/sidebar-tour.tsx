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
      body: 'Quick tour of your control panel — under a minute. Use ← / → to step, Esc to leave.',
    },
    {
      id: 'dashboard',
      target: '[data-tour="nav-home"]',
      placement: 'right',
      title: 'Your home',
      body: 'Approvals waiting for you, recent activity, and your agents at a glance — your daily starting point.',
    },
    {
      id: 'agents',
      target: '[data-tour="nav-assistants"]',
      placement: 'right',
      title: 'Team',
      body: 'Hire, train, and monitor your agents here. Each agent has its own setup, app permissions, and approval rules.',
    },
    {
      id: 'approvals',
      target: '[data-tour="nav-approvals"]',
      placement: 'right',
      title: 'Approvals queue',
      body: 'When an agent action needs human sign-off, it lands here. The amber badge shows how many are waiting.',
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
