# Approvals — promotion of quick approve/reject actions to production

**Created:** 2026-05-06 15:00
**Status:** Draft — awaiting confirmation before step 1
**Related:** `docs/agent-plans/2026-05-04-1714-approvals-inline-actions-sandbox.md` (sandbox source)

---

## 1. Task summary

Перенести быстрые ✓ / ✕ кнопки и undo-toast из sandbox-страницы `/sandbox/approvals-inline` в продакшен-страницу `/approvals`. Решения должны реально уходить в backend (`api.decideApproval`), но через **deferred commit** (5s окно с возможностью Undo, как в Gmail).

Layout продакшена остаётся **row-list** (как сейчас). Карточная сетка — будущая работа: пользователь добавит переключатель таблица / карточки отдельно.

Sandbox-страницу не трогаем — остаётся как design reference. Будет удалена отдельной задачей.

---

## 2. Current repository state

- `src/prototype/screens/ApprovalsScreen.tsx` — табличный row-list. Каждая строка — `<Link to="/approvals/:id">` поверх grid (5 колонок: avatar, summary, time, Status, arrow). Pagination внизу. Никаких inline-actions.
- `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx` — card grid, ✓/✕ icon-buttons на каждой карточке, inline reject-form (red panel inside card), ToastStack + ToastItem в правом нижнем углу с 5s undo. Вся sandbox-state — локальная, `api.decideApproval` НЕ вызывается.
- `src/prototype/lib/api.ts:557` — `decideApproval(id, decision, reason, userId)` мутирует `fxApprovals` напрямую через 1.5–3s, потом ещё через 2–3s выводит run в terminal. Кидает `already_resolved` если `a.status !== 'pending'`.
- `src/prototype/lib/types.ts:400-411` — `ApprovalDecisionRequest { decision, reason? }`, `ApprovalDecisionAccepted { approval_id, decision, status: 'queued' }`.
- `src/prototype/screens/ApprovalDetailScreen.tsx:152` — единственный текущий caller `decideApproval` в продакшене.

## 3. Relevant files inspected

| Path | Что взято |
|---|---|
| `src/prototype/screens/ApprovalsScreen.tsx` | Текущий row-layout, sort, filters, pagination, agentNameByRun, PolicyBanner. |
| `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx` | UndoToast, ToastStack, ToastItem, deferred-commit паттерн (но без backend-call), обработчики approve/reject. |
| `src/prototype/lib/api.ts:557-620` | Сигнатура decideApproval, ошибочные пути (already_resolved), task-side-effect отсутствует (удалён ранее). |
| `src/prototype/lib/types.ts:380-418` | ApprovalRequest, ApprovalDecisionRequest, ApprovalDecisionAccepted. |
| `src/prototype/screens/ApprovalDetailScreen.tsx:140-170` | Эталонный pattern вызова decideApproval с `{ ack, current }` обработкой ошибок. |
| `docs/gateway.yaml:575,592,599,1931,1942` | Backend контракт — POST /approvals/{id}/decision с reason `?` (≥ 1 char per spec). |

## 4. Assumptions and uncertainties

- **Spec говорит `reason` опционален**, но мы всё равно требуем его для reject (UX rule, не backend). Approve — без reason. *(уверенность: высокая)*
- **`decideApproval` идемпотентен в смысле "second call after first commits throws already_resolved"** — fixture-логика на строке 577 это подтверждает. Значит наш deferred-commit безопасен от двойных кликов (timer'ы единичные на approval id). *(уверенность: высокая)*
- **Spec backend семантика `reason` ≥ 4 chars** — нет такого ограничения в spec'е. Это UI-rule из sandbox. Оставим тот же порог. *(уверенность: средняя — можем повысить до 10 если попросишь)*
- **При навигации с pending decision** — мы должны flush'нуть всё немедленно, иначе пользователь нажал approve, ушёл на Activity, и его решение потерялось. Логика — в `useEffect` cleanup. *(уверенность: высокая)*
- **Race с другим оператором** — если pending идёт 5s и параллельно второй админ решает тот же запрос, наш decideApproval кинет `already_resolved`. Покажем error-toast и восстановим row. *(уверенность: высокая)*
- **Sandbox остаётся работать** после extract'а ToastStack — его внутреннее состояние остаётся sandbox-only, меняется только источник компонента. *(уверенность: высокая)*

## 5. Proposed approach

**Главная идея:** row остаётся row, но превращается из `<Link>` в `<div>` с явным навигационным «корешком» (правая стрелка) и явными action-кнопками. Это разрывает конфликт «click anywhere navigates vs. click button does action».

**Deferred commit (Gmail-style):**

```
user clicks ✓/✕  →  push toast{approvalId, decision, expiresAt: now+5000}
                 →  hide row from visible list (locally)
                 →  setTimeout 5000ms

5s tick:        →  on every tick update countdown in toast
                 →  on Undo: clear timeout, remove toast, unhide row, no API call
                 →  on expire / route-leave: clearTimeout, fire api.decideApproval(...)
                                            success: keep row hidden (real fixture mutated)
                                            already_resolved: warn + unhide row
                                            other error: error toast + unhide row
```

**Reject Dialog (Radix `Dialog`):** открывается по клику ✕, форма с textarea (≥ 4 chars), Cancel + Confirm reject. Confirm закрывает диалог и стартует тот же deferred-commit, что и approve.

**Reuse:** ToastStack + ToastItem выносятся в `src/prototype/components/undo-toast.tsx`. Sandbox начинает импортировать оттуда — никаких behavior-изменений в sandbox'е.

## 6. Risks and trade-offs

| Risk | Mitigation |
|---|---|
| Pending decision теряется при reload вкладки во время 5s окна. | По UX это считается "ничего не произошло" — Gmail работает так же. Не персистим pending в localStorage. |
| Pending decision теряется при навигации на другой роут (unmount ApprovalsScreen). | Cleanup эффект flush'ит все pending'и: вместо clearTimeout вызывает the commit immediately. Логи добавим в Activity через api. |
| Race с параллельным админом. | `already_resolved` ошибка ловится, показывается warn-toast «{Agent} already decided by {name}», row перерисовывается с актуальным статусом из ответа `current`. |
| Двойной клик по ✓ запускает второй timer. | Кнопки disabled на uid в pending; клик не регистрируется второй раз. |
| 5s undo окно слишком короткое для мис-клика. | Тот же порог уже валидирован в sandbox; поднимем до 8s если пользователи попросят. Не критично сейчас. |
| Опадание strict-mode двойного timer'а в dev. | useEffect cleanup правильно clearTimeout'ит — стандартный паттерн. |
| `<div onClick>` теряет accessibility (Tab, Enter). | Добавляем `role="link"`, `tabIndex={0}`, обработчик Enter/Space → navigate. ✓/✕ — это `IconButton` с `aria-label`, focus стандартный. |

**Trade-offs приняты:**

- Pending row пропадает из списка сразу (не остаётся в "approving…" состоянии). Альтернатива — оставлять в списке с приглушённой opacity и инлайн-плашкой "Approving in Ns — Undo" — была бы ближе к Gmail. Но в row-layout это дополнительная высота строки и моргание. Всплывающий toast в правом нижнем — визуально чище и совпадает с sandbox.
- Reject через Dialog (а не inline form в строке) — потому что row-layout не даёт места для expand'а формы, и Dialog даёт больше пространства под reason textarea + связные подсказки.

## 7. Step-by-step implementation plan

### Step 1 — Extract `UndoToast` shared component

- NEW `src/prototype/components/undo-toast.tsx`:
  - Export `UndoToast` interface, `ToastStack` component, `makeToastId()`, `nowMs()` helpers.
  - Поведение 1:1 с sandbox'ом (countdown через setInterval 250ms, dismiss на expire, кнопка Undo).
- EDIT `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx`:
  - Удалить локальные `ToastStack`, `ToastItem`, `UndoToast`, `makeToastId`, `nowMs`.
  - Import из нового модуля.
  - Никаких behavior-изменений.
- VERIFY: `/sandbox/approvals-inline` работает идентично прежнему.

**Stop here. Report.**

### Step 2 — Convert ApprovalsScreen row from Link to div + add quick action buttons

- EDIT `src/prototype/screens/ApprovalsScreen.tsx`:
  - Заменить `<Link>` row на `<div role="link" tabIndex={0} onClick onKeyDown>`. Сохранить тот же grid + класс `agent-row`.
  - Добавить колонку с ✓/✕ `IconButton` (зелёная / красная, soft) перед стрелочной колонкой. Только когда `a.status === 'pending'`.
  - Hover/focus visible — оставляем как у `agent-row`.
  - Стрелочная колонка остаётся, но теперь только визуальный affordance — навигация идёт по всей строке.
  - Обработчики ✓/✕ — `e.stopPropagation()` чтобы row-click не сработал.
  - Approve handler пока — заглушка `console.log`, проводка деферред-коммита в step 4.
- VERIFY: переходы по строке работают по клику и Enter; кнопки видны на pending; tab-order логичный.

**Stop here. Report.**

### Step 3 — Reject reason Dialog

- EDIT `ApprovalsScreen.tsx`:
  - Local state: `rejectTarget: { id, agentName, actionVerb } | null`, `rejectReason`, `rejectTouched`.
  - При клике ✕ — `setRejectTarget(...)`, открыть `<Dialog.Root open={!!rejectTarget}>`.
  - Dialog content: title `Reject — {agent} {action verb}`, `TextAreaField` (≥ 4 chars validation, error через `error` prop как у sandbox), Cancel + Confirm reject buttons.
  - Cancel закрывает диалог; Confirm — закрывает + вызывает reject handler с reason (заглушка как и в step 2).
- VERIFY: Dialog открывается, валидируется, закрывается по Cancel / Esc; reason обнуляется между открытиями.

**Stop here. Report.**

### Step 4 — Deferred commit + real `api.decideApproval` integration

- EDIT `ApprovalsScreen.tsx`:
  - Local state: `pendingIds: Set<string>` (для скрытия из visible list), `timers: Map<string, number>`, `toasts: UndoToast[]` (импортированный тип).
  - Import `ToastStack` из `components/undo-toast`.
  - `scheduleCommit(id, decision, reason)`:
    - markPending(id) → row уходит из visible
    - pushToast → таймер 5000ms
    - timer fires: `api.decideApproval(id, decision, reason, user.id)` →
      - success → удаляем pending-флаг, оставляем row невидимым (он уже не pending в backend), удаляем timer
      - `already_resolved` (Error.code) → warn-toast «Already decided», unhide, refetch (`setReloadTick`)
      - other → error-toast, unhide
  - `undoToast(toastId)`:
    - clearTimeout(timers.get(approvalId))
    - удалить из pendingIds → row возвращается
    - удалить toast
  - useEffect cleanup при размонтировании: `for (const t of timers.values()) clearTimeout(t); flush all pending decisions immediately` (синхронный fire-and-forget вызов decideApproval через `void api.decideApproval(...)` без ожидания).
  - `visible` filter: убирать pendingIds из items (как sandbox'е).
- ❗ Counts (filter chips) считаются от `approvals`, не от `visible` — pending decisions всё ещё технически pending, переход не свершился.
- VERIFY: повторим § 9 ниже.

**Stop here. Report.**

### Step 5 — Polish

- EDIT `ApprovalsScreen.tsx`:
  - Hover-state ✓/✕ кнопок (Radix variant `soft` → можно усилить через `color`).
  - `aria-label` на ✓/✕ — «Approve — {agent} {action}» и «Reject — {agent} {action}».
  - Если все строки текущей page стали pending → не оставлять пустой page слот; pagination сама пересчитается от `visible`.
  - Tooltip на ✓ / ✕ через `title` атрибут (как sandbox).
- VERIFY: a11y (Tab → ✓/✕ доступны, Enter активирует), pagination не разваливается.

**Stop here. Report.**

## 8. Verification checklist

- [ ] `/sandbox/approvals-inline` работает идентично (regression-check после step 1).
- [ ] Row на `/approvals` навигирует по клику и Enter / Space.
- [ ] ✓ кнопка скрывает row, показывает toast «Approved · {agent}» с countdown.
- [ ] ✕ кнопка открывает Dialog с reason textarea; ≥ 4 chars валидация работает; Cancel + Esc закрывают; Confirm стартует тот же deferred commit.
- [ ] Undo в течение 5s — row возвращается, decideApproval НЕ вызван (видно в DevTools network — но у нас mock; проверим через console.log в `decideApproval`).
- [ ] После 5s — `decideApproval` вызывается; через 1.5–3s mock orchestrator переводит approval в `approved`/`rejected`; reload показывает row в "approved" / "rejected" фильтре.
- [ ] Навигация на другой роут с pending decision — flush; reload показывает решённый approval.
- [ ] Race: открыть две вкладки, в первой approve + Undo, во второй reject — после reset в обеих видим reject (последняя выигрывает по timer expire).
- [ ] Empty / loading / error states (через dev-mode toggle) — не сломаны.
- [ ] `npm run lint && npm run build` clean.

## 9. Browser testing instructions for the user

После каждого step'а агент попросит проверить конкретный сценарий. Полный регрессионный прогон в конце:

1. Открыть `http://localhost:5173/#/approvals` (логин любым demo-юзером с правом approve, например `frontend@int3grate.ai`).
2. **Approve happy path:** click ✓ на любой pending → row пропадает, в правом нижнем углу toast с counter «Undo (5s)». Подождать 5s → toast исчезает. Перезагрузить страницу → переключить filter на «Approved» → этот approval там.
3. **Reject happy path:** click ✕ → диалог открывается. Ввести «test reason» → Confirm reject → Dialog закрывается, row пропадает, toast «Rejected · {agent}». 5s → reload → filter «Rejected» → approval там.
4. **Undo:** click ✓, потом сразу нажать Undo в toast → row возвращается на место, через 10s reload → approval всё ещё pending.
5. **Navigation flush:** click ✓, не дожидаясь 5s — переход на `/activity`. Вернуться на `/approvals`, переключить filter на «Approved» — approval должен быть там.
6. **Reject validation:** click ✕ → ввести 1-3 символа → Confirm → ошибка «At least 4 characters», Dialog не закрывается.
7. **Esc closes dialog without commit:** click ✕ → Esc → Dialog закрылся, row остался pending, toast НЕ появился.
8. **Sandbox unchanged:** `/sandbox/approvals-inline` визуально и поведенчески идентичен — это regression-check.

## 10. Progress log

- 2026-05-06 15:00 — Plan drafted. Awaiting user OK to proceed with step 1.
- 2026-05-06 15:20 — **Step 1 complete.** Extracted UndoToast helpers + ToastStack:
  - NEW `src/prototype/lib/undo-toast.ts` — `UndoToast` interface, `makeToastId()`, `nowMs()`.
  - NEW `src/prototype/components/undo-toast.tsx` — `ToastStack` component + internal `ToastItem`.
  - EDIT `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx` — removed local copies, imports from new modules.
  - Split into two files (lib/types vs component) per `react-refresh/only-export-components` rule.
  - `npm run lint && npm run build` clean.
- 2026-05-06 16:35 — **Step 5 complete.** Polish:
  - EDIT `src/prototype/prototype.css`: added `.agent-row:focus-visible` rule (2px accent outline, inset, with the same `gray-3` hover background). Anchor-based rows kept their browser default focus ring; the new `<div role="link">` rows in /approvals didn't have one until now.
  - EDIT `src/prototype/screens/ApprovalsScreen.tsx`: pagination self-correcting via derived `effectivePage = min(page, maxPage)`. No `setState` in effect (ESLint `react-hooks/set-state-in-effect`) and on Undo the user bounces back to their original page automatically — `page` state never moved.
  - Items already covered in earlier steps and re-verified: `aria-label` and `title` on ✓/✕ buttons (step 2); `data-tour="approval-row"` preserved on the row (step 2); empty / error / loading states unchanged.
  - `npm run lint && npm run build` clean.
- 2026-05-06 16:20 — **Step 4 complete.** Deferred commit + real `api.decideApproval`:
  - EDIT `src/prototype/screens/ApprovalsScreen.tsx`:
    - State: `pendingIds` (Set), `toasts` (UndoToast[]). Refs: `timersRef` (Map id → timeout), `pendingDecisionsRef` (Map id → {decision, reason}), `userIdRef` (synced via effect — refs can't be mutated during render in React 19).
    - `scheduleCommit(id, decision, reason, agentName, actionVerb)` — adds to pendingIds, pushes toast, schedules `setTimeout` of `UNDO_WINDOW_MS = 5000` that calls `commitDecision`. Guarded against double-scheduling via `timersRef.current.has(id)`.
    - `commitDecision` — actually calls `api.decideApproval`. On `already_resolved` → `restoreRow` + `setReloadTick` (refetch shows real status). On other error → `restoreRow` + `setError` (visible at top via existing ErrorState path). On success → row stays hidden until next refetch shows it under a different filter.
    - `undoToast` — clears timer, deletes pending decision, restores row, removes toast. Handler reads `toasts` from closure (event-handler-only, so no stale-closure risk).
    - `dismissToast` — fired from the toast's own countdown when remaining ≤ 0; just removes the toast slot. Commit timer fires independently in parallel.
    - Unmount-flush effect (`useEffect(() => { ... }, [])`): on cleanup, fires `decideApproval` immediately for every pending decision (fire-and-forget). Maps captured into local consts on mount so cleanup binds to the same instance.
    - Filter / refetch effect: drops `pendingIds` whose underlying approval has actually committed (status no longer `pending`) — prevents stale ids from hiding rows in `/approved` or `/rejected` filters.
    - `visible = sorted.filter(a => !pendingIds.has(a.id))`. Counts and Pagination both use `visible` (not `sorted`) so the chip badge and the row count stay in sync.
    - `<ToastStack>` rendered inside `AppShell`, after the Dialog, so it appears over everything.
    - `handleApprove` now calls `scheduleCommit('approved', null, ...)`. `confirmReject` calls `scheduleCommit('rejected', reason, ...)` then closes the dialog.
    - Imports added: `useRef` (react), `useAuth` (auth), `ToastStack` (component), `makeToastId, nowMs, UndoToast` (lib).
  - `npm run lint && npm run build` clean.
- 2026-05-06 15:50 — **Step 3 complete.** Reject reason Dialog:
  - EDIT `src/prototype/screens/ApprovalsScreen.tsx`:
    - Added Radix `Dialog.Root` + `Dialog.Content` for the reject form. Title is dynamic — `Reject — {agent} {action verb}`.
    - State: `rejectTarget` (also acts as "is open" flag), `rejectReason`, `rejectTouched`. New constant `REJECT_REASON_MIN = 4` + new `RejectTarget` interface at module scope.
    - `handleRejectStart` now opens the dialog (replaces the prior console-log stub). `confirmReject` validates ≥ 4 chars, logs the confirmed reason, closes the dialog. `closeRejectDialog` resets all reject state. Cancel button uses `Dialog.Close`; Esc / overlay-click route through `onOpenChange`.
    - Dialog body: `<Caption>` row with required-asterisk + `≥ 4 chars` code chip, `TextAreaField` with `autoFocus` + `error` prop wired to `reasonInvalid`. Cancel + Confirm reject buttons in the footer (red Confirm).
    - Imports added: `Dialog`, `IconArrowLeft`, `TextAreaField`.
    - Approve handler still console-logs — wired in step 4.
  - `npm run lint && npm run build` clean.
- 2026-05-06 15:35 — **Step 2 complete.** Row → div + quick-action buttons:
  - EDIT `src/prototype/screens/ApprovalsScreen.tsx`:
    - Replaced `<Link>` row with `<div role="link" tabIndex={0} onClick onKeyDown>`. Enter / Space navigate.
    - New 6th column in grid (`80px`) before the arrow — holds ✓/✕ `IconButton` pair on pending rows, empty Box otherwise (so columns line up across mixed-status pages in 'all' filter).
    - Imports: removed `Link`, added `useRouter`, `IconButton`, `IconCheck`, `IconX`.
    - Stub handlers `handleApprove` / `handleRejectStart` log to console — wired to deferred-commit in step 4.
    - Buttons use `e.stopPropagation()` so row-click navigation doesn't fire under them.
    - `aria-label` on each IconButton — «Approve — {agent} {action}» / «Reject — {agent} {action}».
  - `npm run lint && npm run build` clean.
