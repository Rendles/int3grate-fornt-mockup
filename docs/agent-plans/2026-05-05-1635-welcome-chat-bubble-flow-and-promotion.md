# Welcome-chat — bubble-accumulation flow + dashboard promotion

**Status:** draft, awaiting user approval before Step 1.

## 1. Task summary

Перевести `/sandbox/welcome-chat` со stage-replacement на **bubble-accumulation** model (как в настоящем чате), извлечь reusable компонент, и **промотировать** его на dashboard (Home empty-state) вместо текущего `EmptyHomeHero`.

Конкретно:
- Текущая реализация — `Stage` discriminated union, каждый шаг **заменяет** предыдущий. Нужно — **chat history**: bubble'ы накапливаются вниз, prior сообщения остаются видимыми, новые добавляются с fade-in.
- Click на template → user-echo bubble «Sales Agent» появляется ниже existing welcome bubble, ниже него — описание role'а в system bubble, ниже — action-row.
- «Pick another» → новый user-echo «Pick another» + новый template-grid в свежем bubble (старый grid становится визуально muted и не кликабельный).
- После hire → `Hiring Sales Agent…` bubble, затем (при success) — agent greeting bubble (`template.welcomeMessage`), затем финальная action-row с одной кнопкой `Open chat with Sales Agent →` → click → navigate на `/agents/:id/talk/:chatId`. **Welcome-flow остаётся на одной странице до явного перехода в чат.**
- Auto-scroll в bottom при добавлении новых bubble'ов.
- Fade-in 150ms на каждом новом сообщении.
- Только **последняя** интерактивная панель кликабельная — старые grid'ы / action-row'ы dimmed (`opacity: 0.5`, `pointer-events: none`).

Извлечь `<WelcomeChatFlow />` в `src/prototype/components/welcome-chat-flow.tsx` (по образцу `QuickHireGrid` / `quick-hire-grid.tsx`):
- Sandbox `/sandbox/welcome-chat` использует его в `mode="standalone"` (внутри AppShell + PageHeader + MockBadge).
- HomeScreen empty branch использует его в `mode="embedded"` (внутри существующего PageHeader приветствия).

Promotion: HomeScreen `agents.length === 0` branch меняет `<EmptyHomeHero />` → `<WelcomeChatFlow mode="embedded" />`. **`EmptyHomeHero` удаляется** (file + import). Production /agents inline QuickHireGrid не трогаем.

Sandbox `/sandbox/welcome-chat` остаётся параллельно — для design-итераций. Удалим отдельной задачей после user-validation на Home.

Member-вариант: на Home empty workspace member видит embedded flow в member-варианте (system bubble «Your workspace doesn't have any agents yet. Ask an admin to hire your first.» + tutorial line), без template tiles. То же поведение что в текущем sandbox member-view.

Out-of-scope (явно не делаем):
- ❌ Inline composer + real chat continuation после hire (Option B из обсуждения). После hire показываем `Open chat →` button → navigate на /agents/:id/talk/:chatId. Real chat живёт там.
- ❌ Replacement '/agents' empty inline grid. QuickHireGrid там остаётся как есть.
- ❌ Удаление sandbox `/sandbox/welcome-chat` route. Удалится отдельной задачей после approval.
- ❌ Animation transitions сложнее чем CSS opacity fade-in.
- ❌ Persistence шагов welcome-flow (если user reload — flow сбрасывается). Acceptable для прототипа.
- ❌ Replay / scroll-back to re-pick previously rejected templates. Старые grid'ы dimmed and не кликабельные — user picks again через «Pick another» action-row.

## 2. Current repository state

**Sandbox WelcomeChatScreen (`screens/sandbox/WelcomeChatScreen.tsx`, ~390 строк):**
- `Stage` discriminated union: `{ kind: 'opening' | 'selected' | 'hiring' }`. Каждый stage **заменяет** предыдущий — opening исчезает когда user picks, selected исчезает когда clicks Hire, и т.д.
- `OpeningStage`, `SelectedStage`, `HiringStage` — per-stage компоненты, parent рендерит только один из них в зависимости от `stage.kind`.
- `useHireTemplate({ withSeedChat: true })` интегрирован — после success делает `navigate('/agents/:id/talk/:chatId')`.
- `MemberView` — отдельный компонент (system bubble + tutorial line), без template tiles.
- `SystemBubble`, `UserBubble`, `TutorialLine` — shared bubble components.

**Home empty branch (`screens/HomeScreen.tsx:89-90`):**
```tsx
agents!.length === 0 ? (
  <EmptyHomeHero canCreate={user?.role === 'admin' || user?.role === 'domain_admin'} />
) : (...)
```

**`EmptyHomeHero` (`screens/home/EmptyHomeHero.tsx`):** single Card hero — large icon tile + Heading + paragraph + Button → `/agents`. ~50 строк. Будет удалён.

**`useHireTemplate()` hook (`lib/use-hire-template.ts`):** `{ hire, busy, error, clearError }`. Принимает `options.withSeedChat`. Уже используется в QuickHireGrid и WelcomeChatScreen — не меняется.

**`api.createChat`** мок поддерживает `seed_assistant_message` (Step 1 предыдущего плана). Не меняется.

**Sidebar (`components/shell.tsx`):** 4 sandbox preview entries (Team Bridge / Approvals preview / Quick hire / Welcome chat). После promotion'а Welcome chat sidebar entry **остаётся** — sandbox параллельный.

## 3. Relevant files inspected

- `src/prototype/screens/sandbox/WelcomeChatScreen.tsx` — источник flow для refactor.
- `src/prototype/screens/HomeScreen.tsx:71-100` — empty branch для promotion.
- `src/prototype/screens/home/EmptyHomeHero.tsx` — будет удалён.
- `src/prototype/lib/use-hire-template.ts` — hook (не меняется).
- `src/prototype/lib/quick-hire.ts` — `QUICK_HIRE_TEMPLATES`, `appsFromGrants`, `extractSampleTasks` (не меняется).
- `src/prototype/lib/templates.ts` — `welcomeMessage` field (не меняется).
- `src/prototype/components/chat-panel.tsx:97-99` — auto-scroll pattern (`messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })`).
- `src/prototype/router.tsx` — `Link`, `useRouter`.
- `docs/ux-spec.md § 9-10` — anti-patterns (no animations heavier than fade, no AI-cliché).

## 4. Assumptions and uncertainties

**Assumptions:**

- **Bubble list = source of truth.** Один state `messages: WelcomeMsg[]` плюс `interactiveIdx: number | null` (индекс последнего активного интерактивного bubble — все ниже него или равные ему disabled). Когда user picks → push новые messages в list, обновить `interactiveIdx`.
- **Только последняя interactive panel реагирует на клики.** Старые grid'ы / action-row'ы muted (`opacity: 0.5`, `pointerEvents: 'none'`). Tutorial-line дubicate — каждый opening-grid имеет свою tutorial-line ниже; старые tutorial-line тоже dimmed.
- **Reset state на promotion.** Если user открывает Home, начинает welcome-flow (выбирает Sales, потом «Pick another», потом Marketing), потом покидает страницу — на следующем visit'е flow сбрасывается. Acceptable. Persistence через localStorage — overengineering на этом этапе.
- **Auto-scroll работает.** `messagesEndRef` + `scrollIntoView({ behavior: 'smooth', block: 'end' })` после каждого push'а. Аналог ChatPanel.
- **Fade-in 150ms.** Каждый новый message получает CSS animation `welcome-fade-in` (opacity 0 → 1 + translateY 4px → 0). Простой и не cliché. Без typing-effect.
- **Embedded mode на Home — page-padding.** HomeScreen использует `.page` (не narrow). Чтобы flow не растягивался на 1400px и bubbles не выглядели нелепо — внутри `<WelcomeChatFlow mode="embedded" />` оборачиваем content в `<Box style={{ maxWidth: 720, marginInline: 'auto' }}>` или используем self-contained narrow-wrap. Bubbles max-width 78% от 720px = ~565px. Standalone mode (sandbox) полагается на parent `.page--narrow`.
- **`HomeScreen` PageHeader actions при empty.** Сейчас всегда рендерятся `Approvals` + `Start a chat` в actions. При empty workspace Approvals → нет approval'ов, Start a chat → ChatNewScreen requires picked agent — не работает. Decision: **скрываем actions** на Home когда `agents.length === 0`. PageHeader-приветствие («Good morning, Ada.») остаётся.
- **EmptyHomeHero удаляется.** File + import + любые tests/refs. Если кому-то понадобится снова — git revert. Cleanliness > backwards-comp.
- **Sandbox остаётся.** Route + sidebar entry + `WelcomeChatScreen.tsx` живут параллельно. После validation на Home — удалим отдельной задачей.
- **Member-variant identical в sandbox и embedded.** Один `MemberView` блок внутри `<WelcomeChatFlow />` — рендерится когда `user.role === 'member'`.

**Uncertainties:**

- **PageHeader subtitle на Home при empty.** Текущий: «Team-wide counts, live approvals, and spend this week.» — для empty workspace это лоgically false (нет counts). Можно: (a) подменить subtitle на «Let's set up your team.» когда empty; (b) убрать subtitle вовсе при empty; (c) оставить как есть. **Беру (a)** — короткий контекст почему пользователь видит welcome-chat вместо metrics.
- **Когда user clicks `Open chat with Sales Agent →`** — мы навигируем на `/agents/:id/talk/:chatId`. Что если ChatPanel в embed mode приходит и видит messages list уже содержащий seeded greeting (мы кладём его в `fxChatMessages[id]` через extended `createChat`) — отрисует ли его? Да, `listChatMessages` вернёт seeded message, ChatPanel отрисует normal MessageBubble с моделью + ago. Должно работать без правок ChatPanel. Verify в Step 4.
- **Disabling старых grid'ов — pointerEvents или disabled?** Беру `pointer-events: none` + `opacity: 0.5`. Не блокирует focus — но и не даёт click trigger'ить. Tab navigation на disabled-grid card будет работать, но Enter не будет триггерить. Это OK для прототипа, потому что фокус естественно опускается вниз к latest interactive panel.
- **Hiring stage error path в bubble-accumulation модели.** Если hire фейлится — push «error» bubble (Banner) и в той же позиции возвращаем action-row для retry. То есть flow:
  - click Hire → push hiring-bubble → API call
  - on error → remove hiring-bubble (или mark failed) + push error-bubble + push **retry** action-row (re-show «Pick another / Modify / Hire»).
  - on success → remove hiring-bubble (или leave) + push agent-greeting bubble + push «Open chat →» action-row.
  - **Беру: leave hiring-bubble** (история сохраняется), на error append error+retry, на success append greeting+open-chat. Это самая natural narrative.
- **Animation flicker** при рендере trigger'ной cmp в первый раз — `welcome-fade-in` animation на mount всех messages. Но мы не хотим чтобы opening-bubble fade'ил на load — он уже виден когда страница mount'ится. Решение: animate только messages добавленные **после** initial mount. Можно через flag `animateNewOnly` или через `useEffect` который добавляет animation class только к свежедобавленным. Простой подход — каждый message с `key` уникальным id, и CSS-animation triggered'ится через mount React'а message'а в DOM. Initial messages — на load — animation сработает один раз быстро, не критично. Если flicker — добавим check на mount.
- **HomeScreen layout breakage.** Если flow embedded растёт на 1000+ pixels (после нескольких «Pick another»), а HomeScreen имеет fixed-height структуру — overflow / cropping. Беру: HomeScreen `.page` is auto-height. Body растёт вертикально. Sidebar fixed.
- **`.page--narrow` vs `.page`.** Sandbox использует `--narrow`. Home использует `.page`. Чтобы не было visual diff'а bubble-width между sandbox и Home — wrapping internal `maxWidth: 720` решает (предсказуемо в обоих контекстах).

## 5. Proposed approach

### Файлы

**Новый:** `src/prototype/components/welcome-chat-flow.tsx` — reusable компонент с bubble-accumulation, exports `WelcomeChatFlow` and `WelcomeChatFlowMode` type.

**Изменяется:**
- `src/prototype/screens/sandbox/WelcomeChatScreen.tsx` — превращается в тонкую обёртку: `AppShell + PageHeader + MockBadge + <WelcomeChatFlow mode="standalone" />`. Stage-логика и UI bubbles переезжают в новый компонент.
- `src/prototype/screens/HomeScreen.tsx` — empty branch меняет `<EmptyHomeHero />` → `<WelcomeChatFlow mode="embedded" />`. Subtitle подменяется на «Let's set up your team.» когда empty. Actions row скрывается когда empty.
- `src/prototype/prototype.css` — добавляем keyframe `welcome-fade-in` (opacity + translateY 4px → 0, 150ms).

**Удаляется:**
- `src/prototype/screens/home/EmptyHomeHero.tsx` — file + import в HomeScreen.tsx.

### Data model

```ts
// Discriminated union — каждое сообщение знает что рендерить.
type WelcomeMsg =
  | { kind: 'system-text'; id: string; content: ReactNode }
  | { kind: 'user-echo'; id: string; content: string }
  | { kind: 'template-grid'; id: string }
  | { kind: 'tutorial-line'; id: string }
  | { kind: 'template-details'; id: string; templateId: string }
  | { kind: 'action-row'; id: string; templateId: string; phase: 'select' | 'open-chat'; agentId?: string; chatId?: string }
  | { kind: 'hiring'; id: string; templateId: string }
  | { kind: 'agent-greeting'; id: string; templateId: string }
  | { kind: 'error'; id: string; message: string }

// Component state.
type State = {
  messages: WelcomeMsg[]
  // Index of the latest interactive message (template-grid / action-row).
  // Earlier interactive messages are rendered with opacity 0.5 + pointer-events: none.
  // Null when there's no interactive message at the bottom (e.g. during 'hiring').
  activeIdx: number | null
}
```

### Initial state (admin)

```
[0] system-text: "Welcome to your team."  ← (first paragraph)
                "Pick a role below to start, or take a quick tutorial."
[1] template-grid                         ← interactive (activeIdx=1)
[2] tutorial-line                         ← link, also interactive but separate
```

After clicking Sales:

```
[0] system-text                           ← dimmed (older)
[1] template-grid (Sales selected)        ← dimmed, pointer-events: none
[2] tutorial-line                         ← dimmed
[3] user-echo: "Sales Agent"              ← right-aligned
[4] template-details (Sales)              ← system bubble with about/apps/tasks/approvals
[5] action-row (phase: 'select')          ← interactive (activeIdx=5)
                                            buttons: Pick another · Modify · Hire Sales Agent
```

After clicking Hire:

```
[..prior..]
[5] action-row                            ← dimmed
[6] hiring (template: sales)              ← spinner bubble, no interactive
                                            (activeIdx = null while busy)
```

After hire success:

```
[..prior..]
[6] hiring                                ← stays, marker of completion
[7] agent-greeting (sales)                ← system bubble: "Hi — I'm your Sales Agent..."
[8] action-row (phase: 'open-chat')       ← interactive (activeIdx=8)
                                            single button: Open chat with Sales Agent →
```

After hire error:

```
[..prior..]
[6] hiring                                ← stays, marker of attempt
[7] error (message)                       ← banner
[8] action-row (phase: 'select')          ← interactive (activeIdx=8)
                                            same as before (Pick another / Modify / Hire)
```

After clicking «Pick another» (from select action-row):

```
[..prior..]
[5] action-row (phase: 'select')          ← dimmed
[6] user-echo: "Pick another"             ← right-aligned
[7] template-grid                         ← fresh grid, interactive (activeIdx=7)
```

### Component structure

```tsx
// Public API
type WelcomeChatFlowMode = 'standalone' | 'embedded'
interface WelcomeChatFlowProps {
  mode: WelcomeChatFlowMode
}

export function WelcomeChatFlow({ mode }: WelcomeChatFlowProps) {
  const { user } = useAuth()
  const isMember = user?.role === 'member'
  const [state, dispatch] = useReducer(reducer, initialState(isMember))
  // ...
  // Render messages list with auto-scroll, fade-in animations.
}

// Reducer pattern keeps state transitions explicit & testable.
type Action =
  | { type: 'pick-template'; template: AssistantTemplate }
  | { type: 'pick-another' }
  | { type: 'start-hire'; template: AssistantTemplate }
  | { type: 'hire-success'; template: AssistantTemplate; agentId: string; chatId?: string }
  | { type: 'hire-error'; template: AssistantTemplate; message: string }

function reducer(state: State, action: Action): State { /* ... */ }
```

### Auto-scroll

```tsx
const endRef = useRef<HTMLDivElement | null>(null)
useEffect(() => {
  endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
}, [state.messages.length])
```

### CSS keyframe

```css
@keyframes welcome-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.welcome-msg {
  animation: welcome-fade-in 150ms ease-out;
}
.welcome-msg--dimmed {
  opacity: 0.5;
  pointer-events: none;
  transition: opacity 150ms ease-out;
}
```

### HomeScreen change

```tsx
{loading ? (
  <Box mt="5"><LoadingList rows={8} /></Box>
) : agents!.length === 0 ? (
  <Box mt="4"><WelcomeChatFlow mode="embedded" /></Box>
) : (
  <AdminView ... />
)}
```

PageHeader subtitle/actions — conditional на empty:

```tsx
<PageHeader
  eyebrow={...}
  title={...}
  subtitle={
    isEmpty ? "Let's set up your team."
            : "Team-wide counts, live approvals, and spend this week."
  }
  actions={isEmpty ? undefined : <>...current actions...</>}
/>
```

(`isEmpty` — derived from `agents.length === 0` после loading.)

### Sandbox standalone wrapper

```tsx
// screens/sandbox/WelcomeChatScreen.tsx — превращается в:
export default function WelcomeChatScreen() {
  return (
    <AppShell crumbs={[...]}>
      <div className="page page--narrow">
        <PageHeader eyebrow={... + MockBadge} title={...} subtitle={...} />
        <WelcomeChatFlow mode="standalone" />
      </div>
    </AppShell>
  )
}
```

## 6. Risks and trade-offs

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Bubble-accumulation model — fundamental rewrite, easy to introduce regression | high | Step 1 рефакторит на изолированном sandbox screen. Step 2 — extract без логических изменений. Step 3 — promotion (новая ветка, EmptyHomeHero удаляется только когда новый flow работает). После каждого step'а verify по browser checklist. |
| Auto-scroll конфликтует с парент-scroll'ом на Home (если Home длинная страница) | medium | `scrollIntoView({ block: 'end' })` скроллит ближайший scrollable parent. На Home parent — главное окно. На большом экране это значит scroll к последнему bubble'у. На small screen — то же. Acceptable. Если плохо — `behavior: 'auto'` instead of smooth. |
| Старые grid'ы dimmed но всё ещё в DOM — accessibility | medium | `pointer-events: none` плюс `aria-disabled="true"` на dimmed Card. tabIndex={-1} чтобы убрать из tab order. |
| Fade-in animation на initial mount всех messages выглядит как «лента» | low | Initial state имеет 3 messages (welcome / grid / tutorial). Они анимируются сразу. Это короткий burst (150ms) — не отвлекает. Если ugly — добавим `disable-initial-animation` flag. |
| `EmptyHomeHero` удалена — пользователь привык, рассчитывает на неё | low | Заменяется чем-то более интересным. Не regression, эволюция. |
| Promotion на Home: PageHeader actions при empty (Approvals / Start a chat) — disabled или скрыты | low | Beрём: скрыты (`actions={undefined}` при empty). Approvals empty не делает смысла, Start a chat ведёт на ChatNewScreen которая требует agent — нет agent'ов — broken flow. |
| Sandbox + production parallel — confusion для дизайнеров и dev | low | Sandbox sidebar entry имеет `preview` badge. Sandbox banner / MockBadge явно говорит «sandbox preview». Production HomeScreen empty не показывает MockBadge — это live UX. |
| Reducer-based state — code-style change vs current useState | low | Reducer's более ясно для accumulating sequences. useState с массивом тоже работает; но reducer gives explicit transitions. Если предпочитаешь useState — могу сделать; но лично reducer чище для chat-narrative state machine. |
| Member на Home empty видит welcome-chat в member-варианте — текст «Ask an admin» без CTA | low | То же что сегодня в EmptyHomeHero (member видит «No team yet. Ask...»). Не regression. |
| User reload Home в середине flow — теряет progress | low | Acceptable. Если важно — `useReducer` state persist через `localStorage`, но это lazy optimization. Не нужно сейчас. |
| Bubbles накопятся на 10+ items если user долго играет с pick another — overflow | low | Acceptable. UX-driven user пройдёт flow за 1-3 picks. Если delete-old / collapse-old — отдельная feature. |
| Action-row с одной кнопкой «Open chat with Sales Agent →» выглядит pretty plain | low | Можно сделать `solid` accent button + arrow icon. Visually weighted. Single-button rows работают. |

## 7. Step-by-step implementation plan

**Step 1 — Refactor sandbox WelcomeChatScreen на bubble-accumulation (без extract'а).**

- Заменить `Stage` discriminated union на `WelcomeMsg[] + activeIdx`.
- Реализовать `reducer` с actions: `pick-template`, `pick-another`, `start-hire`, `hire-success`, `hire-error`.
- Render messages в order, dimmed older interactive panels.
- Auto-scroll через `useRef` + `useEffect`.
- Добавить CSS keyframe `welcome-fade-in` в `prototype.css`.
- Member-version в той же модели — initial state даёт два messages (member-system-text + tutorial-line).
- Click Hire wires existing `useHireTemplate({ withSeedChat: true })` → on success dispatch `hire-success` (которое push'ит agent-greeting + open-chat action-row); on error dispatch `hire-error`. На «Open chat» action-row click → navigate.
- Проверить `npm run lint && npm run build` clean.

**Verify:** `/sandbox/welcome-chat` — все шаги работают как раньше но bubble'ы накапливаются. Click Sales → opening + grid + tutorial остаются (dimmed), ниже добавляются user-echo + details + action-row. Pick another → новый user-echo + новый grid. Hire → hiring bubble + greeting + open-chat row → click → navigate на talk/chatId. Member-variant: 2 bubbles, immutable (no interactive). Sandbox banner/MockBadge не тронуты.

**Step 2 — Extract в `<WelcomeChatFlow />`.**

- Создать `src/prototype/components/welcome-chat-flow.tsx`: переносим reducer, types, all sub-components (MessageRenderer, TemplateGrid, TemplateDetails, ActionRow, HiringBubble, GreetingBubble, ErrorBubble, UserBubble, SystemBubble, TutorialLine, MemberView).
- Component API: `{ mode: 'standalone' | 'embedded' }`. Внутри — `<Box style={{ maxWidth: 720, marginInline: 'auto' }}>` для consistency.
- `WelcomeChatScreen.tsx` сжимается до тонкой обёртки `AppShell + PageHeader + MockBadge + <WelcomeChatFlow mode="standalone" />`.
- Verify sandbox `/sandbox/welcome-chat` ведёт себя 1:1 как после Step 1.

**Verify:** `/sandbox/welcome-chat` визуально / функционально не изменился. Lint+build clean.

**Step 3 — Promotion на HomeScreen + удаление EmptyHomeHero.**

- В `HomeScreen.tsx`: import `WelcomeChatFlow` from new component.
- Заменить `<EmptyHomeHero canCreate={...} />` на `<Box mt="4"><WelcomeChatFlow mode="embedded" /></Box>` в empty branch. (canCreate prop не нужен — компонент знает member-variant сам через useAuth.)
- PageHeader: derive `isEmpty` (`agents && agents.length === 0`); subtitle conditional («Let's set up your team.» при empty, текущий при non-empty); actions conditional (undefined при empty).
- Удалить `import { EmptyHomeHero } from './home/EmptyHomeHero'` и сам файл `screens/home/EmptyHomeHero.tsx`.

**Verify:** 
1. Login admin + dev-mode `Empty` → `/` → видно PageHeader приветствие + subtitle «Let's set up your team.» + welcome-chat embedded (welcome bubble + grid + tutorial). Click Sales → накапливается. Hire → greeting → Open chat → navigate.
2. Login admin + dev-mode `Real` → `/` → нормальный AdminView с metrics. Subtitle/actions нормальные.
3. Login member + dev-mode `Empty` → `/` → embedded member-variant (system bubble «Ask admin» + tutorial). Без template tiles.

**Step 4 — Polish + visual fine-tuning + final lint/build.**

- Verify fade-in animation выглядит smoothly (не «прыгает»).
- Verify auto-scroll behavior на Home (не должно скроллить сильно после последнего pick).
- Verify layout-breakage на small screens (<480px) — bubbles wrap правильно.
- Verify dimmed older grid'ы visibly muted и не кликабельны (в т.ч. tab navigation skips them).
- Verify embedded `maxWidth: 720` consistency между sandbox и Home — bubbles одинакового размера.
- `aria-disabled="true"` + `tabIndex={-1}` на dimmed interactive elements.
- Final `npm run lint && npm run build`.

**Verify:** Full happy path:
1. localStorage clear → login admin → bug-icon Empty → `/`.
2. Видно welcome bubble + grid + tutorial line. Auto-scroll положение OK.
3. Hover на Sales tile — `card--hover` подсветка.
4. Click Sales → fade-in: user-echo + details + action-row. Старый grid dimmed.
5. Click Pick another → fade-in: user-echo + новый grid. Старый action-row dimmed, старый details dimmed.
6. Click Marketing → details/action-row для Marketing.
7. Click Modify → navigate на /agents/new?template=marketing → AgentNewScreen pre-positioned.
8. Browser back → welcome-chat сохранил состояние? (если parent component не unmount'ился). Если потерял — acceptable.
9. Re-pick Sales → click Hire → hiring bubble. ~1s → greeting + Open chat. Click → navigate на /agents/agt_sales_agent/talk/cht_xxxx → assistant greeting там же.
10. Sidebar → Home → AdminView (1 active agent теперь). EmptyHomeHero удалён, не виден.
11. Sandbox `/sandbox/welcome-chat` — тот же flow, MockBadge + sandbox banner.

## 8. Verification checklist

- [ ] `components/welcome-chat-flow.tsx` exists, exports `WelcomeChatFlow` + `WelcomeChatFlowMode`.
- [ ] `screens/sandbox/WelcomeChatScreen.tsx` — thin wrapper (~30 строк) с MockBadge + standalone WelcomeChatFlow.
- [ ] `screens/home/EmptyHomeHero.tsx` — DELETED. Import в HomeScreen.tsx тоже удалён.
- [ ] `HomeScreen.tsx` empty branch использует `<WelcomeChatFlow mode="embedded" />`.
- [ ] HomeScreen PageHeader subtitle conditional («Let's set up your team.» при empty).
- [ ] HomeScreen PageHeader actions hidden при empty.
- [ ] `prototype.css` имеет `welcome-fade-in` keyframe и `.welcome-msg--dimmed` rules.
- [ ] Bubble-accumulation: opening → click Sales → user-echo + details + action-row appended (старые dimmed).
- [ ] Pick another → user-echo + новый grid appended.
- [ ] Hire success → hiring + greeting + open-chat action-row appended.
- [ ] Hire error → hiring + error banner + retry action-row appended.
- [ ] Auto-scroll работает (scroll-to-bottom on new message).
- [ ] Fade-in animation (~150ms opacity + translateY 4px → 0).
- [ ] Dimmed older interactive elements: opacity 0.5, pointer-events none, aria-disabled, tabIndex -1.
- [ ] Open chat action-row → click → navigate `/agents/:id/talk/:chatId`. ChatPanel в embed mode рендерит seeded greeting message.
- [ ] Member на `/sandbox/welcome-chat` и Home empty видит member-variant без template tiles.
- [ ] Sandbox `/sandbox/welcome-chat` route + sidebar entry остаются (parallel coexistence).
- [ ] `/sandbox/quick-hire`, `/agents` empty inline grid, `/agents/new`, `/agents/new?template=sales` — никаких regression.
- [ ] `npm run lint` clean.
- [ ] `npm run build` clean.

## 9. Browser testing instructions for the user

**Setup:** `npm run dev`, login `frontend@int3grate.ai` (admin) / `member@int3grate.ai` (member).

**Step 1 — bubble accumulation на sandbox:**
- `/sandbox/welcome-chat` → opening welcome bubble + grid + tutorial visible.
- Click Sales → user-echo `Sales Agent` (right) → system details bubble → action-row appears below. Старый grid dimmed.
- Pick another → user-echo `Pick another` → new grid. Старая action-row dimmed.
- Click Hire Sales → hiring bubble (spinner) → greeting bubble «Hi — I'm your Sales Agent…» → action-row [`Open chat with Sales Agent →`] appears.
- Click Open chat → navigate на `/agents/agt_sales_agent/talk/cht_xxxx` → ChatPanel loads, seeded greeting visible как assistant turn.

**Step 2 — extract, no visual diff:**
- `/sandbox/welcome-chat` ведёт себя 1:1 как Step 1.

**Step 3 — promotion на Home:**
- bug-icon Empty + reload `/`.
- PageHeader приветствие («Good morning, Ada.») + subtitle «Let's set up your team.». Actions hidden (нет Approvals / Start a chat).
- Below — embedded welcome-chat flow.
- Полный happy path как в sandbox: Sales → Hire → Open chat.
- bug-icon Real → `/` → нормальный AdminView с metrics. Subtitle / actions normal.
- Member empty → `/` → member-variant (без template tiles).

**Step 4 — polish:**
- Resize window → bubbles адаптируются под maxWidth 720.
- Tab navigation на dimmed grid → focus skips, не triggers click.
- `EmptyHomeHero.tsx` удалён — git status показывает deletion.
- Sandbox `/sandbox/welcome-chat` всё ещё доступен через sidebar.

## 10. Progress log

- **2026-05-05 16:35** — план создан. Подтверждено: Option A (post-hire = inline greeting + Open chat → navigate), sandbox остаётся параллельно, fade-in 150ms, member-variant identical в sandbox и embedded. Refactor stage→bubble accumulation, extract в `<WelcomeChatFlow />`, promotion на HomeScreen empty branch с удалением EmptyHomeHero. PageHeader на Home conditional при empty (subtitle change, hide actions). 4 step'а: refactor → extract → promote+delete → polish. Жду «делай» для Step 1.
- **2026-05-05 17:00** — **Step 1 done.** Sandbox refactor на bubble-accumulation. Files touched: `src/prototype/screens/sandbox/WelcomeChatScreen.tsx` (полный rewrite, ~530 строк), `src/prototype/prototype.css` (добавлены `.welcome-msg` keyframe и `.welcome-msg--dimmed` rules + `prefers-reduced-motion` guard). Data model: `WelcomeMsg` discriminated union из 9 kind'ов (system-text / user-echo / template-grid / tutorial-line / template-details / action-row / open-chat-row / hiring / agent-greeting / error). State `{ messages: WelcomeMsg[]; frozenIdx: number }` + `useReducer`. Actions: `pick-template` (push user-echo + details + action-row), `pick-another` (push user-echo + new template-grid), `start-hire` (push hiring), `hire-success` (push agent-greeting + open-chat-row), `hire-error` (push error + retry action-row). Reducer pattern: `frozenIdx = messages.length` snapshot ДО push'а — все interactive messages с index < frozenIdx становятся dimmed (`pointer-events: none`, opacity 0.5, aria-disabled, tabIndex -1). Initial state derived from `useReducer(reducer, isMember, m => m ? memberInitialState() : adminInitialState())`. Auto-scroll через `endRef` + `scrollIntoView({ behavior: 'smooth', block: 'end' })` на change `messages.length`. `MessageRenderer` switch'ит по kind и рендерит соответствующий bubble: `SystemBubble`, `UserBubble`, `TemplateGrid`, `TutorialLine`, `TemplateDetailsBubble`, `SelectActionRow`, `OpenChatActionRow`, `HiringBubble`, agent-greeting (system bubble с welcomeMessage), error banner. CSS fade-in animation (150ms opacity + translateY) на каждом `.welcome-msg`-wrapper. Hire wiring: `useHireTemplate({ withSeedChat: true })` интегрирован, success/error дispatch'ит соответствующее. Open chat: navigate на `/agents/:id/talk/:chatId` (или fallback `/agents/:id/talk` если chatId undefined). Module-level `_msgCounter` для unique IDs (collisions across instances не ожидаются). Member-variant: `memberInitialState()` даёт 2 messages (system-text «Ask admin» + tutorial-line) — не интерактивно, ничего не дispatch'ится. `npm run lint` clean. `npm run build` clean (655 kB bundle, 639ms — было 644 kB, +11 kB на новый flow). Жду подтверждения для Step 2.
- **2026-05-05 17:15** — **Step 2 done.** Extract `<WelcomeChatFlow />` в reusable component. Files touched: новый файл `src/prototype/components/welcome-chat-flow.tsx` (~520 строк), `src/prototype/screens/sandbox/WelcomeChatScreen.tsx` сжат до ~35-строчной обёртки `AppShell + PageHeader + MockBadge + <WelcomeChatFlow />`. Перенесено в новый компонент: `WelcomeMsg` discriminated union, `isInteractive` helper, module-level `_msgCounter` + `makeId`, `State` / `Action` types, `adminInitialState` / `memberInitialState`, `reducer`, всё хождение через `useReducer` + `useEffect` (auto-scroll) + `useHireTemplate`, `MessageRenderer`, и все sub-components: `TemplateGrid`, `TemplateTile`, `TemplateDetailsBubble`, `SelectActionRow`, `OpenChatActionRow`, `HiringBubble`, `SystemBubble`, `UserBubble`, `TutorialLine`. Внутренний wrapper `<Box style={{ maxWidth: 720, marginInline: 'auto' }}>` — для consistency визуала когда компонент embedded в `.page` (Home, шире) и в `.page--narrow` (sandbox, 920px). Решил **не вводить `mode` prop** — функциональной разницы между standalone / embedded в текущей реализации нет, добавим если/когда понадобится (YAGNI per CLAUDE.md). MockBadge остаётся в screen wrapper sandbox'а — компонент сам по себе чистый. Verify: `/sandbox/welcome-chat` ведёт себя 1:1 как после Step 1. `npm run lint` clean. `npm run build` clean (655 kB, 649ms). Жду подтверждения для Step 3.
- **2026-05-05 17:30** — **Step 3 done.** Promotion на HomeScreen + удаление EmptyHomeHero. Files touched: `src/prototype/screens/HomeScreen.tsx` (import `WelcomeChatFlow`, удалён import `EmptyHomeHero`, добавлен `isEmpty = !loading && agents !== null && agents.length === 0`, PageHeader subtitle/actions conditional на `isEmpty`, render-tree empty branch теперь `<Box mt="4"><WelcomeChatFlow /></Box>`). **Удалён файл** `src/prototype/screens/home/EmptyHomeHero.tsx`. PageHeader при empty: subtitle = «Let's set up your team.» (вместо «Team-wide counts...»), actions = undefined (скрываем «Approvals» + «Start a chat» — оба broken для empty workspace). Greeting heading и eyebrow остаются как есть. `isEmpty` определяется ПОСЛЕ загрузки (`!loading && agents !== null && agents.length === 0`) — иначе мы бы flash'или empty-copy между рендерами. WelcomeChatFlow внутри knows о member-роли через useAuth — отдельного prop не нужно. `npm run lint` clean. `npm run build` clean (653ms). Жду подтверждения для Step 4.
- **2026-05-05 18:30** — **Chat-feel polish round** (по фидбеку: «обводки, перенести picker вниз, hover preview, выделить чат как карточку»). Files touched: `src/prototype/components/welcome-chat-flow.tsx` (refactor), `src/prototype/prototype.css` (frame + chip). Изменения: (1) **Frame as card** — компонент завернут в `.welcome-frame` (background gray-2, border 1px gray-a4, border-radius 14, overflow hidden, min-height 360, max-height `min(720px, calc(100svh - 220px))`, flex-column). Внутри две зоны: `.welcome-frame__messages` (flex 1, overflowY auto, padding 16) — scrollable chat history; `.welcome-frame__picker` (border-top gray-a4, padding 14 16, sticky bottom) — sticky picker strip. (2) **Picker moved to bottom** — больше не часть messages list. Рендерится отдельной зоной внутри frame. Caption «Pick a role» + Flex chips. Auto-scroll теперь работает в пределах messages box (overflow-y auto делает его scroll-ancestor'ом). (3) **HoverCard preview** на каждом chip — Radix `HoverCard.Root openDelay={250}` с side="top". Content size="1" maxWidth 320: name + shortPitch + до 5 apps как Badge chips. Keyboard accessible (focus = hover). (4) **Chip restyle** — убрана граница (`border: none`), tonal `gray-a3` background → hover `accent-a3`. Соответствует «no borders» visual vocabulary остального app'а. (5) **State model упрощён** — убран `pick-another` action из union и reducer. Убран `template-grid` kind из `WelcomeMsg`. `RendererProps.onPickAnother` и `onPickTemplate` props убраны (picker сам по себе). Убран «Pick another» button из `SelectActionRow` — теперь только Modify + Hire. Initial admin-state теперь только welcome bubble + tutorial-line (без template-grid в чате). (6) **Picker visibility** derives from messages.last: `hireDone = last.kind === 'open-chat-row'` (скрываем picker), `hireBusy = last.kind === 'hiring'` (chips disabled, opacity 0.55). Member тоже не видит picker. (7) **Member flow** unchanged: welcome bubble «Ask admin» + tutorial. Не показываем picker (member не может нанимать). Imports updated: добавлен `HoverCard`, удалён `IconArrowLeft`. `npm run lint` clean. `npm run build` clean (660 kB, 677ms; +5 kB на HoverCard). Ждёт user-review в браузере.

- **2026-05-05 17:45** — **Step 4 done.** Final verification round — никаких code changes, только review code quality + lint + build:
  - **A11y review.** Dimmed messages: parent `welcome-msg--dimmed` (pointer-events: none + opacity 0.5) + per-element `aria-disabled` + `tabIndex={-1}` + `role` removed when dimmed. Tab navigation skips dimmed elements. Tutorial Link rendered как plain `<span>` когда dim'нутый (двойная защита).
  - **Voice review.** 0 emoji, 0 «Hey friend!», 0 exclamation points в любом UI-text. Linear/Notion стилистика. UX-spec § 9-10 anti-patterns avoided.
  - **Visual hierarchy.** Bubbles layout chat-style: system-bubbles слева gray-3 max-width 78%, user-echo справа accent-a3 max-width 78%, template-grid full 720px width (это reply-menu, не сообщение — chat-pattern норма), tutorial-line dashed gray-2 max-width 78%, hiring-bubble system-style с inline spinner + cosmetic 3-line description.
  - **Stage transitions** — fade-in 150ms (opacity + translateY 4px → 0) на каждом новом message, dimmed-transition 150ms на переход older-interactive в dim. Reduced-motion guard срабатывает корректно.
  - **Auto-scroll** — `scrollIntoView({ behavior: 'smooth', block: 'end' })` на change `messages.length`. На Home (длинная страница с PageHeader выше) скроллит к последнему bubble — это natural narrative behavior.
  - **Layout consistency.** WelcomeChatFlow внутренний `maxWidth: 720` обеспечивает identical размер bubbles в sandbox (parent `.page--narrow` 920px) и Home (parent `.page` full-width). Bubbles 565px max в обоих контекстах.
  - **Custom template** не fallback'нется в welcome-chat (его нет в `QUICK_HIRE_TEMPLATES`). Только 6 non-custom templates.
  - **Final state of files:** `lib/templates.ts` + `lib/types.ts` + `lib/api.ts` + `lib/use-hire-template.ts` + `lib/quick-hire.ts` + `components/welcome-chat-flow.tsx` + `screens/sandbox/WelcomeChatScreen.tsx` + `screens/HomeScreen.tsx` + `tours/WelcomeToast.tsx` + `components/shell.tsx` + `index.tsx` + `prototype.css` + `docs/backend-gaps.md`. **Удалён** `screens/home/EmptyHomeHero.tsx`. Sandbox route + sidebar entry — остаются (parallel coexistence; удалится отдельной задачей после user-validation).
  - `npm run lint` clean. `npm run build` clean. **Все 4 step'а закрыты — готово к ручной проверке по сценариям из § 9.**
