# int3grate.ai — Brand Color System for Radix Themes

> **Кому это:** AI-кодеру, работающему над фронтендом проекта на Radix Themes.
> **От кого:** Дизайн-консультация (предполагается, что проект уже использует `@radix-ui/themes`).
> **Что нужно сделать:** Интегрировать брендовую палитру `int3grate.ai` через механизм кастомизации Radix, не переписывая компоненты.
>
> **Важно:** Я не знаю точную структуру проекта. Везде где явно сказано "уточни у пользователя" — пожалуйста, спроси, не угадывай. Список вопросов в конце документа.

---

## 1. Контекст и цель

Проект использует Radix Themes как основу UI. У бренда есть фирменная палитра, которая не совпадает с дефолтными шкалами Radix, но достаточно близка к ним, чтобы не строить дизайн-систему с нуля.

Стратегия: **подменить все 12 шагов трёх Radix-шкал (`violet`, `cyan`, `orange`) на брендовые эквиваленты через CSS-переменные**, и оставить `slate` как gray. После этого встроенные компоненты Radix (`Button`, `Badge`, `Callout`, `Tabs`, `Switch` и т.д.) автоматически начнут использовать брендовые цвета через стандартные `accentColor` и `color` пропы.

Это менее инвазивно чем полный кастом и сохраняет accessibility-гарантии Radix.

---

## 2. Брендовая палитра

| Имя | Hex | Семантическая роль |
|---|---|---|
| Core Black | `#05070A` | Главный фон приложения (dark) |
| Graphite | `#0E1117` | Поднятые поверхности — карточки, попапы, сайдбар (dark) |
| Mist White | `#F7F8FA` | Основной текст (dark) / фон страницы (light) |
| Logic Purple | `#701DFD` | Главный бренд-акцент. Primary CTA, активная навигация, AI-фичи |
| Signal Cyan | `#01C9FA` | Информационный канал: ссылки, info-нотификации, "новое/непрочитано", real-time |
| Deploy Orange | `#FD9C12` | Действие и внимание: дедлайны, warning-нотификации, важные акценты |

### Назначение в Radix-терминах

- `accentColor="violet"` — глобальный акцент темы → **Logic Purple**
- `color="cyan"` на компонентах → **Signal Cyan**
- `color="orange"` на компонентах → **Deploy Orange**
- `grayColor="slate"` — без изменений, она уже визуально близка к Core Black / Graphite / Mist White

---

## 3. Стратегия интеграции

### Почему мы переопределяем именно `violet`, `cyan`, `orange`

Это ближайшие по hue шкалы Radix к нашим брендовым цветам. Если переопределить именно их, можно использовать стандартный API Radix Themes (`accentColor`, `color` пропы) без создания собственных компонентов.

Альтернативой было бы создание собственных Custom Colors через генератор `radix-ui.com/colors/custom` с произвольными именами — но это требует переименования всего и не даёт преимуществ перед прямым переопределением встроенных шкал.

### Что не покрыто (пока)

- **Семантические цвета success/danger** — палитра бренда их не содержит. Радикс `jade` (success) и `red` (danger) можно использовать без модификации. См. раздел "Что НЕ покрыто" в конце.
- **Alpha-варианты** (`--violet-a1` ... `--violet-a12`) — нужны для оверлеев и `variant="soft"` компонентов. Их можно сгенерировать на [radix-ui.com/colors/custom](https://www.radix-ui.com/colors/custom) для каждого из трёх брендовых цветов. **Уточни у пользователя**, нужны ли они для текущей фазы.

---

## 4. Цветовые шкалы

Каждая шкала — 12 шагов. Шаг 9 — это точный брендовый hex. Остальные шаги построены по Radix-логике (см. раздел "Семантика шагов" ниже).

### 4.1. Логика шагов

Это стандартная семантика Radix Colors, повторяется для всех трёх шкал:

| Шаги | Назначение |
|---|---|
| **1–2** | Фоны (app background, subtle background) |
| **3–5** | Подложки компонентов (карточки, hover, selected) |
| **6–8** | Бордеры, focus-ring, разделители |
| **9** | Solid fill — primary button background, brand color |
| **10** | Hover state для шага 9 |
| **11** | Низкоконтрастный текст (на тёмных/светлых фонах) |
| **12** | Высококонтрастный текст (заголовки, акценты) |

### 4.2. Dark mode

#### Logic Purple (overrides `violet`)

| Step | Hex |
|---|---|
| 1 | `#110A1F` |
| 2 | `#170E2B` |
| 3 | `#221540` |
| 4 | `#2A1755` |
| 5 | `#321B6A` |
| 6 | `#3D2585` |
| 7 | `#4D2DA8` |
| 8 | `#5E1FD8` |
| **9** | **`#701DFD`** ← brand |
| 10 | `#8240FD` |
| 11 | `#B89BFF` |
| 12 | `#E0D4FF` |

#### Signal Cyan (overrides `cyan`)

| Step | Hex |
|---|---|
| 1 | `#06141C` |
| 2 | `#081A24` |
| 3 | `#082B3A` |
| 4 | `#073A50` |
| 5 | `#064867` |
| 6 | `#06587C` |
| 7 | `#066D97` |
| 8 | `#0386BB` |
| **9** | **`#01C9FA`** ← brand |
| 10 | `#36D5FB` |
| 11 | `#7FE6FE` |
| 12 | `#D6F6FF` |

#### Deploy Orange (overrides `orange`)

| Step | Hex |
|---|---|
| 1 | `#1A1006` |
| 2 | `#221608` |
| 3 | `#38210A` |
| 4 | `#4A2A0A` |
| 5 | `#5C320A` |
| 6 | `#6F3E08` |
| 7 | `#874C06` |
| 8 | `#BB6C00` |
| **9** | **`#FD9C12`** ← brand |
| 10 | `#FFB13E` |
| 11 | `#FFCB7A` |
| 12 | `#FFE5C4` |

### 4.3. Light mode

В Radix Colors light-режим инвертирован по lightness относительно dark: шаг 1 — почти белый с лёгким оттенком, шаг 12 — очень тёмный текстовый. Шаг 9 остаётся прежним — это брендовый солид, который работает в обоих режимах.

#### Logic Purple — light

| Step | Hex |
|---|---|
| 1 | `#FDFCFF` |
| 2 | `#F8F4FF` |
| 3 | `#EFE5FF` |
| 4 | `#E3D2FF` |
| 5 | `#D5BBFE` |
| 6 | `#C4A1F8` |
| 7 | `#AC82EE` |
| 8 | `#8B59E0` |
| **9** | **`#701DFD`** ← brand |
| 10 | `#6315E5` |
| 11 | `#5A12CC` |
| 12 | `#2C1668` |

#### Signal Cyan — light

| Step | Hex |
|---|---|
| 1 | `#FAFEFF` |
| 2 | `#F0FBFE` |
| 3 | `#DCF5FD` |
| 4 | `#BFEDFB` |
| 5 | `#97E2F8` |
| 6 | `#6BD2F2` |
| 7 | `#38BFE8` |
| 8 | `#11A6D6` |
| **9** | **`#01C9FA`** ← brand |
| 10 | `#00A8D4` |
| 11 | `#0C7B9C` |
| 12 | `#0A3947` |

#### Deploy Orange — light

| Step | Hex |
|---|---|
| 1 | `#FFFDF9` |
| 2 | `#FFF7EA` |
| 3 | `#FFEDCD` |
| 4 | `#FFE0A8` |
| 5 | `#FFCF7A` |
| 6 | `#FCBC4B` |
| 7 | `#F2A726` |
| 8 | `#DE9214` |
| **9** | **`#FD9C12`** ← brand |
| 10 | `#E58A08` |
| 11 | `#B26800` |
| 12 | `#4F2D00` |

---

## 5. Paste-ready CSS

Этот блок нужно вставить **после** импорта `@radix-ui/themes/styles.css`. Точное место в проекте зависит от структуры — **уточни у пользователя**, где у них глобальные стили (типично `app/globals.css`, `src/styles/globals.css`, или `_app.tsx`).

```css
/* ============================================================
   int3grate.ai — Radix Themes brand color overrides
   ============================================================ */

/* ----- LIGHT MODE ----- */
:root,
.light,
.light-theme {
  /* Logic Purple — overrides violet */
  --violet-1:  #FDFCFF;
  --violet-2:  #F8F4FF;
  --violet-3:  #EFE5FF;
  --violet-4:  #E3D2FF;
  --violet-5:  #D5BBFE;
  --violet-6:  #C4A1F8;
  --violet-7:  #AC82EE;
  --violet-8:  #8B59E0;
  --violet-9:  #701DFD;  /* brand */
  --violet-10: #6315E5;
  --violet-11: #5A12CC;
  --violet-12: #2C1668;

  /* Signal Cyan — overrides cyan */
  --cyan-1:  #FAFEFF;
  --cyan-2:  #F0FBFE;
  --cyan-3:  #DCF5FD;
  --cyan-4:  #BFEDFB;
  --cyan-5:  #97E2F8;
  --cyan-6:  #6BD2F2;
  --cyan-7:  #38BFE8;
  --cyan-8:  #11A6D6;
  --cyan-9:  #01C9FA;   /* brand */
  --cyan-10: #00A8D4;
  --cyan-11: #0C7B9C;
  --cyan-12: #0A3947;

  /* Deploy Orange — overrides orange */
  --orange-1:  #FFFDF9;
  --orange-2:  #FFF7EA;
  --orange-3:  #FFEDCD;
  --orange-4:  #FFE0A8;
  --orange-5:  #FFCF7A;
  --orange-6:  #FCBC4B;
  --orange-7:  #F2A726;
  --orange-8:  #DE9214;
  --orange-9:  #FD9C12;  /* brand */
  --orange-10: #E58A08;
  --orange-11: #B26800;
  --orange-12: #4F2D00;
}

/* ----- DARK MODE ----- */
.dark,
.dark-theme {
  /* Logic Purple — overrides violet */
  --violet-1:  #110A1F;
  --violet-2:  #170E2B;
  --violet-3:  #221540;
  --violet-4:  #2A1755;
  --violet-5:  #321B6A;
  --violet-6:  #3D2585;
  --violet-7:  #4D2DA8;
  --violet-8:  #5E1FD8;
  --violet-9:  #701DFD;  /* brand */
  --violet-10: #8240FD;
  --violet-11: #B89BFF;
  --violet-12: #E0D4FF;

  /* Signal Cyan — overrides cyan */
  --cyan-1:  #06141C;
  --cyan-2:  #081A24;
  --cyan-3:  #082B3A;
  --cyan-4:  #073A50;
  --cyan-5:  #064867;
  --cyan-6:  #06587C;
  --cyan-7:  #066D97;
  --cyan-8:  #0386BB;
  --cyan-9:  #01C9FA;   /* brand */
  --cyan-10: #36D5FB;
  --cyan-11: #7FE6FE;
  --cyan-12: #D6F6FF;

  /* Deploy Orange — overrides orange */
  --orange-1:  #1A1006;
  --orange-2:  #221608;
  --orange-3:  #38210A;
  --orange-4:  #4A2A0A;
  --orange-5:  #5C320A;
  --orange-6:  #6F3E08;
  --orange-7:  #874C06;
  --orange-8:  #BB6C00;
  --orange-9:  #FD9C12;  /* brand */
  --orange-10: #FFB13E;
  --orange-11: #FFCB7A;
  --orange-12: #FFE5C4;

  /* Brand surfaces — пиксель-точный фон страницы и панелей */
  --color-background:  #05070A;  /* Core Black */
  --color-panel-solid: #0E1117;  /* Graphite */
}

/* ----- LIGHT MODE SURFACES (опционально) ----- */
:root,
.light,
.light-theme {
  /* Если нужен точный Mist White как фон страницы вместо Radix-дефолта */
  --color-background:  #F7F8FA;
  /* --color-panel-solid: #FFFFFF; — Radix-дефолт обычно ОК */
}
```

> **Замечание про селекторы.** Я использовал `.dark`, `.dark-theme`, `.light`, `.light-theme` — это стандартные классы Radix Themes. Если в проекте используется другой механизм (например, `data-theme="dark"` или media query), **скорректируй селекторы**. Уточни у пользователя.

---

## 6. Конфигурация компонента Theme

В корне приложения:

```tsx
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import './styles/brand-colors.css';  // ← наши оверрайды (после Radix CSS!)

export default function RootLayout({ children }) {
  return (
    <Theme
      accentColor="violet"
      grayColor="slate"
      appearance="dark"        // или "light", или "inherit" для системного
      radius="medium"
      scaling="100%"
    >
      {children}
    </Theme>
  );
}
```

**Важно про порядок импортов:** наш `brand-colors.css` должен идти **после** `@radix-ui/themes/styles.css`, иначе оверрайды не применятся.

**Уточни у пользователя:**
- Какой `appearance` нужен по умолчанию? `dark`, `light`, или `inherit`?
- Есть ли в проекте переключатель темы? Если да — как он реализован (next-themes, useTheme hook, кастом)?

---

## 7. Паттерны использования в коде

### 7.1. Primary действия — Logic Purple (по умолчанию)

`accentColor="violet"` сделан глобальным, поэтому все компоненты без явного `color` пропа автоматически используют Logic Purple:

```tsx
<Button>New deal</Button>                          {/* фиолетовая кнопка */}
<Switch defaultChecked />                          {/* фиолетовый switch */}
<Tabs.Root>...</Tabs.Root>                        {/* фиолетовый индикатор активного таба */}
<Callout.Root>AI insight here</Callout.Root>      {/* фиолетовый callout */}
```

### 7.2. Информационные элементы — Signal Cyan

```tsx
<Badge color="cyan">NEW</Badge>
<Badge color="cyan" variant="soft">3 unread</Badge>
<Callout.Root color="cyan">
  <Callout.Icon><InfoCircledIcon /></Callout.Icon>
  <Callout.Text>You have 3 new leads since yesterday</Callout.Text>
</Callout.Root>
```

### 7.3. Внимание и дедлайны — Deploy Orange

```tsx
<Badge color="orange">OVERDUE</Badge>
<Badge color="orange" variant="soft">Deadline today</Badge>
<Callout.Root color="orange">
  <Callout.Text>7 tasks are overdue</Callout.Text>
</Callout.Root>
```

### 7.4. CSS-переменные напрямую (для кастомных компонентов)

Если есть кастомные компоненты вне Radix, можно ссылаться на переменные:

```css
.ai-insight-card {
  background: var(--violet-2);              /* subtle purple tint */
  border: 1px solid var(--violet-6);        /* purple border */
  color: var(--violet-12);                  /* readable purple text */
}

.ai-insight-card .icon {
  color: var(--violet-9);                   /* brand solid */
}
```

---

## 8. ⚠️ Важные caveats и warning'и про контрастность

### 8.1. Cyan и Orange — это "bright scales"

В Radix Colors есть две категории шкал:

- **"Deep" scales** (violet, blue, red, etc.) — на их шаге 9 читается **белый** текст
- **"Bright" scales** (sky, mint, lime, yellow, amber) — на их шаге 9 читается **тёмный** текст, потому что цвет слишком яркий

**Logic Purple `#701DFD`** — deep scale, всё работает по умолчанию.

**Signal Cyan `#01C9FA`** и **Deploy Orange `#FD9C12`** — это bright scales: яркость слишком высокая, белый текст на них читается плохо.

Проблема: мы переопределили `cyan` и `orange`, которые в Radix считаются "deep" — значит, `<Button color="cyan" variant="solid">` или `<Button color="orange" variant="solid">` отрендерятся **с белым текстом на ярком фоне**, и это будет нечитаемо.

### 8.2. Что с этим делать

Три варианта, выбрать по контексту:

**(a) Использовать `variant="soft"` вместо `solid`** — для cyan и orange это естественно, soft использует step 3 как фон и step 11 как текст:

```tsx
<Badge color="cyan" variant="soft">NEW</Badge>      {/* всегда читаемо */}
<Badge color="orange" variant="soft">OVERDUE</Badge>
```

**(b) Добавить `highContrast` проп** — увеличивает контраст автоматически:

```tsx
<Button color="cyan" highContrast>Action</Button>
```

**(c) CSS-оверрайд для текста на solid-cyan/orange кнопках:**

```css
/* Принудительно тёмный текст на ярких solid-кнопках */
.rt-Button[data-accent-color="cyan"][data-variant="solid"],
.rt-Badge[data-accent-color="cyan"][data-variant="solid"] {
  color: var(--cyan-12);
}

.rt-Button[data-accent-color="orange"][data-variant="solid"],
.rt-Badge[data-accent-color="orange"][data-variant="solid"] {
  color: var(--orange-12);
}
```

> **Уточни у пользователя**, какой подход они хотят. Рекомендую (a) как дефолт — `solid` для cyan/orange редко нужен, бренд-яркость уже даёт акцент.
>
> ⚠️ **Селекторы `[data-accent-color="..."]` могут отличаться** в разных версиях Radix Themes — проверь в DevTools актуальные атрибуты на компонентах в проекте.

### 8.3. Контрастные пары для проверки

Для AA WCAG / APCA при ручной верификации:

| Контекст | Цвет фона | Цвет текста | Режим |
|---|---|---|---|
| Primary button | `var(--violet-9)` `#701DFD` | white | dark + light |
| Cyan badge (solid) | `var(--cyan-9)` `#01C9FA` | `var(--cyan-12)` (тёмный) | dark + light |
| Orange badge (solid) | `var(--orange-9)` `#FD9C12` | `var(--orange-12)` (тёмный) | dark + light |
| Soft purple card | `var(--violet-3)` | `var(--violet-11)` | оба |
| Page text | `var(--color-background)` | `var(--gray-12)` | оба |

---

## 9. Что НЕ покрыто этим документом

### 9.1. Success / Danger семантика

В брендовой палитре нет зелёного/красного. Для CRM-функционала (won/lost deals, успешная отправка, ошибки валидации) рекомендую использовать Radix-шкалы **без модификации**:

- **Success → `jade`** (более приглушённый, чем `green`, лучше уживается с фиолетовым брендом)
- **Danger → `red`** (стандартный Radix)

Использовать только как точечные индикаторы статусов, иконки и валидацию. **Никогда** как primary CTA — они не должны конкурировать с Logic Purple за роль главного цвета.

```tsx
<Badge color="jade">Won</Badge>
<Badge color="red">Lost</Badge>
<Text color="red" size="2">Email is required</Text>
```

### 9.2. Alpha-варианты

Не сгенерированы. Нужны если в проекте используются `variant="soft"`, оверлеи на цветных фонах, или translucent панели. Можно сгенерировать на [radix-ui.com/colors/custom](https://www.radix-ui.com/colors/custom), вставив `#701DFD`, `#01C9FA`, `#FD9C12` поочерёдно.

### 9.3. Charts / Data viz

Если в проекте есть графики (Recharts, Chart.js, Visx, D3 и т.п.) — им нужен отдельный массив цветов, эти библиотеки не подхватывают CSS-переменные автоматически. Рекомендуемый порядок для CRM-метрик:

```ts
export const CHART_COLORS = {
  primary:   '#701DFD',   // Logic Purple — основная метрика
  secondary: '#01C9FA',   // Signal Cyan — справочная
  warning:   '#FD9C12',   // Deploy Orange — критичная
  success:   '#22C55E',   // jade-ish — положительная
  danger:    '#E5484D',   // red-ish — отрицательная
  neutral:   '#8B8D98',   // slate-9
};
```

### 9.4. Custom palette generation через официальный Radix-генератор

Все мои значения шагов 1–8 и 10–12 — это математическая аппроксимация. Официальный генератор Radix [radix-ui.com/colors/custom](https://www.radix-ui.com/colors/custom) использует APCA-корректировки и даёт более точные перцептуально-сбалансированные шкалы.

Если хочется **максимально аутентичных** Radix-шкал — прогнать там каждый из трёх брендовых hex'ов и заменить мои значения на сгенерированные. Шаг 9 (брендовый exact) при этом надо вручную вернуть на исходное значение, генератор может его слегка скорректировать. **Уточни у пользователя**, хочет ли он сделать этот дополнительный шаг.

---

## 10. ❓ Вопросы, которые нужно задать пользователю перед началом

Я не знаю контекст проекта, поэтому перед тем как лить эти изменения, пожалуйста, спроси у пользователя:

1. **Используется ли `@radix-ui/themes` или только `@radix-ui/react-*` примитивы?** Этот документ написан для Themes. Для голых примитивов подход будет принципиально другим.
2. **Где у проекта глобальные стили?** Куда вставлять CSS с оверрайдами — `app/globals.css`, `src/index.css`, `_app.tsx` или другое место?
3. **Как реализовано переключение тёмной/светлой темы?**
   - Класс `.dark` на `<html>` или на корневом `<Theme>`?
   - Атрибут `data-theme`?
   - Через `next-themes`?
   - Только тёмная тема (тогда блок light можно не вставлять)?
4. **Нужны ли alpha-варианты прямо сейчас**, или это позже? (Влияет на работоспособность `variant="soft"` поверх цветных фонов.)
5. **Какой `appearance` дефолтный** у `<Theme>` — `dark`, `light` или `inherit`?
6. **Стратегия для cyan/orange solid-кнопок** (см. секцию 8.2): использовать `soft` вариант / `highContrast` / CSS-оверрайд?
7. **Есть ли в проекте графики или data-viz?** Если да — какая библиотека и где определяются их цвета?
8. **Есть ли уже какие-то кастомизации `--violet-*` / `--cyan-*` / `--orange-*` в проекте?** Если да — мы их перепишем, надо убедиться что они нигде специально не нужны.
9. **Прогонять ли значения через официальный Radix-генератор** для более точной перцептуальной сбалансированности (см. 9.4)?
10. **Нужно ли добавить success/danger семантику сейчас**, или это отдельная задача? (См. 9.1.)

---

## 11. План имплементации (предлагаемый)

1. Уточнить у пользователя ответы на вопросы из секции 10.
2. Создать файл `styles/brand-colors.css` с содержимым из секции 5 (или в эквивалентном месте проекта).
3. Импортировать его после `@radix-ui/themes/styles.css` в глобальной точке входа.
4. Обновить `<Theme>` props: `accentColor="violet"`, `grayColor="slate"`.
5. Прогнать визуальный smoke-test:
   - Primary `<Button>` — должна быть Logic Purple
   - `<Badge color="cyan" variant="soft">` — должна быть Signal Cyan в мягком стиле
   - `<Badge color="orange" variant="soft">` — Deploy Orange
   - Переключить тему light/dark — обе должны выглядеть корректно
6. Решить проблему cyan/orange `solid`-кнопок по выбранной стратегии (8.2).
7. Если в проекте есть кастомные компоненты со своими цветами — пройтись по ним и заменить хардкод на CSS-переменные `var(--violet-*)` и т.д.

---

*Документ подготовлен на основе официальных гайдов Radix Colors и Radix Themes. Все цветовые значения шага 9 — точные брендовые hex'ы. Шаги 1–8 и 10–12 — HSL-аппроксимация, для пиксель-точного соответствия Radix-алгоритму прогнать через [radix-ui.com/colors/custom](https://www.radix-ui.com/colors/custom).*
