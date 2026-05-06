// Canonical entity types — aligned 1:1 with docs/gateway.yaml schemas.
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

// ─────────────────────────────────────────────── User

export interface User {
  id: string
  tenant_id: string
  domain_id: string | null
  email: string
  name: string
  role: Role
  // Optional per docs/gateway.yaml — only required: [id, tenant_id, email, name, role].
  approval_level?: ApprovalLevel
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
  // Detail-only enrichment fields (docs/gateway.yaml). Populated only on
  // GET /agents/{id}; null on list views or when orchestrator lookup fails.
  total_spend_usd?: number | null
  runs_count?: number | null
  created_at: string
  updated_at: string
}

export interface CreateAgentRequest {
  name: string
  description?: string
  domain_id?: string
}

export interface AgentList {
  items: Agent[]
  total: number
  limit?: number
  offset?: number
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
  tool_name: string
  mode: ToolPolicyMode
  approval_required?: boolean
  scopes?: string[]
}

export interface GrantsSnapshot {
  agent_id: string
  tenant_id: string
  version: string
  grants: GrantsSnapshotEntry[]
  issued_at: string
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

// docs/gateway.yaml schema name is `RunDetail` (response of GET /runs/{runId}).
// `Run` is kept as a backward-compatible alias so existing imports keep working.
export interface RunDetail {
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

export type Run = RunDetail

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

// ─────────────────────────────────────────────── Runs list (docs/gateway.yaml)
// Lightweight projection of Run for /dashboard/runs — no `steps[]`, includes a
// denormalized `agent_id` so list views don't need to resolve agent_version_id.

export interface RunListItem {
  id: string
  tenant_id: string
  domain_id: string | null
  task_id: string | null
  agent_id: string | null
  agent_version_id: string | null
  status: RunStatus
  suspended_stage: string | null
  started_at: string | null
  ended_at: string | null
  total_cost_usd: number
  total_tokens_in: number
  total_tokens_out: number
  created_at: string
}

export interface RunsList {
  items: RunListItem[]
  total: number
  limit: number
  offset: number
}

// ─────────────────────────────────────────────── Chat (docs/gateway.yaml)

export type ChatStatus = 'active' | 'closed' | 'failed'
export type ChatMessageRole = 'user' | 'assistant' | 'tool' | 'system'

export interface Chat {
  id: string
  tenant_id: string
  agent_id: string
  agent_version_id: string
  created_by: string
  model: string
  title: string | null
  status: ChatStatus
  started_at: string
  updated_at: string
  ended_at: string | null
  total_cost_usd: number
  total_tokens_in: number
  total_tokens_out: number
}

export interface ChatList {
  items: Chat[]
  total: number
  limit: number
  offset: number
}

export interface ChatToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  chat_id: string
  role: ChatMessageRole
  content: string | null
  tool_calls: ChatToolCall[] | null
  tool_call_id: string | null
  tool_name: string | null
  cost_usd: number | null
  tokens_in: number | null
  tokens_out: number | null
  created_at: string
}

export interface ChatMessageList {
  items: ChatMessage[]
  total: number
  limit: number
  offset: number
}

export interface CreateChatRequest {
  agent_version_id: string
  model?: string | null
  title?: string | null
  // MOCK-ONLY: when set, the mock api.createChat seeds the chat with a
  // synthetic assistant message so the user lands on a chat that already
  // has a greeting. The real backend does NOT support this — see
  // docs/backend-gaps.md. Used by the welcome-chat onboarding sandbox.
  seed_assistant_message?: string
}

export interface SendMessageRequest {
  content: string
}

// SSE frames for POST /chat/{chatId}/message. The wire format is `data: <json>`
// per docs/gateway.yaml; the mock yields these as a typed AsyncIterable.
export type ChatStreamFrame =
  | { event: 'turn_start'; message_id: string }
  | { event: 'text_delta'; delta: string }
  | { event: 'tool_call'; tool: string; args: Record<string, unknown>; tool_call_id: string }
  | { event: 'tool_result'; tool_call_id: string; status: 'ok' | 'error'; output_ref: Record<string, unknown> | null }
  | { event: 'turn_end'; message_id: string; cost_usd: number; tokens_in: number; tokens_out: number }
  | { event: 'done' }
  | { event: 'error'; kind: 'approval_required' | 'tool_error' | 'llm_error'; message: string }

// ─────────────────────────────────────────────── Audit (docs/gateway.yaml)
// Tenant-scoped step-level events unified across runs and chats.
// Each event carries exactly one of run_id / chat_id (the other is null).
// Chat-sourced events also populate message_id.

// step_type is intentionally a free-form string in the contract because
// historical run-side values are inconsistent. Canonical run values: 'llm',
// 'tool_call', 'approval_wait', 'system'. Canonical chat values:
// 'chat_message', 'chat_tool_call'.
export type AuditStepType =
  | 'llm'
  | 'tool_call'
  | 'approval_wait'
  | 'system'
  | 'chat_message'
  | 'chat_tool_call'

export interface AuditEvent {
  id: string
  run_id: string | null
  chat_id: string | null
  message_id: string | null
  agent_id: string
  step_type: string
  status: string
  tool_name: string | null
  model_name: string | null
  cost_usd: number | null
  tokens_in: number | null
  tokens_out: number | null
  duration_ms: number | null
  created_at: string
  completed_at: string | null
}

export interface AuditList {
  items: AuditEvent[]
  total: number
  limit: number
  offset: number
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

export interface ApprovalList {
  items: ApprovalRequest[]
  total: number
  limit?: number
  offset?: number
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
