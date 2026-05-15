# Tier 3 — Chat-side approvals

> Plan owner: Claude
> Created: 2026-05-15 00:30 local
> Status: plan only — awaiting owner sign-off before Step 1

## 1. Task summary

Полноценная UI-реализация **chat-side approvals** — пользователь решает approval **прямо в чате** через inline-карточку (вместо отдельного похода на `/approvals`). Это закрывает gap `§ 1.17` из `docs/backend-gaps.md` и единственная не-задокументированная UI-фича из gateway 0.3.0 (точнее введена в 0.2.0 / ADR-0011).

**Owner-confirmed UX-решения:**
1. Suspended-card рендерится **как сообщение** в timeline чата.
2. Approve/Reject — **inline в чате** (без перехода на отдельный экран).
3. После Approve/Reject — чат **продолжается автоматически** (агент дописывает результат).
4. Делаем **полный план**, не MVP-минимум.

## 2. Current repository state

**Mock layer (Tier 1 закоммичен `b11e622`):**
- `ApprovalRequest.run_id: string | null` + `ApprovalRequest.chat_id: string | null`. Polymorphic.
- `ChatStatus` включает `'awaiting_approval'`.
- `ChatStreamFrame` включает variant `{ event: 'suspended', approval_id, tool, tool_call_id }`.
- `ApprovalDecisionAccepted.status: 'queued' | 'recorded'`.
- 1 chat-source approval fixture (`apv_9030` — refund $90 reply email, привязан к `cht_3801`).
- `api.decideApproval` возвращает `queued` для chat-source / `recorded` для run-source.

**UI layer — почти ничего:**
- `components/chat-panel.tsx`: ловит `'suspended'` frame, но показывает **generic error banner** (заглушка).
- `screens/ApprovalsScreen.tsx`, `ApprovalDetailScreen.tsx`, `screens/sandbox/TeamBridgeScreen.tsx`: **фильтруют только run-anchored approvals** — chat-source просто не отображаются. Комментарии «Tier 3 will surface these».

## 3. Relevant files inspected

- `src/prototype/lib/types.ts:289+` — Chat / ChatMessage / ChatStreamFrame с suspended variant.
- `src/prototype/components/chat-panel.tsx` — главный компонент, который надо переписать.
- `src/prototype/screens/ApprovalsScreen.tsx`, `ApprovalDetailScreen.tsx`, `components/approval-card.tsx` — filtering и rendering.
- `src/prototype/lib/api.ts:sendChatMessage`, `decideApproval`, `listChatMessages`, `getChat` — mock streamer и flow контроля.
- `src/prototype/lib/fixtures.ts:approvals` — `apv_9030` chat-source.
- `docs/gateway.yaml § ApprovalRequest, Chat, ChatStreamFrame` — спека.
- `docs/backend-gaps.md § 1.17` — описание изменения.

## 4. Assumptions and uncertainties

**Assumptions (owner-confirmed):**
- Suspended-card = новый тип сообщения в `ChatMessageList` (визуально отличается от user/assistant сообщений).
- Approve/Reject inline (а не link на `/approvals/:id` из чата).
- Auto-resume — после decision UI **сам** подтягивает продолжение turn'а через polling `getChatMessages({ after })` (per spec).

**Uncertainties / детали для разруливания по ходу:**
- **Inline reject reason** — должна ли быть textarea на reject (как сейчас в `approval-card.tsx` через `RejectInlineForm`)? Я склоняюсь к **да** — даже в чате reject нужно объяснить агенту. По умолчанию свернуто, на клик Reject раскрывается.
- **Что показывается ПОСЛЕ resolution в suspended-card?** Card остаётся в timeline как историческое сообщение со статусом «Approved» / «Rejected» (зелёная/красная плашка). За ней — продолжение turn'а как обычные assistant-сообщения. То есть card **immutable history**.
- **Что если approval решён ИЗ `/approvals` экрана (не из чата)?** Когда юзер возвращается в чат, chat.status уже `'active'`, новые сообщения уже там. Suspended-card в timeline показывает «Approved (decided elsewhere {ago})».
- **Reject UX:** агент дописывает «I won't proceed with that action.» На моке — статичный текст. На реальном бэке — orchestrator генерит.
- **Когда мок-streamer эмитит `'suspended'`?** Когда tool в стриме имеет approval-rule. Конкретно: первое же tool_call с approval gate → suspended frame, прекращение стрима, переход chat.status → awaiting_approval. Сейчас в моке этого триггера **нет** — стрим всегда успешно завершается. Надо добавить.

## 5. Proposed approach

### 5.1 Архитектура mock-streamer (новая)

Сейчас `api.sendChatMessage` — линейный async-generator:
```ts
turn_start → text_delta × N → tool_call → tool_result → text_delta × N → turn_end → done
```

Надо ввести **conditional suspension**:
```ts
turn_start → text_delta × N → tool_call → SUSPENDED frame ⇒ stream ends
  ↓ chat.status flips to 'awaiting_approval'
  ↓ user approves via decideApproval(approval_id)
  ↓ mock schedules resume — appends to fxChatMessages[chatId]
  ↓ UI polling via getChatMessages(after) picks up resumed turn
```

**Реализация:**
- В моке хранится **side-table** `pendingResumes: Map<chatId, { approvalId, tail: ChatMessage[] }>`. Tail — заранее заготовленные «продолжение turn'а» сообщения (tool_result message + agent's final text message).
- `sendChatMessage` решает: если ассистент использует tool с approval gate → эмитит до tool_call, потом `suspended`, прерывает стрим, кладёт tail в pendingResumes, флипает chat.status.
- `decideApproval` для chat-source approval'а:
  - Approve → достаёт tail из pendingResumes, добавляет в `fxChatMessages`, флипает chat.status обратно на `'active'`. UI поллит и видит новые сообщения.
  - Reject → не trigger'ит tool, добавляет одно agent-message «I won't proceed since you rejected.», флипает status.
- `sendChatMessage` если chat suspended → throws с кодом `'conflict'` (mock-эквивалент 409).

### 5.2 Suspended-card в чате

Новый тип сообщения в `ChatMessageList`. Структура:
- `ChatMessage` сейчас имеет `role: 'user' | 'assistant' | 'system'` (или похоже). Возможно надо добавить `role: 'approval_card'`, или использовать существующий `system` с особым payload.
- Я предлагаю **новый поле `ChatMessage.kind?: 'approval'`** (mock-only поле, не в спеке) — указывает что это suspended-card. Содержит `approval_id`. При рендере chat-panel.tsx подтягивает approval через `api.getApproval(approval_id)` и рендерит специальный компонент.

**Альтернатива:** не добавлять spec-divergent поле. Вместо этого — chat-panel.tsx определяет «есть ли pending chat-source approval для этого чата» через дополнительный `api.getChatApproval(chatId)` запрос. Это **спека-чище**.

Я склоняюсь ко **2-му варианту** (без поля `kind`). Это:
- Не вводит mock-only поле (по аналогии с `requested_by_name` cleanup).
- Suspended-state живёт в Chat.status, как и должно по спеке.
- При render: chat.status === 'awaiting_approval' → подтянуть approval с `chat_id === chatId, status === 'pending'` через filter.

Visual design suspended-card:
```
┌─ Waiting for your approval ─────────────────────────┐
│                                                      │
│  [Avatar] Refund Resolver wants to                  │
│     refund $412 on charge ch_3P8fL2 (order #44021)  │
│                                                      │
│  [Approve]  [Reject ▾]                              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

После Reject клик — разворачивается inline textarea для reason, кнопка `Confirm reject`.

После resolution suspended-card **остаётся** в timeline, статус меняется:
```
┌─ Approved by you · 1m ago ──────────────────────────┐
│  [Avatar] Refund Resolver wants to                  │
│     refund $412 on charge ch_3P8fL2 (order #44021)  │
└──────────────────────────────────────────────────────┘
[Agent text continues here normally]
```

### 5.3 Chat input

Когда `chat.status === 'awaiting_approval'`:
- Textarea read-only.
- Placeholder: «Chat is paused — waiting for your decision above».
- Send button hidden или disabled.

### 5.4 Approvals list / detail integration

**`ApprovalsScreen` (list):**
- Убрать run-source filter (комментированные «Tier 3» места).
- Каждая строка / карточка показывает источник:
  - Run-source: «from run · 5m ago» + link на `/activity/{run_id}`.
  - Chat-source: «from chat with {Agent} · 5m ago» + link на `/agents/{agent_id}/talk/{chat_id}`.
- Optional filter pill «All / From runs / From chats» — добавляем в полный план.

**`approval-card.tsx`:**
- Conditional render: если `approval.chat_id` — показывает chat-source variant строку «from chat with…».
- Resolve agent_id: для chat-source — через `chat.agent_id` (extra fetch или передать через props).

**`ApprovalDetailScreen`:**
- Sections currently показывают run-context (steps, errors, run trail). Для chat-source — другой контент:
  - Заголовок «Triggered from a chat with {Agent}».
  - Section «Conversation excerpt» — последние 3-5 сообщений из chat'а перед suspension.
  - Back-link «Return to chat» → `/agents/{agent_id}/talk/{chat_id}`.
- Approve/Reject actions работают через тот же `api.decideApproval`. После decision — back-link или redirect в чат, чтобы Maria увидела resumed turn.

### 5.5 Fixtures

Расширить пул chat-source approvals для демо-вариативности. Добавить:
- 1 pending chat-source approval с агентом Lead Qualifier (email outreach).
- 1 resolved (approved) chat-source approval — показать post-resolution UI.
- Возможно chat fixture с awaiting_approval статусом.

### 5.6 Файлы

**Изменённые:**
- `src/prototype/components/chat-panel.tsx` — основные изменения: suspended-state rendering, disabled input, decision handling, polling for resume.
- `src/prototype/lib/api.ts` — `sendChatMessage` логика прерывания + 409, `decideApproval` resume логика, новый side-table `pendingResumes`.
- `src/prototype/components/approval-card.tsx` — chat-source variant.
- `src/prototype/screens/ApprovalsScreen.tsx` — снять run-source filter, добавить source distinction в строки.
- `src/prototype/screens/ApprovalDetailScreen.tsx` — chat-source variant в trigger-context, back-link.
- `src/prototype/screens/sandbox/TeamBridgeScreen.tsx` — снять run-source filter в pending feed.
- `src/prototype/lib/fixtures.ts` — добавить 2-3 chat-source approval fixtures + соответствующие chat fixtures.

**Новые (вероятно):**
- `src/prototype/components/chat-approval-card.tsx` — выделить suspended-card в отдельный компонент (если разрастётся > 100 строк). Иначе оставить inline в chat-panel.

## 6. Risks and trade-offs

- **Mock streamer complexity.** Добавление resume mechanism — нетривиальное изменение. Side-table state, polling-friendly tail emission. Можно зашибить mock streamer багами, которые потом долго отлавливать.
- **State sync chat-panel.** Polling после decision — race condition risk. Если poll начинается слишком рано — увидит старое состояние. Если слишком поздно — UI лагает. Mitigation: явный delay (~200ms) после `decideApproval` resolve перед началом polling, либо явная задержка в mock на эмиссию tail.
- **Vocab risk.** Suspended-card в чате — новый surface, легко скатиться в engineering-speak («suspended chat», «gate», «pending approval gate»). Строго следить за «Waiting for your approval», «{Agent} wants to…», «Refund Resolver is paused while you decide».
- **Inline reject reason UX.** Пользователь жмёт Reject в чате — раскрывается textarea. Может быть тесно в layout'е чата. Альтернатива: всегда показывать reason input под кнопками. Сделаем как разрастётся.
- **Approvals list backward compatibility.** Снятие run-source filter — может вылезти chat-source approval row, для которого `approval-card.tsx` не готов рендерить (chat_id != null). Тестировать оба пути на каждом списке-экране.
- **`/approvals/:id` для chat-source.** Если пользователь decide'ит approval **там**, а не в чате, чат всё равно должен resume'нуться. Это значит `api.decideApproval` должен **всегда** триггерить resume для chat-source, независимо от точки вызова. Проверить.
- **Reject в чате — что говорит агент?** Сейчас на моке — статичный текст «I won't proceed with that action since you rejected». На реальном бэке orchestrator генерит контекстно. Mock-текст принимаем как заглушку.
- **Resume через polling vs SSE.** Per spec — клиент polls `getChatMessages({ after: last_id })`. Это **новый pattern** для нашего chat-panel'а (сейчас он только consume'ит initial SSE stream). Добавляем polling-loop на awaiting_approval.

## 7. Step-by-step implementation plan

**Step 1 — Mock streamer mechanics.**
- В `lib/api.ts`: реализовать suspension trigger в `sendChatMessage` (когда agent делает tool_call с approval-gate). Эмитить `'suspended'` frame, прерывать стрим, флипать `chat.status`, класть tail в `pendingResumes`.
- `decideApproval` для chat-source: достать tail, добавить в `fxChatMessages`, флипнуть chat.status, удалить из pendingResumes.
- `sendChatMessage` отказывать с code `'conflict'` если chat suspended.
- Verification: через DevTools console прогнать сценарий — Sеnd → suspended → decideApproval → новые сообщения в `getChatMessages`. Никаких UI-изменений.

**Step 2 — Chat panel suspended UX.**
- В `chat-panel.tsx`: при `chat.status === 'awaiting_approval'` подтягивать `getApprovals({ chat_id: chatId, status: 'pending' })` (или `getApproval` по последнему suspended frame), рендерить suspended-card в timeline.
- Disable textarea + send button.
- Inline Approve / Reject buttons → `api.decideApproval`.
- На Reject — inline reason expand (textarea).
- Verification: открыть `cht_3801` (тот, что в `apv_9030`), увидеть suspended-card, попробовать Approve/Reject.

**Step 3 — Auto-resume + polling.**
- После decideApproval (resolve) — chat-panel запускает poll `getChatMessages({ after: last_id })` каждые ~300ms до получения N новых сообщений.
- Append к UI list, скролл вниз.
- Flip chat.status вернётся в `'active'`, textarea разблокируется.
- Suspended-card в timeline остаётся, статус обновляется до Approved/Rejected.
- Verification: full flow в браузере. Decision → ~500ms → новые agent-сообщения появляются автоматически, input разблокирован.

**Step 4 — Approvals list integration.**
- Снять run-source filter в `ApprovalsScreen`, `ApprovalDetailScreen`, `TeamBridgeScreen`.
- `approval-card.tsx`: conditional render «from chat with {Agent}» для chat-source.
- Compact source-indicator в row.
- Verification: `/approvals` показывает chat-source approval row. Клик ведёт на detail.

**Step 5 — Approval-detail chat-source variant.**
- `ApprovalDetailScreen`: detect chat-source, заменить activity-trail section на conversation-excerpt section (3-5 предыдущих сообщений из чата).
- Back-link «Return to chat» → `/agents/{agent_id}/talk/{chat_id}`.
- Approve/Reject здесь тоже работают — после decision redirect обратно в чат.
- Verification: `/approvals/apv_9030` — открыть, увидеть chat-context.

**Step 6 — Approvals list filter (полный план).**
- SegmentedControl «All / From runs / From chats» в `ApprovalsScreen` header.
- Источник filter сохраняется в URL query или local state (по аналогии со status filter).

**Step 7 — Fixtures.**
- Добавить 1-2 chat-source approval rows + соответствующие chat fixtures с awaiting_approval статусом.
- Один pending (для демо UI), один resolved-approved (для демо post-resolution UI).

**Step 8 — Edge cases.**
- 409 handling в chat-panel при сценарии «пользователь жмёт Send пока suspended». Toast «Chat is paused — please decide above.»
- Decision из `/approvals` экрана → возвращение в чат — chat показывает resumed messages корректно.
- Tour fixture `approval-review-tour` — проверить что не сломан (там был свой scenario с approval).

**Каждый Step + browser verification + commit.** Полный план = 8 циклов работы.

## 8. Verification checklist (по окончании всех 8 шагов)

- [ ] `npm run build && npm run lint` clean после каждого шага.
- [ ] Под Ada открыть `/agents/agt_refund_resolver/talk/cht_3801` (или создать новый сценарий) → видеть suspended-card как сообщение.
- [ ] Approve → агент дописывает результат автоматически.
- [ ] Reject → reason expand → confirm → агент отвечает «won't proceed».
- [ ] Textarea заблокирован пока suspended; разблокирован после decision.
- [ ] `/approvals` показывает chat-source approval в списке вместе с run-source.
- [ ] Approval-card для chat-source: «from chat with Refund Resolver».
- [ ] `/approvals/apv_9030` — chat-source variant, link обратно в чат.
- [ ] Filter «From chats» / «From runs» работает.
- [ ] Decision из `/approvals` → возврат в чат → resumed messages видны.
- [ ] Member роль — какое поведение? Skip approvals → видит чат без suspended-card / status: «Chat is paused (admin will decide)»?
- [ ] Vocab: никаких «suspended», «gate», «queued» в visible-UI.

## 9. Browser testing instructions for the user

После Step 3 (главный milestone):
1. `frontend@int3grate.ai` → `/agents/agt_refund_resolver/talk/cht_3801`. Увидеть в timeline suspended-card.
2. Approve → дождаться 0.5s — увидеть новые сообщения от агента, input разблокирован.
3. Reload страницы — состояние сохраняется (мутации в memory).

После Step 5 (approvals integration):
4. `/approvals` — chat-source row в списке.
5. Открыть `/approvals/apv_9030` — chat-source variant detail screen с conversation excerpt.

После Step 8 (edge cases):
6. Открыть suspended chat, попробовать Send через trick (если получится обойти UI gate) — должен прилететь 409 / friendly toast.
7. Маршрут «approve из /approvals → возвращаюсь в чат» — resumed messages должны быть.

## 10. Progress log

- **2026-05-15 00:30** — Plan drafted. 8 шагов. Owner confirmed: suspended-card как message в timeline, inline Approve/Reject, auto-resume через polling, полный план не MVP. Большая задача — расщеплена на 8 циклов для удобства верификации.
