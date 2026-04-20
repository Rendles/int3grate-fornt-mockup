// Canonical entity types — aligned 1:1 with gateway.yaml schemas.
// No UI helper fields: only data the backend actually returns.

export type Role = 'member' | 'domain_admin' | 'admin'
export type ApprovalLevel = 1 | 2 | 3 | 4

// ─────────────────────────────────────────────── User

export interface User {
  id: string
  tenant_id: string
  domain_id: string | null
  email: string
  name: string
  role: Role
  approval_level: ApprovalLevel
  created_at: string
}

// ─────────────────────────────────────────────── Agent

export type AgentStatus = 'draft' | 'active' | 'paused' | 'archived'

export interface Agent {
  id: string
  tenant_id: string
  domain_id: string | null
  owner_user_id: string | null
  name: string
  description: string | null
  status: AgentStatus
  active_version: AgentVersion | null
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────── AgentVersion

export interface AgentVersion {
  id: string
  agent_id: string
  version: number
  instruction_spec: string
  memory_scope_config: Record<string, unknown>
  tool_scope_config: Record<string, unknown>
  approval_rules: Record<string, unknown>
  model_chain_config: Record<string, unknown>
  is_active: boolean
  created_by: string | null
  created_at: string
}

// ─────────────────────────────────────────────── ToolGrant

export type ToolGrantScopeType = 'tenant' | 'domain' | 'agent'
export type ToolGrantMode = 'read' | 'write' | 'read_write'

export interface ToolGrant {
  id: string
  scope_type: ToolGrantScopeType
  scope_id: string
  tool_name: string
  mode: ToolGrantMode
  approval_required: boolean
  config: Record<string, unknown>
}

// ─────────────────────────────────────────────── Task

export type TaskType = 'chat' | 'one_time' | 'schedule'
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Task {
  id: string
  tenant_id: string
  domain_id: string | null
  type: TaskType
  status: TaskStatus
  created_by: string | null
  assigned_agent_id: string | null
  assigned_agent_version_id: string | null
  title: string | null
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────── Run

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'suspended' | 'cancelled'

export interface Run {
  id: string
  tenant_id: string
  domain_id: string | null
  task_id: string
  agent_version_id: string | null
  status: RunStatus
  suspended_stage: string | null
  started_at: string | null
  ended_at: string | null
  total_cost_usd: number
  total_tokens_in: number
  total_tokens_out: number
  error_message: string | null
  steps: RunStep[]
  created_at: string
}

// ─────────────────────────────────────────────── RunStep

export type RunStepType =
  | 'llm_call'
  | 'tool_call'
  | 'memory_read'
  | 'memory_write'
  | 'approval_gate'
  | 'validation'

export interface RunStep {
  id: string
  step_type: RunStepType
  status: string
  model_name: string | null
  tool_name: string | null
  input_ref: Record<string, unknown> | null
  output_ref: Record<string, unknown> | null
  cost_usd: number | null
  tokens_in: number | null
  tokens_out: number | null
  duration_ms: number | null
  created_at: string
  completed_at: string | null
}

// ─────────────────────────────────────────────── ApprovalRequest

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'

export interface ApprovalRequest {
  id: string
  run_id: string
  task_id: string
  tenant_id: string
  requested_action: string
  requested_by: string | null
  requested_by_name: string | null
  approver_role: string | null
  approver_user_id: string | null
  status: ApprovalStatus
  reason: string | null
  evidence_ref: Record<string, unknown> | null
  expires_at: string | null
  resolved_at: string | null
  created_at: string
}

// ─────────────────────────────────────────────── SpendDashboard / SpendRow

export type SpendRange = '1d' | '7d' | '30d' | '90d'
export type SpendGroupBy = 'agent' | 'user'

export interface SpendRow {
  id: string
  label: string
  total_usd: number
  total_tokens_in: number
  total_tokens_out: number
  run_count: number
  spend_date: string | null
}

export interface SpendDashboard {
  range: string
  group_by: string
  total_usd: number
  items: SpendRow[]
}
