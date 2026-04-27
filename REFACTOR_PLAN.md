# REFACTOR_PLAN.md

Status: **Complete**. Groups A-E all done. Group C (filter unification) was wrapped in with the rest. See per-group tables for the actual approaches taken.

Cleanup pass for the prototype — remove dead exports, fix React 18
lint violations, refresh project-level docs. Audit performed in chat;
this file captures the actionable items so the work can be picked up
later.

Scope explicitly excludes:
- `AGENTS.md` — leave as-is (per author).
- `.claude/settings.local.json` — leave as-is (per author).

## Group A — Quick deletions (low risk, ~10 min)

Pure dead code. Each item has zero call-sites in `src/` and is safe to
remove with no further refactor.

| # | Symbol / file | Location | Notes |
|---|---|---|---|
| 1 | `stepKindLabel()` + the `STEP_KIND_LABELS` map | `src/prototype/lib/format.ts:176-187` | Done. Removed both the function and the map. |
| 2 | `HealthResponse` interface | `src/prototype/lib/types.ts:19-24` | Done. Removed the unused interface. |
| 3 | `IconPause` legacy export | `src/prototype/components/icons.tsx` | Done. Removed the export and the matching `PauseIcon` import. |

After removing items 1-3, run `npm run build` to confirm no
unused-import / unused-variable errors leak (`tsconfig` enables
`noUnusedLocals` + `noUnusedParameters`).

## Group B — Structural micro-refactor (5-10 min, no behaviour change)

Two files mix React component exports with plain function/hook exports.
That violates `react-refresh/only-export-components` (currently emitted
as a warning) and breaks Vite HMR for the components.

| # | Move | From | To |
|---|---|---|---|
| 4 | `statusLabel(s)` | `src/prototype/components/common/status.tsx` | Done. Moved to `src/prototype/components/common/status-label.ts`; shared status metadata lives in `src/prototype/components/common/status-data.ts`. Import the helper directly rather than through the component barrel so React Refresh stays clean. |
| 5 | `useTour()` hook | `src/prototype/tours/TourProvider.tsx` | Done. Moved to `src/prototype/tours/useTour.ts`; shared context lives in `src/prototype/tours/tour-context.ts`. Updated call-sites in `components/shell.tsx` and `tours/TourOverlay.tsx`. |

Risk: very low. Type signatures stay identical; only the import path
on internal call-sites changes.

## Group C — Optional unification (~30 min)

Each list screen declares its own `STATUSES: Array<XxxStatus | 'all'>`
constant. They are all valid but trivially duplicated. If we touch
filter UI again, this becomes worth extracting.

Candidates:
- `screens/AgentsScreen.tsx` — `Array<AgentStatus | 'all'>`
- `screens/ApprovalsScreen.tsx` — `StatusFilter[]`
- `screens/ChatsScreen.tsx` — `Array<ChatStatus | 'all'>`
- `screens/RunsScreen.tsx` — `Array<RunStatus | 'all'>`
- `screens/TasksScreen.tsx` — `Array<TaskStatus | 'all'>`

Done. Added `src/prototype/lib/filters.ts` with typed `as const`
tuples and updated the five list screens above to import their status
filters from the shared module. `AuditScreen` source filters were left
local because they are not status filters and were outside this group.

## Group D — ESLint / React 18 best practices (1-2 hours)

These are real `react-hooks` / purity rule violations. Everything works
today but the warnings will compound as the codebase grows. Each fix is
local.

| # | File:line | Issue | Fix |
|---|---|---|---|
| 6 | `src/prototype/auth.tsx:49` | `setLoading` called synchronously inside `useEffect` | Done. Wrapped session-init in an async function; every path (no-stored-session, missing credential, fetch success, fetch error) now flows through a single `finally` that sets `loading=false` once. |
| 7 | `src/prototype/screens/ChatNewScreen.tsx:50` | `setModel` called synchronously inside `useEffect` | Done. Replaced `model: string` state with `userModel: string \| null` (explicit user override) and a derived `defaultModel` from the agent version. Removed the mirror-effect entirely. Side-effect: user choice now persists across agent switches (was previously overwritten by the effect). |
| 8 | `src/prototype/screens/RunsScreen.tsx:74` | `Date.now()` invoked during render in `runDuration` | Done. Added a `loadedAt` state that is refreshed inside the list-fetch effect; `runDuration` reads from `loadedAt` instead of calling `Date.now()` during render. Live duration for in-flight runs only ticks on list reload — acceptable for the prototype. |
| 9 | `src/prototype/screens/home/SavingsBanner.tsx:44` | mutating an accumulator inside `.map()` | Done. Replaced with `.reduce()` that pushes onto the accumulator parameter (no closure mutation). Lint rule `react-hooks/immutability` cleared. |
| 10 | `src/prototype/tours/TourOverlay.tsx:75` | `setRect` / `setMissing` synchronously in effect | Done. Extracted per-step state and effects into a `TourStepView` subcomponent keyed by `step.id`, so React unmounts/remounts on step change and the synchronous reset is no longer needed. Also stored the pending `setTimeout` handle in the effect's local scope and clear it in cleanup, fixing a latent timer leak when steps changed mid-retry. |
| 11 | `src/prototype/tours/TourOverlay.tsx:126` | `useLayoutEffect` without deps mutates `tooltipHeight` on every render | Done. Replaced the post-render measurement with a `ResizeObserver` attached in `useLayoutEffect` (so the first measurement still lands before paint, no flicker). Functional `setTooltipHeight(prev => …)` removes the need for `tooltipHeight` in the deps array; empty deps satisfies `react-hooks/exhaustive-deps`. |

After each fix re-run `npm run lint` and `npm run build`.

Final state after Group D: `npm run lint` reports 0 errors, 0 warnings; `npm run build` clean.

## Group E — Documentation refresh (~30 min)

| # | What | Action |
|---|---|---|
| 12 | `README.md` is the stock Vite template (React Compiler, ESLint config suggestions, no project context). | Done. Rewrote as a project-specific intro: what the repo is, the two-UI-by-hash architecture (`/` landing vs `/#/app` prototype), `npm install && npm run dev`, demo logins, the script list, and links into `CLAUDE.md`, `gateway (5).yaml`, `BACKEND_DATA_SOURCES.md`, `GATEWAY_NEXT_PLAN.md`. |
| 13 | `PROTOTYPE_UPDATE_PLAN.md` is the v0.1 → v0.2.0 update plan and is fully executed (types, fixtures, screens all reflect v0.2.0). | Done. Prepended an "Archived" header pointing readers at `GATEWAY_DIFF.md` for the diff itself and at `GATEWAY_NEXT_PLAN.md` for the active migration toward `gateway (5).yaml`. The body is preserved for reference. |

## What NOT to touch

These looked like candidates but should stay:

- `gateway.yaml`, `gateway_new.yaml`, `gateway (5).yaml` — backend
  contracts; the older versions are kept on purpose for diffing,
  documented in CLAUDE.md.
- `GATEWAY_DIFF.md`, `GATEWAY_NEXT_PLAN.md`, `BACKEND_DATA_SOURCES.md`,
  `RADIX_MIGRATION_PLAN.md` — load-bearing for the next iteration of
  work; CLAUDE.md links to them.
- `SCREENS.md`, `USER_FLOWS.en.md`, `USER_FLOWS.ru.md`,
  `LANDING_BRIEF.md`, `PROJECT.md`, `PROJECT.ru.md`,
  `DEMO_SCRIPT.en.md` — product / demo documents owned outside this
  refactor pass.
- `.prototype-root` scoping, `:where()` anchor reset, and the
  `--color-panel-solid: var(--gray-2)` override in `prototype.css` —
  intentional, documented in CLAUDE.md.
- `auth.tsx` two-step login flow and the `proto.session.v1` schema —
  part of the spec contract.

## Recommended execution order

1. **Group A** — pure deletions, safe, satisfying. Do these first to
   reduce noise in the diff for everything that follows.
2. **Group B** — small, mechanical, fixes a real lint warning.
3. **Group D** — go through items 6-11 one at a time, each as its own
   commit so regressions are bisectable.
4. **Group E** — rewrite `README.md`, retire `PROTOTYPE_UPDATE_PLAN.md`.
5. **Group C** — only if a filter-UI change is upcoming; otherwise
   skip.

After all groups land, update `CLAUDE.md`:
- Format helpers list — drop `stepKindLabel`.
- Icons legacy list — drop `IconPause`.
- Component primitives — `statusLabel` now lives in its own file, but
  the import path through `components/common.tsx` is unchanged so no
  prose change is needed.

## Approximate budget

- Group A: ~10 min
- Group B: ~10 min
- Group C: ~30 min (optional)
- Group D: ~1.5 hours
- Group E: ~30 min

Minimum useful pass = A + B (~20 min, ~80 lines of dead code removed,
two lint warnings cleared).
