# Tour Authoring Documentation Plan

Status: **Done**.

## 1. Task summary

Create permanent documentation that explains how to author, register, seed, and verify guided tours in this project so future work does not require rediscovering the tour system from code.

The requested deliverable is documentation, not a new tour and not engine changes.

## 2. Current repository state

- Current app is Vite + React 19 + TypeScript.
- Prototype routes are direct hash routes like `#/learn`; there is no `#/app` prefix.
- The tour engine is implemented under `src/prototype/tours/`.
- `/learn` is the Learning Center and reads tour cards from `TOURS` in `src/prototype/tours/registry.ts`.
- Training mode is implemented and swaps API reads to scenario fixtures through `src/prototype/lib/api.ts`.
- There are existing planning documents under `docs/plans/`, but they are implementation/status plans, not a concise authoring guide.
- Working tree is already dirty from previous product/documentation work; this task should only touch the new guide and a small discoverability pointer if approved.

## 3. Relevant files inspected

- `AGENTS.md`
- `package.json`
- `src/prototype/tours/types.ts`
- `src/prototype/tours/registry.ts`
- `src/prototype/tours/TourProvider.tsx`
- `src/prototype/tours/TourOverlay.tsx`
- `src/prototype/tours/TrainingModeProvider.tsx`
- `src/prototype/tours/TrainingBanner.tsx`
- `src/prototype/tours/TrainingAutoExit.tsx`
- `src/prototype/tours/WelcomeToast.tsx`
- `src/prototype/tours/training-fixtures.ts`
- `src/prototype/tours/sidebar-tour.tsx`
- `src/prototype/tours/approval-review-tour.tsx`
- `src/prototype/tours/start-a-chat-tour.tsx`
- `src/prototype/tours/configure-tool-grants-tour.tsx`
- `src/prototype/screens/LearnScreen.tsx`
- `src/prototype/index.tsx`
- `src/prototype/components/shell.tsx`
- `src/prototype/lib/api.ts`
- `docs/plans/tours.md`
- `docs/plans/tours-implementation.md`

## 4. Assumptions and uncertainties

- The best home for permanent how-to documentation is `docs/tours-guide.md`.
- The existing `docs/plans/tours.md` and `docs/plans/tours-implementation.md` should remain as planning/status documents, not be overwritten.
- A small pointer in both `AGENTS.md` and `CLAUDE.md` would make the new guide discoverable for future agents.
- No browser UI should change from this documentation task.
- The current tour copy may still be stale per `AGENTS.md`; the guide should document mechanics and caution about vocabulary, not silently rewrite existing tours.

## 5. Proposed approach

Create a detailed guide at:

`docs/tours-guide.md`

The guide should cover:

- tour system overview;
- file map;
- `Tour` / `TourStep` shape;
- when to use Training mode;
- how to create a training scenario;
- how API sandboxing works;
- how to add `data-tour` targets;
- how to write a tour file;
- how to register a tour in `registry.ts`;
- how `/learn` gates audience and starts tours;
- cross-screen navigation with `navigateTo`;
- selector/placement best practices;
- verification checklist;
- browser testing instructions;
- common failure modes and fixes;
- a small copy-paste template for new tours.

Then update `AGENTS.md` and `CLAUDE.md` guided-tour sections with a one-line pointer to `docs/tours-guide.md`.

## 6. Risks and trade-offs

- If the guide is too tied to current implementation details, it can become stale. Mitigation: describe current source of truth files and make the guide explicit about checking the real code first.
- If the guide duplicates all of `docs/plans/tours-implementation.md`, it becomes noisy. Mitigation: keep it authoring-focused and reference implementation plans only for historical phase context.
- Adding pointers to `AGENTS.md` and `CLAUDE.md` touches agent instructions. This is low risk and improves discoverability, but it should stay small.

## 7. Step-by-step implementation plan

1. Create `docs/tours-guide.md` with the full tour-authoring guide.
2. Update `AGENTS.md` and `CLAUDE.md` guided tours sections with a short pointer to `docs/tours-guide.md`.
3. Verify documentation consistency:
   - check the guide references real file paths;
   - check route examples use direct hashes (`#/learn`, not `#/app/learn`);
   - check guide does not claim unimplemented features are complete.
4. Run no build unless code changes are introduced. Documentation-only changes do not need `npm run build`.
5. Report touched files and browser verification instructions.

## 8. Verification checklist

- `docs/tours-guide.md` exists.
- `docs/tours-guide.md` includes a complete new-tour checklist.
- `docs/tours-guide.md` explains Training mode and when it is optional.
- `docs/tours-guide.md` explains `navigateTo` for cross-screen tours.
- `docs/tours-guide.md` explains `/learn` registration and audience gating.
- `docs/tours-guide.md` uses current direct route examples like `http://localhost:5173/#/learn`.
- `AGENTS.md` links or points to `docs/tours-guide.md`.
- `CLAUDE.md` links or points to `docs/tours-guide.md`.
- No runtime code files are changed.

## 9. Browser testing instructions for the user

No browser test is required for documentation-only changes.

If desired, the user can open `http://localhost:5173/#/learn` to compare the guide against the visible Learning Center cards and existing tours.

## 10. Progress log

- 2026-04-29 16:50: Read `AGENTS.md`.
- 2026-04-29 16:50: Checked git status and `package.json`.
- 2026-04-29 16:50: Inspected tour engine, registry, training fixtures, Learning Center, mounting, and existing tour plans.
- 2026-04-29 16:50: Proposed permanent guide `docs/tours-guide.md` plus small `AGENTS.md` pointer.
- 2026-04-29 16:50: Created this plan file.
- 2026-04-29 16:50: Created `docs/tours-guide.md` with the tour authoring workflow, Training mode notes, registration steps, and verification checklist.
- 2026-04-29 16:50: User requested adding the pointer to `CLAUDE.md` too; plan updated to include both agent instruction files.
- 2026-04-29 16:50: Added `docs/tours-guide.md` pointers to the Guided tours sections of `AGENTS.md` and `CLAUDE.md`.
- 2026-04-29 16:50: Marked this plan as Done.
