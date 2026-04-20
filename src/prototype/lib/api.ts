import {
  agents as fxAgents,
  agentVersions as fxVersions,
  approvals as fxApprovals,
  grantsByAgent,
  runs as fxRuns,
  getSpendDashboard,
  tasks as fxTasks,
  users as fxUsers,
} from './fixtures'
import type {
  Agent,
  AgentVersion,
  ApprovalRequest,
  Run,
  SpendDashboard,
  SpendGroupBy,
  SpendRange,
  Task,
  ToolGrant,
  User,
} from './types'

const delay = () => new Promise(r => setTimeout(r, 120 + Math.random() * 260))

export const api = {
  async login(email: string, password: string): Promise<User> {
    void password
    await delay()
    const u = fxUsers.find(u => u.email === email)
    if (!u) throw new Error('No such user')
    return u
  },
  async me(userId: string): Promise<User> {
    await delay()
    const u = fxUsers.find(u => u.id === userId)
    if (!u) throw new Error('No user')
    return u
  },
  async listAgents(): Promise<Agent[]> {
    await delay()
    return fxAgents
  },
  async getAgent(id: string): Promise<Agent | undefined> {
    await delay()
    return fxAgents.find(a => a.id === id)
  },
  async createAgent(input: { name: string; description: string; owner_user_id: string }): Promise<Agent> {
    await delay()
    const owner = fxUsers.find(u => u.id === input.owner_user_id)
    const id = `agt_${input.name.toLowerCase().replace(/\s+/g, '_').slice(0, 20)}`
    const now = new Date().toISOString()
    const agent: Agent = {
      id,
      tenant_id: owner?.tenant_id ?? 'ten_acme',
      domain_id: owner?.domain_id ?? 'dom_hq',
      name: input.name,
      description: input.description,
      status: 'draft',
      owner_user_id: input.owner_user_id,
      active_version: null,
      created_at: now,
      updated_at: now,
      version_count: 0,
      tools_granted: 0,
      tools_requiring_approval: 0,
      last_run_at: null,
      runs_7d: 0,
      success_rate_7d: 0,
      monthly_spend_usd: 0,
      monthly_spend_cap_usd: null,
      tone: 'accent',
      glyph: input.name.slice(0, 2).toUpperCase(),
    }
    fxAgents.unshift(agent)
    return agent
  },
  async listAgentVersions(agentId: string): Promise<AgentVersion[]> {
    await delay()
    return fxVersions.filter(v => v.agent_id === agentId).sort((a, b) => b.version_number - a.version_number)
  },
  async createAgentVersion(agentId: string, input: {
    instruction_spec: string
    model_chain_config: AgentVersion['model_chain_config']
    memory_scope_config: AgentVersion['memory_scope_config']
    tool_scope_config: AgentVersion['tool_scope_config']
    approval_rules: AgentVersion['approval_rules']
    notes?: string
  }): Promise<AgentVersion> {
    await delay()
    const existing = fxVersions.filter(v => v.agent_id === agentId)
    const next = existing.reduce((m, v) => Math.max(m, v.version_number), 0) + 1
    const v: AgentVersion = {
      id: `ver_${agentId}_${next}`,
      agent_id: agentId,
      version_number: next,
      instruction_spec: input.instruction_spec,
      memory_scope_config: input.memory_scope_config,
      tool_scope_config: input.tool_scope_config,
      approval_rules: input.approval_rules,
      model_chain_config: input.model_chain_config,
      is_active: false,
      created_by: 'usr_ada',
      created_at: new Date().toISOString(),
      label: `v${next} · draft`,
      notes: input.notes ?? '',
      activated_at: null,
    }
    fxVersions.unshift(v)
    return v
  },
  async activateVersion(agentId: string, versionId: string): Promise<AgentVersion> {
    await delay()
    const v = fxVersions.find(v => v.id === versionId)
    if (!v) throw new Error('no version')
    fxVersions.forEach(vv => {
      if (vv.agent_id === agentId && vv.is_active) vv.is_active = false
    })
    v.is_active = true
    v.activated_at = new Date().toISOString()
    const a = fxAgents.find(a => a.id === agentId)
    if (a) {
      a.active_version = versionId
      a.updated_at = new Date().toISOString()
    }
    return v
  },
  async getGrants(agentId: string): Promise<ToolGrant[]> {
    await delay()
    return grantsByAgent[agentId] ?? []
  },
  async setGrants(agentId: string, next: ToolGrant[]): Promise<ToolGrant[]> {
    await delay()
    grantsByAgent[agentId] = next
    const a = fxAgents.find(a => a.id === agentId)
    if (a) {
      a.tools_granted = next.filter(g => g.granted !== false).length
      a.tools_requiring_approval = next.filter(g => g.approval_required && g.granted !== false).length
      a.updated_at = new Date().toISOString()
    }
    return next
  },
  async listTasks(filter?: { status?: Task['status']; agentId?: string; type?: Task['type'] }): Promise<Task[]> {
    await delay()
    let list = [...fxTasks]
    if (filter?.status) list = list.filter(t => t.status === filter.status)
    if (filter?.agentId) list = list.filter(t => t.assigned_agent_id === filter.agentId)
    if (filter?.type) list = list.filter(t => t.type === filter.type)
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at))
  },
  async createTask(input: {
    assigned_agent_id: string
    title: string
    user_input: string
    type: Task['type']
    priority?: Task['priority']
  }): Promise<Task> {
    await delay()
    const agent = fxAgents.find(a => a.id === input.assigned_agent_id)!
    const now = new Date().toISOString()
    const t: Task = {
      id: `tsk_${Math.floor(Math.random() * 9000 + 1000)}`,
      tenant_id: agent.tenant_id,
      domain_id: agent.domain_id,
      type: input.type,
      status: 'pending',
      title: input.title,
      user_input: input.user_input,
      assigned_agent_id: input.assigned_agent_id,
      assigned_agent_version_id: agent.active_version ?? '',
      created_by: 'usr_ada',
      created_at: now,
      updated_at: now,
      agent_name: agent.name,
      created_by_name: 'Ada Fernsby',
      run_id: null,
      duration_ms: null,
      steps_count: 0,
      spend_usd: 0,
      result_summary: null,
      priority: input.priority ?? 'normal',
    }
    fxTasks.unshift(t)
    return t
  },
  async getTask(id: string): Promise<Task | undefined> {
    await delay()
    return fxTasks.find(t => t.id === id)
  },
  async getRun(id: string): Promise<Run | undefined> {
    await delay()
    return fxRuns[id]
  },
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
  async decideApproval(id: string, decision: 'approve' | 'reject', reason: string, byUserId: string): Promise<ApprovalRequest> {
    await delay()
    const a = fxApprovals.find(a => a.id === id)
    if (!a) throw new Error('no approval')
    if (a.status !== 'pending') {
      // Conflict — someone else (or this same tab) already decided.
      throw Object.assign(new Error('Approval already resolved'), { code: 'already_resolved', current: a })
    }
    const now = new Date().toISOString()
    a.status = decision === 'approve' ? 'approved' : 'rejected'
    a.approver_user_id = byUserId
    a.resolved_at = now
    a.reason = reason

    // Cascade the decision into the related run (and task on reject) so the
    // mock matches what the detail screen promises the operator.
    const run = fxRuns[a.run_id]
    if (run) {
      const gate = run.steps.find(s => s.approval_id === a.id)
      if (decision === 'approve') {
        if (run.status === 'suspended') {
          run.status = 'running'
          run.suspended_stage = null
        }
        if (gate) {
          gate.status = 'ok'
          gate.completed_at = now
          gate.detail = `Approved · orchestrator will resume ${a.tool_name ?? 'the pending step'}`
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
          gate.detail = `Rejected${reason ? ` · ${reason}` : ''}`
        }
        const task = fxTasks.find(t => t.id === a.task_id)
        if (task && (task.status === 'pending' || task.status === 'running')) {
          task.status = 'cancelled'
          task.updated_at = now
          task.result_summary = `Cancelled · approval ${a.id} rejected`
        }
      }
    }
    return a
  },
  async getSpend(range: SpendRange = '30d', group_by: SpendGroupBy = 'agent'): Promise<SpendDashboard> {
    await delay()
    return getSpendDashboard(range, group_by)
  },
}
