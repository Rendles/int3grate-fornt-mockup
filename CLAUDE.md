# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server with HMR.
- `npm run build` — `tsc -b` (project references) then `vite build`. Treat TS errors as build failures; the project enables `noUnusedLocals`, `noUnusedParameters`, and `verbatimModuleSyntax` (use `import type` for type-only imports).
- `npm run lint` — flat-config ESLint over `**/*.{ts,tsx}` with `typescript-eslint`, `react-hooks`, and `react-refresh/vite`.
- `npm run preview` — serve the production build.

There is no test runner configured.

## Architecture

This is a **Vite + React 19 + TypeScript** single-page app that ships *two* UIs from a single bundle, switched by URL hash:

- `src/App.tsx` is the public landing page (Vite/React starter look).
- When `window.location.hash` starts with `#/app`, `App.tsx` mounts `src/prototype/` instead and toggles a `prototype-active` class on `<body>`. This is the actual product mockup — a "control plane" operator UI for managing AI agents, chats, runs, approvals, and spend.

### The prototype (`src/prototype/`)

Self-contained mock of a multi-tenant agent control plane. **No backend** — everything is in-memory fixtures. The mock is shaped 1:1 against the gateway OpenAPI spec so swapping in a real http client should be a thin replacement at the `lib/api.ts` boundary.

#### Backend contract

The canonical contract is `gateway (5).yaml` at the repo root (latest spec from the backend team). Older specs are kept for diffing: `gateway_new.yaml` (v0.2.0), `gateway.yaml` (v0.1). The diff between v0.1 and v0.2 is in `GATEWAY_DIFF.md`. The migration plan to the latest spec — and what's still open with the backend — is in `GATEWAY_NEXT_PLAN.md`. The data-source map (every UI surface → endpoint that should feed it) is in `BACKEND_DATA_SOURCES.md`. **Read these before invoking new endpoints or extending the type model.**

Three endpoints are *known gaps* — the UI uses them, but the gateway doesn't expose them yet: `POST /auth/register`, `GET /users` (used everywhere for resolving names), `GET /approvals/{id}`. These are noted in the docs above as open questions for the backend team.

#### Routing (`router.tsx`, `index.tsx`)

Hand-rolled hash router. Routes are declared as a flat list in `index.tsx` using `matchRoute(pattern, path)` with `:param` segments. **Always navigate via the `<Link>` component or `useRouter().navigate`** — they prepend `/app` to the hash automatically. The router strips the `/app` prefix before matching, so route patterns are written without it (e.g. `/agents/:agentId`, `/chats/:chatId`).

Current route map:
- `/` Home, `/login`, `/register`, `/profile`, `/404`-style fallback
- `/agents`, `/agents/new`, `/agents/:agentId` (+ `/grants`, `/settings` tabs), `/agents/:agentId/versions/new`
- `/chats`, `/chats/new`, `/chats/:chatId`
- `/tasks`, `/tasks/new`, `/tasks/:taskId` *(MVP-deferred backend, kept in UI for design continuity)*
- `/runs`, `/runs/:runId`
- `/approvals`, `/approvals/:approvalId`
- `/audit` *(admin-only)*
- `/tools`, `/spend`
- `/learn` *(Learning Center — hub for guided tours; see "Guided tours" section)*

> ⚠️ **`Link` props pass-through**: the `Link` component accepts the full `AnchorHTMLAttributes` surface (minus `href`/`onClick`, which it owns) and spreads it onto the inner `<a>`. This is what makes Radix Themes `asChild` composition work — e.g. `<Text size="1" asChild><Link to="…">…</Link></Text>` correctly forwards `data-accent-color` / class names onto the anchor so Radix-driven styles apply. Don't tighten the props back to a fixed list.

#### Auth (`auth.tsx`)

`AuthProvider` + three seeded users in `lib/fixtures.ts` (`admin`, `domain_admin`, `member`). Demo logins:
- `frontend@int3grate.ai` (Ada — admin, L4)
- `domain@int3grate.ai` (Marcelo — domain_admin, L3)
- `member@int3grate.ai` (Priya — member, L1)

Any password works; the login screen pre-fills `demo`.

**Two-step login flow** mirrors the spec: `POST /auth/login` returns `LoginResponse { token, expires_at }`, then the client calls `GET /me` with the bearer to fetch the `User`. The mock generates a `mock_<userId>` token and decodes it back. Session is `{ token, userId }` in `localStorage` under `proto.session.v1` (legacy `{ userId }`-only sessions still resolve).

The `Router` in `index.tsx` gates everything behind `useAuth()` and renders `LoginScreen` when `!user || path === '/login'`.

#### Mock API (`lib/api.ts`)

The `api` object is the single data layer used by every screen. Each call awaits a 120–380 ms `delay()` to simulate latency, then mutates fixture arrays directly (e.g. `fxAgents.unshift(...)`, `grantsByAgent[id] = next`). Mutations persist for the lifetime of the page load only.

**Pagination envelope**: list endpoints return `{ items, total, limit, offset }` (matching the spec) — `listAgents`, `listTasks`, `listApprovals`, `listChats`, `listChatMessages`, `listRuns`, `listAudit`. Always read `.items` at the call site. The `paginate(...)` helper at the top of `api.ts` honours optional `limit`/`offset`.

**Chat streaming**: `api.sendChatMessage(chatId, req)` returns an `AsyncIterable<ChatStreamFrame>` mirroring the SSE frames the real gateway emits (`turn_start`, `text_delta`, `tool_call`, `tool_result`, `turn_end`, `done`, `error`). UI code consumes it with `for await (const frame of stream)`. When swapping to a real backend, replace the producer with a fetch+ReadableStream reader; the consumer doesn't change.

**When adding new entities or screens**: extend `lib/types.ts`, seed in `lib/fixtures.ts`, and expose through `lib/api.ts` — do not call fixtures from screens directly.

#### Domain model (`lib/types.ts`)

Canonical entities, aligned 1:1 with `gateway (5).yaml` schemas. Keep this file the single source of truth for shape.

Auth: `LoginRequest`, `LoginResponse`, `User`, `Role`, `ApprovalLevel`.
Agents: `Agent`, `AgentStatus`, `AgentList`, `CreateAgentRequest`, `AgentVersion`, `CreateAgentVersionRequest`.
Tools: `ToolGrant`, `ToolGrantMode`, `ToolGrantScopeType`, `ReplaceToolGrantsRequest`, `ToolGrantCheck`, `ToolDefinition`, `ToolPolicyMode`, `GrantsSnapshot`, `GrantsSnapshotEntry`.
Tasks (`x-mvp-deferred`): `Task`, `TaskType`, `TaskStatus`, `TaskList`, `CreateTaskRequest`.
Runs: `RunDetail` *(canonical name; `Run` is a kept alias)*, `RunListItem`, `RunsList`, `RunStatus`, `RunErrorKind`, `RunToolError`, `RunStep`, `RunStepType`.
Chat: `Chat`, `ChatList`, `ChatMessage`, `ChatMessageList`, `ChatStatus`, `ChatMessageRole`, `ChatToolCall`, `CreateChatRequest`, `SendMessageRequest`, `ChatStreamFrame`.
Audit: `AuditEvent`, `AuditList`, `AuditStepType`.
Approvals: `ApprovalRequest`, `ApprovalStatus`, `ApprovalList`, `ApprovalDecisionRequest`, `ApprovalDecisionAccepted`, `CreateApprovalInternalRequest`.
Spend: `SpendDashboard`, `SpendRow`, `SpendRange`, `SpendGroupBy`.

#### Shell (`components/shell.tsx`)

`AppShell({ crumbs, children })` wraps every authenticated screen with `Sidebar` + `Topbar`. Sidebar nav badges are computed from `api.listApprovals` / `api.listTasks` / `api.listChats` on mount. The "Audit" item is shown only to admins.

#### Styling (`prototype.css`)

All prototype styles are scoped under `.prototype-root` (the wrapper in `index.tsx`) so they don't leak into the landing page. Dark "instrument-panel" aesthetic on top of Radix Themes — colours come from Radix CSS variables (`--gray-*`, `--accent-*`, `--amber-*`, `--green-*`, `--red-*`, including alpha scales `--gray-a*`). Use Radix tokens rather than hardcoding colors. Inter is the only font family (resolved via `--font-sans` / `--font-serif` / `--font-mono`).

Radix component overrides (e.g. catalog Select items, MetaRow first-letter capitalization) live at the bottom of `prototype.css` with explanatory comments — read before changing them.

Two layout escape hatches:
- **`.page` / `.page--wide` / `.page--narrow`** — standard page padding for screens with body-scroll behaviour.
- **`.chat-detail`** — fixed-height layout (`100svh - 48px`) with internal scroll on the messages section, used by `ChatDetailScreen` so the composer stays pinned at the bottom.

> ⚠️ **Anchor styling specificity**: the global `<a>` reset uses `:where(.prototype-root) a { color: inherit }` (zero-specificity wrapper). Without `:where()`, Radix Button styles like `<Button asChild color="gray">` would lose their color when wrapping a `<Link>`. Don't drop the `:where()`.

> ⚠️ **Portaled Radix content** (`Select.Content`, dropdowns, popovers) renders **outside `.prototype-root`** via `<body>` portals. Selectors targeting popup contents (e.g. `.catalog-item` for the grants catalog Select) must NOT be prefixed with `.prototype-root` or they won't match. There's a comment block at the top of those rules in `prototype.css`.

> ⚠️ **`--color-panel-solid` override**: at the top of `.prototype-root` we redefine `--color-panel-solid: var(--gray-2)`. Radix Themes' default resolution (with `panelBackground="solid"` + `grayColor="slate"` in light mode) collapses to `--gray-1` — i.e. the same as `--color-page-background` — so all card / sidebar / sticky-topbar / chat-message surfaces became invisible against the page in the light theme. The `--gray-2` override gives a faint tint in light mode and is visually identical to the previous behaviour in dark mode. Don't remove it without a replacement strategy.

### Adding a screen

1. Create `src/prototype/screens/MyScreen.tsx` exporting a default component.
2. Wrap its return in `<AppShell crumbs={[...]}>`.
3. Register the route in the `routes` array in `src/prototype/index.tsx`.
4. Reuse existing primitives before adding new ones (see below).

### Component primitives (`components/common/*`)

All exported through the `components/common.tsx` barrel:

- **`PageHeader`** — `eyebrow / title / subtitle / actions`. Actions area is `<Flex wrap="wrap" gap="2">` — pass actions as direct children (Fragment) so they wrap independently when the title eats the width.
- **`CommandBar`** — labelled chips strip (`{ label, value, tone? }[]`). Use for at-a-glance metadata strips below `PageHeader`.
- **`Tabs`** — Radix `TabNav` wrapper. Has a built-in bottom border; pair with ~24px breathing space before content (see `AgentDetailScreen`).
- **`MetaRow`** — DataList row. **Must be wrapped in `<DataList.Root size="2">`** by the caller (without it the grid template breaks). The label automatically gets first-letter-capitalized via CSS, so call sites can write `label="created by"` and it renders as `Created by`.
- **`MetricCard`** — KPI tile with label / value / unit / delta / icon, optional `href` to make it clickable.
- **`Status`** — coloured pill mapping enum status → friendly label. Accepts the union of all status enums (Agent / Run / Task / Approval / Chat / etc.). For places that need a string instead of the pill (e.g. `CommandBar` `value` field, inline banner copy), import **`statusLabel(s)`** from `components/common/status-label` — it shares the underlying map and falls back to `humanKey()` for unknown values.
- **`Pagination`** — page + pageSize controls. Used at the bottom of `card--table` lists.
- **`InfoHint`** — info ⓘ tooltip for technical / API hints inline in copy.
- **`Caption`** — small uppercase tracked label (UI section labels).
- **`Avatar`** — initials avatar.
- **`MockBadge`** — small dashed pill marking surfaces unbacked by the real backend. Two kinds: `kind="design"` (no endpoint exists in spec at all — pure mock) and `kind="deferred"` (endpoint exists but `x-mvp-deferred`). Hover shows full explanation. Use whenever a screen, widget, or sidebar item shows synthesized data.

### Icons (`components/icon.tsx` + `components/icons.tsx`)

Two-tier wrapper over `@hugeicons/react` + `@hugeicons/core-free-icons`:

- **`<Icon icon={SomeIcon} />`** (`components/icon.tsx`) — preferred for new code. Pair with a direct named import from `@hugeicons/core-free-icons`.
- **Legacy named exports** (`components/icons.tsx`) — `IconHome`, `IconAgent`, `IconChat`, `IconTask`, `IconApproval`, `IconRun`, `IconTool`, `IconSpend`, `IconAudit`, `IconPlus`, `IconArrowLeft`, `IconArrowRight`, `IconCheck`, `IconX`, `IconAlert`, `IconInfo`, `IconPlay`, `IconStop`, `IconSearch`, `IconLock`, `IconEye`, `IconEyeOff`, `IconLogout`, `IconSun`, `IconMoon`, `IconHelp`. These are now thin wrappers over the same Hugeicons set, kept so existing call-sites still work; new code should prefer `<Icon>`.

Both wrappers default `className="ic"`. Sizing comes from the `.ic` class in `prototype.css` (14px default; `.ic--sm` 12px, `.ic--lg` 18px). All icons inherit `currentColor`, so colour them via the surrounding `<Text color="…">` / Radix Theme tokens — don't pass `primaryColor` props.

### Form fields (`components/fields.tsx`)

`TextInput`, `TextAreaField`, `PasswordField`, `SelectField` — Radix Themes wrappers with chrome for label / hint / error / required. Use these for forms.

For inline selects inside dense table cells, **don't** use `SelectField` — its `<Flex direction="column" gap="1">` chrome breaks vertical alignment with adjacent buttons / switches. Build a thin direct `<Select.Root>` instead (see `InlineSelect` / `CatalogPicker` in `components/grants-editor.tsx`). The trigger needs `style={{ width: '100%' }}` and the content needs `position="popper"` for stable anchoring.

### State + empty / error / loading (`components/states.tsx`)

`Banner`, `EmptyState`, `ErrorState`, `LoadingList`, `NoAccessState`. Reach for these before crafting bespoke loading skeletons.

### Format helpers (`lib/format.ts`)

Centralised. **Always reach for these before formatting inline.**

Numbers / dates: `money`, `num`, `pct`, `ago`, `absTime`, `shortDate`, `durationMs`.
ID / reference: `shortRef` (entity_id → `#<tail>` for breadcrumbs/refs), `humanKey` (`snake_case` → `Sentence case`).
Domain labels: `roleLabel`, `domainLabel`, `tenantLabel`, `approverRoleLabel`.
Tool catalog: `TOOL_LABELS`, `toolLabel(name)`, `prettifyRequestedAction(s)` (parses `service.action` prefix from `requested_action` strings and replaces with friendly tool label).
Enum → friendly: `grantModeLabel` (`read_write` → "Read & write"), `policyModeLabel` (`requires_approval` → "Requires approval"), `errorKindLabel` (`tool_error` → "Tool error"), `toolErrorStatusLabel`, `stageLabel` (run.suspended_stage parser), `runStepStatusLabel` (`ok` → "OK", others via `humanKey`).

Rule of thumb: never display raw enums (`requires_approval`, `domain_admin`, `tool_error`) or raw IDs (`agt_xxx`, `usr_xxx`) directly in the UI — always go through one of the helpers above.

### Keeping the UI human-friendly

The prototype's design constraint is that **end users are not engineers** — they shouldn't see snake_case keys, raw enum values, opaque IDs, or JSON dumps. Conventions:

- Render names, not IDs. `Agent.name` not `agent.id`. For nav references use `shortRef(id)` (`#4081`) in breadcrumbs / chips, not full opaque IDs.
- Replace tool keys with `toolLabel(name)` everywhere (`stripe.refund` → `Stripe · Refund`).
- Replace role keys with `roleLabel` / `approverRoleLabel` (`domain_admin` → `Domain Admin`).
- Replace policy / grant / error enums via the helpers above.
- Render JSON-ish backend objects as structured key/value lists, not `<pre>` dumps. See `EvidenceList` in `ApprovalDetailScreen`, `ToolParameters` in `ToolsScreen`, the four config cards in `AgentDetailScreen.OverviewTab` (Model / Memory / Tools / Approval rules) for examples of how to flatten a nested object into readable rows.

### Mock-only surfaces

Whenever a UI surface displays data that isn't backed by a real endpoint, mark it with `<MockBadge>` so reviewers and demoers know what's synthesized. Currently flagged:
- **Register screen** — no `POST /auth/register` in spec.
- **All Tasks screens** + **Tasks sidebar item** + **Recent tasks / Task outcomes / My tasks** dashboard cards — backend exists in spec but `x-mvp-deferred`.
- **Activity heatmap** + **Savings banner** on the Home dashboard — synthesized client-side, no backend aggregates.

Three documented endpoints have *known gaps* on the backend side (used by the UI but missing from the spec): `GET /users`, `GET /approvals/{id}`, `POST /auth/register`. These are tracked in `BACKEND_DATA_SOURCES.md` as open questions; don't try to "fix" them from the frontend.

### Guided tours (`src/prototype/tours/`)

Game-style interactive walkthroughs: dim overlay, spotlight on a target element, floating tooltip with step copy, optional Training mode that swaps real backend data for tour-specific fixtures. The engine is feature-complete; growing the tour catalog from here is purely data work — write a tour file, add `data-tour="…"` attributes to the screens it walks, register in `registry.ts`. See `TOURS_PLAN.md` (design / scenarios / what's left) and `TOURS_IMPLEMENTATION_PLAN.md` (build status per phase).

#### Engine pieces

- **`types.ts`** — `Tour` (`{ id, name, steps[] }`) and `TourStep` (`{ id, target, title, body, placement?, spotlightPadding?, navigateTo? }`). `target` is a CSS selector — **prefer `[data-tour="…"]` attributes over class selectors** so refactors to `prototype.css` don't silently break tours. `navigateTo` (optional) is a hash route the engine routes to before resolving the target; if absent, the engine inherits the most recent prior step's `navigateTo`, so Back / prev navigation always restores the right page.
- **`TourProvider.tsx` + `tour-context.ts` + `useTour.ts`** — context with `startTour`, `next`, `prev`, `endTour(markCompleted?)`, `isCompleted`, plus the welcome-toast flag (`welcomePromptShown`, `markWelcomePromptShown`). Persists `completed: string[]` and `welcomePromptShown: boolean` in `localStorage["proto.tours.v1"]`. Reaching the last step (`Done`) marks completed; `Skip tour` / `Esc` ends without marking, so the tour can be retried. Body scroll is locked while a tour is active.
- **`TourOverlay.tsx`** — single mounted overlay. Spotlight is a fixed-position rect with `box-shadow: 0 0 0 9999px rgba(0,0,0,.65)` (the shadow paints the dim outside — no SVG mask). Tooltip placement (`top` / `bottom` / `left` / `right`) is computed from `target.getBoundingClientRect()` and clamped to the viewport. The same DOM nodes for spotlight + tooltip persist across step changes (no `key={step.id}` on the inner view), so CSS transitions on `top` / `left` / `width` / `height` interpolate smoothly between steps. Listens to window `resize` + capture-phase `scroll` (RAF-throttled) and `ResizeObserver` on the tooltip. Hotkeys: `→`/`Enter` next, `←` back, `Esc` skip-tour. If the target selector doesn't resolve within the retry budget (~500 ms same-screen, ~1.5 s when `navigateTo` is set), the tooltip shows a fallback message instead of getting stuck.
- **`registry.ts`** — `TOURS: TourEntry[]`, the single source of truth for "what tours exist". Each entry carries `audience` (`'all' | 'admin' | 'domain_admin'`), `group` (`'getting-started' | 'core-workflows' | 'admin-setup'`), `description`, `durationLabel`, and `scenarioId | null`.
- **Tour data files** — one per tour (`sidebar-tour.tsx`, `approval-review-tour.tsx`, …). Pure data.

#### Training mode (data-dependent tours)

A real new tenant has no agents / approvals / runs, so data-dependent tours seed their own fixtures via Training mode:

- **`TrainingModeProvider.tsx` + `training-context.ts` + `useTrainingMode.ts`** — context with `{ active, scenarioId, enter, exit }`. On `enter(id)` it calls a private `__setTrainingMode(id)` setter on `lib/api.ts`; reads inside `api.*` consult `_trainingScenario()` and serve from the active scenario's fixtures instead of the real `fxAgents` / `fxApprovals` / etc. Mutations on training-mode entities (`api.decideApproval`) return synthetic queued responses without touching real fixtures. Auto-exits after 15 min idle.
- **`training-fixtures.ts`** — `TRAINING_SCENARIOS: Record<string, TrainingScenario>`. One scenario per data-dependent tour, with stable IDs exported (e.g. `APPROVAL_REVIEW_IDS`) so tour data can write literal `navigateTo: '/approvals/${id}'`.
- **`TrainingBanner.tsx`** — sticky amber bar pinned to the top of the viewport while training is active. Adds a `with-training-banner` class on `.prototype-root` so `.shell` reserves layout space via the `--training-banner-height` CSS variable.
- **`TrainingAutoExit.tsx`** — invisible bridge inside `TourProvider`. Watches `activeTour`; when a tour transitions from active to inactive (Done / Skip / Esc / last-step completion) it calls `exit()` if training was active and navigates to `/learn` so the user lands back on the hub.

The pilot data-dependent tour (`approval-review`) demonstrates the full pattern: scenario fixture, `data-tour=` attributes on `ApprovalsScreen` + `ApprovalDetailScreen`, cross-screen `navigateTo`, sandboxed `decideApproval`. Use it as the template when adding the rest from `TOURS_PLAN.md`.

#### Discovery + entry points

- **`/learn` route** (`screens/LearnScreen.tsx`) — single hub listing every tour from `TOURS`, grouped by `TourGroup`. Cards show audience, duration, status (read via `isCompleted`), Start / Restart button. Cards for tours the current user can't run (e.g. admin-only when user is `member`) render disabled with a tooltip.
- **Topbar `?` button** repointed at `/learn` (used to launch the sidebar tour directly). Global `?` hotkey also opens `/learn`, ignored while a tour is active or focus is in an editable field.
- **`WelcomeToast.tsx`** — bottom-right pinned, non-blocking; renders once per browser on the first authenticated mount where `welcomePromptShown !== true`. Click "Open Learning Center" or X dismisses, both flip the flag.

Mounted in `index.tsx` as: `RouterProvider` → `TrainingModeProvider` → (`TrainingBanner`, `TourProvider` → (`Router`, `TourOverlay`, `WelcomeToast`, `TrainingAutoExit`)).

CSS lives at the bottom of `prototype.css` under `TRAINING MODE BANNER`, `WELCOME TOAST`, and `TOUR / GUIDED ONBOARDING` blocks (`.tour`, `.tour__spot`, `.tour__tooltip`, `.tour__backdrop`, `.training-banner*`, `.welcome-toast`) with `prefers-reduced-motion` honoured.

#### Adding a new tour

1. If data-dependent: add a `TrainingScenario` to `training-fixtures.ts` with stable IDs. Wire any new `api.*` reads it depends on to consult `_trainingScenario()` (most are already wired from `approval-review`).
2. Add `data-tour="…"` attributes to the screens the tour walks. Wrap composite components (e.g. `<PageHeader>`) in a `<div data-tour="…">` if you need to anchor on a region rather than a single leaf.
3. Write the tour file (`tours/my-tour.tsx`) exporting a `Tour`. Steps that need a specific page declare `navigateTo`; subsequent same-page steps inherit it.
4. Register in `registry.ts` `TOURS` with audience, group, description, durationLabel, and `scenarioId` (or `null`).
5. Verify on `/learn`: card appears, Start launches it (with banner if scenario is set), Done returns to `/learn` and flips the card to Completed. `npm run lint && npm run build` clean.
