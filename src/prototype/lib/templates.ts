// Agent templates — used by the wizard at /agents/new (Phase 7).
//
// A template is a starting kit for hiring an agent. It pre-fills:
//   - The default name shown in step 1.
//   - The instruction brief used to create v1.
//   - The permissions (tool grants) the worker needs to do its job.
//   - The list of apps the user can allow for the agent in step 2,
//     derived from the unique tool prefixes in `defaultGrants`.
//   - The plain-English approval list shown in the preview screen.
//
// Templates point at tool keys from the existing catalog (`api.listTools`).
// When the template gallery grows, edit this file — it's the single source
// of truth for the wizard.

import type { ToolGrantMode } from './types'

export type TemplateGrant = {
  tool_name: string
  mode: ToolGrantMode
  approval_required: boolean
}

export interface AssistantTemplate {
  id: string
  // Default display name for the worker. Editable in step 1.
  defaultName: string
  // One-line summary shown on the welcome card.
  shortPitch: string
  // Paragraph shown on the template preview screen.
  longPitch: string
  // Default instruction brief for v1. The user can edit it in step 3 → Advanced.
  defaultInstructions: string
  // Default permissions (granted when the worker is hired).
  defaultGrants: TemplateGrant[]
  // Plain-English bullets for the preview screen — what the user has to
  // confirm. Doesn't have to map 1:1 to grants; it's user-facing copy.
  approvalCopy: string[]
  // Optional model override. Defaults to claude-haiku-4-5 if absent.
  defaultModel?: string
  // Whether the template appears in the top-4 welcome cards. The remaining
  // ones live behind "See all roles".
  featured: boolean
  // Used as the avatar's two-letter initials when no other icon is available.
  initials: string
  // First message the agent sends after a hire from the welcome-chat
  // onboarding flow. Business-tone, 1-2 sentences, ends in a question.
  // Stored client-side and seeded into the chat via mock-only
  // CreateChatRequest.seed_assistant_message — see docs/backend-gaps.md.
  welcomeMessage: string
  // Workspace this template belongs to by default. Resolved at hire time:
  // if a workspace with this name exists, the new agent is assigned there;
  // otherwise the workspace is auto-created (the user is added as a member,
  // their current scope is NOT switched). `null` = no preset, the user picks
  // their target workspace at hire time (Custom template).
  defaultWorkspaceName: string | null
}

export const TEMPLATES: AssistantTemplate[] = [
  {
    id: 'sales',
    defaultName: 'Sales Agent',
    shortPitch: 'Finds leads, sends intros, follows up.',
    longPitch:
      'Helps you grow your customer base without manual outreach. Watches your CRM for new leads, drafts personalised intro emails, and nudges follow-ups when prospects go quiet.',
    defaultInstructions: `You are a Sales Agent for a small business.

Your job:
- Watch the CRM for new inbound leads and qualify them.
- Draft short, personal intro emails — match the lead's tone.
- Follow up after 3 business days if they don't reply.
- Always wait for human approval before sending external emails.

You never make up information. If you don't know something about a prospect, ask the user.`,
    defaultGrants: [
      { tool_name: 'apollo.enrich_contact', mode: 'read', approval_required: false },
      { tool_name: 'zoho_crm.read_contact', mode: 'read', approval_required: false },
      { tool_name: 'zoho_crm.write_deal', mode: 'read_write', approval_required: true },
      { tool_name: 'email.send', mode: 'read_write', approval_required: true },
      { tool_name: 'web_search', mode: 'read', approval_required: false },
    ],
    approvalCopy: [
      'Sending external emails',
      'Adding contacts to nurture campaigns in your CRM',
    ],
    featured: true,
    initials: 'SA',
    welcomeMessage:
      "Hi — I'm your Sales Agent. I can scan your CRM for new leads, draft personalised intros for your approval, and follow up on prospects that go quiet. Want me to start with this week's inbound?",
    defaultWorkspaceName: 'Sales',
  },
  {
    id: 'marketing',
    defaultName: 'Marketing Agent',
    shortPitch: 'Drafts campaigns, schedules posts, watches signal.',
    longPitch:
      'Drafts weekly campaigns, schedules social posts, and summarises performance. Useful when you want a steady marketing cadence without hiring a dedicated marketer.',
    defaultInstructions: `You are a Marketing Agent for a small business.

Your job:
- Draft weekly newsletter copy in the brand tone the user has set.
- Schedule social posts and announce major product news.
- Monitor mentions and surface anything worth a human reply.
- Always wait for human approval before publishing anything externally.`,
    defaultGrants: [
      { tool_name: 'slack.post_message', mode: 'read_write', approval_required: true },
      { tool_name: 'web_search', mode: 'read', approval_required: false },
      { tool_name: 'kb.lookup', mode: 'read', approval_required: false },
    ],
    approvalCopy: [
      'Posting to Slack channels',
      'Publishing newsletter copy or social content',
    ],
    featured: true,
    initials: 'MA',
    welcomeMessage:
      "Hi — I'm your Marketing Agent. I can draft this week's newsletter in your brand voice, schedule social posts, and surface mentions worth a reply. Want me to put together a draft for review?",
    defaultWorkspaceName: 'Marketing',
  },
  {
    id: 'reports',
    defaultName: 'Reports Analyst',
    shortPitch: 'Pulls dashboards, summarises numbers, flags anomalies.',
    longPitch:
      'Pulls weekly numbers from QuickBooks and your knowledge base, summarises them in human language, and flags anything that looks off relative to last period.',
    defaultInstructions: `You are a Reports Analyst for a small business.

Your job:
- Pull weekly revenue, cost, and key product numbers from connected systems.
- Summarise them in plain language with the previous-period comparison.
- Flag anomalies (sudden drops, unexpected spikes) without panicking the user.
- You only read data. You never write or post anywhere.`,
    defaultGrants: [
      { tool_name: 'quickbooks.read_invoice', mode: 'read', approval_required: false },
      { tool_name: 'web_search', mode: 'read', approval_required: false },
      { tool_name: 'kb.lookup', mode: 'read', approval_required: false },
    ],
    approvalCopy: [
      'Read-only — no approvals required day-to-day.',
    ],
    featured: true,
    initials: 'RA',
    welcomeMessage:
      "Hi — I'm your Reports Analyst. I read your numbers and summarise them in plain language, with comparisons to last period and anything that looks off. Want me to pull this week's snapshot?",
    defaultWorkspaceName: 'Reports',
  },
  {
    id: 'support',
    defaultName: 'Customer Support',
    shortPitch: 'Answers FAQs, escalates the rest.',
    longPitch:
      'Reads the customer\'s history and your knowledge base to answer common questions. Drafts replies; escalates anything tricky or sensitive to you for approval.',
    defaultInstructions: `You are a Customer Support Agent for a small business.

Your job:
- Read the customer's prior conversation and CRM record before replying.
- Look up answers in the knowledge base before guessing.
- Draft reply emails in a friendly, concise tone — never pretend to be human.
- Always wait for human approval before sending any reply that touches refunds, discounts, or complaints.`,
    defaultGrants: [
      { tool_name: 'kb.lookup', mode: 'read', approval_required: false },
      { tool_name: 'zoho_crm.read_contact', mode: 'read', approval_required: false },
      { tool_name: 'email.send', mode: 'read_write', approval_required: true },
      { tool_name: 'slack.post_message', mode: 'read_write', approval_required: true },
    ],
    approvalCopy: [
      'Sending reply emails to customers',
      'Posting status updates in shared Slack channels',
    ],
    featured: true,
    initials: 'CS',
    welcomeMessage:
      "Hi — I'm your Customer Support agent. I can read a customer's history, look up answers in your knowledge base, and draft replies for your approval. Want me to take a look at the open tickets?",
    defaultWorkspaceName: 'Customer Support',
  },
  {
    id: 'finance',
    defaultName: 'Finance Helper',
    shortPitch: 'Reconciles invoices, prepares refunds, flags exceptions.',
    longPitch:
      'Pulls invoices from QuickBooks, reconciles charges in Stripe, and prepares refund requests for your approval. Catches duplicate charges and flags suspicious patterns.',
    defaultInstructions: `You are a Finance Helper for a small business.

Your job:
- Reconcile this week's Stripe charges against QuickBooks invoices.
- Surface any duplicates, missed entries, or refund-eligible cases.
- Prepare refunds for the user's approval — never issue refunds on your own.
- Always wait for human approval before any money movement.`,
    defaultGrants: [
      { tool_name: 'stripe.read_charge', mode: 'read', approval_required: false },
      { tool_name: 'stripe.refund', mode: 'read_write', approval_required: true },
      { tool_name: 'quickbooks.read_invoice', mode: 'read', approval_required: false },
      { tool_name: 'email.send', mode: 'read_write', approval_required: true },
    ],
    approvalCopy: [
      'Issuing Stripe refunds',
      'Sending finance-related emails to customers',
    ],
    featured: false,
    initials: 'FH',
    welcomeMessage:
      "Hi — I'm your Finance Helper. I reconcile Stripe charges against QuickBooks, flag duplicates and refund-eligible cases, and prepare refunds for your approval — never on my own. Should I run this week's reconciliation?",
    defaultWorkspaceName: 'Finance',
  },
  {
    id: 'operations',
    defaultName: 'Operations Helper',
    shortPitch: 'Handles user provisioning, access changes, app hygiene.',
    longPitch:
      'Onboards and offboards team members across Okta and AWS, posts status updates in Slack, and chases stale access. Useful when you don\'t have a dedicated IT admin.',
    defaultInstructions: `You are an Operations Helper for a small business.

Your job:
- Provision and de-provision user accounts in Okta and AWS on request.
- Post a Slack message confirming each access change.
- Watch for stale access (users who left but still have entitlements).
- Always wait for human approval before creating, modifying, or revoking any access.`,
    defaultGrants: [
      { tool_name: 'okta.read_user', mode: 'read', approval_required: false },
      { tool_name: 'okta.create_user', mode: 'read_write', approval_required: true },
      { tool_name: 'slack.post_message', mode: 'read_write', approval_required: true },
    ],
    approvalCopy: [
      'Creating user accounts in Okta',
      'Revoking AWS access',
      'Posting access-change notifications in Slack',
    ],
    featured: false,
    initials: 'OH',
    welcomeMessage:
      "Hi — I'm your Operations Helper. I handle Okta and AWS access changes for new joiners and leavers, post Slack updates, and watch for stale entitlements. Want me to check who's still around but shouldn't be?",
    defaultWorkspaceName: 'Operations',
  },
  {
    id: 'custom',
    defaultName: 'Custom Agent',
    shortPitch: 'Start from scratch and train everything yourself.',
    longPitch:
      'A blank agent. You\'ll write the instructions, pick the apps, and decide what needs your approval. Best for needs that don\'t match a template.',
    defaultInstructions: 'You are a custom agent. Describe what you want it to do here.',
    defaultGrants: [],
    approvalCopy: [
      'Up to you — set approval rules in Advanced settings.',
    ],
    featured: false,
    initials: 'CW',
    welcomeMessage: '',
    defaultWorkspaceName: null,
  },
]

export function getTemplate(id: string): AssistantTemplate | undefined {
  return TEMPLATES.find(t => t.id === id)
}

export const FEATURED_TEMPLATES = TEMPLATES.filter(t => t.featured)
export const NON_FEATURED_TEMPLATES = TEMPLATES.filter(t => !t.featured)
