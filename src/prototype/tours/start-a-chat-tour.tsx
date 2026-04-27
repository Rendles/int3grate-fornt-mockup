import type { Tour } from './types'

export const startAChatTour: Tour = {
  id: 'start-a-chat',
  name: 'Start a chat',
  steps: [
    {
      id: 'agent-picker',
      target: '[data-tour="chat-agent-picker"]',
      placement: 'bottom',
      navigateTo: '/chats/new',
      title: 'Pick an agent',
      body:
        'Choose the agent you want to talk to. Active agents can start a chat; paused agents are shown as context but cannot open a new conversation.',
    },
    {
      id: 'agent-version',
      target: '[data-tour="chat-agent-version"]',
      placement: 'left',
      title: 'Bound to one version',
      body:
        'Every chat is attached to one active agent version. That keeps the instructions, tools, and model behavior stable for the whole conversation.',
    },
    {
      id: 'title',
      target: '[data-tour="chat-title"]',
      placement: 'left',
      title: 'Give it a title',
      body:
        'The title is optional. It helps you find the conversation later in the chat list, especially when you have many chats with the same agent.',
    },
    {
      id: 'model',
      target: '[data-tour="chat-model"]',
      placement: 'left',
      title: 'Choose the model',
      body:
        "The model starts from the agent version's primary model. Once the chat opens, the model is fixed; open a new chat if you need to switch.",
    },
    {
      id: 'submit',
      target: '[data-tour="chat-submit"]',
      placement: 'left',
      title: 'Open the chat',
      body:
        'This button creates the chat and redirects to the conversation screen. In Training mode, the created chat is sandboxed and will not touch real data.',
    },
  ],
}
