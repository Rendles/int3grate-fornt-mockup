# Tours Plan

Status: **Needs implementation planning refresh**.

Updated: 2026-04-29.

This document is the high-level product plan for guided tours. It describes
which tours are already shipped, which future tours still make sense, and
which older ideas should not be implemented as originally written.

For practical authoring rules, use `docs/tours-guide.md`.
For step-by-step implementation work, use `docs/plans/tours-implementation.md`.

## Current System State

The guided-tour system itself is already in place:

- Learning Center route: `/learn`.
- Tour registry: `src/prototype/tours/registry.ts`.
- Tour engine: `src/prototype/tours/TourOverlay.tsx`.
- Training mode: `src/prototype/tours/TrainingModeProvider.tsx`.
- Training fixtures: `src/prototype/tours/training-fixtures.ts`.
- Cross-screen navigation is supported through `TourStep.navigateTo`.
- Conditional steps through `TourStep.when` are **not** supported today.

Currently shipped tours:

| Tour id | Status | Notes |
|---|---|---|
| `sidebar-overview` | Shipped | Static overview of the shell navigation. |
| `approval-review` | Shipped | Core workflow tour with Training mode. |
| `start-a-chat` | Shipped | Reworked to follow Team -> Agent -> Talk. |
| `configure-tool-grants` | Shipped | Reworked as "Set agent permissions". |

## Important Product Guardrails

All future tours must follow `docs/ux-spec.md`.

That means:

- Teach the user as an owner managing a small digital team, not as an engineer operating workflows.
- Prioritize Team, Conversation, and Approvals.
- Keep Activity understandable, but do not turn it into logs/traces onboarding.
- Avoid user-facing technical words in tour copy: workflow, MCP, tokens, model, prompt, JSON, run, execution, trace, context window, orchestration, system prompt, temperature.
- Use direct current routes, not legacy redirects. Use `/activity`, `/costs`, `/agents/new`, `/agents/:id/talk`, not `/runs`, `/spend`, or old `/app` paths.
- Prefer short practical explanations over architecture lectures.

## What Changed From The Older Plan

The old plan treated `inspect-a-run` and `spend-overview` as the remaining
Phase 6 work. That is no longer the right default order.

Reasons:

- `/runs` is now a legacy redirect to `/activity`.
- `/spend` is now a legacy redirect to `/costs`.
- The old `inspect-a-run` idea was built around a technical detail screen with tokens, model/tool columns, step timelines, and run language.
- The current UX spec explicitly tells us not to lead Maria into technical concepts unless there is a strong reason.
- The current product is trying to simplify around Team, Conversation, Approvals, Activity, and Costs.

So the older Phase 6 candidates are not deleted, but their priority and shape are changed below.

## Recommended Future Tours

### 0. Preflight: Existing Tour Copy Cleanup

Priority: P0 before adding any new tour.

This is not a new tour, but it should happen first. At least one existing
Learning Center card still contains stale technical language: `start-a-chat`
mentions "version and model" in `registry.ts`.

Goal:

- Make sure all existing tour card descriptions and step bodies match the current UI and `docs/ux-spec.md`.
- Keep existing tour ids stable so completed-tour localStorage records still work.

Why:

- Adding more tours while existing cards still teach banned vocabulary makes the Learning Center feel inconsistent.
- This is low-risk and should be done before larger tour work.

### 1. `hire-an-agent` - Hire your first agent

Priority: P1, recommended next new tour.

Audience:

- `admin` / `domain_admin`.

Routes:

- `/agents/new`.
- Optional success navigation to `/agents/:agentId/talk` if the final hire action is included.

Why this should replace the old next step:

- Hiring an agent is closer to the core product promise than inspecting a technical run.
- It supports the Team mental model: agents are employees joining the team.
- It gives a demo-friendly story: choose a role, understand app access, review approvals, hire, then talk.

Recommended shape:

1. Welcome / role templates - explain choosing a useful starting role.
2. Preview - explain what this agent will help with.
3. Name - explain that this is how the team will recognize the agent.
4. Apps - explain that apps are what the agent can access.
5. Review - explain apps, approvals, and the final hire action.
6. Success - explain that the agent is ready and can be talked to from Team.

Implementation notes:

- Current `AgentNewScreen` has no tour targets, so it needs new `data-tour` attributes.
- The wizard currently exposes advanced settings with model/token language. The tour should avoid highlighting that section unless the UI is simplified first.
- If the tour clicks the final Hire button, Training mode should sandbox `createAgent`, `createAgentVersion`, `activateVersion`, and grants writes. If we do not add sandbox support yet, the tour should stop before the final submit.
- Because Connect apps is a mock-only surface, the tour copy should be honest and should not oversell real OAuth behavior.

### 2. `activity-overview` - Understand what agents did

Priority: P2.

Audience:

- All roles.

Routes:

- `/activity`.
- Optional `/activity/:runId` only if framed as an advanced technical view and not the main lesson.

This replaces the old `inspect-a-run` idea.

Why:

- Activity is useful for trust: the owner can see what agents did and when they need help.
- The friendly Activity list is more aligned with the product than the technical detail screen.

Recommended shape:

1. Activity nav item - where to check what happened.
2. Friendly activity row - agent name, plain-English outcome, time.
3. Filters - narrow by agent and date.
4. Expanded row - see the short explanation and app details.
5. Needs approval / got stuck state - connect Activity back to Approvals.
6. Optional technical view link - mention that most users do not need it.

Implementation notes:

- `RunsScreen` currently has no `data-tour` attributes for filters, rows, or expanded content.
- `api.listRuns()` does not currently read from Training mode scenarios, so a deterministic Activity tour needs API support first.
- Do not implement the old technical `inspect-a-run` tour as the default. If a technical tour is ever needed, make it admin/developer-facing and clearly label it as advanced.
- Adding `TourStep.when` is not needed for the friendly Activity overview if we seed deterministic training data.

### 3. `costs-overview` - Understand monthly bill

Priority: P3.

Audience:

- `admin` / `domain_admin`.

Routes:

- `/costs`.

Why:

- Costs are important for admins and demos, but the screen is mostly read-only analytics.
- This should be short and practical, not a dense analytics walkthrough.

Recommended shape:

1. Weekly total - what has been spent this week.
2. Costs by agent - which agents are driving spend.
3. Trend - rough last-four-weeks direction, with the mock badge caveat.
4. All agents table - click through to an agent if needed.
5. Optional advanced view - only if the product still keeps it visible; do not teach tokens as a normal concept.

Implementation notes:

- Use `/costs`, not `/spend`.
- `SpendScreen` currently has no `data-tour` attributes.
- `api.getSpend()` does not currently use Training mode data.
- The existing advanced accordion includes tokens. The tour should not spotlight token rows unless the screen is revised for the target user.

### 4. `apps-and-permissions` - How app access works

Priority: P4, optional.

Audience:

- `admin` / `domain_admin`.

Routes:

- `/apps`.
- Maybe `/agents/:agentId/grants` if combined with the existing permissions tour.

Why:

- App access is important, but `/apps` currently includes mock-only OAuth behavior.
- The shipped `configure-tool-grants` tour already teaches agent-level permissions.

Recommendation:

- Do not build this until app connection behavior is less placeholder-like.
- If built, keep it short and focus on "connected services your agents can access", not connector internals.

## Tours Not Recommended Right Now

### Old `inspect-a-run`

Do not implement as originally written.

The old idea targeted `/runs/:runId` and highlighted technical internals:
status pill, CommandBar, tokens, step timeline, model/tool columns, JSON-like
details, and conditional banners.

This conflicts with the current UX direction. If we need a technical tour
later, it should be:

- renamed to something like `advanced-activity-detail`;
- admin/developer-facing only;
- launched from a clearly advanced context;
- written in a way that does not teach Maria that "runs" are the main mental model.

### Tasks Flow

Do not build a tour for `/tasks*` while Tasks remain MVP-deferred.

### Register Screen

Do not build a tour for registration while `POST /auth/register` is missing.

### Profile

Do not build a tour. The screen is too small to justify one.

### Full Settings Tour

Do not build yet. Settings contains mixed admin/developer/diagnostic surfaces,
and a broad tour would likely make the app feel more complex rather than less.

## Training Mode Backlog

Current Training mode is enough for shipped tours, but future tours may need
additional sandbox coverage.

Likely needs:

| Future tour | Training support needed |
|---|---|
| `hire-an-agent` | Sandbox create agent, create version, activate version, grants writes, or stop before final submit. |
| `activity-overview` | Route `api.listRuns()` through training scenarios and seed friendly Activity rows. |
| `costs-overview` | Add spend data to `TrainingScenario` or allow `api.getSpend()` to read deterministic training spend. |

Rule:

- If a tour needs predictable data, add Training mode support at the `api.*` boundary.
- Do not read fixtures directly from screens.
- Do not let training mutations leak into normal mock data.

## Implementation Principles For New Tours

- One tour per file under `src/prototype/tours/`.
- Register every tour in `src/prototype/tours/registry.ts`.
- Use `data-tour` attributes, not class names or text selectors.
- Keep copy under 2 short sentences per step.
- Prefer `navigateTo` for cross-screen tours.
- Do not add `when` unless a new tour truly needs conditional steps.
- After each tour: `npm run lint` and `npm run build`.
- Browser verify from `http://localhost:5173/#/learn`.

## Recommended Next Work

1. Clean existing Learning Center card copy, especially `start-a-chat`.
2. Create a detailed implementation plan for `hire-an-agent`.
3. Build `hire-an-agent` one step at a time.
4. Reassess whether Activity or Costs is more useful for the next demo.

This means the refreshed plan no longer treats old Phase 6c `inspect-a-run`
as the next default step.
