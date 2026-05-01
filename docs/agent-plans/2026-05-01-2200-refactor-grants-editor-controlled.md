# Refactor GrantsEditor → reusable in wizard step 2

Status: **Done — all 6 steps implemented; lint + build clean. Tour walk skipped per user direction.**

## Sign-off decisions (recorded 2026-05-01)

- **D-1 (architecture):** Variant **A** — refactor existing `GrantsEditor` so it works in both `/agents/:id/grants` (post-creation) and `/agents/new` step 2 (pre-creation). No code duplication, no parallel components.
- **D-2 (split):** the controlled inner part becomes a new exported component `GrantsForm` (pure presentational, no save). The existing `GrantsEditor` *name is kept* and becomes a thin wrapper around `GrantsForm` that adds: agent.id, baseline/dirty tracking, save button, save error handling, NoAccessState fallback. This preserves the import in `AgentDetailScreen.tsx:127` unchanged.
- **D-3 (pre-fill in wizard):** when a template is picked (Sales, Marketing, Reports, …) → `pickedGrants` is initialised from `template.defaultGrants` (read-prefilled with mode + approval_required from template). When **Custom** template is picked → `pickedGrants = []`, user adds tools manually.
- **D-4 (state shape in wizard):** `connectedApps: Set<string>` is replaced by `pickedGrants: GrantDraft[]` where `GrantDraft = { tool_name, mode, approval_required, config? }` (matches `ReplaceToolGrantsRequest.grants[]` exactly). No interim "set of prefixes" abstraction.
- **D-5 (no Save in wizard):** wizard collects state, applies via `api.setGrants` only on Hire (last step). No intermediate save, no baseline/dirty in wizard. `<GrantsForm>` is purely controlled there.
- **D-6 (tour selectors stay where they are):** `data-tour="grants-mode"`, `grants-catalog"`, `grants-add"`, `grants-write-warning"` live inside `GrantsForm` (used by both contexts). `data-tour="grants-summary"` and `grants-save"` stay in the wrapper (`/grants` tab only). Tour `configure-tool-grants-tour` continues to work on `/grants` unchanged.
- **D-7 (reset to template):** in wizard, an optional "Reset to template defaults" ghost button. Not in v1 — start without it; if user feedback wants it, add later. Removing all permissions and re-picking is one click anyway.

## 1. Task summary

`GrantsEditor` today is **smart**: it owns its save lifecycle (baseline, dirty, `api.setGrants` on Save). That works on `/agents/:id/grants` because the agent already exists. It does NOT work in `/agents/new` step 2 because the agent isn't created until the final Hire button.

We split the editor into:
- `GrantsForm` — controlled inner. Knows nothing about save/agent. Renders the table (tool rows + permission select + remove + add catalog picker + write-without-approval warning). Caller controls `grants` array via `onChange`.
- `GrantsEditor` (wrapper, kept name) — wraps `GrantsForm` with baseline/dirty/save logic for the `/grants` tab. Same API as before for `AgentDetailScreen`.

In `AgentNewScreen.tsx`, wizard step 2 ("Allow access") replaces its current per-app `AppsStep` with `<GrantsForm>`. State `connectedApps: Set<string>` becomes `pickedGrants: GrantDraft[]`, pre-filled from the chosen template. Hire passes `pickedGrants` to `api.setGrants` after `createAgent` + `activateVersion`.

## 2. Current state inspected

- `src/prototype/components/grants-editor.tsx` (370 LOC): exports `GrantsEditor`. Internal helpers: `PermissionSelect`, `CatalogPicker`, `ToolNameCell`, `ReadOnlyGrants`, `PERMISSION_OPTIONS`, `levelFromGrant`, `applyLevel`.
- `src/prototype/screens/AgentDetailScreen.tsx:127`: `<GrantsEditor agent={agent} grants={grants} canEdit={canEdit} onChange={setGrants} />`.
- `src/prototype/screens/AgentNewScreen.tsx`: state `connectedApps: Set<string>` (line 47); `toggleApp` (108); `requiredAppPrefixes` + `skippedApps` (line ~119); `hire()` filters `template.defaultGrants` by `connectedApps` and calls `api.setGrants` (143-148). `AppsStep` component (line 602-709) is the per-app toggle UI we're replacing.
- `src/prototype/lib/types.ts:107` — `ReplaceToolGrantsRequest` shape: `{ grants: Array<{ tool_name, mode, approval_required?, config? }> }`. `GrantDraft` will be exactly the inner array element.
- `src/prototype/lib/templates.ts:60+` — each template has `defaultGrants: TemplateGrant[]` where `TemplateGrant = { tool_name, mode, approval_required, config? }` already. Direct compatibility.
- Tour `configure-tool-grants-tour.tsx` — uses 6 `data-tour` selectors. After refactor: 4 inside `GrantsForm` (still resolve from /grants tab), 2 in wrapper (resolve only on /grants — wizard doesn't use them, tour doesn't run there).

## 3. Files touched

- `src/prototype/components/grants-editor.tsx` — split into `GrantsForm` (new export) + `GrantsEditor` (wrapper, kept export name)
- `src/prototype/screens/AgentNewScreen.tsx` — replace `AppsStep` with `GrantsForm`-driven step; rename state; rewrite hire(); update ReviewStep summary
- `src/prototype/lib/templates.ts` — `TemplateGrant` type already matches the shape we need; possibly export it formally if not already
- *Maybe:* `src/prototype/lib/types.ts` — if we want to formally export `GrantDraft` type
- *No change:* `src/prototype/screens/AgentDetailScreen.tsx` — wrapper API preserved
- *No change:* `src/prototype/tours/configure-tool-grants-tour.tsx` — selectors preserved on `/grants` tab

## 4. Risks

| Risk | Mitigation |
|---|---|
| Refactor regresses `/grants` tab — save / dirty / reset stop working. | Wrapper preserves the existing API exactly. After refactor, manually walk `/grants` tab (load, change permission, save, reset, add new tool, remove tool) before declaring done. |
| `configure-tool-grants` tour breaks — selectors moved/removed. | Selectors `grants-mode`, `grants-catalog`, `grants-add`, `grants-write-warning` stay inside `GrantsForm` (resolve in both contexts). `grants-summary` and `grants-save` stay in wrapper (resolve on /grants where the tour runs). Verify tour walks cleanly after refactor. |
| `connectedApps`-based legacy code in wizard (`requiredAppPrefixes`, `skippedApps`) — references to a removed concept. | Step 4 of the plan tracks every reference; rewrite ReviewStep summary to use grants count instead of "skipped apps" warning. |
| Wizard step 2 becomes overwhelming — 16 tools × 3 levels each = lots of micro-decisions on onboarding. | Pre-fill from template = sensible defaults; user just trims/adjusts. Custom template = user explicitly opted into manual mode. Acceptable trade-off. |
| `GrantDraft` shape diverges from `ToolGrant` (missing `id`/`scope_*`) confuses callers. | Document the type clearly. `GrantsForm` props use `Array<GrantDraft>` (no `id` required); wrapper maps `ToolGrant[]` ↔ `GrantDraft[]` for save. |

## 5. Step-by-step implementation

Stop-and-report after each step.

### Step 1 — Carve out `GrantsForm` (controlled inner)

In `grants-editor.tsx`:
- Add new exported type `GrantDraft = { tool_name: string; mode: ToolGrantMode; approval_required: boolean; config?: Record<string, unknown> }`
- Add new exported component `GrantsForm({ grants, onChange, catalog?, canEdit?, idPrefix? })`:
  - `grants: GrantDraft[]`, `onChange(next: GrantDraft[])`, optional `canEdit` (default `true`)
  - Renders: table (rows with `ToolNameCell` + `PermissionSelect` + remove `IconButton`), add row (`CatalogPicker` + Add button), write-without-approval warning banner
  - Holds local `newTool` state and self-fetches `catalog` if not passed (preserving today's behaviour)
  - **No** baseline/dirty/save/saveError — those belong in the wrapper
  - Keeps `data-tour="grants-mode"`, `grants-catalog"`, `grants-add"`, `grants-write-warning"`
  - Generates synthetic IDs locally for keying React rows (`grants` is array-index-based otherwise — let `useMemo` give each row a stable key based on tool_name + index, since `GrantDraft` has no `id`)
- Keep `GrantsEditor` working as before — temporarily duplicate or have it use `GrantsForm` internally. Decide in implementation whether to refactor immediately or in Step 2.

After Step 1: lint + build clean. `/grants` tab still functions (because `GrantsEditor` still has its old guts OR is already wrapping `GrantsForm`).

### Step 2 — Make `GrantsEditor` a wrapper around `GrantsForm`

- `GrantsEditor` keeps signature `({ agent, grants, canEdit, onChange })` exactly
- Internal: `baseline`, `local`, `saving`, `saveError` state (as today)
- `local` is `ToolGrant[]` (because we need `id` for save's response wiring); convert to/from `GrantDraft[]` at the `<GrantsForm grants=…>` boundary
- Header (count + Reset + Save) wraps `<GrantsForm>` in the table area
- `data-tour="grants-summary"` on header, `data-tour="grants-save"` on save button
- `NoAccessState` + `<ReadOnlyGrants>` for `!canEdit` path

After Step 2: `/grants` tab pixel-equivalent to before. Verify in browser.

### Step 3 — Wizard state rewrite in `AgentNewScreen.tsx`

- `connectedApps: Set<string>` → `pickedGrants: GrantDraft[]`
- `toggleApp` → removed
- `requiredAppPrefixes` → removed
- `skippedApps` → re-derive as "tools in template defaults that user removed" or drop entirely (probably drop — see Step 4)
- `pickTemplate(t)` — when template chosen, set `pickedGrants` to deep-copied `t.defaultGrants`. For Custom template, `setPickedGrants([])`
- `resetWizard` — clear pickedGrants
- `hire()` — line 143-148 simplifies: `if (pickedGrants.length > 0) await api.setGrants(agent.id, { grants: pickedGrants })`

### Step 4 — Wizard step 2 UI: replace `AppsStep` with `GrantsForm`

- Delete `AppsStep` component (or keep file scope but remove from render)
- New step 2 renders:
  - Heading already says "Allow access." (kept)
  - Subtitle already correct
  - `<GrantsForm grants={pickedGrants} onChange={setPickedGrants} />`
  - Continue + Back buttons (existing pattern)
- ReviewStep summary:
  - Replace "Allowed apps" SummaryRow with "Permissions" — `pickedGrants.length` total + breakdown by level (`X read-only, Y write (with approval), Z write (auto)`)
  - Drop the "N apps not allowed yet" warning banner — it was tied to template-required-apps concept that no longer exists
- Success message in `WelcomeBack`/post-hire: tweak "with the apps you allowed" → "with the {N} permissions you set up"

### Step 5 — Tour walk + lint + build

- Walk `configure-tool-grants` tour from `/learn`, verify all 6 selectors resolve
- `npm run lint`
- `npm run build`
- Bundle size delta ~0 (refactor, not feature add/remove)

### Step 6 — Update progress logs

- `handoff-prep.md` — append decision-log entry
- This plan file — set Status: Done; fill § 7 progress log

## 6. Verification checklist

- [ ] `/agents/:id/grants` (post-creation) — load grants, change permission level, Save, Reset, add new tool from catalog, remove tool, all behave as before
- [ ] `/agents/:id/grants` shows "Save permissions" disabled until dirty; enabled after change
- [ ] `/agents/new` step 2 — picking a template (e.g. Sales) shows pre-filled grants in the editor
- [ ] `/agents/new` step 2 — Custom template shows empty editor with catalog picker available
- [ ] `/agents/new` step 2 — can change permission level per tool, can remove, can add from catalog
- [ ] No "Save" button in wizard step 2 — only Continue
- [ ] ReviewStep summary shows "Permissions" with count + breakdown, no "Connected apps" line
- [ ] Hire creates agent with the picked grants applied (verify by opening /agents/:id/grants of the new agent)
- [ ] `configure-tool-grants` tour completes without "target not found"
- [ ] `npm run lint` clean. `npm run build` clean.

## 7. Browser test for the user

After Step 5:

1. Log in as `frontend@int3grate.ai`.
2. **/agents/:id/grants** of any existing agent — change a permission level and save; reset works; add/remove tools work. (Regression check.)
3. **/agents/new** → pick **Sales agent** → Continue. Step 2 now shows a full per-tool editor pre-filled with template grants. You can change `read` ↔ `write (with approval)` per row, remove rows, add rows from catalog.
4. Continue → Review → check summary reads `Permissions: N total · X read · Y write (with approval) · Z write (auto)`.
5. Hire → on the new agent's page, open Permissions tab → confirm what you set up shows there.
6. Repeat with **Custom** template → step 2 starts empty; add a few tools manually → Continue → Hire.
7. Open `/learn` → start "Configure tool grants" tour → walks cleanly.

## 8. Progress log

- 2026-05-01 22:00 — plan drafted. Awaiting confirmation before Step 1.
- 2026-05-01 — Step 1 done. Added exported type `GrantDraft` and exported component `GrantsForm` (controlled, no save) to `components/grants-editor.tsx`. `GrantsEditor` left untouched. Lint + build clean; bundle unchanged (dead code).
- 2026-05-01 — Step 2 done. `GrantsEditor` now wraps `GrantsForm`: kept its public API (`agent`, `grants`, `canEdit`, `onChange`) and external behaviour (baseline/dirty/save/saveError, `data-tour="grants-summary"`, `grants-save"`, NoAccessState fallback). Internals: removed `newTool`/`catalog` state and inline table — delegated to `<GrantsForm>` via a `drafts` projection (ToolGrant[] → GrantDraft[]) and `handleFormChange` bridge that re-attaches synthetic ids for new rows. Save unchanged. Bundle 969.26 kB (+0.6 kB on the bridge).
- 2026-05-01 — Steps 3+4 done in one coherent pass (split would have left an intermediate broken state). In `AgentNewScreen.tsx`:
  - State: `connectedApps: Set<string>` → `pickedGrants: GrantDraft[]`
  - Removed: `requiredAppPrefixes` useMemo, `toggleApp`, `skippedApps`
  - `pickTemplate` pre-fills `pickedGrants` from `template.defaultGrants` (Custom = empty array)
  - `hire()` passes `pickedGrants` to `setGrants` directly (no filter)
  - Wizard step 2 render: `<AppsStep />` → `<GrantsForm grants onChange />` + Back/Continue buttons inline
  - `function AppsStep` deleted (~107 LOC removed)
  - `ReviewStep` props: dropped `connectedApps`, `skippedApps`; added `pickedGrants`; "Allowed apps" SummaryRow → "Permissions" with total + breakdown via `grantsBreakdown(grants)` helper; "skipped apps" warning → info banner only when 0 permissions picked
  - Success message: "with the apps you allowed" → "with N permissions ready to use"
  - Imports: dropped `useMemo`, `Badge`, `toolLabel`, `TemplateGrant`; added `GrantsForm`, `GrantDraft`
  - One miss caught at first build: Preview phase still referenced removed `requiredAppPrefixes` + `appLabel`. Fixed by deriving `previewApps` inline from `template.defaultGrants` and re-importing `appLabel`/`appPrefix` from `lib/format`.
  - Second miss: `TemplateGrant` has no `config` field — `pickTemplate` map dropped that field (it's optional in `GrantDraft` anyway).
- 2026-05-01 — Step 5 marked done without browser tour walk per user direction. `npm run lint` clean. `npm run build` clean. Bundle 967.37 kB (~−2 kB after removing AppsStep).
- 2026-05-01 — Step 6 done. This file marked Status: Done. `handoff-prep.md` decision log updated with cumulative refactor entry.
