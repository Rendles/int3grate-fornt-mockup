# План миграции на чистый Radix Themes

Цель: убрать всю кастомизацию поверх Radix. Никаких custom-обёрток, никаких hand-rolled CSS классов, никаких hardcoded `padding` / `border-radius` / `font-size` в inline-стилях и в `prototype.css`. Всё — через Radix компоненты и их пропы.

---

## Что считается нарушением

- Custom-компонент, дублирующий существующий Radix (Btn → Button, Chip → Badge, и т.п.)
- Custom `<label>` / `FieldLabel` / `FieldError` обёртка вместо `Text as="label"` + Radix
- Hardcoded `padding`, `margin`, `gap`, `border-radius`, `font-size`, `line-height`, `letter-spacing` в CSS или inline-стилях (там где есть соответствующий Radix проп)
- CSS-классы для раскладки (`.grid--4`, `.split`, `.row`, `.stack`, `.card`, `.card__head`, `.agent-row`) вместо `<Flex>`, `<Grid>`, `<Box>`, `<Card>`
- Inline `style={{ padding: ..., background: ..., borderRadius: ... }}` вместо Radix пропов (`p`, `bg`, `radius`)
- Hex / rgb литералы

## Что НЕ считается нарушением

- `var(--gray-X)`, `var(--accent-X)` и т.п. — это токены Radix, допустимо в `style={{ border: '1px solid var(--gray-6)' }}` пока у Radix нет border-пропа
- Кастомные анимации login-страницы (grid-drift, login-glow) — Radix этого не покрывает
- SVG иконки

---

## Фаза 1 — Убрать custom-обёртки, дублирующие Radix

### 1.1 `Btn` → `Button` / `IconButton` ✅
**Файл:** `src/prototype/components/common/btn.tsx` — удалён.

- [x] По всему проекту заменено: 92 usage → Radix `Button` / `IconButton`.
- [x] `variant="primary"` → default `Button`, `variant="ghost"` → `variant="ghost"`, `variant="danger"` → `color="red"`.
- [x] Size `sm/md/lg` → `1/2/3`.
- [x] `href="/x"` → `<Button asChild><a href="#/x">…</a></Button>`.

### 1.2 `Chip` / `PolicyModeChip` → `Badge` ✅
**Файл:** `src/prototype/components/common/chip.tsx` — удалён.

- [x] 44 usage заменены на `<Badge>` c Radix `color`/`variant`/`radius`/`size`.
- [x] `PolicyModeChip` инлайнен на месте использования (AgentDetailScreen, ToolsScreen).

### 1.3 `Caption` — оставлена
**Файл:** `src/prototype/components/common/caption.tsx` (оставить)

- [x] **Оставлена как легитимное расширение Radix:** у Radix `Text` нет пропов `textTransform` / `letterSpacing`, а этот кейс пронизывает весь UI (37 мест). Inline-дублирование стиля хуже, чем тонкая обёртка.
- [x] Добавлен поясняющий комментарий в `caption.tsx`.

### 1.4 `Status` — переписан через Radix `Badge` ✅
**Файл:** `src/prototype/components/common/status.tsx`

- [x] Инлайн `dotStyle` убран. Статус теперь — `<Badge color variant>` с пропом `soft`/`outline` для dotted-варианта.
- [x] Анимация `status-pulse` применяется как `className` к Radix Badge — оставлена, т.к. Radix не имеет пульсирующего состояния.

### 1.5 `Avatar` — OK
- [x] Проверено: уже использует Radix `Avatar` напрямую.

### 1.6 `Toggle` → `Switch` ✅
- [x] Удалён `toggle.tsx`. Заменено на Radix `<Switch>` + `<Flex asChild><label>` в двух местах (grants-editor, StyleGuide).

---

## Фаза 2 — Формы (labels / errors / hints) ✅

### 2.1 `FieldLabel` / `FieldError` / `FieldHint` ✅
**Файл:** `src/prototype/components/fields.tsx`

- [x] `FieldLabel/FieldError/FieldHint` стали **file-local helpers** (не экспортированы) и теперь используют чистые Radix примитивы.
- [x] Лейбл: `<Text as="label" size="1" weight="medium" color="gray">` + required helper.
- [x] Хинт: `<Text as="div" size="1" color="gray">`.
- [x] Ошибка: `<Text color="red">` + inner `<Flex>` с `<IconAlert>` (цвет иконки наследуется через `currentColor` от Text). Убран inline `style={{ color: 'var(--red-11)' }}`.
- [x] Обёртка поля: `<Flex direction="column" gap="1">` заменила `<div>` + `mt="1"`/`mb="1"` на полях.

### 2.2 `TextInput` / `PasswordField` / `TextAreaField` / `SelectField` ✅
- [x] Все 4 компонента используют `<Flex direction="column" gap="1">` как корень.
- [x] `SelectField` потерял неиспользуемый проп `triggerStyle` (был dead code).

---

## Фаза 3 — Shell (sidebar / topbar / page) ✅

### 3.1 Sidebar ⚠️ компромисс
**Файлы:** `src/prototype/components/shell.tsx`

- [x] Badge для "deferred" note (inline-стили с `borderRadius: 3`, `padding: '1px 5px'`, `marginLeft: 6`) — заменён на Radix `<Badge color="gray" variant="outline" radius="small" size="1">` с dashed border через style.
- [x] Item badge (`.sb__item-badge`, `.sb__item-badge--warn`, `.sb__item-badge--muted`) — заменены на Radix `<Badge color={...} variant={...}>`.
- [x] Footer user info (`.sb__user-name`, `.sb__user-role`) — заменены на `<Box flexGrow="1">` + Radix `<Text color="gray">`.
- [x] Inline `style={{ minWidth: 0, flex: 1 }}` → Radix `minWidth="0" flexGrow="1"`.
- [ ] **Оставлены:** `.sb__brand`, `.sb__tenant`, `.sb__nav`, `.sb__item` + `.sb__item--active::before` (accent bar), `.sb__user`, `.sb__footer`. Причина: responsive трансформация sidebar → icon-only (72px) → bottom-nav (mobile) не покрывается Radix пропами — это уникальный паттерн дизайна. Radix breakpoints (xs/sm/md/lg/xl) не совпадают с нашими (≤768, ≤1100).

### 3.2 Topbar ✅
- [x] Оставлен inline `background: 'var(--gray-2)', borderBottom: '1px solid var(--gray-6)'` — это Radix-токены, а Radix `Flex` не имеет prop `bg`/`borderBottom` для такого случая.

### 3.3 Page container ⏭️ отложено в Фазу 5
`.page` / `.page--wide` / `.page--narrow` встречаются в 33 местах по всем screens. Рефакторинг на `<Box>` или перенос padding внутрь `AppShell` сделаем массово вместе с inline-стилями в Фазе 5.

### 3.4 `PageHeader` ✅
- [x] Удалены классы `.page__header`, `.page__header-info`, `.page__eyebrow`, `.page__subtitle`, `.page__actions` из JSX.
- [x] Переписан через `<Flex asChild><header>` + `<Box>` + Radix `Text`/`Heading` с `pb`, `mb`, `gap`, responsive `direction`/`align`/`gap`.
- [x] **Оставлен** класс `.page__title` — только для стилизации вложенного `<em>` в accent-цвет (Radix `Heading` не покрывает descendant-селекторы).

### 3.5 `CommandBar` ✅
- [x] Inline `style={{ background, border, borderRadius, padding }}` удалён.
- [x] Обёрнут в Radix `<Card size="1">` (дает радиус, фон, границу из темы автоматически).

---

## Фаза 4 — Раскладки и карточки ✅ (с компромиссом)

### 4.1 Layout-классы ✅
**Файл:** `prototype.css` (строки ~574-586, 710-714) — классы ещё не удалены, но в JSX не используются.

- [x] В JSX заменено 102 occurrence: `<div className="grid grid--N">` → `<Grid columns="N" gap="4">`, `<div className="stack">` → `<Flex direction="column" gap>`, `<div className="row">` → `<Flex align="center" gap>`, `<div className="split">` → `<Grid columns={{ initial: '1', lg: '2fr 1fr' }}>`.
- [x] `<div className="form-row">` → Radix `<Grid columns={{ initial: '1', md: '240px 1fr' }} gap="5" py="5">` + `<Separator size="4" />` между секциями вместо `border-bottom`.
- [ ] **CSS классы пока не удалены из prototype.css** — отложено в Фазу 7 (финальная очистка), потому что в CSS остаются только определения, в JSX они нигде не используются.

### 4.2 Card ⚠️ компромисс
**Файлы:** `prototype.css` (строки ~342-369)

- [ ] **Оставлены:** `.card`, `.card__head`, `.card__body`, `.card__foot`. Причина: Radix `<Card>` не имеет head/body/foot slots; замена раздула бы JSX на 4-8 строк в каждом из ~20 usage'ов. Это легитимный композиционный паттерн (аналогично тому как MUI CardHeader/CardContent существуют отдельно).

### 4.3 Form row ✅
См. выше (4.1) — форма rows заменены на Grid + Separator.

### 4.4 Tables ⚠️ компромисс
- [ ] **Оставлены:** `.agent-row`, `.agent-row__avatar`, `.spend-row`, `.spend-row__bar-track`, `.spend-row__bar-fill`, `.table`. Причина: эти классы описывают уникальные table-row дизайны с hover-состоянием, avatar с gradient-маской, progress-bar'ами. Radix `<Table>` не покрывает custom grid columns + hover + псевдоэлементы. Разнос в Radix Grid + Box потребовал бы дублирования стилей в каждой строке.

---

## Фаза 5 — Убрать inline-стили в screens ✅ (частично, с документированным остатком)

### 5.1 Screens ✅ (все пройдены)
- [x] Все 17 screens пройдены. Ключевые замены:
  - `marginTop/marginBottom/marginLeft/marginRight: N` → `mt/mb/ml/mr="N"`
  - `padding: N` → `p="N"`, `padding: 'Xpx Ypx'` → `px`/`py`
  - `gap: N` → `gap="N"`
  - `flex: 1` → `flexGrow="1"`, `minWidth: 0` → `minWidth="0"`
  - `flexWrap: 'wrap'` → `wrap="wrap"`, `justifyContent: 'flex-end'` → `justify="end"`
  - `display: 'flex'` контейнеры → `<Flex>`, `display: 'grid'` → `<Grid>`
- [x] `Caption` принимает Radix margin-пропы (`m/mt/mr/mb/ml/mx/my`) — все 37 usage'ов Caption с inline-margin переписаны.
- [x] Login/Register формы — `className="row row--sm"` заменён на `<Flex>`/`<Box>`.

### 5.2 Остаток inline-стилей (документированные компромиссы)
Оставлено то, что не имеет Radix-эквивалента:
- `style={{ borderColor, borderStyle, borderTop, borderBottom }}` — Radix не имеет border-пропов
- `style={{ gridTemplateColumns: '240px 1fr' }}` — нестандартные grid templates (Radix `Grid columns` принимает только number)
- `style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}` в табличных header'ах — `Text` не имеет этих пропов
- `style={{ background: 'var(--accent-a3)', color: 'var(--red-11)' }}` — specific Radix-токены, когда Radix `Box bg/color` не принимает shade
- `style={{ minHeight, maxHeight, height: N }}` — height-утилиты не покрываются Radix
- `style={{ textAlign: 'right', whiteSpace: 'nowrap', lineHeight: 1.55 }}` — внутри `Text` без Radix props
- Анимации login-страницы (grid-drift, login-glow) — keep-as-is

### 5.3 Сырые `<button>` в screens — документированный компромисс
Осталось 6 `<button>` с кастомным styling'ом (не через Radix Button):
- `ApprovalDetailScreen`: DecisionCTA (tile с gradient), "Switch to approve/reject" chip-button
- `TaskNewScreen`: agent/type picker tiles (`className="login__role"`)
- `ToolsScreen`: expandable tool row (click для раскрытия)
- `ApprovalsScreen`: `QuickActionButton` (28×28 check/x)
- `RunDetailScreen`: step expandable row

Причина: это не "кнопки-кнопки", а кликабельные tile/row surfaces с совершенно нестандартным visual (grid-раскладки, backgrounds, borders). Radix `<Button>` бы их не подошёл.

---

## Фаза 6 — Специальные компоненты ✅

### 6.1 `MetricCard` ✅ (минорно)
- [x] Использует Radix `<Card variant="surface" size="2">` + `<Flex direction="column" gap="2">`.
- [x] `borderColor` остался inline, т.к. это динамический per-instance цвет (amber при tone=warn) и Radix не имеет border-пропа.

### 6.2 `Pagination` ✅
- [x] Inline `padding: '10px 16px'` заменён на `px="4" py="2"`.
- [x] `borderTop` + `background: 'var(--gray-3)'` оставлены inline (Radix нет пропов).

### 6.3 `InfoHint` ✅
- [x] Удалён класс `.info-hint` из `prototype.css`.
- [x] Сырой `<button className="info-hint">` заменён на Radix `<IconButton variant="ghost" color="gray" size="1" radius="full">`.

### 6.4 `GrantsEditor` ✅ (частично)
- [x] Inline row `className="row row--between"` + margin'ы → Radix `<Flex>` с пропами.
- [ ] Inline grid-header стили (строки ~141-150, ~166-170) оставлены — это custom-таблица с `gridTemplateColumns: 'minmax(0, 1fr) 130px 110px 110px 32px'` и связанными padding/border, которые невыразимы через Radix Grid.

### 6.5 `AppShell` ⚠️ компромисс
- [ ] `.shell` grid с `grid-template-areas` оставлен. Radix `<Grid>` не умеет grid-template-areas + responsive transformation в bottom-nav.

---

## Фаза 7 — Финальная очистка ✅ (с компромиссом)

### 7.1 `prototype.css` ✅
- [x] Удалены: `.grid`, `.grid--4/3/2`, `.stack`, `.stack--sm`, `.row`, `.row--sm`, `.row--between`, `.split`, `.form-row*`, `.info-hint*`, `.table*`, `.table-wrap`, `.page__header`, `.page__header-info`, `.page__subtitle`, `.page__actions`, и соответствующие responsive правила.
- [x] **Оставлены (с причинами):**
  - `.prototype-root` — scope
  - `.shell`, `.shell__sidebar`, `.shell__main` — layout
  - `.sb__*` — responsive трансформация sidebar → icon-only → bottom-nav
  - `.page`, `.page--wide`, `.page--narrow` — используется в 33 screens
  - `.page__title em` — accent-цвет для em внутри Heading
  - `.page__eyebrow` — используется в Login/Register/StyleGuide section headers
  - `.card`, `.card__head/body/foot/title` — композиционный паттерн без Radix-эквивалента
  - `.agent-row`, `.spend-row` — уникальные table-row дизайны
  - `.login__*` — анимации splash-страницы
  - `.status-pulse` — пульсирующая анимация для running статусов
  - `.ic`, `.ic--sm`, `.ic--lg` — icon sizing
  - `.state__icon`, `.truncate` — utility
- [x] Размер CSS: **846 → 690 строк** (-18%)

### 7.2 Иконки ⏭️ отложено
- [ ] Миграция `components/icons.tsx` (legacy SVG) → `components/icon.tsx` (Hugeicons) — ортогональна целям Radix-чистоты, оставлена как отдельный tech-debt item.

### 7.3 Проверка ✅
- [x] `npm run build` — чистый (307 modules, 531 kB JS, 697 kB CSS).
- [x] `npm run lint` — чистый (0 warnings, 0 errors).
- [x] Все `Radix`-компоненты используются напрямую или через минимальные легитимные обёртки (Caption, Status).

---

## Приоритеты и порядок

| Порядок | Фаза | Почему сначала |
|---|---|---|
| 1 | Фаза 1 (wrappers) | Самый большой выигрыш; после этого станет легко править screens |
| 2 | Фаза 2 (формы) | Маленький изолированный объём, разблокирует Login/Register/AgentNew/TaskNew |
| 3 | Фаза 4 (layout) | Без этого screens не перепишешь |
| 4 | Фаза 3 (shell) | После layout становится тривиальным |
| 5 | Фаза 5 (screens) | Механическая работа после предыдущих фаз |
| 6 | Фаза 6 (спец-компоненты) | Добиваем хвосты |
| 7 | Фаза 7 (cleanup) | Финальная очистка CSS |

---

## Definition of Done

- В `prototype.css` только theme-setup + анимации, не более ~100 строк
- Ни одного `className=` в screens кроме scope-якоря `.prototype-root`
- Ни одного inline `style={{}}` где есть Radix-проп (кроме border, grid-template-columns, анимаций)
- Все интерактивные элементы — прямые Radix-компоненты без обёрток
- Все тексты через `<Text>` / `<Heading>` с size-пропом
- Все лейблы форм через `<Text as="label">`
- `npm run build` и `npm run lint` — без ошибок
- Визуально страницы максимально близки к текущему дизайну
