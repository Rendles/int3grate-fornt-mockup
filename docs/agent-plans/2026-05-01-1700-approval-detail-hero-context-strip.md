# Approval detail — hero context strip

Status: **Done — Steps 1–3 implemented; lint + build clean.**

Sign-off decisions (recorded 2026-05-01):

- **C-1 (layout):** group all three navigation links (View agent,
  Open chat, parent task) into a single horizontal "context strip"
  rendered as a sibling block immediately under the `<PageHeader>`,
  not inside it.
- **C-2 (status pill stays in `actions`):** the right-aligned status
  pill remains in `PageHeader actions`. The context strip is purely
  navigational; the status pill is state — they don't share a row.
- **C-3 (chip style):** all three chips use the same Radix primitive
  — `<Button asChild variant="soft" color="gray" size="2">` with a
  leading icon. No custom CSS class. Equal weight, instantly
  scannable, and the soft variant has enough surface contrast against
  `--gray-2` panel background that the buttons read as buttons (the
  current `ghost color="gray"` does not).
- **C-4 (subtitle):** the `<PageHeader subtitle>` becomes empty (the
  task moves into the strip). The `subtitle` prop is dropped entirely,
  not left as `undefined` with stale wiring.
- **C-5 (conditional render):** the strip is rendered only when at
  least one chip is renderable. Each chip is independently conditional
  (`agent` for the two agent chips, `taskContext` for the task chip).
  If all three would be empty, no strip — no empty row.
- **C-6 (icons):** `IconAgent` (View agent), `IconChat` (Open chat),
  `IconTask` (Task: …). All three are already imported or already in
  the icons barrel.
- **Out of scope:** restyling the `Status` pill, restyling the title,
  changing the eyebrow, changing PageHeader itself.

## 1. Task Summary

Today's hero crowds three different navigation links in three
different visual languages:

- **View agent** — `ghost size="1" color="gray"` button in `actions`.
  Almost invisible against the dark panel.
- **Open chat** — same as above.
- **Parent task** — plain inline `<Link>` inside `subtitle`. Different
  shape, different weight.

Plus the `Status` pill — which is colored — sits next to the two grey
ghost buttons and visually dominates them. The supervisor's eye lands
on the status pill and skips the buttons entirely.

This plan unifies the three nav links into one horizontal strip of
equal-weight chips, placed under the title. The status pill stays in
`actions` so state and navigation don't compete.

## 2. Current Repository State

- Branch: `shuklin/ux-redesign`. Working tree has the prior
  prior-activity-relocate plan committed (or staged).
- File touched: `src/prototype/screens/ApprovalDetailScreen.tsx` only.
- No new dependency, no new icon, no new format helper. `IconTask` is
  already exported from `components/icons.tsx`.
- `PageHeader` is in `components/common.tsx`. Verified it accepts
  `eyebrow / title / subtitle / actions` and that `actions` is a
  `<Flex wrap="wrap" gap="2">` slot — matches the documented contract
  in `CLAUDE.md`.
- Routes already exist: `/agents/:agentId`, `/agents/:agentId/talk`,
  `/tasks/:taskId`. No router changes.

## 3. Relevant Files Inspected

- `src/prototype/screens/ApprovalDetailScreen.tsx` — already read
  during the prior plan; the hero block is at the top of the return
  JSX (`<PageHeader … actions={…} />` inside the
  `data-tour="approval-action"` wrapper).
- `src/prototype/components/icons.tsx` — `IconTask` available.
- `src/prototype/components/common.tsx` — `PageHeader` shape.
- `docs/ux-spec.md` § 8 — `Open chat` / `View agent` / `In task` are
  acceptable user-facing copy. No vocab violations.
- `CLAUDE.md` — Agent Working Agreement, one-step-at-a-time rule.

## 4. Assumptions And Uncertainties

### Assumptions

- The user accepts "View agent", "Open chat", "Task: <title>" as the
  three chip labels. Task chip uses the literal task title, prefixed
  with "Task:" so the chip reads independently when scanned.
- `variant="soft" color="gray"` is enough lift; we don't need a custom
  `.context-chip` CSS class. If the result is still too subtle, we
  iterate in a second pass. (Discussed in C-3.)
- The strip lives outside the `data-tour="approval-action"` wrapper.
  The tour step "What is being asked" should still spotlight the
  PageHeader title/eyebrow, not the navigation chips.

### Uncertainties to verify in Step 1

- **Wrapping behaviour on narrow widths.** Three chips + the task
  title can exceed the `page--narrow` width on mobile. The strip
  should `wrap="wrap" gap="2"` so chips stack cleanly. Verified by
  squeezing the dev viewport in Step 4.
- **Status pill alone in `actions`.** With both ghost buttons
  removed, `actions` becomes just `<Status status={…} />`. That's
  fine — `PageHeader` actions is a flex slot, single child renders
  normally.
- **Long task titles.** A long title may visually overwhelm the agent
  chips. If observed, the task chip can `max-width` + ellipsis later
  — not in scope for Step 1.

## 5. Proposed Approach

Single-file edit, three local changes inside the `return` JSX:

1. **Drop `subtitle` from `PageHeader`** (no more inline task link
   there).
2. **Drop the two ghost buttons from `actions`** (only `<Status>`
   remains).
3. **Add a new sibling block** immediately after the
   `data-tour="approval-action"` wrapper, before the conflict banner:

   ```tsx
   {(agent || taskContext) && (
     <Flex gap="2" wrap="wrap" mt="3">
       {agent && (
         <Button asChild variant="soft" color="gray" size="2">
           <Link to={`/agents/${agent.id}`}>
             <IconAgent className="ic ic--sm" />
             View agent
           </Link>
         </Button>
       )}
       {agent && (
         <Button asChild variant="soft" color="gray" size="2">
           <Link to={`/agents/${agent.id}/talk`}>
             <IconChat className="ic ic--sm" />
             Open chat
           </Link>
         </Button>
       )}
       {taskContext && (
         <Button asChild variant="soft" color="gray" size="2">
           <Link to={`/tasks/${taskContext.id}`}>
             <IconTask className="ic ic--sm" />
             Task: {taskContext.title}
           </Link>
         </Button>
       )}
     </Flex>
   )}
   ```

No new component, no new CSS, no new prop on `PageHeader`. If we
later want a reusable "ContextStrip" primitive (e.g. for runs detail),
we extract on the second use, not the first.

## 6. Risks And Trade-offs

| Risk | Mitigation |
|---|---|
| `variant="soft"` chips might still be too subtle on the dark panel. | Easy iteration: bump to `variant="surface"` or add a custom CSS class in a follow-up. The structure (separate strip) is the load-bearing change; the styling tier is cheap to swap. |
| Adding a row of chips eats vertical space above the decision card. | Acceptable trade-off — the supervisor benefits from instant access to the three context targets. The strip only renders when there's at least one chip. |
| Task chip with a long title pushes the agent chips off-screen on narrow widths. | `wrap="wrap"` lets them stack; long-title ellipsis is a follow-up if observed. |
| Tour step `approval-action` no longer covers the task link. | Acceptable; the tour step body talks about "what's being asked", not navigation. The chips are discoverable on their own. |

## 7. Step-by-step Implementation Plan

Each step ends with a stop-and-report.

### Step 1 — Verify hero state and chip primitives

- Re-read the hero JSX in `ApprovalDetailScreen.tsx`.
- Confirm `IconTask` is in the icons barrel (already in
  `components/icons.tsx` — verified during planning, will recheck the
  current import line).
- Confirm `Button asChild variant="soft" color="gray" size="2"`
  renders as expected against `--gray-2` panel — visual sanity check
  against existing usage in the prototype (e.g. CommandBar chips, or
  agent-detail tab actions).

**Report:** confirm assumptions in § 4 before edit.

### Step 2 — Restructure hero + add context strip

- Remove `subtitle` prop from `<PageHeader>`.
- Remove both `View agent` and `Open chat` buttons from `actions`,
  leaving only `<Status status={approval.status} />`.
- Add `IconTask` to the icons import line (if missing).
- Insert the new context-strip block (per § 5) immediately after the
  `data-tour="approval-action"` wrapping `</div>`.

### Step 3 — Lint + build pass

- `npm run lint`.
- `npm run build`.

## 8. Verification Checklist

- [ ] Hero shows: eyebrow with mock badge → title → status pill on
      the right. No buttons or links inside the PageHeader.
- [ ] Below the hero: a single horizontal row of equal-weight chips:
      `[👤 View agent] [💬 Open chat] [📋 Task: <title>]`.
- [ ] When `taskContext` is null: only the two agent chips render.
- [ ] When `agent` is null (rare): only the task chip renders.
- [ ] When both are null: no strip — no empty row.
- [ ] All three chips navigate correctly: agent overview, agent chat
      tab, task detail.
- [ ] Strip wraps cleanly on narrow viewports (drag the window down
      to ~600 px wide).
- [ ] `Status` pill still renders in the top-right of the hero.
- [ ] `npm run lint` clean. `npm run build` clean.

## 9. Browser Testing Instructions For The User

After Step 2 lands:

1. Log in as `frontend@int3grate.ai`.
2. **Approvals → pick a pending request that is tied to a task.**
3. **Hero (top of page):** eyebrow ("APPROVAL REQUEST" + mock badge),
   title ("Sales agent wants to ..."), status pill on the right.
   No links inside the PageHeader.
4. **Just below the hero:** a single row with three chips, all the
   same shape and color (soft gray):
   - `View agent` → opens the agent overview.
   - `Open chat` → opens the agent's chat tab.
   - `Task: <title>` → opens the parent task page.
5. **Open a request without a task** (if any in fixtures): only the
   two agent chips render — no third "Task: …" chip.
6. **Squeeze the window** to ~600 px wide: chips wrap to a second
   row instead of overflowing.
7. **Approval review tour** (`/learn`): step "What is being asked"
   spotlights the title; the chips are not part of the spotlight.
   Step "Evidence panel" still works (it spotlights inside the
   decision card, unrelated to this change).

## 10. Progress Log

- 2026-05-01 17:00 — plan drafted, awaiting user sign-off before Step 1.
- 2026-05-01 — Step 1 done. Hero JSX matches plan; `IconTask` exists
  in icons barrel; `Button asChild variant="soft" color="gray" size="2"`
  is an established pattern (≥6 existing call-sites).
- 2026-05-01 — Step 2 done. Added `IconTask` to icons import. Removed
  `subtitle` prop and both ghost buttons from `<PageHeader>`. Added a
  new sibling `<Flex gap="2" wrap="wrap" mt="3">` block immediately
  after the `data-tour="approval-action"` wrapper, containing up to
  three soft-gray chips: View agent, Open chat, Task: <title>. Each
  chip is independently conditional; the whole block hides when both
  `agent` and `taskContext` are null.
- 2026-05-01 — Step 3 done. `npm run lint` clean. `npm run build`
  clean (`tsc -b` + `vite build`). Bundle warning is the pre-existing
  >500 kB chunk warning, unrelated to this change.
