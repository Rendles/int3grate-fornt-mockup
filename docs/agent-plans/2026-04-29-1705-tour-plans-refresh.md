# Refresh Future Tour Plans

Status: **Done**.

## 1. Task Summary

Update the existing guided-tour planning documents so they match the current product direction, route map, tour engine, and `docs/ux-spec.md` vocabulary. This task is documentation-only: it should not implement new tours yet.

## 2. Current Repository State

- Existing working tree already has documentation changes from the tour authoring guide work:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `docs/tours-guide.md`
  - `docs/agent-plans/2026-04-29-1650-tour-authoring-docs.md`
- Current shipped tours are registered in `src/prototype/tours/registry.ts`:
  - `sidebar-overview`
  - `approval-review`
  - `start-a-chat`
  - `configure-tool-grants`
- Current route map uses direct hash routes:
  - `/activity`, `/activity/:runId`
  - `/costs`
  - `/agents/new`
  - `/learn`
- Legacy redirects still exist:
  - `/runs` -> `/activity`
  - `/spend` -> `/costs`
- `TourStep` currently supports `navigateTo`, but not `when`.
- Training fixtures currently include scenarios for the 3 data-dependent shipped tours only. `inspect-a-run` and `spend-overview` are still comments/pending placeholders.
- `api.getSpend()` does not yet route through training fixtures, so a future spend tour would need API/training support first if it requires scenario data.

## 3. Relevant Files Inspected

- `AGENTS.md`
- `package.json`
- `docs/plans/tours.md`
- `docs/plans/tours-implementation.md`
- `docs/tours-guide.md`
- `docs/ux-spec.md`
- `src/prototype/index.tsx`
- `src/prototype/tours/registry.ts`
- `src/prototype/tours/types.ts`
- `src/prototype/tours/training-fixtures.ts`
- `src/prototype/lib/api.ts`
- `src/prototype/screens/AgentNewScreen.tsx`
- `src/prototype/screens/RunsScreen.tsx`
- `src/prototype/screens/RunDetailScreen.tsx`
- `src/prototype/screens/SpendScreen.tsx`

## 4. Assumptions And Uncertainties

- The user wants the old future-tour plans refreshed first, not new tour code implemented immediately.
- The old `inspect-a-run` plan should be deprioritized because it reinforces technical language that the current UX spec tells us to avoid for Maria.
- A future Activity tour may still be valuable, but it should teach the friendly `/activity` list and "got stuck / needs approval" moments, not the technical timeline.
- A future Costs tour may be useful for admin demos, but it is not as core as Team, Conversation, and Approvals.
- The Hire flow is now a stronger new-tour candidate than the old plan claimed, because it directly supports the Team mental model and first-value path.

## 5. Proposed Approach

Refresh planning in small, reviewable steps:

- First update `docs/plans/tours.md` as the high-level product/design plan.
- Then update `docs/plans/tours-implementation.md` as the step-by-step execution plan.
- Keep `docs/tours-guide.md` mostly practical and current; update it only if the plan refresh reveals stale guidance.
- Do not change app code or implement new tours in this task.

## 6. Risks And Trade-Offs

- Replacing the old Phase 6 order means we are intentionally not following the previous "inspect-a-run then spend-overview" sequence.
- Calling this out firmly is important because blindly implementing `inspect-a-run` would add more technical onboarding at the exact moment the product is trying to feel simpler.
- Documentation-only changes can still mislead future agents if the implementation plan and high-level plan disagree, so both docs need to be aligned before this task is done.
- Browser verification is limited because this task changes docs, not UI behavior.

## 7. Step-By-Step Implementation Plan

1. Update `docs/plans/tours.md` to describe the current shipped tours, stale old assumptions, and the new recommended future-tour order. **Done.**
2. Update `docs/plans/tours-implementation.md` so the remaining phases match the refreshed order and no longer present `inspect-a-run` as the next mandatory engine-changing step. **Done.**
3. Check whether `docs/tours-guide.md` needs a small note that future-tour ideas live in `docs/plans/tours.md`, while the guide remains the how-to reference. **Done.**
4. Run a documentation sanity check with `Select-String` for stale route/copy references in the touched plan docs. **Done.**
5. Mark this plan done after the old plan docs are internally consistent. **Done.**

## 8. Verification Checklist

- [x] `docs/plans/tours.md` no longer says `/runs/:runId` and `/spend` are the active next-route targets without caveats.
- [x] `docs/plans/tours.md` clearly recommends the next tour candidates in priority order.
- [x] `docs/plans/tours.md` explains why `inspect-a-run` should not be implemented as originally written.
- [x] `docs/plans/tours-implementation.md` matches the refreshed high-level plan.
- [x] No app code changed.
- [x] Documentation grep confirms stale references are either removed or explicitly marked as legacy/history.

## 9. Browser Testing Instructions For The User

This task is documentation-only, so there is no required browser behavior to verify after each step.

Optional sanity check:

1. Open `http://localhost:5173/#/learn`.
2. Confirm the Learning Center still shows the existing 4 tour cards.
3. No visual change is expected from this documentation update.

## 10. Progress Log

- 2026-04-29 17:05: Read `AGENTS.md`, checked git status and package scripts.
- 2026-04-29 17:05: Re-read old tour plans, practical tour guide, route map, registry, tour types, fixtures, API, and relevant screens.
- 2026-04-29 17:05: Created this plan file before touching the existing tour plan docs.
- 2026-04-29 17:05: Step 1 completed. Rewrote `docs/plans/tours.md` as the refreshed high-level plan: current shipped tours, guardrails, stale assumptions, new recommended order, and Training mode backlog.
- 2026-04-29 17:05: Step 2 completed. Rewrote `docs/plans/tours-implementation.md` as the refreshed execution plan: copy cleanup first, then `hire-an-agent` decision, then Hire / Activity / Costs in the new order.
- 2026-04-29 17:05: Step 3 completed. Updated `docs/tours-guide.md` intro to separate current planning docs from practical authoring guidance.
- 2026-04-29 17:05: Step 4 completed. Ran documentation sanity checks for stale routes and technical terms. Remaining matches are intentional warnings, legacy notes, or "do not implement this old idea" context.
- 2026-04-29 17:05: Step 5 completed. Marked this plan as done after the refreshed tour planning docs were aligned and sanity-checked.
