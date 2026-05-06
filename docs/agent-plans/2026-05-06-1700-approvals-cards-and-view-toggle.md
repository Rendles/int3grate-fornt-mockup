# Approvals — card grid, view toggle, inline reject everywhere

**Created:** 2026-05-06 17:00
**Status:** Draft — awaiting confirmation before step 1
**Related:**
- `docs/agent-plans/2026-05-06-1500-approvals-quick-actions-promotion.md` (just shipped — quick actions in table view with Dialog)
- `docs/agent-plans/2026-05-04-1714-approvals-inline-actions-sandbox.md` (sandbox source)

---

## 1. Task summary

Перенести card-сетку из `/sandbox/approvals-inline` на продакшен `/approvals`. Добавить переключатель **Cards ↔ Table**. Reject reason — **inline-expand в обоих режимах** (диалог из текущей реализации удаляется): в card mode — внутри карточки (как в sandbox), в table mode — растягивающаяся под строкой панель.

Sandbox-страницу по-прежнему не трогаем по логике (миграция / удаление — отдельная задача), но **визуальные компоненты** (ApprovalCard, RejectInlineForm) вынесем в shared, чтобы избежать дубликата.

## 2. User decisions (already locked in)

| Развилка | Решение |
|---|---|
| Default режим | **Cards** |
| Persistence | **localStorage** (`proto.approvals.view.v1`) |
| Reject UI | **Inline-expand в обоих режимах** (Dialog удалить) |
| Pagination vs infinite scroll | **Pagination в обоих** (как сейчас в table) |

Что НЕ переносим из sandbox: жёлтый «preview» баннер, кнопка «Reset preview», `MockBadge` в eyebrow, infinite-scroll через IntersectionObserver.

## 3. Current repository state

- `src/prototype/screens/ApprovalsScreen.tsx` — после step 5 предыдущего плана: row-list, ✓/✕ buttons на pending rows, Reject через `Radix Dialog`, deferred commit + undo toasts, focus-ring CSS.
- `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx` — card grid, inline `RejectFormBody` (red panel внутри card), `ApprovalCard` функция-компонент локально в файле, infinite scroll, sandbox-only state.
- `src/prototype/components/undo-toast.tsx` + `src/prototype/lib/undo-toast.ts` — общие.
- `src/prototype/lib/filters.ts` — `APPROVAL_STATUS_FILTERS`, `ApprovalStatusFilter`.
- `src/prototype/components/icons.tsx` — содержит `IconCheck`, `IconX`, `IconArrowLeft`, `IconArrowRight`. Нужно проверить наличие иконок для toggle (table / cards / grid / list).

## 4. Relevant files inspected (already done in previous plan)

| Path | Role |
|---|---|
| `src/prototype/screens/ApprovalsScreen.tsx` | Целевой файл правки. |
| `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx` | Источник `ApprovalCard` + `RejectFormBody` + grid layout. |
| `src/prototype/lib/api.ts:557` | `decideApproval` — уже подключён в production через `scheduleCommit`. |

## 5. Assumptions and uncertainties

- **Pagination в обоих режимах работает корректно.** В sandbox использовался infinite scroll, но pagination + carousel of cards — стандартный паттерн (Pinterest grid не нужен). *(уверенность: высокая)*
- **localStorage hook** — простейший шаблон `useLocalStorageState<T>(key, default)`. Аналог уже встречался в проекте? Проверим в step 1 — если есть, переиспользуем; иначе пишем свой минимальный (синхронное чтение в инициализаторе useState). *(уверенность: средняя — может быть в utils, надо grep'нуть)*
- **Иконки переключателя.** Hugeicons, скорее всего, имеют `Grid01Icon` и `Menu01Icon` или `LayoutGrid` / `LayoutList`. Если нет — fallback на текстовые лейблы или простейшие SVG. *(уверенность: низкая, проверим в step 3)*
- **Row expand НЕ ломает row click navigate.** Если render reject-form *вне* строки (sibling в wrap-контейнере), onClick row'а не срабатывает на области формы. *(уверенность: высокая)*
- **`single-active-reject`** — открыт reject на одной row → клик ✕ на другой row закрывает первую и открывает вторую (как в sandbox). Не позволяем двум открытым формам одновременно. *(уверенность: высокая)*
- **Avatar fallback** — sandbox использует `agentName.slice(0, 2).toUpperCase()`. Production уже делает то же самое. *(уверенность: высокая)*
- **`MockBadge` в card view** — в production его нет ни в одном виде. *(уверенность: высокая)*

## 6. Proposed approach

**Расщепление на компоненты (после refactor'а):**

```
ApprovalsScreen
├── ViewToggle          (Cards | Table)
├── StatusFilter        (chips: pending / approved / rejected / all)
├── RejectInlineForm    (red panel, ≥4 chars, Cancel + Confirm — shared)
├── ApprovalCard        (Card variant — used in cards view)
├── ApprovalRow         (Table variant — wrapper that yields a row + slot
│                        for the expanded reject form)
├── Pagination
└── ToastStack          (already shared)
```

**Shared между production и sandbox:**

- `components/approval-card.tsx` — `ApprovalCard` (used by both production cards view AND sandbox)
- `components/reject-inline-form.tsx` — `RejectInlineForm` (used by both production cards/table views AND sandbox)

Sandbox начинает импортировать оба отсюда. Никаких поведенческих изменений в sandbox'е — он по-прежнему использует свой sandbox-only state (resolvedIds, toasts) и НЕ вызывает `decideApproval`. Просто визуальные компоненты теперь общие.

**Shape общих компонентов:**

```ts
// ApprovalCard — pure visual, no API
interface ApprovalCardProps {
  approval: ApprovalRequest
  agentName: string
  actionVerb: string
  isRejectExpanded: boolean
  rejectReason: string
  rejectTouched: boolean
  onOpenDetail: () => void
  onApprove: () => void
  onRejectStart: () => void
  onChangeReason: (v: string) => void
  onBlurReason: () => void
  onRejectCancel: () => void
  onRejectConfirm: () => void
}

// RejectInlineForm — pure visual, no state of its own
interface RejectInlineFormProps {
  reason: string
  touched: boolean
  minChars: number  // production: 4, sandbox: 4
  onChangeReason: (v: string) => void
  onBlurReason: () => void
  onCancel: () => void
  onConfirm: () => void
}
```

**Table mode reject expand:**

```tsx
<div className="approval-row-wrap"> {/* flex column, border-bottom */}
  <div className="agent-row" onClick={navigate}> {/* grid, no border */}
    ...avatar, summary, status, ✓/✕, →
  </div>
  {isRejectExpanded && (
    <div className="approval-row__reject-panel">
      <RejectInlineForm ... />
    </div>
  )}
</div>
```

CSS: `.approval-row-wrap` берёт на себя `border-bottom` (раньше был на `.agent-row`). Reject-panel получает inset red background через ту же палитру, что в card view.

**View toggle:**

```tsx
const [viewMode, setViewMode] = useLocalStorageState<'cards' | 'table'>(
  'proto.approvals.view.v1',
  'cards',
)
```

Переключатель — две `IconButton` рядом со status-чипсами справа: cards-icon + list-icon, активный получает `variant="solid"`/`color="blue"`, остальной `variant="soft"`. Подсказки через `title` + `aria-label`.

**Pagination layout:**

Pagination сейчас рендерится внутри `<div className="card card--flush">`. После правки:
- Card view: `<Pagination />` после `<Grid>` cards.
- Table view: `<Pagination />` внутри `<div className="card card--flush">` после Flex с rows (сохраняем текущий вид).

В обоих случаях используем общую переменную `visible.length` как `total`.

## 7. Risks and trade-offs

| Risk | Mitigation |
|---|---|
| Refactor ломает existing deferred-commit логику. | Step 1 — только Dialog → inline-expand, без новых режимов. Тесты регрессии после step 1. |
| Sandbox ломается при переходе на shared компоненты. | Step 2 — sandbox начинает импортировать shared компоненты только после того, как эквивалентность их с локальными копиями подтверждена (визуально и в коде). |
| Pagination сбрасывается при смене viewMode. | viewMode никак не связан с `page` state — page остаётся неизменным. Но если visible на новой странице другой (не сбрасывается, потому что filter не меняется) — это OK. |
| Стили reject-panel в table mode не совпадают с card view. | Используем тот же `RejectInlineForm` компонент, единый CSS-класс. |
| `useLocalStorageState` стал жирным API без нужды. | Делаем простейший inline в файле, без отдельного hook'а в lib (если в проекте уже нет общего helper'а — добавим только если позже понадобится в третьем месте). |
| Hugeicons могут не иметь `Grid01Icon` / `Menu01Icon`. | Если нет — используем `<IconCheck />` стиль / эмодзи / simple SVG. Step 3 верификация. Fallback decision документируется в плане. |
| Click на reject form внутри row-wrap не должен навигировать. | Reject panel — sibling row'а, не вложен. onClick `<div role="link">` не срабатывает. |
| Table-row Tab order ломается при expanded reject. | Tab после ✕ → textarea → Cancel → Confirm → следующая row. Логично. Проверим в step 4. |

**Trade-offs приняты:**
- ApprovalCard и RejectInlineForm выносим в shared, даже хотя sandbox планируется к удалению. **Почему**: иначе мы пишем дубликат сейчас, а через неделю удаляем sandbox — лишняя работа. Compactness > delayed-cleanup.
- Pagination в обоих режимах вместо infinite scroll. **Почему**: переключение режима не должно менять механику списка; меньше дёргание UI; consistency с другими списочными экранами проекта.

## 8. Step-by-step implementation plan

### Step 1 — Extract shared components

- NEW `src/prototype/components/reject-inline-form.tsx`:
  - Export `RejectInlineForm` — pure visual.
  - Reuse the `RejectFormBody` styling from sandbox (red `--red-a2` background, `≥ N chars` code chip, Cancel + Confirm buttons).
- NEW `src/prototype/components/approval-card.tsx`:
  - Export `ApprovalCard` — pure visual.
  - Reuse the layout from sandbox `ApprovalCard` (avatar+name+timestamp header, "wants to" body, footer with View Details + ✓/✕).
  - Imports `RejectInlineForm` for the expanded state.
- EDIT `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx`:
  - Remove local `ApprovalCard` and `RejectFormBody`.
  - Import shared from `components/approval-card` and `components/reject-inline-form`.
  - No behaviour changes.
- VERIFY: `/sandbox/approvals-inline` looks and behaves identically (regression check).

**Stop here. Report.**

### Step 2 — Replace Dialog with inline-expand in current table view

- EDIT `src/prototype/screens/ApprovalsScreen.tsx`:
  - Remove `Dialog.*` imports + the entire `<Dialog.Root>...</Dialog.Root>` block.
  - Replace `rejectTarget` state model (storing the approval) with `expandedRejectId: string | null`.
  - State: `rejectReason`, `rejectTouched` keep (now keyed by which row is expanded).
  - `handleRejectStart` opens the inline form on that row (closes any other open one).
  - Row render becomes:
    ```tsx
    <div className="approval-row-wrap"> { /* border-bottom moves here */ }
      <div className="agent-row" role="link" tabIndex={0} ...>
        ...
      </div>
      {expandedRejectId === a.id && (
        <div className="approval-row__reject-panel">
          <RejectInlineForm ... />
        </div>
      )}
    </div>
    ```
  - CSS in `prototype.css`: new `.approval-row-wrap` (flex column) with the border-bottom moved off `.agent-row` (or scoped via `.approval-row-wrap > .agent-row { border-bottom: 0 }`). New `.approval-row__reject-panel` — same red palette as the card form.
- VERIFY: ✓ button still works as before. ✕ now opens an inline panel under the row instead of a dialog. Confirm/Cancel/Esc behave correctly. `npm run lint && npm run build` clean.

**Stop here. Report.**

### Step 3 — Add view toggle (cards / table) with localStorage

- EDIT `src/prototype/screens/ApprovalsScreen.tsx`:
  - Add inline `useLocalStorageState<'cards' | 'table'>('proto.approvals.view.v1', 'cards')` (or use `useState` + `useEffect` if no shared hook exists). Keep it simple.
  - Render a `<ViewToggle>` (two IconButton'ы — cards / table) in the filter row, justify-end.
  - Wrap the existing list rendering in `viewMode === 'table' ? <TableList ... /> : <CardGrid ... />`.
  - For step 3 only: `<CardGrid>` is a placeholder — render the Table list both ways for now. Just verify the toggle persists and re-renders.
  - Confirm icon availability — Hugeicons probably has `LayoutGrid01Icon` / `Menu01Icon` or similar. If not, use `Grid` + `Bars` from existing icon set. Document chosen icons.
- VERIFY: toggle visible, clicks switch modes, refresh preserves choice. Both modes still render the table for now.

**Stop here. Report.**

### Step 4 — Build Card grid view

- EDIT `src/prototype/screens/ApprovalsScreen.tsx`:
  - Replace placeholder `<CardGrid>` with real implementation: `<Grid columns={{ initial: '1', sm: '2', lg: '3' }} gap="3">` mapping over `pageItems` to `<ApprovalCard ... />`.
  - Same `RejectInlineForm` is used inside each card via the `isRejectExpanded` prop.
  - All handlers (`handleApprove`, `handleRejectStart`, `confirmReject`, etc.) wire the same way as in table mode — they share the `expandedRejectId` state, so opening reject in one card closes it in another (consistent with table mode).
  - Pagination renders below the grid, in a separate `<Box>` (no surrounding `card card--flush` chrome).
- VERIFY:
  - Card view renders correctly at all breakpoints (1 / 2 / 3 columns).
  - ✓/✕, undo, Confirm reject all work identically to table mode.
  - Switching views mid-pending-decision doesn't break (toast keeps counting, decision still commits).
  - Pagination works in both modes.

**Stop here. Report.**

### Step 5 — Polish & a11y verification

- Verify Tab order in both modes:
  - Table: row → ✓ → ✕ → next row → ... When reject is expanded: row → ✓ → ✕ → textarea → Cancel → Confirm → next row.
  - Cards: card → View Details → ✓ → ✕ → next card. When reject is expanded: card → View Details → textarea → Cancel → Confirm → next card. (Note: in cards the View Details button replaces the row-link semantic.)
- Hover states consistent.
- Confirm `data-tour="approval-row"` and `data-tour="approvals-filter"` still resolve in both modes (touring a card or row).
- `aria-label` on ✓/✕ correct in both modes.
- `npm run lint && npm run build` clean.

**Stop here. Report.**

## 9. Verification checklist

- [ ] Sandbox `/sandbox/approvals-inline` works identically after step 1 (regression).
- [ ] Step 2: Reject opens inline below the row, not in a dialog. `Esc`-equivalent (Cancel button) closes it.
- [ ] Step 2: Inline form ≥4 chars validation behaves like before.
- [ ] Step 3: View toggle switches modes; reload preserves the choice.
- [ ] Step 4: Card grid renders at 1 / 2 / 3 columns based on viewport.
- [ ] Step 4: ✓/✕/Undo/Confirm reject work identically in cards and table.
- [ ] Step 4: Pagination works in both modes.
- [ ] Step 4: Switching modes mid-pending-decision keeps the toast and commits the decision after 5s.
- [ ] Default mode for first-time visitors is `cards`.
- [ ] Tab order is logical in both modes (step 5).
- [ ] `data-tour` selectors still resolve.
- [ ] `npm run lint && npm run build` clean.

## 10. Browser testing instructions for the user

After step 4, full regression run:

1. `http://localhost:5173/#/approvals` — should default to **Cards** view (clear localStorage if testing first-time experience: DevTools → Application → Local Storage → delete `proto.approvals.view.v1`).
2. **Approve in cards:** click ✓ on a card → card disappears, undo toast appears with countdown. Same as table.
3. **Reject in cards:** click ✕ → red panel expands inside the card, replacing the footer buttons. Type 1-3 chars → error visible. Type 4+ → Confirm sends decision, toast appears.
4. **Cancel reject:** open reject in card → Cancel → form collapses, no toast.
5. **Switch to Table:** click table-toggle → list view appears. Pagination still shows.
6. **Reject in Table:** click ✕ on a row → row stays in place, a red panel expands directly under it. Same validation.
7. **Cancel in Table:** Cancel collapses the panel.
8. **Single-active-reject:** open reject on row A → click ✕ on row B → row A's form closes, row B opens.
9. **Persistence:** switch to Table, reload → still Table. Switch back to Cards, reload → Cards.
10. **Mid-undo switch:** click ✓ in cards → switch to Table mid-countdown → toast still counts down → after 5s decision commits. Switch to "Approved" filter to verify.
11. **Pagination:** approve enough rows on page 1 to push some onto page 2, paginate, switch view → consistent.
12. **Sandbox unchanged:** `/sandbox/approvals-inline` looks and behaves identically.

## 11. Progress log

- 2026-05-06 17:00 — Plan drafted. Awaiting user OK to proceed with step 1.
- 2026-05-06 18:45 — **Step 6 — direction change.** User reversed the pagination decision: infinite scroll in BOTH modes (matches sandbox). Replaces the Pagination work from steps 4-5.
  - EDIT `src/prototype/screens/ApprovalsScreen.tsx`:
    - Removed `Pagination` import and both `<Pagination>` blocks (table + cards). Removed `page`, `pageSize`, `effectivePage`, `pageStart`, `pageItems`, `maxPage` derived state.
    - Removed `sortOldestFirst` helper and the `sorted` memo. Server order (newest first per spec) is what we render now — client-side sort would have to re-order on every page append, defeating the point.
    - Added `PAGE_SIZE = 12` (same as sandbox). New state: `items: ApprovalRequest[]`, `total: number`, `pageNum: number`, `loading`, `loadingMore`. New ref: `sentinelRef`.
    - Initial-load effect now passes `limit: PAGE_SIZE, offset: 0`, sets `items` / `total`, toggles `loading` from `true`. The pendingIds-cleanup logic is unchanged.
    - New `loadMore` async fn: guarded against double-fire (via `loadingMore` and `items.length >= total`); calls `api.listApprovals` with `offset: nextPage * PAGE_SIZE`; appends to `items`; bumps `pageNum`.
    - New IntersectionObserver effect: watches `sentinelRef`, fires `loadMore` when sentinel enters viewport (200px pre-load margin). Re-subscribes on `[items.length, total, statusFilter, loading, loadingMore]`.
    - Loading guard switched from `!approvals` to explicit `loading`. Empty / error guards unchanged.
    - `pageItems` references replaced with `visible` everywhere. Counts memo input switched from `sorted` to `items`.
    - Status filter chip onClick lost its `setPage(0)` (no longer relevant).
    - Sentinel + completion footer rendered once for both modes, below the conditional list. Footer copy mirrors sandbox: `Scroll for more · X of Y` / `Loading more…` / `All caught up · N approvals`.
  - UX side-effect: oldest-first sort dropped (incompatible with infinite scroll). Documented in code comment.
  - `npm run lint && npm run build` clean.
- 2026-05-06 18:15 — **Step 5 complete.** Polish + a11y verification:
  - EDIT `src/prototype/components/approval-card.tsx`: added `data-tour="approval-row"` to the card root so tour selectors resolve in card view too (sandbox inherits this — harmless, tours don't yet target sandbox).
  - Tab order verified mentally:
    - Table: row → ✓ → ✕ → next row. With reject expanded: row → ✓ → ✕ → textarea → Cancel → Confirm → next row. DOM order natural.
    - Cards: View Details → ✓ → ✕ → next card. With reject expanded: textarea → Cancel → Confirm → next card's View Details (footer replaced).
  - Hover states: `.card` is intentionally inert (no `.card--hover` modifier on ApprovalCard) — the card isn't clickable as a whole; actions go through explicit buttons. `:focus-visible` on `.agent-row` (already in step 5 of the previous plan) covers keyboard focus in table view.
  - Reject visual cue is mode-appropriate: row gets `--red-a2` background in table mode (no full border to color); card gets `--red-a6` border-color (the natural surface).
  - `aria-pressed` / `aria-label` / `title` already in place on toggle and on ✓/✕ from earlier steps.
  - `npm run lint && npm run build` clean.
- 2026-05-06 18:05 — **Step 4 complete.** Real card grid view:
  - EDIT `src/prototype/screens/ApprovalsScreen.tsx`:
    - Render branches on `viewMode`. Table branch unchanged from step 2.
    - Card branch: `<Grid columns={{ initial: '1', sm: '2', lg: '3' }} gap="3">` mapping `pageItems` to shared `<ApprovalCard>` (from step 1). Each card receives the same `rejectTarget` / `rejectReason` / `rejectTouched` state so a reject opened in one card / row stays in sync regardless of view-mode switch.
    - Card branch's Pagination renders below the grid in a plain `<Box mt="3">` (no `card card--flush` chrome — the cards themselves are the chrome).
    - `data-tour="approvals-card-grid"` attribute on the grid for future tour anchors.
    - `Grid` added to the radix-themes import.
  - Switching modes mid-pending decision: pending state lives outside the rendered branches, so the toast countdown and the row's hidden-from-visible state are preserved across mode switches. Mid-edit reject draft also survives — `rejectTarget` and `rejectReason` are screen-level state.
  - `npm run lint && npm run build` clean.
- 2026-05-06 17:50 — **Step 3 complete.** View mode toggle + localStorage persistence (cards / table):
  - EDIT `src/prototype/screens/ApprovalsScreen.tsx`:
    - Added `ApprovalsViewMode = 'cards' | 'table'` type, `VIEW_MODE_STORAGE_KEY = 'proto.approvals.view.v1'`, `readStoredViewMode()` helper for the lazy-init read.
    - State: `viewMode` initialised lazily from `localStorage`; effect mirrors changes back to storage.
    - New `ViewModeToggle` component (two `IconButton`s — `GridViewIcon` for cards, `Menu01Icon` for table). Active option is `variant="solid" color="blue"`, inactive `variant="soft" color="gray"`. `aria-pressed`, `aria-label`, `title` set on each. Used the modern `Icon` wrapper with direct hugeicons import (per CLAUDE.md guidance for new code).
    - Toggle placed in the filter row, right-aligned via `<Box flexGrow="1" />` after the status chips.
    - Render not yet branched on `viewMode` — placeholder for step 4. Toggle is functional and persists; the underlying list remains the table for both modes until step 4.
  - `npm run lint && npm run build` clean.
- 2026-05-06 17:35 — **Step 2 complete.** Dialog → inline-expand in table view:
  - EDIT `src/prototype/screens/ApprovalsScreen.tsx`:
    - Removed `Dialog` import + the entire `Dialog.Root` block at the bottom of the screen.
    - Removed now-unused imports (`TextAreaField`, `IconArrowLeft`).
    - Removed local `reasonInvalid` derived var (RejectInlineForm computes it internally).
    - Renamed `closeRejectDialog` → `closeReject`. `rejectTarget` state shape unchanged — still `{ approval, agentName, actionVerb } | null` and doubles as "which row is expanded".
    - Wrapped each row in a new `<div className="approval-row-wrap">` that hosts the `<div className="agent-row">` plus an optional `<div className="approval-row__reject-panel">` sibling. Reject panel renders `<RejectInlineForm>` (shared from step 1) when `rejectTarget?.approval.id === a.id`.
    - Row gets a soft `--red-a2` background while its reject panel is open — visual cue tying the two together.
    - Row's inline `borderBottom` removed; the wrap takes over via CSS.
    - Reject panel is a sibling of the row, NOT inside it — so onClick on the form doesn't navigate.
  - EDIT `src/prototype/prototype.css`:
    - NEW `.approval-row-wrap` (flex column, border-bottom on wrap, last-child reset, `> .agent-row { border-bottom: 0 }`).
    - NEW `.approval-row__reject-panel` (padding-only wrapper at `0 16px 16px`; RejectInlineForm paints its own red panel inside).
  - `npm run lint && npm run build` clean.
- 2026-05-06 17:20 — **Step 1 complete.** Extracted shared visual components:
  - NEW `src/prototype/components/reject-inline-form.tsx` — `RejectInlineForm`. Pure visual; takes `reason / touched / minChars / handlers`. Sandbox + (future) production both use it.
  - NEW `src/prototype/components/approval-card.tsx` — `ApprovalCard`. Pure visual; takes the same shape sandbox used + `rejectMinChars` parameter (was hard-coded to 4). Imports `RejectInlineForm` for the expanded state.
  - EDIT `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx` — removed local `ApprovalCard` and `RejectFormBody`; now imports `ApprovalCard` from the shared module. Pruned now-unused imports (`Avatar`, `Status`, `IconButton`, `TextAreaField`, `IconArrowLeft`, `IconArrowRight`, `IconCheck`, `IconX`, `ago`). Passes `rejectMinChars={4}` to keep behavior identical.
  - `npm run lint && npm run build` clean.
