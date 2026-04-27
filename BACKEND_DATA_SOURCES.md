# Источники данных бэкенда

_Где какие данные должны браться из реального API, когда мы заменим in-memory фикстуры на gateway-клиент._

**Контекст.** Сейчас фронтенд (`src/prototype/`) полностью замокан: `lib/api.ts` ходит в массивы из `lib/fixtures.ts` через `delay()` и мутирует их в памяти. Реальной сети нет. Этот документ — карта соответствия: для каждого экрана и каждого UI-вызова указано, из какого endpoint'а должны прийти данные согласно `gateway_new.yaml` (контракт **Gateway v0.2.0**).

При интеграции с реальным бэкендом нужно будет:
1. Заменить тело методов в `src/prototype/lib/api.ts` на `fetch`-вызовы к gateway.
2. Удалить (или оставить как seed для dev-режима) `src/prototype/lib/fixtures.ts`.
3. Везде, где UI домысливает за бэк (см. раздел «Пробелы»), договориться с бэк-разработчиком — либо добавить endpoint, либо изменить UI.

---

## 1. Контракт бэкенда

- Спека: `gateway_new.yaml` (OpenAPI 3.1, версия `0.2.0`).
- Полный дифф с предыдущей версией: `GATEWAY_DIFF.md`.
- Базовый URL: `http://localhost:8080` (dev). Прод-URL должен прийти от инфры.
- Авторизация: JWT Bearer (`/auth/login` выдаёт `token + expires_at`). Все защищённые endpoint'ы помечены `security: bearerAuth`.
- Сущности с пометкой `x-mvp-deferred`: `/tasks/*`. UI оставлен «for design continuity», но бэк может временно вернуть `501` или вовсе не реализовать — фронт должен это переживать.
- Endpoint'ы с пометкой `x-internal`: `/internal/*`. Для service-to-service вызовов оркестратора, **не должны** быть достижимы с публичного клиента. UI рендерит `Policy snapshot` ради демонстрации, но в проде эту панель надо либо убрать, либо проксировать через отдельный admin-endpoint.

---

## 2. Каноничные сущности и их источник

| Сущность | Тип в `lib/types.ts` | Откуда берётся | Откуда мутируется |
|---|---|---|---|
| `User` | `User` | `GET /me` (свой профиль) | `POST /auth/login` (создаёт сессию) |
| `Agent` | `Agent` | `GET /agents`, `GET /agents/{id}` | `POST /agents` |
| `AgentVersion` | `AgentVersion` | вложен в `Agent.active_version` | `POST /agents/{id}/versions`, `POST /agents/{id}/versions/{verId}/activate` |
| `ToolGrant` | `ToolGrant` | `GET /agents/{id}/grants` | `PUT /agents/{id}/grants` |
| `ToolDefinition` | `ToolDefinition` | `GET /tools` | только бэк (каталог) |
| `GrantsSnapshot` | `GrantsSnapshot` | `GET /internal/agents/{id}/grants/snapshot` (**internal**) | только оркестратор |
| `Task` | `Task` | `GET /tasks`, `GET /tasks/{id}` | `POST /tasks` (**MVP-deferred**) |
| `Run` | `Run` (со списком `RunStep`) | `GET /runs/{id}` | оркестратор асинхронно (нет публичного `POST /runs`) |
| `ApprovalRequest` | `ApprovalRequest` | `GET /approvals` | `POST /internal/approvals` (создание оркестратором), `POST /approvals/{id}/decision` (решение пользователя) |
| `SpendDashboard` | `SpendDashboard` | `GET /dashboard/spend?range=&group_by=` | только бэк-агрегация |

> **Важно про идентификаторы.** Везде в спеке id'шники имеют префиксы (`agt_`, `ver_`, `tsk_`, `run_`, `apv_`, `usr_`, `ten_`, `dom_`, `grt_`, `stp_`). UI больше **не показывает** их пользователю — только использует во внутренних href и в API-вызовах. Любые «человеческие» имена (`agent.name`, `user.name`, `domain` через `domainLabel`) идут из тех же entity-ответов или из общего справочника.

---

## 3. Карта экранов → API

### `/login` — `LoginScreen`
- `POST /auth/login` с `{ email, password }`. Возвращает `LoginResponse { token, expires_at }`.
- После логина фронт сразу зовёт `GET /me`, чтобы получить полный `User` (роль, `approval_level`, `tenant_id`, `domain_id`).
- **Прототип:** `api.login()` принимает любой пароль и просто ищет фикстуру по email. JWT-токены не выпускаются.
- **Что менять:** хранить полученный `token` (в `localStorage` сейчас лежит только `userId`), прокидывать его как `Authorization: Bearer <token>` во все остальные запросы. Истечение токена (`expires_at`) надо обрабатывать → редирект на `/login`.

### `/register` — `RegisterScreen`
- **В спеке нет endpoint'а `POST /auth/register`.** UI создаёт юзера + tenant прямо на клиенте (мутирует фикстуры).
- **Что менять:** спросить бэкенд, как должен происходить онбординг нового workspace'а. Возможные варианты: отдельный `POST /auth/register`, инвайт-флоу через email, или вообще через биллинг/админку. Пока — это **открытый вопрос к бэкенду**.

### `/` — `HomeScreen` (Dashboard)
Параллельно зовёт:
- `GET /agents` → `listAgents` (список агентов).
- `GET /tasks` → `listTasks` (без фильтра).
- `GET /approvals` → `listApprovals` (без фильтра).
- `GET /dashboard/spend?range=7d&group_by=agent` → только для админов (`role === 'admin' | 'domain_admin'`).
- `GET /me` неявно — берётся из `AuthProvider`, который однажды загрузил пользователя.

`MemberView` дополнительно фильтрует по `requested_by === user.id` и `created_by === user.id` — это делает фронт, бэкенд возвращает полный список (на момент v0.2.0 серверной фильтрации `?requested_by=me` нет).

### `/agents` — `AgentsScreen`
- `GET /agents` → весь список.
- `GET /users` (см. «Пробелы») → нужен только чтобы показать имя owner'а вместо `usr_*`. **В gateway v0.2.0 такого endpoint'а нет**, в моке используется `api.listUsers()`. Реальный бэк должен либо:
  - добавить `GET /users` (или `GET /tenants/{id}/users`),
  - либо включать `owner.name` прямо в ответ `GET /agents` (денормализация).

Фильтрация по `status` и поисковая строка делаются **на клиенте** — не присылается параметр в запрос.

### `/agents/new` — `AgentNewScreen`
- `POST /agents` с `{ name, description?, domain_id? }`.
- `owner_user_id` бэк проставляет сам (из JWT-сессии). UI это не передаёт.
- Возвращается полный `Agent` с `status: 'draft'` и `active_version: null`.
- После успеха фронт делает `navigate(/agents/{id})`.

### `/agents/:agentId` (overview / grants / settings) — `AgentDetailScreen`
Параллельно:
- `GET /agents/{id}` → агент с уже встроенной `active_version`.
- `GET /agents/{id}/grants` → список `ToolGrant`.
- `GET /users` → словарь для подстановки имени owner'а / автора версии.

Tab `grants` дополнительно открывает `PolicySnapshotPanel`, который зовёт `GET /internal/agents/{id}/grants/snapshot`. **Это internal endpoint** — в проде он не должен быть доступен фронту. Решения два: проксировать через admin-endpoint или совсем убрать панель из публичного UI.

### `/agents/:agentId/grants` — `GrantsEditor`
- Загружает `ToolGrant[]` через `getGrants` (см. выше) **и** `GET /tools` (`api.listTools()`) для подсказок в авто-комплите названий тулов.
- Сохраняет через `PUT /agents/{id}/grants` с телом `ReplaceToolGrantsRequest` (только `{ tool_name, mode, approval_required, config }` — `id`/`scope_*` присваивает gateway).
- Бэк возвращает обновлённый `ToolGrant[]` с уже проставленными id/scope.

### `/agents/:agentId/versions/new` — `VersionNewScreen`
- `POST /agents/{id}/versions` с `CreateAgentVersionRequest` (instruction_spec обязателен, остальное — JSON-конфиги).
- Если выбран чек-бокс «activate immediately» — следом `POST /agents/{id}/versions/{verId}/activate`.
- Версия возвращается с `created_by` равным юзеру из JWT, `is_active: false` до активации.

### `/tasks` — `TasksScreen`
- `GET /tasks?status=...` — фильтр по статусу применяется **server-side**.
- `GET /agents` и `GET /users` для резолвинга имён.
- Пагинация делается на клиенте (см. «Пробелы»).

### `/tasks/new` — `TaskNewScreen`
- `GET /agents` для пикера.
- `POST /tasks` с `CreateTaskRequest` (`agent_id`, `user_input`, `type?`, `title?`, `domain_id?`).
- В ответе бэк не возвращает `run_id` — оркестратор присоединит run асинхронно. Фронт показывает success-панель с инвайтом «Open task detail».
- Помечено `x-mvp-deferred` — production-путь, скорее всего, будет диспатчить run напрямую (например, `POST /runs`), минуя task. Когда бэк определится — поправить и API, и success-flow.

### `/tasks/:taskId` — `TaskDetailScreen`
- `GET /tasks/{id}`.
- `GET /agents`, `GET /users` (опять — для имён).
- В Task **нет** `run_id`: чтобы посмотреть выполнение, пользователь должен открыть run по-отдельности (UI дает кнопку «Open run», но run-ID он сейчас знать не может — это отдельный gap; пока используется только в `ApprovalDetailScreen` и `RunDetailScreen`, куда run-ID приходит из других источников).

### `/runs/:runId` — `RunDetailScreen`
- `GET /runs/{id}` — возвращает run **со встроенным `steps[]`** (полный timeline).
- Никаких отдельных вызовов за шагами — всё в одном ответе.
- Поля `tool_errors` и `error_kind` пришли в v0.2.0; фронт уже их рендерит.

### `/approvals` — `ApprovalsScreen`
- `GET /approvals?status=...` — фильтр серверный.
- `GET /users` — для резолвинга `approver_user_id` и для fallback'а `requested_by`, если в ответе нет `requested_by_name`.

### `/approvals/:approvalId` — `ApprovalDetailScreen`
- `GET /approvals/{id}` (см. «Пробелы» — этого endpoint'а в спеке **нет**, мок ищет в списке).
- `GET /users` для имён.
- При decide:
  - `POST /approvals/{id}/decision` с `ApprovalDecisionRequest { decision, reason? }`.
  - Бэк отвечает **`202 Accepted`** + `ApprovalDecisionAccepted { approval_id, decision, status: 'queued' }`. Это **не sync** — оркестратор обработает решение асинхронно.
  - Дальше фронт **поллит** `GET /approvals/{id}` (раз в ~800 мс) до момента, когда `status !== 'pending'`. Затем переключается на пуллинг `GET /runs/{run_id}` до достижения terminal-status. См. `useEffect` в `ApprovalDetailScreen` ~строки 62-93.

### `/tools` — `ToolsScreen`
- `GET /tools` — публичный каталог `ToolDefinition[]`.
- Полностью статический список с `default_mode`, `description`, `input_schema`. Фильтрация и поиск — на клиенте.

### `/spend` — `SpendScreen`
- `GET /dashboard/spend?range={1d|7d|30d|90d}&group_by={agent|user}`.
- Возвращается уже агрегированный `SpendDashboard` с `total_usd` и `items[]`.
- Любая смена `range`/`group_by` инициирует **новый** запрос — фронт не пересчитывает на клиенте.
- Доступ только для `admin` / `domain_admin`. Бэк **должен** проверять это сам и отвечать `403` для member'ов; UI дополнительно показывает `NoAccessState`.

### `/profile` — `ProfileScreen`
- Только данные из `AuthProvider` (т.е. из ранее сделанного `GET /me`).
- Никаких новых вызовов.

### `/components` — `StyleGuideScreen`
- Чисто визуальный гайд, никаких API-вызовов.

---

## 4. Сводная таблица: метод mock-API → endpoint бэкенда

| `api.<метод>` (mock) | HTTP method + path | Тело запроса | Тело ответа |
|---|---|---|---|
| `login(email, password)` | `POST /auth/login` | `LoginRequest` | `LoginResponse` (потом `GET /me`) |
| `register(...)` | _нет в спеке_ | — | — |
| `me(userId)` | `GET /me` | — | `User` |
| `listUsers()` | _нет в спеке_ (см. пробелы) | — | `User[]` |
| `listAgents()` | `GET /agents` | — | `Agent[]` |
| `getAgent(id)` | `GET /agents/{id}` | — | `Agent` (с `active_version` внутри) |
| `createAgent(input)` | `POST /agents` | `CreateAgentRequest` | `Agent` |
| `createAgentVersion(agentId, input)` | `POST /agents/{id}/versions` | `CreateAgentVersionRequest` | `AgentVersion` |
| `activateVersion(agentId, verId)` | `POST /agents/{id}/versions/{verId}/activate` | — | `AgentVersion` (с `is_active: true`) |
| `getGrants(agentId)` | `GET /agents/{id}/grants` | — | `ToolGrant[]` |
| `setGrants(agentId, body)` | `PUT /agents/{id}/grants` | `ReplaceToolGrantsRequest` | `ToolGrant[]` |
| `listTasks(filter?)` | `GET /tasks?status=` | — | `Task[]` |
| `getTask(id)` | `GET /tasks/{id}` | — | `Task` |
| `createTask(input)` | `POST /tasks` | `CreateTaskRequest` | `Task` (без `run_id`) |
| `getRun(id)` | `GET /runs/{id}` | — | `Run` (с `steps[]`) |
| `listApprovals(filter?)` | `GET /approvals?status=` | — | `ApprovalRequest[]` |
| `getApproval(id)` | _нет в спеке_ (см. пробелы) | — | `ApprovalRequest` |
| `decideApproval(id, decision, reason, byUserId)` | `POST /approvals/{id}/decision` | `ApprovalDecisionRequest` | `202 Accepted` + `ApprovalDecisionAccepted` |
| `listTools()` | `GET /tools` | — | `ToolDefinition[]` |
| `getGrantsSnapshot(agentId)` | `GET /internal/agents/{id}/grants/snapshot` (**internal!**) | — | `GrantsSnapshot` |
| `getSpend(range, groupBy)` | `GET /dashboard/spend?range=&group_by=` | — | `SpendDashboard` |

---

## 5. Асинхронные паттерны, которые нельзя забыть

1. **Решение по approval — асинхронное.** `POST /approvals/{id}/decision` отвечает `202 + status: queued`. UI должен переключаться в режим polling, не предполагать синхронный ответ. Сейчас интервал ~800 мс для approval, ~1 с для run. См. `ApprovalDetailScreen`.

2. **Run прикрепляется к task асинхронно.** `POST /tasks` не возвращает `run_id`. Если нужен run сразу, фронт должен поллить `GET /tasks/{id}` или подписываться на отдельный канал (на момент v0.2.0 канала нет). Пока: UI просто показывает success-панель и даёт открыть task detail, где `run_id` тоже отсутствует — это известный gap.

3. **`active_version` уже встроена в `Agent`.** Никакого отдельного `GET /agents/{id}/versions` нет (в v0.2.0 list versions не публичный — только текущая активная). История версий не доступна, баннер на overview-табе об этом предупреждает.

4. **Snapshot tool-grants пересчитывается раз в run.** `GET /internal/agents/{id}/grants/snapshot` возвращает версионированный снапшот. UI показывает версию в бейдже; реальный оркестратор **пиннит** этот snapshot на время run'а, чтобы поведение было воспроизводимым даже если grants поменяли мид-ран.

5. **Latency simulation.** Mock-`delay()` рандомит 120-380 мс. Реальная сеть будет другой. Все экраны имеют loading state (`LoadingList`, `setUndefined` пока ждём ответа) — не убирать.

---

## 6. Пробелы между UI и спекой gateway v0.2.0

Места, где фронт **уже сейчас** домысливает endpoints, которых нет в `gateway_new.yaml`. Когда бэк-разработчик это увидит — нужен совместный апдейт спеки или подгонка UI:

| Что зовёт UI | Зачем | Что делать |
|---|---|---|
| `GET /users` (используется в `listUsers()`) | Чтобы рисовать имена вместо `usr_*` ID везде, где приходит `created_by` / `requested_by` / `approver_user_id` / `owner_user_id` | Либо добавить `GET /users` (как минимум `[{id, name}]`), либо денормализовать имена прямо в ответы (`creator_name`, `approver_name`, `owner_name` и т.д.) |
| `GET /approvals/{id}` (используется в `getApproval()`) | Открыть детальный экран по deeplink-у | Добавить endpoint в спеку (один объект) или сделать UI способным жить только на `GET /approvals` со server-side `?id=` фильтром |
| `POST /auth/register` | Онбординг нового workspace | Уточнить у бэка/продукта, как реально регистрируются tenant'ы |
| Дёрганье `run_id` после `POST /tasks` | Открыть run, который оркестратор присоединил к task | Либо вернуть `run_id` в ответ `POST /tasks` (когда оркестратор его создаст), либо добавить `GET /tasks/{id}/runs`, либо WebSocket/SSE для асинхронных уведомлений |
| Server-side пагинация для `GET /tasks`, `GET /agents`, `GET /approvals` | Сейчас UI режет страницу на клиенте | Когда списки вырастут → добавить `?page=&page_size=` и `total` в ответе. Пока на in-memory объёмах это работает |
| `GET /internal/*` из публичного UI | Демонстрация policy snapshot | В проде — либо проксировать через admin-роут, либо убрать панель |

---

## 7. План замены mock на реальный клиент

Пошагово, когда бэкенд будет готов:

1. **Сделать тонкий http-слой** в `src/prototype/lib/http.ts`: обёртку над `fetch` с автоматическим `Authorization: Bearer` из сессии + общей обработкой ошибок (401 → logout, 403 → no-access state, 422 → validation errors из `ValidationError` schema).
2. **Переписать `lib/api.ts`** метод за методом, оставив **публичный интерфейс ровно тем же** — все экраны зовут `api.<method>` и не должны меняться. Сравнить shape ответа с `lib/types.ts`; при расхождении — править типы и фикстуры в одном PR.
3. **Сохранить `lib/fixtures.ts`** на время как dev-fallback (env-переменная `VITE_USE_FIXTURES=1`), чтобы можно было запускать UI без бэка для дизайн-ревью.
4. **Закрыть пробелы из §6** — либо дописать gateway, либо адаптировать UI (например, выпилить `getApproval`, если бэк не хочет одинокий endpoint).
5. **Прогнать руками каждый экран** по чек-листу из `SCREENS.md` — проверить, что все loading / empty / error / no-access состояния работают на реальной сети, а не только на 120-380 мс задержке.

---

## 8. Где смотреть, если что-то не сходится

- **Полный контракт:** `gateway_new.yaml` (open в Swagger UI / Stoplight / IDE с OpenAPI плагином).
- **Что изменилось от v0.1.x к v0.2.0:** `GATEWAY_DIFF.md`.
- **План синхронизации фронта с v0.2.0** (исторический): `PROTOTYPE_UPDATE_PLAN.md`.
- **Канонические TS-типы:** `src/prototype/lib/types.ts` — они выровнены 1-в-1 с компонентами схемы из gateway.
- **Mock-реализация:** `src/prototype/lib/api.ts` — все вызовы и помечены комментариями `// ── METHOD /path`.
- **Seed-данные:** `src/prototype/lib/fixtures.ts` — образцы записей, которые в проде придут от настоящих БД-таблиц.
