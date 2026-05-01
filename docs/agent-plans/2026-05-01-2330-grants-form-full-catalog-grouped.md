# GrantsForm: full catalog, grouped by app, smart defaults

Status: **Draft — awaiting confirmation, then step-by-step.**

## Sign-off decisions (recorded 2026-05-01)

- **D-1 (terminology):** «Allow» / «Allow all» / «Remove» / «Remove all». Not «Connect»/«Подключить». Consistent with the recent OAuth-semantics cleanup.
- **D-2 (universal UI):** the new design lives inside `GrantsForm` so it appears in **both** the wizard step 2 ("Allow access") and the post-creation `/agents/:id/grants` tab. Wrapper `GrantsEditor` keeps its save/dirty/baseline; only the inner table changes.
- **D-3 (smart defaults):** when user clicks «Allow» on a tool — initial permission level comes from catalog `tool.default_mode`:
  - `read_only` → `{ mode: 'read', approval_required: false }`
  - `requires_approval` → `{ mode: 'read_write', approval_required: true }`
  - `denied` → tool not allowable; «Allow» is hidden, row appears disabled with a hint
- **D-4 (template pre-fill):** all tools in the catalog are visible always. Tools that the picked template grants — appear in their app card with the template's permission already applied. Other tools — show «Allow» button. Custom template = no pre-allowed tools.
- **D-5 (group-by-app):** every tool rendered inside a card whose header is the app name + bulk action(s). Header bulk actions:
  - X < N allowed → show «Allow all» (allows the not-yet-allowed tools using each one's smart default)
  - X > 0 allowed → show «Remove all»
  - 0 < X < N → both buttons visible
  - All denied tools never count toward N (they're shown but not addable, ignored by bulk actions)
- **D-6 (sort):** apps sorted alphabetically by app label. Tools within a card sorted alphabetically by tool label.
- **D-7 (tour debt):** existing `data-tour="grants-catalog"` and `data-tour="grants-add"` selectors disappear (catalog picker + single Add button no longer exist). Tour `configure-tool-grants` will fall back on those two steps. Per user direction, tour fixes are deferred. Logged as known issue.

## 1. Task summary

Today's `GrantsForm` shows only granted tools as a list, with a catalog `Select` picker + Add button to add new ones. Discoverability is poor — user can't see what's available without opening the picker, and bulk actions don't exist.

Replace with a **full-catalog grouped view**: all available tools are visible always, grouped by app prefix (Apollo, Email, Zoho CRM, …). Per tool: if granted → permission select + remove. If not granted → «Allow» button using catalog's smart default. Per app card header: name + bulk «Allow all» / «Remove all» actions.

`GrantsForm`'s public API is unchanged (`grants: GrantDraft[]`, `onChange`, optional `catalog`). `GrantsEditor` wrapper stays as-is. `AgentNewScreen.tsx` doesn't need any changes — it already passes `pickedGrants` + `setPickedGrants`.

## 2. Files touched

- `src/prototype/components/grants-editor.tsx` — rewrite `GrantsForm` internals (group rendering, per-app bulk actions, allow-by-default-mode logic). Add helper `policyModeToLevel`. `GrantsEditor` wrapper untouched. `ReadOnlyGrants` untouched.
- *No change* to `AgentNewScreen.tsx` (same API), `AgentDetailScreen.tsx` (wrapper preserves API).
- *Deferred:* `tours/configure-tool-grants-tour.tsx` — two stale selectors (`grants-catalog`, `grants-add`) will fail; intentionally not fixed in this pass per user direction.

## 3. Inspected

- `lib/types.ts:126` — `ToolPolicyMode = 'read_only' | 'requires_approval' | 'denied'`
- `lib/fixtures.ts` — 16 tools across ~6 apps; one tool with `default_mode: 'denied'` (`fixtures.ts:440`) — the design must honour this and not let the user grant it
- `lib/format.ts` — `appPrefix(toolName)` and `appLabel(prefix)` already exist; reuse
- `components/grants-editor.tsx:15-32` — `PermissionLevel`, `applyLevel`, `levelFromGrant` exist and stay; new helper `policyModeToLevel(mode)` mirrors the mapping in D-3
- `lib/api.ts:832` — backend already uses the same mapping internally (`policyModeForGrant`). Frontend mirroring is consistent

## 4. Risks

| Risk | Mitigation |
|---|---|
| Vertical length of full catalog overwhelming on smaller viewports. | 16 tools across 6 apps fits in one screen height typically; scroll-friendly. If grows past ~30 tools, add app-level collapsible cards as follow-up. |
| `denied` tools shown as disabled rows might confuse — "why is this here?". | Ghost styling + hint text under tool name: «Restricted at workspace level». Honest framing. |
| Tour `configure-tool-grants` partially broken after refactor. | Per user direction, accept and log as known debt. Two fallback messages in the tour. The remaining four selectors (`agent-tab-grants`, `grants-summary`, `grants-mode`, `grants-write-warning`, `grants-save`) still resolve. |
| `GrantsEditor` wrapper's empty-state copy («No permissions yet») rendered nowhere now since `GrantsForm` always renders the catalog — even with zero grants, the UI shows app cards with «Allow» buttons. | Wrapper's count line still reads «0 permissions» in that case. Not a regression — it's clearer than the old empty state. |
| `setSaveError(null)` on grants prop sync in wrapper — make sure the grants → catalog → render chain still triggers when GrantsForm self-fetches catalog. | Catalog self-fetch is unchanged; nothing about the wrapper's save lifecycle is touched. |

## 5. Step-by-step

Each step ends with stop-and-report.

### Step 1 — Add `policyModeToLevel` helper + sketch group-by-app data shape

In `grants-editor.tsx`:
- Add helper `policyModeToLevel(mode: ToolPolicyMode): PermissionLevel`:
  - `read_only` → `'read'`
  - `requires_approval` → `'write_approval'`
  - `denied` → `'read'` (returned as a fallback; the caller must check denied separately and not call this for denied tools)
- Add helper `groupCatalogByApp(catalog, grants)`:
  - Returns `Array<{ prefix, label, tools: Array<{ tool: ToolDefinition; granted: GrantDraft | null; isDenied: boolean }> }>`
  - Sorted alphabetically by `label`; tools sorted alphabetically inside
- Verify build clean

### Step 2 — Rewrite `GrantsForm` body (group cards rendering, per-tool controls, header bulk actions)

- Drop the old flat list + catalog picker structure
- Render `groups.map(group => <AppCard ... />)`, each card with:
  - Header: `Avatar(prefix) + appLabel + "X of N allowed" caption + bulk-action buttons (Allow all / Remove all per D-5)`
  - Body: per-tool row — if granted → `ToolNameCell + PermissionSelect + IconX (remove)`; if not granted and not denied → `ToolNameCell + Allow button`; if denied → `ToolNameCell + small ghost label "Restricted"`
- Bulk «Allow all»: takes all not-granted, not-denied tools in this app, computes `applyLevel(policyModeToLevel(t.default_mode))` for each, and emits a single `onChange(merged)` with all of them appended
- Bulk «Remove all»: filters out grants whose tool_name has `appPrefix === group.prefix`, single `onChange`
- Single «Allow» (per-tool): same logic but for one tool
- Single «×» (remove): filter out by tool_name, `onChange`
- Keep `data-tour="grants-mode"` on per-tool PermissionSelect; keep `data-tour="grants-write-warning"` on the warning banner. **Drop `grants-catalog` and `grants-add` data-tour attributes** (intentional — those selectors are gone).
- Catalog self-fetch logic unchanged

### Step 3 — Verify wizard + /grants tab visually

- Build + lint
- Browser walkthrough (described in § 7) — both contexts use the new UI

### Step 4 — Update progress logs

- This plan-file → Status Done
- `handoff-prep.md` decision log entry referencing the plan
- Note tour debt explicitly in handoff-prep so future sessions can prioritise it

## 6. Verification checklist

- [ ] `/agents/new` step 2 renders cards-by-app with all tools visible
- [ ] Picking Sales template — Apollo / Email / Web Search / Zoho cards show their template tools as already-allowed with template's permission level; not-templated tools show «Allow»
- [ ] Picking Custom template — every tool in every card shows «Allow»; no pre-allowed
- [ ] Clicking «Allow» on a `read_only` tool → row becomes allowed at «Read only»
- [ ] Clicking «Allow» on a `requires_approval` tool → row becomes allowed at «Write (with approval)»
- [ ] Bulk «Allow all» on a card → all not-granted-not-denied tools allowed at their respective default
- [ ] Bulk «Remove all» on a card → all tools of that app removed from grants
- [ ] Denied tool (in fixtures: `payments.process_charge` or whichever it is on line 440) shown but not grantable; no «Allow» button
- [ ] Permission select per-row works (changes mode + approval_required)
- [ ] Remove (×) per-row works
- [ ] write-without-approval warning banner appears when applicable
- [ ] `/agents/:id/grants` tab shows the same UI; existing grants pre-rendered as allowed; Save/Reset/Dirty work as before
- [ ] `npm run lint` clean
- [ ] `npm run build` clean

## 7. Browser test for the user

After Step 3:

1. Log in as `frontend@int3grate.ai`.
2. **/agents/new** → Custom template → step 2 → all 16 tools visible in 6 app cards. Every row has «Allow». Click «Allow all» on Apollo — three Apollo rows become allowed at Read only. Change one to «Write (with approval)» via the dropdown. Hire — open new agent's Permissions tab → state matches what was set up.
3. **/agents/new** → Sales template → step 2 → Apollo / Email / Zoho / Web Search cards show their template tools pre-allowed at template-defined levels. Click «Allow all» on a not-templated app → fills with smart defaults. Hire and confirm.
4. **/agents/:id/grants** of any existing agent — same UI; existing grants prefilled. Toggle a tool, change a level, Save → backend gets the new state. Reset works.
5. Find a `denied` tool — should appear but not grantable. No «Allow» button on it; the bulk «Allow all» on its app should skip it.
6. Confirm write-without-approval banner shows when at least one tool is at «Write (auto)».

## 8. Progress log

- 2026-05-01 23:30 — plan drafted; awaiting confirmation before Step 1.
