# T2.1 (A) — User-lookup context + `requested_by_name` cleanup

> Plan owner: Claude
> Created: 2026-05-14 17:00 local
> Status: plan only — awaiting owner sign-off before Step 1

## 1. Task summary

Заменить mock-only денормализованное поле `ApprovalRequest.requested_by_name` (которое реальный бэк 0.3.0 не возвращает) на честный лукап через `api.listUsers()`. Цель — устранить shape-divergence между моком и реальным бэком, не меняя UX в местах, где имя сейчас показывается. Это **Вопрос A** из обсуждения T2.1 (см. `2026-05-13-2330-prototype-spec-0.3.0-sync-plan.md`). Вопрос B (добавлять ли имена approver / owner / version author) **не входит в этот план** — отдельное продуктовое решение.

## 2. Current repository state

- `master` clean (закрыто 3 шага плана `2026-05-14-1500-company-hub-members.md` + 15 юзеров в фикстурах). Uncommitted: новые юзеры + /company.
- `api.listUsers()` уже возвращает paginated envelope (mock в `lib/api.ts:335`).
- `api.getUser(userId)` уже есть (`lib/api.ts:344`).
- Тип `ApprovalRequest.requested_by_name` объявлен в `lib/types.ts:442-450` с длинным комментарием «mock-only, UI integration will need to look up via GET /users».
- Поле `requested_by_name` рендерится **в 5 точках**:
  - `components/approval-card.tsx:84` — «Triggered by Marcelo Ito · 2h ago».
  - `screens/ApprovalDetailScreen.tsx:396` — «Triggered 2h ago by Marcelo Ito».
  - `screens/ApprovalsScreen.tsx:498-500` — строка таблицы «Triggered by Marcelo Ito».
  - `screens/home/AdminView.tsx:95` — feed pending approvals, формат `{name} · {ago}`.
  - `screens/sandbox/TeamBridgeScreen.tsx:576` — fallback в цепочке `agent.name → user name → '—'`.
- Фикстуры: 6 строк `requested_by_name: '…'` в `lib/fixtures.ts` (1368-1496) + 1 в `tours/training-fixtures.ts:104`.

## 3. Relevant files inspected

- `lib/types.ts:442-450` — поле + комментарий.
- `lib/fixtures.ts:1368, 1390, 1414, 1437, 1459, 1477, 1495` — все 6 экземпляров.
- `tours/training-fixtures.ts:104` — единственная строка в тур-фикстурах.
- 5 UI-консумеров (адреса выше).
- `lib/api.ts:335-349` — listUsers / getUser ready.

## 4. Assumptions and uncertainties

**Assumptions:**
- `api.listUsers()` для роли `member` в реальном бэке вернёт 403 (спека: «Requires admin or domain_admin role»). Наш мок этого **не enforce** — возвращает всем. Стратегия: в провайдере **не звать** `listUsers`, если `user.role === 'member'`. Хук `useUser` для member отдаёт `undefined` для любого ID, UI должен fallback'нуть на копию без имени.
- Member-роль видит approvals **в принципе** (например, его собственный pending approval mid-chat в Tier 3). Сейчас на этом уровне UI не проверяется, но имя по `requested_by` ему недоступно — нужен graceful fallback.
- Sandbox `TeamBridgeScreen` оставляем как есть по сути — `requested_by_name` там был fallback после `agent.name`. Меняем на `useUser(...)?.name`, цепочка остаётся.

**Uncertainties:**
- Когда провайдер должен **перезагружаться**? Кейсы: при логине/логауте (новый юзер → new context); при смене training scenario (там свой список юзеров); при `DevMode='empty'` (хочется ли пустой map). MVP: re-load при изменении `user.id` И при изменении training scenario ID. DevMode игнорируем (если режим empty, listUsers вернёт []; провайдер ставит пустой map; имена становятся `undefined` — это и есть «empty»).
- Где в дереве монтировать. Текущее: `AuthProvider → RouterProvider → DevModeProvider → TrainingModeProvider → (TourProvider → ...)`. UserLookupProvider должен быть после `AuthProvider` (нужен текущий user) и после `TrainingModeProvider` (нужно подхватить scenario.users). Лучшее место: **внутри `TrainingModeProvider`**, обёртка над `(TourProvider → ...)`.
- Имя файла. `lib/user-lookup.tsx` или `components/user-lookup-provider.tsx`? Конвенция в проекте: `lib/` для data-layer контекстов (`scope-filter.tsx` там лежит), `components/` для UI. Я за **`lib/user-lookup.tsx`**.

## 5. Proposed approach

### Файл `lib/user-lookup.tsx`

```tsx
type UserMap = Map<string, User>

interface UserLookupValue {
  users: UserMap                    // empty Map until loaded / for member
  loading: boolean
  reload: () => void
}

const UserLookupContext = createContext<UserLookupValue | null>(null)

export function UserLookupProvider({ children }) {
  const { user } = useAuth()
  // Training scenario invalidates the cache — re-load on change.
  const scenarioId = useTrainingScenarioId()
  const [users, setUsers] = useState<UserMap>(new Map())
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    if (!user || user.role === 'member') {
      setUsers(new Map())
      return
    }
    setLoading(true)
    api.listUsers({ limit: 500 })
      .then(({ items }) => setUsers(new Map(items.map(u => [u.id, u]))))
      .catch(() => setUsers(new Map()))   // 403 / network → empty
      .finally(() => setLoading(false))
  }, [user, scenarioId])

  useEffect(() => { load() }, [load])

  return <UserLookupContext.Provider value={{ users, loading, reload: load }}>...
}

// Public hook — null/undefined IDs return undefined safely.
export function useUser(userId: string | null | undefined): User | undefined {
  const ctx = useContext(UserLookupContext)
  if (!ctx || !userId) return undefined
  return ctx.users.get(userId)
}
```

### Удаление `requested_by_name`

1. `lib/types.ts:442-450` — удалить поле и его длинный комментарий-сноску.
2. `lib/fixtures.ts` — 6 строк удалить.
3. `tours/training-fixtures.ts:104` — 1 строка удалить.

### Обновление 5 консумеров

Везде паттерн: импорт `useUser` из `lib/user-lookup`, заменить `approval.requested_by_name` на `useUser(approval.requested_by)?.name`. Член-роль или необнаруженный user → имя `undefined` → существующая копия деградирует.

Конкретные правки:

- **`approval-card.tsx:84-85`**
  ```tsx
  // Было:
  {approval.requested_by_name ? `Triggered by ${approval.requested_by_name} · ${ago(approval.created_at)}` : `Triggered ${ago(approval.created_at)}`}
  // Стало:
  const requesterName = useUser(approval.requested_by)?.name
  {requesterName ? `Triggered by ${requesterName} · ${ago(approval.created_at)}` : `Triggered ${ago(approval.created_at)}`}
  ```

- **`ApprovalDetailScreen.tsx:396`**
  ```tsx
  Triggered {ago(approval.created_at)}{requesterName ? ` by ${requesterName}` : ''}.
  ```

- **`ApprovalsScreen.tsx:498-500`** — условный рендер «Triggered by …» строки: показывать только когда `requesterName` есть.

- **`home/AdminView.tsx:95`** — формат `{requesterName ?? '—'} · {ago}` (это feed, отсутствие имени допускается — но member здесь не оказывается, AdminView only for admin/domain_admin).

- **`sandbox/TeamBridgeScreen.tsx:576`** — цепочка `ag ? `from ${ag.name}` : requesterName ?? '—'` (имя ставим только если ID нашёлся в lookup-context).

## 6. Risks and trade-offs

- **N+1 на mount.** Сейчас каждое имя в фикстурах денормализовано. После перехода на провайдер — один `GET /users` на mount, потом все 5 точек читают из мапы. Это **меньше** трафика, не больше. Никакого N+1.
- **Race: approval показывается до того как listUsers вернулся.** `useUser` отдаёт `undefined` пока not loaded → копия показывается без имени → имя «прилетает» в следующем рендере. Минорная FOUC-аналогия. Можно скрыть мерцание добавив `loading` flag и условный `null` — но это лишняя сложность. Принимаем как есть; запас в ~150 мс на старте имени быть не должно.
- **Member-роль скрывает имена везде.** Это правильно по спеке (бэк отдаёт 403 на /users), но визуально member увидит «Triggered 2h ago» без указания кем. Согласовано с owner'ом: показываем без «by X».
- **Training scenarios.** Tour-fixture для `approval-review` имел свой `requested_by_name: 'agent · Refunds Concierge'` — это **не имя юзера**, а строковый литерал-описание. После удаления поля надо проверить: в туре `APPROVAL_REVIEW_USER_ID` всё ещё резолвится через listUsers? Если scenario.users — отдельная коллекция, надо там seed'ить юзера с этим ID.
- **MembersTab двойная загрузка.** MembersTab уже грузит `api.listUsers()` сам. После добавления провайдера — формально две загрузки одного списка. Не критично (один `await delay(120ms)`), но дублирующий запрос. Оптимизация — мигрировать MembersTab на `useUsers()` хук — **из этого плана исключена**, отдельное движение.

## 7. Step-by-step implementation plan

**Step 1** — Создать `lib/user-lookup.tsx`. Провайдер + `useUser`. Mount внутри `TrainingModeProvider` в `index.tsx`. Verification: открыть приложение, `useEffect` с `console.log(useContext(UserLookupContext))` в любом screen должен показывать загруженный Map с 15 юзерами под Ada/Marcelo, пустой под Priya. (Логи добавляем-удаляем в той же итерации.)

**Step 2** — Удалить `requested_by_name` из `lib/types.ts` (поле + комментарий) и из 6 фикстурных строк (`lib/fixtures.ts`) + 1 строки в `tours/training-fixtures.ts`. TS-ошибки в 5 точках консумеров — ОЖИДАЕМЫ, они будут на Step 3. **На этом шаге build не зелёный**, это OK.

**Step 3** — Обновить 5 консумеров. После этого build должен быть зелёный. Lint clean.

**Step 4** — Проверить training-scenario для approval-review tour. Если `APPROVAL_REVIEW_USER_ID` не возвращается через listUsers под scenario'ом — добавить seed-юзера в scenario.users. Сейчас «requested_by_name» там был литерал «agent · Refunds Concierge», что **по факту не имя юзера** — это была мок-стилизация. После удаления поля имени там не будет; для tour'а это терпимо (тур всё равно deferred).

**Verification после Step 4 (полный):**
- Под Ada открыть `/approvals` → видны имена.
- Под Ada открыть `/approvals/:id` → видно «by …».
- Под Ada открыть `/` → admin pending feed → видны имена.
- Под Priya открыть `/approvals` (если member туда вообще ходит) → имена отсутствуют, копия без «by …».
- `npm run build && npm run lint` clean.

## 8. Verification checklist

- [ ] `lib/types.ts` не содержит `requested_by_name`.
- [ ] `lib/fixtures.ts` не содержит `requested_by_name`.
- [ ] `tours/training-fixtures.ts` не содержит `requested_by_name`.
- [ ] Grep `requested_by_name` в `src/` возвращает 0 матчей.
- [ ] Все 5 точек рендера используют `useUser()`.
- [ ] Под Ada все 5 точек показывают имена так же, как до изменения.
- [ ] Под Priya эти же экраны показывают копию без «by X», без NULL-крашей.
- [ ] `npm run build && npm run lint` clean.

## 9. Browser testing instructions for the user

После Step 1:
- Никакой visible-разницы. Только лог в DevTools (если оставил).

После Step 3:
1. `frontend@int3grate.ai` (Ada) → `/approvals` → строки в таблице содержат «Triggered by Marcelo Ito · …».
2. Клик в одну из строк → детальный экран показывает «Triggered 2h ago by Marcelo Ito.».
3. `/` (Home) — admin view — pending approvals feed справа содержит имена.
4. `/sandbox/team-bridge` — fallback цепочка работает (имя агента если есть, иначе имя юзера).
5. Logout. Login под `member@int3grate.ai` (Priya). Если member видит approvals — копия без «by X». Никаких error-state'ов.

## 10. Progress log

- **2026-05-14 17:00** — Plan drafted. Awaiting owner sign-off на Step 1. Решение по member-роли: показывать без «by X» (подтверждено). MembersTab миграция на хук исключена из плана.
