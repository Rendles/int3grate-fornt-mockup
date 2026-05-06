# First-run empty-state onboarding — quick-hire on /agents and HomeScreen

**Status:** draft, awaiting user approval before Step 1.

## 1. Task summary

Встроить sandbox quick-hire grid в production user-flow, так чтобы новый пользователь без агентов сразу видел путь «нанять первого агента в два клика», а не пустые экраны с метриками-нулями.

Конкретно:
- Извлечь шаблон-grid из `src/prototype/screens/sandbox/QuickHireScreen.tsx` в reusable компонент `components/quick-hire-grid.tsx`. Sandbox screen перевести на этот компонент (тонкая обёртка), чтобы избежать code-duplication.
- На `/agents`, если у пользователя нет агентов И он admin/domain_admin — заменить `EmptyState` на quick-hire grid inline (collapsed cards + accordion preview + Hire-цепочка). Member-у при отсутствии агентов оставляем нейтральный `EmptyState` («Ask an admin to hire»), потому что ему всё равно нельзя нанимать.
- На HomeScreen, если у пользователя нет агентов — заменить `<AdminView>` (метрики-нулями) на `<EmptyHomeHero>`: hero copy + единая CTA «Build your team» → `/agents`. Не дублируем grid на двух экранах: на Home только зов, grid живёт на /agents.

Out-of-scope (явно не делаем сейчас):
- ❌ Удалять sandbox `/sandbox/quick-hire` — он остаётся для design-итераций (как и `team-bridge`).
- ❌ Замена production `/agents/new` wizard — он остаётся для custom hires и repeat-hires «с настройкой».
- ❌ Обработка empty-states остальных экранов (`/approvals`, `/activity`, `/costs`) — это пункт #3 бэклога целиком, мы делаем только agent-focused кусочек.
- ❌ Multi-step onboarding (welcome modal, tour autostart, прогресс-бар «1 of 3») — у нас уже есть `WelcomeToast` + `/learn`, не плодим.
- ❌ Backend-изменения — empty determination на клиенте (`agents.length === 0`).
- ❌ Persistence onboarding-состояния («I've dismissed this») — после первого hire empty-state пропадает естественно, dismiss не нужен.

В рамках задачи:
- ✅ Reusable `<QuickHireGrid />` принимает optional `header` (eyebrow/title/subtitle/banner) и render-mode (`'standalone' | 'embedded'`).
- ✅ После Hire — `navigate('/agents/' + agent.id)` (overview агента). Это работает и из sandbox, и из inline /agents.
- ✅ HomeScreen empty hero — простой Card + текст + CTA. Без teaser-карт, чтобы не дублировать grid.
- ✅ Dev-mode toggle (`Empty`) корректно триггерит новые empty-flows на обоих экранах.

## 2. Current repository state

**Sandbox quick-hire** (`src/prototype/screens/sandbox/QuickHireScreen.tsx`, ~250 строк):
- Single-active accordion над списком из 6 шаблонов.
- Helpers `extractSampleTasks`, `appsFromGrants` — module-scope, легко экспортировать.
- Hire-цепочка: `createAgent → createVersion → setGrants → activateVersion → navigate('/agents/:id')`.
- Member-guard через `NoAccessState`.
- Banner с inline-link'ами на `/agents` и `/agents/new`.

**`AgentsScreen`** (`src/prototype/screens/AgentsScreen.tsx:127-141`):
```tsx
) : !agents ? (
  <LoadingList rows={6} />
) : agents.length === 0 ? (
  <EmptyState
    icon={<IconAgent />}
    title="No agents yet"
    body="Hire your first agent and give it a role, instructions, and access to apps."
    action={canCreate ? { label: 'Hire an agent', href: '/agents/new' } : undefined}
  />
) : filtered.length === 0 ? ...
```
Empty-state ведёт на `/agents/new` (полный wizard). Нет inline preview шаблонов.

**`HomeScreen`** (`src/prototype/screens/HomeScreen.tsx:71-99`):
- При успешной загрузке всегда рендерит `<AdminView agents={agents!} ... />`.
- AdminView использует agents для счётчиков (`Active agents`, `0 total`), spend, recent runs. При empty fixtures: «0 Active agents · 0 total», «$0.00 · 7d», пустой ribbon recent runs.
- Нет ветви «empty workspace».

**Dev-mode**:
- `src/prototype/dev/dev-mode-provider.tsx` + `dev-mode.ts` — toggle в topbar форсит API-мode (`Real / Empty / Loading / Error`).
- Empty-mode заставляет `api.listAgents()`, `api.listApprovals()`, `api.listRuns()`, `api.getSpend()` вернуть пустые envelope'ы.
- Это инструмент для тестирования новых empty-flows без правки fixtures.

**Other entry points to check**:
- `HireTile` (`AgentsScreen.tsx:207-229`) — показывается **только когда есть агенты** (`filter === 'all' && !query` ветка). При empty не появляется.
- `WelcomeToast` (`tours/WelcomeToast.tsx`) — bottom-right pinned, показывается first-time. Это discovery hint, не CTA. Сосуществует с нашим empty-flow без конфликта.
- `/learn` route — обучение, не настройка.

## 3. Relevant files inspected

- `src/prototype/screens/sandbox/QuickHireScreen.tsx` — источник логики для extract.
- `src/prototype/screens/AgentsScreen.tsx:127-141` — куда вставлять inline grid.
- `src/prototype/screens/HomeScreen.tsx:71-99` — куда вставлять empty hero.
- `src/prototype/screens/home/AdminView.tsx` — какое содержимое заменяем.
- `src/prototype/components/states.tsx:133-148` — `EmptyState` API (для member-варианта на /agents).
- `src/prototype/components/common.tsx` — `MockBadge`, `PageHeader`, `Avatar`, `Caption`.
- `src/prototype/dev/dev-mode-provider.tsx` — для проверки empty-flow.
- `src/prototype/tours/WelcomeToast.tsx` — чтобы убедиться что нет конфликта.
- `src/prototype/lib/templates.ts` — `FEATURED_TEMPLATES`, `NON_FEATURED_TEMPLATES`.
- `src/prototype/lib/api.ts:282-380` — hire-цепочка.

## 4. Assumptions and uncertainties

**Assumptions:**

- **`agents.length === 0` — единственный сигнал «empty workspace»**, как обсуждалось. Не считаем pending approvals / runs / spend — без агентов всё это пусто детерминированно. Один сигнал = одна развилка, проще читать.
- **Member sees neutral empty.** На `/agents` member видит `EmptyState` с body «Ask a workspace admin to hire your first agent» (без CTA-action). Member не может нанимать — quick-hire grid ему вреден (frustration).
- **HomeScreen empty hero вместо AdminView.** Полная замена `<AdminView>` (а не баннер сверху) — потому что иначе пользователь видит дашборд с нулями и hero одновременно, mixed message. Hero только тогда, когда action нужен.
- **HomeScreen empty hero — admin и member видят одно и то же**, разница в copy:
  - Admin: «Your team is empty. Build it →» + button «Build your team» → `/agents`.
  - Member: «No team yet. Ask an admin to hire your first agent.» — без button.
- **После first hire empty-state пропадает естественно**, без persistence. Reload `/agents` → list с одним агентом → нормальный listing.
- **Reusable component name — `QuickHireGrid`**. Импорт из `../components/quick-hire-grid` (не из `common/`, потому что специализированный, не general primitive). Аналогия — `grants-editor.tsx`.
- **Sandbox screen переходит на extracted компонент** — единый источник правды, чтобы design-fixes на одном месте применялись и к production, и к sandbox.
- **`navigate('/agents/:id')` после hire — единое поведение для обоих использований grid'а.** Maria после hire видит overview своего агента — естественный next-step (она сразу там же может «Talk to» / `Permissions` посмотреть).

**Uncertainties:**

- **Заголовок над inline-grid на `/agents`?** PageHeader страницы — `Your team.` Под ним status-фильтры и поиск. Когда empty, фильтры/поиск визуально бессмысленны (фильтровать нечего). Беру: **скрываем status-фильтры + search bar при empty** (admin), оставляем PageHeader, под ним inline grid с собственным sub-title `Pick a starter template`. Это согласуется с «empty-flow = focused single CTA».
- **PageHeader `Hire an agent` button при empty.** Сейчас он всегда виден. Когда grid prominentno внизу, button сверху дублирует. Беру: **оставляем кнопку как есть** — это вторичный CTA для тех кто хочет full wizard сразу. Не прячем чтобы не плодить условную логику.
- **Header у `<QuickHireGrid />` (banner про «working preview»).** В sandbox banner важен — там флагирует «design preview». В production на `/agents` — банера НЕ нужно (это уже не preview). В HomeScreen empty hero — отдельная UI, grid там не появляется. Решение: компонент принимает `mode='standalone' | 'embedded'`. В `standalone` (sandbox) рендерит свой PageHeader+banner. В `embedded` (production /agents) — только grid, заголовок и subtitle прокидываются props'ом или вообще не рендерятся (caller рисует сам).
- **HomeScreen empty hero визуально — насколько богат?** Варианты:
  - (a) Минимум: Card с текстом + button. ~50 строк кода.
  - (b) Hero с полу-illustrated layout (большая иконка `IconAgent`, copy, button).
  - (c) Hero + 3-4 teaser featured-template cards (read-only превью, click ведёт на /agents с pre-expanded card).
  - **Беру (b)** — middle ground. Иллюстрация даёт визуальный вес empty-flow'у, не пуская при этом дублирующий grid. (c) — overengineering: один и тот же grid на двух экранах смущает.
- **Pre-expanded card via deep-link?** В (c)-варианте мы бы прокидывали `?template=sales` в URL и `<QuickHireGrid />` раскрывал бы соответствующую карту. Беру: **НЕ делаем сейчас** (мы (b)). Если позже захотим (c), URL-state добавим тогда.
- **PageHeader title на HomeScreen в empty.** Сейчас «Good morning, Ada.» — приветствие безотносительно к workspace state. Беру: **оставляем приветствие**, hero идёт ниже как replacement AdminView. Приветствие персонализирует, а hero объясняет «что делать». Они не конфликтуют.
- **Loading state на HomeScreen перед empty determination.** Сейчас `LoadingList rows={8}`. После загрузки если empty → hero. Это даст flash «loading → empty» который ОК, не надо дополнительно лечить.

## 5. Proposed approach

### Файлы

- **Новый:** `src/prototype/components/quick-hire-grid.tsx` — extracted component. Включает: `QuickHireGrid`, helper'ы `extractSampleTasks` и `appsFromGrants`. Принимает props `mode`, `onAfterHire?` (default = navigate'ом на agent overview).
- **Новый:** `src/prototype/screens/home/EmptyHomeHero.tsx` — hero для HomeScreen empty. Принимает props `canCreate: boolean`.
- **Изменяется:**
  - `src/prototype/screens/sandbox/QuickHireScreen.tsx` — превращается в тонкую обёртку `AppShell + <QuickHireGrid mode="standalone" />`. Логика hire/accordion переехала в компонент.
  - `src/prototype/screens/AgentsScreen.tsx` — empty-state ветка для admin рендерит `<QuickHireGrid mode="embedded" />` (плюс prepend-caption). Status-фильтры и search скрываются когда `agents.length === 0`.
  - `src/prototype/screens/HomeScreen.tsx` — после загрузки если `agents.length === 0` → `<EmptyHomeHero />` вместо `<AdminView />`.

### `<QuickHireGrid />` API

```tsx
type QuickHireGridProps = {
  mode: 'standalone' | 'embedded'
  // Optional callback after successful hire. If absent, navigates to /agents/:id.
  onAfterHire?: (agentId: string) => void
  // When true (default for embedded), member-guard renders nothing — caller
  // decides what to render for non-admins. When false (standalone), the
  // component renders NoAccessState itself.
  hideMemberGuard?: boolean
}
```

В `standalone` mode компонент ниже внутри своего AppShell-context'а рендерит:
- `MockBadge` + sandbox banner — оставляем для sandbox версии.
- 6 cards + accordion + hire chain.

В `embedded` mode рендерит **только** 6 cards + accordion + hire chain. Никаких баннеров. Caller (AgentsScreen / EmptyHomeHero если бы он использовал grid) рисует свой header.

### `AgentsScreen` empty-state

```tsx
) : agents.length === 0 ? (
  canCreate ? (
    <Box mt="4">
      <Caption>Pick a starter template</Caption>
      <Text as="div" size="2" color="gray" mb="3">
        Hire your first agent in two clicks. You can rename, retrain, or fire later.
      </Text>
      <QuickHireGrid mode="embedded" hideMemberGuard />
    </Box>
  ) : (
    <EmptyState
      icon={<IconAgent />}
      title="No agents yet"
      body="Ask a workspace admin to hire your first agent."
    />
  )
) : ...
```

Status-фильтры и search-bar также wrap'аются в `agents.length > 0` ветку — при empty не рендерятся.

### `EmptyHomeHero`

```tsx
function EmptyHomeHero({ canCreate }: { canCreate: boolean }) {
  return (
    <Card variant="surface" size="3" mt="4">
      <Flex direction="column" align="center" gap="3" py="6" px="4">
        <Box style={{ /* large icon tile */ }}>
          <IconAgent />
        </Box>
        <Heading size="5" align="center" weight="medium">
          {canCreate ? 'Build your team' : 'No team yet'}
        </Heading>
        <Text size="2" color="gray" align="center" style={{ maxWidth: 460 }}>
          {canCreate
            ? "You don't have any agents yet. Hire your first in two clicks — pick a role, review what they'll do, confirm."
            : 'No agents have been hired yet. Ask a workspace admin to hire your first.'}
        </Text>
        {canCreate && (
          <Button asChild size="3" mt="2">
            <a href="#/agents"><IconArrowRight /> Build your team</a>
          </Button>
        )}
      </Flex>
    </Card>
  )
}
```

Используем стиль аналогичный `StateShell` из `states.tsx`, чтобы визуально консистентно.

### HomeScreen rendering branch

```tsx
{loading ? (
  <Box mt="5"><LoadingList rows={8} /></Box>
) : agents!.length === 0 ? (
  <EmptyHomeHero canCreate={user?.role === 'admin' || user?.role === 'domain_admin'} />
) : (
  <AdminView ... />
)}
```

### Вёрстка флоу

```
USER HAS NO AGENTS
──────────────────
  /          → HomeScreen with EmptyHomeHero
                "Build your team" button → /agents
  /agents    → AgentsScreen with QuickHireGrid embedded
                Click template card → expand → Hire → /agents/:id

USER HAS 1+ AGENTS
──────────────────
  /          → HomeScreen with AdminView (current)
  /agents    → AgentsScreen with status filters + listing + HireTile
  /agents/new → Production wizard (unchanged)
  /sandbox/quick-hire → Standalone QuickHireGrid (sandbox)
```

## 6. Risks and trade-offs

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Extract компонент ломает sandbox screen | medium | Sandbox переходит первым (Step 2), я буквально перевожу логику 1:1. Visual diff = только обёртка. |
| `navigate('/agents/:id')` после hire не подходит для embedded на /agents (Maria хочет вернуться в listing) | low | Пробовали в sandbox — это хорошее место приземления (overview видно сразу). Если плохо — добавим `onAfterHire` callback в /agents → navigate(`/agents`). Но дефолт логичнее. |
| HomeScreen empty hero визуально слабее AdminView на «non-empty» — пользователь подумает «что-то поломалось» | low | Hero card визуально полноценный (large icon, heading, paragraph, CTA). Это not-screen-blank, а явное empty-statement. |
| Member на HomeScreen empty видит «No team yet. Ask an admin» без actions — выглядит beneficial-но-tupik | low | Это правда, и помогает понять «не я должен это делать». Без CTA лучше, чем с disabled-CTA. |
| Status-фильтры на /agents скрыты при empty — admin чувствует «потерю» control'а | low | При empty нечего фильтровать. После first hire они вернутся (1+ agents → нормальный listing). |
| Welcome toast и empty hero показываются одновременно → визуальный шум | low | Welcome toast — bottom-right thin pill, hero — center top. Не конфликтуют по area. Если воюют — можно скрыть toast при `agents.length === 0` (но это next iteration, не Step 4 здесь). |
| Reusable component design-mistake: `mode` prop всегда хрупкий | medium | Альтернатива — два разных компонента (QuickHireGridStandalone / QuickHireGridEmbedded). Беру single-component с `mode` prop'ом потому что разница только в обёртке header'а — не оправдывает duplication. Если станет больше различий — отрефакторим в два. |
| Dev-mode (`Empty`) уже работает — но нужно явно проверить что новые ветки корректно триггерятся | low | Step 4 verification: явно тестируем через toggle. Не пишем sample-fixtures под empty (dev-mode уже есть). |
| Member видит inline EmptyState на /agents без CTA — мог бы открыть QuickHireGrid в read-only mode | low | Read-only grid = «showroom без покупки» — frustrating для члена команды который хочет помочь. Проще честный текст «ask an admin». Если bus-case появится — добавим позже. |
| ChatNewScreen / ApprovalsScreen / другие листы тоже empty при no-agents (cascading empty) | low | Каждый из них уже имеет свой EmptyState (не панически). Они не на critical path первого hire. Их улучшение — отдельный пункт #3 бэклога целиком. |
| Hire через embedded /agents → редирект на /agents/:id → user back-button → /agents (теперь с одним агентом) → empty grid пропал → user не понимает «куда делся» | low | Это правильное поведение. Можно добавить toast «Hired Sales Agent» после hire — но это уже polish следующих итераций. |
| После hire возвращаемся на listing — там есть `HireTile` (видимая dashed-card «Hire a new agent» → /agents/new). Inconsistency: hire-from-template (quick) vs hire-with-wizard (full) | low | Это соответствует двум реальным режимам. После первого hire Maria уже знает оба пути. Пометка-tooltip на HireTile («Custom hire — full wizard») — polish следующих итераций. |

## 7. Step-by-step implementation plan

**Step 1 — Extract `<QuickHireGrid />` без визуальных изменений.**

- Создать `src/prototype/components/quick-hire-grid.tsx`. Перенести из `QuickHireScreen.tsx`:
  - `QUICK_HIRE_TEMPLATES` constant.
  - `extractSampleTasks`, `appsFromGrants` helpers.
  - `TemplateCard`, `ExpandedBody` компоненты.
  - Hire-цепочка (`hire(template)`).
- Экспортировать `QuickHireGrid` с props `{ mode: 'standalone' | 'embedded'; onAfterHire?: (agentId: string) => void; hideMemberGuard?: boolean }`.
  - В `standalone` mode компонент рендерит `Banner` + grid (как сейчас в QuickHireScreen, минус AppShell/PageHeader).
  - В `embedded` mode — **только** grid.
  - `onAfterHire` дефолтит на `navigate('/agents/' + agentId)`.
  - Member-guard: в `standalone` рендерит `NoAccessState`. В `embedded` — return null (caller решает).
- `QuickHireScreen.tsx` превращается в:
  ```tsx
  return (
    <AppShell crumbs={[...]}>
      <div className="page page--wide">
        <PageHeader eyebrow={...} title={...} subtitle={...} />
        <QuickHireGrid mode="standalone" />
      </div>
    </AppShell>
  )
  ```

**Verify:** `#/app/sandbox/quick-hire` ведёт себя 1:1 как раньше — все 4 step'а из предыдущего плана работают без изменений. Никаких visual diff'ов. `npm run lint && npm run build` clean.

**Step 2 — Inline empty-state на `/agents`.**

- В `AgentsScreen.tsx`:
  - Wrap status-filters + search-bar в условие `agents && agents.length > 0`.
  - В empty-branch:
    - admin/domain_admin → render `<Box mt="4"><Caption>Pick a starter template</Caption><Text>Hire your first…</Text><QuickHireGrid mode="embedded" hideMemberGuard /></Box>`.
    - member → текущий `<EmptyState>` с body «Ask a workspace admin to hire your first agent.», action удаляем.
- Не трогаем `filtered.length === 0` ветку (это «no match», не «no data»).

**Verify:**
- Dev-mode toggle на `Empty` → `/agents` показывает QuickHireGrid inline без status-фильтров и search.
- Production fixtures (admin) → `/agents` показывает обычный listing с фильтрами.
- Member + empty-mode → видит neutral EmptyState без CTA.
- Click на карту → expand → Hire → редирект на /agents/:id (новый агент в shared fixtures, но dev-mode override продолжает возвращать empty при следующем чтении listAgents — visual «empty снова» это feature dev-mode'а).
- Production fixtures: admin не должен видеть наш empty-state (у него есть seeded agents).

**Step 3 — `EmptyHomeHero` + branch на HomeScreen.**

- Создать `src/prototype/screens/home/EmptyHomeHero.tsx`:
  - Card variant="surface" size="3", center-aligned Flex column, large icon tile (использую тот же стиль что `StateIcon` из `states.tsx`), Heading + paragraph + Button → `/agents`.
  - Props: `canCreate: boolean`.
- В HomeScreen.tsx, в render-tree добавить ветку `agents!.length === 0`:
  - Подставить `<EmptyHomeHero canCreate={user?.role === 'admin' || user?.role === 'domain_admin'} />` вместо `<AdminView />`.
  - PageHeader приветствия и actions оставить как есть.

**Verify:**
- Dev-mode `Empty` + login admin → `/` показывает приветствие + EmptyHomeHero card. Click button → `/agents` (с inline grid).
- Dev-mode `Empty` + login member → `/` показывает «No team yet. Ask an admin» без button.
- Production fixtures → `/` показывает нормальный AdminView.

**Step 4 — Polish + verification round.**

- Проверить `WelcomeToast` сосуществует с empty hero без визуального конфликта.
- Проверить что после первого hire (через embedded /agents) пользователь приземляется на /agents/:id, и при возврате на / уже видит AdminView (не EmptyHomeHero).
- Проверить что dev-mode toggle (Real → Empty → Real) корректно re-renders оба экрана.
- Финальный lint+build.
- Обновить `docs/backlog.md` — пункт #3 переносим из «Открытых» в «Сделано» с пометкой «частично — agents-focused кусочек, остальные empty-states остаются открытыми».

**Verify:** Полный full-flow:
1. Login admin → seed empty mode.
2. `/` → EmptyHomeHero → click `Build your team`.
3. `/agents` → QuickHireGrid embedded → expand Sales → Hire.
4. `/agents/agt_sales_agent` overview.
5. Sidebar → Home → AdminView (теперь не empty).
6. Sidebar → Team → Listing с одним agent + HireTile + filters/search вернулись.

`npm run lint && npm run build` clean.

## 8. Verification checklist

- [ ] `src/prototype/components/quick-hire-grid.tsx` — новый файл, exporting `QuickHireGrid`.
- [ ] `QuickHireScreen.tsx` — тонкая обёртка, использует `<QuickHireGrid mode="standalone" />`.
- [ ] `/sandbox/quick-hire` ведёт себя как раньше (no visual regression).
- [ ] `/agents` под admin + dev-mode `Empty` → inline grid, без фильтров/search.
- [ ] `/agents` под member + dev-mode `Empty` → neutral EmptyState без CTA.
- [ ] `/agents` под admin + production fixtures → normal listing (никаких quick-hire grid'ов вылезших).
- [ ] `/` под admin + dev-mode `Empty` → EmptyHomeHero (полноценный card), приветствие выше остаётся.
- [ ] `/` под member + dev-mode `Empty` → EmptyHomeHero без button.
- [ ] `/` под admin + production fixtures → AdminView (не сломали dashboard).
- [ ] Hire из `/agents` empty-grid → агент создаётся (createAgent → createVersion → setGrants → activateVersion), редирект на /agents/:id.
- [ ] После hire возврат на `/` → AdminView (одним агентом меньше empty).
- [ ] HireTile на /agents listing после первого hire всё ещё ведёт на `/agents/new` (full wizard).
- [ ] WelcomeToast не наезжает на EmptyHomeHero.
- [ ] `npm run lint` clean.
- [ ] `npm run build` clean.

## 9. Browser testing instructions for the user

**Setup:** `npm run dev`, login `frontend@int3grate.ai` (admin) для основной проверки и `member@int3grate.ai` (member) для guard-варианта.

**Switch dev-mode:** click bug-icon в topbar → `Empty` → reload page, чтобы api начал отдавать пустые envelope'ы.

**Step 1 — sandbox без regression:**
1. `#/app/sandbox/quick-hire` → grid карт, expand-accordion, Hire — всё как было.

**Step 2 — `/agents` empty:**
1. dev-mode `Empty`. Sidebar → Team.
2. Видно: PageHeader «Your team.», `Hire an agent` button (как раньше). НЕ видно: status-фильтры, search bar.
3. Под header'ом subtle caption «Pick a starter template» + paragraph + grid 6 карт (Sales / Marketing / Reports / Support / Finance / Operations).
4. Click Sales → expand → видно longPitch / apps / sample tasks / approvals / Back+Hire.
5. Click `Hire Sales Agent` → spinner ~400ms → редирект на `/agents/agt_sales_agent`.
6. Logout → login `member@int3grate.ai` → dev-mode Empty + `/agents` → centered EmptyState «No agents yet · Ask a workspace admin to hire your first agent.» БЕЗ кнопки.

**Step 3 — HomeScreen empty:**
1. admin + dev-mode `Empty`. Sidebar → Home.
2. PageHeader приветствие «Good morning, Ada.» + actions (Approvals / Start a chat).
3. Ниже — single Card: large icon tile, «Build your team» heading, body, button «Build your team» с arrow icon.
4. Click button → переход на `/agents` (inline grid из Step 2).
5. member + dev-mode `Empty` + `/` → тот же Card, copy «No team yet…», без button.
6. dev-mode `Real` (production fixtures) + `/` → нормальный AdminView (метрики, список approvals и т.д.).

**Step 4 — full first-time flow (admin):**
1. dev-mode `Empty`. Login.
2. Landing на `/` → EmptyHomeHero. Click `Build your team`.
3. На `/agents` → click Sales card → expand → Hire.
4. Landing на `/agents/agt_sales_agent` overview.
5. Sidebar Home → теперь AdminView (1 active agent в счётчике).
6. Sidebar Team → listing с одним «Sales Agent» + status-фильтры + search + HireTile (для второго hire).
7. Click HireTile → `/agents/new` full wizard (production unchanged).

**Edge cases:**
- WelcomeToast pinned bottom-right одновременно с EmptyHomeHero — не наезжают, hero center-top, toast bottom-right.
- Reload `/` сразу после hire (когда мы уже на /agents/:id) — back-button → / → AdminView.
- dev-mode Loading на `/agents` — `LoadingList` rows показывается до того как мы определили empty. Не должен flash empty-grid.

## 10. Progress log

- **2026-05-05 12:30** — план создан. Подтверждено направление: extract reusable `<QuickHireGrid />`, использовать его в `/agents` empty-state, на HomeScreen — отдельный `<EmptyHomeHero />` без grid'а (single CTA → /agents). Sandbox остаётся для design-итераций. Member видит neutral copy без grid. Жду «делай» от пользователя для Step 1.
- **2026-05-05 12:50** — **Step 1 done.** Extract `<QuickHireGrid />` без визуальных изменений. Files touched: `src/prototype/components/quick-hire-grid.tsx` (new, ~280 строк), `src/prototype/screens/sandbox/QuickHireScreen.tsx` (rewritten as thin wrapper, ~30 строк, было ~320). Перенесены: `QUICK_HIRE_TEMPLATES`, `extractSampleTasks`, `appsFromGrants`, `TemplateCard`, `ExpandedBody`, hire-цепочка целиком. Component API: `{ mode: 'standalone' \| 'embedded'; onAfterHire?: (agentId: string) => void }`. Default `onAfterHire` = `navigate('/agents/' + agentId)`. Member-guard внутри компонента: standalone → NoAccessState, embedded → null (caller decides). Banner с inline-link'ами рендерится только в standalone. QuickHireScreen теперь выглядит как 30-строчная обёртка `AppShell + PageHeader + <QuickHireGrid mode="standalone" />`. Visual regression: нулевая (grid + accordion + hire — те же компоненты, тот же DOM). `npm run lint` clean. `npm run build` clean (337 modules, 639ms). Жду подтверждения для Step 2.
- **2026-05-05 13:05** — **Step 2 done.** Inline empty-state на `/agents`. Files touched: `src/prototype/screens/AgentsScreen.tsx`. Изменения: (1) Filters/search Flex (статус-фильтры + name/description input) обёрнут в условие `agents && agents.length > 0` — при empty не рендерится, не плодит фрустрацию (нечего фильтровать). Loading-state (`!agents`) тоже не показывает фильтры — ждёт результат. (2) Empty-branch (`agents.length === 0`) разветвлён по `canCreate`: admin/domain_admin → `<Box mt="2"><Caption>Pick a starter template</Caption><Text>Hire your first agent in two clicks. You can rename, retrain, or fire later.</Text><QuickHireGrid mode="embedded" /></Box>`; member → текущий `<EmptyState>` с body «Ask a workspace admin to hire your first agent.» (action убран, button-CTA member-у не нужна). (3) `filtered.length === 0` ветка («no match») не тронута — это другая семантика. Imports добавлены: `Caption` из `common`, `QuickHireGrid` из `components/quick-hire-grid`. Поведение: `<QuickHireGrid mode="embedded" />` без banner'а (он только в standalone), member-guard внутри возвращает null (мы уже branch'ились по canCreate). После hire — `navigate('/agents/' + id)` дефолтный, как в sandbox. `npm run lint` clean. `npm run build` clean (337 modules, 650ms). Жду подтверждения для Step 3.
- **2026-05-05 13:20** — **Step 3 done.** EmptyHomeHero + branch на HomeScreen. Files touched: `src/prototype/screens/home/EmptyHomeHero.tsx` (new, ~50 строк), `src/prototype/screens/HomeScreen.tsx` (import + render-branch). EmptyHomeHero: `Card variant="surface" size="4"`, центрированный column-Flex, large icon-tile (56×56, accent border + accent-a3 background, IconAgent `ic--lg` 18px) — стилистически согласован со `StateIcon` из `states.tsx`, но визуально мощнее (56×56 vs 36×36, indigo accent vs gray). Heading size="6" + caption color="gray" с max-width 460px. Button `size="3"` ведёт на `#/agents` — admin видит, member нет. Copy: admin = «Build your team / You don't have any agents yet. Hire your first in two clicks — pick a role, review what they'll do, confirm. / [Build your team →]»; member = «No team yet / No agents have been hired yet. Ask a workspace admin to hire your first.» (без button). HomeScreen render-tree: `loading ? LoadingList : agents.length === 0 ? <EmptyHomeHero canCreate={isAdmin} /> : <AdminView ... />`. PageHeader приветствие («Good {time}, Ada.») и actions (Approvals / Start a chat) рендерятся всегда — empty hero идёт ниже как replacement дашборда. `npm run lint` clean. `npm run build` clean (337 modules, 662ms). Жду подтверждения для Step 4.
- **2026-05-05 13:35** — **Step 4 done.** Финальная сверка + `docs/backlog.md` обновлён. Никаких новых code-changes в Step 4 — только верификация и документация. (1) `docs/backlog.md` — пункт #3 остаётся открытым со статусом «частично сделано (agent-focused кусочек)» и явным списком оставшихся empty-states (`/approvals`, `/activity`, `/costs`, `/agents/:id/talk`, `/agents/:id/activity`). В раздел «Сделано» добавлены два пункта: 2026-05-05 quick-hire sandbox + 2026-05-05 empty-state onboarding на `/agents` и Home. История изменений обновлена. (2) Финальный sanity-pass: `npm run lint` clean, `npm run build` clean (337 modules, 642ms). Все 4 step'а плана закрыты. **Готово к ручной проверке по сценариям из § 9.** Note для следующей сессии: WelcomeToast (bottom-right pinned) и EmptyHomeHero (center-top) пространственно не конфликтуют, но при желании можно скрывать toast при empty workspace — это уже polish следующих итераций, не входит в эту задачу.
