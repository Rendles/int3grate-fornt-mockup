# Tours Implementation Plan

Status: **Refreshed 2026-04-29**.

This is the step-by-step execution plan for future guided-tour work. Read it
together with `docs/plans/tours.md` and `docs/tours-guide.md`.

No new tours have been implemented under this refreshed plan yet.

## Current Baseline

Do not redo these pieces. They are already implemented:

- Learning Center route: `/learn`.
- First-login welcome toast.
- Training mode provider and banner.
- Training auto-exit after a tour ends.
- Tour registry in `src/prototype/tours/registry.ts`.
- Cross-screen tour navigation through `TourStep.navigateTo`.
- Existing shipped tours:
  - `sidebar-overview`
  - `approval-review`
  - `start-a-chat`
  - `configure-tool-grants`

Current engine limits:

- `TourStep.when` does not exist.
- The overlay owns pointer events while active, so a tour cannot safely rely
  on the user clicking highlighted app UI behind the overlay.
- `navigateTo` can move between routes, but it cannot set internal React state
  inside a single route.
- `AgentNewScreen` wizard phase is local state, not route state.
- `api.listRuns()` does not read from Training mode scenarios.
- `api.getSpend()` does not read from Training mode scenarios.

Current route facts:

- Use `/activity`, not old `/runs`.
- Use `/costs`, not old `/spend`.
- Use `/agents/new` for the Hire wizard.
- Use `/agents/:agentId/talk` for the conversation surface.

## Execution Order

The refreshed order is:

1. Existing tour copy cleanup.
2. Decide and plan the `hire-an-agent` implementation shape.
3. Implement the chosen `hire-an-agent` tour.
4. Implement `activity-overview`.
5. Implement `costs-overview`.
6. Reassess optional `apps-and-permissions` or advanced technical tours.

The old "Phase 6c inspect-a-run, then Phase 6d spend-overview" sequence is
deprecated. Do not follow it.

## Phase A - Existing Tour Copy Cleanup

Status: **Done 2026-04-29**.

Goal:

- Remove stale or technical visible tour/discovery copy before adding new
  tours.

Known issues:

- Resolved in `docs/agent-plans/2026-04-29-1723-tour-copy-cleanup.md`.
- `src/prototype/tours/registry.ts` no longer describes `start-a-chat` as
  confirming "version and model".
- `src/prototype/tours/WelcomeToast.tsx` no longer says tours walk through
  "agents, approvals, and runs".

Files likely touched:

- `src/prototype/tours/registry.ts`
- `src/prototype/tours/WelcomeToast.tsx`
- Possibly existing tour files if the audit finds more visible stale copy.

Steps:

1. Search `src/prototype/tours` for visible banned/technical terms from
   `docs/ux-spec.md`.
2. Update only user-facing copy. Do not rename ids, file names, route keys, or
   internal type names.
3. Keep existing tour ids stable.
4. Run `npm run lint`.
5. Run `npm run build`.
6. Browser check `/learn`, then optionally clear `proto.tours.v1` and verify
   the welcome toast copy on a fresh login.

Acceptance criteria:

- Learning Center cards no longer mention model/version/runs as normal user
  concepts.
- Existing tour cards still render.
- Existing tour ids are unchanged.
- Lint and build pass.

Verification:

- `npm run lint` passed.
- User verified `npm run build` locally and reported that the build passed.

Pause after this phase for user review.

## Phase B - `hire-an-agent` Implementation Decision

Status: **Done 2026-04-29**.

Goal:

- Choose the safest shape for the next new tour before writing code.

Why this phase exists:

- The Hire wizard lives on one route (`/agents/new`) and changes screens using
  local React state.
- The current tour engine can navigate routes, but it cannot drive wizard phase
  changes.
- The overlay blocks normal page clicks while active, so a tour step cannot
  simply say "click this role card" and assume the underlying UI will receive
  the click.

Decision options:

1. **Orientation-only tour**.
   - No engine changes.
   - No Training mode required.
   - Highlights the Hire entry point, role templates, app-access explanation,
     and explains what happens next.
   - Stops before asking the user to perform the full wizard.
   - Recommended first version because it is low-risk.

2. **Full wizard tour with route-driven tour state**.
   - Adds explicit tour support to `AgentNewScreen`, likely through search
     params such as `/agents/new?tourTemplate=sales&tourPhase=review`.
   - Lets `navigateTo` move between deterministic wizard phases.
   - More robust than relying on clicks, but it adds product-screen logic only
     for tours.

3. **Full wizard tour with new engine interaction support**.
   - Adds a new engine concept such as `allowTargetInteraction` or action
     checkpoints.
   - More general, but higher risk and not needed by the shipped tours.

Recommendation:

- Chosen path: **option 1, orientation-only tour**.
- Decision record and implementation plan:
  `docs/agent-plans/2026-04-29-1954-hire-an-agent-tour-plan.md`.
- The first version will not include final Hire submit.
- Training mode sandboxing for create-agent mutations is not required for the
  first version because the tour will not create an agent.
- If option 2 or 3 is chosen, create a separate implementation plan before
  touching code.

Acceptance criteria:

- The chosen path is written into a new `docs/agent-plans/...` file before
  implementation.
- The plan explicitly says whether the final Hire submit is included.
- The plan explicitly says whether Training mode must sandbox create-agent
  mutations.

Pause after this phase for user confirmation.

## Phase C - Implement `hire-an-agent`

Status: **Ready for orientation-only implementation**.

Implementation plan:

- `docs/agent-plans/2026-04-29-1954-hire-an-agent-tour-plan.md`

If Phase B chooses orientation-only:

Files likely touched:

- `src/prototype/screens/AgentNewScreen.tsx`
- `src/prototype/tours/hire-an-agent-tour.tsx`
- `src/prototype/tours/registry.ts`

Likely steps:

1. Add stable `data-tour` attributes to the `/agents/new` welcome screen:
   page intro, featured role grid, first role card, more roles toggle, and
   back-to-Team or next-action area if useful.
2. Create `hire-an-agent-tour.tsx`.
3. Register the tour in `registry.ts`, probably under `getting-started` or
   `admin-setup`.
4. Keep copy focused on "choose a role, name the agent, connect apps, review
   approvals, hire".
5. Do not highlight model/token/advanced settings.
6. Run `npm run lint`.
7. Run `npm run build`.
8. Browser verify from `http://localhost:5173/#/learn` as Ada/admin.

If Phase B chooses a full wizard tour:

- Write a dedicated implementation plan first.
- Decide how wizard state becomes deterministic.
- Decide whether final submit is sandboxed or avoided.
- Add Training mode support only through `api.*`, never by mutating fixtures
  directly from screens.

Acceptance criteria:

- Tour appears on `/learn`.
- Audience gating is correct.
- Every spotlight target resolves.
- No banned technical words are introduced in visible copy.
- Training mode behavior is explicit and safe.

Pause after this phase for browser review.

## Phase D - Implement `activity-overview`

Status: **Not started**.

Goal:

- Replace the old technical `inspect-a-run` idea with a friendly Activity
  overview.

Files likely touched:

- `src/prototype/screens/RunsScreen.tsx`
- `src/prototype/lib/api.ts`
- `src/prototype/tours/training-fixtures.ts`
- `src/prototype/tours/activity-overview-tour.tsx`
- `src/prototype/tours/registry.ts`

Steps:

1. Add Training mode support to `api.listRuns()`.
2. Add an `activity-overview` scenario with deterministic friendly Activity
   rows, including at least one "needs approval" or "got stuck" example.
3. Add stable `data-tour` targets to the Activity list:
   nav item if needed, filters, first row, expanded summary, approval/help
   state, optional technical-view link.
4. Create `activity-overview-tour.tsx`.
5. Register the tour.
6. Run `npm run lint`.
7. Run `npm run build`.
8. Browser verify from `/learn` for an admin and a member if audience is `all`.

Acceptance criteria:

- The tour teaches `/activity`, not `/runs`.
- The tour does not frame "run" as the user mental model.
- The tour does not require `TourStep.when`.
- Technical detail view is optional and clearly described as advanced if
  mentioned at all.

Pause after this phase for browser review.

## Phase E - Implement `costs-overview`

Status: **Not started**.

Goal:

- Add a short admin tour for understanding spend/monthly bill.

Files likely touched:

- `src/prototype/screens/SpendScreen.tsx`
- `src/prototype/lib/api.ts`
- `src/prototype/tours/training-fixtures.ts`
- `src/prototype/tours/costs-overview-tour.tsx`
- `src/prototype/tours/registry.ts`

Steps:

1. Decide whether deterministic Training mode spend is required.
2. If yes, extend `TrainingScenario` and `api.getSpend()` to support scenario
   spend data.
3. Add `data-tour` targets to the simple Costs view:
   weekly total, costs-by-agent card, trend card, all-agents table.
4. Avoid spotlighting the advanced token table unless the screen is revised.
5. Create `costs-overview-tour.tsx`.
6. Register the tour under `admin-setup`.
7. Run `npm run lint`.
8. Run `npm run build`.
9. Browser verify from `/learn` as Ada/admin and confirm member users cannot
   run the tour.

Acceptance criteria:

- The tour uses `/costs`, not `/spend`.
- The tour stays short.
- The tour does not teach tokens as a normal user concept.
- MockBadge caveat on the trend is respected.

Pause after this phase for browser review.

## Phase F - Optional Later Tours

Status: **Deferred**.

Candidates:

- `apps-and-permissions`
- `advanced-activity-detail`

Rules:

- Do not build `apps-and-permissions` while the Apps connect flow is still
  mostly placeholder OAuth behavior.
- Do not build `advanced-activity-detail` for Maria. If it is ever needed,
  make it admin/developer-facing and clearly advanced.
- Do not revive the old `inspect-a-run` wording.

## Definition Of Done For Future Tour Work

For each implemented tour:

- A plan file exists under `docs/agent-plans/`.
- Exactly one plan step is completed per user-reviewed work cycle unless the
  user explicitly asks for autonomous execution.
- The tour file is pure data.
- Data-dependent tours use Training mode through the `api.*` boundary.
- Tour ids are stable and kebab-case.
- `/learn` card appears in the right group with the right audience.
- `npm run lint` passes.
- `npm run build` passes.
- Browser verification is done from `http://localhost:5173/#/learn`.
- Training mode exits after Done, Skip tour, and Esc.
