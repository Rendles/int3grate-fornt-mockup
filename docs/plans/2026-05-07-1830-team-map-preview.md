# Team Map — sandbox preview surface

**Date:** 2026-05-07 18:30
**Author:** brainstorm session, captured by Claude
**Status:** design doc — implementation plan следующим документом
**Type:** design preview, mock-only, removable

---

## 1. Summary

Добавляем `/sandbox/team-map` — preview-surface, визуализирующий **связи между агентами** в форме пространственного графа: карточки агентов как узлы, handoff'ы между ними как рёбра. Это **не org chart** (структура подчинения), а **визуализация активности команды за окно времени** — кто кого о чём просил, кто кому передал задачу, кто кого ждёт.

Размещается в **sandbox**, не в production surfaces, по двум причинам:
- (а) фича может не зайти Maria — proactively изолируем риск,
- (б) backend этого поведения не содержит вообще, mock здесь глубже обычного.

Promotion на основные surfaces (например, toggle `List | Map` на `/agents`) — **отдельное решение после preview**, не часть этой итерации.

---

## 2. Background — почему это вообще обсуждается

Запрос пришёл от инвестора и начальства одновременно с визуальными референсами **Paperclip** и **Pentagon**. Формулировка от заказчика — «work chart», ожидание — карточки + стрелки + что-то перемещается между ними.

Конфликт с проектом: §9 анти-паттернов прямо запрещает «node-based workflow editor / DAG как основной UI», §11 — workflow-редакторы «против духа продукта».

**Разрешение конфликта** (ключевое открытие брейншторма): оба референса **не делают workflow editor**.
- Paperclip — это **org chart** (иерархическое дерево «CEO → CTO → engineer»). Их собственная формулировка: «treats coordination as a management problem, not a graph problem».
- Pentagon — **коммуникационное пространство** для AI-сотрудников: «workspace for your AI employees to communicate, coordinate, and get work done as a team». Скриншоты — карточки агентов + переписка между ними.

Оба усиливают метафору «цифровая команда», а не противоречат ей. Запрет проекта направлен против **process orchestration UI**, а не против **team visualization UI** — это разные вещи, которые легко перепутать на словах.

Заказчик-визуально ближе к **Pentagon** (живая активность, перемещение между карточками), не к **Paperclip** (статичная структура). Это критичный выбор — см. §3.

---

## 3. Concept — что мы рисуем (это сердце документа)

**Team Map = пространственная визуализация активности команды за окно времени.**

Не статичная схема. Не «как устроена компания». А **визуализация лога handoff'ов**, разложенного пространственно вместо ленты.

| | Paperclip-style (отвергнуто) | Pentagon-style (выбрано) |
|---|---|---|
| Что показывает | Иерархия подчинения | Кто кого о чём просил |
| Меняется | Раз в месяц | Постоянно, в реальном времени |
| Узлы | Роли | Агенты |
| Рёбра | Подчинение | События (handoff'ы) |
| Полезно для | «У меня нет никого по финансам» | «Застряло у Tom'а» |
| Тип данных | Структура | Лог |

**Конкретно:**

- **Узлы** — карточки агентов с именем, аватаром, ролью, статусом (active/idle/paused). Те же карточки что на `/agents`, в компактном виде.
- **Рёбра** — handoff'ы между парами агентов за окно времени. Если Sarah и Tom не контактировали за окно — ребра нет. Если контактировали часто — ребро жирное.
- **Состояние ребра** — `pending` (агент ждёт ответа) / `answered` / `timed_out`. Визуально: pending пунктирное, answered сплошное, timed_out красноватое.
- **Hover на ребре** — короткое summary последнего handoff'а: *«Sarah asked Tom: is there an open contract with this client? Tom replied 4 minutes later.»*
- **Окно времени** — фильтр в header'е: `Last 24h | 7d | 30d`. Дефолт — open question (см. §10).
- **Клик на ребре** — переход в `/activity/:runId`, в run где handoff произошёл. Это сильный UX-move: граф становится навигационным элементом в Activity, а не ещё одним островом данных.

**Чего тут НЕТ и не появится:**
- Drag-and-drop редактирования.
- Создания handoff'ов вручную пользователем.
- Конфигурации того, кто кого может просить.
- Live websocket'ов / streaming. Это срез за окно, не realtime feed.

---

## 4. Current state — что есть сейчас

- **Связей между агентами в проекте нет.** В `Agent` нет полей про связи. В `RunDetail.steps` шаги это `llm_call | tool_call | memory_read | memory_write | approval_gate | validation` — agent-to-agent коммуникации нет.
- **`/agents`** — плоский список карточек, никаких связей.
- **`/sandbox/team-bridge`** уже есть в проекте, но это другая фича (по словам автора — «не то что нам надо»). Назвать новую surface надо иначе, чтобы не пересекаться.
- **Backend (`gateway.yaml`):** ничего про inter-agent communication.

---

## 5. Files likely involved (требуют верификации перед impl)

```
src/prototype/lib/types.ts             — добавить Handoff, расширить RunStepKind
src/prototype/lib/fixtures.ts          — seeded handoffs между demo-агентами
src/prototype/lib/api.ts               — listHandoffs(scope) с фильтр-каскадом по workspace
src/prototype/index.tsx                — новый route /sandbox/team-map
src/prototype/screens/                 — новый TeamMapScreen.tsx
src/prototype/components/              — компоненты canvas / node-card / edge / tooltip
src/prototype/components/common/       — возможно новый TimeWindowFilter
sidebar nav (где-то в index.tsx)       — preview-link в sandbox секции
docs/backend-gaps.md                   — новая запись §X (см. §8 этого doc'а)
docs/ux-spec.md                        — возможно vocabulary updates
```

Точные файлы и строки — в impl plan.

---

## 6. Domain model changes

### 6.1 Новый kind в `RunStep`

```ts
type RunStepKind =
  | 'llm_call'
  | 'tool_call'
  | 'memory_read'
  | 'memory_write'
  | 'approval_gate'
  | 'validation'
  | 'agent_call'  // <-- новый
```

`agent_call` — внутренний шаг run'а: «агент A в процессе работы над задачей обратился к агенту B». Этот шаг порождает запись `Handoff`.

### 6.2 Новая сущность `Handoff`

```ts
interface Handoff {
  id: string
  run_id: string                                    // в каком run возник
  from_agent_id: string
  to_agent_id: string
  summary: string                                   // human-readable одна строка
  status: 'pending' | 'answered' | 'timed_out' | 'declined'
  created_at: string
  resolved_at?: string
  workspace_id: string                              // для filter cascade
}
```

**Это derived эфемерная сущность.** Старые handoff'ы (older N days, TBD) автоматически выпадают из вьюхи через фильтр окна. В fixtures хранятся все, в UI отображается окно.

### 6.3 API mock

```ts
api.listHandoffs({ since, workspace_id }): Promise<{ items: Handoff[], total }>
```

Filter cascade по `getCurrentWorkspaceId()` — как у `listAgents/listApprovals/...` (consistent с существующей конвенцией).

### 6.4 Что НЕ меняется

- `Agent` тип не получает новых полей (нет `connected_agents`, `manager_id`, etc — это бы превратило map в structural org chart).
- Существующие endpoint'ы `gateway.yaml` не трогаем.
- Никакого нового концепта «teams within team» / «squads» / «departments».

---

## 7. Surface decision — где это живёт

**Решение: `/sandbox/team-map` — preview surface, изолировано от production.**

- Sidebar entry — в sandbox-секции (под divider'ом, рядом с `team-bridge`), с preview-badge.
- На странице — `<MockBadge kind="design" />` с честным reason: *«Agent-to-agent communication is a design preview — backend behavior not yet defined.»*
- Не toggle на `/agents`.
- Не изменяет существующие screens.
- Удаляется одной операцией: убрать route, убрать sidebar entry, удалить screen файл, убрать seeded handoffs из fixtures, убрать запись в backend-gaps.md.

**Promotion path (на потом, не сейчас):**
1. Если фича принимается → toggle `List | Map` на `/agents`.
2. Если backend начинает эмитить `agent_call` шаги → MockBadge меняется на `kind="deferred"`, потом убирается.
3. Если фича не зайдёт → удаление по списку выше.

Это и есть «возможность скрывать», о которой говорил автор: surface существует, но за divider'ом в sandbox, не на главной нав-линии.

---

## 8. Backend gaps entry

Добавить в `docs/backend-gaps.md` новую запись:

```
§ 1.16  Agent-to-agent communication

Spec: ничего. Поведение в backend не существует.
Импакт UI: /sandbox/team-map работает на seeded fixtures.
Глубина mock'а: deep — это не "endpoint pending", а "behavior pending design".
Wiring path: когда backend начнёт эмитить шаги вида
  RunStep { kind: 'agent_call', from_agent, to_agent, summary, ... }
  — UI агрегирует их в Handoff'ы автоматически. Изменения в lib/api.ts:
  заменить listHandoffs mock на derive-from-runs или новый endpoint.
Vocabulary: handoff (internal) / "ask between agents" (user-facing).
```

---

## 9. Vocabulary decisions

| Где | Что пишем | Что НЕ пишем |
|---|---|---|
| Page title | **Team map** | Graph, Work chart, Network, Workflow |
| Edge label (hover) | "Sarah asked Tom: ..." | request, message, communication |
| Filter | "Last 24h / 7d / 30d" | window, range, time bucket |
| Empty state | "haven't worked together yet" | no data, no edges, empty graph |
| Sidebar item | **Team map** | Agent network, Connections |
| Internal (типы, файлы) | `Handoff`, `agent_call`, `TeamMapScreen` | (не трогаем — § 11.2 ux-spec) |

**Глагол для handoff'а — open question (см. §10).** Рабочий вариант — `ask` как универсальный (Sarah asked Tom...). Альтернативы: `pass to` (звучит как делегирование), `check with` (звучит как уточнение), `handoff` (слишком HR-ный для обычной просьбы).

**Запрещённые слова в этой surface (расширение § 8 ux-spec):** graph, node, edge, network, DAG, workflow, orchestration, message bus, communication channel.

---

## 10. Open questions (требуют решения до impl)

1. **Дефолт временного окна.** 7 дней — описывает «как живёт команда», но может быть пусто. 24h — гарантирует свежесть, но рискует empty state. **Склоняюсь к 7d с возможностью 24h/30d.** Решение: TBD.

2. **Точный глагол.** `ask / pass to / check with / hand off` — какой родной для проекта. Решение: TBD, но не блокирует impl (можно стартовать с `ask` и поменять).

3. **Поведение ребра при долгом ожидании.** Если pending уже 6 часов — это всё ещё pending или превращается в timed_out? Threshold? Визуальный распад (color shift, пунктир жирнее)? Решение: TBD.

4. **Layout при 8+ агентах.** Force-directed (физика пружин)? Circular? Manual placement в fixtures? Force-directed может выглядеть хаотично на малом количестве узлов; static — скучно на большом. **Рекомендация:** static positions из fixtures на старте (демо-данные ограничены), force-directed как enhancement если выходим за пределы demo.

5. **Cluster'ы / группировка.** Если агентов 20+, имеет смысл группировать по functional area (sales / ops / support)? Это добавляет structural overlay на activity-граф — гибрид. Решение: **out of scope для preview**, рассматривается если promotion happens.

6. **Approval ↔ handoff пересечение.** Если Sarah просит Tom сделать external action — кто триггерит approval, Sarah или Tom? Это **глубокий вопрос domain model**, не UI. На preview surface не блокирует — handoff'ы в seeded fixtures внутренние, без external actions. Но при scaling всплывёт.

7. **Cross-workspace handoff'ы.** По существующей логике workspaces — нет, filter cascade применяется. Подтверждаем: handoff `workspace_id` обязательный, фильтр по `getCurrentWorkspaceId()`.

8. **Seeded data dataset.** Сколько handoff'ов нужно для убедительной демо? Слишком мало — пустой граф. Слишком много — каша. **Рекомендация:** 4-6 агентов, 8-12 handoff'ов разных статусов, охватывают 7 дней.

---

## 11. Risks

| Риск | Mitigation |
|---|---|
| Инвестор увидит preview, попросит promote на main surface — теряем простоту `/agents` | Документированная design-stance в этом doc'е (§3): activity ≠ structure. Готовность отстаивать через open questions §10. |
| Backend подключим — handoff'ов реально нет — граф пустой | MockBadge с честной формулировкой («design preview, not deferred wiring»). Фикстуры остаются как demo data до момента когда реальная активность начнёт их перекрывать. |
| Vocabulary дрейф — слово `ask` неоднозначно (user → agent vs agent → agent) | Контекст hover'а делает ясным («Sarah asked Tom»). Если станет проблемой — переключение на `pass to`. |
| Force-directed layout на малых данных = хаос | Static positions в seeded fixtures на старте. Force-directed только если выходим за demo. |
| Дублирование с `/activity` — handoff там тоже виден как run-step | Это фича, не баг. Map = пространственный взгляд на ту же активность. Клик на ребре ведёт в Activity. Это reinforces, не competes. |
| Граф растёт с временем → старые handoff'ы делают каждое окно перенасыщенным | Фильтр окна ограничивает — `7d` отсекает старое. + cap на edge thickness в UI. |

---

## 12. Implementation phases (high-level — детальный plan следующим doc'ом)

Каждая phase — один cycle по §10.5 проекта. Lint+build clean между phase'ами.

1. **Domain types.** Расширить `RunStepKind`. Добавить `Handoff`. TS strict pass.
2. **Fixtures.** Seeded handoffs (8-12 штук, разные статусы, 7-дневное окно). Связаны с существующими demo-runs.
3. **API mock.** `api.listHandoffs(scope)` с filter cascade и `delay()`.
4. **Route + screen skeleton.** `/sandbox/team-map`, `<MockBadge>`, базовый layout, time window filter (UI-only пока).
5. **Canvas component.** Static positions, узлы как карточки, рёбра как линии. Без интерактивности.
6. **Edge interactions.** Hover → tooltip с summary + status. Click → navigate в `/activity/:runId`.
7. **Empty states.** Три ситуации (§13).
8. **Sidebar entry.** Preview-badge в sandbox-секции.
9. **Backend gaps update.** Запись в `docs/backend-gaps.md` (§8 этого doc'а).
10. **Polish + browser smoke test.** Toggle workspace → re-render. Toggle window → перерасчёт. Clean DevMode (empty/loading/error).

Оценка: 8-12 cycles. **Не блокирующих.** Каждая phase коммитится отдельно.

---

## 13. Empty states (три случая)

1. **`< 2` агентов в workspace.** Граф не имеет смысла. Показать промо-плейсхолдер вместо canvas'а: *«Your team will appear here as it grows. When agents start working together, you'll see how they collaborate.»* Без CTA — это анонс, не блокер. Toggle окна скрыт.

2. **`2+` агентов, но handoff'ов в окне нет.** Канвас с карточками агентов **без рёбер**. Внизу subtle hint: *«No collaboration in the last 7 days yet.»* Кнопка «Try last 30 days» рядом — может протух из 7-дневного окна.

3. **Был handoff но протух из окна.** Случай выше + работающее переключение фильтра. Расширил окно — увидел.

---

## 14. Out of scope (явно НЕ в этой итерации)

- Toggle `List | Map` на `/agents` — это promotion, отдельное решение.
- Drag-and-drop редактирование графа.
- Ручное создание handoff'ов из UI (handoff появляется только из run).
- Trust-ladder progression на узлах (отдельная фича из §11 backlog'а).
- Cross-workspace view (фильтр cascade применяется, как везде).
- Realtime updates / websocket'ы.
- Cluster'ы / department grouping.
- Анимация перемещения данных по рёбрам — рассматривается **только если** заказчик настаивает на «движении между карточками» как явном требовании (не из общего описания референсов).
- Configuration кто кого может просить — это automation rules, против духа продукта.

---

## 15. Verification (для impl phase)

- [ ] `npm run lint` clean
- [ ] `npm run build` clean (TS strict: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`)
- [ ] DevMode toggle: `/sandbox/team-map` корректно показывает empty / loading / error states
- [ ] Workspace switch: handoff'ы фильтруются, граф пересобирается
- [ ] Time window filter работает, перерасчёт без перезагрузки
- [ ] Hover на edge показывает summary
- [ ] Click на edge ведёт на `/activity/:runId` (если run существует)
- [ ] MockBadge виден, hover показывает причину
- [ ] Sidebar preview-badge виден в sandbox-секции
- [ ] `docs/backend-gaps.md` содержит запись §1.16
- [ ] Three empty states проверены вручную (через DevMode + изменение fixtures)
- [ ] Vocabulary check: на странице нет запрещённых слов из §9 этого doc'а

---

## 16. Progress log

(пусто — design phase, impl будет в следующем doc'е)
