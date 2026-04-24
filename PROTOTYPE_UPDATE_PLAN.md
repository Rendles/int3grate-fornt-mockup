# План обновления прототипа под gateway v0.2.0

_Что именно меняем во фронте (`src/prototype/`) с учётом диффа `gateway.yaml → gateway_new.yaml` (см. `GATEWAY_DIFF.md`)._

**Контекст.** Это design mockup, не реальный клиент. Цель — чтобы интерфейс и данные фикстур **отражали новый контракт бэкенда**. Никаких реальных запросов, всё остаётся на in-memory фикстурах; просто `lib/api.ts`, `lib/types.ts`, `lib/fixtures.ts` и экраны начинают говорить на языке v0.2.0.

---

## 0. Принципы

- **Task-концепция отложена** (ADR-0003). В прототипе Task-экраны **оставляем** как «deferred»-часть (они живые и визуально демонстрируют, что было бы), но:
  - во всех моделях, где `task_id` стал optional (Run, Approval), UI должен корректно рендериться **без** `task_id`;
  - в навигации пометим Tasks-пункт как `deferred` (например, тусклая метка / бейдж «MVP-deferred») — чтобы в демо было видно, что это перенесено.
- **Approval-flow становится асинхронным.** Визуально показываем два шага: «Decision accepted → queued → run resumed». Это ключевое изменение опыта оператора.
- **Модель ошибок run’а богаче.** Новый терминальный статус `completed_with_errors` + `tool_errors[]` + `error_kind`. Нужен отдельный чип, баннер, и секция «Tool errors» в RunDetail.
- **Появляется публичный tool catalog.** Это новая поверхность — отдельный экран `/tools` или секция в Agent → Grants, подтягивающая `ToolDefinition[]` из фикстур.
- **Две разные оси `mode`** сосуществуют. Это важно визуализировать, чтобы не запутать:
  - legacy `ToolGrant.mode` — CRUD-ось: `read | write | read_write`;
  - new `GrantsSnapshot.grants[].mode` / `ToolDefinition.default_mode` — policy-ось: `read_only | requires_approval | denied`.
- **Несогласованность enum в approval-decision** (`approve/reject` в ответе vs `approved/rejected` в запросе и статусах) — учитываем в типах, в UI везде показываем формы `approved/rejected` (согласно статусу).

---

## 1. Типы — `src/prototype/lib/types.ts`

### 1.1 `RunStatus` — добавить новое значение
```ts
export type RunStatus =
  | 'pending'
  | 'running'
  | 'suspended'
  | 'completed'
  | 'completed_with_errors' // NEW
  | 'failed'
  | 'cancelled';
```

### 1.2 `Run` / `RunDetail` — `task_id` опциональный + новые поля
- `task_id` → `string | null` (ADR-0003).
- Добавить:
  ```ts
  error_kind?: RunErrorKind | null;
  tool_errors?: RunToolError[];
  ```

### 1.3 `ApprovalRequest` — `task_id` опциональный
- `task_id: string | null`.

### 1.4 Новые типы (добавить в файл)
```ts
export type RunErrorKind =
  | 'none'
  | 'tool_error'
  | 'orchestrator_error'
  | 'timeout'
  | 'cancelled';

export interface RunToolError {
  tool: string;
  status: 'error' | 'timeout' | 'denied';
  message?: string;
  at?: string;            // ISO date-time
  tool_call_id?: string | null;
}

export type ToolPolicyMode = 'read_only' | 'requires_approval' | 'denied';

export interface ToolDefinition {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>; // JSON Schema
  default_mode: ToolPolicyMode;
}

export interface GrantsSnapshotEntry {
  tool: string;
  mode: ToolPolicyMode;
  scopes?: string[];
}

export interface GrantsSnapshot {
  agent_id: string;
  tenant_id: string;
  version: string;       // monotonic counter / hash
  grants: GrantsSnapshotEntry[];
  issued_at: string;
}

export interface ApprovalDecisionAccepted {
  approval_id: string;
  decision: 'approve' | 'reject'; // NB: формы без «-d», не перепутать с ApprovalStatus
  status: 'queued';
}
```

### 1.5 Task-семейство — оставить, комментарий о deferred
- Ничего структурно не удаляем, но наверху каждой Task-схемы добавить комментарий `// MVP-deferred (ADR-0003)`.

---

## 2. API — `src/prototype/lib/api.ts`

### 2.1 `decideApproval` — сделать двух-фазным (мок async)
Текущая версия обновляет approval и сразу отдаёт финальное состояние. Нужно имитировать поведение v0.2.0:
- первым шагом `await delay(120..380)` → вернуть `ApprovalDecisionAccepted { status: 'queued' }`;
- приватно запустить «фоновый» таймер на 1.5–3 с (чтобы в демо polling чувствовался), который:
  - меняет `approval.status` на `approved`/`rejected`, проставляет `resolved_at`;
  - обновляет связанный `run`: `suspended` → `running` → `completed` / `completed_with_errors` / `failed` (в зависимости от фикстуры).
- UI будет опрашивать `getApproval(id)` и `getRun(runId)`, пока не увидит терминальное состояние. Никакого «мгновенного» успеха.

Сигнатура после изменения:
```ts
decideApproval(id: string, body: ApprovalDecisionRequest)
  : Promise<ApprovalDecisionAccepted>
```

Старая сигнатура `Promise<ApprovalRequest>` ломается — надо поправить все call-site’ы.

### 2.2 Новые методы
```ts
listTools(): Promise<ToolDefinition[]>
getGrantsSnapshot(agentId: string): Promise<GrantsSnapshot>
```
Оба читают из новых массивов в `fixtures.ts` (см. §3). `getGrantsSnapshot` собирает snapshot на лету из текущих `grants` + каталога.

### 2.3 Прочее
- `createApproval` / internal-аналоги — `task_id` теперь опциональный (не требовать в mock-валидации).
- Добавить тонкий helper `pollUntil(fn, predicate, { interval, timeout })` для экранов, который они могут импортировать (не обязательно, но удобно).

---

## 3. Фикстуры — `src/prototype/lib/fixtures.ts`

### 3.1 Tool catalog (новое)
Завести массив `fxTools: ToolDefinition[]` (~8–12 штук) с реалистичными именами — из уже используемых в grants и run-steps (`irs.verify_ein`, `sos.lookup`, `filings.read`, `filings.submit`, `notifications.send_email`, и т.п.). Для каждого — правдоподобный `input_schema` (2–4 поля) и `default_mode`.

### 3.2 Новый run со статусом `completed_with_errors`
Добавить `run_4082` (или использовать существующий partial-fail run):
- `status: 'completed_with_errors'`;
- `error_kind: 'tool_error'`;
- `tool_errors: [{ tool: 'irs.verify_ein', status: 'error', message: 'IRS TIN mismatch', at: '...' }, { tool: 'sos.lookup', status: 'timeout', message: 'upstream 12s', at: '...' }]`;
- steps: assistant output всё-таки есть, часть tool-calls зелёные, часть красные.

### 3.3 Approval без task
Пара `approval`-записей с `task_id: null` (run был создан без task’а) — чтобы проверить все UI-ветки с отсутствующим task’ом.

### 3.4 Обновить существующие runs
Проставить `error_kind`/`tool_errors` там, где это уместно (failed run’ы — `error_kind: 'tool_error'` или `'orchestrator_error'`).

---

## 4. Экраны — `src/prototype/screens/`

### 4.1 `ApprovalDetailScreen.tsx`
- **Защита от `task_id === null`** — условный рендер ссылки/секции «Task».
- **Async-сценарий одобрения:**
  1. пользователь жмёт «Approve» / «Reject»;
  2. кнопки блокируются, показывается inline-баннер `info`:
     _«Decision queued — resume обычно занимает 8–15 с»_;
  3. запускаем polling `getApproval(id)` + `getRun(run_id)` каждые ~1 с;
  4. при терминальном состоянии run’а — меняем баннер на success/danger/warn в зависимости от `run.status`
     (`completed` → success, `completed_with_errors` → warn, `failed`/`cancelled` → danger);
  5. обновляем карточку с новым `resolved_at`, `status`.
- **Новый вариант ErrorState** под 400/403 (мок отдаёт их редко, например если approval уже в терминальном состоянии — conflict/forbidden).

### 4.2 `RunDetailScreen.tsx`
- **Защита от `task_id === null`**: breadcrumbs и «Task» секция — скрыть/заглушка «No task (run created standalone)».
- **Новый статус-чип `completed_with_errors`**: tone `warn` (см. §6), иконка в той же семье, что у `completed`, но с жёлтым маркером.
- **Новая секция «Tool errors»** (между «Steps» и «Metadata») — видна, когда `tool_errors?.length > 0`:
  - список карточек: `{tool}` — chip status (`error`/`timeout`/`denied`), время, message; клик разворачивает детали.
- **Metadata**: вывести `error_kind` как отдельное поле (над или рядом с `error_message`).

### 4.3 `AgentDetailScreen.tsx` — tab **Grants**
- Рядом с текущим редактором (CRUD-mode) показать новую панель **«Policy snapshot»**, которая дергает `getGrantsSnapshot(agentId)`:
  - таблица: `Tool | Policy mode | Scopes | Version | Issued at`;
  - policy mode — новый chip с тремя вариантами (`read_only`/`requires_approval`/`denied`), отдельная палитра (см. §6).
- В редакторе grants при добавлении tool — **autocomplete по tool catalog** (`api.listTools()`).
- Визуально развести **две оси mode**: legacy (CRUD) в верхней части редактора, policy snapshot — ниже, с подписью «Effective policy (from gateway snapshot)».

### 4.4 Новый экран `ToolsScreen.tsx` (роут `/tools`)
- Список `ToolDefinition[]` из `api.listTools()`.
- Карточка на каждый tool: `name`, описание, `default_mode` chip, preview `input_schema` (JSON в коллапсе).
- Без write-операций (каталог read-only).

### 4.5 Экраны Task (`TasksScreen`, `TaskDetailScreen`, `TaskNewScreen`)
- Ничего не трогаем структурно.
- Наверху добавить **info-баннер**: _«Task concept is MVP-deferred (ADR-0003). Runs may be created without a task.»_
- В сайдбаре (см. §5) — визуальная метка deferred.

### 4.6 `ApprovalsScreen.tsx` (список)
- Защита от `task_id === null` в колонках.
- Если quick-decide — переиспользовать новый async-паттерн из §4.1 (либо просто редирект на detail, что уже так).

### 4.7 Прочие экраны
- `HomeScreen`, `SpendScreen`, `ProfileScreen`, `LoginScreen`, `RegisterScreen`, `StyleGuideScreen` — **не трогаем**.
- `StyleGuideScreen` можно дополнить новыми чипами (см. §6), но это опционально.

---

## 5. Навигация — `components/shell.tsx`, `index.tsx`

### 5.1 Sidebar
- Пункт **Tasks** — оставить, но рядом бейдж `deferred` (маленький ghost chip), либо приглушённый цвет текста. В тултипе — пояснение про ADR-0003.
- Добавить пункт **Tools** (`/tools`), иконка — например «cubes» или «plug». Без бейджа счётчика (это каталог).

### 5.2 Routes (`index.tsx`)
- Добавить:
  ```ts
  { pattern: '/tools', element: <ToolsScreen /> }
  ```
- Остальные роуты — без изменений.

---

## 6. Стили — `prototype.css`, `components/common.tsx`

### 6.1 Чип статуса `completed_with_errors`
- Использовать tone `warn` (как у `suspended`), но с **штриховкой** или доп-точкой, чтобы отличать от `suspended` (промежуточный vs терминальный). Альтернатива — ввести новый токен `--caution` (янтарный), если `warn` визуально перегружен. **Решение в процессе реализации** — начинать с tone `warn` + dotted border.
- Обновить `Status`-компонент и map `status → tone` в `components/common.tsx` (добавить ветку для `completed_with_errors`).

### 6.2 Policy-mode чипы (новая ось)
- Ввести семантические токены:
  - `read_only` — tone `info` (голубой);
  - `requires_approval` — tone `warn` (жёлтый);
  - `denied` — tone `danger` (красный, возможно ghost).
- Отдельный helper-компонент `<PolicyModeChip mode={...} />` чтобы не путать с `<Chip tone=...>` для CRUD-mode.

### 6.3 Tool-errors карточка
- Использовать существующие `--danger-soft`, `--danger-border` для контейнера, `--warn-*` для timeout, `--ghost` для denied.

### 6.4 Баннер «Decision queued»
- Использовать существующий `Banner` (`components/states.tsx`) tone `info`.

---

## 7. Порядок работ (предлагаемый)

1. **Типы** (`lib/types.ts`): enum, optional `task_id`, новые interfaces. Сразу компилировать — подсветит все call-site’ы.
2. **Фикстуры** (`lib/fixtures.ts`): tool catalog, run с `completed_with_errors`, approval без task.
3. **API** (`lib/api.ts`): `listTools`, `getGrantsSnapshot`, рефакторинг `decideApproval` на async-модель.
4. **Экраны (защита от null)**: `ApprovalDetailScreen`, `RunDetailScreen`, `ApprovalsScreen` — сначала просто не падать при `task_id === null`.
5. **UI статуса `completed_with_errors`**: Status map + RunDetail секция `tool_errors[]`.
6. **Async approval UX**: баннер + polling в `ApprovalDetailScreen`.
7. **Tool catalog**: `ToolsScreen`, sidebar-пункт, роут.
8. **Agent Grants**: policy snapshot panel + autocomplete по каталогу.
9. **Tasks deferred**: баннер на экранах, бейдж в сайдбаре.
10. **Стили / чипы**: финальные токены для policy-mode и `completed_with_errors`.

---

## 8. Что осознанно НЕ делаем

- Не удаляем Task-экраны и Task-типы — они остаются для «design continuity» и демо сценария «было/стало».
- Не меняем auth-flow — securitySchemes не двинулись.
- Не перекраиваем legacy `ToolGrant.mode` — оставляем CRUD-ось как есть, показываем рядом новую policy-ось.
- Не вводим реальный polling-интервал из продакшн-кода — в моке достаточно 1 с и искусственной «работы» 1.5–3 с.
- Не добавляем реальную валидацию `input_schema` (каталог) — это mockup, достаточно render’а JSON.

---

## 9. Файлы, которые будут затронуты

| Файл | Изменения |
|---|---|
| `src/prototype/lib/types.ts` | enum `RunStatus`, opt `task_id` в `Run`/`Approval`, 5 новых типов |
| `src/prototype/lib/api.ts` | async `decideApproval`, новые `listTools` / `getGrantsSnapshot` |
| `src/prototype/lib/fixtures.ts` | `fxTools`, run с `completed_with_errors`, approval без task |
| `src/prototype/screens/ApprovalDetailScreen.tsx` | async-баннер, polling, null-safe task |
| `src/prototype/screens/ApprovalsScreen.tsx` | null-safe task колонки |
| `src/prototype/screens/RunDetailScreen.tsx` | новый статус-чип, секция `tool_errors`, null-safe task |
| `src/prototype/screens/AgentDetailScreen.tsx` | panel «Policy snapshot», autocomplete по tool catalog |
| `src/prototype/screens/TasksScreen.tsx` и др. Task-экраны | info-баннер MVP-deferred |
| `src/prototype/screens/ToolsScreen.tsx` | **новый файл** — каталог tools |
| `src/prototype/components/shell.tsx` | пункт Tools, бейдж deferred для Tasks |
| `src/prototype/index.tsx` | роут `/tools` |
| `src/prototype/components/common.tsx` | `Status` map для `completed_with_errors`, `<PolicyModeChip>` |
| `src/prototype/prototype.css` | (опционально) новый токен `--caution`, штриховка для `completed_with_errors` |
