# План перехода на новый gateway (`gateway (5).yaml`)

_Что бэкенд добавил в новой версии спеки, что поменял, и что нам нужно сделать на фронте, когда мы будем синхронизироваться._

**Источники:**
- Текущая спека, под которую сделаны фронт и фикстуры: `gateway_new.yaml` (заявлен `info.version: 0.2.0`).
- Новая спека от бэк-разработчика: `gateway (5).yaml` (заявлен `info.version: 0.0.1` — судя по всему, пересчёт версионирования или новая major-итерация; уточнить у бэка).
- Текущее состояние фронта: см. `BACKEND_DATA_SOURCES.md`.

---

## TL;DR

Спека выросла с **17 endpoint'ов** до **27**. Изменения **аддитивные** — ни один существующий endpoint не убран, но появились **три новые крупные поверхности** (Chat, Audit, Runs-list) и пара **молчаливых breaking changes в схемах**.

| Категория | Что сделано |
|---|---|
| 🆕 Новый endpoint | Chat (6 шт.), Audit (1 шт.), Dashboard runs (1 шт.), internal agent-version resolver (1 шт.) |
| ⚠️ Breaking изменение схемы | `GrantsSnapshot.grants[].tool` → `tool_name`, добавлен `approval_required` |
| ➕ Аддитивные поля | `Agent.total_spend_usd`, `Agent.runs_count` (только в detail-ответе) |
| 📝 Уточнённый контракт | `POST /approvals/{id}/decision` — `200` помечен deprecated, канон — `202` |
| ⏸ Без изменений | Auth, Users, Agents (CRUD), Tools, Spend, MVP-deferred Tasks остались такими же |

---

## 1. Новые endpoint'ы (которых раньше не было)

### 1.1. Chat surface — основная новая фича

Заменяет (или дополняет) `task type=chat`. Это **синхронный диалог с агентом, стримящийся через SSE**.

| Endpoint | Что делает |
|---|---|
| `POST /chat` | Создать чат, привязать к `agent_version_id` + `model`. Модель **фиксируется** на всё время чата — поменять нельзя, можно только открыть новый чат. |
| `GET /chat/{chatId}` | Метаданные чата + накопленные `total_cost_usd`, `total_tokens_*`. |
| `DELETE /chat/{chatId}` | Закрыть чат (`status=closed`, `ended_at` проставляется). Сообщения остаются для аудита. **Реоткрытия нет** — только новый чат. |
| `POST /chat/{chatId}/message` | Отправить пользовательское сообщение. **Возвращает `text/event-stream`** (Server-Sent Events). Один ход = одна стриминг-сессия. |
| `GET /chat/{chatId}/messages` | История сообщений, newest-first, с `tool_calls` и `tool` ролями (для аудита). |
| `GET /chats` | Список чатов: member видит свои; admin/domain_admin — все в tenant scope. Фильтр `?agent_id=`, пагинация. |

**Формат SSE-фреймов** (см. описание в спеке вокруг строки 484):

```
data: {"event":"turn_start","message_id":"<uuid>"}
data: {"event":"text_delta","delta":"Let me search..."}
data: {"event":"tool_call","tool":"web_search","args":{...}}
data: {"event":"tool_result","status":"ok","output_ref":{...}}
data: {"event":"text_delta","delta":"I found 3 matches..."}
data: {"event":"turn_end","message_id":"<uuid>","cost_usd":0.0034,"tokens_in":1240,"tokens_out":180}
data: {"event":"done"}
```

Ошибки терминируют поток:
```
data: {"event":"error","kind":"approval_required|tool_error|llm_error","message":"..."}
```

`kind=approval_required` означает, что инструмент потребовал approval — внутри чата approval'ов нет в v1, поэтому turn падает; UI должен направить пользователя на approval-поверхность и повторить с новой реплики.

**Новые схемы:** `Chat`, `ChatList`, `ChatMessage`, `ChatMessageList`, `CreateChatRequest`, `SendMessageRequest`.

### 1.2. Audit timeline

`GET /audit` — единый tenant-scoped тайм-лайн step-level событий, **объединённый** для runs и chats:

- Параметры: `agent_id?`, `run_id?`, `chat_id?`, `from?`, `to?`, `limit`, `offset`.
- `run_id` и `chat_id` **взаимоисключающие** — оба = `422`.
- Каждое событие имеет ровно один из `run_id` / `chat_id` ненулевым; для chat-событий заполнен `message_id`.
- Поля: `step_type` (свободная строка — у run-стороны исторически разнородно: `llm`, `tool_call`, `approval_wait`, `system`; у chat-стороны: `chat_message`, `chat_tool_call`), `cost_usd`, `tokens_in`, `tokens_out`, `duration_ms`.

**Назначение:** глобальная страница «что вообще делали агенты», которая видит и runs, и chats, с их затратами. Сейчас прототип показывает только run-timeline на конкретном run'е.

**Новые схемы:** `AuditEvent`, `AuditList`.

### 1.3. Dashboard runs list

`GET /dashboard/runs` — пагинированный список runs для tenant'а, фильтр по `?status=`. Раньше runs можно было открыть **только по deeplink-у** (`/runs/{id}`); теперь есть нормальный list-вью.

- Возвращает облегчённый `RunListItem` (есть `agent_id`, нет `steps[]`) — детали грузятся отдельно через существующий `GET /runs/{runId}`.
- Gateway проксирует на orchestrator `GET /internal/runs`.

**Новые схемы:** `RunsList`, `RunListItem`.

### 1.4. Internal: agent-version resolver

`GET /internal/agent-versions/{versionId}?tenant_id=` — **internal**, для оркестратора. Резолвит `agent_version_id` в `agent_id` + `tenant_id` + замороженный `instruction_spec`. Используется при создании чата, чтобы зафиксировать инструкции на момент старта.

Фронта это **не касается напрямую** — но если когда-нибудь PolicySnapshotPanel захочет резолвить версию в имя агента, эндпоинт пригодится (после прокси через admin-роут).

**Новая схема:** `AgentVersionRef`.

---

## 2. Изменения в существующих endpoint'ах и схемах

### 2.1. ⚠️ Breaking: `GrantsSnapshot.grants[]`

Поле `tool` переименовано в `tool_name` и добавлен `approval_required: boolean`.

**Было** (gateway_new.yaml):
```yaml
grants:
  - tool: stripe.refund
    mode: requires_approval
    scopes: [...]
```

**Стало** (gateway (5).yaml):
```yaml
grants:
  - tool_name: stripe.refund
    mode: requires_approval
    approval_required: false
    scopes: [...]
```

**Что ломается на фронте:**
- `src/prototype/lib/types.ts` → `GrantsSnapshotEntry.tool` нужно переименовать в `tool_name`, добавить `approval_required?: boolean`.
- `src/prototype/screens/AgentDetailScreen.tsx` → `PolicySnapshotPanel` рендерит `{toolLabel(g.tool)}` — поменять на `g.tool_name`.
- `src/prototype/lib/api.ts` → `getGrantsSnapshot()` собирает `entries: GrantsSnapshotEntry[]` с полем `tool` — поменять на `tool_name`.
- `src/prototype/lib/fixtures.ts` — фикстур snapshot нет (он генерится в `api.ts`), но всё равно перепроверить.

### 2.2. ➕ Аддитивно: `Agent.total_spend_usd` и `Agent.runs_count`

Появляются **только в детальном** ответе `GET /agents/{agentId}`. В list-views (`GET /agents`) приходят `null`.

> «Populated only on the detail view; null elsewhere. Populated by orchestrator enrichment lookup; if it fails, also null.»

**Что делать на фронте:**
- Добавить эти поля в `Agent` type (опциональные, `number | null`).
- На `AgentDetailScreen` показать их где-нибудь в шапке или в settings-табе. Натуральный кандидат — рядом с `ACTIVE VER`/`UPDATED` в CommandBar или отдельная карточка «Statistics».
- На `AgentsScreen` (списке) **не рассчитывать** на эти поля — они там `null`. Текущая реализация и так их не использует.

### 2.3. 📝 Уточнено: `POST /approvals/{id}/decision`

Контракт **не меняется по сути** (фронт уже умеет async-резолв через polling), но в спеке теперь явно:

- `200` помечен **deprecated**, будет удалён после `2026-07-01`.
- `202` объявлен каноничным success-ответом с телом `ApprovalDecisionAccepted { approval_id, decision, status: "queued" }`.

**Что делать на фронте:**
- Когда будем писать реальный http-клиент — принимать **оба** статуса. Если `200` (старая семантика) — конвертировать в `ApprovalDecisionAccepted` локально и сразу считать резолвленным; если `202` — работать через polling (как сейчас в моке).
- Через ~3 месяца после `2026-07-01` можно будет полностью убрать ветку `200`.

### 2.4. Idempotency-Key (формализовано в спеке)

В новой спеке у `POST /agents`, `POST /agents/{id}/versions`, `POST /tasks`, добавлен необязательный header `Idempotency-Key`. На фронте сейчас не используется.

**Что делать:** в http-обёртке генерировать UUID для каждого POST'а, делающего создание (`createAgent`, `createAgentVersion`, `createTask`, `createChat`). Это полезно при автоматических ретраях.

---

## 3. Что осталось как было

Без изменений (фронт продолжает работать как сейчас, только когда заменим mock на http):

- `POST /auth/login` → JWT + `expires_at`.
- `GET /me`.
- `GET /agents`, `POST /agents`, `GET /agents/{id}` (только `total_spend_usd`/`runs_count` добавились — см. §2.2).
- `POST /agents/{id}/versions`, `POST /agents/{id}/versions/{verId}/activate`.
- `GET /agents/{id}/grants`, `PUT /agents/{id}/grants`.
- `GET /tasks`, `POST /tasks`, `GET /tasks/{id}` — **всё ещё `x-mvp-deferred: true`**, бэк может вернуть 501.
- `GET /runs/{runId}`.
- `GET /approvals` (список).
- `GET /tools`.
- `GET /dashboard/spend`.
- `/internal/approvals`, `/internal/agents/{id}/grants/snapshot`, `/internal/tool-grants/check`.
- `GET /health`.

**Пробелы из `BACKEND_DATA_SOURCES.md` остаются открытыми:**
- `GET /users` (фронту нужно для резолвинга имён) — не появилось.
- `GET /approvals/{id}` (фронт зовёт для deeplink-detail) — не появилось.
- `POST /auth/register` (онбординг workspace) — не появилось.

Эти пункты нужно **поднять отдельным запросом к бэк-разработчику** при следующей синхронизации.

---

## 4. Что это значит для UX и продуктовой фичности

### Tasks → Chats: смена парадигмы для chat-режима

Раньше «диалог с агентом» был типом задачи (`Task.type === 'chat'`). В новой спеке:
- **Чат** — это отдельная сущность с SSE-стримом, моделью, привязанной к чату на всё время, и аудитом по сообщениям.
- **Tasks** остаются `x-mvp-deferred` — ничего не работает.
- `one_time` и `schedule` режимы пока **остались без замены**.

**UX-следствие:** кнопка «Start a task» в текущем UI ведёт на форму, которая в проде на типе `chat` должна редиректить в новый Chat-флоу (`POST /chat` + переход на чат-вью), а на типе `one_time`/`schedule` пока вообще ничего не делает (бэк не реализован). Нужно решить:
- Либо переименовать «Tasks» в «Chats» и упростить — пока есть только чат-режим;
- Либо оставить tasks как обещание и явно показывать «coming soon» на не-chat вариантах;
- Либо сделать гибрид — пикер режима, который для chat дёргает Chat API, а для остальных показывает заглушку.

### Audit screen — новая поверхность

Сейчас в навигации нет /audit. Нужно решить, **где он должен появиться**:
- Самостоятельный пункт в Sidebar (рядом с Spend)?
- Подвкладка дашборда?
- Только для `admin` / `domain_admin`?

Аналитика идёт по step-level events с `cost_usd` — фактически это то, что Spend агрегирует, плюс детализация. Можно подружить с экраном Spend.

### Runs list — переключение на endpoint

Сейчас прототип:
- В Sidebar нет «Runs».
- Run-detail доступен только через approval (`run_id`-link) или через task (которой не будет).
- В новой спеке runs — first-class list. Логично добавить `Runs` в Sidebar и делать туда дашборд.

---

## 5. Open questions для бэк-разработчика

Вопросы, которые надо задать **до** того как начнём писать реальный http-клиент:

1. **Версионирование**: спека сейчас называется `0.0.1`, предыдущая была `0.2.0`. Это сознательный сброс или ошибка? Какой шильдик ставить в Topbar (`CONTROL · v0.7` сейчас) и в healthcheck-ответе?
2. **Tasks** (`x-mvp-deferred`): когда планируется реализация? `one_time`/`schedule` режимы вообще будут или их закроют в пользу другого подхода?
3. **`GET /users`** — нужен фронту для резолвинга имён (`owner_user_id`, `requested_by`, `approver_user_id`, `created_by`). Ваш план: добавить endpoint, или денормализовать имена в ответы? Если денормализация — какой набор «*_name» полей будет проставлен?
4. **`GET /approvals/{id}`** — единичный approval по deeplink. Нужно для прямого захода на `/approvals/{id}` страницу. Будем добавлять или фронту жить через `?id=` фильтр на `GET /approvals`?
5. **`POST /auth/register`** — онбординг нового workspace'а. Через email-инвайты, через биллинг, или через публичный register? Сейчас в моке самопальная реализация.
6. **Chat ↔ Approvals**: в SSE на `kind=approval_required` turn падает; потом пользователь видит approval, апрувит — что делать в чате? Перезапустить тот же запрос? Открыть новый turn? UX тут не описан.
7. **Run dispatch без task**: если task-флоу deferred, как фронт **создаёт run**? Раньше было `POST /tasks`, теперь tasks нет. Идёт ли run только через chat'ы (т.е. run = одна chat-turn)? Или есть отдельный путь?
8. **Pagination envelope**: фронт сейчас использует client-side pagination и не отправляет `limit`/`offset`. Бэк дойдёт до объёмов, где обязательны server-side query params? Какой default `limit` (в спеке `20`, и на 100 капается)?
9. **SSE reconnect**: если соединение оборвалось во время `POST /chat/{chatId}/message`, что делать? Есть ли механизм resume? Или начать новый turn?
10. **Audit retention**: как далеко в прошлое возвращает `GET /audit`? Бесконечно? Окно? Пагинация работает на больших объёмах?

---

## 6. Конкретный план работ на фронте

Когда начнём делать сборку под новый gateway — порядок шагов:

### 6.1. Подготовка (без визуальных изменений)

- [ ] **Обновить `lib/types.ts`** под новые схемы:
  - Поправить `GrantsSnapshotEntry.tool` → `tool_name`, добавить `approval_required?: boolean`.
  - Добавить `Agent.total_spend_usd?: number | null`, `Agent.runs_count?: number | null`.
  - Завести новые типы: `Chat`, `ChatList`, `ChatMessage`, `ChatMessageList`, `CreateChatRequest`, `SendMessageRequest`, `ChatStatus`, `ChatMessageRole`.
  - Завести `AuditEvent`, `AuditList`.
  - Завести `RunListItem`, `RunsList` (отдельно от уже имеющегося `Run`/`RunDetail`).
  - Завести `AgentVersionRef` (если решим, что фронту он нужен).
- [ ] **Обновить `lib/api.ts`** — добавить новые методы:
  - `createChat`, `getChat`, `closeChat`, `sendChatMessage` (отдельный SSE-транспорт), `listChatMessages`, `listChats`.
  - `listAudit`.
  - `listRuns` (для дашборда runs).
  - В существующих методах — обновить shape для `getGrantsSnapshot` (рефактор поля `tool` → `tool_name`).
- [ ] **Поменять PolicySnapshotPanel** в `AgentDetailScreen.tsx` — `g.tool` → `g.tool_name`. Рендер не сломается, тулзы будут резолвиться корректно.

### 6.2. Новые экраны / поверхности

- [ ] **Chat:**
  - Список чатов (`/chats`) — добавить пункт в Sidebar. Member видит свои, admin — все.
  - Создание чата (`/chats/new`) — минимально: пикер агента, пикер модели (опционально), сабмит → редирект.
  - Чат-вью (`/chats/:chatId`) — главный экран:
    - История сообщений (load via `GET /chat/{chatId}/messages`, newest-first).
    - Композиция нового сообщения, отправка через SSE (`POST /chat/{chatId}/message`).
    - Live-обновление UI на фреймы: `text_delta` инкрементально дописывает, `tool_call` показывает плашку, `tool_result` обновляет её, `turn_end` фиксирует cost/tokens.
    - Обработка `error` фреймов: `approval_required` → CTA «Open approvals», `tool_error`/`llm_error` → просто показать ошибку.
    - Кнопка «Close chat» (DELETE) — фиксирует чат как readonly.
  - **SSE-транспорт в http-клиенте:** не `EventSource` (он не умеет POST с body), а fetch + `ReadableStream` reader для `text/event-stream`.
- [ ] **Audit timeline (`/audit`):**
  - Таблица событий с фильтрами `agent_id`, `run_id` XOR `chat_id`, диапазоном дат.
  - Per-row: `step_type`, `tool_name`/`model_name`, `cost_usd`, `tokens_in/out`, `duration_ms`, `created_at`.
  - Пагинация серверная (`limit`/`offset`).
- [ ] **Runs list (`/runs`):**
  - Таблица runs с фильтром по статусу. Использует `RunListItem` (нет steps).
  - Клик → существующий `RunDetailScreen`.

### 6.3. Косметика существующих экранов

- [ ] **AgentDetailScreen:** показать `total_spend_usd` и `runs_count` (когда не null) — например, дополнительные `MetricCard` или строки в settings-табе.
- [ ] **TaskNewScreen:** перерешать судьбу. Минимум — показать на типах `one_time`/`schedule` баннер «Coming soon». На типе `chat` — редирект в Chat-флоу. Или вообще удалить экран и заменить на «Open chat».
- [ ] **Sidebar:** добавить пункты `Chats`, `Audit`, `Runs` (возможно, `Runs` под dashboard).

### 6.4. http-клиент

- [ ] Тонкая обёртка над `fetch` (`lib/http.ts`):
  - `Authorization: Bearer <token>` (token из localStorage, обновляется на login).
  - `Idempotency-Key: <uuid>` на POST'ах создания.
  - Универсальная обработка 401 → logout, 403 → no-access, 422 → ValidationError → форм-ошибки.
  - Распаковка пагинированных ответов: `{ items, total, limit, offset }` — UI пока пользует `items[]`, но `total` нам нужен будет для серверной пагинации.
  - Поддержка обоих `200` и `202` для approval decision (см. §2.3).
  - Отдельный `streamSSE` метод для chat'а.
- [ ] **dev-fallback на фикстуры** — оставить `lib/fixtures.ts` под `VITE_USE_FIXTURES=1`, чтобы дизайн-ревью можно было гонять без бэка.

### 6.5. QA-чеклист

- [ ] Все экраны из `SCREENS.md` гоняются на реальной сети, проверены состояния loading / empty / error / no-access.
- [ ] SSE-стрим устойчив к медленному набору, обрыву соединения, error-фреймам.
- [ ] Idempotency проверена: двойной клик «Create agent»/«Send message» не создаёт двух записей.
- [ ] Approval flow со сменой `200`→`202` — работает на обоих ответах.
- [ ] Pagination на больших списках (>100 элементов) переключается на server-side.

---

## 7. Где смотреть в коде и в спеке

| Что | Где |
|---|---|
| Полная новая спека | `gateway (5).yaml` |
| Старая спека (наша current baseline) | `gateway_new.yaml` |
| Историческая v1 | `gateway.yaml` |
| Дифф между старой v1 и v0.2.0 | `GATEWAY_DIFF.md` |
| Список всех endpoint'ов и mock-методов | `BACKEND_DATA_SOURCES.md` |
| Каноничные TS-типы | `src/prototype/lib/types.ts` |
| Mock реализация API | `src/prototype/lib/api.ts` |
| Seed-данные для всех экранов | `src/prototype/lib/fixtures.ts` |
| Иерархия экранов | `SCREENS.md` |
| План синхронизации с v0.2.0 (исторический) | `PROTOTYPE_UPDATE_PLAN.md` |
