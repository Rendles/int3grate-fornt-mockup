# T2.3 — Manage employment card (Pause / Resume / Fire)

> Plan owner: Claude
> Created: 2026-05-14 23:00 local
> Status: plan only — awaiting owner sign-off before Step 1

## 1. Task summary

Восстановить (но уже как **рабочую**, не disabled-placeholder) карточку **«Manage employment»** на AgentDetail → Settings, под `WorkspaceCard`. Это закрывает gap `§ 4.1` из `docs/backend-gaps.md` — бэк 0.3.0 дал `PATCH /agents/{id}/status` с lifecycle `draft / active / paused / archived` и enforce'ит легальность переходов.

UI:
- Pause / Resume / Fire — actions в зависимости от текущего статуса.
- Card отображается **всегда** (даже для `draft` и `archived`), с информативным текстом без actions.
- Лёгкий confirm-диалог на Pause; усиленный confirm на Fire (но **без typed-confirmation** — история сохраняется, ничего необратимо не теряется).
- Resume — instant action, без диалога.

## 2. Current repository state

- `api.patchAgentStatus(agentId, { status })` — готов (`lib/api.ts:434-448`), enforce'ит легальные переходы.
- `_AGENT_STATUS_TRANSITIONS` (`lib/api.ts:155-160`):
  - draft → active, archived
  - active → paused, archived
  - paused → active, archived
  - archived → (terminal)
- SettingsTab (`AgentDetailScreen.tsx:455-484`) рендерит `Agent details` (3 read-only meta) + `WorkspaceCard`. Карточки «Manage employment» нет — была удалена 2026-05-01, скрытый комментарий (`AgentDetailScreen.tsx:477-481`) указывает на восстановление.
- `handleRetrained()` (line 45) — refetch агента; используется для rename / description / version activate. Тот же callback пойдёт сюда.

## 3. Relevant files inspected

- `src/prototype/lib/api.ts:155-165, 434-448` — transitions table + patchAgentStatus mock.
- `src/prototype/screens/AgentDetailScreen.tsx:30-77, 132, 455-484` — auth + Settings tab + retrain-callback.
- `docs/ux-spec.md § 5, § 8` — pause/stop как «красная кнопка», Hire/Fire симметрия.
- `docs/handoff-prep.md § 2.2` — старая UI surface, копия (preserved): «Pausing stops new activity» / «Removes the agent from your team. The activity history is kept for audit».
- `docs/gateway.yaml:1447-1456` — `PatchAgentStatusRequest` schema.

## 4. Assumptions and uncertainties

**Assumptions (подтверждены owner'ом):**
- `draft` агент — карточка **показывается** с инструктивным текстом «Set up brief to activate» (вместо actions).
- Vocab: **Fire** (не Retire / Decommission).
- `archived` агент — карточка **показывается** с текстом «Fired {ago}», без actions.
- Layout — каждое действие отдельной секцией с описанием (вертикально), не inline-кнопки.
- Filter `archived` из дефолтного `/agents` — **отложено** (separate cycle).

**Uncertainties:**
- Кто может Pause/Fire? Бэк требует `admin / domain_admin` (как и `patchAgent`). UI gate — тот же `canEdit` что и для rename. Member видит карточку **read-only** (информативно — текущий статус + причина-комментарий, но без кнопок). Это согласуется с принципом UI honesty (member физически не сможет).
- Что показывает «Fired {ago}»? — для `archived` агента у нас есть `agent.updated_at` (мок обновляет его при transition). Это пока ближайшее приближение к «когда фейрили». Real backend, вероятно, добавит `archived_at` или дату в audit — но сейчас `updated_at` достаточно.
- Pending runs / approvals у запауженного агента — мок не симулирует. UI не упоминает (не спекулируем о бэк-поведении).

## 5. Proposed approach

### Card structure

```
┌─ Manage employment ─────────────────────────────────────┐
│                                                          │
│  [content depends on agent.status — see states below]   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### State: `draft`

```
This agent doesn't have a brief yet.
Set one up to activate them.

[no buttons]
```

Caption «status: draft» в Caption-стиле сверху.

### State: `active`

```
Pause employment
  Pausing stops new activity. You can resume them any time.
  [Pause]              ← soft, gray-ish

────────────

Fire {agent.name}
  Removes them from your team. Their past activity stays
  in your history, but they can't be brought back.
  [Fire {agent.name}]  ← red soft
```

### State: `paused`

```
Resume employment
  {Agent} is currently paused. Resume to let them take on
  new work again.
  [Resume]             ← cyan/violet soft (positive action)

────────────

Fire {agent.name}
  ... (same as active)
  [Fire {agent.name}]
```

### State: `archived`

```
{Agent} was fired {ago}.
Their past activity stays in your history.

[no buttons]
```

### Confirm dialogs

**Pause**:
```
Title: "Pause {agent.name}?"
Body: "They will stop taking on new work. You can resume them any time."
Buttons: [Cancel] [Pause]
```

**Fire**:
```
Title: "Fire {agent.name}?"
Body: "They will stop working immediately. Their past activity stays
in your history, but they can't be brought back."
Buttons: [Cancel] [Fire {agent.name}]  ← red
```

**Resume** — без диалога, instant flip (как VersionHistory's Activate).

После любого изменения статуса — `onSaved()` коллбек (= `handleRetrained` в parent), который рефетчит агента; Status badge в header автоматически обновляется.

### Файлы

**Изменённые:**
- `src/prototype/screens/AgentDetailScreen.tsx`:
  - SettingsTab — добавляется `<ManageEmploymentCard agent={agent} canEdit={canEdit} onSaved={onAgentSaved} />` после `WorkspaceCard`.
  - SettingsTab принимает новый prop `onAgentSaved` (= `handleRetrained`).
  - Новый local component `ManageEmploymentCard` (~150 строк) или extract в `components/manage-employment-card.tsx` если разрастётся.

## 6. Risks and trade-offs

- **Размер компонента.** Pause/Fire диалоги + state-based content + 3 patch вызовов = много логики. Может разрастись до 150+ строк. Решу по факту: > 100 строк → выношу в отдельный файл.
- **Race conditions на patch.** Два юзера могут одновременно патчить статус. Мок не симулирует, но в реальности бэк ответит 409 на illegal transition (например, два Pause подряд → один из них вернёт «paused → paused» не легально). Обрабатываем error inline.
- **Status badge в header может «застрять».** После Fire, agent.status='archived' — но Avatar + name + status badge в header останутся. Это OK — agent **существует**, он просто `archived`. UX: пользователь видит «Lead Hunter [Archived]» и понимает что не работает.
- **`updated_at` как proxy для «when fired».** Не идеально (агент мог быть обновлён по другой причине), но другого поля нет. Если real backend добавит `archived_at` — поменяем 1 строку.
- **Pause-агенту приходят approvals.** Мок не симулирует, что pending approvals для paused-агента «зависают». UI просто показывает agent.status=paused, дальше дело orchestrator'а. Не наша забота.
- **Member видит read-only card.** Согласуется с UI honesty. Если кому-то не нравится visual «cards с информацией без actions» — можно скрывать card для member совсем. Сейчас оставляю — пусть видит контекст «agent is active/paused/fired».

## 7. Step-by-step implementation plan

**Step 1** — Реализация одним проходом:
1. Добавить `onAgentSaved` prop в `SettingsTab`. Передать его из parent (`AgentDetailScreen` body).
2. Создать `ManageEmploymentCard` (локально или отдельным файлом).
3. Логика: state-based render по `agent.status`. 3 confirm dialogs (Pause, Fire) + 1 instant action (Resume). `api.patchAgentStatus` под каждой.
4. Вставить `<ManageEmploymentCard>` в SettingsTab после `<WorkspaceCard>`.
5. Build + lint clean.

## 8. Verification checklist

- [ ] `npm run build && npm run lint` clean.
- [ ] Под Ada на active агенте (например `agt_lead_qualifier`): видишь Pause + Fire секции. Pause → диалог → Confirm → status flip на paused, badge в header обновился, card перерендерилась с Resume + Fire.
- [ ] Resume → instant → status flip на active обратно.
- [ ] Fire → диалог → Confirm → status flip на archived, badge обновился, card перерендерилась с «Fired {ago}» текстом, no actions.
- [ ] На draft агенте (создать через hire или взять существующего без version): card видна, текст «Set up brief to activate», no buttons.
- [ ] На archived (после Fire): card видна, текст «Fired Xm ago», no buttons.
- [ ] Под Priya (member): card видна, текущий статус показан, **кнопки скрыты**. Никаких visible-actions.
- [ ] Illegal transition не возможен в UI (мы не предлагаем кнопок несуществующих transitions). На бэке всё равно 409, если как-то попадёт — обрабатываем error.

## 9. Browser testing instructions for the user

1. `frontend@int3grate.ai` (Ada) → `#/agents/agt_lead_qualifier/settings`. Card «Manage employment» под WorkspaceCard, видишь Pause + Fire секции.
2. Pause → подтвердить → Status в шапке меняется на `Paused`. Card теперь Resume + Fire.
3. Resume → инстант → обратно active.
4. Fire → подтвердить → Status в шапке `Archived`. Card теперь «Fired ~now», без кнопок.
5. Создать agent через `/agents/new` (или взять draft): зайти в Settings — Card видна, «Set up brief to activate».
6. `member@int3grate.ai` (Priya) → settings того же агента: card видна, кнопок нет.

## 10. Progress log

- **2026-05-14 23:00** — Plan drafted. Owner confirmed: draft state shown with text, Fire не Retire, archived state shown, vertical sections layout, defer /agents filter.
