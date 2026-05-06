# Instant chat creation (ChatGPT-style lazy create)

**Status:** draft, awaiting user approval before step 1.

## 1. Task summary

Убрать промежуточный экран-форму `ChatNewScreen` из основного потока создания чата с конкретным агентом. Когда у пользователя уже выбран агент (карточка в `/agents`, шапка `AgentDetailScreen`, баннер закрытого чата), клик «Talk to / New chat» приводит **сразу** к готовому-к-вводу composer — чат на бэке создаётся **только** при отправке первого сообщения, как в ChatGPT.

Title чата будет = первые ~60 символов первого user-сообщения (бэк не умеет генерить умные тайтлы, нет `PATCH /chat`).

`ChatNewScreen` остаётся как **agent-picker** для глобального entry-point с HomeScreen (`Start a chat` без выбранного агента) — но упрощается: убираются поля model и title (нарушают vocab-правила и теперь не нужны), остаётся только список агентов; клик по агенту ведёт на тот же draft-роут.

## 2. Current repository state

Текущие точки входа на новый чат и куда они ведут:

| Где | Файл:строка | Куда ведёт |
| --- | --- | --- |
| HomeScreen «Start a chat» | `HomeScreen.tsx:81` | `#/chats/new` (no agent) |
| AgentsScreen карточка «Talk to» | `AgentsScreen.tsx:191` | `/agents/:id/talk` (Talk-to tab) |
| AgentDetailScreen шапка «Talk to {name}» | `AgentDetailScreen.tsx:101` | `/agents/:id/talk` |
| Talk-to tab CTA «New chat» | `AgentDetailScreen.tsx:315` | `#/chats/new?agent=<id>` |
| Closed-chat баннер «Start a new chat» | `chat-panel.tsx:186` | `#/chats/new?agent=<id>` |

Сейчас Talk-to tab при `chatId === undefined` рендерит CTA-карточку «Start a new chat» + список past chats. При наличии `chatId` — `ChatPanel` в embed-режиме.

`ChatPanel` (`chat-panel.tsx`) в текущем виде требует валидный `chatId` — на маунте делает `api.getChat(chatId)`, потом `listChatMessages`. Draft-режима нет.

`ChatNewScreen` содержит agent picker (полный список) + Title input + Model dropdown с `claude-opus-4-7`/`claude-sonnet-4-6`/`claude-haiku-4-5` (последнее — нарушение vocab-правил из `ux-spec.md`).

## 3. Relevant files inspected

- `src/prototype/screens/ChatNewScreen.tsx` — текущая форма создания
- `src/prototype/screens/AgentDetailScreen.tsx` — `TalkToTab` рендер логика, шапка
- `src/prototype/screens/AgentsScreen.tsx` — `Talk to` кнопка на карточке
- `src/prototype/screens/HomeScreen.tsx` — глобальный «Start a chat» (line 81)
- `src/prototype/components/chat-panel.tsx` — рендер чата + closed-banner
- `src/prototype/lib/api.ts:649` — `createChat(req, viewer)` контракт
- `src/prototype/lib/types.ts` — `Chat`, `CreateChatRequest`, `SendMessageRequest`
- `src/prototype/index.tsx` — роутинг, маршруты `/agents/:id/talk*` и `/chats/new`
- `src/prototype/tours/start-a-chat-tour.tsx` — тур который ходит по `data-tour` атрибутам внутри `ChatNewScreen` (будет no-op после изменений; туры в deferred-состоянии — не трогаем)

## 4. Assumptions and uncertainties

**Assumptions:**

- Бэк-контракт `POST /chat → POST /chat/{id}/message` атомарен с т.з. UX: можно вызвать одно за другим без race conditions, потому что агент привязан к версии и tenant — нет других участников.
- Title клиентского происхождения (truncate первого сообщения) приемлем — спека позволяет любую строку в `CreateChatRequest.title?`.
- URL `/agents/:id/talk` (без chatId) — нормальное место для draft state, не ломает существующие deep-links (`/agents/:id/talk/:chatId` остаётся как есть).
- `ChatPanel` можно расширить новым `mode='draft'` без поломки существующих full/embed путей.

**Uncertainties:**

- Тур `start-a-chat-tour` — точно фейлится gracefully (per `CLAUDE.md` tour engine). Не блокирующее.
- Deep-links на `#/chats/new?agent=<id>` от старых букмарков/ссылок: оставляю редирект → `/agents/:id/talk`, чтобы не получать 404. Без агента в query — оставляю на `ChatNewScreen` (он теперь picker).
- Title на пустое сообщение — невозможно (composer не отправит пустую строку, есть `canSend` гард).

## 5. Proposed approach

### URL дизайн

`/agents/:id/talk` (без `chatId`) теперь означает **«готовый-к-чату draft state»**:
- composer сверху, список past chats снизу
- при отправке первого сообщения создаётся чат, URL `replace` на `/agents/:id/talk/:chatId`

Никакого нового сегмента вроде `/talk/draft` не вводим — UX совпадает с тем что Talk-to tab всегда «готов к разговору».

### `ChatPanel` draft mode

Добавляю третий режим: `mode='draft'`. В этом режиме:
- props: `agent: Agent`, `agentVersion: AgentVersion`, **нет** `chatId`
- не делает `api.getChat()` / `listChatMessages()`
- рендерит пустой messages area + composer
- на первый submit:
  1. `createChat({ agent_version_id, title: msg.slice(0, 60).trim() || undefined })` 
  2. `sendChatMessage(chat.id, { content: msg })` — поток событий как обычно
  3. `navigate(`/agents/:id/talk/:chatId`, { replace: true })` после `done` события
- закрыть нечего (closed-баннер не показывается, кнопки close нет)

После первого `createChat` компонент уже работает «почти» как embed — но я **не** делаю переключение mode внутри одного маунта, а полагаюсь на `replace` URL → `key` mount’а в `TalkToTab` поменяется → `ChatPanel` переинициализируется в `embed` с `chatId` и подтянет данные. Чисто, без in-component state machine.

### `TalkToTab` редизайн

```
[ ChatPanel mode='draft' ]    ← composer ready, empty messages
─────────────────────────
Past chats                    ← existing list
- Conversation #abc · ago     ← unchanged
- ...
```

При наличии `chatId` (embedded chat выбран) — текущее поведение остаётся: показывается embed-режим с back-link «← All chats with X».

Старая CTA-карточка «Start a new chat» (`AgentDetailScreen.tsx:303-321`) удаляется — composer теперь и есть та самая «cta».

### `ChatNewScreen` — упрощение

- Убираю Title field (бесполезен теперь, всё равно из первого сообщения)
- Убираю Model dropdown (vocab violation)
- Убираю `MODELS` constant
- Убираю «Open chat» button + `submit()` handler с API вызовом
- Клик по карточке агента в picker’е → `navigate(`/agents/:id/talk`)` (тот самый draft-роут), API не вызывается здесь
- Убираю Banner про «Chats can't be reopened» (релевантнее показывать в самом draft-context’е, если вообще нужен)

Итог: `ChatNewScreen` становится «выбери агента» — лист карточек + ничего больше. Остаётся ради `HomeScreen` global entry.

### Closed-chat баннер

`chat-panel.tsx:182-192` — кнопка «Start a new chat» внутри закрытого чата меняет `href` с `#/chats/new?agent=<id>` на `#/agents/<id>/talk`.

## 6. Risks and trade-offs

| Риск | Тяжесть | Митигация |
| --- | --- | --- |
| Двойной API-вызов на первый submit (createChat + sendChatMessage) — failure между ними оставит «пустой» чат на бэке | средняя | если `createChat` ОК но `sendChatMessage` падает, пустой чат остаётся в `listChats` (с status=active, 0 messages). Не критично — пользователь увидит его в past chats и может удалить (close). В реальном бэке это и так возможно при network drop. Acceptable. |
| Title = truncate первого сообщения — вырезает на полуслове | низкая | `slice(0, 60).trim()`. Длинное обрезается, короткое ОК. Бэк может позже добавить smart-titling — flag в `backend-gaps.md` если важно. |
| Тур `start-a-chat-tour.tsx` полностью сломается (его шаги ходят по полям формы которых больше нет) | низкая | туры в deferred-состоянии (per memory). Engine fallback. Не блокирующее, в плане отмечено. |
| Изменение «Talk to» с `/agents` карточек теперь СПАВНИТ draft каждый раз — кто-то ожидающий «открыть последний чат» получит пустой composer | средняя | по требованию пользователя именно такое поведение. Past chats видны под composer’ом → один клик чтобы открыть существующий. Acceptable. |
| Deep-link `#/chats/new?agent=<id>` из старых ссылок | низкая | в `ChatNewScreen` добавляю useEffect: если `agent` в query — `navigate(replace)` на `/agents/:id/talk`. Чисто, не вижу form. |
| Двойная отрисовка при `replace` URL после первого submit (mount draft → mount embed) | низкая | `ChatPanel` использует `key={chatId}` уже; для draft пока key не нужен. Briefly показывается LoadingList — приемлемо, ChatGPT тоже моргает. Если визуально некрасиво — оптимизация задним числом. |

## 7. Step-by-step implementation plan

**Step 1 — `ChatPanel` draft mode**

В `src/prototype/components/chat-panel.tsx`:
- Добавить опцию `mode: 'full' | 'embed' | 'draft'`
- В draft режиме props также включают `agent: Agent` и `agentVersion: AgentVersion` (вместо `chatId`)
- Гайд: вынести общий messages+composer JSX, а fetch/state логику ветвить по mode
- Реализовать `sendDraft(content)` который делает create→send→navigate(replace)

Verify: lint+build clean. Не подключаем нигде ещё.

**Step 2 — `TalkToTab` рендер draft + past chats**

В `src/prototype/screens/AgentDetailScreen.tsx`:
- Когда `chatId === undefined` и `canTalk === true` → рендер `<ChatPanel mode='draft' agent={agent} agentVersion={agent.active_version!} />` + below — текущий список past chats
- Удалить CTA-карточку «Start a new chat» (lines 303-321)
- При `chatId` defined — поведение без изменений

Verify в браузере: `/agents/<id>/talk` — composer пустой, можно писать. Past chats под ним.

**Step 3 — Первый submit lazy-create**

В draft `ChatPanel`:
- Вызвать `api.createChat({ agent_version_id: agentVersion.id, title: content.slice(0,60).trim() || undefined })`
- Получив `chat.id`, вызвать `api.sendChatMessage(chat.id, { content })` — итерировать stream как сейчас
- После `done` → `navigate(`/agents/${agentId}/talk/${chat.id}`, { replace: true })`
- Error handling: если `createChat` падает → `streamError` баннер + composer не очищается

Verify: написать сообщение в draft → URL меняется → embed mode рендерит уже созданный чат с этим сообщением + ответом.

**Step 4 — Closed-chat баннер**

`chat-panel.tsx:186` — заменить `href` на `#/agents/${agent.id}/talk`. Удалить `?agent=` query.

Verify: закрытый чат → клик «Start a new chat» → composer пустой на том же агенте.

**Step 5 — Упрощение `ChatNewScreen`**

`src/prototype/screens/ChatNewScreen.tsx`:
- Удалить `MODELS` constant, `userModel` state, model dropdown
- Удалить title input, `title` state
- Удалить `submit()` handler с API логикой
- Удалить Banner про «Chats can't be reopened»
- В обработчике клика по карточке агента → `navigate(`/agents/${a.id}/talk`)` сразу
- Если `?agent=<id>` в query при маунте → useEffect делает `navigate(replace)` сразу на `/agents/:id/talk` (закрытие deep-link дыры)
- Subtitle/title формы переписать: «Pick the agent you want to chat with»

Verify: HomeScreen «Start a chat» → видишь только список агентов → клик → попал в draft.

**Step 6 — Убрать «New chat» button из `chat-panel.tsx` Talk-to tab CTA**

Уже сделано в Step 2 (CTA-карточка удалена).

**Step 7 — Lint + build + ручной smoke**

`npm run lint && npm run build` — должно быть чисто.

## 8. Verification checklist

- [ ] `npm run lint` — clean
- [ ] `npm run build` — clean (`tsc -b` + `vite build`)
- [ ] Type-check: `ChatPanel` mode prop работает на всех трёх ветках
- [ ] Tour engine не крашится на `/learn → start-a-chat-tour` старт (показывает friendly fallback)
- [ ] Deep-link `#/chats/new?agent=agt_xxx` редиректит на `/agents/agt_xxx/talk`

## 9. Browser testing instructions

**Сценарий A — instant create через карточку агента:**
1. Открыть `/agents`
2. Кликнуть «Talk to» на любой active агенте
3. Ожидание: попадаешь на `/agents/<id>/talk`, composer пустой, под ним past chats (если были)
4. Написать «Test message» → Send (или Ctrl+Enter)
5. Ожидание: появляется user-сообщение, потом streaming-ответ агента, URL обновляется на `/agents/<id>/talk/cht_xxxx`
6. Перейти на «← All chats with X»
7. Ожидание: новый чат в списке past chats, title = «Test message» (или первые 60 символов)

**Сценарий B — instant create через шапку AgentDetail:**
1. Открыть `/agents/<id>` (Overview tab)
2. Кликнуть «Talk to <name>» в шапке
3. Ожидание: попадаешь на Talk-to tab с пустым composer

**Сценарий C — global entry с HomeScreen:**
1. Открыть `/` (HomeScreen)
2. Кликнуть «Start a chat» в шапке
3. Ожидание: попадаешь на `/chats/new` — список агентов, **нет** model dropdown, **нет** title input, **нет** «Open chat» button
4. Кликнуть на карточку агента
5. Ожидание: попадаешь на `/agents/<id>/talk` (draft state)

**Сценарий D — closed chat → start new:**
1. Открыть существующий чат `/agents/<id>/talk/<chatId>`
2. Кликнуть «Close chat»
3. Появляется баннер «This chat is closed»
4. Кликнуть «Start a new chat»
5. Ожидание: попадаешь на `/agents/<id>/talk` (draft, composer пустой)

**Сценарий E — agent paused / no version:**
1. Найти paused или archived агента в `/agents`
2. Ожидание: «Talk to» disabled, клик ничего не делает

**Сценарий F — deep-link legacy:**
1. Открыть напрямую URL `#/chats/new?agent=agt_<существующий>`
2. Ожидание: мгновенный redirect на `/agents/<id>/talk` (через useEffect)

**Edge case — пустое сообщение в draft:**
1. В draft composer ничего не печатать, нажать Send
2. Ожидание: кнопка disabled, ничего не происходит, чат на бэке не создан

## 10. Progress log

- **2026-05-02 17:30** — план создан. Подтверждены требования: lazy-create с title из первых ~60 символов первого сообщения; Talk-to кнопки с `/agents` ведут сразу в draft; `ChatNewScreen` остаётся для HomeScreen global entry, но упрощается. Жду «делай» от пользователя для Step 1.
- **2026-05-02 17:45** — **Step 1 done.** `ChatPanel` теперь принимает discriminated-union props: `{ mode: 'full'|'embed', chatId }` или `{ mode: 'draft', agent, agentVersion, onCreated }`. В draft режиме `useEffect` для fetch'а пропускается, loading/not-found гварды skip'аются, `send()` идёт по ветке `createChat → setChat → sendChatMessage → onCreated(chat.id)`. Title клиентский — `content.slice(0, 60).trim()`. Никуда ещё не подключено. `npm run lint` и `npm run build` чистые. Files touched: `src/prototype/components/chat-panel.tsx`.
- **2026-05-02 18:00** — **Step 2 done.** `TalkToTab` в `AgentDetailScreen.tsx` теперь рендерит `<ChatPanel mode='draft'>` обёрнутый в `chat-detail chat-detail--embed` когда `chatId === undefined`. Под composer'ом — список past chats (когда есть; пустой fallback `EmptyState` убран — composer сам по себе CTA). Старая «Start a new chat» CTA-карточка удалена. `onCreated` callback делает `navigate(replace)` на `/agents/:id/talk/:chatId`. `useRouter` импортирован. Embed mode для существующих чатов не тронут. Lint+build чистые. Files touched: `src/prototype/screens/AgentDetailScreen.tsx`.
- **2026-05-02 18:05** — **Step 3 covered.** Lazy-create на первом submit реализован уже в Step 1 внутри `ChatPanel.send()` (ветка `props.mode === 'draft'`). Step 2 wire-up завершил подключение. Ничего отдельно делать не нужно.
- **2026-05-02 18:10** — **Step 4 done.** Closed-chat баннер в `chat-panel.tsx` теперь ссылается на `#/agents/${agent.id}/talk` вместо `#/chats/new?agent=${agent.id}`. Один-line edit. Files touched: `src/prototype/components/chat-panel.tsx`.
- **2026-05-02 18:20** — **Step 5 done.** `ChatNewScreen.tsx` радикально упрощён. Удалены: `MODELS` constant, model dropdown, title input, `userModel`/`title`/`submitted`/`busy`/`err` states, API вызов `createChat`, «Open chat» button, info banner про «Chats can't be reopened». Остались: список агентов (фильтр `status !== 'archived'`), при клике на runnable агента — `navigate('/agents/:id/talk')`. Если query содержит `?agent=<id>` (legacy deep-link) — useEffect делает мгновенный `navigate(replace)` на `/agents/:id/talk`, picker не рендерится. Lint+build чистые. Files touched: `src/prototype/screens/ChatNewScreen.tsx`.
- **2026-05-02 18:25** — **Step 6 covered.** Удаление CTA-карточки сделано в Step 2.
- **2026-05-02 18:25** — **Step 7 done.** `npm run lint` clean, `npm run build` clean (`tsc -b && vite build` 333 modules, 658ms). Все ветки plan'а закрыты — готово к ручной проверке в браузере по сценариям из § 9.
- **2026-05-02 18:55** — **Post-review fix: sidebar layout.** Пользователь жалуется что после первого submit в draft весь UI ремонтится и past chats исчезают (back-link «← All chats» не давал ощущение того же места). Переделал `TalkToTab` — всегда два столбца: `280px` сайдбар слева (`Conversations` header + `New` button + список past chats со sticky-позицией) и `ChatPanel` (draft или embed) справа. Сайдбар не пересобирается при смене chatId — только правый столбец ремонтится через `key={chatId}`. Активный чат подсвечен `accent-a3` фоном + 3px accent border-left. Добавил `chatId` в deps useEffect для `setChats` чтобы сразу после создания нового чата он появлялся в сайдбаре. Lint+build чистые. Files touched: `src/prototype/screens/AgentDetailScreen.tsx`.
