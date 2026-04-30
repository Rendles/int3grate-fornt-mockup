# Approval detail page — redesign

Status: **Draft — awaiting user sign-off before Step 1.**

Sign-off decisions (recorded 2026-04-30):

- **D-1 (prior activity):** lift out of `<details>` accordion; show inline by
  default as a "What the agent did so far" section above the decision card.
- **D-2 (task context):** show the parent task headline in the page hero
  (eyebrow line + linked task title) when `taskContext` is present.
- **D-3 (agent / chat links):** make the agent name in the hero title a
  link to `/agents/:agentId`; add a small "Open chat" chip next to it
  routing to `/agents/:agentId/talk`.
- **D-4 (quick approve):** add a small ghost-style `Quick approve` button
  in the top-right of `ReviewCard`. Single click → submits `approved`
  with no reason. Minimum target size 24×24px (WCAG 2.5.5). The existing
  full-size `Approve action` / `Reject action` buttons stay; reject keeps
  the two-step flow with required reason. Quick reject is intentionally
  not added.
- **Out of scope (this plan):** quick approve in the `/approvals` list.
  Was discussed, not signed off — left as future work.

## 1. Task Summary

`ApprovalDetailScreen` (`src/prototype/screens/ApprovalDetailScreen.tsx`,
857 lines) currently asks the supervisor to make a decision with limited
context: prior agent activity is hidden behind an accordion, the parent
task is only reachable through "Technical details", and the agent name
is plain text — no link to the agent page or chat. The decision flow is
also strictly two-step (click `Approve action` → confirm with optional
reason → submit), which is correct for high-stakes deliberation but
becomes friction for supervisors who skim ten low-risk approvals in a row.

This plan rebuilds the page around five user-facing changes:

0. The action being requested — already present, unchanged.
1. **Prior activity** — promoted from collapsed accordion to inline section.
2. **Parent task** — surfaced in the hero, linked.
3. **Link to agent page** — agent name in the title becomes a `<Link>`.
4. **Link to agent chat** — small "Open chat" chip in the hero actions.
5. **Quick approve** — small ghost button, single-click approve, no reason.

The two-step deliberate flow stays as the default for users who need to
add a reason or who are reviewing something high-stakes.

## 2. Current Repository State

- Branch: `shuklin/ux-redesign`. Existing diff is unrelated (tours work,
  AGENTS.md, learn screen). This plan touches one screen file plus
  potentially `prototype.css` for the new section style.
- `ApprovalDetailScreen` already fetches `runContext` (`api.getRun`),
  `taskContext` (`api.getTask`) and `agents` (`api.listAgents`), so the
  data needed for D-1 through D-4 is already loaded. No new API surface.
- `agent` is resolved via
  `agents.find(a => a.active_version?.id === runContext.agent_version_id)`.
  The link will use `agent.id`, which is already on the resolved object.
- Routes that we will link to already exist (verified in `index.tsx`):
  - `/agents/:agentId` — agent overview.
  - `/agents/:agentId/talk` — agent's chat tab.
  - `/tasks/:taskId` — task detail (mock-backed; `MockBadge kind="deferred"`
    on the screen, not on the link).
- `Link` component prepends `/app` automatically; we use it everywhere
  per CLAUDE.md routing notes.
- `data-tour` attributes on the screen: `approval-action`,
  `approval-decision`, `approval-evidence`. These are referenced by
  `tours/approval-review-tour.tsx`. The redesign must keep them on
  semantically equivalent nodes or the tour breaks.

## 3. Relevant Files Inspected

- `src/prototype/screens/ApprovalDetailScreen.tsx` — the only screen file
  touched. Sub-components living inside: `ReviewCard`,
  `DecisionConfirmCard`, `ResolvedCard`, `ResumeBanner`, `Section`,
  `FactValue`, `PriorActivityAccordion`, `StepLine`,
  `TechnicalDetailsAccordion`, `DetailRow`.
- `src/prototype/lib/types.ts` — `ApprovalRequest`, `RunDetail`, `Task`
  shape confirmed; `Task` has `title`, `status`, `id`.
- `src/prototype/lib/api.ts` — `decideApproval(id, decision, reason, userId)`
  is the single mutation. Quick approve passes `null` reason.
- `src/prototype/router.tsx` + `src/prototype/index.tsx` — route patterns
  for agent, task, agent-talk verified.
- `src/prototype/tours/approval-review-tour.tsx` — selectors that depend
  on this screen.
- `src/prototype/components/common.tsx` (`PageHeader`, `Status`,
  `MockBadge`, `Caption`) — primitives reused.
- `src/prototype/prototype.css` — `.card`, `.card__head`, `.card__body`,
  `.card__foot` patterns we will compose.
- `docs/ux-spec.md` § 5 (control = central thesis), § 8 (vocab), § 11
  (anti-patterns).
- `docs/backend-gaps.md` — `MockBadge kind="design"` on the existing
  PageHeader stays; nothing in this plan widens the backend surface.
- `CLAUDE.md` — Agent Working Agreement, one-step-at-a-time rule.

## 4. Assumptions And Uncertainties

### Assumptions

- The user has accepted that two-step approve remains the default and
  primary path, and that quick approve is an additional, smaller surface.
- The user accepts that quick approve has no reason field. The audit log
  records the user, decision, and timestamp via `decideApproval`; reason
  is `null`. This is consistent with existing reject-vs-approve asymmetry
  (approve reason was already optional in the two-step flow).
- Task page (`/tasks/:taskId`) is acceptable as a link target despite
  being `x-mvp-deferred`. The link is informational; if backend is
  missing, the task screen already renders its own deferred banner.
- The "Open chat" target is `/agents/:agentId/talk` (agent's chat tab)
  rather than `/chats/new` — the supervisor's intent is "talk to *this*
  agent", which is the agent-scoped chat list, not a generic new chat.

### Uncertainties to verify in Step 1

- **Touch target compliance.** `Radix Button size="1"` height is roughly
  24px. We will measure it in DevTools and bump to a custom min-height
  if needed.
- **Tour selector survival.** `approval-decision` currently wraps the
  whole `ReviewCard` block. After the redesign, the quick-approve button
  must NOT be the first match for any tour-targeted selector. We confirm
  in Step 6 (verification).
- **Auto-submit race.** `doDecide` already guards against `already_resolved`
  by re-fetching before submit. Quick approve must use the same guard.
  Refactor preserves the guard.

## 5. Proposed Approach

Single screen file, four self-contained edits, ordered so each is
independently verifiable:

1. **Refactor `doDecide` to take explicit args.** Today it reads
   `decision` and `reason` from state. We change the signature to
   `doDecide(d: Decision, reasonText: string)` and update the existing
   confirm button to pass `(decision, reason)`. This unblocks quick
   approve without duplicating logic.
2. **Hero rebuild (D-2 + D-3).** Replace the plain `agentName` text in
   the title with a `<Link to={'/agents/' + agent.id}>{agentName}</Link>`.
   Add a "Open chat" ghost button in `actions` (next to `<Status>`).
   Add an eyebrow row above the title showing parent task: `In task:
   <Link>{task.title}</Link>` when `taskContext` exists. Keep the
   existing `MockBadge` on the eyebrow.
3. **Lift `PriorActivityAccordion` out of `<details>` (D-1).** Replace
   the `<details>` element with a `Section`-like inline block titled
   "What the agent did so far". Position it **above** `ReviewCard` so
   the supervisor reads context first, then decides. Keep the
   `data-tour="approval-evidence"` attribute on the new wrapper.
4. **Quick approve button (D-4).** Add a `<Button size="1"
   variant="ghost" color="green">` in `ReviewCard`'s top-right (above
   the existing big-buttons row). Single click calls
   `doDecide('approved', '')`. Min-height 24px verified. Tooltip:
   "Approve without adding a reason". The existing big `Approve action`
   button stays unchanged and still routes through `DecisionConfirmCard`.

No new dependencies. No new API calls. No new fixtures. No copy that
violates ux-spec § 8 (no "tokens", "model", "run", etc.).

## 6. Risks And Trade-offs

| Risk | Mitigation |
|---|---|
| Quick approve looks like the canonical button → user clicks it without reading. | Ghost variant, smaller size, top-right placement (away from primary button column); tooltip explains "no reason". |
| Tiny target hostile to trackpad / keyboard users. | 24px floor; full keyboard support (Enter on focused button). |
| Tour `approval-decision` no longer wraps the right node. | Step 6 verifies the tour still finds its targets; rewrite the tour step *only if* it visibly breaks. |
| Prior activity inline always-visible adds vertical noise on dense screens. | Inline section uses muted styling and limited density (existing `StepLine` already designed for this). |
| `taskContext` is null often → eyebrow flickers / shifts layout. | Render the task line only when `taskContext` is non-null, no placeholder. The existing `MockBadge` line is the stable anchor. |
| `/tasks/:taskId` is mvp-deferred → link goes to a screen the user might not "trust". | The task screen already explains its own deferred status. The link is purely contextual; no new lie introduced. |
| Quick approve creates a 1-click destructive action. | Acknowledged trade-off. Mitigated by size, placement, and the fact that the deliberate two-step path is unchanged. |

## 7. Step-by-step Implementation Plan

Each step ends with a **stop and report**, per CLAUDE.md.

### Step 1 — Verify state and route shape

1. Re-read `ApprovalDetailScreen.tsx` end-to-end.
2. Open DevTools on `/approvals/:id` (use a pending fixture) and confirm:
   - `runContext.agent_version_id` resolves to an `agent.id` from the
     loaded `agents` list;
   - `taskContext` is populated for at least one fixture;
   - `Radix Button size="1"` rendered height in this screen's context.
3. Re-read `tours/approval-review-tour.tsx` step targets.

**Report:** confirm or correct each assumption in § 4 before any edit.

### Step 2 — Refactor `doDecide` to accept args

- Change signature: `doDecide(d: Decision, reasonText: string)`.
- Inside, drop the reads from `decision` / `reason`; use args.
- Keep the `already_resolved` re-fetch guard.
- Update the confirm-card submit to call `doDecide(decision, reason.trim())`.

No visible UI change. Lint + build clean.

### Step 3 — Hero rebuild (D-2 + D-3)

- Wrap `agentName` in the `PageHeader` title with a `<Link to={'/agents/' + agent.id}>` when `agent` is non-null. Fall back to plain text otherwise.
- In `actions`, add `<Button asChild size="1" variant="ghost"><Link to={'/agents/' + agent.id + '/talk'}>Open chat</Link></Button>` to the right of `<Status>`. Order: `[Open chat] [Status]`.
- Above the title (still inside the same `data-tour="approval-action"` wrapper), conditionally render an eyebrow line: `<Caption>In task</Caption> <Link to={'/tasks/' + task.id}>{task.title}</Link>`. Hidden when `taskContext` is null.

**Verify:** PageHeader still has the `MockBadge`; clicking the agent name navigates to `/agents/:id`; clicking "Open chat" navigates to `/agents/:id/talk`; task line only appears when present.

### Step 4 — Lift prior activity out of accordion (D-1)

- Replace `<PriorActivityAccordion>` with a new inline component
  `PriorActivitySection`. Same `useMemo` for `leadingSteps`, same
  `StepLine` rendering.
- Position: between the hero and `ReviewCard` (above the decision).
- Wrapper retains `data-tour="approval-evidence"`.
- Hide entirely when there are no leading steps and no task context (the
  existing early-return condition).

**Verify:** the steps are visible without clicking; tour selector still
resolves; vertical rhythm (24px) preserved.

### Step 5 — Quick approve button (D-4)

- In `ReviewCard`, add a small header strip above the existing `Section`
  blocks containing a single `<Button size="1" variant="ghost" color="green">`
  aligned to the right. Inside: `<IconCheck className="ic ic--sm" /> Quick approve`.
  `aria-label="Approve without adding a reason"`. Tooltip same.
- `onClick`: calls `doDecide('approved', '')`. The button is a sibling
  of the existing `Approve action` / `Reject action` buttons; both paths
  ultimately call `doDecide` with different args.
- Visual: `size="1"` ghost, `color="green"`, padding tuned so target box
  is ≥24px tall. Live-measure in DevTools. If Radix `size="1"` is below
  24px, add `style={{ minHeight: 24, paddingInline: 8 }}`.
- Disabled while `busy` is true.

**Verify:** single click submits and triggers the existing
`ResumeBanner` polling. The big `Approve action` flow still works
unchanged. `Reject action` still requires reason ≥4 chars.

### Step 6 — Tour + lint + build pass

- `npm run lint`.
- `npm run build`.
- Walk the `approval-review` tour from `/learn`. Every step's target
  must resolve. If a step now points at a removed selector, decide:
  fix the tour copy (small) or keep stale (per CLAUDE.md tour rebuild
  is currently deferred — favour minimal fix).

## 8. Verification Checklist

- [ ] `/approvals/:id` (pending) shows: parent task line, agent name as
      link, "Open chat" chip, prior activity inline, quick approve in
      ReviewCard top-right, big Approve / Reject buttons unchanged.
- [ ] Quick approve submits with `null` reason; resume banner appears;
      audit log shows the approval as approved with no reason.
- [ ] Two-step Approve still works and still allows an optional reason.
- [ ] Reject still requires ≥4 char reason.
- [ ] `already_resolved` race still handled (open two tabs, decide in
      tab A, click in tab B → conflict banner appears).
- [ ] Resolved approvals (`/approvals/:id` for an approved fixture) do
      NOT show quick approve, because `ReviewCard` is not rendered.
- [ ] Hero links: agent name → `/agents/:id`; "Open chat" →
      `/agents/:id/talk`; task title → `/tasks/:id`.
- [ ] Quick approve button is ≥24px tall and ≥24px wide.
- [ ] Tab order through the page: hero links → prior activity → quick
      approve → big approve → big reject. No focus traps.
- [ ] `approval-review` tour completes without "target not found".
- [ ] `npm run lint` clean. `npm run build` clean.
- [ ] No new vocab violations: no "run", "execution", "model", etc.
      Check with the grep in `CLAUDE.md` § "Useful greps".

## 9. Browser Testing Instructions For The User

After Step 5 lands, open the prototype:

1. Log in as `frontend@int3grate.ai` (any password).
2. Navigate to **Approvals** in the sidebar. Pick any pending request.
3. **Top of the page** — confirm:
   - The eyebrow shows `APPROVAL REQUEST` (with the existing dashed
     mock badge — that is intentional).
   - Below it, if the request is tied to a task, you see
     `In task: <task title>` as a link. Click it — should land on the
     task page.
   - The page title reads `<Agent name> wants to <action>`. The agent
     name itself is a link — click it, should land on the agent page.
   - To the right of the title, you see a small **Open chat** ghost
     button. Click it — should land on the agent's chat tab.
4. **Below the hero** — confirm a "What the agent did so far" section
   is visible **without clicking anything**. It lists the agent's
   leading steps with status pills.
5. **Quick approve** — find the small `Quick approve` button in the
   top-right of the white decision card (the one with "Why approval is
   needed", "What you should check", etc.). It should be visibly
   smaller than the big `Approve action` button below.
   - Hover it: tooltip "Approve without adding a reason".
   - Click it once: a "queued" banner appears, then "running", then a
     terminal banner. **No second confirm screen.**
6. **Two-step approve still works.** Open another pending approval.
   Click the big green `Approve action` button. The reason card
   appears. Type something or leave it blank, click `Approve action`.
   Should resolve.
7. **Reject is unchanged.** Open another pending approval. Click
   `Reject action`. The reason card appears with **required** reason
   field. Try submitting without a reason — should show "At least 4
   characters". Add a reason, submit — should resolve.
8. **Resolved approvals.** Open an already-approved request. There
   should be **no** quick-approve button (because the decision card
   isn't rendered).
9. **Tour still works.** Go to `/learn`, start the
   "Approval review" tour. Walk through it; no "target not found"
   fallback should appear.

## 10. Progress Log

- 2026-04-30 16:45 — plan drafted, awaiting user sign-off before Step 1.
- 2026-04-30 — Steps 1–6 implemented. `npm run lint` and `npm run build`
  both clean. Tour selectors `approval-action`, `approval-decision`,
  `approval-evidence` all preserved in `ApprovalDetailScreen.tsx`.
- Plan deviations recorded mid-implementation:
  - **Step 3.** Plan said "wrap agent name in a `<Link>`". Switched to
    two ghost-button chips in `actions` (`View agent`, `Open chat`).
    Reason: `:where(.prototype-root) a { color: inherit; text-decoration:
    none }` makes inline links inside a heading visually indistinguishable
    from plain text — no affordance. Two chips are symmetric, discoverable,
    and match the navigation pattern used elsewhere.
  - **Step 4.** Plan said "render condition unchanged". Tightened it:
    section now hides when `leadingSteps.length === 0` regardless of task
    presence. The previous condition (`leadingSteps.length === 0 && !task`)
    rendered an empty-step section just because a task existed — which
    no longer makes sense now that the parent task is shown in the hero
    subtitle. Dropped the `task` prop from `PriorActivitySection`.
- Tour copy walk-through left to user: the engine resolves all targets,
  but per `CLAUDE.md` memory tour rebuild is deferred — copy may still
  reference removed UI. Not in scope for this plan.
