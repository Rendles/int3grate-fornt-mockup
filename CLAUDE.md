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
- **`Status`** — coloured pill mapping enum status → friendly label. Accepts the union of all status enums (Agent / Run / Task / Approval / Chat / etc.).
- **`Pagination`** — page + pageSize controls. Used at the bottom of `card--table` lists.
- **`InfoHint`** — info ⓘ tooltip for technical / API hints inline in copy.
- **`Caption`** — small uppercase tracked label (UI section labels).
- **`Avatar`** — initials avatar.
- **`MockBadge`** — small dashed pill marking surfaces unbacked by the real backend. Two kinds: `kind="design"` (no endpoint exists in spec at all — pure mock) and `kind="deferred"` (endpoint exists but `x-mvp-deferred`). Hover shows full explanation. Use whenever a screen, widget, or sidebar item shows synthesized data.

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
Enum → friendly: `grantModeLabel` (`read_write` → "Read & write"), `policyModeLabel` (`requires_approval` → "Requires approval"), `errorKindLabel` (`tool_error` → "Tool error"), `toolErrorStatusLabel`, `stageLabel` (run.suspended_stage parser), `stepKindLabel`.

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
