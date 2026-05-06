# AGENTS.md

This file provides guidance to Codex (or any other AI coding agent) working in this repository. It reflects the **current state** of the prototype, aligned with `docs/ux-spec.md`.

# Agent Working Agreement

These rules are mandatory for all AI agents working in this repository.

## Core behavior

- Do not jump directly into implementation for non-trivial work.
- Before implementing anything, inspect the current repository state and verify that your assumptions match the actual codebase.
- Prefer evidence from the current files over prior memory, model knowledge, or user assumptions.
- Be strict, skeptical, and direct. If the user's idea is risky, inconsistent with the codebase, over-engineered, under-specified, or likely to create maintenance problems, say so clearly and propose a better alternative.
- Do not agree just to be helpful. Push back when needed.

## When a plan is required

Create a written plan before implementation when the task involves any of the following:

- more than one file;
- architectural or state-management changes;
- routing, data loading, authentication, payments, permissions, forms, or API integration;
- refactoring;
- new dependencies;
- changes that may affect UX, performance, accessibility, SEO, or build behavior;
- any task where the correct approach is not obvious from a quick inspection.

For trivial one-line fixes, typo fixes, or purely mechanical changes, a written plan is not required, but the agent must still briefly state what it is going to do.

## Plan file requirements

For every planned task, create a new plan file under:

`docs/agent-plans/`

Use this naming format:

`YYYY-MM-DD-HHMM-short-task-name.md`

The plan file must be a living document and must include:

1. Task summary
2. Current repository state
3. Relevant files inspected
4. Assumptions and uncertainties
5. Proposed approach
6. Risks and trade-offs
7. Step-by-step implementation plan
8. Verification checklist
9. Browser testing instructions for the user
10. Progress log

Before implementing the first step, the agent must verify that the plan still matches the real current codebase.

## One-step-at-a-time execution

When working from a plan:

- Do exactly one plan step per work cycle.
- After completing one step, stop and report:
  - what was changed;
  - which files were touched;
  - why this step was done this way;
  - how the user can verify the result locally in the browser;
  - what the next step in the plan is.
- Do not continue to the next step until the user explicitly asks to continue, unless the user has clearly asked for autonomous execution.

## Repository state check

Before creating or executing a plan, inspect the project state. At minimum:

- check the current git status;
- inspect package scripts and available commands;
- inspect relevant routes/components/modules before changing them;
- identify the framework and key conventions actually used in this repo;
- check for existing patterns before introducing new ones.

Do not rely on stale assumptions.

## Frontend verification

For frontend changes, always include browser verification instructions.

The report after each step must explain:

- which page or route to open;
- what the user should click or interact with;
- what visual or behavioral result should be expected;
- what edge case should be checked, if relevant.

If a browser check is not possible or not relevant, explain why.

## Pushback policy

The agent must challenge the user when appropriate.

Push back when:

- the requested change conflicts with existing architecture;
- the requested approach is more complex than necessary;
- the change is likely to introduce bugs or regressions;
- the requirement is ambiguous;
- the requested UX is inconsistent or harmful;
- there is a simpler, safer, or more maintainable option.

When pushing back:

1. State the concern clearly.
2. Explain the technical reason.
3. Offer a better alternative.
4. Ask for confirmation only if the trade-off is genuinely a product decision.

Do not be rude, but be firm.

## Read first

Before touching any UI text or making product decisions, read in this order:

1. **`docs/ux-spec.md`** — canonical spec for the target user (Maria, agent-curious owner). Everything user-facing should align with this. § 11 has explicit instructions for AI agents reviewing the project.
2. **`docs/backend-gaps.md`** — catalogue of mock-only surfaces and missing backend endpoints. Don't try to "fix" these from the frontend.
3. **`docs/backlog.md`** — current open items. Skim at session start.

## Commands

- `npm run dev` — Vite dev server with HMR.
- `npm run build` — `tsc -b` (project references) then `vite build`. Treat TS errors as build failures; the project enables `noUnusedLocals`, `noUnusedParameters`, and `verbatimModuleSyntax` (use `import type` for type-only imports).
- `npm run lint` — flat-config ESLint over `**/*.{ts,tsx}` with `typescript-eslint`, `react-hooks`, and `react-refresh/vite`.
- `npm run preview` — serve the production build.

There is no test runner configured.

### Local launch and visual verification

- The current app mounts the prototype directly. Use `http://localhost:5173/#/` as the default local URL.
- Do **not** use the old `#/app/...` prefix. Real routes are direct hash routes such as `#/agents`, `#/approvals`, `#/activity`, and `#/agents/new`. The `#/app` toggling architecture was removed — `src/App.tsx` now just returns `<PrototypeApp />`.
- If the user says the app is already running, verify against that live server instead of trying to start another dev server.
- For isolated headless checks, seed the admin session in localStorage before loading routes: `localStorage.setItem('proto.session.v1', JSON.stringify({ token: 'mock_usr_ada', userId: 'usr_ada' }))`.
- For vocabulary/UI-copy passes, visually check at least: Home, Approvals list/detail, Activity list + expanded row, Team (`/agents`), Agent detail tabs, Costs, and the Hire wizard welcome → success. Apps / Settings / Audit / Register are not currently routed (see Architecture below).
- A successful vocabulary pass should find no visible `Assistant` / `Assistants` / `AI worker` copy in those routes. Internal IDs like `assistants`, `/agents`, `role: 'assistant'`, and `data-tour="nav-assistants"` can remain.

## Architecture

This is a **Vite + React 19 + TypeScript** single-page app. The current app mounts the prototype directly:

- `src/App.tsx` is a 5-line wrapper that returns `<PrototypeApp />`. There is no public landing page and no `#/app` toggle.
- `src/prototype/` is the actual product mockup — a control plane operator UI for managing AI agents, conversations, activity, approvals, and costs.

### The prototype (`src/prototype/`)

Self-contained mock of a multi-tenant agent control plane. **No backend** — everything is in-memory fixtures. The mock is shaped 1:1 against the gateway OpenAPI spec so swapping in a real http client should be a thin replacement at the `lib/api.ts` boundary.

#### Backend contract

Canonical backend contract: **`docs/gateway.yaml`** (OpenAPI 3.2.0). **This file is synced verbatim from the live stage backend** at `https://stage.api.int3grate.ai/docs/openapi.yaml` (last pulled 2026-05-01). It IS what the backend actually exposes — not what we wish it exposed. Refresh with `curl -sS https://stage.api.int3grate.ai/docs/openapi.yaml > docs/gateway.yaml`. The earlier local-only extended draft (which had endpoints the real backend never had — `/auth/register`, `/users`, `/tasks/*`, `/tenants/*`, integration registry) is archived as `docs/gateway-legacy-2026-04.yaml` for diff/history only.

`docs/backend-gaps.md` catalogues every place the UI promises functionality the backend doesn't yet expose. **Read it before invoking new endpoints or proposing backend wiring.**

Key gaps (validated against live spec 2026-05-01):

- `POST /auth/register` — absent. UI hidden (registration screen + "Create account" button commented out).
- `GET /users` — absent. UI uses `requested_by_name` (denormalised in approval) where possible; ALL user-name surfaces removed (approver name, agent owner, version author).
- `GET /approvals/{id}` — absent (deep-link single-fetch). UI hydrates from the list response.
- `/tasks/*` — absent in live spec entirely. UI fully removed 2026-05-02 (4 screens deleted, routes/types/fixtures cleaned). Approval `task_id` field stays in spec but no UI consumer.
- Integration registry / OAuth flow (`/integrations/*`) — absent and architecturally out-of-scope (see `docs/handoff-prep.md § 0` — shared backend credentials, no per-tenant OAuth). Apps page hidden.
- Workspace CRUD / `PATCH /agents/{id}` (Pause/Fire) — absent. Settings page hidden; AgentDetail "Manage employment" surface removed from the visible Settings tab.
- Per-week spend buckets — backend exposes only aggregate ranges; 4-week trend is split client-side.
- Activity sentence summaries — backend doesn't return per-run summary; headlines on `/activity` are derived client-side from `RunStatus`.
- Naming mismatch: tool catalog endpoint is `/tool-catalog` in live, but `api.listTools()` in mock targets `/tools`. Update at production swap; mock layer is unaffected.
- `AgentVersion.*_config` shapes — `model_chain_config` / `memory_scope_config` / `tool_scope_config` / `approval_rules` are spec'd as `object additionalProperties: true`, so internal fields aren't fixed. UI used to render speculated fields (Model / Memory / Apps / Approval rules cards on AgentDetail → Advanced); those four cards were removed 2026-05-06. See `docs/backend-gaps.md § 1.13`.
- `GET /internal/agents/{id}/grants/snapshot` is `x-internal: true` (orchestrator-only). UI used to render a `PolicySnapshotPanel` on AgentDetail → Advanced calling this endpoint; the panel was removed 2026-05-06. `api.getGrantsSnapshot()` + `GrantsSnapshot` types kept for a possible future internal-tools UI. See `docs/backend-gaps.md § 1.14`.

#### Routing (`router.tsx`, `index.tsx`)

Hand-rolled hash router. Routes are declared as a flat list in `index.tsx` using `matchRoute(pattern, path)` with `:param` segments. **Always navigate via the `<Link>` component or `useRouter().navigate`** — they write direct hash routes such as `#/agents` and `#/activity`. There is **no `/app` prefix** anywhere; route patterns are matched against the raw hash path.

Current route map (live in `src/prototype/index.tsx`):

- `/`, `/login`, `/profile`, `/learn`. `NotFoundScreen` is the fallback. `/register` is commented out (see backend gaps).
- `/agents`, `/agents/new`, `/agents/:agentId` (Overview default), `/agents/:agentId/{talk,grants,activity,settings,advanced}`, `/agents/:agentId/talk/:chatId` (embedded chat), `/agents/:agentId/versions/new`.
- `/approvals`, `/approvals/:approvalId`.
- `/activity`, `/activity/:runId` (Technical view — labelled `advanced` in the UI).
- `/costs`.
- `/sandbox/team-bridge`, `/sandbox/approvals-inline`, `/sandbox/quick-hire` — design-exploration previews, surfaced in the sidebar with a muted "preview" badge.
- Legacy redirects: `/runs[/...]` → `/activity[/...]`, `/spend` → `/costs`, `/chats` → `/agents`, `/chats/:chatId` → resolves agent_id and forwards to `/agents/:agentId/talk/:chatId`. `/chats/new` still exists as a chat-creation form; after `createChat` it navigates to the embedded path.
- **Hidden (commented out, not deleted):** `/register`, `/apps` + `/tools` redirect, `/settings` + `/settings/{team,history,developer,diagnostic}`, `/audit`. Their screen files (`RegisterScreen.tsx`, `ToolsScreen.tsx`, `SettingsScreen.tsx`, `AuditScreen.tsx`) are preserved for restoration but no route currently mounts them.

> ⚠️ **`Link` props pass-through**: the `Link` component accepts the full `AnchorHTMLAttributes` surface (minus `href`/`onClick`, which it owns) and spreads it onto the inner `<a>`. This is what makes Radix Themes `asChild` composition work. Don't tighten the props back to a fixed list.

#### Sidebar (`components/shell.tsx`)

5 production items + 3 sandbox preview items. Apps / Settings / Audit nav entries are commented out (alongside their routes). Settings was admin-only when shipped; the role gate is preserved in the comment block for restoration.

Production:
1. **Home** (`/`) — operational dashboard.
2. **Approvals** (`/approvals`) — pending decisions, with badge count.
3. **Activity** (`/activity`) — ribbon of what agents did. Audit log is folded into this view; there is no separate `/audit` surface.
4. **Team** (`/agents`) — list of agents. The route stays `/agents` and the internal nav key is still `assistants` (and `data-tour="nav-assistants"`), but the visible label is `Team` per `docs/ux-spec.md`.
5. **Costs** (`/costs`) — spend overview.

Sandbox preview (muted badge, separated by a divider):
6. **Team Bridge** (`/sandbox/team-bridge`).
7. **Approvals preview** (`/sandbox/approvals-inline`).
8. **Quick hire** (`/sandbox/quick-hire`).

#### Auth (`auth.tsx`)

`AuthProvider` + three seeded users in `lib/fixtures.ts` (`admin`, `domain_admin`, `member`). Demo logins:

- `frontend@int3grate.ai` (Ada — admin, L4)
- `domain@int3grate.ai` (Marcelo — domain_admin, L3)
- `member@int3grate.ai` (Priya — member, L1)

Any password works; the login screen pre-fills `demo`. The "Create account" button is commented out alongside the `/register` route.

**Two-step login flow** mirrors the spec: `POST /auth/login` returns `LoginResponse { token, expires_at }`, then the client calls `GET /me` with the bearer to fetch the `User`. The mock generates a `mock_<userId>` token and decodes it back. Session is `{ token, userId }` in `localStorage` under `proto.session.v1`.

The `Router` in `index.tsx` gates everything behind `useAuth()` and renders `LoginScreen` when `!user || path === '/login'`.

#### Mock API (`lib/api.ts`)

The `api` object is the single data layer used by every screen. Each call awaits a 120–380 ms `delay()` to simulate latency, then mutates fixture arrays directly. Mutations persist for the lifetime of the page load only.

**Pagination envelope**: list endpoints return `{ items, total, limit, offset }` (matching the spec). Always read `.items` at the call site.

**Chat streaming**: `api.sendChatMessage(chatId, req)` returns an `AsyncIterable<ChatStreamFrame>` mirroring SSE frames. UI consumes via `for await (const frame of stream)`. When swapping to a real backend, replace the producer; the consumer doesn't change.

**When adding new entities or screens**: extend `lib/types.ts`, seed in `lib/fixtures.ts`, and expose through `lib/api.ts` — do not call fixtures from screens directly.

**Dev-mode page-state toggle**: the topbar bug-icon (see `dev/dev-mode-provider.tsx`) forces `api.ts` into `empty` / `loading` / `error` modes for working on those visual states without fabricating dummy data. `DevModeRemount` re-mounts the route tree on toggle.

#### Domain model (`lib/types.ts`)

Canonical entities, aligned 1:1 with `docs/gateway.yaml` schemas. Keep this file the single source of truth for shape. Tasks types were removed alongside the UI deletion (no `Task`, `TaskList`, `CreateTaskRequest` etc.).

Auth: `LoginRequest`, `LoginResponse`, `User`, `Role`, `ApprovalLevel`.
Agents: `Agent`, `AgentStatus`, `AgentList`, `CreateAgentRequest`, `AgentVersion`, `CreateAgentVersionRequest`.
Tools: `ToolGrant`, `ToolGrantMode`, `ToolGrantScopeType`, `ReplaceToolGrantsRequest`, `ToolGrantCheck`, `ToolDefinition`, `ToolPolicyMode`, `GrantsSnapshot`, `GrantsSnapshotEntry`.
Runs: `RunDetail` *(canonical name; `Run` is a kept alias)*, `RunListItem`, `RunsList`, `RunStatus`, `RunErrorKind`, `RunToolError`, `RunStep`, `RunStepType`.
Chat: `Chat`, `ChatList`, `ChatMessage`, `ChatMessageList`, `ChatStatus`, `ChatMessageRole`, `ChatToolCall`, `CreateChatRequest`, `SendMessageRequest`, `ChatStreamFrame`.
Audit: `AuditEvent`, `AuditList`, `AuditStepType`.
Approvals: `ApprovalRequest`, `ApprovalStatus`, `ApprovalList`, `ApprovalDecisionRequest`, `ApprovalDecisionAccepted`.
Spend: `SpendDashboard`, `SpendRow`, `SpendRange`, `SpendGroupBy`.

**Type names stay even when UI labels change.** `Agent` is the canonical type name and matches the gateway spec. Don't rename internal types when changing user-facing copy.

#### Templates (`lib/templates.ts`)

7 starter agent templates used by the Hire wizard at `/agents/new`: Sales, Marketing, Reports, Customer Support, Finance, Operations, Custom. Each carries `defaultName`, `shortPitch`, `longPitch`, `defaultInstructions`, `defaultGrants` (linking tool keys), `approvalCopy`, `featured` flag (top-4 on Welcome), `initials`, and a `welcomeMessage` (seeded as the agent's first chat message on hire). The exported interface name is `AssistantTemplate` (internal — vocab rule does not apply). Edit this file to add or change templates — it's the single source of truth for the wizard.

#### Styling (`prototype.css`)

All prototype styles are scoped under `.prototype-root` (the wrapper in `index.tsx`). Dark "instrument-panel" aesthetic on top of Radix Themes — colours come from Radix CSS variables (`--gray-*`, `--accent-*`, `--amber-*`, `--green-*`, `--red-*`, including alpha scales `--gray-a*`). Use Radix tokens rather than hardcoding colors. Inter is the only font family.

Layout escape hatches:

- **`.page` / `.page--wide` / `.page--narrow`** — standard page padding.
- **`.chat-detail`** (full-screen mode, `100svh - 48px`) and **`.chat-detail.chat-detail--embed`** (embed mode, `min-height: 480px; max-height: calc(100svh - 280px)`) — used by `ChatPanel` in two contexts.

> ⚠️ **Anchor styling specificity**: the global `<a>` reset uses `:where(.prototype-root) a { color: inherit }` (zero-specificity wrapper). Without `:where()`, Radix Button styles like `<Button asChild color="gray">` would lose their color when wrapping a `<Link>`. Don't drop the `:where()`.

> ⚠️ **Portaled Radix content** (`Select.Content`, dropdowns, popovers, dialogs) renders **outside `.prototype-root`** via `<body>` portals. Selectors targeting popup contents must NOT be prefixed with `.prototype-root` or they won't match.

> ⚠️ **Radix class overrides are intentionally global** (no `.prototype-root` prefix). The block in `prototype.css` under `RADIX OVERRIDES` (button / icon-button / badge radius, `rt-TextFieldRoot` / `rt-TextAreaRoot` / `rt-SelectTrigger` radius + surface) controls the styling of Radix-emitted classes everywhere — including portaled dialog / popover / select content on `<body>`. If these were scoped to `.prototype-root`, every new dialog would re-discover wrong-radius buttons/inputs. Don't re-add the prefix.

> ⚠️ **`--color-panel-solid` override**: at the top of `.prototype-root` we redefine `--color-panel-solid: var(--gray-2)`. Don't remove it without a replacement strategy.

### Adding a screen

1. Create `src/prototype/screens/MyScreen.tsx` exporting a default component.
2. Wrap its return in `<AppShell crumbs={[...]}>`.
3. Register the route in the `routes` array in `src/prototype/index.tsx`.
4. Reuse existing primitives before adding new ones.

### Component primitives (`components/common/*`)

All exported through the `components/common.tsx` barrel:

- **`PageHeader`** — `eyebrow / title / subtitle / actions`. Actions area is `<Flex wrap="wrap" gap="2">`.
- **`CommandBar`** — labelled chips strip (`{ label, value, tone? }[]`).
- **`Tabs`** — Radix `TabNav` wrapper. Has a built-in bottom border; pair with ~24px breathing space before content.
- **`MetaRow`** — DataList row. **Must be wrapped in `<DataList.Root size="2">`** by the caller.
- **`MetricCard`** — KPI tile.
- **`Status`** — coloured pill mapping enum status → friendly label. For string-only contexts use `statusLabel(s)` from `components/common/status-label`.
- **`Pagination`** — page + pageSize controls.
- **`InfoHint`** — info ⓘ tooltip.
- **`Caption`** — small uppercase tracked label.
- **`Avatar`** — initials avatar (planned upgrade to realistic photos per `docs/ux-spec.md` § 9 — not yet done).
- **`MockBadge`** — small dashed pill marking surfaces unbacked by the real backend. Two kinds: `kind="design"` (no endpoint exists in spec at all) and `kind="deferred"` (endpoint exists but `x-mvp-deferred`). Hover shows full explanation.

### Icons (`components/icon.tsx` + `components/icons.tsx`)

Two-tier wrapper over `@hugeicons/react` + `@hugeicons/core-free-icons`:

- **`<Icon icon={SomeIcon} />`** (`components/icon.tsx`) — preferred for new code.
- **Legacy named exports** (`components/icons.tsx`) — `IconHome`, `IconAgent`, `IconChat`, `IconApproval`, `IconRun`, `IconTool`, `IconSpend`, `IconAudit`, `IconSettings`, `IconPlus`, `IconArrowLeft`, `IconArrowRight`, `IconCheck`, `IconX`, `IconAlert`, `IconInfo`, `IconPlay`, `IconStop`, `IconSearch`, `IconLock`, `IconEye`, `IconEyeOff`, `IconLogout`, `IconSun`, `IconMoon`, `IconHelp`. New code prefers `<Icon>`.

Both wrappers default `className="ic"`. Sizing: 14px default; `.ic--sm` 12px, `.ic--lg` 18px. All icons inherit `currentColor`.

### Form fields (`components/fields.tsx`)

`TextInput`, `TextAreaField`, `PasswordField`, `SelectField` — Radix Themes wrappers. Use these for forms.

For inline selects inside dense table cells, **don't** use `SelectField` — its chrome breaks vertical alignment with adjacent buttons. Build a thin direct `<Select.Root>` instead (see `InlineSelect` / `CatalogPicker` in `components/grants-editor.tsx`).

### State + empty / error / loading (`components/states.tsx`)

`Banner`, `EmptyState`, `ErrorState`, `LoadingList`, `NoAccessState`. Reach for these before crafting bespoke loading skeletons.

### Format helpers (`lib/format.ts`)

Centralised. **Always reach for these before formatting inline.**

Numbers / dates: `money`, `num`, `pct`, `ago`, `absTime`, `shortDate`, `durationMs`.
ID / reference: `shortRef`, `humanKey`.
Domain labels: `roleLabel`, `domainLabel`, `tenantLabel`, `approverRoleLabel`.
Tool catalog: `TOOL_LABELS`, `toolLabel`, `prettifyRequestedAction`, `appPrefix`, `appLabel`, `APP_LABELS`.
Enum → friendly: `grantModeLabel`, `policyModeLabel`, `errorKindLabel`, `toolErrorStatusLabel`, `stageLabel`, `runStepStatusLabel`.

Rule of thumb: never display raw enums (`requires_approval`, `domain_admin`, `tool_error`) or raw IDs (`agt_xxx`, `usr_xxx`) directly in the UI — always go through one of the helpers above.

### Vocabulary (canonical, per `docs/ux-spec.md` § 8)

End users are not engineers. The product is "my little digital team" — agents are employees, not workflow nodes. Use business language, not engineering terms.

**Keep:**

- `Agent` — the central concept Maria came for. Don't hide it.
- `Hire` (instead of Deploy / Create).
- `Brief` / `Train` (instead of Configure).
- `Playbook` (instead of Workflow).
- `Ask` / `Assign` (instead of Run / Execute).
- `What they can access` (instead of Tools / Connectors — but the page can be called `Apps`).
- `Got stuck — needs help` (instead of Error / Failed).
- `Activity` (instead of Logs / Traces).
- `Hours worked` / `Monthly bill` (instead of Tokens / Costs — pragmatically, `$X spent` is acceptable on the dashboard hero).
- `Instruction` / `Brief` (instead of Prompt).

**Don't show in the UI:** workflow, MCP, tokens, model, prompt, JSON, run, execution, trace, context window, orchestration, system prompt, temperature.

**Render names, not IDs.** `Agent.name` not `agent.id`. For nav references use `shortRef(id)` (`#4081`) in breadcrumbs / chips, not full opaque IDs.

**These rules apply to user-facing strings only.** The internal type `Agent` in `lib/types.ts`, the file `AgentNewScreen.tsx`, the URL pattern `/agents/*`, the variable `tokenCount` — all stay. Per `docs/ux-spec.md` § 11.2: ask yourself "will the user see this?" If no, leave it alone.

> **Internal-only "assistant" matches:** user-facing UI uses `Agent / agents`; the `/agents` sidebar item is labelled `Team`. Remaining `Assistant` / `assistants` matches in code are intentional and internal (e.g. `ChatMessageRole = 'assistant'`, nav key `assistants`, the `AssistantTemplate` interface).

### Mock-only surfaces (visually flagged)

Whenever a UI surface displays data that isn't backed by a real endpoint, mark it with `<MockBadge>`. Currently flagged in routed screens:

- **HomeScreen → ActivityHeatmap** — heatmap is synthesized client-side; backend doesn't expose hourly action aggregates.
- **HomeScreen → SavingsBanner** — savings figure synthesized from a fictional baseline (38 min/task at $75/hr).
- **Sandbox previews** (`/sandbox/team-bridge`, `/sandbox/approvals-inline`, `/sandbox/quick-hire`) — design-only; mutations don't persist and may not call real api endpoints.

Preserved in source but **not currently routed** (badges remain so they reappear correctly when restored):

- `RegisterScreen` — no `POST /auth/register` in spec.
- `ToolsScreen` (Apps page header + Connect new app modal) — connection status derived from grants; OAuth is a placeholder.
- `SettingsScreen` Workspace / Team / Developer / Diagnostic tabs — Workspace edit endpoints missing, `GET /users` missing, Developer card is a reference doc, Diagnostic toggle is a placeholder.

The full mapping (every gap → its UI flag) lives in `docs/backend-gaps.md`.

### Guided tours (`src/prototype/tours/`)

Game-style interactive walkthroughs: dim overlay, spotlight on a target element, floating tooltip with step copy, optional Training mode that swaps real backend data for tour-specific fixtures.

**Status:** the engine is feature-complete. Tour copy is **stale** — selectors mostly still resolve, but step bodies reference removed UI (CommandBar, scope_type selects, etc.). Tour rebuild under new vocabulary is **deferred** by user decision. Don't auto-suggest tour rebuild work.

Before adding or changing tours, read **`docs/tours-guide.md`**. It is the practical authoring guide for targets, scenarios, registry entries, and browser verification.

#### Engine pieces

- **`types.ts`** — `Tour` and `TourStep`. `target` is a CSS selector — **prefer `[data-tour="…"]` attributes** over class selectors.
- **`TourProvider.tsx` + `tour-context.ts` + `useTour.ts`** — context with start/next/prev/end, persisted in `localStorage["proto.tours.v1"]`.
- **`TourOverlay.tsx`** — single mounted overlay. Spotlight = `box-shadow: 0 0 0 9999px rgba(0,0,0,.65)` (no SVG mask). Tooltip placement computed from `target.getBoundingClientRect()`. RAF-throttled `resize` + capture-phase `scroll`. Hotkeys: `→`/`Enter` next, `←` back, `Esc` skip-tour. Falls back to a friendly message if the target doesn't resolve in ~500 ms (or ~1.5 s with `navigateTo`).
- **`registry.ts`** — `TOURS: TourEntry[]`, single source of truth for "what tours exist".
- **Tour data files** — pure data: `sidebar-tour.tsx`, `approval-review-tour.tsx`, `configure-tool-grants-tour.tsx`.

#### Training mode (data-dependent tours)

Provider in `TrainingModeProvider.tsx` swaps fixtures at the `api.*` layer when active. Sandboxed mutations don't touch real fixture arrays. Auto-exits after 15 min idle. Tours that need pre-seeded data (e.g. `approval-review`) declare a `scenarioId` in the registry. The pilot `approval-review` is the canonical example.

#### Discovery

- **`/learn`** route — single hub. Cards show audience, duration, completion status.
- **Topbar `?` button** + global `?` hotkey — opens `/learn`. Ignored while a tour is active or focus is in an editable field.
- **`WelcomeToast.tsx`** — bottom-right pinned, non-blocking; appears once per browser on first authenticated mount.

Mounted in `index.tsx` as: `AuthProvider` → `RouterProvider` → `DevModeProvider` → `TrainingModeProvider` → (`TrainingBanner`, `TourProvider` → (`DevModeRemount` → `Router`, `TourOverlay`, `WelcomeToast`, `TrainingAutoExit`)).

#### Adding a new tour

1. If data-dependent: add a `TrainingScenario` to `training-fixtures.ts` with stable IDs.
2. Add `data-tour="…"` attributes to the screens the tour walks.
3. Write the tour file (`tours/my-tour.tsx`) exporting a `Tour`.
4. Register in `registry.ts`.
5. Verify: card on `/learn`, Start launches, Done returns. `npm run lint && npm run build` clean.

## How to approach a new task in this codebase

1. **Read the relevant doc first.**
   - UI text or vocab change → `docs/ux-spec.md` § 8.
   - Layout / new screen → `docs/ux-spec.md` § 4 (three key screens).
   - Backend wiring → `docs/backend-gaps.md`.
   - Open items / priorities → `docs/backlog.md`.

2. **Check the spec for anti-patterns.** `docs/ux-spec.md` § 10 has a checklist: workflow / MCP / tokens / "Hey friend! 👋" / mascots / etc. Don't introduce them.

3. **Sort findings by hierarchy** (`docs/ux-spec.md` § 11.1): control & approvals → team mental model → business language → three screens → aha moment → trust ladder → tone & visuals.

4. **Distinguish visible from internal.** § 11.2 — type names, file names, comments, internal vars are not subject to vocab rules.

5. **Don't silently fix.** § 11.3 — if you find a divergence, surface it to the owner before mass refactoring. Cosmetic fixes are fine; semantic changes ask first.

6. **Lint + build clean before declaring done.** `noUnusedLocals` and `noUnusedParameters` are strict — clean stale imports.

## Useful greps

```bash
# Find every place that still uses pre-spec vocabulary:
grep -rn "AI worker\|AI workers\|\bAssistant\b\|\bAssistants\b\|\bassistant\b\|\bassistants\b" \
  --include="*.tsx" --include="*.ts" \
  src/prototype/screens src/prototype/components src/prototype/tours

# Find every MockBadge usage:
grep -rn "MockBadge" src/prototype --include="*.tsx"

# Find disabled "(planned)" buttons:
grep -rn "(planned)\|(coming soon)\|(placeholder)" src/prototype --include="*.tsx"
```
