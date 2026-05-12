# Workspaces redesign — план работ

**Дата:** 2026-05-08 16:45
**Источник спеки:** `docs/plans/workspaces-redesign-spec.md`
**Тип:** реализация принятой архитектуры (active workspace × global scope filter — независимые слайсы state).
**Статус:** черновик плана. До апрува к коду не приступаем.

---

## 1. Task summary

Развести «рабочий контекст» (`activeWorkspaceId`) и «контекст просмотра» (`scopeFilter: string[]`) на два независимых state-слайса. Switcher остаётся single-active и определяет только куда уходит новый hire / Team Map. На list-экранах вводится глобальный sticky chip-row с дефолтом «All workspaces», единый между всеми экранами. Hire-форма получает явный target с локальным override без затрагивания глобального state. На регистрации auto-create первого workspace с именем `Main`. Sidebar nav пункт «Team» переименовывается в «Agents».

Полный чек-лист требований — §14 спеки. Контр-список ошибок — §15 спеки. Перечитать перед коммитом.

---

## 2. Current repository state

Подтверждено инспекцией кода (а не из памяти).

**State-слой:**
- `auth.tsx` уже single-active: `activeWorkspaceId: string | null` + `setActiveWorkspace(id)` + миграция со старых форматов (`selectedWorkspaceIds[]`, `currentWorkspaceId`). `applyActiveWorkspace` валидирует id против memberships, fallback на первый. `localStorage["proto.session.v1"]` хранит `{ token, userId, activeWorkspaceId }`.
- `lib/workspace-context.ts` уже хранит ОБА синглтона: `activeWorkspaceId` + `allUserWorkspaceIds[]`. `setAll*` вызывается из `applyActiveWorkspace`.

**API-слой:**
- `lib/api.ts:72-97` — `inSelectedWorkspaces(agentId, workspaceIds?)` уже умеет fallback: если `workspaceIds` пустой/undefined — берётся `getAllUserWorkspaceIds()` (= union по memberships). То же для `userInSelectedWorkspaces`. **Это значит api-слой уже готов к новой семантике filter==[]:** экран либо передаёт `workspace_ids: []`, либо `undefined` — оба работают как «все memberships».
- Все list-методы (`listAgents` / `listApprovals` / `listRuns` / `listAudit` / `listChats` / `getSpend` / `listHandoffs`) принимают optional `workspace_ids?: string[]`.
- Sidebar approval badge (`shell.tsx`) уже зовёт `listApprovals({ status: 'pending' })` без `workspace_ids` — поведение по спеке §9 уже верное, надо только обновить комментарий.

**UI-слой (что уйдёт):**
- `components/common/workspace-filter.tsx` — текущий per-page компонент. Принимает `value` / `onChange` от родителя. Семантика: «All» = все memberships явно, sticky-last не пускает массив в `[]`. Используется в `AgentsScreen`, `ApprovalsScreen`, `RunsScreen`, `SpendScreen` (4 экрана) и нигде больше.
- В каждом из 4 экранов: `useState<string[]>(() => activeWorkspaceId ? [activeWorkspaceId] : [])` инициализирует фильтр от active. Дефолт = active, не «all». Это меняем (§1.3 спеки).

**UI-слой (что меняется):**
- `components/workspace-switcher.tsx` — текущая шапка триггера: `name` (сверху, weight=medium) + caption «Workspace» (снизу, мелкий, uppercase). Спека просит инвертировать: caption «Working in» сверху + name снизу. Также добавить helper-text в dropdown и search при N≥10.
- `components/common/workspace-context-pill.tsx` — принимает `show` от родителя. Новая семантика спеки §4.7: `show = (filter == [] && myWorkspaces.length > 1) || filter.length > 1`. Логика остаётся в родителях (экранах) — pill сам не лезет в глобальный state.
- `screens/AgentNewScreen.tsx` — индикация target workspace отсутствует. На review-step есть строка SummaryRow «Workspace», но нет управляемого override. Текущий resolution (`template.defaultWorkspaceName` → find-or-create, иначе active) живёт в `hire()` и в `useHireTemplate.hire()`. Спека §5 просит локальный target с возможностью переопределить через `[Change]`.
- `screens/WorkspacesScreen.tsx` — empty-state есть, но без копирайта про назначение workspaces. Subtitle «Teams inside your company...» использует слово Team. Поправим под §7.1.
- `components/shell.tsx:72` — `label: 'Team', to: '/agents'`. По §1.5 переименовать в `Agents`. Все breadcrumbs `{ label: 'team', to: '/agents' }` тоже.

**Прочее:**
- `WorkspaceRemount` (`components/workspace-remount.tsx`) keying на `activeWorkspaceId`. После редизайна локального useState больше не будет — filter глобальный — поэтому ремаунт автоматически перестаёт сбрасывать filter (§10.3). Сам ремаунт оставляем, как просит §10.2.
- `register()` в `auth.tsx:183` сейчас просто кладёт `userId` в storage. Auto-create workspace отсутствует.

---

## 3. Relevant files inspected

| Файл | Что важно |
|---|---|
| `src/prototype/auth.tsx` | session migration, applyActiveWorkspace, register |
| `src/prototype/lib/workspace-context.ts` | синглтоны для api-слоя |
| `src/prototype/lib/api.ts:60-97` | `inSelectedWorkspaces` fallback |
| `src/prototype/components/workspace-switcher.tsx` | trigger label, dropdown |
| `src/prototype/components/common/workspace-filter.tsx` | per-page chip row (целевое — переписать) |
| `src/prototype/components/common/workspace-context-pill.tsx` | условие показа пилюли |
| `src/prototype/components/workspace-remount.tsx` | key keyed by active |
| `src/prototype/components/shell.tsx` | sidebar Team → Agents, approvals badge |
| `src/prototype/screens/AgentsScreen.tsx` | local filter useState |
| `src/prototype/screens/ApprovalsScreen.tsx` | local filter useState |
| `src/prototype/screens/RunsScreen.tsx` | local filter useState |
| `src/prototype/screens/SpendScreen.tsx` | local filter useState |
| `src/prototype/screens/AgentNewScreen.tsx` | target resolution + review row |
| `src/prototype/lib/use-hire-template.ts` | shared hire chain |
| `src/prototype/screens/WorkspacesScreen.tsx` | empty state copy |
| `docs/backend-gaps.md` | §1.15 надо переписать |
| `docs/ux-spec.md` | § 8 «Workspace ≠ Team» — конфликтует с §1.5 спеки (см. §6 ниже) |

---

## 4. Assumptions and uncertainties

### 4.1 — Что считаем зафиксированным

- API-слой не трогаем. `inSelectedWorkspaces` уже умеет fallback на «all memberships». Меняется только **поставщик** значения filter — раньше каждый экран свой `useState`, теперь общий хук.
- WorkspaceRemount остаётся; в этом тикете не переписываем (§10.2 спеки, follow-up §12.1).
- Sidebar approval badge уже корректен (без `workspace_ids`). Меняется только пояснительный комментарий.

### 4.2 — Открытые микро-вопросы (на твой апрув)

1. **Hire-form target × `template.defaultWorkspaceName`.** Сейчас templates с `defaultWorkspaceName` (Sales / Marketing / Reports / Finance / Operations / Customer Support) при найме либо находят workspace по имени, либо авто-создают его, **игнорируя `activeWorkspaceId`**. Спека §5.2 говорит: «Внутри hire-визарда — локальный `useState<string>(activeWorkspaceId)`. На submit — этот id передаётся в `createAgent`». Это **меняет** поведение с шаблонами: Sales-шаблон больше не создаст workspace «Sales», а уйдёт в active.
   - **Вариант A (буквальная спека):** init local target = `activeWorkspaceId`. Шаблоны теряют auto-create workspace по имени. Простая модель «куда я работаю — туда и нанимаю». Templates становятся чисто пресет-набором (имя/инструкция/grants), workspace они больше не диктуют.
   - **Вариант B (сохранить auto-create):** init local target = (template.defaultWorkspaceName ? найти/auto-создать : activeWorkspaceId). User в `[Change]` всё равно может переопределить. Поведение с шаблонами сохраняется.
   - **Моё мнение:** Вариант A проще, чище и согласован со §1.4 (active и filter — независимы; hire живёт от active). Авто-создание workspace при выборе шаблона — это магия, которую пользователь не контролирует, и она конфликтует с явной строкой `Hiring into: X`. Если шаблон Sales создаёт workspace «Sales», но пользователь в этот момент сидит в active=«Marketing», UI говорит одно, делает другое.
   - **Нужно решение пользователя.** Дальше в плане предполагаю вариант **A** (если не подтвердишь иначе).

2. **`docs/ux-spec.md` § 8 vs §1.5 спеки.** Spec говорит «Workspace ≠ Team, и поэтому sidebar-пункт = Team». Новый редизайн просит «Team → Agents в навигации». Это семантический разворот. После имплементации `docs/ux-spec.md § 8` нужно будет обновить (sidebar label сменился), и фразу «Team is reserved for the /agents sidebar label» переписать. **Это часть работы или follow-up?** Я бы сделал в этом тикете для consistency — иначе документ останется противоречивым.

3. **Re-render strategy при смене filter.** Текущий ремаунт keyed by `activeWorkspaceId`. После редизайна filter живёт в Context/синглтоне; смена filter должна заставить list-экраны re-fetch. Способы:
   - **(a)** хук `useScopeFilter()` возвращает `[filter, setFilter]` через React Context — компоненты, читающие filter, перерисовываются автоматически; в их `useEffect([filter, ...])` улетает re-fetch. Это самый прямой путь.
   - **(b)** синглтон по аналогии с `workspace-context.ts` + ручной event subscription. Сложнее, не нужно.
   - Беру вариант **(a)** — Context. Простой, идиоматичный, работает с React 19.

4. **Search в switcher (§3.5).** Нужно ли искать по `description` или только по `name`? В текущем `Workspace` schema есть `description?`. Спека пишет «по подстроке имени» — ограничусь `name`, регистронезависимо. Если пользователь хочет — расширим.

5. **Auto-create на регистрации с скрытым `/register` (§6).** Сейчас route закомментирован, кнопка «Create account» в `LoginScreen` тоже скрыта. По §6.1 auto-create должен срабатывать **после login для юзера с 0 memberships**. Это важно: в моке сценарий не воспроизводится (демо-юзеры все имеют memberships), но код-путь должен быть готов. Я положу логику в эффект `AuthProvider`, который слушает результат `listWorkspaces` после login и при `length===0` дёргает `api.createWorkspace({ name: 'Main' })`. Идемпотентность — флаг в state провайдера (не localStorage; раз в монтирование AuthProvider).

### 4.3 — Риски

- **WorkspaceContextPill props.** Сейчас `show` приходит от родителя (`workspaceFilter.length > 1`). Я могу либо (i) оставить `show` как есть и пересчитать в каждом из 4 экранов по новой формуле, либо (ii) убрать `show`, считать внутри pill через `useScopeFilter()` + `useAuth().myWorkspaces`. Вариант (ii) меньше дублирования. Но pill используется ещё в `approval-card.tsx` — там надо понять, имеет ли смысл `show` всегда в новой формуле или нужен явный override. Решение: оставлю `show` от родителя; экраны и approval-card вычисляют единообразно через новый хелпер `shouldShowWorkspacePill(filter, myWorkspaces.length)` в `lib/scope-filter.ts`. Меньше переписки.
- **Sticky-last в `[]`-семантике.** Спека §4.3 говорит: «нельзя снять последний выбранный workspace-чип, если All workspaces не активна». То есть когда filter=[wsA, wsB] и юзер кликает по wsB — toggle, filter=[wsA]. Если юзер кликает ещё раз по wsA — silent no-op (не позволяем filter=[], потому что это не «все», это «ничего». Но `[]` в новой семантике значит «все»). Точно как пишет спека: «Иначе массив станет пустым, а пустой массив означает all, что не то, что хотел пользователь». Реализую silent no-op.
  - **Альтернатива:** вместо silent no-op делать toggle на «All workspaces». Спека предписывает no-op, делаю no-op. Зафиксирую в коде комментом со ссылкой на §4.3.
- **Migration scope key (§8.4).** При первом монтировании после релиза нужно проинициализировать `proto.scope.v1` если ключа нет. Сделаю это в `useScopeFilter` provider'е через `useEffect` на первом mount, защита от повторов через ref.
- **Quick-hire grid + welcome-chat onboarding.** `useHireTemplate.hire()` — общий путь для QuickHireGrid (на /agents empty) и welcome-chat. По варианту A (см. §4.2) логика resolveWorkspace упрощается: всегда `activeWorkspaceId`. QuickHireGrid и welcome-chat не имеют UI для override — они стартуют от active. Это правильно: «one-click hire» по определению идёт в текущий контекст. Зафиксирую в комментариях.

---

## 5. Proposed approach

### 5.1 — Архитектура нового state

**Новый файл:** `src/prototype/lib/scope-filter.tsx` (TSX потому что экспортирует Provider+component)

Содержит:
- `ScopeFilterProvider` — Context Provider, гидрируется из `localStorage["proto.scope.v1"]` с валидацией `userId`. Слушает `useAuth().user` и `myWorkspaces`: при смене user сбрасывает на `[]` (если userId mismatch); при смене memberships вычищает ушедшие id.
- `useScopeFilter()` хук — возвращает `{ filter: string[], setFilter: (next: string[]) => void }`.
- `shouldShowWorkspacePill(filter, totalWorkspaces): boolean` — формула §4.7: `(filter.length === 0 && totalWorkspaces > 1) || filter.length > 1`.
- Константа `WORKSPACE_SEARCH_THRESHOLD = 10`.
- Storage key `proto.scope.v1`, формат `{ userId: string, filter: string[] }`.

Provider монтируется в `index.tsx` **внутри** `AuthProvider` (нужен `user.id`), но **вне** `WorkspaceRemount` (filter переживает remount по §10.3) и **выше** `Router`.

### 5.2 — Switcher (§3)

Файл: `components/workspace-switcher.tsx`

- Trigger layout инвертируется: caption «Working in» (size=1, gray, lowercase «in», без uppercase) сверху, name (size=2, weight=medium) снизу.
- Dropdown получает helper-text под радио-списком, перед `+ Create workspace`: `New agents will be hired into the selected workspace.` (Text size=1, color gray).
- При `myWorkspaces.length >= WORKSPACE_SEARCH_THRESHOLD` (=10) — добавляется input в верхней части dropdown, фильтрующий список по `name.toLowerCase().includes(query.trim().toLowerCase())`. Фокус на mount dropdown'а — стандартное поведение Radix.
- Поведение при клике по workspace — БЕЗ изменений (`setActiveWorkspace(id)`). **Не зовёт `setFilter`.** (§3.4 + контр-список §15).

### 5.3 — Chip-row (§4)

Файл: `components/common/workspace-filter.tsx` — переписывается полностью.

Новые props: ничего (читает `useScopeFilter()` и `useAuth().myWorkspaces` сам). Удаляет необходимость родителю прокидывать value/onChange.

Логика:
- При `myWorkspaces.length <= 1` — `return null`.
- Лейбл слева: `Showing:` (Text size=1, gray, lowercase, без uppercase letter-spacing).
- Первый чип: «All workspaces», active=`filter.length === 0`. Click → `setFilter([])`.
- Далее: чип на каждый workspace, active=`filter.includes(ws.id)`. Click logic:
  - Если сейчас `filter.length === 0` — `setFilter([ws.id])` (включается ровно этот).
  - Если `filter.includes(ws.id)` — toggle off:
    - `filter.length === 1` — silent no-op (sticky last per §4.3).
    - иначе — `setFilter(filter.filter(x => x !== ws.id))`.
  - Если не включён — `setFilter([...filter, ws.id])`.
- Стили чипов оставляю как сейчас (Radix Badge `soft`/`outline`, blue/gray) — один в один с текущим, чтобы визуальный сдвиг был только в копирайте и логике.

### 5.4 — List-экраны (§4.6)

Файлы: `AgentsScreen.tsx`, `ApprovalsScreen.tsx`, `RunsScreen.tsx`, `SpendScreen.tsx`.

В каждом:
- Удаляется локальный `useState<string[]>(...)` для workspaceFilter и его сеттер.
- Импортируется `useScopeFilter()` и `shouldShowWorkspacePill`.
- В api-вызовы передаётся `workspace_ids: filter` (filter — `string[]`; пустой массив corretly триггерит fallback в `inSelectedWorkspaces`).
- `<WorkspaceFilter ... />` рендерится без props (читает state сам).
- Логика показа `<WorkspaceContextPill show={...} />` — `show={shouldShowWorkspacePill(filter, myWorkspaces.length)}`.
- `useEffect` deps: `filter` вместо `workspaceFilter`. Re-fetch автоматически.

### 5.5 — Hire-form (§5) — вариант **A** из §4.2

Файл: `screens/AgentNewScreen.tsx`

- Локальный state `[targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(activeWorkspaceId)` — устанавливается на mount, **не следит** за изменениями `activeWorkspaceId` после монтирования (по спеке: локальный, не реагирует).
- На каждом wizard-step (welcome / name / apps / review) в шапке (под StepProgress) рендерится строка:
  ```
  Hiring into: <Name>  [Change ▾]
  ```
  Реализация: маленький DropdownMenu с радио-списком `myWorkspaces`. Click → `setTargetWorkspaceId(id)`. **Не трогает `setActiveWorkspace`.**
- При `myWorkspaces.length === 1` — `[Change]` скрывается. Просто статичная строка.
- При `targetWorkspaceId === null` (защита, по §5.3) — блокировать кнопку Hire с сообщением «Create a workspace first» + ссылка на `/workspaces`.
- В `hire()` функции: **удалить ветку `template.defaultWorkspaceName` find-or-create**. Использовать `targetWorkspaceId` напрямую: `await api.setAgentWorkspace(agent.id, targetWorkspaceId)`. ReviewStep больше не вычисляет `wsName`/`willCreateNew`/`inActiveScope` — те поля убрать; SummaryRow «Workspace» показывает имя `myWorkspaces.find(w => w.id === targetWorkspaceId)?.name`.
- Welcome screen — он показывает grid шаблонов; туда тоже добавить «Hiring into: …» в самом верху, до карточек, чтобы пользователь видел контекст ещё до выбора шаблона.

Файл: `lib/use-hire-template.ts`

- Удалить `template.defaultWorkspaceName` ветку. `targetWorkspace = await api.getWorkspace(activeWorkspaceId)` — единственный путь. Если `activeWorkspaceId === null` — error «Pick a workspace first» (как сейчас).
- Сигнатура hook остаётся: `useHireTemplate()` без аргументов. QuickHireGrid и welcome-chat не получают override (one-click — всегда в active; пользователь хочет другое — пусть идёт в полный wizard).
- `HireResult.workspaceWasCreated` теперь всегда `false` — поле удалить (или оставить как `false`, если зависимости трудно убрать). Дёрну зависимости и удалю.

Файл: `components/quick-hire-grid.tsx` — обновится автоматически по сигнатуре.

### 5.6 — Auto-create на регистрации (§6)

Файл: `src/prototype/auth.tsx`

В `useEffect`, который слушает `user` и зовёт `listWorkspaces`:
- После получения списка — если `list.items.length === 0` И флаг `autoCreatedRef.current === false`:
  - `autoCreatedRef.current = true`
  - `await api.createWorkspace({ name: 'Main', emoji: '🏠' }, user.id)`
  - повторно `listWorkspaces` или просто `setMyWorkspaces([newWs])`.
  - `applyActiveWorkspace([newWs], stored?.activeWorkspaceId)`.
- Идемпотентность: ref сбрасывается в `false` на logout.
- Failure mode: catch + лог. Не блокировать login, не падать.

`api.createWorkspace` уже принимает `(input, ownerUserId)` — добавит membership автоматически (читал имплементацию ранее в этой ветке кода).

### 5.7 — WorkspacesScreen (§7.1)

Файл: `screens/WorkspacesScreen.tsx`

- В `<PageHeader subtitle>` или сразу под header'ом (до MockBadge и до grid'а) — блок helper-text:
  ```
  Use workspaces to group agents by department, client, location, or business line.
  Examples: Sales, Customer Support, Acme Corp, EU Operations.
  ```
- Стиль: `Text size="2" color="gray"`, без drama, без bold, в `Box mb="4"`.
- Subtitle `PageHeader` упростить (сейчас «Teams inside your company. Each holds...» — Team там — вокабулярная грязь).

### 5.8 — Sidebar Team → Agents (§1.5)

Файл: `components/shell.tsx`

- `label: 'Team'` → `label: 'Agents'` для key='assistants'.

Все breadcrumbs `{ label: 'team', to: '/agents' }` в screens (`AgentNewScreen`, `AgentsScreen`, `AgentDetailScreen`, и т.д.) — → `{ label: 'agents', to: '/agents' }`. Обновлю grep'ом, проверю каждое вхождение визуально (есть ли «back to team» CTA на NoAccessState — там тоже).

### 5.9 — WorkspaceContextPill (§4.7)

Файл: `components/common/workspace-context-pill.tsx`

- Логика показа остаётся в родителе через prop `show`. Родитель вычисляет через `shouldShowWorkspacePill(filter, myWorkspaces.length)` (импорт из `lib/scope-filter`).
- Внутри pill — никаких изменений.

### 5.10 — Sidebar approvals badge (§9)

Файл: `components/shell.tsx`

- Обновить комментарий: «counts ALL pending across user's memberships, no `workspace_ids` passed — соответствует общему дефолту filter=[]».
- Поведение не меняется.

### 5.11 — WorkspaceRemount (§10)

Файл: `components/workspace-remount.tsx`

- Не меняем. Обновляю комментарий: «filter scope живёт в `useScopeFilter` Context'е, **выше** этого ремаунта в дереве — ремаунт его НЕ сбрасывает (по дизайну: смена active не трогает filter, §2.3)».
- Проверю, что в коде нигде нет «при смене active сбрось filter» — должно отсутствовать, так как локальный useState уйдёт.

### 5.12 — Migration (§8.4)

В `ScopeFilterProvider`:
- При первом mount: `localStorage.getItem("proto.scope.v1")`. Если null — записать `{ userId: user.id, filter: [] }`. Если есть, но `userId !== user.id` — игнорировать значение, начать с `[]`, перезаписать с правильным `userId`.

### 5.13 — backend-gaps.md (§11)

Файл: `docs/backend-gaps.md`

В §1.15 переписать под новую модель:
- Single-active switcher + global scope filter — это два независимых клиентских слайса.
- Backend знает только про single-active (через `Workspace.workspace_id` на агентах) и `?workspace_ids[]=...` filter param.
- Auto-create on register — серверная альтернатива описана.
- Search support — упомянуть pagination/filter by name на `GET /workspaces`.
- Удалить устаревшие куски про multi-active filter, оставить только новую модель.

Last-updated bump.

---

## 6. Risks and trade-offs

| Риск | Mitigation |
|---|---|
| Шаблоны теряют auto-create workspace по имени (вариант A в §4.2) | Это поведенческий сдвиг. Есть аргумент что «Sales template = ярлык workspace», но он скрытый и конфликтует с новым явным `Hiring into: X`. Документирую в spec комментом, обновлю reviewstep копирайт. **Жду подтверждения варианта.** |
| `docs/ux-spec.md` § 8 противоречит §1.5 нового спека | Обновляю ux-spec.md в этом же тикете, иначе документация тонет. Помечу пункт в commit message. |
| Sticky-last no-op кажется неинтуитивным | Это конкретное предписание спеки §4.3. Если по ходу вёрстки понимаю, что лучше autoroute на «All», — пинг с micro-decision до коммита. |
| Auto-create workspace может race'ить с listWorkspaces при двойном mount | Защита через ref + early-return из эффекта. Стандартный паттерн. |
| Search в switcher (N≥10) — никто из демо-юзеров не имеет 10+ workspaces | Зашью feature, проверю руками, добавив фикстурно нескольких workspaces для одного demo-юзера на время разработки. Перед merge — откатить фикстуры. |
| Filter persists между сессиями user A → user B на одном устройстве (демо-логин) | `userId` в payload `proto.scope.v1` — пресекает протекание. Тест-кейс в browser-verification (§9). |
| Нагрузка работы — большая, шанс попутно сломать что-то | Разбиваю на 11 шагов (§7) с явными контрольными точками. После каждого: lint + visual smoke на затронутом экране. Отдельный шаг — финальный `npm run build` + ручной обход всех 4 list-экранов + hire-flow. |

---

## 7. Step-by-step implementation plan

Каждый шаг — атомарный коммит-кандидат. Не переходим к следующему до подтверждения.

1. **`lib/scope-filter.tsx` + Provider в index.tsx.** Создать новый файл с Context, Provider, хук, хелпер `shouldShowWorkspacePill`, константу `WORKSPACE_SEARCH_THRESHOLD`. Смонтировать `<ScopeFilterProvider>` в index.tsx **внутри AuthProvider, выше WorkspaceRemount**. Без потребителей пока. Smoke: `npm run build` чистый.

2. **WorkspaceContextPill — без изменений по логике**, но добавить экспорт `shouldShowWorkspacePill` из `lib/scope-filter` в barrel `components/common.tsx`. Обновить комментарий в pill.

3. **Chip-row переписан.** `components/common/workspace-filter.tsx` использует `useScopeFilter`, удаляет props `value`/`onChange`. Лейбл «Showing:», «All workspaces» как первый чип, новая click-логика, sticky-last no-op. Скрыт при N≤1. Smoke: build чистый, экраны пока не подключены — компонент не рендерит ничего значимого, потому что родители ещё не знают про новый API. Поэтому в этом же шаге обновить **временный** placeholder-родитель (или сразу мигрировать AgentsScreen — см. шаг 4).

   *Решение:* шаги 3 и 4 объединить — `WorkspaceFilter` без props сразу подключается в AgentsScreen, иначе шаг 3 ломает компиляцию.

4. **AgentsScreen → useScopeFilter.** Удалить локальный useState, чип-row рендерится без props, api-вызовы получают `workspace_ids: filter`, контекст-пилюля через `shouldShowWorkspacePill`. Browser smoke: открыть `/agents`, переключить чипы, навигировать на `/approvals`, вернуться — filter sticky. Открыть DevTools Application → localStorage — ключ `proto.scope.v1` существует и обновляется.

5. **ApprovalsScreen → useScopeFilter.** Аналогично шагу 4. Пилюля в строке approval.

6. **RunsScreen + SpendScreen → useScopeFilter.** Аналогично.

7. **Switcher (§3).** Trigger layout инвертирован, caption «Working in», dropdown helper-text, search при N≥10. Browser smoke: переключение active не трогает filter (открыть /agents, выбрать filter=[wsA], переключить active в switcher на wsB, остаться на /agents — filter всё ещё [wsA]).

8. **Hire-form (§5).** Локальный target, Hiring-into header на каждом step, удаление `template.defaultWorkspaceName` ветки в `AgentNewScreen.hire()` и в `useHireTemplate.hire()`. ReviewStep копирайт упростить. Browser smoke: hire flow от welcome → success в active=ws_ops; затем сменить через [Change] на ws_marketing — agent появляется в ws_marketing, active не сменился. Quick-hire grid и welcome-chat — hire идёт в active.

9. **Auto-create на регистрации (§6).** Эффект в AuthProvider после listWorkspaces. Smoke: вручную в DevTools `localStorage.removeItem('proto.session.v1')` и одновременно очистить мок-фикстуры workspaces для текущего user — после login создаётся «Main». В реальности невоспроизводимо штатным путём, поэтому — manual fixture poke + verification.

10. **WorkspacesScreen (§7.1) + Sidebar Team→Agents (§1.5) + breadcrumbs cleanup.** Helper-text над grid'ом, subtitle очищен. Sidebar `label: 'Team'` → `'Agents'`, breadcrumbs `team` → `agents` всюду. Visual sweep по всем затронутым экранам.

11. **`docs/backend-gaps.md` §1.15 + `docs/ux-spec.md` § 8 update + cleanup.** Финальный review кода: grep по «setActiveWorkspace.*setFilter» / «setFilter.*setActiveWorkspace» — должно быть пусто. `npm run lint && npm run build` чисто. Прохожу по чек-листу спеки §14 + контр-список §15.

---

## 8. Verification checklist

После каждого шага:
- [ ] `npm run lint` — без новых warnings.
- [ ] `npm run build` — без ошибок (`noUnusedLocals`, `noUnusedParameters`).

После всех шагов:
- [ ] Чек-лист §14 спеки — каждая галочка подтверждена.
- [ ] Контр-список §15 спеки — каждая ❌ проверена и не воспроизводится.
- [ ] Grep `setActiveWorkspace` — не вызывается рядом с `setFilter`.
- [ ] Grep `\bTeam\b` в sidebar и breadcrumbs — заменено на `Agents`.
- [ ] localStorage ключи: `proto.session.v1` (с `activeWorkspaceId`), `proto.scope.v1` (с `userId`+`filter`). Старые поля не появляются.

---

## 9. Browser testing instructions

Локальный dev-сервер: `http://localhost:5173/#/`. Демо-юзер `frontend@int3grate.ai` пароль `demo`.

### 9.1 — Switcher × filter independence

1. Login как Ada. Открыть `/agents`.
2. В switcher (sidebar) — текущий active workspace должен быть caption=«Working in» сверху, name снизу.
3. В chip-row сверху списка agents: «Showing: [All workspaces ✓] [<ws1>] [<ws2>] …». Дефолт — «All workspaces» подсвечена.
4. Кликнуть `[<ws1>]` — список сужается до агентов из ws1, контекст-пилюля у строк скрывается.
5. Кликнуть `[<ws2>]` — toggle add, теперь filter=[ws1, ws2]. Пилюля «in <ws_name>» появляется у каждой строки.
6. Кликнуть `[All workspaces]` — filter=[]; пилюля у строк появляется (если memberships >1).
7. В switcher переключить active на другой workspace — filter chip-row **не меняется**.
8. Перейти на `/approvals` — chip-row показывает то же значение filter (sticky глобально).
9. Refresh страницы — filter сохранён (через localStorage).

### 9.2 — User isolation (proto.scope.v1.userId)

1. Logout, login как Marcelo.
2. На `/agents` — filter сброшен в «All workspaces» (так как `userId` в storage не совпал).

### 9.3 — Hire flow target override

1. Active workspace = ws_ops.
2. `/agents/new` → Welcome step. Сверху строка `Hiring into: ops [Change]`.
3. Выбрать Sales шаблон → Name step. Шапка `Hiring into: ops [Change]`.
4. `[Change]` → выбрать ws_marketing.
5. Continue → Apps → Review. На каждом — `Hiring into: marketing [Change]`.
6. Hire. Success-page и далее `/agents/:id` — agent в ws_marketing.
7. Switcher (sidebar) — active всё ещё ws_ops.

### 9.4 — Sticky-last no-op (§4.3)

1. На `/agents` chip-row, выбрать filter=[ws1] (один чип). Кликнуть по ws1 ещё раз. **Чип НЕ снимается** (silent no-op). filter=[] не наступает.

### 9.5 — Single-workspace user (§4.4 / §3.6)

1. Если у user'а 1 workspace — chip-row не рендерится.
2. Switcher — рендерится, dropdown работает (только одна строка + Create + Manage).

### 9.6 — Switcher search (§3.5)

1. Заштриховать в фикстурах: добавить временно 11+ workspaces для Ada. Login.
2. Switcher dropdown — input search в верхней части. Ввод фильтрует список.
3. Откатить фикстуры до commit'а.

### 9.7 — Sidebar approvals badge

1. Filter на /approvals = [ws1] (один). На sidebar approvals-пункте — badge число такое же, как раньше? Должно быть всё ещё ALL pending (поверх всех memberships, не только filter).

### 9.8 — Sidebar nav label

1. Sidebar item «Agents» (не «Team»). Breadcrumbs во всех routes — `agents`.

---

## 10. Открытые вопросы — жду подтверждения до старта

1. **Hire-form × `template.defaultWorkspaceName` — вариант A или B?** (см. §4.2.1). Я выбрал A. Подтверди или возрази.
2. **`docs/ux-spec.md § 8` обновлять в этом тикете?** Я выбрал — да. Подтверди.
3. **Можно ли временно добавить 11 workspaces в фикстуры для теста search в switcher (§9.6)?** Откатим перед коммитом. Я выбрал — да.

Если по всем трём ОК — запускаю шаг 1.

---

## 11. Progress log

- **2026-05-08 16:45** — план создан.
- **2026-05-08, шаг 1** — `lib/scope-filter.tsx` создан (Provider, `useScopeFilter`, `shouldShowWorkspacePill`, `WORKSPACE_SEARCH_THRESHOLD`). Provider смонтирован в `index.tsx` внутри AuthProvider, выше WorkspaceRemount. Persist в `localStorage["proto.scope.v1"]` с `userId` tag. Lint+build чисто.
- **2026-05-08, шаги 3-6** — `workspace-filter.tsx` переписан под `useScopeFilter` (props убраны, лейбл «Showing:», чип «All workspaces» как первый, sticky-last). 4 list-экрана (`AgentsScreen`, `ApprovalsScreen`, `RunsScreen`, `SpendScreen`) переключены на хук. `SpendScreen` by-workspace breakdown теперь учитывает «All workspaces» через `shouldShowWorkspacePill`. Lint+build чисто.
- **2026-05-08, шаг 7** — Switcher: caption «Working in» сверху, name снизу; helper-text про hire под радио-списком; search input при N≥10; никаких setFilter рядом с setActiveWorkspace. Lint+build чисто.
- **2026-05-08, шаги 8 и 8.5** — Hire-form: локальный `targetWorkspaceId`, `HiringIntoHeader` на welcome + всех wizard-step, Banner+disable Hire при null target, ReviewStep упрощён (удалены wsName/willCreateNew/inActiveScope). Удалена ветка `template.defaultWorkspaceName` find-or-create в `AgentNewScreen.hire()` и в `useHireTemplate.hire()` — quick-hire теперь всегда в active. Удалено поле `HireResult.workspaceWasCreated` + связанные ветки в welcome-chat-flow и quick-hire-grid copy. Breadcrumbs `team`→`agents` в AgentNewScreen (5 мест). Lint+build чисто.
- **2026-05-08, шаг 9** — Auto-create на login: эффект в `AuthProvider` после `listWorkspaces`, при `length===0` зовёт `api.createWorkspace({ name: 'Main' }, userId)`. Idempotency через `autoCreatedForUserRef`. Failure non-fatal. Lint+build чисто.
- **2026-05-08, шаг 10** — Sidebar nav «Team» → «Agents» (`shell.tsx`). Breadcrumbs `team`→`agents` в `AgentDetailScreen` (3), `AgentsScreen` (1), `ChatNewScreen` (1). Approvals badge комментарий обновлён под §9. WorkspacesScreen helper-text над grid'ом. WorkspaceRemount комментарий обновлён под §10.3. Lint+build чисто.
- **2026-05-08, шаг 11** — `docs/backend-gaps.md § 1.15` переписан под новую модель (active/filter split, auto-create на login, search support упомянут, sync через preferences out-of-scope). `docs/ux-spec.md § 4.1` и § 8 обновлены: sidebar = Agents, «Team» свободен под marketing-копию. Финальный grep по контр-списку §15 — чисто. `Agent.workspace_id` отсутствует (как требует §15); `WorkspaceMembership.workspace_id` и `Handoff.workspace_id` (denormalised, mock-only) — это другие сущности, false-positive grep'а.
- **Открытое:** `MetaRow label="Team" value={domainLabel(...)}` в `AgentDetailScreen.tsx:193` и `RunDetailScreen.tsx:214` — это бизнес-уровневая метка департамента (Sales/Support/HQ), не nav. По спеке §1.5 «Team» свободен под не-nav контексты. Оставил без изменений; если потребуется — отдельный микро-тикет на «Department».
  - **2026-05-08 follow-up — закрыто:** оказалось, не department, а тот же workspace. Принят architectural decision domain ≡ workspace (`docs/handoff-prep.md § 0.1`). Stat-tile + MetaRow переименованы в «Workspace», `domainLabel`/`DOMAIN_LABELS` удалены, side-table `agentWorkspace` удалена. План: `docs/agent-plans/2026-05-08-1900-domain-workspace-merge.md`.
- **Чек-лист §14 — все галочки закрыты:**
  - [x] active workspace и scope filter — независимы (§2). Проверено grep'ом по `setActiveWorkspace.*setFilter`/`setFilter.*setActiveWorkspace` — нет совпадений.
  - [x] Глобальный `useScopeFilter` — `lib/scope-filter.tsx`.
  - [x] `localStorage["proto.scope.v1"]` с валидацией `userId` — `readStoredScope`.
  - [x] Switcher caption «Working in».
  - [x] Switcher helper-text про hire.
  - [x] Switcher search при N≥10.
  - [x] Chip-row подпись «Showing:».
  - [x] Чип «All workspaces» с `[]` семантикой.
  - [x] Sticky-last (silent no-op).
  - [x] Chip-row скрыт при N≤1.
  - [x] Локальный `useState` filter — удалён.
  - [x] Все 4 list-экрана дефолтятся в `[]`.
  - [x] Hire-form: «Hiring into: X [Change]» с локальным target.
  - [x] Auto-create `Main` на login (через client-side `POST /workspaces`).
  - [x] Empty state copy на `/workspaces`.
  - [x] Filter валидация при изменении memberships (`useEffect` в `ScopeFilterProvider`).
  - [x] Migration: при первом mount без `proto.scope.v1` — инициализация в `[]` через `userId === user.id` mismatch path.
  - [x] WorkspaceRemount не сбрасывает filter (Provider выше в дереве).
  - [x] Approvals badge комментарий обновлён.
  - [x] `docs/backend-gaps.md` §1.15 обновлён.
  - [x] `WorkspaceContextPill`: правило показа учитывает новый filter (`shouldShowWorkspacePill`).
- **2026-05-08 — план полностью выполнен.**
