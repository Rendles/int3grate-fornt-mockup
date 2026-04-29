# Documentation Reorganization & README Refresh

## 1. Task summary

Move all non-tool-required docs under `docs/`, rename to lowercase-with-dashes, update every reference (markdown + code comments), and refresh `README.md` to remove stale `/#/app` references and broken doc links.

User chose option C from the chat audit on 2026-04-29.

## 2. Current repository state

- Branch: `master`. Working tree dirty (HomeScreen vocab pass, prior cleanup).
- Root .md inventory: `AGENTS.md`, `BACKEND_GAPS.md`, `CLAUDE.md`, `int3grate_ux_spec.md`, `README.md`, `TOURS_IMPLEMENTATION_PLAN.md`, `TOURS_PLAN.md`.
- `docs/agent-plans/` exists with 2 historical plans.
- Git tracking: `README.md`, `TOURS_PLAN.md`, `TOURS_IMPLEMENTATION_PLAN.md` tracked. `BACKEND_GAPS.md`, `int3grate_ux_spec.md` untracked (recent additions).
- README.md is **stale**: references `/#/app` URL prefix (removed after Phase 11), and links to two non-existent files (`BACKEND_DATA_SOURCES.md`, `GATEWAY_NEXT_PLAN.md`).

## 3. Relevant files inspected

- All 7 root .md files plus inventory grep across the whole repo (12 files containing `int3grate_ux_spec|BACKEND_GAPS|TOURS_PLAN|TOURS_IMPLEMENTATION_PLAN`).
- `git ls-files` to confirm tracking state for each move.
- 4 source code files with comments referencing TOURS_PLAN.md.

## 4. Assumptions and uncertainties

- `AGENTS.md`, `CLAUDE.md`, `README.md` MUST stay at root (tool/convention requirements). Confirmed.
- New paths use lowercase-with-dashes (open-source convention). H1 titles inside files updated to readable form (e.g. `# BACKEND_GAPS.md` → `# Backend gaps`).
- Inter-doc references inside moved files become sibling-relative (`tours.md`, not full `docs/plans/tours.md`).
- Code comment references use repo-root-relative paths (`docs/plans/tours.md`) — easier to grep, less brittle than deep relative.
- Historical agent-plan files (`2026-04-29-1502-*` and `2026-04-29-1530-*`) NOT edited — they document past state.
- `gateway_latest.yaml` mentioned in CLAUDE.md doesn't exist on disk — separate issue, out of scope here.

## 5. Proposed approach

5-stage execution:

1. Create target directories.
2. Move/rename files (use `git mv` where tracked, plain `mv` where untracked).
3. Update H1 titles inside the 3 SCREAMING_SNAKE-titled files.
4. Update every reference: CLAUDE.md, AGENTS.md, BACKEND_GAPS (now `docs/backend-gaps.md`), TOURS_IMPLEMENTATION (now `docs/plans/tours-implementation.md`), 4 source code files.
5. Rewrite README.md intro + Where-to-read-next.

## 6. Risks and trade-offs

- Renaming tracked files via `git mv` preserves history; untracked files don't have history to preserve.
- Risk of missing a reference: mitigated by full-repo grep before and after.
- Risk of breaking the dev server: only code-comment changes touch source — no behavior change. Build/lint should stay green.
- README rewrite is partial (intro + reading list), not a full reskin — keeps scope contained.

## 7. Step-by-step implementation plan

### Step 7.1 — Create directories

```bash
mkdir -p docs/plans
```

### Step 7.2 — Move files

```bash
mv BACKEND_GAPS.md docs/backend-gaps.md
mv int3grate_ux_spec.md docs/ux-spec.md
git mv TOURS_PLAN.md docs/plans/tours.md
git mv TOURS_IMPLEMENTATION_PLAN.md docs/plans/tours-implementation.md
```

### Step 7.3 — Update H1 titles in moved files

- `docs/backend-gaps.md` line 1: `# BACKEND_GAPS.md` → `# Backend gaps`
- `docs/plans/tours.md` line 1: `# TOURS_PLAN.md` → `# Tours plan`
- `docs/plans/tours-implementation.md` line 1: `# TOURS_IMPLEMENTATION_PLAN.md` → `# Tours implementation plan`
- `docs/ux-spec.md` H1 already human-readable (`# INT3GRATE.AI — Спецификация…`) — leave as is.

### Step 7.4 — Update CLAUDE.md (10 references)

Replace `int3grate_ux_spec.md` → `docs/ux-spec.md` (8 occurrences).
Replace `BACKEND_GAPS.md` → `docs/backend-gaps.md` (3 occurrences).

### Step 7.5 — Update AGENTS.md (mirror of 7.4)

Same substitutions.

### Step 7.6 — Update inter-tour references in `docs/plans/tours-implementation.md`

- `TOURS_PLAN.md` → `tours.md` (sibling-relative, ~4 occurrences)
- Self-references `TOURS_IMPLEMENTATION_PLAN.md` → `tours-implementation.md`

### Step 7.7 — Update source code comments (4 files)

- `src/prototype/lib/api.ts` L99: `TOURS_PLAN.md` → `docs/plans/tours.md`
- `src/prototype/tours/training-context.ts` L6: same
- `src/prototype/tours/training-fixtures.ts` L18: same
- `src/prototype/tours/TrainingModeProvider.tsx` L8: same

### Step 7.8 — Rewrite README.md

Write fresh README that:
- Drops two-UIs-from-one-bundle framing (no longer true; the prototype mounts directly).
- Drops `/#/app` URL prefix from Quick start.
- Updates Where-to-read-next with new docs paths.
- Drops broken refs (`BACKEND_DATA_SOURCES.md`, `GATEWAY_NEXT_PLAN.md`).
- Keeps demo-logins block (still accurate).

### Step 7.9 — Verify

- Grep all old names — should find ZERO references (excluding historical agent-plan files).
- Grep new names — should find expected references.
- `npm run lint` clean.
- `npm run build` clean.
- `git status --porcelain` shows the 4 renames + 4 modified source files + modified CLAUDE.md/AGENTS.md/README.md.

## 8. Verification checklist

- [ ] `Test-Path BACKEND_GAPS.md` → False; `Test-Path docs/backend-gaps.md` → True
- [ ] `Test-Path int3grate_ux_spec.md` → False; `Test-Path docs/ux-spec.md` → True
- [ ] `Test-Path TOURS_PLAN.md` → False; `Test-Path docs/plans/tours.md` → True
- [ ] `Test-Path TOURS_IMPLEMENTATION_PLAN.md` → False; `Test-Path docs/plans/tours-implementation.md` → True
- [ ] grep `int3grate_ux_spec\|BACKEND_GAPS\|TOURS_PLAN\|TOURS_IMPLEMENTATION_PLAN` in repo (excluding `docs/agent-plans/`) returns 0 hits
- [ ] grep `#/app` in repo (excluding `docs/agent-plans/`) returns 0 hits
- [ ] grep `BACKEND_DATA_SOURCES\|GATEWAY_NEXT_PLAN` returns 0 hits
- [ ] `npm run lint` clean
- [ ] `npm run build` clean

## 9. Browser testing instructions for the user

Open `http://localhost:5173/#/`. The login screen should appear. Sign in with `frontend@int3grate.ai`. Confirm the home dashboard renders normally — all four metric cards, savings banner, two-column section, three-column section. Click each sidebar item; navigate to a few sub-routes; confirm nothing 404s. None of these changes touched runtime code, only doc paths in comments — so visual behavior must be identical.

## 10. Progress log

- 2026-04-29 15:45: User picked option C (full reorg + targeted README update).
- 2026-04-29 15:45: Inventory grep + tracking-state check completed.
- 2026-04-29 15:45: Plan file created.
