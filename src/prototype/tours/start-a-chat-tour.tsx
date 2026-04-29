import type { Tour } from './types'
import { START_A_CHAT_IDS } from './training-fixtures'

const agentId = START_A_CHAT_IDS.activeAgentId

export const startAChatTour: Tour = {
  id: 'start-a-chat',
  name: 'Start a chat',
  steps: [
    {
      id: 'team-page',
      target: '[data-tour="nav-assistants"]',
      placement: 'right',
      navigateTo: '/agents',
      title: 'Find your team',
      body:
        'Your agents live here. Open this page any time you want to talk to one of them.',
    },
    {
      id: 'agent-card',
      target: '[data-tour="team-agent-card"]',
      placement: 'bottom',
      title: 'Pick an active agent',
      body:
        'Active agents are ready to talk. Paused agents need to be unpaused first. Click into the agent you want to start a conversation with.',
    },
    {
      id: 'agent-detail',
      target: '[data-tour="agent-talk-cta"]',
      placement: 'bottom',
      navigateTo: `/agents/${agentId}`,
      title: 'Open the conversation',
      body:
        'Tap Talk to to start chatting. Conversations live inside the agent — that way each agent has its own history with you.',
    },
    {
      id: 'talk-content',
      target: '[data-tour="agent-talk-tab-content"]',
      placement: 'bottom',
      navigateTo: `/agents/${agentId}/talk`,
      title: 'Your chats with this agent',
      body:
        'Past conversations show below. Open one to keep talking, or click New chat to start fresh.',
    },
    {
      id: 'wrap-up',
      target: '[data-tour="agent-talk-tab-content"]',
      placement: 'bottom',
      title: 'You’re set',
      body:
        'Replies stream in real time. The conversation is private to you and the agent — open a new chat any time you want a fresh thread.',
    },
  ],
}
