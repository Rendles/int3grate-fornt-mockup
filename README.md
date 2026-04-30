# int3grate-front-mockup

Front-end mockup for the **Int3grate.ai control plane** — a multi-tenant
operator UI for managing AI agents, conversations, activity, approvals,
apps, costs, and settings. Self-contained, no backend; everything is
mocked in-memory against the gateway OpenAPI spec.

## Quick start

```bash
npm install
npm run dev
```

Then open `http://localhost:5173/#/`. The login screen will appear.

Demo logins (any password works; the form pre-fills `demo`):

- `frontend@int3grate.ai` — admin
- `domain@int3grate.ai` — domain admin
- `member@int3grate.ai` — member

## Scripts

- `npm run dev` — Vite dev server with HMR.
- `npm run build` — `tsc -b` then `vite build`.
- `npm run lint` — flat-config ESLint.
- `npm run preview` — serve the production build.

There is no test runner configured.

## Where to read next

- **`CLAUDE.md`** / **`AGENTS.md`** — full architecture overview, conventions,
  primitives, format helpers, the tour system, and the prototype's design
  constraints. Start here if you're going to touch code. The two files are
  kept in sync; pick whichever your AI tool reads.
- **`docs/ux-spec.md`** — canonical product spec. Defines the target user
  (Maria, agent-curious owner), vocabulary, anti-patterns, and instructions
  for AI agents reviewing the project.
- **`docs/backend-gaps.md`** — UI surface → backend gap catalogue. Lists
  every place the UI promises functionality the backend doesn't yet expose,
  and which `<MockBadge>` flags it.
- **`docs/plans/tours.md`** — design and copy for the guided-tour catalog
  (Training mode, Learning Center, planned tours).
- **`docs/plans/tours-implementation.md`** — phased build plan for the tour
  system; status per phase tracked inline.
- **`docs/gateway.yaml`** — the canonical backend contract (OpenAPI 3.1)
  the mock is shaped against. Single source of truth for endpoint shapes
  and `x-mvp-deferred` flags.
