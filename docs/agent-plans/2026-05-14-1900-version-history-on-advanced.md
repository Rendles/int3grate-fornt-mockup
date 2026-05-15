# Version history на AgentDetail → Advanced

> Plan owner: Claude
> Created: 2026-05-14 19:00 local
> Status: plan only — awaiting owner sign-off before Step 1

## 1. Task summary

Заменить заглушку-баннер «Setup history is single-version for now» на Advanced tab AgentDetail на реальный VersionHistory блок. Бэк 0.3.0 даёт `GET /agents/{id}/versions` (paginated), `GET /versions/{vid}`, `POST /versions/{vid}/activate`. В моке всё уже работает (`api.listAgentVersions`, `activateVersion`).

UI:
- Список всех версий (включая активную, она тоже в timeline).
- Каждая past-строка раскрывает inline brief.
- На не-активных строках кнопка `Activate` (admin/domain_admin only) → диалог подтверждения → flip активной.
- `ActiveVersionCard` (сейчас отдельно сверху) **удаляется** — её данные дублируются с первой строкой timeline. Retrain-кнопка переезжает в заголовок VersionHistory.
- Если у агента всего 1 версия (нет истории) — компактный caption «No earlier versions yet — your first brief is the current one.» вместо списка.

## 2. Current repository state

- `AdvancedTab` в `AgentDetailScreen.tsx:594-626` рендерит `ActiveVersionCard` + `InstructionsCard` + stale Banner.
- `lib/fixtures.ts:agentVersions` — по 1 строке на агента (10 агентов, 10 версий). Истории нет.
- `api.listAgentVersions(agentId, filter)` — paginated, sorted by version desc.
- `api.activateVersion(agentId, vid)` — flip `is_active`, синкает `agent.active_version` и переводит `draft → active`.
- `useUser(created_by)` уже доступен через `lib/user-lookup`.

## 3. Relevant files inspected

- `src/prototype/screens/AgentDetailScreen.tsx:594-686` — AdvancedTab, ActiveVersionCard, InstructionsCard.
- `src/prototype/lib/api.ts:478-520` — activate + list + get versions.
- `src/prototype/lib/fixtures.ts:276-403` — agentVersions array (10 строк).
- `docs/gateway.yaml:1339-1417` — AgentVersion + AgentVersionList schema.

## 4. Assumptions and uncertainties

**Assumptions:**
- Опасные «слепые» поля (`model_chain_config`, `memory_scope_config`, `tool_scope_config`, `approval_rules`) **не рендерим**. Эти 4 объекта со схемой `additionalProperties: true` — бэк не фиксирует форму. Их удаляли с Advanced 2026-05-06 именно по этой причине.
- Activate доступен только admin / domain_admin (как и POST /versions, по спеке требуется тот же gate). Member — read-only timeline.
- Версии **immutable** + удалить нельзя — это сильное обещание Maria («ничего не потеряется при rollback»), используем в копии диалога.
- 4-я колонка `created_by` теперь резолвится через `useUser` — но member её не видит из-за отсутствия доступа к /users. Fallback `—` или скрытие? Возьму fallback `—`.

**Uncertainties:**
- Сколько версий показывать по умолчанию? `listAgentVersions` paginated. У наших агентов будет ≤ 3-5 строк. Просто грузим все (limit=50). При сотнях версий — другая история, но это не наш случай.
- Раскрытие inline vs модал? Inline проще, не отрывает контекст. Иду на inline accordion.
- «Активная тоже в списке» — подтверждено owner'ом. Значит `ActiveVersionCard` можно удалить. Retrain-кнопка переезжает.

## 5. Proposed approach

### Структура UI на Advanced tab

```
InstructionsCard (как сейчас — full brief of active version)
  ↓
VersionHistory card:
  header: "Version history" + count badge + [Retrain] button (admin only)
  body:
    ─ if только 1 версия: caption «No earlier versions yet…»
    ─ else: список вертикальных строк, newest-first:
        [chevron] v14 [Active]  Marcelo Ito · 10d ago
        ─ expanded: <pre> instruction_spec full text </pre>

        [chevron] v13                Marcelo Ito · 21d ago      [Activate]
        ─ expanded: full text

        [chevron] v12                Priya Vasan · 34d ago      [Activate]
        ─ expanded: full text
```

### Диалог Activate

```
Title: "Activate version 12?"
Body: "Your current setup (v14) will move to history. You can come back to it any time — nothing is deleted."
Buttons: [Cancel]  [Activate v12]
```

После activate → list refetch, активная позиция переезжает на v12.

### Изменения по файлам

**Новые:**
1. `src/prototype/components/version-history.tsx` — компонент VersionHistory. ~150 строк. Inside: API load (listAgentVersions), state for expanded rows, activate dialog state. Принимает `agentId`, `agentName` (для копии), `canEdit`, `onRetrain` (callback на Retrain).

**Изменённые:**
2. `src/prototype/screens/AgentDetailScreen.tsx`:
   - `AdvancedTab` — заменить `ActiveVersionCard` + Banner на `<VersionHistory />` ниже `InstructionsCard`.
   - `ActiveVersionCard` — удалить (его данные теперь в timeline).
   - Кнопка Retrain переезжает в заголовок VersionHistory.

3. `src/prototype/lib/fixtures.ts` — seed 6 past-версий для 3 агентов:
   - `agt_lead_qualifier`: + v12, v13 (current v14).
   - `agt_refund_resolver`: + v6, v7 (current v8).
   - `agt_ticket_triage`: + v4, v5 (current v6).
   - Разные `created_by` (Ada/Marcelo/Priya — показать что разные люди иногда правят).
   - `instruction_spec` эволюционирует — короче в старых, длиннее в свежих.
   - `created_at` — последовательно дальше в прошлом.
   - Остальные 7 агентов остаются с 1 версией — UI должен корректно рендерить caption «No earlier versions yet».

## 6. Risks and trade-offs

- **Удаление `ActiveVersionCard` — потеря visual prominence?** Раньше «Current setup» сразу выделялся карточкой. Теперь это первая строка списка с badge `Active`. Я думаю это **плюс**: меньше шума, целостный timeline. Если визуально окажется недостаточно выделено — поставим строке background-tint или жирную рамку.
- **Inline accordion на 5+ версий с длинными brief'ами — высота страницы поплывёт.** Принимаем; список из 5 строк — терпимо. Если станет 20+ — добавим Show more.
- **Member кликает Activate (не должен мочь)** — UI скрывает кнопку для не-admin. Дополнительно мок-API не enforce'ит — это OK (на интеграции бэк отдаст 403, мы покажем ErrorState). Сейчас не строим этот gate.
- **State sync после activate.** `activateVersion` мутирует `fxAgents` (active_version). Нам нужно после успеха либо refetch versions, либо обновить AgentDetail outer state. Простой путь: refetch listAgentVersions внутри VersionHistory + позвать колбэк parent для refresh agent. Пока сделаем только refetch внутри — `agent.active_version` тоже обновится в моке, но AgentDetail может не подхватить без перерендеринга. Если визуально активная версия не двигается — добавим колбэк.
- **InstructionsCard сверху показывает active brief, и в timeline тоже** — дублирование. Можно убрать InstructionsCard, оставить только timeline. Но: первое впечатление от Advanced — «вот brief, который агент использует прямо сейчас». Если убрать — first thing is history. Я склоняюсь оставить InstructionsCard как «here's the active brief» + timeline ниже как «here's how we got here». Если owner возразит — уберём InstructionsCard.

## 7. Step-by-step implementation plan

**Step 1** — Seed фикстур. Добавить 6 новых `AgentVersion` записей в `lib/fixtures.ts`. Подобрать тексты brief'ов так, чтобы было видно эволюцию. Verification: открыть `/agents/agt_lead_qualifier`, в `api.listAgentVersions('agt_lead_qualifier')` (console) — должны прийти 3 строки.

**Step 2** — Реализация VersionHistory компонента + интеграция. Создать `components/version-history.tsx` со списком, expand, диалогом Activate. Замена в AdvancedTab. Удаление `ActiveVersionCard`. Build + lint clean.

## 8. Verification checklist

- [ ] Открыть `/agents/agt_lead_qualifier/advanced` под Ada → видны 3 строки timeline.
- [ ] Раскрытие v13 → виден полный brief (отличный от v14).
- [ ] Activate v13 → диалог с правильной копией → Confirm → v13 теперь Active, v14 теперь в past.
- [ ] Открыть `/agents/agt_compliance_checker/advanced` (1 версия) → видна одна строка с badge Active, под ней caption «No earlier versions yet».
- [ ] Под Priya (member): timeline виден read-only, кнопки Activate отсутствуют.
- [ ] Retrain кнопка в заголовке VersionHistory работает (ведёт на `/agents/:id/versions/new`).
- [ ] `npm run build && npm run lint` clean.

## 9. Browser testing instructions for the user

После Step 1: визуально ничего нового — только в console `api.listAgentVersions('agt_lead_qualifier')` отдаёт 3.

После Step 2:
1. Login frontend@int3grate.ai → `#/agents/agt_lead_qualifier/advanced` — должно быть 3 строки.
2. Раскрыть v13 — увидеть прежний brief.
3. Кликнуть Activate на v13 → диалог → подтвердить → v13 теперь Active. Закрыть и заново открыть Advanced — статус сохраняется (мок мутирует fixture).
4. `#/agents/agt_compliance_checker/advanced` — 1 строка + caption.
5. `#/agents/agt_lead_qualifier/advanced` под Priya — timeline есть, Activate-кнопок нет.

## 10. Progress log

- **2026-05-14 19:00** — Plan drafted. Подтверждено: replace banner на VersionHistory, активная в списке, удалить ActiveVersionCard, Activate на этом же шаге, 3 агента с историей.
