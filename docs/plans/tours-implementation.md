# Tours implementation plan

Status: **In progress**. 6a `start-a-chat` and 6b
`configure-tool-grants` are done; 6c-6d remain.

Step-by-step build plan for the tour-system expansion described in
`tours.md`. Sequenced so each phase delivers a self-contained,
verifiable increment and any future session can resume mid-flight by
reading this file alone.

Read this file together with `tours.md`. The plan doc describes
*what* and *why*; this file describes *how* and *in what order*.

## Sequencing rationale

```
Phase 1  Core infra (TrainingMode + tours registry + visible banner)
   |
   +--> Phase 2  Learning Center (/learn) and Topbar "?" repoint
   |       |
   |       +--> Phase 3  First-login welcome toast
   |
   +--> Phase 4  Engine extension: cross-screen step (navigateTo)
           |
           +--> Phase 5  First real tour: approval-review
                   |
                   +--> Phase 6  Remaining tours (start-a-chat,
                   |              configure-tool-grants, inspect-a-run,
                   |              spend-overview), with `when` predicate
                   |              added before inspect-a-run
                   |
                   +--> Phase 7  Documentation polish
```

Each phase ends with explicit acceptance criteria. After each phase:
`npm run lint` and `npm run build` must both come back clean before
moving on.

If you are resuming this work mid-stream, scroll to the first phase
whose status header is **Not started** or **In progress** — earlier
phases are already on disk.

---

## Phase 1 — Core infrastructure

Status: **Done**.

Goal: stand up the `TrainingModeProvider`, the API-level sandbox hook,
the visible "training mode" banner, and the central tours registry.
After this phase the system can be put into and out of training mode
manually (no UI yet to launch a real data tour against), and a
single source of truth lists every tour.

### Files to create

#### `src/prototype/tours/training-context.ts`

```ts
import { createContext } from 'react'

export interface TrainingModeValue {
  active: boolean
  scenarioId: string | null
  enter: (scenarioId: string) => void
  exit: () => void
}

export const TrainingModeContext = createContext<TrainingModeValue | null>(null)
```

#### `src/prototype/tours/useTrainingMode.ts`

```ts
import { useContext } from 'react'
import { TrainingModeContext } from './training-context'

export function useTrainingMode() {
  const v = useContext(TrainingModeContext)
  if (!v) throw new Error('useTrainingMode outside provider')
  return v
}
```

#### `src/prototype/tours/TrainingModeProvider.tsx`

- State: `{ active, scenarioId }` (single piece of state — derive
  `active = scenarioId !== null`).
- `enter(id)`: sets scenarioId, calls `api.__setTrainingMode(id)` (see
  below), starts an idle timer that auto-`exit()`s after 15 min of no
  `enter`/`exit` calls.
- `exit()`: clears scenarioId, calls `api.__setTrainingMode(null)`.
- Wrap the existing app tree near the root.

#### `src/prototype/tours/training-fixtures.ts`

Skeleton — populated per-scenario in later phases.

```ts
import type { Agent, ApprovalRequest, Chat, RunDetail, Task, User } from '../lib/types'

export interface TrainingScenario {
  id: string
  agents: Agent[]
  users: User[]
  chats: Chat[]
  approvals: ApprovalRequest[]
  runs: RunDetail[]
  tasks: Task[]
  // grants and spend added if/when scenarios need them
}

export const TRAINING_SCENARIOS: Record<string, TrainingScenario> = {
  // scenarios populated in their respective tour phases
}
```

#### `src/prototype/tours/TrainingBanner.tsx`

- Sticky top bar; renders when `useTrainingMode().active === true`.
- Amber tone (`--amber-3` background, `--amber-9` text).
- Copy: **"Training mode — your changes here aren't saved."**
- "Exit training" button on the right calls `exit()`.
- Mounted right after `<TrainingModeProvider>` in `index.tsx` so it
  sits above all routes including `/learn` (it shouldn't appear on
  `/learn` because we never enter training mode just from visiting
  it, but if someone enters training and lands on `/learn`, the bar
  is still useful).

#### `src/prototype/tours/registry.ts`

```ts
import type { Tour } from './types'

export type TourAudience = 'all' | 'admin' | 'domain_admin'
export type TourGroup = 'getting-started' | 'core-workflows' | 'admin-setup'

export interface TourEntry {
  tour: Tour
  audience: TourAudience
  group: TourGroup
  description: string                  // 1-line, shown on /learn cards
  durationLabel: string                // e.g. "~2 min · 5 steps"
  scenarioId: string | null            // null for tours that don't need training mode
}

export const TOURS: TourEntry[] = [
  // Populated as tours land. The pilot sidebar tour is registered here
  // in this phase.
]
```

### Files to modify

#### `src/prototype/lib/api.ts`

Add a private module-level "training scenario" variable plus a setter
exported under a name that signals it's not for screens to call:

```ts
let __activeTrainingScenario: string | null = null
export function __setTrainingMode(scenarioId: string | null) {
  __activeTrainingScenario = scenarioId
}

// inside each list/get function:
function fixturesFor<T>(real: T, scenarioGetter: (s: TrainingScenario) => T): T {
  if (!__activeTrainingScenario) return real
  const s = TRAINING_SCENARIOS[__activeTrainingScenario]
  return s ? scenarioGetter(s) : real
}
```

Reads route through `fixturesFor`. Mutations during training go to a
sandbox copy of the active scenario (one Map per scenario session,
discarded on `__setTrainingMode(null)`).

This keeps the `tours/*` directory free of imports from `lib/api.ts`
internals (still uses the public `api`); `lib/api.ts` just gets a
narrow back-channel that `TrainingModeProvider` uses on enter/exit.

#### `src/prototype/index.tsx`

Wrap the existing tree:

```
<RadixTheme ...>
  <div className="prototype-root">
    <AuthProvider>
      <RouterProvider>
        <TrainingModeProvider>
          <TrainingBanner />
          <TourProvider>
            <Router />
            <TourOverlay />
          </TourProvider>
        </TrainingModeProvider>
      </RouterProvider>
    </AuthProvider>
    ...
  </div>
</RadixTheme>
```

#### `src/prototype/tours/sidebar-tour.tsx` → register in `TOURS`

The existing pilot tour gets a `TourEntry` with `scenarioId: null`,
`group: 'getting-started'`, `audience: 'all'`,
`durationLabel: '~1 min · 5 steps'`.

### Acceptance criteria

- Calling `useTrainingMode().enter('whatever-id')` from a debug
  shortcut (or React DevTools) flips the banner on across every route.
- `useTrainingMode().exit()` removes the banner.
- `TOURS` array contains exactly one entry: `sidebar-overview`.
- `npm run lint` clean. `npm run build` clean.
- The pilot sidebar tour still works exactly as before (no regression).

### Pause for review

After Phase 1 — banner, context wiring, and registry are visible
without yet doing anything to a tour. Confirm that Topbar /
sidebar / theme toggle / logout all still behave normally before
proceeding.

---

## Phase 2 — Learning Center page

Status: **Done**.

Depends on: Phase 1.

Goal: a `/learn` route that lists tours from `TOURS`, shows their
status, and lets the user start any of them. Repoint the Topbar "?"
button at this route.

### Files to create

#### `src/prototype/screens/LearnScreen.tsx`

- Wrapped in `<AppShell crumbs=[{ label: 'home', to: '/' }, { label: 'Learning Center' }]>`.
- `PageHeader` — eyebrow `LEARN`, title "Learning Center", subtitle.
- For each `TourGroup` (`'getting-started' | 'core-workflows' | 'admin-setup'`):
  - Section heading via `Caption`.
  - Cards in a 2- or 3-column grid (mirror `MetricCard` styling).
- Card content:
  - Title.
  - 1-line description.
  - Audience pill: `<Badge color="gray">All</Badge>`, `Admin`, or
    `Domain Admin` (use existing `roleLabel` logic where applicable).
  - Duration label.
  - Status: `Not started` (gray) or `Completed` (green) — read via
    `useTour().isCompleted(tour.id)`.
  - Primary button: `Start tour` (or `Restart` if completed). Click
    → if `scenarioId` set, `useTrainingMode().enter(scenarioId)`;
    then `useTour().startTour(tour)`.
- Cards for tours the current user can't run (e.g. admin-only when
  user is `member`) render with the button disabled and a tooltip
  "Admin only".

#### Register the route

In `src/prototype/index.tsx`, add to the `routes` array:

```ts
{ pattern: '/learn', render: () => <LearnScreen /> },
```

### Files to modify

#### `src/prototype/components/shell.tsx`

The "?" `IconButton` in `Topbar` currently calls
`startTour(sidebarTour)`. Change it to navigate:

```tsx
<IconButton
  variant="ghost"
  size="1"
  onClick={() => navigate('/learn')}
  title="Open Learning Center"
  aria-label="Open Learning Center"
>
  <IconHelp size={14} />
</IconButton>
```

(`navigate` from `useRouter()` — already imported by other handlers
in shell.)

Also drop the now-unused `useTour`/`sidebarTour` imports from this
file. The hook still exists; the tour entry is still in `TOURS` —
it just doesn't auto-launch from Topbar anymore.

#### Global hotkey

Add a `useEffect` in `Topbar` (or in `index.tsx` near the keyboard
shortcut for the tour) that listens for `?` (Shift+/) and calls
`navigate('/learn')`. Don't register while a tour is active (the
`useTour` hotkey listener owns the keyboard then).

### Acceptance criteria

- `/learn` renders cards for the sidebar tour (only one for now).
- "Start tour" button on the card launches `sidebar-overview`.
  Completing it flips the card to `Completed` + `Restart` button.
- Topbar "?" navigates to `/learn` instead of starting the sidebar
  tour directly.
- Pressing `?` from anywhere navigates to `/learn`. From within an
  active tour, `?` is ignored (tour engine owns hotkeys).
- `npm run lint` clean. `npm run build` clean.

### Pause for review

After Phase 2 — the hub exists, one card, button works. Confirm
visual fit with the rest of the app (card spacing, group headings)
before adding more cards.

---

## Phase 3 — First-login welcome prompt

Status: **Done**.

Depends on: Phase 1, Phase 2.

Goal: a one-time, non-blocking toast directs the user to `/learn`.

### Files to modify

#### `src/prototype/tours/types.ts`

Extend `ToursPersistedState`:

```ts
export interface ToursPersistedState {
  completed: string[]
  welcomePromptShown?: boolean         // optional → legacy storage works
}
```

#### `src/prototype/tours/TourProvider.tsx`

Add a getter and a setter for the welcome flag, exposed through the
context value:

```ts
interface TourContextValue {
  // ...
  welcomePromptShown: boolean
  markWelcomePromptShown: () => void
}
```

`markWelcomePromptShown()` writes `welcomePromptShown: true` into the
existing `proto.tours.v1` record (preserving `completed`).

### Files to create

#### `src/prototype/tours/WelcomeToast.tsx`

- Pinned bottom-right via `position: fixed`.
- Renders only when:
  - `useAuth().user !== null`
  - `useRouter().path !== '/login' && !== '/register'`
  - `useTour().welcomePromptShown === false`
- Auto-dismisses after 10s; user can also dismiss with an X.
- Dismiss or click `Open Learning Center` → calls
  `markWelcomePromptShown()`. Click also navigates to `/learn`.
- Mounted near root in `index.tsx` (inside `TourProvider` so it has
  context access).

### Acceptance criteria

- Clear `localStorage["proto.tours.v1"]`, hard-reload, log in →
  toast appears.
- Click "Open Learning Center" → navigates to `/learn`, toast gone,
  flag persisted.
- Subsequent reloads do NOT re-show the toast.
- Independently dismissing the toast also persists the flag.
- `npm run lint` clean. `npm run build` clean.

### Pause for review

After Phase 3 — confirm toast position doesn't fight other sticky UI
(theme toggle, logout, training-mode banner). Adjust z-index if it
clashes with the future training banner.

---

## Phase 4 — Engine extension: cross-screen step

Status: **Done**.

Depends on: Phase 1.

Goal: a `TourStep` can declare `navigateTo: '<route>'` and the
overlay navigates there before resolving the target. Required for
`approval-review` and any future tour spanning multiple routes.

### Files to modify

#### `src/prototype/tours/types.ts`

```ts
export interface TourStep {
  // ... existing
  navigateTo?: string                  // hash route, e.g. '/approvals/:id'
                                        //   ↳ tour data writes the literal
                                        //     path; if dynamic, the tour
                                        //     resolves it before passing
                                        //     in to startTour (e.g. via a
                                        //     scenario-known approval id).
}
```

For the `approval-review` tour the dynamic id is just a constant from
the scenario's seeded approval — bake the resolved string into the
step at tour-definition time, not at runtime.

#### `src/prototype/tours/TourOverlay.tsx`

Inside `TourStepView`'s target-resolution effect, before `tryFind()`:

```tsx
useEffect(() => {
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | null = null
  if (step.navigateTo) {
    navigate(step.navigateTo)         // uses useRouter().navigate
  }
  // ... existing tryFind() logic
}, [step.target, step.navigateTo])
```

`navigate` is stable (memoised in router context) so listing it as a
dep would normally be required, but exclude with a comment if it
isn't memoised.

If `navigateTo` is set, allow a longer retry budget (50 attempts at
30 ms = 1.5s) since the destination screen has to fetch and render.

### Acceptance criteria

- A throwaway test step (e.g. attach to one of the existing nav
  items) with `navigateTo: '/agents'` correctly navigates from
  wherever the user was, then anchors on the target.
- Sidebar tour still works (no regression — none of its steps use
  `navigateTo`).
- `npm run lint` clean. `npm run build` clean.

### Pause for review

After Phase 4 — this is a small change, but the tour engine is the
most subtle code in the system. Run the sidebar tour once before
moving on.

---

## Phase 5 — First data-dependent tour: `approval-review`

Status: **Done**.

Depends on: Phases 1, 2, 4.

Goal: the first tour that uses Training mode end-to-end. Walks an
admin/domain_admin from the queue into a single approval, through
the decision UI.

### Files to create

#### `src/prototype/tours/approval-review-tour.tsx`

Define the seven steps (audience, copy, target, placement,
optional `navigateTo`). Borrowing structure from `sidebar-tour.tsx`.
Cross-screen jump from step 3 to step 4 uses `navigateTo:
'/approvals/<seeded-approval-id>'`.

#### Add to `src/prototype/tours/training-fixtures.ts`

Populate the `approval-review` scenario:

```ts
export const TRAINING_SCENARIOS: Record<string, TrainingScenario> = {
  'approval-review': {
    id: 'approval-review',
    users: [/* trainee user */],
    agents: [/* one active agent */],
    runs: [/* one suspended run */],
    approvals: [/* one pending approval against the run */],
    chats: [],
    tasks: [],
  },
}
```

The fixture data should look believable — use existing labels via
`prettifyRequestedAction` etc. and make the run's `suspended_stage`
match the approval (e.g. `tool_call · stripe.refund`).

### Files to modify

#### `src/prototype/screens/ApprovalsScreen.tsx`

Add `data-tour` attributes:

```tsx
<Flex ... data-tour="approvals-filter">
  {STATUSES.map(s => ...)}
</Flex>
...
<Link ... data-tour="approval-row" ...>      // first row only or all?
  ...
</Link>
```

Strategy: attach `data-tour="approval-row"` on every row; the tour
selector targets the first match. That way a user with many
approvals isn't confused by which row the spotlight chose.

#### `src/prototype/screens/ApprovalDetailScreen.tsx`

Add:
- `data-tour="approval-action"` on the title row.
- `data-tour="approval-evidence"` on the evidence card.
- `data-tour="approval-decision"` on the Approve/Reject buttons row.
- `data-tour="approval-reason"` on the reason `TextAreaField`.

#### `src/prototype/tours/registry.ts`

Add the entry:

```ts
{
  tour: approvalReviewTour,
  audience: 'admin',
  group: 'core-workflows',
  description: 'Walk through reviewing a pending approval — what to read, how to decide, what happens after.',
  durationLabel: '~3 min · 7 steps',
  scenarioId: 'approval-review',
}
```

### Acceptance criteria

- From `/learn`, "Start tour" on the Approval review card:
  1. Enters Training mode (banner appears).
  2. Navigates to `/approvals` and shows the seeded pending
     approval as the only row.
  3. Walks through steps 1-3 on the queue.
  4. Auto-navigates to `/approvals/:id` for steps 4-7.
  5. On `Done`, exits Training mode (banner disappears) and the
     real data is back.
- Pressing `Esc` mid-tour also exits Training mode and restores real
  data.
- The card on `/learn` flips to `Completed` after the tour finishes
  with `Done`.
- Lint + build clean.

### Pause for review

After Phase 5 — this is the first complete user-facing tour with
Training mode. Walk through it end-to-end. Verify the banner stays
visible across the cross-screen jump and that exit cleanly restores
reality.

---

## Phase 6 — Remaining tours

Status: **In progress**. 6a `start-a-chat` and 6b
`configure-tool-grants` are done; 6c-6d remain.

Depends on: Phase 5.

Each tour follows the same pattern as `approval-review`. Build them
in this order; each is self-contained and can be reviewed
independently.

### 6a. `start-a-chat`

Status: **Done**.

Single-route tour (`/chats/new`). 4-5 steps. Scenario seeds two
agents (one active, one paused) plus a fresh user. The first step uses
`navigateTo: '/chats/new'` because tours are launched from `/learn`;
the rest reuse the inherited route. Attach `data-tour` attrs to:
agent picker, version chip, title, model select, submit button.

### 6b. `configure-tool-grants`

Status: **Done**.

Single-route tour (`/agents/:id/grants`). 7 steps. Scenario seeds
one active agent with one demo grant so the editor opens with a real
table row that can be spotlighted.
Tricky bits: catalog `Select` is portaled outside `.prototype-root`
— the spotlight selector must still work (the selector goes through
`document.querySelector` so it does, but verify on a live demo).
Implemented against the current grants editor shape: catalog picker,
Add grant button, tool-name table cell, scope selector, access
selector, approval switch, and Save grants button. Training mode
sandboxes `getGrants`, `setGrants`, and `getGrantsSnapshot`.

### 6c. `inspect-a-run` — needs `when` predicate first

Before this tour, extend the engine again:

#### Phase 6c.0 — `when` predicate

Add to `TourStep`:

```ts
when?: () => boolean
```

In `TourProvider.next()` (and `prev()`), skip steps where `when`
returns `false`. Important: `when` runs at navigation time, NOT
during render — call it from `next()` / `prev()`, advance again if
it returns false.

Then build the tour itself. 5-6 steps. Scenario seeds one suspended
run with a representative timeline (LLM call, tool_call with an
error, approval_gate). Use `when` to skip the suspended-banner step
if the seeded run somehow ended up not-suspended (defensive — not
expected in practice but cheap to guard).

### 6d. `spend-overview`

Single-route tour (`/spend`). 3 short steps. Scenario seeds a
30-day synthesised spend dataset across 3 agents + 2 domains, with
one spike day to make the chart interesting. No `navigateTo`,
no `when`.

### Acceptance criteria (per sub-phase)

- The tour appears on `/learn` in the right group, with the right
  audience.
- Starting it enters Training mode with the right scenario.
- Each step's spotlight finds its target without falling back to
  the "not on this screen" message.
- Done closes the tour, exits Training mode, restores real data,
  flips card to Completed.
- Lint + build clean after each.

### Pause for review

Pause after **6a** (proves the pattern is repeatable) and again
before **6c** (engine extension `when` is added). Proceed straight
through 6b after 6a unless something surprising surfaces.

---

## Phase 7 — Documentation polish

Status: **Done**.

Depends on: Phases 1-6.

Goal: bring `CLAUDE.md` and `README.md` up to date so a new
contributor can onboard from the docs alone.

### `CLAUDE.md` updates

In the existing **Guided tours** section:
- Mention the `/learn` route and the registry as the source of
  truth for "what tours exist".
- Mention `TrainingModeProvider`, the amber banner, and the
  scenario-fixture model.
- Mention the welcome toast flag in `proto.tours.v1`.
- Mention the new `TourStep` fields: `navigateTo`, `when`.
- Mention the `data-tour` attribute conventions for tour authors.

In the **Routing** section:
- Add `/learn` to the route map.

### `README.md` updates

Add one line in "Where to read next":
- `tours.md` — design and copy for guided tours.
- `docs/plans/tours-implementation.md` — leave it pointing here as well in
  case future maintainers want the build history.

### Acceptance criteria

- Lint + build clean.
- Skim test: a fresh reader can find `/learn`, the registry, and
  the Training mode model from `CLAUDE.md` alone.

---

## Definition of done (whole project)

- `npm run lint` and `npm run build` both clean.
- All 6 tours are registered in `TOURS` and visible on `/learn`.
- Each data-dependent tour seeds its scenario, runs end-to-end,
  exits cleanly with real data restored.
- Welcome toast fires once on a fresh login, points at `/learn`,
  and never shows again after dismissal.
- `proto.tours.v1` storage shape is `{ completed: string[],
  welcomePromptShown: boolean }`.
- `CLAUDE.md` and `README.md` reflect the above.

## Resuming mid-flight — checklist

If picking up this plan from a fresh context:

1. Read `tours.md` for design intent.
2. Read this file top to bottom.
3. Run `git status` and `git log -- docs/plans/tours-implementation.md` to
   see which phases were marked done in commits.
4. Update each phase's `Status:` line in this file as you move
   through it (`Not started` → `In progress` → `Done`).
5. Phases are designed to be small enough that each fits in a single
   commit. If a phase is partially done in working tree, finish it
   before opening a new one.
6. Don't conflate phases. A "minor improvement to Phase 2" while in
   Phase 5 should be staged separately — easier to review, easier
   to revert.
