# TOURS_PLAN.md

Status: **In progress** — `sidebar-overview`, `approval-review`,
`start-a-chat`, and `configure-tool-grants` tours shipped; the
remaining Phase 6 tours are still proposed and not yet implemented.

Plan for expanding the guided-tour system (`src/prototype/tours/`).
Captures which tours are worth building, what they need to cover, and
what engine work has to land before some of them are practical.

The expanded scope adds two structural pieces beyond more tours:

- A **Training mode** that swaps real backend data for tour-specific
  fixtures while a tour is active, so a new user with zero approvals /
  agents / runs can still walk through "Review an approval" against
  realistic content. Mutations are sandboxed; on tour end the
  pre-tour state is restored.
- A **Learning Center** page (`/learn`) that lists all tours, their
  status, audience, and lets the user start or restart any of them
  from one place. A one-time welcome banner on first login points
  there.

## Recommended tours, in build order

Each tour (except `sidebar-overview`, which doesn't depend on data) is
bound to a Training Mode scenario with the same id — see the **Training
mode** section below for the fixture sets each scenario seeds.

### 1. `approval-review` — Review an approval (priority: P0)

- **Audience:** admin / domain_admin (gated by role on the sidebar nav).
- **Routes:** `/approvals` then `/approvals/:approvalId` (cross-screen).
- **Why this first:** the approval queue is the core value prop of the
  control plane (human-in-the-loop). It's also the most error-prone
  surface — a wrong click commits a real-world side effect — so an
  explanatory walkthrough has the highest practical value of any
  candidate. Builds out the cross-screen capability of the engine,
  which subsequent tours can reuse.
- **Proposed steps (7–8):**
  1. Sidebar approvals badge (`data-tour="nav-approvals"`) — explain the
     amber count means pending decisions waiting on you.
  2. Queue table row (`data-tour="approval-row"`) — what each row shows
     (action, requester, age, approver role).
  3. Status filter chips (`data-tour="approvals-filter"`) — pending vs
     resolved.
  4. *(navigation: click a row → `/approvals/:id`)*
  5. Action title (`data-tour="approval-action"`) — `prettifyRequestedAction`
     output, why it's friendly-formatted.
  6. Evidence panel (`data-tour="approval-evidence"`) — read this to
     understand context before deciding.
  7. Approve / Reject buttons (`data-tour="approval-decision"`) — both
     queue an async decision; the run resumes once accepted.
  8. Reason field (`data-tour="approval-reason"`) — required for reject
     (≥ 4 chars), optional for approve.
- **Engine requirement:** cross-screen tours. See "Engine improvements"
  below; a minimum-viable approach is to split this into two linked
  tours (`approvals-queue` + `approval-decision`) until the engine
  handles route changes natively.

### 2. `start-a-chat` — Start a chat (priority: P1)

- **Audience:** all roles.
- **Routes:** `/chats/new` (single screen, redirects to `/chats/:id`
  on submit — tour ends before the redirect).
- **Why:** the primary interactive surface for end users. The
  model-fixed-per-chat constraint and the "agent must be active" gate
  are not obvious from the UI alone.
- **Proposed steps (4–5):**
  1. Agent picker (`data-tour="chat-agent-picker"`) — pick an active
     agent. Paused/archived agents are dimmed and cannot start a chat.
  2. Active version chip (`data-tour="chat-agent-version"`) — every
     chat is bound to one `agent_version_id` for its lifetime.
  3. Title field (`data-tour="chat-title"`) — optional, shown in the
     chat list.
  4. Model select (`data-tour="chat-model"`) — defaults to the version's
     primary model and is **fixed once the chat opens**. To switch
     models, open a new chat.
  5. Open chat button (`data-tour="chat-submit"`) — redirects to the
     conversation surface.

### 3. `configure-tool-grants` — Configure tool grants (priority: P1)

- **Audience:** admin / domain_admin (the grants editor allows both roles).
- **Routes:** `/agents/:agentId/grants`.
- **Why:** security-critical and the UI is dense — catalog Select +
  scope_type + mode + approval switch per row. Without a
  walkthrough the read / write / read_write × scope_type matrix is
  opaque, and a wrong grant changes what the agent can touch.
- **Implemented steps (7):**
  1. Catalog Select (`data-tour="grants-catalog"`) — search and pick another
     tool from the global catalog. The dropdown items are 2-line
     name + description (see `prototype.css` `.catalog-item`).
  2. Add grant button (`data-tour="grants-add"`) — adds another
     editable grant row to the training scenario.
  3. Tool cell (`data-tour="grants-tool-cell"`) — shows the granted
     tool name in the table row.
  4. Scope type selector (`data-tour="grants-scope-type"`) — agent,
     domain, tenant; explains the inheritance model.
  5. Mode selector (`data-tour="grants-mode"`) — `read` /
     `write` / `read_write` semantic difference.
  6. Approval switch (`data-tour="grants-policy"`) — toggles whether
     the grant requires a human approval before risky tool use.
  7. Save button (`data-tour="grants-save"`) — atomic replace of the
     full grants list (`PUT /agents/:id/grants`).

### 4. `inspect-a-run` — Inspect a suspended / failed run (priority: P2)

- **Audience:** all roles (read-only view; no role gating beyond
  per-tenant visibility).
- **Routes:** `/runs/:runId`. Pre-condition: a run with `status` in
  `suspended` / `failed` / `completed_with_errors`. The tour should
  steer the user to a representative fixture run on launch.
- **Why:** the run detail screen has many conditional banners
  (suspended, failed, completed-with-errors, tool-errors card) plus
  the step timeline. New users have a hard time mapping "what went
  wrong" to a specific step without a guided pass.
- **Proposed steps (5–6):**
  1. Status pill (`data-tour="run-status"`) — `Status` component
     mapping; pulse animation flags in-flight states.
  2. CommandBar (`data-tour="run-commandbar"`) — task ref, error kind,
     steps count, tokens, spend, "waiting on" stage.
  3. Suspended banner (`data-tour="run-banner-suspended"`) — only
     shown if `run.status === 'suspended'`; explains the orchestrator
     paused on `suspended_stage` and an approval is waiting.
  4. Tool-errors card (`data-tour="run-tool-errors"`) — only shown if
     any step had a tool-level error.
  5. Step timeline (`data-tour="run-steps"`) — what each step kind
     means (LLM call, tool call, memory read/write, approval gate,
     validation), how to read durations and tokens.
  6. Step expand (`data-tour="run-step-row"`) — click a step row to
     see its tool args / result.
- **Engine requirement:** "conditional step" — skip a step if its
  target doesn't resolve (the suspended banner only exists for
  suspended runs). Today the overlay falls back to a "not on this
  screen" message, which is acceptable but ugly; see "Engine
  improvements".

### 5. `spend-overview` — Spend dashboard tour (priority: P3)

- **Audience:** admin / domain_admin.
- **Routes:** `/spend`.
- **Why:** lower-priority because the screen is mostly static analytics
  — there's not much to "do", just read. A 3-step "what is this chart"
  tour is enough; doesn't justify a full multi-step walkthrough.
- **Proposed steps (3):**
  1. Range selector (`data-tour="spend-range"`) — 7d / 30d / 90d.
  2. Group-by selector (`data-tour="spend-groupby"`) — agent / domain
     / tool / user.
  3. Spend table (`data-tour="spend-table"`) — what each row shows;
     click a row to open the corresponding entity.

## Tours we are deliberately NOT making

- **Sidebar overview** — already shipped as `sidebar-overview`.
- **Tasks flow** (`/tasks*`) — backend is `x-mvp-deferred`. Building a
  tour against deferred surfaces will need to be redone when the
  feature lands.
- **Audit log** (`/audit`) — admin-only, simple table UI, narrow
  audience. Inline `InfoHint` on the columns is sufficient.
- **Create agent** (`/agents/new`) — rare operation, full form. Field
  hints inside `TextInput` / `SelectField` are a better fit than an
  overlay tour.
- **Register screen** — mock-only, no real flow to walk through.
- **Profile** — single trivial screen.

## Training mode (the empty-tenant problem)

A real new tenant has zero agents, zero approvals, zero runs — every
data-dependent tour above would land on an `EmptyState` screen and fall
flat. Instead of forcing tours to be empty-state-friendly (which limits
what they can teach), we swap real data for tour-specific fixtures
while the tour is active.

### Architecture

- New `TrainingModeProvider` context above the API boundary. State:
  `{ active: boolean; scenario: string | null }`.
- New `lib/training-fixtures.ts` exports one fixture set per scenario
  (matching the tour id). A scenario is a function that returns the
  agents / approvals / runs / chats / users etc. needed for that tour.
- The `lib/api.ts` boundary checks `TrainingModeProvider.active`.
  When active, every `api.list*()` / `api.get*()` reads from the
  active scenario's snapshot rather than the real fixture arrays.
  Mutations (`api.decideApproval`, `api.createChat`, etc.) write only
  into a scratch sandbox tied to that scenario's session — they never
  hit the real arrays or, on the real platform, the backend.
- On tour start: snapshot current state (no-op on real backend, since
  reads bypass it), set `active = true, scenario = '<id>'`.
- On tour end (Done / Skip tour / Esc / timeout): clear scenario, set
  `active = false`. Sandbox is discarded — no persistence anywhere.

### Visual indication — non-negotiable

Without a clear marker the user can't tell training data from real.
While `active`:

- Sticky bar across the top, amber tone (`--amber-3` background,
  `--amber-9` text/icon), copy: **"Training mode — your changes here
  aren't saved."** Plus a primary "Exit training" button on the right.
- Small pulse-dot in Topbar near the "?" icon as a secondary cue.
- Banners on each card screen (`<Banner tone="warn">`) are excessive —
  the sticky top bar is enough.

### Per-scenario fixture sets

Each scenario contains the minimum data to make its tour feel real:

| Scenario id | Seeds |
|---|---|
| `approval-review` | 1 active agent, 1 user (the trainee), 1 run paused on a `tool_call` stage, 1 pending approval against that run with a realistic `requested_action` (e.g. `stripe.refund`). |
| `start-a-chat` | 2 agents (one active with an active version, one paused — to demonstrate the "can't chat" affordance), 0 chats. |
| `configure-tool-grants` | 1 active agent, 1 demo grant (so the tour can spotlight real table cells), with the catalog still available for adding another grant. |
| `inspect-a-run` | 1 suspended run with a representative step timeline (LLM call, tool_call with an error, approval_gate at the tail), 1 matching pending approval. |
| `spend-overview` | Synthetic 30-day spend dataset across 3 agents and 2 domains, plus 1 spike day. |

`sidebar-overview` does NOT use Training mode — it only points at
sidebar nav items, which exist regardless of data.

### Risks / open decisions

- **Idle timeout.** If the user wanders off mid-tour, training mode
  could persist indefinitely. Auto-exit after ~15 minutes of no tour
  interaction (no Next/Back/key press / no `useTour` API call).
- **Manual navigation away from tour.** Today the tour shows a
  "not on this screen" fallback if the target is missing. In
  Training mode that's worse — user might think the empty state is
  real. Decision: ending the tour also ends Training mode, even if
  the user navigates away first.
- **Mutations during the tour.** `Approve` / `Reject` should fully
  complete inside the sandbox, including showing the post-decision
  state, so the tour can demonstrate the "decision queued, run
  resumed" UX. They never call the real backend.
- **Analytics.** Real-platform analytics must distinguish
  `training=true` events. Don't pollute funnels with simulated
  Approve clicks. The training-mode flag is part of every emitted
  event payload.
- **Mixing real + training.** Hard rule: full snapshot/replace, never
  partial. Anything else is a debugging nightmare.

## Learning Center (`/learn`)

Single-page hub for all tours. Authenticated route, listed in the
sidebar (probably under the brand block, separate from the main nav,
or as a "Help" item near the footer).

### Layout

- `PageHeader` — eyebrow `LEARN`, title "Learning Center", short
  subtitle.
- One section per group:
  - **Getting started** — `sidebar-overview`, `start-a-chat`.
  - **Core workflows** — `approval-review`, `inspect-a-run`.
  - **Admin setup** — `configure-tool-grants`, `spend-overview`.
- Each tour rendered as a card:
  - Title + 1-line description.
  - Audience pill (All / Admin / Domain admin).
  - Estimated duration ("~2 min · 5 steps").
  - Status: `Not started` / `Completed` (read from
    `useTour().isCompleted(id)`).
  - Primary action: `Start tour` (or `Restart` if completed).
  - Secondary line: requirements ("Admin only" → button disabled with
    a hint for member users).

### Behaviour

- Visiting `/learn` does NOT itself enter Training mode. Each card's
  Start button does, scoped to that tour's scenario.
- The "?" `IconButton` in Topbar — currently launches
  `sidebar-overview` directly — switches to navigating to `/learn`.
  Keyboard shortcut `?` (Shift+/) also opens `/learn`.
- Re-running a completed tour is allowed. `markCompleted` is
  idempotent.

## First-login welcome prompt

Surface the Learning Center the first time a user lands on the app,
without modal-blocking them.

- After `AuthProvider` resolves a user and route is anything other
  than `/login` / `/register`, check
  `localStorage["proto.tours.v1"].welcomePromptShown`.
- If not shown: render a non-blocking toast/banner pinned bottom-right
  for ~10s, dismissable, copy:
  > **New here?** The Learning Center has short tours that walk you
  > through agents, approvals, and runs. → **Open Learning Center**
- Click → navigate to `/learn`. Either click or dismiss flips
  `welcomePromptShown = true`.
- Never re-shown to the same browser/session, even after clearing
  individual tour completions.

## Engine improvements that unblock the above

The current `TourOverlay` only handles single-page targets via
`document.querySelector` with retry. A few small additions cover most
multi-screen tours.

1. **Cross-screen step (`navigateTo` on `TourStep`).** When a step
   declares `navigateTo: '/approvals/:id'`, the engine navigates via
   `useRouter().navigate(...)` before resolving the target. Needed by
   `approval-review` step 4. Likely shape:
   ```ts
   interface TourStep {
     // ...
     navigateTo?: string                       // hash route
     waitForTarget?: boolean                   // default true
   }
   ```
2. **Conditional step (`when` predicate).** Skip a step entirely when
   its precondition fails. Needed by `inspect-a-run` to skip the
   suspended banner step on non-suspended runs:
   ```ts
   interface TourStep {
     // ...
     when?: () => boolean                      // skip if false
   }
   ```
3. **`TrainingModeProvider` + sandboxed API.** New context above the
   API boundary that, while active, makes `lib/api.ts` reads return
   scenario fixtures and writes go to an in-memory sandbox. Tour
   start sets `{ active: true, scenario: '<id>' }`; tour end (or
   idle timeout) clears it. The sticky amber top-bar with "Exit
   training" is the visible counterpart. See the **Training mode**
   section above for full architecture.
4. **`/learn` route.** New top-level authenticated route that mounts
   a `LearnScreen` listing tours grouped by audience/topic, with
   per-tour status pulled from `useTour().isCompleted(id)`. The "?"
   button in Topbar (currently launches `sidebar-overview`) is
   repointed at this route.
5. **Welcome prompt.** Non-blocking toast on first authenticated
   mount where `welcomePromptShown !== true` in
   `proto.tours.v1`, pointing at `/learn`. Dismiss or click flips the
   flag. Replaces the simpler "auto-launch sidebar tour" idea — sending
   the user to the hub is more general.
6. **Resume after navigation.** Lower priority. If the user navigates
   away (e.g. clicks a sidebar link) mid-tour, today the tour stays
   "active" but its target no longer resolves and falls back to the
   "not on this screen" message. With Training mode active, this is
   strictly worse — user sees fake data on a screen the tour didn't
   intend. Decision: ending the tour also ends Training mode, even
   if the user navigates away first.

## Conventions for new tours

- Tour data lives in `src/prototype/tours/<tour-id>.tsx`. One file per
  tour. Keep the body copy ≤ 2 sentences per step.
- Tour ids are kebab-case strings (matched against
  `proto.tours.v1` localStorage). They are user-visible only via
  `isCompleted()`; don't leak into UI copy.
- Targets are `data-tour="..."` attributes on stable DOM nodes. Prefer
  attaching them at component boundaries (`PageHeader`, `CommandBar`,
  card heads) rather than deep inside JSX so the tour survives style
  refactors.
- Placement defaults to `right` for sidebar items, `bottom` for
  PageHeader anchors, `top` for footer-pinned controls. Pick whatever
  doesn't push the tooltip off-viewport at a 1280×800 reference size.
- Each tour should be standalone — no required preceding tour. The
  user can start anywhere.

## Open questions

- Do we want **per-role tours** (admin vs member) for the same screen,
  or a single tour that uses `when` predicates? Current bias: single
  tour with conditional steps. Revisit once `inspect-a-run` ships and
  we see if conditionals get unwieldy.
- Should completed tours stay "available" from the `/learn` page (so
  users can re-watch), or hide once `isCompleted`? Current bias: keep
  visible with a check mark — re-watching is a feature, not a bug.
- Should `/learn` itself be available pre-login (e.g. linked from the
  marketing landing page) or strictly authenticated? Current bias:
  authenticated only — Training mode needs the auth shell to work.
- For the real platform, where do training-mode mutations actually
  live? Pure client-side `Map`s (cleared on reload), or a short-lived
  server-side sandbox session? Client-side is simpler; server-side
  lets touring users see the same scenario across tabs. Defer until
  we know whether multi-tab tour replay is a real use case.
- Idle timeout duration for Training mode — 15 min is a starting
  guess. May need shorter (5 min) if users tend to alt-tab away
  mid-tour, or longer (30 min) if a tour is read-heavy. Revisit
  after first real tour ships.
