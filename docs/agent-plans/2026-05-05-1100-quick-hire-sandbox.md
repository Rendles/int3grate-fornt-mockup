# Quick-hire — two-click agent creation sandbox preview

**Status:** draft, awaiting user approval before Step 1.

## 1. Task summary

Sandbox-превью альтернативного flow найма агента: пользователь видит карточки шаблонов, кликает одну → раскрывается preview со всей сводкой про этого агента → клик `Hire {Name}` → агент создан, редирект на `/agents/:id`. Буквально два клика, никакого многошагового wizard.

Делается строго как preview по образцу team-bridge / approvals-inline:
- Новый screen в `src/prototype/screens/sandbox/QuickHireScreen.tsx`.
- Hash-роут `/sandbox/quick-hire`.
- Sidebar-entry с muted `preview` badge (под Approvals preview, без отдельного divider'а).
- Production `/agents/new` (Hire wizard) и его entry-point с `/agents` Welcome — **не трогаем**.

Out-of-scope (явно отказались на обсуждении):
- ❌ Inline-edit имени / brief / apps / approvals в момент hire — всё defaults шаблона, правка только потом на AgentDetail.
- ❌ Кастомный agent ('custom' template) — он бесполезен в 2-click flow (нечего предзаполнять). Оставляем для production wizard.
- ❌ Auto-suffix дубликатов имени — рассчитываем на rename-after-hire.
- ❌ Изменения `lib/templates.ts` — переиспользуем как есть.
- ❌ Изменения hire API-цепочки. Sandbox вызывает те же `createAgent → createVersion → setGrants → activateVersion`, потому что мы реально хотим увидеть нанятого агента в production-списке (это часть демо-эффекта). См. § 4.

В рамках preview:
- ✅ Grid из шаблонов (FEATURED + non-featured минус 'custom').
- ✅ Click на карточке — раскрывает её inline (accordion-style, single-active).
- ✅ В раскрытой карте: name, longPitch, apps (chips из defaultGrants), approval bullets, 3 sample tasks, primary CTA `Hire {Name}`.
- ✅ Hire → spinner inline на CTA → success → navigate(`/agents/:id`).
- ✅ Error inline в раскрытой карте (Banner-стиль).
- ✅ MockBadge `kind="design"` в eyebrow + sandbox info-banner.

## 2. Current repository state

**Production hire flow:**
- `/agents/new` → `AgentNewScreen.tsx` — 4-фазный wizard (welcome / name / apps / review). Phase 'welcome' показывает FEATURED_TEMPLATES grid; клик → phase 'name' (редактируем имя) → 'apps' (mock OAuth toggles + GrantsForm) → 'review' (advanced: instructions/model/creativity/maxTokens) → Hire button.
- API-цепочка hire (`AgentNewScreen.tsx:111-134`):
  1. `api.createAgent({ name, description: template.shortPitch, domain_id })` → returns Agent (status='draft')
  2. `api.createAgentVersion(agent.id, { instruction_spec, model_chain_config, memory_scope_config, tool_scope_config })` → returns AgentVersion (is_active=false)
  3. `api.setGrants(agent.id, { grants: pickedGrants })` (только если grants непустые)
  4. `api.activateVersion(agent.id, v.id)` → переводит agent в status='active'
  5. `api.getAgent(agent.id)` → re-fetch для success-screen
- Mock тут простой: всё в-память, без race conditions.

**Templates** (`lib/templates.ts`):
- 7 шаблонов; 4 featured (sales, marketing, reports, support) + 2 non-featured (finance, operations) + 1 'custom'.
- Каждый: `id`, `defaultName`, `shortPitch`, `longPitch`, `defaultInstructions`, `defaultGrants[]`, `approvalCopy[]`, `featured`, `initials`. Опционально `defaultModel`.
- Helper `getTemplate(id)`, `FEATURED_TEMPLATES`, `NON_FEATURED_TEMPLATES`.

**Sandbox precedent:**
- `src/prototype/screens/sandbox/TeamBridgeScreen.tsx` — design exploration, без mutations.
- `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx` — preview с локальным state (не трогает fixtures).
- Sidebar entries в `components/shell.tsx:75-89` — два sandbox-пункта под одним `dividerAbove: true`.

**MockBadge / Banner:** доступны через `components/common.tsx` и `components/states.tsx`.

## 3. Relevant files inspected

- `src/prototype/screens/AgentNewScreen.tsx` (lines 1-150 для phase machine, lines 108-145 для hire-цепочки) — копируем API-вызовы.
- `src/prototype/lib/templates.ts` — переиспользуем целиком; не правим.
- `src/prototype/lib/api.ts:282-349` — `createAgent`, `createAgentVersion`, `activateVersion`. `:362-380` — `setGrants`.
- `src/prototype/lib/types.ts` — `Agent`, `AgentVersion`, `ReplaceToolGrantsRequest`.
- `src/prototype/screens/sandbox/TeamBridgeScreen.tsx` — pattern reference (header / MockBadge / banner).
- `src/prototype/screens/sandbox/ApprovalsInlineScreen.tsx` — pattern reference (state-handling).
- `src/prototype/components/shell.tsx:75-89` — sidebar entry pattern.
- `src/prototype/index.tsx` — flat routes array, нужно добавить `/sandbox/quick-hire`.
- `src/prototype/components/common.tsx` — `PageHeader`, `Avatar`, `MockBadge`, `Caption`.
- `src/prototype/components/states.tsx` — `Banner` (для error inline).
- `src/prototype/components/icons.tsx` — `IconAgent`, `IconCheck`, `IconArrowRight`, `IconTool`, `IconLock`.
- `src/prototype/lib/format.ts` — `toolLabel`, `appLabel`, `appPrefix` для отрисовки apps-chips.
- `src/prototype/router.tsx` — `useRouter().navigate` для редиректа.
- `src/prototype/auth.tsx` — `useAuth()` для `domain_id` и role-check.

## 4. Assumptions and uncertainties

**Assumptions:**

- **Sandbox реально создаёт агента** (вызывает `api.*`). Это отличие от approvals-inline — там мы НЕ мутировали fixtures, потому что approvals являются shared resource между sandbox и production. Здесь наоборот: hire — это терминальное действие, после которого пользователь УХОДИТ из sandbox на `/agents/:id`. Демо-эффект «вот, я нанял агента, и вот он в команде» теряется если мы используем фейковую mutation. И production `/agents` всё равно показывает всех агентов, добавление одного нового sandbox-агента ничего не ломает.
- **Sample tasks выводим из `defaultInstructions`.** В шаблоне нет отдельного поля `sampleTasks`. Парсим первые 3 буллита (строки начинающиеся с `- `) из `defaultInstructions`. Если у шаблона нет буллетов — fallback на `approvalCopy` (как ближайшее по смыслу).
- **Apps-chips группируем по `appPrefix`.** Например, шаблон `support` имеет `kb.lookup`, `zoho_crm.read_contact`, `email.send`, `slack.post_message` → chips: `Knowledge base`, `Zoho CRM`, `Email`, `Slack` (через `appLabel(prefix)`). Дубликаты сжимаем.
- **Single-active accordion.** Только одна карта раскрыта в любой момент. Клик на другой карте — закрывает текущую и открывает новую.
- **Custom template исключаем.** В `getQuickHireTemplates()`-фильтре отбрасываем `id === 'custom'`. Для custom flow остаётся production wizard.
- **Audience.** Открыто всем ролям (как team-bridge / approvals-inline), несмотря на то что production `/agents/new` режет members (`isMember → NoAccessState`). Это sandbox demo, не нарушаем prod permissions потому что туда члены команды не могут перейти из sidebar — но guard для членов команды стоит **повторить** для design-fidelity (показываем NoAccessState как в production). Подтвердить с пользователем — § Uncertainties ниже.
- **Hire success → navigate `/agents/:agentId`.** Никакого sandbox-специфичного success-screen, чтобы не дублировать логику AgentNewScreen success-фазы. Пользователь приземляется на overview агента — там и так всё видно.

**Uncertainties:**

- **Member-guard.** Production `/agents/new` показывает NoAccessState для members. Делать ли то же самое в sandbox? **Беру: ДА, repeat the guard.** Sandbox — это design preview production-flow, права должны совпадать. Если пользователь хочет проверить flow от лица админа — пусть переключит логин (есть три demo-учётки).
- **Где 'See more roles'?** В production wizard — раскрывающаяся секция с NON_FEATURED_TEMPLATES под основной grid. **Беру: показываем все 6 (4 featured + 2 non-featured) сразу одной grid-сеткой.** На 6 карточек 3-колоночный grid выглядит ровно (2×3); прятать половину в expand — лишний клик, противоречит принципу «всё видно сразу».
- **Layout раскрытой карты vs соседних.** Если карта в grid'е раскрывается — она «вырастает» и ломает rhythm соседних карт. Два варианта:
  - (a) Card grows in-place, остальные карты обтекают по grid-flow (CSS grid auto-rows). Преимущество: сохраняем positional context («раскрыл `Sales`, она тут же расширилась»).
  - (b) Раскрытая карта поднимается в отдельный full-width section НАД grid'ом, grid отображается с placeholder в месте выбранной карты.
  - **Беру (a)** — проще, не ломает scroll-position. Если визуально получится плохо — пересмотрим в Step 3.
- **Sample tasks parsing.** Если `defaultInstructions` не имеет буллетов в нужном виде — fallback на `approvalCopy`. Но `approvalCopy` это «что нужно подтверждать», не «что агент делает». Не идеально семантически. **Беру: fallback допустим, потому что у всех текущих шаблонов есть буллеты в `defaultInstructions`.** Если шаблон без буллетов — секцию «What they'll do» просто скрываем.
- **Permissions field в карте — насколько детально?** Можно: (i) chips по apps (короткое); (ii) bullet-list `approvalCopy` (среднее); (iii) полный grants table (длинное). **Беру (i)+(ii) обе:** apps как chips сверху + approvalCopy bullets снизу. Полный grants table — это для production GrantsForm, в sandbox preview не нужен.
- **Что показать когда `defaultGrants.length === 0`** (для 'custom' — но мы его исключаем, так что N/A). Для всех текущих non-custom шаблонов grants всегда есть.

## 5. Proposed approach

### Файлы

- **Новый:** `src/prototype/screens/sandbox/QuickHireScreen.tsx`
- **Изменяется:**
  - `src/prototype/index.tsx` — импорт + роут `/sandbox/quick-hire`.
  - `src/prototype/components/shell.tsx` — sidebar-entry под `Approvals preview`.

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  HIRE PREVIEW · sandbox  [design badge]                              │
│  Hire an agent in two clicks                                         │
│  Pick a role, review the summary, confirm.                           │
│                                                                       │
│  ┌─ Sandbox banner ────────────────────────────────────────────────┐ │
│  │ This is a working preview. Hires created here are real and will │ │
│  │ appear on /agents.                                               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                              │
│  │ [SA]      │ │ [MA]      │ │ [RA]      │                            │
│  │ Sales     │ │ Marketing │ │ Reports   │                            │
│  │ Finds...  │ │ Drafts... │ │ Pulls...  │                            │
│  └──────────┘ └──────────┘ └──────────┘                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                              │
│  │ [CS]      │ │ [FH]      │ │ [OH]      │                            │
│  │ Support   │ │ Finance   │ │ Operations│                            │
│  │ Answers...│ │ Reconc... │ │ Onboard...│                            │
│  └──────────┘ └──────────┘ └──────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

Click на карте `Sales`:

```
┌──────────────────────────────────────────────────────────────────┐
│ [SA]   Sales Agent                                                │
│        Finds leads, sends intros, follows up.                     │
│                                                                    │
│        Helps you grow your customer base without manual           │
│        outreach. Watches your CRM for new leads, drafts           │
│        personalised intro emails, and nudges follow-ups...        │
│                                                                    │
│        Apps they'll use                                            │
│        [Apollo] [Zoho CRM] [Email] [Web search]                   │
│                                                                    │
│        What they'll do                                             │
│        • Watch the CRM for new inbound leads and qualify them.    │
│        • Draft short, personal intro emails — match the lead's... │
│        • Follow up after 3 business days if they don't reply.     │
│                                                                    │
│        They'll ask before                                          │
│        • Sending external emails                                   │
│        • Adding contacts to nurture campaigns in your CRM         │
│                                                                    │
│        [Cancel]                       [✓ Hire Sales Agent →]      │
└──────────────────────────────────────────────────────────────────┘
[Marketing card]  [Reports card]
[Support card]    [Finance card]    [Operations card]
```

### State

```ts
type QuickHireState = {
  expandedTemplateId: string | null
  hireBusy: boolean
  hireError: string | null
}
```

(Per-template; нет смысла иметь массив state'ов.)

### Поведение

- **Card click** (collapsed): `expandedTemplateId = templateId`. Если уже раскрыт — collapse (`null`).
- **Hire click**: `hireBusy = true`. Цепочка:
  1. `api.createAgent({ name: template.defaultName, description: template.shortPitch, domain_id: user?.domain_id ?? null })`
  2. `api.createAgentVersion(agent.id, { instruction_spec: template.defaultInstructions, model_chain_config: { primary: template.defaultModel ?? 'claude-haiku-4-5' }, memory_scope_config: {}, tool_scope_config: { inherits_from_agent: true } })`
  3. `if (template.defaultGrants.length) api.setGrants(agent.id, { grants: template.defaultGrants })`
  4. `api.activateVersion(agent.id, v.id)`
  5. `navigate('/agents/' + agent.id)`
- **Hire error**: `hireBusy = false`, `hireError = message`. Inline Banner внутри раскрытой карты, кнопка `Hire` снова активна для retry.
- **Cancel** в раскрытой карте: `expandedTemplateId = null`.

### Card components

```tsx
function TemplateCard({ template, expanded, onToggle, onHire, busy, error }) {
  return (
    <Box
      className="quickhire-card"
      data-expanded={expanded}
      onClick={!expanded ? onToggle : undefined}
    >
      <Flex gap="3">
        <Avatar initials={template.initials} />
        <Box>
          <Text size="3" weight="medium">{template.defaultName}</Text>
          <Text size="2" color="gray">{template.shortPitch}</Text>
        </Box>
      </Flex>
      {expanded && <ExpandedBody template={template} onHire={onHire} onCancel={onToggle} busy={busy} error={error} />}
    </Box>
  )
}
```

`ExpandedBody` рендерит longPitch / apps-chips / sample tasks / approvalCopy / actions row.

### Helper'ы

- `extractSampleTasks(instructions: string): string[]` — парсит первые 3 буллета (строка `^- (.+)`); возвращает [] если ни одного.
- `appsFromGrants(grants: TemplateGrant[]): { prefix: string; label: string }[]` — `appPrefix(g.tool_name)` → unique → `appLabel(prefix)`.

### Layout escape

Grid 3 колонки на широких экранах (`{ initial: '1', sm: '2', lg: '3' }`). Раскрытая карта использует `gridColumn: '1 / -1'` чтобы занять всю ширину строки grid'а — соседние карты сдвигаются вниз без пропусков. (Альтернативный подход «card grows in-place» через `grid-auto-rows: min-content` тоже работает, но full-width-row проще читается визуально.)

## 6. Risks and trade-offs

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Пользователь нанимает агента из sandbox и не ожидает что он реально появится на `/agents` | medium | Sandbox banner явно говорит «Hires created here are real and will appear on /agents». Plus — 'preview' badge в sidebar видно постоянно. |
| Дубликаты имени — Maria хирит `Sales Agent` дважды → два агента «Sales Agent» в /agents | low | Принципиальное решение шага 4 § Assumptions: rename-after-hire через AgentDetail. Если станет проблемой в demo — добавим auto-suffix `(2)` в production версии. |
| Member кликает в sidebar → попадает на NoAccessState | low | Repeat production guard. Member видит понятное сообщение, как и в production wizard. |
| Раскрытая карта full-width ломает rhythm grid'а на mobile | low | Grid `{ initial: '1' }` на mobile = 1 колонка, full-width row выглядит так же как обычные карты. На desktop (3 col) — sweep-down ниже соседних карт это ожидаемое behavior accordion'а. |
| Sample tasks parsing fragile (если кто-то добавит шаблон без буллетов) | low | Fallback: секцию «What they'll do» скрываем если `extractSampleTasks` вернул []. Не падаем. |
| Hire-цепочка частично прошла (createAgent ok, createVersion fail) → orphan draft agent | medium (production-like) | Это та же проблема что в production wizard — там она тоже не решена. В mock не возникает (нет реальных server errors). Не добавляем sandbox-специфичный rollback. |
| Sandbox sidebar entry становится третьей preview-кнопкой | low | Уже есть две, добавляем третью под тем же divider'ом. Если станет четыре — сгруппируем в `Sandbox` collapsible. Сейчас не нужно. |
| Click на collapsed card vs клик на 'Cancel' в expanded — race | low | `onClick` на Box работает только когда `!expanded`. В expanded — клики только на `Cancel` / `Hire`. |
| 'custom' template исключён → пользователь думает «а где custom?» | low | Если важно — линк-out в банер: «Need a blank agent? Use the full hire wizard.» с link на `/agents/new`. Добавляем в Step 4 polish. |

## 7. Step-by-step implementation plan

**Step 1 — Каркас экрана + роут + sidebar.**

- Создать `src/prototype/screens/sandbox/QuickHireScreen.tsx` со скелетом:
  - `AppShell` crumbs `[home, team, quick hire]`
  - `PageHeader` eyebrow `'HIRE PREVIEW · SANDBOX'` с MockBadge `kind="design"`, title `Hire an agent in two clicks`, subtitle `Pick a role, review the summary, confirm.`
  - Sandbox info-banner («This is a working preview. Hires created here are real and will appear on /agents.»)
  - Member-guard: `if (user?.role === 'member') return NoAccessState`.
  - Grid карт (collapsed only, без expand-логики). Используем `[...FEATURED_TEMPLATES, ...NON_FEATURED_TEMPLATES].filter(t => t.id !== 'custom')`.
  - Каждая карта — avatar + defaultName + shortPitch. Click пока не делает ничего (или console.log).
- Зарегистрировать роут `/sandbox/quick-hire` в `src/prototype/index.tsx`.
- Добавить sidebar-entry в `components/shell.tsx` — под `Approvals preview`, без `dividerAbove`, label `Quick hire`, icon `IconAgent`, badge `'preview'`.
- `npm run lint` и `npm run build` clean.

**Verify:** `#/app/sandbox/quick-hire` открывается, отображает 6 карт в grid'е (3 на desktop). Sidebar показывает три sandbox-entry под одним divider'ом. Member видит NoAccessState. Production `/agents/new` визуально не изменился.

**Step 2 — Single-active accordion + ExpandedBody.**

- State `expandedTemplateId: string | null`.
- Card click → toggle.
- Раскрытая карта получает `gridColumn: '1 / -1'` (full-width).
- ExpandedBody: longPitch / apps-chips / sample tasks (через `extractSampleTasks(template.defaultInstructions)`) / approvalCopy bullets / actions row (Cancel + `Hire {Name}`-disabled placeholder).
- Helper'ы `extractSampleTasks`, `appsFromGrants` — module-level.
- Hire button пока **не вызывает API** — просто disabled placeholder.

**Verify:** клик на карту раскрывает её на всю ширину строки. Соседние карты сдвигаются вниз. Клик на другую карту закрывает текущую и открывает новую. Cancel работает. Apps-chips показывают `Apollo / Zoho CRM / Email / Web search` для Sales (или эквиваленты для других). Sample tasks — 3 буллета. ApprovalCopy — bullets в нижней секции.

**Step 3 — Hire цепочка + spinner + redirect.**

- State `hireBusy`, `hireError`.
- На Hire click → run цепочка из § 5. Spinner на кнопке во время `hireBusy`. После `activateVersion` → `navigate('/agents/' + agent.id)`.
- Error → Banner внутри ExpandedBody, retry-able.

**Verify:** клик `Hire Sales Agent` показывает spinner ~400ms (накопленные `delay()` в API), затем переход на `/agents/agt_sales_agent` (или `agt_sales_agent_2` если уже существует — id-генерация в `createAgent` использует name). Agent виден в `/agents` listing с status='active'. Permissions tab показывает grants из template.

**Step 4 — Polish.**

- Cancel button — иконка `IconArrowLeft` + label `Back`.
- Hire button — иконка `IconCheck` + spinner replacement.
- 'custom' link-out в банере (опционально): «Need a blank agent? Open the full wizard.» → `/agents/new`.
- Hover-state на collapsed cards (small lift / accent border).
- Final lint + build.

**Verify:** UX чувствует себя завершённо. Все cards имеют hover-state. Banner с link на full wizard работает.

## 8. Verification checklist

- [ ] `#/app/sandbox/quick-hire` opens, renders.
- [ ] Sidebar показывает `Quick hire` с muted preview badge, под `Approvals preview`.
- [ ] Production `/agents/new` визуально не изменился, не открывает sandbox.
- [ ] Member видит NoAccessState (как в production wizard).
- [ ] Admin видит 6 карт (sales, marketing, reports, support, finance, operations) в grid'е 3-колоночном на desktop.
- [ ] Клик на collapsed card раскрывает её inline на всю ширину строки.
- [ ] Раскрытая карта показывает: longPitch, 3-5 apps-chips, 3 sample tasks, 1-3 approval bullets, Cancel + Hire actions.
- [ ] Клик на другую карту закрывает текущую и открывает новую.
- [ ] Cancel в раскрытой карте сворачивает её.
- [ ] Hire click → spinner на кнопке → редирект на `/agents/:id` через ~400ms.
- [ ] Созданный агент виден в `/agents` listing с status='active' и правильным defaultName.
- [ ] Agent's `/agents/:id/grants` показывает все grants из template.
- [ ] Agent's `/agents/:id/versions` показывает active v1 с `instruction_spec === template.defaultInstructions`.
- [ ] Hire дважды один и тот же шаблон создаёт два агента с одинаковым именем (no auto-suffix — by design).
- [ ] Hire error (если получится симулировать) показывает Banner inline, кнопка остаётся retry-able.
- [ ] `npm run lint` clean.
- [ ] `npm run build` clean.

## 9. Browser testing instructions for the user

После каждого step'а:

1. Если dev server не запущен: `npm run dev`, открыть напечатанный URL.
2. Залогиниться (`frontend@int3grate.ai` для admin или `member@int3grate.ai` для member-guard test).
3. Перейти по sidebar `Quick hire` (после Step 1) или вручную `#/app/sandbox/quick-hire`.

**Step 1 — каркас:**
- Открывается экран с заголовком «Hire an agent in two clicks», MockBadge, sandbox banner.
- Видно 6 карт: Sales / Marketing / Reports / Support / Finance / Operations.
- В sidebar появилась `Quick hire` под `Approvals preview`.
- Под `member@int3grate.ai` — NoAccessState.

**Step 2 — accordion:**
- Click на «Sales Agent» card → она расширяется на всю ширину строки.
- В раскрытой видно: longPitch (paragraph), Apps секция с chips, "What they'll do" с 3 буллетами, "They'll ask before" с 1-3 буллетами, Cancel + Hire (disabled) внизу.
- Click на «Marketing» — Sales сворачивается, Marketing раскрывается.
- Click на Cancel — карта сворачивается.

**Step 3 — hire:**
- В раскрытой Sales карте → click `Hire Sales Agent`.
- Spinner на кнопке ~400ms.
- Редирект на `/agents/agt_sales_agent`.
- Открыть `/agents` — там новый «Sales Agent» с status active.
- Открыть его Permissions tab — там 5 grants (apollo / zoho_crm.read_contact / zoho_crm.write_deal / email.send / web_search).

**Step 4 — polish:**
- Hover на collapsed card даёт visual feedback.
- Cancel/Hire — с иконками.
- Banner с link `Need a blank agent? Open the full wizard.` ведёт на `/agents/new`.

**Edge cases:**
- Hire дважды Sales Agent → два агента «Sales Agent» в /agents (имя не уникальное by design).
- Toggle accordion несколько раз — состояние не залипает.
- Tab navigation — фокус идёт по картам, Enter/Space раскрывает (если будем добавлять — потенциально полезно, в плане Step 2 не указано, добавлю если останется время в Step 4).

## 10. Progress log

- **2026-05-05 11:00** — план создан. Подтверждено направление: чистые 2 клика без inline-edit, sandbox preview по образцу team-bridge / approvals-inline, реальные API вызовы (sandbox создаёт настоящих агентов в shared fixtures), expand-в-grid accordion, member-guard повторяет production. Жду «делай» от пользователя для Step 1.
- **2026-05-05 11:20** — **Step 1 done.** Скелет экрана + route + sidebar-entry. Files touched: `src/prototype/screens/sandbox/QuickHireScreen.tsx` (new), `src/prototype/index.tsx` (import + route), `src/prototype/components/shell.tsx` (sidebar item under Approvals preview, no extra divider). Экран: `AppShell` crumbs `[home, sandbox, quick hire]`, `PageHeader` eyebrow `SANDBOX · QUICK HIRE` с `MockBadge kind="design"`, title `Hire an agent in two clicks.`, subtitle `Pick a role, review the summary, confirm. No multi-step wizard.`, info-Banner `This is a working preview` с упоминанием `/agents` и линка на full wizard. Member-guard через `NoAccessState`. Grid карт `{ initial: '1', sm: '2', lg: '3' }` рендерит 6 шаблонов (FEATURED+NON_FEATURED минус `custom`) — каждая `<Card variant="surface">` с `Avatar` + `defaultName` + `shortPitch`. Click пока ничего не делает (Step 2). `npm run lint` clean. `npm run build` clean (337 modules, 720ms — было 334; +3 для QuickHireScreen и зависимостей). Жду подтверждения для Step 2.
- **2026-05-05 11:35** — **Step 2 done.** Single-active accordion + ExpandedBody. State `expandedId: string | null` в `QuickHireScreen`. Click на collapsed Card → `setExpandedId(t.id)`; повторный click на той же — collapse; click на другой — переключение (single-active). Раскрытая карта получает `gridColumn: '1 / -1'` через wrapper `<Box>` (full-width row), соседние сдвигаются вниз. Grid переехал с `Grid columns={...}` на чистый CSS `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))` чтобы full-width row корректно занимал ВСЮ ширину контейнера (Radix Grid с числовыми columns в этом сценарии работает не так гибко). Card border при expand становится accent (`var(--accent-7)`), `cursor: pointer` только на collapsed. Keyboard: `role="button"`, `tabIndex={0}`, `onKeyDown` → Enter/Space на collapsed Card раскрывает её. ExpandedBody: longPitch (paragraph), 3 секции с `Caption`-заголовками — `Apps they'll use` (Badge chips через новый helper `appsFromGrants` группирует grants по `appPrefix` → `appLabel`), `What they'll do` (через новый helper `extractSampleTasks` парсит первые 3 буллета из `defaultInstructions` regex'ом `^\s*-\s+(.+)`), `They'll ask before` (`approvalCopy` буллеты). Каждая секция скрывается если соответствующий массив пуст. Action row внизу: `Back` (soft gray) + `Hire {Name}` (solid, **disabled** — wiring в Step 3). Helpers вынесены на module-level. Files touched: только `src/prototype/screens/sandbox/QuickHireScreen.tsx`. `npm run lint` clean. `npm run build` clean (337 modules, 631ms). Жду подтверждения для Step 3.
- **2026-05-05 11:50** — **Step 3 done.** Hire-цепочка + spinner + redirect. `useRouter().navigate` подключён в `QuickHireScreen`. State `busy: boolean`, `hireError: string | null` на parent-level (один expanded card в любой момент → один busy/error достаточно). `hire(template)` функция: `createAgent({ name: defaultName, description: shortPitch, domain_id }) → createAgentVersion(agent.id, { instruction_spec: defaultInstructions, model_chain_config: { primary: defaultModel ?? 'claude-haiku-4-5' }, approval_rules: {}, memory_scope_config: {}, tool_scope_config: { inherits_from_agent: true } }) → setGrants (только если defaultGrants непустой) → activateVersion → navigate('/agents/' + agent.id)`. Цепочка идентична production `AgentNewScreen.hire()`. Error path: ставим `hireError`, очищаем `busy`, остаёмся в expanded view; пользователь может кликнуть Hire ещё раз. `Toggle` (collapse + переключение карт) блокируется во время `busy` — нельзя случайно сменить карту во время API-цепочки. Action-row кнопок: `Back` disabled во время busy; `Hire` показывает `<Spinner /> Hiring…` во время busy. Inline `<Banner tone="danger" title="Couldn't hire">{error}</Banner>` над action-row если ошибка. Files touched: только `src/prototype/screens/sandbox/QuickHireScreen.tsx`. `npm run lint` clean. `npm run build` clean (337 modules, 627ms). Жду подтверждения для Step 4.
- **2026-05-05 12:05** — **Step 4 done.** Polish-pass. (1) Banner получил inline links: `Hires created here are real and will appear on /agents. Need a blank agent? Use the full hire wizard.` — `/agents` и `full hire wizard` теперь настоящие `<Link>`-элементы (импортирован `Link` из `../../router`); кликабельны, ведут на нужные роуты с правильным префиксом `/app`. (2) Hover-state на collapsed cards через существующий класс `card--hover` (`prototype.css:271-277`) — даёт subtle background `var(--gray-a3)` + border-color `var(--gray-a6)` с 120ms transition. На expanded card hover не применяется (className conditional). Current state экрана: 6 карт в auto-fit grid, click/Enter/Space раскрывает full-width accordion с longPitch / apps / sample tasks / approval bullets / Back+Hire actions. Hire идёт через production API-цепочку, редирект на `/agents/:id`. Member видит NoAccessState. Все 4 step'а закрыты. Files touched: только `src/prototype/screens/sandbox/QuickHireScreen.tsx`. `npm run lint` clean. `npm run build` clean (337 modules, 639ms). **Готово к ручной проверке по сценариям из § 9.**
