# Gateway API: diff между gateway.yaml и gateway_new.yaml

_Сравнение старой (`0.1.0`) и новой (`0.2.0`) OpenAPI-спецификации control plane Int3grate._

## 1. Сводка

- **Версия API** поднята с `0.1.0` до `0.2.0`.
- **Новых путей: 2** (`GET /tools`, `GET /internal/agents/{agentId}/grants/snapshot`). Удалённых путей нет.
- **Крупные изменения контракта:**
  - `POST /approvals/{approvalId}/decision` стал **асинхронным**: канонический успех теперь `202 Accepted` с новой схемой `ApprovalDecisionAccepted`; старый `200 ApprovalRequest` помечен deprecated (удалят после 2026-07-01). Добавлены коды `400`, `403`. Рекомендуется polling `GET /runs/{runId}`.
  - Весь блок `/tasks/*` и связанные схемы (`Task`, `TaskList`, `TaskStatus`, `TaskType`, `CreateTaskRequest`) помечены **`x-mvp-deferred: true`** по ADR-0003 — концепция task отложена из MVP.
  - `RunDetail.task_id` и `ApprovalRequest.task_id` стали **необязательными (nullable)**; также `CreateApprovalInternalRequest.task_id` удалён из `required`.
  - `RunStatus` расширен новым значением **`completed_with_errors`**, добавлены схемы `RunErrorKind`, `RunToolError`, поле `RunDetail.tool_errors[]`, `RunDetail.error_kind`.
- **Новые схемы:** `GrantsSnapshot`, `ToolDefinition`, `RunErrorKind`, `RunToolError`, `ApprovalDecisionAccepted`.
- **Новые глобальные responses:** `BadRequest` (400) и `Forbidden` (403).
- **Новый тег:** `tools` (каталог инструментов).

---

## 2. Новые endpoints

| Метод  | Путь                                                  | Назначение |
|--------|-------------------------------------------------------|-----------|
| `GET`  | `/tools`                                              | Публичный каталог инструментов (для UI tool-picker и валидации входа до диспетча). Возвращает массив `ToolDefinition`. Тег `tools`. `bearerAuth`. |
| `GET`  | `/internal/agents/{agentId}/grants/snapshot`          | Service-to-service: снимок действующих tool-grants агента на момент старта run. Возвращает `GrantsSnapshot`. Тег `internal`, `x-internal: true`, `bearerToken`. Ответы: `200`, `401`, `403`, `404`. |

---

## 3. Удалённые endpoints

Физически удалённых путей нет. Однако весь раздел `/tasks/*` (три операции) помечен в спецификации как **`x-mvp-deferred: true`**, а их `summary` получили префикс `"[MVP-DEFERRED]"`:

- `GET /tasks` — `listTasks`
- `POST /tasks` — `createTask`
- `GET /tasks/{taskId}` — `getTask`

Эти операции остаются в спеке для «design continuity», но **не реализованы в gateway** и должны фильтроваться codegen’ом.

---

## 4. Изменённые endpoints

### 4.1 `POST /approvals/{approvalId}/decision` — `decideApproval`

Наибольшие изменения в спецификации.

- Добавлено развёрнутое `description` о том, что gateway больше не ждёт резюма orchestrator синхронно — решение enqueue’ится в outbox, resume занимает 8–15 с, клиент должен poll’ить `GET /runs/{runId}`. Ссылка на ADR-0004 (candidate).
- **Изменены responses:**
  - `200` — **deprecated**; description явно сообщает, что код будет удалён после **2026-07-01**; «new clients must accept `202`». Схема осталась `ApprovalRequest`.
  - `202` — **новый канонический успех**. Описание: «Decision accepted and queued for asynchronous resume via the gateway outbox». Схема — новая `ApprovalDecisionAccepted`.
  - `400` — **новый** (`BadRequest`).
  - `403` — **новый** (`Forbidden`).
  - `401`, `404`, `409` — без изменений.

### 4.2 `GET /tasks`, `POST /tasks`, `GET /tasks/{taskId}`

- Добавлен extension **`x-mvp-deferred: true`**.
- `summary` получил префикс `"[MVP-DEFERRED]"`.
- Параметры, body, responses — без изменений.

### 4.3 Прочие endpoints

`/auth/login`, `/me`, `/agents`, `/agents/{agentId}`, `/agents/{agentId}/versions`, `/agents/{agentId}/versions/{versionId}/activate`, `/agents/{agentId}/grants` (GET/PUT), `/runs/{runId}`, `/approvals`, `/dashboard/spend`, `/internal/approvals`, `/internal/tool-grants/check`, `/health` — **без изменений** (параметры, body, responses идентичны).

---

## 5. Изменения в схемах (`components/schemas`)

### 5.1 Новые схемы

| Схема | Назначение |
|-------|-----------|
| `GrantsSnapshot` | Point-in-time снимок tool-grants агента. Поля: `agent_id` (uuid, req), `tenant_id` (uuid, req), `version` (string — monotonic counter / hash, req), `grants` (array req) с элементами `{ tool: string (req), mode: enum[read_only, requires_approval, denied] (req), scopes: string[] }`, `issued_at` (date-time, req). |
| `ToolDefinition` | Элемент каталога инструментов. Поля: `name` (string, req), `description` (string), `input_schema` (object, JSON Schema, req, `additionalProperties: true`), `default_mode` (enum `[read_only, requires_approval, denied]`, req). |
| `RunErrorKind` | Enum: `[none, tool_error, orchestrator_error, timeout, cancelled]`. |
| `RunToolError` | Запись об отказе тула в пределах run. Поля: `tool` (string, req), `status` (enum `[error, timeout, denied]`, req), `message` (string), `at` (date-time), `tool_call_id` (uuid, nullable). |
| `ApprovalDecisionAccepted` | Тело ответа на `202` от `decideApproval`. Поля: `approval_id` (uuid, req), `decision` (enum `[approve, reject]`, req — **обратите внимание: формы `approve`/`reject`, а не `approved`/`rejected`, как в запросе и статусах**), `status` (enum `[queued]`, req). |

### 5.2 Удалённые схемы

Физически удалённых схем нет. Все Task-схемы остались, но помечены `x-mvp-deferred: true` (`Task`, `TaskList`, `TaskStatus`, `TaskType`, `CreateTaskRequest`).

### 5.3 Изменённые схемы

#### `RunStatus`
- Перечислен в новом порядке.
- **Добавлено значение `completed_with_errors`**. Теперь enum: `[pending, running, suspended, completed, completed_with_errors, failed, cancelled]`.
- Добавлено развёрнутое `description`, формализующее терминальные состояния:
  - `completed` — clean terminal, всё получилось.
  - `completed_with_errors` — есть assistant output, но ≥1 tool call failed (см. `tool_errors[]`).
  - `failed` — usable output не получен (ошибка orchestrator, timeout и т. п.).
  - `cancelled` — терминальный cancel.

#### `RunDetail`
- В `required` **убран `task_id`** (было `[id, tenant_id, task_id, status, created_at, steps]`, стало `[id, tenant_id, status, created_at, steps]`).
- Поле `task_id` стало **`nullable: true`** с комментарием «Optional per ADR-0003 (task concept deferred).»
- **Новые поля:**
  - `error_kind` → `$ref RunErrorKind`, nullable.
  - `tool_errors` → `array<RunToolError>`, nullable. Описание: заполняется при `status = completed_with_errors` либо `status = failed` с `error_kind = tool_error`, иначе пустой/отсутствует.

#### `ApprovalRequest`
- В `required` **убран `task_id`** (было `[id, run_id, task_id, tenant_id, requested_action, status, created_at]`, стало `[id, run_id, tenant_id, requested_action, status, created_at]`).
- `task_id` стал `nullable: true` с описанием «Optional per ADR-0003 (task concept deferred).»

#### `CreateApprovalInternalRequest`
- В `required` **убран `task_id`** (было `[run_id, task_id, tenant_id, requested_action]`, стало `[run_id, tenant_id, requested_action]`).
- `task_id` стал `nullable: true` с описанием «Optional per ADR-0003 (task concept deferred).»

#### Task-семейство (`Task`, `TaskList`, `TaskStatus`, `TaskType`, `CreateTaskRequest`)
- Структурно идентичны старой версии.
- На корне каждой из этих схем добавлен extension **`x-mvp-deferred: true`**.

#### Прочие схемы
`LoginRequest`, `LoginResponse`, `User`, `Agent`, `AgentList`, `CreateAgentRequest`, `AgentVersion`, `CreateAgentVersionRequest`, `ToolGrant`, `ReplaceToolGrantsRequest`, `ToolGrantCheck`, `RunStep`, `ApprovalStatus`, `ApprovalList`, `ApprovalDecisionRequest`, `SpendDashboard`, `SpendRow`, `HealthResponse` — **без изменений**.

---

## 6. Прочие изменения

### 6.1 `info`
- `version`: `0.1.0` → `0.2.0`. Остальное идентично.

### 6.2 `servers`
Без изменений (`http://localhost:8080`).

### 6.3 `tags`
- **Добавлен** тег `tools` — "Tool registry / catalog". Встал между `approvals` и `dashboard`.
- Остальные теги без изменений.

### 6.4 `securitySchemes`
Без изменений. `bearerAuth` (JWT) и `bearerToken` (service-to-service) сохранены.

### 6.5 `parameters`
Без изменений (`AgentId`, `VersionId`, `TaskId`, `RunId`, `ApprovalId`, `IdempotencyKey`, `LimitParam`, `OffsetParam`).

### 6.6 `responses` (общие)
- **Добавлено `BadRequest`** (400).
- **Добавлено `Forbidden`** (403).
- `Unauthorized`, `NotFound`, `Conflict`, `ValidationError` — без изменений. Все по-прежнему возвращают `application/problem+json` по внешней схеме `../schemas/shared/problem.yaml`.

### 6.7 Семантические сдвиги
- **Асинхронизация workflow approval.** Клиенты должны переезжать с синхронного `200 → ApprovalRequest` на асинхронное `202 → ApprovalDecisionAccepted { status: "queued" }` + polling `GET /runs/{runId}`. Есть переходный период: до 2026-07-01 сервер может временно отдавать `200`.
- **Task как концепция отложен.** В контрактах `RunDetail`, `ApprovalRequest`, `CreateApprovalInternalRequest` task_id больше не обязателен; весь `/tasks/*` помечен deferred. Бэкенд будет работать с run’ами без task’ов.
- **Модель ошибок run’а стала богаче.** Отдельный enum `RunErrorKind`, массив `tool_errors[]`, и новый терминальный статус `completed_with_errors` позволяют различать «run завершился, но тулы падали» от «run упал». Это уже не бинарное success/fail.
- **Явный tool catalog.** Появление `GET /tools` + `ToolDefinition` означает, что каталог и JSON Schema’ы тулов теперь публичный контракт, а не хардкод на фронте.
- **Кэширование grants для orchestrator.** `GET /internal/agents/{agentId}/grants/snapshot` + `GrantsSnapshot.version` заменяет паттерн «дёргать `/internal/tool-grants/check` на каждый tool call».
- **Mode-словарь для tool grants разветвился.** Legacy `ToolGrant.mode` остаётся `[read, write, read_write]`. Новые контракты (`GrantsSnapshot.grants[].mode`, `ToolDefinition.default_mode`) используют `[read_only, requires_approval, denied]`. Это семантически разные оси (CRUD vs политика доступа), но одинаковое имя поля может запутать.
- **`ApprovalDecisionAccepted.decision`** использует формы `approve`/`reject`, тогда как `ApprovalDecisionRequest.decision` и `ApprovalStatus` — формы `approved`/`rejected`. Это несогласованность, о которой стоит помнить на фронте.

---

## 7. Влияние на фронтенд

Что практически точно придётся править в `src/prototype/` и рядом (или как минимум — учесть при переходе на реальный бэкенд):

- **`lib/types.ts`**
  - `RunStatus`: добавить `completed_with_errors`.
  - `RunDetail`: сделать `task_id` опциональным, добавить `error_kind?: RunErrorKind`, `tool_errors?: RunToolError[]`.
  - `ApprovalRequest`: `task_id` → опциональное.
  - Добавить типы: `RunErrorKind`, `RunToolError`, `GrantsSnapshot`, `ToolDefinition`, `ApprovalDecisionAccepted`.
  - Оставить Task-типы, но помечать в коде/комментариях как deferred (или изолировать за фичефлаг, чтобы не ссылаться из новых экранов).

- **`lib/api.ts`**
  - `api.decideApproval(...)`: перевести на async-модель. Обработать оба `200` (legacy, deprecated) и `202` (canonical). После успеха — запускать polling `getRun(runId)` до терминального статуса (`completed`, `completed_with_errors`, `failed`, `cancelled`). Учесть новые возможные коды `400` и `403`.
  - Добавить метод `listTools()` → `GET /tools`, возвращает `ToolDefinition[]`.
  - Для internal-эндпоинтов (если мок их имитирует) — добавить `getGrantsSnapshot(agentId)`.
  - `createApprovalInternal`/`createApproval` — `task_id` больше не обязателен.

- **Экраны и UI**
  - **Approvals**: после «Approve/Reject» перестать ждать мгновенный финальный статус — показывать состояние `queued`, затем крутить polling по run’у. Вставить информационный баннер про async-резюм (8–15 с).
  - **Runs / RunDetail**: отрисовать новый статус `completed_with_errors` (нужен отдельный цвет/иконка/чип между `completed` и `failed`). Добавить секцию `tool_errors[]` (список инструментов с `status`, `message`, `at`). Использовать `error_kind` в качестве подзаголовка ошибки.
  - **Agents / Tools**: экран / секция «tool catalog», подтягивающая `GET /tools`, с рендером `default_mode` и, возможно, превью `input_schema`. При конструировании `ReplaceToolGrantsRequest` — валидировать tool names по каталогу.
  - **Tasks**: скрыть / feature-flag’нуть все экраны и пункты меню, которые опираются на `/tasks/*`. В прототипе они сейчас живые — решить, оставить как «deferred»-заглушки или убрать из нав-бара. Run’ы теперь могут существовать без task’а, значит ссылка «run → task» на карточке run’а должна gracefully обрабатывать отсутствие.
  - **Approvals/Runs карточки**: обработать отсутствие `task_id` (не показывать секцию «Task»).

- **Auth-flow**
  - `bearerAuth` / `bearerToken` не менялись — login и хранение JWT остаются как есть.
  - Но добавились `400`/`403` на `decideApproval`: ErrorState должен различать «нет прав» от «плохой запрос» и от 404/409.

- **Mismatched enum — осторожно**
  - Не перепутать `decision: approve | reject` (в ответе `ApprovalDecisionAccepted`) с `decision: approved | rejected` (в запросе `ApprovalDecisionRequest`). В типах и в UI это два разных union’а — стоит добавить маппер.
  - Не смешивать `ToolGrant.mode` (`read | write | read_write`) с `GrantsSnapshot.grants[].mode` / `ToolDefinition.default_mode` (`read_only | requires_approval | denied`).

- **Ключевые файлы, которые нужно обновить** (абсолютные пути):
  - `D:\Work\int3grate-fornt-mockup\src\prototype\lib\types.ts`
  - `D:\Work\int3grate-fornt-mockup\src\prototype\lib\api.ts`
  - `D:\Work\int3grate-fornt-mockup\src\prototype\lib\fixtures.ts` (новые поля в фикстурах run’ов и approval’ов, сид для `tools`)
  - Экраны approvals / runs / agents (`src\prototype\screens\*`) — см. выше.
