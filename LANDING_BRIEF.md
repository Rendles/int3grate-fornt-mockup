# Int3grate.ai — Landing Brief for the Design Agent

> You are receiving this document because you are working on the **landing page** for the Int3grate.ai product prototype. This brief gives you every screen, every visual decision, every piece of copy, and the product positioning — so you can decide which parts of the app to showcase, re-skin for a marketing context, or embed as hero imagery.

**Do not invent features.** If something isn't in this brief or the actual prototype, the backend doesn't support it and the landing shouldn't promise it.

---

## 1. What the product is — one paragraph

Int3grate.ai is a **control plane for AI agents** in a B2B setting. It's the place where operators:

1. **Define agents** (immutable versions with an instruction spec, a model chain, and a policy).
2. **Gate tool use** (which tools the agent can call, and when a human has to sign off).
3. **Audit the trail** (every task spawns a run, every run streams steps, every gated action lands as an approval request with a reason and evidence).

It is **not** an agent framework. It is **not** ChatGPT-for-teams. It is the operator surface you sit in after agents exist, to keep them accountable.

---

## 2. Positioning & voice

**Tagline (actual, shipping):**

> **Let agents do work. Keep humans in control.**

Used verbatim on the login screen's left panel. This should be the headline thesis of the landing page.

**Supporting beats (all live in the product):**

- "Approval is a policy, not an AI decision" — the agent doesn't choose whether to ask for permission; the operator sets it on the tool grant, and the orchestrator enforces it.
- "Decisions owed" — framing for the approval inbox.
- "Your fleet" — framing for the agents list.
- "Work in motion" — framing for tasks.
- "Run timeline" — the audit trail.
- "Spend visibility" (never "ROI").

**Voice:**

- Direct, operator-flavoured, slightly terminal-esque.
- Lowercase labels in monospace (`APPROVALS`, `POST /approvals/{id}/decision`) for structure.
- Sentence-case serif-italic words for emotional weight — e.g. `<em>owed.</em>`, `<em>fleet.</em>`, `<em>in motion.</em>`.
- Never marketese. Never "supercharge", "leverage", "revolutionise".
- Technical details are a feature, not something to hide — endpoints are visible on most screens as `GET /tasks?status=pending` chips.

---

## 3. Visual identity

### Palette (CSS custom properties under `.prototype-root`)

| Token | Hex | Use |
| --- | --- | --- |
| `--bg` | `#0a0b0c` | Page background (near-black) |
| `--surface` | `#0e1012` | Cards |
| `--surface-2` | `#13161a` | Card headers, table header rows |
| `--surface-3` | `#181c21` | Nested fills |
| `--surface-hi` | `#1e2229` | Hover surfaces |
| `--border` | `#20242b` | Dividers |
| `--border-2` | `#2a2f37` | Chip / input borders |
| `--text` | `#e5e6e9` | Primary text |
| `--text-muted` | `#9a9ea6` | Secondary text |
| `--text-dim` | `#60646c` | Tertiary / mono labels |
| `--text-ghost` | `#383c43` | Placeholders |
| **`--accent`** | **`#0F62FE`** (IBM Blue 60) | Primary action, links, focus |
| `--accent-2` | `#0043CE` | Gradient second stop |
| `--accent-ink` | `#ffffff` | Text on accent background |
| `--warn` | `#ffb347` | Warnings, pending, suspended |
| `--danger` | `#ff5a4d` | Errors, rejections, failed |
| `--success` | `#55d991` | Completed, approved |
| `--info` | `#6aa6ff` | Running, info |

Each tone has `*-soft` (12% alpha fill) and `*-border` (~35% alpha border).

**Aesthetic label:** dark "instrument-panel" / "control-plane" UI. Dense, flat, no drop shadows, no gradients except the accent button and one or two status backgrounds. Sharp 6-8px radii.

### Typography

- **Single family: Inter** (300, 400, 500, 600, 700) — loaded once from Google Fonts.
- There are three CSS vars (`--font-sans`, `--font-serif`, `--font-mono`) that all resolve to Inter. The variable name encodes intent, not different families.
- `.mono` uses tight tracking (`letter-spacing: -0.02em`) for codey/metadata feel.
- `.serif` styling (letter-spacing 0) is used on oversize display numbers/titles — think 22–56px display lines like "Good morning, Ada." or "$2.18k spent".

### Iconography

Custom 1-stroke SVG set in `components/icons.tsx`. 16×16 and 12×12 variants. All icons follow one visual rule: stroked at 1.5, no fills, rounded caps. Category: agent, task, approval, spend, home, route, play, pause, stop, check, x, alert, arrow (up/down/right), clock, search, lock, filter, plus, chat, tool.

### Component primitives

Reuse these on the landing if it becomes embeddable. All scoped under `.prototype-root` — don't leak styles outside of that wrapper.

- **`<PageHeader>`** — `eyebrow` (small mono uppercase) + `title` (serif-italic display) + `subtitle` (muted prose) + right-aligned `actions` row.
- **`<CommandBar>`** — horizontal strip under the header showing key/value metadata like `RUN · run_4081 · AGT VER · ver_rr_08 · STATUS · suspended`. Monospaced.
- **`<Status>`** — dot + label component covering every run/task/approval/agent status. Color-coded.
- **`<Chip>`** — small rounded pill. Tones: accent, warn, danger, success, info, ghost.
- **`<Dot>`** — 6×6 status dot, optional pulse animation.
- **`<Sparkbar>`** — tiny bar-graph (not currently used — retained for future).
- **`<Avatar>`** — 2-letter initials tile (monospaced).
- **`<Btn>`** — variants: `primary` (accent fill, white text), `ghost` (transparent, hover fills), `danger` (red border). Optional `icon` slot.
- **`<Tabs>`** — underline-on-active tabs.
- **`<Banner>`** — full-width note with icon, title, body. Tones `info` / `warn`.
- **`<EmptyState>` / `<ErrorState>` / `<NoAccessState>` / `<LoadingList>`** — state components used everywhere.

### Layout

- **`AppShell`** = fixed left `Sidebar` (240px-ish) + top `Topbar` + main content area.
- Pages use `.page` (narrow) or `.page--wide` (wide) max-width containers.
- Card grids: `grid--2`, `grid--3`, `grid--4`.
- `split` = 2fr/1fr column split used on dashboard and task detail.

---

## 4. Navigation & screen map

The product is a hash-routed SPA. All URLs are `#/…`.

```
LOGIN  (/)
 │
 ├─→ DASHBOARD          #/
 ├─→ AGENTS             #/agents ──→ AGENT NEW         #/agents/new
 │                      │         ──→ AGENT DETAIL     #/agents/:id           (tab: overview)
 │                                 ──→ TOOL GRANTS     #/agents/:id/grants    (tab: grants)
 │                                 ──→ SETTINGS        #/agents/:id/settings  (tab: settings)
 │                                 ──→ NEW VERSION     #/agents/:id/versions/new
 │
 ├─→ TASKS              #/tasks ──→ TASK NEW           #/tasks/new
 │                              ──→ TASK DETAIL        #/tasks/:id
 │
 ├─→ RUN DETAIL         #/runs/:id     (reachable from approvals / task detail)
 │
 ├─→ APPROVALS          #/approvals ──→ APPROVAL DETAIL #/approvals/:id
 │
 ├─→ SPEND              #/spend
 │
 └─→ PROFILE            #/profile
```

**Sidebar (always visible):** Dashboard · Agents · Tasks · Approvals · Spend. Tasks and Approvals show badge counts when non-zero. Brand mark "I" + "Int3grate.ai" + "CONTROL · v0.7" at the top.

**Topbar:** breadcrumbs on the left, user email (monospace, dim) on the right, logout icon.

---

## 5. Screen-by-screen walkthrough

For each screen I describe: **Layout**, **Copy on screen** (verbatim where possible), **Components used**, **What data is shown**, and **Actions available**. Screens marked ⭐ are particularly photogenic and recommended as landing-page showcases.

### 5.1 Login — `/` ⭐

**Layout:** Two-column, full viewport.

- **Left panel** (dark): brand mark + name, oversize tagline (display serif-italic), three meta bullets at the bottom.
- **Right panel**: auth form, centred vertically.

**Copy on screen (verbatim):**

- Eyebrow: `SIGN IN`
- H2: `Welcome back.`
- Sub: "Authenticate with your workspace email to access the control plane."
- Tagline (left panel): **"Let agents do work."** / **"Keep humans _in control._"**
- Meta bullets: `POST /auth/login` · `Region · eu-west-1` · `Status · nominal`
- Invalid banner: **"Invalid credentials"** · "That email and password combination isn't recognised."

**Components:** Btn (primary, lg), inline-validated `<input>`s, Banner (warn).

**Actions:** Email+password submit. No demo-role quick-logins.

### 5.2 Dashboard — `#/` ⭐⭐ (admin view is the strongest landing hero)

**Layout:** page__wide with PageHeader, then 4-tile metric grid, then a split (2fr recent tasks / 1fr pending approvals).

**Copy on screen:**

- Eyebrow: e.g. `MONDAY, APR 20 · TENANT ten_acme`
- Title: e.g. **"Good morning, _Ada._"** (time-of-day aware)
- Admin sub: "Tenant-level counts from GET /agents, GET /tasks, GET /approvals and GET /dashboard/spend."
- Member sub: "Your tasks and approval requests."
- Actions: ghost `Approvals`, primary `Start a task` (with play icon).

**Tiles (admin):**
- `Active agents` · number · "X total"
- `Tasks` · number · "X failed"
- `Pending approvals` · number · "needs a human decision" / "queue clear" (warn border if > 0)
- `Spend · 7d` · money compact · "X agents"

**Split panels:**
- **Recent tasks** card — rows with task title, id, `ago(updated_at)`, Status chip, agent_id, type chip.
- **Pending approvals** card — warn border if non-empty; stacked sub-cards showing `id`, `approver_role`, `requested_action`, requester + `ago(created_at)`.

**Member view:** 2-column split — "My tasks" + "My approval requests".

**Notes for landing:** This is the single most demonstrative screen. The 4-tile grid + split cards visualise the whole chain at once.

### 5.3 Profile — `#/profile`

**Layout:** narrow page, three stacked cards.

**Copy:** Eyebrow `PROFILE · GET /me`, title **"Hello, _Ada._"**.

**Cards:**
1. **Identity** — 64px Avatar, name (display serif), email (mono dim), role chip (accent), approval-level chip (info), User ID (mono, right-aligned).
2. **Scope** — 2×2 grid of tenant_id, domain_id (mono blocks), created_at, role.
3. **Approval authority** — 4-column grid of L1–L4 tiles; the user's tier and below are highlighted (accent fill + accent border). Above their tier = muted.

**Actions:** Sign out (ghost, top-right).

### 5.4 Agents list — `#/agents` ⭐

**Layout:** wide page. Header, filter chip row, table.

**Copy:** Eyebrow `AGENTS · GET /agents`. Title **"Your _fleet._"**. Sub: "Configure what agents are and what they may touch. Each row is one entry from GET /agents."

**Action:** `New agent` primary button (admins) or disabled with lock icon + `"Admins only"` title (members).

**Filters:** Status chips (`all`, `active`, `paused`, `draft`, `archived`) with live counts + text filter input (right-aligned).

**Table columns:** `name · description` | `status` | `active version` (v-number chip + primary model) | `owner · domain` (mono) | `updated`. Full row is clickable.

**Footer hint (mono, dim):** `endpoint · GET /agents`

**Notes for landing:** strong screenshot candidate — gives density and business colour at once.

### 5.5 Agent new — `#/agents/new`

**Layout:** narrow page, header, optional banner (success/error), then a form card.

**Copy:** Eyebrow `POST /agents`. Title **"New _agent._"**. Sub: "POST /agents accepts name, description, domain_id. Owner is inferred from the caller."

**Form fields:** Name (required, 1–200), Description (optional), Domain (select). Simple two-column form rows (label + hint left, input right).

**Member no-access:** full-screen `<NoAccessState>` component: padlock icon, "You need Admin access", "Creating agents is restricted to admins."

### 5.6 Agent detail — `#/agents/:id` ⭐

**Layout:** wide page. PageHeader → CommandBar → Tabs → tab content.

**Header:** Eyebrow `AGENT · agt_refund_resolver · GET /agents/{id}` (code in eyebrow). Title = agent name (plain). Actions: Status chip, active-version chip, primary `Start task` (disabled if status ≠ active).

**CommandBar cells:** `ID`, `TENANT`, `DOMAIN`, `OWNER`, `ACTIVE VER` (accent/warn tone), `UPDATED`.

**Tabs:** Overview · Tool grants (count) · Settings.

**Overview tab:**
- "Active version" card with either an embedded version panel (id, version, is_active, created_by, created_at, `instruction_spec` in a `<pre>`, 2×2 grid of `memory_scope_config` / `tool_scope_config` / `approval_rules` / `model_chain_config` as pretty-printed JSON).
- Info banner: "Gateway exposes only the active version. There is no `GET /versions` endpoint."

**Tool grants tab:** full grant editor (table with tool_name, scope, mode, approval toggle, remove; add-row input at bottom, `PUT /grants` save button).

**Settings tab:** metadata MetaRow list; warn banner "Writes aren't in the gateway yet"; `Archive (planned)` + `Delete (planned)` disabled danger buttons.

**Notes for landing:** the JSON config panels visualise the "immutable version" concept well. Great for a "configure once, audit forever" beat.

### 5.7 New version — `#/agents/:id/versions/new`

**Layout:** narrow page, series of form cards.

**Copy:** Eyebrow `POST /agents/{id}/versions`. Title: **"New _version_ v14"** (next version number in small muted text).

**Cards:**
1. **`instruction_spec`** (required) — full-width monospace textarea (min 260px, Inter mono styling, 12.5px / 1.5 line).
2. **`model_chain_config`** — Primary model select, max_tokens number, temperature number.
3. **Activate immediately** checkbox card.
4. Info banner explaining what the backend accepts.

### 5.8 Tasks list — `#/tasks` ⭐

**Copy:** Eyebrow `TASKS · GET /tasks`. Title **"Work _in motion._"** Sub: "Each task is dispatched to an agent. The backend returns only task-level metadata — runs are fetched separately."

**Action:** `Create task` primary (with plus icon).

**Filter row:** status chips with live counts.

**Table columns:** `id · title` | `type` | `status` (Status component) | `agent · version` (mono) | `created by` (mono, uuid) | `updated` (ago). Full row clickable.

**Footer hint:** `endpoint · GET /tasks?status=…`

### 5.9 Task new — `#/tasks/new` ⭐

**Layout:** narrow page, step-ish form cards.

**Copy:** Eyebrow `POST /tasks`. Title **"Dispatch _a task._"** Sub: "POST /tasks requires an agent and user_input. The backend starts a run but Task response does not return run_id."

**Cards:**
1. **Agent picker** — list of agent buttons, each with name + id + status (right-aligned Status + version tag). Only active agents with an active version are selectable. Visual: selected agent gets accent soft fill and accent border.
2. **Type picker** — 3 columns (chat / one_time / schedule), each a tall button with serif-italic label + description. Selected = accent.
3. **Form card** — Title (optional), `user_input` textarea (required, `*`).

**Action row:** ghost `Cancel` + primary `Start task` (with play icon).

**Success state:** Replaces the form with a success panel (green border, check icon, serif "Task queued.") + a "Response" card listing the returned Task fields + "Open task detail" primary button.

**Notes for landing:** this screen demonstrates "human dispatches work to an agent" — great for a 3-step product animation.

### 5.10 Task detail — `#/tasks/:id`

**Layout:** wide page. Header + CommandBar + info Banner + Metadata card.

**Copy:** Eyebrow `TASK · tsk_4081 · GET /tasks/{id}`. Title = task.title (or "Untitled task"). Sub: "Task metadata from GET /tasks/{id}. To inspect the run, open it directly by ID — the Task response doesn't carry run_id."

**CommandBar cells:** ID, TYPE, STATUS, AGENT, VERSION, CREATED BY.

**Banner (info):** "Gateway Task has `id, tenant_id, domain_id, type, status, created_by, assigned_agent_id, assigned_agent_version_id, title, created_at, updated_at`. No run_id, no steps, no spend."

**Metadata card:** MetaRow list of every Task field, mono values, dashed-bottom dividers.

**Actions:** `Start another` (pre-fills /tasks/new with same agent + type).

### 5.11 Run detail — `#/runs/:id` ⭐⭐ (the most visually dense)

**Layout:** wide page. Header + CommandBar + (suspended banner) + (failure card) + Steps table + Run metadata card.

**Copy:** Eyebrow `RUN · run_4081 · GET /runs/{id}`. Title **"Run _timeline._"** Sub: "Full step audit trail for this run, returned by GET /runs/{id}."

**CommandBar:** ID · TASK · AGT VER · STATUS (warn tone for failed/suspended) · STEPS · TOKENS (`X in · Y out`) · SPEND · SUSPENDED (only if present).

**Suspended banner:** warn-tinted. "Run is suspended. Orchestrator paused at `approval_gate · stripe.refund`. An approval_gate step is waiting for a human decision."

**Failed card:** red border, red soft fill, alert icon, serif "Run failed", `error_message` as prose.

**Steps table columns:** `step_type` (mono) · `status` (Chip, tone-coded) · `model / tool` (mono) · `duration` · `tokens (in/out)` · `cost`. Clicking a row expands it below — pretty-printed `input_ref` and `output_ref` JSON in two side-by-side `<pre>` blocks with `var(--surface-2)` background.

**Metadata card:** every Run schema field, mono.

**Notes for landing:** This is the money shot for "observability / audit trail". The steps table with an expanded JSON row shows depth.

### 5.12 Approvals inbox — `#/approvals` ⭐⭐⭐ (the killer hero)

**Layout:** wide page. Header → Policy banner → Status filter row → Table.

**Copy:**
- Eyebrow `APPROVALS · GET /approvals`
- Title **"Decisions _owed._"**
- Sub: "Approval requests created by the orchestrator when a policy or tool grant requires a human decision."

**Policy banner (info tone) — pulled verbatim for landing:**
- Title: **"Approval is a policy, not an AI decision"**
- Body: "The orchestrator creates an approval request whenever a grant or rule requires a human decision. The agent doesn't choose — it's gated."

**Status chips:** all, pending (warn tint when selected), approved, rejected, expired, cancelled.

**Table columns:** `id · created_at` (mono, stacked) | `requested action` (e.g. "stripe.refund · $412 on charge ch_3P8fL2") + small sub-line `run X · task Y` | `requested by` (name + uuid) | `approver role` (chip) | `status · expires` | `quick decide` — two circular buttons (success check, danger x) for pending rows | arrow-right.

**Notes for landing:** This is THE screen to hero the product. The copy "Decisions owed" + "Approval is a policy, not an AI decision" + the row with a $412 refund + the green/red quick-action buttons in one frame tells the whole pitch.

### 5.13 Approval detail — `#/approvals/:id` ⭐⭐

**Layout:** narrow page. Header → CommandBar → decision card (state-dependent) → fields card → evidence card.

**Copy:** Eyebrow `APPROVAL · apv_9021`. Title = the action string e.g. `"stripe.refund · $412 on charge ch_3P8fL2 (order #44021)"`.

**CommandBar:** ID · RUN (accent) · TASK · NEEDS (e.g. `domain_admin`) · EXPIRES (warn) / RESOLVED.

**Decision intro card** (when pending and you can decide): warn-tinted, title "Your decision is required", two-column CTA grid:
- **Approve** — success-green panel with check icon, "Resume the suspended run and execute the requested action.", "Reason optional" mono footer.
- **Reject** — danger-red panel with X icon, "Stop the requested action. The run is terminated.", "Reason required" footer.

**Decision confirm card:** after picking, colour-keyed to the decision (success or danger border), sub-card "What happens next" showing either play-icon + `Run run_4081 leaves the suspended state, the orchestrator executes the pending step.` or stop-icon + `Run run_4081 does NOT execute the pending action. The run terminates in the rejected state.`

Below: reason textarea (required for reject, ≥4 chars), signing-as line (`Signing as: Ada Fernsby · frontend@int3grate.ai · L4`), submit button (`Approve · resume run` or `Reject · stop action`).

**Conflict banner** (danger): "Already resolved · approved — Another approver decided this while you were reviewing."

**Resolved card:** success or danger tint, 40px icon tile (check/x/lock), big serif status word, decider uuid, resolved-at timestamp, italic reason quote, `Open run →` link.

**Fields card:** MetaRow list of every `ApprovalRequest` schema field.

**Evidence card:** `evidence_ref` pretty-JSON in a bordered `<pre>`.

**Notes for landing:** Perfect companion to the inbox for a "two-screen diptych" hero — inbox on the left, the approve/reject decision on the right.

### 5.14 Spend dashboard — `#/spend` ⭐

**Layout:** wide page. Header → range/group_by chip row → 3 summary cards → horizontal-bar chart → breakdown table.

**Copy:** Eyebrow `SPEND · GET /dashboard/spend · 7d · agent`. Title: display of `$X.Yk <em>spent</em>`. Sub: "Aggregated spend returned by `GET /dashboard/spend`. Fields: range, group_by, total_usd, items[]."

**Controls row:** `range` chips (1d · 7d · 30d · 90d), separator, `group_by` chips (agent · user).

**Summary cards (all derived from response):**
1. `total_usd` · big compact money · "dashboard root field"
2. `sum of run_count` · number · "across X agents"
3. `tokens · in / out` · k-rounded number · "in Xk · out Yk"

**Spend-by-group card:** horizontal bar for each row — 180px label column, 1fr bar track (accent gradient fill), 150px money + share% column.

**Breakdown table columns:** `label · id` (with agent icon for `group_by=agent`) · `total_usd` (right-aligned mono) · `runs` · `tokens_in` · `tokens_out` · `spend_date`. Clicking an agent row navigates to that agent's detail.

**Member no-access:** full-screen `NoAccessState` — "Spend analytics are scoped to admins."

**Notes for landing:** the horizontal bar chart + summary cards is a clean "numbers look" frame.

### 5.15 Not found — any unmatched route

Simple empty state, "Route not found. Pick a destination from the sidebar." + back-to-home primary button.

---

## 6. Recommended hero flow for the landing

If the landing page tells ONE story, tell this one:

1. **Frame the problem** with the login tagline:
   > Let agents do work. Keep humans in control.

2. **Show how** — illustrate the chain. A simple diagram works:
   `Agent → Version → Tool Grants → Task → Run → Run Steps → Approval → Spend`

3. **Show the keystone screen — Approvals inbox.** Use the actual copy: "Decisions owed." / "Approval is a policy, not an AI decision." A single screenshot of the approvals table with a $412 refund row and green/red quick-action buttons is the most concentrated visual the product has.

4. **Show the decision experience** — the Approval detail page with the Approve/Reject CTA cards side by side, reinforcing that approving **resumes the suspended run** and rejecting **stops it**.

5. **Show the audit** — the Run detail timeline with an expanded step showing JSON `input_ref`/`output_ref`. This is "every action is logged" made concrete.

6. **Show spend visibility** — the Spend dashboard with the bar chart. Always call it "spend visibility", never "ROI".

7. **Close with the tagline repeated, CTA = Sign in.**

---

## 7. Alternative narrative angles (pick one)

- **"Your fleet"** — lead with the Agents list to a more ops-y audience.
- **"Work in motion"** — lead with Tasks + Runs for teams who already have AI in prod.
- **"Approval is a policy"** — lead with the Approvals inbox; best for compliance-focused buyers.

---

## 8. Target audience

- **Ops leads / platform engineers** — the primary user. They set up agents and write the policies.
- **Domain managers** — approvers at L3. They handle day-to-day approvals for their domain.
- **Compliance / finance** — audit the trail, watch spend.
- **Developers** — read the endpoint chips on every page; they can see the API contract without opening docs.

Not the audience: end-users of the agent (those interact through the agent itself, not the control plane).

---

## 9. Core concepts the landing MUST explain

Briefly, but these are non-negotiable:

1. **Agent ≠ agent version.** The agent is the container; the version is the immutable config. You ship new versions, you don't edit them.
2. **Tool grants are the policy.** Approval isn't decided by the AI — the operator writes `approval_required: true` on a grant, the orchestrator enforces it.
3. **Runs suspend on approval gates.** The agent doesn't "wait politely" — the orchestrator stops the run and routes to a human; approve resumes, reject cancels.
4. **Spend visibility, not ROI.** We measure cost and throughput, not business value. Don't claim ROI.
5. **Audit trail is primitive.** Every step is logged with refs; `GET /runs/{id}` returns the full timeline.

---

## 10. Copy vault — ready-to-drop strings

All pulled verbatim from the product; safe to reuse on the landing.

### Taglines
- **Let agents do work. Keep humans in control.**
- **Approval is a policy, not an AI decision.**
- Decisions owed.
- Your fleet.
- Work in motion.
- Run timeline.
- Dispatch a task.

### Page eyebrows (endpoint-flavoured; use sparingly for "technical credibility" sections)
- `DASHBOARD`
- `AGENTS · GET /agents`
- `TASKS · GET /tasks`
- `APPROVALS · GET /approvals`
- `SPEND · GET /dashboard/spend`
- `PROFILE · GET /me`

### One-liners you can subhead with
- "Configure what agents are and what they may touch."
- "Each task is dispatched to an agent. The backend returns only task-level metadata — runs are fetched separately."
- "The orchestrator creates an approval request whenever a grant or rule requires a human decision. The agent doesn't choose — it's gated."
- "Full step audit trail for this run."
- "Aggregated spend returned by GET /dashboard/spend. Fields: range, group_by, total_usd, items[]."

### Status vocabulary (consistent everywhere)
- Agent: `draft / active / paused / archived`
- Task: `pending / running / completed / failed / cancelled`
- Run: `pending / running / completed / failed / suspended / cancelled`
- Approval: `pending / approved / rejected / expired / cancelled`

---

## 11. What NOT to say on the landing

These promises aren't in the prototype or gateway. Avoid:

- "ROI" — we compute cost, not business value.
- "Real-time analytics" — no live streaming, no deltas, no burn charts.
- "Agent marketplace" / "Integrations catalog" — no catalog in the backend.
- "Team collaboration" — no comments, no threads.
- "One-click deploy" — agents need configuration.
- "Run history" aggregated across agents — no global `GET /runs` endpoint.
- "User management" — no `GET /users` endpoint; the app knows only the logged-in user.
- "Search" — no search endpoint.
- "CSV export" — nothing exports.

---

## 12. Technical pointers for the landing agent

- **Embedding the prototype:** It lives under `/#/…` hash routes. If the landing is served at `/` (no hash) the existing `App.tsx` renders the Vite starter; any hash starting with `#/` mounts the prototype. To link the landing's "Open prototype" CTA, use `href="#/"`.
- **Single Vite bundle:** both the landing (`App.tsx`) and the prototype share one React bundle. CSS isolation is done with a `.prototype-root` wrapper — don't wrap landing components in that class.
- **Accent re-theming:** If the landing wants to adopt the Int3grate.ai palette, the single load-bearing token is `--accent: #0F62FE`. Everything else cascades.
- **Screenshots:** All prototype screens are SSR-safe (no heavy charts). For hero imagery, log in as `frontend@int3grate.ai` and:
  - `#/` for dashboard
  - `#/approvals` for the inbox hero
  - `#/approvals/apv_9021` for the decision screen
  - `#/runs/run_4081` for the timeline (expand a step for the JSON reveal)
  - `#/spend` for the bar chart
- **No analytics / tracking** is currently wired. If the landing needs pageview tracking on the prototype, add it in `prototype/index.tsx`, not globally.

---

## 13. File-level map for your reference

| File | What's in it |
| --- | --- |
| `src/App.tsx` | Landing page container + `#/` hash check to mount prototype |
| `src/prototype/index.tsx` | Prototype router, maps hash to screen component |
| `src/prototype/prototype.css` | All prototype visual tokens (palette, typography, layout, component styles) |
| `src/prototype/lib/types.ts` | Backend-aligned TypeScript types |
| `src/prototype/lib/api.ts` | Mock API; each method matches one endpoint in gateway.yaml |
| `src/prototype/lib/fixtures.ts` | In-memory seed data used by the mock API |
| `src/prototype/components/shell.tsx` | Sidebar + Topbar + AppShell wrapper |
| `src/prototype/components/common.tsx` | Primitives (Btn, Chip, Status, PageHeader, CommandBar, Avatar, Tabs, Dot) |
| `src/prototype/components/states.tsx` | Empty / Error / Loading / NoAccess / Banner |
| `src/prototype/components/icons.tsx` | SVG icon set |
| `src/prototype/screens/*` | One `.tsx` per screen listed in § 5 |
| `gateway.yaml` | The backend contract; source of truth for what data exists |

---

## 14. Checklist when the landing is updated

- [ ] Hero headline uses the actual tagline: **"Let agents do work. Keep humans in control."**
- [ ] At least one screenshot or mock of the **Approvals inbox** (key differentiator).
- [ ] Copy never promises features listed in § 11 ("what NOT to say").
- [ ] Accent colour matches `#0F62FE`.
- [ ] Font is Inter everywhere (no substitutes).
- [ ] Dark-mode aesthetic is preserved — this product does not have a light theme.
- [ ] CTA button that enters the prototype links to `#/`.
- [ ] If the landing embeds a live screen, it wraps the embed in the `.prototype-root` class and lets `prototype.css` style it.

That's the full briefing. If something's ambiguous, open the screen in the prototype — the product is the source of truth.
