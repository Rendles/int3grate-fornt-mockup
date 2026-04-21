# Int3grate.ai - main user flows

This document describes the most important demoable user flows in the Control Plane prototype. The goal is not just to walk through screens, but to show the product value: AI agent governance, controlled execution, human-in-the-loop approvals, auditability, and spend visibility.

## Recommended demo order

1. Register or sign in to a workspace.
2. Use the dashboard as the operating overview.
3. Show agent governance: fleet list, details, versions, and tool grants.
4. Dispatch a task to an active agent.
5. Inspect a run audit trail.
6. Make a human approval decision.
7. Review spend by agent and by user.
8. Show role-based access differences between admin, domain admin, and member.

## Demo accounts

| Role | Email | What to show |
| --- | --- | --- |
| Tenant Admin | `frontend@int3grate.ai` | Full access: agents, grants, approvals, spend. |
| Domain Admin | `domain@int3grate.ai` | Domain-scoped management and approvals. |
| Member | `member@int3grate.ai` | Limited access: tasks and own work, no fleet analytics. |

Any password works in the mock auth flow. The login screen already pre-fills a demo password.

## Flow 1. Onboarding: register a workspace owner

**Route:** `#/register`

**Why demo it:** This is the first-touch customer journey. It explains that the product is multi-tenant: the user creates a workspace, not just an isolated account.

**Demo steps:**

1. Open the registration page.
2. Enter name, workspace, email, password, and password confirmation.
3. Submit the form.
4. Show automatic sign-in and redirect to the dashboard.

**What to highlight:**

- Workspace becomes the basis for `tenant_id`.
- The new user becomes the workspace owner: `admin`, approval level `L4`.
- Field validation covers email, password length, and password confirmation.
- This is a mock flow: the created user exists in the current tab memory until page reload.

**Success state:** The user lands on the dashboard already authenticated.

## Flow 2. Sign in and role-aware dashboard

**Route:** `#/login`, then `#/`

**Why demo it:** The dashboard should quickly communicate that this is a control plane, not an agent chat interface. Operators see fleet state across agents, tasks, approvals, and spend.

**Demo steps:**

1. Sign in as `frontend@int3grate.ai`.
2. Show the top dashboard metrics.
3. Show recent tasks and pending approvals.
4. Open the sidebar and explain the main product areas.
5. Optionally sign in as `member@int3grate.ai` to show a narrower dashboard.

**What to highlight:**

- Admins see fleet-level state and spend.
- Members see a narrower work surface.
- Sidebar badges surface active tasks and pending approvals.
- The dashboard connects the core chain: Agent -> Task -> Run -> Approval -> Spend.

**Success state:** The audience understands where an operator starts the day and which decisions need attention.

## Flow 3. Agent governance: create and prepare an agent

**Routes:** `#/agents`, `#/agents/new`, `#/agents/:agentId`, `#/agents/:agentId/versions/new`, `#/agents/:agentId/grants`

**Why demo it:** This is the core product flow. It shows that an agent is a governed operating asset with versions, policies, and permissions, not just a prompt.

**Demo steps:**

1. Open the agents list.
2. Filter by status or search by name.
3. Create a new agent with name, description, and domain.
4. Open the agent detail page.
5. Create the first version or a new immutable version.
6. Pick primary model, max tokens, temperature, and activate immediately.
7. Go to the Tool grants tab.
8. Show mode, scope, and the `approval_required` toggle.

**What to highlight:**

- Agents have lifecycle states: `draft`, `active`, `paused`, `archived`.
- Versions are immutable: material changes create a new version.
- Only one active version is used when dispatching tasks.
- Tool grants constrain which tools the agent can call.
- A write grant without approval is risky, and the UI warns about it.
- Members cannot create agents or versions.

**Success state:** The agent is ready to run with an active version and clear tool grants.

## Flow 4. Dispatch task: start agent work

**Routes:** `#/tasks`, `#/tasks/new`, `#/tasks/:taskId`

**Why demo it:** This is the main user action. An operator or member describes work, selects an agent, and dispatches execution.

**Demo steps:**

1. Open Tasks.
2. Click Create task or Start task from an agent detail page.
3. Select an active agent with an active version.
4. Choose task type: `chat`, `one_time`, or `schedule`.
5. Fill title and user input.
6. Start the task.
7. Show the success panel and task metadata.
8. Open task detail.

**What to highlight:**

- Only an active agent with an active version can run a task.
- The Task response does not include `run_id`: the orchestrator creates runs asynchronously.
- Task detail shows the backend contract, not invented UI fields.
- "Start another" can pre-fill a new task from the same context.

**Success state:** A pending task is created for the orchestrator to pick up.

## Flow 5. Run audit trail: explain what the agent did

**Route:** `#/runs/:runId`

**Good demo IDs:** `run_4081`, `run_4080`, `run_4079`, `run_4077`, `run_4076`

**Why demo it:** This is the product trust layer. Users see not only the result, but every execution step: LLM calls, tool calls, memory, validation, and approval gates.

**Demo steps:**

1. Open run detail from approval detail or directly by ID.
2. Show the command bar: task, version, status, tokens, spend.
3. Expand several run steps.
4. Show `input_ref` and `output_ref` as JSON.
5. For a suspended run, show the suspended stage.
6. For a failed run, show the error message.

**What to highlight:**

- A run is the execution audit trail.
- Each step has type, status, model/tool, duration, tokens, and cost.
- A suspended run shows exactly where policy stopped execution.
- A failed run explains why through `error_message`.
- This is essential for control, debugging, and trust.

**Success state:** The audience understands that agent actions are transparent and inspectable.

## Flow 6. Approval gate: human-in-the-loop decision

**Routes:** `#/approvals`, `#/approvals/:approvalId`

**Good demo IDs:** `apv_9021`, `apv_9022`, `apv_9023`

**Why demo it:** This is a key control-plane differentiator: an agent can prepare an action, but risky execution requires a human decision.

**Demo steps:**

1. Open the Approvals inbox.
2. Filter pending approvals.
3. Open a pending approval.
4. Show requested action, approver role, evidence JSON, linked task, and linked run.
5. Choose Approve or Reject.
6. Enter a reason for Reject.
7. Submit the decision.
8. Open the linked run and show the cascade result.

**What to highlight:**

- An approval is a policy decision, not an AI decision.
- Approve resumes the suspended run.
- Reject stops the requested action and moves the run/task toward a cancelled state.
- Reason is written into the audit trail.
- The UI handles conflict state when someone else already resolved the approval.

**Success state:** The risky action is either explicitly allowed by a human or safely stopped.

## Flow 7. Spend visibility: understand agent cost

**Route:** `#/spend`

**Why demo it:** Financial control matters in B2B. This screen shows which agents and users generate spend.

**Demo steps:**

1. Open Spend as admin or domain admin.
2. Toggle range: `1d`, `7d`, `30d`, `90d`.
3. Toggle group_by: `agent` and `user`.
4. Show total spend, total runs, and tokens in/out.
5. Show horizontal bars by share of spend.
6. In group_by agent mode, click a row to navigate to agent detail.

**What to highlight:**

- Spend is built only from the backend response: `range`, `group_by`, `items`, `total_usd`.
- The breakdown includes spend, runs, input tokens, and output tokens.
- This is a visibility screen, not an ROI model or billing engine.
- Members do not have access to spend analytics.

**Success state:** The operator understands where money is going and which agents may need optimization.

## Flow 8. Role and access story

**Routes:** `#/profile`, `#/agents/new`, `#/spend`, `#/agents/:agentId/grants`

**Why demo it:** Enterprise control depends on roles. This flow shows that the prototype already separates user capabilities.

**Demo steps:**

1. Sign in as admin and open Profile.
2. Show role, tenant, domain, and approval level.
3. Open Spend and Agent creation.
4. Sign out and sign in as member.
5. Try to open Spend or create an agent.
6. Show the no-access state.
7. Open grants as member and show read-only mode.

**What to highlight:**

- `admin` sees the full tenant.
- `domain_admin` manages domain-level operations.
- `member` can work with tasks but cannot govern the fleet.
- Approval level explains which decisions the user can make.
- Access restrictions are visible in the UI flows, not hidden.

**Success state:** The audience understands the enterprise model: who can dispatch work, who can change policy, and who can approve risky actions.

## What not to promise in the demo

- There is no real backend: `api` runs on in-memory fixtures.
- Most mutations only live in the current tab until page reload.
- There is no global runs list.
- There is no user directory.
- There is no agent edit, archive, or delete flow.
- There is no CSV export, billing ledger, or real-time streaming.
- Version history is not listable: the UI exposes only the active version plus new version creation.

