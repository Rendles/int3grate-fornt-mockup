# Backend gaps

Каталог мест в мокапе, где UI обещает функциональность, которой backend не предоставляет — либо endpoint отсутствует в gateway-спеке, либо данные синтезированы клиентом, либо это mock-only хак, либо UI ещё disabled.

Документ нужен бэкенд-команде, чтобы знать что нужно wired up перед production-deploy. Также служит подсказкой будущим итерациям мокапа.

> Зафиксировано после Phases 1-9 + 11. Все ссылки — относительно `docs/gateway.yaml` в репозитории. Для каждого пункта указано **где в UI** (file:line или surface), **что нужно** на стороне backend, и **степень критичности**.

---

## 1. Missing endpoints (UI calls, spec doesn't expose)

### 1.1 — `POST /auth/register` 🚨 critical

- **UI:** `RegisterScreen.tsx`, заполнение формы регистрации создаёт нового tenant + admin user.
- **Текущий мок:** `api.register()` создаёт нового user/tenant в `fxUsers` напрямую.
- **Что нужно от backend:** endpoint создания tenant + первого admin user. Возвращает `LoginResponse` (token + expires_at) + созданного user.
- **MockBadge:** ✅ помечен на `RegisterScreen.tsx:157`.

### 1.2 — `GET /users` 🚨 critical

- **UI:** Везде где UI резолвит имя по `user_id` (owner, requested_by, approver_user_id) — `AgentsScreen`, `ApprovalsScreen`, `ApprovalDetailScreen`, `RunDetailScreen`, `SettingsScreen` (Team members tab), и т.д.
- **Текущий мок:** `api.listUsers()` возвращает все `fxUsers`.
- **Что нужно от backend:** `GET /users?tenant_id=...` (или embedded в bearer scope). Минимально — `id`, `name`, `email`, `role`, `approval_level`. Учитывая privacy — возможно scoped views для `member` (видят только себя + admin контакты).
- **Альтернатива:** denormalize `name` в каждый response (сейчас уже есть `requested_by_name` в approvals — расширить до agent.owner_name, etc).

### 1.3 — ~~`GET /approvals/{id}`~~ — RESOLVED 2026-05-01

> **Этот gap не существует.** Live backend (см. `docs/gateway.yaml`) экспонирует `GET /approvals/{approvalId}` (operationId `getApproval`). Frontend workaround (cache + sequential list sweep), который мы добавили ранее, был основан на устаревшем local draft. Workaround снят, `api.getApproval(id)` снова делает прямой single-fetch. Запись оставлена как stub чтобы не ломать ссылки `§1.3`.

### 1.4 — `PATCH /agents/{id}` или транзиция `draft → active` ⚠️ medium

- **UI:** `AgentNewScreen.tsx:147` — после `activateVersion` мок мутирует `agent.status = 'active'` напрямую.
- **Текущий мок:** Hack — `fresh.status = 'active'` после `activateVersion`. Real backend почти наверняка флипает статус сам, но это не задокументировано в спеке.
- **Что нужно от backend:** либо POST `/agents/{id}/versions/{verId}/activate` сам флипает agent.status, либо отдельный endpoint `PATCH /agents/{id}` для status-перехода.

### 1.5 — Workspace CRUD ⏸ planned

- **UI:** `SettingsScreen` → Workspace tab — disabled buttons:
  - `Open billing (planned)` — Stripe customer portal redirect
  - `Rename (planned)` — `PATCH /tenants/{id}` для name
  - `Close (planned)` — `DELETE /tenants/{id}` или soft-archive
- **Текущий мок:** ничего (disabled UI).
- **Что нужно от backend:** см. выше. Билинг — отдельная интеграция со Stripe или другим биллинговым провайдером.

### 1.6 — User invitation (`POST /users`) ⏸ planned

- **UI:** `SettingsScreen` → Team members tab — disabled `Invite member (planned)` button.
- **Текущий мок:** ничего.
- **Что нужно от backend:** `POST /users` с email + role + optional approval_level. Email-инвайт flow или magic-link.

### 1.7 — ~~Integration registry / OAuth flow~~ — REMOVED 2026-05-01

> **Этой записи больше нет.** OAuth на стороне tenant'a архитектурно не существует и не планируется — Int3grate владеет shared credentials для всех integrations. См. `handoff-prep.md § 0` для деталей. **Бэкенд-команде не нужно проектировать integration registry / OAuth endpoints.** Запись оставлена как stub чтобы не ломать ссылки `§1.7` из других секций.

### 1.8 — Filter `/dashboard/runs?agent_id=` ⚠️ low

- **UI:** `AgentDetailScreen` (Activity tab), `ApprovalsScreen` (resolve agent name) — фильтрация runs по agent_id делается **client-side**.
- **Текущий мок:** `listRuns({ limit: 100 })` → `.filter(r => r.agent_id === id)`.
- **Что нужно от backend:** добавить optional `agent_id` query param к `/dashboard/runs` — иначе на больших данных N+1 fetch + клиент-сайд фильтрация уронят performance.

### 1.9 — Per-week spend buckets ⚠️ low

- **UI:** `SpendScreen.tsx:178` — 4-week trend sparkline.
- **Текущий мок:** Распределяет `(30d_total - 7d_total)` по 3 предыдущим неделям с детерминированным весом + реальный `7d` как четвёртая точка.
- **Что нужно от backend:** `GET /spend?bucket=week&range=4w` или эквивалент — раскладка по неделям.
- **MockBadge:** ✅ помечен на trend card.

### 1.10 — Batch grants fetch ⚠️ low

- **UI:** `ToolsScreen.tsx` — для построения "Used by N assistants" делает N+1 `getGrants(agentId)` для каждого agent.
- **Текущий мок:** `Promise.all(agents.map(a => api.getGrants(a.id)))` — 5-7 параллельных calls.
- **Что нужно от backend:** либо `GET /grants?tenant_id=...` (tenant-wide), либо `GET /agents?include=grants`.

### 1.11 — `requested_action` → human language

- **UI:** Везде где показывается approval action — `ApprovalsScreen` row, `ReviewCard` title, и т.д.
- **Текущий мок:** `prettifyRequestedAction()` парсит prefix `service.action` и подменяет через `toolLabel()` map.
- **Что нужно от backend:** возвращать поле `requested_action_label` (denormalised human text) или structured object (tool, args summary, target). Сейчас UI парсит free-form string — fragile.

### 1.12 — Seed assistant message on chat creation ⚠️ medium

- **UI:** `screens/sandbox/WelcomeChatScreen.tsx` — onboarding flow: после hire'а агента из шаблона нас перекидывает в чат, где агент сразу приветствует пользователя сообщением из `template.welcomeMessage`.
- **Текущий мок:** `CreateChatRequest` имеет mock-only поле `seed_assistant_message?: string`. `api.createChat` (`lib/api.ts`) при наличии этого поля prepend'ит synthetic `ChatMessage` (role='assistant') в `fxChatMessages[id]` ДО возврата chat'а — `listChatMessages` сразу возвращает приветствие.
- **Что нужно от backend:** один из путей —
  1. Поддержать `seed_assistant_message` в `POST /chat` body (простейший) — backend сам создаёт assistant-message без вызова LLM.
  2. Хранить `welcome_message_template` на `agent_version` (или `agent`) и backend генерит greeting при `createChat` на основе template'а версии.
  3. Auto-trigger LLM с system-prompt «Greet the user as {name}, explain what you can do» — самый дорогой и недетерминированный.
- **Use case:** только onboarding-flow welcome-chat. В production /agents/new и QuickHireGrid greeting НЕ нужен (там пользователь сам идёт в chat и пишет первое сообщение).
- **Если backend не реализует:** UI fallback — после hire navigate'имся на `/agents/:id/talk` (draft mode без greeting). Onboarding теряет narrative-finish, но не падает.
- **MockBadge:** не нужен — пользователь не видит mock-only механики, только результат (greeting в chat).

### 1.13 — `AgentVersion.*_config` shapes underspecified ⚠️ medium

- **Где было в UI:** AgentDetail → Advanced tab имел четыре карточки, рендерящие предполагаемые внутренние поля:
  - `ModelChainCard` читал `model_chain_config.{primary, fallbacks, max_tokens, temperature}`
  - `MemoryScopeCard` читал `memory_scope_config.{user_facts, session_only, domain_shared, retention_days}`
  - `ToolScopeCard` читал `tool_scope_config.{inherits_from_agent, overrides, denylist}`
  - `ApprovalRulesCard` читал `approval_rules.rules[].{when, required_approver_level}`
- **Что говорит spec:** `docs/gateway.yaml` определяет каждое из этих полей как `object` с `additionalProperties: true` — внутренняя структура НЕ зафиксирована. Это значит, что любой backend-совместимый response мог бы вернуть `{}` или произвольную форму, и UI работал бы только на наших мок-фикстурах.
- **Действие 2026-05-06:** четыре карточки удалены из UI вместе с поддерживающими компонентами (`ModelBadge`, `ToggleRow`, `ApprovalRule` interface, `ApprovalRuleRow`). На Advanced остались только поля, гарантированные spec'ом: `version`, `is_active`, `created_at`, `instruction_spec`.
- **Что нужно от backend:** зафиксировать схемы внутри `*_config` объектов в OpenAPI (отдельные named schemas или `properties` блок вместо `additionalProperties: true`). Без этого UI не может показывать ничего более конкретного, чем raw JSON.

### 1.14 — `GET /internal/agents/{agentId}/grants/snapshot` is x-internal ⚠️ medium

- **Где было в UI:** AgentDetail Advanced tab → `PolicySnapshotPanel` (dashed-border card в самом низу).
- **Что говорит spec:** endpoint существует в `docs/gateway.yaml:810`, но помечен `x-internal: true`, `tags: [internal]`, и описание прямо пишет «called by orchestrator». Bearer-scope обычного user'а почти наверняка его не пропустит.
- **Действие 2026-05-06:** панель удалена из UI. `api.getGrantsSnapshot()` и типы `GrantsSnapshot` / `GrantsSnapshotEntry` оставлены в `lib/api.ts` / `lib/types.ts` — на случай будущей admin-only internal-tools UI.
- **Что нужно от backend (если хотим показывать в UI):** либо публичный аналог endpoint'а с user-scoped permission'ами, либо documented elevation flow (например, отдельный `/admin` namespace с tenant_admin scope).

### 1.15 — Workspaces (multi-membership UI context) ⚠️ high

> **2026-05-08 architectural decision (impl complete):** backend `domain` ≡ frontend `workspace`. См. `docs/handoff-prep.md § 0.1`. **`Agent.domain_id` (уже есть в spec) — это и есть workspace FK; роль `domain_admin` = workspace admin.** Side-table `agentWorkspace` удалена; hardcoded `DOMAIN_LABELS` удалены; stat-tile «Team» переименован в «Workspace» везде. План: `docs/agent-plans/2026-05-08-1900-domain-workspace-merge.md` (выполнен 2026-05-08).

- **Что это:** концепт «workspace = команда внутри компании» — UI-контейнер для agents / approvals / activity / costs. Пользователь может состоять в нескольких workspace'ах одновременно. На бэке эта же сущность называется `domain`.
- **State-модель:** UI держит **два независимых слайса**:
  - **`activeWorkspaceId: string | null`** — «рабочий контекст». Single-active. Driver для hire-form (default target), Team Map sandbox, `WorkspaceRemount` keying. Persist'ится в `localStorage["proto.session.v1"].activeWorkspaceId`.
  - **`scopeFilter: string[]`** — глобальный sticky filter для всех list-экранов. `[]` = «all workspaces» (union по memberships, дефолт). `[wsA, wsB, ...]` = explicit subset. Persist'ится в `localStorage["proto.scope.v1"]` как `{ userId, filter }` (userId tag отсекает протекание между демо-логинами на одном устройстве).
  - **Связи нет:** смена active в switcher не трогает filter, и наоборот. Это разделение «контекст действия» vs «контекст просмотра» зафиксировано в `docs/plans/workspaces-redesign-spec.md § 2`.
- **Где в UI (mock — но не везде глубокий мок):**
  - `WorkspaceSwitcher` в header сайдбара — caption «Working in», текущий workspace, dropdown с radio-list + helper «New agents will be hired into the selected workspace.» + `+ Create workspace` + `Manage workspaces` + MockBadge. При >=10 memberships в dropdown появляется search input.
  - Глобальный chip-row на `/agents`, `/activity`, `/approvals`, `/costs` — лейбл «Showing:», первый чип «All workspaces» (filter==[]), далее чипы на каждый workspace. Sticky-last (нельзя снять последний чип, не активировав «All workspaces»). Скрыт при N≤1.
  - `/workspaces` (`WorkspacesScreen`) — helper-text + card grid + Create/Edit/Delete + Members card (read-only).
  - Hire-form (`/agents/new`) — header «Hiring into: X [Change]» с локальным per-hire override; глобальный active не трогается. Welcome-step + каждый wizard-step.
  - AgentDetail Overview tile «Workspace», RunDetail MetaRow «workspace», AgentDetail Settings → `WorkspaceCard` с move-action — все читают `agent.domain_id` и резолвят имя через `workspaceLabel(id)` (lookup в `fxWorkspaces`).
  - Filter cascade в `api.list*` — каждый list-метод (`listAgents`, `listApprovals`, `listRuns`, `listAudit`, `listChats`, `getSpend`, `listHandoffs`) принимает `workspace_ids?: string[]`. Пустой/undefined → fallback на union по memberships (`getAllUserWorkspaceIds()`). **Resolve agent → workspace через `agent.domain_id` напрямую** — никакого side-table.
  - Auto-create на login: если `GET /workspaces` вернул empty list для свежего юзера, клиент инициирует `POST /workspaces` с `{ name: 'Main' }` (idempotent, см. `auth.tsx`). Демо-юзеры с memberships не задеты.
- **Что говорит spec:**
  - **Есть:** `Agent.domain_id: uuid|null`, `User.domain_id: uuid|null`, роль `domain_admin`. Это и есть наш workspace FK + workspace admin role.
  - **Нет:** `Workspace` (или `Domain`) schema, `/workspaces` (или `/domains`) namespace, membership endpoints, `PATCH /agents/{id}` (для move-action).
- **Что нужно от backend (минимально):**
  - `Workspace`/`Domain` schema (`id`, `name`, `description?`, `created_at`). Backend выбирает имя — UI нормализует.
  - `Membership` schema (`workspace_id`, `user_id`, `joined_at`, optionally `role`).
  - `GET /workspaces` (или `/domains`) — workspaces visible to the bearer (via memberships).
  - `GET /workspaces/{id}` / `POST /workspaces` / `PATCH /workspaces/{id}` / `DELETE /workspaces/{id}`.
  - `GET /workspaces/{id}/members` (read-only достаточно для v1).
  - `PATCH /agents/{id}` с `{ domain_id }` — для move-action (см. AgentDetail Settings → WorkspaceCard).
  - **Filter param на list endpoints:** `?workspace_ids[]=ws_a&workspace_ids[]=ws_b` (multi-param) ИЛИ `?workspace_ids=a,b` (CSV) — на бэке маппится на `domain_id IN (...)` фильтр. Применяется к `/agents`, `/dashboard/runs`, `/audit`, `/approvals`, `/chat`, `/dashboard/spend`. **Когда параметр НЕ передан** — сервер ВОЗВРАЩАЕТ union по всем workspace'ам пользователя (это контракт нашего «filter==[]» = «all»; на этот же контракт опирается sidebar approval badge — счётчик считает ALL pending без передачи workspace_ids).
  - Aggregations (`/dashboard/spend`): либо честный server-side multi-param, либо `group_by=workspace` чтобы UI не считал per-workspace aggregation client-side. Сейчас у `/dashboard/spend` нет `workspace_id` query вообще.
- **Auto-create на регистрации:**
  - Вариант A (проще): `POST /auth/register` (см. § 1.1) сам создаёт первый workspace с именем `Main` и добавляет юзера как member. Клиент только зовёт `GET /me` после login и получает уже не-пустой membership list.
  - Вариант B (текущий мок): клиент после login проверяет `GET /workspaces` и при `length === 0` сам зовёт `POST /workspaces`. Backend делать ничего не нужно.
  - Решение за бэкенд-командой; UI в обоих случаях работает идентично — после login `myWorkspaces.length >= 1` гарантировано.
- **Search в switcher:** при >>10 workspaces список memberships может стать большим. Реальный `GET /workspaces` должен поддерживать pagination и optional `?name=` filter. Сейчас клиент просто читает весь список и фильтрует in-memory — не блокер для MVP, но упомянуть.
- **Sync filter между устройствами:** на данный момент `scopeFilter` живёт ТОЛЬКО в клиенте (localStorage). Backend о нём знать не нужно. Если в будущем понадобится sync — отдельный endpoint типа `GET/PUT /me/preferences`. Сейчас явно out of scope.
- **Что нужно дополнительно (для invite/remove):** `POST /workspaces/{id}/members`, `DELETE /workspaces/{id}/members/{user_id}`, плюс реальный `GET /users` для resolver'а (см. § 1.2).
- **Что не меняется:**
  - `Agent` / `User` типы в `types.ts` остаются 1:1 со спекой. `domain_id` поле уже есть — UI читает его как workspace FK.
  - Внутренние имена (`Agent.domain_id`, role enum `domain_admin`, `ToolGrant.scope_type='domain'`) — backend-контрактные, не трогаем.
- **MockBadge:** да — на `/workspaces` (header), в dropdown свитчера, на Members card, на AgentDetail Settings WorkspaceCard. `kind="design"` — Workspace CRUD endpoints отсутствуют (само поле `Agent.domain_id` есть).
- **Files:** `src/prototype/lib/workspace-context.ts`, `src/prototype/lib/scope-filter.tsx`, `src/prototype/lib/api.ts` (методы `listWorkspaces` / `getWorkspace` / `createWorkspace` / `updateWorkspace` / `deleteWorkspace` / `listWorkspaceMembers` / `listWorkspaceStats` / `getAgentWorkspace` / `setAgentWorkspace` / `getAgentWorkspaceMap`), `src/prototype/lib/types.ts` (`Workspace` / `WorkspaceMembership` / `WorkspaceList` / `CreateWorkspaceRequest` / `UpdateWorkspaceRequest`), `src/prototype/lib/format.ts` (`workspaceLabel`), `src/prototype/lib/fixtures.ts` (`workspaces` / `workspaceMemberships`; `Agent.domain_id` теперь хранит ws_* ids), `src/prototype/auth.tsx` (`activeWorkspaceId` в `StoredSession`, `useAuth().{myWorkspaces, setActiveWorkspace, refreshWorkspaces, ...}`, auto-create on login), `src/prototype/components/{workspace-switcher,workspace-form-dialog,workspace-delete-dialog,workspace-remount}.tsx`, `src/prototype/components/common/{workspace-filter,workspace-context-pill}.tsx`, `src/prototype/screens/WorkspacesScreen.tsx`.
- **Планы:** `docs/agent-plans/2026-05-06-2200-workspaces-mock.md` (initial), `docs/agent-plans/2026-05-08-0030-page-filters-vs-global-scope.md` (intermediate), `docs/agent-plans/2026-05-08-1645-workspaces-redesign.md` (active/filter split), `docs/agent-plans/2026-05-08-1900-domain-workspace-merge.md` (domain ≡ workspace merge — current).

### 1.16 — Agent-to-agent communication ⚠️ design preview

- **Что это:** концепт «один агент в процессе своей работы спрашивает другого» — handoff внутри run'а. Surfacing'ом служит `/sandbox/team-map`: пространственная визуализация недавних handoff'ов в окне 24h / 7d / 30d. Vocab: `handoff` (internal) / `ask between agents` (user-facing).
- **Где в UI (sandbox preview, целиком mock):**
  - `/sandbox/team-map` (`TeamMapScreen`) — sidebar entry под divider'ом рядом с `team-bridge`, preview-badge.
  - SVG-canvas с карточками агентов и линиями между парами; hover → tooltip («Sarah asked Tom …»); click → `/activity/:runId`.
  - Aggregate per pair: один edge на пару, толщина = функция от количества handoff'ов, стиль = доминирующий статус (`pending > timed_out > declined > answered`).
- **Что говорит spec:** ничего. В `docs/gateway.yaml` нет `Handoff` schema, нет `agent_call` step kind в `RunStep.step_type`, нет `/handoffs` endpoint'а. Поведение в backend не существует — это **«behavior pending design»**, не «endpoint pending wiring». Mock здесь глубже, чем у `/workspaces`.
- **Что нужно от backend (когда design дойдёт до spec'а):**
  - Эмитить `RunStep` с `step_type: 'agent_call'` и payload вроде `{ from_agent_id, to_agent_id, summary, status }` (точная shape — design decision).
  - Опционально: денормализованный endpoint `GET /handoffs?since=...&workspace_id=...` для эффективной выборки за окно (без N+1 derive из runs).
  - `Handoff.status` как минимум `pending|answered|timed_out|declined` — pending→timed_out timeout policy на стороне orchestrator'а (UI ждёт готовый статус).
  - Workspace-scoped фильтрация — handoff'ы наследуют scope через agent (cross-workspace asks UI не показывает).
- **Что меняется при wiring'e:** в `lib/api.ts` `listHandoffs` либо переходит на новый endpoint, либо derive'ит из `listRuns` собирая `agent_call` steps. UI consumer не меняется. `Handoff.workspace_id` денорм-поле (mock-only convenience) уйдёт — будет резолвиться через agent.
- **MockBadge:** да — `kind="design"` в header'е `/sandbox/team-map`, hint указывает на этот § 1.16.
- **Files:**
  - `src/prototype/lib/types.ts` — `Handoff` / `HandoffStatus` / `HandoffList`, `agent_call` в `RunStepType`.
  - `src/prototype/lib/fixtures.ts` — `handoffs[]` (10 seed'ов в ws_ops), `agentPositions` side-table.
  - `src/prototype/lib/api.ts` — `listHandoffs({ since? })`.
  - `src/prototype/screens/sandbox/TeamMapScreen.tsx` — surface.
  - `src/prototype/components/team-map-canvas.tsx` — SVG canvas + hover tooltip + click navigation.
  - `src/prototype/components/shell.tsx` — sidebar entry.
  - `src/prototype/prototype.css` — стили `.team-map*`.
- **Removability:** удаляется как одна единица — sandbox surface, без production-зависимостей. См. self-описание в комментарии шапки `TeamMapScreen.tsx`.
- **План:** design doc `docs/plans/2026-05-07-1830-team-map-preview.md`, impl plan `docs/agent-plans/2026-05-07-1900-team-map-impl.md`.

---

## 2. Synthesized data on the client

### 2.1 — Cost trend (4 недели)

- **Где:** `SpendScreen.tsx` → `FourWeekTrend`.
- **Как синтезируется:** weights `[0.30, 0.34, 0.36, real_7d]` поверх `(30d - 7d)`. Псевдо-uptrend.
- **Backend должен:** см. §1.9.
- **MockBadge:** ✅.

### 2.2 — Activity sentence text

- **Где:** `RunsScreen.tsx` → `runHeadline()`.
- **Как:** mapping `RunStatus → "Sales Agent finished an activity"` etc. Не показывает что именно сделал AI ("found 3 leads", "sent email").
- **Backend должен:** возвращать `summary: string` в `RunListItem` или `RunDetail`. Это backend territory — orchestrator или summary-generator. Без этого client может только status-based templates.
- **MockBadge:** не помечено отдельно — это часть design language, не synthesized data per se. Но фактически — гэп.

### 2.3 — App "connection" status — это и есть правильная модель (rewritten 2026-05-01)

- **Где:** `ToolsScreen.tsx` → `usedBy` list. *(Сама страница Apps скрыта в MVP — см. handoff-prep § 2.8 — но логика остаётся в коде.)*
- **Как работает:** App показывается как "Connected" если хотя бы один agent имеет grant на любой tool этого app prefix-а.
- **Это не workaround.** На этой платформе **нет per-tenant OAuth-уровня** (см. handoff-prep § 0). Int3grate владеет shared credentials, и единственная авторизация на user-стороне — `setGrants` (agent-level permissions). Поэтому "app is connected" по определению = "хотя бы один agent имеет permission" — это правильная семантическая модель.
- **Что нужно от backend:** ничего. Концепт работает корректно поверх существующего `GET /tools` + `PUT /agents/{id}/grants`.
- **Caveat для UI:** слово "Connected" может вводить в заблуждение (вызывает OAuth-ассоциации). Если страницу Apps когда-то восстановят — переименовать в "Used" / "In use by" / "Authorised for".

### 2.4 — Audit events from run steps

- **Где:** `lib/api.ts:461` — comment.
- **Как:** mock синтезирует audit events из steps в `fxRuns`. Реальный gateway передаёт `GET /internal/audit` от orchestrator.
- **Backend должен:** уже есть в спеке (`GET /audit`). Mock-only синтез — это просто fixture data generation. Не блокер.

### 2.5 — Date grouping (Today / Yesterday / This week / Earlier)

- **Где:** `RunsScreen.tsx` → `dateGroup()`.
- **Как:** client-side bucketing.
- **Backend должен:** ничего, это виз UI логика. Нет gap-а.

### 2.6 — Trend % vs previous week (Home + Costs hero)

- **Где:** `HomeScreen.tsx` Spending section, `SpendScreen.tsx` hero.
- **Как:** `prevWeek = (30d - 7d) × 7/23`, потом `(7d - prevWeek) / prevWeek × 100`. Использует два реальных endpoint'а.
- **Backend должен:** ничего обязательного — формула честная. Можно ускорить добавив `/spend?compare=previous_week`, но необязательно.
- **MockBadge:** не помечено (формально оба endpoint реальные).

### 2.7 — Activity heatmap (deleted in Phase 2)

- ~~Был в Phase 1, удалён в Phase 2~~. Больше не релевантно.

### 2.8 — Savings banner (deleted in Phase 2)

- ~~Был в Phase 1, удалён в Phase 2~~. Больше не релевантно.

---

## 3. Mock-only behavior (real backend handles differently)

### 3.1 — JWT format

- **Где:** `lib/api.ts:78-89`.
- **Mock:** token = `mock_<userId>`, decoder извлекает userId из строки.
- **Backend:** signed JWT с подписью + expiration. Frontend не должен decode-ить — gateway resolves через `GET /me`.
- **Migration impact:** zero — UI уже использует `GET /me`, JWT layout — implementation detail.

### 3.2 — Async approval decision polling

- **Где:** `lib/api.ts:570-643`, `ApprovalDetailScreen.tsx:79-112`.
- **Mock:** `setTimeout` 1.5-3s до flip approval, потом 2-3s до terminal run state.
- **Backend:** orchestrator асинхронно processit decision; UI polls `getApproval` + `getRun` (уже работает — это правильный pattern). Просто реальные latencies будут другие.
- **Migration impact:** zero — UI код одинаковый.

### 3.3 — Chat streaming (SSE simulation)

- **Где:** `components/chat-panel.tsx`, `lib/api.ts:sendChatMessage`.
- **Mock:** Async generator emit-ит фрейки `turn_start`, `text_delta`, `tool_call`, `tool_result`, `turn_end`, `done`.
- **Backend:** real `POST /chat/{id}/message` возвращает `text/event-stream`. Frontend reader: `fetch().body.getReader()` → parse SSE → emit frames.
- **Migration impact:** заменить producer в `api.sendChatMessage` на fetch+SSE reader. Consumer (UI) не меняется.

### 3.4 — In-memory mutations persist for page lifetime

- **Где:** все `api.create*` / `api.set*` / `api.close*` методы.
- **Mock:** мутирует fixture arrays напрямую. После refresh — данные сбрасываются.
- **Backend:** persistent storage. Refresh показывает реальное состояние.
- **Migration impact:** zero — UI код одинаковый.

### 3.5 — Agent status flip после createAgentVersion

- **Где:** `AgentNewScreen.tsx:147` (Phase 7 wizard).
- **Mock:** `fresh.status = 'active'` напрямую после `activateVersion`.
- **Backend:** см. §1.4.
- **Migration impact:** удалить хак, доверить backend-у транзицию.

---

## 4. Disabled UI features (planned, no backend yet)

### 4.1 — Pause AI worker / Fire AI worker

- **Где:** `AgentDetailScreen.tsx` → Settings tab.
- **Что нужно:** `PATCH /agents/{id}` со status transition, либо отдельные endpoint-ы `POST /agents/{id}/pause`, `DELETE /agents/{id}`.
- **Status:** disabled "(planned)".

### 4.2 — Manage billing / Rename workspace / Close workspace

- **Где:** `SettingsScreen.tsx` → Workspace tab.
- **Что нужно:** см. §1.5.
- **Status:** disabled "(planned)".

### 4.3 — Invite member

- **Где:** `SettingsScreen.tsx` → Team members tab.
- **Что нужно:** см. §1.6.
- **Status:** disabled "(planned)".

### 4.4 — ~~Connect new app (Authorise per service)~~ — REMOVED 2026-05-01

> **Этой записи больше нет.** Концепт «Connect a new app» / «Authorise per service» был основан на отсутствующей OAuth-модели (см. удалённую § 1.7 и `handoff-prep.md § 0`). Сама модалка `ConnectAppTile` остаётся в `ToolsScreen.tsx`, но страница Apps скрыта в MVP (см. handoff-prep § 2.8); если когда-то будут восстанавливать — этот концепт нужно полностью переосмыслить, не «доделать OAuth». Запись оставлена как stub чтобы не ломать ссылки.

### 4.5 — Diagnostic mode rendering

- **Где:** `SettingsScreen.tsx` → Diagnostic tab.
- **Что есть:** toggle пишет `localStorage["proto.diagnostic.v1"]`.
- **Чего нет:** conditional rendering technical hints в основном UI. Plan section 5 / 11 описывает что это должно показывать API endpoints в InfoHint обратно когда включено.
- **Status:** placeholder switch.

---

## 5. Plan-optional items (документированы как намеренно skipped)

### 5.1 — Edit-before-approve

- **Plan:** section 7.2 — option to edit approval action body before approving (e.g., edit email before sending).
- **Status:** не реализовано. Открытый design question — какие поля `evidence_ref` editable, как UX.

### 5.2 — Demo data mode

- **Plan:** section 8 шаг 5 + section 11 — fake activity / approvals / spend для нового пользователя плюс "Reset to clean workspace" button.
- **Status:** не реализовано. Полезно для sales-демо.

---

## 6. Tour copy debt (Phase 10 deferred)

- `sidebar-tour.tsx`, `approval-review-tour.tsx`, `configure-tool-grants-tour.tsx` — селекторы и тексты ссылаются на удалённые/перемещённые элементы (tour rebuild deferred).
- **Status:** ⏸ Deferred user-decision, not a backend issue.

---

## 5. Naming mismatches between mock and live spec

Точечные расхождения между нашим `lib/api.ts` (мокает paths) и реальным `gateway.yaml`. Не функциональные баги — только переименования при swap к real http client.

### 5.1 — `/tools` (mock) → `/tool-catalog` (live)

- **Где:** `lib/api.ts` метод `api.listTools()` — внутренне мокает path `/tools`. В live spec real path — `/tool-catalog` (operationId `listToolCatalog`).
- **Impact:** ноль на mock layer. Когда swap к real http client — изменить URL string в одной строке.
- **Кому помнить:** разработчику который будет делать `lib/api.ts` mock-to-real swap.

---

## 6. Tasks subtree — absent in live spec entirely (UI fully removed 2026-05-02)

> **Update 2026-05-02:** UI removed entirely. 4 screens deleted (`TasksScreen`, `TaskDetailScreen`, `TaskNewScreen`, `TaskOutcomesCard`), all `/tasks/*` routes removed, `api.listTasks` / `getTask` / `createTask` removed, types deleted, `fxTasks` fixtures removed, training-fixtures `tasks: []` cleaned. Approval task chip removed from `ApprovalDetailScreen`. The original section below is preserved for backend-team context.



В legacy local draft (`gateway-legacy-2026-04.yaml`) пути `/tasks/*` присутствовали с пометкой `x-mvp-deferred`. **В live spec (`gateway.yaml`) их нет вообще** — даже как deferred placeholder. Это значит:

- Backend **никогда не вернёт** Task data — `listTasks`, `getTask`, `createTask` всегда будут 404 в production.
- Frontend Tasks subtree (`/tasks`, `/tasks/new`, `/tasks/:id`) на mock работает, в production **немедленно падает**.
- Mitigation: Tasks routes доступны только через deep-link из approval task chip (sidebar нет). При production swap нужно либо удалить Tasks UI целиком, либо добавить try/catch + fallback "Tasks not available".

`MockBadge kind="deferred"` на Tasks-screens нужно поменять на `kind="design"` или явно "absent" — текущий ярлык "deferred" подразумевает "будет позже", что неточно.

---

## 7. Open questions for backend-product alignment

Эти вопросы открыты для backend-product alignment:

- **Notifications** — как пользователь узнаёт о новом approval? Email? In-app? Push? Backend должен expose-ить notification settings + delivery mechanism. Сейчас UI просто показывает badge на sidebar.
- **Diagnostic mode toggle** — нужно ли хранить per-tenant или per-user? UI кладёт в localStorage (per-browser).
- **Шаблоны AI-сотрудников** — `lib/templates.ts` имеет 7 hardcoded. Реально templates должны жить либо в backend (`/templates`), либо в client config — открыто.

---

## Сводная таблица приоритета для backend

| # | Что | Важность | Visually flagged in UI |
|---|---|---|---|
| 1.1 | `POST /auth/register` | 🚨 ship blocker | ✓ MockBadge on RegisterScreen |
| 1.2 | `GET /users` | 🚨 ship blocker | ✓ MockBadge on Settings → Team |
| ~~1.3~~ | ~~`GET /approvals/{id}`~~ | ✅ resolved — есть в live spec (workaround снят) | — |
| 1.4 | Agent status flip endpoint | ⚠️ medium | — internal hack, no user surface |
| ~~1.7~~ | ~~Integration registry + OAuth~~ | ❌ removed — out-of-scope (см. handoff-prep § 0) | — |
| 1.6 | User invitation | ⏸ может быть post-MVP | ✓ disabled "(planned)" button on Settings → Team |
| 1.5 | Workspace CRUD | ⏸ может быть post-MVP | ✓ MockBadge on Settings → Workspace + disabled buttons |
| 1.8 | Filter runs by agent_id | ⚠️ performance | — internal, not surface |
| 1.10 | Batch grants fetch | ⚠️ performance | — internal, not surface |
| 1.9 | Per-week spend buckets | ⚠️ low (есть workaround) | ✓ MockBadge on Costs trend chart |
| 1.11 | `requested_action` structured | ⚠️ low (есть workaround) | — invisible (transformation handled in helpers) |
| 4.1 | Pause/Fire endpoints | ⚠️ должно быть до GA | ✓ MockBadge on Settings tab → Manage employment |
| 2.2 | Activity sentence summary | ⚠️ улучшение UX | ✓ MockBadge on Activity page |
| 1.16 | Agent-to-agent communication | ⚠️ design preview (sandbox-only) | ✓ MockBadge on /sandbox/team-map |

---

## Visual mock-flagging pass

Каждая user-facing surface, опирающаяся на синтезированные данные или отсутствующий endpoint, должна быть помечена `<MockBadge>`.

`<MockBadge>` имеет два kind-а:
- **`kind="design"`** — endpoint полностью отсутствует в спеке (синие/красные dashed pill «MOCK»)
- **`kind="deferred"`** — endpoint есть, но `x-mvp-deferred` (амбер dashed pill «DEFERRED»)

При наведении показывает hint с конкретной причиной.

---

**Last updated:** 2026-05-08 (latest) — § 1.15 (Workspaces) rewritten for the **domain ≡ workspace merge** (architectural decision, see `docs/handoff-prep.md § 0.1`). Backend `domain` and frontend `workspace` are now treated as one entity: `Agent.domain_id` (already in spec) IS the workspace FK, role `domain_admin` IS workspace admin. Side-table `agentWorkspace` removed; `DOMAIN_LABELS` hardcode removed; new `workspaceLabel(id)` helper resolves names via `fxWorkspaces`. UI labels updated: AgentDetail Overview tile «Team»→«Workspace», Settings MetaRow dropped (dup of WorkspaceCard), RunDetail MetaRow «team»→«workspace», ProfileScreen Scope card resolved label conflict (tenant Caption «Workspace»→«Tenant», domain Caption «Team»→«Workspace»). Backend contract minimally affected — still need `Workspace` (or `Domain`) schema + CRUD endpoints + `PATCH /agents/{id}` for move-action, but `Agent.workspace_id` is no longer requested (the field exists as `domain_id`).

Earlier 2026-05-08 — § 1.15 (Workspaces) rewritten for the active/filter split redesign. UI now keeps `activeWorkspaceId` (where I work — drives hire) and `scopeFilter: string[]` (what I see — global sticky chip-row, default `[]` = all memberships) as TWO INDEPENDENT slices. Switcher relabeled "Working in"; chip-row labeled "Showing:" with first chip "All workspaces". Sidebar nav "Team" → "Agents". Auto-create "Main" workspace on first login when memberships are empty. Backend contract for list endpoints unchanged — still `?workspace_ids[]=...`, omit = union over user memberships.

Earlier 2026-05-08 — § 1.15 (Workspaces) updated. UI pivoted to single-active switcher + per-page workspace filters; list endpoints accept `workspace_ids[]`, defaulting to "all user memberships" when omitted (used by the unscoped sidebar approval badge).

Earlier 2026-05-07 (later) — § 1.15 extended with multi-scope filter requirements. UI now supports selecting several workspaces at once; list endpoints + aggregations need `workspace_id[]` / `workspace_ids` semantics.

Earlier 2026-05-07 — added § 1.16 (Agent-to-agent communication) for the `/sandbox/team-map` preview. Sandbox-only, design preview, deeper mock than usual (behavior pending design, not just wiring).

Earlier 2026-05-01 (later) — `docs/gateway.yaml` synced verbatim with live stage spec (`https://stage.api.int3grate.ai/docs/openapi.yaml`, OpenAPI 3.2.0, version 0.1.0). Reconciliation revealed: § 1.3 (`GET /approvals/{id}`) actually exists in live → resolved + workaround removed. Tasks subtree completely absent in live spec (was `x-mvp-deferred` in legacy draft) → new § 6 documents this. Naming gap `/tools` ↔ `/tool-catalog` → new § 5.

Earlier 2026-05-01: removed § 1.7 (Integration registry / OAuth) and § 4.4 (Connect new app modal) as architecturally out-of-scope; rewrote § 2.3 (App connection status) as the canonical model.

Earlier: 2026-04-28 — Phase 11 + visual mock-flagging pass.
