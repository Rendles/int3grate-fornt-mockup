# Existing Tour Copy Cleanup

Status: **Done**.

## 1. Task Summary

Clean up visible copy around the existing guided tours so it follows `docs/ux-spec.md` and the refreshed tour plans. This phase should remove stale or technical wording from the Learning Center, welcome prompt, and existing tour copy without changing tour mechanics.

## 2. Current Repository State

- The working tree already contains previous documentation changes:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `docs/tours-guide.md`
  - `docs/plans/tours.md`
  - `docs/plans/tours-implementation.md`
  - completed plan files under `docs/agent-plans/`
- Current shipped tours are:
  - `sidebar-overview`
  - `approval-review`
  - `start-a-chat`
  - `configure-tool-grants`
- `docs/plans/tours-implementation.md` marks Phase A as not started and calls out two known stale-copy issues:
  - `start-a-chat` card mentions "version and model".
  - `WelcomeToast.tsx` mentions "runs".
- A current inspection also found `LearnScreen.tsx` uses the visible group label "Core workflows", which conflicts with the UX vocabulary guidance.
- No test runner is configured. Available checks are `npm run lint` and `npm run build`.

## 3. Relevant Files Inspected

- `AGENTS.md`
- `package.json`
- `docs/ux-spec.md`
- `docs/tours-guide.md`
- `docs/plans/tours.md`
- `docs/plans/tours-implementation.md`
- `src/prototype/screens/LearnScreen.tsx`
- `src/prototype/tours/registry.ts`
- `src/prototype/tours/WelcomeToast.tsx`
- `src/prototype/tours/sidebar-tour.tsx`
- `src/prototype/tours/approval-review-tour.tsx`
- `src/prototype/tours/start-a-chat-tour.tsx`
- `src/prototype/tours/configure-tool-grants-tour.tsx`

## 4. Assumptions And Uncertainties

- The user wants Phase A from `docs/plans/tours-implementation.md` implemented now.
- This task should only change user-facing copy and status documentation, not tour ids, scenario ids, route keys, target selectors, or Training mode behavior.
- Internal names such as `core-workflows`, `nav-assistants`, `RunDetail`, and training fixture fields can remain because users do not see them.
- The visible word "workflow" in the Learning Center group label should be replaced, even though the internal group id must stay stable.

## 5. Proposed Approach

Work in small reviewable steps:

- First clean discovery copy around existing tours: Learning Center group/card text and the first-login welcome prompt.
- Then audit the actual tour step bodies and update only visible stale copy if found.
- Finally run static checks and mark Phase A complete in the relevant docs.

## 6. Risks And Trade-Offs

- Changing visible labels can slightly change the feel of `/learn`, but this is intentional and aligned with the UX spec.
- Renaming internal ids would risk breaking completion state and grouping, so internal ids will not be changed.
- Broadly rewriting all tour copy would be riskier than necessary. This pass should stay focused on stale technical vocabulary and obvious current-UI mismatches.

## 7. Step-By-Step Implementation Plan

1. Clean visible discovery copy in `LearnScreen.tsx`, `registry.ts`, and `WelcomeToast.tsx`. **Done.**
2. Audit existing tour step copy and adjust only visible stale or technical wording if the audit finds issues. **Done.**
3. Run `npm run lint`. **Done.**
4. Run `npm run build`. **Done.**
5. Update `docs/plans/tours-implementation.md` Phase A status and mark this plan done. **Done.**

## 8. Verification Checklist

- [x] Learning Center no longer shows `Core workflows` as visible copy.
- [x] `start-a-chat` card no longer mentions version or model.
- [x] Welcome toast no longer says tours cover runs.
- [x] Existing tour ids remain unchanged.
- [x] Existing `scenarioId` values remain unchanged.
- [x] No banned technical terms remain in visible tour discovery copy.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] `docs/plans/tours-implementation.md` marks Phase A done.

## 9. Browser Testing Instructions For The User

After step 1:

1. Open `http://localhost:5173/#/learn`.
2. Confirm the Learning Center still shows the existing 4 cards.
3. Confirm the group that used to say `Core workflows` now uses friendlier copy.
4. Confirm the `Start a chat` card explains choosing an agent and opening a chat without mentioning model or version.
5. To verify the welcome toast, clear `localStorage["proto.tours.v1"]`, refresh any authenticated route except `/learn`, and confirm the toast points to agents, approvals, and activity.

After step 2:

1. Open `http://localhost:5173/#/learn`.
2. Start `Sidebar overview`, `Review an approval`, and `Start a chat`.
3. Confirm the tooltip copy still matches the highlighted UI.
4. Confirm the tooltips avoid technical wording like `history log`, `audit`, `metadata`, `reference IDs`, and `stream`.

## 10. Progress Log

- 2026-04-29 17:23: Read `AGENTS.md`, checked git status, checked package scripts, and re-read tour planning docs.
- 2026-04-29 17:23: Inspected the current tour registry, welcome toast, Learning Center, and existing tour files before changing code.
- 2026-04-29 17:23: Step 1 completed. Cleaned Learning Center group/card copy and welcome toast copy without changing tour ids, group ids, scenarios, or routes.
- 2026-04-29 17:23: Step 2 completed. Audited existing tour step bodies and replaced stale technical wording with friendlier business copy.
- 2026-04-29 17:23: Step 3 completed. Ran `npm run lint`; ESLint completed without errors.
- 2026-04-29 17:23: Step 4 completed. User verified `npm run build` locally and reported that the build passed.
- 2026-04-29 19:49: Step 5 completed. Updated `docs/plans/tours-implementation.md` to mark Phase A done and closed this plan.
