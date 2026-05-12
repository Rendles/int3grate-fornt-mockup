# Landing handoff — Int3grate.AI цветовая палитра

> **Кому:** команде, которая собирает лендинг int3grate.ai.
> **От кого:** фронт продуктового приложения (этот репозиторий).
> **Цель:** синхронизировать цвета лендинга с приложением. Это **обновлённая** палитра — на лендинге, скорее всего, до сих пор использованы Radix-дефолты (`indigo`/`amber`/`green`/`blue`), их надо заменить.
>
> Канонический исходник палитры — [`docs/int3grate-radix-color-system.md`](./int3grate-radix-color-system.md). Этот файл — практический срез того, что **уже внедрено** в приложении (`src/prototype/brand-colors.css`).
>
> Дата актуализации: 2026-05-12.

---

## 1. TL;DR

Поверх Radix Themes (если используете) или поверх своих CSS-переменных переопределите **три шкалы** — `violet`, `cyan`, `orange` — на брендовые. `slate` (gray) и семантические `jade` (success) / `red` (danger) оставьте как есть. Шкалы `amber`, `green`, `indigo`, `blue` использовать **нельзя** — они мигрированы в брендовые эквиваленты.

| Хочу… | Использовать |
|---|---|
| Primary CTA, акцент, фокус-ринг | `violet` (= Logic Purple `#701DFD`) |
| Info / новое / real-time | `cyan` (= Signal Cyan `#01C9FA`) |
| Warn / дедлайн / внимание | `orange` (= Deploy Orange `#FD9C12`) |
| Success | `jade` (Radix default, без оверрайда) |
| Danger / error | `red` (Radix default, без оверрайда) |
| Нейтрали / текст / поверхности | `slate` (Radix default, без оверрайда) |

---

## 2. Брендовая палитра (6 опорных цветов)

| Имя | Hex | Семантическая роль |
|---|---|---|
| **Core Black** | `#05070A` | Фон страницы (dark mode) |
| **Graphite** | `#0E1117` | Поднятые поверхности — карточки, попапы, сайдбар (dark) |
| **Mist White** | `#F7F8FA` | Фон страницы (light mode) / основной текст (dark) |
| **Logic Purple** | `#701DFD` | Главный бренд-акцент — primary CTA, активная нав., focus ring, AI-фичи |
| **Signal Cyan** | `#01C9FA` | Информационный канал — info-нотификации, "новое", real-time, identity tags |
| **Deploy Orange** | `#FD9C12` | Действие и внимание — warn, дедлайны, ожидающие действия |

---

## 3. Полные 12-шаговые шкалы

Шаги 1–8 — фоны, бордеры, soft-варианты. Шаг **9 — точный брендовый hex** (используется для solid-кнопок, badge fill, brand-индикаторов). Шаги 10–12 — hover и текст.

### 3.1. Dark mode

#### Logic Purple (`--violet-*`)

| Step | Hex | Назначение |
|---|---|---|
| 1 | `#110A1F` | App background |
| 2 | `#170E2B` | Subtle background |
| 3 | `#221540` | UI element bg |
| 4 | `#2A1755` | Hovered UI |
| 5 | `#321B6A` | Active / selected UI |
| 6 | `#3D2585` | Subtle border |
| 7 | `#4D2DA8` | UI border |
| 8 | `#5E1FD8` | Hovered border / focus ring |
| **9** | **`#701DFD`** | **Solid backgrounds (brand)** |
| 10 | `#8240FD` | Hovered solid |
| 11 | `#B89BFF` | Low-contrast text |
| 12 | `#E0D4FF` | High-contrast text |

#### Signal Cyan (`--cyan-*`)

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
| **9** | **`#01C9FA`** |
| 10 | `#36D5FB` |
| 11 | `#7FE6FE` |
| 12 | `#D6F6FF` |

#### Deploy Orange (`--orange-*`)

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
| **9** | **`#FD9C12`** |
| 10 | `#FFB13E` |
| 11 | `#FFCB7A` |
| 12 | `#FFE5C4` |

### 3.2. Light mode

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
| **9** | **`#701DFD`** |
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
| **9** | **`#01C9FA`** |
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
| **9** | **`#FD9C12`** |
| 10 | `#E58A08` |
| 11 | `#B26800` |
| 12 | `#4F2D00` |

---

## 4. Surface tokens

Если используете Radix Themes, эти переменные надо перекрыть для пиксель-точного совпадения с приложением:

| Token | Light | Dark |
|---|---|---|
| `--color-background` (фон страницы) | `#F7F8FA` (Mist White) | `#05070A` (Core Black) |
| `--color-panel-solid` (карточки) | `var(--gray-2)` ⚠️ | `#0E1117` (Graphite) |

⚠️ В light-режиме panel **намеренно не белый**: чистый `#FFFFFF` на фоне Mist White теряет высоту — карточки исчезают. Используем `var(--gray-2)` (≈ `#F1F2F4`).

---

## 5. Paste-ready CSS

Полный блок, готовый к копированию. Включает все 12 opaque-шагов + 12 alpha-шагов для каждой из трёх шкал, в обоих режимах. Alpha-значения сгенерированы скриптом по фоновому цвету каждого режима — **руками не править**.

```css
/* ============================================================
   int3grate.ai — brand color overrides
   ============================================================
   Если используете Radix Themes — этот блок должен идти
   ПОСЛЕ @radix-ui/themes/styles.css.
   Если у себя своя система CSS-переменных — приведите имена
   (--violet-N / --cyan-N / --orange-N) к своим конвенциям. */

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
  --violet-a1:  rgba(253, 252, 255, 1);
  --violet-a2:  rgba(248, 244, 255, 1);
  --violet-a3:  rgba(239, 229, 255, 1);
  --violet-a4:  rgba(227, 210, 255, 1);
  --violet-a5:  rgba(205, 172, 255, 0.8);
  --violet-a6:  rgba(102, 0, 244, 0.3508);
  --violet-a7:  rgba(89, 0, 225, 0.4758);
  --violet-a8:  rgba(79, 0, 209, 0.6411);
  --violet-a9:  rgba(94, 0, 253, 0.8831);
  --violet-a10: rgba(85, 0, 227, 0.9153);
  --violet-a11: rgba(78, 0, 200, 0.9274);
  --violet-a12: rgba(24, 0, 90, 0.9113);

  /* Signal Cyan — overrides cyan */
  --cyan-1:  #FAFEFF;
  --cyan-2:  #F0FBFE;
  --cyan-3:  #DCF5FD;
  --cyan-4:  #BFEDFB;
  --cyan-5:  #97E2F8;
  --cyan-6:  #6BD2F2;
  --cyan-7:  #38BFE8;
  --cyan-8:  #11A6D6;
  --cyan-9:  #01C9FA;    /* brand */
  --cyan-10: #00A8D4;
  --cyan-11: #0C7B9C;
  --cyan-12: #0A3947;
  --cyan-a1:  rgba(250, 254, 255, 1);
  --cyan-a2:  rgba(238, 252, 255, 0.8);
  --cyan-a3:  rgba(202, 243, 255, 0.6);
  --cyan-a4:  rgba(0, 199, 254, 0.2267);
  --cyan-a5:  rgba(0, 191, 245, 0.3887);
  --cyan-a6:  rgba(0, 181, 236, 0.5668);
  --cyan-a7:  rgba(0, 174, 227, 0.7733);
  --cyan-a8:  rgba(0, 160, 211, 0.9312);
  --cyan-a9:  rgba(0, 201, 250, 0.996);
  --cyan-a10: rgba(0, 168, 212, 1);
  --cyan-a11: rgba(0, 117, 151, 0.9514);
  --cyan-a12: rgba(0, 49, 63, 0.9595);

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
  --orange-a1:  rgba(255, 253, 249, 1);
  --orange-a2:  rgba(255, 247, 234, 1);
  --orange-a3:  rgba(255, 237, 205, 1);
  --orange-a4:  rgba(255, 224, 168, 1);
  --orange-a5:  rgba(255, 207, 122, 1);
  --orange-a6:  rgba(254, 162, 0, 0.7);
  --orange-a7:  rgba(241, 152, 0, 0.848);
  --orange-a8:  rgba(220, 137, 0, 0.92);
  --orange-a9:  rgba(253, 149, 0, 0.928);
  --orange-a10: rgba(228, 134, 0, 0.968);
  --orange-a11: rgba(178, 104, 0, 1);
  --orange-a12: rgba(79, 45, 0, 1);

  /* Brand surfaces, light. Panel = gray-2 by design — Mist White
     page + pure-white panel loses elevation. */
  --color-background:  #F7F8FA;
  --color-panel-solid: var(--gray-2);
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
  --violet-a1:  rgba(145, 42, 255, 0.0857);
  --violet-a2:  rgba(139, 59, 255, 0.1347);
  --violet-a3:  rgba(137, 71, 255, 0.2204);
  --violet-a4:  rgba(126, 59, 255, 0.3061);
  --violet-a5:  rgba(120, 58, 255, 0.3918);
  --violet-a6:  rgba(117, 67, 255, 0.502);
  --violet-a7:  rgba(117, 66, 255, 0.6449);
  --violet-a8:  rgba(111, 36, 255, 0.8408);
  --violet-a9:  rgba(113, 29, 255, 0.9918);
  --violet-a10: rgba(131, 64, 255, 0.9918);
  --violet-a11: rgba(184, 155, 255, 1);
  --violet-a12: rgba(224, 212, 255, 1);

  /* Signal Cyan — overrides cyan */
  --cyan-1:  #06141C;
  --cyan-2:  #081A24;
  --cyan-3:  #082B3A;
  --cyan-4:  #073A50;
  --cyan-5:  #064867;
  --cyan-6:  #06587C;
  --cyan-7:  #066D97;
  --cyan-8:  #0386BB;
  --cyan-9:  #01C9FA;    /* brand */
  --cyan-10: #36D5FB;
  --cyan-11: #7FE6FE;
  --cyan-12: #D6F6FF;
  --cyan-a1:  rgba(19, 184, 255, 0.0735);
  --cyan-a2:  rgba(33, 186, 255, 0.1061);
  --cyan-a3:  rgba(20, 191, 255, 0.1959);
  --cyan-a4:  rgba(12, 186, 255, 0.2857);
  --cyan-a5:  rgba(8, 178, 255, 0.3796);
  --cyan-a6:  rgba(7, 181, 255, 0.4653);
  --cyan-a7:  rgba(7, 184, 255, 0.5755);
  --cyan-a8:  rgba(2, 183, 255, 0.7224);
  --cyan-a9:  rgba(1, 205, 255, 0.9796);
  --cyan-a10: rgba(55, 216, 255, 0.9837);
  --cyan-a11: rgba(128, 231, 255, 0.9959);
  --cyan-a12: rgba(214, 246, 255, 1);

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
  --orange-a1:  rgba(58, 30, 0, 0.4);
  --orange-a2:  rgba(150, 82, 0, 0.2);
  --orange-a3:  rgba(255, 134, 10, 0.204);
  --orange-a4:  rgba(255, 134, 10, 0.276);
  --orange-a5:  rgba(255, 131, 10, 0.348);
  --orange-a6:  rgba(255, 137, 5, 0.424);
  --orange-a7:  rgba(255, 140, 2, 0.52);
  --orange-a8:  rgba(187, 108, 0, 1);
  --orange-a9:  rgba(255, 157, 18, 0.992);
  --orange-a10: rgba(255, 177, 62, 1);
  --orange-a11: rgba(255, 203, 122, 1);
  --orange-a12: rgba(255, 229, 196, 1);

  /* Brand surfaces, dark — Core Black page, Graphite panel. */
  --color-background:  #05070A;
  --color-panel-solid: #0E1117;
}

/* ============================================================
   BRIGHT-SCALE SOLID CONTRAST FIX
   Signal Cyan и Deploy Orange на шаге 9 слишком яркие — белый
   текст на них нечитаем. Принудительно тёмный текст (шаг 12) на
   solid-кнопках и badge с этими акцентами. См. § 7 ниже.
   ============================================================ */
.rt-Button[data-accent-color="cyan"][data-variant="solid"],
.rt-Badge[data-accent-color="cyan"][data-variant="solid"] {
  color: var(--cyan-12);
}
.rt-Button[data-accent-color="orange"][data-variant="solid"],
.rt-Badge[data-accent-color="orange"][data-variant="solid"] {
  color: var(--orange-12);
}
```

---

## 6. Маппинг ролей → шкалы (как использовать в коде)

| Состояние / роль | Шкала | Примеры в приложении |
|---|---|---|
| Primary CTA, активная нав., focus ring, AI-фичи | `violet` (Theme accent) | `<Button>Hire agent</Button>`, активный sidebar item, `<PageHeader em>` |
| Info / новое / real-time / identity tag | `cyan` | streaming/running состояния, info-баннер, role/version badge, "Active workspace" pill |
| Warn / pending / dedline | `orange` | pending approvals, partial-error borders, mock-badge |
| Success | `jade` (Radix default) | Allow / Completed / Won badges |
| Danger / error / destructive | `red` (Radix default) | Reject / Failed / Delete |
| Нейтрали — текст, бордеры, поверхности | `slate` (Radix default) | `var(--gray-12)` для основного текста |

**Запрещено** использовать в продакшен-коде (мигрированы 2026-05-12):
- ❌ `amber` → `orange`
- ❌ `green` → `jade`
- ❌ `indigo` → `violet`
- ❌ `blue` → `cyan`

---

## 7. ⚠️ Контрастность на bright scales (важно для лендинга)

В Radix есть две категории шкал:

- **Deep scales** (`violet`, `red`, `jade`) — на шаге 9 читается **белый** текст.
- **Bright scales** (`cyan`, `orange` после нашего оверрайда) — шаг 9 слишком яркий, белый текст **не читается**.

Что это значит для лендинга:

1. **Primary CTA — Logic Purple.** На `--violet-9` (`#701DFD`) белый текст контрастирует — это безопасный дефолт.
2. **Hero accent / "NEW" / "В реальном времени" pills** — Signal Cyan, **только `soft`-вариант** (фон step 3, текст step 11). Не делайте solid cyan кнопок с белым текстом.
3. **CTA "Записаться" / "Skip the wait" / "Limited offer"** — Deploy Orange, **только `soft`-вариант** ИЛИ solid с тёмным текстом (CSS-фикс выше уже это делает для Radix-компонентов).

Контрастные пары для ручной проверки (AA WCAG):

| Контекст | Фон | Текст |
|---|---|---|
| Primary button | `var(--violet-9)` `#701DFD` | white |
| Cyan badge / pill (solid) | `var(--cyan-9)` `#01C9FA` | `var(--cyan-12)` dark |
| Orange badge / pill (solid) | `var(--orange-9)` `#FD9C12` | `var(--orange-12)` dark |
| Soft purple block | `var(--violet-3)` | `var(--violet-11)` |
| Body text on page | `var(--color-background)` | `var(--gray-12)` |

---

## 8. Чарты / data-viz (если есть)

CSS-переменные графические библиотеки (Recharts / Chart.js / D3) не подхватывают автоматически. Передавайте хексы напрямую:

```ts
export const CHART_COLORS = {
  primary:   '#701DFD',   // Logic Purple — основная метрика
  secondary: '#01C9FA',   // Signal Cyan — справочная
  warning:   '#FD9C12',   // Deploy Orange — критичная
  success:   '#3FA37A',   // jade-ish (Radix jade-9)
  danger:    '#E5484D',   // red-ish (Radix red-9)
  neutral:   '#8B8D98',   // slate-9
};
```

---

## 9. Логотип и градиенты

- Если на лендинге есть градиентный hero / glow — собирайте его из брендовых трёх: `Logic Purple → Signal Cyan` (cool / AI-feel) или `Logic Purple → Deploy Orange` (energetic / action).
- Фоновые glow / "звёздное небо" — на тёмном Core Black с подсветками `--violet-a4` / `--cyan-a3`.
- Не вводите новых hex-значений вне этой палитры. Любой новый цвет должен идти через одну из шести брендовых ролей.

---

## 10. Что делать дальше

1. Скопируйте CSS из § 5 в глобальный стилевой файл лендинга (после Radix-стайлов, если Radix Themes используется).
2. Найдите и замените все остатки `indigo` / `amber` / `green` / `blue` Radix-шкал на соответствующие новые (см. § 6).
3. Если есть кастомные hex'ы вне этой палитры — мигрируйте на `var(--violet-*)` / `var(--cyan-*)` / `var(--orange-*)` / `var(--gray-*)`.
4. Прогнать визуальный smoke-test на hero / pricing / footer — primary CTA должен быть Logic Purple, pending / promo badges — soft orange, "new feature" pills — soft cyan.
5. Проверить light + dark режимы, если оба поддерживаются.

---

## 11. Контакты и источники

- Полный спек палитры с обоснованием: [`docs/int3grate-radix-color-system.md`](./int3grate-radix-color-system.md)
- Реализация в приложении: `src/prototype/brand-colors.css`
- Общий handoff лендингу (позиционирование, копи, страницы): [`docs/landing-handoff.md`](./landing-handoff.md) — **внимание:** секция 2.1 этого файла устарела (там ещё указан `indigo`); этот документ — корректный источник по цветам.
