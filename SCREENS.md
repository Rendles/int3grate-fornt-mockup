# Структура экранов — Int3grate Control Plane

Иерархическое описание всех экранов. Только структура блоков и регионов — без стилей и без описания компонентов.

---

## Карта экранов

```
Публичная часть
  └─ Landing (src/App.tsx)

Прототип (src/prototype/)
  ├─ Auth
  │   ├─ Login             /login
  │   └─ Register          /register
  │
  ├─ Dashboard
  │   └─ Home              /
  │
  ├─ Agents
  │   ├─ Agents list       /agents
  │   ├─ Agent new         /agents/new
  │   └─ Agent detail      /agents/:agentId
  │       └─ Version new   /agents/:agentId/versions/new
  │
  ├─ Tasks
  │   ├─ Tasks list        /tasks
  │   ├─ Task new          /tasks/new
  │   └─ Task detail       /tasks/:taskId
  │       └─ Run detail    /runs/:runId
  │
  ├─ Approvals
  │   ├─ Approvals list    /approvals
  │   └─ Approval detail   /approvals/:approvalId
  │
  ├─ Tools                 /tools
  ├─ Spend                 /spend
  ├─ Profile               /profile
  └─ Style guide           /components
```

---

## Глобальная оболочка (присутствует на всех экранах кроме Auth)

```
AppShell
├─ Sidebar (слева)
│   ├─ Brand block (логотип + название + версия)
│   ├─ Tenant / Domain block (ID тенанта, ID домена, ссылка)
│   ├─ Nav list
│   │   ├─ Dashboard
│   │   ├─ Agents
│   │   ├─ Tasks            (badge: активные)
│   │   ├─ Approvals        (badge: pending)
│   │   ├─ Tools
│   │   ├─ Spend
│   │   └─ Components
│   └─ Footer (текущий пользователь)
│
├─ Topbar (сверху)
│   ├─ Breadcrumbs
│   ├─ Email пользователя
│   ├─ Theme toggle
│   └─ Logout
│
└─ Page (основная область)
    └─ [контент экрана]
```

На tablet sidebar сжимается в icon-only. На mobile sidebar уезжает вниз и становится bottom-nav.

---

## 1. Auth

### 1.1 Login  `/login`

```
Split layout (две колонки)
├─ Left: Brand panel
│   ├─ Logo + название + тэг
│   ├─ Hero-слоган
│   └─ Meta-линия (регион · версия · статус)
│
└─ Right: Form panel
    ├─ Eyebrow "SIGN IN"
    ├─ Заголовок + подпись
    ├─ Форма
    │   ├─ Email
    │   ├─ Password
    │   └─ Error banner (опционально)
    ├─ CTA "Continue"
    └─ Ссылка на Register
```

### 1.2 Register  `/register`

```
Split layout (идентичен Login)
├─ Left: Brand panel (другой слоган)
└─ Right: Form panel
    ├─ Eyebrow "SIGN UP"
    ├─ Заголовок + подпись
    ├─ Форма
    │   ├─ Name
    │   ├─ Workspace
    │   ├─ Email
    │   ├─ Password
    │   └─ Confirm password
    ├─ CTA "Create account"
    └─ Ссылка на Login
```

---

## 2. Dashboard

### 2.1 Home  `/`

**Admin / Domain admin:**
```
PageHeader
├─ Eyebrow (день недели + tenant ID)
├─ Title ("Good morning, …")
└─ Actions (Approvals, Start a task)

Metrics grid (4 колонки)
├─ Active agents
├─ Tasks
├─ Pending approvals
└─ Spend 7d

Split (2fr | 1fr)
├─ Recent tasks (список)
└─ Pending approvals (список карточек)
```

**Member:**
```
PageHeader (title + subtitle)

Split (1fr | 1fr)
├─ My tasks
└─ My approval requests
```

---

## 3. Agents

### 3.1 Agents list  `/agents`

```
PageHeader (+ action "New agent")

Filters row
├─ Status chips (all · active · paused · draft · archived)
├─ Разделитель (flex)
└─ Search input

Table
├─ Header row
└─ Rows (Name+desc | Status | Version | Owner+Domain | Updated | →)

Pagination
```

### 3.2 Agent detail  `/agents/:agentId`

```
PageHeader (+ status, active version, action "Start task")

CommandBar
(ID | TENANT | DOMAIN | OWNER | ACTIVE VER | UPDATED)

Tabs
├─ Overview
│   ├─ Active version card
│   │   ├─ Metadata list
│   │   ├─ Instruction spec
│   │   ├─ Grid 2x2
│   │   │   ├─ memory_scope_config
│   │   │   ├─ tool_scope_config
│   │   │   ├─ approval_rules
│   │   │   └─ model_chain_config
│   │   └─ Action "New version"
│   └─ Info banner
│
├─ Grants
│   ├─ Grants editor
│   └─ Policy snapshot panel
│
└─ Settings
    ├─ Agent metadata
    ├─ Warning banner
    └─ Danger zone (Archive · Delete)
```

### 3.3 Agent new  `/agents/new`

```
PageHeader (+ actions Cancel / Create draft)

Banner (success / error, опционально)

Form card
├─ Row: Name
├─ Row: Description
└─ Row: Domain
```

### 3.4 Version new  `/agents/:agentId/versions/new`

```
PageHeader (+ actions Cancel / Create version)

Form card
├─ Instruction spec
├─ Memory scope config
├─ Tool scope config
├─ Approval rules
└─ Model chain config
```

---

## 4. Tasks

### 4.1 Tasks list  `/tasks`

```
PageHeader (+ action "Create task")

Warning banner (MVP-deferred)

Filters row
└─ Status chips (all · pending · running · completed · failed · cancelled)

Table
├─ Header row
└─ Rows (ID+Title | Type | Status | Agent+Version | Created by | Updated | →)

Pagination
```

### 4.2 Task detail  `/tasks/:taskId`

```
PageHeader (+ status, action "Start another")

CommandBar
(ID | TYPE | STATUS | AGENT | VERSION | CREATED BY)

Warning banner (MVP-deferred)

Metadata card
```

### 4.3 Task new  `/tasks/new`

**Before dispatch:**
```
PageHeader (+ actions Cancel / Start task)

Warning banner

Card "Agent"
└─ Список выбираемых агентов (tiles)

Card "Type"
└─ Grid 3 колонки с типами

Card "Task details"
├─ Row: Title
└─ Row: Input

Info banner
```

**After dispatch:**
```
PageHeader (+ action "Back to tasks")

Success panel
├─ Title "Task queued"
├─ Описание
├─ Response card (DataList)
└─ CTA "Open task detail"
```

### 4.4 Run detail  `/runs/:runId`

```
PageHeader (+ status)

CommandBar
(ID | TASK | AGENT | STATUS | STARTED | FINISHED)

Timeline / steps list
└─ Пошаговое выполнение run

Metadata card
```

---

## 5. Approvals

### 5.1 Approvals list  `/approvals`

```
PageHeader

Policy banner

Filters row
└─ Status chips (all · pending · approved · rejected · expired · cancelled)

Table
├─ Header row
└─ Rows (ID+Created | Action | Requested by | Role | Status+Expires | Quick decide | →)

Pagination
```

### 5.2 Approval detail  `/approvals/:approvalId`

**Три состояния в зависимости от approval:**

```
PageHeader (+ status, actions "Open run" / "Open task" / "Back")

CommandBar
(ID | RUN | TASK | NEEDS | EXPIRES | RESOLVED)

Conflict banner (опционально)
Resume polling banner (опционально)

─────────────────────────────
Состояние 1 — Pending (intro)
Decision intro card
├─ Header "Your decision is required"
└─ Два CTA
    ├─ Approve
    └─ Reject

─────────────────────────────
Состояние 2 — Pending (confirm)
Decision confirm card
├─ Header (Approve/Reject) + switch
├─ "What happens next" sub-card
├─ Reason (textarea)
├─ Signed as (info)
└─ Footer (Back / Decide)

─────────────────────────────
Состояние 3 — Resolved
Resolved card
├─ Статус + кто + когда
├─ Reason (опционально)
└─ CTA "Open run"

─────────────────────────────

Metadata card

Evidence card (опционально)
```

---

## 6. Tools  `/tools`

```
PageHeader

CommandBar
(TOTAL | READ_ONLY | REQUIRES_APPROVAL | DENIED)

Filters row
├─ Search input
└─ Mode chips (all · read_only · requires_approval · denied)

Expandable table
├─ Header row (Name | Default mode | Description | expand)
└─ Rows (collapsed / expanded)
    └─ Expanded: input_schema (JSON)
```

---

## 7. Spend  `/spend`

(Доступно только admin / domain_admin. Иначе — no-access экран.)

```
PageHeader

CommandBar
(TOTAL | READ_ONLY | REQUIRES_APPROVAL | DENIED)

Filters row
├─ Range chips (1d · 7d · 30d · 90d)
├─ Разделитель
└─ Group chips (agent · user)

Metrics grid (3 колонки)
├─ Total spend
├─ Total runs
└─ Tokens in/out

Chart card "Spend by [group]"
└─ Horizontal bar rows (label | bar | amount+%)

Breakdown table
├─ Header row
└─ Rows ([group] | Spend | Runs | Tokens in | Tokens out | Date)

Pagination
```

---

## 8. Profile  `/profile`

```
PageHeader (+ action "Sign out")

Identity card
├─ Avatar
├─ Name + email + role chip
└─ User ID (справа)

Scope card
└─ Grid 2x2 (Tenant | Domain | Created | Role)

Approval authority card
├─ Пояснительный текст
└─ Grid 4 (L1 · L2 · L3 · L4)
```

---

## 9. Style guide  `/components`

```
PageHeader (+ actions)

CommandBar (Route | Library | Theme | Density)

Sections (вертикальный стек)
├─ Handoff guidance (3 cards)
├─ Color tokens (grid)
├─ Typography / radius / spacing (grid 2)
├─ Component map for Figma (table)
├─ Actions and badges (grid 2)
├─ Forms and selection (grid 2)
├─ Cards, command bars, metadata
├─ System states (grid 2x2)
├─ Data rows and pagination
└─ Transfer checklist (grid 2)
```

---

## Навигация — потоки между экранами

```
Login ──► Home
Register ──► Home

Home ──► Agents / Tasks / Approvals / Spend
         (через metric cards и списки)

Agents list ──► Agent detail ──► Version new
              └─► Agent new

Agent detail ──► Task new (с preselected agent)

Tasks list ──► Task detail ──► Run detail
            └─► Task new ──► (success) ──► Task detail

Approvals list ──► Approval detail ──► Run detail / Task detail

Tools list ──► (expand inline, без перехода)

Spend ──► Agent detail (по клику на agent row)

Любой экран ──► Profile (из sidebar footer)
Любой экран ──► Components (из sidebar)
```

---

## Адаптивные варианты (для каждого экрана)

Каждый экран существует в трёх размерах:

| Размер | Ширина | Ключевые изменения раскладки |
|---|---|---|
| Desktop | ≥ 1101px | Полная раскладка как описана выше |
| Tablet | ≤ 1100px | Sidebar сжат в icon-only (72px); grid-4 → grid-2; grid-3 → grid-2; split → одна колонка; формы → label над полем |
| Mobile | ≤ 768px | Sidebar становится bottom-nav (56px); все grid → 1 колонка; PageHeader вертикальный; таблицы со скроллом по горизонтали; Login/Register → одна колонка |

---

## Рекомендация по структуре Figma

1. **Страница "Screens / Desktop"** — по одному фрейму на каждый экран из списка выше.
2. **Страница "Screens / Tablet"** — те же экраны в tablet-варианте.
3. **Страница "Screens / Mobile"** — те же экраны в mobile-варианте.
4. **Страница "Flows"** — стрелки переходов из раздела «Навигация».
5. **Страница "Shell"** — отдельно Sidebar + Topbar + PageHeader как шаблоны.
6. **Состояния экранов** — для детальных экранов (Approval detail, Task new, Home) держать разные фреймы на каждое состояние.
