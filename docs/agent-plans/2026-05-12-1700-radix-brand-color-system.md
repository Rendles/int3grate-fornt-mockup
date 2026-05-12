# 2026-05-12 1700 — Radix brand color system

> Источник: `docs/int3grate-radix-color-system.md` (дизайн-консультация).
> Цель: внедрить брендовую палитру int3grate.ai через переопределение Radix-шкал `violet` / `cyan` / `orange` + миграцию `indigo` / `amber` / `green` → `violet` / `orange` / `jade`.

## 1. Task summary

Заменить дефолтные Radix-шкалы тремя брендовыми (Logic Purple, Signal Cyan, Deploy Orange), сменить accent с `indigo` на `violet`, мигрировать активные использования `amber` → `orange` и `green` → `jade`. Обе темы (dark + light) должны выглядеть корректно. Сделать так, чтобы существующий API Radix Themes (`<Button>`, `<Badge color="cyan">`, `<Theme accentColor="...">`) выдавал брендовые цвета без переписывания компонентов.

## 2. Current repository state

- Vite + React 19 + TypeScript SPA, mount: `src/main.tsx` → `App.tsx` → `PrototypeApp` (`src/prototype/index.tsx`).
- Radix Themes конфигурируется единожды в `src/prototype/index.tsx:170-209` (`ThemedRoot`):
  - `accentColor='indigo'` (нужно → `violet`)
  - `grayColor="slate"` ✓ (по доку — оставляем)
  - `panelBackground="solid"`, `radius="small"`, `hasBackground={false}`
  - `<Theme asChild>` оборачивает `.prototype-root` — Radix приклеивает `.dark-theme`/`.light-theme` ровно на этот же div.
- Тема переключается через `useTheme()` (`src/prototype/theme.tsx`), значения хранятся в `localStorage["proto.theme.v1"]`.
- Стили: `@radix-ui/themes/styles.css` импортируется первым в `index.tsx:1`, затем `./prototype.css:2` (.prototype-root scope).
- `prototype.css:27` сейчас override-ит `--color-panel-solid: var(--gray-2)` — это нужно для light-режима (см. § 6 риски).
- Hex-литералов в TSX/CSS нет — всё через `--gray-*`, `--accent-*`, `--amber-*`, `--red-*`, `--green-*`, `--cyan-a4` (login glow) и т.д.

## 3. Relevant files inspected

- `docs/int3grate-radix-color-system.md` (source-of-truth doc)
- `src/prototype/index.tsx` — Theme config
- `src/prototype/prototype.css` — глобальные CSS, переменные, существующие override
- `src/prototype/theme.tsx` — theme provider (dark/light)
- `src/index.css` — root reset (color-scheme: dark)
- `src/main.tsx`, `src/App.tsx` — точки монтирования
- `package.json` — Radix Themes `^3.3.0`
- Все `color="amber|green|indigo"` использования: 7+7+3 файлов соответственно
- Все `var(--amber-*|--green-*|--cyan-a*|--accent-*)` — отмаплены через grep

## 4. Assumptions and uncertainties

### Подтверждённые с пользователем (2026-05-12)

| # | Решение |
|---|---|
| 1 | Amber → Orange — **полная миграция**, обе шкалы (prop + CSS var) |
| 2 | Green → Jade — **миграция**, обе шкалы (prop + CSS var) |
| 3 | Alpha-шкалы — **делаем сами**, без официального генератора |
| 4 | `--color-panel-solid` в dark — **Graphite `#0E1117`** из дока |
| 5 | Значения шагов 1–8/10–12 — **берём из дока** (HSL-аппроксимация) |
| 6 | Solid cyan/orange contrast fix — **на моё усмотрение** → выбираю **CSS-override на `[data-accent-color="..."][data-variant="solid"]`** (один раз и забыли, не надо помнить на каждом callsite) |
| 7 | `color="indigo"` в welcome-chat-flow — **убираем prop**, наследует accent |

### Ещё не подтверждено / уточняется в процессе

- **`--color-panel-solid` в light** оставляю `var(--gray-2)` (док молчит про это; существующий override в `prototype.css:27` нужен иначе light-карточки сольются с фоном). Поднимаю в browser-тесте на confirm.
- **Алгоритм генерации alpha-шкал** — предлагаю в шаге 6 написать tiny Node-скрипт, который использует формулу `alpha = max_channel((target - bg) / (255 - bg))` (для dark) с source = brand step 9, bg = Core Black `#05070A` (dark) / Mist White `#F7F8FA` (light). Если результат визуально неудачен — переходим на ручной hand-tune.

## 5. Proposed approach

Подход 5-шаговый, каждый шаг независим, между шагами можно проверять браузером.

1. **CSS-файл с overrides** (новый `src/prototype/brand-colors.css`), импортируется в `index.tsx` ПОСЛЕ `prototype.css` чтобы наш `--color-panel-solid` стрэтегия для light победила. Содержит:
   - Light-режим (`:root, .light, .light-theme`): три шкалы violet/cyan/orange по доку (только шаги 1–12, без alpha).
   - Dark-режим (`.dark, .dark-theme`): три шкалы + `--color-background: #05070A` + `--color-panel-solid: #0E1117`.
   - Удалить `--color-panel-solid: var(--gray-2)` из `prototype.css:27` и перенести логику сюда (dark → Graphite, light → `var(--gray-2)`).
2. **Сменить accent**: `accentColor='indigo'` → `accentColor='violet'` в `index.tsx:176`. Все `var(--accent-*)` авто-обновятся на violet.
3. **Миграция amber → orange**:
   - `color="amber"` → `color="orange"` (7 файлов: ChatNewScreen, team-map-side-panel ×2, RunDetailScreen, SettingsScreen, ToolsScreen ×2, TrainingBanner).
   - `var(--amber-*)` → `var(--orange-*)` (~30 мест: prototype.css TrainingBanner block, AdminView, ApprovalDetailScreen, RunDetailScreen, RunsScreen, sandbox/TeamBridgeScreen, mock-badge, metric-card, states.tsx, и др.).
4. **Миграция green → jade**:
   - `color="green"` → `color="jade"` (7 файлов: approval-card, ApprovalsScreen, grants-editor ×2, ApprovalDetailScreen ×2, LearnScreen, ToolsScreen ×2).
   - `var(--green-*)` → `var(--jade-*)` (~25 мест: chat-panel, AgentNewScreen, grants-editor, ApprovalDetailScreen, RunsScreen, undo-toast, AdminView, welcome-chat-flow, ToolsScreen, sandbox/TeamBridgeScreen).
5. **Indigo cleanup + solid-contrast fix**:
   - Убрать `color="indigo"` prop из 3 мест в `welcome-chat-flow.tsx` (lines 722, 759, 1276).
   - Добавить в `brand-colors.css` CSS-override на `[data-accent-color="cyan"][data-variant="solid"]` и `[data-accent-color="orange"][data-variant="solid"]` → `color: var(--cyan-12)` / `var(--orange-12)`. Подтвердить актуальный селектор Radix v3 в DevTools перед добавлением (атрибут может быть `data-accent-color` или другой).
6. **(deferred / phase 2)** Hand-tune alpha-шкал `--violet-a*`, `--cyan-a*`, `--orange-a*`. Сейчас будут использоваться Radix-defaults, что визуально близко но не пиксель-точно к новому шагу 9. Триггер для phase 2: пользователь видит «soft variant выглядит не наш» в smoke-test.

## 6. Risks and trade-offs

1. **`--color-panel-solid` в light**. Док предлагает `#FFFFFF` дефолт; код сейчас использует `var(--gray-2)` иначе карточки невидимы на белом фоне. Резолюция в плане: в light оставляем `var(--gray-2)`, в dark берём Graphite. Если потом окажется что Mist White `#F7F8FA` как page bg + чистый белый panel смотрятся ОК — упростим. Документируем в комменте.
2. **`--color-page-background` vs `--color-background`**. `prototype.css:41` ссылается на `--color-page-background`. Док перепрописывает `--color-background`. В Radix Themes v3.3.0 актуальное имя — `--color-background`. Сейчас в light page bg, возможно, работает «через каскад» (Radix всё ещё эмитит обе для совместимости, надо проверить). Заменю обращение в prototype.css на `--color-background` в шаге 1.
3. **Bright-scale solid контраст**. Cyan и Orange — bright scales: белый текст на solid-кнопке/бэйдже нечитаем. Решение — глобальный CSS override на dark-text в solid-variant'е. После миграции amber→orange критично только для TrainingBanner (`color="amber" variant="solid"`). Бонус: миграция safety-net.
4. **Alpha-шкалы**. Без overrides `--violet-a*`/`--cyan-a*`/`--orange-a*` останутся дефолтными Radix-альфами (близко по hue к нашему шагу 9 но не идентично). На soft-вариантах (`Badge variant="soft"`, hover, focus) разница минимальна, но опытный глаз увидит. Если пользователь скажет «soft cyan выглядит мутно» — пишем generator script в phase 2.
5. **Жадник vs зелёный**. Jade темнее зелёного. После миграции Allow-кнопки/Won-бэйджи станут чуть приглушённее. Это намерение дока (лучше уживается с фиолетовым).
6. **Перцептуальная неточность HSL-аппроксимации**. Шаги 1–8 и 10–12 в доке — HSL-приближение, не APCA. Шаг 5 на dark `#321B6A` может на ультра-широких мониторах выглядеть мутно. План: оставить как есть, если в smoke-test'е виден дискомфорт — phase 2 прогон через генератор.
7. **`accent-9` em-стиль**. `.page__title em`, `.login__tagline em`, `.advanced-toggle[open] .advanced-toggle__chevron` используют `var(--accent-9)`. После accent → violet они станут ярко-фиолетовыми `#701DFD`. Бренд — соответствие; визуально ярче чем индиго. Не баг.

## 7. Step-by-step implementation plan

### Step 1 — Create `brand-colors.css` + wire imports

Файлы: новый `src/prototype/brand-colors.css`, edit `src/prototype/index.tsx`, edit `src/prototype/prototype.css`.

- Создать `brand-colors.css` с:
  - Light overrides (`:root, .light, .light-theme`) — три шкалы violet/cyan/orange (шаги 1–12), light `--color-panel-solid: var(--gray-2)` (комментарий «почему не #FFF»).
  - Dark overrides (`.dark, .dark-theme`) — три шкалы + `--color-background: #05070A` + `--color-panel-solid: #0E1117`.
  - Solid-contrast fix selector block (закомментирован до подтверждения селектора в шаге 5).
- В `index.tsx:2` импорт `./prototype.css` → потом `./brand-colors.css` (после, чтобы наш `--color-panel-solid` стратегия победила).
- В `prototype.css:27` убрать `--color-panel-solid: var(--gray-2)` (теперь живёт в brand-colors.css).
- В `prototype.css:41` заменить `var(--color-page-background)` → `var(--color-background)`.

**Verify**: `npm run dev` → визуально страницы выглядят как раньше, кроме accent (всё ещё indigo, шаг 2 поменяет). Light и dark переключаются. Карточки видны в обеих темах.

### Step 2 — Switch accent: indigo → violet

Файл: `src/prototype/index.tsx:176`.

- `accentColor='indigo'` → `accentColor='violet'`.

**Verify**: primary кнопки, focus ring, active sidebar mark, hover на role-card, `em` в `<PageHeader>` и login tagline — всё фиолетовое `#701DFD`. Сайдбар активный пункт имеет ярко-фиолетовую ленту.

### Step 3 — Migrate amber → orange

Файлы:
- TSX `color="amber"`: `screens/ChatNewScreen.tsx:91`, `screens/RunDetailScreen.tsx:155`, `screens/SettingsScreen.tsx:172`, `screens/ToolsScreen.tsx:224,229`, `components/team-map-side-panel.tsx:120,129`, `tours/TrainingBanner.tsx:36`.
- TSX `var(--amber-*)`: `screens/ApprovalDetailScreen.tsx:312,709`, `screens/home/AdminView.tsx:22,24,69`, `screens/RunDetailScreen.tsx:143,144,150,151`, `screens/RunsScreen.tsx:37,581`, `screens/SettingsScreen.tsx`, `components/common/mock-badge.tsx:26-27`, `components/common/metric-card.tsx:22`, `components/states.tsx:19-21`, `screens/sandbox/TeamBridgeScreen.tsx:32,470,531,604,606`, `tours/TrainingBanner.tsx:29,32`.
- CSS `prototype.css`: lines 1511, 1512, 1521, 1645, 1653 — `--amber-*` → `--orange-*`.

**Verify**: TrainingBanner — оранжевая, "no setup" бэйдж — оранжевый, partial-error border на RunDetail — оранжевый. Mock-badge тоже оранжевый (по доку Mock остаётся "design exploration" warning — это правильно).

### Step 4 — Migrate green → jade

Файлы:
- TSX `color="green"`: `components/approval-card.tsx:119`, `screens/ApprovalsScreen.tsx:510`, `components/grants-editor.tsx:279,341`, `screens/ApprovalDetailScreen.tsx:317,368`, `screens/LearnScreen.tsx:86`, `screens/ToolsScreen.tsx:219,394`.
- TSX `var(--green-*)`: `components/chat-panel.tsx:513,517,560`, `screens/AgentNewScreen.tsx:380,487,493,494`, `components/grants-editor.tsx:240,242`, `screens/ApprovalDetailScreen.tsx:339,437,438,516,528,707`, `components/undo-toast.tsx:79,80`, `screens/home/AdminView.tsx:21`, `components/welcome-chat-flow.tsx:945,946`, `screens/ToolsScreen.tsx:385`, `screens/RunsScreen.tsx:36`, `screens/sandbox/TeamBridgeScreen.tsx:31,603`.

**Verify**: Allow buttons в grants-editor, Won/Approved badges, chat tool-call success icon — все jade (более приглушённый зелёный).

### Step 5 — Indigo cleanup + solid contrast fix

Файлы: `components/welcome-chat-flow.tsx` lines 722, 759, 1276; `src/prototype/brand-colors.css`.

- Убрать prop `color="indigo"` из трёх Avatar в welcome-chat-flow. Avatar без `color` prop наследует accent → violet.
- В DevTools проверить актуальный селектор Radix v3.3.0 для accent + variant (вероятно `[data-accent-color="cyan"][data-variant="solid"]`).
- Добавить в `brand-colors.css` блок (не префиксованный `.prototype-root` — Radix-классы могут портироваться):

```css
/* Bright-scale solid contrast — cyan & orange step 9 are too bright for white text */
.rt-Button[data-accent-color="cyan"][data-variant="solid"],
.rt-Badge[data-accent-color="cyan"][data-variant="solid"] {
  color: var(--cyan-12);
}
.rt-Button[data-accent-color="orange"][data-variant="solid"],
.rt-Badge[data-accent-color="orange"][data-variant="solid"] {
  color: var(--orange-12);
}
```

**Verify**: welcome-chat avatars — фиолетовые. Solid orange/cyan кнопки и бэйджи — тёмный текст (если такие сейчас есть; иначе скрытая страховка).

### Step 6 — (deferred) Alpha-шкалы

Пропускаем в первой итерации. Если в smoke-test'е видна visual regression на soft-вариантах:
- Создать `scripts/gen-radix-alphas.mjs` — реализация Radix alpha-blend формулы: `alpha = max((target_channel - bg_channel) / (255 - bg_channel))` для dark, инвертирована для light.
- Inputs: brand hexes + Core Black / Mist White backgrounds.
- Outputs: 12 alpha-pairs `(hex, alpha%)` для каждой шкалы и режима — копируются в brand-colors.css.

## 8. Verification checklist

- [ ] `npm run lint` clean (нет stale imports после миграции color props).
- [ ] `npm run build` clean (TS-ошибок нет; `verbatimModuleSyntax` ОК).
- [ ] `localStorage.setItem('proto.session.v1', JSON.stringify({ token: 'mock_usr_ada', userId: 'usr_ada' }))`.
- [ ] `#/` — Home dashboard, фиолетовый accent в hbar bars, heatmap tint, "savings" линия графика.
- [ ] `#/approvals` — pending approvals border оранжевый (был amber), Approve кнопка jade (был green), Reject кнопка красная.
- [ ] `#/approvals/<id>` — Approve/Reject button colors соответствуют.
- [ ] `#/activity` — activity rows: success badge jade, warn badge orange, error badge red.
- [ ] `#/activity/<run_id>` — partial-error panel оранжевый border + background.
- [ ] `#/agents` — agent list, no color overrides expected (gray + accent).
- [ ] `#/agents/<id>/grants` — Allow buttons jade, "no apps configured" warn jade-tinted (после миграции).
- [ ] `#/agents/new` — Welcome chat: avatar bubbles фиолетовые (не indigo), step indicator активный фиолетовый, completed jade.
- [ ] `#/costs` — spend rows, gradient линий фиолетовый.
- [ ] `#/learn` — completed badge jade.
- [ ] `#/workspaces` — active workspace tile фиолетовая граница.
- [ ] `#/sandbox/team-bridge` — pending badges оранжевые, completed jade, completed_with_errors оранжевый.
- [ ] **Тема light** — переключить через UI / topbar toggle. Все вышеперечисленное в светлой палитре. Карточки имеют отчётливое отделение от фона (gray-2 vs page bg).
- [ ] **Training mode** — `#/learn` → Start "Approval review" → top banner оранжевый (был amber), dot пульсирует.
- [ ] Mock badge — оранжевый pill.
- [ ] **Solid bright fix** — если есть в проекте `<Button color="orange|cyan" variant="solid">` — текст читаемый.

## 9. Browser testing instructions for the user

1. `npm run dev` → открыть `http://localhost:5173/#/`.
2. Залогиниться `frontend@int3grate.ai` / `demo` (Ada — admin).
3. Пройти по чек-листу § 8 в **dark** теме.
4. Переключить тему (`topbar` → theme toggle или ручной `localStorage.setItem('proto.theme.v1', 'light'); location.reload()`).
5. Пройти по чек-листу § 8 в **light** теме. Особое внимание:
   - Карточки на Home отличимы от фона страницы (`--color-panel-solid: var(--gray-2)` vs `--color-background: Mist White`).
   - Primary CTA "Hire" / "Create" — насыщенный фиолетовый, читаемый белый текст.
6. На `#/learn` запустить тур "Approval review" — training banner должен быть оранжевый.
7. Если что-то выглядит «mutно» или off-brand — отметить экран + переменную, переход в § 5 step 6 (alpha-шкалы).

## 10. Progress log

- **2026-05-12 17:00** — План создан. Ждём `продолжай` от пользователя для Step 1.
- **2026-05-12 17:20** — **Step 1 done.**
  - `src/prototype/brand-colors.css` создан: 3 шкалы × 2 темы + surface tokens.
  - `src/prototype/index.tsx:3` — добавлен импорт `./brand-colors.css` после `./prototype.css`.
  - `src/prototype/prototype.css:21-27` — убран `--color-panel-solid: var(--gray-2)`, заменён комментарий-пойнтером в brand-colors.css.
  - `src/prototype/prototype.css:38` — `var(--color-page-background)` → `var(--color-background)` (актуальное имя в Radix v3).
  - `npm run build` clean, `npm run lint` clean.
  - На текущем шаге accent всё ещё `indigo` — visual diff будет только на surface (panel solid в dark становится Graphite). Step 2 переключит accent на violet.
- **2026-05-12 17:25** — **Step 2 done.**
  - `src/prototype/index.tsx:176` — `accentColor='indigo'` → `accentColor='violet'`.
  - `npm run build` clean, `npm run lint` clean.
  - Все `var(--accent-*)` теперь резолвятся в Logic Purple. 3 хардкода `color="indigo"` в welcome-chat-flow всё ещё активны (Step 5).
- **2026-05-12 17:45** — **Step 3 done.**
  - Затронуто **23 файла** TSX/CSS. План недосчитал tone-maps (`'amber'` строки в map'ах типа `tone → color`), поэтому пришлось расширить sweep:
    - **`color="amber"` prop** (7 файлов): ChatNewScreen, SettingsScreen, ToolsScreen, team-map-side-panel, TrainingBanner, RunDetailScreen, ChatNewScreen.
    - **`var(--amber-*)` (CSS var)**: prototype.css, ApprovalDetailScreen, home/AdminView, RunsScreen, mock-badge, metric-card, states, sandbox/TeamBridgeScreen, RunDetailScreen, TrainingBanner.
    - **`'amber'` string in tone-maps / ternaries** (15 файлов): team-map-side-panel, team-map-canvas, SettingsScreen, AuditScreen, ToolsScreen, ApprovalsScreen, home/AdminView, sandbox/TeamBridgeScreen, grants-editor, states, common/avatar, common/command-bar, common/status, shell, RunDetailScreen.
    - **Code comments** (3 файла): shell.tsx, TrainingBanner, TrainingAutoExit. Tour copy (`approval-review-tour`, `sidebar-tour`) — НЕ трогалось (CLAUDE.md tour rebuild deferred).
  - `npm run build` clean, `npm run lint` clean.
  - Финальный `grep amber` показывает только 2 остаточные ссылки в tour data — намеренно оставлены.
- **2026-05-12 18:00** — **Step 4 done.**
  - Затронуто **20 файлов**. Аналогично Step 3, патч идёт в 3 раунда по уникальным паттернам:
    - `var(--green-*)` → `var(--jade-*)` — 10 файлов: chat-panel, grants-editor, AgentNewScreen, ApprovalDetailScreen, RunsScreen, AdminView, sandbox/TeamBridgeScreen, ToolsScreen, undo-toast, welcome-chat-flow.
    - `color="green"` → `color="jade"` — 6 файлов: approval-card, grants-editor, ApprovalDetailScreen, ApprovalsScreen, LearnScreen, ToolsScreen.
    - `'green'` → `'jade'` (tone-maps + type unions) — 7 файлов: AuditScreen, SettingsScreen, ApprovalDetailScreen, RunDetailScreen, common/avatar, common/status, states.
    - prototype.css line 10 — комментарий "scales reference" обновлён.
  - `npm run build` clean, `npm run lint` clean.
  - 2 остаточные английских "green" в коментах — естественный язык про цветовое кодирование, не Radix-токен.
- **2026-05-12 18:15** — **Step 5 done.**
  - `components/welcome-chat-flow.tsx` — убраны 3 prop'а `color="indigo"` на Avatar (3 разных индента, 3 отдельных Edit). Avatar теперь наследует accent (Logic Purple).
  - Комментарий "flat indigo circle" → "flat accent circle" (line 1266).
  - `brand-colors.css` — добавлен блок BRIGHT-SCALE SOLID CONTRAST FIX: `.rt-Button[data-accent-color="cyan|orange"][data-variant="solid"]` + `.rt-Badge[...]` → текст на `var(--cyan-12)` / `var(--orange-12)`. Селекторы НЕ под `.prototype-root` (Radix портирует контент в body).
  - `npm run build` clean, `npm run lint` clean. Финальный `grep indigo` — 0 совпадений.
  - **Все 5 шагов основной миграции завершены.** Step 6 (alpha-шкалы) — deferred, активируется только если в smoke-test'е заметна mut'ность soft-вариантов.
- **2026-05-12 18:30** — **Step 6 done.**
  - `scripts/gen-radix-alphas.mjs` — Node-скрипт, реализует Radix `getAlphaColorSrgb` алгоритм: для каждой пары `(opaque step N, brand background)` выдаёт `rgba(r, g, b, a)` такое, что blend-on-bg равен opaque. Источник цвета максимально насыщен per-channel.
  - `brand-colors.css` — встроены 72 alpha-переменных (`--violet-a1..a12`, `--cyan-a1..a12`, `--orange-a1..a12`) × dark + light. Распределены по соответствующим scale-блокам внутри существующих `:root, .light, .light-theme` и `.dark, .dark-theme` секций. Header-комментарий направляет на script при изменении opaque шагов.
  - `npm run build` clean, `npm run lint` clean.
  - **Все шаги плана выполнены.** Visual smoke-test остался на пользователя.
