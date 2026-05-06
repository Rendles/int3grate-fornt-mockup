# Approvals — inline actions sandbox preview

**Status:** draft, awaiting user approval before Step 1.

## 1. Task summary

Sandbox-превью новой реализации `/approvals`, где у каждой строки появляются inline approve/reject действия — без захода на детальный экран. Делаем строго как preview, по образцу team-bridge: новый screen в `src/prototype/screens/sandbox/`, отдельный hash-роут `/sandbox/approvals-inline`, sidebar-пункт с muted "preview" badge. Production `/approvals`, `/approvals/:id`, dashboard-widget на Home — **не трогаем**.

Out-of-scope (явно отказались на предыдущем шаге):
- ❌ Risk-tier gating / клиентский heuristic «high-risk action».
- ❌ Изменения dashboard-widget'а или detail-screen'а.
- ❌ Bulk approve.
- ❌ Backend-flag предложения (формализация поля будет позже, если эту идею промотируем).

В рамках preview:
- ✅ Approve = single click → optimistic remove + 5-секундный undo-toast.
- ✅ Reject = expand-row с reason input ≥ 4 символов, submit прямо в строке.
- ✅ Click по остальной части строки — по-прежнему ведёт на `/approvals/:id`.
- ✅ Status-filter сохраняется как есть.

## 2. Current repository state

- `src/prototype/screens/ApprovalsScreen.tsx` — production list. Строка-ссылка целиком (`<Link>`) на detail. Layout grid: `auto minmax(0, 1fr) 100px 110px 24px`. Filter pills, pagination, `PolicyBanner`.
- `src/prototype/screens/ApprovalDetailScreen.tsx` — detail screen с reason-семантикой (≥ 4 символов для reject, optional для approve), conflict-handling (`already_resolved`), async resume polling.
- `src/prototype/lib/api.ts:529` — `decideApproval(id, decision, reason, userId)` мутирует fixture-массив. **Sandbox эту функцию не вызывает** (см. § 4 ниже).
- Team-bridge sandbox precedent: `src/prototype/screens/sandbox/TeamBridgeScreen.tsx`, route `/sandbox/team-bridge` в `src/prototype/index.tsx:151`, sidebar-entry в `src/prototype/components/shell.tsx:72-79` с `dividerAbove: true` и `badge: { count: 'preview', tone: 'muted' }`.
- `MockBadge` (`components/common.tsx`) — компонент для маркировки sandbox-surface'ов; вариант `kind="design"` подходит для нашего случая.
- `RUN_TERMINAL`, `decideApproval`, `ApprovalDecisionAccepted`, `ApprovalRequest` — типы и функции уже описаны в `lib/types.ts` и `lib/api.ts`.
- Toast-компонента в проекте сейчас **нет** — придётся написать минимальную (см. Step 3).

## 3. Relevant files inspected

- `src/prototype/screens/ApprovalsScreen.tsx` — production source for layout, sort, filter logic.
- `src/prototype/screens/ApprovalDetailScreen.tsx` — copy / semantics для reason-field, conflict-banner.
- `src/prototype/screens/sandbox/TeamBridgeScreen.tsx` — sandbox pattern reference.
- `src/prototype/index.tsx` — flat routes array, нужно добавить `/sandbox/approvals-inline`.
- `src/prototype/components/shell.tsx:72-79` — sidebar entry pattern (badge `'preview'`, divider).
- `src/prototype/lib/api.ts:529` (`decideApproval`) — **НЕ вызываем** в sandbox, чтобы fixtures не мутировались между sandbox и production.
- `src/prototype/lib/types.ts:377` (`ApprovalRequest`).
- `src/prototype/lib/format.ts` — `prettifyRequestedAction`, `ago`.
- `src/prototype/components/common.tsx` — `MockBadge`, `Avatar`, `Status`, `Pagination`, `PageHeader`.
- `src/prototype/components/states.tsx` — `Banner`, `EmptyState`.
- `src/prototype/components/icons.tsx` — `IconCheck`, `IconX`, `IconArrowRight`, `IconApproval`, `IconArrowLeft` (для Cancel в reject form).

## 4. Assumptions and uncertainties

**Assumptions:**

- **Sandbox не должен мутировать общие fixtures.** Production `/approvals` и sandbox используют один и тот же in-memory массив (`fixtures.approvals`). Если мы вызовем `api.decideApproval(...)`, approval исчезнет и из production-списка тоже. Это нарушает принцип «sandbox preview = песочница». **Решение: не вызывать API вообще.** Sandbox держит локальный `Set<string>` resolved-id и игнорирует его при отрисовке. Это значит:
  - Никакого `already_resolved` конфликта в sandbox физически не возникает.
  - Никакого async resume / polling — потому что нечего ждать.
  - Перезагрузка страницы возвращает все строки в исходное состояние (потому что fixtures не тронуты). Это даже плюс — пользователь может перетестировать одни и те же rows.
  - Для дополнительного удобства добавляем кнопку «Reset preview» в header — сбрасывает локальный resolved-set без перезагрузки страницы.
- **Reason-валидация копирует production-поведение.** ≥ 4 символа для reject, optional для approve. Даже если API не зовём — валидируем для design-fidelity (в production-варианте это и будет значимо).
- **Undo-окно 5 секунд.** Захардкожено как константа в файле. В production (если промотируем) это будет аргументом для backend — нужен либо deferred-decision endpoint, либо rescind-endpoint. Пометим в `backend-gaps.md` только при промоушене.
- **Sidebar entry повторяет team-bridge.** Используем тот же `dividerAbove: true` (один divider на все sandbox'ы) и тот же `badge: { count: 'preview', tone: 'muted' }`. Если sandbox'ов станет много — будем разделять, но сейчас 2 элемента под одним divider'ом — нормально.
- **Audience.** Доступно всем ролям как и team-bridge. Demo-only, никакой role-gating.

**Uncertainties:**

- **Layout кнопок в строке.** Я предлагаю заменить chevron `→` на пару icon-кнопок и сохранить навигационный chevron справа: `[ago]  [Status]  [✓]  [✕]  [→]`. Альтернатива — две кнопки без chevron (клик по row body всё равно ведёт). Беру первый вариант — chevron эксплицитно сигналит «остальная строка кликается, ведёт на детали». Если визуально перегружено — пересмотрим в Step 2.
- **Reject expand-row vs popover.** Беру expand-row (как обсуждали). Popover был бы уместен если reason ввод — редкий случай; но для reject он required всегда, expand честнее показывает «строка занята reason'ом».
- **Toast или inline-undo.** Беру bottom-right toast (как в Gmail). Можно было бы делать inline-undo на месте удалённой строки, но (а) если фильтр меняется — теряется; (б) attribution «approve этого row» теряется когда строка вернулась в список. Toast накапливается стопкой и явно говорит «вот действие N, отменить?». Если несколько approve подряд — несколько toast'ов в стеке.
- **Permission to render inline buttons.** В production approval-list есть строки разных статусов (`approved`, `rejected`, `expired`). Inline-кнопки показываем **только** для `pending`. Resolved-строки рендерим как сейчас (без actions, click ведёт на detail).

## 5. Proposed approach

### Файлы

- **Новый:** `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx`
- **Изменяется:**
  - `src/prototype/index.tsx` — добавить роут `/sandbox/approvals-inline`.
  - `src/prototype/components/shell.tsx` — добавить sidebar-entry под существующим Team Bridge (тот же блок, без дополнительного divider'а — оба под одним).

### Структура экрана

```
┌─────────────────────────────────────────────────────────────────────┐
│  PREVIEW · sandbox  [preview badge]                                 │
│  Pending approvals — inline actions                                  │
│  Quick approve/reject without leaving the list.                      │
│  [Reset preview]                                                     │
│                                                                       │
│  ┌─ Sandbox banner ────────────────────────────────────────────────┐ │
│  │ Actions in this preview don't persist. Refresh to start over.   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  status: [Pending][Approved][Rejected][All]                          │
│                                                                       │
│  ┌─ row ───────────────────────────────────────────────────────────┐ │
│  │ [SA] Sarah wants to send refund of $42      2m  Pending  ✓ ✕ → │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─ row (rejecting) ───────────────────────────────────────────────┐ │
│  │ [MR] Marcus wants to charge $1200          5m  Pending  ✓ ✕ → │ │
│  │  ┌─ reason form ────────────────────────────────────────────┐   │ │
│  │  │ [textarea ≥ 4 chars]                                      │   │ │
│  │  │           [← Cancel]   [✕ Confirm reject]                  │   │ │
│  │  └───────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ...                                                                  │
│  [pagination]                                                         │
└─────────────────────────────────────────────────────────────────────┘

                                      ┌─ undo toast (bottom-right) ──┐
                                      │ Approved · Sarah's refund     │
                                      │                    Undo (4s)  │
                                      └───────────────────────────────┘
```

### State (sandbox-local, no API)

```ts
type LocalState = {
  resolvedIds: Set<string>          // approved or rejected locally
  expandedRejectId: string | null   // which row is in reject-form mode
  rejectReason: string
  rejectTouched: boolean
  toasts: Toast[]                   // stacked
}

type Toast = {
  id: string                        // uuid for key
  approvalId: string
  decision: 'approved' | 'rejected'
  agentName: string
  actionVerb: string
  expiresAt: number                 // Date.now() + 5000
}
```

### Поведение

- **Render:** `approvals.filter(a => !state.resolvedIds.has(a.id))` для pending-фильтра. Для прочих фильтров (`approved`/`rejected`/`all`) — sandbox-resolved строки тоже скрываем (они «как бы» переместились в resolved, но мы не имитируем переход; просто убираем их из preview).
- **Approve click:** добавить id в `resolvedIds`, push toast. Никаких API. Возможно, если reject уже expanded для этой строки — collapse.
- **Reject click:** установить `expandedRejectId = a.id`, focus на textarea.
- **Confirm reject:** валидация ≥ 4 символов; если ок — `resolvedIds.add(id)`, push toast, очистить expand-state. Иначе — error message.
- **Cancel reject:** очистить expand-state.
- **Undo click:** `resolvedIds.delete(approvalId)`, удалить toast.
- **Toast expire (5s):** удалить toast (но id остаётся в `resolvedIds`).
- **Reset preview:** `resolvedIds = new Set()`, toasts = [], expand-state = null.

### Toast component (минимальный, inline в файле экрана)

```tsx
function ToastStack({ toasts, onUndo }: { toasts: Toast[]; onUndo: (id: string) => void }) {
  return (
    <Box style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 80 }}>
      <Flex direction="column" gap="2">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onUndo={() => onUndo(t.id)} />)}
      </Flex>
    </Box>
  )
}
```
`ToastItem` использует `useEffect`-таймер для tick'а оставшихся секунд (rerender каждую секунду, чтобы показать «Undo (3s)»). При `expiresAt < now` — компонент сам себя демонтирует через callback в parent.

### Layout строки

Замена существующего grid'а:
- Сейчас: `gridTemplateColumns: 'auto minmax(0, 1fr) 100px 110px 24px'`
- Sandbox: `gridTemplateColumns: 'auto minmax(0, 1fr) 100px 110px auto auto 24px'` (добавили 2 cell под action-buttons; gap уменьшаем до 10px чтобы вместить).

Actions:
- Approve: `<Button size="1" variant="ghost" color="green">` с `<IconCheck>`. Title: «Approve — recorded immediately, 5 seconds to undo».
- Reject: `<Button size="1" variant="ghost" color="red">` с `<IconX>`. Title: «Reject — write a reason».

**Click-handling:** `<Link>` на всю строку конфликтует с inline-buttons (вложенные click'и). Решение: убираем `<Link>` с обёртки, делаем `onClick` на rows + `e.stopPropagation()` на action-buttons. Chevron `→` остаётся как визуальный сигнал. Альтернатива — `<Link>` на левую часть row + actions в отдельном `<Flex>` outside. Беру первый — проще CSS, проще keyboard navigation.

Keyboard / a11y:
- Row — кликабельный `div` с `role="link"`, `tabIndex={0}`, `onKeyDown` для Enter/Space.
- Action-buttons — нативные `<Button>`, фокус-trap отдельно.

## 6. Risks and trade-offs

| Risk | Severity | Mitigation |
| --- | --- | --- |
| User путает sandbox с production `/approvals` и думает, что approve реально сработал | medium | Sandbox banner прямо под header'ом + MockBadge + «Reset preview» button + sidebar-entry с «preview» badge. Копи прямо: «Actions in this preview don't persist». |
| Mutation fixture'ов через `decideApproval` залетает и в production | high | **Не вызываем `api.decideApproval` вовсе.** Только локальное состояние. Закомментировано в коде «// SANDBOX: no API call — fixture mutation would leak to /approvals». |
| Toast-стек растёт неограниченно если пользователь approve'ит много подряд | low | Стек ограничиваем последними 5 toast'ами; старые pop'аются досрочно. |
| Reject expand-row делает строку аномально высокой → ломает pagination визуально | low | Тестируем в браузере. У pagination и так свой блок снизу — не должно сломаться. Если ломается — добавляем `max-height` + scroll внутри expanded-row. |
| Многословные action-key вроде `payments.charge_with_extra_metadata` обрезаются | low | `prettifyRequestedAction` уже даёт human-friendly строку. Если переполнение — `truncate` class. |
| Click по row body конфликтует с click по action-button (event bubbling) | medium | `e.stopPropagation()` на onClick action-buttons. Тестируем — Enter на row не должен триггерить approve. |
| `<Link>` (Radix-router) → `div role="link"` может потерять prefetch / правильную навигацию | low | Используем `useRouter().navigate()` в onClick — то же поведение что `<Link>`. |
| Sandbox в sidebar занимает место + увеличивает «sandbox-noise» | low | Уже есть один (Team Bridge) — две preview-entry под одним divider'ом терпимо. Если станет три — пересмотрим. |
| Одновременно открыть reject-form в нескольких строках | low | Single `expandedRejectId` — открытие новой формы автоматически закрывает старую (потеря введённого reason'а). Простое поведение. Если кто-то жалуется — переделаем на массив. |

## 7. Step-by-step implementation plan

**Step 1 — Каркас экрана + роут + sidebar.**

- Создать `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx` со скелетом: `AppShell`, `PageHeader` («Pending approvals — inline actions»), `MockBadge`, sandbox info-banner, копия status-filter из production, рендер строк **БЕЗ** inline actions (т.е. строка визуально ≈ как в production, но обёрнута в наш onClick → navigate).
- Зарегистрировать роут `/sandbox/approvals-inline` в `src/prototype/index.tsx`.
- Добавить sidebar-entry в `src/prototype/components/shell.tsx` — под Team Bridge, без отдельного divider'а (оба под одним), label «Approvals preview», icon `IconApproval`, badge `'preview'`, **без** `dividerAbove`.
- Lint+build clean.

Verify: `#/app/sandbox/approvals-inline` открывается, отображает реальные approvals из fixtures, status-filter работает, click по строке ведёт на `/approvals/:id`. Sidebar показывает обе sandbox-entry.

**Step 2 — Inline buttons + reject expand-row (без toast'а).**

- Расширить grid строки на 2 ячейки (approve, reject).
- Добавить state: `resolvedIds`, `expandedRejectId`, `rejectReason`, `rejectTouched`.
- Approve click → `resolvedIds.add(id)`, `e.stopPropagation()`. Без toast'а пока.
- Reject click → `expandedRejectId = id`, фокус на textarea.
- Confirm reject (≥ 4) → `resolvedIds.add(id)`, очистить expand-state.
- Cancel reject → очистить expand-state.
- Render строки фильтрует через `!resolvedIds.has(id)`.
- Inline buttons рендерятся только для `status === 'pending'`.

Verify: approve мгновенно удаляет строку. Reject разворачивает форму. Valid reason → строка удаляется. Невалидный — error message. Click по row body всё ещё ведёт на detail. Click по button **не** триггерит navigate.

**Step 3 — Undo toast + 5s timer.**

- Inline-компонент `ToastStack` + `ToastItem` (bottom-right fixed, max 5 toasts).
- Approve и Confirm reject пушат toast.
- ToastItem каждую секунду rerender'ит remaining-time. На `expiresAt < now` — callback в parent → удалить из массива.
- Undo button → `resolvedIds.delete(approvalId)`, удалить toast.

Verify: approve → toast appears bottom-right с countdown. Через 5s исчезает. Click Undo до 5s → строка возвращается в список + toast исчезает. 5 toast'ов одновременно стекаются.

**Step 4 — «Reset preview» button + polish.**

- Кнопка `Reset preview` в actions PageHeader'а → сбрасывает state.
- Sandbox banner снизу под header'ом с честным текстом.
- Loading / error states match production.
- Keyboard navigation (Enter на row → navigate, Tab order: row → approve → reject).
- Disabled state кнопок во время чужого reject (если другая row в `expandedRejectId`) — нет, оставляем enable.
- Final lint + build.

Verify: `Reset preview` возвращает все скрытые строки. Banner текст ясен. Tab order ок. Lint+build clean.

## 8. Verification checklist

- [ ] `#/app/sandbox/approvals-inline` opens, renders.
- [ ] Sidebar показывает «Approvals preview» с muted preview badge, под Team Bridge.
- [ ] Production `/approvals` визуально не изменился, не открывает sandbox.
- [ ] После approve в sandbox → переход на `/approvals` показывает строку всё ещё в pending. (Fixtures не тронуты.)
- [ ] Approve в sandbox → строка скрывается, toast bottom-right с «Undo (5s)».
- [ ] Undo до истечения 5s → строка возвращается + toast исчезает.
- [ ] Reject → expand-row показывает textarea + Confirm/Cancel.
- [ ] Reject Confirm с reason ≥ 4 — строка скрывается, toast.
- [ ] Reject Confirm с reason < 4 — error inline, форма не submit'ится.
- [ ] Reject Cancel — форма закрывается без действия.
- [ ] Click по telу row → navigate на `/approvals/:id` (production detail).
- [ ] Click по action-button **не** триггерит navigate.
- [ ] `Reset preview` восстанавливает все строки + очищает toast'ы.
- [ ] Status-filter работает; resolved-локально строки не появляются ни в одном фильтре.
- [ ] Inline-buttons рендерятся только для `pending`-статуса.
- [ ] `npm run lint` clean.
- [ ] `npm run build` clean.

## 9. Browser testing instructions for the user

После каждого step'а:

1. Если dev server не запущен: `npm run dev`, открыть напечатанный URL.
2. Залогиниться (`frontend@int3grate.ai`, пароль `demo`).
3. Перейти по sidebar `Approvals preview` (после Step 1) или вручную — `#/app/sandbox/approvals-inline`.

**Step 1 — каркас:**
- Открывается экран с заголовком «Pending approvals — inline actions», MockBadge, sandbox banner.
- Список approvals идентичен production (минус inline buttons).
- Click по строке ведёт на `/approvals/:id`.
- В sidebar появилась `Approvals preview` под `Team Bridge`.

**Step 2 — inline actions без toast:**
- В строке справа — две icon-кнопки (зелёная ✓ и красная ✕) и chevron.
- Click на ✓ → строка мгновенно исчезает.
- Click на ✕ → под строкой разворачивается форма с textarea и кнопками.
- Ввод ≥ 4 символов + Confirm → строка исчезает.
- Ввод < 4 символов → error «At least 4 characters», submit не проходит.
- Cancel → форма закрывается, строка остаётся.
- Click по середине строки (имя агента) → переход на `/approvals/:id`.

**Step 3 — toast + undo:**
- Approve строки → справа снизу появляется чёрный (или dark-themed) toast с надписью «Approved · {agent} {action} · Undo (5s)».
- Counter тикает: 5s → 4s → 3s → 2s → 1s → исчезает.
- Click `Undo` до истечения → строка возвращается в список, toast исчезает.
- Approve трёх строк подряд → три toast'а столбиком.

**Step 4 — reset + polish:**
- Кнопка `Reset preview` в шапке.
- Approve / reject несколько строк → click `Reset preview` → все строки возвращаются, toast'ы пропадают.
- Tab по экрану — фокус идёт row → approve → reject → next row.
- Открыть production `/approvals` — состояние нетронуто.

**Edge case — переключение фильтра:**
- На фильтре `pending`: approve строку → она исчезает.
- Переключить на `all` → строка по-прежнему скрыта (sandbox-resolved).
- Reset → строка возвращается во все фильтры.

**Edge case — переход в detail и обратно:**
- Click по середине строки → попал на `/approvals/:id`.
- Browser back → вернулся в sandbox.
- Состояние sandbox (resolvedIds + toasts) сохраняется (лежит в component state, но React не размонтирует sandbox при back если router сохраняет его).
- *Если состояние теряется при back — это ОК для preview, в плане прописать как known limitation.*

## 10. Progress log

- **2026-05-04 17:14** — план создан. Подтверждены требования: sandbox preview по образцу team-bridge, no risk-tier gating, inline approve + reject + 5s undo, sidebar-entry с preview badge. Жду «делай» от пользователя для Step 1.
- **2026-05-04 17:30** — **Step 1 done.** Скелет экрана + route + sidebar-entry. Files touched: `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx` (new), `src/prototype/index.tsx` (import + route), `src/prototype/components/shell.tsx` (sidebar item under Team Bridge, no extra divider). Экран отображает реальные approvals из fixtures, status-filter работает, click по строке (или Enter / Space на focused row) ведёт на `/approvals/:id`. Banner "This is a preview — actions don't persist" + MockBadge `kind="design"` в eyebrow. Никаких inline-actions ещё нет — это Step 2. `npm run lint` clean. `npm run build` clean (334 modules, 721ms). Жду подтверждения для Step 2.
- **2026-05-04 17:42** — **Step 2 done.** Добавлены inline approve/reject actions + reject expand-row form. State: `resolvedIds: Set<string>`, `expandedRejectId: string | null`, `rejectReason`, `rejectTouched`. Логика: approve → resolvedIds.add → строка скрывается; reject → expand-row под строкой с textarea (autoFocus, ≥ 4 символа required) + Cancel/Confirm кнопки. Открытие reject на другой строке закрывает текущую форму (single-active-form). `visible` фильтрует `!resolvedIds.has(a.id)`. Counts пересчитываются от `visible`. Inline-кнопки рендерятся только для `pending`. Click на action-button делает `e.stopPropagation()` чтобы не триггерить navigate. Row вынесен в отдельный компонент `ApprovalRow`. Никакого toast'а ещё (Step 3). API не вызывается (sandbox rule). `npm run lint` clean. `npm run build` clean (334 modules, 640ms). Files touched: только `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx`. Жду подтверждения для Step 3.
- **2026-05-04 17:55** — **Step 3 done.** Undo toast stack: компоненты `ToastStack` (fixed bottom-right, `pointer-events: none` на контейнере, `auto` на самих toast'ах) + `ToastItem` (per-toast 250ms interval ticks the countdown, на expiry вызывает `onDismiss`). Toast push'ится в `onApprove` и `onRejectConfirm`, cap = 5 (`prev.slice(-5)`). Click `Undo (Ns)` → `undoToast(id)` → удаляет toast + удаляет `approvalId` из `resolvedIds` (строка возвращается в список). Auto-dismiss через 5s — toast исчезает, строка остаётся скрытой. Visual: dark card-tile с цветной иконкой (зелёная/красная), agent name, action verb, Undo button; min-width 320px, max 420px. Лёгкий fix лента: ESLint react-hooks/purity flag'нул `Date.now()` и `Math.random()` внутри компонента → вынес в module-level helpers `makeToastId()` / `nowMs()`. `npm run lint` clean. `npm run build` clean (334 modules, 639ms). Files touched: только `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx`. Жду подтверждения для Step 4.
- **2026-05-04 18:05** — **Step 4 done.** Добавлена `Reset preview` кнопка в actions PageHeader'а — рендерится только когда `hasSandboxState` true (есть resolved-rows ИЛИ активные toast'ы ИЛИ открытая reject-form), иначе header чистый. Click → сбрасывает `resolvedIds`, `toasts` и текущую reject-form. Polish-проверки: sandbox banner на месте (Step 1), MockBadge `kind="design"` в eyebrow на месте, loading/error/empty states match production, keyboard navigation работает (Tab: row → Approve → Reject → next row; Enter/Space на focused row → navigate). `npm run lint` clean. `npm run build` clean (334 modules, 641ms). Files touched: только `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx`. **Все step'ы плана закрыты — готово к ручной проверке по сценариям из § 9.**
- **2026-05-04 18:25** — **Layout swap (по запросу): rows → cards.** Пользователь попросил перекинуть на card-grid по образцу AgentsScreen. Заменил render-блок: `<Flex direction="column">` + `ApprovalRow` → `<Grid columns={{ initial: '1', sm: '2', lg: '3' }}>` + `ApprovalCard`. ApprovalRow удалён, ApprovalCard написан с нуля: avatar+name+triggered-by-line+status pill в шапке, "Wants to" caption + action verb в теле, ago timestamp, footer-зона с тремя кнопками (`Approve` | `Reject` | chevron-only `Details`). Reject-форма теперь раскрывается ВНУТРИ карточки и **заменяет** footer-buttons (вместо того чтобы появляться снизу). Resolved-карточки (non-pending в фильтре `all`) показывают только `Open details`. Card border окрашивается в красный при открытой reject-форме для visual-emphasis. Pagination переехала под Grid. Click-to-navigate на сам card-body убран — только explicit `Details` button (как в AgentsScreen). State-логика и toast'ы не изменились. `npm run lint` clean. `npm run build` clean (334 modules, 646ms). Files touched: только `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx`.
- **2026-05-04 18:40** — **Card layout fixes (две жалобы пользователя).** (1) Details-button был незаметным chevron-only ghost — заменил на text-link «View full details →» в отдельной meta-строке вместе с `ago` timestamp. (2) Action-buttons на разных карточках были на разной высоте из-за переменного контента сверху. Решение: оборачиваю meta-line + footer в `<Flex direction="column" gap="3" style={{ marginTop: 'auto' }}>` — bottom-block прижимается ко дну карточки, Grid auto-stretching уравнивает высоту карточек в одной строке, Approve/Reject теперь всегда выровнены. Pending footer стал чистым: только `[✓ Approve]` и `[✕ Reject]` с equal-flex (chevron-only Details выпилен). Resolved-карточки — только meta-line с «View full details» link (full-width Open details button убран — избыточен). При открытой reject-form meta-line с "View full details" link скрывается чтобы не отвлекать от формы. `npm run lint` clean. `npm run build` clean (334 modules, 663ms).
- **2026-05-04 18:55** — **Pagination → infinite scroll (по запросу).** Pagination-блок не вписывался в card-grid эстетику. Перевёл на тот же паттерн что в RunsScreen: `PAGE_SIZE = 12`, IntersectionObserver-sentinel с `rootMargin: '200px'`, accumulating `items` array, `total` приходит из envelope `api.listApprovals`. Sentinel-block снизу показывает `Loading more…` / `Scroll for more · X of Y` / `All caught up · N approvals`. `loading` / `loadingMore` отдельные флаги — initial-state не заменяет accumulated на pagination'е. Filter change сбрасывает items и грузит page 0 заново. `sortOldestFirst` убрал — server-natural newest-first порядок (как в RunsScreen) совместим с infinite-scroll, oldest-first ломает UX «новое сверху, scroll грузит более старое». Counts в filter-pills теперь приближённые (только то что загружено), как и в RunsScreen — приемлемо для preview. `react-hooks/set-state-in-effect` на initial setLoading/setItems отключил локально (как в RunsScreen — паттерн уже принятый). `npm run lint` clean. `npm run build` clean (334 modules, 672ms). Files touched: `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx`.
- **2026-05-04 19:10** — **Visual hierarchy inversion (по запросу): Details > Approve/Reject.** Цель — нюджить пользователя смотреть детали, а не сразу одобрять. Изменения: (1) `View full details` — primary CTA, `size="2" variant="soft"` (accent indigo), full-width, всегда первая кнопка bottom-block'а. (2) Approve / Reject — `size="1" variant="ghost"` (был `size="2" variant="soft"`), equal-flex второй строкой под Details. (3) `ago` timestamp перенёс в шапку рядом с triggered-by-line (`Triggered by Maria · 2m ago` единая строка), освободил bottom-block чисто под actions. (4) Resolved-карточки теперь показывают тот же primary `View full details` button (раньше — только text-link в meta), визуальная консистентность. (5) При reject-form expanded actions block заменяется формой как раньше. `aria-label` на Approve/Reject поменял на `Quick approve — …` / `Quick reject — …` для отражения новой иерархии. `npm run lint` clean. `npm run build` clean (334 modules, 657ms). Files touched: `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx`.
- **2026-05-04 19:25** — **Single-row actions layout (по запросу).** Объединил все три кнопки в одну строку: широкий `View full details` (`flex: 1`) + два `<IconButton>` (Radix Themes) справа — зелёный ✓ и красный ✕ для quick approve/reject. Иконки получают tooltip через `title` + `aria-label`. Resolved-карточки рендерят только Details (без icon-button'ов). Reject-form по-прежнему заменяет actions при expand. `IconButton` импортирован из `@radix-ui/themes`. `npm run lint` clean. `npm run build` clean (334 modules, 631ms). Files touched: `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx`.
- **2026-05-04 19:50** — **Five layout variants + picker (по запросу).** Добавил toolbar для переключения визуала карточки. Все варианты используют **только** поля из `ApprovalRequest` (никаких выдуманных данных) и shared bottom-block (ActionsRow / RejectFormBody). Варианты: (1) **Compact** — текущий baseline, avatar+name в шапке, "wants to" + verb в теле. (2) **Action hero** — verb становится `size="5" weight="medium"` headline, agent name → small subtitle. (3) **Timer** — pending карточки получают amber callout с `untilExpiry(approval.expires_at)` ("expires in 3h 50m"); resolved показывают "Created … · Resolved …". (4) **Evidence** — выводит первые 3 ключа из `approval.evidence_ref` (поле `Record<string,unknown>|null` уже в типе) как kv-rows + "+N more in details" если больше. (5) **Accent bar** — вертикальная цветовая полоса слева по `approval.status` (amber/green/red/gray) + строка "Needs domain admin approval" из `approval.approver_role`. Добавлен helper `untilExpiry()` (форматирует будущие даты — `ago()` только прошлое). Picker — кнопки toggle group под status filter, активный вариант solid indigo. `npm run lint` clean. `npm run build` clean (334 modules, 663ms).
- **2026-05-04 20:15** — **Variant set v2 (по запросу).** Action-hero / Timer / Evidence / Accent-bar отвергнуты пользователем. Удалил их вместе с `untilExpiry` helper. Compact оставил без изменений. Добавил 4 НОВЫХ варианта с разной компоновкой И разной раскладкой кнопок: (1) **Quote** — verb в виде italic pull-quote с accent-цветной вертикальной полосой слева, signature line «— {agent}, on behalf of {requested_by}». Кнопки: 3 равных labeled (`Review · Approve · Reject`). (2) **Banner** — full-width status-цветная полоса в шапке с `ago` («PENDING · 2m AGO»), затем avatar+name+triggered-by-line, затем «wants to»+verb. Кнопки stacked: full-width Details на верху, ниже Approve/Reject 50/50 ghost-стилем. (3) **Split** — двух-колоночный layout: левая колонка 96px (`gray-a2` фон) с avatar+name+ago по центру, правая — verb+actions. Кнопки: full-width Details + вертикально-stacked зелёная/красная IconButton'ы 1-size справа. Полностью отдельный card-container с `flex-direction: row`. (4) **Pills** — все метаданные как Radix Badges row сверху (agent, from {triggered_by}, status, ago, approver_role) + verb крупнее (`size="3"`) + actions внизу. Кнопки: solid primary `View full details` full-width + tiny ghost text-link «Quick: ✓ approve · ✕ reject» по центру. `Badge` импортирован, `approverRoleLabel` остался в импортах. `npm run lint` clean. `npm run build` clean (334 modules, 665ms).
- **2026-05-04 20:45** — **Variant set v3 — fundamentally different paradigms (по запросу).** Quote / Banner / Split / Pills отвергнуты, нужны принципиально другие mental models. Compact оставил, всё остальное снёс. Новые варианты сменяют paradigm: (1) **Inbox** — single-line dense rows как в Gmail/Linear. Parent рендерится как vertical Flex внутри одного bordered card-container (НЕ Grid). Каждая строка ~56px: avatar 28px + agentName + «wants to {action}» (truncated) + via {trigger} + ago + Status + ✓/✕ ghost icon-buttons + chevron. Click по строке → detail. Reject раскрывает форму под строкой. Parent рендеринг conditional: `variant === 'inbox' ? Flex : Grid`. (2) **Chat** — bubble-style диалог. Avatar 36px слева, серая bubble с скруглёнными углами справа («I'd like to {action}»), подпись `{agent} · {ago} · for {trigger}` под bubble. Кнопки: ghost `Open thread`, **solid green** `Approve`, soft red `Reject` — выровнены вправо как chat-reply actions. (3) **Memo** — interoffice-memo. Header strip «APPROVAL MEMO» mono-uppercase. Tabular field/value rows: `TO: domain admin / FROM: agent / RE: action / ON BHLF: trigger / WHEN: ago / STATUS: pill`. Все label'ы в mono-font. Dotted divider перед actions. Кнопки: soft Details + IconButton'ы. (4) **Receipt** — printed receipt. Mono-font на всём card, dotted-line dividers, label/value пары all-caps mono labels. Status — это **stamp** в bottom-center (rotate -2deg, 2px solid border, color-coded background per status). Кнопки: soft `View record` + IconButton'ы. Helper `MemoRow` вынесен на module-scope (react-hooks/static-components rule). `Badge` import убран (не используется). `approverRoleLabel` нужен для Memo TO line. `npm run lint` clean. `npm run build` clean (334 modules, 671ms).
- **2026-05-04 21:05** — **Variant exploration ended (по запросу: «Все фигня. Оставь только компактный»).** Ни один из 13 испробованных вариантов (action-hero / timer / evidence / accent-bar / quote / banner / split / pills / inbox / chat / memo / receipt) не понравился. Откатываю всё к compact baseline. Удалено: `CardVariant` type, `VARIANT_OPTIONS`, picker UI, `variant` state, conditional Grid/list рендеринг, helpers `statusAccent` / `untilExpiry`, компоненты `InboxRow` / `ChatCard` / `MemoCard` / `MemoRow` / `ReceiptCard`, dispatcher switch внутри `ApprovalCard`, `Badge` и `approverRoleLabel` импорты. Compact-вариант inlined обратно в `ApprovalCard` (без отдельного `CompactCard`). Все остальные слои (data-loading, infinite scroll, sandbox state, undo toast, reject form, sidebar entry) не тронуты. `npm run lint` clean. `npm run build` clean (334 modules, 679ms).
