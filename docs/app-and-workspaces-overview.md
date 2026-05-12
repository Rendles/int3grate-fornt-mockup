# Обзор приложения и устройства Workspaces

Документ для внешнего обсуждения с другим ИИ-агентом. Самодостаточный — читается без доступа к коду. Снимок состояния на 2026-05-08.

---

## 1. Что это за продукт

**Int3grate** — control plane для AI-агентов, которых компания «нанимает» вместо найма людей на повторяющиеся задачи. Идеальный пользователь — Maria, владелица малого/среднего бизнеса, не инженер. Ментальная модель — «маленькая цифровая команда»: агенты это сотрудники, не workflow-узлы.

Что пользователь делает в продукте:

- **Hire** агентов из шаблонов (Sales / Marketing / Reports / Support / Finance / Operations / Custom).
- **Approvals** — даёт разрешения на чувствительные действия (отправить email, списать деньги, создать запись в CRM).
- **Activity** — ленту того, что агенты сделали.
- **Costs** — траты по месяцам/неделям, по агентам.
- **Talk** — встроенный чат с конкретным агентом для уточнений и ad-hoc задач.

Намеренно избегаем engineering-лексики: нет «workflow», «MCP», «tokens», «prompt», «model», «context window». Используем «agent / hire / brief / playbook / activity / monthly bill».

## 2. Тех-стек и состояние

- **Vite + React 19 + TypeScript**, hand-rolled hash router (нет react-router).
- **Radix Themes** для UI-примитивов, тёмная instrument-panel-эстетика поверх Radix CSS-переменных.
- **Бэкенда нет**. Это полностью мокап: данные в `lib/fixtures.ts`, единый data-слой `lib/api.ts` имитирует SSE, пагинацию, задержки.
- Контракт с реальным backend заморожен в `docs/gateway.yaml` — это OpenAPI, **синкается verbatim с live stage backend**. Файл говорит, что бэкенд _реально умеет_, а не что мы _хотим_.
- Большая часть фронта 1:1 ложится на спеку. Каталог расхождений — `docs/backend-gaps.md` (что endpoint отсутствует, что данные синтезированы клиентом, и т.д.).

## 3. Архитектура фронтенда

```
src/App.tsx → <PrototypeApp /> (5 строк-обёртка)
src/prototype/
├─ index.tsx              ← роутер + провайдеры
├─ auth.tsx               ← AuthProvider, сессия, workspace state
├─ router.tsx             ← hash-based router
├─ lib/
│  ├─ api.ts              ← единый data-слой; имитирует backend
│  ├─ fixtures.ts         ← in-memory данные
│  ├─ types.ts            ← домен, 1:1 со спекой
│  ├─ workspace-context.ts← синглтон с активным ws и списком memberships
│  ├─ format.ts           ← хелперы форматирования
│  └─ templates.ts        ← 7 шаблонов для hire-визарда
├─ components/
│  ├─ shell.tsx           ← AppShell + Sidebar
│  ├─ workspace-switcher.tsx
│  ├─ workspace-remount.tsx
│  ├─ workspace-form-dialog.tsx
│  ├─ workspace-delete-dialog.tsx
│  ├─ common/
│  │  ├─ workspace-filter.tsx       ← per-page chip-row
│  │  └─ workspace-context-pill.tsx ← «in {workspace}» бейдж
│  └─ ...
├─ screens/               ← страницы
└─ tours/                 ← движок интерактивных туров (deferred)
```

### Провайдеры и порядок монтирования

```
AuthProvider
  └ RouterProvider
    └ DevModeProvider
      └ TrainingModeProvider
        ├ TrainingBanner
        └ TourProvider
          ├ DevModeRemount → WorkspaceRemount → Router (страницы)
          ├ TourOverlay
          ├ WelcomeToast
          └ TrainingAutoExit
```

`WorkspaceRemount` — обёртка `display: contents`, чьим ключом является `activeWorkspaceId`. При смене активного workspace всё дерево страниц размонтируется и собирается заново — это нужно потому что list-экраны кешируют результат в локальном state, и без принудительного remount продолжали бы показывать данные предыдущего workspace.

### Роуты (хеш-роутер)

Production: `/`, `/login`, `/profile`, `/learn`, `/agents`, `/agents/new`, `/agents/:agentId/{overview,talk,grants,activity,settings,advanced}`, `/approvals`, `/activity`, `/costs`, `/workspaces`, `/sandbox/team-bridge`, `/sandbox/team-map`. Закомментированы (но файлы сохранены): `/register`, `/apps`, `/settings/*`, `/audit`.

### Сайдбар

Header: логотип → **WorkspaceSwitcher** → 5 production пунктов (Home / Approvals / Activity / Team / Costs) → divider → 1 sandbox preview (Team Bridge) → footer (user-меню).

Внимание к терминологии: пункт сайдбара называется «**Team**», но ведёт на `/agents`. То есть «Team» = ваша цифровая команда (агенты), а «**Workspace**» = container верхнего уровня (отдел/команда _людей_ внутри компании). Это сознательное разделение, не bug.

### Auth

- Демо-логины: Ada (admin, L4), Marcelo (domain_admin, L3), Priya (member, L1). Любой пароль.
- Двухшаговый login: `POST /auth/login` → `LoginResponse {token, expires_at}`, затем `GET /me` с bearer.
- Сессия хранится в `localStorage["proto.session.v1"]` как `{ token, userId, activeWorkspaceId }`.

### Mock-only поверхности

Любая UI-поверхность, не имеющая endpoint в реальной спеке, помечается `<MockBadge kind="design" />` (endpoint вообще не существует) или `kind="deferred"` (существует, но `x-mvp-deferred`). Workspaces — целиком `kind="design"`.

## 4. Workspaces — главный фокус документа

### 4.1. Что такое Workspace в нашей модели

«Команда людей внутри компании». Контейнер верхнего уровня, который держит:

- **Агентов** — каждый агент принадлежит ровно одному workspace.
- **Approvals, Activity, Spend** — все производные от агентов, поэтому unscope автоматически через агента.
- **Membership** — пользователь может быть членом нескольких workspace-ов одновременно.

Параллель: Slack workspace, GitHub team, Notion workspace, Linear team. **Это НЕ tenant** — tenant у нас отдельная сущность (вся компания), workspace это под-уровень внутри tenant.

### 4.2. Почему всё это mock-only

В `docs/gateway.yaml` (live backend на 2026-05-01) **нет** ничего про workspace:

- нет `Workspace` schema;
- нет `Membership` schema;
- нет `/workspaces/*` endpoints;
- у `Agent` нет поля `workspace_id`.

Поэтому ассоциация «agent → workspace» хранится в **side-table в фикстурах**: `agentWorkspace: Record<agent_id, workspace_id>`. Это намеренно — мы НЕ добавляем `workspace_id` в `Agent`-тип, потому что этот тип 1:1 со спекой, и фейковое поле сломает боли при подключении реального бэка. См. `docs/backend-gaps.md § 1.15`.

### 4.3. State-модель (что менялось)

Текущая модель — **single-active + per-page filter**. Это уже _вторая_ итерация, после короткого эксперимента с multi-active.

#### Итерация 1 — multi-active в глобальном свитчере (2026-05-07, отвергнута)

Switcher был multi-select (чекбоксы + «All workspaces»). `selectedWorkspaceIds: string[]` ехал и в URL списков, и в hire-flow, и в Team Map. Появились проблемы:

- Куда уходит новый агент при hire, если выбрано 3 ws? Нужен dropdown в форме.
- Team Map визуализирует _один_ workspace — в multi пришлось делать fallback с EmptyState и кнопкой «Use {firstSelected}».
- Глобальное состояние стало неоднозначным: «где я работаю» vs «что я смотрю» — разные вопросы.

План полной реализации: `docs/agent-plans/2026-05-07-2300-multi-workspace-scope.md`. Pivot обоснован в `docs/agent-plans/2026-05-08-0030-page-filters-vs-global-scope.md`.

#### Итерация 2 — single-active + per-page filter (текущая)

Разделение на два уровня (как в Linear / Notion / GitHub):

- **Глобальный контекст — один.** Switcher выбирает _где я работаю сегодня_. Это драйвит hire (новый агент идёт в active), default-home, и `WorkspaceRemount` keying.
- **Per-page фильтр — локальный.** На list-экранах есть chip-row, где пользователь может расширить scope для _данного экрана_, не меняя глобальный контекст.

#### Что хранится где

```ts
// auth.tsx — AuthValue (в провайдере)
myWorkspaces: Workspace[]              // все memberships юзера
activeWorkspaceId: string | null       // одна активная
setActiveWorkspace: (id) => void
refreshWorkspaces: () => Promise<...>

// lib/workspace-context.ts — module-level singleton
let activeWorkspaceId: string | null   // зеркало для api.ts
let allUserWorkspaceIds: string[]      // зеркало для api.ts (memberships)
// AuthProvider пишет туда на login/switch/logout

// localStorage["proto.session.v1"]
{ token, userId, activeWorkspaceId }   // персистится между релоадами

// Per-screen state — useState внутри каждой list-страницы
const [workspaceFilter, setWorkspaceFilter] = useState<string[]>(
  () => activeWorkspaceId ? [activeWorkspaceId] : []
)
// Сбрасывается при remount (т.е. при навигации прочь и обратно).
// localStorage НЕ используется — намеренно per-visit.
```

Зачем синглтон в `workspace-context.ts`? Потому что `api.list*` не должны принимать `workspaceId` в каждом вызове как параметр (это ехало бы через 100 callsites). Вместо этого api читает синглтон, который пишет AuthProvider. Когда появится реальный backend — оба слоя выкидываются: bearer-scoped queries + явный `workspace_ids[]` query param.

### 4.4. UI-поверхности

#### 4.4.1. WorkspaceSwitcher (sidebar header)

`components/workspace-switcher.tsx`

- Триггер: текущий workspace (имя + caption «Workspace») + кнопка-стрелка.
- Dropdown: радио-список `myWorkspaces` (галочка у активного), separator, `+ Create workspace` (открывает `WorkspaceFormDialog`), `Manage workspaces` (навигация на `/workspaces`), MockBadge внизу.
- Switch пишет через `setActiveWorkspace(id)`: state в auth + синглтон + localStorage. Затем `WorkspaceRemount` переключает ключ → all list screens перерисовываются с новым default scope.

#### 4.4.2. Per-page workspace filter

`components/common/workspace-filter.tsx`

Chip-row с пилюлями: «All» + по одной пилюле на каждый workspace. Полностью локален странице, не пишет в глобальный state.

Правила:
- **Скрыт** если у юзера 0 или 1 membership (нечего фильтровать).
- Default — `[activeWorkspaceId]`.
- **Sticky last:** нельзя снять последнюю выбранную пилюлю (silent no-op), иначе экран рендерится с пустым scope.
- Сбрасывается при навигации прочь/обратно (per-visit, не per-session). Это сознательное решение — пер-screen `localStorage` не используется. Если пользователь часто хочет «всегда All», это станет известно по жалобам и будет добавлено как follow-up.

Используется в: `/agents`, `/activity`, `/approvals`, `/costs`.

#### 4.4.3. WorkspaceContextPill

`components/common/workspace-context-pill.tsx`

Маленький бейдж «in {Workspace name}» рядом с карточкой/строкой агента. Видно ТОЛЬКО когда per-page filter показывает >1 workspace — иначе это шум, потому что и так понятно где мы. Каждый list-экран сам решает `show={workspaceFilter.length > 1}`.

#### 4.4.4. /workspaces — управление

`screens/WorkspacesScreen.tsx`

- Card-grid: emoji + имя + описание + counts (members, agents) + created-at.
- Текущий выделен «Active» бейджом, остальные имеют «Switch».
- Edit (через `WorkspaceFormDialog`).
- Delete (через `WorkspaceDeleteDialog` с type-the-name confirm). Если у юзера ровно один workspace — кнопка Delete заблокирована с tooltip.
- Под гридом — read-only `Members` с MockBadge (потому что `GET /users` всё равно отсутствует).

#### 4.4.5. Sidebar pending-approvals badge

Считает **все pending approvals по всем memberships** — независимо от активного workspace и от per-page фильтра. Логика: когда что-то горящее, юзер должен это видеть, даже если он не в том workspace, где оно появилось. Реализовано как `api.listApprovals({ status: 'pending' })` без `workspace_ids` — fallback в api.ts превращается в «union по всем memberships».

### 4.5. Filter cascade в API-слое

`lib/api.ts:72-97`

```ts
function inSelectedWorkspaces(agentId, workspaceIds?): boolean {
  // Если параметр не передан или пустой — fallback на ВСЕ memberships
  // юзера. Это чтобы sidebar approval badge и подобные могли не
  // протаскивать workspace_ids через себя.
  const allowed = (workspaceIds && workspaceIds.length > 0)
    ? workspaceIds
    : getAllUserWorkspaceIds()
  if (allowed.length === 0) return false
  if (!agentId) return false
  const wsId = fxAgentWorkspace[agentId]
  if (!wsId) return false
  return allowed.includes(wsId)
}
```

Каждый list-метод принимает `workspace_ids?: string[]`:

- `listAgents({ workspace_ids? })`
- `listRuns({ workspace_ids? })`
- `listApprovals({ workspace_ids? })` (через `approvalAgentId(approval) → run → version → agent`)
- `listAudit({ workspace_ids? })`
- `listChats({ workspace_ids? })`
- `listHandoffs({ workspace_ids? })`
- `getSpend({ workspace_ids? })` — фильтрация per-row через `agentWorkspace` map; для group_by='user' идёт через `userInSelectedWorkspaces`.

Когда параметр опущен — это «всё что я могу видеть» = union по memberships.

При `createAgent` агент авто-привязывается к **активному** workspace (через `getActiveWorkspaceId()`). Hire-flow всегда явно зовёт `setAgentWorkspace` после, так что это просто safety net.

### 4.6. Граничные случаи

| Кейс | Поведение |
|---|---|
| Юзер удаляет активный workspace | `applyActiveWorkspace` валидирует stored id → не находит → берёт первый из оставшихся memberships. |
| У юзера 0 workspace-ов (новый аккаунт без приглашений) | `activeWorkspaceId = null`, switcher показывает «No workspace», все list-экраны пустые. |
| У юзера 1 workspace | Per-page filter скрыт, switcher всё равно виден (для symmetry + кнопки Create). |
| Пользователь Priya (member, L1) | Visible scope = только её memberships. Никакой role-gate на switcher — multi-select показывается всем у кого ≥2 memberships, single-pick UI у тех у кого 1. |
| Старая сессия с `selectedWorkspaceIds` | Migration в `readStoredSession`: берётся первый id как новый active. |
| Старая сессия с `currentWorkspaceId` | Migration: переименование в `activeWorkspaceId`. |
| Новый workspace создан | `refreshWorkspaces` → `applyActiveWorkspace` подхватывает. Создатель сразу получает его как active (см. `WorkspaceSwitcher.handleCreate`). |
| Approval без resolvable agent (битая цепочка run→version→agent) | `inSelectedWorkspaces` возвращает false → approval отфильтрован. |

### 4.7. Что нужно от backend (когда дойдёт до wiring)

Минимальный набор:

- `Workspace` schema (`id`, `name`, `description?`, `created_at`).
- `Membership` schema (`workspace_id`, `user_id`, `joined_at`, optionally `role`).
- `GET /workspaces` — visible to bearer.
- `GET /workspaces/{id}`, `POST /workspaces`, `PATCH /workspaces/{id}`, `DELETE /workspaces/{id}`.
- `GET /workspaces/{id}/members` (read-only достаточно для v1).
- `Agent.workspace_id: string` — иначе фронт не уйдёт от side-table.
- Filter param на list-endpoints: либо `?workspace_id[]=a&workspace_id[]=b`, либо `?workspace_ids=a,b`. Применяется ко всем `/agents`, `/dashboard/runs`, `/audit`, `/approvals`, `/chat`, `/dashboard/spend`. Без параметра сервер возвращает union по memberships юзера.
- Опционально для invite/remove: `POST /workspaces/{id}/members`, `DELETE /workspaces/{id}/members/{user_id}` + реальный `GET /users` (он сейчас тоже отсутствует — backend-gaps § 1.2).
- Для аккуратной агрегации: `group_by=workspace` для `/dashboard/spend`, иначе клиенту приходится складывать самому.

## 5. Что обсудить с другим ИИ

Ниже — открытые вопросы и потенциальные альтернативные модели, которые имеет смысл сравнить:

1. **Single-active vs multi-active в глобальном свитчере.** Мы пробовали multi и откатились. Аргументы за multi: «admin хочет видеть всё сразу», cross-team monitoring, fewer clicks. Аргументы против (наши): неоднозначность hire-target, сложность Team Map, расплывчатый смысл «глобального контекста». Как решают это Linear / Notion / GitHub / Slack? Где multi-scope действительно работает (Datadog, Grafana, Stripe)?

2. **Per-visit reset фильтра.** Мы намеренно сбрасываем per-page filter при навигации. Альтернативы: per-screen `localStorage` (sticky), session-storage (sticky на вкладку), URL-query param (shareable links + sticky). Что лучше для пользователя-неинженера?

3. **Granularity scope.** Сейчас scope живёт на уровне Workspace. Можно ли извлечь пользу из под-уровней — projects / labels / tags? Linear имеет Workspace > Team > Project. У нас — Workspace > Agent. Стоит ли вводить Project/Pod/Squad как промежуточный уровень?

4. **Cross-workspace сущности.** Pending approvals badge считает по всем workspace-ам — это исключение. Стоит ли иметь «inbox» / «my queue» как отдельную глобальную поверхность поверх workspace-разреза?

5. **Membership и роли внутри workspace.** Сейчас роль (admin / domain_admin / member) — глобальная на уровне tenant. Бэкенд может в будущем дать per-workspace роли. Стоит ли уже сейчас закладывать UI под per-workspace permissions?

6. **Workspace = team vs workspace = project.** В нашей текущей метафоре Workspace = «команда людей» (Sales, Marketing, Operations). Но многие SaaS используют Workspace = «среда / проект» (dev / staging / prod, или client A / client B). Что естественнее для Maria?

7. **Onboarding и default workspace.** Новый юзер логинится — какой workspace должен быть active первым? Сейчас: сохранённый ID или первый из списка. Можно: «Personal» / «Inbox» / «My agents» как virtual workspace, поверх настоящих.

8. **Sidebar switcher placement.** У нас он между логотипом и навигацией. Альтернативы: bottom (Slack), modal (Cmd+K), отдельная страница (Linear sidebar dropdown). Что лучше масштабируется на 10+ workspace-ов?

9. **Visual feedback при switch.** Сейчас весь подlevel ремонтируется (`WorkspaceRemount`). Это надёжно, но грубо — мерцание всего экрана. Можно ли мягче через React Suspense / per-component invalidation?

10. **Shared agents / templates across workspace-ов.** Сейчас агент жёстко привязан к одному workspace. Реалистично ли «один агент работает на несколько команд»? Если да — как это рендерить в UI без двусмысленности owner-scope.

## 6. Файлы-первоисточники (для глубокого чтения)

```
src/prototype/auth.tsx                                — workspace state в провайдере
src/prototype/lib/workspace-context.ts                — module-singleton
src/prototype/lib/api.ts:60-100, 314-, 469-, 527-,    — filter cascade
                          615-, 631-, 748-, 937-
src/prototype/components/workspace-switcher.tsx       — sidebar dropdown
src/prototype/components/workspace-remount.tsx        — key-based remount
src/prototype/components/common/workspace-filter.tsx  — per-page chip row
src/prototype/components/common/workspace-context-pill.tsx
src/prototype/screens/WorkspacesScreen.tsx            — /workspaces
src/prototype/lib/fixtures.ts:108                     — agentWorkspace side-table
docs/backend-gaps.md § 1.15                           — что нужно от backend
docs/agent-plans/2026-05-07-2300-multi-workspace-scope.md      — отвергнутая мульти-итерация
docs/agent-plans/2026-05-08-0030-page-filters-vs-global-scope.md — текущая архитектура
```
