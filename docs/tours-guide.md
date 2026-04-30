# Guided Tours Authoring Guide

This document explains how to create, register, seed, and verify guided
tours in the prototype.

Read this before changing anything under `src/prototype/tours/`.
Use `docs/plans/tours.md` for current product priorities and future-tour
ideas. Use `docs/plans/tours-implementation.md` for the current execution
sequence. This file is the practical "how to build a tour" reference.

Planning and authoring are intentionally separate:

- `docs/plans/tours.md` answers what is worth building next.
- `docs/plans/tours-implementation.md` answers in what order to build it.
- `docs/tours-guide.md` answers how to create, wire, and verify a tour.
- Do not implement old tour ideas directly from memory; check the refreshed
  plans first.

## Quick Facts

- Learning Center route: `#/learn`
- Local URL: `http://localhost:5173/#/learn`
- Tour source folder: `src/prototype/tours/`
- Registry: `src/prototype/tours/registry.ts`
- Tour model: `src/prototype/tours/types.ts`
- Training fixtures: `src/prototype/tours/training-fixtures.ts`
- Overlay engine: `src/prototype/tours/TourOverlay.tsx`
- Tour state provider: `src/prototype/tours/TourProvider.tsx`
- Training mode provider: `src/prototype/tours/TrainingModeProvider.tsx`
- Do not use the old `#/app/...` prefix. Routes are direct hash routes.

Current shipped tours:

- `sidebar-overview`
- `approval-review`
- `start-a-chat`
- `configure-tool-grants`

## System Overview

Tours are data objects. The UI engine is already mounted globally.

The app mounts the tour system in `src/prototype/index.tsx`:

```tsx
<TrainingModeProvider>
  <TrainingBanner />
  <TourProvider>
    <Router />
    <TourOverlay />
    <WelcomeToast />
    <TrainingAutoExit />
  </TourProvider>
</TrainingModeProvider>
```

The normal launch flow is:

1. User opens `/learn`.
2. `LearnScreen` renders cards from `TOURS` in `registry.ts`.
3. User clicks `Start tour`.
4. If the registry entry has `scenarioId`, `LearnScreen` calls
   `enterTraining(scenarioId)`.
5. `LearnScreen` calls `startTour(entry.tour)`.
6. `TourOverlay` reads the current step and highlights `step.target`.
7. `TourOverlay` navigates first if the step has `navigateTo`.
8. `TourProvider` marks completion in `localStorage["proto.tours.v1"]`.
9. `TrainingAutoExit` exits training mode and returns the user to `/learn`.

The overlay supports:

- spotlight around a target element;
- floating tooltip;
- `Next`, `Back`, `Skip step`, `Skip tour`, and `Done`;
- keyboard shortcuts: right arrow / Enter for next, left arrow for back,
  Esc to skip the tour;
- cross-screen navigation through `navigateTo`;
- fallback copy when a target cannot be resolved.

## File Map

Core engine files:

| File | Purpose |
|---|---|
| `types.ts` | `Tour`, `TourStep`, persisted state types |
| `registry.ts` | Single source of truth for cards shown on `/learn` |
| `TourProvider.tsx` | Active tour state, current step, completion persistence |
| `TourOverlay.tsx` | Spotlight, tooltip, target resolution, hotkeys, navigation |
| `tour-context.ts` | React context for tour state |
| `useTour.ts` | Hook for reading tour state |

Training mode files:

| File | Purpose |
|---|---|
| `training-fixtures.ts` | Scenario-specific data sets |
| `TrainingModeProvider.tsx` | Activates/deactivates scenario data |
| `training-context.ts` | React context for training mode |
| `useTrainingMode.ts` | Hook for training mode |
| `TrainingBanner.tsx` | Amber banner while training mode is active |
| `TrainingAutoExit.tsx` | Exits training and returns to `/learn` after a tour ends |

Discovery files:

| File | Purpose |
|---|---|
| `src/prototype/screens/LearnScreen.tsx` | Learning Center cards and audience gating |
| `WelcomeToast.tsx` | First-login prompt that points to `/learn` |
| `src/prototype/components/shell.tsx` | Topbar help button and `?` hotkey |

Tour data files:

| File | Purpose |
|---|---|
| `sidebar-tour.tsx` | Non-data tour of navigation |
| `approval-review-tour.tsx` | Data-dependent approval review tour |
| `start-a-chat-tour.tsx` | Data-dependent chat tour |
| `configure-tool-grants-tour.tsx` | Data-dependent permissions tour |

## Tour Data Model

The source of truth is `src/prototype/tours/types.ts`.

```ts
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TourStep {
  id: string
  target: string
  title: string
  body: React.ReactNode
  placement?: TourPlacement
  spotlightPadding?: number
  navigateTo?: string
}

export interface Tour {
  id: string
  name: string
  steps: TourStep[]
}
```

Field rules:

- `Tour.id` must be stable. It is stored in `localStorage` as completed
  state.
- `Tour.name` appears on the `/learn` card.
- `TourStep.id` must be stable and unique within the tour.
- `target` is a CSS selector. Prefer `[data-tour="..."]`.
- `title` and `body` are user-facing copy. Follow `docs/ux-spec.md`.
- `placement` controls tooltip position. Default is `right`.
- `spotlightPadding` is optional and should be used only when the default
  padding is visually too tight.
- `navigateTo` is a route path like `/approvals` or `/agents/:id/talk`.
  Do not include `#` or `/app`.

There is no `when` predicate in the current type. If a future tour needs
conditional steps, add that as engine work first and document it here.

## When To Use Training Mode

Use Training mode when the tour depends on data that may not exist in a
real workspace.

Use Training mode for tours that need:

- a pending approval;
- a specific agent id;
- a specific chat list;
- a specific grants setup;
- a specific run or task;
- sandboxed mutations that should not affect real fixture arrays.

Do not use Training mode for tours that only point at static shell UI,
such as the sidebar overview.

Registry rule:

```ts
scenarioId: null
```

means no Training mode.

```ts
scenarioId: 'approval-review'
```

means `LearnScreen` calls `enterTraining('approval-review')` before the
tour starts.

## Training Fixtures

Training scenarios live in `src/prototype/tours/training-fixtures.ts`.

The scenario type is:

```ts
export interface TrainingScenario {
  id: string
  agents: Agent[]
  users: User[]
  chats: Chat[]
  approvals: ApprovalRequest[]
  runs: RunDetail[]
  tasks: Task[]
  grantsByAgent?: Record<string, ToolGrant[]>
}
```

Guidelines:

- Use stable ids for every entity the tour navigates to.
- Export a small `*_IDS` object when the tour file needs dynamic paths.
- Keep scenario data minimal. Seed only what the tour needs.
- Use realistic names and descriptions; this data is visible to users.
- Do not mutate global fixtures directly from screens.
- If a new tour needs an entity type that Training mode does not route yet,
  update `src/prototype/lib/api.ts` deliberately and verify reads/mutations.

Example pattern:

```ts
const MY_TOUR_AGENT_ID = 'agt_train_my_tour'

export const MY_TOUR_IDS = {
  agentId: MY_TOUR_AGENT_ID,
} as const

export const MY_TOUR: TrainingScenario = {
  id: 'my-tour',
  users: [/* ... */],
  agents: [/* ... */],
  chats: [],
  approvals: [],
  runs: [],
  tasks: [],
}

export const TRAINING_SCENARIOS: Record<string, TrainingScenario> = {
  'approval-review': APPROVAL_REVIEW,
  'start-a-chat': START_A_CHAT,
  'configure-tool-grants': CONFIGURE_TOOL_GRANTS,
  'my-tour': MY_TOUR,
}
```

## API Sandboxing

Training mode is activated by `TrainingModeProvider`, which calls
`__setTrainingMode(id)` in `src/prototype/lib/api.ts`.

The API layer then reads from scenario data instead of normal fixtures for
supported endpoints.

Currently covered areas include:

- users;
- agents;
- grants;
- runs detail;
- approvals list/detail;
- approval decisions;
- chats;
- chat messages;
- grants snapshots.

Mutation behavior is intentionally sandboxed where implemented. For
example, training chats and grants write to training-local arrays. Approval
decisions return a synthetic queued response instead of mutating real
fixtures.

If a new tour needs mutation support, do not write directly to
`training-fixtures.ts` data from a screen. Add sandbox handling in
`api.ts` at the relevant API boundary.

## Adding Targets To Screens

Tour targets should be stable `data-tour` attributes.

Good:

```tsx
<div data-tour="approval-evidence">
  ...
</div>
```

Tour step:

```ts
target: '[data-tour="approval-evidence"]'
```

Avoid:

- targeting layout classes like `.card:nth-child(2)`;
- targeting generated Radix classes;
- targeting visible text;
- relying on DOM position;
- adding duplicated `data-tour` values on the same screen.

Place the attribute on the smallest stable wrapper that visually matches
the concept being explained.

For dense controls, wrap the whole control area rather than the tiny icon
or label. The spotlight should feel intentional, not twitchy.

## Cross-Screen Tours With `navigateTo`

Use `navigateTo` when a step expects a specific route.

Example:

```ts
{
  id: 'detail-action',
  target: '[data-tour="approval-action"]',
  placement: 'bottom',
  navigateTo: `/approvals/${APPROVAL_REVIEW_IDS.approvalId}`,
  title: 'What is being asked',
  body: 'The title summarises what the agent wants to do.',
}
```

Rules:

- `navigateTo` is a router path, not a hash. Use `/approvals`, not
  `#/approvals`.
- Do not use `/app`.
- For dynamic ids, resolve them from stable training fixture ids at tour
  definition time.
- If later steps live on the same route, they can omit `navigateTo`.
  `TourOverlay` inherits the most recent prior `navigateTo` when moving
  forward or backward.
- Steps with `navigateTo` get a longer target-resolution retry budget.

## Writing A Tour File

Create a new file in `src/prototype/tours/`.

Naming convention:

```txt
my-tour.tsx
```

Skeleton:

```tsx
import type { Tour } from './types'
import { MY_TOUR_IDS } from './training-fixtures'

const agentId = MY_TOUR_IDS.agentId

export const myTour: Tour = {
  id: 'my-tour',
  name: 'My tour',
  steps: [
    {
      id: 'open-page',
      target: '[data-tour="nav-assistants"]',
      placement: 'right',
      navigateTo: '/agents',
      title: 'Find your team',
      body:
        'Your agents live here. Open this page any time you want to check who is working.',
    },
    {
      id: 'agent-card',
      target: '[data-tour="team-agent-card"]',
      placement: 'bottom',
      navigateTo: `/agents/${agentId}`,
      title: 'Open an agent',
      body:
        'Each agent has its own setup, conversations, permissions, and activity.',
    },
  ],
}
```

Copy rules:

- Keep step bodies short. Two sentences is usually enough.
- Explain why the element matters, not only what it is.
- Use the product vocabulary from `docs/ux-spec.md`.
- Avoid technical words in user-facing copy: workflow, MCP, tokens, model,
  prompt, JSON, run, execution, trace, context window, orchestration,
  system prompt, temperature.
- Internal ids like `nav-assistants` can remain internal.

## Registering The Tour

Add the import and entry in `src/prototype/tours/registry.ts`.

```ts
import { myTour } from './my-tour'
```

```ts
{
  tour: myTour,
  audience: 'all',
  group: 'getting-started',
  description: 'Short description shown on the Learning Center card.',
  durationLabel: '~2 min · 4 steps',
  scenarioId: 'my-tour',
}
```

Audience options:

- `all`
- `admin`
- `domain_admin`

Audience behavior is implemented in `LearnScreen`:

- `all`: every role can run it;
- `admin`: only admin can run it;
- `domain_admin`: admin and domain admin can run it.

Group options:

- `getting-started`
- `core-workflows`
- `admin-setup`

If you need a new group, update both `TourGroup` in `registry.ts` and
`GROUPS` in `LearnScreen.tsx`.

## Testing Checklist

Run static checks when code changes:

```bash
npm run lint
npm run build
```

For documentation-only changes, build is usually unnecessary.

Browser verification:

1. Open `http://localhost:5173/#/learn`.
2. Log in if needed.
3. Confirm the new card appears in the expected group.
4. Confirm the audience badge and disabled/enabled state are correct.
5. Click `Start tour`.
6. If `scenarioId` is set, confirm the amber Training mode banner appears.
7. Confirm the first step navigates to the expected route.
8. Confirm each spotlight target resolves.
9. Use `Next`, `Back`, `Skip step`, `Skip tour`, and `Esc`.
10. Finish with `Done`.
11. Confirm the app returns to `/learn`.
12. Confirm Training mode exits.
13. Confirm the card shows `Completed`.
14. Restart the tour and confirm it starts from step 1 again.

For cross-screen tours, also verify Back navigation:

- advance past a route change;
- click `Back`;
- confirm the overlay returns to the correct previous route and target.

## Common Failure Modes

### The tour card does not appear on `/learn`

Check:

- the tour is imported in `registry.ts`;
- the tour entry is added to `TOURS`;
- the `group` value exists in `LearnScreen.tsx`;
- the app has reloaded.

### The card appears but the Start button is disabled

Check:

- `audience` in `registry.ts`;
- current user role;
- `canRun` logic in `LearnScreen.tsx`.

### The overlay says the element is not on the current screen

Check:

- the target `data-tour` attribute exists;
- the selector is unique;
- the step has the right `navigateTo`;
- the target is rendered for the current role and current fixture data;
- Training mode is using the expected scenario.

### Training data does not appear

Check:

- `scenarioId` in `registry.ts` matches `TRAINING_SCENARIOS`;
- `TrainingModeProvider` is mounted;
- the screen reads through `api.*`, not directly from fixtures;
- `api.ts` routes that entity type through `_trainingScenario()`.

### A mutation leaks into real mock data

Stop and fix the API boundary.

Training-mode mutations must write to training-local state, not real fixture
arrays.

### Spotlight is visually awkward

Check:

- the `data-tour` target may be too small or too large;
- move the attribute to a better wrapper;
- use `spotlightPadding` only after choosing a good target;
- try another `placement`.

### Copy looks stale

Check:

- `docs/ux-spec.md` vocabulary;
- current visible UI labels;
- old tour plans in `docs/plans/` may be historical and not current.

## New Tour Checklist

Use this before asking for review:

- [ ] Tour goal is clear and user-facing.
- [ ] Existing implementation was inspected before writing.
- [ ] Training mode decision is explicit: `scenarioId` or `null`.
- [ ] Scenario data exists if needed.
- [ ] Stable ids are exported from `training-fixtures.ts` if needed.
- [ ] Screens have stable `data-tour` targets.
- [ ] Tour file exports a `Tour`.
- [ ] All route changes use `navigateTo` with direct paths.
- [ ] Tour is registered in `TOURS`.
- [ ] `/learn` card copy is short and clear.
- [ ] Audience gating is correct.
- [ ] `npm run lint` passes if code changed.
- [ ] `npm run build` passes if code changed.
- [ ] Browser test at `http://localhost:5173/#/learn` passes.
- [ ] Training mode exits after Done / Skip / Esc.
- [ ] No old `#/app` routes are used.

## Minimal Non-Data Tour Template

```tsx
import type { Tour } from './types'

export const myStaticTour: Tour = {
  id: 'my-static-tour',
  name: 'My static tour',
  steps: [
    {
      id: 'first',
      target: '[data-tour="nav-home"]',
      placement: 'right',
      navigateTo: '/',
      title: 'Home',
      body: 'This is your starting point for approvals, activity, and spend.',
    },
  ],
}
```

Registry entry:

```ts
{
  tour: myStaticTour,
  audience: 'all',
  group: 'getting-started',
  description: 'Learn where to start.',
  durationLabel: '~1 min · 1 step',
  scenarioId: null,
}
```

## Minimal Data-Dependent Tour Template

```tsx
import type { Tour } from './types'
import { MY_TOUR_IDS } from './training-fixtures'

export const myDataTour: Tour = {
  id: 'my-data-tour',
  name: 'My data tour',
  steps: [
    {
      id: 'detail',
      target: '[data-tour="my-detail"]',
      placement: 'bottom',
      navigateTo: `/agents/${MY_TOUR_IDS.agentId}`,
      title: 'Review the detail',
      body: 'This example uses training data so every workspace sees the same state.',
    },
  ],
}
```

Registry entry:

```ts
{
  tour: myDataTour,
  audience: 'domain_admin',
  group: 'core-workflows',
  description: 'Walk through a realistic example using training data.',
  durationLabel: '~2 min · 3 steps',
  scenarioId: 'my-data-tour',
}
```

## Maintenance Notes

- Keep this guide aligned with `src/prototype/tours/types.ts`.
- If you add new engine features, update this file in the same change.
- If you add a new route prefix or change routing, update every route
  example here.
- If tour copy is rebuilt under new vocabulary, update examples here too.
