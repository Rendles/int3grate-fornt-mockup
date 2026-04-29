# Documentation Cleanup Plan

## 1. Task summary

Remove completed temporary documentation/plans only if they are no longer useful and are not referenced by the current working instructions.

This is a destructive local-file task, so deletion requires explicit action-time confirmation before any file is removed.

## 2. Current repository state

- Current branch: `master`.
- Working tree is dirty with many existing product changes.
- `docs/` did not exist before this plan; `docs/agent-plans/` was created for this plan as required by `AGENTS.md`.
- Root markdown files currently include:
  - `AGENTS.md`
  - `BACKEND_GAPS.md`
  - `CLAUDE.md`
  - `HOMESCREEN_RESTORE_PLAN.md`
  - `HOMESCREEN_VOCAB_FIX_PLAN.md`
  - `int3grate_ux_spec.md`
  - `README.md`
  - `SPEC_ALIGNMENT_PLAN.md`
  - `TOURS_IMPLEMENTATION_PLAN.md`
  - `TOURS_PLAN.md`
  - `UX_SIMPLIFICATION_PLAN.md`

## 3. Relevant files inspected

- `AGENTS.md`
- `CLAUDE.md`
- `package.json`
- `HOMESCREEN_RESTORE_PLAN.md`
- `HOMESCREEN_VOCAB_FIX_PLAN.md`
- `TOURS_PLAN.md`
- `TOURS_IMPLEMENTATION_PLAN.md`
- `SPEC_ALIGNMENT_PLAN.md`
- `UX_SIMPLIFICATION_PLAN.md`
- `BACKEND_GAPS.md`
- `int3grate_ux_spec.md`
- `README.md`

## 4. Assumptions and uncertainties

- `HOMESCREEN_RESTORE_PLAN.md` and `HOMESCREEN_VOCAB_FIX_PLAN.md` are temporary executor plans for work that has already been completed and visually accepted by the user.
- `TOURS_PLAN.md` and `TOURS_IMPLEMENTATION_PLAN.md` are still active because both say `Status: In progress` and list remaining phases/tours.
- `SPEC_ALIGNMENT_PLAN.md` is done, but it is intentionally kept as a canonical reference by `AGENTS.md` and `CLAUDE.md`.
- `UX_SIMPLIFICATION_PLAN.md`, `BACKEND_GAPS.md`, and `int3grate_ux_spec.md` are current reference documents and should stay.
- `README.md` appears stale because it still mentions the old `/#/app` route and missing docs like `BACKEND_DATA_SOURCES.md`, but this cleanup pass is about deleting completed plans, not rewriting README.
- `CLAUDE.md` and `AGENTS.md` are active agent instructions and should stay.

## 5. Proposed approach

Delete only the completed HomeScreen temporary plans:

- `HOMESCREEN_RESTORE_PLAN.md`
- `HOMESCREEN_VOCAB_FIX_PLAN.md`

Keep all other markdown files for now.

## 6. Risks and trade-offs

- Deleting local files is irreversible unless restored from git or backups. These two files are currently untracked, so git may not be able to restore them after deletion.
- The HomeScreen plans contain detailed execution history and rollback notes. That is useful for audit/debugging, but the implemented state is already reflected in code and the user has accepted the work.
- Keeping them creates root-level documentation noise and makes future agents more likely to read stale completed executor plans.

## 7. Step-by-step implementation plan

1. Inventory markdown documentation and classify each file as keep/delete.
2. Create this plan file under `docs/agent-plans/`.
3. Ask the user for explicit confirmation to delete the two candidate files.
4. Delete only:
   - `HOMESCREEN_RESTORE_PLAN.md`
   - `HOMESCREEN_VOCAB_FIX_PLAN.md`
5. Verify that those files are gone and no other markdown files were deleted.
6. Report the final state.

## 8. Verification checklist

- `Test-Path HOMESCREEN_RESTORE_PLAN.md` returns `False`.
- `Test-Path HOMESCREEN_VOCAB_FIX_PLAN.md` returns `False`.
- `Test-Path TOURS_PLAN.md` returns `True`.
- `Test-Path TOURS_IMPLEMENTATION_PLAN.md` returns `True`.
- `Test-Path SPEC_ALIGNMENT_PLAN.md` returns `True`.
- `Test-Path UX_SIMPLIFICATION_PLAN.md` returns `True`.
- `Test-Path BACKEND_GAPS.md` returns `True`.
- `Test-Path int3grate_ux_spec.md` returns `True`.
- `Test-Path AGENTS.md` returns `True`.
- `Test-Path CLAUDE.md` returns `True`.
- `Test-Path README.md` returns `True`.

## 9. Browser testing instructions for the user

No browser check is needed for this step because deleting completed markdown plans does not affect runtime UI behavior.

If the user wants extra confidence, open `http://localhost:5173/#/` and confirm the app still loads, but this cleanup does not change application code.

## 10. Progress log

- 2026-04-29 15:02: Read `AGENTS.md` as requested.
- 2026-04-29 15:02: Checked git status, package scripts, root markdown inventory, and references from `AGENTS.md` / `CLAUDE.md`.
- 2026-04-29 15:02: Classified `HOMESCREEN_RESTORE_PLAN.md` and `HOMESCREEN_VOCAB_FIX_PLAN.md` as deletion candidates.
- 2026-04-29 15:02: Classified tour docs and canonical spec/reference docs as keep.
- 2026-04-29 15:02: Created this plan file.
