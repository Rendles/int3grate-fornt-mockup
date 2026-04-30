# Gateway YAML cleanup & canonical spec move

## 1. Task summary

Delete two outdated gateway OpenAPI YAML files, move the current one into `docs/`, rename it to a clean filename, and update every reference (markdown + source code) so the canonical backend contract has one obvious location and one obvious name.

## 2. Current repository state

Three YAML files at root, all untracked:

| File | Version (per `info.version`) | Modified | Size | Status |
|---|---|---|---|---|
| `gateway (5).yaml` | 0.0.1 | Apr 27 | 69 KB | Canonical (per CLAUDE.md and user) |
| `gateway_new.yaml` | 0.2.0 | Apr 27 | 44 KB | Outdated draft |
| `gateway.yaml` | 0.1.0 | Apr 17 | 34 KB | Oldest draft |

Note: version numbers in the files are confusing (0.2.0 > 0.0.1 numerically), but the canonical pick is `gateway (5).yaml` per file size, modification recency, and existing CLAUDE.md/AGENTS.md text.

## 3. Relevant files inspected

- 3 YAML files (versions, sizes, mtime).
- `git ls-files gateway*` — all untracked.
- 18+ references to "gateway" patterns across CLAUDE.md, AGENTS.md, README.md, docs/backend-gaps.md, .claude/settings.local.json, and source code (types.ts, fixtures.ts, api.ts, auth.tsx, TaskNewScreen.tsx, mock-badge.tsx).
- Two source comments (`types.ts:1`, `fixtures.ts:1`) reference the oldest `gateway.yaml` (no parentheses) — pre-existing inconsistency, will fix.

## 4. Assumptions and uncertainties

- `gateway (5).yaml` is canonical. Confirmed by CLAUDE.md text + user statement + file size/recency.
- Renaming target: `docs/gateway.yaml` — clean, removes the parenthesized-number artifact, no collision since the old `gateway.yaml` is deleted in this same pass.
- `.claude/settings.local.json` line 43 contains a historical command permission referencing the old YAMLs — left as-is (it's a permission record; deleting the files just makes that permission unused, not broken).
- Historical agent-plan files in `docs/agent-plans/` (the 1545 plan flagged the gateway_latest issue) — not edited; they're records.

## 5. Proposed approach

1. Move `gateway (5).yaml` → `docs/gateway.yaml`.
2. Delete `gateway_new.yaml` and `gateway.yaml`.
3. Update all references using replace_all where mechanical:
   - `gateway (5).yaml` → `docs/gateway.yaml`
   - `gateway.yaml` (bare, in source comments) → `docs/gateway.yaml`
4. Strengthen wording in CLAUDE.md/AGENTS.md/README.md: explicitly call it the "single source of truth — sync against this file when backend behavior is in question".
5. Drop the no-longer-true sentence about `gateway_latest.yaml` / `gateway_new.yaml` / older specs being kept "for diffing".
6. Verify: grep, lint, build.

## 6. Risks and trade-offs

- Deleting untracked YAMLs is irreversible (no git history). User confirmed.
- Risk of an outdated source-code comment still pointing at old name: mitigated by full grep.
- Renaming `gateway (5).yaml` removes a "(5)" identifier that hinted at iteration count — that information is lost, but it was never useful documentation.

## 7. Step-by-step implementation plan

### 7.1 Move + delete

```bash
mv "gateway (5).yaml" docs/gateway.yaml
rm gateway_new.yaml
# (note: previous local 'gateway.yaml' was the old v0.1 file at root,
#  not the new docs/gateway.yaml — they're in different directories)
rm gateway.yaml
```

### 7.2 Update references — markdown

CLAUDE.md (2 lines):
- L145: replace the whole "Canonical spec: ..." sentence with a stronger one-liner pointing at `docs/gateway.yaml` and explicitly framing it as the source of truth. Drop mentions of deleted files.
- L216: `gateway (5).yaml` → `docs/gateway.yaml`.

AGENTS.md (2 lines): mirror of CLAUDE.md.

README.md L48: `gateway (5).yaml` → `docs/gateway.yaml`.

docs/backend-gaps.md L7: `gateway (5).yaml` → `docs/gateway.yaml`.

### 7.3 Update references — source code

Use `replace_all` per file for `gateway (5).yaml` → `docs/gateway.yaml`:
- `src/prototype/lib/types.ts` (5 occurrences)
- `src/prototype/lib/fixtures.ts` (3 occurrences)
- `src/prototype/lib/api.ts` (10 occurrences)
- `src/prototype/auth.tsx` (2 occurrences)
- `src/prototype/screens/TaskNewScreen.tsx` (1 occurrence)
- `src/prototype/components/common/mock-badge.tsx` (1 occurrence)

Also fix two stale comments referencing bare `gateway.yaml`:
- `src/prototype/lib/types.ts` L1: `gateway.yaml` → `docs/gateway.yaml`
- `src/prototype/lib/fixtures.ts` L1: `gateway.yaml` → `docs/gateway.yaml`

### 7.4 Verify

- `Test-Path "gateway (5).yaml"` / `gateway.yaml` / `gateway_new.yaml` at root → all False
- `Test-Path docs/gateway.yaml` → True
- grep `gateway \(5\)\.yaml|gateway_new|gateway_latest` repo-wide (excluding `docs/agent-plans/` and `.claude/settings.local.json`) → 0 hits
- grep `docs/gateway.yaml` → ~22 hits across docs + source
- `npm run lint` clean
- `npm run build` clean

## 8. Verification checklist

- [ ] All 3 root YAMLs gone; `docs/gateway.yaml` exists
- [ ] No live reference to old names (excluding agent-plans + local settings)
- [ ] Lint + build clean
- [ ] CLAUDE.md, AGENTS.md, README.md prominently identify `docs/gateway.yaml` as the canonical backend contract

## 9. Browser testing instructions for the user

No browser check needed — only docs and code comments changed. Build and lint cover correctness. If you want extra confidence, open `http://localhost:5173/#/`, log in, and confirm the dashboard renders.

## 10. Progress log

- 2026-04-29 16:00: Inventory completed. User confirmed `gateway (5).yaml` is canonical.
- 2026-04-29 16:00: Plan created.
