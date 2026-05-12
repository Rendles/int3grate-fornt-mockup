import type {
  Agent,
  AgentVersion,
  ApprovalRequest,
  Chat,
  RunDetail,
  ToolGrant,
  User,
} from '../lib/types'

/**
 * One scenario's worth of fixtures, keyed by entity. Active scenarios
 * fully replace the real fixture arrays at the API read boundary —
 * reads return whatever lives here, mutations write to a sandbox tied
 * to the scenario session (see lib/api.ts).
 *
 * Per-scenario contents are documented in docs/plans/tours.md
 * "Training mode" → "Per-scenario fixture sets".
 */
export interface TrainingScenario {
  id: string
  agents: Agent[]
  users: User[]
  chats: Chat[]
  approvals: ApprovalRequest[]
  runs: RunDetail[]
  grantsByAgent?: Record<string, ToolGrant[]>
}

// ─────────────────────────────────────────────── approval-review scenario
//
// Stable IDs so the tour data can write a literal `navigateTo:
// '/approvals/${APPROVAL_REVIEW_APPROVAL_ID}'` rather than resolving at
// runtime. Standalone run (task_id = null) keeps the screen simple — no
// task panel to wire up.

const APPROVAL_REVIEW_APPROVAL_ID = 'apv_train_001'
const APPROVAL_REVIEW_RUN_ID = 'run_train_001'
const APPROVAL_REVIEW_AGENT_ID = 'agt_train_001'
const APPROVAL_REVIEW_VERSION_ID = 'ver_train_001'
const APPROVAL_REVIEW_USER_ID = 'usr_train_001'

const NINE_MIN_AGO = '2026-04-27T09:51:00Z'

const approvalReviewVersion: AgentVersion = {
  id: APPROVAL_REVIEW_VERSION_ID,
  agent_id: APPROVAL_REVIEW_AGENT_ID,
  version: 3,
  instruction_spec:
    'You are a Refunds Concierge. Verify charges, apply refund policy, escalate amounts above $200 to a human approver.',
  memory_scope_config: {
    user_facts: true,
    session_only: false,
    domain_shared: false,
    retention_days: 30,
  },
  tool_scope_config: { inherits_from_agent: true, overrides: [], denylist: [] },
  approval_rules: { rules: [{ id: 'rule_train_1', when: 'stripe.refund > 200', required_approver_level: 3 }] },
  model_chain_config: { primary: 'claude-sonnet-4-6' },
  is_active: true,
  created_by: APPROVAL_REVIEW_USER_ID,
  created_at: '2026-04-01T10:00:00Z',
}

export const APPROVAL_REVIEW: TrainingScenario = {
  id: 'approval-review',
  users: [
    {
      id: APPROVAL_REVIEW_USER_ID,
      tenant_id: 'ten_acme',
      domain_id: 'ws_ops',
      email: 'training@example.com',
      name: 'You (training)',
      role: 'admin',
      approval_level: 4,
      created_at: '2025-01-01T00:00:00Z',
    },
  ],
  agents: [
    {
      id: APPROVAL_REVIEW_AGENT_ID,
      tenant_id: 'ten_acme',
      domain_id: 'ws_ops',
      owner_user_id: APPROVAL_REVIEW_USER_ID,
      name: 'Refunds Concierge',
      description: 'Handles customer refund requests through Stripe.',
      status: 'active',
      created_at: '2026-04-01T10:00:00Z',
      updated_at: NINE_MIN_AGO,
      active_version: approvalReviewVersion,
      total_spend_usd: null,
      runs_count: null,
    },
  ],
  approvals: [
    {
      id: APPROVAL_REVIEW_APPROVAL_ID,
      run_id: APPROVAL_REVIEW_RUN_ID,
      task_id: null,
      tenant_id: 'ten_acme',
      requested_action: 'stripe.refund · $412 on charge ch_3P8fL2 (order #44021)',
      requested_by: APPROVAL_REVIEW_USER_ID,
      requested_by_name: 'agent · Refunds Concierge',
      approver_role: 'domain_admin',
      approver_user_id: null,
      status: 'pending',
      reason: null,
      evidence_ref: {
        charge_id: 'ch_3P8fL2',
        order_id: '#44021',
        amount_usd: 412,
        reason: 'Customer-reported duplicate charge',
        customer: 'Eliza Voss',
      },
      expires_at: '2026-04-27T20:00:00Z',
      resolved_at: null,
      created_at: NINE_MIN_AGO,
    },
  ],
  runs: [
    {
      id: APPROVAL_REVIEW_RUN_ID,
      tenant_id: 'ten_acme',
      domain_id: 'ws_ops',
      task_id: null,
      agent_version_id: APPROVAL_REVIEW_VERSION_ID,
      status: 'suspended',
      suspended_stage: 'approval_gate · stripe.refund',
      started_at: NINE_MIN_AGO,
      ended_at: null,
      total_cost_usd: 0.18,
      total_tokens_in: 3420,
      total_tokens_out: 810,
      error_kind: 'none',
      error_message: null,
      tool_errors: [],
      created_at: NINE_MIN_AGO,
      steps: [
        {
          id: 'stp_train_1',
          step_type: 'llm_call',
          status: 'ok',
          model_name: 'claude-sonnet-4-6',
          tool_name: null,
          duration_ms: 820,
          tokens_in: 620,
          tokens_out: 140,
          cost_usd: 0.04,
          input_ref: { prompt: 'Process refund SR-2204 ($412, Eliza Voss)' },
          output_ref: { plan: 'verify → policy → approval → notify' },
          created_at: NINE_MIN_AGO,
          completed_at: NINE_MIN_AGO,
        },
        {
          id: 'stp_train_2',
          step_type: 'tool_call',
          status: 'ok',
          model_name: null,
          tool_name: 'stripe.read_charge',
          duration_ms: 310,
          tokens_in: null,
          tokens_out: null,
          cost_usd: 0,
          input_ref: { charge_id: 'ch_3P8fL2' },
          output_ref: { status: 'succeeded', amount_usd: 412 },
          created_at: NINE_MIN_AGO,
          completed_at: NINE_MIN_AGO,
        },
        {
          id: 'stp_train_3',
          step_type: 'approval_gate',
          status: 'pending',
          model_name: null,
          tool_name: null,
          duration_ms: null,
          tokens_in: null,
          tokens_out: null,
          cost_usd: null,
          input_ref: { approval_id: APPROVAL_REVIEW_APPROVAL_ID },
          output_ref: null,
          created_at: NINE_MIN_AGO,
          completed_at: null,
        },
      ],
    },
  ],
  chats: [],
}

// ─────────────────────────────────────────────── start-a-chat scenario

const START_CHAT_ACTIVE_AGENT_ID = 'agt_train_chat_active'
const START_CHAT_PAUSED_AGENT_ID = 'agt_train_chat_paused'
const START_CHAT_ACTIVE_VERSION_ID = 'ver_train_chat_active'
const START_CHAT_PAUSED_VERSION_ID = 'ver_train_chat_paused'
const START_CHAT_USER_ID = 'usr_train_chat'

const START_CHAT_CREATED_AT = '2026-04-20T10:00:00Z'
const START_CHAT_UPDATED_AT = '2026-04-27T10:05:00Z'

const startChatActiveVersion: AgentVersion = {
  id: START_CHAT_ACTIVE_VERSION_ID,
  agent_id: START_CHAT_ACTIVE_AGENT_ID,
  version: 5,
  instruction_spec:
    'You are a Support Concierge. Answer account questions, summarize context, and escalate sensitive actions to approvals.',
  memory_scope_config: {
    user_facts: true,
    session_only: false,
    domain_shared: true,
    retention_days: 45,
  },
  tool_scope_config: { inherits_from_agent: true, overrides: [], denylist: [] },
  approval_rules: { rules: [{ id: 'rule_chat_train_1', when: 'billing.credit_adjustment', required_approver_level: 3 }] },
  model_chain_config: { primary: 'claude-sonnet-4-6' },
  is_active: true,
  created_by: START_CHAT_USER_ID,
  created_at: START_CHAT_CREATED_AT,
}

const startChatPausedVersion: AgentVersion = {
  id: START_CHAT_PAUSED_VERSION_ID,
  agent_id: START_CHAT_PAUSED_AGENT_ID,
  version: 2,
  instruction_spec:
    'You are a Billing Auditor. Review invoice anomalies and prepare summaries for finance reviewers.',
  memory_scope_config: {
    user_facts: false,
    session_only: true,
    domain_shared: false,
    retention_days: 7,
  },
  tool_scope_config: { inherits_from_agent: true, overrides: [], denylist: [] },
  approval_rules: { rules: [] },
  model_chain_config: { primary: 'claude-haiku-4-5' },
  is_active: true,
  created_by: START_CHAT_USER_ID,
  created_at: START_CHAT_CREATED_AT,
}

export const START_A_CHAT: TrainingScenario = {
  id: 'start-a-chat',
  users: [
    {
      id: START_CHAT_USER_ID,
      tenant_id: 'ten_acme',
      domain_id: 'ws_ops',
      email: 'training-chat@example.com',
      name: 'You (training)',
      role: 'member',
      approval_level: 1,
      created_at: '2025-01-01T00:00:00Z',
    },
  ],
  agents: [
    {
      id: START_CHAT_ACTIVE_AGENT_ID,
      tenant_id: 'ten_acme',
      domain_id: 'ws_ops',
      owner_user_id: START_CHAT_USER_ID,
      name: 'Support Concierge',
      description: 'Answers customer questions with account context.',
      status: 'active',
      created_at: START_CHAT_CREATED_AT,
      updated_at: START_CHAT_UPDATED_AT,
      active_version: startChatActiveVersion,
      total_spend_usd: null,
      runs_count: null,
    },
    {
      id: START_CHAT_PAUSED_AGENT_ID,
      tenant_id: 'ten_acme',
      domain_id: 'dom_finance',
      owner_user_id: START_CHAT_USER_ID,
      name: 'Billing Auditor',
      description: 'Paused for policy review, so it cannot start new chats.',
      status: 'paused',
      created_at: START_CHAT_CREATED_AT,
      updated_at: START_CHAT_UPDATED_AT,
      active_version: startChatPausedVersion,
      total_spend_usd: null,
      runs_count: null,
    },
  ],
  approvals: [],
  runs: [],
  chats: [],
}

// configure-tool-grants scenario

const CONFIGURE_GRANTS_AGENT_ID = 'agt_train_grants'
const CONFIGURE_GRANTS_VERSION_ID = 'ver_train_grants'
const CONFIGURE_GRANTS_USER_ID = 'usr_train_grants'
const CONFIGURE_GRANTS_GRANT_ID = 'grt_train_grants_001'

const CONFIGURE_GRANTS_CREATED_AT = '2026-04-18T10:00:00Z'
const CONFIGURE_GRANTS_UPDATED_AT = '2026-04-27T10:10:00Z'

const configureGrantsVersion: AgentVersion = {
  id: CONFIGURE_GRANTS_VERSION_ID,
  agent_id: CONFIGURE_GRANTS_AGENT_ID,
  version: 1,
  instruction_spec:
    'You are an Operations Concierge. Help operators inspect accounts and draft safe actions, but only use tools explicitly granted to this agent.',
  memory_scope_config: {
    user_facts: false,
    session_only: true,
    domain_shared: false,
    retention_days: 14,
  },
  tool_scope_config: { inherits_from_agent: true, overrides: [], denylist: [] },
  approval_rules: { rules: [{ id: 'rule_grants_train_1', when: 'write tool calls', required_approver_level: 3 }] },
  model_chain_config: { primary: 'claude-sonnet-4-6' },
  is_active: true,
  created_by: CONFIGURE_GRANTS_USER_ID,
  created_at: CONFIGURE_GRANTS_CREATED_AT,
}

export const CONFIGURE_TOOL_GRANTS: TrainingScenario = {
  id: 'configure-tool-grants',
  users: [
    {
      id: CONFIGURE_GRANTS_USER_ID,
      tenant_id: 'ten_acme',
      domain_id: 'dom_ops',
      email: 'training-grants@example.com',
      name: 'You (training)',
      role: 'admin',
      approval_level: 4,
      created_at: '2025-01-01T00:00:00Z',
    },
  ],
  agents: [
    {
      id: CONFIGURE_GRANTS_AGENT_ID,
      tenant_id: 'ten_acme',
      domain_id: 'dom_ops',
      owner_user_id: CONFIGURE_GRANTS_USER_ID,
      name: 'Operations Concierge',
      description: 'Training agent with one demo tool grant.',
      status: 'active',
      created_at: CONFIGURE_GRANTS_CREATED_AT,
      updated_at: CONFIGURE_GRANTS_UPDATED_AT,
      active_version: configureGrantsVersion,
      total_spend_usd: null,
      runs_count: null,
    },
  ],
  approvals: [],
  runs: [],
  chats: [],
  grantsByAgent: {
    [CONFIGURE_GRANTS_AGENT_ID]: [
      {
        id: CONFIGURE_GRANTS_GRANT_ID,
        scope_type: 'agent',
        scope_id: CONFIGURE_GRANTS_AGENT_ID,
        tool_name: 'kb.lookup',
        mode: 'read_write',
        approval_required: false,
        config: {},
      },
    ],
  },
}

export const TRAINING_SCENARIOS: Record<string, TrainingScenario> = {
  'approval-review': APPROVAL_REVIEW,
  'start-a-chat': START_A_CHAT,
  'configure-tool-grants': CONFIGURE_TOOL_GRANTS,
  // Pending phases:
  //   - 'inspect-a-run'          → Phase 6c
  //   - 'spend-overview'         → Phase 6d
}

// Re-exported for tour data files that need the literal IDs in navigateTo.
export const APPROVAL_REVIEW_IDS = {
  approvalId: APPROVAL_REVIEW_APPROVAL_ID,
  runId: APPROVAL_REVIEW_RUN_ID,
  agentId: APPROVAL_REVIEW_AGENT_ID,
  versionId: APPROVAL_REVIEW_VERSION_ID,
  userId: APPROVAL_REVIEW_USER_ID,
} as const

export const START_A_CHAT_IDS = {
  activeAgentId: START_CHAT_ACTIVE_AGENT_ID,
  pausedAgentId: START_CHAT_PAUSED_AGENT_ID,
  activeVersionId: START_CHAT_ACTIVE_VERSION_ID,
  userId: START_CHAT_USER_ID,
} as const

export const CONFIGURE_TOOL_GRANTS_IDS = {
  agentId: CONFIGURE_GRANTS_AGENT_ID,
  versionId: CONFIGURE_GRANTS_VERSION_ID,
  userId: CONFIGURE_GRANTS_USER_ID,
  grantId: CONFIGURE_GRANTS_GRANT_ID,
} as const
