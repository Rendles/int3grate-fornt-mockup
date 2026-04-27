# int3grate-front-mockup

Front-end mockup for the **Int3grate.ai control plane** — a multi-tenant
operator UI for managing AI agents, chats, runs, approvals, tools and
spend. The repo ships *two* UIs from a single Vite bundle, switched by
URL hash:

- `/` — public landing page (`src/App.tsx`, the Vite/React starter).
- `/#/app` (and any deeper `/#/app/...`) — the control-plane prototype
  (`src/prototype/`). Self-contained, no backend; everything is mocked
  in-memory against the gateway OpenAPI spec.

## Quick start

```bash
npm install
npm run dev
```

Then open the prototype at `http://localhost:5173/#/app`.

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

- **`CLAUDE.md`** — full architecture overview, conventions, primitives,
  format helpers, the tour system, and the prototype's design constraints.
  Start here if you're going to touch code.
- **`gateway (5).yaml`** — the canonical backend contract the mock is
  shaped against.
- **`BACKEND_DATA_SOURCES.md`** — UI surface → endpoint map; lists open
  questions for the backend team.
- **`GATEWAY_NEXT_PLAN.md`** — what's still needed to migrate from the
  in-memory mock to a real backend.
