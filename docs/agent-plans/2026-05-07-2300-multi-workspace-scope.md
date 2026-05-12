# Multi-workspace scope — implementation plan

**Date:** 2026-05-07 23:00
**Type:** implementation plan, follows agreement in chat
**Status:** active — Phase 1 starting

---

## 1. Task summary

Расширить workspace-фичу так, чтобы пользователь, состоящий в нескольких workspace'ах, мог одновременно видеть данные из нескольких или всех своих workspace'ов. Заменить `currentWorkspaceId: string | null` на `selectedWorkspaceIds: string[]`. Filter cascade в `api.list*` пересчитать на union. WorkspaceSwitcher → multi-select dropdown с «All workspaces» pseudo-toggle. Per-screen pills в multi-mode для контекста. Aggregate view на Costs.

Mock-only — backend в gateway.yaml вообще не имеет workspace endpoints (см. § 1.15). Не блокер.

---

## 2. Decisions (committed)

| # | Question | Choice | Rationale |
|---|---|---|---|
| 1 | Default scope for new user | All memberships | "See everything by default" matches admin mental model |
| 2 | Last selected workspace | Silent no-op (sticky) | Empty selection breaks all screens; no value in allowing it |
| 3 | Workspace dropdown in Custom hire | Multi-mode only | Single-mode has unambiguous current; dropdown is noise |
| 4 | Team Map fallback in multi | EmptyState + "Use {firstSelected}" CTA | One-click escape is friendlier than just a text |
| 5 | Costs per-workspace breakdown | Multi-mode only | Single-mode aggregate is meaningless (1 ws) |

Plus prior decision (chat): no role-gate. Multi-select shown to anyone with ≥2 memberships; user with 1 membership stays single-pick UI naturally.

---

## 3. Files to be touched (verified)

```
src/prototype/lib/workspace-context.ts        — singleton: id → ids[]
src/prototype/auth.tsx                        — StoredSession + AuthValue + provider state
src/prototype/lib/api.ts                      — inCurrentWorkspace → inSelectedWorkspaces (7 sites)
src/prototype/components/workspace-switcher.tsx — DropdownMenu.Item → CheckboxItem + "All" toggle
src/prototype/components/workspace-remount.tsx — key on sorted-CSV
src/prototype/screens/AgentNewScreen.tsx      — Custom hire ws dropdown
src/prototype/screens/sandbox/TeamMapScreen.tsx — multi-mode fallback
src/prototype/components/common/*             — WorkspaceContextPill primitive (new)
src/prototype/screens/AgentsScreen.tsx        — pill on cards
src/prototype/screens/RunsScreen.tsx          — pill on rows
src/prototype/screens/ApprovalsScreen.tsx     — pill on items
src/prototype/screens/SpendScreen.tsx         — by-workspace section in multi
src/prototype/lib/api.ts                      — getAgentWorkspaceMap() helper
docs/backend-gaps.md                          — § 1.15 multi-scope note
```

---

## 4. Step-by-step plan

### Phase 1 — Foundation: state model migration

- `lib/workspace-context.ts`: `getCurrentWorkspaceId/setCurrentWorkspaceId` → `getSelectedWorkspaceIds/setSelectedWorkspaceIds: () => string[]`. Empty array means "no scope".
- `auth.tsx`:
  - `StoredSession`: rename `currentWorkspaceId?` → `selectedWorkspaceIds?: string[]`. Migration: на чтении, если виден старый `currentWorkspaceId`, конвертим в `[currentWorkspaceId]`.
  - State: `currentWorkspaceId` → `selectedWorkspaceIds: string[]`.
  - Method: `switchWorkspace(id)` → `setSelectedWorkspaces(ids: string[])`.
  - `applyCurrentWorkspace` rules:
    - Validate stored ids ∩ memberships → drop unknown.
    - If result empty → fall back to ALL memberships (`myWorkspaces.map(w => w.id)`).
    - Write through to singleton + storage.
  - Add computed convenience: `isMultiSelectMode = selectedWorkspaceIds.length > 1`, `isAllSelected = ...length === myWorkspaces.length` (when myWorkspaces.length > 0).

**Verify**: build clean (compile fails for any old consumer of `currentWorkspaceId` / `switchWorkspace` — they'll be fixed in subsequent phases).

### Phase 2 — Filter cascade

- `lib/api.ts`:
  - `inCurrentWorkspace(agentId)` → `inSelectedWorkspaces(agentId)`. Body: `agentId in fxAgentWorkspace && getSelectedWorkspaceIds().includes(fxAgentWorkspace[agentId])`.
  - `userInCurrentWorkspace(userId)` → `userInSelectedWorkspaces(userId)`. Body: any membership of user is in selected ids.
  - All 7 call-sites replaced.
  - `createAgent` auto-pin: pin to first selected if any; otherwise leave unpinned. (Hire flows always call `setAgentWorkspace` explicitly after, so this is just a safety net.)

**Verify**: build + lint clean. Manual test pending Phase 3 (UI).

### Phase 3 — WorkspaceSwitcher multi-select UI

- `workspace-switcher.tsx`:
  - Replace `DropdownMenu.Item` per-ws → `DropdownMenu.CheckboxItem` (radix supports it; doesn't auto-close on click — perfect for multi).
  - Add "All workspaces" CheckboxItem at top:
    - `checked` if `isAllSelected`.
    - `onCheckedChange`: if currently all → reset to `[firstSelected]` (collapse). Else → check all (`myWorkspaces.map(w=>w.id)`).
  - Per-ws CheckboxItem:
    - `checked` if id ∈ selected.
    - `onCheckedChange`:
      - if checked → add to selected.
      - if unchecked → remove unless it's the last one (silent no-op).
  - Trigger label:
    - 0 selected → impossible by invariant. Defensive: "No workspaces" gray.
    - 1 → workspace name.
    - == myWorkspaces.length → "All workspaces".
    - else → "{N} workspaces" + tooltip listing names.
  - Caption stays "Workspace" (single concept, plural visualisation).

**Verify**: browser test. Toggle between configurations.

### Phase 4 — WorkspaceRemount key

- `workspace-remount.tsx`: `key` → sorted-CSV of selectedWorkspaceIds. Remount triggers on any selection change, not just single-id swap.

### Phase 5 — Hire flow: AgentNewScreen Custom dropdown

- `screens/AgentNewScreen.tsx`:
  - In Review step: if `selectedWorkspaceIds.length > 1` AND `!template.defaultWorkspaceName` (Custom) → render a `SelectField` "Workspace" with options = `myWorkspaces`. Default value = `selectedWorkspaceIds[0]`. State: `customWorkspaceId`.
  - In `hire()`: when template lacks defaultWorkspaceName and we're multi → use `customWorkspaceId` as target. Else current logic stays.
  - In single-mode: dropdown not shown; current scope used as before.

### Phase 6 — Team Map multi-mode fallback

- `screens/sandbox/TeamMapScreen.tsx`:
  - Read `selectedWorkspaceIds` and `setSelectedWorkspaces` from `useAuth`.
  - If selectedWorkspaceIds.length > 1 → before any data fetch, render an EmptyState with title "Team Map shows one workspace at a time", body "Switch to a single workspace to see how that team works together.", action button "Use {firstSelectedWorkspace.name}" → `setSelectedWorkspaces([firstSelectedId])`.

### Phase 7 — WorkspaceContextPill primitive + screen integration

- New `components/common/workspace-context-pill.tsx`:
  - Props: `agentId: string` (or workspace name directly via `workspaceName?: string` — TBD).
  - Reads `useAuth().isMultiSelectMode + myWorkspaces` and lookup table.
  - Returns `null` in single-mode. Otherwise renders a small Badge ("in {workspace}").
  - Lookup map cached via context or just by inline find.
- Export through `common.tsx` barrel.
- Integrate into:
  - `AgentsScreen` — agent card (next to status pill).
  - `RunsScreen` — row (sub-line / right-side).
  - `ApprovalsScreen` — card-mode + table-mode item.

### Phase 8 — Costs per-workspace breakdown

- `lib/api.ts`: add helper `async getAgentWorkspaceMap(): Promise<Record<string, string>>` returning `{ agentId: workspaceId }` for ALL agents (not workspace-filtered — needed for client-side aggregation across multiple workspaces).
- `SpendScreen.tsx`:
  - Multi-mode only: new "Spend by workspace" card above the per-agent breakdown.
  - Compute: `spendDashboard.items` (already workspace-filtered) groupBy `agentWorkspaceMap[item.id]` → `{ workspaceId, total }[]`.
  - Render: list with workspace name + amount + bar visualisation (proportional to total).

### Phase 9 — Backend gaps doc update

- `docs/backend-gaps.md` § 1.15: add bullet "Multi-scope filter — list endpoints need to support `?workspace_id[]=...` or `?workspace_ids=a,b` to honour user-selected subsets without N round-trips. Aggregations (spend, counts) either supported via the same multi-param or computed client-side from the union."
- Update Last-Updated footer.

### Phase 10 — Verify

- `npm run lint` clean.
- `npm run build` clean.
- Vocab grep on new UI strings.
- Browser smoke matrix:
  - Login Ada (3 workspaces) — switcher shows "All workspaces" by default, all surfaces show union.
  - Switch to single Operations → behaves as before.
  - Switch to "Operations + Growth" subset → trigger label updates, screens show union.
  - Try to uncheck last → no-op.
  - On `/sandbox/team-map` in multi → fallback EmptyState with action.
  - On `/costs` in multi → "Spend by workspace" section visible.
  - On `/agents`, `/activity`, `/approvals` in multi → "in {ws}" pills on rows.
  - Hire Custom in multi → workspace dropdown visible in Review.
  - Hire Custom in single → no dropdown.
  - Hire template (Sales) in multi → no dropdown (template default wins).

---

## 5. Risks / open considerations

- **Sidebar pending-approvals badge** is computed by counting items returned from `api.listApprovals({ status: 'pending' })`. With multi-scope, count is union — exactly what we want. No code change. ✓
- **Auto-pin on createAgent** changes from "current single ws" to "first selected ws". Could be surprising for legacy callers, but all real callers (use-hire-template, AgentNewScreen.hire) override via setAgentWorkspace explicitly. Fallback only for unknown future caller — safe. ✓
- **Workspace switcher dropdown closes on outside click.** OK — Radix default. User can re-open and continue toggling.
- **Performance** — filter cascade now involves an `Array.includes` over `selectedIds` per agent check. Selected ids are O(1-3) typically; negligible.
- **Identity of "All"** — when memberships change (new ws created), if user was on "all" it should stay on "all" (auto-include new). Achieved by storing the actual id array and refreshing it through `applyCurrentWorkspace` on `myWorkspaces` changes. Need to handle this in refresh callback.

---

## 6. Verification checklist

- [ ] Lint + build clean
- [ ] Switcher: toggle "All", individual checkboxes, last-sticky behavior
- [ ] Trigger label: 1 / All / N variants
- [ ] WorkspaceRemount: changes scope → re-mount fires
- [ ] /agents in multi: union list + pills
- [ ] /activity in multi: union list + pills
- [ ] /approvals in multi: union list + pills + badge count
- [ ] /costs in multi: by-workspace section
- [ ] /sandbox/team-map in multi: fallback EmptyState + CTA
- [ ] Hire Custom in multi: dropdown in Review
- [ ] Hire Custom in single: no dropdown
- [ ] Hire template in any mode: no dropdown
- [ ] localStorage migration: old session with `currentWorkspaceId` → upgraded to ids array silently
- [ ] All-selected stickiness: create new workspace → stays "all"
- [ ] backend-gaps.md § 1.15 updated
- [ ] Vocab grep on new UI strings

---

## 7. Progress log

(пусто — старт по подтверждению пользователя)
