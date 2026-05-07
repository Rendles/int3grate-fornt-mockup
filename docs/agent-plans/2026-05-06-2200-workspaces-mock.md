# Workspaces — mock-only multi-membership + switcher + management page

**Created:** 2026-05-06 22:00
**Status:** Draft — awaiting confirmation before step 1
**Backend reality:** None of the endpoints in this plan exist in the
live spec (`docs/gateway.yaml`). Add catalogue entry to
`docs/backend-gaps.md § 1.x` as part of this work.

---

## 1. Task summary

Ввести Workspace как первичный контекст-контейнер UI: пользователь может
быть членом нескольких workspace'ов, переключаться между ними, видеть
только агентов / approvals / activity / costs текущего workspace'а,
и управлять списком workspace'ов (CRUD) на отдельной странице.

Полностью моковая реализация — никаких новых эндпойнтов в `lib/api.ts`
не привязано к реальному backend'у. Фиксации в `docs/backend-gaps.md`.

## 2. User decisions (already locked in)

| Развилка | Решение |
|---|---|
| Multi-membership | Yes — пользователь может быть в нескольких. |
| Что такое workspace | Команда внутри компании. |
| User-facing label | **Workspace** (не «Team» — collision с уже существующим label `/agents` = «Team»). |
| Switcher placement | **Sidebar header** между `.sb__brand` и `.sb__nav` (Slack/Linear/Notion-конвенция). Не топбар. |
| Management page route | `/workspaces` — отдельный route, **БЕЗ** sidebar-пункта. Открывается из dropdown свитчера через `Manage workspaces`. |
| Member management v1 | Read-only (count + avatars). Invite/remove deferred — нужен `GET /users` + invite endpoints, обоих нет. |
| Workspace fields | `name` (required), `description` (optional, ≤140 chars). Иконок нет — текст-only по решению 2026-05-06. |
| Delete UX | Type-the-name confirmation (GitHub/Linear/Vercel). |
| Filter cascade | Каждый агент в fixtures получает `workspace_id`. Switch filter'ит `/agents`, `/approvals`, `/activity`, `/costs` каскадом по `agent.workspace_id`. |
| Default workspace | Первая membership в списке. Persisted в `proto.session.v1.currentWorkspaceId`. |
| Last-workspace deletion | Block — нельзя удалить единственный workspace, в котором ты состоишь. Toast + disabled Delete. |
| MockBadge | На management page (header) + dropdown свитчера (внизу). `kind="design"`, бэкенд эндпойнтов нет. |

## 3. Current repository state

Inspected files:
- `src/prototype/components/shell.tsx:104-167` — Sidebar с `.sb__brand` (logo+title) → `.sb__nav` (items) → `.sb__footer` (user). Свитчер встанет блоком между `.sb__brand` и `.sb__nav`.
- `src/prototype/components/shell.tsx:169-282` — Topbar с breadcrumbs слева и cluster кнопок справа (DevMode, Help, theme, Logout). Не трогаем.
- `src/prototype/auth.tsx:18-25` — `StoredSession { token?, userId? }` в `localStorage["proto.session.v1"]`. Расширяем на `currentWorkspaceId?`.
- `src/prototype/lib/types.ts` — нет ни `Workspace`, ни `Membership`. Создаём.
- `src/prototype/lib/fixtures.ts` — есть `fxAgents`, `fxUsers`. Каждый агент сейчас глобальный (нет `workspace_id`). Добавим поле + сидов 2-3 workspace'а.
- `src/prototype/lib/api.ts` — pagination envelope `{ items, total, limit, offset }` + 120-380ms delay паттерн. Новые методы держат тот же паттерн.
- `src/prototype/index.tsx` — flat route list. Добавляем `/workspaces` + детальный `/workspaces/:workspaceId/edit` (или модалкой — см. § 5).
- `docs/backend-gaps.md` — добавим § 1.15 «Workspace CRUD + membership».

## 4. Relevant files inspected

| Path | Что взято |
|---|---|
| `components/shell.tsx` | Sidebar layout, topbar layout, nav structure |
| `auth.tsx` | Session shape, login flow, `useAuth()` API |
| `lib/types.ts` | Существующие типы — для согласования naming convention |
| `lib/fixtures.ts` | Структура fxArrays, как сидится `fxAgents` |
| `lib/api.ts` | Pagination envelope, delay() pattern, mutation pattern |
| `prototype.css` | `.sb__brand` / `.sb__nav` структура для нового блока свитчера |

## 5. Proposed approach

### 5.1 Data model (`lib/types.ts`)

```ts
export interface Workspace {
  id: string                    // ws_xxx
  name: string
  description?: string
  emoji?: string                // 📊 / 📣 / ⚙️ / etc., optional
  created_at: string            // ISO
}

export interface WorkspaceMembership {
  workspace_id: string
  user_id: string
  joined_at: string             // ISO
}

export interface WorkspaceList {
  items: Workspace[]
  total: number
  limit: number
  offset: number
}

export interface CreateWorkspaceRequest {
  name: string
  description?: string
  emoji?: string
}

export type UpdateWorkspaceRequest = Partial<CreateWorkspaceRequest>
```

`Agent` получает поле `workspace_id: string`.

### 5.2 Fixtures (`lib/fixtures.ts`)

Сидируем 3 workspace:
- `ws_growth` — «Growth» 📈 — Ada + Marcelo (Ada admin, Marcelo domain_admin).
- `ws_ops` — «Operations» ⚙️ — Ada + Priya.
- `ws_finance` — «Finance» 💸 — только Ada.

Каждый из существующих `fxAgents` получает `workspace_id`. Распределение
естественное — sales/marketing-агенты в Growth, support/ops — в Ops,
finance/reports — в Finance.

### 5.3 API (`lib/api.ts`)

```ts
api.listWorkspaces()                                // мои workspace'ы
api.getWorkspace(id)
api.createWorkspace(input)                          // creator auto-joined
api.updateWorkspace(id, patch)
api.deleteWorkspace(id)                             // 409 если только этот у юзера
api.switchWorkspace(id)                             // обновляет session
```

Все возвращают через `delay(120-380)`. Mutations пишут прямо в
`fxWorkspaces`, `fxMemberships`. `deleteWorkspace` каскадно удаляет
агентов с этим `workspace_id` (mock — реалистично эмулирует «архив»
как hard-delete).

`api.listAgents()`, `api.listApprovals()`, `api.listRuns()`,
`api.getSpendDashboard()` — читают `currentWorkspaceId` из сессии и
фильтруют. **Это ключевая часть** — иначе свитчер fake.

### 5.4 Session (`auth.tsx`)

`StoredSession { token, userId, currentWorkspaceId? }`. При логине —
если у юзера есть membership'ы, `currentWorkspaceId` ставится на первый.
`useAuth()` экспортирует `{ user, currentWorkspaceId, switchWorkspace }`.
`switchWorkspace(id)` — пишет в localStorage + триггерит re-fetch'и
активных запросов (через простую инвалидацию — bumping counter в
context, чтобы экраны видели новые данные).

### 5.5 UI: WorkspaceSwitcher (`components/workspace-switcher.tsx`)

Новый компонент. Renders в Sidebar между `.sb__brand` и `.sb__nav`.

Trigger: широкая кнопка `[emoji] Workspace name ▾` (size 2). Dropdown
(Radix DropdownMenu):
- Top section: «MY WORKSPACES» caption + список с radio-индикатором
  активного.
- Divider.
- `+ Create workspace` (открывает Create dialog).
- `Manage workspaces` (navigate `/workspaces`).
- Bottom: `<MockBadge kind="design" />` с tooltip'ом.

Создание: тут же inline Radix Dialog с полями name / description /
emoji-grid. После Create — auto-switch на новый.

### 5.6 UI: WorkspacesScreen (`screens/WorkspacesScreen.tsx`)

Route `/workspaces`. PageHeader: «Workspaces», subtitle «Teams inside
your company. Switch context in the sidebar.», действие — `+ New
workspace`. Под ним `<MockBadge kind="design">` с пояснением.

Список — table (Radix Table) или card grid: emoji + name + description +
member-count + agent-count + created. На каждой строке dropdown menu:
`Edit`, `Delete`. Активный workspace — мягкий highlight + бейдж
«Current».

Edit — открывает тот же dialog, что и Create, но с pre-filled
значениями.

Delete — двух-этапный confirm dialog:
1. «You're about to delete `<name>` and N agents will be archived.»
2. Type the name to confirm. Кнопка Delete disabled пока input ≠ name.

Member management — карточка под таблицей: список member-ов текущего
workspace'а (read-only — Avatar + name + role). MockBadge на самой
карточке: «Member management — connect backend to invite/remove».

### 5.7 Routing (`index.tsx`)

```ts
{ pattern: '/workspaces', render: () => <WorkspacesScreen /> }
```

Без sidebar-пункта. Detail редактирования и create — через диалоги, не
отдельные routes.

### 5.8 Vocab impact

`docs/ux-spec.md § 8` уже фиксирует «Team» = `/agents`. Добавить ниже
запись: «Workspace = команда внутри компании, контейнер агентов; не
называть это словом Team в UI». Обновить `CLAUDE.md` / `AGENTS.md`
секцию vocabulary.

### 5.9 Backend gaps entry

`docs/backend-gaps.md § 1.15` — таблица отсутствующих эндпойнтов,
последствия, fallback'и. Шаблон такой же как § 1.13 / 1.14.

## 6. Risks and trade-offs

- **Filter cascade трогает 4+ экрана.** Если что-то промахнём, юзер
  увидит чужого агента. Митигейшн — централизуем фильтр на уровне
  `api.list*` методов, не в каждом скрине отдельно.
- **Edge case: 0 workspaces.** Если юзер удалил все свои (или сид сломал
  сессию) — нужен empty state на `/workspaces` и не падаем в sidebar.
  Защита: `currentWorkspaceId` ⇒ если пуст, sidebar свитчер показывает
  «No workspace · Create one», nav-items частично disabled (Approvals/
  Activity/Costs ничего не покажут — empty states).
- **Cascade на delete агентов.** В моке делаем hard-delete, в проде это
  будет «archive». В UI копируем «archive» wording в diaog — не «Delete
  forever 12 agents».
- **Type-the-name confirm для прод-юзера может быть тяжеловато.**
  GitHub / Linear так делают для именно тяжёлых ops; workspace = team
  = контейнер ценных артефактов, тут это оправданно.
- **Свитчер в сайдбаре крадёт ~56px вертикали.** Sidebar у нас длинный
  и не страдает.

## 7. Step-by-step implementation plan

1. **Types + fixtures + base API** — `Workspace`, `WorkspaceMembership`,
   `Agent.workspace_id`, сид трёх workspace'ов, базовые
   `api.listWorkspaces`/`getWorkspace`/`createWorkspace`/
   `updateWorkspace`/`deleteWorkspace`/`switchWorkspace`. Без UI ещё.
   Verification: `npm run lint && npm run build` clean.

2. **Session расширение** — `currentWorkspaceId` в storage,
   `useAuth().switchWorkspace()`, default-выбор при логине, защита
   при stale id.

3. **Filter cascade в `api.list*`** — `listAgents`, `listApprovals`,
   `listRuns`, `getSpendDashboard` читают `currentWorkspaceId` и
   фильтруют. Каждый dashboard reads (HomeScreen heatmap / savings)
   тоже.
   Verification: вручную в `Console` через `api.switchWorkspace('ws_ops')`
   проверить что `/agents` показывает другую подборку.

4. **WorkspaceSwitcher компонент** + интеграция в Sidebar. Без Create
   dialog'а пока — radio-list + `Manage workspaces` link.
   Verification: переключение работает, активный подсвечен.

5. **Create workspace dialog** — внутри свитчера + потом переиспользуется
   на `/workspaces`. Form, validation (name required, ≤80 chars),
   emoji-picker (12 фиксированных опций).

6. **WorkspacesScreen** — list + Edit dialog (тот же компонент, что и
   Create, но pre-filled) + member display. MockBadge.

7. **Delete dialog** — type-the-name confirm + last-workspace block.

8. **Docs** — backend-gaps § 1.15, ux-spec § 8 vocab note,
   CLAUDE.md / AGENTS.md routing list + sidebar mention.

## 8. Verification checklist

- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] Login as Ada (`frontend@int3grate.ai`) — три workspace'а в
  свитчере, Growth дефолтный.
- [ ] Login as Priya (`member@int3grate.ai`) — один workspace (Ops).
- [ ] Switch на Ops в Ada-сессии — `/agents` показывает только
  ops-агентов; `/approvals` и `/activity` тоже отфильтрованы.
- [ ] Create workspace «QA» с emoji 🧪 — auto-switch на новый, пустые
  списки везде, empty states работают.
- [ ] Edit «QA» → переименовать в «Quality» → отражено в свитчере.
- [ ] Delete «Quality» (последний созданный) → type-the-name → ушёл,
  switch на Growth.
- [ ] Попытка удалить **последний свой** workspace — кнопка disabled с
  tooltip'ом.
- [ ] Direct hash `#/workspaces` работает; sidebar-пункта нет.

## 9. Browser testing instructions for the user

После каждого степа я скажу что именно проверить. Базовое:

1. Откройте `http://localhost:5173/#/` под Ada (`frontend@int3grate.ai`).
2. В сайдбаре над списком навигации увидите блок свитчера с emoji
   текущего workspace'а.
3. Нажмите → dropdown со списком ваших workspace'ов, radio активного,
   `+ Create workspace`, `Manage workspaces`.
4. Переключите в Ops → проверьте что Approvals счётчик пересчитался,
   `/agents` показывает другую подборку, на `/costs` другие цифры.
5. `Manage workspaces` ведёт на `/workspaces` — таблица всех
   ваших workspace'ов с CRUD действиями.

## 10. Progress log

- **2026-05-06 — Step 1 done.** Types (`Workspace` / `WorkspaceMembership` / `WorkspaceList` / `CreateWorkspaceRequest` / `UpdateWorkspaceRequest`) добавлены в `lib/types.ts`. Fixtures `workspaces` (Growth / Operations / Finance), `workspaceMemberships`, side-table `agentWorkspace` в `lib/fixtures.ts`. API: `listWorkspaces` / `getWorkspace` / `createWorkspace` / `updateWorkspace` / `deleteWorkspace` / `listWorkspaceMembers`.
- **2026-05-06 — Step 2 done.** `lib/workspace-context.ts` — module-singleton getter/setter. `auth.tsx` расширен: `StoredSession.currentWorkspaceId`, `useAuth().{myWorkspaces, currentWorkspaceId, switchWorkspace, refreshWorkspaces, workspacesLoading}`. `applyCurrentWorkspace` validates stored id против myWorkspaces, fall back на первую membership.
- **2026-05-06 — Step 3 done.** Filter cascade в `api.list*`: `listAgents`, `listApprovals` (через `approvalAgentId` resolver), `listRuns` (resolve до пагинации), `listAudit`, `listChats`, `getSpend` (split на agent/user). `createAgent` пишет новый агент в `agentWorkspace[id] = currentWorkspaceId`. Training mode bypass'ит фильтр.
- **2026-05-06 — Step 4 done.** `WorkspaceSwitcher` компонент в sidebar header (между `.sb__brand` и `.sb__nav`). Radio-list + MockBadge. `WorkspaceRemount` в `index.tsx` re-mount'ит Router subtree на switch. CSS: `.sb__ws*`, narrow-mode collapse.
- **2026-05-06 — Step 5 done.** `WorkspaceFormDialog` (reusable mode='create'|'edit') с валидацией (name ≤80, description ≤140) + 12-emoji picker. Wired в switcher через `+ Create workspace`. Auto-switch на новый после create.
- **2026-05-06 — Step 6 done.** `WorkspacesScreen` (`/workspaces`) — card grid (Switch / Edit), Members card (read-only), MockBadge. `api.listWorkspaceStats()`. `Manage workspaces` link в switcher dropdown.
- **2026-05-06 — Step 7 done.** `WorkspaceDeleteDialog` — type-the-name confirm с показом agent + member impact. Last-workspace block через Tooltip + disabled button (defence in depth — api тоже бросает). Cascade-обновление stats после delete.
- **2026-05-06 — Step 8 done.** Docs: `backend-gaps.md § 1.15` (Workspaces gap entry со списком нужных backend-эндпойнтов), `ux-spec.md § 8` (vocab note Workspace ≠ Team), `CLAUDE.md` / `AGENTS.md` (routing, sidebar header, vocabulary, mock-only surfaces). Plan log заполнен.
