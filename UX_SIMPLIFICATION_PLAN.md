# UX_SIMPLIFICATION_PLAN.md

Документ описывает проблемы текущего интерфейса для простых пользователей и идеи по тому, как сделать платформу понятнее без потери текущей глубины для админов и операторов.

## Короткое резюме

Текущий интерфейс выглядит как мощный control plane для технических операторов. Это хорошо для админов, разработчиков и людей, которые понимают AI-инфраструктуру, но может быть слишком сложно для обычных пользователей.

Главная проблема: интерфейс слишком рано показывает внутреннюю механику платформы. Пользователь видит agents, runs, tools, grants, versions, audit, policies, API endpoints и другие технические сущности до того, как понял простую ценность продукта.

Главная идея: не удалять сложность, а разделить ее на уровни.

- Simple mode: обычный рабочий интерфейс для людей, которые хотят пользоваться AI-помощниками.
- Advanced mode: полный control plane для админов, операторов и технических пользователей.

## Для кого интерфейс сейчас сложен

### Простые пользователи

Это люди, которые хотят:

- задать вопрос AI-помощнику;
- продолжить чат;
- попросить AI выполнить задачу;
- подтвердить или отклонить действие;
- понять, что AI сделал и почему он остановился.

Им не обязательно понимать:

- что такое agent version;
- что такое run;
- чем task отличается от chat;
- как работают tool grants;
- что такое orchestrator;
- зачем нужен policy snapshot;
- какие endpoints вызываются под капотом.

### Админы и операторы

Им, наоборот, нужны:

- настройка ассистентов;
- права доступа к инструментам;
- контроль approval rules;
- диагностика runs;
- audit trail;
- spending analytics;
- технические детали поведения системы.

Текущий интерфейс больше подходит именно этой группе.

## Основные проблемы текущего интерфейса

### 1. Слишком много разделов одного уровня

В sidebar сейчас рядом стоят:

- Dashboard
- Agents
- Chats
- Tasks
- Approvals
- Runs
- Tools
- Spend
- Audit

Для обычного пользователя это выглядит как набор внутренних модулей системы. Неочевидно, с чего начать и какие разделы нужны каждый день.

Проблема: навигация отражает архитектуру продукта, а не пользовательские задачи.

### 2. Технические термины появляются слишком рано

В интерфейсе часто встречаются термины:

- agent;
- version;
- instruction_spec;
- model_chain_config;
- max_tokens;
- temperature;
- grants;
- policy snapshot;
- run;
- orchestrator;
- tenant;
- domain;
- x-internal;
- x-mvp-deferred.

Эти термины точные, но они создают ощущение технической панели, где можно легко ошибиться.

### 3. API-детали видны пользователю

Во многих `InfoHint` показываются backend endpoints:

- `GET /agents`
- `POST /chat`
- `GET /approvals`
- `POST /approvals/{id}/decision`
- `GET /internal/agents/{id}/grants/snapshot`

Это полезно для разработки и демо backend-интеграции, но для обычного пользователя такие подсказки не объясняют пользу. Они скорее напоминают, что пользователь находится в техническом инструменте.

### 4. Создание агента ощущается как настройка backend-сущности

Сейчас flow создания выглядит технически корректно:

- создать agent;
- создать version;
- настроить instruction_spec;
- настроить model_chain_config;
- активировать version;
- отдельно настроить grants.

Но для простого пользователя это не выглядит как создание AI-помощника. Это выглядит как создание сложной системной сущности.

### 5. Runs полезны, но плохо объяснены для нетехнических пользователей

Run detail важен для диагностики, но обычный пользователь не думает в терминах "run". Он хочет понять:

- что AI сделал;
- где AI остановился;
- что пошло не так;
- требуется ли действие человека;
- можно ли продолжить работу.

Термин `Run` лучше оставить для advanced-слоя.

### 6. Tools и Grants звучат инженерно

`Tool grants` правильно описывает модель доступа, но для пользователя понятнее:

- Connected apps;
- Permissions;
- What this assistant can access;
- Actions this assistant can take.

Сейчас настройка grants может выглядеть как опасная security matrix.

### 7. Dashboard не всегда отвечает на вопрос "что мне делать сейчас?"

Dashboard показывает важные метрики, но простому пользователю в первую очередь нужны actionable cards:

- продолжить чат;
- ответить на approval;
- посмотреть недавнюю активность;
- начать с подходящего ассистента.

Админский dashboard может оставаться более аналитическим.

### 8. Туры помогают, но не должны быть костылем

Guided tours полезны, но если без тура экран непонятен, значит сам экран слишком сложный. Тур должен усиливать интерфейс, а не спасать его.

## Предлагаемый принцип интерфейса

Продукт должен говорить с пользователем на трех уровнях:

### Уровень 1: простое действие

Что пользователь хочет сделать.

Примеры:

- Start a chat
- Review an approval
- Create an assistant
- Connect an app
- See what happened

### Уровень 2: понятное объяснение

Зачем это нужно и что произойдет.

Пример:

> This assistant can read your knowledge base, but it cannot send messages or change records unless you allow it.

### Уровень 3: технические детали

Для админов и технических пользователей.

Примеры:

- API endpoint;
- raw ids;
- policy snapshot;
- internal schema;
- run steps;
- model parameters.

Важно: уровень 3 должен быть доступен, но не должен быть первым, что видит простой пользователь.

## Предложение: Simple mode и Advanced mode

### Simple mode

Это интерфейс по умолчанию для обычных пользователей.

Навигация может быть такой:

- Home
- Ask AI
- My chats
- Approvals
- Learning Center

Возможные действия:

- начать чат;
- выбрать ассистента;
- посмотреть свои чаты;
- подтвердить или отклонить запрос;
- понять, что сделал AI;
- пройти обучение.

Что скрываем:

- Runs;
- Tools;
- Audit;
- Spend;
- raw grants;
- version internals;
- API hints.

### Admin mode

Это интерфейс для владельцев workspace, domain admins и операторов.

Навигация может быть такой:

- Home
- Assistants
- Approvals
- Activity
- Connected apps
- Costs
- Advanced

В `Advanced` можно перенести:

- Runs;
- Audit;
- raw tool catalog;
- policy snapshots;
- version details;
- API details.

## Предлагаемые переименования

| Сейчас | Предложение | Почему |
|---|---|---|
| Agent | Assistant | Для пользователя это помощник, а не технический агент. |
| Agents | Assistants | Понятнее как основной продуктовый объект. |
| Tool | Connected app / Capability | Пользователь думает про приложения и возможности. |
| Tool grants | Permissions / Access permissions | Понятнее как права доступа. |
| Run | Activity / Work log / Execution | Описывает, что AI что-то делал. |
| Task | Request / Job | Менее технически перегружено. |
| Version | Setup / Published setup / Draft | Пользователь понимает настройки и публикацию. |
| instruction_spec | Instructions | Человеческое название поля. |
| model_chain_config | Model settings | Не раскрывает внутреннюю структуру. |
| max_tokens | Response length limit | Понятнее для нетехнических людей. |
| temperature | Creativity | Более пользовательский смысл. |
| approval_required | Needs human approval | Прямо объясняет смысл. |
| Orchestrator | Platform / System | Не нужно раскрывать внутренний компонент. |
| Domain | Team / Department | Если бизнес-смысл именно команда или отдел. |
| Tenant | Workspace | Более привычный SaaS-термин. |

## Предложение по навигации

### Для обычного пользователя

Основная навигация:

- Home
- Ask AI
- My chats
- Approvals
- Learn

Home должен отвечать на вопрос:

> What needs my attention?

Карточки:

- Continue recent chat
- Start with an assistant
- Approvals waiting for me
- Recent AI activity
- Suggested tour

### Для админа

Основная навигация:

- Home
- Assistants
- Approvals
- Activity
- Connected apps
- Costs
- Learn
- Advanced

В `Advanced`:

- Runs
- Audit
- Raw tools
- Policy snapshots
- Internal diagnostics

## Предложение по Dashboard

### Простой Dashboard

Фокус: действия, а не метрики.

Секции:

- "Start here": кнопка Start a chat.
- "Your recent chats": последние чаты.
- "Needs your approval": запросы, где пользователь должен принять решение.
- "What happened recently": простая лента действий AI.
- "Learn the basics": короткий блок про Learning Center.

### Admin Dashboard

Фокус: контроль и риски.

Секции:

- Pending approvals.
- Assistants with issues.
- Failed or suspended activity.
- Spend changes.
- Recently changed permissions.
- Setup checklist.

## Предложение по созданию ассистента

Вместо технического flow "Agent + Version + Grants" можно сделать wizard.

### Шаг 1: Choose what this assistant does

Пользователь выбирает шаблон:

- Customer support
- Sales assistant
- Finance helper
- Internal knowledge helper
- Refund assistant
- Blank assistant

### Шаг 2: Give it instructions

Поля:

- Name
- What should it help with?
- What should it never do?
- Tone of voice

Техническое поле `instruction_spec` не показываем как label.

### Шаг 3: Connect apps

Показываем карточки приложений:

- Knowledge base
- Slack
- Email
- Stripe
- CRM
- Okta

Для каждого:

- Can read
- Can write
- Needs approval

### Шаг 4: Safety rules

Простые правила:

- Ask approval before sending messages.
- Ask approval before refunds.
- Ask approval before changing user access.
- Never use dangerous tools.

### Шаг 5: Test assistant

Мини-чат прямо в wizard.

Цель: дать пользователю увидеть результат до публикации.

### Шаг 6: Publish

Кнопка:

- Publish assistant

Advanced details:

- version id;
- model settings;
- raw instructions;
- tool grants payload.

## Предложение по экрану Assistants

Текущий `Agents` можно превратить в более понятный `Assistants`.

Что показать в списке:

- имя ассистента;
- для чего он нужен;
- статус: Draft, Active, Paused;
- какие приложения подключены;
- требуется ли human approval;
- кнопка Start chat;
- кнопка Manage.

Что спрятать глубже:

- raw id;
- active_version_id;
- internal config;
- policy snapshot.

## Предложение по экрану Assistant detail

Сделать вкладки более пользовательскими:

- Overview
- Instructions
- Access
- Safety
- Activity
- Advanced

В `Overview`:

- что делает ассистент;
- статус;
- last activity;
- start chat;
- connected apps summary.

В `Instructions`:

- простой текст инструкций;
- editable draft;
- publish changes.

В `Access`:

- приложения и права доступа.

В `Safety`:

- когда нужен human approval;
- опасные действия;
- кто может approve.

В `Advanced`:

- version;
- raw config;
- policy snapshot;
- API hints.

## Предложение по экрану Approvals

Approvals уже ближе к пользовательской задаче, но можно упростить язык.

Текущий смысл:

> Approval requests created by the orchestrator when a policy or tool grant requires a human decision.

Более простой смысл:

> AI is asking for permission before it takes an important action.

Карточка approval должна отвечать:

- What does AI want to do?
- Why does it need approval?
- What information should I check?
- What happens if I approve?
- What happens if I reject?

Кнопки:

- Approve action
- Reject action

Не просто:

- Approve
- Reject

Так меньше страха, потому что действие становится конкретнее.

## Предложение по экрану Runs / Activity

Для обычных пользователей заменить `Runs` на `Activity`.

Показывать:

- AI started working.
- AI read knowledge base.
- AI tried to use Stripe.
- AI paused for approval.
- Human approved.
- AI finished.

Для админов можно оставить advanced timeline:

- LLM call;
- tool_call;
- approval_gate;
- memory read;
- validation;
- tokens;
- cost;
- duration.

## Предложение по экрану Tools / Connected apps

Для обычного admin-view:

- Connected apps
- What assistants can access
- Read access
- Write access
- Requires approval

Raw `Tool catalog` оставить в Advanced.

Пример простого текста:

> Connected apps are services your assistants can use. Reading is usually safe. Writing can change data, so it can require human approval.

## Предложение по подсказкам

### Сейчас

InfoHint часто объясняет API.

### Предложение

InfoHint должен сначала объяснять человеческий смысл.

Пример для chat:

Вместо:

> Creates a chat via POST /chat. Bound to one agent_version_id + model for its lifetime.

Лучше:

> This chat will use the selected assistant setup. The model stays fixed so the conversation is consistent.

API details можно вынести в:

- Advanced details;
- Developer info;
- Debug mode;
- tooltip only for admins.

## Предложение по Learning Center

Learning Center оставить, но изменить роль:

- не просто tours;
- а onboarding hub.

Разделы:

- Basics
- For everyday users
- For approvers
- For admins
- Advanced diagnostics

Туры должны быть короткими и задачными:

- Start your first chat.
- Approve an AI action.
- Create an assistant.
- Connect an app safely.
- Understand AI activity.

Важно: туры не должны объяснять каждую техническую деталь. Они должны помогать пользователю сделать первое полезное действие.

## Возможный план внедрения

### Phase 1: Vocabulary pass

Цель: сделать язык мягче без больших изменений в архитектуре.

Что сделать:

- заменить `Agent` на `Assistant` в пользовательских местах;
- заменить `Tool grants` на `Access permissions`;
- заменить `Runs` на `Activity` для non-advanced users;
- убрать API endpoints из обычных InfoHint;
- добавить человеческие объяснения в PageHeader.

Риск: часть backend-aligned терминов может быть полезна для демо. Можно оставить их в Advanced info.

### Phase 2: Role-based navigation

Цель: убрать лишние разделы у простых пользователей.

Для member:

- Home
- Ask AI
- My chats
- Approvals
- Learn

Для admin/domain_admin:

- Home
- Assistants
- Approvals
- Activity
- Connected apps
- Costs
- Learn
- Advanced

### Phase 3: Simplified Home

Цель: сделать Home не аналитическим экраном, а стартовой точкой.

Member Home:

- continue chat;
- start chat;
- approvals waiting;
- recent activity.

Admin Home:

- urgent approvals;
- assistant health;
- spend changes;
- risky permissions;
- failed activity.

### Phase 4: Assistant creation wizard

Цель: заменить technical setup flow на понятный guided flow.

Wizard:

1. Choose assistant purpose.
2. Instructions.
3. Connected apps.
4. Safety rules.
5. Test.
6. Publish.

### Phase 5: Advanced details model

Цель: сохранить текущую мощность, но убрать ее из первого слоя.

Паттерны:

- Advanced tab;
- Developer details accordion;
- Show raw config;
- Show API endpoint;
- Show policy snapshot;
- Show run internals.

### Phase 6: Review all empty states and banners

Цель: сделать каждое пустое состояние обучающим.

Примеры:

- "No chats yet" -> "Start your first chat with an assistant."
- "No approvals" -> "When AI needs permission, requests will appear here."
- "No assistants" -> "Create an assistant to give your team a safe AI helper."

## Что не стоит делать

### Не стоит просто удалить advanced-функции

Они важны для продукта. Нужно не удалять, а спрятать глубже.

### Не стоит полагаться только на туториалы

Если базовый экран непонятен без тура, его нужно упростить.

### Не стоит показывать API всем пользователям

API hints полезны для разработки, но обычным пользователям они создают лишний страх.

### Не стоит использовать AI-термины без объяснения

Даже слово "agent" может быть неочевидным. Лучше начинать с "assistant" и объяснять глубже по мере необходимости.

## Критерии успеха

Интерфейс стал лучше, если пользователь может без обучения:

- понять, с чего начать;
- начать чат;
- понять, кто такой assistant;
- понять, какие приложения assistant может использовать;
- понять, почему AI просит approval;
- безопасно approve или reject действие;
- найти историю того, что AI сделал.

Для админа интерфейс стал лучше, если он может:

- быстро увидеть риски;
- настроить assistant permissions;
- понять, где AI остановился;
- проверить spend;
- открыть advanced diagnostics, когда это нужно.

## Открытые вопросы

- Нужен ли явный переключатель Simple / Advanced, или достаточно role-based navigation?
- Нужно ли переименовывать `Agent` в `Assistant` везде, или только в UI-copy?
- Нужно ли сохранять API hints в демо-версии как отдельный "Developer mode"?
- Должны ли tasks остаться в основном интерфейсе, если backend помечает их как MVP-deferred?
- Какой термин лучше для `Run`: Activity, Work log, Execution, History?
- Какой термин лучше для `Tool grants`: Permissions, Access, Connected apps access?
- Должен ли wizard создания assistant заменить текущий flow полностью или жить рядом как simple flow?

## Рекомендуемый следующий шаг

Самый безопасный следующий шаг: сделать отдельный UX-copy pass без больших архитектурных изменений.

Минимальный объем:

- переписать PageHeader subtitle для Home, Agents, Chat, Approvals, Runs, Tools;
- заменить технические InfoHint на человеческие подсказки;
- добавить Advanced details там, где нужно сохранить API-информацию;
- подготовить словарь терминов для UI.

После этого можно переходить к role-based navigation и wizard для создания ассистента.
