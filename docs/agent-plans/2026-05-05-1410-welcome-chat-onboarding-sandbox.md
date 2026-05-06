# Welcome-chat onboarding sandbox

**Status:** draft, awaiting user approval before Step 1.

## 1. Task summary

Sandbox preview `/sandbox/welcome-chat` — guided onboarding wizard стилизованный под чат, для empty workspace. Заменяет dashboard-like EmptyHomeHero на narrative-driven flow: pick role → review → confirm → land in real chat with the new agent (который приветствует через synthetic seed-message).

Делается строго по образцу sandbox preview pattern (как team-bridge / approvals-inline / quick-hire) — production EmptyHomeHero и QuickHireGrid НЕ ломаем, sandbox живёт параллельно. Если идея зайдёт — отдельный раунд promotion'а заменит EmptyHomeHero на этот flow.

В рамках задачи:
- ✅ Новый sandbox-screen `/sandbox/welcome-chat` со chat-bubble layout (system bubbles + clickable card replies, **никакого textbox**).
- ✅ 3 stage'а внутри одного screen'а: opening (intro + template tiles) → selected (description + Hire/Modify/Pick another) → hiring (spinner).
- ✅ После hire — auto-create chat с **synthetic assistant welcome message** из `template.welcomeMessage`, navigate на `/agents/:id/talk/:chatId`.
- ✅ Reusable hook `useHireTemplate()` для hire-цепочки (вынесен из `quick-hire-grid.tsx` чтобы шарить логику).
- ✅ `?template=X` query support в `AgentNewScreen` для кнопки «Modify before hire» — открывает full wizard pre-positioned.
- ✅ Member-версия: упрощённое intro («Your team is empty. Ask an admin to hire someone.») без template tiles.
- ✅ Скрытие `WelcomeToast` когда workspace пустой (избегаем overlap с welcome-chat сценой).

Out-of-scope (явно отказались):
- ❌ Реальный textbox / писательный chat-input — это **guided wizard**, не AI-assistant. Печатать нельзя.
- ❌ Editable name / instructions / grants внутри welcome-chat. «Modify» = link на full wizard.
- ❌ Замена production EmptyHomeHero / QuickHireGrid в `/agents`. Sandbox параллельный.
- ❌ Cartoonish avatars, robot mascots, AI sparkles, «Hey friend! 👋», emoji-tone — UX-spec § 9-10 anti-patterns.
- ❌ Animation transitions stage-to-stage сложнее чем CSS opacity. Это onboarding, не product reveal.
- ❌ Dynamically generated greeting через LLM — статичный per-template welcomeMessage в `templates.ts`.

## 2. Current repository state

**HomeScreen (post-Step 3 предыдущего плана):** `agents.length === 0` → `<EmptyHomeHero />` (single-card hero, button → /agents). Это production. Sandbox welcome-chat — отдельная страница, не трогает HomeScreen branch.

**QuickHireGrid (`components/quick-hire-grid.tsx`):** содержит:
- Templates filtering (`QUICK_HIRE_TEMPLATES`)
- Helpers `extractSampleTasks`, `appsFromGrants`
- `TemplateCard` + `ExpandedBody` UI
- **Hire-цепочка inlined**: `createAgent → createVersion → setGrants → activateVersion → navigate('/agents/:id')`. Это будем выносить в отдельный hook (Step 1) чтобы welcome-chat тоже мог его звать с другими параметрами (auto-create chat).

**ChatPanel (`components/chat-panel.tsx`):** три mode'а:
- `'full'` — full-screen, fetches chat+messages by `chatId`.
- `'embed'` — embedded в agent tab, тоже fetches by `chatId`.
- `'draft'` — без `chatId`, render empty + composer; на первом send делает `createChat → sendMessage → onCreated(chatId)`.

После hire welcome-chat будет navigate'ить на `/agents/:id/talk/:chatId` (embed mode) — chat УЖЕ создан с seed message. Никакой новый mode у ChatPanel не нужен.

**`api.createChat`** (`lib/api.ts:679`):
```ts
async createChat(req: CreateChatRequest, viewer: User): Promise<Chat> {
  // ... creates chat with empty fxChatMessages[id] = []
}
```
Не поддерживает seed messages. Расширим (Step 1) — optional `seed_assistant_message` в `CreateChatRequest`, mock prepends synthetic ChatMessage в `fxChatMessages[id]`. Backend gap (отметим в `backend-gaps.md`).

**`AssistantTemplate`** (`lib/templates.ts:23`):
```ts
{ id, defaultName, shortPitch, longPitch, defaultInstructions, defaultGrants, approvalCopy, defaultModel?, featured, initials }
```
Добавим `welcomeMessage: string` (1-2 предложения, business-tone).

**WelcomeToast** (`tours/WelcomeToast.tsx`): bottom-right pinned, persists `welcomePromptShown` в `localStorage["proto.tours.v1"]`. Показывается once per browser, link → `/learn`. Конфликт с welcome-chat: оба зовут что-то делать. Решение — скрывать toast когда `agents.length === 0` (welcome-chat и так зовёт).

**Sandbox precedents:**
- `/sandbox/team-bridge` — design preview без mutations.
- `/sandbox/approvals-inline` — preview inline approve/reject.
- `/sandbox/quick-hire` — preview 2-click hire (тонкая обёртка над QuickHireGrid после Step 1 предыдущего плана).

Все три имеют sidebar entries с muted `preview` badge под одним `dividerAbove: true`. Welcome-chat будет четвёртым.

**UX-spec constraints (§ 9-10):**
- No mascots / robots / cartoon avatars.
- No "Hey friend! 👋", no emoji-tone, no AI sparkles.
- No purple gradients.
- Voice: spокойный business-tone (Linear / Notion / Zoho).
- Aha moment в первые минуты — не после длинного onboarding.

## 3. Relevant files inspected

- `src/prototype/screens/HomeScreen.tsx` — production empty-state branch (не трогаем).
- `src/prototype/screens/home/EmptyHomeHero.tsx` — production fallback (не трогаем).
- `src/prototype/components/quick-hire-grid.tsx` — hire chain to extract.
- `src/prototype/components/chat-panel.tsx` — modes overview, embed mode usage.
- `src/prototype/lib/api.ts:282-380` (hire chain endpoints), `:679-715` (createChat mock).
- `src/prototype/lib/types.ts` — `AssistantTemplate`, `CreateChatRequest`, `ChatMessage`, `Chat`.
- `src/prototype/lib/templates.ts` — schema + 7 templates.
- `src/prototype/screens/AgentNewScreen.tsx` — full wizard, нужно добавить `?template=X` support.
- `src/prototype/router.tsx` — `useRouter().path` имеет query string? Проверить.
- `src/prototype/screens/sandbox/QuickHireScreen.tsx` — sandbox pattern reference.
- `src/prototype/components/shell.tsx:75-95` — sidebar sandbox entries pattern.
- `src/prototype/index.tsx:152-156` — sandbox routes registration.
- `src/prototype/tours/WelcomeToast.tsx` — toast logic, нужно gate'ить по `agents.length === 0`.
- `docs/ux-spec.md § 7, § 8, § 9-10` — aha moment, voice, anti-patterns.
- `docs/backend-gaps.md` — куда добавить seed_assistant_message gap.

## 4. Assumptions and uncertainties

**Assumptions:**

- **Это guided wizard, НЕ chat.** Никакого textbox. Только clickable card-replies. Визуально — chat bubbles, но behavior — wizard. В sandbox banner и в hint надо явно сказать «interactive intro», не «chat with AI».
- **Voice neutral business.** Examples: «Welcome. Pick a role to start.» / «Sales Agent — finds leads, drafts intros, follows up.» / «Hire Sales Agent» / «Pick another». **Не** «Hi there! 👋», **не** «Awesome! 🎉».
- **No agent avatar in welcome-chat.** В sample-design'е ChatPanel есть Badge с model name на assistant bubbles. Welcome chat — synthetic system messages, не настоящий agent. Я НЕ ставлю avatar/badge на system-bubbles. Просто индентация + bubble color (var(--gray-3) как ChatPanel).
- **`welcomeMessage` per template — статичный текст.** Maintained вручную в `templates.ts`. 1-2 предложения, business-tone. Например для Sales: «Hi, I'm your Sales Agent. I can review CRM leads, draft intro emails for your approval, and chase quiet prospects. Want to start with this week's inbound?»
- **`api.createChat` extension — mock-only.** Prod backend не имеет такого поля. Документируем в `backend-gaps.md` как gap §1.X. Backend нужен либо `seed_assistant_message` в request, либо отдельный `POST /chats/{id}/seed-message` endpoint, либо backend генерит greeting сам по `agent.welcome_template`.
- **Member version — упрощённый.** Без template tiles, без Hire button. System bubble «Your team is empty. Ask an admin to hire someone.» + кнопка «Take the tutorial» → `/learn`.
- **WelcomeToast suppress при empty workspace.** Чтобы не было overlap'а welcome-chat (center) + toast (bottom-right) обоих зовущих на onboarding. Toast показываем только когда workspace уже не пустой.
- **«Modify before hire»** = navigate на `/agents/new?template=sales`. Пользователь попадает в full wizard pre-positioned (skip phase='welcome', сразу phase='name' с pre-filled template state).
- **Promotion path:** sandbox параллелен с EmptyHomeHero. Sandbox sidebar-link у admin'а виден, у member'а — тот же link виден (но welcome-chat внутри показывает member-версию). Если идея зайдёт — отдельный раунд: EmptyHomeHero deletes, HomeScreen empty branch указывает на welcome-chat (либо inlined, либо redirect).

**Uncertainties:**

- **Auto-create chat при hire — race condition.** Если `createChat` после `activateVersion` падает — что показываем? Agent уже создан, но chat нет. Решение: catch error → fallback navigate на `/agents/:id/talk` (draft mode, без seed). Пользователь не теряет агента, просто не видит greeting. Mock'у это не страшно (нет реальных errors), но логику закладываем для prod.
- **Layout — full-screen или page-padded?** ChatPanel в production использует `.chat-detail` (`100svh - 48px`). Welcome-chat должен быть похож, но MeasuredChat — overkill. Беру: page-padded layout (`.page page--narrow`), bubbles в обычном flow, sticky-bottom action row не нужен (action row в каждом stage свой).
- **Возврат назад из Stage 2 (selected template).** Кнопка «Pick another» — да. Браузерный back — нет (мы внутри одного route'а). Если пользователь нажмёт browser back — выйдет с sandbox в предыдущий route (наверное /). Это OK, не ломаем.
- **Stage transitions — animated?** Беру: simple replace без animation. Бегущие fade-in'ы для onboarding — прокладочный feel. Нейтральнее без них.
- **Tutorial link — в каждом stage или только opening?** Беру: только в opening stage (как secondary CTA). В Stage 2 (template selected) уже фокус на hire decision, отвлекать на tutorial не нужно.
- **`?template=X` в AgentNewScreen — на каком этапе чтения?** На mount: `useEffect(() => { if (templateParam) setTemplate(getTemplate(templateParam)); setPhase('name'); }, [])`. Простой, не ломает существующий flow.
- **`useHireTemplate()` — где живёт?** Беру: `src/prototype/lib/use-hire-template.ts`. Hook + clean signature. QuickHireGrid в Step 1 переходит на использование этого hook'а.
- **Чего НЕ показываем member'у в welcome-chat?** Templates вообще скрываем (member не может нанимать — show-room только разочарует). Только text + tutorial link.

## 5. Proposed approach

### Файлы

**Новые:**
- `src/prototype/lib/use-hire-template.ts` — extracted hire-цепочка как hook.
- `src/prototype/screens/sandbox/WelcomeChatScreen.tsx` — sandbox screen (~250 строк).

**Изменяются:**
- `src/prototype/lib/templates.ts` — добавить `welcomeMessage: string` field в schema; заполнить для 6 non-custom templates.
- `src/prototype/lib/types.ts` — добавить optional `seed_assistant_message?: string` в `CreateChatRequest`.
- `src/prototype/lib/api.ts:679` — `createChat` мок prepend'ит synthetic ChatMessage в `fxChatMessages[id]` если seed передан.
- `src/prototype/components/quick-hire-grid.tsx` — переход на `useHireTemplate()` (поведение не меняется).
- `src/prototype/screens/AgentNewScreen.tsx` — `?template=X` query support.
- `src/prototype/index.tsx` — route `/sandbox/welcome-chat`, query parsing для AgentNewScreen.
- `src/prototype/components/shell.tsx` — sidebar entry под Quick hire.
- `src/prototype/tours/WelcomeToast.tsx` — gate by `agents.length === 0`.
- `docs/backend-gaps.md` — задокументировать seed_assistant_message gap.

### Stage flow

```
┌──────────────────────────────────────────────────────────────┐
│ STAGE 0 — opening                                             │
├──────────────────────────────────────────────────────────────┤
│  ┌─ system bubble ────────────────────────────────────────┐ │
│  │ Welcome to your team.                                   │ │
│  │ Pick a role below to start, or take a quick tutorial.   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─[SA] Sales─┐ ┌─[MA] Marketing─┐ ┌─[RA] Reports─┐         │
│  │ Finds...   │ │ Drafts...      │ │ Pulls...     │  ...    │
│  └────────────┘ └────────────────┘ └──────────────┘         │
│                                                                │
│  ┌─ system bubble (secondary) ───────────────────────────┐  │
│  │ Take the tutorial · /learn →                           │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

User clicks Sales →

┌──────────────────────────────────────────────────────────────┐
│ STAGE 1 — selected                                            │
├──────────────────────────────────────────────────────────────┤
│  [previous bubbles dim or stay; opening visible]               │
│                                                                │
│  ┌─ user-style bubble (right-aligned) ───────────────────┐  │
│  │ Sales Agent                                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ system bubble ───────────────────────────────────────┐  │
│  │ About Sales Agent                                       │  │
│  │                                                          │  │
│  │ Helps you grow your customer base without manual...    │  │
│  │                                                          │  │
│  │ Apps they'll use                                        │  │
│  │ [Apollo] [Zoho CRM] [Email] [Web Search]               │  │
│  │                                                          │  │
│  │ What they'll do                                         │  │
│  │ • Watch CRM for new inbound leads...                   │  │
│  │ • Draft short, personal intro emails...                │  │
│  │ • Follow up after 3 business days...                   │  │
│  │                                                          │  │
│  │ They'll ask before                                      │  │
│  │ • Sending external emails                              │  │
│  │ • Adding contacts to nurture campaigns                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                                │
│         [← Pick another]  [Modify]  [Hire Sales Agent ✓]    │
└──────────────────────────────────────────────────────────────┘

User clicks Hire →

┌──────────────────────────────────────────────────────────────┐
│ STAGE 2 — hiring                                              │
├──────────────────────────────────────────────────────────────┤
│  ┌─ system bubble ───────────────────────────────────────┐  │
│  │ Hiring Sales Agent…                                    │  │
│  │ ⏵ creating profile · setting up access · activating    │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

After ~400ms → navigate('/agents/agt_sales_agent/talk/:chatId')

In real chat (existing /agents/:id/talk/:chatId via embed mode):

┌──────────────────────────────────────────────────────────────┐
│ /agents/agt_sales_agent/talk/cht_xxxx                         │
├──────────────────────────────────────────────────────────────┤
│  ┌─ assistant bubble ────────────────────────────────────┐  │
│  │ [haiku-4-5]  just now                                  │  │
│  │                                                          │  │
│  │ Hi, I'm your Sales Agent. I can review CRM leads,      │  │
│  │ draft intro emails for your approval, and chase quiet  │  │
│  │ prospects. Want to start with this week's inbound?     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                                │
│  [textbox composer — real chat now]                           │
└──────────────────────────────────────────────────────────────┘
```

### `useHireTemplate()` API

```ts
export function useHireTemplate() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hire = async (
    template: AssistantTemplate,
    options: { withSeedChat?: boolean } = {},
  ): Promise<{ agentId: string; chatId?: string }> => {
    setBusy(true); setError(null)
    try {
      const agent = await api.createAgent({
        name: template.defaultName,
        description: template.shortPitch,
        domain_id: user?.domain_id ?? null,
      })
      const v = await api.createAgentVersion(agent.id, { /* ... */ })
      if (template.defaultGrants.length) await api.setGrants(agent.id, { grants: template.defaultGrants })
      await api.activateVersion(agent.id, v.id)

      let chatId: string | undefined
      if (options.withSeedChat && user) {
        try {
          const chat = await api.createChat(
            {
              agent_version_id: v.id,
              seed_assistant_message: template.welcomeMessage,
            },
            user,
          )
          chatId = chat.id
        } catch {
          // Fallback — agent created OK, just no greeting; caller can navigate to draft mode.
        }
      }

      return { agentId: agent.id, chatId }
    } catch (e) {
      setError((e as Error).message ?? 'Could not hire agent')
      setBusy(false)
      throw e
    }
  }

  return { hire, busy, error, clearError: () => setError(null) }
}
```

### `WelcomeChatScreen` structure

```tsx
type Stage =
  | { kind: 'opening' }
  | { kind: 'selected'; template: AssistantTemplate }
  | { kind: 'hiring'; template: AssistantTemplate }

// For member: collapsed flow — only opening stage with member copy.
```

Visual layer mirrors ChatPanel bubble style (`var(--gray-3)` for system, `var(--accent-a3)` for user echo, max-width 78%, `border-radius: 12`). Action row — Flex with three buttons, не bubble.

### `AgentNewScreen` query support

```tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  const templateId = params.get('template')
  if (templateId) {
    const t = getTemplate(templateId)
    if (t) {
      setTemplate(t)
      setName(t.defaultName)
      setInstructions(t.defaultInstructions)
      setPickedGrants(t.defaultGrants.map(g => ({ ...g, scope_type: 'agent', scope_id: 'pending' })))
      setPhase('name')
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

(Точные поля state'а проверим при имплементации — в AgentNewScreen есть `template` / `name` / `instructions` / `pickedGrants` / `model` / `creativity` / `maxTokens`.)

### `WelcomeToast` gate

```tsx
const visible =
  !welcomePromptShown
  && user !== null
  && agentsCount > 0  // NEW: skip when workspace is empty
  && path !== '/login'
  // ...
```

`agentsCount` через `api.listAgents()` на mount. Минимальный fetch.

## 6. Risks and trade-offs

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Пользователь думает что это AI и ищет textbox | high | NO textbox в screen'e вообще. Bubble style + clickable cards. Subtitle в opening явно: «Pick a role — interactive intro, no typing needed.» |
| Воспринимается как cliché AI-chatbot | high | Neutral business voice, без emoji-tone, без robot avatar/badge. Stylistically Linear/Notion. UX-spec § 9-10 actively avoided. |
| Welcome message persistence | medium | Mock extension `seed_assistant_message` в `createChat`. Backend gap явно отмечен. Если backend не реализует — UI останется работать (chat без greeting не падает). |
| `useHireTemplate()` extract ломает QuickHireGrid | medium | Step 1 extract'им и сразу переключаем QuickHireGrid на hook. Verify sandbox `/sandbox/quick-hire` и `/agents` empty branch работают. |
| `?template=X` в AgentNewScreen ломает существующий welcome flow | medium | Query handler в `useEffect`-mount — если param есть, jump на phase='name'; если нет, обычный flow. Не вмешиваемся в state machine. Verify: открыть `/agents/new` без params — phase='welcome'; с `?template=sales` — phase='name', Sales pre-filled. |
| Hire success → chat creation race | low | Try/catch вокруг createChat — agent уже активен, fallback navigate на `/agents/:id/talk` (draft mode). Greeting теряется, остальное работает. |
| WelcomeToast suppress ломает уже виденный toast (повторно покажет) | low | Не ломает: `welcomePromptShown` flag в localStorage остаётся независим от `agentsCount`. Suppress только blocks render, не сбрасывает persisted flag. |
| Stage transitions без анимации feel'ятся резкими | low | Намеренно — это не product reveal, это onboarding. Smoothing через 80ms opacity на нем — overhead не оправдан. Если пользователь захочет animation в feedback — добавим в polish. |
| Member видит sandbox-entry в sidebar но welcome-chat для него обрезана | low | Sidebar entry виден всем (как и team-bridge). Member кликает — видит member-версию. Это design intent (sandbox = preview, не gated). |
| `welcomeMessage` для 6 шаблонов написан плохо/inconsistent | medium | Я напишу в первом draft, в Step 1 покажу пример всех 6. Если voice off — пользователь поправит на Step 1 review до перехода к Step 2. |
| После hire пользователь приземляется в чат, видит greeting — но сам не знает что писать в ответ | medium (UX, не tech) | Welcome message заканчивается **вопросом** («Want to start with this week's inbound?» / «Should I take a look at last week's numbers?»). Это natural prompt to reply. Если пользователь не отвечает — chat пустой, не страшно, он может вернуться. |
| Sandbox sidebar становится 4-м preview entry | low | Уже 3 (team-bridge / approvals-inline / quick-hire). 4 — терпимо под одним divider'ом. Если станет 5+ — group в `Sandbox` collapsible, но пока нет. |
| AgentNewScreen `?template=X` URL не сериализуется через router'наш Link | low | Router принимает любую string как `to`. Проверю в Step 5 — если `Link to="/agents/new?template=sales"` ломается, `<a href="#/app/agents/new?template=sales">` точно работает. |

## 7. Step-by-step implementation plan

**Step 1 — Schema + API + hook + backend-gaps.**

- `lib/templates.ts`:
  - Add `welcomeMessage: string` field to `AssistantTemplate` interface.
  - Fill for 6 non-custom templates (sales / marketing / reports / support / finance / operations). 1-2 sentences, business-tone, ending в вопросе.
  - 'custom' template — пустой `welcomeMessage: ''` (custom не используется в welcome-chat, но schema требует).
- `lib/types.ts`:
  - `CreateChatRequest` — добавить optional `seed_assistant_message?: string`.
- `lib/api.ts`:
  - `createChat` мок: после создания chat, если `req.seed_assistant_message` truthy и не training → push synthetic ChatMessage в `fxChatMessages[id]`. ID `msg_seed_${chat.id}`, role `assistant`, content из seed, model = chat.model, created_at = now, остальные tokens/cost = 0.
- `lib/use-hire-template.ts` (new): hook как описан в § 5.
- `components/quick-hire-grid.tsx`: убрать inlined hire-функцию, использовать `useHireTemplate()`. `onAfterHire` callback остаётся как был.
- `docs/backend-gaps.md`: новая запись §1.X — `seed_assistant_message` mock-only, backend gap для onboarding greeting.

**Verify:** `/sandbox/quick-hire` и `/agents` empty branch работают как раньше (no visual diff). Hire создаёт agent — никаких regression. `npm run lint && npm run build` clean.

**Step 2 — WelcomeChatScreen скелет + opening stage + route + sidebar.**

- `screens/sandbox/WelcomeChatScreen.tsx` (new):
  - `AppShell` crumbs `[home, sandbox, welcome]`.
  - `PageHeader` eyebrow `SANDBOX · WELCOME` + `MockBadge kind="design"`, title `Welcome to your team.`, subtitle `Pick a role below — interactive intro, no typing needed.`.
  - State: `Stage` discriminated union. `[stage, setStage] = useState<Stage>({ kind: 'opening' })`.
  - Member-guard: `if (isMember)` → render member version (system bubble «Your team is empty. Ask an admin to hire someone.» + Tutorial link, no template tiles).
  - Opening stage UI:
    - System bubble: «Welcome to your team. Pick a role below to start, or take a quick tutorial.»
    - Grid из 6 template-карт (reuse `QUICK_HIRE_TEMPLATES`). Click → `setStage({ kind: 'selected', template })`.
    - Secondary system bubble: «Take the tutorial» с link → `/learn`.
- `index.tsx`: import + route `/sandbox/welcome-chat`.
- `shell.tsx`: sidebar entry под Quick hire, label `Welcome chat`, badge `'preview'`, no extra divider.

**Verify:** `#/app/sandbox/welcome-chat` opens. Видно 6 template-tile'ов и tutorial link. Click на template (но реакции пока нет — Step 3). Sidebar показывает 4 sandbox-entry под одним divider'ом. Member видит обрезанную версию.

**Step 3 — Selected stage + Hire/Modify/Pick another wiring.**

- ExpandedBody-like контент в system bubble: longPitch + apps + sample tasks + approvalCopy. Reuse helpers `extractSampleTasks` / `appsFromGrants` (импорт из `quick-hire-grid.tsx` — экспортируем их там, если ещё не).
- User-style echo bubble сверху selected-stage: имя выбранного template'а как «what user clicked» (мимикрия chat-pattern).
- Action row: 3 button'а:
  - `← Pick another` → `setStage({ kind: 'opening' })`.
  - `Modify` (variant="soft") → navigate(`/agents/new?template=${template.id}`).
  - `Hire {template.defaultName}` (variant="solid") → trigger hire (Step 4).
- Pick another и Modify работают сразу, Hire пока stub (`onClick` → console).

**Verify:** Click template → раскрывается selected stage с описанием. «Pick another» возвращает на opening. «Modify» открывает /agents/new (пока welcome phase, не pre-filled — это Step 5).

**Step 4 — Hire chain + auto-create chat + navigate.**

- Hook `useHireTemplate()` подключён в WelcomeChatScreen.
- На Hire click: `setStage({ kind: 'hiring', template })`, then `await hire(template, { withSeedChat: true })`. На success → `navigate('/agents/' + agentId + '/talk/' + chatId)` (или `/agents/${agentId}/talk` если chatId undefined из fallback).
- Hiring stage UI: system bubble «Hiring {name}…» + Spinner + 3-line «creating profile · setting up access · activating» (purely cosmetic).
- Error path: вернуться в selected stage с inline error banner в bubble.

**Verify:** Click Hire → spinner ~1s (накопленные delays из 5 API calls) → редирект на `/agents/agt_sales_agent/talk/cht_xxxx`. В чате видно welcome message от ассистента (из `template.welcomeMessage`). Можно отправить ответ — нормальная chat-цепочка.

**Step 5 — `?template=X` query support в AgentNewScreen + WelcomeToast gate.**

- AgentNewScreen.tsx: `useEffect` на mount парсит `window.location.hash.split('?')[1]`, если `template=X` есть и `getTemplate(X)` возвращает template — set state и `setPhase('name')`.
- `tours/WelcomeToast.tsx`: добавить `useEffect` который читает `api.listAgents()` count'у (через стейт `agentsCount: number | null`). Add condition `agentsCount !== null && agentsCount > 0` к visibility check.

**Verify:** 
1. `/agents/new` (no query) — phase='welcome', выбор шаблона.
2. `/agents/new?template=sales` — сразу phase='name' с Sales pre-filled (имя «Sales Agent» в input).
3. WelcomeToast не показывается при empty workspace; первый login с агентами в fixtures — toast есть.
4. Click `Modify` в welcome-chat → `/agents/new?template=sales` → опен phase='name' с Sales.

**Step 6 — Polish + verify + log.**

- Layout-pass: bubble margins, action-row alignment, member-version copy review.
- Verify full happy-path: empty workspace login → / (EmptyHomeHero существует) → manually navigate `/sandbox/welcome-chat` → opening → click Sales → selected → Hire → /agents/.../talk/... → see greeting → reply → chat works.
- Verify edge cases:
  - Click Modify → /agents/new pre-filled.
  - Pick another from selected back to opening.
  - Tutorial link → /learn.
  - Member version → no template grid.
  - dev-mode `Empty` triggers correctly.
- Final lint + build.

## 8. Verification checklist

- [ ] `lib/templates.ts` — `welcomeMessage` field on all 7 templates (custom = empty string).
- [ ] `lib/types.ts` — `CreateChatRequest.seed_assistant_message?: string`.
- [ ] `lib/api.ts` — createChat mock seeds synthetic assistant ChatMessage when `seed_assistant_message` is provided.
- [ ] `lib/use-hire-template.ts` — exports `useHireTemplate()` hook with `{ hire, busy, error, clearError }`.
- [ ] `components/quick-hire-grid.tsx` — uses `useHireTemplate()` instead of inlined chain. No visual regression.
- [ ] `screens/sandbox/WelcomeChatScreen.tsx` — three stages, no textbox, neutral voice.
- [ ] Sidebar — 4 sandbox entries under one divider (Team Bridge / Approvals preview / Quick hire / Welcome chat).
- [ ] `/sandbox/welcome-chat` opens, opening stage renders 6 templates + tutorial link.
- [ ] Click template → selected stage with description + Pick another / Modify / Hire.
- [ ] Pick another → back to opening.
- [ ] Modify → `/agents/new?template={id}` → AgentNewScreen pre-positioned at phase='name' with template state.
- [ ] Hire → spinner ~1s → navigate `/agents/{id}/talk/{chatId}` → welcome message visible in chat history.
- [ ] User can send a reply in real chat — normal flow.
- [ ] Member sees stripped welcome-chat (no templates).
- [ ] WelcomeToast: hidden when workspace empty, visible after first hire.
- [ ] Production EmptyHomeHero unchanged — visible on `/` empty.
- [ ] Production QuickHireGrid on `/agents` empty unchanged.
- [ ] `docs/backend-gaps.md` — new entry on `seed_assistant_message`.
- [ ] `npm run lint` clean.
- [ ] `npm run build` clean.

## 9. Browser testing instructions for the user

**Setup:** `npm run dev`, login `frontend@int3grate.ai` (admin) / `member@int3grate.ai` (member). Topbar bug-icon → `Empty` для триггера empty-flows.

**Step 1 — schema + hook + sandbox unchanged:**
- `/sandbox/quick-hire` — visually identical, hire chain works.
- `/agents` empty (dev-mode Empty) — visually identical, hire works.

**Step 2 — opening stage:**
- Sidebar → `Welcome chat`.
- Видно: PageHeader + system bubble «Welcome to your team. Pick a role…» + 6 template tiles + secondary bubble «Take the tutorial» (link to `/learn`).
- Click on template — пока ничего (Step 3).
- Member: `member@int3grate.ai` → /sandbox/welcome-chat → видит обрезанную версию (system bubble «Your team is empty…» + tutorial link, no templates).

**Step 3 — selected stage:**
- Click Sales tile → expanded selected stage с описанием.
- User-style echo bubble (right-aligned) с «Sales Agent».
- System bubble: longPitch / apps chips / what they'll do (3 bullets) / approvals (2 bullets).
- 3 кнопки внизу: Pick another / Modify / Hire Sales Agent.
- Pick another → opening stage, выбор сброшен.
- Modify → `/agents/new` (пока без pre-fill — Step 5).

**Step 4 — hire + chat:**
- В selected stage Sales → click Hire Sales Agent.
- Spinner на кнопке + system bubble «Hiring Sales Agent…».
- ~1s → редирект на `/agents/agt_sales_agent/talk/cht_xxxx`.
- В чате assistant bubble с моделью + ago + текст: «Hi, I'm your Sales Agent. I can review CRM leads, draft intro emails for your approval, and chase quiet prospects. Want to start with this week's inbound?»
- Composer работает, можно ответить.

**Step 5 — Modify pre-fill + WelcomeToast:**
- В welcome-chat → Sales → Modify → `/agents/new?template=sales`. URL содержит query. AgentNewScreen открывается на phase='name', input с «Sales Agent», instructions/grants/etc предзаполнены. Можно continue в обычный flow.
- Без query: `/agents/new` — phase='welcome', выбор шаблона.
- WelcomeToast: первый login с pустым workspace + `welcomePromptShown=false` в localStorage → toast НЕ показывается. После hire (workspace непустой) → toast видим (если ещё не показан раньше).

**Step 6 — polish + full happy path:**
1. localStorage clear, login admin, dev-mode Empty.
2. Landing на / → EmptyHomeHero (production существует).
3. Sidebar → Welcome chat (sandbox).
4. Pick Sales → Hire → land in chat with greeting → reply.
5. Sidebar → Home → AdminView (1 active agent).
6. Sidebar → Welcome chat → opening stage всё ещё доступна (если хочется попробовать ещё).

**Edge cases:**
- Tutorial link → `/learn` opens.
- Logout → re-login → flag `welcomePromptShown` остаётся, поведение consistent.
- Click Hire → simulate error (нельзя в моке) — fallback на agent created, no greeting. Manual: проверить что `try/catch` в `useHireTemplate()` стрельнул бы корректно.

## 10. Progress log

- **2026-05-05 14:10** — план создан. Подтверждено: sandbox preview по образцу quick-hire, guided wizard в chat-облике без textbox, neutral business voice (no robot/sparkles/emoji-tone), synthetic greeting через mock-extension `createChat.seed_assistant_message`, `?template=X` поддержка в AgentNewScreen для Modify-кнопки, WelcomeToast suppress при empty workspace. Production EmptyHomeHero / QuickHireGrid не трогаем — sandbox параллельный. 6 step'ов: schema+hook → opening → selected → hire+chat → modify+toast → polish. Жду «делай» для Step 1.
- **2026-05-05 14:35** — **Step 1 done.** Schema + API + hook + backend-gaps. Files touched: `src/prototype/lib/types.ts` (new optional `seed_assistant_message?: string` в `CreateChatRequest` с MOCK-ONLY комментарием), `src/prototype/lib/templates.ts` (`welcomeMessage: string` field в `AssistantTemplate`; заполнено для 6 non-custom templates business-tone'ом, заканчивается вопросом; для `custom` — пустая строка), `src/prototype/lib/api.ts` (`createChat` мок prepend'ит synthetic `ChatMessage` `role='assistant'` с `id=msg_seed_${chatId}` в `fxChatMessages[id]` и `__trainingChatMessages[id]` при наличии seed). Новый файл: `src/prototype/lib/use-hire-template.ts` — hook `useHireTemplate()` возвращает `{ hire(template, options), busy, error, clearError }`. `hire()` делает `createAgent → createVersion → setGrants → activateVersion`, и при `options.withSeedChat=true && template.welcomeMessage` дополнительно `createChat({ seed_assistant_message })` с try/catch fallback (agent остаётся active даже если chat creation падает). Новый файл: `src/prototype/lib/quick-hire.ts` — extracted helpers `QUICK_HIRE_TEMPLATES`, `extractSampleTasks`, `appsFromGrants` (вынесены из `quick-hire-grid.tsx` потому что react-refresh запрещает mixing components+constants exports в одном файле). `components/quick-hire-grid.tsx` переключён на `useHireTemplate()` hook вместо inlined chain — поведение не меняется, error-state теперь приходит из hook'а через `clearError()`. `docs/backend-gaps.md` — новая запись §1.12 «Seed assistant message on chat creation» с тремя backend-вариантами (наивный seed, version-template, LLM-generated) и fallback-логикой. `npm run lint` clean. `npm run build` clean (646 kB bundle, 642ms). Жду подтверждения для Step 2.
- **2026-05-05 14:50** — **Step 2 done.** WelcomeChatScreen skeleton + opening stage + route + sidebar. Files touched: `src/prototype/screens/sandbox/WelcomeChatScreen.tsx` (new, ~150 строк), `src/prototype/index.tsx` (import + route `/sandbox/welcome-chat`), `src/prototype/components/shell.tsx` (sidebar entry под `Quick hire` с label `Welcome chat`, icon `IconChat`, badge `'preview'`). Layout: `.page page--narrow`, `PageHeader` eyebrow `SANDBOX · WELCOME` с `MockBadge kind="design"` (hint объясняет что чат = guided wizard, hire реальный), title `Welcome to your team.`, subtitle `Pick a role below — interactive intro, no typing needed.`. State: `Stage` discriminated union `{ kind: 'opening' \| 'selected' \| 'hiring' }` инициализирован `{ kind: 'opening' }`. Member-guard: `isMember` → `<MemberView />` с system bubble «Your workspace doesn't have any agents yet. Ask an admin to hire your first.» + tutorial line. Admin сейчас рендерит только `OpeningStage` — система bubble с приветствием и инструкцией, grid из 6 template-tiles (`auto-fit minmax(220px, 1fr)`, gap 10), и tutorial-line внизу. `TemplateTile` — Card с `card--hover`, `cursor: pointer`, role=button, tabIndex=0, Enter/Space → onClick. Avatar 28 + name + shortPitch. Click ставит `setStage({ kind: 'selected', template })` — но selected stage пока не рендерится (Step 3). `SystemBubble` и `TutorialLine` — shared компоненты: bubble `var(--gray-3)` или `var(--gray-2)` + dashed border, justify-start, max-width 78%, border-radius 12 — стиль mirrors `ChatPanel.MessageBubble` но БЕЗ avatar/badge (system messages, не assistant turns). Voice neutral business — без exclamation points, без emoji. `npm run lint` clean, `npm run build` clean (638ms). Жду подтверждения для Step 3.
- **2026-05-05 15:05** — **Step 3 done.** Selected stage + Pick another / Modify / Hire-stub. Files touched: только `src/prototype/screens/sandbox/WelcomeChatScreen.tsx`. Добавлен `SelectedStage` компонент. Layout: `<UserBubble>{template.defaultName}</UserBubble>` (right-aligned echo, accent-a3 фон, mimics user message) → `<SystemBubble>` с разделами «About {Name}» (longPitch), «Apps they'll use» (Badge chips через `appsFromGrants`), «What they'll do» (3 буллета через `extractSampleTasks`), «They'll ask before» (`approvalCopy` буллеты) — все секции conditional на наличии данных → action row из 3 кнопок (`Flex justify="end" gap="2" wrap="wrap"`): «Pick another» (soft gray, IconArrowLeft), «Modify» (soft accent), «Hire {Name}» (solid, IconCheck). `UserBubble` — новый shared компонент (mirror of SystemBubble, но right-aligned + `var(--accent-a3)` background). Wiring в parent: `stage.kind === 'selected'` ветка рендерит `SelectedStage` с тремя callbacks: `onPickAnother` → `setStage({ kind: 'opening' })`, `onModify` → `navigate('/agents/new?template=' + template.id)` (URL уже строит query — pre-fill в AgentNewScreen появится в Step 5), `onHire` → пока no-op (stub для Step 4). Imports добавлены: `Badge`, `Button`, `Caption`, `IconArrowLeft`, `IconCheck`, `useRouter`, `appsFromGrants`, `extractSampleTasks`. `npm run lint` clean. `npm run build` clean (637ms). Жду подтверждения для Step 4.
- **2026-05-05 15:25** — **Step 4 done.** Hire chain + auto-create chat + redirect. Files touched: только `src/prototype/screens/sandbox/WelcomeChatScreen.tsx`. `useHireTemplate()` подключён в parent — деструктурируется `{ hire, error: hireError, clearError }`. `startHire(template)` async function: `setStage({ kind: 'hiring', template })` → `await hire(template, { withSeedChat: true })` → если success ВЕРНУЛ chatId → `navigate('/agents/' + agentId + '/talk/' + chatId)` (real chat с seeded greeting), иначе fallback `navigate('/agents/' + agentId + '/talk')` (draft mode без greeting). На error → `setStage({ kind: 'selected', template })` revert; `error` остаётся в hook'е → пробрасывается в `SelectedStage` через новый prop, рендерится как inline `<Banner tone="danger" title="Couldn't hire">{error}</Banner>` над action-row. `pickTemplate` / `pickAnother` callbacks вызывают `clearError()` чтобы старый error не висел при смене selection. Новый `HiringStage` компонент: единый SystemBubble с `<Spinner size="3" />` + «Hiring {name}…» heading + descriptive line «Creating profile · setting up access · activating» (cosmetic, описывает 4 API calls). Imports добавлены: `Spinner` (radix), `Banner` (states), `useHireTemplate`. `npm run lint` clean. `npm run build` clean (637ms). Жду подтверждения для Step 5.
- **2026-05-05 15:50** — **Step 5 done.** AgentNewScreen `?template=X` support + WelcomeToast gate. Files touched: `src/prototype/screens/AgentNewScreen.tsx` (`useEffect` import + `getTemplate` import + new useEffect выше member-guard early return; парсит `window.location.hash` через `URLSearchParams`, на match вызывает inline pre-fill: setTemplate/setName/setInstructions/setModel/setPickedGrants → setPhase('name'); локальный `eslint-disable react-hooks/set-state-in-effect` как в RunsScreen.tsx — паттерн уже принятый в проекте), `src/prototype/tours/WelcomeToast.tsx` (новое локальное state `agentsCount: number \| null`, `useEffect` на mount fetches `api.listAgents()` для подсчёта, `visible` теперь требует `agentsCount !== null && agentsCount > 0` — empty workspaces не получают toast потому что они уже видят EmptyHomeHero/QuickHireGrid/welcome-chat и второй CTA в углу мешает). JSDoc на компоненте обновлён с описанием suppression. `npm run lint` clean. `npm run build` clean (639ms). Жду подтверждения для Step 6.
- **2026-05-05 16:05** — **Step 6 done.** Final pass — code review + final lint/build. Никаких новых code changes в Step 6, только review:
  - Member copy: «Your workspace doesn't have any agents yet. Ask an admin to hire your first.» — clear, neutral, не патронизирующая.
  - Voice review: 0 emoji, 0 «Hey friend!», 0 exclamation points в любом UI-тексте. Voice matches Linear/Notion stylistically. UX-spec § 9-10 anti-patterns avoided.
  - Visual hierarchy: opening (welcome bubble → grid → tutorial) → selected (echo → details bubble → actions) → hiring (single bubble, transient). Каждый stage — single column, top-down narrative.
  - Imports clean, никаких dead exports.
  - `useHireTemplate({ withSeedChat: true })` корректно интегрирован.
  - WelcomeToast suppression при empty подтверждён.
  - AgentNewScreen `?template=` deep-link работает через URLSearchParams parsing.
  - `npm run lint` clean. `npm run build` clean (626ms). **Все 6 step'ов плана закрыты — готово к ручной проверке по сценариям из § 9.** Production EmptyHomeHero / QuickHireGrid / ChatPanel — не тронуты. Sandbox параллельный, promotion (если зайдёт) — отдельный раунд.
