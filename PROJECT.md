# Int3grate.ai — Control Plane Prototype

> **Let agents do work. Keep humans in control.**

A frontend prototype for a B2B AI agent platform. Operators configure what agents are, what they may touch, and when a human has to sign off. This document is the walkthrough — every screen, every action, every data field, grounded in the `gateway.yaml` contract.

---

## 1. What this is

**Int3grate.ai Control Plane** is the operator surface for a multi-tenant AI agent platform. It does three things:

1. **Defines agents** — immutable versions with an instruction spec, model chain, memory scope, tool scope, and approval rules.
2. **Gates tool use** — each agent's grants say which tools it can call and whether a human has to approve.
3. **Exposes the audit trail** — every task has a run, every run has steps, every gated action has an approval decision with a reason.

The prototype is a Vite + React + TypeScript single-page app. There is no backend running; the `api` module is a mock over in-memory fixtures, and the shapes match `gateway.yaml` 1-to-1.

---

## 2. The mental model — the chain

Everything connects through a single vertical chain:

```
Agent ─┬─ Version (immutable; instruction + model + policy)
       │
       ├─ Tool Grants (scope · mode · approval_required)
       │
       └─ Task ─── Run ─── Run Steps
                     │         │
                     │         └─ approval_gate step
                     │
                     └─ Approval (decision · reason · evidence)
                     │
                     └─ Spend (rolled up across agents / users)
```

Reading the chain:

- **An agent** is what you configure. It has a status (`draft | active | paused | archived`) and an active **version**.
- **A version** is immutable. You POST a new version when you change anything material. Only one version per agent is active at a time.
- **Tool grants** are attached to an agent. A grant says "tool X can be called in mode Y and needs approval Z".
- **A task** is dispatched to an agent. The backend starts a **run**.
- **A run** is the execution trace. It streams **steps** — `llm_call`, `tool_call`, `memory_read`, `memory_write`, `approval_gate`, `validation`.
- **An approval_gate** step suspends the run. The orchestrator creates an **approval request** and waits for a human decision.
- **Spend** is the per-agent and per-user rollup of run cost and tokens.

---

## 3. Roles

Three roles, hierarchically:

| Role | What they can do | What they see |
| --- | --- | --- |
| `member` | Create tasks, see their own work | Their tasks + their approval requests. No fleet analytics. |
| `domain_admin` | All of the above + create agents/versions, manage grants, handle approvals (up to L3), view spend | Everything inside their domain. |
| `admin` | Everything `domain_admin` can do, across all domains. Highest approval level (L4). | Full tenant. |

Each user has an `approval_level` (1–4). Approval rules on versions route requests to whichever level they need.

---

## 4. Data model (from `gateway.yaml`)

Each entity below is returned verbatim by the backend. The UI renders only these fields.

### User
`id · tenant_id · domain_id · email · name · role · approval_level · created_at`

### Agent
`id · tenant_id · domain_id · owner_user_id · name · description · status · active_version · created_at · updated_at`

`active_version` is the embedded `AgentVersion` object (not a reference ID).

### AgentVersion
`id · agent_id · version · instruction_spec · memory_scope_config · tool_scope_config · approval_rules · model_chain_config · is_active · created_by · created_at`

The four `*_config` fields are opaque objects — the backend doesn't constrain shape.

### ToolGrant
`id · scope_type · scope_id · tool_name · mode · approval_required · config`

- `scope_type ∈ {tenant, domain, agent}`
- `mode ∈ {read, write, read_write}`
- `approval_required: boolean` — the single switch that says "human must decide before execution".

### Task
`id · tenant_id · domain_id · type · status · created_by · assigned_agent_id · assigned_agent_version_id · title · created_at · updated_at`

- `type ∈ {chat, one_time, schedule}`
- `status ∈ {pending, running, completed, failed, cancelled}`
- The Task response does **not** carry run_id, step counts, or spend aggregates.

### Run (`RunDetail`)
`id · tenant_id · domain_id · task_id · agent_version_id · status · suspended_stage · started_at · ended_at · total_cost_usd · total_tokens_in · total_tokens_out · error_message · steps · created_at`

- `status ∈ {pending, running, completed, failed, suspended, cancelled}`
- `suspended_stage` names the step where the run paused (e.g. `approval_gate · stripe.refund`).

### RunStep
`id · step_type · status · model_name · tool_name · input_ref · output_ref · cost_usd · tokens_in · tokens_out · duration_ms · created_at · completed_at`

`step_type ∈ {llm_call, tool_call, memory_read, memory_write, approval_gate, validation}`. `input_ref` and `output_ref` are opaque objects.

### ApprovalRequest
`id · run_id · task_id · tenant_id · requested_action · requested_by · requested_by_name · approver_role · approver_user_id · status · reason · evidence_ref · expires_at · resolved_at · created_at`

`status ∈ {pending, approved, rejected, expired, cancelled}`. `evidence_ref` is an opaque object — the payload the approver reviews.

### SpendDashboard / SpendRow
Dashboard: `range · group_by · items · total_usd`.
Row: `id · label · total_usd · total_tokens_in · total_tokens_out · run_count · spend_date`.

---

## 5. API endpoints (from `gateway.yaml`)

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/auth/login` | Exchange email+password for a JWT |
| GET | `/me` | Current user profile |
| GET | `/agents` | List agents (pagination) |
| POST | `/agents` | Create agent (name, description, domain_id) |
| GET | `/agents/{id}` | Agent with embedded active version |
| POST | `/agents/{id}/versions` | Create immutable version |
| POST | `/agents/{id}/versions/{verId}/activate` | Make this version active |
| GET | `/agents/{id}/grants` | List tool grants |
| PUT | `/agents/{id}/grants` | Full replace of tool grants |
| GET | `/tasks` | List tasks (status filter + pagination) |
| POST | `/tasks` | Create a task (starts a run on the backend) |
| GET | `/tasks/{id}` | Task metadata |
| GET | `/runs/{id}` | Run with full step timeline |
| GET | `/approvals` | List approval requests (status filter) |
| POST | `/approvals/{id}/decision` | Approve or reject |
| GET | `/dashboard/spend` | Aggregated spend (`range` + `group_by`) |
| GET | `/health` | Liveness check |

Notably **missing** (intentional gaps — the UI never pretends they exist):
- No `GET /agents/{id}/versions` (version history list)
- No `GET /runs` (global run list)
- No `GET /users` (directory)
- No `PATCH` / `DELETE /agents/{id}` (edit + archive)
- No search, no CSV export, no audit-log feed

---

## 6. Screens

15 screens, all reachable via the sidebar or internal navigation. Every screen has: loading, empty, error, and — where role-gated — a no-access state.

### Sign in (`/`)

Standalone screen (no shell) that authenticates the user.

- **Purpose** — exchange credentials for a session.
- **Data** — email + password form.
- **Actions** — submit, field-level validation, inline error banner on invalid credentials.
- **Endpoint** — `POST /auth/login`.

### Dashboard (`#/`)

The landing page post-login. Role-aware.

- **Admin / Domain admin view** — 4 tile cards (active agents, task count, pending approvals, 7d spend), recent tasks list, pending approvals list.
- **Member view** — their tasks + their approval requests.
- **Data** — derived from `GET /agents`, `GET /tasks`, `GET /approvals`, and (admins only) `GET /dashboard/spend?range=7d&group_by=agent`.
- **Actions** — start a task, open approvals queue. Every tile links to its detail surface.

### Profile (`#/profile`)

- **Purpose** — show the current user's identity and approval authority.
- **Data** — `GET /me` response: id, email, name, role, approval_level, tenant_id, domain_id, created_at.
- **Actions** — sign out.
- **Authority panel** — visualises L1–L4 and highlights the user's level.

### Agents list (`#/agents`)

- **Purpose** — operate the fleet.
- **Data** — `GET /agents`. Columns: name + description, status, active_version (version number + primary model), owner_user_id + domain_id, updated_at.
- **Actions** — filter by status, text-filter by name/description, create new agent (role-gated), open any row for detail.

### Create agent (`#/agents/new`)

Admins only. Members see a `no access` state.

- **Fields** — `name` (required), `description`, `domain_id`.
- **Endpoint** — `POST /agents`. Owner is inferred by the backend from the caller.
- **On success** — redirect to agent detail, status is `draft` until the first version is activated.

### Agent detail (`#/agents/:id`)

Three tabs: Overview, Tool grants, Settings.

**Overview**
- Command bar: `ID`, `TENANT`, `DOMAIN`, `OWNER`, `ACTIVE VER`, `UPDATED`.
- Active version card: version number, is_active, created_by, created_at, instruction_spec (formatted), plus the four config objects rendered as JSON.
- "Create new version" action for admins.
- Banner note: there is no `GET /versions` — history isn't listable.

**Tool grants** (`#/agents/:id/grants`)
- Backed by `GET /agents/{id}/grants` + `PUT /agents/{id}/grants`.
- Members see a read-only list. Admins edit inline: mode, approval_required toggle, scope, add / remove grants.
- Warning banner if any write grant has `approval_required = false`.

**Settings** (`#/agents/:id/settings`)
- Shows full agent metadata.
- Archive and Delete buttons are `disabled (planned)` — there is no `PATCH` / `DELETE /agents` in the backend yet.

### Create version (`#/agents/:id/versions/new`)

Admins only.

- **Fields** — `instruction_spec` (required), model chain (primary model, max_tokens, temperature). Other configs submitted as `{}`.
- **Endpoints** — `POST /agents/{id}/versions`, optionally followed by `POST /versions/{verId}/activate` when the "activate immediately" checkbox is on.
- **On success** — redirects to agent detail.

### Tasks list (`#/tasks`)

- **Purpose** — see work in motion.
- **Data** — `GET /tasks` (with optional `?status=…`). Columns: id + title, type, status, agent_id + version_id, created_by, updated_at.
- **Actions** — filter by status, create new task.

### Create task (`#/tasks/new`)

- **Fields** — agent picker, `title` (optional), `user_input` (required), `type` (chat/one_time/schedule).
- **Agent picker** — shows status chip and `active_version` — only active agents with an active version are selectable.
- **Endpoint** — `POST /tasks`.
- **Success panel** — shows the created Task fields. There is **no** run_id in the response — the orchestrator attaches a run asynchronously.

### Task detail (`#/tasks/:id`)

- **Purpose** — see task metadata from `GET /tasks/{id}`.
- **Data** — all Task fields rendered as a metadata table.
- **Actions** — "Start another" (pre-fills `/tasks/new` with the same agent and type).
- **Note** — the Task response carries no run_id, no steps, no spend. Operators navigate to runs by ID or from the approval that references a run.

### Run detail (`#/runs/:id`)

- **Purpose** — full audit timeline of one run.
- **Data** — `GET /runs/{id}`. Command bar: id, task_id, agent_version_id, status, step count, tokens, spend, (if suspended) suspended_stage.
- **Steps table** — one row per step with `step_type`, `status`, model/tool, duration, tokens in/out, cost. Click a row to expand; the expanded panel shows `input_ref` and `output_ref` as pretty-printed JSON.
- **Run metadata card** — every Run schema field, rendered verbatim.
- **Banners** — suspended runs show a warn banner; failed runs show the `error_message`.
- **Actions** — open the parent task.

### Approvals inbox (`#/approvals`)

- **Purpose** — the queue of decisions owed.
- **Data** — `GET /approvals` (with optional `?status=…`). Columns: id + created_at, requested_action, requested_by, approver_role, status + expires/resolved, quick-decide buttons.
- **Actions** — filter by status, click row for full detail, or quick-decide (jumps to the detail screen with the decision pre-selected).
- **Policy banner** — reinforces that approvals are a policy, not an AI choice.

### Approval detail (`#/approvals/:id`)

- **Purpose** — let a human make a safe decision.
- **Data** — the full `ApprovalRequest` (with `evidence_ref` rendered as JSON), plus links to the related run and task.
- **Decision flow** — pick Approve or Reject → confirm panel with reason textarea → submit.
  - Approve: reason optional.
  - Reject: reason required (≥ 4 chars).
- **What the UI promises** — approving resumes the suspended run; rejecting stops it. The mock API actually cascades this into the run (`suspended → running` on approve, `→ cancelled` on reject).
- **States handled** — pending, approved, rejected, expired, cancelled, conflict (someone else resolved it while you were deciding), loading, error, no access.
- **Endpoint** — `POST /approvals/{id}/decision` with `{ decision: 'approved' | 'rejected', reason? }`.

### Spend dashboard (`#/spend`)

Admins only.

- **Purpose** — spend visibility, not ROI.
- **Data** — `GET /dashboard/spend?range=&group_by=`. Dashboard fields: `range`, `group_by`, `total_usd`, `items`.
- **Summary cards** — total_usd (from response), total runs (sum of `run_count`), total tokens (sum of `total_tokens_in` + `total_tokens_out`). All three are derived only from the API response.
- **Spend by group chart** — horizontal bars showing each row's share of total.
- **Breakdown table** — one row per group: label + id, total_usd, run_count, total_tokens_in, total_tokens_out, spend_date.
- **Actions** — toggle range (1d/7d/30d/90d), toggle group_by (agent/user), click agent rows to navigate to that agent.
- **Not-shown** — period-over-period deltas, avg cost per run, cap utilisation, daily burn — none are in the backend response.

### Not found

Any unmatched route lands here with a back-to-home action.

---

## 7. States every screen handles

- **Loading** — skeleton rows via `LoadingList`.
- **Empty** — `EmptyState` with an icon and (where applicable) a primary action.
- **Error** — `ErrorState` with a retry button that re-triggers the fetch.
- **No access** — `NoAccessState` when the user's role isn't sufficient.
- **Conflict** (only Approval detail) — when someone else resolved the approval before the current decision was submitted.

---

## 8. Visual language

- **Dark instrument-panel aesthetic** — surfaces `--bg` / `--surface-*`, text tones `--text` / `--text-muted` / `--text-dim`.
- **Accent**: `#0F62FE` (IBM Blue 60). `--accent-ink` is white.
- **Tones** — `--warn` (orange), `--danger` (red), `--success` (green), `--info` (blue).
- **Status component** — a dot + label for every run/task/approval/agent status; the tone is consistent across screens.
- **Typography** — Inter only, single Google Fonts import.
- **Iconography** — custom SVG icon set in `components/icons.tsx`.

---

## 9. Tech stack

- **Vite 5** + **React 19** + **TypeScript** (strict mode, `verbatimModuleSyntax`, no unused locals).
- **Hand-rolled hash router** (`router.tsx`) — flat route table, `:param` segments, `<Link>` + `useRouter().navigate`.
- **Auth provider** — session persisted in `localStorage` under `proto.session.v1`.
- **Mock API** (`lib/api.ts`) — awaits a synthetic latency then mutates in-memory fixtures.
- **Fixtures** (`lib/fixtures.ts`) — backend-shaped seed data for users, agents, versions, grants, tasks, runs, approvals, and spend.
- **No CSS framework** — plain CSS with custom properties, scoped under `.prototype-root`.

---

## 10. Running it

```bash
npm install
npm run dev        # Vite dev server with HMR
npm run build      # tsc -b && vite build
npm run lint       # eslint flat config (typescript-eslint + react-hooks)
npm run preview    # serve production build
```

Sign in with any of:
- `frontend@int3grate.ai` (admin, L4)
- `domain@int3grate.ai` (domain_admin, L3)
- `member@int3grate.ai` (member, L1)

Any password ≥ 8 characters is accepted.

---

## 11. Demonstration flows

The fixtures are seeded so the operator can walk all four run states end-to-end:

| Flow | Task | Run | Approval |
| --- | --- | --- | --- |
| **Approval-required** | `tsk_4081` — refund $412 | `run_4081` — suspended | `apv_9021` — pending (L3) |
| **Access-revoke · admin approval** | `tsk_4077` — offboard | `run_4077` — suspended | `apv_9022` — pending (L4) |
| **Successful** | `tsk_4079` — invoice reconcile | `run_4079` — completed | — |
| **Failed** | `tsk_4076` — vendor onboarding | `run_4076` — failed (IRS EIN mismatch) | — |

Deciding `apv_9021` or `apv_9022` cascades into the corresponding run: approving resumes it, rejecting cancels it and the task.

---

## 12. Known limitations

The UI is strict about the gateway contract. Features that would require endpoints we don't have are either omitted or surfaced as `planned` / `disabled`:

- No version history list (no `GET /versions`) — agent detail shows only the embedded active version.
- No global run list — runs are only reachable by ID.
- No user directory — names for people other than `/me` are not resolvable.
- No agent edit / archive / delete — settings tab has planned buttons.
- No CSV export anywhere.
- No tenant-wide search.
