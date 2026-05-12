# 2026-05-12 1900 — `blue` → `cyan` / `violet` semantic split

> Follow-up к `2026-05-12-1700-radix-brand-color-system.md`. Та миграция перевела `amber → orange`, `green → jade`, accent `indigo → violet`, но шкалу `blue` не трогала. В результате брендовая **Signal Cyan** определена в `brand-colors.css`, но в UI почти не задействована — 8 точек против 30, где висит generic Radix `blue` (не наш бренд).

## 1. Task summary

Развести существующие 30+ применений `color="blue"` / `var(--blue-*)` по семантике:

- **Bucket A — info/in-progress** (streaming, running, pending, info-banner): `blue` → `cyan` (Signal Cyan, наш бренд).
- **Bucket B — accent/selected/identity** (primary CTA, active filter tab, role/version/plan badge, hyperlink ref, "Active" indicator): `blue` → `violet` (Logic Purple, наш бренд accent).

После миграции `color="blue"` / `var(--blue-*)` в `src/` остаться не должно. Шкала Radix `blue` физически остаётся в Themes — мы её не переопределяем — но в нашем коде она перестаёт использоваться.

## 2. Current repository state

- Бренд-система: `src/prototype/brand-colors.css` переопределяет `violet`, `cyan`, `orange` шкалы (light + dark + alpha). Шкала `blue` НЕ переопределена — рендерится Radix-дефолтом (≈ `#0090FF`).
- Theme accent: `accentColor="violet"` (`src/prototype/index.tsx:176`). Все `var(--accent-*)` резолвятся в Logic Purple.
- В коде сосуществуют:
  - `color="blue"` (~22 места) — generic Radix blue.
  - `var(--blue-9 | --blue-11 | --blue-a3 | --blue-a4)` (~8 мест) — generic Radix blue.
  - `color="cyan"` (8 мест: status.tsx, avatar.tsx, ApprovalDetailScreen waiting badge, ProfileScreen approval-level, AuditScreen/RunDetailScreen/SettingsScreen running status, ToolsScreen read_only, grants-editor read mode) — наш Signal Cyan.
  - `var(--cyan-a4)` (1 место: prototype.css:853 login glow).
- Анти-патт: `info` tone в трёх map-ах (`states.tsx`, `RunsScreen TONE`, `command-bar` VALUE_COLOR, `avatar` TONE_COLOR, `status` TONE_COLOR) частично уже мапится в `cyan` (status/avatar), частично — в `blue` (states/RunsScreen). Несогласованно.

## 3. Relevant files inspected

TSX `color="blue"`:
- `components/shell.tsx:155` (nav count badge default branch)
- `components/retrain-dialog.tsx:181` (Submit CTA)
- `components/chat-panel.tsx:459, 462, 534` (streaming model badge, "streaming…" text, tool-call "running…" text)
- `components/common/workspace-filter.tsx:89` (active workspace chip)
- `components/common/avatar.tsx:9` (TONE_COLOR.accent)
- `components/common/status.tsx:9` (TONE_COLOR.accent)
- `components/common/command-bar.tsx:5-6` (VALUE_COLOR.accent)
- `components/states.tsx:9` (BANNER_COLOR.info)
- `screens/WorkspacesScreen.tsx:135` ("Active" badge)
- `screens/SpendScreen.tsx:189` (range tab active)
- `screens/SettingsScreen.tsx:88, 280, 334, 339` (Pro plan, source filter active, activity/chat links)
- `screens/AuditScreen.tsx:132, 186, 191` (source filter active, activity/chat links)
- `screens/AgentsScreen.tsx:111` (filter tab active)
- `screens/ToolsScreen.tsx:142` (connection filter active)
- `screens/RunsScreen.tsx:341` (TabButton active)
- `screens/ApprovalsScreen.tsx:409` (non-pending status filter active fallback)
- `screens/ApprovalDetailScreen.tsx:599` (running badge in banner)
- `screens/ProfileScreen.tsx:36` (role badge)
- `screens/AgentDetailScreen.tsx:642` (version badge)

TSX `var(--blue-*)`:
- `screens/RunsScreen.tsx:39` (TONE.info bg/fg)
- `screens/home/AdminView.tsx:25, 26` (STATUS_TONE.running, .pending)
- `screens/sandbox/TeamBridgeScreen.tsx:607, 608` (RUN_TONE.running, .pending)
- `screens/ApprovalDetailScreen.tsx:710` (stepTone pending: bg + fg)
- `screens/SettingsScreen.tsx:508` (diagnostic info-box bg)
- `screens/ToolsScreen.tsx:406` (Connection placeholder info-box bg)

## 4. Assumptions and uncertainties

### Подтверждённые (по предыдущему обмену 2026-05-12)

| # | Решение |
|---|---|
| 1 | Cyan = Signal Cyan (info / streaming / running / pending). |
| 2 | Violet = Logic Purple (accent / selected / brand identity). |
| 3 | Pending approvals в `ApprovalsScreen:409` остаются `orange` — semantic warn, не accent. Не трогаем. |
| 4 | Брендовая Signal Cyan читаема на soft-badge (step 3 / a3) во всех нужных размерах — solid-contrast fix из 1700-плана покрывает только solid variant. Текущие use-кейсы — soft / outline / a3 bg, проблем не ожидается. |

### Не подтверждённые / нюансы

- **Hyperlink цвет**. `SettingsScreen` и `AuditScreen` имеют `<Text size="1" color="blue">activity #abc</Text>` — это inline-ссылки. Предлагаю `violet` (accent — стандартная "link"-конвенция, плюс violet хорошо читается в обеих темах). Альтернатива — `cyan` для отличия от primary actions; не выбираю, потому что violet согласован с "this is a clickable navigation".
- **`retrain-dialog` Submit**: можно либо `color="violet"`, либо вообще **убрать prop** (Radix Button без `color` наследует Theme accent → violet). Выбираю **убрать prop** — это самый идиоматичный путь для primary CTA, плюс если accent потом изменится, кнопка следует.
- **Identity badges** (`Pro` plan, role, version, "Active" workspace): тоже можно убрать prop. Но эти бэйджи — брендовые маркеры, не «текущий accent». Если accent позже изменится — захочется ли, чтобы `Pro` тоже сменил цвет? Скорее нет — это **брендовая идентификация**, она должна оставаться Logic Purple даже если accent уехал. → **Explicit `color="violet"`**.
- **Filter tabs** (active state): conditional `color={isActive ? 'blue' : 'gray'}`. Drop prop в active-ветке невозможно — нужна явная пара. → **Explicit `color="violet"`**.
- **CSS-var в JS** (`var(--blue-9)` в inline styles): варианты — `var(--accent-9)` (резолвится в текущий accent) или `var(--cyan-9)` (наш бренд info). Для Bucket A берём **`var(--cyan-9)`** (по семантике). Bucket B в JS inline нет — все они Radix-component props.

## 5. Proposed approach

3-шаговый sweep, каждый шаг изолирован и проверяется отдельно.

1. **Шаг 1 — Bucket A** (info / streaming / running / pending → cyan).
2. **Шаг 2 — Bucket B** (selected / accent / identity → violet, с убиранием prop где это primary CTA без conditional).
3. **Шаг 3 — Verification** (`grep` clean, `npm run lint && npm run build` clean, ручная браузер-проверка по чек-листу).

Tour copy / `tours/*.tsx` НЕ трогаем (rebuild deferred — CLAUDE.md правило).

## 6. Risks and trade-offs

1. **Cyan a3 read-on-dark**. Light-cyan bg на dark теме (`var(--cyan-a3)`) на info-box будет тёмно-кобальтовый с прозрачностью. Может оказаться менее контрастным чем blue-a3. Mitigation: smoke-test в dark теме на `SettingsScreen` Diagnostic info-box; если плохо — поднять до `--cyan-a4`. Risk: low.
2. **Violet перенасыщение**. После шага 2 фильтр-табы в 7 экранах станут violet — суммарно много фиолетового рядом с violet primary buttons / accent ring. Может смотреться монохромно. Mitigation: в браузер-тесте смотрим на `/agents`, `/audit`, `/activity` — если выглядит душно, можно понизить selected-tab до `cyan` (но тогда теряем семантику info/selected, не хочется). Risk: medium.
3. **Avatar `accent` tone → violet**. Аватары в `welcome-chat-flow` уже мигрировали в violet (через accent inheritance, не через TONE_COLOR — мы там убирали prop). Сейчас изменение `TONE_COLOR.accent: 'blue' → 'violet'` — это для других мест, где `<Avatar tone="accent">`. Грепаю: один такой кейс — в `quick-hire-grid.tsx`? Проверю на старте Step 2.
4. **Type unions**. `command-bar.tsx` имеет `Record<Tone, 'blue' | 'orange' | 'gray'>`. После замены string union обновляется на `'violet' | 'orange' | 'gray'`. TS должен это проглотить — `Code color` prop принимает все Radix-colors. Risk: low, ловится `npm run build`.
5. **Tour selectors**. `data-tour` attrs не используют цвет, селекторы не должны ломаться. Tour text может ссылаться на "blue tab" — тур rebuild deferred, копия может протухать. Лог: проверить `grep "blue" tours/` — если есть, отметить (но не править).
6. **localStorage badge tone "accent" / "info"**. Не используется — bucket nav badge tones — `'warn' | 'muted' | undefined`. `undefined` → default `blue` branch. После Step 1 это станет `cyan`. ✓ ОК.

## 7. Step-by-step implementation plan

### Step 1 — Bucket A: blue → cyan (info / in-progress)

**TSX `color="blue"` → `color="cyan"`** (9 точек):
- `components/shell.tsx:155` — default badge color branch.
- `components/chat-panel.tsx:459, 462, 534` — streaming badge, streaming text, running text.
- `components/states.tsx:9` — `BANNER_COLOR.info: 'blue' → 'cyan'`.
- `screens/ApprovalDetailScreen.tsx:599` — running badge.

**TSX `var(--blue-*)` → `var(--cyan-*)`** (8 точек):
- `screens/RunsScreen.tsx:39` — `info: { bg: 'var(--cyan-9)', fg: 'var(--cyan-11)' }`.
- `screens/home/AdminView.tsx:25, 26` — running, pending → `var(--cyan-9)`.
- `screens/sandbox/TeamBridgeScreen.tsx:607, 608` — running, pending → `var(--cyan-9)`.
- `screens/ApprovalDetailScreen.tsx:710` — `bg: var(--cyan-a4), fg: var(--cyan-11)`.
- `screens/SettingsScreen.tsx:508` — `background: var(--cyan-a3)`.
- `screens/ToolsScreen.tsx:406` — `background: var(--cyan-a3)`.

**Verify**: `npm run build` + `npm run lint` clean. В браузере:
- `#/approvals/<id>` (status: in-progress) — running badge cyan, pending step pill cyan-tint.
- `#/activity` — info-tone бэйджи цианом (когда status = `running`).
- `#/` (Home Admin) — running/pending bars цианом.
- `#/settings` (Diagnostic tab) — info-box cyan-tint.
- `#/sandbox/team-bridge` — running/pending plates цианом.
- Любой chat с активным streaming — `streaming…` подпись и tool-call `running…` циановые.

### Step 2 — Bucket B: blue → violet (selected / accent / identity)

**Drop `color="blue"` prop entirely** (1 точка — primary CTA без conditional):
- `components/retrain-dialog.tsx:181` — `<Button color="blue">` → `<Button>` (наследует accent).

**TSX `color="blue"` → `color="violet"`** (21 точка):

Maps:
- `components/common/avatar.tsx:9` — `TONE_COLOR.accent: 'blue' → 'violet'`.
- `components/common/status.tsx:9` — `TONE_COLOR.accent: 'blue' → 'violet'`.
- `components/common/command-bar.tsx:5-6` — `VALUE_COLOR.accent: 'blue' → 'violet'`; обновить type union `'blue' | 'orange' | 'gray'` → `'violet' | 'orange' | 'gray'`.

Identity badges:
- `screens/SettingsScreen.tsx:88` — Pro plan badge.
- `screens/ProfileScreen.tsx:36` — role badge.
- `screens/AgentDetailScreen.tsx:642` — version badge.
- `screens/WorkspacesScreen.tsx:135` — "Active" badge.

Hyperlinks:
- `screens/SettingsScreen.tsx:334, 339` — activity / chat ref text.
- `screens/AuditScreen.tsx:186, 191` — activity / chat ref text.

Active filter tabs:
- `components/common/workspace-filter.tsx:89` — `active ? 'violet' : 'gray'`.
- `screens/SpendScreen.tsx:189` — `r === range ? 'violet' : 'gray'`.
- `screens/SettingsScreen.tsx:280` — source filter active.
- `screens/AuditScreen.tsx:132` — source filter active.
- `screens/AgentsScreen.tsx:111` — agent filter active.
- `screens/ToolsScreen.tsx:142` — connection filter active.
- `screens/RunsScreen.tsx:341` — TabButton active.
- `screens/ApprovalsScreen.tsx:409` — `f === 'pending' ? 'orange' : 'violet'` (non-pending active fallback).

**Verify**: `npm run build` + `npm run lint` clean. В браузере:
- `#/workspaces` — "Active" pill фиолетовая.
- `#/profile` — role badge фиолетовый, `approval · L*` остаётся цианом (это уже cyan).
- `#/settings` — Pro plan badge фиолетовый, source tabs active = фиолет.
- `#/agents/<id>` (Overview) — `v{N}` badge фиолетовый.
- `#/agents` — filter tabs active фиолетовые.
- `#/audit`, `#/activity` — source/filter tabs active фиолетовые; ссылки activity #abc / chat #abc фиолетовые.
- `#/costs` — range tabs active фиолетовые.
- `#/approvals` — non-pending filter (approved/rejected) active фиолетовый, pending остаётся orange.
- `#/agents/<id>` retrain dialog — Submit кнопка primary accent (фиолетовая solid).

### Step 3 — Verification & cleanup

1. `grep -rn 'color="blue"\|var(--blue-' src/` — должно быть пусто (за исключением, возможно, комментариев / tour copy, см. § 6 риск 5).
2. `npm run lint && npm run build` — обязательно clean.
3. Browser smoke-test по § 9.
4. Если визуально что-то diff'ит (см. § 6 риски) — список под решение перед merge.

## 8. Verification checklist

- [ ] `grep -rn "color=\"blue\"" src/` → 0 совпадений.
- [ ] `grep -rn "var(--blue-" src/` → 0 совпадений в TSX. (В `prototype.css` `--blue-*` не используется — заранее проверено.)
- [ ] `grep -rn "'blue'" src/prototype/components src/prototype/screens` → только в комментариях / type unions комментариях, если найдётся.
- [ ] `npm run lint` clean.
- [ ] `npm run build` clean.
- [ ] Dark + light тема проверены.

## 9. Browser testing instructions for the user

1. `npm run dev` → открыть `http://localhost:5173/#/`.
2. Залогиниться `frontend@int3grate.ai` / `demo`.
3. **Bucket A (cyan, info)**:
   - `#/` — на dashboard hbar у running/pending bars цвет должен быть Signal Cyan (`#01C9FA`), не голубой Radix-blue.
   - `#/approvals/<любой pending>` — открыть; banner с `running` badge — циан. Step pill `pending` — циан-tint.
   - `#/activity` — найти run со статусом `running` — badge циан.
   - `#/settings` → Diagnostic — переключить switch, info-box подсветится cyan-tint.
   - `#/sandbox/team-bridge` — running/pending plates цианом.
   - Chat: открыть `#/agents/<id>/talk` → отправить "test" → во время streaming должен быть Signal Cyan model badge и `streaming…` подпись.
4. **Bucket B (violet, accent)**:
   - `#/workspaces` — текущий workspace помечен violet `Active`.
   - `#/profile` — role badge фиолетовый; `approval · L4` остаётся cyan.
   - `#/settings` — Pro plan фиолет; source tabs (Audit history / Chat history) active = фиолет.
   - `#/agents/<id>` Overview — `v3` (или similar) badge фиолет.
   - `#/agents` — agent filter tabs (all / live / paused / fired) active = фиолет.
   - `#/audit` — source tab active фиолет; activity/chat ссылки в строках фиолетовые.
   - `#/costs` — range tabs (7d / 30d / 90d) active = фиолет.
   - `#/approvals` — переключение фильтра: pending → orange, approved/rejected → фиолет.
   - `#/agents/<id>` → Retrain — открыть диалог, Submit кнопка solid violet.
5. **Light theme**:
   - Переключить `localStorage.setItem('proto.theme.v1', 'light'); location.reload()`.
   - Повторить ключевые точки выше. Особо: cyan info-box (`SettingsScreen` Diagnostic) контрастен в light теме.

## 10. Progress log

- **2026-05-12 19:00** — План создан. Жду `продолжай` для Step 1.
- **2026-05-12 19:15** — **Step 1 done.** Bucket A (info / in-progress) → cyan.
  - TSX `color="blue"` → `color="cyan"` (6 точек): `shell.tsx:155`, `chat-panel.tsx:459,462,534`, `states.tsx:9` (BANNER_COLOR.info), `ApprovalDetailScreen.tsx:599` (running badge).
  - TSX `var(--blue-*)` → `var(--cyan-*)` (8 точек): `RunsScreen.tsx:39`, `home/AdminView.tsx:25,26`, `sandbox/TeamBridgeScreen.tsx:607,608`, `ApprovalDetailScreen.tsx:710`, `SettingsScreen.tsx:508`, `ToolsScreen.tsx:406`.
  - `npm run lint` clean, `npm run build` clean.
- **2026-05-12 19:30** — **Step 2 done.** Bucket B (selected / accent / identity) → violet.
  - `retrain-dialog.tsx:181` — prop `color="blue"` удалён (Submit наследует Theme accent → violet).
  - TONE_COLOR maps (3 файла): `avatar.tsx`, `status.tsx`, `command-bar.tsx` — `accent: 'blue' → 'violet'`. В `command-bar` обновлён type union.
  - `avatar.tsx:39` — fallback `?? 'blue'` → `?? 'violet'`.
  - Identity badges (4): `SettingsScreen.tsx:88` (Pro plan), `ProfileScreen.tsx:36` (role), `AgentDetailScreen.tsx:642` (version), `WorkspacesScreen.tsx:135` (Active).
  - Hyperlinks (4): `SettingsScreen.tsx:334,339`, `AuditScreen.tsx:186,191`.
  - Active filter tabs (8): `workspace-filter.tsx:89`, `SpendScreen.tsx:189`, `SettingsScreen.tsx:280`, `AuditScreen.tsx:132`, `AgentsScreen.tsx:111`, `ToolsScreen.tsx:142`, `RunsScreen.tsx:341`, `ApprovalsScreen.tsx:409` (non-pending fallback).
  - `npm run lint` clean, `npm run build` clean.
- **2026-05-12 19:32** — **Step 3 done.** Final verification.
  - `grep -rn 'color="blue"\|var(--blue-' src/` → 0 совпадений.
  - `grep -rn "'blue'" src/` → 0 совпадений.
  - lint + build clean.
- **2026-05-12 19:45** — **Step 2 reverted to variant 1.** Пользователь после browser-теста сказал что не хотел violet — ожидал blue → cyan везде. Откатываю 19 точек: violet → cyan.
  - `retrain-dialog.tsx:181` — вернули prop, теперь `color="cyan"` (не drop, не violet).
  - TONE_COLOR maps: `avatar`, `status`, `command-bar` — `accent: 'cyan'`. Это значит, что `accent` и `info` tone-buckets теперь оба резолвятся в cyan (визуально неразличимы — желаемое поведение пользователя).
  - `avatar.tsx:39` fallback `?? 'cyan'`.
  - Все identity badges, hyperlinks, active filter tabs — `cyan`.
  - `ApprovalsScreen.tsx:409` — `f === 'pending' ? 'orange' : 'cyan'` (pending остаётся orange).
  - `grep blue/violet` — 0 совпадений в `src/prototype/`. Единственное `'violet'` — `accentColor='violet'` в Theme config (это правильно, Theme accent сохраняется).
  - `npm run lint` clean, `npm run build` clean.
  - **Финальное состояние**: всё бывшее `blue` теперь `cyan` (Signal Cyan), без семантической разбивки.
