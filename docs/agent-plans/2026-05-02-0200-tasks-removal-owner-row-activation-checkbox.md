# Final cleanup — Tasks removal + Owner row + Auto-activation checkbox

Status: **Done — all 9 steps complete; lint + build clean.**

## Three independent cleanups, ordered by scope

1. **Tasks subtree — full removal** (largest)
2. **AgentDetail Settings owner row — remove**
3. **Wizard activation hack → opt-in/opt-out checkbox**

---

## Sign-off decisions (recorded 2026-05-02)

### Tasks (largest)
- **T-1 (delete vs hide):** **delete** Tasks-related files entirely (not the prior comment-out pattern). User said «полностью сносим значит страницы и все зависимости».
- **T-2 (api.ts methods):** delete `api.listTasks()`, `api.getTask()`, `api.createTask()`, plus the in-mock side-effect in `decideApproval` that cancels a task on reject (lines around `fxTasks.find(...)` inside the resume mutation).
- **T-3 (types):** delete `Task`, `TaskList`, `TaskStatus`, `TaskType`, `CreateTaskRequest` from `lib/types.ts`.
- **T-4 (fixtures):** delete `fxTasks` const + `task()` factory helper from `lib/fixtures.ts`. Remove any imports of these.
- **T-5 (approval task_id):** keep `task_id` field on ApprovalRequest (it stays in spec as a backend-populated reference). Stop displaying it — drop the chip from ApprovalDetail hero, drop `taskContext` state + `getTask` call.
- **T-6 (training fixtures):** if any tour scenarios reference Task data, drop those references.
- **T-7 (TaskOutcomesCard file):** delete entirely (was already hidden in dashboard, file no longer needed).

### Owner row
- **O-1:** delete the «owner» MetaRow from `AgentDetailScreen` Settings tab.
- **O-2:** drop `users` state, `api.listUsers()` call, `userName` helper, `User` type import from AgentDetailScreen if those are now unused (lint will catch).

### Activation
- **A-1:** delete the `fresh.status = 'active'` mock hack in `AgentNewScreen.tsx hire()`. After `activateVersion` (real `POST /agents/{id}/versions/{verId}/activate`) we trust backend to set agent.status correctly. If backend doesn't (and we discover this in production), we add a comment + workaround later — not now.
- **A-2:** add an «Activate immediately after hiring» checkbox to ReviewStep (default: **checked**). If checked → call `activateVersion` (current behaviour). If unchecked → skip activateVersion; agent stays in `draft`.
- **A-3:** Success message should reflect actual returned status — if active: «is ready», if draft: «is hired but inactive — activate from the agent's page when you're ready».

### Out of scope
- Renaming `api.listTools()` → `listToolCatalog()` (still mock layer; documented gap)
- Restoring Tasks UI when backend ever ships `/tasks/*` (separate effort then)
- Other dashboard widgets (already covered)

---

## 1. Task summary

After the live-spec reconciliation, three concrete things still don't match reality:

1. **Tasks subtree** (3 screens + routes + 4 api calls + types + fixtures + approval chip) — backend has no `/tasks/*` endpoints; in production every Task UI surface 404s. User chose **full removal**, not hide.
2. **AgentDetail Settings tab «owner» row** — depends on `GET /users` (absent). Currently shows «—» if can't resolve. Just drop.
3. **AgentNewScreen wizard `fresh.status = 'active'` hack** — assumes backend flips agent status after activateVersion. Drop the hack; trust backend. Add checkbox so user can opt out of auto-activation.

## 2. Files inspected / touched

Tasks (7+ files):
- DELETE `src/prototype/screens/TasksScreen.tsx`
- DELETE `src/prototype/screens/TaskDetailScreen.tsx`
- DELETE `src/prototype/screens/TaskNewScreen.tsx`
- DELETE `src/prototype/screens/home/TaskOutcomesCard.tsx`
- EDIT `src/prototype/index.tsx` — remove 3 routes + 3 imports
- EDIT `src/prototype/lib/api.ts` — remove `listTasks` / `getTask` / `createTask` methods + decideApproval task-side-effect
- EDIT `src/prototype/lib/types.ts` — remove Task / TaskList / TaskStatus / TaskType / CreateTaskRequest
- EDIT `src/prototype/lib/fixtures.ts` — remove `fxTasks` const + `task()` factory + any Task imports
- EDIT `src/prototype/screens/ApprovalDetailScreen.tsx` — remove `taskContext` state + `getTask` call + task chip in hero + Task type import
- VERIFY `src/prototype/tours/training-fixtures.ts` — drop Task references if any
- VERIFY any other importers of Task type

Owner row (1 file):
- EDIT `src/prototype/screens/AgentDetailScreen.tsx` — drop owner MetaRow, `users` state, `listUsers` call, `userName` helper, `User` import (if unused after)

Activation (1 file):
- EDIT `src/prototype/screens/AgentNewScreen.tsx` — drop `fresh.status = 'active'`, add checkbox state + UI in ReviewStep, conditionally call activateVersion

Docs:
- EDIT `docs/handoff-prep.md` — close Tasks gap (§ 6 in backend-gaps), close owner-name fallback story, close activation hack
- EDIT `docs/backend-gaps.md` — § 6 (Tasks absent) → mark «UI removed»
- EDIT `CLAUDE.md` Key gaps list — annotate

## 3. Risks

| Risk | Mitigation |
|---|---|
| Tasks deletion breaks training tours that have Task scenarios. | Step 0 grep finds all Task references; remove training scenarios that depend on Tasks. |
| Approval fixtures still set `task_id` — UI tries to render chip with no data. | After removing chip render, `task_id` field is just an unused property on the object. No render path → no problem. |
| `decideApproval` mock side-effect on tasks is removed — does anything depend on cancelled-task-on-reject for demo purposes? | Mock-only side effect. Real backend handles this server-side. No UI consumer. Safe to remove. |
| Auto-activation default «on» means user can't opt out unless they uncheck. | That's the intended UX — most users want immediate activation. Checkbox just exposes the choice. |
| Production: removing `fresh.status = 'active'` mock hack reveals backend doesn't flip status. | Acceptable — agent shows as `draft` until manual activation from agent page. Better than UI lying. |
| Owner row removal — admins lose visibility into who owns an agent. | Without `GET /users` we can't show name anyway. Showing a raw user_id wasn't useful. When backend ships `/users` or denormalises owner_name, restore. |

## 4. Step-by-step plan

Stop-and-report after each step.

### Step 1 — Verify state and Task references

- Grep all Task* type usages, fxTasks references, listTasks/getTask/createTask call sites
- Grep training-fixtures.ts for task-related scenarios
- Confirm scope matches plan; flag any surprise importers

### Step 2 — Remove ApprovalDetailScreen task chip + getTask

- Drop `taskContext` state + setter
- Drop the `api.getTask(...)` block in useEffect
- Drop the task chip JSX in hero context strip
- Drop `Task` type from imports

After: lint + build clean. Approval detail still works; just no task chip.

### Step 3 — Delete the 3 Task screens + dashboard helper

- Delete `TasksScreen.tsx`, `TaskDetailScreen.tsx`, `TaskNewScreen.tsx`, `home/TaskOutcomesCard.tsx`

Build will fail (orphan routes/imports) — that's the entry to Step 4.

### Step 4 — Update routes and imports

- `src/prototype/index.tsx`: remove `import TasksScreen / TaskDetailScreen / TaskNewScreen` + 3 route entries
- `src/prototype/screens/home/AdminView.tsx`: remove the commented-out TaskOutcomesCard import line (file deleted)

After: build clean.

### Step 5 — Remove api methods + types + fixtures

- `lib/api.ts`: remove `listTasks`, `getTask`, `createTask` methods. Remove the `fxTasks.find(...)` side-effect in `decideApproval` (mock-only task cancellation on reject).
- `lib/types.ts`: remove `Task`, `TaskList`, `TaskStatus`, `TaskType`, `CreateTaskRequest`.
- `lib/fixtures.ts`: remove `fxTasks` const + `task()` factory; clean up any Task imports.
- Verify other files don't import these (lint catches).

### Step 6 — Owner row removal in AgentDetailScreen

- Remove `<MetaRow label="owner" value={ownerName} />` from SettingsTab
- Drop `users` state, `api.listUsers()` call, `userName` helper, `User` type import if unused

### Step 7 — Wizard activation refactor

- Remove `fresh.status = 'active'` mutation in `hire()`
- Add `autoActivate: boolean` state (default `true`)
- Add checkbox to ReviewStep: «Activate this agent immediately after hiring» (helper text below: «Uncheck to keep it as a draft — activate later from the agent's page.»)
- Conditional: `if (autoActivate) await api.activateVersion(...)`
- Success page: branch by returned status — `is ready` if active, `is hired as a draft — activate from its page when ready` if draft

### Step 8 — Lint + build + verification

- `npm run lint` clean
- `npm run build` clean
- Manual sanity: hire flow, approval detail (no chip), agent detail settings (no owner row)

### Step 9 — Doc updates

- `handoff-prep.md` lo: log all 3 cleanups
- `backend-gaps.md` § 6 (Tasks absent) → mark «UI removed entirely 2026-05-02»; § 1.2 (GET /users) → annotate that owner row removed; mention that activation hack removed
- `CLAUDE.md` Key gaps list → drop Tasks-related bullet (no UI to flag); annotate users-gap (UI now degrades to absent fields rather than «—» placeholders)

## 5. Verification checklist

- [ ] No file imports `Task` / `TaskList` / `TaskStatus` / `TaskType` / `CreateTaskRequest`
- [ ] No file imports `TasksScreen` / `TaskDetailScreen` / `TaskNewScreen` / `TaskOutcomesCard`
- [ ] `api.listTasks` / `getTask` / `createTask` no longer exist
- [ ] `fxTasks` no longer exists
- [ ] `/tasks`, `/tasks/new`, `/tasks/:taskId` routes return 404 / not-found
- [ ] ApprovalDetail hero has no Task chip even when approval has `task_id`
- [ ] AgentDetail Settings tab has no «owner» row
- [ ] Hire wizard ReviewStep shows «Activate immediately» checkbox, default checked
- [ ] Hire with checkbox checked → agent appears active (or as backend says)
- [ ] Hire with checkbox unchecked → agent appears as draft, success message reflects this
- [ ] `npm run lint` clean. `npm run build` clean.

## 6. Browser test

After Step 8:
1. Open `/approvals/:id` for an approval with `task_id` → no task chip
2. Type `#/tasks` → not-found
3. Open agent → Settings tab → no owner row
4. Hire flow → Review step has «Activate immediately after hiring» checkbox, default on. Hire → success.
5. Hire flow with checkbox unchecked → success message says «hired as a draft — activate from its page»

## 7. Progress log

- 2026-05-02 02:00 — plan drafted; awaiting confirmation before Step 1.
- 2026-05-02 — All 9 steps complete. Step 1 verified scope + found 2 additions (`lib/filters.ts` TASK_STATUS_FILTERS + `tours/training-fixtures.ts` Task imports/fields). Step 2 stripped task chip + getTask + taskContext from ApprovalDetailScreen. Step 3 deleted 4 task-related files. Step 4 removed routes + imports from `index.tsx`. Step 5 deleted `api.listTasks/getTask/createTask` + decideApproval task side-effects + 5 types in lib/types.ts + fxTasks (~150 LOC) + task() factory + filters cleanup + training-fixtures cleanup. Step 6 removed owner MetaRow + extended to «created by» MetaRow in AdvancedTab (same root cause); dropped `users` state, `userName` helper, listUsers call, User import. Step 7 removed mock activation hack + added `autoActivate: boolean` state + checkbox в ReviewStep + conditional activateVersion + success page branch by `hiredAgent.status`. Step 8 lint + build clean (bundle 590.28 kB, ~−19 kB cumulative). Step 9 docs updated: handoff-prep decision log, backend-gaps § 6 marked UI removed, CLAUDE.md Key gaps annotated.
