import {
  agents as fxAgents,
  agentVersions as fxVersions,
  approvals as fxApprovals,
  chats as fxChats,
  chatMessages as fxChatMessages,
  fxTools,
  grantsByAgent,
  handoffs as fxHandoffs,
  runs as fxRuns,
  getAgentStats,
  getSpendDashboard,
  users as fxUsers,
  workspaces as fxWorkspaces,
  workspaceMemberships as fxWorkspaceMemberships,
} from './fixtures'
import type {
  Agent,
  AgentList,
  AgentStatus,
  AgentVersion,
  AgentVersionList,
  ApprovalDecisionAccepted,
  ApprovalList,
  ApprovalRequest,
  AuditEvent,
  AuditList,
  Chat,
  ChatList,
  ChatMessage,
  ChatMessageList,
  ChatStreamFrame,
  CreateChatRequest,
  CreateWorkspaceRequest,
  GrantsSnapshot,
  GrantsSnapshotEntry,
  HandoffList,
  LoginResponse,
  PatchAgentRequest,
  PatchAgentStatusRequest,
  ReplaceToolGrantsRequest,
  Role,
  RunDetail,
  RunListItem,
  RunStatus,
  RunStepType,
  RunsList,
  SendMessageRequest,
  SpendDashboard,
  SpendGroupBy,
  SpendRange,
  ToolDefinition,
  ToolGrant,
  ToolPolicyMode,
  UpdateWorkspaceRequest,
  User,
  UserList,
  Workspace,
  WorkspaceList,
} from './types'
import { TRAINING_SCENARIOS, type TrainingScenario } from '../tours/training-fixtures'
import { getDevMode } from '../dev/dev-mode'
import { getActiveWorkspaceId, getAllUserWorkspaceIds } from './workspace-context'

// Workspace filter — page-filter variant. Each list endpoint accepts an
// optional `workspace_ids` parameter; the screen passes its local page
// filter through. When the parameter is omitted (e.g. the sidebar
// approval badge wants ALL pending across the user's memberships), we
// fall back to the user's full membership list so callers don't have to
// thread it through. See docs/agent-plans/2026-05-08-0030-page-filters-
// vs-global-scope.md.
//
// Empty / no memberships → nothing in scope. Training mode short-circuits
// this layer entirely; training scenarios bring their own agent set with
// no workspace concept.
function inSelectedWorkspaces(
  agentId: string | null | undefined,
  workspaceIds?: string[],
): boolean {
  const allowed = (workspaceIds && workspaceIds.length > 0)
    ? workspaceIds
    : getAllUserWorkspaceIds()
  if (allowed.length === 0) return false
  if (!agentId) return false
  // Per docs/handoff-prep.md § 0.1: backend `domain` ≡ frontend `workspace`,
  // so `agent.domain_id` IS the workspace FK — no side-table needed.
  const agent = fxAgents.find(a => a.id === agentId)
  const wsId = agent?.domain_id
  if (!wsId) return false
  return allowed.includes(wsId)
}

// User-id → workspace membership across the chosen scope. True if the user
// is a member of ANY of the workspaces in scope. Used for SpendDashboard
// group_by='user' filtering.
function userInSelectedWorkspaces(userId: string, workspaceIds?: string[]): boolean {
  const allowed = (workspaceIds && workspaceIds.length > 0)
    ? workspaceIds
    : getAllUserWorkspaceIds()
  if (allowed.length === 0) return false
  return fxWorkspaceMemberships.some(
    m => m.user_id === userId && allowed.includes(m.workspace_id),
  )
}

// ApprovalRequest doesn't carry agent_id directly — resolve via run_id →
// run.agent_version_id → version.agent_id for run-source approvals, or
// chat_id → chat.agent_id for chat-source ones (gateway 0.2.0 / ADR-0011).
// Returns null if any link is missing (such approvals are filtered out by
// inSelectedWorkspaces).
function approvalAgentId(a: ApprovalRequest): string | null {
  if (a.run_id) {
    const run = fxRuns[a.run_id]
    if (!run || !run.agent_version_id) return null
    const version = fxVersions.find(v => v.id === run.agent_version_id)
    return version?.agent_id ?? null
  }
  if (a.chat_id) {
    const chat = fxChats.find(c => c.id === a.chat_id)
    return chat?.agent_id ?? null
  }
  return null
}

// Dev-mode short-circuit. Read methods call this right after delay()
// and either get '"empty"' (apply empty result), 'real' (continue with
// the real impl), hang forever (loading mode), or throw (error mode).
async function _devGate(): Promise<'real' | 'empty'> {
  const m = getDevMode()
  if (m === 'real') return 'real'
  if (m === 'empty') return 'empty'
  if (m === 'loading') {
    await new Promise<never>(() => {})
    return 'real' // unreachable
  }
  throw new Error('Dev mode: forced error')
}

// Slice an array per limit/offset envelope params. Defaults:
// no slicing (returns the whole array) so existing client-side pagination
// keeps working until screens migrate to server-side params.
function paginate<T>(all: T[], filter?: { limit?: number; offset?: number }): { items: T[]; total: number; limit?: number; offset?: number } {
  const total = all.length
  const offset = filter?.offset
  const limit = filter?.limit
  const start = offset ?? 0
  const end = limit != null ? start + limit : undefined
  const items = limit != null || offset != null ? all.slice(start, end) : all
  return { items, total, limit, offset }
}

const delay = () => new Promise(r => setTimeout(r, 120 + Math.random() * 260))

// Legal lifecycle transitions for PATCH /agents/{id}/status (gateway 0.3.0).
// `archived` is terminal — can't be re-activated. `paused` is reversible.
// Note: draft→active normally happens via version activation (POST
// /agents/{id}/versions/{verId}/activate), but the PATCH endpoint also
// accepts it for completeness.
const _AGENT_STATUS_TRANSITIONS: Record<AgentStatus, readonly AgentStatus[]> = {
  draft:    ['active', 'archived'],
  active:   ['paused', 'archived'],
  paused:   ['active', 'archived'],
  archived: [],
}

function _isLegalAgentStatusTransition(from: AgentStatus, to: AgentStatus): boolean {
  if (from === to) return true
  return _AGENT_STATUS_TRANSITIONS[from].includes(to)
}

function toIdSegment(value: string, fallback: string, maxLength = 24): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLength)
  return slug || fallback
}

// Mock JWT layout: `mock_<userId>`. The real gateway uses signed JWTs;
// frontend treats this as opaque and just round-trips it back as bearer.
const MOCK_TOKEN_PREFIX = 'mock_'
const MOCK_TOKEN_TTL_HOURS = 12

function mintMockToken(userId: string): LoginResponse {
  const expires = new Date(Date.now() + MOCK_TOKEN_TTL_HOURS * 3_600_000).toISOString()
  return { token: `${MOCK_TOKEN_PREFIX}${userId}`, expires_at: expires }
}

function userIdFromToken(token: string): string {
  // Mock-only decoder. Real backend extracts `sub` from the verified JWT.
  // Backwards-compatible: accept raw userIds for sessions stored before the
  // login flow switched to LoginResponse.
  return token.startsWith(MOCK_TOKEN_PREFIX) ? token.slice(MOCK_TOKEN_PREFIX.length) : token
}

// ─────────────────────────────────────────────── Training-mode hook
//
// Module-level pointer to the currently-active training scenario. Set by
// `TrainingModeProvider` via `__setTrainingMode(id)` on tour start, cleared
// to null on exit. See docs/plans/tours.md "Training mode" section.
//
// Reads inside `api.*` route through `_trainingScenario()` and replace
// their underlying fixture array with the scenario's set when active.
// Per-read plumbing is added per-tour as scenarios land — Phase 1 only
// stands up the wiring (setter + helper); both are exported so they
// don't trip `noUnusedLocals` until reads actually start consuming them.
let __activeTrainingScenario: string | null = null
let __trainingChats: Chat[] | null = null
let __trainingChatMessages: Record<string, ChatMessage[]> | null = null
let __trainingGrantsByAgent: Record<string, ToolGrant[]> | null = null

export function __setTrainingMode(id: string | null) {
  __activeTrainingScenario = id
  const scenario = id ? TRAINING_SCENARIOS[id] : null
  __trainingChats = scenario ? [...scenario.chats] : null
  __trainingChatMessages = scenario
    ? Object.fromEntries(scenario.chats.map(c => [c.id, [] as ChatMessage[]]))
    : null
  __trainingGrantsByAgent = scenario
    ? Object.fromEntries(
        Object.entries(scenario.grantsByAgent ?? {}).map(([agentId, grants]) => [
          agentId,
          grants.map(cloneGrant),
        ]),
      )
    : null
}

export function _trainingScenario(): TrainingScenario | null {
  if (!__activeTrainingScenario) return null
  return TRAINING_SCENARIOS[__activeTrainingScenario] ?? null
}

function trainingChats(): Chat[] | null {
  const scenario = _trainingScenario()
  if (!scenario) return null
  if (!__trainingChats) __trainingChats = [...scenario.chats]
  return __trainingChats
}

function trainingChatMessages(chatId: string): ChatMessage[] | null {
  if (!_trainingScenario()) return null
  if (!__trainingChatMessages) __trainingChatMessages = {}
  if (!__trainingChatMessages[chatId]) __trainingChatMessages[chatId] = []
  return __trainingChatMessages[chatId]
}

function trainingAgentVersion(versionId: string): AgentVersion | undefined {
  const scenario = _trainingScenario()
  return scenario?.agents
    .map(a => a.active_version)
    .find((v): v is AgentVersion => v?.id === versionId)
}

function trainingGrants(agentId: string): ToolGrant[] | null {
  const scenario = _trainingScenario()
  if (!scenario) return null
  if (!__trainingGrantsByAgent) __trainingGrantsByAgent = {}
  if (!__trainingGrantsByAgent[agentId]) {
    __trainingGrantsByAgent[agentId] = (scenario.grantsByAgent?.[agentId] ?? []).map(cloneGrant)
  }
  return __trainingGrantsByAgent[agentId]
}

function cloneGrant(grant: ToolGrant): ToolGrant {
  return {
    ...grant,
    config: { ...grant.config },
  }
}

export const api = {
  // ── POST /auth/login ──────────────────────────────────────────────
  // Returns LoginResponse { token, expires_at } per docs/gateway.yaml.
  // Clients then call GET /me with the token to fetch the User profile.
  async login(email: string, password: string): Promise<LoginResponse> {
    void password
    await delay()
    const u = fxUsers.find(u => u.email === email)
    if (!u) throw new Error('No such user')
    return mintMockToken(u.id)
  },

  async register(input: { name: string; email: string; password: string; workspaceName: string }): Promise<User> {
    void input.password
    await delay()
    const email = input.email.trim().toLowerCase()
    if (fxUsers.some(u => u.email.toLowerCase() === email)) {
      throw new Error('Email already registered')
    }

    const userSegment = toIdSegment(email.split('@')[0] ?? '', 'user')
    let userId = `usr_${userSegment}`
    let userSuffix = 2
    while (fxUsers.some(u => u.id === userId)) {
      userId = `usr_${userSegment}_${userSuffix}`
      userSuffix += 1
    }

    const tenantSegment = toIdSegment(input.workspaceName, 'workspace')
    let tenantId = `ten_${tenantSegment}`
    let tenantSuffix = 2
    while (fxUsers.some(u => u.tenant_id === tenantId)) {
      tenantId = `ten_${tenantSegment}_${tenantSuffix}`
      tenantSuffix += 1
    }

    const user: User = {
      id: userId,
      tenant_id: tenantId,
      domain_id: null,
      email,
      name: input.name.trim(),
      role: 'admin',
      approval_level: 4,
      created_at: new Date().toISOString(),
    }
    fxUsers.unshift(user)
    return user
  },

  // ── GET /me ────────────────────────────────────────────────────────
  // Real gateway resolves the user from the bearer JWT. Mock decodes the
  // user_id from `mock_<userId>` tokens; raw userIds from old sessions still
  // work so we don't force a logout on the version bump.
  async me(token: string): Promise<User> {
    await delay()
    const userId = userIdFromToken(token)
    const u = fxUsers.find(u => u.id === userId)
    if (!u) throw new Error('No user')
    return u
  },

  // ── GET /users (gateway 0.3.0). Admin / domain_admin only — the gate is
  // enforced by the real backend; the mock leaves it open. Returns the
  // paginated `UserList` envelope per spec.
  async listUsers(filter?: { limit?: number; offset?: number }): Promise<UserList> {
    await delay()
    if (await _devGate() === 'empty') return { items: [], total: 0, limit: filter?.limit, offset: filter?.offset }
    const scenario = _trainingScenario()
    const source = scenario?.users ?? fxUsers
    return paginate([...source], filter)
  },

  // ── GET /users/{userId} (gateway 0.3.0).
  async getUser(userId: string): Promise<User | undefined> {
    await delay()
    if (await _devGate() === 'empty') return undefined
    const scenario = _trainingScenario()
    return (scenario?.users ?? fxUsers).find(u => u.id === userId)
  },

  // ── GET /agents ────────────────────────────────────────────────────
  // Returns AgentList envelope (docs/gateway.yaml). Detail-only enrichment
  // fields (total_spend_usd, runs_count) are null on list views per spec.
  async listAgents(filter?: { limit?: number; offset?: number; workspace_ids?: string[] }): Promise<AgentList> {
    await delay()
    if (await _devGate() === 'empty') return { items: [], total: 0, limit: filter?.limit, offset: filter?.offset }
    const scenario = _trainingScenario()
    if (scenario) return paginate(scenario.agents, filter)
    const scoped = fxAgents.filter(a => inSelectedWorkspaces(a.id, filter?.workspace_ids))
    return paginate(scoped, filter)
  },

  // ── GET /agents/{id} ───────────────────────────────────────────────
  // Detail view enriches the Agent with total_spend_usd / runs_count
  // (docs/gateway.yaml). List view leaves these null.
  async getAgent(id: string): Promise<Agent | undefined> {
    await delay()
    if (await _devGate() === 'empty') return undefined
    const scenario = _trainingScenario()
    const a = (scenario?.agents ?? fxAgents).find(a => a.id === id)
    if (!a) return undefined
    if (scenario) return { ...a }
    const stats = getAgentStats(id)
    return {
      ...a,
      total_spend_usd: stats?.total_spend_usd ?? null,
      runs_count: stats?.runs_count ?? null,
    }
  },

  // ── POST /agents ───────────────────────────────────────────────────
  async createAgent(input: { name: string; description?: string; domain_id?: string | null }): Promise<Agent> {
    await delay()
    const id = `agt_${input.name.toLowerCase().replace(/\s+/g, '_').slice(0, 20)}`
    const now = new Date().toISOString()
    const agent: Agent = {
      id,
      tenant_id: 'ten_acme',
      domain_id: input.domain_id ?? null,
      owner_user_id: null,
      name: input.name,
      description: input.description ?? null,
      status: 'draft',
      active_version: null,
      created_at: now,
      updated_at: now,
    }
    fxAgents.unshift(agent)
    // If the caller didn't pass `domain_id`, pin to the active workspace so
    // the new agent shows up immediately under the user's current scope.
    // Hire flows always call setAgentWorkspace afterwards to put the agent
    // at its actual destination, so this is a safety net for callers that
    // skip the explicit pin. Per § 0.1 — agent.domain_id IS the workspace FK.
    if (!agent.domain_id) {
      const wsId = getActiveWorkspaceId()
      if (wsId) agent.domain_id = wsId
    }
    return agent
  },

  // ── PATCH /agents/{id} (gateway 0.3.0) ────────────────────────────
  // True PATCH semantics: absent fields are left unchanged. Empty patch
  // (zero fields provided) is rejected — must mutate at least one.
  async patchAgent(agentId: string, patch: PatchAgentRequest): Promise<Agent> {
    await delay()
    const a = fxAgents.find(a => a.id === agentId)
    if (!a) throw Object.assign(new Error('Agent not found'), { code: 'not_found' })
    const provided = Object.entries(patch).filter(([, v]) => v !== undefined)
    if (provided.length === 0) {
      throw Object.assign(new Error('PATCH /agents requires at least one field'), { code: 'bad_request' })
    }
    if (patch.name !== undefined) a.name = patch.name
    if (patch.description !== undefined) a.description = patch.description
    if (patch.domain_id !== undefined) a.domain_id = patch.domain_id
    if (patch.owner_user_id !== undefined) a.owner_user_id = patch.owner_user_id
    a.updated_at = new Date().toISOString()
    return a
  },

  // ── PATCH /agents/{id}/status (gateway 0.3.0) ─────────────────────
  // Lifecycle transitions: draft→active (activate), active↔paused,
  // active→archived (decommission). Illegal transitions return 409 on the
  // real backend; the mock raises with code 'conflict'.
  async patchAgentStatus(agentId: string, patch: PatchAgentStatusRequest): Promise<Agent> {
    await delay()
    const a = fxAgents.find(a => a.id === agentId)
    if (!a) throw Object.assign(new Error('Agent not found'), { code: 'not_found' })
    if (!_isLegalAgentStatusTransition(a.status, patch.status)) {
      throw Object.assign(
        new Error(`Illegal transition: ${a.status} → ${patch.status}`),
        { code: 'conflict', from: a.status, to: patch.status },
      )
    }
    a.status = patch.status
    a.updated_at = new Date().toISOString()
    return a
  },

  // ── POST /agents/{id}/versions ────────────────────────────────────
  async createAgentVersion(agentId: string, input: {
    instruction_spec: string
    memory_scope_config?: Record<string, unknown>
    tool_scope_config?: Record<string, unknown>
    approval_rules?: Record<string, unknown>
    model_chain_config?: Record<string, unknown>
  }): Promise<AgentVersion> {
    await delay()
    const existing = fxVersions.filter(v => v.agent_id === agentId)
    const nextNumber = existing.reduce((m, v) => Math.max(m, v.version), 0) + 1
    const v: AgentVersion = {
      id: `ver_${agentId}_${nextNumber}`,
      agent_id: agentId,
      version: nextNumber,
      instruction_spec: input.instruction_spec,
      memory_scope_config: input.memory_scope_config ?? {},
      tool_scope_config: input.tool_scope_config ?? {},
      approval_rules: input.approval_rules ?? {},
      model_chain_config: input.model_chain_config ?? {},
      is_active: false,
      created_by: 'usr_ada',
      created_at: new Date().toISOString(),
    }
    fxVersions.unshift(v)
    return v
  },

  // ── POST /agents/{id}/versions/{verId}/activate ───────────────────
  async activateVersion(agentId: string, versionId: string): Promise<AgentVersion> {
    await delay()
    const v = fxVersions.find(v => v.id === versionId)
    if (!v) throw new Error('no version')
    fxVersions.forEach(vv => {
      if (vv.agent_id === agentId && vv.is_active) vv.is_active = false
    })
    v.is_active = true
    const a = fxAgents.find(a => a.id === agentId)
    if (a) {
      a.active_version = v
      // Per backend confirmed flow (2026-05-02): activating a version
      // transitions the agent from `draft` → `active` server-side. Mock
      // mirrors that so the success page shows the right status.
      if (a.status === 'draft') a.status = 'active'
      a.updated_at = new Date().toISOString()
    }
    return v
  },

  // ── GET /agents/{id}/versions (gateway 0.3.0) ─────────────────────
  // Paginated history of an agent's versions. Sorted newest-first.
  async listAgentVersions(
    agentId: string,
    filter?: { limit?: number; offset?: number },
  ): Promise<AgentVersionList> {
    await delay()
    if (await _devGate() === 'empty') {
      return { items: [], total: 0, limit: filter?.limit, offset: filter?.offset }
    }
    const all = fxVersions
      .filter(v => v.agent_id === agentId)
      .sort((a, b) => b.version - a.version)
    return paginate(all, filter)
  },

  // ── GET /agents/{id}/versions/{versionId} (gateway 0.3.0) ─────────
  // Returns 404 if the versionId doesn't belong to the agent.
  async getAgentVersion(agentId: string, versionId: string): Promise<AgentVersion | undefined> {
    await delay()
    if (await _devGate() === 'empty') return undefined
    return fxVersions.find(v => v.id === versionId && v.agent_id === agentId)
  },

  // ── GET /agents/{id}/grants ───────────────────────────────────────
  async getGrants(agentId: string): Promise<ToolGrant[]> {
    await delay()
    if (await _devGate() === 'empty') return []
    const training = trainingGrants(agentId)
    return training ? training.map(cloneGrant) : grantsByAgent[agentId] ?? []
  },

  // ── PUT /agents/{id}/grants ───────────────────────────────────────
  // Spec body is ReplaceToolGrantsRequest (no id/scope_*) — gateway assigns
  // id/scope_type/scope_id itself. Response is the full ToolGrant[].
  async setGrants(agentId: string, body: ReplaceToolGrantsRequest): Promise<ToolGrant[]> {
    await delay()
    const next: ToolGrant[] = body.grants.map((g, i) => ({
      id: `grt_${agentId.slice(0, 8)}_${Date.now().toString(36)}_${i}`,
      scope_type: 'agent',
      scope_id: agentId,
      tool_name: g.tool_name,
      mode: g.mode,
      approval_required: g.approval_required ?? false,
      config: g.config ?? {},
    }))
    const training = trainingGrants(agentId)
    if (training) {
      __trainingGrantsByAgent = {
        ...(__trainingGrantsByAgent ?? {}),
        [agentId]: next.map(cloneGrant),
      }
      return next
    }
    grantsByAgent[agentId] = next
    const a = fxAgents.find(a => a.id === agentId)
    if (a) a.updated_at = new Date().toISOString()
    return next
  },

  // ── GET /runs/{id} ────────────────────────────────────────────────
  // Returns RunDetail (docs/gateway.yaml schema name).
  async getRun(id: string): Promise<RunDetail | undefined> {
    await delay()
    if (await _devGate() === 'empty') return undefined
    const scenario = _trainingScenario()
    if (scenario) return scenario.runs.find(r => r.id === id)
    return fxRuns[id]
  },

  // ── GET /runs (gateway 0.3.0) and legacy /dashboard/runs ──────────
  // Paginated tenant-scoped run list. Spec params: `status`, `limit`,
  // `offset`. The `workspace_ids` filter is **mock-only** — backend has
  // no Workspace concept in spec yet (see docs/backend-gaps.md § 1.15);
  // when workspaces ship, this filter goes with them.
  async listRuns(filter?: {
    status?: RunStatus
    limit?: number
    offset?: number
    workspace_ids?: string[]
  }): Promise<RunsList> {
    await delay()
    if (await _devGate() === 'empty') {
      const limit = filter?.limit ?? 20
      const offset = filter?.offset ?? 0
      return { items: [], total: 0, limit, offset }
    }
    const limit = filter?.limit ?? 20
    const offset = filter?.offset ?? 0
    const all = Object.values(fxRuns)
      .filter(r => {
        if (filter?.status && r.status !== filter.status) return false
        if (!inSelectedWorkspaces(r.agent_id, filter?.workspace_ids)) return false
        return true
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    const items: RunListItem[] = all.slice(offset, offset + limit).map(r => ({
      id: r.id,
      tenant_id: r.tenant_id,
      task_id: r.task_id,
      agent_id: r.agent_id,
      agent_version_id: r.agent_version_id,
      status: r.status,
      suspended_stage: r.suspended_stage,
      started_at: r.started_at,
      ended_at: r.ended_at,
      total_cost_usd: r.total_cost_usd,
      total_tokens_in: r.total_tokens_in,
      total_tokens_out: r.total_tokens_out,
      created_at: r.created_at,
    }))
    return { items, total: all.length, limit, offset }
  },

  // ── GET /audit ────────────────────────────────────────────────────
  // Tenant-scoped audit timeline. In the real gateway this proxies to
  // orchestrator GET /internal/audit; here we synthesize events from run
  // steps. Chat-sourced events will be added when the chat surface lands.
  // run_id and chat_id are mutually exclusive (passing both yields 422).
  async listAudit(filter?: {
    agent_id?: string
    run_id?: string
    chat_id?: string
    from?: string
    to?: string
    limit?: number
    offset?: number
    workspace_ids?: string[]
  }): Promise<AuditList> {
    await delay()
    if (filter?.run_id && filter?.chat_id) {
      throw Object.assign(new Error('run_id and chat_id are mutually exclusive'), { code: 'validation_error' })
    }
    const limit = filter?.limit ?? 20
    const offset = filter?.offset ?? 0
    if (await _devGate() === 'empty') return { items: [], total: 0, limit, offset }

    const all: AuditEvent[] = []
    // Run-sourced events.
    if (!filter?.chat_id) {
      for (const run of Object.values(fxRuns)) {
        const version = run.agent_version_id ? fxVersions.find(v => v.id === run.agent_version_id) : undefined
        const agentId = version?.agent_id
        if (!agentId) continue
        if (!inSelectedWorkspaces(agentId, filter?.workspace_ids)) continue
        if (filter?.agent_id && filter.agent_id !== agentId) continue
        if (filter?.run_id && filter.run_id !== run.id) continue
        for (const step of run.steps) {
          if (filter?.from && step.created_at < filter.from) continue
          if (filter?.to && step.created_at > filter.to) continue
          all.push({
            id: step.id,
            run_id: run.id,
            chat_id: null,
            message_id: null,
            agent_id: agentId,
            step_type: stepTypeToAudit(step.step_type),
            status: step.status,
            tool_name: step.tool_name,
            model_name: step.model_name,
            cost_usd: step.cost_usd,
            tokens_in: step.tokens_in,
            tokens_out: step.tokens_out,
            duration_ms: step.duration_ms,
            created_at: step.created_at,
            completed_at: step.completed_at,
          })
        }
      }
    }
    // Chat-sourced events.
    if (!filter?.run_id) {
      for (const chat of fxChats) {
        if (!inSelectedWorkspaces(chat.agent_id, filter?.workspace_ids)) continue
        if (filter?.agent_id && filter.agent_id !== chat.agent_id) continue
        if (filter?.chat_id && filter.chat_id !== chat.id) continue
        const messages = fxChatMessages[chat.id] ?? []
        for (const msg of messages) {
          if (filter?.from && msg.created_at < filter.from) continue
          if (filter?.to && msg.created_at > filter.to) continue
          all.push({
            id: msg.id,
            run_id: null,
            chat_id: chat.id,
            message_id: msg.id,
            agent_id: chat.agent_id,
            step_type: msg.role === 'tool' ? 'chat_tool_call' : 'chat_message',
            status: 'completed',
            tool_name: msg.tool_name,
            model_name: msg.role === 'assistant' ? chat.model : null,
            cost_usd: msg.cost_usd,
            tokens_in: msg.tokens_in,
            tokens_out: msg.tokens_out,
            duration_ms: null,
            created_at: msg.created_at,
            completed_at: msg.created_at,
          })
        }
      }
    }
    all.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return {
      items: all.slice(offset, offset + limit),
      total: all.length,
      limit,
      offset,
    }
  },

  // ── GET /handoffs (mock-only) ─────────────────────────────────────
  // Surfaces inter-agent asks for /sandbox/team-map. Backend doesn't expose
  // this — see docs/backend-gaps.md § 1.16. Filter cascade scopes to the
  // active workspace via from_agent_id (handoffs never cross workspaces).
  // The `since` filter is ISO lower-bound on created_at; default unbounded
  // so the screen can re-window without re-fetching.
  async listHandoffs(filter?: { since?: string; workspace_ids?: string[] }): Promise<HandoffList> {
    await delay()
    if (await _devGate() === 'empty') return { items: [], total: 0 }
    const all = fxHandoffs
      .filter(h => inSelectedWorkspaces(h.from_agent_id, filter?.workspace_ids))
      .filter(h => !filter?.since || h.created_at >= filter.since)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return { items: all, total: all.length }
  },

  // ── GET /approvals ────────────────────────────────────────────────
  // Returns ApprovalList envelope (docs/gateway.yaml).
  async listApprovals(filter?: {
    status?: ApprovalRequest['status']
    limit?: number
    offset?: number
    workspace_ids?: string[]
  }): Promise<ApprovalList> {
    await delay()
    if (await _devGate() === 'empty') return { items: [], total: 0, limit: filter?.limit, offset: filter?.offset }
    const scenario = _trainingScenario()
    let list = scenario
      ? [...scenario.approvals]
      : fxApprovals.filter(a => inSelectedWorkspaces(approvalAgentId(a), filter?.workspace_ids))
    if (filter?.status) list = list.filter(a => a.status === filter.status)
    list.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return paginate(list, filter)
  },

  // GET /approvals/{id} (gateway v0.1.0). Direct single-fetch — backend
  // exposes the endpoint, no cache or list-sweep workaround needed.
  async getApproval(id: string): Promise<ApprovalRequest | undefined> {
    await delay()
    if (await _devGate() === 'empty') return undefined
    const scenario = _trainingScenario()
    if (scenario) return scenario.approvals.find(a => a.id === id)
    return fxApprovals.find(a => a.id === id)
  },

  // ── POST /approvals/{id}/decision ─────────────────────────────────
  // Per gateway v0.2.0: decision is enqueued, orchestrator resumes async.
  // Mock mimics that with a 1.5-3s delay before mutating approval, then
  // another 2-3s before the run reaches a terminal state (approved path).
  async decideApproval(
    id: string,
    decision: 'approved' | 'rejected',
    reason: string | null,
    byUserId: string,
  ): Promise<ApprovalDecisionAccepted> {
    await delay()
    // Mutations are sandboxed in training mode — return a synthetic queued
    // response so the optimistic UI keeps moving but no real fixture is
    // touched. Phase 6+ may add real per-scenario sandbox handling here.
    if (__activeTrainingScenario) {
      void reason; void byUserId
      return {
        approval_id: id,
        decision: decision === 'approved' ? 'approve' : 'reject',
        status: 'queued',
      }
    }
    const a = fxApprovals.find(a => a.id === id)
    if (!a) throw new Error('no approval')
    if (a.status !== 'pending') {
      throw Object.assign(new Error('Approval already resolved'), { code: 'already_resolved', current: a })
    }

    const resumeAt = 1500 + Math.random() * 1500
    const completeAt = resumeAt + 2000 + Math.random() * 1500

    // Stage 1 — orchestrator picks up the decision, approval flips.
    setTimeout(() => {
      if (a.status !== 'pending') return
      const now = new Date().toISOString()
      a.status = decision
      a.approver_user_id = byUserId
      a.resolved_at = now
      a.reason = reason

      // Chat-source approvals (a.chat_id != null per ADR-0011): resume the
      // chat by appending tool_result + agent's follow-up message (approve)
      // or single acknowledgement (reject). Chat status flips back to
      // 'active' inside applyChatResume.
      if (a.chat_id) {
        applyChatResume(a, decision, reason)
        return
      }
      const runId = a.run_id
      if (!runId) return
      const run = fxRuns[runId]
      if (!run) return
      const gate = run.steps.find(
        s => s.step_type === 'approval_gate' &&
        (s.input_ref as { approval_id?: string } | null)?.approval_id === a.id,
      )
      if (decision === 'approved') {
        if (run.status === 'suspended') {
          run.status = 'running'
          run.suspended_stage = null
        }
        if (gate) {
          gate.status = 'ok'
          gate.completed_at = now
        }
      } else {
        if (run.status === 'suspended' || run.status === 'running') {
          run.status = 'cancelled'
          run.ended_at = now
          run.suspended_stage = null
          run.error_message = `Approval ${a.id} rejected${reason ? `: ${reason}` : ''}`
        }
        if (gate) {
          gate.status = 'blocked'
          gate.completed_at = now
        }
      }
    }, resumeAt)

    // Stage 2 — run reaches terminal state (approved path only). Chat-source
    // approvals don't have a run terminal state to drive here.
    if (decision === 'approved' && a.run_id) {
      const runId = a.run_id
      setTimeout(() => {
        const run = fxRuns[runId]
        if (!run || run.status !== 'running') return
        const now = new Date().toISOString()
        run.status = 'completed'
        run.ended_at = now
      }, completeAt)
    }

    // `status` per gateway 0.2.0:
    //  - 'queued'   — chat-source: gateway queued an async resume on the outbox.
    //  - 'recorded' — run-source: gateway persisted the decision directly,
    //                 nothing else queued (orchestrator polls the row).
    return {
      approval_id: a.id,
      decision: decision === 'approved' ? 'approve' : 'reject',
      status: a.chat_id ? 'queued' : 'recorded',
    }
  },

  // ── Chat (docs/gateway.yaml) ───────────────────────────────────────

  // GET /chats — visibility scoped by role (member sees own, admin/domain_admin
  // see everything within tenant scope). The mock takes role + userId
  // explicitly because there is no implicit auth context in this layer.
  async listChats(
    viewer: { id: string; role: Role },
    filter?: { agent_id?: string; limit?: number; offset?: number; workspace_ids?: string[] },
  ): Promise<ChatList> {
    await delay()
    const limit = filter?.limit ?? 20
    const offset = filter?.offset ?? 0
    if (await _devGate() === 'empty') return { items: [], total: 0, limit, offset }
    const isAdmin = viewer.role === 'admin' || viewer.role === 'domain_admin'
    const training = trainingChats()
    const source = training ?? fxChats
    const all = source
      .filter(c => (isAdmin ? true : c.created_by === viewer.id))
      // Skip workspace filter inside training scenarios — they bring their
      // own chat set and have no workspace concept.
      .filter(c => (training ? true : inSelectedWorkspaces(c.agent_id, filter?.workspace_ids)))
      .filter(c => (filter?.agent_id ? c.agent_id === filter.agent_id : true))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    return {
      items: all.slice(offset, offset + limit),
      total: all.length,
      limit,
      offset,
    }
  },

  // GET /chat/{chatId}
  async getChat(id: string): Promise<Chat | undefined> {
    await delay()
    if (await _devGate() === 'empty') return undefined
    const training = trainingChats()
    if (training) return training.find(c => c.id === id)
    return fxChats.find(c => c.id === id)
  },

  // POST /chat — bind a new chat to an agent_version + model. Tenant and
  // creating user come from the caller's JWT in the real gateway; the mock
  // takes them as explicit args.
  async createChat(req: CreateChatRequest, viewer: User): Promise<Chat> {
    await delay()
    const training = trainingChats()
    const version = training
      ? trainingAgentVersion(req.agent_version_id)
      : fxVersions.find(v => v.id === req.agent_version_id)
    if (!version) throw new Error('agent version not found')
    const id = training
      ? `cht_train_${Date.now().toString(36)}`
      : `cht_${Math.floor(3000 + Math.random() * 6999)}`
    const now = new Date().toISOString()
    const chat: Chat = {
      id,
      tenant_id: viewer.tenant_id,
      agent_id: version.agent_id,
      agent_version_id: version.id,
      created_by: viewer.id,
      model: req.model ?? (version.model_chain_config as { primary?: string })?.primary ?? 'claude-haiku-4-5',
      title: req.title ?? null,
      status: 'active',
      started_at: now,
      updated_at: now,
      ended_at: null,
      total_cost_usd: 0,
      total_tokens_in: 0,
      total_tokens_out: 0,
    }
    // MOCK-ONLY: when seed_assistant_message is provided, prepend a synthetic
    // assistant ChatMessage so the chat lands non-empty. The real backend
    // does NOT support this — see docs/backend-gaps.md. Used by the
    // welcome-chat onboarding sandbox to deliver a per-template greeting.
    const seedMessages: ChatMessage[] = req.seed_assistant_message
      ? [
          {
            id: `msg_seed_${id}`,
            chat_id: id,
            role: 'assistant',
            content: req.seed_assistant_message,
            tool_calls: null,
            tool_call_id: null,
            tool_name: null,
            cost_usd: 0,
            tokens_in: 0,
            tokens_out: 0,
            created_at: now,
          },
        ]
      : []

    if (training) {
      training.unshift(chat)
      if (!__trainingChatMessages) __trainingChatMessages = {}
      __trainingChatMessages[id] = [...seedMessages]
      return chat
    }
    fxChats.unshift(chat)
    fxChatMessages[id] = [...seedMessages]
    return chat
  },

  // DELETE /chat/{chatId} — sets status=closed, stamps ended_at. Idempotent.
  async closeChat(id: string): Promise<void> {
    await delay()
    const training = trainingChats()
    const chat = training ? training.find(c => c.id === id) : fxChats.find(c => c.id === id)
    if (!chat) throw new Error('chat not found')
    if (chat.status === 'closed') return
    chat.status = 'closed'
    chat.ended_at = new Date().toISOString()
    chat.updated_at = chat.ended_at
  },

  // GET /chat/{chatId}/messages — newest-first per spec.
  async listChatMessages(
    chatId: string,
    filter?: { limit?: number; offset?: number },
  ): Promise<ChatMessageList> {
    await delay()
    const limit = filter?.limit ?? 50
    const offset = filter?.offset ?? 0
    if (await _devGate() === 'empty') return { items: [], total: 0, limit, offset }
    const source = trainingChatMessages(chatId) ?? fxChatMessages[chatId] ?? []
    const all = source
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return {
      items: all.slice(offset, offset + limit),
      total: all.length,
      limit,
      offset,
    }
  },

  // POST /chat/{chatId}/message — server-streamed turn. Returns an
  // AsyncIterable<ChatStreamFrame> mirroring the SSE frames the real gateway
  // emits. The shape matches what a fetch-based ReadableStream consumer would
  // see, so the screen-level loop won't change when we wire real http.
  sendChatMessage(
    chatId: string,
    req: SendMessageRequest,
  ): AsyncIterable<ChatStreamFrame> {
    return streamMockTurn(chatId, req)
  },

  // ── GET /tool-catalog (operationId `listToolCatalog` per gateway 0.3.0).
  // Mock method name is `listTools` for historical reasons — when swapping
  // to a real http client, point this method at `/tool-catalog` (NOT `/tools`,
  // which does not exist in spec) and consider renaming to `listToolCatalog`
  // for alignment with operationId. See docs/backend-gaps.md § 5.1.
  async listTools(): Promise<ToolDefinition[]> {
    await delay()
    if (await _devGate() === 'empty') return []
    return fxTools
  },

  // ── GET /internal/agents/{id}/grants/snapshot (gateway v0.2.0) ────
  async getGrantsSnapshot(agentId: string): Promise<GrantsSnapshot> {
    await delay()
    if (await _devGate() === 'empty') {
      return {
        agent_id: agentId,
        tenant_id: 'ten_acme',
        version: 'snap_empty',
        grants: [],
        issued_at: new Date().toISOString(),
      }
    }
    const scenario = _trainingScenario()
    const agent = (scenario?.agents ?? fxAgents).find(a => a.id === agentId)
    if (!agent) throw new Error('agent not found')
    const grants = trainingGrants(agentId) ?? grantsByAgent[agentId] ?? []
    const catalogByName = new Map(fxTools.map(t => [t.name, t] as const))

    const entries: GrantsSnapshotEntry[] = grants.map(g => ({
      tool_name: g.tool_name,
      mode: policyModeForGrant(g, catalogByName.get(g.tool_name)),
      approval_required: g.approval_required,
      scopes: scopesForGrant(g),
    }))

    // Stable version hash based on grant ids + modes (changes when grants edit).
    const versionSeed = grants
      .map(g => `${g.id}:${g.mode}:${g.approval_required ? '1' : '0'}`)
      .sort()
      .join('|')
    const version = `snap_${simpleHash(versionSeed)}`

    return {
      agent_id: agent.id,
      tenant_id: agent.tenant_id,
      version,
      grants: entries,
      issued_at: new Date().toISOString(),
    }
  },

  // ── GET /dashboard/spend ──────────────────────────────────────────
  // Workspace-scoped: byAgent rows filtered via agent.domain_id (workspace
  // FK per § 0.1); byUser rows filtered to members of the workspaces in
  // scope. Total is recomputed on the filtered slice so the hero number
  // matches the visible items.
  async getSpend(
    range: SpendRange = '7d',
    group_by: SpendGroupBy = 'agent',
    workspaceIds?: string[],
  ): Promise<SpendDashboard> {
    await delay()
    if (await _devGate() === 'empty') return { range, group_by, total_usd: 0, items: [] }
    const full = getSpendDashboard(range, group_by)
    const items = full.items.filter(row =>
      group_by === 'agent'
        ? inSelectedWorkspaces(row.id, workspaceIds)
        : userInSelectedWorkspaces(row.id, workspaceIds),
    )
    const total_usd = Math.round(items.reduce((s, r) => s + r.total_usd, 0) * 100) / 100
    return { range, group_by, total_usd, items }
  },

  // ──────────────────────────────────────────────────────────────────
  // Workspaces (mock-only — no backend CRUD endpoints exist; see
  // docs/backend-gaps.md § 1.15). Mutations write straight into the
  // fxWorkspaces / fxWorkspaceMemberships arrays + agent.domain_id
  // (the spec-level workspace FK, § 0.1) and persist for the lifetime
  // of the page load only.
  // ──────────────────────────────────────────────────────────────────

  // GET /workspaces — workspaces the calling user belongs to.
  async listWorkspaces(userId: string): Promise<WorkspaceList> {
    await delay()
    if (await _devGate() === 'empty') return { items: [], total: 0 }
    const myIds = new Set(
      fxWorkspaceMemberships
        .filter(m => m.user_id === userId)
        .map(m => m.workspace_id),
    )
    const items = fxWorkspaces.filter(w => myIds.has(w.id))
    return { items, total: items.length }
  },

  async getWorkspace(id: string): Promise<Workspace> {
    await delay()
    const w = fxWorkspaces.find(w => w.id === id)
    if (!w) throw new Error('Workspace not found')
    return w
  },

  // Mock-only — tenant-wide workspace list, ignoring caller's memberships.
  // Used by /company/members so admin / domain_admin can resolve workspace
  // names for users outside their own workspace(s). No backend counterpart
  // yet (Workspace schema is mock-only).
  async listAllWorkspaces(): Promise<Workspace[]> {
    await delay()
    if (await _devGate() === 'empty') return []
    return [...fxWorkspaces]
  },

  // POST /workspaces — creator is auto-joined.
  async createWorkspace(input: CreateWorkspaceRequest, creatorUserId: string): Promise<Workspace> {
    await delay()
    const name = input.name.trim()
    if (!name) throw new Error('Workspace name is required')

    const segment = toIdSegment(name, 'workspace')
    let id = `ws_${segment}`
    let suffix = 2
    while (fxWorkspaces.some(w => w.id === id)) {
      id = `ws_${segment}_${suffix}`
      suffix += 1
    }

    const ws: Workspace = {
      id,
      name,
      description: input.description?.trim() || undefined,
      created_at: new Date().toISOString(),
    }
    fxWorkspaces.push(ws)
    fxWorkspaceMemberships.push({
      workspace_id: id,
      user_id: creatorUserId,
      joined_at: ws.created_at,
    })
    return ws
  },

  // PATCH /workspaces/{id}
  async updateWorkspace(id: string, patch: UpdateWorkspaceRequest): Promise<Workspace> {
    await delay()
    const w = fxWorkspaces.find(w => w.id === id)
    if (!w) throw new Error('Workspace not found')
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim()
      if (!trimmed) throw new Error('Workspace name is required')
      w.name = trimmed
    }
    if (patch.description !== undefined) {
      w.description = patch.description.trim() || undefined
    }
    return w
  },

  // DELETE /workspaces/{id} — last-workspace block enforced if userId is
  // passed (membership check). Cascade hard-deletes:
  //   - workspace memberships
  //   - agent → workspace map entries
  //   - agents themselves (mock equivalent of "archive on backend")
  async deleteWorkspace(id: string, userId?: string): Promise<void> {
    await delay()
    const idx = fxWorkspaces.findIndex(w => w.id === id)
    if (idx < 0) throw new Error('Workspace not found')

    if (userId) {
      const myCount = fxWorkspaceMemberships
        .filter(m => m.user_id === userId)
        .length
      const isMine = fxWorkspaceMemberships
        .some(m => m.user_id === userId && m.workspace_id === id)
      if (isMine && myCount <= 1) {
        throw new Error('Cannot delete your only workspace')
      }
    }

    // Cascade: drop agents whose domain_id points at this workspace
    // (§ 0.1: agent.domain_id IS the workspace FK). Their grants/versions
    // get dropped indirectly — listAgents filters on agent.domain_id, and
    // approvals/runs key off agent_id, so once the agent itself is gone
    // the cascade is automatic.
    for (let i = fxAgents.length - 1; i >= 0; i -= 1) {
      if (fxAgents[i].domain_id === id) fxAgents.splice(i, 1)
    }

    // Drop memberships pointing at this workspace.
    for (let i = fxWorkspaceMemberships.length - 1; i >= 0; i -= 1) {
      if (fxWorkspaceMemberships[i].workspace_id === id) {
        fxWorkspaceMemberships.splice(i, 1)
      }
    }

    fxWorkspaces.splice(idx, 1)
  },

  // GET /workspaces/{id}/members — read-only list (full
  // invite/remove flow needs GET /users + invite endpoints, neither
  // exists in spec; see docs/backend-gaps.md § 1.15).
  async listWorkspaceMembers(workspaceId: string): Promise<User[]> {
    await delay()
    const userIds = new Set(
      fxWorkspaceMemberships
        .filter(m => m.workspace_id === workspaceId)
        .map(m => m.user_id),
    )
    return fxUsers.filter(u => userIds.has(u.id))
  },

  // Companion to listWorkspaces — returns counts per workspace for the
  // /workspaces card grid. Returned as a Record<workspaceId, stats> so the
  // caller can join in O(1). Spans all workspaces, not just the caller's
  // memberships — the caller filters to its own.
  async listWorkspaceStats(): Promise<Record<string, { member_count: number; agent_count: number }>> {
    await delay()
    const out: Record<string, { member_count: number; agent_count: number }> = {}
    for (const w of fxWorkspaces) {
      const member_count = fxWorkspaceMemberships.filter(m => m.workspace_id === w.id).length
      const agent_count = fxAgents.filter(a => a.domain_id === w.id).length
      out[w.id] = { member_count, agent_count }
    }
    return out
  },

  // Find a workspace by name *among the user's memberships*. Case-insensitive,
  // exact match. Returns null if no such workspace is in scope. Restricting
  // by membership avoids global-name collisions (someone else may have a ws
  // with the same name the user can't see).
  //
  // Used by the hire flow to decide whether to reuse an existing workspace
  // or auto-create a new one when applying a template's defaultWorkspaceName.
  // Mock-only — no backend endpoint behind this.
  async findMyWorkspaceByName(name: string, userId: string): Promise<Workspace | null> {
    await delay()
    const normalized = name.trim().toLowerCase()
    if (!normalized) return null
    const myIds = new Set(
      fxWorkspaceMemberships
        .filter(m => m.user_id === userId)
        .map(m => m.workspace_id),
    )
    const found = fxWorkspaces.find(
      w => myIds.has(w.id) && w.name.trim().toLowerCase() === normalized,
    )
    return found ?? null
  },

  // Snapshot of agent → workspace mapping. Used by the Costs screen for
  // client-side per-workspace aggregation in multi-scope mode. Reads
  // `agent.domain_id` directly (§ 0.1: domain ≡ workspace). When backend
  // ships /spend?group_by=workspace this can be removed.
  async getAgentWorkspaceMap(): Promise<Record<string, string>> {
    await delay()
    const map: Record<string, string> = {}
    for (const a of fxAgents) {
      if (a.domain_id) map[a.id] = a.domain_id
    }
    return map
  },

  // Read the workspace an agent currently belongs to. Returns null if the
  // agent isn't assigned (domain_id null). Reads agent.domain_id directly
  // (§ 0.1: backend domain ≡ frontend workspace).
  async getAgentWorkspace(agentId: string): Promise<Workspace | null> {
    await delay()
    const agent = fxAgents.find(a => a.id === agentId)
    if (!agent?.domain_id) return null
    return fxWorkspaces.find(w => w.id === agent.domain_id) ?? null
  },

  // Move an agent to a different workspace. Thin wrapper around
  // PATCH /agents/{id} with { domain_id } — the mutation shape is real
  // (gateway 0.3.0). The mock-only part is the Workspace concept itself:
  // no Workspace schema or /workspaces endpoints exist in spec, so the
  // workspaceId we pass refers to a client-side fixture rather than a
  // real backend record (see docs/backend-gaps.md § 1.15). The client
  // pre-validates that the workspace exists in our fixtures — the real
  // backend would return 422 on an unknown domain_id.
  // Used by hire-flow target override and by the AgentDetail Settings
  // "Move to" affordance.
  async setAgentWorkspace(agentId: string, workspaceId: string): Promise<void> {
    const ws = fxWorkspaces.find(w => w.id === workspaceId)
    if (!ws) throw new Error('Workspace not found')
    await api.patchAgent(agentId, { domain_id: workspaceId })
  },
}

function policyModeForGrant(grant: ToolGrant, def: ToolDefinition | undefined): ToolPolicyMode {
  if (def?.default_mode === 'denied') return 'denied'
  if (grant.approval_required) return 'requires_approval'
  if (grant.mode === 'read') return 'read_only'
  return def?.default_mode ?? 'requires_approval'
}

function scopesForGrant(grant: ToolGrant): string[] | undefined {
  const raw = (grant.config as { scopes?: unknown })?.scopes
  if (Array.isArray(raw) && raw.every(s => typeof s === 'string')) return raw as string[]
  return undefined
}

// ──────────────────────────────────────────────────────────────────
// Chat streaming (mock SSE)
// ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Canned assistant replies — rotated by message count so demos stay varied.
const MOCK_REPLIES = [
  "Got it. I'll start by pulling the most recent context, then walk through the options.",
  "Quick check — let me confirm the policy before I act.",
  "Here's what I'd do: gather the evidence first, then propose a draft for your review.",
  "I need to look this up. Standby.",
]

const MOCK_FOLLOWUPS = [
  "\n\nLet me know if you'd like me to take action or hand it off.",
  "\n\nWant me to draft the next step or summarize what we have so far?",
  "\n\nHappy to dig deeper if you point me at a thread.",
]

// Whether the input warrants a tool-call detour. Heuristic — keeps the demo
// flow lively when the user asks for lookups.
function shouldUseTool(input: string): boolean {
  const k = input.toLowerCase()
  return /\b(look ?up|find|search|check|fetch|read|verify|pull)\b/.test(k)
}

// Chat-side approval support (gateway 0.2.0 / ADR-0011).
//
// When the user asks for an approval-gated action (refund, send email, etc.)
// the streamer emits a `tool_call` frame, then `'suspended'`, ends the stream,
// flips chat.status → 'awaiting_approval', and creates an ApprovalRequest
// row with chat_id set. `decideApproval` later picks up the resume via
// `applyChatResume` — appending tool_result + the agent's follow-up message
// to fxChatMessages and flipping chat.status back to 'active'.

interface ChatResumeContext {
  approvalId: string
  chatId: string
  toolName: string
  toolCallId: string
}

const pendingResumes = new Map<string, ChatResumeContext>()

// Detect user intent that needs an approval-gated tool. Returns the tool
// spec or null. Trigger words are deliberately narrow — most chat turns
// fall through to the standard kb.lookup or text-only path.
function detectApprovalNeeded(input: string): {
  tool: string
  toolCallId: string
  args: Record<string, unknown>
  action: string
  evidenceRef: Record<string, unknown>
} | null {
  const k = input.toLowerCase()
  const toolCallId = `tcl_${Date.now()}`

  // Refund — extract a dollar amount if present.
  const refundMatch = k.match(/refund[^.]*?\$?(\d+)/)
  if (refundMatch && /refund/.test(k)) {
    const amount = Number(refundMatch[1])
    return {
      tool: 'stripe.refund',
      toolCallId,
      args: { amount_usd: amount, charge_id: 'ch_3P8fL2' },
      action: `stripe.refund · $${amount} on charge ch_3P8fL2`,
      evidenceRef: { amount_usd: amount, charge_id: 'ch_3P8fL2' },
    }
  }

  // Email send.
  if (/\bsend[^.]*?(email|reply|message)\b/.test(k) || /\breply[^.]*?to\b/.test(k)) {
    return {
      tool: 'gmail.send',
      toolCallId,
      args: { recipient: 'customer@example.com', subject: 'Re: your request' },
      action: 'gmail.send · reply to customer email',
      evidenceRef: { recipient: 'customer@example.com' },
    }
  }

  return null
}

// Resume a chat after its approval is decided. Called from `decideApproval`
// when the approval is chat-anchored. Synthesises the post-decision tail
// (tool_result + agent's final message on approve, single message on reject)
// and flips chat.status back to 'active'.
function applyChatResume(
  approval: ApprovalRequest,
  decision: 'approved' | 'rejected',
  reason: string | null,
): void {
  if (!approval.chat_id) return
  const chat = fxChats.find(c => c.id === approval.chat_id)
  if (!chat) return

  const ctx = pendingResumes.get(approval.id)
  pendingResumes.delete(approval.id)

  // For pre-seeded fixture approvals (no pendingResume context) — derive
  // a sensible tool name from the action prefix.
  const toolName = ctx?.toolName ?? approval.requested_action.split(/[\s·]/)[0] ?? 'unknown'
  const toolCallId = ctx?.toolCallId ?? `tcl_resume_${approval.id}`

  const list = fxChatMessages[chat.id] ?? []
  const now = new Date().toISOString()
  const ts = Date.now()

  if (decision === 'approved') {
    list.push({
      id: `msg_${chat.id}_${ts}_t`,
      chat_id: chat.id,
      role: 'tool',
      content: JSON.stringify({ status: 'ok' }),
      tool_calls: null,
      tool_call_id: toolCallId,
      tool_name: toolName,
      cost_usd: null,
      tokens_in: null,
      tokens_out: null,
      created_at: now,
    })
    list.push({
      id: `msg_${chat.id}_${ts + 1}_a`,
      chat_id: chat.id,
      role: 'assistant',
      content: `Done — ${toolName} completed. Let me know if you'd like anything else.`,
      tool_calls: null,
      tool_call_id: null,
      tool_name: null,
      cost_usd: 0.04,
      tokens_in: 320,
      tokens_out: 80,
      created_at: now,
    })
  } else {
    list.push({
      id: `msg_${chat.id}_${ts}_a`,
      chat_id: chat.id,
      role: 'assistant',
      content: `Understood — I won't proceed with that action.${reason ? ` Noted: ${reason}` : ''}`,
      tool_calls: null,
      tool_call_id: null,
      tool_name: null,
      cost_usd: 0.02,
      tokens_in: 160,
      tokens_out: 40,
      created_at: now,
    })
  }

  fxChatMessages[chat.id] = list
  chat.status = 'active'
  chat.updated_at = now
}

async function* streamMockTurn(
  chatId: string,
  req: SendMessageRequest,
): AsyncIterable<ChatStreamFrame> {
  const training = trainingChats()
  const trainingMessages = training ? trainingChatMessages(chatId) : null
  const chat = training ? training.find(c => c.id === chatId) : fxChats.find(c => c.id === chatId)
  if (!chat) throw new Error('chat not found')
  if (chat.status === 'awaiting_approval') {
    // Mock-equivalent of the real backend's 409 on POST /chat/{id}/message
    // while suspended (gateway 0.2.0 / ADR-0011).
    yield {
      event: 'error',
      kind: 'llm_error',
      message: 'Chat is paused — waiting for your decision on a pending approval.',
    }
    return
  }
  if (chat.status !== 'active') {
    yield { event: 'error', kind: 'llm_error', message: 'Chat is closed.' }
    return
  }

  // Persist the user message immediately so listChatMessages reflects it.
  const userMsgId = `msg_${chatId}_${Date.now()}_u`
  const userCreatedAt = new Date().toISOString()
  const list = trainingMessages ?? fxChatMessages[chatId] ?? []
  list.push({
    id: userMsgId,
    chat_id: chatId,
    role: 'user',
    content: req.content,
    tool_calls: null,
    tool_call_id: null,
    tool_name: null,
    cost_usd: null,
    tokens_in: null,
    tokens_out: null,
    created_at: userCreatedAt,
  })
  if (trainingMessages) __trainingChatMessages = { ...(__trainingChatMessages ?? {}), [chatId]: list }
  else fxChatMessages[chatId] = list

  await sleep(180)

  // Begin assistant turn.
  const assistantMsgId = `msg_${chatId}_${Date.now()}_a`
  yield { event: 'turn_start', message_id: assistantMsgId }

  let assistantContent = ''

  // Approval-gated path (gateway 0.2.0 / ADR-0011). When the user asks for
  // a refund / email send / similar, the agent emits a tool_call → suspended,
  // the chat flips to 'awaiting_approval', and an ApprovalRequest record is
  // pushed. The turn does NOT continue — `decideApproval` later calls
  // `applyChatResume` to append the post-decision tail.
  const approvalNeeded = !trainingMessages ? detectApprovalNeeded(req.content) : null
  if (approvalNeeded) {
    const prefix = "Sure — I'll prepare that. It needs your approval before I can finish."
    for (const chunk of chunkText(prefix, 16)) {
      yield { event: 'text_delta', delta: chunk }
      assistantContent += chunk
      await sleep(50 + Math.random() * 70)
    }
    // Persist the partial assistant message so reload after suspension shows
    // the agent's pre-decision context (text + the tool_call it wants to run).
    const partialCreatedAt = new Date().toISOString()
    list.push({
      id: assistantMsgId,
      chat_id: chatId,
      role: 'assistant',
      content: assistantContent,
      tool_calls: [{ id: approvalNeeded.toolCallId, name: approvalNeeded.tool, args: approvalNeeded.args }],
      tool_call_id: null,
      tool_name: null,
      cost_usd: 0.03,
      tokens_in: 240,
      tokens_out: 60,
      created_at: partialCreatedAt,
    })
    fxChatMessages[chatId] = list

    yield {
      event: 'tool_call',
      tool: approvalNeeded.tool,
      tool_call_id: approvalNeeded.toolCallId,
      args: approvalNeeded.args,
    }

    // Spawn the ApprovalRequest record.
    const approvalId = `apv_${Date.now()}`
    const nowIso = new Date().toISOString()
    fxApprovals.unshift({
      id: approvalId,
      run_id: null,
      chat_id: chatId,
      task_id: null,
      tenant_id: chat.tenant_id,
      requested_action: approvalNeeded.action,
      requested_by: chat.created_by,
      approver_role: 'domain_admin',
      approver_user_id: null,
      status: 'pending',
      reason: null,
      evidence_ref: approvalNeeded.evidenceRef,
      expires_at: new Date(Date.now() + 6 * 3_600_000).toISOString(),
      resolved_at: null,
      created_at: nowIso,
    })
    pendingResumes.set(approvalId, {
      approvalId,
      chatId,
      toolName: approvalNeeded.tool,
      toolCallId: approvalNeeded.toolCallId,
    })
    chat.status = 'awaiting_approval'
    chat.updated_at = nowIso

    yield {
      event: 'suspended',
      approval_id: approvalId,
      tool: approvalNeeded.tool,
      tool_call_id: approvalNeeded.toolCallId,
    }
    return
  }

  const useTool = shouldUseTool(req.content)
  const toolCalls: ChatStreamFrame[] = []

  if (useTool) {
    // Pre-tool prefix.
    const prefix = "Let me check the source first."
    for (const chunk of chunkText(prefix, 14)) {
      yield { event: 'text_delta', delta: chunk }
      assistantContent += chunk
      await sleep(60 + Math.random() * 80)
    }
    const toolCallId = `tcl_${chatId}_${Date.now()}`
    yield {
      event: 'tool_call',
      tool: 'kb.lookup',
      tool_call_id: toolCallId,
      args: { query: req.content.slice(0, 80) },
    }
    toolCalls.push({
      event: 'tool_call',
      tool: 'kb.lookup',
      tool_call_id: toolCallId,
      args: { query: req.content.slice(0, 80) },
    })
    await sleep(800 + Math.random() * 600)
    yield {
      event: 'tool_result',
      tool_call_id: toolCallId,
      status: 'ok',
      output_ref: { hits: 3, top_score: 0.84 },
    }
    await sleep(180)
  }

  // Stream the main reply text.
  const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)]
    + (useTool ? '\n\nBased on what I found: 3 relevant entries with strong score (0.84). Top match looks directly applicable.' : '')
    + MOCK_FOLLOWUPS[Math.floor(Math.random() * MOCK_FOLLOWUPS.length)]

  for (const chunk of chunkText(reply, 18)) {
    yield { event: 'text_delta', delta: chunk }
    assistantContent += chunk
    await sleep(40 + Math.random() * 70)
  }

  // Synthesize cost/token aggregates for the turn.
  const tokens_in = Math.round(900 + Math.random() * 1800)
  const tokens_out = Math.round(220 + Math.random() * 480)
  const cost_usd = Math.round((tokens_in * 0.000003 + tokens_out * 0.000015) * 1000) / 1000

  // Persist the assistant message + any tool messages, update chat aggregates.
  const assistantCreatedAt = new Date().toISOString()
  list.push({
    id: assistantMsgId,
    chat_id: chatId,
    role: 'assistant',
    content: assistantContent,
    tool_calls:
      toolCalls.length > 0
        ? toolCalls.map(t =>
            t.event === 'tool_call'
              ? { id: t.tool_call_id, name: t.tool, args: t.args }
              : { id: 'unknown', name: 'unknown', args: {} },
          )
        : null,
    tool_call_id: null,
    tool_name: null,
    cost_usd,
    tokens_in,
    tokens_out,
    created_at: assistantCreatedAt,
  })

  if (toolCalls.length > 0) {
    for (const tc of toolCalls) {
      if (tc.event !== 'tool_call') continue
      list.push({
        id: `msg_${chatId}_${Date.now()}_t`,
        chat_id: chatId,
        role: 'tool',
        content: JSON.stringify({ hits: 3, top_score: 0.84 }),
        tool_calls: null,
        tool_call_id: tc.tool_call_id,
        tool_name: tc.tool,
        cost_usd: null,
        tokens_in: null,
        tokens_out: null,
        created_at: assistantCreatedAt,
      })
    }
  }
  if (trainingMessages) __trainingChatMessages = { ...(__trainingChatMessages ?? {}), [chatId]: list }
  else fxChatMessages[chatId] = list

  chat.total_cost_usd = Math.round((chat.total_cost_usd + cost_usd) * 1000) / 1000
  chat.total_tokens_in += tokens_in
  chat.total_tokens_out += tokens_out
  chat.updated_at = assistantCreatedAt

  yield {
    event: 'turn_end',
    message_id: assistantMsgId,
    cost_usd,
    tokens_in,
    tokens_out,
  }
  await sleep(60)
  yield { event: 'done' }
}

// Split a string into ~size-character chunks aligned on word boundaries when
// possible, so the streamed deltas read naturally rather than mid-word.
function chunkText(text: string, size: number): string[] {
  const out: string[] = []
  let i = 0
  while (i < text.length) {
    const end = Math.min(i + size, text.length)
    let cut = end
    if (end < text.length) {
      const slice = text.slice(i, end + 6)
      const ws = slice.search(/\s/)
      if (ws > 0 && i + ws < text.length) cut = i + ws + 1
    }
    out.push(text.slice(i, cut))
    i = cut
  }
  return out
}

// Map RunStep.step_type → canonical audit step_type per docs/gateway.yaml.
// Run-side values are intentionally a small enum: llm | tool_call | approval_wait | system.
function stepTypeToAudit(kind: RunStepType): string {
  if (kind === 'llm_call') return 'llm'
  if (kind === 'tool_call') return 'tool_call'
  if (kind === 'approval_gate') return 'approval_wait'
  return 'system'
}

function simpleHash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
