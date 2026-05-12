# Page-level workspace filters — pivot from global multi-scope

**Date:** 2026-05-08 00:30
**Type:** implementation plan, follows decision in chat
**Status:** active

---

## 1. Task summary

Pivot from "global multi-select switcher controls every screen" to a cleaner model:

- **WorkspaceSwitcher** → reverts to single-active. "Where I'm working today." Drives hire, default home.
- **Per-page workspace filter** → new chip row on list screens (`/agents`, `/activity`, `/approvals`, `/costs`). Multi-select. Defaults to `[activeWorkspaceId]` per-page session. Doesn't touch global state.
- **Sidebar approval badge** → counts ALL pending across user's memberships, independent of scope.

Rationale: `Linear/Notion/GitHub`-style — global context is single, list views have their own filters. Solves the "I want to compare 2 teams' agents without flipping global" complaint without making every screen ambiguous about "where is my new hire going".

---

## 2. Decisions confirmed in chat

| # | Question | Choice |
|---|---|---|
| 1 | Approach | Option B — single switcher + per-page filter |
| 2 | Page filter UI placement | Under PageHeader, near existing filters, low visual weight |
| 3 | Sidebar approval badge | Counts ALL workspaces (independent of scope) |
| 4 | Page filter persistence | Per-visit only (resets on navigate away/back) |

---

## 3. Architecture

### State model
- `auth.tsx` AuthValue:
  - `activeWorkspaceId: string | null` (single, replaces `selectedWorkspaceIds: string[]`)
  - `setActiveWorkspace(id: string): void` (replaces `setSelectedWorkspaces`)
  - `myWorkspaces: Workspace[]` stays
  - Drop: `isMultiSelectMode`, `isAllSelected`, `selectedWorkspaceIds`, `currentWorkspaceId` (legacy convenience)
- `workspace-context.ts` singleton:
  - Tracks BOTH `activeWorkspaceId` and `allUserWorkspaceIds` (memberships).
  - Exports `getActiveWorkspaceId`, `getAllUserWorkspaceIds`, setters.
  - Both written by AuthProvider on session changes.
- `StoredSession`:
  - `activeWorkspaceId?: string` (replaces `selectedWorkspaceIds?: string[]`).
  - Migration: if old `selectedWorkspaceIds` exists, take the first id as active.

### API filter cascade
- `inSelectedWorkspaces(agentId, workspaceIds?: string[])`:
  - If `workspaceIds` provided AND non-empty → filter on those (intersected with user's memberships).
  - If `workspaceIds` undefined OR empty → fall back to ALL user's memberships ("no filter" = "show everything in your visible scope").
  - Same null-id defensive guards as today.
- Every list method accepts optional `workspace_ids?: string[]`:
  - `listAgents({ workspace_ids? })`
  - `listRuns({ workspace_ids? })`
  - `listApprovals({ workspace_ids? })`
  - `listAudit({ workspace_ids? })`
  - `listChats({ workspace_ids? })`
  - `listHandoffs({ workspace_ids? })`
  - `getSpend({ workspace_ids? })`
- `createAgent` auto-pin → active workspace (single, predictable).
- `getAgentWorkspaceMap` stays (used by Costs by-workspace breakdown).

### Page filter primitive
- New `components/common/workspace-filter.tsx`:
  - Props: `value: string[]`, `onChange: (next: string[]) => void`, optional `availableIds?: string[]` to constrain (defaults to user's memberships).
  - Renders a chip row: pill-style buttons for each workspace + an "All workspaces" master pill.
  - Clicking a chip toggles it. "All" = check everything. Last-checked sticky no-op (same rule as before).
  - Visual: low weight — sits in the same area as existing status/range filters.
  - Hidden if user has 0 or 1 workspace (nothing meaningful to filter).

### Per-screen state
- `useState<string[]>(() => activeWorkspaceId ? [activeWorkspaceId] : [])` on mount.
- Resets on remount (navigate away/back). No localStorage.
- Pass to api list call as `workspace_ids: filter`.

### Sidebar approval badge
- Calls `api.listApprovals({ status: 'pending' })` WITHOUT `workspace_ids`.
- → all pending across user's memberships.

---

## 4. Files to be touched

```
src/prototype/lib/workspace-context.ts            — singleton: id + memberships
src/prototype/auth.tsx                            — single active model
src/prototype/lib/api.ts                          — workspace_ids param on list methods
src/prototype/components/workspace-switcher.tsx   — revert to radio
src/prototype/components/workspace-remount.tsx    — key on activeWorkspaceId
src/prototype/components/workspace-form-dialog.tsx — no changes
src/prototype/components/common/workspace-filter.tsx — new
src/prototype/components/common.tsx               — barrel export
src/prototype/components/common/workspace-context-pill.tsx — show prop
src/prototype/screens/AgentsScreen.tsx            — page filter + listAgents wiring
src/prototype/screens/RunsScreen.tsx              — page filter + listRuns wiring
src/prototype/screens/ApprovalsScreen.tsx         — page filter + listApprovals wiring
src/prototype/screens/SpendScreen.tsx             — page filter + getSpend wiring + by-workspace card
src/prototype/screens/AgentNewScreen.tsx          — drop Custom workspace dropdown (active is unambiguous)
src/prototype/screens/sandbox/TeamMapScreen.tsx   — drop multi-mode fallback
src/prototype/screens/WorkspacesScreen.tsx        — Focus → Switch (single semantic)
src/prototype/components/shell.tsx                — sidebar badge: drop workspace scope
docs/backend-gaps.md                              — § 1.15 update (workspace_ids on list endpoints)
```

---

## 5. Phased plan

### Phase F1 — Foundation revert (atomic)

All changes that flip the model from multi-active to single-active + memberships. Atomic because they're tightly coupled.

- `workspace-context.ts`: two singletons (active id + user memberships).
- `auth.tsx`: rename state, expose `activeWorkspaceId` + `setActiveWorkspace`. Storage migration. Singleton sync.
- `workspace-switcher.tsx`: revert to single radio. Trigger label shows the active workspace name. "All workspaces" master toggle removed.
- `workspace-remount.tsx`: key on activeWorkspaceId.
- `WorkspacesScreen`: Focus button → Switch. "In scope" badge → "Active".
- `AgentNewScreen`: drop Custom workspace dropdown (use active).
- `TeamMapScreen`: drop multi-mode fallback (always shows active's graph).

**Verify**: build clean (api.ts will fail if it references dropped properties — fixed in F2).

### Phase F2 — API workspace_ids parameter

- `inSelectedWorkspaces(agentId, ids?)`: dual contract (provided vs default-all).
- Every list method gains `workspace_ids?: string[]` filter param.
- `createAgent` auto-pin to active.
- `getAllUserWorkspaceIds` singleton wired.

**Verify**: build clean; existing screens keep working (their api calls without `workspace_ids` get the "all memberships" filter, which is permissive — broader than before).

### Phase F3 — `<WorkspaceFilter>` primitive

- Component: chip row with master "All" + per-workspace chips.
- Hidden when user has ≤1 workspace.
- Last-checked sticky.
- Export through `common.tsx` barrel.

### Phase F4 — Wire screens to page filter

For each list screen:
- Add `[workspaceFilter, setWorkspaceFilter] = useState<string[]>(() => activeWorkspaceId ? [activeWorkspaceId] : [])`.
- Render `<WorkspaceFilter value={workspaceFilter} onChange={setWorkspaceFilter} />` near existing filters.
- Pass `workspace_ids: workspaceFilter` to all api list calls in this screen.
- Re-fetch on filter change (effect dep).

Screens:
- F4a — AgentsScreen
- F4b — RunsScreen
- F4c — ApprovalsScreen
- F4d — SpendScreen (+ by-workspace card visible when filter.length > 1)

### Phase F5 — Sidebar badge cross-scope

- `shell.tsx`: `api.listApprovals({ status: 'pending' })` (no workspace_ids).
- Badge counts ALL pending across user's memberships.

### Phase F6 — `<WorkspaceContextPill>` rewire

- Add `show?: boolean` prop (default `false`).
- Each screen passes `show={workspaceFilter.length > 1}`.
- Drop `isMultiSelectMode` reading from auth (auth no longer has that concept).

### Phase F7 — Backend gaps update

- Document the per-list-call `workspace_ids` filter convention.
- Note: sidebar badge uses unscoped /approvals (no workspace_ids).

### Phase F8 — Verify

- Lint+build clean.
- Vocab grep on new UI strings.
- Browser smoke matrix (see § 6).

---

## 6. Verification matrix

- [ ] Login Ada (3 workspaces): switcher shows "Operations" (or whatever was active). NOT "All workspaces".
- [ ] On `/agents`: page filter chip row visible. Default = active workspace selected. List shows agents only from active.
- [ ] Click "All workspaces" chip on `/agents`: list expands to all 11 agents (8 ws_ops + 2 ws_growth + 1 ws_finance) with workspace pills.
- [ ] Navigate to `/activity`: filter resets to active (page-visit reset). List shows runs from active only.
- [ ] Navigate back to `/agents`: filter is reset to active again (per-visit, not persisted).
- [ ] Sidebar approval badge: count = ALL pending across all 3 workspaces.
- [ ] On `/approvals` page filter: defaults to active, can broaden to all.
- [ ] On `/costs` page filter expanded to multi: by-workspace card appears.
- [ ] On `/costs` page filter single: by-workspace card hidden.
- [ ] Hire from `/agents/new` Custom: no workspace dropdown — agent goes to active workspace silently.
- [ ] Hire Sales template from any active: still creates "Sales" workspace if missing (template default still wins).
- [ ] `/sandbox/team-map`: shows graph for active workspace. No multi-mode fallback.
- [ ] Login Priya (1 workspace): page filter chip row hidden everywhere (nothing to filter).
- [ ] Old session with `selectedWorkspaceIds` in localStorage: migrates to first id as active.

---

## 7. Risks

- **TS strict** — many api signatures change. Tedious but mechanical.
- **WorkspaceRemount** — now keyed on single id, less aggressive than sorted-CSV. Should still cover the "switch active" remount case.
- **Sidebar badge ALL** — if backend later wants per-tenant isolation, badge logic might need refresh. Documented in backend-gaps.
- **Cost of two-step UX** — user sometimes wants to set filter to "all" frequently. We're betting the per-visit reset isn't annoying. If it becomes a complaint, persistence per-screen in localStorage is a small follow-up.

---

## 8. Progress log

(пусто — старт по подтверждению)
