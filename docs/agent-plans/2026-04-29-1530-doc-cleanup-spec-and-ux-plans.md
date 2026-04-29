# Documentation Cleanup — SPEC_ALIGNMENT_PLAN & UX_SIMPLIFICATION_PLAN

## 1. Task summary

Delete two completed/superseded root-level plans (`SPEC_ALIGNMENT_PLAN.md`, `UX_SIMPLIFICATION_PLAN.md`) and clean up every reference to them in the rest of the repo so nothing points at deleted files.

Follows the earlier plan `2026-04-29-1502-documentation-cleanup.md` (which deleted the two HOMESCREEN executor plans and explicitly left these two as "keep"). User overruled that decision after a content audit.

## 2. Current repository state

- Branch: `master`. Working tree dirty (HomeScreen vocab pass, settings.local, etc.).
- `docs/agent-plans/` exists from the prior cleanup pass.
- Root markdown files include the two deletion targets plus `BACKEND_GAPS.md`, `int3grate_ux_spec.md`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `TOURS_PLAN.md`, `TOURS_IMPLEMENTATION_PLAN.md`.
- User explicitly confirmed deletion + reference cleanup in chat on 2026-04-29.

## 3. Relevant files inspected

- `SPEC_ALIGNMENT_PLAN.md` — status banner: ✅ Done 2026-04-28. Substitution rules already mirrored in CLAUDE.md/AGENTS.md vocabulary section. Deferred items duplicated in `int3grate_ux_spec.md`.
- `UX_SIMPLIFICATION_PLAN.md` — 984 lines. § 4 ("Что было неправильно") explicitly marks the original plan as superseded; § 3 metaphor "AI worker" was rolled back. Tracker is historical.
- `CLAUDE.md` (lines 3, 121–122, 328, 353, 387, 389) — references both files.
- `AGENTS.md` (lines 3, 121–122, 340, 365, 399, 401) — same set of references (CLAUDE.md/AGENTS.md were synced).
- `BACKEND_GAPS.md` (lines 235, 240, 272) — references `UX_SIMPLIFICATION_PLAN.md`.
- `src/prototype/index.tsx` (lines 37, 110) — code comments referencing `UX_SIMPLIFICATION_PLAN.md` Phase 1 / Phase 4.
- `docs/agent-plans/2026-04-29-1502-documentation-cleanup.md` — historical, **not modified**.

## 4. Assumptions and uncertainties

- `int3grate_ux_spec.md` is the single canonical source for UX direction; the deleted plans add no information beyond what's already there.
- The SPEC_ALIGNMENT vocabulary substitution rules are sufficiently captured by the Vocabulary section in CLAUDE.md/AGENTS.md (anti-patterns list + Keep-list + "what stays internal" examples).
- Code comments in `src/prototype/index.tsx` are internal (per spec § 11.2 not subject to vocab rules) but pointing at a deleted file is still misleading — rephrase to remove the reference without changing behavior.
- Old plan file `2026-04-29-1502-documentation-cleanup.md` reflects the executor's reasoning at that moment. Treating it as immutable historical record — not editing it.

## 5. Proposed approach

Three-stage edit, then delete, then verify:

1. **Edit references** in `CLAUDE.md`, `AGENTS.md`, `BACKEND_GAPS.md`, `src/prototype/index.tsx`. Keep useful information (e.g. "what stays internal" guidance, Phase numbering for history) by inlining or rephrasing without referencing the deleted files.
2. **Delete** `SPEC_ALIGNMENT_PLAN.md` and `UX_SIMPLIFICATION_PLAN.md`.
3. **Verify** with grep that no live references remain (excluding the two historical agent-plan files and this plan file).

## 6. Risks and trade-offs

- Deleting documents is irreversible if not committed (current files have history in git, so a checkout from `HEAD` brings them back if needed).
- Risk of missing a reference: mitigated by the grep inventory above (16 hits across 4 files + 2 historical plan files left as-is).
- Risk of degrading useful context in CLAUDE.md/AGENTS.md (Phase numbering, internal-stays guidance): mitigated by keeping the substantive content and only dropping the doc pointer.
- The src/prototype/index.tsx comment edits change comments only — no runtime behavior.

## 7. Step-by-step implementation plan

### Step 7.1 — CLAUDE.md edits (5 edits)

a. Line 3 intro: drop "after Phases 1-11 of `UX_SIMPLIFICATION_PLAN.md` and the arrival of" → simpler "aligned with `int3grate_ux_spec.md`".

b. Lines 121–122 (Read first items 2 and 3): remove both bullets entirely. Renumber remaining items so list is 1. int3grate_ux_spec.md, 2. BACKEND_GAPS.md.

c. Line 328 (SPEC ALIGNMENT DONE blockquote): replace with concise version that keeps only the still-useful part — "vocabulary uses `Agent / agents`; sidebar `/agents` is `Team`; intentional internal matches: `ChatMessageRole = 'assistant'`, nav key `assistants`, `AssistantTemplate` interface". Drop the historical attribution to the deleted plans.

d. Line 353 (Tours status): drop "after Phases 1-11" and "Phase 10 of `UX_SIMPLIFICATION_PLAN.md`" — replace with generic "Tour rebuild under new vocabulary is deferred".

e. Lines 387–389 ("How to approach a new task"): drop "+ UX_SIMPLIFICATION_PLAN.md § 10" from layout bullet; remove the "Pending alignment work → SPEC_ALIGNMENT_PLAN.md" bullet entirely.

### Step 7.2 — AGENTS.md edits (mirror of CLAUDE.md)

a. Same intro line.
b. Same Read first list trim.
c. Line 340 SPEC ALIGNMENT blockquote — same simplification.
d. Line 365 Tours status — same simplification.
e. Lines 399, 401 — same trim.

### Step 7.3 — BACKEND_GAPS.md edits (3 edits)

a. Line 235: drop "(см. UX_SIMPLIFICATION_PLAN.md → Phase 10 deferred section)" — replace with "(tour rebuild deferred)".

b. Line 240 heading: "## 7. Open questions из UX_SIMPLIFICATION_PLAN.md section 11" → "## 7. Open questions for backend-product alignment".

c. Line 272: rephrase "Полный список — в UX_SIMPLIFICATION_PLAN.md § 14 …" — drop the cross-reference; the surrounding paragraph already explains what `<MockBadge>` does.

### Step 7.4 — src/prototype/index.tsx edits (2 edits)

a. Line 37: `// Old paths redirect to new ones (Phase 1 of UX_SIMPLIFICATION_PLAN.md).` → `// Old paths redirect to new ones (legacy hash routes).`

b. Line 110: `// Top-level Chats was removed in Phase 4 (UX_SIMPLIFICATION_PLAN.md): chat` → `// Top-level Chats was removed: chat`.

### Step 7.5 — Delete the two files

- `git rm` is not appropriate (files are tracked? Check first). If tracked, use `git rm`. If untracked, `Remove-Item`.
- Use Bash: `rm SPEC_ALIGNMENT_PLAN.md UX_SIMPLIFICATION_PLAN.md`.

### Step 7.6 — Verify

- Grep for `SPEC_ALIGNMENT_PLAN|UX_SIMPLIFICATION_PLAN` across the repo.
- Acceptable remaining hits: only the two historical agent-plan files in `docs/agent-plans/` (`2026-04-29-1502-documentation-cleanup.md` and this one).
- Run `npm run lint` + `npm run build` to confirm no code regressions (paranoid check; comments shouldn't affect anything).

## 8. Verification checklist

- [ ] `Test-Path SPEC_ALIGNMENT_PLAN.md` → False
- [ ] `Test-Path UX_SIMPLIFICATION_PLAN.md` → False
- [ ] `Test-Path BACKEND_GAPS.md` → True
- [ ] `Test-Path int3grate_ux_spec.md` → True
- [ ] `Test-Path CLAUDE.md` / `AGENTS.md` / `README.md` → all True
- [ ] `grep -rn "SPEC_ALIGNMENT_PLAN\|UX_SIMPLIFICATION_PLAN"` returns hits ONLY in `docs/agent-plans/*.md`
- [ ] `npm run lint` clean
- [ ] `npm run build` clean

## 9. Browser testing instructions for the user

No browser check needed — this is documentation + code-comment cleanup. No runtime code changed. If you want extra confidence, open `http://localhost:5173/#/` and confirm the app still loads. The legacy `/runs`, `/spend`, `/chats` redirects still work.

## 10. Progress log

- 2026-04-29 15:30: User confirmed deletion in chat after content audit.
- 2026-04-29 15:30: Inventory grep ran. 16 references across 4 files + 2 historical plan files in `docs/agent-plans/` (left as-is).
- 2026-04-29 15:30: Plan file created.
