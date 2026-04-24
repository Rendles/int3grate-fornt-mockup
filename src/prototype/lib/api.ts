import {
  agents as fxAgents,
  agentVersions as fxVersions,
  approvals as fxApprovals,
  fxTools,
  grantsByAgent,
  runs as fxRuns,
  getSpendDashboard,
  tasks as fxTasks,
  users as fxUsers,
} from './fixtures'
import type {
  Agent,
  AgentVersion,
  ApprovalDecisionAccepted,
  ApprovalRequest,
  GrantsSnapshot,
  GrantsSnapshotEntry,
  ReplaceToolGrantsRequest,
  Run,
  SpendDashboard,
  SpendGroupBy,
  SpendRange,
  Task,
  ToolDefinition,
  ToolGrant,
  ToolPolicyMode,
  User,
} from './types'

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

export const api = {
  // ── Auth ───────────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<User> {
    void password
    await delay()
    const u = fxUsers.find(u => u.email === email)
    if (!u) throw new Error('No such user')
    return u
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
  async me(userId: string): Promise<User> {
    await delay()
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
  async listAgents(): Promise<Agent[]> {
    await delay()
    return fxAgents
  },

  // ── GET /agents/{id} ───────────────────────────────────────────────
  async getAgent(id: string): Promise<Agent | undefined> {
    await delay()
    return fxAgents.find(a => a.id === id)
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
  async listTasks(filter?: { status?: Task['status'] }): Promise<Task[]> {
    await delay()
    let list = [...fxTasks]
    if (filter?.status) list = list.filter(t => t.status === filter.status)
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at))
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
  async getRun(id: string): Promise<Run | undefined> {
    await delay()
    return fxRuns[id]
  },

  // ── GET /approvals ────────────────────────────────────────────────
  async listApprovals(filter?: { status?: ApprovalRequest['status'] }): Promise<ApprovalRequest[]> {
    await delay()
    let list = [...fxApprovals]
    if (filter?.status) list = list.filter(a => a.status === filter.status)
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at))
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
      tool: g.tool_name,
      mode: policyModeForGrant(g, catalogByName.get(g.tool_name)),
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

function simpleHash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
