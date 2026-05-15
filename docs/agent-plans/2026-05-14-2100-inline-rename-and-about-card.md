# T2.2 — Inline rename в шапке + About card на Overview

> Plan owner: Claude
> Created: 2026-05-14 21:00 local
> Status: plan only — awaiting owner sign-off before Step 1

## 1. Task summary

Дать admin/domain_admin править `agent.name` и `agent.description` через UI:
- **Inline rename** в шапке AgentDetail (рядом с Avatar, через кастомный `title` ReactNode для PageHeader).
- **About card** первым блоком на Overview, с кнопкой `Edit` (открывает textarea).
- Из SettingsTab → «Agent details» убрать строки `name` и `description` (единая точка правды).

Бэк-эндпоинт `PATCH /agents/{id}` готов в моке (`api.patchAgent`, ограничения: name 1-200, description nullable).

## 2. Current repository state

- `AgentDetailScreen.tsx:99-113` — PageHeader с title = `<Flex><Avatar/> {agent.name}</Flex>`, subtitle = description.
- `OverviewTab` начинается с card «What this agent does» (preview `version.instruction_spec`). Description там не показывается.
- `SettingsTab → Agent details` card рендерит DataList с name / description / status / created / updated.
- `api.patchAgent` готов (мок имитирует true PATCH).

## 3. Relevant files inspected

- `src/prototype/screens/AgentDetailScreen.tsx:95-217, 455-484` — header + OverviewTab + SettingsTab.
- `src/prototype/lib/api.ts:411-428` — patchAgent.
- `docs/gateway.yaml:1425-1445` — PatchAgentRequest схема.

## 4. Assumptions and uncertainties

**Assumptions:**
- Card title — «About» (подтверждено).
- Empty description — «—» для всех ролей (подтверждено).
- Pencil icon на имени — только по hover (подтверждено).
- Description занимает место **перед** «What this agent does» card (брифом).
- При сохранении имя 0 символов → Save disabled (UI), сервер вернёт 422.

**Uncertainties:**
- Custom title в `PageHeader` — компонент уже принимает `ReactNode`, никаких правок самого `PageHeader` не нужно. Проверено: `PageHeader` принимает `title: ReactNode`.
- После rename — нужно обновлять crumbs (там `label: agent.name`). Сейчас агент в стейте; refetch перерисует crumbs автоматически.

## 5. Proposed approach

### Inline rename (EditableAgentName)

Локальный компонент в `AgentDetailScreen.tsx` (или отдельный файл если будет > 80 строк):

```
View mode:
  [Avatar] [Name text] [pencil icon — visible on hover, admin/domain_admin only]

Edit mode:
  [Avatar] [<TextInput>] [Save] [Cancel]
  - Enter saves, Esc cancels, empty disables Save
  - Max 200, min 1 (HTML maxlength + JS validation)
  - Save → api.patchAgent({ name }) → refetch agent → exit
  - On error: keep edit mode, show error inline (single line below input)
```

`title` для PageHeader = `<EditableAgentName agent={agent} canEdit={canEdit} onSaved={refetch} />`. Status badge остаётся в `actions` слоте PageHeader как сейчас.

### AboutCard

Новый компонент / inline section в `OverviewTab`:

```
View mode:
  card head: "About" + [Edit] button (admin/domain_admin only, no hover gate — it's standard button)
  card body: description text or "—"

Edit mode:
  card head: "About"
  card body: <TextAreaField> with current description
  card footer: [Cancel] [Save]
  - Save → api.patchAgent({ description }) → refetch agent → exit
  - Empty input → save as null (clearing description)
```

Вставляется первым блоком в OverviewTab (перед «What this agent does»). При `!version` (агент без setup'а) — карточка About всё равно рендерится, потому что description живёт на агенте, не на версии.

### Удаление из Settings

В `SettingsTab → Agent details` убрать строки `name` и `description`. Остаются: status, created, updated.

## 6. Risks and trade-offs

- **Hover-only pencil не виден тач-устройствам.** Принимаем: прототип desktop-first. На touch — клик по имени тоже триггерит edit (по convention click-to-edit), даже без visible pencil. Альтернатива — всегда видимый pencil. Я за hover, как owner сказал.
- **Edit и Save через Enter в input.** Удобно, но Enter без shift в textarea тоже бы переходил по форме — здесь у нас TextInput одной строкой, без проблем. В textarea для description Enter = newline, Save только через кнопку.
- **PATCH с пустым `description`.** Спека позволяет `string | null`. Мы шлём `null`, если поле пустое. Семантика: «очистить description».
- **Race after rename.** Пока патч in-flight: блокируем Save (busy). На error — остаёмся в edit, показываем сообщение. На success — выход.
- **Кратко в коде один Settings блок остаётся почти пустым.** Owner согласовал: «settings почти бесполезна щас будет», разруливаем позже отдельно.

## 7. Step-by-step implementation plan

**Step 1** — Один цикл. Делаю:
1. `EditableAgentName` локальный компонент.
2. Кастомный title для PageHeader.
3. `AboutCard` локальный компонент.
4. Вставка AboutCard первым блоком в OverviewTab (внутри return main path, и аналогично в `!version` ветке — agent.description актуален и до setup'а).
5. Удаление name+description рядов из Settings → Agent details.
6. Build + lint clean.

Если EditableAgentName или AboutCard окажутся > 80-100 строк — выделю в `components/editable-agent-name.tsx` и/или `components/about-card.tsx`. Решу по факту.

## 8. Verification checklist

- [ ] `npm run build && npm run lint` clean.
- [ ] Под Ada: hover на имени → pencil появляется. Клик → input. Enter → сохранение → refetch. Имя в crumbs обновилось.
- [ ] Пустое имя → Save disabled. Имя 200+ символов → maxLength блокирует ввод.
- [ ] Esc → cancel. Click outside (если делаем) → cancel.
- [ ] Под Priya (member): pencil НЕ появляется на hover. Кнопка Edit на About card НЕ показывается.
- [ ] About card — первый блок Overview. Пустой description → «—».
- [ ] Edit About → textarea. Очистить полностью → Save → description = null → card показывает «—».
- [ ] SettingsTab → Agent details: name/description рядов больше нет, status/created/updated остаются.

## 9. Browser testing instructions for the user

1. `frontend@int3grate.ai` (Ada) → `#/agents/agt_lead_qualifier` (Overview).
2. Hover на имени в шапке → pencil → клик → переименовать → Enter → имя поменялось всюду.
3. About card — первый блок. Edit → textarea → изменить → Save.
4. `member@int3grate.ai` (Priya) на той же странице — нет pencil, нет Edit.
5. `#/agents/agt_lead_qualifier/settings` — карточка `Agent details` короче (3 строки meta), `WorkspaceCard` под ней без изменений.

## 10. Progress log

- **2026-05-14 21:00** — Plan drafted. Скоп: name через inline header + description через About card на Overview. Settings card подсыхает на 3 read-only строки (status/created/updated) + WorkspaceCard.
