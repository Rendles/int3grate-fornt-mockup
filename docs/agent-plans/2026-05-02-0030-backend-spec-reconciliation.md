# Backend spec reconciliation — drop stale workarounds, sync gap docs

Status: **Done — all 7 steps completed; lint + build clean.**

## Context

`docs/gateway.yaml` was replaced 2026-05-01 with the verbatim live stage spec
(`https://stage.api.int3grate.ai/docs/openapi.yaml`, OpenAPI 3.2.0,
version 0.1.0). Several of our previously-flagged "gaps" turned out to
be present in the live backend (notably `GET /approvals/{id}`); a few
others are confirmed missing AND are now confirmed not even planned
(no `x-mvp-deferred` placeholders for tasks/tenants/integrations).

This plan does three things, in order:

1. **Drop the approval-fetch workaround** in `lib/api.ts` — backend gives
   us the endpoint directly, our cache + sequential list sweep is overhead.
2. **Reconcile gap-docs** with live spec — kill stale entries, validate
   remaining ones, change Tasks status from "x-mvp-deferred" → "absent".
3. **Document the `/tools` → `/tool-catalog` naming mismatch** for the
   eventual mock-to-real http swap. Don't rename code yet — premature
   while everything is still mock.

## Sign-off decisions (recorded 2026-05-01, awaiting confirmation)

- **D-1 (workaround removal scope):** delete the `approvalCache` Map,
  `cacheApprovals` helper, and `APPROVAL_STATUSES_TO_TRY` constant from
  `lib/api.ts`. Simplify `getApproval(id)` back to a direct lookup.
  Drop the `opts: { fresh?: boolean }` parameter — it only existed to
  bypass the cache that's going away.
- **D-2 (callers cleanup):** remove `{ fresh: true }` from the two
  `getApproval` call-sites in `ApprovalDetailScreen.tsx`. They become
  plain `api.getApproval(approvalId)`.
- **D-3 (docs reconciliation scope):** touch only what's verifiably
  wrong vs live spec. Specifically:
  - `backend-gaps.md` § 1.3 — delete (workaround stub for an endpoint
    that exists)
  - `backend-gaps.md` Tasks-related entries — re-categorize from
    "x-mvp-deferred backend" to "absent from live spec entirely"
  - `backend-gaps.md` footer "Last updated" — refresh
  - `handoff-prep.md` § 1.3 — close as resolved
  - `CLAUDE.md` "Key gaps" list (line 149-157) — drop the
    `GET /approvals/{id}` line, mark Pause/Fire and per-week-spend
    items as "UI removed", refresh the rest
- **D-4 (tool catalog naming):** Frontend keeps `api.listTools()`
  method name (rename is premature while still mock). Add a one-line
  note in `backend-gaps.md` (new section "5. Naming mismatches")
  flagging that the real path is `/tool-catalog` not `/tools`. The
  swap to real http client will need to update the URL string at the
  `lib/api.ts` boundary.
- **Out of scope (this plan):**
  - Full `backend-gaps.md` rewrite — surgical edits only
  - Removing Tasks subtree from UI (separate decision; deep-link from
    approval chip stays)
  - Touching `gateway-legacy-2026-04.yaml` (kept untouched as archive)

## 1. Task summary

The recent canonicalization of `gateway.yaml` revealed that some of our
defensive frontend code (approval-fetch cache + sweep) is now obsolete,
and several lines of gap documentation are misleading. This plan tightens
the codebase to match what the backend actually does — no more, no less.

## 2. Current repository state

- Branch: `shuklin/ux-redesign`. Working tree has uncommitted Costs
  rewrite + dashboard-mock hides + Activity rewrite + canonical-yaml
  swap on top of the prior session work.
- `docs/gateway.yaml` — synced with live (verified earlier today).
- `docs/gateway-legacy-2026-04.yaml` — archived old draft.
- `lib/api.ts` lines ~67-87 contain the approval cache helpers.
- `lib/api.ts` lines ~552-587 contain the rewritten `getApproval` /
  `listApprovals`.
- `lib/api.ts` `decideApproval` line ~668 contains the cache invalidate.
- `screens/ApprovalDetailScreen.tsx` calls `api.getApproval(id, { fresh: true })`
  in two places — `tickApproval` polling and `doDecide` optimistic check.
- `docs/backend-gaps.md` § 1.3 = REMOVED stub from earlier hide
  (created when we added the workaround).
- `docs/handoff-prep.md` § 1.3 = "frontend workaround in place" entry
  added earlier today.
- `CLAUDE.md` line 153 = `GET /approvals/{id} — missing`.

## 3. Files inspected

- `docs/gateway.yaml` — verified `getApproval` operationId at
  `GET /approvals/{approvalId}` (real, not deferred)
- `docs/gateway.yaml` — verified `tool-catalog` path + `listToolCatalog`
  operationId
- `docs/gateway.yaml` — verified ABSENCE of `/tasks/*`, `/auth/register`,
  `/users`, `/tenants/*`, `/integrations/*`, `PATCH /agents/{id}`
- `src/prototype/lib/api.ts` — current cache+sweep implementation
- `src/prototype/screens/ApprovalDetailScreen.tsx` — current `{ fresh: true }`
  call-sites (lines 76 and 156 approx)
- `docs/backend-gaps.md` — entries that need surgical edits
- `docs/handoff-prep.md` § 1.3 — to be closed
- `CLAUDE.md` Key gaps list (line 149-157)

## 4. Assumptions and uncertainties

### Assumptions

- Removing the cache means polling in `ApprovalDetailScreen` makes a
  fresh `GET /approvals/{id}` every tick (~800ms). Network-wise that's
  one request per second per open approval-detail tab — acceptable
  during the brief async-resume window (~8-15s).
- Mock `getApproval` returns synchronous fixture lookup, so removing
  the cache doesn't change behaviour in the prototype. The cache only
  ever helped the now-irrelevant case of "no single-fetch endpoint".
- The legacy yaml file (`gateway-legacy-2026-04.yaml`) stays as-is —
  no further action this plan.

### Uncertainties to verify in Step 1

- Whether `approvalCache` is referenced anywhere outside `lib/api.ts`
  (export check). Expected: no.
- Whether the `{ fresh: true }` literal appears elsewhere (other screens).
  Expected: only the two ApprovalDetailScreen sites.
- Whether `/tool-catalog` path appears anywhere in the codebase right
  now. Expected: no — we mock against `/tools` internally, the path
  is only relevant at swap time.

## 5. Proposed approach

Surgical edits in three buckets:

1. **Code (`lib/api.ts` + `ApprovalDetailScreen.tsx`):**
   - Delete the cache module-level state and helpers
   - Simplify `getApproval(id)` to direct fixture lookup (mock) —
     no opts parameter
   - `listApprovals` — drop the cache-populate side-effect
   - `decideApproval` — drop the invalidate line
   - Update both `ApprovalDetailScreen` call-sites to drop `{ fresh: true }`

2. **Docs (3 files):**
   - `backend-gaps.md`:
     - § 1.3 stub → delete entirely (no longer a gap)
     - Tasks-related entries (any that say "x-mvp-deferred") →
       re-frame as "absent from live spec"
     - Add new short § 5 "Naming mismatches" with the
       `/tools` ↔ `/tool-catalog` note
     - Refresh "Last updated" footer
   - `handoff-prep.md`:
     - § 1.3 → close as "✅ resolved — backend has the endpoint, see
       gateway.yaml"
     - Append decision-log entry referencing this plan
   - `CLAUDE.md`:
     - Line 153 (`GET /approvals/{id} — missing`) → drop
     - Pause/Fire and per-week-spend bullets → annotate "UI removed"
     - Activity sentence summaries bullet → remove (helper deleted
       earlier this session)

3. **No code rename for `/tool-catalog`** — only documented.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Removing cache breaks polling in mock — getApproval returns stale fixture reference and never sees decideApproval mutation. | Mock fxApprovals mutations are in-place (same object refs). Direct .find() returns the live reference, so polling sees real state. Verified by re-reading decideApproval mutation pattern. |
| `{ fresh: true }` removal might leave unused imports or dead branches. | TypeScript build catches unused. Verify with build. |
| Stale CLAUDE.md "Key gaps" list confuses future agents. | That's exactly why we're updating it — the inverse risk is bigger. |
| Aggressive doc edits might lose nuance someone needed. | Surgical — only rewrite verifiably-wrong lines. Keep tone, structure. The legacy yaml archive preserves the old plans. |

## 7. Step-by-step plan

### Step 1 — Verify assumptions

- Grep for `approvalCache`, `cacheApprovals`, `APPROVAL_STATUSES_TO_TRY`
  outside `lib/api.ts`. Expect zero hits.
- Grep for `{ fresh: true }` in `src/prototype/`. Expect 2 hits, both
  in `ApprovalDetailScreen.tsx`.
- Grep for `/tool-catalog` in `src/prototype/`. Expect 0 hits.

**Report:** confirm assumptions, no surprises.

### Step 2 — Strip approval cache from `lib/api.ts`

- Delete `approvalCache` Map declaration + 11-line block-comment
- Delete `APPROVAL_STATUSES_TO_TRY` const
- Delete `cacheApprovals` helper function
- `listApprovals`: remove the `if (!scenario) cacheApprovals(page.items)`
  line; revert to `return paginate(list, filter)`
- `getApproval(id, opts?)`: simplify to original direct lookup —
  fixture or scenario `.find(a => a.id === id)`. Drop `opts` param.
  Return type stays `Promise<ApprovalRequest | undefined>`.
- `decideApproval`: drop the `approvalCache.delete(id)` line + comment

After: lint + build clean.

### Step 3 — Drop `{ fresh: true }` from `ApprovalDetailScreen.tsx`

- Two call-sites become `api.getApproval(approvalId)` — bare.

After: lint + build clean. No behaviour change visible on resolved
approvals; polling on pending approvals still works (mock mutates
fixture in place).

### Step 4 — `CLAUDE.md` Key gaps list update

- Drop the `GET /approvals/{id}` line entirely
- Annotate `Per-week spend buckets` line: "UI removed in Costs rewrite"
- Annotate `Activity sentence summaries` line: "UI removed; row title
  is now `{agent} · {status}`"
- Annotate `Pause / Fire agent` line: "UI removed; `Manage employment`
  card hidden"
- Other lines (auth/register, /users, integration registry) — keep,
  validated against live

### Step 5 — `backend-gaps.md` reconciliation

- Delete § 1.3 stub (the `~~Integration registry~~` style stub from
  earlier today; the entry no longer reflects reality)
- Find Tasks-related entries — re-frame status from "x-mvp-deferred"
  to "absent in live spec, deferred indefinitely"
- Add new minimal § 5 "Naming mismatches":
  - `/tool-catalog` (live) vs `/tools` (mock api.ts) — naming swap
    needed at production http boundary
- Update "Last updated" footer

### Step 6 — `handoff-prep.md` reconciliation

- § 1.3 → close: status change from "🚨 → ⚠️ workaround" to
  "✅ resolved — endpoint exists in live spec"
- Append decision-log entry summarising this plan

### Step 7 — Lint + build + final summary

- `npm run lint` clean
- `npm run build` clean
- Verify bundle size (expect ~−1 kB from removed cache helpers)

## 8. Verification checklist

- [ ] `lib/api.ts` no longer imports / declares `approvalCache`
- [ ] `getApproval` signature is `(id: string) => Promise<ApprovalRequest | undefined>`
- [ ] `ApprovalDetailScreen.tsx` has no `{ fresh: true }` literals
- [ ] Polling on pending approval still flips status (open in two tabs,
      decide in one, watch the other)
- [ ] Conflict banner still works (decide simultaneously)
- [ ] `CLAUDE.md` Key gaps list no longer mentions `GET /approvals/{id}`
- [ ] `backend-gaps.md` § 1.3 stub gone
- [ ] `backend-gaps.md` § 5 (new) documents `/tool-catalog` rename
- [ ] `handoff-prep.md` § 1.3 closed as resolved
- [ ] `npm run lint` clean
- [ ] `npm run build` clean

## 9. Browser test for the user

After Step 7:

1. Log in as `frontend@int3grate.ai`.
2. **Approvals → pending row → click in.** Page loads (cache-miss path
   no longer exists, but mock direct lookup is instant).
3. **Hit approve.** Resume banner queued → resolved → terminal. Polling
   uses bare `getApproval` — should still see the status flip.
4. **Open same approval in a second tab.** Decide in tab A, watch tab B
   detect conflict. Conflict banner appears (timestamp only — no name,
   that was already done earlier today).
5. **Refresh /approvals/:id directly (deep-link).** Page loads.
6. Sanity-check `/activity` and `/costs` aren't affected (they shouldn't
   be — touched no shared code).

## 10. Progress log

- 2026-05-02 00:30 — plan drafted; awaiting confirmation before Step 1.
- 2026-05-02 — All 7 steps done. Step 1 verified zero references outside expected files. Step 2 stripped approvalCache + APPROVAL_STATUSES_TO_TRY + cacheApprovals + opts param in `lib/api.ts` (~50 LOC removed). Step 3 cleaned 2 `{ fresh: true }` callers in `ApprovalDetailScreen.tsx`. Step 4 reconciled `CLAUDE.md` Key gaps list against live spec. Step 5 surgical edits to `backend-gaps.md`: § 1.3 → resolved-stub, new § 5 (naming mismatches), new § 6 (Tasks absent in live spec), priority table + footer refreshed. Step 6 updated `handoff-prep.md` § 1.3 → ✅ RESOLVED + decision log entry. Step 7 lint + build clean; bundle 611.67 kB (значительный drop от Vite оптимизации после dead-code removal).
