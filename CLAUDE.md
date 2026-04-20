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
- When `window.location.hash` starts with `#/app`, `App.tsx` mounts `src/prototype/` instead and toggles a `prototype-active` class on `<body>`. This is the actual product mockup — a "control plane" operator UI for managing AI agents, tasks, runs, approvals, and spend.

### The prototype (`src/prototype/`)

Self-contained mock of a multi-tenant agent control plane. No backend — everything is in-memory fixtures.

- **Routing** (`router.tsx`): hand-rolled hash router. Routes are declared as a flat list in `index.tsx` using `matchRoute(pattern, path)` with `:param` segments. Always navigate via the `<Link>` component or `useRouter().navigate`, which prepend `/app` to the hash automatically. The router strips the `/app` prefix before matching, so route patterns are written without it (e.g. `/agents/:agentId`).
- **Auth** (`auth.tsx`): `AuthProvider` with three seeded users in `lib/fixtures.ts` (admin / domain_admin / member). Session is `{ userId }` in `localStorage` under key `proto.session.v1`. Any password works against fixture emails (`frontend@int3grate.ai`, `domain@int3grate.ai`, `member@int3grate.ai`); the login screen pre-fills `demo`. The `Router` in `index.tsx` gates everything behind `useAuth()` and renders `LoginScreen` when `!user || path === '/login'`.
- **Mock API** (`lib/api.ts`): the `api` object is the single data layer used by every screen. Each call awaits a 120–380 ms `delay()` to simulate latency, then mutates the fixture arrays directly (e.g. `fxAgents.unshift(...)`, `grantsByAgent[id] = next`). Mutations persist for the lifetime of the page load only. When adding new entities or screens, extend `lib/types.ts`, seed in `lib/fixtures.ts`, and expose through `lib/api.ts` — do not call fixtures from screens directly.
- **Domain model** (`lib/types.ts`): canonical entities (`User`, `Agent`, `AgentVersion`, `ToolGrant`, `Task`, `Run`/`RunStep`, `ApprovalRequest`, `SpendDashboard`). Each interface separates backend-contract fields from "UI helpers" (commented as such) populated only by fixtures — keep that split when extending types.
- **Shell** (`components/shell.tsx`): `AppShell({ crumbs, children })` wraps every authenticated screen with `Sidebar` + `Topbar`. Sidebar nav badges are computed from `api.listApprovals` / `api.listTasks` on mount.
- **Styling** (`prototype.css`): all prototype styles are scoped under `.prototype-root` (the wrapper in `index.tsx`) so they don't leak into the landing page. Dark "instrument-panel" aesthetic driven by CSS custom properties (`--bg`, `--accent: #0F62FE`, tone tokens like `--warn-soft`, `--success-border`). Use the existing tokens rather than hardcoding colors. Fonts come from a Google Fonts `@import` — Inter only (single family, used everywhere via `--font-sans` / `--font-serif` / `--font-mono`, all resolving to Inter).

### Adding a screen

1. Create `src/prototype/screens/MyScreen.tsx` exporting a default component.
2. Wrap its return in `<AppShell crumbs={[...]}>`.
3. Register the route in the `routes` array in `src/prototype/index.tsx`.
4. Use existing primitives from `components/common.tsx` (`Btn`, `Chip`, `PageHeader`, `Status`, `Sparkbar`, `Avatar`, `Toggle`) and `components/states.tsx` (`Banner`, `ErrorState`, `LoadingList`, `NoAccessState`) before introducing new ones.
