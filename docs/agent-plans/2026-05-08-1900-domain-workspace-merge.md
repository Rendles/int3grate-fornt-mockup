# Domain ≡ Workspace — merge plan

**Дата:** 2026-05-08 19:00
**Статус:** черновик плана. До апрува к коду не приступаем.
**Architectural decision:** `docs/handoff-prep.md § 0.1` — backend `domain` ≡ frontend `workspace`. `Agent.domain_id` (есть в spec) — это и есть FK к workspace; роль `domain_admin` = workspace admin.

---

## 1. Task summary

Слить две параллельные сущности (backend `domain` + frontend mock `workspace`) в одну. После плана:
- `Agent.domain_id` (поле из spec'а) — **единственный** источник «к какому workspace принадлежит агент». Мок-сайдтейбл `agentWorkspace` уходит.
- Hardcoded `DOMAIN_LABELS` (`dom_hq → 'HQ'`, `dom_sales → 'Sales'`, `dom_support → 'Support'`) уходят. UI читает имя workspace через `fxWorkspaces` lookup по `agent.domain_id`.
- Stat-tile «Team» на `AgentDetailScreen` Overview, MetaRow «team» на Settings и MetaRow «team» на `RunDetailScreen` переименовываются в **«Workspace»**, значения тянутся через workspace lookup.
- Фикстуры agents переписываются: `domain_id` теперь = id из `fxWorkspaces` (`ws_growth` / `ws_ops` / `ws_finance`).
- Фикстуры users тоже: `usr_ada.domain_id = null` (admin не привязан к одному), `usr_marcelo.domain_id = 'ws_growth'` (domain_admin Growth), `usr_priya.domain_id = 'ws_ops'` (member Ops).
- `WorkspaceCard` MockBadge на Settings tab: текст hint'а пересмотреть — само поле есть в spec'е, mock — только про move (`PATCH /agents/{id}` отсутствует).

Это чисто внутренняя refactor-операция в моке. Эндпоинты не меняются. UX поведение в норме не меняется (имена workspace'ов те же, только источник истины другой). Stat-tile меняет лейбл «Team» → «Workspace».

---

## 2. Current repository state (verified 2026-05-08)

### 2.1 — Где сейчас две параллельные привязки

В `src/prototype/lib/fixtures.ts`:
- `fxAgents[i].domain_id` использует префикс `dom_*` (`dom_hq` / `dom_sales` / `dom_support`) — соответствует роли `domain_admin` и хардкоду в `format.ts`.
- `fxAgentWorkspace: Record<agent_id, workspace_id>` (строка 108) — параллельный мап с префиксом `ws_*` (`ws_growth` / `ws_ops` / `ws_finance`).
- Те же agents имеют **обе** привязки: `agt_lead_qualifier` имеет `domain_id: 'dom_sales'` и `agentWorkspace: 'ws_growth'`. После слияния — одна.

В `src/prototype/lib/format.ts:124-128`:
- `DOMAIN_LABELS = { dom_hq: 'HQ', dom_sales: 'Sales', dom_support: 'Support' }`.
- `domainLabel(id)` маппит через эту таблицу с fallback на `id.replace(/^dom_/, '')`.

В UI:
- `AgentDetailScreen.tsx:193` — Overview stat-tile `{ label: 'Team', value: domainLabel(agent.domain_id) }`.
- `AgentDetailScreen.tsx:467` — Settings tab `<MetaRow label="team" value={domainLabel(agent.domain_id)} />`.
- `RunDetailScreen.tsx:214` — predictably та же роль (нужно подтвердить точное место — упомянуто в progress log редизайна workspaces).

В api-слое (`src/prototype/lib/api.ts`):
- `inSelectedWorkspaces(agentId)` (строка 72) читает `fxAgentWorkspace[agentId]`.
- `getAgentWorkspace(agentId)` (строка 1138) читает `fxAgentWorkspace[agentId]` → находит в `fxWorkspaces`.
- `setAgentWorkspace(agentId, workspaceId)` (строка 1149) пишет в `fxAgentWorkspace[agentId]`.
- `getAgentWorkspaceMap()` (строка 1129) возвращает копию `fxAgentWorkspace`.

### 2.2 — Что не меняется

- Тип `Workspace` в `lib/types.ts` — остаётся. Это и есть та схема, которую бэкенд должен будет добавить (под именем `Domain` или `Workspace` — backend's call).
- `fxWorkspaces` (3 записи) — остаётся. Имена и описания не меняются.
- `WorkspaceMembership` тип + `fxWorkspaceMemberships` — остаётся (это про user → workspace, отдельная сущность от agent → workspace).
- Существующий global scope filter (`useScopeFilter`, chip-row, switcher) — не трогается.
- Hire-flow — не трогается (`api.setAgentWorkspace` остаётся в том же контракте, только imp меняется).
- `Agent` type в `lib/types.ts` — НЕ добавляем `workspace_id` (поле в spec'е называется `domain_id`).

### 2.3 — Где роль `domain_admin` всплывает в UI

`format.ts:59-62`:
```ts
if (r === 'admin') return 'Workspace Admin'
if (r === 'domain_admin') return 'Team Admin'
```

Это **vocab-инверсия** относительно новой модели. После слияния логичнее:
- `admin` = «Tenant Admin» / «Owner» (он рулит всем тенантом, не одним workspace'ом).
- `domain_admin` = «Workspace Admin» (рулит одним workspace = domain'ом).

**Это отдельный vocab decision — НЕ часть этого плана.** Упомяну в § 4 как открытый вопрос; не трогаю в шагах ниже, чтобы не размазывать тикет.

---

## 3. Relevant files inspected

| Файл | Что важно |
|---|---|
| `src/prototype/lib/fixtures.ts` | `fxAgents` (с `domain_id`), `fxWorkspaces`, `fxWorkspaceMemberships`, `fxAgentWorkspace`, `users` (с `domain_id`) |
| `src/prototype/lib/api.ts` | `inSelectedWorkspaces`, `userInSelectedWorkspaces`, `getAgentWorkspace`, `setAgentWorkspace`, `getAgentWorkspaceMap`, `createAgent` (auto-pin) |
| `src/prototype/lib/format.ts` | `DOMAIN_LABELS`, `domainLabel`, `roleLabel` |
| `src/prototype/lib/types.ts` | `User.domain_id`, `Agent.domain_id`, `Workspace`, `WorkspaceMembership` |
| `src/prototype/screens/AgentDetailScreen.tsx` | stat-tile «Team» (193), MetaRow «team» (467), `WorkspaceCard` (488) |
| `src/prototype/screens/RunDetailScreen.tsx` | MetaRow «team» (предположительно ~214) |
| `src/prototype/lib/use-hire-template.ts` | `hire()` зовёт `setAgentWorkspace` — контракт не меняется |
| `src/prototype/screens/AgentNewScreen.tsx` | hire flow вызывает `setAgentWorkspace` |
| `docs/handoff-prep.md § 0.1` | architectural decision (создан в этой же сессии) |
| `docs/backend-gaps.md § 1.15` | cross-link (создан в этой же сессии); **полная переработка раздела — последний шаг плана** |

---

## 4. Assumptions and uncertainties

### 4.1 — Решения, которые я принимаю по умолчанию (нужен апрув)

1. **Id-стратегия: оставить `ws_*` префикс.** Все агенты получат `domain_id` со значением из `ws_growth` / `ws_ops` / `ws_finance`. Префикс `ws_` соответствует слову «workspace» в UI. В моке id могут быть любые; на бэке будут реальные UUIDs, префикс не имеет значения.
   - **Альтернатива:** оставить `dom_*` (переименовать `fxWorkspaces` ids в `dom_growth` / `dom_ops` / `dom_finance`). Меньше шума в diff'ах фикстур, но user-visible имя «Workspace» через `dom_*` строки — странно при reading логов / DevTools.
   - **Я выбираю `ws_*`.** Подтверди.

2. **Маппинг старых dom_* ids → ws_* ids:**
   ```
   dom_hq      → ws_ops      (HQ был "general/internal" → теперь Operations)
   dom_sales   → ws_growth   (Sales → Growth, который покрывает sales+marketing)
   dom_support → ws_ops      (Support → Operations, который и так ops/support)
   ```
   **Логика:** `fxWorkspaces` содержит Growth (sales+marketing) / Operations (support+internal) / Finance. Маппинг сохраняет смысловую близость. Минус — `dom_hq` и `dom_support` оба идут в `ws_ops` (раньше были разные «домены»), что схлопывает разнообразие.
   - **Альтернатива A:** добавить четвёртый workspace `ws_hq` или `ws_support` чтобы сохранить 1:1 маппинг. Минус — фикстуры workspaces текущие подобраны осознанно, лишний workspace = шум.
   - **Альтернатива B:** руками пройтись по каждому из ~25 agents в фикстурах и решить «куда он логически принадлежит». Точнее, но трудоёмко.
   - **Я выбираю предложенный 3-в-3 маппинг с двумя коллапсами.** Если пользователь хочет иначе — вариант B.

3. **`User.domain_id` — что делаем.**
   - `usr_ada` (admin, L4) — `domain_id: null`. Admin не привязан к workspace'у в смысле «работает в нём» — он рулит всем тенантом.
   - `usr_marcelo` (domain_admin, L3) — `domain_id: 'ws_growth'`. Он domain_admin Growth.
   - `usr_priya` (member, L1) — `domain_id: 'ws_ops'`. Member Operations.
   - **Vs current state:** Ada была `dom_hq`, Marcelo `dom_sales`, Priya `dom_support`. Меняется явно.
   - **Альтернатива:** оставить `User.domain_id` без изменений (подмаппить старые ids в новые через таблицу, как для агентов). Тогда Ada останется привязана к одному workspace (странно для admin).
   - **Я выбираю null для admin + ws_* для остальных.** Подтверди.

4. **`domainLabel` функция — что с ней.** После удаления `DOMAIN_LABELS` хардкода:
   - **Вариант A:** удалить `domainLabel` целиком, заменить call-sites на `workspaceById(id)?.name ?? '—'` (новый хелпер).
   - **Вариант B:** оставить функцию, но переписать как `workspaceLabel(id)` thin wrapper над `fxWorkspaces.find()`. Переименовать.
   - **Я выбираю A.** Меньше косвенностей; помогает grep'у будущим агентам.

5. **`docs/backend-gaps.md § 1.15` — переписать сейчас или follow-up?** Раздел сейчас описывает state ДО слияния; после имплементации он становится частично некорректным.
   - **Вариант A:** переписываю в этом же тикете (последний шаг плана). Pro: документ остаётся честным и согласованным.
   - **Вариант B:** оставляю как follow-up. Pro: меньше risk полусырого документа, если imp прерывается.
   - **Я выбираю A.** Подтверди.

### 4.2 — Не трогаю в этом тикете (упомянуть для записи)

- **Vocab `roleLabel`:** `admin` → 'Workspace Admin', `domain_admin` → 'Team Admin' (`format.ts:59-62`). После слияния логичнее «Tenant Admin» / «Workspace Admin». **Отдельный тикет, нужен явный vocab-decision от пользователя.**
- **Backend-side rename `domain` → `workspace`:** не наша забота, бэкенд может оставить `Agent.domain_id` как есть, UI работает.
- **`domain_admin` role string:** в spec'е enum остаётся `[member, domain_admin, admin]`. Не переименовываем — UI читает enum value и мапит на label.

### 4.3 — Риски

- **Тестовая корзина мутаций.** Side-table `fxAgentWorkspace` мутировался через `setAgentWorkspace`; теперь это будет мутация `agent.domain_id` на самом объекте `Agent`. Проверить, что нигде нет «снимка» Agent'а до мутации, который потом сравнивается. Просмотр — простой grep по `agent.domain_id` в коде на чтение.
- **Фикстуры могут расходиться.** Сейчас `agt_lead_qualifier` имеет `domain_id: 'dom_sales'` И `agentWorkspace: 'ws_growth'`. После мерджа — только `domain_id: 'ws_growth'`. UI начнёт показывать `Growth` вместо `Sales` в местах, где использовался `domainLabel`. Это **намеренно**: до плана UI был врунлив, показывал две разные принадлежности. После — одна.
- **Маппинг `usr_marcelo` → `ws_growth`:** Marcelo `domain_admin`. Если по бэкенд-семантике `domain_admin` строго рулит ровно одним domain'ом, то в `inSelectedWorkspaces` для domain_admin'а должен быть filter по его `domain_id`. Это уже не часть плана, но проверю: сейчас filter cascade использует **memberships** (`fxWorkspaceMemberships`), не `User.domain_id`. После слияния — то же; `User.domain_id` живёт сам по себе и используется только для labels (если вообще).
- **Backward compat localStorage:** клиентского state, который зависит от `dom_*` ids, нет. `proto.session.v1` хранит `activeWorkspaceId` — там `ws_*`. `proto.scope.v1` хранит `filter: string[]` — там тоже `ws_*`. Ничего не ломается.
- **Workspaces redesign plan progress log** содержит запись «Открытое — оставил без изменений; если потребуется — отдельный микро-тикет на Department». Эта запись становится неактуальной — план её закрывает. После имплементации — добавлю комментарий-cross-link в тот progress log.

---

## 5. Proposed approach — high-level

Шесть атомарных шагов. Каждый — отдельный коммит-кандидат, верификация после каждого:
1. **Фикстуры:** переписать `Agent.domain_id` (с `dom_*` на `ws_*`), `User.domain_id` (admin null, остальные ws_*), удалить `fxAgentWorkspace`.
2. **api.ts:** `inSelectedWorkspaces` / `getAgentWorkspace` / `setAgentWorkspace` / `getAgentWorkspaceMap` читают `agent.domain_id`. Импорт `fxAgentWorkspace` удаляется.
3. **format.ts:** удалить `DOMAIN_LABELS` + `domainLabel`. Добавить новый хелпер `workspaceById(id, workspaces)` (или просто inline lookup).
4. **UI screens:** AgentDetailScreen Overview tile «Team» → «Workspace», тянет `fxWorkspaces.find(w => w.id === agent.domain_id)?.name`. То же для Settings tab MetaRow и RunDetailScreen MetaRow. Лейблы переименовываются.
5. **`WorkspaceCard` MockBadge hint:** обновить текст — само поле в spec'е есть, mock — только про move (отсутствие `PATCH /agents/{id}`).
6. **Документация:** `docs/backend-gaps.md § 1.15` переписать под новую модель (без `agentWorkspace` side-table). Cross-link добавить в `2026-05-08-1645-workspaces-redesign.md` progress log.

Каждый шаг описан детально в § 7.

---

## 6. Risks and trade-offs

| Риск | Mitigation |
|---|---|
| Фикстуры расходятся между двумя источниками сейчас (`dom_*` vs `ws_*`) — после мерджа сильно поменяются UI лейблы где использовался `domainLabel` | Это намеренно. UI был врунлив; станет честным. В § 4.1.2 описан явный маппинг — пользователь подтверждает. |
| `usr_ada.domain_id = null` потребует, чтобы UI везде, где `domainLabel(user.domain_id)`, показывал «—» вместо «HQ» | Grep по `user.domain_id` / `usr.domain_id` — сейчас в UI это поле почти не используется (Settings → Team members tab скрыт; Approvals смотрит на approver_user_id, не на domain). Проверю при имплементации. |
| После удаления `fxAgentWorkspace` все места, импортирующие его как `agentWorkspace`, падают на компиляции | Хорошо — TS поймает все call-sites. Грубый поиск: один импорт в api.ts (`fxAgentWorkspace`), плюс fixtures.ts экспорт. После удаления — `npm run build` укажет на остальное (если что-то есть). |
| Бэкенд может в итоге назвать поле иначе (`workspace_id` вместо `domain_id`) — придётся гонять переименование на фронте | Это уже после wiring'а к real backend, не в моке. Если так — это thin rename в `lib/types.ts` + `lib/api.ts` + UI. Не сейчас. |
| Маппинг `dom_hq + dom_support → ws_ops` коллапсирует разнообразие — некоторые agents «теряют» свой original domain | Намеренно — `ws_ops` и есть «общий operations workspace», в фикстурах это самый большой workspace (8 агентов). Логически близко. Если пользователь хочет точнее — § 4.1.2 вариант B (per-agent ручной маппинг). |

---

## 7. Step-by-step implementation plan

Каждый шаг — атомарный коммит-кандидат. Не переходим к следующему до подтверждения пользователя.

### Шаг 1 — Фикстуры

Файл: `src/prototype/lib/fixtures.ts`

Действия:
- В `fxAgents`: каждому agent'у поменять `domain_id` по таблице:
  - `dom_hq` → `ws_ops`
  - `dom_sales` → `ws_growth`
  - `dom_support` → `ws_ops`
  - `null` → null (без изменений)
- В `users`: поменять `domain_id` так:
  - `usr_ada`: `dom_hq` → `null`
  - `usr_marcelo`: `dom_sales` → `ws_growth`
  - `usr_priya`: `dom_support` → `ws_ops`
- Удалить `export const agentWorkspace: Record<string, string> = { ... }` (строка 108) и комментарий перед ним (строки 105-107).
- Если в файле есть только этот consumer импорта `Workspace` из types — оставить (используется `fxWorkspaces`).

Verify (после шага):
- `npm run build` — должен упасть с ~1 ошибкой в `api.ts` (импорт `agentWorkspace as fxAgentWorkspace`). Это ожидаемо, фиксится в шаге 2.

### Шаг 2 — api.ts

Файл: `src/prototype/lib/api.ts`

Действия:
- Удалить импорт `agentWorkspace as fxAgentWorkspace` (строка 4).
- `inSelectedWorkspaces(agentId, workspaceIds)`: вместо `const wsId = fxAgentWorkspace[agentId]` сделать `const agent = fxAgents.find(a => a.id === agentId); const wsId = agent?.domain_id`. Остальное без изменений.
- `getAgentWorkspaceMap()`: построить объект из `fxAgents.reduce((acc, a) => { if (a.domain_id) acc[a.id] = a.domain_id; return acc }, {})`.
- `getAgentWorkspace(agentId)`: вместо чтения side-table — `const agent = fxAgents.find(a => a.id === agentId); if (!agent?.domain_id) return null; return fxWorkspaces.find(w => w.id === agent.domain_id) ?? null`.
- `setAgentWorkspace(agentId, workspaceId)`: вместо `fxAgentWorkspace[agentId] = workspaceId` сделать `agent.domain_id = workspaceId`. `agent.updated_at = ...` — сохранить.
- В `createAgent` (строка ~360, auto-pin) — если есть chunk c `fxAgentWorkspace[id] = ...`, переписать на `agent.domain_id = ...` или удалить если `domain_id` уже передаётся в `createAgent`. Проверю при имплементации.
- Обновить комментарии: убрать «mock-only side-table», заменить на «reads `agent.domain_id` (the spec-level FK)».

Verify:
- `npm run build` — clean.
- `npm run lint` — clean.

### Шаг 3 — format.ts

Файл: `src/prototype/lib/format.ts`

Действия:
- Удалить `const DOMAIN_LABELS: Record<string, string> = { ... }` (строки 124-128).
- Удалить `export function domainLabel(...)` (строки 130-133).
- Если есть импортирующие — пройти grep'ом, заменить на:
  ```ts
  import { workspaces as fxWorkspaces } from './fixtures'
  // ...
  fxWorkspaces.find(w => w.id === agent.domain_id)?.name ?? '—'
  ```
- **Альтернатива (cleaner):** добавить новый хелпер в `format.ts`:
  ```ts
  import { workspaces as fxWorkspaces } from './fixtures'
  export function workspaceLabel(id: string | null | undefined): string {
    if (!id) return '—'
    return fxWorkspaces.find(w => w.id === id)?.name ?? '—'
  }
  ```
  Это keeps consistency с другими `*Label` функциями в файле. Использую именно этот подход.

Verify:
- Grep `domainLabel` — должно быть 0 совпадений после шага.
- `npm run build` — clean.

### Шаг 4 — UI screens

Файлы: `src/prototype/screens/AgentDetailScreen.tsx`, `src/prototype/screens/RunDetailScreen.tsx`

Действия:
- `AgentDetailScreen.tsx:14` — заменить `import ... domainLabel ... from '../lib/format'` на `workspaceLabel`.
- `AgentDetailScreen.tsx:193` (Overview stat-tile):
  ```ts
  { label: 'Workspace', value: workspaceLabel(agent.domain_id) },
  ```
- `AgentDetailScreen.tsx:467` (Settings MetaRow):
  ```tsx
  <MetaRow label="workspace" value={workspaceLabel(agent.domain_id)} />
  ```
- `RunDetailScreen.tsx`: найти аналогичное место (по progress log редизайна workspaces — около строки 214). Та же замена `domainLabel` → `workspaceLabel`, лейбл «team» → «workspace».
- `WorkspaceCard` на Settings tab уже показывает workspace через `api.getAgentWorkspace` — не трогаем (он останется работать через новую imp в api.ts).

Verify:
- Browser smoke: открыть `/agents/agt_lead_qualifier` (Overview) — stat-tile `Workspace: Growth` (вместо `Team: Sales`). Settings tab → MetaRow `workspace: Growth`. WorkspaceCard ниже показывает то же `Growth`. Ровно один источник правды.
- Открыть `/activity/run_*` — MetaRow `workspace: ...`.

### Шаг 5 — WorkspaceCard MockBadge hint

Файл: `src/prototype/screens/AgentDetailScreen.tsx`

Действия:
- В `<MockBadge>` внутри `WorkspaceCard` (~520) текущий hint: «Workspaces and agent-to-workspace assignment aren't in the backend spec yet. Moves persist for the page session only. See docs/backend-gaps.md § 1.15.»
- Новый hint: «`Agent.domain_id` есть в spec'е (это и есть workspace FK), но `PATCH /agents/{id}` пока нет — поэтому "Move to" мутирует только в-памяти. Сами workspace endpoints (`GET /workspaces`, …) тоже отсутствуют. См. docs/handoff-prep.md § 0.1 + docs/backend-gaps.md § 1.15.»
- `kind="design"` оставляем — workspace endpoints (CRUD) всё ещё отсутствуют. Меняется только текст hint'а.

### Шаг 6 — Документация

Файлы: `docs/backend-gaps.md`, `docs/agent-plans/2026-05-08-1645-workspaces-redesign.md`

Действия:
- `docs/backend-gaps.md § 1.15`: переписать. Что меняется:
  - Удалить упоминание side-table `agentWorkspace` (заменить на «`Agent.domain_id` уже в spec'е — UI использует его напрямую»).
  - Удалить «`Agent.workspace_id` тоже отсутствует» из «Что говорит spec» (теперь это **есть**, под именем `domain_id`).
  - В «Что нужно от backend (минимально)» убрать пункт «`Agent.workspace_id: string`» (есть как `domain_id`); оставить требование на `Workspace`/`Domain` schema + endpoints CRUD.
  - В footer (changelog в конце файла) добавить запись 2026-05-08 про слияние domain ≡ workspace.
- `docs/agent-plans/2026-05-08-1645-workspaces-redesign.md` progress log: дописать строку:
  ```
  - **2026-05-08 — follow-up по «Открытое (Team-stat-tile через domainLabel)»:** закрыто планом
    `docs/agent-plans/2026-05-08-1900-domain-workspace-merge.md` — backend `domain` ≡ frontend
    `workspace`. Stat-tile переименован в «Workspace», `agentWorkspace` side-table удалена.
  ```

Verify:
- Grep `agentWorkspace` в `src/` — 0 совпадений.
- Grep `domainLabel` в `src/` — 0 совпадений.
- Grep `dom_hq|dom_sales|dom_support` во всём проекте — 0 совпадений (включая фикстуры).
- `npm run build && npm run lint` — clean.

---

## 8. Verification checklist

После каждого шага:
- [ ] `npm run lint` — без новых warnings.
- [ ] `npm run build` — без ошибок (`noUnusedLocals`, `noUnusedParameters`).

После всех шагов:
- [ ] Grep `agentWorkspace` / `fxAgentWorkspace` — 0 совпадений.
- [ ] Grep `domainLabel` / `DOMAIN_LABELS` — 0 совпадений.
- [ ] Grep `dom_hq|dom_sales|dom_support` — 0 совпадений.
- [ ] AgentDetail Overview stat-tile показывает `Workspace: <name>` (не `Team: HQ/Sales/Support`).
- [ ] AgentDetail Settings MetaRow показывает `workspace: <name>` (не `team: ...`).
- [ ] RunDetail MetaRow показывает `workspace: <name>`.
- [ ] WorkspaceCard на Settings tab показывает то же значение (один источник правды).
- [ ] Move-to action на WorkspaceCard работает (мутирует `agent.domain_id`, остаётся в этом workspace до перезагрузки).
- [ ] Filter cascade работает: фильтр по workspace на `/agents`, `/approvals`, `/activity`, `/costs` корректно учитывает `agent.domain_id` (а не side-table).
- [ ] backend-gaps.md § 1.15 переписан, footer-changelog обновлён.

---

## 9. Browser testing instructions

Локальный dev: `http://localhost:5173/#/`. Демо-юзер `frontend@int3grate.ai` (Ada, admin, все 3 workspaces).

### 9.1 — AgentDetail переименование

1. Login как Ada. Открыть `/agents`.
2. Кликнуть на любой agent (например, Lead Qualifier).
3. **Overview tab:** stat-tile в сетке (3 колонки) — третья карточка должна быть `Workspace: Growth` (заглавная W). Не `Team: Sales`.
4. Перейти на **Settings tab.** В карточке Agent details: MetaRow `workspace: Growth`. Не `team: ...`.
5. Ниже — `Workspace` карточка с `current: Growth`. Все три места показывают одно и то же имя. **Ровно один источник правды.**

### 9.2 — RunDetail

1. `/activity` → кликнуть на любой run.
2. MetaRow `workspace: <name>`. Лейбл строчный «workspace».

### 9.3 — Move-to

1. AgentDetail Settings → WorkspaceCard → Move to → выбрать другой workspace.
2. Hint у MockBadge раскрывается на hover — **новый текст** про `Agent.domain_id` существует, отсутствует только `PATCH /agents/{id}`.
3. После Move: stat-tile на Overview (вернуться) обновился; Filter cascade на `/agents` отображает agent в новом workspace.

### 9.4 — Filter cascade

1. На `/agents` chip-row выбрать ровно один workspace (например, Growth).
2. Список agents отфильтрован — только agents с `domain_id === 'ws_growth'`.
3. Переключить на `Operations` — список меняется.
4. Это работает идентично pre-merge поведению, но **источник** теперь `agent.domain_id`, не side-table.

### 9.5 — Empty case

1. Если есть agent без `domain_id` (null) — он не должен показываться ни в одном workspace-фильтре. (В текущих фикстурах `agt_*` где `domain_id: null` — есть в строке 1354.)
2. На AgentDetail для такого agent'а: stat-tile `Workspace: —`. WorkspaceCard: empty-state «not assigned to a workspace».

---

## 10. Открытые вопросы — жду подтверждения до старта

1. **Id-стратегия (§ 4.1.1):** оставляю `ws_*` префикс? (yes / no)
2. **Маппинг старых dom_* → ws_* (§ 4.1.2):** предложенный 3-в-3 коллапс или per-agent ручной маппинг? (collapse / manual)
3. **`User.domain_id` (§ 4.1.3):** Ada=null, Marcelo=ws_growth, Priya=ws_ops? (yes / иначе)
4. **`domainLabel` (§ 4.1.4):** удалить и заменить на новый `workspaceLabel`? (yes / keep & rename)
5. **`backend-gaps.md § 1.15` (§ 4.1.5):** переписать в этом тикете? (yes / follow-up)
6. **vocab `roleLabel` (§ 4.2):** оставляю как есть (не часть тикета)? (confirm / делаем сразу)

Если по всем шести ОК — запускаю Шаг 1.

---

## 11. Progress log

- **2026-05-08 — план создан, документация (`handoff-prep.md § 0.1`, `backend-gaps.md § 1.15` cross-link, auto-memory) зафиксирована.**
- **2026-05-08, Шаг 1 — фикстуры.** `users[].domain_id`: Ada→null, Marcelo→ws_growth, Priya→ws_ops. Все agents: `dom_hq`→`ws_ops`, `dom_sales`→`ws_growth`, `dom_support`→`ws_ops` (~22 agents). Один ToolGrant.scope_id (`grt_domain_sales_crm`) `dom_sales`→`ws_growth` (scope_type='domain' enum остался). `agentWorkspace` side-table удалена. Комментарий блока WORKSPACES обновлён.
- **2026-05-08, Шаг 2 — api.ts + workspace-context-pill.** Импорт `fxAgentWorkspace` удалён. `inSelectedWorkspaces` / `getAgentWorkspace` / `setAgentWorkspace` / `getAgentWorkspaceMap` читают `agent.domain_id`. `createAgent` auto-pin мутирует `agent.domain_id`. `deleteWorkspace` cascade и `listWorkspaceStats.agent_count` — через `fxAgents.filter(a => a.domain_id === w.id)`. `WorkspaceContextPill` тоже переключён с side-table на `agent.domain_id`. Build+lint clean.
- **2026-05-08, Шаг 3 — format.ts.** `DOMAIN_LABELS` хардкод и `domainLabel` функция удалены. Добавлена `workspaceLabel(id)` — thin lookup в `fxWorkspaces`. Все 4 call-sites переключены: `AgentDetailScreen.tsx` (×2 — Overview tile + Settings MetaRow), `ProfileScreen.tsx` (Scope card), `RunDetailScreen.tsx` (MetaRow). Visible labels («Team»/«team») пока НЕ переименованы — это Шаг 4. Build+lint clean. Grep `domainLabel|DOMAIN_LABELS` — 0.
- **Дополнение (выявлено в Шаге 3):** `ProfileScreen` не был в исходном плане Шага 4 — там есть конфликт `Caption "Workspace" → tenantLabel(user.tenant_id)` (Acme) vs `Caption "Team" → workspaceLabel(user.domain_id)`. После Шага 4 переименования «Team»→«Workspace» получим два лейбла "Workspace" в одной карточке. Решение для Шага 4: tenant Caption → "Tenant" / "Company" (предложение); domain Caption → "Workspace".
- **2026-05-08, Шаг 4 — UI labels.** AgentDetail Overview stat-tile «Team»→«Workspace». RunDetail MetaRow «team»→«workspace». ProfileScreen: tenant Caption «Workspace»→«Tenant», domain Caption «Team»→«Workspace» (разрешён конфликт). **Дополнительный cleanup:** в AgentDetail Settings tab «Agent details» card удалена строка `MetaRow label="workspace"` — она была дубликатом отдельной `WorkspaceCard` ниже (раньше эти две сущности были разными — domain ≠ workspace; после слияния стали одной, дубль убран). Build+lint clean.
- **2026-05-08, Шаг 5 — WorkspaceCard MockBadge.** Текст hint'а переписан: `agent.domain_id` IS в spec'е (это и есть workspace FK), mock-часть — отсутствие `PATCH /agents/{id}` для move + отсутствие `Workspace` CRUD endpoints. Шапочный комментарий перед компонентом тоже обновлён (раньше говорил про side-table). `kind="design"` оставлен — Workspace CRUD endpoints всё ещё отсутствуют. Build+lint clean.
- **2026-05-08, Шаг 6 — финальная документация.** `docs/backend-gaps.md § 1.15` переписан под новую модель: явно сказано что `Agent.domain_id` есть в spec'е и работает как workspace FK; убраны упоминания side-table; «Что нужно от backend» больше не запрашивает `Agent.workspace_id` (есть как `domain_id`); добавлен список UI screens, где используется `workspaceLabel`. Footer-changelog в `backend-gaps.md` дополнен записью про merge. Cross-link добавлен в progress log редизайна workspaces (`2026-05-08-1645-workspaces-redesign.md`). Шапочный комментарий блока Workspace в `lib/types.ts` переписан с упоминания side-table на `agent.domain_id`. `training-fixtures.ts` (5 мест `dom_support` → `ws_ops`) приведён к новой системе — small maintenance fix без rebuild туров.
- **Финальный grep по чек-листу § 8:**
  - `agentWorkspace|fxAgentWorkspace` в `src/` — только локальная переменная `agentWorkspaceMap` в `SpendScreen` (отражает api `getAgentWorkspaceMap()`, не side-table). Остальное чисто.
  - `domainLabel|DOMAIN_LABELS` в `src/` — 0.
  - `dom_hq|dom_sales|dom_support` в `src/` — 0.
- **2026-05-08 — план полностью выполнен.**
