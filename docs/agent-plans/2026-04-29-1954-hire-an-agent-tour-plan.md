# Hire An Agent Tour Plan

Status: **In progress**.

## 1. Task Summary

Plan the next guided tour: `hire-an-agent`. The chosen implementation shape is an orientation-only tour for the `/agents/new` welcome screen. It will explain why the Hire flow exists and how to choose a starting role without trying to drive the full wizard.

This plan is the Phase B decision record and the implementation plan for the next phase. No app code is changed in this decision step.

## 2. Current Repository State

- Existing shipped tours:
  - `sidebar-overview`
  - `approval-review`
  - `start-a-chat`
  - `configure-tool-grants`
- Phase A copy cleanup is done.
- `src/prototype/screens/AgentNewScreen.tsx` now has welcome-screen `data-tour`
  targets for the orientation-only tour.
- The Hire wizard uses local React state: `welcome`, `preview`, `name`, `apps`, `review`, `success`.
- `TourStep` supports `navigateTo`, but not conditional steps or app-click interaction.
- `TourOverlay` owns the modal overlay and handles `Next`, `Back`, `Skip step`, `Skip tour`, and `Done`; it should not rely on the underlying app receiving clicks while the tour is active.
- `AgentNewScreen` still contains an advanced settings accordion with visible words such as model and tokens. The new tour must not highlight that section.

## 3. Relevant Files Inspected

- `AGENTS.md`
- `package.json`
- `docs/plans/tours.md`
- `docs/plans/tours-implementation.md`
- `docs/tours-guide.md`
- `src/prototype/screens/AgentNewScreen.tsx`
- `src/prototype/tours/types.ts`
- `src/prototype/tours/TourOverlay.tsx`
- `src/prototype/tours/registry.ts`

## 4. Assumptions And Uncertainties

- The goal is to add a useful demo tour with minimal engine and UX risk.
- The tour should teach the Team mental model: hiring an agent is like adding a person to the digital team.
- The first version should not click through the full wizard or create an agent.
- The final Hire submit is **not included** in this version.
- Training mode sandboxing for create-agent mutations is **not required** for this version because no mutation will run.
- If the user later wants a full wizard tour, that should be a separate plan with explicit engine or route-state work.

## 5. Proposed Approach

Build an orientation-only tour.

The tour should:

- Start from `/learn` and navigate to `/agents/new`.
- Highlight the welcome page intro.
- Highlight the featured role grid.
- Highlight one representative role card.
- Highlight the `See all roles` action or explain that more roles are available.
- Highlight `Skip and explore` or the route back to Team as a safe exit.
- Tell the user what happens after choosing a role: preview, name, connect apps, review, hire.

The tour should not:

- Depend on Training mode.
- Submit the Hire form.
- Highlight advanced settings.
- Mention model, tokens, prompt, JSON, runs, execution, traces, or other banned technical vocabulary.
- Add new tour engine features.

## 6. Risks And Trade-Offs

- Orientation-only is less interactive than a full wizard tour, but it avoids brittle coupling to local wizard state.
- Not including final Hire means the user will not see the success screen in this tour. That is acceptable for a first version because it keeps the tour safe and predictable.
- This version teaches the entry point and mental model, not every field. That is intentional; a long wizard tour could make onboarding feel heavier.
- Adding `data-tour` targets to the welcome screen is low risk, but the target wrappers still need to be visually checked so the spotlight feels intentional.

## 7. Step-By-Step Implementation Plan

1. Add stable `data-tour` targets to the `/agents/new` welcome screen only: **Done.**
   - page intro
   - featured role grid
   - first featured role card or all role cards with a shared selector
   - `See all roles`
   - `Skip and explore`
2. Create `src/prototype/tours/hire-an-agent-tour.tsx` as a pure tour data file with 4-5 short steps. **Done.**
3. Register the tour in `src/prototype/tours/registry.ts`: **Done.**
   - `tour.id`: `hire-an-agent`
   - `audience`: `domain_admin`
   - `group`: likely `getting-started`
   - `scenarioId`: `null`
4. Run a targeted copy scan for banned visible terms in the new tour file and registry card. **Done.**
5. Run `npm run lint`.
6. Run `npm run build`.
7. Browser verify from `http://localhost:5173/#/learn` as an admin/domain admin:
   - card appears
   - member users cannot start it
   - Start navigates to `/agents/new`
   - every spotlight target resolves
   - Back, Skip step, Skip tour, Esc, and Done behave normally

## 8. Verification Checklist

- [x] `AgentNewScreen.tsx` gets stable welcome-screen `data-tour` targets.
- [x] `hire-an-agent-tour.tsx` exists and exports a `Tour`.
- [x] `registry.ts` includes `hire-an-agent`.
- [x] The tour uses `navigateTo: '/agents/new'`.
- [x] `scenarioId` is `null`.
- [x] Final Hire submit is not included.
- [x] Training mode create-agent sandboxing is not required.
- [x] New visible copy avoids banned technical terms.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Browser verification passes from `/learn`.

## 9. Browser Testing Instructions For The User

After step 1:

1. Open `http://localhost:5173/#/agents/new`.
2. Confirm the welcome screen still looks unchanged.
3. Click `See all roles` and confirm the extra roles still expand.
4. Click `Skip and explore` and confirm it still navigates to `#/agents`.

After step 3:

1. Open `http://localhost:5173/#/learn`.
2. Confirm the `Hire an agent` card appears in `Getting started`.
3. Confirm Ada/admin and Marcelo/team admin can start it.
4. Confirm Priya/member cannot start it.
5. Do not fully validate spotlight behavior yet; that comes after copy scan, lint, build, and final browser verification.

After implementation:

1. Open `http://localhost:5173/#/learn`.
2. Log in as Ada or Marcelo.
3. Find the `Hire an agent` tour card.
4. Click `Start tour`.
5. Confirm the app navigates to `#/agents/new`.
6. Click through each step and confirm the spotlight lands on the welcome intro, role choices, role card, and available actions.
7. Confirm the tour does not open advanced settings or mention model/tokens.
8. Press `Esc` during the tour and confirm it closes cleanly.
9. Finish the tour with `Done` and confirm the app returns to `/learn`.
10. Log in as Priya/member if needed and confirm the card is disabled or unavailable to start.

## 10. Progress Log

- 2026-04-29 19:54: Read current agent rules, git status, package scripts, tour implementation roadmap, tour guide, tour types, overlay behavior, registry, and `AgentNewScreen.tsx`.
- 2026-04-29 19:54: Chose the orientation-only implementation shape because the current tour engine cannot safely drive the local-state Hire wizard without extra product or engine work.
- 2026-04-29 19:54: Explicitly decided that the final Hire submit is not included and Training mode create-agent sandboxing is not required for the first version.
- 2026-04-29 19:54: Step 1 completed. Added stable `data-tour` targets to the `/agents/new` welcome screen without changing visual layout or click behavior.
- 2026-04-29 19:54: Step 2 completed. Created the pure-data `hire-an-agent` tour with five welcome-screen steps and no submit action.
- 2026-04-29 19:54: Step 3 completed. Registered `hire-an-agent` in the Learning Center with `domain_admin` audience, `getting-started` group, and `scenarioId: null`.
- 2026-04-29 19:54: Step 4 completed. Ran targeted copy scans against `hire-an-agent-tour.tsx` and the `hire-an-agent` registry card; no banned visible technical terms were found.
