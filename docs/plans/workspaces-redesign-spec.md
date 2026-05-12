# Workspaces — редизайн scope-модели и UI

Документ для агента, работающего внутри проекта Int3grate. Контекст продукта и устройство кода у тебя уже есть. Этот файл — **спецификация изменений**, которые нужно внести в текущую модель workspaces. Архитектурные решения уже приняты после внешнего обсуждения, твоя задача — составить план работ и реализовать.

Документ парный к `app-and-workspaces-overview.md` (текущее состояние) и к `docs/backend-gaps.md` (контракт с бэкендом). Все номера разделов и ссылки на файлы ниже соответствуют текущему коду.

---

## 0. Что от тебя нужно

1. Прочитать этот документ целиком, **не приступая к коду**.
2. Сверить требования с текущим кодом (`auth.tsx`, `workspace-switcher.tsx`, `workspace-filter.tsx`, `workspace-context-pill.tsx`, `WorkspacesScreen.tsx`, `lib/api.ts`, `lib/workspace-context.ts`, `screens/*`).
3. **Составить план работ** — декомпозировать в конкретные задачи с привязкой к файлам, указать порядок, отметить риски и места, где нужно будет принять микро-решения по ходу. План отдать на ревью **до** начала имплементации.
4. После апрува плана — реализовать.
5. Обновить `docs/backend-gaps.md` соответствующими изменениями (раздел про Workspace расширится, см. §11).

Пиши план в `docs/agent-plans/{дата}-{время}-workspaces-redesign.md` в стиле существующих плановых документов в этой папке.

---

## 1. Принятые архитектурные решения (контекст для тебя)

Это краткая выжимка решений, которые повлияли на требования ниже. Полное обсуждение есть в истории, тебе нужны факты и причины:

**1.1.** Single-active в глобальном switcher — **сохраняем**. Multi-active не возвращаем, не обсуждаем.

**1.2.** Switcher переключает только **«рабочий контекст»** — куда уходит новый hire и что показывает Team Map. Он **больше не определяет, что пользователь видит на list-экранах**. Это ключевой сдвиг семантики.

**1.3.** На list-экранах вводится **глобальный sticky фильтр scope** — единый ключ для всех четырёх экранов (`/agents`, `/activity`, `/approvals`, `/costs`). Дефолт — **all workspaces**. Sticky между визитами через `localStorage`.

**1.4.** Active workspace и глобальный filter — **независимы друг от друга**. Смена active в switcher не трогает filter и наоборот. Это важно: мы намеренно разводим «контекст действия» и «контекст просмотра», и склеивать их обратно нельзя ни в одной точке UI.

**1.5.** Терминология: пункт сайдбара **«Team» переименовывается в «Agents»**. Слово «Workspace» в UI **остаётся**. Слово «Team» освобождается под маркетинговую/onboarding-копирайт-метафору «digital team», но в навигации больше не используется.

**1.6.** На регистрации **auto-create первого workspace** с именем `Main`. Empty state «у пользователя 0 workspaces» больше не достижим штатным путём (только через ручное удаление последнего).

**1.7.** Switcher с N=1 workspace остаётся **полнофункциональным дропдауном**, не упрощается. Не скрывается.

**1.8.** Approvals остаётся существующим экраном `/approvals`. Дефолт фильтра = all (как и у остальных list-экранов). Глобальный sidebar approvals badge продолжает считать union по всем memberships — это согласуется с новым дефолтом.

**1.9.** Persisting фильтра — **только `localStorage`, без URL query param**. Shareable ссылки сейчас не нужны.

**1.10.** Плавный transition вместо `WorkspaceRemount` — **не в этой работе**. Текущий ремаунт сохраняется, оформляется как follow-up в §12.

---

## 2. Новая модель state — точные определения

### 2.1. Active workspace

`activeWorkspaceId: string | null` — **«рабочий контекст»**.

Влияет только на:

- Дефолт target в hire-form (`/agents/new`).
- Контекст, в котором рендерится Team Map / Team Bridge sandbox.
- `WorkspaceRemount` keying (остаётся, см. §10).
- Дефолт workspace для `createAgent` API (safety net в `lib/api.ts`).

**Не** влияет на:

- Содержимое list-экранов (`/agents`, `/activity`, `/approvals`, `/costs`).
- Sidebar approvals badge.
- Глобальный фильтр scope.

Persistence: `localStorage["proto.session.v1"].activeWorkspaceId` (как сейчас).

### 2.2. Глобальный scope filter

Новая сущность. Один на всё приложение, **общий между всеми list-экранами**.

```ts
// Тип значения
type ScopeFilter = string[]  // workspace IDs; пустой массив = "all"
```

Семантика:

- `[]` (пустой массив) = **all workspaces** = union по всем memberships пользователя. Это дефолт.
- `[wsId, wsId, ...]` = конкретный sub-set workspaces, выбранный пользователем.

Persistence: новый ключ `localStorage["proto.scope.v1"]`. Формат:

```json
{ "userId": "user-123", "filter": ["ws-sales", "ws-marketing"] }
```

`userId` нужен, чтобы при смене юзера на этом же устройстве (демо-логин Ada → Marcelo) старый фильтр не «протёк» в чужой scope. При несовпадении `userId` — игнорируется, дефолт `[]`.

### 2.3. Связь между active и filter

**Их нет.** Это два независимых слайса state.

- Смена active в switcher: filter **не трогается**.
- Изменение filter в chip-row: active **не трогается**.
- Удаление workspace, который был и в active, и в filter:
  - Active валидируется как сейчас (берётся первый из оставшихся memberships).
  - Filter: удалённый workspace вычищается из массива. Если массив стал пустым из-за этого — он остаётся пустым, что означает «all», что корректно.

### 2.4. Per-page локальный filter (текущий `workspace-filter.tsx`) — **удаляется**

Нынешний `useState<string[]>` внутри каждого list-экрана убирается. Filter теперь живёт в одном месте — глобальном слайсе. См. §4.

---

## 3. Switcher (sidebar)

`components/workspace-switcher.tsx`

### 3.1. Подпись триггера

Было: имя workspace + caption «Workspace».

Стало: подпись **«Working in»** (caption, мелким шрифтом сверху) + имя workspace (основной текст).

Точная копирайт-формулировка для caption: `Working in` (английский, lowercase «in»). Локализация — отдельная история, сейчас просто английский.

### 3.2. Dropdown — содержимое

Без изменений по сравнению с текущим:

- Радио-список `myWorkspaces` (галочка у активного).
- Separator.
- `+ Create workspace` (открывает `WorkspaceFormDialog`).
- `Manage workspaces` (навигация на `/workspaces`).
- `MockBadge kind="design"` внизу.

### 3.3. Dropdown — добавить пояснительную копирайт-метку

Под радио-списком, до separator перед `+ Create workspace`:

```
New agents will be hired into the selected workspace.
```

Текст мелкий, secondary color, `Text size="1"` (Radix). Это снимает класс вопросов «что вообще делает этот переключатель».

### 3.4. Поведение при клике на workspace в dropdown

Без изменений: `setActiveWorkspace(id)` — пишет в auth state + синглтон + localStorage. **Filter scope не трогается.** Это критично — если случайно зацепится `setScopeFilter`, нарушится §2.3.

### 3.5. Поиск в dropdown при N≥10

Когда у пользователя **10 или больше** memberships, в верхней части dropdown появляется поле поиска (input), фильтрующее радио-список по подстроке имени workspace. При N<10 поиска нет.

Граница 10 — эвристика, не критичная. Если хочется — вынеси в константу `WORKSPACE_SEARCH_THRESHOLD`.

### 3.6. N=1 — швыряем без изменений

Когда у юзера ровно один workspace, switcher остаётся полным дропдауном (триггер + список из одного пункта + Create + Manage). Не скрываем, не упрощаем. Это решение принято осознанно ради discoverability фичи.

---

## 4. Глобальный scope filter — UI

### 4.1. Где живёт chip-row

На каждом из четырёх list-экранов: `/agents`, `/activity`, `/approvals`, `/costs`. Размещение и стилистика — как у текущего `workspace-filter.tsx`.

### 4.2. Подпись chip-row

Было: «Workspace filter» (или эквивалент).

Стало: **«Showing:»** перед чипами. Например: `Showing: [All workspaces ✓] [Sales] [Marketing]`.

### 4.3. Состав чипов

- Первый чип — **«All workspaces»**. Соответствует значению filter `[]`.
- Далее — по чипу на каждый workspace из `myWorkspaces`.

Поведение:

- Клик на «All workspaces» → `setScopeFilter([])`. Все остальные чипы становятся неактивными.
- Клик на конкретный workspace-чип:
  - Если сейчас активна «All workspaces» (filter == `[]`) — активируется только этот workspace, filter становится `[wsId]`.
  - Если уже выбран какой-то sub-set — toggle этого wsId внутри массива.
- **Sticky last:** нельзя снять последний выбранный workspace-чип, если «All workspaces» не активна. Иначе массив станет пустым, а пустой массив означает «all», что не то, что хотел пользователь. Silent no-op (тот же паттерн, что в текущей реализации).

### 4.4. Скрытие chip-row при N≤1

Если у пользователя 0 или 1 workspace — chip-row не рендерится вообще. Нечего фильтровать.

### 4.5. Источник данных

Новый кастомный хук `useScopeFilter()` — единая точка чтения и записи глобального scope. Возвращает `{ filter: string[], setFilter: (f: string[]) => void }`.

Реализация — на твоё усмотрение (Context, Zustand, синглтон по аналогии с `workspace-context.ts` — что лучше ложится в существующий код). Главное:

- Один источник правды на всё приложение.
- При записи — синхронно обновлять `localStorage["proto.scope.v1"]`.
- При чтении на старте — гидрироваться из `localStorage`, валидируя `userId`.

### 4.6. Source of truth для api-слоя

`lib/api.ts` функция `inSelectedWorkspaces` (lines 72-97) сейчас принимает параметр `workspaceIds?` и фолбэкается на «все memberships юзера», если параметр пуст.

Адаптировать так:

- Каждый list-экран в свой `api.list*` вызов передаёт **актуальное значение глобального filter**, прочитанное из `useScopeFilter`.
- Если filter `[]` — экран **не передаёт** `workspace_ids` в api (или передаёт `undefined`). Существующий fallback в `inSelectedWorkspaces` сделает union по memberships — это и есть «all».
- Если filter `[wsId, ...]` — экран передаёт его как `workspace_ids: [...]`.

То есть логика filter cascade в api **не меняется**. Меняется только **кто** даёт ей значение: раньше — локальный `useState` каждого экрана, теперь — глобальный хук.

### 4.7. WorkspaceContextPill — без изменений по логике

`components/common/workspace-context-pill.tsx` показывается по правилу `show={workspaceFilter.length > 1}` или (новое) `show={filter == [] && myWorkspaces.length > 1}`.

То есть пилюля «in {Workspace}» рядом с item-ом видна, когда:

- Активна «All workspaces» и у юзера >1 workspace, ИЛИ
- В filter явно >1 workspace выбран.

Если выбран ровно один workspace — пилюля скрыта, и так понятно где мы.

---

## 5. Hire flow

`screens/AgentNewScreen.tsx` (или соответствующий файл hire-визарда).

### 5.1. Явная индикация target workspace

В верхней части формы hire (на каждом шаге визарда, шапка) — отчётливая строка:

```
Hiring into: {ActiveWorkspaceName}  [Change]
```

`[Change]` — кликабельная ссылка/кнопка, которая открывает inline-селектор (Radix DropdownMenu или Select) со списком `myWorkspaces`. Клик по варианту:

- **Локально для этой формы** меняет target workspace для будущего hire.
- **Не трогает глобальный active** в switcher.

То есть в hire-flow появляется **локальный** target, по умолчанию равный глобальному active. Пользователь может его переопределить для конкретного найма, и это не повлияет на глобальное состояние.

### 5.2. Реализация target

Внутри hire-визарда — локальный `useState<string>(activeWorkspaceId)`. На submit — этот id передаётся в `createAgent` + `setAgentWorkspace`.

### 5.3. Если у юзера 0 workspaces

Невозможный кейс по §2 (auto-create на регистрации гарантирует хотя бы один). Но защитный guard оставить: если каким-то образом `activeWorkspaceId == null` — hire-форма блокируется с сообщением «Create a workspace first» и кнопкой на `/workspaces`.

### 5.4. Если у юзера 1 workspace

`[Change]` ссылка скрывается — менять не на что. Просто статичная строка `Hiring into: Main`.

---

## 6. Onboarding — auto-create первого workspace

### 6.1. Когда срабатывает

При первом успешном `POST /auth/login` для пользователя, у которого `myWorkspaces.length === 0` после `GET /me` — клиент инициирует создание workspace.

В моке: после `GET /me` проверяется длина memberships, и если 0 — вызывается мок-эквивалент `POST /workspaces` с дефолтным телом (см. §6.2).

### 6.2. Дефолтное содержимое

```ts
{
  name: "Main",
  description: "",     // пустое
  emoji: "🏠"          // или любой нейтральный, на твоё усмотрение
}
```

### 6.3. Идемпотентность

Если auto-create уже сработал в этой сессии (флаг в session state), повторно не вызывать. Защита от race conditions при параллельных монтированиях провайдеров.

### 6.4. Failure mode

Если auto-create не удался (в реальном API будет могло) — UI показывает ошибку, но **не блокирует логин**. Пользователь попадает на `/agents` с empty state, может создать workspace вручную через switcher → `+ Create workspace`. Сейчас в моке fail-сценарий не нужен, но в коде учти, чтобы потом было куда расти.

### 6.5. Демо-юзеры

Демо-логины (Ada, Marcelo, Priya) уже имеют memberships в фикстурах. Auto-create для них не сработает (length > 0). Это правильно, ничего менять не нужно.

---

## 7. WorkspacesScreen (`/workspaces`)

`screens/WorkspacesScreen.tsx`

### 7.1. Empty state — копирайт

В empty state (когда у юзера 0 workspaces — невозможный кейс по §6, но guard для consistency) и/или в верхней части screen как helper text:

```
Use workspaces to group agents by department, client, location, or business line.
Examples: Sales, Customer Support, Acme Corp, EU Operations.
```

Размещение: блок с пояснением **над** card-grid, до списка. Стиль — secondary text, не bold, не drama.

### 7.2. Остальное поведение — без изменений

- Card-grid: emoji + имя + описание + counts + created-at.
- Active бейдж на текущем, Switch на остальных.
- Edit / Delete (с type-the-name confirm).
- Members read-only снизу с MockBadge.

### 7.3. Last-workspace delete guard

Сейчас: «Если у юзера ровно один workspace — кнопка Delete заблокирована».

Оставить. С учётом auto-create на регистрации это правило никогда не вынудит юзера в zero-workspace state, что хорошо.

---

## 8. Active workspace — поведение при сменах

### 8.1. Active валидация

В `applyActiveWorkspace` (auth.tsx) логика без изменений: stored id → проверить что в memberships → fallback на первый.

### 8.2. Filter не валидируется через active

В `applyActiveWorkspace` **не трогать** scope filter. Filter валидируется отдельно, см. §8.3.

### 8.3. Filter валидация при смене memberships

При любом изменении `myWorkspaces` (login, create, delete, refresh):

- Прочитать текущий `filter` из `useScopeFilter`.
- Отфильтровать массив, оставив только id, которые есть в новых `myWorkspaces`.
- Если результат отличается от исходного — записать обратно через `setFilter`.
- Пустой результирующий массив остаётся пустым (= «all»), это валидное состояние.

### 8.4. Migration старых сессий

В `readStoredSession` уже есть две миграции:
- `selectedWorkspaceIds` (старый multi-active) → берётся первый id как новый active.
- `currentWorkspaceId` → переименование в `activeWorkspaceId`.

Добавить третью: при первой загрузке после релиза — если `localStorage["proto.scope.v1"]` отсутствует, инициализировать его как `{ userId: <текущий>, filter: [] }`. Существующие пользователи увидят «All workspaces» как дефолт, что соответствует новой модели.

---

## 9. Sidebar approvals badge

`components/shell.tsx` или где сейчас живёт логика badge.

### 9.1. Поведение — без изменений

Badge продолжает считать `api.listApprovals({ status: 'pending' })` **без передачи `workspace_ids`** — fallback в api делает union по memberships.

### 9.2. Согласованность

Это поведение теперь согласуется с новым дефолтом list-экранов («все по умолчанию»), а не является исключением. В коде комментарий «exception для cross-workspace visibility» можно убрать или переписать на «соответствует общему дефолту».

---

## 10. WorkspaceRemount

`components/workspace-remount.tsx`

### 10.1. Текущее поведение

Wrapper с `display: contents`, key = `activeWorkspaceId`. При смене active всё дерево страниц размонтируется.

### 10.2. В этой работе — оставляем как есть

Не переделываем. Технический долг зафиксирован в §12.

### 10.3. Что с filter scope при ремаунте

Текущий ремаунт сбрасывает локальный `useState` на list-экранах (что и было его смыслом). После редизайна локального useState больше нет — filter глобальный и persisted в `localStorage`. Поэтому ремаунт **не сбрасывает filter**, что и нужно по §2.3 (active меняется → filter остаётся).

Проверь, что нигде в коде нет «при смене active сбрось filter» эффекта. Если будет — удали.

---

## 11. Что попадает в backend-gaps.md

Раздел «§ 1.15 Workspaces» в `docs/backend-gaps.md` дополни/перепиши с учётом следующего:

### 11.1. Минимальный набор — без изменений

- `Workspace` schema, `Membership` schema.
- CRUD endpoints на `/workspaces` и `/workspaces/{id}`.
- `Agent.workspace_id` как required-поле.
- `?workspace_ids[]=...` filter param на всех list endpoints.

### 11.2. Новые требования из этой работы

**Auto-create на регистрации:**
- `POST /auth/register` (или эквивалент): сервер на стороне регистрации создаёт первый workspace с именем `Main` и автоматически добавляет юзера как member. Альтернатива — клиент после login делает явный `POST /workspaces`. Решение за бэкенд-командой, но клиентский флоу одинаковый, см. §6.

**Глобальный scope filter — backend-aware?**
- Сейчас filter живёт **только на клиенте** (в `localStorage`). Бэкенду о нём знать не нужно.
- Если в будущем понадобится sync между устройствами или persistence на сервере — будет отдельный endpoint типа `GET/PUT /me/preferences`. Сейчас явно out of scope.

**Search в switcher (§3.5):**
- При >>10 workspaces список memberships может стать большим. В реальности `GET /me` или `GET /workspaces` должен поддерживать pagination и filter by name. Сейчас не блокер, но упомянуть.

### 11.3. Что не меняется

- Side-table `agentWorkspace` в фикстурах остаётся, пока бэкенд не добавит `Agent.workspace_id`.
- `Agent` тип в `types.ts` остаётся 1:1 со спекой, без фейкового `workspace_id`. См. оригинальный § 1.15.

---

## 12. Follow-up задачи (не в этой работе)

Зафиксируй в плане как **отдельные будущие тикеты**, не делай:

**12.1.** Замена `WorkspaceRemount` (key-based hard remount) на плавный transition через инвалидацию кешей + skeleton/shimmer на list-экранах. Требует переноса list-state из локального `useState` в общий слой и явной подписки на смену active. Не блокирует ничего из этой спеки.

**12.2.** URL query param для filter scope (для shareable ссылок). Не нужно сейчас, но дизайн глобального filter не должен препятствовать добавлению этого позже.

**12.3.** Today/Inbox экран как отдельная cross-workspace поверхность поверх approvals. Откладывается до сигнала от пользовательских данных.

**12.4.** Tags/labels на агентах как proto-projects. Откладывается до сигнала, что пользователи перерастают плоскую модель внутри workspace.

**12.5.** Per-workspace роли (вместо текущей tenant-level роли). Зависит от backend-решений, не наша зона сейчас.

---

## 13. Out of scope — фиксируем явно

Эти вещи **не делаем** и в обозримом будущем не планируем:

- Multi-active в глобальном switcher.
- Sub-levels (Project/Pod/Squad внутри workspace).
- Shared agents — агент по-прежнему принадлежит ровно одному workspace.
- Per-screen sticky filter (вместо глобального).
- Скрытие switcher при N=1.

Если по ходу имплементации возникнет соблазн — не делаем, обсуждаем отдельно.

---

## 14. Итоговый чеклист требований

Когда план готов, сверься с этим списком, что ничего не пропущено:

- [ ] `Active workspace` и `scope filter` — два независимых слайса state (§2).
- [ ] Глобальный `useScopeFilter` хук, единая точка для всех list-экранов (§4.5).
- [ ] `localStorage["proto.scope.v1"]` с валидацией по `userId` (§2.2).
- [ ] Switcher caption: «Working in» (§3.1).
- [ ] Switcher dropdown: helper text про hire (§3.3).
- [ ] Switcher search при N≥10 (§3.5).
- [ ] Chip-row подпись «Showing:» (§4.2).
- [ ] Чип «All workspaces» как первый, с правильной семантикой `[]` (§4.3).
- [ ] Sticky last (§4.3).
- [ ] Chip-row скрыт при N≤1 (§4.4).
- [ ] Локальный `workspace-filter.tsx` useState — удалён (§2.4).
- [ ] Все 4 list-экрана дефолтятся в filter `[]` (= all) (§1.3).
- [ ] Hire-form: «Hiring into: X [Change]» с локальным target (§5).
- [ ] Auto-create `Main` workspace на регистрации (§6).
- [ ] Empty state copy на `/workspaces` (§7.1).
- [ ] Filter валидация при изменении memberships (§8.3).
- [ ] Migration: инициализация `proto.scope.v1` для существующих сессий (§8.4).
- [ ] WorkspaceRemount не сбрасывает filter (§10.3).
- [ ] Approvals badge — поведение без изменений, комментарий обновить (§9).
- [ ] `docs/backend-gaps.md` обновлён (§11).
- [ ] WorkspaceContextPill: правило показа учитывает новый filter scope (§4.7).

---

## 15. Чего не должно случиться

Контр-список — типичные ошибки, которые легко допустить, реализуя эту спеку. Перечитай перед коммитом:

- ❌ Где-то остался `setActiveWorkspace(id)` который заодно зовёт `setFilter([id])` или сбрасывает filter. Это запрещено §2.3.
- ❌ Где-то остался `setFilter` который заодно зовёт `setActiveWorkspace`. Тоже запрещено.
- ❌ Hire-form подменяет глобальный active при «Change» вместо локального target. Запрещено §5.1.
- ❌ Дефолт list-экрана берёт `[activeWorkspaceId]` вместо `[]`. Запрещено §1.3.
- ❌ Filter сбрасывается на навигации между экранами. Sticky глобальный, между экранами **сохраняется** (§1.3, §2.2).
- ❌ Approvals badge начал передавать `workspace_ids` и схлопнулся в текущий active. Должен оставаться cross-workspace (§9).
- ❌ Поле `workspace_id` появилось в `Agent` типе. Запрещено, см. оригинальный § 1.15 в `backend-gaps.md`.

---

Когда план готов — пинг с ссылкой на файл в `docs/agent-plans/`. До апрува плана к коду не приступаем.
