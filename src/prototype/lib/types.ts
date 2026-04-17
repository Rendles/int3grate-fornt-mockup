// Canonical entity types for the control plane MVP.
// Fields at the top of each interface match the backend contract.
// Optional fields at the bottom are local UI helpers populated by fixtures.

export type Role = 'member' | 'domain_admin' | 'admin'
export type ApprovalLevel = 1 | 2 | 3 | 4

// ─────────────────────────────────────────────── User

export interface User {
  id: string
  tenant_id: string
  domain_id: string
  email: string
  name: string
  role: Role
  approval_level: ApprovalLevel
  // UI helpers
  tenant_name?: string
  domain_name?: string
  team?: string
  initials?: string
  avatar_tone?: string
}

// ─────────────────────────────────────────────── Agent

export type AgentStatus = 'draft' | 'active' | 'paused' | 'archived'

export interface Agent {
  id: string
  tenant_id: string
  domain_id: string
  name: string
  description: string
  status: AgentStatus
  owner_user_id: string
  active_version: string | null
  created_at: string
  updated_at: string
  // UI helpers (not canonical)
  owner_team?: 'sales' | 'admin' | 'finance' | 'operations' | 'support' | 'growth'
  version_count?: number
  tools_granted?: number
  tools_requiring_approval?: number
  last_run_at?: string | null
  runs_7d?: number
  success_rate_7d?: number
  monthly_spend_usd?: number
  monthly_spend_cap_usd?: number | null
  tone?: string
  glyph?: string
}

// ─────────────────────────────────────────────── AgentVersion

export interface MemoryScopeConfig {
  user_facts: boolean
  session_only: boolean
  domain_shared: boolean
  retention_days: number
}

export interface ToolScopeConfig {
  inherits_from_agent: boolean
  overrides: string[]
  denylist: string[]
}

export interface ApprovalRule {
  id: string
  when: string
  required_approver_level: ApprovalLevel
  note: string
}

export interface ModelChainConfig {
  primary: string
  fallbacks: string[]
  max_tokens: number
  temperature: number
}

export interface AgentVersion {
  id: string
  agent_id: string
  version_number: number
  instruction_spec: string
  memory_scope_config: MemoryScopeConfig
  tool_scope_config: ToolScopeConfig
  approval_rules: ApprovalRule[]
  model_chain_config: ModelChainConfig
  is_active: boolean
  created_by: string
  created_at: string
  // UI helpers
  label?: string
  notes?: string
  activated_at?: string | null
}

// ─────────────────────────────────────────────── ToolGrant

export type ToolGrantScopeType = 'tenant' | 'domain' | 'agent'
export type ToolGrantMode = 'read' | 'write' | 'read_write'

export interface ToolGrantConfig {
  provider?: string
  category?: ToolCategory
  rate_limit_per_day?: number
  max_spend_per_call_usd?: number
  allowed_channels?: string[]
  notes?: string
  [key: string]: unknown
}

export type ToolCategory = 'crm' | 'comms' | 'data' | 'docs' | 'payments' | 'infra' | 'calendar' | 'llm' | 'search'

export interface ToolGrant {
  id: string
  agent_id: string
  tool_name: string
  scope_type: ToolGrantScopeType
  scope_id: string
  mode: ToolGrantMode
  approval_required: boolean
  config: ToolGrantConfig
  // UI helpers
  granted?: boolean
  last_invoked_at?: string | null
}

// ─────────────────────────────────────────────── Task

export type TaskType = 'chat' | 'one_time' | 'schedule'
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Task {
  id: string
  tenant_id: string
  domain_id: string
  type: TaskType
  status: TaskStatus
  title: string
  user_input: string
  assigned_agent_id: string
  assigned_agent_version_id: string
  created_by: string
  created_at: string
  updated_at: string
  // UI helpers
  agent_name?: string
  created_by_name?: string
  run_id?: string | null
  duration_ms?: number | null
  steps_count?: number
  spend_usd?: number
  result_summary?: string | null
  priority?: 'normal' | 'high' | 'urgent'
  schedule_cron?: string | null
}

// ─────────────────────────────────────────────── Run

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'suspended' | 'cancelled'

export interface Run {
  id: string
  task_id: string
  agent_version_id: string
  status: RunStatus
  suspended_stage: string | null
  total_cost_usd: number
  total_tokens_in: number
  total_tokens_out: number
  error_message: string | null
  started_at: string
  ended_at: string | null
  steps: RunStep[]
  // UI helpers
  agent_id?: string
  agent_name?: string
  version_label?: string
  duration_ms?: number | null
}

// ─────────────────────────────────────────────── RunStep

export type RunStepType =
  | 'llm_call'
  | 'tool_call'
  | 'memory_read'
  | 'memory_write'
  | 'approval_gate'
  | 'validation'

export type RunStepStatus = 'pending' | 'running' | 'ok' | 'blocked' | 'failed' | 'skipped'

export interface RunStep {
  id: string
  run_id: string
  step_index: number
  step_type: RunStepType
  status: RunStepStatus
  model_name: string | null
  tool_name: string | null
  input_ref: string | null
  output_ref: string | null
  cost_usd: number | null
  tokens_in: number | null
  tokens_out: number | null
  duration_ms: number | null
  created_at: string
  completed_at: string | null
  // UI helpers
  title?: string
  detail?: string
  payload?: Record<string, string>
  approval_id?: string
}

// ─────────────────────────────────────────────── ApprovalRequest

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'

export interface ApprovalRequest {
  id: string
  run_id: string
  task_id: string
  requested_action: string
  requested_by: string
  requested_by_name: string
  approver_role: Role
  approver_user_id: string | null
  status: ApprovalStatus
  reason: string | null
  evidence_ref: string | null
  expires_at: string
  resolved_at: string | null
  created_at: string
  // UI helpers
  task_title?: string
  agent_id?: string
  agent_name?: string
  tool_name?: string
  monetary_value_usd?: number | null
  risk?: 'low' | 'medium' | 'high'
  impact_scope?: string
  policy_reason?: string
  payload?: Record<string, string>
  required_approver_level?: ApprovalLevel
}

// ─────────────────────────────────────────────── SpendDashboard / SpendRow

export type SpendRange = '1d' | '7d' | '30d' | '90d'
export type SpendGroupBy = 'agent' | 'user'

export interface SpendRow {
  id: string
  label: string
  total_usd: number
  tokens_in: number
  tokens_out: number
  run_count: number
  spend_date: string
  // UI helpers
  cap_usd?: number | null
  trend?: number[]
  delta_pct?: number
  kind?: SpendGroupBy | 'team' | 'tool' | 'domain'
  sub_label?: string
}

export interface SpendDashboard {
  range: SpendRange
  group_by: SpendGroupBy
  total_usd: number
  items: SpendRow[]
  // UI helpers for page chrome
  window_label?: string
  total_runs?: number
  total_spend_delta_pct?: number
  total_runs_delta_pct?: number
  pending_approvals?: number
  avg_cost_per_run_usd?: number
  burn_per_day?: number[]
  cap_usd?: number
}
