# Бэклог идей и улучшений

Живой список идей, которые обсуждались но ещё не запланированы как отдельный agent-plan. При старте сессии — пройтись по этому списку с пользователем, спросить что брать в работу.

Каждый пункт: **краткое описание · мотивация · статус**. Когда пункт уходит в работу — создаётся `docs/agent-plans/YYYY-MM-DD-…-*.md`, статус здесь меняется на `→ в работе`. Когда сделано — пункт переезжает в «Сделано» или удаляется.

---

## Открытые

### 1. Упростить механизм аппрувов

**Идея:** возможно стоит вообще убрать отдельную страницу `/approvals/:approvalId` для принятия решения и сделать всё через модалку.

**Мотивация (от пользователя):** текущий flow — клик на approval → переход на отдельный экран → решение → возврат. Похоже на overkill для того что по сути «да/нет с комментарием».

**Что обсудить перед реализацией:**
- Что именно остаётся на детальном экране? Long-form контекст (full args, preview, related run trace) — это часто нужно, или редко?
- Если модалка — где она открывается? Из списка `/approvals`? Из dashboard widget'а? Из notification toast'а?
- Что с deep-linkable URL для approval? (e.g., бэк может слать ссылку в email — там нужен addressable экран)
- Если убираем отдельный экран, ссылки `#/approvals/:id` нужны как redirect на `/approvals` с открытой модалкой?

**Статус:** → в работе. Реализовано как sandbox preview в `/sandbox/approvals-inline` — inline approve/reject из списка решает оба пункта (1 и 2) без отдельного модал-экрана. См. `docs/agent-plans/2026-05-04-1714-approvals-inline-actions-sandbox.md`. Решение по промоушну в production откладывается до отдельного раунда.

---

### 2. Быстрый approve/reject прямо из списка

**Идея:** на странице `/approvals` (и/или из dashboard widget'а Pending approvals) — короткая модалка-confirm с описанием, без перехода на детальный экран.

**Мотивация (от пользователя):** Maria видит «10 запросов на разрешение», она хочет 80% из них прокликать в один шаг — без 10 переходов туда-обратно. Только спорные открывает детально.

**Что обсудить перед реализацией:**
- Связан с пунктом 1: если 1 = «всё через модалку», то это уже то же самое. Если 1 = «оставить экран, добавить inline confirm» — это два разных контрола.
- Какие минимальные данные показать в quick-confirm: agent name, action label (`gmail.send` / `payments.charge`), affected resource, opcional comment field?
- Какие approvals **нельзя** quick-approve и обязательно требуют детального экрана? (e.g., high-risk ones, level-3+, multi-step)?
- Ошибки: если quick-confirm падает (server reject, race), как показываем — toast, inline, escalation на детальный экран?

**Статус:** → в работе. Объединено с пунктом 1 в `/sandbox/approvals-inline`: каждая строка получает inline `Approve` / `Reject` (с reason expand) + 5s undo. См. `docs/agent-plans/2026-05-04-1714-approvals-inline-actions-sandbox.md`.

---

### 3. Empty states с инструкциями и быстрым CTA

**Идея:** когда у пользователя пустой экран (нет агентов, нет approvals, нет activity, нет past chats) — сразу показывать короткую инструкцию что делать + кнопку для следующего действия.

**Мотивация (от пользователя):** для нового пользователя пустой экран — это «и что теперь?». Maria открыла проект, видит «No agents yet» — должна моментально понимать «нужно нанять» и где кнопка.

**Что обсудить перед реализацией:**
- Где конкретно? Полный список empty-state экранов: `/agents` (no team), `/approvals` (no pending), `/activity` (no runs), `/costs` (no spend), `/agents/:id/talk` (no past chats — тут уже есть thin hint в sidebar), `/agents/:id/activity` (no per-agent activity).
- Какой объём инструкции — одно предложение, чек-лист, видео, картинка? У нас в `EmptyState` уже есть `body` + опциональный `action` button, насколько надо расширять?
- Onboarding-like? Different from обычного empty state — после первого hire приветственный flow?
- Tie-in с уже существующим WelcomeToast и `/learn` route — не создавать ли overlap.

**Статус:** частично сделано (agent-focused кусочек). 2026-05-05 — `/agents` empty-state теперь рендерит inline `<QuickHireGrid />` с шаблонами вместо `EmptyState`-карточки, HomeScreen в empty workspace показывает `<EmptyHomeHero />` с CTA `Build your team` → `/agents`. Member видит neutral copy без CTA. См. `docs/agent-plans/2026-05-05-1230-empty-state-quick-hire-onboarding.md`. Остаётся открытым: `/approvals` (no pending), `/activity` (no runs), `/costs` (no spend), `/agents/:id/talk` (no past chats), `/agents/:id/activity` (no per-agent activity).

---

## Сделано

- **2026-05-05 · Empty-state onboarding на `/agents` и Home (частичный пункт #3).** `/agents` пустой workspace теперь показывает inline `<QuickHireGrid />` с 6 шаблонами (Sales / Marketing / Reports / Support / Finance / Operations) вместо `EmptyState`-карточки — пользователь нанимает первого агента в два клика. HomeScreen в empty workspace показывает `<EmptyHomeHero />` с одним CTA `Build your team` → `/agents`. Status-фильтры и search на `/agents` скрываются при empty (нечего фильтровать). Member видит neutral copy без CTA. Reusable `<QuickHireGrid mode="standalone" \| "embedded" />` в `components/quick-hire-grid.tsx` — sandbox `/sandbox/quick-hire` теперь тонкая обёртка над ним. См. `docs/agent-plans/2026-05-05-1230-empty-state-quick-hire-onboarding.md`.

- **2026-05-04 · Quick-hire sandbox preview.** Two-click hire flow на `/sandbox/quick-hire`: grid из 6 шаблонов агентов с inline-accordion preview (longPitch / apps / sample tasks / approvals / Hire button). Hire идёт через ту же API-цепочку что production wizard (`createAgent → createVersion → setGrants → activateVersion`). Не висело в Открытых — было обсуждено и спланировано отдельно. См. `docs/agent-plans/2026-05-05-1100-quick-hire-sandbox.md`.

- **2026-05-04 · Dev-mode page-state toggle.** Bug-icon в topbar (`Real / Empty / Loading / Error`) для быстрой проверки состояний экранов без правки фикстур. Override на уровне `api.ts`. См. `src/prototype/dev/`. Не висело отдельным пунктом в Открытых — добавлено сразу как инструмент перед задачей #3 (empty states).

---

## История изменений

- 2026-05-02 — файл создан. Добавлены три идеи: упрощение approvals, quick approve/reject, empty states.
- 2026-05-04 — пункты 1 и 2 (упрощение approvals + quick approve/reject) ушли в работу как объединённый sandbox preview `/sandbox/approvals-inline` (план: `docs/agent-plans/2026-05-04-1714-approvals-inline-actions-sandbox.md`). Добавлен dev-mode toggle в раздел Сделано как инструмент для следующей задачи.
- 2026-05-05 — добавлен sandbox `/sandbox/quick-hire` (two-click hire flow) → переехал в Сделано. Затем по обсуждению с пользователем пункт #3 (empty states) частично закрыт agent-focused кусочком: `<QuickHireGrid />` встроен в `/agents` empty-state, HomeScreen empty workspace получил `<EmptyHomeHero />` с CTA → /agents. Пункт #3 остаётся открытым на остальные empty-states (approvals / activity / costs / chats / per-agent activity).
