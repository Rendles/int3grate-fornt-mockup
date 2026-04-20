# Int3grate.ai — Прототип Control Plane

> **Пусть агенты делают работу. Пусть люди остаются у руля.**

Фронтенд-прототип для B2B-платформы AI-агентов. Операторы настраивают, чем агенты являются, к чему имеют доступ и когда действие требует человеческого одобрения. Этот документ — полный тур: все экраны, все действия, все поля данных, строго по контракту `gateway.yaml`.

---

## 1. Что это

**Int3grate.ai Control Plane** — поверхность оператора для мульти-тенантной платформы AI-агентов. Решает три задачи:

1. **Описывает агентов** — иммутабельные версии: инструкция, цепочка моделей, скоуп памяти, скоуп инструментов, правила одобрений.
2. **Контролирует инструменты** — у каждого агента свои grant-ы, определяющие, какие инструменты он может вызвать и нужно ли человеческое одобрение.
3. **Выставляет audit trail** — каждая задача порождает run, run состоит из шагов, каждое gate-действие — из решения с причиной и evidence.

Прототип — это Vite + React + TypeScript SPA. Бэкенда нет; `api` — мок поверх in-memory фикстур, формы данных 1-в-1 соответствуют `gateway.yaml`.

---

## 2. Ментальная модель — цепочка

Всё связано одной вертикалью:

```
Agent ─┬─ Version (иммутабельная; instruction + model + policy)
       │
       ├─ Tool Grants (scope · mode · approval_required)
       │
       └─ Task ─── Run ─── Run Steps
                     │         │
                     │         └─ approval_gate step
                     │
                     └─ Approval (decision · reason · evidence)
                     │
                     └─ Spend (агрегирован по агентам / пользователям)
```

Как читать цепочку:

- **Agent** — то, что настраиваешь. У него есть статус (`draft | active | paused | archived`) и активная **version**.
- **Version** — иммутабельна. Любое важное изменение = POST новой версии. Активная версия у агента всегда одна.
- **Tool grants** привязаны к агенту. Grant говорит: «инструмент X можно вызвать в режиме Y, нужно одобрение Z».
- **Task** — задача, отправленная агенту. Бэкенд запускает **run**.
- **Run** — трасса выполнения. Стримит **steps** — `llm_call`, `tool_call`, `memory_read`, `memory_write`, `approval_gate`, `validation`.
- **approval_gate** подвешивает run. Оркестратор создаёт **approval request** и ждёт решения человека.
- **Spend** — агрегат стоимости и токенов по агентам и пользователям.

---

## 3. Роли

Три роли в иерархии:

| Роль | Что может | Что видит |
| --- | --- | --- |
| `member` | Создавать задачи, смотреть свою работу | Свои задачи + свои approval-запросы. Аналитика по флоту недоступна. |
| `domain_admin` | Всё выше + создавать агентов/версии, управлять grants, решать approval-ы (до L3), смотреть spend | Всё в пределах своего домена. |
| `admin` | Всё, что может `domain_admin`, во всех доменах. Максимальный approval level (L4). | Весь tenant. |

У каждого пользователя есть `approval_level` (1–4). Правила одобрений на версиях маршрутизируют запросы к нужному уровню.

---

## 4. Модель данных (из `gateway.yaml`)

Каждая сущность ниже — ровно то, что возвращает бэкенд. UI показывает только эти поля.

### User
`id · tenant_id · domain_id · email · name · role · approval_level · created_at`

### Agent
`id · tenant_id · domain_id · owner_user_id · name · description · status · active_version · created_at · updated_at`

`active_version` — встроенный объект `AgentVersion` (не ID).

### AgentVersion
`id · agent_id · version · instruction_spec · memory_scope_config · tool_scope_config · approval_rules · model_chain_config · is_active · created_by · created_at`

Четыре `*_config` — непрозрачные объекты, бэкенд не фиксирует их форму.

### ToolGrant
`id · scope_type · scope_id · tool_name · mode · approval_required · config`

- `scope_type ∈ {tenant, domain, agent}`
- `mode ∈ {read, write, read_write}`
- `approval_required: boolean` — тот самый переключатель «до выполнения нужен человек».

### Task
`id · tenant_id · domain_id · type · status · created_by · assigned_agent_id · assigned_agent_version_id · title · created_at · updated_at`

- `type ∈ {chat, one_time, schedule}`
- `status ∈ {pending, running, completed, failed, cancelled}`
- В ответе Task **нет** run_id, счётчиков шагов или стоимости.

### Run (`RunDetail`)
`id · tenant_id · domain_id · task_id · agent_version_id · status · suspended_stage · started_at · ended_at · total_cost_usd · total_tokens_in · total_tokens_out · error_message · steps · created_at`

- `status ∈ {pending, running, completed, failed, suspended, cancelled}`
- `suspended_stage` указывает на шаг, где run приостановился (например, `approval_gate · stripe.refund`).

### RunStep
`id · step_type · status · model_name · tool_name · input_ref · output_ref · cost_usd · tokens_in · tokens_out · duration_ms · created_at · completed_at`

`step_type ∈ {llm_call, tool_call, memory_read, memory_write, approval_gate, validation}`. `input_ref` и `output_ref` — непрозрачные объекты.

### ApprovalRequest
`id · run_id · task_id · tenant_id · requested_action · requested_by · requested_by_name · approver_role · approver_user_id · status · reason · evidence_ref · expires_at · resolved_at · created_at`

`status ∈ {pending, approved, rejected, expired, cancelled}`. `evidence_ref` — непрозрачный объект, payload, который смотрит аппрувер.

### SpendDashboard / SpendRow
Dashboard: `range · group_by · items · total_usd`.
Row: `id · label · total_usd · total_tokens_in · total_tokens_out · run_count · spend_date`.

---

## 5. API-эндпоинты (из `gateway.yaml`)

| Method | Путь | Что делает |
| --- | --- | --- |
| POST | `/auth/login` | Email+пароль → JWT |
| GET | `/me` | Профиль текущего пользователя |
| GET | `/agents` | Список агентов (пагинация) |
| POST | `/agents` | Создать агента (name, description, domain_id) |
| GET | `/agents/{id}` | Агент + встроенная активная версия |
| POST | `/agents/{id}/versions` | Создать иммутабельную версию |
| POST | `/agents/{id}/versions/{verId}/activate` | Сделать версию активной |
| GET | `/agents/{id}/grants` | Список tool grants |
| PUT | `/agents/{id}/grants` | Полная замена списка grants |
| GET | `/tasks` | Список задач (фильтр по статусу + пагинация) |
| POST | `/tasks` | Создать задачу (бэкенд запускает run) |
| GET | `/tasks/{id}` | Метаданные задачи |
| GET | `/runs/{id}` | Run + полный таймлайн шагов |
| GET | `/approvals` | Список approval-запросов (фильтр по статусу) |
| POST | `/approvals/{id}/decision` | Approve или reject |
| GET | `/dashboard/spend` | Агрегированный spend (`range` + `group_by`) |
| GET | `/health` | Liveness |

Намеренно **отсутствуют** (UI не делает вид, что они есть):
- Нет `GET /agents/{id}/versions` (истории версий)
- Нет `GET /runs` (глобального списка run-ов)
- Нет `GET /users` (директории пользователей)
- Нет `PATCH` / `DELETE /agents/{id}` (редактирование + архивация)
- Нет поиска, нет CSV-экспорта, нет audit-log feed

---

## 6. Экраны

15 экранов, доступны через сайдбар или внутренние ссылки. На каждом — состояния loading / empty / error / no-access (там, где применимо).

### Sign in (`/`)

Отдельный экран без shell-а.

- **Назначение** — обмен учётных данных на сессию.
- **Данные** — email + пароль.
- **Действия** — submit, инлайн-валидация полей, баннер при неверных учётных.
- **Эндпоинт** — `POST /auth/login`.

### Dashboard (`#/`)

Стартовая страница после входа. Роль-ориентированная.

- **Admin / Domain admin** — 4 tile-карточки (активные агенты, кол-во задач, pending approvals, spend за 7д), список последних задач, список pending approvals.
- **Member** — только свои задачи и свои approval-запросы.
- **Данные** — из `GET /agents`, `GET /tasks`, `GET /approvals`, и (только admin) `GET /dashboard/spend?range=7d&group_by=agent`.
- **Действия** — старт задачи, открытие очереди approvals. Каждая tile-карточка — ссылка в свой детальный экран.

### Profile (`#/profile`)

- **Назначение** — показать личность текущего пользователя и его approval-полномочия.
- **Данные** — ответ `GET /me`: id, email, name, role, approval_level, tenant_id, domain_id, created_at.
- **Действия** — выход.
- **Панель полномочий** — визуализация L1–L4 с подсветкой уровня пользователя.

### Список агентов (`#/agents`)

- **Назначение** — управлять флотом.
- **Данные** — `GET /agents`. Колонки: name + description, status, active_version (номер версии + primary-модель), owner_user_id + domain_id, updated_at.
- **Действия** — фильтр по статусу, поиск по имени/описанию, создать нового агента (role-gated), открыть строку для деталей.

### Создание агента (`#/agents/new`)

Только для админов. Member видит `no access`.

- **Поля** — `name` (обязательно), `description`, `domain_id`.
- **Эндпоинт** — `POST /agents`. Owner бэкенд определяет из сессии.
- **При успехе** — редирект на детали агента, статус `draft` до активации первой версии.

### Детали агента (`#/agents/:id`)

Три вкладки: Overview, Tool grants, Settings.

**Overview**
- Command bar: `ID`, `TENANT`, `DOMAIN`, `OWNER`, `ACTIVE VER`, `UPDATED`.
- Карточка активной версии: номер, is_active, created_by, created_at, instruction_spec (форматированная), все четыре config-объекта как JSON.
- Кнопка «Create new version» для админов.
- Баннер: `GET /versions` нет — история версий недоступна.

**Tool grants** (`#/agents/:id/grants`)
- Через `GET /agents/{id}/grants` + `PUT /agents/{id}/grants`.
- Member видит read-only. Админ редактирует инлайн: mode, approval_required toggle, scope, добавление / удаление grant-ов.
- Warn-баннер, если write-grant без `approval_required`.

**Settings** (`#/agents/:id/settings`)
- Полные метаданные агента.
- Кнопки Archive и Delete — `disabled (planned)`: `PATCH` / `DELETE /agents` в бэкенде пока нет.

### Новая версия (`#/agents/:id/versions/new`)

Только админы.

- **Поля** — `instruction_spec` (обязательно), model chain (primary model, max_tokens, temperature). Остальные конфиги отправляются как `{}`.
- **Эндпоинты** — `POST /agents/{id}/versions`, и опционально `POST /versions/{verId}/activate` если включён чекбокс «активировать сразу».
- **При успехе** — редирект на детали агента.

### Список задач (`#/tasks`)

- **Назначение** — работа в движении.
- **Данные** — `GET /tasks` (с опциональным `?status=…`). Колонки: id + title, type, status, agent_id + version_id, created_by, updated_at.
- **Действия** — фильтр по статусу, создать новую задачу.

### Создание задачи (`#/tasks/new`)

- **Поля** — выбор агента, `title` (опционально), `user_input` (обязательно), `type` (chat/one_time/schedule).
- **Выбор агента** — показывает статус и `active_version`; кликабельны только активные агенты с активной версией.
- **Эндпоинт** — `POST /tasks`.
- **Success-панель** — все поля из ответа Task. В ответе **нет** run_id — оркестратор привязывает run асинхронно.

### Детали задачи (`#/tasks/:id`)

- **Назначение** — метаданные задачи из `GET /tasks/{id}`.
- **Данные** — все поля Task как таблица.
- **Действия** — «Start another» (заполнит `/tasks/new` тем же агентом и типом).
- **Замечание** — run_id в ответе Task нет. К run-у переходят по id или из approval.

### Детали run (`#/runs/:id`)

- **Назначение** — полный audit-таймлайн одного run-а.
- **Данные** — `GET /runs/{id}`. Command bar: id, task_id, agent_version_id, status, кол-во шагов, токены, spend, suspended_stage (если подвешен).
- **Таблица шагов** — по строке на шаг: `step_type`, `status`, model/tool, duration, tokens in/out, cost. Клик раскрывает панель с `input_ref` и `output_ref` как pretty-JSON.
- **Карточка метаданных run** — все поля схемы Run.
- **Баннеры** — warn при suspended; карточка с `error_message` при failed.
- **Действия** — перейти к родительской задаче.

### Очередь approvals (`#/approvals`)

- **Назначение** — очередь решений.
- **Данные** — `GET /approvals` (с опциональным `?status=…`). Колонки: id + created_at, requested_action, requested_by, approver_role, status + expires/resolved, кнопки quick-decide.
- **Действия** — фильтр по статусу, клик по строке — детали, либо quick-decide (прыгает на детальный экран с предвыбранным решением).
- **Политика-баннер** — напоминает, что approval — это политика, а не решение AI.

### Детали approval (`#/approvals/:id`)

- **Назначение** — дать человеку безопасно принять решение.
- **Данные** — полный `ApprovalRequest` (с `evidence_ref` как JSON) + ссылки на связанные run и task.
- **Flow решения** — выбрать Approve или Reject → панель подтверждения с reason-textarea → submit.
  - Approve: reason опционален.
  - Reject: reason обязателен (≥ 4 символов).
- **Что UI обещает** — approve возобновляет suspended run; reject его останавливает. Мок-API каскадит это в run (`suspended → running` при approve, `→ cancelled` при reject).
- **Состояния** — pending, approved, rejected, expired, cancelled, conflict (кто-то другой решил пока ты думал), loading, error, no access.
- **Эндпоинт** — `POST /approvals/{id}/decision` с `{ decision: 'approved' | 'rejected', reason? }`.

### Spend dashboard (`#/spend`)

Только для админов.

- **Назначение** — видимость расходов, не ROI.
- **Данные** — `GET /dashboard/spend?range=&group_by=`. Поля dashboard: `range`, `group_by`, `total_usd`, `items`.
- **Summary-карточки** — total_usd (из ответа), total runs (сумма `run_count`), total tokens (сумма `total_tokens_in` + `total_tokens_out`). Все три — дериваты от ответа API.
- **График «Spend by group»** — горизонтальные бары с долей каждого элемента от total.
- **Breakdown-таблица** — строка на элемент: label + id, total_usd, run_count, total_tokens_in, total_tokens_out, spend_date.
- **Действия** — переключать range (1d/7d/30d/90d), переключать group_by (agent/user), клик по agent-строке — перейти к агенту.
- **Чего нет** — дельт, avg cost per run, утилизации кэпа, daily burn — ничего этого бэкенд не возвращает.

### Not found

Любой неизвестный роут приходит сюда с кнопкой «назад на главную».

---

## 7. Состояния, которые закрыты на каждом экране

- **Loading** — skeleton через `LoadingList`.
- **Empty** — `EmptyState` с иконкой и (там, где уместно) primary-действием.
- **Error** — `ErrorState` с кнопкой retry, перезапускающей fetch.
- **No access** — `NoAccessState`, когда роль пользователя недостаточна.
- **Conflict** (только Approval detail) — когда approval кто-то уже решил, пока ты был на странице.

---

## 8. Визуальный язык

- **Тёмная instrument-panel эстетика** — поверхности `--bg` / `--surface-*`, текст `--text` / `--text-muted` / `--text-dim`.
- **Акцент**: `#0F62FE` (IBM Blue 60). `--accent-ink` — белый.
- **Тона** — `--warn` (оранжевый), `--danger` (красный), `--success` (зелёный), `--info` (синий).
- **Компонент Status** — точка + подпись для любого статуса run/task/approval/agent; тон одинаков во всём приложении.
- **Типографика** — только Inter, один `@import` с Google Fonts.
- **Иконки** — собственный SVG-набор в `components/icons.tsx`.

---

## 9. Технологический стек

- **Vite 5** + **React 19** + **TypeScript** (строгий режим, `verbatimModuleSyntax`, запрет неиспользуемых переменных).
- **Самописный hash-роутер** (`router.tsx`) — плоская таблица маршрутов, `:param`-сегменты, `<Link>` + `useRouter().navigate`.
- **Auth provider** — сессия в `localStorage` под ключом `proto.session.v1`.
- **Mock API** (`lib/api.ts`) — синтетическая задержка, затем мутация in-memory фикстур.
- **Фикстуры** (`lib/fixtures.ts`) — сид-данные в форме бэкенда для users, agents, versions, grants, tasks, runs, approvals, spend.
- **Без CSS-фреймворка** — чистый CSS с custom properties, скоупленый под `.prototype-root`.

---

## 10. Запуск

```bash
npm install
npm run dev        # Vite dev server с HMR
npm run build      # tsc -b && vite build
npm run lint       # eslint flat config (typescript-eslint + react-hooks)
npm run preview    # прод-сборка
```

Вход любым из:
- `frontend@int3grate.ai` (admin, L4)
- `domain@int3grate.ai` (domain_admin, L3)
- `member@int3grate.ai` (member, L1)

Пароль — любой от 8 символов.

---

## 11. Демонстрационные сценарии

Фикстуры засеяны так, чтобы оператор мог пройти все четыре состояния run-а:

| Сценарий | Task | Run | Approval |
| --- | --- | --- | --- |
| **Требуется одобрение** | `tsk_4081` — возврат $412 | `run_4081` — suspended | `apv_9021` — pending (L3) |
| **Отзыв доступа · admin-одобрение** | `tsk_4077` — offboarding | `run_4077` — suspended | `apv_9022` — pending (L4) |
| **Успех** | `tsk_4079` — сверка инвойсов | `run_4079` — completed | — |
| **Провал** | `tsk_4076` — онбординг вендора | `run_4076` — failed (IRS EIN mismatch) | — |

Решение по `apv_9021` или `apv_9022` каскадит в соответствующий run: approve возобновляет, reject отменяет run и задачу.

---

## 12. Известные ограничения

UI строго соблюдает контракт gateway. Фичи, которые требуют отсутствующих эндпоинтов, либо опущены, либо помечены как `planned` / `disabled`:

- Нет истории версий (нет `GET /versions`) — детали агента показывают только встроенную активную версию.
- Нет глобального списка run-ов — run доступен только по id.
- Нет директории пользователей — имена людей, кроме `/me`, не резолвятся.
- Нет редактирования / архивации / удаления агента — в settings-вкладке стоят `planned`-кнопки.
- Нет CSV-экспорта.
- Нет поиска по тенанту.
