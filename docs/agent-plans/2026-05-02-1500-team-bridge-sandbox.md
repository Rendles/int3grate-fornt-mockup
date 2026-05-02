# Team Bridge — sandbox preview

## 1. Task summary

Заказчик сказал: *«It's too much of a spreadsheet experience right now, it needs to have more of a grid/control room view.»* Он насмотрелся на Paperclip.

Сделать **изолированный sandbox-экран** под названием **Team Bridge**, доступный по отдельному маршруту (например `/sandbox/team-bridge`), без линка в sidebar — чтобы показать заказчику направление дизайна, не ломая текущий Home/Agents/Approvals/Activity.

Это **демо-only**. Никаких изменений production-роутов, sidebar, существующих экранов. После согласования с заказчиком решим: откатить, частично перенести в Home, или полностью заменить.

## 2. Current repository state

- Sidebar: 5 пунктов (Home / Approvals / Activity / Team / Costs) для всех ролей.
- `HomeScreen` → `AdminView`: 3 metric-карточки + 2-колоночный блок (Pending approvals + Recent activity) + SpendByAgent. Списки строк.
- `AgentsScreen` (`/agents`): сетка карточек 1/2/3 cols, в каждой карточке аватар-инициалы, имя, описание, status pill, last active, кнопки Talk/Manage. **Это уже частично «grid»**, но карточка статичная — не показывает что агент делает прямо сейчас.
- `ApprovalsScreen`, `RunsScreen`, `SpendScreen` — все списки строк.
- Аватары: 2-letter initials (`Avatar` компонент). Spec § 9 хочет реалистичные фото — gap из ux-backlog #5, не делалось.
- Real backend data доступен через `api.listAgents()`, `api.listApprovals()`, `api.listRuns({ limit: N })`, `api.getSpend()`.

## 3. Relevant files inspected

- `src/prototype/index.tsx` — flat routes array. Легко добавить sandbox-маршрут.
- `src/prototype/screens/HomeScreen.tsx` + `screens/home/AdminView.tsx` — текущий Home.
- `src/prototype/screens/AgentsScreen.tsx` — текущий Team grid.
- `src/prototype/components/shell.tsx` — Sidebar (НЕ трогаем — sandbox без sidebar-линка).
- `src/prototype/components/common.tsx` — primitives (`PageHeader`, `Avatar`, `Status`, `MetricCard`).
- `src/prototype/lib/fixtures.ts` — 7 fixture-агентов (Lead Qualifier, Refund Resolver, Access Provisioner, Invoice Reconciler, Knowledge Base Sync, Campaign Drafter, Legacy Triage Bot).
- `src/prototype/lib/api.ts` — `listAgents`, `listApprovals`, `listRuns`, `getSpend`.
- `src/prototype/prototype.css` — `.card`, `.card--tile`, `.card--hover`, `.page--wide`. Можно расширить scoped-классами `.bridge-*`.

## 4. Assumptions and uncertainties

**Assumptions:**

- Sandbox доступен только админу через прямой URL (как `/learn` или `/profile`), не через nav. Никаких permissions-хитростей не нужно — Maria сама не наткнётся.
- Реальные фото агентов в этом первом подходе — **не делаем**. Используем initials как сейчас. Если заказчику зайдёт направление — отдельная задача собрать asset-набор.
- Per-agent live state (current task, today's output) — **синтезируем честно** с `<MockBadge kind="design">` на хедере экрана. Это design preview, не production. Backend gap §1.2/§2.2 — известный.
- Layout — desktop-first (как и весь прототип). Mobile sandbox — out of scope этой итерации.

**Uncertainties:**

- Не знаю как именно выглядит Paperclip — заказчик ссылается на него абстрактно. Мой trade-off: интерпретирую «control room» как **team-operations-floor** (живые тайлы агентов с текущей работой), а **не** как NORAD-walls с DAG-графами и telemetry. Прямой Paperclip-clone был бы anti-pattern по spec §10 (workflow / DAG / engineering aesthetic). Если заказчик после demo скажет «нет, мне нужно прямо Paperclip» — пересмотрим.
- Открытый вопрос: одна страница или две? Вариант A — одна `/sandbox/team-bridge` показывает всё. Вариант B — линкнуть из неё на дополнительные sandbox-варианты (Approvals deck, Activity swimlanes). **Решение: A для первого захода**, чтобы заказчик увидел концепт за один скролл.

## 5. Proposed approach

Сделать новый экран `TeamBridgeScreen.tsx` под `src/prototype/screens/sandbox/`. Доступен по hash `#/app/sandbox/team-bridge`. **Sidebar не трогаем.** В sandbox-папке держим всё связанное с превью (компоненты, потенциально стили), чтобы потом было легко удалить или промотировать.

### Layout (desktop-first, single column main + side rail)

```
┌──────────────────────────────────────────────────────┬─────────────┐
│  TEAM BRIDGE  · sandbox preview  [MOCK]              │             │
│  At-a-glance view of your digital team               │  PENDING    │
│                                                      │  APPROVALS  │
│  ┌─ STATUS RAIL ─────────────────────────────────┐   │  (deck)     │
│  │ 4 working · 2 waiting on you · 1 stuck · 1 idle│  │             │
│  └────────────────────────────────────────────────┘  │  ─ deck ─   │
│                                                      │             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │  card 1     │
│  │ [SA] Sarah  │ │ [MR] Marcus │ │ [LI] Lisa   │    │  card 2     │
│  │ ● working   │ │ ● waiting   │ │ ● stuck     │    │  ...        │
│  │ "Reviewing  │ │ "Drafting   │ │ "Couldn't   │    │             │
│  │  12 leads…" │ │  Q3 mailer" │ │  reach API" │    │             │
│  │ today: 47/3 │ │ today: 8/0  │ │ today: 2/1  │    │             │
│  │ Talk · Pause│ │ Talk · Pause│ │ Help · Talk │    │             │
│  └─────────────┘ └─────────────┘ └─────────────┘    │             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │             │
│  │ ...                                          ...  │             │
│                                                      │             │
│  ┌─ ACTIVITY TICKER ──────────────────────────────┐  │             │
│  │ 2m  Sarah · approved follow-up to 3 leads      │  │             │
│  │ 5m  Marcus · drafted email for review          │  │             │
│  │ 12m Lisa  · got stuck (network)                │  │             │
│  └─────────────────────────────────────────────────┘  │             │
└──────────────────────────────────────────────────────┴─────────────┘
```

### Конкретные пиксели концепта

1. **Status rail (top strip)** — 4 пилюли с цветовой точкой и числом: `working` (green), `waiting on you` (amber), `stuck` (red), `idle` (gray). Кликаются — фильтруют сетку ниже.
2. **Agent tiles (main grid)** — `auto-fill, minmax(280px, 1fr)`. Каждый тайл:
   - Аватар (~48px) + имя + роль (description).
   - Status indicator (цветовая точка + label) — не из spec, **синтезируем**: `working` (есть свежий running run), `waiting` (есть pending approval), `stuck` (есть failed run), `idle` (нет ничего).
   - Одна строка «что сейчас делает» — синтезируем из самого свежего run/approval (`prettifyRequestedAction` или похожая логика).
   - Сегодняшняя статистика: `done today: N · waiting: M` — counts из real data.
   - 2 кнопки: `Talk` (linkнуть на `/agents/:id/talk`), `Manage` (на `/agents/:id`). Если stuck — `Help` (на `/activity`).
   - Hover поднимает карточку (border highlight).
3. **Pending approvals deck (right rail)** — стопка карточек с превью requested_action, requested_by, ago. Click → `/approvals/:id`. Как card-deck, не таблица. Width ~320px, sticky-top.
4. **Activity ticker (bottom)** — компактная горизонтальная или вертикальная лента из последних 6-8 событий. Один ряд = avatar + agent + одна фраза + timestamp. Не expandable; для деталей — `/activity`.
5. **MockBadge** на header экрана с честным объяснением: «This is a sandbox preview. Live status / current activity / today's stats are synthesized from real run data — they would need backend support to be real-time. See docs/handoff-prep.md for context.»

### Что НЕ делаем

- Никаких DAG / node-graph / workflow visualisation.
- Никаких real-time websocket subscriptions (synthesize on mount).
- Никаких новых zoom-уровней / multi-monitor layouts.
- Никаких confetti / sparkles / robotic chrome.

## 6. Risks and trade-offs

- **Risk:** заказчик увидит превью и скажет «вот это и делайте production». Тогда нужно будет аккуратно пересмотреть Home (или вынести Bridge как новую страницу). У нас останется конфликт «дашборд метрик vs живой команде» — нужно будет решить какая модель главная.
  - *Mitigation:* sandbox именно для этого — обсуждать на конкретном примере, а не на словах. После demo принимаем решение.
- **Risk:** synthesized live-state создаёт ложное впечатление что backend это уже умеет. Если sandbox увидит backend-команда — могут начать строить под выдуманный API.
  - *Mitigation:* MockBadge на хедере + явное «sandbox preview» в title + fact-check что в коде есть `// SANDBOX:` комменты у synthesize-helpers.
- **Risk:** «выглядит как dashboard, который мы хотели заменить» — если визуально получится тоже сетка карточек, заказчик не увидит разницы между новым и существующим `/agents`.
  - *Mitigation:* критическое отличие — **дополнительные surfaces** (status rail, ticker, approvals deck) плюс **per-tile current-activity sentence**, которой на `/agents` нет. Тайлы должны выглядеть «живыми», а не статичными.
- **Trade-off:** один экран (Bridge) объединяет три сущности (агенты + approvals + activity), которые сейчас в трёх отдельных местах sidebar. Это **сознательное** решение для control-room ощущения — но дублирует контент. В production-варианте надо будет решить, что остаётся в sidebar.

## 7. Step-by-step implementation plan

**Step 1.** Создать каркас экрана + добавить sandbox-route, проверить что hash `#/app/sandbox/team-bridge` открывает заглушку с PageHeader + MockBadge + «coming soon» подложкой. Без логики, без данных. Проверить что sidebar не показывает линка, существующие экраны не пострадали, lint+build clean.

**Step 2.** Добавить data-loading: fetch agents + approvals + recent runs. Реализовать synthesize-функции `agentLiveStatus(agent, runs, approvals)` и `agentCurrentActivity(agent, runs, approvals)` с честными SANDBOX-комментами. Нарисовать **status rail** (4 пилюли с counts). Без тайлов и deck'а ещё.

**Step 3.** Реализовать **agent tiles grid** — основной visual. Использовать synthesized status + current-activity. Кнопки Talk/Manage, link на существующие роуты. Hover-эффект.

**Step 4.** Добавить **pending approvals deck** в правый rail. Sticky на больших экранах, перетекает вниз на узких.

**Step 5.** Добавить **activity ticker** внизу. Real data, последние 6-8 runs.

**Step 6.** Polish pass: visual hierarchy, отступы, проверить что filter-pills из status rail реально фильтруют тайлы, проверить empty/loading states, проверить что каждая ссылка ведёт куда нужно. Финальный lint + build.

## 8. Verification checklist

- [ ] `#/app/sandbox/team-bridge` открывается, экран рендерится.
- [ ] Sidebar не содержит ссылки на sandbox.
- [ ] `/`, `/agents`, `/approvals`, `/activity`, `/costs` — работают как раньше, визуально не изменились.
- [ ] MockBadge виден на хедере с понятным объяснением.
- [ ] Status rail показывает реальные counts по 7 fixture-агентам.
- [ ] Agent tiles показывают живой текст (current activity) — не "—" / placeholder.
- [ ] Approvals deck кликается, ведёт на `/approvals/:id`.
- [ ] Activity ticker показывает реальные runs.
- [ ] `npm run lint` clean.
- [ ] `npm run build` clean (TS strict).

## 9. Browser testing instructions for the user

После каждого step'а:

1. Если dev server не запущен: `npm run dev`, открыть напечатанный URL (обычно `http://localhost:5173/`).
2. Залогиниться как `frontend@int3grate.ai` (Ada — admin), пароль `demo`.
3. В адресной строке заменить hash на `#/app/sandbox/team-bridge` (т.к. в sidebar линка нет).
4. **Step 1:** должна открыться страница с заголовком «Team Bridge» + MockBadge + placeholder-block.
5. **Step 2:** на странице появилась горизонтальная strip с пилюлями `working / waiting / stuck / idle` и числами.
6. **Step 3:** под status rail — сетка тайлов агентов. Каждый тайл показывает имя, статус-точку, одну фразу о текущей работе, today-counts, кнопки Talk/Manage.
7. **Step 4:** справа появилась колонка с pending approvals (карточки-стопкой).
8. **Step 5:** под grid'ом — узкая лента последних activity events.
9. **Step 6:** клик по пилюле в status rail фильтрует тайлы; клик по approval-карточке ведёт на approval detail; клик по тайлу/Talk/Manage — на правильные роуты.

После всех steps также проверить что Home / Team / Approvals / Activity / Costs выглядят и работают как до начала.

## 10. Progress log

- 2026-05-02 15:00 — план создан, ждём подтверждения user'а на Step 1.
