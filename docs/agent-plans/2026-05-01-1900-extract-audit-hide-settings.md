# Extract Audit screen, hide Settings

Status: **Done — extracted AuditScreen, hid Settings; lint + build clean.**

Sign-off decisions (recorded 2026-05-01, confirmed by user):

- **D-1 (label):** sidebar pill `Audit`; page header title `Audit log`.
- **D-2 (visibility):** admin-only sidebar item (same gating as the now-hidden `Settings`).
- **D-3 (position):** last item in sidebar (`Home → Approvals → Activity → Team → Apps → Costs → Audit`).
- **D-4 (legacy URLs):** the existing `/audit → /settings/history` redirect is **deleted**, not flipped. `/settings/*` URLs become dead 404s.
- **D-5 (file lifecycle):** `SettingsScreen.tsx` stays in the repo, untouched (mirrors the registration-hide pattern). Sidebar item + 5 routes get commented out with TODO references.
- **D-6 (extraction over import):** `HistoryLogTab` logic moves *into* the new `AuditScreen.tsx` together with its helpers (`historyStatusTone`, `STEP_TYPE_LABEL`, `HISTORY_TABLE_COLS`, `HistorySource`, `HISTORY_SOURCES`, `HISTORY_PAGE_SIZE_DEFAULT`). The new screen does **not** import from `SettingsScreen.tsx` — clean break, no stale dependency chain.

## 1. Task summary

`Settings` is being hidden from the UI. Most of its tabs (Workspace, Team, Diagnostic, Developer) are mock surfaces or placeholders we want out of the MVP. The one tab with real backend behaviour — **History log** (calls `GET /audit`, real spec endpoint) — is too useful to drop, so it gets promoted to a top-level admin route `/audit`.

The change is a clean three-file edit plus a new screen:
- new `AuditScreen.tsx`,
- routes + imports in `index.tsx`,
- sidebar item swap in `shell.tsx`.

`SettingsScreen.tsx` stays in the codebase (commented-out, recoverable) per the registration pattern.

## 2. Current repository state

- Branch: `shuklin/ux-redesign`. Working tree has uncommitted handoff-prep + registration-hide changes.
- Settings sidebar item: `shell.tsx:58-60` (admin-conditional spread).
- Settings routes: `index.tsx` — five `/settings/*` patterns + one `import SettingsScreen`.
- Legacy `/audit` redirect: `index.tsx` — `/audit` pattern that navigates to `/settings/history`.
- `HistoryLogTab` + helpers: `SettingsScreen.tsx:192-389` (≈200 lines, self-contained).
- Auth gating: `useAuth().user.role === 'admin' || 'domain_admin'` — same predicate used for Settings.
- `IconAudit` already exists in `components/icons.tsx`.

## 3. Files inspected

- `src/prototype/screens/SettingsScreen.tsx` — `HistoryLogTab` is lines ~192–389; uses `api.listAudit`, `api.listAgents`, `Caption`, `Pagination`, `ErrorState`, `LoadingList`, `EmptyState`, `SelectField`, `Status`-via-`Badge`, `Box`, `Flex`, `Text`, `Button`, `Code`. All imports already legal at the top of the file.
- `src/prototype/index.tsx` — flat routes array; legacy redirects use `LegacyRedirect` helper (line ~150).
- `src/prototype/components/shell.tsx` — `Sidebar()` builds `items: NavItem[]`; admin-conditional spread for Settings at line ~58–60.
- `docs/handoff-prep.md` § 2.1 / 2.5 / 2.6 — mark as *subsumed by Settings hide*. § 1 in `backend-gaps.md` doesn't need an immediate edit — `GET /audit` is real and stays real.

## 4. Assumptions and uncertainties

- `AuditScreen` uses the same data-fetching shape as `HistoryLogTab` — no API change, no new fixture.
- New `<PageHeader>` content: eyebrow `AUDIT`, title `Audit log`, subtitle `Per-step record of what your agents and team did. Filter by source or agent.` No `MockBadge` (this is a real-backend surface).
- `IconAudit` is the right icon — it was the legacy choice; consistent vocabulary.
- AppShell crumbs: `[{ label: 'home', to: '/' }, { label: 'audit' }]`.
- No tour selectors point at `/settings/history` (verified by grep — none of the three tour files reference settings/history selectors).

## 5. Step-by-step implementation

Single coherent change, no per-step stop — user explicitly asked to proceed end-to-end.

1. **Create `src/prototype/screens/AuditScreen.tsx`** — copy `HistoryLogTab` + 5 helpers from `SettingsScreen.tsx`. Wrap in `<AppShell crumbs={…}>` + `<PageHeader eyebrow=… title=… subtitle=… />`. Default-export the page component.
2. **Edit `src/prototype/index.tsx`:**
   - Add `import AuditScreen from './screens/AuditScreen'`.
   - Add route `{ pattern: '/audit', render: () => <AuditScreen /> }`.
   - Comment out `import SettingsScreen` with TODO referencing `handoff-prep.md`.
   - Comment out all 5 `/settings/*` routes with one shared TODO.
   - Delete (not comment) the old `/audit → /settings/history` LegacyRedirect entry.
3. **Edit `src/prototype/components/shell.tsx`:**
   - Add `IconAudit` to the icon import line.
   - Comment out the admin-conditional `Settings` nav item.
   - Add admin-conditional `Audit` nav item as the last entry.
4. **Lint + build** — `npm run lint && npm run build`.
5. **Update `docs/handoff-prep.md`:**
   - Mark § 2.1 (Diagnostic), § 2.5 (Workspace), § 2.6 (Invite member) as `🙈 hidden via Settings removal on 2026-05-01`.
   - Add a new entry documenting the Settings hide + Audit extraction.
   - Append to the decision log.

## 6. Risks

| Risk | Mitigation |
|---|---|
| `HistoryLogTab` uses some helper still imported only by SettingsScreen — extraction misses a dependency. | Code-grep for each helper name in the new file before saving. Lint catches missing imports. |
| Bookmarks to `/settings/*` 404. | Acceptable per D-4. Demo audience won't have such bookmarks. |
| `IconAudit` not in current shell imports → forgotten. | Step 3 explicitly adds it. |
| The new `AuditScreen` page header uses default `PageHeader` props that conflict with crumbs styling. | Mirror `RunsScreen.tsx` page-header shape (verified during step 1 of inspection). |
| Tours reference deleted selectors. | Verified by grep — no settings/history tour selectors exist. |

## 7. Verification checklist

- [ ] `Settings` no longer in sidebar (login as `frontend@int3grate.ai`).
- [ ] `Audit` appears as the last sidebar item, admin-only (member login: not visible).
- [ ] `/audit` shows the History log full-screen with the new `<PageHeader>`.
- [ ] All filters work (source `all/runs/chats`, agent picker, pagination).
- [ ] `/settings`, `/settings/team`, `/settings/history`, `/settings/developer`, `/settings/diagnostic` all 404 (or wherever the not-found state is).
- [ ] `npm run lint` clean.
- [ ] `npm run build` clean.
- [ ] No regression on Activity, Home, or any other admin-visible screen.

## 8. Browser test for the user

1. Log in as `frontend@int3grate.ai` (admin).
2. Sidebar: 7 items. Last is **Audit** (with `IconAudit`).
3. Click Audit → loads `/audit`. Header: eyebrow `AUDIT`, title `Audit log`, subtitle about per-step record.
4. Same filters as before (source pills + agent select + pagination).
5. Click any agent in the agent select → list filters to that agent.
6. Switch source `runs ↔ chats ↔ all` → table updates.
7. Type `#/settings` in the URL → should land on the not-found state, not crash.
8. Log out, log in as `member@int3grate.ai` → no `Audit` item in sidebar.

## 9. Progress log

- 2026-05-01 19:00 — plan drafted, implementation starts immediately.
- 2026-05-01 — All 5 implementation steps done in one pass:
  1. Created `src/prototype/screens/AuditScreen.tsx` (≈220 lines): `HistoryLogTab` body + 5 helpers (`HISTORY_TABLE_COLS`, `HISTORY_PAGE_SIZE_DEFAULT`, `STEP_TYPE_LABEL`, `HistorySource`, `HISTORY_SOURCES`, `historyStatusTone`) lifted verbatim. Wrapped in `<AppShell>` + `<PageHeader eyebrow="AUDIT" title="Audit log" subtitle="Per-step record …" />`. Admin gate via `NoAccessState` (member typing `#/audit` gets the no-access screen).
  2. `index.tsx`: added `import AuditScreen` + route `{ pattern: '/audit', render: () => <AuditScreen /> }`. Commented out `import SettingsScreen` and 5 `/settings/*` routes with shared TODO. Deleted legacy `/audit → /settings/history` redirect entry.
  3. `shell.tsx`: added `IconAudit` to icons import, commented out `IconSettings` (now unused), commented out admin-conditional `Settings` nav item, added admin-conditional `Audit` nav item as the last entry.
  4. `npm run lint` clean. `npm run build` clean. Bundle 987 kB (was ~1007 kB before this + the registration hide — ~20 kB total saved across both hides).
  5. `docs/handoff-prep.md` updated: § 2.1 / 2.5 / 2.6 marked as `🙈 subsumed by Settings hide` (cross-link to new § 2.7); new § 2.7 documents the Settings hide + Audit extraction in full.
- Tour selectors verified: no tour file references `/settings/*` selectors. Sidebar `nav-settings` selector — checked: not present in any tour file. No tour breakage.
- `SettingsScreen.tsx` left untouched in `src/prototype/screens/` per the registration-hide pattern. Restorable in one diff.
