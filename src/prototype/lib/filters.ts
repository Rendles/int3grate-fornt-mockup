import type { AgentStatus, ApprovalStatus, ChatStatus, RunStatus } from './types'

export type StatusFilter<TStatus extends string> = TStatus | 'all'

export type AgentStatusFilter = StatusFilter<AgentStatus>
export type ApprovalStatusFilter = StatusFilter<ApprovalStatus>
export type ChatStatusFilter = StatusFilter<ChatStatus>
export type RunStatusFilter = StatusFilter<RunStatus>

export const AGENT_STATUS_FILTERS = [
  'all',
  'active',
  'paused',
  'draft',
  'archived',
] as const satisfies readonly AgentStatusFilter[]

export const APPROVAL_STATUS_FILTERS = [
  'all',
  'pending',
  'approved',
  'rejected',
  'expired',
  'cancelled',
] as const satisfies readonly ApprovalStatusFilter[]

export const CHAT_STATUS_FILTERS = [
  'all',
  'active',
  'closed',
  'failed',
] as const satisfies readonly ChatStatusFilter[]

export const RUN_STATUS_FILTERS = [
  'all',
  'pending',
  'running',
  'suspended',
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled',
] as const satisfies readonly RunStatusFilter[]

