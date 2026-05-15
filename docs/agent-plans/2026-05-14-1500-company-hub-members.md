# /company — хаб для Members + Workspaces

> Plan owner: Claude
> Created: 2026-05-14 15:00 local
> Status: plan only — awaiting owner sign-off before Step 1

## 1. Task summary

Сделать единую точку входа в «структуру моей компании»: новая страница `/company` с двумя вкладками — **Members** (плоский список всех 15 юзеров из тенанта, read-only) и **Workspaces** (существующий функционал из `/workspaces` — list/create/edit/delete + members of current).

Доступ — через **расширенный WorkspaceSwitcher dropdown** в шапке сайдбара: пункт «Manage workspaces» переименовывается в «Manage company» и ведёт на `/company`. Текущий `/workspaces` маршрут уходит в legacy-redirect.

Это первая UI-реализация **T2.1** из плана `2026-05-13-2330-prototype-spec-0.3.0-sync-plan.md` — backend 0.3.0 дал нам `GET /users` (paginated) и `GET /users/{userId}`, фикстуры на 15 юзеров уже добавлены сегодня (commit pending).

## 2. Current repository state

- `master` clean. Свежие изменения только в `lib/fixtures.ts` (12 новых юзеров) — uncommitted.
- `api.listUsers()` уже возвращает paginated `UserList` envelope (`lib/api.ts:335`).
- `api.getUser(userId)` уже возвращает single `User | undefined` (`lib/api.ts:344`).
- `WorkspacesScreen.tsx` (229 строк) рендерит cards grid + Members card только для активного воркспейса.
- `WorkspaceSwitcher` (`components/workspace-switcher.tsx`, 159 строк) — dropdown с radio-list memberships + «+ Create workspace» + «Manage workspaces» + MockBadge.
- Routes в `index.tsx`: `/workspaces` зарегистрирован, ведёт на `WorkspacesScreen`.

## 3. Relevant files inspected

- `src/prototype/lib/fixtures.ts:33-200` — теперь 15 юзеров (Ada/Marcelo/Priya/Yusuf/Lena/Bashir/Hana/Tomás/Naledi/Eitan/Sasha/Mei-Lin/Aarav/Freya/Diego).
- `src/prototype/lib/api.ts:335-349` — `listUsers` + `getUser` ready.
- `src/prototype/screens/WorkspacesScreen.tsx` — будет рефакторнут в `WorkspacesTab` content-компонент.
- `src/prototype/components/workspace-switcher.tsx` — единственное изменение: переименовать пункт.
- `src/prototype/index.tsx` — добавить route `/company`, добавить legacy redirect `/workspaces` → `/company?tab=workspaces`.

## 4. Assumptions and uncertainties

**Assumptions:**
- `GET /users` в реальной 0.3.0 возвращает **всех** юзеров тенанта, не только тех, кто в текущем воркспейсе caller'а. (Подтверждено: `description: "List users in the caller's tenant"` в gateway.yaml — это **тенант-wide**.)
- Read-only список приемлем — никакого Invite / Remove / Edit Role (эндпоинтов нет).
- Members tab — это таблица/грид, не нужен Spotlight/детальный экран `User`. Юзер кликается куда-то только если есть смысл (пока нет — оставляем неинтерактивным).

**Uncertainties:**
- Доступен ли `GET /users` для роли `member`? Спека пишет «Requires admin or domain_admin role». Значит Members tab надо **скрывать или ограничивать для member**. Открытый вопрос: показывать вкладку с «No access» state или скрывать сам tab? Я бы скрывал tab — иначе member видит пустоту с описанием, что у него нет прав, что зачем-то атрибутирует машинные процессы людям.
- Текущий `/workspaces` сам по себе доступен member'у (там и `Manage workspaces` в switcher для всех). Это надо ли менять? Я бы оставил как есть — Workspaces tab всем виден, Members tab скрыт для member'ов.
- Vocab: внутри Members tab — какой column header у "domain_id"? «Workspace» — да, это main concept. Что если юзер с `domain_id: null`? Лейбл «Tenant-wide» / «All workspaces» / «—»? Я бы взял «All» с tooltip — лаконично.

## 5. Proposed approach

### Структура страницы `/company`

```
[breadcrumbs: Home / Company]
PageHeader
  eyebrow: ""
  title: "Company"
  subtitle: "People and workspaces in your tenant"
  actions: (none — actions перенесутся в табы)

Tabs: Members | Workspaces
  ├── Members tab
  │     Filter row: [search by name/email] [role filter] [workspace filter]
  │     Table:
  │       Avatar+Name | Email | Role | Approval Level | Workspace | Joined
  │     MockBadge внизу: kind="design" — Invite/Remove unavailable
  │
  └── Workspaces tab
        (всё содержимое текущего WorkspacesScreen — grid карточек, dialogs)
```

### Изменения по файлам

**Новые:**
1. `src/prototype/screens/CompanyScreen.tsx` — shell с tabs, `useSearchParams`-like логика для активной вкладки через `?tab=members|workspaces`.
2. `src/prototype/screens/company/MembersTab.tsx` — таблица users.
3. `src/prototype/screens/company/WorkspacesTab.tsx` — извлечённый content из `WorkspacesScreen.tsx` (без `AppShell` wrapper и PageHeader — это даёт `CompanyScreen`).

**Изменённые:**
4. `src/prototype/components/workspace-switcher.tsx` — пункт «Manage workspaces» → «Manage company», navigate target `/workspaces` → `/company`.
5. `src/prototype/index.tsx` — route `/company`, legacy redirect `/workspaces → /company?tab=workspaces`.
6. `src/prototype/screens/WorkspacesScreen.tsx` — **удаляется** после миграции содержимого в `WorkspacesTab.tsx`.

### Активная вкладка через URL

Использовать hash query: `#/company?tab=members` или `#/company?tab=workspaces`. Default — `members` (потому что это новое и более важное). Routing-движок у нас hand-rolled; надо проверить, парсит ли он query-параметры из hash. Если нет — добавить парсинг или использовать второй сегмент `/company/:tab`.

**Альтернатива:** `/company/members` и `/company/workspaces` как отдельные routes, дефолтная `/company` → редирект на members. Это чище для hash-router'а. Я предпочитаю этот вариант.

## 6. Risks and trade-offs

- **Доступ для member.** Скрытие Members tab от member'ов — нет ли это inconsistent UX («admin видит две вкладки, member одну»)? Альтернатива — показывать tab с `NoAccessState`. Я за **скрытие**, потому что member физически не получит данные от бэка (403), и показывать пустоту с «у вас нет прав» — это создание fake surface, противоречит memory `feedback_ui_honesty`.
- **Workspaces refactor.** `WorkspacesScreen.tsx` имеет 229 строк state и handlers. Распилить аккуратно, чтобы dialogs / refresh / state не сломались. Рисков немного — компонент уже изолированный.
- **Legacy redirect.** `/workspaces` ещё могут быть забуккмаркены или линковаться из других мест в коде. Грепнуть `'/workspaces'` перед переездом, чтобы убедиться, что нигде не зарелайаются.
- **Member-фикстуры.** У нас сейчас 15 юзеров. Сортировка/фильтры — продумать default. Default sort by role (admin → domain_admin → member), затем by name.
- **Vocab pitfall.** Колонка «Role» с raw enum `domain_admin` — НЕЛЬЗЯ. Использовать `roleLabel(role)` из `lib/format.ts` (уже есть).

## 7. Step-by-step implementation plan

**Step 1** — Plumbing. Создать пустые файлы `CompanyScreen.tsx` + `company/MembersTab.tsx` + `company/WorkspacesTab.tsx`. CompanyScreen ставит AppShell + PageHeader + Tabs с двумя tab nav links. MembersTab — заглушка с просто Caption «Members tab». WorkspacesTab — извлечь содержимое из WorkspacesScreen.tsx (cards grid + dialogs), убрать `AppShell` + `PageHeader` обёртки. Зарегистрировать routes `/company`, `/company/members`, `/company/workspaces` в `index.tsx`. `/company` → redirect на `/company/members`. `/workspaces` → redirect на `/company/workspaces`. Удалить `WorkspacesScreen.tsx`. Лоадинг состояния и dialogs — переезжают как есть.

**Verification после Step 1:** открыть `/workspaces` → должен редиректнуть на `/company/workspaces`, увидеть тот же экран что был раньше. Открыть `/company/members` → увидеть пустую заглушку с «Members coming next». Switcher dropdown ещё с старым «Manage workspaces» — менять в Step 2.

**Step 2** — Members tab implementation. В `MembersTab.tsx`: загрузка `api.listUsers()`, таблица с колонками Avatar+Name / Email / Role / Approval / Workspace / Joined. Фильтр-роу: search input (имя/email), Select по role, Select по workspace. Скрытие tab для роли `member` (на уровне CompanyScreen — не рендерим nav link и редиректим `/company/members` → `/company/workspaces`).

**Verification после Step 2:** под Ada (admin) увидеть 15 человек, фильтры работают. Под Priya (member) — `/company/members` редиректнет на `/company/workspaces`, Members tab в nav не виден.

**Step 3** — Switcher rename + MockBadge на Members tab. WorkspaceSwitcher: пункт «Manage workspaces» → «Manage company», target `/workspaces` → `/company`. Members tab: MockBadge `kind="design"` снизу с пояснением «Invite/Remove will arrive when backend exposes user CRUD endpoints». Breadcrumbs polish.

**Verification после Step 3:** switcher dropdown показывает «Manage company», клик ведёт на `/company`. Mock badge виден.

## 8. Verification checklist

- [ ] `npm run lint && npm run build` clean после каждого шага.
- [ ] Под Ada (admin) виден Members tab, 15 человек, фильтры работают.
- [ ] Под Marcelo (domain_admin) виден Members tab, видны те же 15 человек (домен_admin тоже имеет доступ к `/users`).
- [ ] Под Priya (member) Members tab НЕ виден, прямой переход на `/company/members` редиректит на `/company/workspaces`.
- [ ] `/workspaces` → редирект на `/company/workspaces`, не ломает back-button.
- [ ] WorkspaceSwitcher dropdown показывает «Manage company» с правильным target.
- [ ] MockBadge на Members tab объясняет отсутствие Invite/Remove.
- [ ] Vocab-чек: никаких raw `domain_admin` / `member` без `roleLabel()`. Колонка «Workspace» использует имя воркспейса, не `domain_id`.

## 9. Browser testing instructions for the user

После Step 1:
1. Открыть `http://localhost:5173/#/workspaces` — должен показать список воркспейсов с новым URL `#/company/workspaces`.
2. Открыть `http://localhost:5173/#/company/members` — заглушка.

После Step 2:
1. Залогиниться под `frontend@int3grate.ai` (Ada). Открыть `#/company/members` — таблица из 15 человек.
2. Проверить фильтры: search «Hana», role «member», workspace «Growth».
3. Залогиниться под `member@int3grate.ai` (Priya). Открыть `#/company/members` — должен редиректнуться на `/workspaces` или показать NoAccess (по согласованию).
4. Switcher: открыть dropdown, кликнуть «Manage workspaces» (ещё не переименован) — попадает на `/company/workspaces`.

После Step 3:
1. Switcher dropdown показывает «Manage company», клик ведёт на `/company` → `/company/members`.
2. На Members tab внизу виден MockBadge с tooltip.

## 10. Progress log

- **2026-05-14 15:00** — Plan drafted. Awaiting owner sign-off на Step 1. Step 1 — plumbing (3 новых файла + удаление WorkspacesScreen.tsx + 2 route правки). Members tab — заглушка на этом шаге, наполнение в Step 2.
