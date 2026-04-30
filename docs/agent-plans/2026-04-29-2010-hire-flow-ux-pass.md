# Hire-an-agent flow — UX & visual consistency pass

Status: **Done — all phases A-D shipped.**

Sign-off decisions (recorded 2026-04-29):

- **B-1 (heading size):** full unification at `size="8"` across Welcome,
  Preview, all wizard steps, and Success.
- **D-1 (Preview):** keep Preview, integrate it into `StepProgress` as a
  4-step strip — `Overview · Name · Apps · Review`. Do **not** remove.
- **D-2 (Brief):** lift Brief out of `<details>`, show it always-visible
  on Review. Model / Creativity / Response length stay collapsed.
- **D-3 (Cancel):** add a Cancel ghost link in the wizard top row.

## 1. Task Summary

The `/agents/new` flow (file: `src/prototype/screens/AgentNewScreen.tsx`) walks
the user through six phases — `welcome → preview → name → apps → review →
success`. The flow ships and works, but a careful read uncovered ~14 problems
across logic, navigation, visual hierarchy, and component sizing. None of
them is a blocker on its own. Together they make the wizard feel inconsistent
and misleading at the moments where a non-technical owner most needs trust.

This plan groups the fixes into four phases (A–D), ordered by **risk × user
visibility**. Phase A and B are pure cleanup with negligible risk. Phase C is
small polish. Phase D is an information-architecture call and must be
signed off by the user before touching code.

## 2. Current Repository State

- Branch: `shuklin/ux-redesign`. Current diff includes work on tours
  (`docs/agent-plans/2026-04-29-1954-hire-an-agent-tour-plan.md` and
  `src/prototype/tours/hire-an-agent-tour.tsx`) plus the modified
  `AgentNewScreen.tsx`.
- The Hire wizard uses local React state for phase. There is no router
  state per step — `useRouter` is only used for navigation away.
- `data-tour` attributes have been added to the welcome screen for the new
  `hire-an-agent` orientation tour: `hire-welcome-intro`,
  `hire-featured-roles`, `hire-featured-role-card`, `hire-see-all-roles`,
  `hire-skip-explore`. The wizard steps themselves currently have no
  `data-tour` targets — refactors below must keep welcome's intact.
- The `<MockBadge kind="design">` on the Apps step is intentional and must
  stay visible (per `docs/backend-gaps.md`: real OAuth registry isn't in
  the spec yet). Only its placement changes.
- `@radix-ui/themes` exports `Spinner`, but no current screen uses it.
  Adding it here is a new-but-trivial dependency surface.

## 3. Relevant Files Inspected

- `src/prototype/screens/AgentNewScreen.tsx` — single file, 916 lines, owns
  the entire flow including its sub-components (`RoleCard`,
  `PreviewSection`, `PreviewBullet`, `StepProgress`, `NameStep`,
  `AppsStep`, `ReviewStep`, `SummaryRow`, `BulletItem`, `appReason`).
- `src/prototype/lib/templates.ts` — the 7 starter templates fed into the
  wizard. Untouched by this plan.
- `src/prototype/prototype.css`, lines 240–340 — `.page`, `.page--narrow`,
  `.page__title`, `.card` definitions. Note `.page__title em` is the rule
  that paints `<em>` accent-9 italic; only `<Heading className="page__title">`
  benefits.
- `src/prototype/components/fields.tsx`, `components/common.tsx`,
  `components/states.tsx` — primitives the wizard reuses. No changes
  required.
- `src/prototype/lib/api.ts` — `createAgent`, `createAgentVersion`,
  `activateVersion`, `setGrants`, `getAgent`. Backend contract unchanged.
- `docs/ux-spec.md` § 4 (three key screens), § 8 (vocabulary), § 11
  (anti-patterns) — all changes below comply.
- `docs/backend-gaps.md` — Apps step OAuth wiring is intentionally mocked;
  MockBadge stays.
- `CLAUDE.md` — Agent Working Agreement and one-step-at-a-time rule.

## 4. Assumptions And Uncertainties

### Assumptions

- The user wants the same flow shape (`welcome → … → success`), just
  cleaner. We are **not** redesigning the wizard from scratch.
- The Preview phase is **product-debatable** but currently shipping; we
  treat its removal as a Phase D decision, not Phase A.
- `Hire` as a verb stays per `docs/ux-spec.md` § 8 — we only adjust where
  it is used (button labels, breadcrumbs).
- `MockBadge` placement may move; it must remain on the Apps step in some
  visible form because the OAuth wiring is still mocked.
- Adding `Spinner` from `@radix-ui/themes` is acceptable — it ships with
  the existing theme and adds no new dependency.

### Uncertainties

All Phase D options have been resolved (see Status block at the top of
this document).

- **C-3 (RoleCard hover):** Inline JS hover works today. Migrating it
  to CSS `:hover` is a style decision — easy to revert if user prefers
  JS. Implement as part of Phase C unless user opts out.

## 5. Proposed Approach

Four-phase plan:

- **Phase A — logic fixes:** correct two real navigation bugs and one
  misleading button label. No visual changes. ~1 commit.
- **Phase B — visual consistency:** unify heading sizes, footer alignment,
  fix the heading-stuffed `MockBadge`, give the `<details>` block a
  visible chevron. ~1–2 commits.
- **Phase C — micro-polish:** equalise Connect/Disconnect, add Spinner to
  busy state, optionally migrate RoleCard hover from JS to CSS. ~1 commit.
- **Phase D — information architecture:** integrate Preview into
  StepProgress as Step 0 (`Overview`), lift Brief out of `<details>` on
  Review, add a Cancel link in the wizard top row. ~2 commits.

Each phase ends with `npm run lint` + `npm run build` clean, manual
browser verification, and a stop-and-report per CLAUDE.md.

## 6. Risks And Trade-offs

- **Risk:** Renaming Preview CTA from "Hire X" to "Continue" could read
  as less committal. Trade-off accepted because the current label flat-out
  lies — clicking it doesn't hire.
- **Risk:** Bumping wizard headings from `size="6"` to `size="8"` will
  reduce vertical density on the Name step. Trade-off accepted because
  consistency across the linear flow matters more (decision recorded in
  Status block — full unification chosen).
- **Risk:** A 4-step `StepProgress` strip (`Overview · Name · Apps ·
  Review`, per D-1) is wider than today's 3-step strip and may wrap on
  narrow viewports. Mitigation: existing strip already uses
  `wrap="wrap"` and the 28px connector lines collapse cleanly.
- **Risk:** Surfacing Brief on Review (D-2) makes the Review screen
  longer. Trade-off accepted because Brief is the most important
  customisation knob and is currently buried behind a click + scroll.
- **Risk:** A Cancel link (D-3) competes for attention with the
  StepProgress strip in the same row. Mitigation: render Cancel as
  `size="1"` ghost grey, far right of the row.
- **Risk:** Tour selectors. The `hire-an-agent` tour points only at
  welcome-screen `data-tour` attributes (not the wizard steps), so
  none of phases A–D break it. Verified by inspection of
  `src/prototype/tours/hire-an-agent-tour.tsx`.

## 7. Step-by-Step Implementation Plan

> **Execution rule (CLAUDE.md):** one step per work cycle. After each
> step, stop and report what changed, which files were touched, and how
> to verify in the browser. Do not auto-continue.

### Phase A — Logic fixes (no sign-off needed beyond this plan)

#### Step A1 — Fix `Back` on Name step to return to Preview

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:** line ~332 — currently `onBack={goBackToWelcome}` on
  `<NameStep>`.
- **Change:** pass `onBack={() => setPhase('preview')}` (or extract a
  helper `goBackToPreview`). Welcome should only be reachable from
  Preview's own Back button.
- **Why:** Current code skips Preview when going back from Name, losing
  the user's chosen template context (template state stays, but the
  screen the user just came from disappears from the back path —
  classic broken-trail pattern).
- **Edge case:** If Preview is removed in Phase D-1, this step becomes
  moot. That's why A1 ships first — if D-1 happens later, A1 is
  trivially reverted.

#### Step A2 — Rename Preview's primary CTA and fix its icon

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:** lines 290–294.
- **Change:**
  - Replace `<IconPlus />` with `<IconArrowRight className="ic ic--sm" />`
    so the affordance reads "go forward", not "create".
  - Replace label `Hire {template.defaultName}` with
    `Set up {template.defaultName}` (or `Continue`). Recommendation:
    `Set up {template.defaultName}` — keeps the named-direct-object
    feel while being honest that no hiring happens yet.
- **Why:** Current Preview button is the single most misleading control
  in the flow. It says "Hire" + plus icon, but actually opens 3 more
  steps. The real "Hire" CTA lives at the bottom of Review.
- **Note:** Welcome breadcrumb says `hire`, which is fine — it's the
  area name, not the action. No change there.

#### Step A3 — `<em>` accent inside wizard headings (page__title)

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:** line 307 — `<Heading size="6" weight="regular">`.
- **Change:** add `className="page__title"` to that heading.
- **Why:** `prototype.css` line 254 — `.page__title em { color:
  var(--accent-9); font-style: italic; }`. Welcome / Preview / Success
  headings have the class; the wizard's three headings don't, so
  `<em>agent.</em>`, `<em>apps.</em>`, `<em>hire.</em>` render as plain
  italics in muted gray. Visual inconsistency, not a bug per se, but
  the design language is broken mid-flow.

### Phase B — Visual consistency

#### Step B1 — Unify heading sizes across the flow

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:** line 307 — wizard heading is `size="6"` while Welcome
  (line 182), Preview (239), Success (384) are all `size="8"`.
- **Decision (recorded in Status block):** full unification at
  `size="8"`. Bump the wizard heading from `size="6"` to `size="8"`.
- **Verification:** at `size="8"` the StepProgress strip and the
  heading should not crowd each other; the `mb="5"` on the Flex
  wrapper at line 305 stays. Confirm in browser on narrow widths.

#### Step B2 — Standardise footer button alignment

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:**
  - Preview footer line 285 — `<Flex justify="center" gap="3" mt="6">`.
  - Wizard footers lines 571, 615, 684, 862 — `<Flex justify="between"
    mt="4" gap="2" wrap="wrap">`.
- **Change:** convert Preview footer to `justify="between"` to match
  the wizard. Place "Back" on the left, "Set up X" on the right.
- **Why:** the eye stops re-locating the primary CTA every screen
  transition. Consistency > local elegance.
- **Edge:** Welcome has `justify="center"` for "See all roles" / "Skip
  and explore" (line 213). That stays — it's a single-row choice list,
  not a stepper footer.

#### Step B3 — Move `MockBadge` out of the Apps heading

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:** lines 309–316.
- **Change:** drop the `<Text as="span">` wrapper. Render the heading
  cleanly:
  ```tsx
  <Heading size="8" weight="regular" className="page__title">
    Connect <em>apps.</em>
  </Heading>
  ```
  Then in the subtitle Text below (line 321), append the MockBadge
  inline at the end:
  ```tsx
  <Flex align="center" gap="2" wrap="wrap">
    <Text size="2" color="gray">
      {template.defaultName} works best when its apps are connected.
      You can skip and connect later.
    </Text>
    <MockBadge kind="design" hint="…" />
  </Flex>
  ```
- **Why:** badges next to giant headings read as broken layout. Pairing
  with the small grey subtitle keeps the badge visible without fighting
  the heading scale.

#### Step B4 — Give Advanced settings `<details>` a chevron affordance

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:** lines 785–791.
- **Change options (pick one):**
  1. **Minimal:** keep native `<details>`, add a chevron icon inside the
     `<summary>` flex. Use a CSS rule scoped to this element so the
     chevron rotates 90° when `details[open]`. Add a class like
     `advanced-toggle` and a small block in `prototype.css`.
  2. **Cleaner:** convert to a controlled state + Radix-styled button
     instead of native `<details>`. More React, but matches the rest
     of the codebase aesthetic.
- **Recommendation:** Option 1 — minimal change, native semantics
  preserved. Three lines of CSS.
- **Why:** today the user sees a single grey row that says
  "Advanced settings · brief, model, creativity, response length". No
  visual hint that it expands. Many users won't click.

#### Step B5 — Welcome/Preview eyebrow + breadcrumb cleanup

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:** breadcrumb at lines 168, 235, 303, 374.
- **Change:** Preview breadcrumb today is `home / team / hire / Sales
  Agent`. Same as the wizard. We could distinguish Preview as `home /
  team / hire / Sales Agent / overview` — but that's clutter. Decision:
  leave as-is. **No code change in this step**, log it as resolved.
- **Why:** flagged in the audit; keeping it as a documented "considered
  and rejected" so we don't relitigate later.

### Phase C — Micro-polish

#### Step C1 — Equalise Connect / Disconnect button footprint

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:** lines 643–656.
- **Current:** Connect = `<Button>` (default size, primary). Connected
  state = `Badge` + `<Button variant="ghost" color="gray" size="1">
  Disconnect</Button>`.
- **Change:** make both states use the same button size. Two patterns:
  - **Same size, swap variant:** `Connect` = solid; `Disconnect` =
    `variant="soft" color="gray"`, both `size="2"`. Drop the separate
    `Connected` badge — replace with `<IconCheck />` inline at the
    front of the Disconnect button or as a leading badge of equal
    height.
  - **Toggle pattern:** one button whose label flips
    `Connect` ↔ `Connected ✓ (click to disconnect)` with a tooltip.
- **Recommendation:** pattern A. It keeps the explicit Disconnect verb
  (no accidental disconnects) while killing the height jump.
- **Why:** today the row visibly "jumps" between states — bad
  microinteraction.

#### Step C2 — Spinner inside `Hiring…` busy state

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:** line 866–868.
- **Change:** import `Spinner` from `@radix-ui/themes`, render it
  inside the busy branch:
  ```tsx
  {busy ? (
    <><Spinner size="1" /> Hiring…</>
  ) : (
    <>Hire {name.trim() || template.defaultName}</>
  )}
  ```
- **Why:** the network call (`createAgent` → `createAgentVersion` →
  `activateVersion` → `setGrants` → `getAgent`) is ~5× 120–380 ms.
  Without a spinner the button just freezes for ~1 second; users
  reasonably assume nothing happened and click again.

#### Step C3 — RoleCard hover from JS to CSS (optional)

- **File:** `src/prototype/screens/AgentNewScreen.tsx` + `prototype.css`.
- **Current:** lines 454–455 use `onMouseOver` / `onMouseOut` to mutate
  `border-color` inline.
- **Change:** add a class `role-card` on the button, move hover styles
  to `prototype.css`:
  ```css
  .role-card { transition: border-color 120ms, background 120ms; }
  .role-card:hover { border-color: var(--accent-a7); }
  ```
  Drop the `onMouseOver/onMouseOut` handlers and the `transition` from
  inline style.
- **Why:** sticky hover state on touch devices, plus inline DOM
  mutation costs more than a CSS transition. **This is optional** —
  not user-visible on desktop, so user may decide to skip.

#### Step C4 — Long-name overflow on Hire CTA

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:** line 867 — `Hire {name.trim() || template.defaultName}`.
- **Change:** wrap the name portion so the button can truncate
  gracefully on small screens:
  ```tsx
  <>Hire <span className="cta-name">{name.trim() || template.defaultName}</span></>
  ```
  with CSS:
  ```css
  .cta-name {
    max-width: 18ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }
  ```
- **Why:** users name agents things like "Sara from East Coast Sales
  Department". On the Preview button (`Set up {name}`) and Review
  button (`Hire {name}`), long names can blow out the layout on narrow
  viewports.

### Phase D — Information architecture

All three D-steps are approved per the Status block. Implementation
details below.

#### Step D1 — Integrate Preview into StepProgress as `Overview`

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Approach:** keep the Preview phase as-is in terms of content. The
  visible change is that **Preview now shows the StepProgress strip
  with 4 entries** (`Overview · Name · Apps · Review`) and Preview is
  the first/active entry.
- **Concrete changes:**
  - Extend `StepProgress` (currently lines 494–533) to accept the
    `'preview'` phase. Update its `steps` array to:
    ```ts
    const steps: Array<'preview' | 'name' | 'apps' | 'review'> =
      ['preview', 'name', 'apps', 'review']
    const labels = {
      preview: 'Overview',
      name: 'Name',
      apps: 'Apps',
      review: 'Review',
    }
    ```
  - Loosen the `phase` prop on `StepProgress` from
    `'name' | 'apps' | 'review'` to include `'preview'`.
  - In the main render, mount `StepProgress` inside the Preview phase
    block too (today it's only mounted in the wizard block at line
    306). Wrap it in the same `<Flex direction="column" gap="3"
    mb="5">` shape used in the wizard for visual continuity.
  - Re-author the Preview heading + subtitle so it sits below the new
    progress strip, replacing the centred avatar-on-top layout when
    appropriate. Recommendation: keep the avatar but move it into a
    smaller header row alongside the heading instead of stacked
    centred — closer to the wizard's left-aligned shape, since now
    they share progress chrome.
  - Pair this with **Step A2** (button label `Set up X`) so the
    Overview step's CTA is honest about advancing to Name.
- **Edge:** `StepProgress` connector lines (28px each) now appear
  between four chips; total width grows. The component already uses
  `wrap="wrap"` so narrow viewports are fine, but verify in browser.

#### Step D2 — Lift Brief out of Advanced on Review

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:** lines 785–853 (the `<details>` block).
- **Concrete changes:**
  - Move the Brief `<TextAreaField>` block (currently lines 794–805,
    inside `<Box>`) **out of** `<details>` and render it as a sibling
    card above the Summary card. The hierarchy on Review becomes:
    1. Summary card (Name / Role / Connected apps / Approvals).
    2. Skipped-apps Banner (if any).
    3. **Brief card** — heading `Brief — what {name} should do`,
       textarea, helper text.
    4. `<details>` collapsed — `Advanced — model, creativity, response
       length`.
    5. `hireError` Banner (if any).
  - Update `<details>` summary text from
    `brief, model, creativity, response length` to
    `model, creativity, response length`.
  - Brief textarea keeps `minHeight: 180`, `placeholder=
    {template.defaultInstructions}`, and the helper line below.
- **Note:** Brief is the *only* knob from Advanced that a non-technical
  owner is likely to touch; surfacing it follows `docs/ux-spec.md` § 4
  (three key screens — give the user the lever that matters).

#### Step D3 — Cancel link in the wizard top row

- **File:** `src/prototype/screens/AgentNewScreen.tsx`
- **Where:** the wizard wrapper at lines 304–324 (the
  `<Flex direction="column" gap="3" mb="5">` containing
  `StepProgress` + heading + subtitle). Also applies to the Preview
  block once D-1 ships, since Preview shares the strip.
- **Concrete changes:** wrap `StepProgress` in a `Flex` row with
  `Cancel` pinned right:
  ```tsx
  <Flex align="center" justify="between" wrap="wrap" gap="3">
    <StepProgress phase={phase} />
    <Button asChild variant="ghost" color="gray" size="1">
      <a href="#/agents">Cancel</a>
    </Button>
  </Flex>
  ```
- **Behaviour:** clicking Cancel navigates straight back to
  `/agents` (Team page). No confirmation modal in this version — the
  only state lost is `name`, `connectedApps`, and any unsaved Brief
  edits, none of which has been persisted.
- **Future consideration (out of scope):** if the user later wants
  draft persistence (resume hiring later), wire Cancel to a confirm
  dialog. Not in this plan.

## 8. Verification Checklist

After every step:

- [ ] `npm run lint` clean.
- [ ] `npm run build` clean (TS strict — `noUnusedLocals` etc).
- [ ] No regressions in the existing tours: confirm
      `hire-an-agent`, `sidebar-overview`, `start-a-chat` still launch
      from `/learn` and reach their first step without warnings.
- [ ] No new MockBadge unintentionally lost. Apps step still flags
      mock OAuth.
- [ ] Reading order on each phase: heading → subtitle → body → footer
      with primary CTA on the right, back on the left.
- [ ] Vocabulary check (`docs/ux-spec.md` § 8): no new mentions of
      MCP, tokens (UI-facing), prompt, JSON, run, trace, model
      surfaced outside Advanced.
- [ ] All headings inside the linear flow now use `page__title`
      consistently and `<em>` is accent-9 italic everywhere.

## 9. Browser Testing Instructions

Open `npm run dev`, navigate to `#/app/agents/new`. Use the seeded
admin account (`frontend@int3grate.ai`, any password) so member-gating
in `AgentNewScreen` (line 68) doesn't bounce you to NoAccessState.

### After Phase A

1. Land on Welcome; click any role card → Preview.
2. Click `Set up <Name>` (was "Hire <Name>"). Should advance to Name
   step. Icon to the right of label is an arrow, not a plus.
3. On Name step click `Back`. **Expected:** lands on Preview, not
   Welcome. (Was: skipped Preview.)
4. On Preview, click `Back`. Lands on Welcome.
5. Heading on Name / Apps / Review pages should now show the `<em>`
   words ("agent.", "apps.", "hire.") in the accent colour and italic.

### After Phase B

1. Wizard headings now read at the new chosen size — same visual scale
   on every step.
2. Apps step heading no longer has a dashed pill stuck to it; the
   pill appears next to the small grey description below.
3. On the Review step, expand `Advanced settings`. Chevron rotates;
   block expands. Collapse — reverse.
4. Walk through the flow Welcome → Success. Every footer puts Back
   on the left, primary on the right.

### After Phase C

1. Apps step: click `Connect` on any app. The connected row should be
   the same height as the unconnected ones (no visible jump).
2. Review step: click `Hire <Name>` while watching the button. A
   spinner appears inside the button label for ~1 s, then you arrive
   at the Success page.
3. Try a long agent name like "Sara from East Coast Sales Department"
   in the Name step → Continue → Review. The CTA at the bottom should
   truncate the name with `…`, not break the row.
4. Hover any role card on Welcome. Border tints accent. Move the
   mouse away. Border returns to default.

### After Phase D

1. Pick a role from Welcome → Preview. The page now shows a 4-chip
   StepProgress (`Overview · Name · Apps · Review`) with `Overview`
   active.
2. Top-right of that row shows a small grey `Cancel` link. Click it
   from any step (Preview / Name / Apps / Review). Lands on
   `/agents` (Team page).
3. Walk to Review. The Brief textarea is visible without expanding
   anything, sitting between the Summary card and the Advanced
   `<details>`. Editing the Brief and continuing to Hire should
   persist the edit (verify the new agent's v1 instruction reflects
   the edit by opening the agent and checking the Brief).
4. The `Advanced` `<details>` summary now reads
   `Advanced — model, creativity, response length` (no `brief`).
5. Resize the viewport down to ~480px wide on Preview / wizard
   pages. `StepProgress` wraps cleanly to a second line; `Cancel`
   either stays right-aligned or wraps to its own line — neither
   should overlap the chips.

## 10. Progress Log

| Date | Step | Result | Notes |
|------|------|--------|-------|
| 2026-04-29 | Plan drafted | — | Initial draft, Phase D options open. |
| 2026-04-29 | Sign-off recorded | Approved | Decisions: B-1 = `size="8"` full unification; D-1 = keep Preview, integrate as Step 0 `Overview`; D-2 = lift Brief out of Advanced; D-3 = add Cancel link. Plan updated in place; implementation not started. |
| 2026-04-29 | Step A1 | Completed | Name step Back now returns to Preview instead of jumping to Welcome. |
| 2026-04-29 | Step A2 | Completed | Preview primary CTA now says `Set up {template.defaultName}` and uses the forward arrow icon instead of plus. |
| 2026-04-29 | Step A3 | Completed | Wizard headings now use `page__title`, so inline `<em>` words inherit the same accent styling as the rest of the flow. |
| 2026-04-29 | Step B1 | Completed | Wizard heading size is now unified at `size="8"` with Welcome, Preview, and Success. |
| 2026-04-29 | Step B2 | Completed | Preview footer now matches wizard alignment with Back on the left and the primary CTA on the right. |
| 2026-04-29 | Step B3 | Completed | Apps MockBadge moved out of the large heading and into the subtitle row, keeping the mock warning visible without disrupting hierarchy. |
| 2026-04-29 | Step B4 | Completed | Advanced settings keeps native `<details>` semantics and now has a rotating chevron affordance. |
| 2026-04-29 | Step B5 | Completed | Breadcrumb cleanup was considered and rejected as unnecessary clutter; current breadcrumbs stay unchanged. |
| 2026-04-29 | Step C1 | Completed | Apps step now uses same-size Connect and Disconnect buttons, with an inline check on the disconnect state instead of a separate badge. |
| 2026-04-29 | Step C2 | Completed | Review Hire button now shows a Radix Spinner during the busy `Hiring…` state. |
| 2026-04-29 | Step C3 | Completed | RoleCard hover styling moved from inline mouse handlers to scoped CSS. |
| 2026-04-29 | Step C4 | Completed | Review Hire CTA now truncates long agent names with `.cta-name` instead of stretching the footer. |
| 2026-04-29 | Step D1 | Completed | Preview is now the `Overview` step in a 4-step StepProgress strip and uses a wizard-aligned header layout. |
| 2026-04-29 | Step D2 | Completed | Review now shows Brief as an always-visible card, while Advanced settings only contains model, creativity, and response length. |
| 2026-04-30 | Step D3 | Completed | Cancel ghost link added top-right of StepProgress on both Preview and wizard steps; navigates to `/agents` via the existing `<Button asChild><a href="#/agents">` pattern. Lint + build clean. |
