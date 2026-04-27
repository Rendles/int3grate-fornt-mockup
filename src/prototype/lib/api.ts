import {
  agents as fxAgents,
  agentVersions as fxVersions,
  approvals as fxApprovals,
  chats as fxChats,
  chatMessages as fxChatMessages,
  fxTools,
  grantsByAgent,
  runs as fxRuns,
  getAgentStats,
  getSpendDashboard,
  tasks as fxTasks,
  users as fxUsers,
} from './fixtures'
import type {
  Agent,
  AgentList,
  AgentVersion,
  ApprovalDecisionAccepted,
  ApprovalList,
  ApprovalRequest,
  AuditEvent,
  AuditList,
  Chat,
  ChatList,
  ChatMessageList,
  ChatStreamFrame,
  CreateChatRequest,
  GrantsSnapshot,
  GrantsSnapshotEntry,
  LoginResponse,
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
  Task,
  TaskList,
  ToolDefinition,
  ToolGrant,
  ToolPolicyMode,
  User,
} from './types'

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

export const api = {
  // ── POST /auth/login ──────────────────────────────────────────────
  // Returns LoginResponse { token, expires_at } per gateway (5).yaml.
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

  // ── GET /users (resolution helper for owner_user_id, requested_by, etc.)
  async listUsers(): Promise<User[]> {
    await delay()
    return [...fxUsers]
  },

  // ── GET /agents ────────────────────────────────────────────────────
  // Returns AgentList envelope (gateway (5).yaml). Detail-only enrichment
  // fields (total_spend_usd, runs_count) are null on list views per spec.
  async listAgents(filter?: { limit?: number; offset?: number }): Promise<AgentList> {
    await delay()
    return paginate(fxAgents, filter)
  },

  // ── GET /agents/{id} ───────────────────────────────────────────────
  // Detail view enriches the Agent with total_spend_usd / runs_count
  // (gateway (5).yaml). List view leaves these null.
  async getAgent(id: string): Promise<Agent | undefined> {
    await delay()
    const a = fxAgents.find(a => a.id === id)
    if (!a) return undefined
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
    return agent
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
      a.updated_at = new Date().toISOString()
    }
    return v
  },

  // ── GET /agents/{id}/grants ───────────────────────────────────────
  async getGrants(agentId: string): Promise<ToolGrant[]> {
    await delay()
    return grantsByAgent[agentId] ?? []
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
    grantsByAgent[agentId] = next
    const a = fxAgents.find(a => a.id === agentId)
    if (a) a.updated_at = new Date().toISOString()
    return next
  },

  // ── GET /tasks ────────────────────────────────────────────────────
  // Returns TaskList envelope (gateway (5).yaml, x-mvp-deferred).
  async listTasks(filter?: { status?: Task['status']; limit?: number; offset?: number }): Promise<TaskList> {
    await delay()
    let list = [...fxTasks]
    if (filter?.status) list = list.filter(t => t.status === filter.status)
    list.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return paginate(list, filter)
  },

  // ── POST /tasks ───────────────────────────────────────────────────
  async createTask(input: {
    agent_id: string
    user_input: string
    type?: Task['type']
    title?: string
    domain_id?: string | null
  }): Promise<Task> {
    await delay()
    void input.user_input // user_input is accepted by POST /tasks but is not echoed back in the Task response
    const agent = fxAgents.find(a => a.id === input.agent_id)
    if (!agent) throw new Error('agent not found')
    const now = new Date().toISOString()
    const t: Task = {
      id: `tsk_${Math.floor(Math.random() * 9000 + 1000)}`,
      tenant_id: agent.tenant_id,
      domain_id: input.domain_id ?? agent.domain_id ?? null,
      type: input.type ?? 'chat',
      status: 'pending',
      title: input.title ?? null,
      created_by: 'usr_ada',
      assigned_agent_id: input.agent_id,
      assigned_agent_version_id: agent.active_version?.id ?? null,
      created_at: now,
      updated_at: now,
    }
    fxTasks.unshift(t)
    return t
  },

  // ── GET /tasks/{id} ───────────────────────────────────────────────
  async getTask(id: string): Promise<Task | undefined> {
    await delay()
    return fxTasks.find(t => t.id === id)
  },

  // ── GET /runs/{id} ────────────────────────────────────────────────
  // Returns RunDetail (gateway (5).yaml schema name).
  async getRun(id: string): Promise<RunDetail | undefined> {
    await delay()
    return fxRuns[id]
  },

  // ── GET /dashboard/runs ───────────────────────────────────────────
  // Paginated list of runs with denormalized agent_id (gateway (5).yaml).
  async listRuns(filter?: {
    status?: RunStatus
    limit?: number
    offset?: number
  }): Promise<RunsList> {
    await delay()
    const limit = filter?.limit ?? 20
    const offset = filter?.offset ?? 0
    const all = Object.values(fxRuns)
      .filter(r => (filter?.status ? r.status === filter.status : true))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    const items: RunListItem[] = all.slice(offset, offset + limit).map(r => {
      const version = r.agent_version_id
        ? fxVersions.find(v => v.id === r.agent_version_id)
        : undefined
      return {
        id: r.id,
        tenant_id: r.tenant_id,
        domain_id: r.domain_id,
        task_id: r.task_id,
        agent_id: version?.agent_id ?? null,
        agent_version_id: r.agent_version_id,
        status: r.status,
        suspended_stage: r.suspended_stage,
        started_at: r.started_at,
        ended_at: r.ended_at,
        total_cost_usd: r.total_cost_usd,
        total_tokens_in: r.total_tokens_in,
        total_tokens_out: r.total_tokens_out,
        created_at: r.created_at,
      }
    })
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
  }): Promise<AuditList> {
    await delay()
    if (filter?.run_id && filter?.chat_id) {
      throw Object.assign(new Error('run_id and chat_id are mutually exclusive'), { code: 'validation_error' })
    }
    const limit = filter?.limit ?? 20
    const offset = filter?.offset ?? 0

    const all: AuditEvent[] = []
    // Run-sourced events.
    if (!filter?.chat_id) {
      for (const run of Object.values(fxRuns)) {
        const version = run.agent_version_id ? fxVersions.find(v => v.id === run.agent_version_id) : undefined
        const agentId = version?.agent_id
        if (!agentId) continue
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

  // ── GET /approvals ────────────────────────────────────────────────
  // Returns ApprovalList envelope (gateway (5).yaml).
  async listApprovals(filter?: { status?: ApprovalRequest['status']; limit?: number; offset?: number }): Promise<ApprovalList> {
    await delay()
    let list = [...fxApprovals]
    if (filter?.status) list = list.filter(a => a.status === filter.status)
    list.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return paginate(list, filter)
  },

  async getApproval(id: string): Promise<ApprovalRequest | undefined> {
    await delay()
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

      const run = fxRuns[a.run_id]
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
        if (a.task_id) {
          const task = fxTasks.find(t => t.id === a.task_id)
          if (task && (task.status === 'pending' || task.status === 'running')) {
            task.status = 'cancelled'
            task.updated_at = now
          }
        }
      }
    }, resumeAt)

    // Stage 2 — run reaches terminal state (approved path only).
    if (decision === 'approved') {
      setTimeout(() => {
        const run = fxRuns[a.run_id]
        if (!run || run.status !== 'running') return
        const now = new Date().toISOString()
        run.status = 'completed'
        run.ended_at = now
        if (a.task_id) {
          const task = fxTasks.find(t => t.id === a.task_id)
          if (task && task.status === 'running') {
            task.status = 'completed'
            task.updated_at = now
          }
        }
      }, completeAt)
    }

    return {
      approval_id: a.id,
      decision: decision === 'approved' ? 'approve' : 'reject',
      status: 'queued',
    }
  },

  // ── Chat (gateway (5).yaml) ───────────────────────────────────────

  // GET /chats — visibility scoped by role (member sees own, admin/domain_admin
  // see everything within tenant scope). The mock takes role + userId
  // explicitly because there is no implicit auth context in this layer.
  async listChats(
    viewer: { id: string; role: Role },
    filter?: { agent_id?: string; limit?: number; offset?: number },
  ): Promise<ChatList> {
    await delay()
    const limit = filter?.limit ?? 20
    const offset = filter?.offset ?? 0
    const isAdmin = viewer.role === 'admin' || viewer.role === 'domain_admin'
    const all = fxChats
      .filter(c => (isAdmin ? true : c.created_by === viewer.id))
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
    return fxChats.find(c => c.id === id)
  },

  // POST /chat — bind a new chat to an agent_version + model. Tenant and
  // creating user come from the caller's JWT in the real gateway; the mock
  // takes them as explicit args.
  async createChat(req: CreateChatRequest, viewer: User): Promise<Chat> {
    await delay()
    const version = fxVersions.find(v => v.id === req.agent_version_id)
    if (!version) throw new Error('agent version not found')
    const id = `cht_${Math.floor(3000 + Math.random() * 6999)}`
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
    fxChats.unshift(chat)
    fxChatMessages[id] = []
    return chat
  },

  // DELETE /chat/{chatId} — sets status=closed, stamps ended_at. Idempotent.
  async closeChat(id: string): Promise<void> {
    await delay()
    const chat = fxChats.find(c => c.id === id)
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
    const all = (fxChatMessages[chatId] ?? [])
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

  // ── GET /tools (gateway v0.2.0) ───────────────────────────────────
  async listTools(): Promise<ToolDefinition[]> {
    await delay()
    return fxTools
  },

  // ── GET /internal/agents/{id}/grants/snapshot (gateway v0.2.0) ────
  async getGrantsSnapshot(agentId: string): Promise<GrantsSnapshot> {
    await delay()
    const agent = fxAgents.find(a => a.id === agentId)
    if (!agent) throw new Error('agent not found')
    const grants = grantsByAgent[agentId] ?? []
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
  async getSpend(range: SpendRange = '7d', group_by: SpendGroupBy = 'agent'): Promise<SpendDashboard> {
    await delay()
    return getSpendDashboard(range, group_by)
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

async function* streamMockTurn(
  chatId: string,
  req: SendMessageRequest,
): AsyncIterable<ChatStreamFrame> {
  const chat = fxChats.find(c => c.id === chatId)
  if (!chat) throw new Error('chat not found')
  if (chat.status !== 'active') {
    yield { event: 'error', kind: 'llm_error', message: 'Chat is closed.' }
    return
  }

  // Persist the user message immediately so listChatMessages reflects it.
  const userMsgId = `msg_${chatId}_${Date.now()}_u`
  const userCreatedAt = new Date().toISOString()
  const list = fxChatMessages[chatId] ?? []
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
  fxChatMessages[chatId] = list

  await sleep(180)

  // Begin assistant turn.
  const assistantMsgId = `msg_${chatId}_${Date.now()}_a`
  yield { event: 'turn_start', message_id: assistantMsgId }

  let assistantContent = ''
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
  fxChatMessages[chatId] = list

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

// Map RunStep.step_type → canonical audit step_type per gateway (5).yaml.
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
