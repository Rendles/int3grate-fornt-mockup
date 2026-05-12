# INT3GRATE.AI — описание проекта для брейншторма

## 1. Что это и для кого

**Продукт:** control-plane UI для управления AI-агентами, которых владелец малого бизнеса «нанимает» как цифровых сотрудников. Агенты выполняют задачи в реальных рабочих инструментах (Zoho CRM, почта, биллинг и т.д.).

**Целевой пользователь — Maria:** владелица сервисной компании 10–20 человек. Уверенно пользуется Zoho One и ChatGPT. **Agent-curious, не agent-naive, не developer.** Она пришла **именно за агентами** — слово «agent» не прячем, прячем технику вокруг него. Документацию не читает, onboarding из 8 экранов не выдержит, обучается прямо в интерфейсе.

**Центральная метафора — «моя маленькая цифровая команда»:** агенты = сотрудники с именами, аватарами, должностями, статусом, отчётом за период. Не workflow, не automation, не nodes.

**Главная тревога — контроль.** Любое внешнее действие (письмо клиенту, обновление CRM, оплата) **по умолчанию проходит approval** до выполнения. У агента видимый pause/stop. Доверие — лестница: каждое действие → trusted типы автономно → агент работает сам с briefing'ами.

**Aha moment** должен случаться в первые минуты после connect Zoho — продукт показывает **реальную работу с реальными данными**, а не пустой dashboard и onboarding-туры.

---

## 2. Стек

- **Vite + React 19 + TypeScript** (single-page app)
- **Radix Themes** + кастомные стили в `src/prototype/prototype.css` (тёмная «приборная панель», палитра через Radix CSS-переменные)
- **Hand-rolled hash router** (`#/agents`, `#/approvals`, …) — нет react-router, есть свой `matchRoute`
- **Hugeicons** (`@hugeicons/react`) через `<Icon icon={…} />` обёртку
- **Inter** — единственный шрифт
- **Никакого backend в проекте**: всё работает на in-memory fixtures в `src/prototype/lib/fixtures.ts`. Mutations живут до refresh.

Команды: `npm run dev`, `npm run build` (`tsc -b` строгий — `noUnusedLocals`/`noUnusedParameters`/`verbatimModuleSyntax`), `npm run lint`. Тестов нет. Дев на `http://localhost:5173/#/`.

---

## 3. Архитектура

```
src/App.tsx                    — 5-строчный wrapper, монтирует <PrototypeApp />
src/prototype/                  — собственно продукт-мокап
  index.tsx                     — провайдеры + Router (плоский список routes)
  router.tsx                    — useRouter, <Link>, navigate
  auth.tsx                      — AuthProvider, session в localStorage["proto.session.v1"]
  prototype.css                 — все стили под .prototype-root scope
  lib/
    types.ts                    — единственный источник истины для shapes (1:1 с gateway.yaml)
    fixtures.ts                 — все мок-данные (агенты, runs, chats, approvals, workspaces, …)
    api.ts                      — единственный data layer; все экраны ходят сюда
    format.ts                   — все human-readable helpers (money, ago, roleLabel, toolLabel, …)
    templates.ts                — 7 starter-шаблонов агентов для Hire wizard
    quick-hire.ts               — общий handler для двухкликового найма
    workspace-context.ts        — singleton с currentWorkspaceId
    use-hire-template.ts        — хук, оборачивающий quickHire
  components/
    common/                     — PageHeader, MetricCard, Status, Pagination, MockBadge, …
    fields.tsx                  — TextInput, SelectField, PasswordField, TextAreaField
    states.tsx                  — Banner, EmptyState, ErrorState, LoadingList, NoAccessState
    chat-panel.tsx              — full + embed mode (SSE-стрим из api.sendChatMessage)
    workspace-switcher.tsx      — свитчер в header сайдбара
    workspace-form-dialog.tsx
    workspace-delete-dialog.tsx
    workspace-remount.tsx       — remount при смене workspace
    quick-hire-grid.tsx         — grid шаблонов для двухкликового найма
    approval-card.tsx           — inline-карточка approval с reason expand + 5s undo
    retrain-dialog.tsx          — переинструктирование (новая версия агента)
    undo-toast.tsx
    grants-editor.tsx
    icon.tsx + icons.tsx        — двухслойная обёртка над Hugeicons
  screens/                      — экраны
  dev/dev-mode-provider.tsx     — bug-icon в topbar форсит api.ts в empty/loading/error
  tours/                        — game-style туры (overlay, спот-лайт). Engine рабочий, копи stale.
```

**Mounting tree (`index.tsx`):**
`AuthProvider` → `RouterProvider` → `DevModeProvider` → `TrainingModeProvider` → (`TrainingBanner`, `TourProvider` → (`DevModeRemount` → `WorkspaceRemount` → `Router`, `TourOverlay`, `WelcomeToast`, `TrainingAutoExit`)).

**Ключевая граница — `lib/api.ts`:**
- Каждый метод `await delay()` 120-380 мс, потом мутирует fixtures напрямую.
- Все list-методы возвращают envelope `{ items, total, limit, offset }` (как в spec).
- Chat-стрим — `AsyncIterable<ChatStreamFrame>` через async generator.
- При swap на реальный backend — заменить только этот файл, остальные экраны не трогать.

---

## 4. Backend-контракт и его дыры

**Канонический контракт:** `docs/gateway.yaml` — OpenAPI 3.2.0, **синхронизирован verbatim с live stage backend** (`https://stage.api.int3grate.ai/docs/openapi.yaml`, последний pull 2026-05-01). Это **то, что бэк действительно отдаёт**, а не то, что мы хотели бы.

**Что в spec есть:** auth (`POST /auth/login`, `GET /me`), agents + versions, tool grants, runs, chats (SSE), audit, approvals, spend, tool catalog (`/tool-catalog`).

**Чего в spec НЕТ (полный каталог в `docs/backend-gaps.md`):**

| # | Gap | Импакт UI |
|---|---|---|
| 1.1 | `POST /auth/register` | Register screen скрыт |
| 1.2 | `GET /users` | Все surfaces с user-name удалены, кроме `requested_by_name` денормализации |
| 1.4 | `PATCH /agents/{id}` (Pause/Fire) | Settings скрыт, manage-employment surface удалён |
| 1.5 | Workspace CRUD | **Главная актуальная дыра — см. §6** |
| 1.6 | Invite member | Settings → Team скрыт |
| 1.7 | Integration registry / OAuth | **Архитектурно не будет** — Int3grate владеет shared credentials, нет per-tenant OAuth. Apps page скрыт. |
| 1.13 | `AgentVersion.*_config` | Speculated Advanced cards удалены 2026-05-06 |
| 2.2 | Activity sentence summary | Headlines синтезируются клиентом из `RunStatus` |

**Любая mock-only surface помечается `<MockBadge>`** (kind="design" — endpoint'а нет, kind="deferred" — есть но `x-mvp-deferred`). Hover показывает причину.

---

## 5. Routes и экраны (актуальные)

```
/                         HomeScreen      — операционный dashboard
/login, /profile, /learn
/agents                   AgentsScreen    — list. В sidebar лейбл «Team»
/agents/new               AgentNewScreen  — Hire wizard (welcome chat → quick-hire grid → draft)
/agents/:id/{overview,talk,grants,activity,settings,advanced}
/agents/:id/talk/:chatId  — embedded chat
/agents/:id/versions/new  — retrain
/approvals                ApprovalsScreen — card/table toggle, badge count в sidebar
/approvals/:id            ApprovalDetailScreen
/activity                 RunsScreen      — лента того, что агенты сделали
/activity/:runId          RunDetailScreen — Technical view ("advanced")
/costs                    SpendScreen     — overview
/sandbox/team-bridge      — design preview, preview-badge в sidebar
/workspaces               WorkspacesScreen — list + Create/Edit/Delete (через свитчер)
```

Legacy redirects: `/runs[/...]` → `/activity[/...]`, `/spend` → `/costs`, `/chats` → `/agents`, `/chats/:id` → `/agents/:agentId/talk/:chatId`.

**Скрыто (закомментировано, не удалено — restore-ready):** `/register`, `/apps`, `/tools`, `/settings*`, `/audit`. Файлы экранов сохранены.

**Sidebar — 5 production пунктов + 1 sandbox preview:**
1. Home (`/`)
2. Approvals (`/approvals`) — с badge
3. Activity (`/activity`) — audit log сложен сюда, отдельного `/audit` нет
4. **Team** (`/agents`) — лейбл «Team», route остаётся `/agents`
5. Costs (`/costs`)
6. Team Bridge sandbox (через divider)

Header сайдбара: brand → **WorkspaceSwitcher** → nav. Footer: user.

---

## 6. Domain model — ключевые сущности

Полный список — в `src/prototype/lib/types.ts`. Главное:

- **`User`** — `id, tenant_id, email, name, role: 'member'|'domain_admin'|'admin', approval_level: 1..4`
- **`Agent`** — `id, name, description, status: 'draft'|'active'|'paused'|'archived', active_version, owner_user_id, total_spend_usd?, runs_count?` (1:1 со spec, **нет** `workspace_id`)
- **`AgentVersion`** — `instruction_spec` + 4 `*_config: Record<string, unknown>` (внутренняя форма НЕ зафиксирована — spec пишет `additionalProperties: true`, поэтому никаких полей внутри них в UI не показываем)
- **`RunDetail` / `RunListItem`** — статусы: `pending|running|suspended|completed|completed_with_errors|failed|cancelled`. Steps: `llm_call|tool_call|memory_read|memory_write|approval_gate|validation`
- **`Chat`** — статусы `active|closed|failed`, роли сообщений `user|assistant|tool|system`. Streaming через SSE-фреймы (`turn_start|text_delta|tool_call|tool_result|turn_end|done|error`)
- **`ApprovalRequest`** — `requested_action, requested_by_name, approver_role, status, reason, evidence_ref, expires_at`. Decision: `approved|rejected`
- **`SpendDashboard`** — range `1d|7d|30d|90d`, group_by `agent|user`
- **`AuditEvent`** — tenant-scoped, объединяет run + chat events
- **`Workspace` (mock-only)** — `id, name, description?, created_at`. Membership: `workspace_id, user_id, joined_at`. **Нет в spec.** Agent → Workspace — side-table `agentWorkspace: Record<agent_id, workspace_id>` в fixtures.

**Авторизация:** `Role = 'member' | 'domain_admin' | 'admin'`, `ApprovalLevel = 1..4`. Три seeded user'а: `frontend@int3grate.ai` (Ada, admin L4), `domain@int3grate.ai` (Marcelo, domain_admin L3), `member@int3grate.ai` (Priya, member L1). Любой пароль работает.

---

## 7. Что было добавлено последним (актуальный контекст)

**Workspaces — мульти-воркспейсный mock (2026-05-06):**
- `WorkspaceSwitcher` в header сайдбара: радио-лист memberships, `+ Create workspace`, `Manage workspaces`, MockBadge.
- `/workspaces` — list + Create/Edit/Delete, type-the-name confirm, Members card.
- `lib/workspace-context.ts` singleton + `WorkspaceRemount` — при смене workspace re-mount всего Router subtree, чтобы list-screens перезапрашивали данные с новым scope'ом.
- Filter cascade в `api.list*` — `listAgents/listApprovals/listRuns/listAudit/listChats/getSpend` фильтруют по `getCurrentWorkspaceId()`.
- Session расширена: `localStorage["proto.session.v1"]` теперь содержит `currentWorkspaceId`.
- **Vocabulary важно:** user-facing label — `Workspace`, **НЕ `Team`** (это коллизия с `/agents` лейблом «Team»). Workspace = контейнер уровня компании/отдела (Slack/Linear/Notion convention).

Backend дыры этого куска подробно: `docs/backend-gaps.md § 1.15`. План: `docs/agent-plans/2026-05-06-2200-workspaces-mock.md`.

---

## 8. Vocabulary rules — критично для любой новой фичи

**Таблица перевода (mandatory, см. `docs/ux-spec.md § 8`):**

| Не пишем | Пишем |
|---|---|
| Deploy | Hire |
| Configure | Train / Brief |
| Workflow | Playbook |
| Run / Execute | Ask / Assign |
| Tools / Connectors | What they can access |
| Errors / Failures | Got stuck — needs help |
| Logs / Traces | Activity |
| Tokens / Costs | Hours worked / monthly bill |
| Model | (не упоминать вообще) |
| Prompt | Instruction / Brief |
| Tenant / Organization | **Workspace** |
| **Agent** | **Agent** (оставляем!) |

**Запрещённые слова в UI:** workflow, MCP, tokens, model, prompt, JSON, run, execution, trace, context window, orchestration, system prompt, temperature.

**Запрещённый тон:** «Hey friend! 👋», «Awesome! 🎉», конфетти, мультяшные роботы, фиолетовые градиенты, AI sparkles, тёмный неон.

**Регистр:** Zoho/QuickBooks/HubSpot — спокойный, бизнесовый. «Sarah is ready. Connect Zoho to let her review your leads.»

**Visible vs internal:** правила касаются только того, что видит пользователь. Внутренние вещи (`Agent` тип, файл `AgentNewScreen.tsx`, URL `/agents`, переменная `tokenCount`, `ChatMessageRole = 'assistant'`, nav key `assistants`, interface `AssistantTemplate`) — **не трогаем**. § 11.2 ux-spec.

**ID не показываем юзеру.** `Agent.name` вместо `agent.id`. Для refs — `shortRef(id)` → `#4081`.

---

## 9. Анти-паттерны (чек-лист)

Не делаем, под запретом:
- node-based workflow editor / DAG как основной UI
- onboarding > 3 экранов до первой пользы
- мультяшные роботы, конфетти, AI sparkles
- внешние действия без approval по умолчанию для нового агента
- агент без имени/аватара/должности
- pause/stop не очевиден
- автономия как бинарный switch вместо лестницы
- aha moment откладывается за onboarding-туром
- aha moment на пустом dashboard'е

---

## 10. Шаблон работы над новой фичей

Codified в `CLAUDE.md` и `AGENTS.md`:

1. **Прочитать** `docs/ux-spec.md` (§ 8 vocab, § 11 для agent), `docs/backend-gaps.md` (что бэк может, чего нет), `docs/backlog.md` (что уже обсуждалось).
2. **Проверить spec** (`docs/gateway.yaml`) — есть ли endpoint, или это будет mock-only.
3. **Создать план** в `docs/agent-plans/YYYY-MM-DD-HHMM-task-name.md` с разделами: summary, current state, files inspected, assumptions, approach, risks, step-by-step, verification, browser test, progress log.
4. **Если mock-only — добавить запись в `backend-gaps.md`** + `<MockBadge>` на surface + явный path для backend wiring.
5. **One step per cycle** — сделал шаг, остановился, отчитался, ждёт «продолжай».
6. **Lint + build clean** перед declaring done (TS strict).

---

## 11. Известные открытые направления

Из `docs/backlog.md`:

- **Empty states с инструкциями** (часть сделана: `/agents` empty показывает `<QuickHireGrid />`, Home в empty workspace — `<EmptyHomeHero />` с CTA `Build your team`). Остаются: `/approvals`, `/activity`, `/costs`, `/agents/:id/talk` (no past chats), `/agents/:id/activity` (no per-agent activity).
- **Inline approve/reject** (1+2) — сделан как `/sandbox/approvals-inline`, на production пока не промоушен. Решение отложено.
- **Trust ladder UI** — концепт из ux-spec, видимая прогрессия для каждого агента по типам задач, в продукте **ещё не показана** — сильный candidate под брейншторм.
- **Notifications** — как Maria узнаёт о новом approval? Сейчас только sidebar badge. Open question, см. backend-gaps § 7.
- **Aha moment flow** — продукт его не показывает на реальных данных в первые минуты; требует connect Zoho + auto-проход агента по лидам. Архитектурно завязано на бэк.
- **Edit-before-approve** (§ 5.1 backend-gaps) — отредактировать черновик письма перед approve. Открытый дизайн-вопрос.

Хорошие зоны для новой фичи: всё что усиливает **trust ladder, контроль, aha moment, или per-agent отчётность** — это сердце продукта. Всё что добавляет конфигурацию, workflow-редакторы, model/prompt-настройки — против духа продукта.

---

## 12. Что важно сказать второй модели

- **Stack:** Vite + React 19 + TS + Radix Themes + кастомный CSS + hand-rolled hash router + in-memory mock api.
- **Никакого backend** — все мутации до refresh. Бэк будет позже, и UI говорит со spec'ом, а не с фантазиями.
- **Любая фича либо опирается на endpoint в `gateway.yaml`, либо это mock-only с `<MockBadge>` + запись в `backend-gaps.md`.**
- **User — Maria, не developer.** Если фича требует от неё понимать workflow / model / prompt / tokens — фича сделана неправильно.
- **Контроль > удобство.** Любое внешнее действие → approval. Это не feature, это ось.
- **Команда, не automation.** Агенты с именами, аватарами, ролями.
- **Vocabulary не косметика** — vocab-нарушения чаще всего сигналят о более глубокой проблеме модели (см. ux-spec § 11.3).
