# Retrain dialog — replace VersionNewScreen with a one-field modal

**Created:** 2026-05-06 19:00
**Status:** Draft — awaiting confirmation before step 1

---

## 1. Task summary

Заменить страницу `/agents/:agentId/versions/new` (полноценный экран с моделями / temperature / max_tokens) на компактный **Retrain dialog** на странице деталей агента. Показываем одно реальное поле — Brief (`instruction_spec`). Vocab перевозим под концепт «retrain», как в плэйбуке (`docs/ux-spec.md` § 8 — `Train` / `Brief` instead of `Configure` / `Prompt`).

## 2. User decisions (already locked in)

| Развилка | Решение |
|---|---|
| Где запускать | Кнопка только на Advanced tab (заменяет «New setup» на «Retrain»). |
| Modal vs page | Modal (Radix Dialog). |
| Поля формы | Только `Brief` textarea + (свёрнутая) панель previous brief. |
| Активация | Always immediate (`createAgentVersion` + `activateVersion` подряд); никакого чекбокса. |
| Старый VersionNewScreen | Удалить файл + роут. |

## 3. Current repository state

- `src/prototype/screens/VersionNewScreen.tsx` (260 строк) — полная страница с textarea для brief, dropdown'ом моделей (`claude-opus-4-7` / `claude-sonnet-4-6` / `claude-haiku-4-5`), `max_tokens` input'ом, `temperature` input'ом, чекбоксом «activate immediately». Заголовки полей: `instruction_spec`, `model_chain_config` — **прямо машинные имена в UI**, нарушение vocab rule из CLAUDE.md.
- Роут `/agents/:agentId/versions/new` зарегистрирован в `src/prototype/index.tsx`.
- На AgentDetailScreen `ActiveVersionCard` (Advanced tab) кнопка «New setup» с `<IconPlus />` ведёт на `/agents/:id/versions/new`.
- На Overview tab «Not configured yet» card имеет аналогичную кнопку «Create v1» с тем же путём (для агентов без `active_version`).
- `api.createAgentVersion(agentId, input)` принимает `instruction_spec` + опциональные `memory_scope_config / tool_scope_config / approval_rules / model_chain_config` (все `Record<string, unknown>`). Mock дефолтит отсутствующие в `{}`.
- `api.activateVersion(agentId, versionId)` — отдельный вызов; внутри mock переключает `is_active` и trims `agent.status` от `draft` к `active`.

## 4. Why we change the call shape

Spec `CreateAgentVersionRequest` маркирует `*_config` как `additionalProperties: true`. UI намеренно не редактирует эти opaque объекты в retrain flow. Мы не передаём в новый version пустые `{}` (которые бы стёрли state на бэкенде), а **forward'им текущие** значения с предыдущей `active_version`. UI меняет только brief; всё остальное остаётся ровно как было.

Если у агента нет `active_version` (первый retrain ≡ initial setup), forward'им `{}` — единственный возможный fallback.

## 5. Assumptions and uncertainties

- **`POST /agents/{id}/versions` with the same `*_config` works on real backend** — должен, spec ничего не запрещает. Но это не верифицировано на live. *(уверенность: средняя)*
- **`activateVersion` после `createAgentVersion` — стандартный двух-стадийный flow** — да, подтверждено в мок-комментарии (`Phase 6`) и handoff-prep. *(уверенность: высокая)*
- **`<Dialog.Content>` достаточно широк для удобной textarea** — Radix Themes `maxWidth="640px"` подойдёт. *(уверенность: высокая)*
- **Radix Themes overrides скруглений уже applies к Dialog контенту** — проверено ранее (мы убрали `.prototype-root` префикс из RADIX OVERRIDES). *(уверенность: высокая)*
- **Modal-портал не поглощает Esc / overlay-click** — Radix Dialog имеет это встроено, плюс `onOpenChange` обработчик. *(уверенность: высокая)*

## 6. Proposed approach

**RetrainDialog компонент** (`src/prototype/components/retrain-dialog.tsx`):

- Props: `open`, `onOpenChange(boolean)`, `agent: Agent`, `currentVersion: AgentVersion | null`, `onRetrained?(newVersion: AgentVersion): void`.
- Internal state: `brief: string` (init из `currentVersion?.instruction_spec ?? ''`), `busy`, `error`, `expandedPrev: boolean`.
- При open'е modal'а — local state перенастраивается (через `useEffect([open, currentVersion])`).
- Submit:
  - validate: `brief.trim().length >= 1`.
  - `await api.createAgentVersion(agent.id, { instruction_spec: brief.trim(), ...forwardedConfigs })`
  - `await api.activateVersion(agent.id, newVersion.id)`
  - `onRetrained?(newVersion)` → закрываем modal.
  - Errors → отрисовываем в modal, не закрываем.
- Layout:
  - Title: динамический.
    - С `currentVersion`: «Retrain {Name}».
    - Без: «Brief {Name}».
  - Description: одно предложение про что произойдёт («Save replaces the current setup. The next chat will use the new brief.»).
  - Поле: textarea `Brief` (label поверх, required asterisk, ≥ 1 char). minHeight 240px, lineHeight 1.5.
  - Если есть `currentVersion`: ниже свёрнутая `<details>` или собственный `<button>` toggle — «See previous brief». Раскрывается inline в красно-серой панели (read-only).
  - Footer: `Cancel` (Dialog.Close) + primary submit «Retrain {Name}» / «Save brief».
- Error: `<Banner tone="warn">` сверху от формы.

**AgentDetailScreen**:

- В parent добавляем `retrainOpen: boolean` state и handler `handleRetrained(v)` — refetches agent (чтобы `active_version` обновился) и закрывает.
- `ActiveVersionCard`: «New setup» → «Retrain». `IconPlus` → можно оставить или поменять на иконку обучения (не критично). onClick = setRetrainOpen(true). Убираем `<a href>` → `<Button onClick>`.
- Overview tab «Not configured yet» card: кнопка `Create v1` тоже триггерит тот же modal. Текст переименовываем в `Set up brief` или `Train {Name}`.
- `<RetrainDialog>` монтируется один раз внутри AgentDetailScreen (после AppShell), shared между обоими entry-points.

**Cleanup:**

- DELETE `src/prototype/screens/VersionNewScreen.tsx`.
- DELETE из `src/prototype/index.tsx` импорт `VersionNewScreen` + роут `/agents/:agentId/versions/new`.

## 7. Risks and trade-offs

| Risk | Mitigation |
|---|---|
| Real backend требует `*_config` обязательно при createAgentVersion. | Forward'им current version'а целиком — backend получит идентичные объекты, ничего не теряется. |
| `activateVersion` падает после успешного create — частично применённое состояние. | `error.message` показываем в modal'е; пользователь видит «Created but failed to activate». При retry попадёт в правильное состояние. Можно потом вызывать `activateVersion(newVersion.id)` руками через future API. |
| Old screen file удалён, но кто-то bookmark'нул `/agents/:id/versions/new`. | Переход на этот hash просто упадёт в `NotFoundScreen`. Это OK — у нас нет долгоживущего production'а. Альтернатива: добавить redirect в `index.tsx` → `/agents/:id/advanced`. Я бы не делал — лишняя сложность. |
| Modal closes mid-submit потеряет work. | `busy` блокирует Cancel-button и `onOpenChange` (чтобы Esc не закрывал во время save'а). |
| Tour pointing at `version-new` selector. | Глобальный grep — если найду selector'ы в `tours/`, обновлю в этом же step'е. |
| User expects to keep editing other knobs (model, temperature). | Vocab rule прямо запрещает их exposure. Новых требований не было. Если потребуется в будущем — отдельный «Power options» surface, не часть retrain flow. |

## 8. Step-by-step implementation plan

### Step 1 — Build `RetrainDialog`

- NEW `src/prototype/components/retrain-dialog.tsx`:
  - Props и behavior как § 6.
  - Reuses `TextAreaField`, `Banner`, Radix `Dialog.Root` / `Dialog.Content`.
  - Forward configs: `currentVersion?.memory_scope_config ?? {}`, etc.
  - Не зовётся ниоткуда пока — просто компонент.
- Lint+build clean.

**Stop. Report.**

### Step 2 — Wire `RetrainDialog` into AgentDetailScreen + replace buttons

- EDIT `src/prototype/screens/AgentDetailScreen.tsx`:
  - State: `retrainOpen`, handler `handleRetrained` (refetch + close).
  - `ActiveVersionCard` (на Advanced tab): кнопка «New setup» → `<Button onClick={() => setRetrainOpen(true)}>Retrain</Button>`. Убрать `<a href>`-pattern.
  - Overview «Not configured yet»: кнопка `Create v1` → `Set up brief` (тот же trigger).
  - Mount `<RetrainDialog open={retrainOpen} onOpenChange={setRetrainOpen} agent={agent} currentVersion={activeVersion} onRetrained={handleRetrained}/>` после AppShell-children.
- VERIFY: дважды трогать одну кнопку — modal не повторяется. После save UI обновился (новый version.id, новая `created_at`).
- Lint+build clean.

**Stop. Report.**

### Step 3 — Delete VersionNewScreen + route

- DELETE `src/prototype/screens/VersionNewScreen.tsx`.
- EDIT `src/prototype/index.tsx`: убрать import `VersionNewScreen` + роут `/agents/:agentId/versions/new`.
- Grep по проекту на оставшиеся ссылки `versions/new` — починить или удалить (в tours, screens, и т.д.).
- Lint+build clean.

**Stop. Report.**

## 9. Verification checklist

- [ ] Advanced tab: «Retrain» кнопка открывает modal.
- [ ] Modal preloaded'ом current brief, textarea фокусирована.
- [ ] Preview previous brief разворачивается / сворачивается.
- [ ] Empty brief blocks submit; ≥ 1 char проходит.
- [ ] Successful save: modal закрывается, `active_version.version` инкрементировался, `created_at` обновился.
- [ ] Overview Not-configured-yet тоже триггерит тот же modal.
- [ ] Cancel/Esc/overlay click закрывают modal без save'а.
- [ ] Mid-busy state: Cancel disabled, Esc no-op.
- [ ] Bookmark `/agents/:id/versions/new` → 404 (NotFoundScreen).
- [ ] `npm run lint && npm run build` clean.
- [ ] Visible UI text: nowhere does `instruction_spec`, `temperature`, `max_tokens`, `model_chain_config`, `claude-...` appear.

## 10. Browser testing instructions

After step 3:

1. `http://localhost:5173/#/agents/<some-active-agent>/advanced`.
2. Кликнуть **Retrain** в шапке Current setup card → modal открывается, в textarea предзаполнен текущий brief.
3. Раскрыть «See previous brief» (если показывается) → красно-серый блок с прежним текстом.
4. Стереть весь текст в textarea → primary button становится disabled / показывает required-error.
5. Ввести новый brief, нажать **Retrain {Name}** → modal закрывается через 1-2с (mock delay), на странице version v++ видна.
6. Открыть агента у которого `active_version === null` (через DevTools mutation, или новый агент без setup'а) — Overview tab: кнопка «Set up brief» открывает тот же modal с пустой textarea.
7. Cancel / Esc / клик по overlay → закрывают без save'а.
8. Открыть `http://localhost:5173/#/agents/<id>/versions/new` напрямую → fallback NotFoundScreen.
9. Vocab grep на `/agents/...` страницах: нигде не должно встречаться `temperature`, `max_tokens`, `instruction_spec`, имена моделей.

## 11. Progress log

- 2026-05-06 19:00 — Plan drafted. Awaiting user OK to proceed with step 1.
- 2026-05-06 19:40 — **Step 3 complete.** Removed VersionNewScreen + route:
  - Grep'нул `versions/new` / `VersionNewScreen` / `version-new` — единственные ссылки были в `index.tsx` (импорт + роут) и в `screens/VersionNewScreen.tsx` сам файл. В `tours/` ничего не нашлось.
  - DELETE `src/prototype/screens/VersionNewScreen.tsx` (260 строк).
  - EDIT `src/prototype/index.tsx`: убран импорт `VersionNewScreen` и роут `/agents/:agentId/versions/new`. Бывший bookmark на этот URL теперь падает в `NotFoundScreen`.
  - `npm run lint && npm run build` clean. Bundle −7 kB JS (старая страница содержала dropdown моделей, temperature/max_tokens поля, prompt-стартер).
- 2026-05-06 19:30 — **Step 2 complete.** Wired `RetrainDialog` into AgentDetailScreen:
  - EDIT `src/prototype/screens/AgentDetailScreen.tsx`:
    - State `retrainOpen` + handler `handleRetrained` (refetches agent so `active_version` and `updated_at` reflect the new server state).
    - `RetrainDialog` mounted once after the page wrapper.
    - `OverviewTab` accepts `onRetrain` prop. The "Not configured yet" card's «Create v1» button became «Set up brief» and triggers the dialog instead of `<a href>`-navigating.
    - `AdvancedTab` accepts `onRetrain`. Passes through to `ActiveVersionCard`.
    - `ActiveVersionCard` signature changed: `agentId` → `agentName`, plus `onRetrain`. The «New setup» link is now a «Retrain {firstName}» ghost button.
    - Banner copy on Advanced tab updated: «Re-creating a setup activates…» → «Retraining replaces the current brief and archives the previous version.»
  - `npm run lint && npm run build` clean. Bundle +2 kB JS for the new dialog wiring.
- 2026-05-06 19:15 — **Step 1 complete.** Built `RetrainDialog`:
  - NEW `src/prototype/components/retrain-dialog.tsx` — self-contained, not yet wired up.
  - Single textarea for the brief; collapsible "See previous brief" panel; Cancel + primary submit (`Retrain {firstName}` / `Save brief`).
  - Submit: `createAgentVersion` → `activateVersion` in sequence; forwards opaque `*_config` from current version verbatim (so backend-side state doesn't reset to `{}`).
  - Open / overlay / Esc blocked while busy.
  - Open-reset state via `useEffect`: pinned with eslint-disable on `react-hooks/set-state-in-effect` (same workaround as ApprovalsInlineScreen).
  - `npm run lint && npm run build` clean.
