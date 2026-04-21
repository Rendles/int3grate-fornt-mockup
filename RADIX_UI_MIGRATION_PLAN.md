# Radix UI migration plan

> Update: this plan is superseded by `RADIX_THEMES_MIGRATION_PLAN.md`.
> The final target is now Radix Themes, not Radix Primitives-first migration.

Документ фиксирует, что такое Radix UI, как он подходит к текущему прототипу Int3grate.ai, и в каком порядке лучше переводить проект на Radix так, чтобы визуально интерфейс изменился минимально.

## Короткий вывод

Для этого проекта лучше начинать с **Radix Primitives**, а не с **Radix Themes**.

Причина простая: текущий прототип уже имеет сильный визуальный язык - темный operator/control-plane интерфейс, свои CSS-токены, плотные формы, кастомные карточки, сайдбар, топбар и состояния. Radix Primitives дают поведение, доступность, фокус-менеджмент и keyboard navigation, но почти не навязывают стили. Это позволяет сохранить текущий `prototype.css`.

Radix Themes можно держать как справочник для Figma и дизайн-системы, но если подключить его как основной UI-kit в коде, визуальных изменений будет больше.

## Что такое Radix UI

Radix UI - это набор React-компонентов для построения доступных интерфейсов и дизайн-систем.

Важные части:

- **Radix Primitives** - низкоуровневые, почти не стилизованные компоненты. Они отвечают за поведение, accessibility, ARIA, focus management, keyboard navigation и структуру сложных компонентов.
- **Radix Themes** - готовая стилизованная библиотека компонентов поверх Radix. Она быстрее дает готовый UI, но сильнее влияет на внешний вид.
- **Radix Icons** - отдельный набор иконок. В этом проекте лучше пока оставить текущие иконки, чтобы не менять визуальный стиль.
- **Radix Colors** - цветовая система. В проекте уже есть свои семантические токены, поэтому прямой переход на Radix Colors не нужен.

Официальные источники:

- Radix Primitives Introduction: https://www.radix-ui.com/primitives/docs/overview/introduction
- Radix Primitives Styling: https://www.radix-ui.com/primitives/docs/guides/styling
- Radix Primitives Composition: https://www.radix-ui.com/primitives/docs/guides/composition
- Radix Primitives Accessibility: https://www.radix-ui.com/primitives/docs/overview/accessibility
- Radix Themes Getting started: https://www.radix-ui.com/themes/docs/overview/getting-started

## Как Radix работает технически

- Многие компоненты состоят из частей: например, `Select.Root`, `Select.Trigger`, `Select.Content`, `Select.Item`.
- Stateful-компоненты выставляют `data-state`, например `open`, `closed`, `checked`, `unchecked`. Это удобно для CSS и позволит заменить часть классов вида `toggle--on` или `tabs__item--active`.
- `asChild` позволяет навесить поведение Radix на наш собственный компонент, не меняя DOM-элемент визуально. Для этого leaf-компоненты должны прокидывать props и ref.
- Почти все важные части принимают `className`, поэтому можно сохранить текущие классы: `.btn`, `.tabs__item`, `.toggle__track`, `.select`, `.info-hint`.
- Portals по умолчанию часто рендерятся в `document.body`. У нас стили строго scoped под `.prototype-root`, поэтому для Tooltip, Select, Dialog и Popover нужно портировать контент внутрь `.prototype-root`, иначе CSS-токены и reset могут не примениться.

## Текущее состояние проекта

- Проект: Vite + React 19 + TypeScript.
- Radix сейчас не подключен в `package.json`.
- Основная mockup-часть живет в `src/prototype/`.
- Визуальный стиль централизован в `src/prototype/prototype.css`.
- Базовые UI-примитивы собраны в `src/prototype/components/common.tsx`.
- Состояния UI собраны в `src/prototype/components/states.tsx`.
- Shell/navigation находятся в `src/prototype/components/shell.tsx`.
- Страница дизайн-системы уже есть: `src/prototype/screens/StyleGuideScreen.tsx`.

Ключевые текущие примитивы:

- `Btn`
- `Chip`
- `Tabs`
- `Toggle`
- `InfoHint`
- `Avatar`
- `Pagination`
- `Status`
- `Banner`
- `EmptyState`
- `ErrorState`
- `NoAccessState`
- `LoadingList`

## Главный принцип миграции

Не переписывать экраны сразу.

Правильный путь: сначала заменить внутреннюю реализацию существующих компонентов на Radix-backed компоненты, сохраняя текущий API и CSS-классы. Тогда экраны вроде `AgentsScreen`, `TaskNewScreen`, `ApprovalDetailScreen` и `RegisterScreen` почти не заметят изменений.

## Рекомендуемые зависимости

Рекомендованный первый шаг:

```bash
npm install radix-ui
```

Почему так:

- официальный Radix сейчас рекомендует пакет `radix-ui` для incremental adoption;
- он tree-shakeable;
- проще держать версии примитивов синхронизированными;
- меньше риска получить дубли shared-зависимостей.

Альтернатива:

```bash
npm install @radix-ui/react-tabs @radix-ui/react-switch @radix-ui/react-tooltip
```

Эта схема точечнее, но сложнее поддерживается при росте количества Radix-компонентов.

## Карта миграции компонентов

| Текущий компонент | Radix target | Комментарий |
| --- | --- | --- |
| `Btn` | `Slot` / собственная кнопка | У Radix Primitives нет обычного Button. Нужно сохранить нашу кнопку и добавить `asChild` через Slot. |
| `Tabs` | `Tabs.Root`, `Tabs.List`, `Tabs.Trigger` | Хороший ранний кандидат. Визуально можно оставить текущие `.tabs` классы. |
| `Toggle` | `Switch.Root`, `Switch.Thumb` | Хороший ранний кандидат. Состояние можно вести через `checked` и `onCheckedChange`. |
| `InfoHint` | `Tooltip` или `Popover` | Лучше начать с Tooltip. Если контент интерактивный, перейти на Popover. |
| `Avatar` | `Avatar.Root`, `Avatar.Fallback` | Низкий риск, но пользы немного, потому что сейчас аватары только initials. |
| `Chip` | custom / Badge-like | В Primitives нет Badge. Лучше оставить кастомным. |
| `Status` | custom | Это product-specific индикатор, Radix не нужен. |
| `Pagination` | custom | У Radix нет pagination primitive. Оставить кастомным. |
| `Banner` | custom / Callout-like | В Primitives нет Callout. Оставить кастомным, либо позже связать с AlertDialog только для действий. |
| `LoadingList` | custom Skeleton | В Primitives нет Skeleton. Оставить кастомным. |
| Native `input` | `Form.Control asChild` / custom Field | У Primitives нет стабильного обычного TextField. Лучше обернуть native input в наш Field. |
| Native `textarea` | `Form.Control asChild` / custom Field | Аналогично input. |
| Native `select` | `Select` | Более заметная миграция, потому что Radix Select рендерит trigger + portal. Делать после Tabs/Switch/Tooltip. |
| Password field | `unstable_PasswordToggleField` или custom wrapper | В Radix есть Password Toggle Field, но он `unstable`. Для минимального риска можно оставить текущий password wrapper до отдельного решения. |
| Possible modal styles | `Dialog` / `AlertDialog` | В CSS есть modal-классы, но активного использования почти нет. Подключать, когда появятся реальные модальные действия. |
| Expandable run steps | `Collapsible` | Подходит для раскрывающихся шагов run detail. |

## План миграции

### Phase 0 - baseline before code changes

Цель: зафиксировать, как интерфейс выглядит сейчас.

- Сделать скриншоты ключевых страниц: login, register, dashboard, agents, agent detail, task create, approval detail, tools, spend, components.
- Прогнать `npm run build`.
- Прогнать `npm run lint`.
- Проверить, что `/components` отражает актуальные примитивы.
- Не менять визуальные токены на этом этапе.

### Phase 1 - install Radix and prepare adapter layer

Цель: подключить Radix без массовой миграции экранов.

- Установить `radix-ui`.
- Создать небольшой helper для portal container внутри `.prototype-root`.
- Подготовить Radix-backed wrappers рядом с текущими примитивами или внутри `components/common.tsx`.
- Перевести leaf-компоненты на `forwardRef`, где это нужно для `asChild`.
- Сохранить текущие props компонентов, чтобы экраны не переписывались сразу.

Файлы-кандидаты:

- `package.json`
- `package-lock.json`
- `src/prototype/components/common.tsx`
- `src/prototype/prototype.css`

### Phase 2 - low-risk primitives

Цель: заменить поведение там, где визуальные риски маленькие.

- `Toggle` -> `Switch`.
- `Tabs` -> `Tabs`.
- `InfoHint` -> `Tooltip`.
- `Avatar` -> `Avatar`, если это не усложнит код.
- Обновить `/components`, чтобы страница показывала уже Radix-backed варианты.

Почему это хороший старт:

- эти компоненты изолированы;
- у них понятные состояния;
- они часто используются;
- визуальный слой можно сохранить через текущие классы.

### Phase 3 - forms and fields

Цель: привести формы к единому Radix-compatible слою.

- Создать или выделить `Field`, `TextInput`, `TextArea`, `SelectField`, `PasswordField`.
- Для `input` и `textarea` использовать native controls под нашим wrapper, возможно через `Form.Control asChild`.
- Для `select` отдельно сделать Radix Select wrapper с текущим compact style.
- Начать с auth-экранов и StyleGuide, потом перейти к create/edit screens.

Файлы-кандидаты:

- `src/prototype/screens/LoginScreen.tsx`
- `src/prototype/screens/RegisterScreen.tsx`
- `src/prototype/screens/AgentNewScreen.tsx`
- `src/prototype/screens/TaskNewScreen.tsx`
- `src/prototype/screens/VersionNewScreen.tsx`
- `src/prototype/components/grants-editor.tsx`

Важный риск:

- Официальная документация Radix Form отмечает, что сейчас Form не всегда удобно компоновать с некоторыми form primitives вроде Select. Поэтому лучше не делать агрессивный "все формы сразу на Radix Form", а идти через собственные wrappers.

### Phase 4 - overlays and complex interactions

Цель: закрыть места, где Radix дает максимальную пользу.

- Использовать `Dialog` для обычных modal flows.
- Использовать `AlertDialog` для destructive confirmation.
- Использовать `Popover` там, где tooltip-контент станет интерактивным.
- Использовать `DropdownMenu`, если появится меню профиля, tenant switcher или action menu.
- Использовать `Collapsible` для раскрывающихся деталей run steps или advanced settings.

На этом этапе особенно важно настроить portal container в `.prototype-root`.

### Phase 5 - screen sweep

Цель: пройтись по всем экранам и убрать несогласованные raw-controls.

- Заменить повторяющиеся raw `button`, `input`, `select`, `textarea` на наши Radix-compatible wrappers.
- Не трогать product-specific карточки, rows, chips и layout без причины.
- Проверить keyboard navigation в auth, forms, tabs, selects, tooltips и dialogs.
- Проверить темную и светлую тему.
- Обновить `StyleGuideScreen`, чтобы он стал живой витриной итоговой Radix-структуры.

## Что лучше не делать

- Не подключать `@radix-ui/themes` как основной UI слой на первом этапе.
- Не переписывать все экраны напрямую на Radix primitives.
- Не удалять текущие CSS-классы сразу.
- Не менять дизайн-токены без отдельного решения.
- Не заменять текущие иконки на Radix Icons массово.
- Не переводить product-specific элементы вроде `Status`, `CommandBar`, data rows и metric cards на Radix, если Radix там не дает поведения.

## Критерии готовности

Миграцию можно считать успешной, если:

- `npm run build` проходит без ошибок.
- `npm run lint` проходит без ошибок.
- Основные user flows визуально почти не отличаются от текущих.
- Keyboard navigation работает лучше или не хуже текущего состояния.
- Focus states видны и соответствуют текущему стилю.
- Portalled components получают тему и токены из `.prototype-root`.
- `/components` документирует финальные Radix mappings для переноса в Figma.

## Вопросы перед началом реализации

Есть два решения, которые лучше подтвердить перед кодом:

- Используем только `radix-ui` Primitives в коде, а Radix Themes оставляем только как reference для Figma?
- Считаем ли native `input` и `textarea` допустимыми внутри Radix-compatible wrappers, или цель именно максимально использовать Radix Form даже там, где это может усложнить код?

Моя рекомендация: начать с `radix-ui` Primitives, сохранить текущий CSS и wrappers, а native text controls оставить внутри наших Field-компонентов до тех пор, пока это не мешает Figma handoff.
