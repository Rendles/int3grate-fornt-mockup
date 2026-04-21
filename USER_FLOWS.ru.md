# Int3grate.ai - основные user flows

Этот документ описывает самые важные пользовательские сценарии, которые стоит показывать в демо прототипа Control Plane. Фокус - не просто пройти по экранам, а показать ценность продукта: управление AI-агентами, контроль действий, human-in-the-loop approvals, audit trail и spend visibility.

## Рекомендуемый порядок демо

1. Регистрация или вход в рабочее пространство.
2. Dashboard как обзор операционного состояния.
3. Agent governance: список агентов, детали, версии и tool grants.
4. Dispatch task: запуск задачи на активного агента.
5. Run audit trail: разбор шагов выполнения.
6. Approval decision: человек принимает или отклоняет рискованное действие.
7. Spend dashboard: контроль затрат по агентам и пользователям.
8. Role and access story: чем отличаются admin, domain admin и member.

## Демо-аккаунты

| Роль | Email | Что показать |
| --- | --- | --- |
| Tenant Admin | `frontend@int3grate.ai` | Полный доступ: agents, grants, approvals, spend. |
| Domain Admin | `domain@int3grate.ai` | Управление в домене, approvals до своего уровня. |
| Member | `member@int3grate.ai` | Ограниченный доступ: задачи и собственная работа, без fleet analytics. |

Любой пароль подходит в моковой авторизации. На экране логина уже заполнен демо-пароль.

## Flow 1. Onboarding: регистрация workspace owner

**Маршрут:** `#/register`

**Зачем показывать:** это первый контакт нового клиента с платформой. Flow объясняет, что продукт мульти-тенантный: пользователь создаёт не просто аккаунт, а рабочее пространство.

**Шаги демо:**

1. Открыть страницу регистрации.
2. Заполнить имя, workspace, email, пароль и подтверждение пароля.
3. Отправить форму.
4. Показать автоматический вход и переход на dashboard.

**Что подсветить:**

- Workspace становится основой для `tenant_id`.
- Новый пользователь получает роль владельца workspace: `admin`, approval level `L4`.
- Валидация работает на уровне полей: email, длина пароля, совпадение паролей.
- Это моковый сценарий: созданный пользователь живёт в памяти текущей вкладки до перезагрузки страницы.

**Успешное состояние:** пользователь попадает на dashboard уже авторизованным.

## Flow 2. Sign in and role-aware dashboard

**Маршрут:** `#/login`, затем `#/`

**Зачем показывать:** dashboard должен быстро объяснять, что это control plane, а не чат с агентом. Здесь оператор видит состояние флота: agents, tasks, approvals и spend.

**Шаги демо:**

1. Войти как `frontend@int3grate.ai`.
2. Показать верхние метрики dashboard.
3. Показать последние tasks и pending approvals.
4. Открыть sidebar и объяснить основные зоны продукта.
5. Войти как `member@int3grate.ai`, если нужно показать ограниченный dashboard.

**Что подсветить:**

- Admin видит fleet-level картину и spend.
- Member видит более узкую рабочую поверхность.
- Sidebar badges показывают активные tasks и pending approvals.
- Dashboard связывает все основные сущности: Agent -> Task -> Run -> Approval -> Spend.

**Успешное состояние:** зритель понимает, где оператор начинает рабочий день и какие решения требуют внимания.

## Flow 3. Agent governance: создать и подготовить агента

**Маршруты:** `#/agents`, `#/agents/new`, `#/agents/:agentId`, `#/agents/:agentId/versions/new`, `#/agents/:agentId/grants`

**Зачем показывать:** это центральный flow продукта. Он показывает, что агент - управляемый операционный объект с версиями, политиками и разрешениями, а не просто prompt.

**Шаги демо:**

1. Открыть список agents.
2. Отфильтровать по статусу или найти агента по имени.
3. Создать нового агента с name, description и domain.
4. Открыть agent detail.
5. Создать первую version или новую immutable version.
6. Выбрать primary model, max tokens, temperature и включить activate immediately.
7. Перейти во вкладку Tool grants.
8. Показать mode, scope и toggle `approval_required`.

**Что подсветить:**

- Agent имеет статус: `draft`, `active`, `paused`, `archived`.
- Version immutable: существенные изменения создают новую версию.
- Active version одна, и именно она используется при запуске задач.
- Tool grants ограничивают, какие инструменты агент может вызывать.
- Write grant без approval - риск, UI показывает предупреждение.
- Members не могут создавать agents или versions.

**Успешное состояние:** агент подготовлен к запуску: есть активная версия и понятные tool grants.

## Flow 4. Dispatch task: запустить работу агента

**Маршруты:** `#/tasks`, `#/tasks/new`, `#/tasks/:taskId`

**Зачем показывать:** это основной пользовательский action. Оператор или member формулирует работу, выбирает агента и запускает выполнение.

**Шаги демо:**

1. Открыть Tasks.
2. Нажать Create task или Start task с agent detail.
3. Выбрать активного агента с active version.
4. Выбрать тип задачи: `chat`, `one_time` или `schedule`.
5. Заполнить title и user input.
6. Запустить task.
7. Показать success panel и metadata созданной task.
8. Открыть task detail.

**Что подсветить:**

- Только active agent с active version может выполнять task.
- Task response не содержит `run_id`: orchestrator создаёт run асинхронно.
- Task detail показывает backend contract, а не выдуманные UI-поля.
- Повторный запуск можно сделать через Start another.

**Успешное состояние:** создана pending task, которую orchestrator должен забрать в работу.

## Flow 5. Run audit trail: объяснить, что сделал агент

**Маршрут:** `#/runs/:runId`

**Хорошие demo IDs:** `run_4081`, `run_4080`, `run_4079`, `run_4077`, `run_4076`

**Зачем показывать:** trust layer продукта. Пользователь видит не только итог, но и пошаговое выполнение: LLM calls, tool calls, memory, validation и approval gate.

**Шаги демо:**

1. Открыть run detail из approval detail или напрямую по ID.
2. Показать command bar: task, version, status, tokens, spend.
3. Развернуть несколько run steps.
4. Показать `input_ref` и `output_ref` как JSON.
5. Для suspended run показать suspended stage.
6. Для failed run показать error message.

**Что подсветить:**

- Run - это audit trail выполнения.
- Каждый step имеет тип, статус, model/tool, duration, tokens и cost.
- Suspended run показывает, где именно агент остановился из-за policy.
- Failed run объясняет причину через `error_message`.
- Это важная часть контроля и debugging.

**Успешное состояние:** зритель понимает, что действия агента прозрачны и проверяемы.

## Flow 6. Approval gate: human-in-the-loop решение

**Маршруты:** `#/approvals`, `#/approvals/:approvalId`

**Хорошие demo IDs:** `apv_9021`, `apv_9022`, `apv_9023`

**Зачем показывать:** это ключевое отличие control plane: агент может подготовить действие, но рискованное действие требует решения человека.

**Шаги демо:**

1. Открыть Approvals inbox.
2. Отфильтровать pending approvals.
3. Открыть pending approval.
4. Показать requested action, approver role, evidence JSON, linked task и linked run.
5. Выбрать Approve или Reject.
6. Для Reject ввести reason.
7. Submit decision.
8. Открыть linked run и показать cascade результата.

**Что подсветить:**

- Approval - это policy decision, не AI decision.
- Approve возобновляет suspended run.
- Reject останавливает requested action и переводит run/task в cancelled state.
- Reason записывается в audit trail.
- UI обрабатывает conflict state, если approval уже решён другим пользователем.

**Успешное состояние:** рискованное действие либо разрешено человеком, либо безопасно остановлено.

## Flow 7. Spend visibility: понять стоимость работы агентов

**Маршрут:** `#/spend`

**Зачем показывать:** для B2B важен финансовый контроль. Этот экран показывает, какие агенты и пользователи генерируют затраты.

**Шаги демо:**

1. Открыть Spend как admin или domain admin.
2. Переключить range: `1d`, `7d`, `30d`, `90d`.
3. Переключить group_by: `agent` и `user`.
4. Показать total spend, total runs и tokens in/out.
5. Показать горизонтальные bars по share of spend.
6. В режиме group_by agent кликнуть строку и перейти в agent detail.

**Что подсветить:**

- Spend строится только из backend response: `range`, `group_by`, `items`, `total_usd`.
- Есть breakdown по spend, runs, input tokens и output tokens.
- Это visibility экран, не ROI или billing engine.
- Members не имеют доступа к spend analytics.

**Успешное состояние:** оператор понимает, где расходуются деньги и какие agents нужно оптимизировать.

## Flow 8. Role and access story

**Маршруты:** `#/profile`, `#/agents/new`, `#/spend`, `#/agents/:agentId/grants`

**Зачем показывать:** enterprise-control невозможен без ролей. Этот flow показывает, что прототип уже различает capabilities пользователей.

**Шаги демо:**

1. Войти как admin и открыть Profile.
2. Показать role, tenant, domain и approval level.
3. Открыть Spend и Agent creation.
4. Выйти и войти как member.
5. Попробовать открыть Spend или create agent.
6. Показать no-access state.
7. Открыть grants как member и показать read-only режим.

**Что подсветить:**

- `admin` видит весь tenant.
- `domain_admin` управляет domain-level операциями.
- `member` может работать с задачами, но не управляет fleet.
- Approval level объясняет, какие решения пользователь может принимать.
- Access restrictions встроены в UI-сценарии, а не спрятаны.

**Успешное состояние:** зритель понимает enterprise model: кто может запускать работу, кто может менять policy и кто может принимать рискованные решения.

## Что не стоит обещать в демо

- Нет реального backend: `api` работает поверх in-memory fixtures.
- Большинство изменений живёт только в текущей вкладке до перезагрузки.
- Нет глобального списка runs.
- Нет directory пользователей.
- Нет редактирования, архивации и удаления agents.
- Нет CSV export, billing ledger или real-time streaming.
- Version history не listable: доступна только active version и создание новой version.

