# Pre-handoff cleanup tracker

Подготовка прототипа к передаче в бэкенд-разработку.

## Назначение

`docs/backend-gaps.md` — статический справочник «что мокнуто» (для бэкенд-команды как чек-лист).
**Этот документ** — рабочий трекер решений и работ, которые нужно выполнить **до передачи**:
- какие критические гэпы нужно подсветить ещё раз;
- какие фичи скрыть / переделать / оставить;
- какой «технический долг» в документации поправить;
- что осталось не проверено и нужен ли второй заход.

Каждая запись — точка принятия решения. По мере того, как принимаем — отмечаем `Status: decided` + конкретное решение, потом `Status: done`.

> Last reviewed: 2026-05-01

---

## 0. Architectural model — read this first

> **2026-05-01 update:** `docs/gateway.yaml` теперь синхронизирован verbatim с **live stage backend** (`https://stage.api.int3grate.ai/docs/openapi.yaml`, OpenAPI 3.2.0, version 0.1.0). Старый local-only расходящийся draft заархивирован как `docs/gateway-legacy-2026-04.yaml`. **Все upcoming решения о gaps опираются на live spec, не на старую местную «расширенную» версию.** Cross-check live spec показал что несколько gaps были overstated (см. § 1.3) или validated (§ 1.1, § 1.2, Tasks, Workspace CRUD, integration registry). Backend-команда: контракт = `docs/gateway.yaml`, всё что не там — отсутствует.



> Подтверждено пользователем 2026-05-01 в conversation. Это **корневой факт** платформы — все UI- и backend-решения должны его учитывать. Если будущий agent видит UI с семантикой «Connect Gmail» / «Authorise app» — это **bug в copy**, не «недоделанная OAuth-фича».

### Базовый факт
- **OAuth на стороне tenant'a НЕ существует и НЕ будет.** Это сознательное архитектурное решение, не временная заглушка.
- **Int3grate централизованно владеет credentials** для всех поддерживаемых интеграций (Gmail, HubSpot, Sheets, Pipedrive, Notion, GitHub, …). Tenant'ы используют **shared backend accounts**, к которым сам Int3grate подключает их.
- **Все integrations доступны всем tenant'ам по умолчанию** (variant A, full access). Нет per-tenant subscription / unlock-логики; нет «доступных» vs «недоступных» tools на уровне workspace'а.
- **Единственный механизм авторизации, который видит пользователь — `PUT /agents/{id}/grants`** (agent-level permissions over already-available tools). Это РЕАЛЬНЫЙ работающий endpoint.

### Что это значит для UI
- **Никаких «Connect» / «Authorise» / «OAuth»-семантик** в user-facing copy. Только «Allow access» / «Permissions».
- **Никаких тенант-уровневых модалок «Connect a new app»**. Концепт изначально неверный — нет ничего что нужно «подключать» на уровне workspace'а.
- Когда UI показывает app как «Connected» — это **derived from grants** (agent X имеет permission на этот app). Это **правильная модель**, не упрощение и не workaround.
- Wizard hire-флоу step «Allow access» — **работающая фича**: `setGrants` реально применяет permissions. Никаких MockBadge на этой поверхности.

### Что это значит для бэкенд-планирования
- **`POST /integrations/*` endpoints НЕ нужны.** Не проектировать integration registry, OAuth start/callback, disconnect. Это out-of-scope by design.
- `GET /tools` — **остаётся** как catalogue available actions (gmail.send, hubspot.find_contact и т.д.).
- `PUT /agents/{id}/grants` — **уже работает**, основной authorisation surface.
- См. `backend-gaps.md` где удалены устаревшие записи про Integration Registry (§ 1.7) и Connect new app modal (§ 4.4); запись про «derived connection status» (§ 2.3) переписана как описание правильной модели.

### Где это уже отражено в коде (на 2026-05-01)
- `AgentNewScreen.tsx` wizard step 2 — copy переписан с «Connect apps» → «Allow access»; MockBadge удалён
- `ToolsScreen.tsx` (Apps page) — скрыт целиком (см. § 2.8); концепт страницы «manage connections» был структурно неверный, восстановление потребует rewrite семантики (не починки)

---

## 0.1. Domain ≡ Workspace — backend semantics decision

> **Подтверждено пользователем 2026-05-08.** Это **корневой факт** по той же модели, что и § 0 (shared backend credentials). Все будущие UI- и backend-решения должны его учитывать.

### Базовый факт

- На бэкенде есть поле **`Agent.domain_id`** (nullable UUID, см. `docs/gateway.yaml:1146`) и роль **`domain_admin`**. Никакого поля `workspace_id` и схемы `Workspace` в spec'е НЕТ.
- На фронте есть концепт **«workspace»** — пользователь-видимый контейнер для agents / approvals / activity / costs (см. § 1.15 в `backend-gaps.md`).
- **Решение:** backend `domain` и frontend `workspace` — это **одна и та же сущность**. Бэкенд `domain_id` будет работать как FK к workspace; роль `domain_admin` = workspace admin.
- Это не «совпадение» и не «временный мок» — это сознательное продуктовое решение: организационная единица, к которой привязаны агенты и которая определяет approval-скоуп — называется в UI «Workspace», а в backend-контракте остаётся `domain` для backwards-compat со spec'ом.

### Что это значит для UI

- **Имя в UI = `Workspace`** везде, где сейчас рендерится `domainLabel(agent.domain_id)`. Конкретно — `AgentDetailScreen.tsx:193` (Overview stat-tile «Team»), `AgentDetailScreen.tsx:467` (Settings → MetaRow «team»), `RunDetailScreen.tsx:214`. Лейблы переименовываются в `Workspace`, значения тянутся через workspace lookup, а не через `domainLabel`.
- **Hardcoded `DOMAIN_LABELS` в `lib/format.ts:124-128`** (`dom_hq → 'HQ'`, `dom_sales → 'Sales'`, `dom_support → 'Support'`) — это **псевдо-workspaces из старой модели**. Они должны быть заменены на реальные имена workspaces из фикстур.
- **`agentWorkspace` side-table в фикстурах** становится симуляцией реального FK `Agent.domain_id`, а не отдельной фантазией. После слияния side-table уходит — `Agent.domain_id` становится единственным источником правды.
- **`Settings → Workspace card`** на AgentDetail (`WorkspaceCard`) перестаёт быть полностью mock-only: само поле существует на бэке, MockBadge должен говорить только про CRUD-операции (move, edit), не про сам факт привязки.

### Что это значит для бэкенд-планирования

- **`Workspace` schema на бэке = renamed `Domain`** (или просто alias). Это договорный уровень: либо бэкенд переименует во всём API на `workspace`, либо оставит `domain_*` и UI замапит на свою сторону. Решение за бэкенд-командой.
- Поле `Agent.domain_id` на спеке остаётся как есть — UI читает его и интерпретирует как workspace_id.
- `domain_admin` роль = workspace admin. Никаких новых ролей не нужно.
- Endpoint'ы CRUD (`GET /workspaces`, `POST /workspaces`, …) из § 1.15 backend-gaps все ещё требуются — это не следует автоматически из факта `domain_id` существует. Если бэкенд хочет — можно сделать это `GET /domains` / `POST /domains`; UI замапит названия.
- Membership endpoints (`GET /workspaces/{id}/members`) — отдельная история, не следует из `domain_id`.

### Что меняется в коде (план — отдельный файл)

См. `docs/agent-plans/2026-05-08-1900-domain-workspace-merge.md` (создаётся в этой же сессии). Кратко:

1. Фикстуры agents переписать так, чтобы `Agent.domain_id` ссылалось на `Workspace.id`. Side-table `agentWorkspace` уходит.
2. `api.getAgentWorkspace(agentId)` читает напрямую `agent.domain_id` и резолвит через `fxWorkspaces`.
3. `api.setAgentWorkspace(agentId, workspaceId)` мутирует `agent.domain_id` (а не side-table).
4. `lib/format.ts`: `DOMAIN_LABELS` хардкод удаляется. `domainLabel` либо удаляется, либо тоньшает до thin wrapper над workspace lookup.
5. Stat-tile «Team» на `AgentDetail` Overview → «Workspace», значение через workspace name. То же на Settings и RunDetail.
6. Filter cascade в `inSelectedWorkspaces` теперь читает `agent.domain_id`, а не `agentWorkspace[id]`.

---

## 1. Ship-blockers — must be wired before production

Без этих эндпоинтов прототип нельзя выкатывать в прод. UI уже честно помечен `<MockBadge>`, поэтому пользователь не «обманут», но **бэкенд обязан** дать эти ручки до релиза.

### 1.1 — `POST /auth/register` 🚨

- **Где в UI:** `src/prototype/screens/RegisterScreen.tsx:157` (форма регистрации, помечена `<MockBadge kind="design">`)
- **Текущий мок:** `api.register()` создаёт `User` + `Tenant` напрямую в `fxUsers` / `fxTenants`
- **Что нужно от бэкенда:** создание тенанта + первого admin-user. Возвращает `LoginResponse { token, expires_at }` + созданного `User`.
- **Без этого:** невозможно онбордить нового клиента
- **Status:** 🙈 hidden in UI on 2026-05-01 (route + "Create account" button commented out, screen file kept). Awaiting backend before re-enabling.
- **Что закомментировано:**
  - `src/prototype/index.tsx` — `import RegisterScreen` и `if (path === '/register') { … }` блок
  - `src/prototype/screens/LoginScreen.tsx` — блок «New to Int3grate.ai? · Create account»
- **Что не тронуто (восстанавливаем при возврате):** `RegisterScreen.tsx` (весь файл), `auth.tsx` метод `register()`, `lib/api.ts` мок `api.register()`, `WelcomeToast.tsx` guard `path !== '/register'`

### 1.2 — `GET /users` 🚨

- **Где в UI:** ~10 экранов, где показываются имена (owner / requested_by / approver_user_id):
  - `src/prototype/screens/SettingsScreen.tsx:150` (Team members tab — здесь есть `<MockBadge>`)
  - `src/prototype/screens/AgentsScreen.tsx`, `src/prototype/screens/AgentDetailScreen.tsx` (owner)
  - `src/prototype/screens/ApprovalsScreen.tsx`, `src/prototype/screens/ApprovalDetailScreen.tsx` (requested_by, approver)
  - `src/prototype/screens/RunDetailScreen.tsx` (initiator)
- **Текущий мок:** `api.listUsers()` возвращает все `fxUsers`; экраны делают `users.find(u => u.id === id)?.name`
- **Что нужно от бэкенда:** `GET /users` (scoped per tenant). Минимум `id`, `name`, `email`, `role`, `approval_level`. Открытый вопрос — privacy: видят ли member-ы всех или только админ-контакты + себя?
- **Альтернатива:** denormalize `name` в каждый response (как уже сделано с `requested_by_name` в approvals) — тогда `/users` нужен только для Team-таба
- **Без этого:** все имена в UI остаются плейсхолдерами или `«—»`
- **Status:** ⏳ flagged in UI; **открыт вопрос** для backend-product alignment — denormalize или отдельный endpoint

### 1.3 — `GET /approvals/{id}` ✅ RESOLVED 2026-05-01

> **Этот gap не существует.** После sync `gateway.yaml` с live spec (см. § 0) обнаружено: `GET /approvals/{approvalId}` (operationId `getApproval`) присутствует в реальном backend. Frontend workaround (cache + sequential list sweep), который мы добавили ранее, был основан на устаревшем local draft. **Workaround снят:** удалены `approvalCache` Map / `cacheApprovals` helper / `APPROVAL_STATUSES_TO_TRY` / `opts: { fresh?: boolean }` параметр / 2 `{ fresh: true }` call-sites в `ApprovalDetailScreen.tsx`. `api.getApproval(id)` снова делает прямой single-fetch. Никаких caveat'ов — endpoint живой, mock direct lookup в production станет real GET.

---

## 2. UI hide/reveal decisions — нужно решить до передачи

Это **продуктовые** решения, не баги. Каждый пункт — выбор: оставить как есть, скрыть, заменить на placeholder.

### 2.1 — Diagnostic mode tab — 🙈 subsumed by Settings hide (2026-05-01)

> Resolved by hiding Settings entirely. Tab no longer reachable. See § 2.7 for the umbrella decision.



- **Где:** `src/prototype/screens/SettingsScreen.tsx:490-515` (Settings → Diagnostic)
- **Что есть:** `Switch` пишет флаг в `localStorage["proto.diagnostic.v1"]`. На основном UI **никакого conditional rendering нет** — флаг ни на что не влияет
- **Honest хвост:** при включении показывается голубой info-box: *«Diagnostic mode is recorded in your browser. The conditional rendering of hints is planned for a follow-up build — for now this is a placeholder switch.»*
- **`<MockBadge>`:** есть на header
- **Проблема:** даже честный placeholder вводит админов в заблуждение. *«Я что-то включил, но ничего не поменялось — сломано?»*
- **Опции:**
  - **A.** Удалить таб целиком. Вернуть когда conditional rendering будет реализован. (Рекомендуется.)
  - **B.** Оставить как есть. Аргумент: roadmap-hint, не вред.
  - **C.** Перевести таб в read-only «coming soon» card без switch.
- **Recommendation:** **A** — удалить. Toggle без эффекта плох по UX-эвристике (Nielsen #1: visibility of system status); даже с info-box это «фантомная фича».
- **Status:** ⏳ open — нужно решение пользователя

### 2.2 — Pause / Fire agent (Manage employment) — 🙈 hidden in UI on 2026-05-01

> Resolved by hiding the entire `Manage employment` card in `AgentDetailScreen.tsx` SettingsTab. Disabled-buttons + MockBadge паттерн снят — теперь tab чище, без placeholder элементов. Файл-уровневые JSX оставлен в виде комментария-stub с ссылкой назад на эту секцию для восстановления когда backend даст endpoints. Также удалены unused imports (`MockBadge`, `IconLock`, `IconStop`) и `canEdit` prop у `SettingsTab` (использовался только в скрытой card).



- **Где:** `src/prototype/screens/AgentDetailScreen.tsx:451-484` (вкладка Settings агента)
- **Что есть:** Две `disabled`-кнопки `Pause (planned)` / `Fire (planned)`, под ними честные тексты *«Pausing stops new activity. You can resume any time. Planned for the next release.»* / *«Removes the agent from your team. The activity history is kept for audit. Planned.»*. `<MockBadge>` на header с подробным hint про `PATCH /agents/{id}` или `POST /agents/{id}/pause` + `DELETE /agents/{id}`
- **Опции:**
  - **A.** Оставить как сейчас (disabled buttons + MockBadge + объяснение). Это уже честный roadmap-hint.
  - **B.** Заменить на «Coming soon» card без кнопок-плейсхолдеров.
  - **C.** Скрыть весь блок «Manage employment» полностью.
- **Recommendation:** **A** — оставить. В отличие от Diagnostic это **не toggle с фантомным эффектом**, а просто disabled-кнопка с конкретной формулировкой *«planned for next release»* + бейдж. Пользователь не нажимает; информация доносится.
- **Status:** ⏳ open — нужно решение пользователя

### 2.3 — Tasks subtree (`/tasks`, `/tasks/new`, `/tasks/:id`)

- **Где:** `src/prototype/screens/TasksScreen.tsx`, `TaskDetailScreen.tsx`, `TaskNewScreen.tsx`. Также widget на Home — `src/prototype/screens/home/TaskOutcomesCard.tsx`
- **Что есть:** Все Tasks-экраны помечены `<MockBadge kind="deferred">` (потому что в `gateway.yaml` у них стоит `x-mvp-deferred`). **В sidebar Tasks нет** (`src/prototype/components/shell.tsx:45-61` — 7 пунктов: Home, Approvals, Activity, Team, Apps, Costs, Settings). Доступ — только через deep-link (например, чип «Task: …» из апрува)
- **Опции:**
  - **A.** Оставить как есть. Пользователь сам не наткнётся; deep-link из апрува ведёт на deferred-экран с собственным баннером — поведение чистое.
  - **B.** Полностью убрать роуты + `TaskOutcomesCard` с Home. Чип «Task: …» из апрува тоже скрыть.
  - **C.** Удалить файлы экранов целиком (вернуть когда бэкенд снимет `x-mvp-deferred`).
- **Recommendation:** **A** — оставить. Архитектурно tasks существует в спеке, deep-link уже честный, sidebar не показывает. Удаление файлов сейчас означает заново их писать через 2 месяца.
- **Status:** ⏳ open — нужно решение пользователя

### 2.4 — Apps → Connect new app (OAuth placeholder) — 🙈 subsumed by Apps hide (2026-05-01)

> Resolved by hiding the entire Apps page. The placeholder modal is no longer reachable. See § 2.8.



- **Где:** `src/prototype/screens/ToolsScreen.tsx:339` (Connect modal), `:110` (статус «Connected»)
- **Что есть:** Click на «Authorise» → 1.5s setTimeout → success badge. Реальной OAuth-связки нет. Также `AgentNewScreen.tsx:338` (wizard step 2 — fake toggle для каждого app prefix). Все три места помечены `<MockBadge>` с явным «Connection placeholder» в info-banner модалки
- **Опции:**
  - **A.** Оставить как есть (sales-демо хорошо смотрится).
  - **B.** Заменить «Authorise» на disabled «Connect (planned)».
  - **C.** Скрыть модалку «Connect new app» целиком, оставить только список «уже подключенных» (синтезированный из grants).
- **Recommendation:** **A** — оставить, если на демо это ценно. **C** если приоритет — не обещать возможность, которую бэкенд не даст в MVP.
- **Status:** ⏳ open — нужно решение пользователя

### 2.5 — Workspace edit-кнопки (Rename / Close / Open billing) — 🙈 subsumed by Settings hide (2026-05-01)

> Resolved by hiding Settings entirely. Buttons no longer reachable. See § 2.7.



- **Где:** `src/prototype/screens/SettingsScreen.tsx:82` (Workspace tab) — `<MockBadge>` + 3 disabled-кнопки
- **Что есть:** Disabled-кнопки `Rename (planned)`, `Close (planned)`, `Open billing (planned)`. MockBadge объясняет, что endpoint-ов нет
- **Опции:** аналогично 2.2 — A/B/C
- **Recommendation:** **A** — оставить. Тот же паттерн что в 2.2 — disabled + объяснение
- **Status:** ⏳ open

### 2.6 — Invite member (Settings → Team) — 🙈 subsumed by Settings hide (2026-05-01)

> Resolved by hiding Settings entirely. Button no longer reachable. See § 2.7.



- **Где:** `src/prototype/screens/SettingsScreen.tsx` — disabled-кнопка `Invite member (planned)`
- **Что есть:** Disabled-кнопка, без отдельного MockBadge (общий `<MockBadge>` на Team-card — для `GET /users`)
- **Опции:** A/B/C
- **Recommendation:** **A** — оставить
- **Status:** ⏳ open

### 2.8 — Apps page — 🙈 hidden in UI on 2026-05-01

- **Где:** Sidebar item `Apps` + 2 routes `/apps`, legacy redirect `/tools → /apps`
- **Что было внутри:** Каталог приложений (gmail, hubspot, …) с подсчётом permissions агентов, фильтрами Connected/Not connected, плиткой «Connect a new app» с placeholder OAuth-flow
- **Что было реальное:** список tools (`api.listTools`), список агентов (`api.listAgents`), permissions (`api.getGrants`) — всё на настоящих endpoints. Бейджи Connected/Not connected — derived from grants, не от настоящего OAuth
- **Что было фейковое:** placeholder OAuth-flow в модалке "Connect a new app" (1.5s setTimeout → "Placeholder OK" badge). Помечено `<MockBadge>`
- **Решение:** скрыть весь Apps-экран. Permissions агента видны на странице самого агента (`/agents/:agentId/grants`) — это canonical place. Apps как отдельный admin-обзор убран из MVP
- **Status:** 🙈 hidden in UI on 2026-05-01
- **Что закомментировано:**
  - `src/prototype/components/shell.tsx` — Apps nav item + `IconTool` импорт
  - `src/prototype/index.tsx` — `import ToolsScreen` + роут `/apps` + legacy redirect `/tools → /apps`
- **Что не тронуто (восстанавливаем при возврате):** `ToolsScreen.tsx` (весь файл)
- **Tour-починка в этом проходе:** удалён step `apps` из `sidebar-tour.tsx`. **Дополнительно** удалён step `settings` из того же tour-файла — его target (`[data-tour="nav-settings"]`) пропал ещё в § 2.7 (Settings hide), но я не починил тогда; починено сейчас. Sidebar tour теперь снова работает чисто

### 2.7 — Settings tab — 🙈 hidden in UI on 2026-05-01, Audit log extracted

- **Где:** Sidebar item `Settings` (admin-only) + 5 routes `/settings`, `/settings/team`, `/settings/history`, `/settings/developer`, `/settings/diagnostic`
- **Что было внутри:** Workspace (read-only data + 3 disabled-кнопки), Team members (`GET /users` mock), History log (`GET /audit` — реальный endpoint), Developer details (spec reference), Diagnostic mode (ничего не делающий toggle)
- **Решение:** скрыть всю вкладку Settings из UI. Единственная **реально работающая** фича — History log — вынесена в отдельный admin-only роут `/audit` (см. ниже)
- **Status:** 🙈 hidden in UI on 2026-05-01
- **Что закомментировано:**
  - `src/prototype/components/shell.tsx` — admin-conditional `Settings` nav item (+ `IconSettings` импорт)
  - `src/prototype/index.tsx` — `import SettingsScreen` + 5 settings-роутов
- **Что удалено (полностью, не комментировано):** legacy redirect `/audit → /settings/history` (теперь `/audit` — primary роут)
- **Что не тронуто (восстанавливаем при возврате):** `SettingsScreen.tsx` (весь файл)
- **Что добавлено:** `src/prototype/screens/AuditScreen.tsx` (новый экран, копия `HistoryLogTab` + helpers, обёрнут в собственный AppShell + PageHeader, admin-gated через `NoAccessState`); admin-conditional `Audit` nav item в sidebar (последним пунктом, иконка `IconAudit`); роут `/audit` в `index.tsx`

---

## 3. Acceptable as-is — уже честно помечено, ничего делать не надо

Просто фиксирую для полноты картины:

| Surface | File:line | Why OK |
|---|---|---|
| Activity sentence headlines | `RunsScreen.tsx:178` | `<MockBadge kind="design">` объясняет: backend должен вернуть `summary`, сейчас templated по статусу |
| 4-week spend trend | `SpendScreen.tsx:226` | `<MockBadge>` объясняет: backend даёт только aggregate ranges, недели разложены client-side |
| Activity heatmap (Home) | `home/ActivityHeatmap.tsx:74` | `<MockBadge>` объясняет: synthesized из `fxRuns` |
| Savings banner | `home/SavingsBanner.tsx:118` | `<MockBadge>` объясняет: baseline (38 min/task @ $75/hr) фиктивный |
| Tools page «Connected» статус | `ToolsScreen.tsx:110` | `<MockBadge>` объясняет: статус выводится из grants, не из реальных OAuth credentials |
| Developer details (Settings) | `SettingsScreen.tsx:403` | `<MockBadge>` корректен — это reference doc, читает из gateway-спеки |

---

## 4. Unverified surface areas — нужен прицельный second pass?

Аудит сосредоточился на тех зонах, которые я перечислил в брифе. **Не получили явного ответа** по следующим зонам:

- **`WelcomeToast`** (`src/prototype/components/WelcomeToast.tsx`) — есть ли что-то, что обещает onboarding-tracking, который никуда не пишется?
- **`/learn` и tours** — есть ли там completion telemetry / progress tracking, которое только в `localStorage` и притворяется backend'ом?
- **Profile screen** (`src/prototype/screens/ProfileScreen.tsx`) — какие user-поля можно «редактировать»? Что происходит при save?
- **CSV / export / download buttons** — есть ли где-то такие?
- **Notifications / email triggers** — встречается ли в UI текст вроде «you'll be emailed» / «we'll notify you» без бэкенд-поддержки?
- **Search / filter / sort** — какие фильтры на больших списках только client-side и не масштабируются?
- **Audit retention claims** — есть ли где-то текст «we keep this for X days» без бэкенд-подтверждения?

**Опции:**
- **A.** Прогон второго прицельного аудита по этим 7 зонам (~10-15 мин агента).
- **B.** Ручная проверка — я сам пройдусь по конкретным файлам.
- **C.** Принять как low-risk: если бы там было что-то критичное, агент скорее всего бы вынес.

**Recommendation:** **A** — дёшево, закроет неопределённость.

**Status:** ⏳ open

---

## 5. Document debt — обновить `backend-gaps.md`

Мелкий cleanup, не блокер:

| # | Что не так | Где | Что сделать |
|---|---|---|---|
| 5.1 | § 4.1 говорит «Pause AI worker / Fire AI worker» — устаревшая лексика | `docs/backend-gaps.md:187` | Заменить на «Pause this agent / Fire this agent» |
| 5.2 | § 2.2 говорит «не помечено отдельно» про Activity headlines | `docs/backend-gaps.md:107` | На самом деле уже помечено — `RunsScreen.tsx:178`. Обновить запись |
| 5.3 | Документ помечен «Last updated: 2026-04-28» — после этого был сделан редизайн `ApprovalDetailScreen` (две правки) | `docs/backend-gaps.md:282` | Освежить дату + verify, что все file:line ссылки внутри § 1.3 / § 4.1 / § 4.5 всё ещё совпадают |
| 5.4 | Раздел § 1 не упоминает явно Tasks-subtree (она deferred-эндпоинт, а не missing) | `docs/backend-gaps.md` | Добавить отдельный пункт про `/tasks/*` со ссылкой на 4 экрана + widget на Home |

**Status:** ⏳ open — делать после того, как примем решения по разделу 2 (потому что некоторые решения могут изменить состояние документа)

---

## 6. Рекомендуемый порядок работ

1. **Решить пункты раздела 2** (2.1 … 2.6) — небольшое обсуждение, ~30 минут.
2. **Решить раздел 4** (нужен ли second-pass аудит) — пара минут.
3. *(Если 4 = да)* Прогнать прицельный аудит → может появиться новый раздел 1.X или 2.X.
4. **Реализовать решения раздела 2** — небольшие отдельные планы под каждое (по правилам `CLAUDE.md`).
5. **Обновить `backend-gaps.md`** (раздел 5).
6. **Финальный self-check:** `npm run lint && npm run build` clean; пройти по каждому из 17 `<MockBadge>` руками; убедиться, что после всех правок hint-ы всё ещё точны.
7. **Передать бэкенд-команде:** ссылка на `backend-gaps.md` (что мокнуто) + ссылка на `gateway.yaml` (контракт) + ссылка на этот документ (история решений).

---

## Appendix A. Полный аудит `<MockBadge>` (17 точек)

Все badges на месте, kind корректен, hint точен. Проверено 2026-05-01.

| # | File | Line | kind | Surface |
|---|---|---|---|---|
| 1 | `RegisterScreen.tsx` | 157 | design | Регистрационная форма |
| 2 | `ApprovalDetailScreen.tsx` | 210 | design | Eyebrow «APPROVAL REQUEST» (single-fetch) |
| 3 | `AgentDetailScreen.tsx` | 455 | design | Manage employment card (Pause/Fire) |
| 4 | `AgentNewScreen.tsx` | 338 | design | Wizard step 2 (Connect apps fake OAuth) |
| 5 | `RunsScreen.tsx` | 178 | design | Activity headlines (synthesized) |
| 6 | `SettingsScreen.tsx` | 82 | design | Workspace card (CRUD missing) |
| 7 | `SettingsScreen.tsx` | 150 | design | Team members card (`GET /users` missing) |
| 8 | `SettingsScreen.tsx` | 403 | design | Developer details tab (spec reference) |
| 9 | `SettingsScreen.tsx` | 495 | design | Diagnostic mode card (placeholder switch) |
| 10 | `SpendScreen.tsx` | 226 | design | 4-week trend (client-side bucketing) |
| 11 | `ToolsScreen.tsx` | 110 | design | App connection status (derived from grants) |
| 12 | `ToolsScreen.tsx` | 339 | design | Connect new app modal (OAuth placeholder) |
| 13 | `TasksScreen.tsx` | 64 | deferred | Tasks list (`x-mvp-deferred`) |
| 14 | `TaskDetailScreen.tsx` | 52 | deferred | Task detail |
| 15 | `TaskNewScreen.tsx` | 103 | deferred | Create task |
| 16 | `home/TaskOutcomesCard.tsx` | 43 | deferred | Home: task outcomes widget |
| 17 | `home/ActivityHeatmap.tsx` | 74 | design | Home: activity heatmap |
| 18 | `home/SavingsBanner.tsx` | 118 | design | Home: savings banner |

> Note: 18 точек, не 17. В CLAUDE.md упоминается «17 screens» — небольшое рассогласование с фактом (`SettingsScreen` использует `<MockBadge>` 4 раза в 4 разных местах, поэтому уникальных файлов 15, а инстансов компонента 18).

---

## Лог решений

- 2026-05-12 — **Брендовая Radix-палитра внедрена + `blue` свеп'нут в `cyan`.** Два прохода в один день. **Утро** (`docs/agent-plans/2026-05-12-1700-radix-brand-color-system.md`): через `src/prototype/brand-colors.css` переопределены 3 Radix-шкалы — `violet` = Logic Purple `#701DFD`, `cyan` = Signal Cyan `#01C9FA`, `orange` = Deploy Orange `#FD9C12` (12 шагов + 12 alpha × 2 темы, alpha сгенерированы скриптом `scripts/gen-radix-alphas.mjs`). Theme accent переключён `indigo → violet`. Миграция `color="amber"` → `"orange"` (23 файла) и `color="green"` → `"jade"` (20 файлов). Solid-contrast fix для bright scales (cyan/orange step 9) — глобальный CSS override на `[data-accent-color][data-variant="solid"]`. `--color-panel-solid` перенесён из `prototype.css` в `brand-colors.css` (dark → Graphite `#0E1117`, light → `var(--gray-2)`). **Вечер** (`docs/agent-plans/2026-05-12-1900-blue-to-cyan-accent-split.md`): отдельная итерация — `blue` (~30 точек, Radix-дефолтная шкала, не наш бренд) полностью заменён на `cyan`. Финальное состояние: в `src/` нет упоминаний `amber/green/indigo/blue`; единственное `'violet'` — `accentColor='violet'` в Theme config. Source-of-truth палитры — `docs/int3grate-radix-color-system.md`. CLAUDE.md, AGENTS.md, ux-spec.md § 9 синхронизированы с новой палитрой. Lint + build clean.


- 2026-05-02 — **AgentDetail Activity tab: row title fixed**. Было `r.suspended_stage ? 'Waiting for your approval' : 'Activity'` — все non-suspended runs показывали placeholder «Activity» (тот же mock-pattern что мы убрали ранее в RunsScreen). Теперь: title = `statusLabel(r.status)` («Completed» / «Got stuck» / «Waiting for approval» / etc.); secondary line добавляет `stageLabel(r.suspended_stage)` когда стадия известна. Все данные real backend (RunListItem.status / suspended_stage / created_at). Импорты: добавлен `statusLabel` from common/status-label, `stageLabel` from lib/format. Lint + build clean.

- 2026-05-02 — **Path A: opt-out activation удалён** (revert недавнего autoActivate checkbox + «Set up & activate» button). Причина — тестируя flow пользователь увидел два UX-противоречия: (1) если в hire wizard uncheck autoActivate, prompt теряется (frontend state не сохраняется, backend не имеет `GET /agents/{id}/versions` listing endpoint чтобы достать v1 обратно); (2) VersionNewScreen куда вёл «Set up & activate» button написан в admin-debug стиле (raw API field names: `instruction_spec`, `model_chain_config`, `max_tokens`; «Forking from v1» лексика; technical descriptions) — Maria-unfriendly. Решение: убрать opt-out целиком. Wizard всегда заканчивается activation, как и backend ожидает. Удалено: `autoActivate` state, checkbox UI в ReviewStep, prop'ы у ReviewStep, conditional `if (autoActivate)` в hire(), success page draft branch, «Set up & activate» button в AgentDetailScreen, `IconPlay` import. VersionNewScreen остаётся для admin retraining (pre-fill из active_version, less scary в этом use case). Lint + build clean; bundle 589.36 kB.

- 2026-05-02 — **AgentDetail: добавлен «Set up & activate» button сверху для draft agents.** Conditional на `agent.active_version === null && canEdit` — для активного agent button скрыт. Расположен в `<PageHeader actions>` справа от status pill, перед «Talk to» button. Color green, IconPlay, link на existing `/agents/:id/versions/new` route. VersionNewScreen уже handles full setup form (instruction, model, etc.) + has «Activate immediately» checkbox (default true) — после save происходит createAgentVersion + activateVersion → agent active_version set + status flips. Это закрывает gap из предыдущего lo (если user в hire wizard uncheck'ил «Activate immediately», agent оставался в draft без UI способа активации). Lint + build clean; bundle 590.50 kB.

- 2026-05-02 — **Hire flow: grants и activate переставлены местами + mock activateVersion флипает agent.status.** Backend-команда подтвердила правильный flow: createAgent → createVersion → **setGrants** → **activateVersion**. У нас был обратный порядок (activate перед grants), что в production делало бы версию active без permissions на момент flip. Swap'нул в `AgentNewScreen.tsx hire()`. Также backend-команда подтвердила что `activateVersion` server-side флипает `agent.status` `draft → active` — обновил mock `lib/api.ts api.activateVersion` чтобы тоже флипал (раньше не флипал; раньшний hack `fresh.status = 'active'` уже удалён в предыдущем cleanup, теперь mock сам делает то что backend делает). Success page branch (`is ready` / `is hired as a draft`) теперь корректно работает: с checkbox checked → mock флипает → «is ready»; unchecked → status остаётся draft → «is hired as a draft». Lint + build clean.

- 2026-05-02 — **Tasks subtree полностью удалён + owner row removed + activation hack → checkbox** (final cleanup pass). Согласно plan `docs/agent-plans/2026-05-02-0200-tasks-removal-owner-row-activation-checkbox.md`:
  1. **Tasks: full removal**. Deleted 4 screens, removed `/tasks/*` routes, `api.listTasks/getTask/createTask` methods, `decideApproval` task side-effects, 5 types, `fxTasks` const + `task()` factory, `TaskStatusFilter` + `TASK_STATUS_FILTERS`, training-fixtures cleanup, ApprovalDetailScreen task chip + getTask + taskContext.
  2. **Owner row removed** в AgentDetail Settings tab + extended to «created by» row в AdvancedTab (same root: absent `GET /users`). `users` state, `userName` helper, listUsers call, User import — все удалены.
  3. **Activation hack removed + checkbox added**. Mock `fresh.status = 'active'` удалён. `autoActivate: boolean` state (default `true`) + checkbox в ReviewStep. Conditional activateVersion. Success page branch'ит по реальному `hiredAgent.status` (`is ready` / `is hired as a draft`).
  4. `task_id` field на ApprovalRequest оставлен (backend поле, нет UI consumer).
  5. Lint + build clean. Bundle 590.28 kB (-19 kB cumulative across all cleanups).

- 2026-05-02 — **Dashboard: добавлен «Recent activity» card** на освободившееся место от Tasks. Использует `GET /dashboard/runs?limit=5` (real backend). HomeScreen fetch'ит `api.listRuns({ limit: 5 })` параллельно с approvals/agents/spend. AdminView получает `recentRuns`; mid section вернулся в 2-col `1fr 1fr`: Pending approvals (left) + Recent activity (right). Per-row: status dot (color по `STATUS_TONE`) + agent name + statusLabel + timestamp + cost (если >0); link на `/activity/:runId`. «All activity» button в header → `/activity`. Все данные real, без mock. Lint + build clean; bundle 609.48 kB.

- 2026-05-02 — **Dashboard: убраны 3 Tasks-related карточки** (Tasks metric, Recent tasks card, TaskOutcomesCard). После reconciliation выяснилось что `/tasks/*` нет в live spec вообще — в production все 3 упали бы на 404 и весь дашборд показал бы ErrorState (потому что `Promise.all` в HomeScreen падает целиком). Удалены: `api.listTasks()` call в HomeScreen useEffect; `tasks`/`failedTasks`/`recentTasks` state + memos; `Task` type import; передача в AdminView. В AdminView: top grid `columns="4"` → `columns="3"` (убран Tasks metric); удалён 2-col `Pending approvals + Recent tasks` (теперь Pending approvals full-width); удалён 2-col `Spend + TaskOutcomes` (теперь SpendByAgent full-width); `TaskOutcomesCard` импорт закомментирован; `MockBadge`, `IconTask`, `humanKey`, `Status`, `agentName` helper — удалены (только tasks использовали). `home/TaskOutcomesCard.tsx` файл оставлен в коде. Layout dashboard теперь sparse: 3 metric cards → Pending approvals (full) → Spend by agent (full). Lint + build clean; bundle 607.60 kB.

- 2026-05-02 — **Backend spec reconciliation (post-canonical sync).** После sync `gateway.yaml` с live stage spec выяснилось что несколько ранее flagged gaps были основаны на устаревшем local draft. Действия:
  1. **§ 1.3 закрыт как resolved** — `GET /approvals/{id}` есть в live (`getApproval` operationId). Удалены `approvalCache` Map + `APPROVAL_STATUSES_TO_TRY` + `cacheApprovals` helper + `opts: { fresh?: boolean }` parameter из `lib/api.ts`. `getApproval(id)` упрощён до direct fixture lookup (mock) / прямой fetch (production). Удалены 2 `{ fresh: true }` call-sites в `ApprovalDetailScreen.tsx`.
  2. **`backend-gaps.md`** обновлён — § 1.3 stub, новая § 5 «Naming mismatches» (`/tools` vs `/tool-catalog`), новая § 6 «Tasks subtree absent in live spec» (раньше думали x-mvp-deferred, реально вообще нет; рекомендовано переcategorize MockBadge на Tasks-screens), таблица приоритета и footer обновлены.
  3. **`CLAUDE.md` Key gaps list** reconciled — удалена `GET /approvals/{id}` строка, аннотированы removed-UI bullets (Pause/Fire, per-week-spend, activity-headlines), добавлены новые `/tasks/*` (absent) и naming mismatch.
  Lint + build clean. См. план: `docs/agent-plans/2026-05-02-0030-backend-spec-reconciliation.md`.

- 2026-05-01 — **Dashboard: спрятаны полностью synthesized карточки `<SavingsBanner />` и `<ActivityHeatmap />`.** Файлы оставлены в `screens/home/` (по паттерну hide), импорты в `AdminView.tsx` закомментированы. Bottom Grid с 3-column `2fr 2fr 1fr` (SpendByAgent + Heatmap + TaskOutcomes) → 2-column `2fr 1fr` (SpendByAgent + TaskOutcomes). SavingsBanner-блок (между metric grid и middle section) удалён. Tasks-related карточки (Tasks metric, Recent tasks, TaskOutcomes) — оставлены пока (deferred backend, не synthesized — отдельная категория). Lint + build clean; bundle уменьшился (тree-shake'ом убрались 2 component file). § 1.9 backend-gap про per-week buckets не релевантен — heatmap была другая mock surface.

- 2026-05-01 — **Costs page переписан полностью без mock surfaces.** Удалены: `FourWeekTrend` SVG-карточка целиком (synthesized weekly buckets с MockBadge), trend percent в hero subtitle (synthesized baseline через `(spendMonth - spendWeek) * (7/23)`), `AdvancedAccordion` + `AdvancedView` + `StatBlock` старый, дублированные `CostsByAssistantCard` (bar) + `SimpleAssistantTable` (table). Group-by-user toggle убран — без `GET /users` бессмысленен (был бы user_id'ы вместо имён). **Новая структура**: hero (`$X spent · last N`) → range chips (1d/7d/30d/90d) → 3 stat cards (Total / Activities / Tokens with in/out breakdown) → unified «Costs by agent» list (per-row: name + bar + cost + % + activities + tokens, link на agent). Один view, без accordion, без duplicate visualizations. Hover-effect на rows (через `card--hover`). Все данные real backend через `GET /dashboard/spend?range=…&group_by=agent`. **MockBadge удалён** из этого файла полностью. Lint + build clean; bundle 951.15 kB (-5.5 kB на удалённом chart + accordion). § 1.9 backend-gap (per-week buckets) теперь без UI-следствия — gap остаётся только для возможного будущего восстановления trend chart.

- 2026-05-01 — **Activity pagination: классический `<Pagination>` (Newer/Older с pageSize control) заменён на infinite-scroll** через `IntersectionObserver` (200px pre-load margin). Items аккумулируются между fetch'ами; в конце списка sentinel показывает «Scroll for more · {N} of {total}» / «Loading more…» / «All caught up». При смене status-filter всё сбрасывается (items=[], page=0, expanded=∅). Page size фиксированный 25. Backend interface не менялся (тот же `GET /dashboard/runs?status=&limit=&offset=`). Lint + build clean; bundle 955.94 kB.

- 2026-05-01 — **Activity filters: mock agent + date-range заменены на real status + pagination.** Backend `GET /dashboard/runs` поддерживает `status` (RunStatus enum) + `limit` / `offset`, но НЕ поддерживает `agent_id` или date filtering — frontend filters над уже загруженными 100 runs обманывали при больших объёмах. Теперь: chips «All / Running / Waiting for approval / Pending / Completed / Finished with errors / Got stuck / Cancelled» (status, real backend filter), плюс `<Pagination>` снизу (использует `total` из response, page change → re-fetch с новым offset). Удалены: `dateRangeFilter()` helper, `DateRange` type, `agentsInList` useMemo, `filtered` useMemo, `agentFilter` / `dateFilter` state, `Avatar` import (был для agent chip icon). `agents` state остаётся — используется для resolution `agentName(r.agent_id)` в row title (без него имя fall-back на «Agent»). Page state сбрасывается при смене status. Date grouping (Today / Yesterday / This week / Earlier) оставлен — это display-логика над real timestamps в рамках текущей страницы, не filter. Lint + build clean; bundle 955.17 kB.

- 2026-05-01 — **Activity / Audit consolidation.** Audit screen (extracted ранее в этой же сессии при скрытии Settings) свернут обратно в Activity — single grouped view, без toggle. Audit nav item удалён из sidebar; `/audit` route закомментирован; `AuditScreen.tsx` файл оставлен в коде для возврата если понадобится compliance surface. **Mock на Activity удалён**: функция `runHeadline()` (synthesized строки типа «Sales Agent finished an activity», шаблонизованные по RunStatus) удалена; row title теперь — `{agentName} · {statusLabel(status)}`, всё real. MockBadge на eyebrow Activity убран. `IconAudit`, `isAdmin` (был только для Audit nav-item gate) закомментированы как unused. Sidebar теперь 5 пунктов для всех (Home, Approvals, Activity, Team, Costs) — admin и member видят одно и то же. Trade-off: chat events (`chat_message`, `chat_tool_call`) больше не видны в timeline-режиме (mitigation: chat history через `/agents/:id/talk/:chatId`); per-step audit table потеряна (mitigation: каждый run открывается через `/activity/:runId` с полным step tree). Lint + build clean; bundle 955.68 kB (-7 kB на скрытом AuditScreen).

- 2026-05-01 — **MockBadge на eyebrow ApprovalDetailScreen удалён.** После реализации workaround (cache + sequential list sweep) и удаления всех user-name placeholder'ов, страница не показывает ни одного выдуманного / mock surface. MockBadge больше не отражает реальность — все данные либо real backend, либо derived from real data через valid workaround. `MockBadge` import удалён из файла. Workaround documented в § 1.3 этого файла — backend всё ещё ideally должен дать proper `?id=` filter, но пользователю это не visible. Lint + build clean; bundle 962.24 kB.

- 2026-05-01 — **ApprovalDetailScreen: убраны user-name surfaces (3 места), которые без `GET /users` показывали `'—'`.** ConflictBanner: «Decided by **{name}** at …» → «Another approver decided this while you were reviewing at {time}.». ResolvedCard: убрана строка «by {approverName}» — остались status + timestamp + reason. TechnicalDetailsAccordion: убран Approver row (Approver role row остаётся — это enum, не имя). `users` state, `userName` helper, `api.listUsers` call, `User` import, `userName` prop у TechnicalDetailsAccordion и `approverName` prop у ResolvedCard — всё удалено. Также добавлен `.catch(() => {})` к `api.getTask` — silent fallback на null если backend deferred Tasks возвращает 404. **Caveat для UI:** теперь не видно кто одобрил (только timestamp). Когда backend сможет либо денормализовать `approver_user_name` в ApprovalRequest (mirroring `requested_by_name`), либо дать `GET /users` — UI восстановит. Lint + build clean; bundle 962.59 kB.

- 2026-05-01 — **ApprovalDetailScreen: реализован frontend workaround для отсутствующего `GET /approvals/{id}`.** Добавлен module-level `approvalCache: Map<string, ApprovalRequest>` в `lib/api.ts`. `listApprovals` populates cache на каждый fetch (training-scenario списки изолированы). `getApproval(id, opts?)` теперь: cache hit → return; cache miss → sequential sweep `GET /approvals?status=pending|approved|rejected|expired|cancelled&limit=100` (с populating cache по пути). Polling в `tickApproval` + optimistic check в `doDecide` пропускают cache через `{ fresh: true }`. `decideApproval` invalidates cache for the id перед return. Common case (entered from `/approvals`): instant. Cold deep-link: до 5 sequential fetches (~1.5s). Updated MockBadge hint на eyebrow и § 1.3 в этом документе. Lint + build clean; bundle 962.83 kB.

- 2026-05-01 — **AgentDetail → Settings tab: «Manage employment» card скрыт.** Tab теперь содержит только read-only «Agent details» card (все 7 полей real backend data: name, description, status, team, owner, created, updated). Pause/Fire disabled-buttons + MockBadge ушли — tab чище, без placeholder UI. Скрытый JSX оставлен в виде stub-комментария для восстановления когда backend даст `PATCH /agents/{id}` или `POST /agents/{id}/pause` + `DELETE /agents/{id}`. § 2.2 теперь помечен 🙈 hidden. Lint + build clean; bundle 962.49 kB. **Caveat:** Agent details остаётся 100% read-only — нет UI для rename/edit description/change owner; backend `PATCH /agents/{id}` тоже отсутствует (см. § 1.4). Это известный gap, оставлен открытым для backend-команды.

- 2026-05-01 — **ReviewStep summary очищен от двух выдуманных полей.** Удалены `Role` SummaryRow (показывал `template.defaultName` — frontend-only label, на бэкенде у Agent поля `role` нет; дублирует Name если юзер не переименовал) и `Approvals` SummaryRow (показывал hardcoded `template.approvalCopy` bullets — статичный template hint, не отражает реальные grants после редактирования; уже дублируется в `Permissions` row через breakdown). Summary теперь показывает только `Name` + `Permissions` — оба отражают реальное состояние того что пойдёт на createAgent / setGrants. Lint + build clean; bundle 963.99 kB.

- 2026-05-01 — **Wizard "Overview" (preview) шаг полностью удалён.** Был лишним: дублировал содержимое welcome card, показывал имя как fait accompli (хотя юзер ещё не подтвердил), и абстрактно перечислял «will need access to: Apollo, Zoho» — на следующих шагах юзер всё равно видит реальный per-tool список. Новый flow: **welcome → name → access → review → success** (3 wizard step + landing + success вместо 4 + landing + success). Изменения в `AgentNewScreen.tsx`: убран phase `'preview'` из enum + WizardPhase; удалены helper-функции `goToWizard`, `goBackToPreview`, `PreviewSection`, `PreviewBullet`, `appReason`; удалён весь preview JSX block (~80 LOC); pickTemplate теперь сразу `setPhase('name')`; NameStep onBack возвращает в welcome через `goBackToWelcome` (с reset template); StepProgress подрезан до 3 dots с label `[NAME, ACCESS, REVIEW]` (был 4 dots с `[OVERVIEW, NAME, APPS, REVIEW]`); удалены unused imports `appLabel`, `appPrefix`. Lint + build clean; bundle 964.35 kB (~−3 kB).


- 2026-05-01 — документ создан после полного аудита проекта (Explore-агент + ручная верификация). Все 17/18 `<MockBadge>` подтверждены актуальными.
- 2026-05-01 — § 1.1 решено: регистрация полностью скрыта в UI, файлы не удалены. Закомментированы роут (`index.tsx`) и кнопка «Create account» (`LoginScreen.tsx`) с TODO-ссылкой на эту секцию. `RegisterScreen.tsx` + `auth.register()` + `api.register()` остались в коде нетронутыми — восстанавливаем когда бэкенд даст `POST /auth/register`. Lint + build clean; bundle уменьшился на ~5 kB (один экран ушёл из tree-shaking).
- 2026-05-01 — § 2.1 / 2.5 / 2.6 / 2.7 решено: Settings полностью скрыт из UI. Audit log (единственная фича на реальном endpoint `GET /audit`) вынесен в отдельный admin-only роут `/audit` через новый файл `AuditScreen.tsx`. Sidebar: 7 пунктов (Settings заменён на Audit, последний пункт). Legacy `/audit → /settings/history` redirect удалён полностью; новый `/audit` — primary route. Lint + build clean; bundle уменьшился ещё на ~14 kB (SettingsScreen ушёл из tree-shaking, минус неиспользуемые хвосты Workspace / Team / Developer / Diagnostic).
- 2026-05-01 — § 2.4 / 2.8 решено: страница Apps полностью скрыта из UI. Permissions агента смотрятся на `/agents/:agentId/grants` — это canonical place. Sidebar теперь 6 пунктов для admin (Home, Approvals, Activity, Team, Costs, Audit), 5 для member (без Audit). Legacy `/tools → /apps` redirect закомментирован. **Дополнительно:** в `sidebar-tour.tsx` удалён step `apps` (target пропал) **и step `settings`** — последний остался broken после прошлого Settings-hide прохода (мой просчёт, починено в этом же проходе). Lint + build clean; bundle 968 kB (минус ~18 kB на скрытом ToolsScreen). Итог за два дня: bundle упал с ~1007 kB до 968 kB (минус ~40 kB / 4 экрана).
- 2026-05-01 — **Архитектурное открытие:** пользователь подтвердил что OAuth на стороне tenant'a не существует и не планируется (Int3grate владеет shared credentials; все integrations доступны всем тенантам — variant A; `setGrants` — единственный auth-surface для user'a). Добавлена секция **§ 0 «Architectural model — read this first»** в начало этого документа как корневой факт для будущих сессий. В `backend-gaps.md` удалены устаревшие записи: § 1.7 (Integration registry / OAuth flow) → REMOVED-stub, § 4.4 (Connect new app modal) → REMOVED-stub; § 2.3 (App connection status) переписана как описание правильной модели, не workaround. **Wizard step 2 в `AgentNewScreen.tsx` переделан:** копи переписана с «Connect apps» → «Allow access» semantics (9 правок: heading, subtitle, AppsStep кнопки, ReviewStep summary/warning, success message, internal comment в `templates.ts`). `<MockBadge>` удалён — этот wizard step **реально работает** через `setGrants`. Lint + build clean; bundle ~968 kB (без изменений — это copy rewrite). См. план: `docs/agent-plans/2026-05-01-2030-fix-connect-semantics.md`.
- 2026-05-01 — **GrantsForm полностью переделан** в новый full-catalog grouped-by-app дизайн. Sandbox preview (`/preview/grants`) удалён вместе с роутом. Теперь и в wizard step 2, и в `/agents/:id/grants` tab используется один и тот же UI: responsive grid карточек (`auto-fill, minmax(360px, 1fr)`), header с avatar-less app label + count badge + bulk «Allow all» / «Remove all», collapsible body (auto-expand если allowed > 0), per-tool LevelToggle (Read / Ask / Auto chips), «Allow» button для not-granted, «Restricted» chip для denied tools. Smart defaults через `policyModeToDraft` (берёт `tool.default_mode`). Цветные tints: green-tinted header для cards с allowed, gray-tinted body. Также **очищена demo data**: удалены `aws.revoke_user` (catalog + 2 approval requests + agent grant + approval rule) и `memory.read` / `memory.write` (tenant grant + agent grant + 2 template references) — historical run steps оставлены до общего refresh demo data. **Tour `configure-tool-grants` подрезан**: удалены 2 stale step (`grants-catalog`, `grants-add` — селекторы исчезли вместе с старым CatalogPicker); шаг `grants-mode` переписан под новые Read/Ask/Auto. Lint + build clean; bundle 967 kB. Preview file удалён.

- 2026-05-01 — **Wizard step 2 теперь даёт полный per-tool control.** Per-app on/off toggle заменён на полноценный grants editor с per-tool permission level (read / write-with-approval / write-auto) и возможностью добавить/удалить tools из catalog. Реализовано через **рефакторинг существующего `GrantsEditor`**, не дублированием: внутренняя controlled-часть выделена в новый компонент `GrantsForm` (без save, чистая presentational), `GrantsEditor` стал тонким wrapper'ом который добавляет save/dirty/baseline для `/agents/:id/grants` tab. Тот же `GrantsForm` используется напрямую в wizard step 2 (`<GrantsForm grants={pickedGrants} onChange={setPickedGrants} />`). Pre-fill: при выборе template (Sales, Marketing, …) — pickedGrants заполняются из `template.defaultGrants`; Custom template — пустой editor, пользователь добавляет с нуля. ReviewStep summary показывает breakdown (X read-only / Y write-with-approval / Z write-auto). API `GrantsEditor` сохранён без изменений — `AgentDetailScreen.tsx` не тронут. Удалено ~107 LOC старого `AppsStep` компонента; bundle 967 kB (-2 kB). Tour `configure-tool-grants` selectors сохранены (всё, что внутри `GrantsForm`, резолвится в обоих контекстах; `grants-summary`/`grants-save` — только в wrapper, на /grants tab). См. план: `docs/agent-plans/2026-05-01-2200-refactor-grants-editor-controlled.md`.
