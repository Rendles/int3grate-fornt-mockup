# Backend spec refresh — 0.1.0 → 0.3.0

> Author: Claude
> Date: 2026-05-13
> Status: spec pulled & saved; UI implications NOT yet acted on

## TL;DR

The live backend has moved from `0.1.0` (our pull dated 2026-05-01) to `0.3.0` (today, 2026-05-13). Two minor versions in twelve days — **all changes are additive** per the upstream changelog. The most important deltas for the frontend:

| Was missing per `docs/backend-gaps.md` | Status now | Impact |
|---|---|---|
| `GET /users`, `GET /users/{id}` | ✅ exists (0.3.0) | Real owner/approver names available. Several "name removed" UI surfaces can be restored. |
| `PATCH /agents/{id}` (metadata) | ✅ exists (0.3.0) | Editing agent name/description/owner now real. |
| `PATCH /agents/{id}/status` (Pause/Fire) | ✅ exists (0.3.0) — statuses: `draft / active / paused / archived` | Settings → "Manage employment" surface can be restored. |
| `GET /agents/{id}/versions` (list) | ✅ exists (0.3.0) | Version history listing now real. |
| `GET /agents/{id}/versions/{vid}` (single) | ✅ exists (0.3.0) | Deep-link to a version now real. |
| `GET /runs` (paginated listing) | ✅ exists (0.3.0) | `/activity` no longer dependent on a synthetic union. |
| `/internal/*` paths in our local spec | ➖ moved to a separate spec (0.2.1) | Frontend never used these — clean-up only. |
| `GET /approvals/{id}` | already existed | Stale claim in `docs/backend-gaps.md` § 1.X — was already in 0.1.0 spec under `getApproval`. Worth re-checking. |
| `POST /auth/register`, workspace CRUD, integrations registry | ❌ still absent | No movement; UI continues to hide these. |
| `GET /tasks/*` | ❌ still absent | Confirmed dropped permanently. UI already removed. |

Two **semantic** changes worth flagging — these are not new endpoints, they reshape existing flows:

1. **Polymorphic approvals (ADR-0011, 0.2.0).** `ApprovalRequest.run_id` is now nullable; new nullable `chat_id` field. Exactly one is set per row. Mocks and UI assume `run_id` is always present — needs fixing.
2. **Chat suspension during approval (ADR-0011, 0.2.0).** New chat status `awaiting_approval`. New SSE event `event:"suspended"` emitted mid-turn when a tool needs approval. `ApprovalDecisionAccepted.status` enum widened `[queued] → [queued, recorded]`. Our mock streamer doesn't model this.

Also a CLAUDE.md doc fix surfaced during this refresh:

- The URL in CLAUDE.md and in the old `gateway.yaml` header is **wrong** — it says `stage.api.int3grate.ai` but the live host is `api.stage.int3grate.ai`. Fixed in the new `docs/gateway.yaml` header; CLAUDE.md still has the wrong URL in two places and should be patched.

---

## What changed in the repo

| File | Action |
|---|---|
| `docs/gateway.yaml` | Replaced with live `0.3.0` content + refreshed comment header. |
| `docs/shared/approval-request.yaml` | **New** — the live spec now `$ref`s an external file for the shared ApprovalRequest schema (per 0.2.1 split). Pulled from `https://api.stage.int3grate.ai/docs/shared/approval-request.yaml`. |
| `docs/gateway-legacy-2026-04.yaml` | Untouched. Still preserved for historical diff. |

CLAUDE.md, `docs/backend-gaps.md`, the mock api layer (`src/prototype/lib/api.ts`), and `src/prototype/lib/types.ts` are **not yet updated** — they need follow-up. See § Action items at the bottom.

---

## Version history (from `info.x-changelog` in the new spec)

```
0.3.0  2026-05-03  Full UI-control surface. New public endpoints:
                   GET /users, GET /users/{userId};
                   PATCH /agents/{agentId} (metadata),
                   PATCH /agents/{agentId}/status (lifecycle),
                   GET /agents/{agentId}/versions (list),
                   GET /agents/{agentId}/versions/{versionId} (detail),
                   GET /runs (paginated list).
                   New schemas: AgentVersionList, PatchAgentRequest,
                   PatchAgentStatusRequest, UserList.
                   All changes additive.

0.2.1  2026-05-02  Split internal service-to-service surface out into a
                   separate `gateway-internal.yaml` spec. Five
                   `/internal/*` paths + their internal-only schemas
                   (CreateApprovalInternalRequest, GrantsSnapshot,
                   AgentVersionRef, ToolGrantCheck, OutboxPendingRow,
                   OutboxPendingList) moved verbatim. Shared
                   ApprovalRequest schema extracted to
                   `shared/approval-request.yaml` and `$ref`-d from
                   both specs. No public-API behavior change.

0.2.0  2026-05-02  Chat-side approval support (ADR-0011). Polymorphic
                   approval_requests (run_id|chat_id), `awaiting_approval`
                   chat status, suspended SSE event,
                   ApprovalDecisionAccepted enum widened to
                   [queued, recorded]. All changes additive.

0.1.0  2026-04-21  Initial spec.
```

---

## Endpoint diff

### Added (public)

| Endpoint | Operation | Notes |
|---|---|---|
| `GET /users` | `listUsers` | Tenant-scoped. Requires `admin` or `domain_admin` role. Paginated. |
| `GET /users/{userId}` | `getUser` | Single tenant user lookup. |
| `PATCH /agents/{agentId}` | `patchAgent` | Optional `name`, `description`, `domain_id`, `owner_user_id`. True PATCH (absent = unchanged). |
| `PATCH /agents/{agentId}/status` | `patchAgentStatus` | `status` enum: `draft / active / paused / archived`. |
| `GET /agents/{agentId}/versions` | `listAgentVersions` | Paginated. |
| `GET /agents/{agentId}/versions/{versionId}` | `getAgentVersion` | Single version detail. |
| `GET /runs` | `listRuns` | Tenant-scoped. Optional `?status=` filter (RunStatus enum). Paginated. |

### Removed from this spec (moved to internal-only)

All five `/internal/*` paths are gone from the public spec and live in a separate `gateway-internal.yaml` (not served via `/docs`, not for frontend consumption):

- `POST /internal/approvals` (`createApprovalInternal`)
- `GET /internal/agent-versions/{versionId}` (`getAgentVersionInternal`)
- `POST /internal/tool-grants/check` (`checkToolGrantInternal`)
- `GET /internal/agents/{agentId}/grants/snapshot` (`getGrantsSnapshotInternal`)
- `GET /internal/outbox/pending` (`listOutboxPendingInternal`)

The frontend never called these, but the mock `api.ts` still has `getGrantsSnapshot()` exposed (per CLAUDE.md "kept for a possible future internal-tools UI"). Functionally fine; the only doc lie is that this method is now in a separate spec.

---

## Schema diff

### Added (public)

- `AgentVersionList` — paginated wrapper for `listAgentVersions`.
- `PatchAgentRequest` — fields: `name`, `description`, `domain_id`, `owner_user_id`. All optional, ≥ 1 must be provided.
- `PatchAgentStatusRequest` — single required field `status: enum [draft, active, paused, archived]`.
- `UserId` — UUID type alias (formerly inlined).
- `UserList` — paginated wrapper for `listUsers`.

### Removed from this spec (moved to internal)

- `AgentVersionRef`, `CreateApprovalInternalRequest`, `GrantsSnapshot`, `OutboxPendingList`, `OutboxPendingRow`, `ToolGrantCheck`.

### Externalised via `$ref`

- `ApprovalRequest` — now `$ref: "./shared/approval-request.yaml"` (file lives at `docs/shared/approval-request.yaml`).
- `ApprovalStatus` is no longer its own schema; the enum is inlined inside `ApprovalRequest.status` in the shared file as `enum: [pending, approved, rejected, expired, cancelled]` (same five values as before).

### Modified

- **`ApprovalRequest`** (0.2.0):
  - `run_id` is now **nullable** (was required & non-nullable).
  - New nullable field `chat_id`.
  - Mutually exclusive: exactly one of `run_id` / `chat_id` is set per row. Enforced by both the gateway service layer and a `approval_requests_one_surface` CHECK constraint.
- **`Chat.status`** (0.2.0): enum extended with `awaiting_approval`. Now `[active, closed, failed, awaiting_approval]`.
- **`ApprovalDecisionAccepted.status`** (0.2.0): enum widened from `[queued]` to `[queued, recorded]`. `queued` is returned for chat-source approvals (async resume on outbox); `recorded` for run-source decisions where the gateway has already persisted the decision and won't queue anything else.

### New SSE frame on `POST /chat/{chatId}/message`

When a tool call hits an approval gate mid-turn, the stream now emits a final `event:"suspended"` frame and ends, plus flips the chat to `awaiting_approval`:

```
data: {"event":"suspended","approval_id":"<uuid>","tool":"<name>","tool_call_id":"<id>"}
```

The endpoint also returns `409` if you call it while the chat is already `awaiting_approval`.

Resume flow (client responsibility):
1. Poll `GET /approvals/{approvalId}` for resolved decision.
2. Poll `GET /chat/{chatId}/messages?after=<last_seen>` for the resumed turn.

---

## Cross-reference: what this closes in `docs/backend-gaps.md`

CLAUDE.md "Key gaps (validated against live spec 2026-05-01)" and `docs/backend-gaps.md` need updates. Specific entries that became stale today:

| Gap entry | Status after refresh |
|---|---|
| "`POST /auth/register` — absent. UI hidden." | Still absent. No change. |
| "`GET /users` — absent. UI uses `requested_by_name`..." | ✅ Now exists. UI can re-introduce user lookups. Note: spec's `ApprovalRequest` still does NOT carry `requested_by_name` — frontend must call `GET /users/{userId}` (or batch via `GET /users`) to render names. |
| "`GET /approvals/{id}` — absent (deep-link single-fetch)." | Stale claim. `getApproval` was in 0.1.0 already. Verify and remove from gap list. |
| "`/tasks/*` — absent." | Still absent. UI already removed. |
| "Integration registry / OAuth flow (`/integrations/*`)." | Still absent, still architecturally out-of-scope. |
| "`PATCH /agents/{id}` (Pause/Fire) — absent." | ✅ Now exists. `PATCH /agents/{id}` for metadata; `PATCH /agents/{id}/status` for lifecycle (`draft / active / paused / archived`). |
| "Workspace CRUD + membership endpoints — absent." | Still absent. UI continues mock-only flow. |
| "Per-week spend buckets..." | Unchanged — still client-side split. |
| "Activity sentence summaries..." | Unchanged. |
| "Naming mismatch: tool catalog endpoint is `/tool-catalog` in live..." | Unchanged. Mock still hits `/tools`. |
| "`AgentVersion.*_config` shapes — speculated fields removed." | Unchanged. |
| "`GET /internal/agents/{id}/grants/snapshot` is `x-internal: true`." | Now lives in a separate `gateway-internal.yaml` spec entirely. Still `x-internal`; still not for frontend. |

---

## CLAUDE.md doc fix (URL typo)

Two places in `CLAUDE.md` (and the old `gateway.yaml` header that we just replaced) reference the wrong host:

- Says: `https://stage.api.int3grate.ai/docs/openapi.yaml`
- Actual: `https://api.stage.int3grate.ai/docs/openapi.yaml`

The new `docs/gateway.yaml` header uses the corrected URL. CLAUDE.md still needs patching (search & replace `stage.api.int3grate.ai` → `api.stage.int3grate.ai`).

---

## Action items (not done in this refresh — decisions for the owner)

1. **Update `CLAUDE.md`** — fix the two URL typos.
2. **Update `docs/backend-gaps.md`** — strike the entries closed by 0.3.0; verify the `GET /approvals/{id}` claim; flag the polymorphic approval reshape as a new entry.
3. **Mock layer (`src/prototype/lib/api.ts`)** — extend mocks for the new endpoints if/when the UI wants to use them:
   - `listUsers` / `getUser`
   - `patchAgent` / `patchAgentStatus`
   - `listAgentVersions` / `getAgentVersion`
   - `listRuns`
4. **Mock types (`src/prototype/lib/types.ts`)** — extend:
   - `Chat.status` add `'awaiting_approval'`.
   - `ApprovalRequest.run_id` → nullable; add `chat_id`.
   - `ApprovalDecisionAccepted.status` → `'queued' | 'recorded'`.
   - Add `PatchAgentRequest`, `PatchAgentStatusRequest`, `UserList`, `AgentVersionList`.
   - Add `ChatStreamFrame` variant for `event:"suspended"`.
5. **Decision on UI restoration** — several previously-hidden surfaces are now backend-real:
   - Settings → "Manage employment" (Pause / Resume / Archive) → `PATCH /agents/{id}/status`.
   - Agent rename / re-owner via Settings → `PATCH /agents/{id}`.
   - User names on approver / owner / version-author fields → `GET /users/{id}`.
   - These were removed in the 2026-05-01 cleanup specifically because the endpoints didn't exist. Worth a product-side conversation before restoring.
6. **Chat-side approvals** — the polymorphic approval reshape (0.2.0) is the biggest semantic change. Today's mock UI assumes every approval is `run_id`-anchored. If chat-side approvals are in the product roadmap, the mock streamer needs the `suspended` event and the approval-list needs to handle `chat_id`-only rows.
