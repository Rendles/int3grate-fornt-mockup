# Backend gaps

Каталог мест в мокапе, где UI обещает функциональность, которой backend не предоставляет — либо endpoint отсутствует в gateway-спеке, либо данные синтезированы клиентом, либо это mock-only хак, либо UI ещё disabled.

Документ нужен бэкенд-команде, чтобы знать что нужно wired up перед production-deploy. Также служит подсказкой будущим итерациям мокапа.

> Зафиксировано после Phases 1-9 + 11. Все ссылки — относительно `docs/gateway.yaml` в репозитории. Для каждого пункта указано **где в UI** (file:line или surface), **что нужно** на стороне backend, и **степень критичности**.

---

## 1. Missing endpoints (UI calls, spec doesn't expose)

### 1.1 — `POST /auth/register` 🚨 critical

- **UI:** `RegisterScreen.tsx`, заполнение формы регистрации создаёт нового tenant + admin user.
- **Текущий мок:** `api.register()` создаёт нового user/tenant в `fxUsers` напрямую.
- **Что нужно от backend:** endpoint создания tenant + первого admin user. Возвращает `LoginResponse` (token + expires_at) + созданного user.
- **MockBadge:** ✅ помечен на `RegisterScreen.tsx:157`.

### 1.2 — `GET /users` 🚨 critical

- **UI:** Везде где UI резолвит имя по `user_id` (owner, requested_by, approver_user_id) — `AgentsScreen`, `ApprovalsScreen`, `ApprovalDetailScreen`, `RunDetailScreen`, `SettingsScreen` (Team members tab), и т.д.
- **Текущий мок:** `api.listUsers()` возвращает все `fxUsers`.
- **Что нужно от backend:** `GET /users?tenant_id=...` (или embedded в bearer scope). Минимально — `id`, `name`, `email`, `role`, `approval_level`. Учитывая privacy — возможно scoped views для `member` (видят только себя + admin контакты).
- **Альтернатива:** denormalize `name` в каждый response (сейчас уже есть `requested_by_name` в approvals — расширить до agent.owner_name, etc).

### 1.3 — `GET /approvals/{id}` ⚠️ medium

- **UI:** `ApprovalDetailScreen.tsx` — переход по deep-link `/approvals/:id`.
- **Текущий мок:** `api.getApproval(id)` ищет в `fxApprovals`.
- **Что нужно от backend:** добавить single-fetch endpoint. Сейчас в спеке только `GET /approvals` (list).

### 1.4 — `PATCH /agents/{id}` или транзиция `draft → active` ⚠️ medium

- **UI:** `AgentNewScreen.tsx:147` — после `activateVersion` мок мутирует `agent.status = 'active'` напрямую.
- **Текущий мок:** Hack — `fresh.status = 'active'` после `activateVersion`. Real backend почти наверняка флипает статус сам, но это не задокументировано в спеке.
- **Что нужно от backend:** либо POST `/agents/{id}/versions/{verId}/activate` сам флипает agent.status, либо отдельный endpoint `PATCH /agents/{id}` для status-перехода.

### 1.5 — Workspace CRUD ⏸ planned

- **UI:** `SettingsScreen` → Workspace tab — disabled buttons:
  - `Open billing (planned)` — Stripe customer portal redirect
  - `Rename (planned)` — `PATCH /tenants/{id}` для name
  - `Close (planned)` — `DELETE /tenants/{id}` или soft-archive
- **Текущий мок:** ничего (disabled UI).
- **Что нужно от backend:** см. выше. Билинг — отдельная интеграция со Stripe или другим биллинговым провайдером.

### 1.6 — User invitation (`POST /users`) ⏸ planned

- **UI:** `SettingsScreen` → Team members tab — disabled `Invite member (planned)` button.
- **Текущий мок:** ничего.
- **Что нужно от backend:** `POST /users` с email + role + optional approval_level. Email-инвайт flow или magic-link.

### 1.7 — Integration registry / OAuth flow ⏸ planned

- **UI:** `ToolsScreen.tsx` — `ConnectAppTile` + dialog с placeholder OAuth-flow. Phase 7 wizard step 2 — fake "Connect" toggle для каждого app prefix.
- **Текущий мок:** Click на Authorise → 1.5s setTimeout → success badge с явной пометкой "Connection placeholder".
- **Что нужно от backend:**
  - `GET /integrations` — каталог поддерживаемых сервисов с метаданными (icon, oauth scopes, tools provided).
  - `POST /integrations/{id}/oauth/start` — возвращает redirect URL на consent page.
  - `POST /integrations/{id}/oauth/callback` — приём code + установка credentials.
  - `GET /integrations/connected` — список уже connected сервисов на tenant.
  - `DELETE /integrations/{id}` — disconnect.
- **MockBadge:** ✅ на CTA + в dialog title + в info banner.

### 1.8 — Filter `/dashboard/runs?agent_id=` ⚠️ low

- **UI:** `AgentDetailScreen` (Activity tab), `ApprovalsScreen` (resolve agent name) — фильтрация runs по agent_id делается **client-side**.
- **Текущий мок:** `listRuns({ limit: 100 })` → `.filter(r => r.agent_id === id)`.
- **Что нужно от backend:** добавить optional `agent_id` query param к `/dashboard/runs` — иначе на больших данных N+1 fetch + клиент-сайд фильтрация уронят performance.

### 1.9 — Per-week spend buckets ⚠️ low

- **UI:** `SpendScreen.tsx:178` — 4-week trend sparkline.
- **Текущий мок:** Распределяет `(30d_total - 7d_total)` по 3 предыдущим неделям с детерминированным весом + реальный `7d` как четвёртая точка.
- **Что нужно от backend:** `GET /spend?bucket=week&range=4w` или эквивалент — раскладка по неделям.
- **MockBadge:** ✅ помечен на trend card.

### 1.10 — Batch grants fetch ⚠️ low

- **UI:** `ToolsScreen.tsx` — для построения "Used by N assistants" делает N+1 `getGrants(agentId)` для каждого agent.
- **Текущий мок:** `Promise.all(agents.map(a => api.getGrants(a.id)))` — 5-7 параллельных calls.
- **Что нужно от backend:** либо `GET /grants?tenant_id=...` (tenant-wide), либо `GET /agents?include=grants`.

### 1.11 — `requested_action` → human language

- **UI:** Везде где показывается approval action — `ApprovalsScreen` row, `ReviewCard` title, и т.д.
- **Текущий мок:** `prettifyRequestedAction()` парсит prefix `service.action` и подменяет через `toolLabel()` map.
- **Что нужно от backend:** возвращать поле `requested_action_label` (denormalised human text) или structured object (tool, args summary, target). Сейчас UI парсит free-form string — fragile.

---

## 2. Synthesized data on the client

### 2.1 — Cost trend (4 недели)

- **Где:** `SpendScreen.tsx` → `FourWeekTrend`.
- **Как синтезируется:** weights `[0.30, 0.34, 0.36, real_7d]` поверх `(30d - 7d)`. Псевдо-uptrend.
- **Backend должен:** см. §1.9.
- **MockBadge:** ✅.

### 2.2 — Activity sentence text

- **Где:** `RunsScreen.tsx` → `runHeadline()`.
- **Как:** mapping `RunStatus → "Sales Agent finished an activity"` etc. Не показывает что именно сделал AI ("found 3 leads", "sent email").
- **Backend должен:** возвращать `summary: string` в `RunListItem` или `RunDetail`. Это backend territory — orchestrator или summary-generator. Без этого client может только status-based templates.
- **MockBadge:** не помечено отдельно — это часть design language, не synthesized data per se. Но фактически — гэп.

### 2.3 — App connection status

- **Где:** `ToolsScreen.tsx` → `usedBy` list.
- **Как:** App считается Connected если хоть один agent имеет grant на любой tool этого app prefix-а. Реальная "connection" — это OAuth credentials, которых нет.
- **Backend должен:** см. §1.7.
- **MockBadge:** ✅ на CTA modal.

### 2.4 — Audit events from run steps

- **Где:** `lib/api.ts:461` — comment.
- **Как:** mock синтезирует audit events из steps в `fxRuns`. Реальный gateway передаёт `GET /internal/audit` от orchestrator.
- **Backend должен:** уже есть в спеке (`GET /audit`). Mock-only синтез — это просто fixture data generation. Не блокер.

### 2.5 — Date grouping (Today / Yesterday / This week / Earlier)

- **Где:** `RunsScreen.tsx` → `dateGroup()`.
- **Как:** client-side bucketing.
- **Backend должен:** ничего, это виз UI логика. Нет gap-а.

### 2.6 — Trend % vs previous week (Home + Costs hero)

- **Где:** `HomeScreen.tsx` Spending section, `SpendScreen.tsx` hero.
- **Как:** `prevWeek = (30d - 7d) × 7/23`, потом `(7d - prevWeek) / prevWeek × 100`. Использует два реальных endpoint'а.
- **Backend должен:** ничего обязательного — формула честная. Можно ускорить добавив `/spend?compare=previous_week`, но необязательно.
- **MockBadge:** не помечено (формально оба endpoint реальные).

### 2.7 — Activity heatmap (deleted in Phase 2)

- ~~Был в Phase 1, удалён в Phase 2~~. Больше не релевантно.

### 2.8 — Savings banner (deleted in Phase 2)

- ~~Был в Phase 1, удалён в Phase 2~~. Больше не релевантно.

---

## 3. Mock-only behavior (real backend handles differently)

### 3.1 — JWT format

- **Где:** `lib/api.ts:78-89`.
- **Mock:** token = `mock_<userId>`, decoder извлекает userId из строки.
- **Backend:** signed JWT с подписью + expiration. Frontend не должен decode-ить — gateway resolves через `GET /me`.
- **Migration impact:** zero — UI уже использует `GET /me`, JWT layout — implementation detail.

### 3.2 — Async approval decision polling

- **Где:** `lib/api.ts:570-643`, `ApprovalDetailScreen.tsx:79-112`.
- **Mock:** `setTimeout` 1.5-3s до flip approval, потом 2-3s до terminal run state.
- **Backend:** orchestrator асинхронно processit decision; UI polls `getApproval` + `getRun` (уже работает — это правильный pattern). Просто реальные latencies будут другие.
- **Migration impact:** zero — UI код одинаковый.

### 3.3 — Chat streaming (SSE simulation)

- **Где:** `components/chat-panel.tsx`, `lib/api.ts:sendChatMessage`.
- **Mock:** Async generator emit-ит фрейки `turn_start`, `text_delta`, `tool_call`, `tool_result`, `turn_end`, `done`.
- **Backend:** real `POST /chat/{id}/message` возвращает `text/event-stream`. Frontend reader: `fetch().body.getReader()` → parse SSE → emit frames.
- **Migration impact:** заменить producer в `api.sendChatMessage` на fetch+SSE reader. Consumer (UI) не меняется.

### 3.4 — In-memory mutations persist for page lifetime

- **Где:** все `api.create*` / `api.set*` / `api.close*` методы.
- **Mock:** мутирует fixture arrays напрямую. После refresh — данные сбрасываются.
- **Backend:** persistent storage. Refresh показывает реальное состояние.
- **Migration impact:** zero — UI код одинаковый.

### 3.5 — Agent status flip после createAgentVersion

- **Где:** `AgentNewScreen.tsx:147` (Phase 7 wizard).
- **Mock:** `fresh.status = 'active'` напрямую после `activateVersion`.
- **Backend:** см. §1.4.
- **Migration impact:** удалить хак, доверить backend-у транзицию.

---

## 4. Disabled UI features (planned, no backend yet)

### 4.1 — Pause AI worker / Fire AI worker

- **Где:** `AgentDetailScreen.tsx` → Settings tab.
- **Что нужно:** `PATCH /agents/{id}` со status transition, либо отдельные endpoint-ы `POST /agents/{id}/pause`, `DELETE /agents/{id}`.
- **Status:** disabled "(planned)".

### 4.2 — Manage billing / Rename workspace / Close workspace

- **Где:** `SettingsScreen.tsx` → Workspace tab.
- **Что нужно:** см. §1.5.
- **Status:** disabled "(planned)".

### 4.3 — Invite member

- **Где:** `SettingsScreen.tsx` → Team members tab.
- **Что нужно:** см. §1.6.
- **Status:** disabled "(planned)".

### 4.4 — Connect new app (Authorise per service)

- **Где:** `ToolsScreen.tsx` → `ConnectAppTile` dialog.
- **Что нужно:** см. §1.7.
- **Status:** functional placeholder (1.5s spinner → "Placeholder OK" badge с info banner).

### 4.5 — Diagnostic mode rendering

- **Где:** `SettingsScreen.tsx` → Diagnostic tab.
- **Что есть:** toggle пишет `localStorage["proto.diagnostic.v1"]`.
- **Чего нет:** conditional rendering technical hints в основном UI. Plan section 5 / 11 описывает что это должно показывать API endpoints в InfoHint обратно когда включено.
- **Status:** placeholder switch.

---

## 5. Plan-optional items (документированы как намеренно skipped)

### 5.1 — Edit-before-approve

- **Plan:** section 7.2 — option to edit approval action body before approving (e.g., edit email before sending).
- **Status:** не реализовано. Открытый design question — какие поля `evidence_ref` editable, как UX.

### 5.2 — Demo data mode

- **Plan:** section 8 шаг 5 + section 11 — fake activity / approvals / spend для нового пользователя плюс "Reset to clean workspace" button.
- **Status:** не реализовано. Полезно для sales-демо.

---

## 6. Tour copy debt (Phase 10 deferred)

- `sidebar-tour.tsx`, `approval-review-tour.tsx`, `configure-tool-grants-tour.tsx` — селекторы и тексты ссылаются на удалённые/перемещённые элементы (tour rebuild deferred).
- **Status:** ⏸ Deferred user-decision, not a backend issue.

---

## 7. Open questions for backend-product alignment

Эти вопросы открыты для backend-product alignment:

- **Notifications** — как пользователь узнаёт о новом approval? Email? In-app? Push? Backend должен expose-ить notification settings + delivery mechanism. Сейчас UI просто показывает badge на sidebar.
- **Diagnostic mode toggle** — нужно ли хранить per-tenant или per-user? UI кладёт в localStorage (per-browser).
- **Шаблоны AI-сотрудников** — `lib/templates.ts` имеет 7 hardcoded. Реально templates должны жить либо в backend (`/templates`), либо в client config — открыто.

---

## Сводная таблица приоритета для backend

| # | Что | Важность | Visually flagged in UI |
|---|---|---|---|
| 1.1 | `POST /auth/register` | 🚨 ship blocker | ✓ MockBadge on RegisterScreen |
| 1.2 | `GET /users` | 🚨 ship blocker | ✓ MockBadge on Settings → Team |
| 1.3 | `GET /approvals/{id}` | ⚠️ ship blocker для deep-links | ✓ MockBadge on ApprovalDetailScreen |
| 1.4 | Agent status flip endpoint | ⚠️ medium | — internal hack, no user surface |
| 1.7 | Integration registry + OAuth | ⏸ может быть post-MVP | ✓ MockBadge on Apps page + Connect modal + Wizard step 2 |
| 1.6 | User invitation | ⏸ может быть post-MVP | ✓ disabled "(planned)" button on Settings → Team |
| 1.5 | Workspace CRUD | ⏸ может быть post-MVP | ✓ MockBadge on Settings → Workspace + disabled buttons |
| 1.8 | Filter runs by agent_id | ⚠️ performance | — internal, not surface |
| 1.10 | Batch grants fetch | ⚠️ performance | — internal, not surface |
| 1.9 | Per-week spend buckets | ⚠️ low (есть workaround) | ✓ MockBadge on Costs trend chart |
| 1.11 | `requested_action` structured | ⚠️ low (есть workaround) | — invisible (transformation handled in helpers) |
| 4.1 | Pause/Fire endpoints | ⚠️ должно быть до GA | ✓ MockBadge on Settings tab → Manage employment |
| 2.2 | Activity sentence summary | ⚠️ улучшение UX | ✓ MockBadge on Activity page |

---

## Visual mock-flagging pass

Каждая user-facing surface, опирающаяся на синтезированные данные или отсутствующий endpoint, должна быть помечена `<MockBadge>`.

`<MockBadge>` имеет два kind-а:
- **`kind="design"`** — endpoint полностью отсутствует в спеке (синие/красные dashed pill «MOCK»)
- **`kind="deferred"`** — endpoint есть, но `x-mvp-deferred` (амбер dashed pill «DEFERRED»)

При наведении показывает hint с конкретной причиной.

---

**Last updated:** 2026-04-28 после Phase 11 + visual mock-flagging pass.
