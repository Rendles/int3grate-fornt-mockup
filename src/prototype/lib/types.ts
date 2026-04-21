// Canonical entity types — aligned 1:1 with gateway.yaml schemas.
// No UI helper fields: only data the backend actually returns.

export type Role = 'member' | 'domain_admin' | 'admin'
export type ApprovalLevel = 1 | 2 | 3 | 4

// ─────────────────────────────────────────────── Auth

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  expires_at: string
}

// ─────────────────────────────────────────────── Health

export interface HealthResponse {
  status: 'ok'
  schema_version?: string
}

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

export interface CreateAgentRequest {
  name: string
  description?: string
  domain_id?: string
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

export interface CreateAgentVersionRequest {
  instruction_spec: string
  memory_scope_config?: Record<string, unknown>
  tool_scope_config?: Record<string, unknown>
  approval_rules?: Record<string, unknown>
  model_chain_config?: Record<string, unknown>
}

// ─────────────────────────────────────────────── ToolGrant (legacy CRUD axis)

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

// Body shape for PUT /agents/{id}/grants — no id/scope_*, gateway assigns them.
export interface ReplaceToolGrantsRequest {
  grants: Array<{
    tool_name: string
    mode: ToolGrantMode
    approval_required?: boolean
    config?: Record<string, unknown>
  }>
}

// Response for GET /internal/tool-grants/check (x-internal).
export interface ToolGrantCheck {
  granted: boolean
  mode: ToolGrantMode | null
  approval_required: boolean
}

// ─────────────────────────────────────────────── Tool catalog + policy axis (gateway v0.2.0)

// Distinct from ToolGrantMode — this is a policy axis, not CRUD.
export type ToolPolicyMode = 'read_only' | 'requires_approval' | 'denied'

export interface ToolDefinition {
  name: string
  description?: string
  input_schema: Record<string, unknown>
  default_mode: ToolPolicyMode
}

export interface GrantsSnapshotEntry {
  tool: string
  mode: ToolPolicyMode
  scopes?: string[]
}

export interface GrantsSnapshot {
  agent_id: string
  tenant_id: string
  version: string
  grants: GrantsSnapshotEntry[]
  issued_at: string
}

// ─────────────────────────────────────────────── Task (MVP-deferred per ADR-0003)

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

// MVP-deferred (ADR-0003) — body for POST /tasks.
export interface CreateTaskRequest {
  agent_id: string
  user_input: string
  type?: TaskType
  title?: string
  domain_id?: string
}

// ─────────────────────────────────────────────── Run

export type RunStatus =
  | 'pending'
  | 'running'
  | 'suspended'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled'

export type RunErrorKind =
  | 'none'
  | 'tool_error'
  | 'orchestrator_error'
  | 'timeout'
  | 'cancelled'

export interface RunToolError {
  tool: string
  status: 'error' | 'timeout' | 'denied'
  message?: string
  at?: string
  tool_call_id?: string | null
}

export interface Run {
  id: string
  tenant_id: string
  domain_id: string | null
  task_id: string | null
  agent_version_id: string | null
  status: RunStatus
  suspended_stage: string | null
  started_at: string | null
  ended_at: string | null
  total_cost_usd: number
  total_tokens_in: number
  total_tokens_out: number
  error_message: string | null
  error_kind?: RunErrorKind | null
  tool_errors?: RunToolError[]
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
  task_id: string | null
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

// Body for POST /approvals/{id}/decision.
// NB: request uses approved/rejected, but the 202-ack below uses approve/reject.
export interface ApprovalDecisionRequest {
  decision: 'approved' | 'rejected'
  reason?: string
}

export interface ApprovalDecisionAccepted {
  approval_id: string
  decision: 'approve' | 'reject'
  status: 'queued'
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
