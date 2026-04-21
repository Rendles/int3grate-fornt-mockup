# Radix Themes migration plan

Этот документ фиксирует обновленную цель: проект нужно постепенно перевести именно на **Radix Themes** и в итоге использовать стандартные Radix Themes colors, typography, spacing, radius и component styles как основной источник визуальной системы.

Важно: мы больше не пытаемся сохранить текущие кастомные цвета и шрифты как design source of truth. Визуал может заметно измениться, и это ожидаемо. Основная задача - перейти на Radix-native систему без переписывания Radix CSS под старый дизайн.

## Главное решение

Финальный UI-слой проекта должен быть построен на `@radix-ui/themes`.

`Radix Primitives` остаются не основной целью, а вспомогательным инструментом для случаев, где в Radix Themes нет нужного компонента или где нужен более низкоуровневый контроль.

Практически это значит:

- новые базовые компоненты должны импортироваться из `@radix-ui/themes`;
- текущие локальные компоненты (`Btn`, `Chip`, `Tabs`, `Toggle`, `Banner`, `LoadingList`, `Avatar`) нужно не удалить сразу, а превратить в thin wrappers над Radix Themes;
- текущий `prototype.css` должен постепенно сократиться до layout styles, product-specific patterns и временной compatibility-прослойки;
- кастомные цвета `--bg`, `--surface`, `--accent`, `--text` и кастомный Inter import нужно постепенно убрать;
- новые UI-участки не должны вводить новые product color tokens, если можно использовать стандартные Radix props и tokens.

## Что такое Radix Themes

Radix Themes - это готовая стилизованная React-библиотека компонентов от Radix UI. Она построена поверх Radix Primitives и Radix Colors, но уже имеет собственные стили, variants, sizes, theme tokens и layout utilities.

Официальная документация описывает Radix Themes как pre-styled component library, которая работает почти сразу после установки. В отличие от Radix Primitives, Themes уже задает внешний вид компонентов.

Официальные источники:

- Getting started: https://www.radix-ui.com/themes/docs/overview/getting-started
- Styling: https://www.radix-ui.com/themes/docs/overview/styling
- Theme overview: https://www.radix-ui.com/themes/docs/theme/overview
- Theme component: https://www.radix-ui.com/themes/docs/components/theme
- Color: https://www.radix-ui.com/themes/docs/theme/color
- Dark mode: https://www.radix-ui.com/themes/docs/theme/dark-mode
- Text Field: https://www.radix-ui.com/themes/docs/components/text-field
- Select: https://www.radix-ui.com/themes/docs/components/select

## Важное отличие от первого плана

В первом плане стартовой точкой были Radix Primitives, потому что они лучше сохраняют текущую визуальную оболочку. После уточнения цели это нужно изменить.

Теперь правильная стратегия такая:

1. Подключить `@radix-ui/themes`.
2. Настроить `Theme` через стандартные Radix props, не переопределяя Radix color scales под старый бренд.
3. Обернуть текущие локальные компоненты в Radix Themes, сохранив их старый API для экранов.
4. Постепенно заменить raw HTML controls и кастомные UI-примитивы на Themes components.
5. Удалять старые custom tokens и CSS по мере миграции компонентов.
6. Оставить Primitives только там, где Themes недостаточно.

## Реалистичное ожидание по визуалу

Полностью пиксель-в-пиксель сохранить текущий вид не получится, и в этой стратегии мы больше не считаем это проблемой. Radix Themes должен постепенно стать визуальной системой проекта.

Визуальные изменения будут контролируемыми, если:

- импортировать Radix Themes CSS до `prototype.css`;
- использовать `Theme asChild` на `.prototype-root`, чтобы Radix theme context был доступен всему прототипу;
- настроить `appearance`, `accentColor`, `grayColor`, `panelBackground`, `radius`, `scaling`;
- не добавлять custom overrides для Radix color scales без крайней необходимости;
- постепенно заменять product CSS tokens стандартными Radix variables и component props;
- не ломать текущую структуру экранов на первом этапе.

## Предлагаемая базовая настройка Theme

Стартовая настройка должна использовать стандартные настройки Radix Themes. Мы можем выбрать стандартные `accentColor`, `grayColor`, `radius` и `scaling`, но не должны переписывать Radix color scales под старые кастомные цвета.

```tsx
import '@radix-ui/themes/styles.css'
import { Theme as RadixTheme } from '@radix-ui/themes'

<RadixTheme
  asChild
  appearance={theme}
  accentColor="blue"
  grayColor="slate"
  panelBackground="solid"
  radius="small"
  scaling="90%"
  hasBackground={false}
>
  <div className={`prototype-root${theme === 'light' ? ' theme-light' : ''}`}>
    ...
  </div>
</RadixTheme>
```

Почему так:

- `appearance` синхронизирует dark/light theme с текущим `ThemeProvider`.
- `accentColor="blue"` использует стандартную blue scale Radix.
- `grayColor="slate"` использует стандартную slate neutral scale Radix.
- `panelBackground="solid"` дает более предсказуемые панели для текущего mockup shell.
- `radius="small"` сохраняет более строгий technical feel, но это стандартный Radix radius option.
- `scaling="90%"` помогает сохранить compact density, но это стандартный Radix scaling option.
- `hasBackground={false}` снижает риск, что Radix Theme перетрет текущий фон `.prototype-root`.
- `asChild` позволяет совместить `.radix-themes` и `.prototype-root` на одном элементе.

## CSS import order

Нужно подключить Radix Themes CSS раньше нашего prototype CSS:

```tsx
import '@radix-ui/themes/styles.css'
import './prototype.css'
```

Иначе наши overrides могут не сработать предсказуемо.

Если позже layout props Radix Themes начнут конфликтовать с кастомными styles, можно перейти на split imports:

```tsx
import '@radix-ui/themes/tokens.css'
import '@radix-ui/themes/components.css'
import './prototype.css'
import '@radix-ui/themes/utilities.css'
```

Это нужно не сразу, а только если появятся реальные CSS precedence проблемы.

## Token strategy

Финальная цель: **не иметь собственных цветовых и шрифтовых design tokens для UI-компонентов**. Цвета, typography, radius, spacing и component states должны приходить из Radix Themes.

Сейчас проект использует свои переменные:

- `--bg`
- `--surface`
- `--surface-2`
- `--surface-3`
- `--border`
- `--border-strong`
- `--text`
- `--text-muted`
- `--accent`
- `--warn`
- `--danger`
- `--success`
- `--info`
- `--font-sans`
- `--font-serif`
- `--font-mono`

Эти переменные не нужно расширять и не нужно использовать как source of truth для новых компонентов. Они могут временно жить только потому, что текущий CSS еще не мигрирован.

Правильное временное направление compatibility layer: **старые product tokens могут ссылаться на стандартные Radix tokens**, а не наоборот.

Пример допустимой временной прослойки:

```css
.prototype-root {
  --bg: var(--gray-1);
  --surface: var(--gray-2);
  --surface-2: var(--gray-3);
  --surface-3: var(--gray-4);
  --border: var(--gray-6);
  --border-strong: var(--gray-8);
  --text: var(--gray-12);
  --text-muted: var(--gray-11);
  --accent: var(--accent-9);
  --accent-soft: var(--accent-a3);
  --accent-border: var(--accent-a7);
}
```

Так старые компоненты продолжат работать, но их цвета уже будут приходить из Radix. Это может заметно поменять визуал, и это нормально.

Что нельзя делать в этой стратегии:

- нельзя делать `--accent-9: var(--accent)` или `--gray-1: var(--bg)`, потому что это превращает Radix в оболочку вокруг старых кастомных цветов;
- нельзя override-ить `--blue-9`, `--gray-1` и другие Radix scales только ради совпадения со старым макетом;
- нельзя добавлять новые custom color tokens для новых компонентов;
- нельзя сохранять Google Fonts import как финальную основу типографики.

Удаление custom tokens должно идти постепенно:

1. Убрать уже добавленный reverse token bridge, если он есть в `prototype.css`.
2. Мигрировать wrappers на Radix Themes components.
3. Заменять usages `var(--accent)`, `var(--surface)`, `var(--text-muted)` на Radix component props или Radix variables.
4. Когда usages почти исчезнут, удалить старые custom tokens и Inter import.

## Карта миграции компонентов

| Сейчас | Radix Themes target | План |
| --- | --- | --- |
| `Btn` | `Button`, `IconButton` | Сохранить `Btn` API, внутри рендерить `Button`. `variant="primary"` -> `Button variant="solid"`, `ghost` -> `ghost` или `soft`, `danger` -> `color="red"`. |
| `Chip` | `Badge` | Сохранить тональные variants, внутри использовать `Badge`. |
| `Tabs` | `Tabs` или `TabNav` | Для внутренних вкладок использовать `Tabs`. Для navigation-like вкладок можно рассмотреть `TabNav`. |
| `Toggle` | `Switch` | Заменить на `Switch`, сохранить props `on`, `onChange`, `label`. |
| `input` | `TextField.Root` | Создать wrapper `TextInput`, потом заменить raw inputs. |
| password input | `TextField.Root` + `TextField.Slot` + `IconButton` | Сохранить текущую логику eye toggle, но UI сделать на Themes. |
| `textarea` | `TextArea` | Создать wrapper `TextAreaField`. |
| `select` | `Select.Root`, `Select.Trigger`, `Select.Content`, `Select.Item` | Самый аккуратный этап, потому что визуально изменится сильнее native select. |
| `Banner` | `Callout.Root`, `Callout.Icon`, `Callout.Text` | `info` -> `color="blue"`, `warn` -> `color="amber"` или `orange`. |
| `Avatar` | `Avatar` | Заменить initials avatar на Themes Avatar. |
| `LoadingList` | `Skeleton` | Использовать `Skeleton` rows. |
| `card` CSS pattern | `Card`, `Inset`, `DataList`, `Table` | Мигрировать постепенно. Не все data rows надо сразу превращать в Table. |
| `InfoHint` | `Tooltip` или `Popover` | Для коротких подсказок `Tooltip`, для richer content `Popover`. |
| modal classes | `Dialog`, `AlertDialog` | Использовать при появлении confirm flows и modal actions. |
| `Pagination` | custom + `Button` + `Select` | В Themes нет готового pagination, оставить product wrapper. |
| `Status` | `Badge` + custom dot | Product-specific. Можно использовать Badge как base, но dot/status row оставить своим. |
| `AppShell` | custom layout + `Box`, `Flex`, `Grid` где удобно | Сайдбар и топбар лучше не переписывать резко. Это product shell. |

## Что делать с Primitives

Primitives не становятся основной целью. Их роль:

- fallback для компонента, которого нет в Radix Themes;
- низкоуровневый контроль для сложного custom behavior;
- возможная основа для product-specific компонентов, если Themes слишком сильно навязывает внешний вид.

Примеры:

- кастомный password toggle можно оставить на Themes TextField, без Primitives;
- если нужен особый combobox, возможно придется использовать Primitives или отдельное решение;
- если нужен сложный approval workflow dialog, сначала пробуем Themes Dialog/AlertDialog.

## План миграции

## Migration status

Текущий статус:

- [x] `@radix-ui/themes` установлен.
- [x] Radix Themes CSS импортирован до `prototype.css`.
- [x] `.prototype-root` обернут в `RadixTheme asChild`.
- [x] Reverse token bridge удален: Radix color tokens больше не подменяются старыми product tokens.
- [x] `Btn` переведен на Radix Themes `Button` / `IconButton` с сохранением старого API.
- [x] `Chip` / `PolicyModeChip` переведены на Radix Themes `Badge` с сохранением старого API (`tone`, `square`).
- [x] `Toggle` переведен на Radix Themes `Switch` с сохранением старого API (`on`, `onChange`, `label`, `disabled`).
- [x] `Banner` переведен на Radix Themes `Callout` с сохранением старого API (`tone`, `title`, `children`, `action`).
- [x] `LoadingList` переведен на Radix Themes `Skeleton` + `Flex` с сохранением старого API (`rows`).
- [x] `Avatar` переведен на Radix Themes `Avatar` с сохранением старого API (`initials`, `tone`, `size` как pixel number).
- [x] `Tabs` переведен на Radix Themes `TabNav` (для href-navigation) / `Tabs` (для controlled `onSelect`) с сохранением старого API.
- [x] `InfoHint` переведен на Radix Themes `Tooltip` с сохранением старого API (`children`, `size`).
- [x] Phase 3 (wrapper migration) завершена полностью.
- [x] Phase 4 - form controls: созданы primitives (`TextInput`, `PasswordField`, `TextAreaField`, `SelectField`, `FieldLabel`, `FieldHint`, `FieldError`). Мигрированы формы: `LoginScreen`, `RegisterScreen`, `StyleGuideScreen`, `AgentNewScreen`, `TaskNewScreen`, `VersionNewScreen`, `GrantsEditor`.
- [x] Phase 5 - cards/data surfaces: `EmptyState` / `ErrorState` / `NoAccessState` переведены на Radix `Card` + `Heading`/`Text`. Создан shared `MetaRow` на `DataList.Item` + мигрированы 24 локальных MetaRow usages в 4 экранах. Создан shared `MetricCard` на Radix `Card` + мигрированы TileCard (HomeScreen), 3 summary cards (SpendScreen), demo MetricCard (StyleGuide). `.card` shell и product-specific rows оставлены custom.
- [x] Phase 6 - overlays: пропущено. В прототипе нет модалок, confirm dialogs, dropdown menus и click-popovers (Explore-разведка подтвердила). `.modal*` CSS в prototype.css — dead scaffolding без usages. Когда реальные overlays появятся с бекендом (delete/archive/reject flows), использовать Radix `Dialog` / `AlertDialog` / `DropdownMenu` / `Popover` напрямую.
- [x] Phase 7 - cleanup: удалены dead CSS блоки — `.toggle*`, `.tabs*` (+ responsive), `.info-hint__bubble*` + keyframes, `.skeleton` + keyframe, `.state`/`.state__title`/`.state__body`/`.state__actions` (оставлен `.state__icon` для SuccessPanel), `.metric__*` + `.card--metric` (+ responsive), `.password-field*`, `.modal*`. StyleGuideScreen `/components` витрина обновлена: RADIX_MAP теперь ссылается на `@radix-ui/themes` targets с описанием реальных миграций; CommandBar показывает актуальные Theme props; handoff-текст переписан под Radix Themes baseline.
- [x] Phase 7b - more unused cleanup: удалены 17 unused icons из `icons.tsx`. Расширен `Banner` (добавлены tones `danger`/`success`/`ghost` + custom `icon` slot + `title: ReactNode`); мигрированы все 5 оставшихся raw `.banner*` JSX usages в `ApprovalsScreen`/`ApprovalDetailScreen`. Мигрирован последний raw `<textarea className="input textarea">` в `ApprovalDetailScreen`. Мигрированы последние raw `<input className="input">` filter-inputs в `AgentsScreen`/`ToolsScreen`. Удалены dead CSS: `.input*`, `.textarea`, `.select`, `.banner*` (полностью).
- [x] Phase 7c - fonts → Radix Themes + Inter:
  - Переопределены Radix font CSS vars внутри `.prototype-root`: `--default-font-family`, `--heading-font-family`, `--code-font-family`, `--strong-font-family`, `--em-font-family`, `--quote-font-family` — все указывают на `Inter` с system-fallback'ом. Google Fonts Inter `@import` сохранён как источник шрифта.
  - Удалены legacy tokens `--font-sans` / `--font-serif` / `--font-mono` и `font-family: var(--font-sans)` на `.prototype-root`.
  - Удалены все `font-family: var(--font-mono)` и `var(--font-serif)` декларации из `prototype.css` (28 rules); элементы наследуют Inter через Radix root.
  - Все inline `fontFamily: 'var(--font-mono)' / 'var(--font-serif)' / 'var(--font-sans)'` заменены на `'var(--code-font-family)' / 'var(--heading-font-family)' / 'var(--default-font-family)'` (~30 usages).
  - Мигрированы ~120 usages `<span className="mono">` / `<div className="mono uppercase muted">` / варианты на Radix `<Code variant="ghost">` и `<Text as="div" size="1" color="gray">` с авто-добавлением `Code`/`Text` импортов в 18 файлах.
  - `.mono` и `.serif` утилиты в CSS остались как compat-bridge: переопределены указывать на `var(--code-font-family)` / `var(--heading-font-family)`. Используются в ~66 местах на блочных `<div>` / `<Link>` / `<strong>` где перевод на `<Code>` сломает семантику. Шрифт всё равно приходит из Radix.
- [x] Phase 7d - colors → Radix Themes (pure):
  - Массовый bulk-replace всех ~400 usages `var(--bg)`/`var(--surface)`/`var(--text*)`/`var(--accent*)`/`var(--warn*)`/`var(--danger*)`/`var(--success*)`/`var(--info*)`/`var(--border*)` в `.tsx` + `.css` → прямые Radix токены (gray-1..12, accent-9/10/contrast/a3/a7, amber-11/a3/a6, red-11/a3/a6, green-11/a3/a6, cyan-11/a3/a6).
  - Удалены ВСЕ кастомные color tokens из `.prototype-root` (29 переменных) + удалён целиком блок `.prototype-root.theme-light` (58 строк). Приложение наследует цвета из Radix scale напрямую.
  - Убран `.theme-light` className из `index.tsx` — dark/light переключение теперь полностью через `<Theme appearance={theme}>` prop.
  - Все `rgba()` inline цвета в CSS (4 декоративных gradient) заменены на Radix alpha tokens (`--gray-a3`, `--accent-a6`, `--cyan-a4`, `--lime-a3`).
  - `COLOR_TOKENS` константа в StyleGuideScreen перезаписана: теперь показывает реальные Radix tokens (gray-1/2/3/4/6/8/10/11/12, accent-9/a3/a7, amber-11, red-11, green-11, cyan-11) с пометкой scale (slate/blue/amber/red/green/cyan). `ColorToken` rendered на Radix `Code` + `Text`.
- [ ] Осталось опционально: удалить `.mono` / `.serif` utility полностью (требует миграции ~66 non-span usages с учётом семантики); мигрировать `.chip` filter-bar кнопки (5 экранов) на Radix; мигрировать `.login__role` custom pickers в `TaskNewScreen` на Radix RadioGroup.

### Phase 0 - baseline

Цель: зафиксировать внешний вид до подключения Themes.

- Прогнать `npm run build`.
- Прогнать `npm run lint`.
- Сделать скриншоты ключевых страниц: login, register, dashboard, agents, agent detail, task create, approval detail, tools, spend, components.
- Отметить текущие размеры controls: кнопки, input, select, tabs, toggle, card padding.

### Phase 1 - install and wrap Theme

Цель: подключить `@radix-ui/themes` без массовой замены компонентов.

- [x] Установить `@radix-ui/themes`.
- [x] Импортировать `@radix-ui/themes/styles.css` до `prototype.css`.
- [x] Обернуть `.prototype-root` в `RadixTheme asChild`.
- [x] Синхронизировать `appearance` с текущей темой.
- [x] Настроить `accentColor`, `grayColor`, `panelBackground`, `radius`, `scaling`.
- Проверить, что текущий UI визуально почти не изменился до замены компонентов.

Файлы:

- `package.json`
- `package-lock.json`
- `src/prototype/index.tsx`
- `src/prototype/prototype.css`

### Phase 2 - remove reverse bridge and align to Radix tokens

Цель: убрать попытки подгонять Radix Themes под старые кастомные цвета и подготовить CSS к Radix-native системе.

- [x] Удалить reverse bridge вида `--accent-9: var(--accent)`, `--gray-1: var(--bg)`, `--color-background: var(--bg)`.
- [x] Не override-ить стандартные Radix color scales.
- [x] Оставить `Theme` props (`accentColor`, `grayColor`, `radius`, `scaling`) как единственный легальный способ настройки базовой темы.
- Если старые CSS-классы еще используют `--bg`, `--surface`, `--accent`, можно временно сделать их aliases к Radix tokens.
- Постепенно заменить прямые product token usages на Radix components, props и CSS variables.
- Проверить dark/light modes после удаления bridge.

Файлы:

- `src/prototype/prototype.css`
- возможно отдельный `src/prototype/radix-compat.css`, если временная compatibility-прослойка станет слишком большой.

### Phase 3 - wrapper migration

Цель: заменить внутренности наших primitives на Radix Themes components, не переписывая экраны.

Порядок:

1. [x] `Btn` -> `Button` / `IconButton`.
2. [x] `Chip` -> `Badge`.
3. [x] `Toggle` -> `Switch`.
4. [x] `Banner` -> `Callout`.
5. [x] `LoadingList` -> `Skeleton`.
6. [x] `Avatar` -> `Avatar`.
7. [x] `Tabs` -> `Tabs` / `TabNav`.
8. [x] `InfoHint` -> `Tooltip`.

Почему wrappers сначала:

- экраны продолжают импортировать те же компоненты из `components/common.tsx`;
- меньше риска сломать поведение;
- легче сравнивать визуальные изменения по одному компоненту.
- с каждым wrapper можно удалить часть кастомного CSS и старых token usages.

### Phase 4 - form controls

Цель: перевести формы на Radix Themes controls и убрать зависимость form UI от `.input`, `.select`, `.textarea`.

Создать или выделить:

- `TextInput`
- `PasswordField`
- `TextAreaField`
- `SelectField`
- `FieldLabel`
- `FieldHint`
- `FieldError`

Порядок экранов:

1. `LoginScreen`
2. `RegisterScreen`
3. `StyleGuideScreen`
4. `AgentNewScreen`
5. `TaskNewScreen`
6. `VersionNewScreen`
7. `GrantsEditor`

Особое внимание:

- `TextField.Root` имеет slot для иконок и buttons, поэтому password eye toggle можно сделать внутри Themes-style field.
- `Select` визуально и поведенчески отличается от native select, поэтому его лучше мигрировать после text inputs.
- Нужно проверить keyboard navigation и focus states.
- Не пытаться стилизовать Radix TextField так, чтобы он полностью повторял старую `.input`.

### Phase 5 - cards, lists, data surfaces

Цель: перевести большие visual surfaces на Themes там, где это улучшает consistency и уменьшает кастомный CSS.

Кандидаты:

- metric cards -> `Card`;
- empty/error/no-access states -> `Card` + `Callout` + `Button`;
- spend rows / agent rows -> пока custom, позже возможно `Table` или `DataList`;
- metadata blocks -> `DataList`;
- command bar -> скорее custom, но без кастомных color tokens.

Здесь не нужно насильно переводить все в `Table`. Текущие rows являются частью product language.

### Phase 6 - overlays and advanced components

Цель: использовать готовые Themes components для сложных интерактивных паттернов.

- `Dialog` для обычных модалок.
- `AlertDialog` для опасных подтверждений.
- `DropdownMenu` для action menus.
- `Popover` для richer hints.
- `HoverCard` только если нужен preview-like content.
- `ScrollArea` для длинных panels.

Themes Dialog/Popover уже решают проблему порталов и темы лучше, чем custom primitive portals.

### Phase 7 - cleanup

Цель: после миграции удалить лишний CSS, raw controls и устаревшие custom tokens.

- Убрать неиспользуемые `.btn`, `.input`, `.select`, `.toggle`, `.tabs` styles или оставить только compatibility layer.
- Удалить `@import` Google Fonts, если Radix default font stack принят как финальный.
- Удалить `--bg`, `--surface`, `--accent`, `--text`, `--font-sans` и похожие variables, когда они больше не нужны.
- Обновить `/components` как актуальную Radix Themes витрину.
- Обновить Figma handoff notes: теперь targets должны быть Radix Themes components, не Primitives.
- Убедиться, что `npm run build` и `npm run lint` проходят.

## Риски

### Визуальный drift

Radix Themes имеет собственные размеры, radius, padding, focus ring и colors. Визуальный drift ожидаем и допустим. Нужно двигаться component-by-component, чтобы изменения были понятными, а не хаотичными.

### CSS specificity

Если пытаться глубоко перебивать internals Radix Themes, код станет хрупким. Лучше использовать props, стандартные tokens и готовые variants. Глубокие overrides должны быть редкими и только для layout/product patterns, не для восстановления старых цветов.

### Compact density

Текущий UI плотнее обычного SaaS-интерфейса. Можно использовать стандартные Radix options `scaling="90%"`, `size="1"` или `size="2"`, но не переписывать padding каждого Radix component вручную.

### AppShell

Сайдбар и топбар лучше сохранить custom на ранних этапах. Их цвета и typography должны постепенно перейти на Radix tokens или Radix components, но layout может остаться product-specific.

### Select migration

Native select и Radix Themes Select отличаются по DOM, portal behavior и interactions. Это будет один из самых заметных этапов.

## Критерии готовности

Миграция считается успешной, если:

- основная библиотека UI-компонентов в коде - `@radix-ui/themes`;
- текущие product wrappers используют Radix Themes внутри;
- основные user flows работают стабильно после ожидаемого визуального обновления;
- dark/light theme работают через Radix `appearance`;
- старые кастомные color/font tokens удалены или остались только как временная compatibility-прослойка для еще не мигрированных участков;
- нет reverse bridge, который подменяет стандартные Radix colors старыми product colors;
- `/components` показывает Radix Themes mapping для Figma;
- `npm run build` и `npm run lint` проходят.

## Моя рекомендация по первому implementation step

Начать с чистого подключения Radix Themes и удаления reverse bridge:

1. Установить `@radix-ui/themes`.
2. Импортировать `@radix-ui/themes/styles.css`.
3. Обернуть `.prototype-root` через `RadixTheme asChild`.
4. Настроить Theme props.
5. Убедиться, что в `prototype.css` нет reverse bridge вида `Radix token -> old product token`.
6. Проверить, что текущий UI работает, даже если визуально начал меняться.

Только после этого переходить к `Btn -> Button` и `Chip -> Badge`.
