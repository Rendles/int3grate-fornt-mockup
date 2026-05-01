# Approval detail — relocate "prior activity" into the decision card

Status: **Done — all 6 steps implemented; lint + build clean. User confirmed in-browser on 2026-05-01.**

Sign-off decisions (recorded 2026-05-01):

- **R-1 (remove "Why approval is needed"):** delete the section entirely.
  `policyReason` (validation-step verdict reason) will no longer be shown
  on this screen. "What happens if you approve / reject" already conveys
  the consequence; we don't repeat the policy rationale.
- **R-2 (remove "What you should check"):** delete the section entirely.
  `evidence_ref` rendering inside `ReviewCard` is removed. Reason: that
  data is largely fabricated in fixtures and unlikely to exist on the
  real backend in the same shape. Keeping it would teach the supervisor
  to rely on a screen that won't be there.
- **R-3 (keep the two consequence sections):** "What happens if you
  approve" and "What happens if you reject" stay inside `ReviewCard`,
  unchanged.
- **R-4 (move prior activity inside `ReviewCard`):** the list of agent
  steps currently rendered by the standalone `PriorActivitySection` at
  the bottom of the page moves *into* `ReviewCard`, in the slot vacated
  by R-1 + R-2. The standalone section below is removed.
- **R-5 (resolved state):** for non-pending approvals (`approved`,
  `rejected`, `expired`, `cancelled`) where `ReviewCard` is not
  rendered, the prior-activity list must still be visible. It is
  rendered as a separate card below `ResolvedCard`.
- **Out of scope:** `evidence_ref` will keep showing in the
  `TechnicalDetailsAccordion` "Raw evidence" block. That accordion is a
  power-user escape hatch and is collapsed by default; it does not
  conflict with R-2's reasoning. If we later decide to drop it from the
  technical accordion too, that's a separate task.

## 1. Task Summary

`ApprovalDetailScreen` (`src/prototype/screens/ApprovalDetailScreen.tsx`)
currently renders the supervisor's decision card (`ReviewCard`) with
four content sections: *Why approval is needed*, *What you should
check*, *What happens if you approve*, *What happens if you reject*.
Below the decision card, a separate `PriorActivitySection` lists what
the agent did so far ("Loaded 12 records", "Policy check — needs
approval", etc.).

The two top sections are being removed: the first because the
"approve/reject consequence" sections already cover the same purpose
from a different angle; the second because the underlying `evidence_ref`
data is largely fabricated and won't exist in the real backend in the
same shape.

In their place, the prior-activity list is moved *into* `ReviewCard` so
the supervisor's eye lands on what the agent actually did before being
asked to make a decision. The standalone section below is removed to
avoid duplication. For already-resolved approvals (where `ReviewCard`
is not rendered), the prior-activity list is shown as its own card
below `ResolvedCard` so the audit trail stays visible.

## 2. Current Repository State

- Branch: `shuklin/ux-redesign`. Working tree clean per gitStatus.
- The previous redesign plan
  (`docs/agent-plans/2026-04-30-1645-approval-detail-redesign.md`) is
  fully implemented; this plan builds directly on top of that one.
- File touched: `src/prototype/screens/ApprovalDetailScreen.tsx` only.
  No CSS change expected — we reuse `.card`, `Section`, and `StepLine`.
- No backend change. No new API call. No new fixture.
- Tour selectors currently on the screen:
  - `approval-action` — wraps the `PageHeader`. Untouched.
  - `approval-decision` — wraps `ReviewCard`. Untouched.
  - `approval-evidence` — currently wraps the standalone
    `PriorActivitySection`. **Moves** with the content into
    `ReviewCard`'s new prior-activity block.

## 3. Relevant Files Inspected

- `src/prototype/screens/ApprovalDetailScreen.tsx` — read end-to-end.
  Affected sub-components: `ReviewCard` (delete 2 sections, add 1),
  `PriorActivitySection` (refactor / split), `ResolvedCard` (no change
  itself, but a new sibling block is added below it on the page).
- `src/prototype/tours/approval-review-tour.tsx` — must verify
  `approval-evidence` selector still resolves on a pending approval.
- `docs/ux-spec.md` § 5 (control & approvals), § 8 (vocab — no
  "validation", no "policy" exposed, "What the agent did so far" is
  acceptable user-facing copy already in use).
- `docs/backend-gaps.md` — `evidence_ref` is not flagged as a gap
  because the field exists in the spec, but its content shape is
  fixture-driven. Removing it from the visible UI is consistent with
  the gap-doc's "don't promise what backend doesn't deliver" stance.
- `CLAUDE.md` — Agent Working Agreement, one-step-at-a-time rule.

## 4. Assumptions And Uncertainties

### Assumptions

- The user accepts that removing `policyReason` from the visible UI
  loses the *specific* reason (e.g. "Amount $4,200 exceeds your $1,000
  daily limit"), and that "this kind of action requires approval" is no
  longer shown as a fallback either. This was discussed and confirmed:
  the consequence sections cover the user need.
- `evidence_ref` removal from `ReviewCard` is fine even when the field
  carries genuinely useful data (amount, recipient). The supervisor
  will rely on the agent-step list and the chat / agent-page links
  instead. If a real backend later returns trustworthy structured
  evidence, we re-evaluate then.
- The prior-activity block inside `ReviewCard` should use the same
  visual language as the existing sibling sections — render via
  `<Section title="What the agent did so far">` to match "What happens
  if you approve" / "What happens if you reject".
- For `ResolvedCard`, the prior-activity block sits as a *separate
  sibling card* below it (not nested inside `ResolvedCard`'s flex
  composition), to keep `ResolvedCard` compact and re-usable.

### Uncertainties to verify in Step 1

- **`approval-evidence` tour selector destination.** When `ReviewCard`
  is the host, the selector should wrap the new prior-activity Section
  inside the card. Confirm the tour copy still makes sense (the tour
  step references "what the agent did so far" — checked, still
  accurate).
- **Empty prior-activity case.** Today, `PriorActivitySection` early-
  returns when `leadingSteps.length === 0`. After the move, what should
  `ReviewCard` do in that case? Proposal: simply omit the section
  inside the card. `ReviewCard` then shows only the two consequence
  sections + buttons. Same logic for `ResolvedCard`'s sibling card —
  don't render the empty card at all.

## 5. Proposed Approach

Single file edit, ordered into self-contained steps:

1. **Extract `AgentStepsList`** — a pure presentational component that
   takes `run: RunDetail | null` and renders the styled list of
   `StepLine`s (or null if there are no leading steps). This becomes
   the shared building block used in two contexts.
2. **Refactor `PriorActivitySection`** to become a *card wrapper*
   around `AgentStepsList` with the heading "What the agent did so
   far" and the step counter. It is no longer rendered at the page
   level for `pending` approvals, only for `resolved` ones. Same
   early-return behaviour.
3. **`ReviewCard` body surgery:**
   - Delete the `policyReason` `useMemo` and its consumer Section.
   - Delete the `evidenceEntries` derivation and its consumer Section.
   - Add a new `<Section title="What the agent did so far">` at the
     top of the body (before "What happens if you approve"). Inside,
     render `<AgentStepsList run={run} />`. If null, omit the Section
     header too (no empty heading).
   - Move the `data-tour="approval-evidence"` attribute onto the
     `<Section>` wrapper (or its inner `<Box>`). The tour can find it
     in its current host card.
4. **Page composition (`ApprovalDetailScreen` return JSX):**
   - Remove the standalone `<div data-tour="approval-evidence">
     <PriorActivitySection /></div>` block.
   - For resolved approvals, render `<PriorActivitySection
     run={runContext} />` immediately below `<ResolvedCard />`.
5. **Cleanup:** drop unused imports (`Code` may still be needed for
   `FactValue` / TechnicalDetails — check before deleting; `humanKey`
   was only used by the deleted "What you should check" section, so
   it is removable from the imports if not used elsewhere on the
   screen).
6. **Tour + lint + build pass.**

No new dependencies. No new types. No new fixtures.

## 6. Risks And Trade-offs

| Risk | Mitigation |
|---|---|
| Losing `policyReason` removes the only user-visible explanation of *why* this specific action triggered approval. | Accepted: consequence sections + agent-step list provide enough context. The technical accordion still exposes the action key for power users. |
| Losing `evidence_ref` removes structured action parameters (amount, recipient) from the decision card. | Accepted: data is fixture-fabricated; the agent-step list often surfaces the same information through `stepDetail` (e.g. "Result: $4200"). Raw evidence remains in the technical accordion. |
| `data-tour="approval-evidence"` selector is now nested inside `ReviewCard` (which is itself inside `data-tour="approval-decision"`). | The tour engine uses `querySelector`, which returns the first match regardless of nesting. Verified by re-reading `TourOverlay.tsx` semantics. |
| `ReviewCard` becomes less informative for low-context supervisors who relied on the policy reason to know what to check. | Accepted by user. The agent-step list — especially the validation step's `stepDetail` — usually surfaces the underlying reason in plain language. |
| Resolved approvals now render two cards in a row (`ResolvedCard` + prior-activity card) where they used to be one card + one card. | Same total count as before — just relocated. No layout regression expected. |
| Empty prior-activity for a brand-new run (no steps yet) leaves `ReviewCard` looking thinner. | Acceptable; the two consequence sections + buttons are still substantial. |

## 7. Step-by-step Implementation Plan

Each step ends with a **stop and report**, per CLAUDE.md.

### Step 1 — Verify state and confirm approach

1. Re-read `ApprovalDetailScreen.tsx` — confirm `policyReason` is only
   used in the one Section being deleted; confirm `evidenceEntries`
   and `humanKey` likewise.
2. Confirm `Code` import is still used outside the deleted section
   (yes — `FactValue` and `TechnicalDetailsAccordion` use it).
3. Re-read `tours/approval-review-tour.tsx` — confirm the
   `approval-evidence` step copy still applies after the relocation.
4. Open the prototype, navigate to a pending approval, confirm the
   current visual (4 sections in `ReviewCard`, separate card below).

**Report:** confirm or correct each assumption in § 4 before any edit.

### Step 2 — Extract `AgentStepsList` and refactor `PriorActivitySection`

- New presentational component `AgentStepsList({ run })`:
  - Same `useMemo` for `leadingSteps` (filter `tool_call`, `validation`,
    `llm_call`).
  - Returns `null` when empty.
  - Returns the `<Flex direction="column" gap="2">` with `<StepLine />`s
    and the "N steps" counter row. (The counter row currently lives in
    `PriorActivitySection`. Decision: keep the counter in
    `PriorActivitySection` since it is part of the *card framing*, and
    keep `AgentStepsList` purely the list. This way `ReviewCard` can
    show its own header via `<Section>` without a duplicate counter.)
- Refactor `PriorActivitySection({ run })`:
  - Same outer `<Box mt="5"><div className="card">…</div></Box>`.
  - Header row: title "What the agent did so far" + step counter.
  - Body: `<AgentStepsList run={run} />`.
  - Early-return null when `leadingSteps.length === 0` (compute via
    `AgentStepsList`'s logic, or just check `run?.steps`). Keep one
    source of truth for the empty check by exporting a tiny
    `hasLeadingSteps(run)` helper or by letting `PriorActivitySection`
    early-return based on the same filter.

No visible change yet (still rendered in the same place).
Lint + build clean.

### Step 3 — Edit `ReviewCard`: delete two sections, add one

- Delete the `policyReason` `useMemo`.
- Delete the `evidenceEntries` derivation.
- Delete `<Section title="Why approval is needed">…</Section>`.
- Delete the conditional `<Section title="What you should check">…</Section>`.
- Add at the top of `card__body`, before "What happens if you approve":
  ```tsx
  <Section title="What the agent did so far" data-tour="approval-evidence">
    <AgentStepsList run={run} />
  </Section>
  ```
  The `Section` component currently doesn't forward arbitrary props.
  Adjust `Section` to accept and forward a `data-tour` attribute (or
  wrap with a `<div data-tour>` if `Section` is shared and we don't
  want to widen its prop surface — decide in implementation).
  - When `AgentStepsList` returns null (no steps), conditionally omit
    the entire Section so we don't show an empty heading.

**Verify:** ReviewCard now shows: Quick approve · "What the agent did
so far" (when there are steps) · "What happens if you approve" · "What
happens if you reject" · footer buttons.

### Step 4 — Page composition: remove standalone block, add resolved sibling

- Delete the page-level
  `<div data-tour="approval-evidence"><PriorActivitySection /></div>`
  block.
- Inside the `approval.status !== 'pending' && !conflict` branch,
  render `<PriorActivitySection run={runContext} />` immediately after
  `<ResolvedCard />`. (Two siblings, not nested.)

**Verify:**
- Pending approval: prior activity is *inside* `ReviewCard`, no
  duplicate card below.
- Resolved approval: `ResolvedCard` + prior-activity card stacked.

### Step 5 — Cleanup imports

- Remove `humanKey` from the `lib/format` import line if no other
  usage on this screen (grep the file).
- Keep `Code` (still used by `FactValue` + `TechnicalDetailsAccordion`).
- Keep `Box`, `Flex`, `Text` (used widely).

### Step 6 — Tour + lint + build pass

- `npm run lint`.
- `npm run build`.
- From `/learn`, start the "Approval review" tour. Step pointing at
  `approval-evidence` should now spotlight the in-card section.

## 8. Verification Checklist

- [ ] **Pending approval:** `ReviewCard` body contains exactly three
      sections — *What the agent did so far* (when non-empty), *What
      happens if you approve*, *What happens if you reject*.
- [ ] **No "Why approval is needed" anywhere on the page.**
- [ ] **No "What you should check" anywhere on the page.**
- [ ] **No standalone prior-activity card below `ReviewCard`** for
      pending approvals.
- [ ] **Resolved approval:** `ResolvedCard` followed by a
      prior-activity card.
- [ ] Quick approve, big Approve, big Reject buttons all still work.
- [ ] Two-step Approve / Reject flows unchanged (reason field still
      required for reject ≥4 chars).
- [ ] `already_resolved` race still handled.
- [ ] `evidence_ref` is still visible inside `TechnicalDetailsAccordion`
      → "Raw evidence" (intentional — power-user escape hatch).
- [ ] `data-tour` attributes resolve: `approval-action`,
      `approval-decision`, `approval-evidence`.
- [ ] `npm run lint` clean. `npm run build` clean.
- [ ] No new vocab violations.

## 9. Browser Testing Instructions For The User

After Step 4 lands, open the prototype:

1. Log in as `frontend@int3grate.ai` (any password).
2. **Approvals → pick a pending request** (sidebar: Approvals).
3. **Inside the white decision card:**
   - At the top right: **Quick approve** ghost button.
   - Below it, the first section is now **"What the agent did so far"**
     listing 1–N step rows with status pills. (If a request has no
     prior steps, this section is omitted — should be rare.)
   - Then **"What happens if you approve"** (green play icon row) and
     **"What happens if you reject"** (red stop icon row).
   - Then the big green **Approve action** + soft red **Reject action**
     buttons.
4. **What you should NOT see** anywhere on this page:
   - No "Why approval is needed".
   - No "What you should check".
   - No separate prior-activity card *below* the decision card.
5. **Open an already-approved (or rejected) request** from the
   approvals list:
   - The compact `Resolved` card at the top (green check / red cross +
     status label + approver name + reason if any).
   - **Below it**, a separate card titled **"What the agent did so far"**
     with the step list. (This is new — previously this card lived
     here for pending too.)
6. **Two-step Approve still works.** Click the big green Approve
   action button on a pending request → reason card appears → submit
   with or without reason → resolves.
7. **Reject still requires a reason.** Click big Reject action →
   reason card appears → empty submit shows "At least 4 characters"
   → enter reason → submit resolves.
8. **Tour still works.** From `/learn`, start "Approval review". The
   step that highlights the agent's prior activity should now
   spotlight the section *inside* the white decision card, not a
   separate card below.
9. **Technical details accordion** at the bottom of the page still
   opens and still contains "Raw evidence" JSON. (We deliberately
   left it there as a power-user escape hatch.)

## 10. Progress Log

- 2026-05-01 15:30 — plan drafted, awaiting user sign-off before Step 1.
- 2026-05-01 — Step 1 done. All four assumptions in § 4 confirmed.
  Extra finding: `FactValue` is only consumed by the deleted "What you
  should check" section, so it must be removed in Step 5 alongside the
  `humanKey` import (otherwise `noUnusedLocals` breaks the build).
- 2026-05-01 — Step 2 done. Added `getLeadingSteps(run)` shared helper
  and pure presentational `AgentStepsList`. `PriorActivitySection` now
  delegates the list rendering to `AgentStepsList`. No visible change
  yet — page still renders the standalone card below `ReviewCard`.
- 2026-05-01 — Step 3 done. `ReviewCard` body now contains: agent
  steps section (when non-empty, wrapped in `data-tour="approval-evidence"`)
  → "What happens if you approve" → "What happens if you reject".
  Deleted: `policyReason` memo, `evidenceEntries` derivation, both
  Sections that consumed them. Updated the file comment for
  `ReviewCard` to match. Standalone `PriorActivitySection` still
  rendered below for *all* statuses — that gets rebalanced in Step 4.
- 2026-05-01 — Step 4 done. Removed the page-level
  `<div data-tour="approval-evidence"><PriorActivitySection /></div>`
  block. For non-pending approvals, `<PriorActivitySection />` now
  renders as a sibling immediately after `<ResolvedCard />`. For
  pending approvals, the steps live only inside `ReviewCard`; no
  duplicate card below. `data-tour="approval-evidence"` exists only
  inside `ReviewCard` now — fine since the tour walks pending
  approvals (training scenario).
- 2026-05-01 — Step 5 done. Removed `humanKey` from `lib/format` import.
  Removed `FactValue` helper function (orphaned after the "What you
  should check" section was deleted). Verified all remaining imports
  are still consumed. `Code` remains — used by `DecisionConfirmCard`
  reason hint and `TechnicalDetailsAccordion` raw evidence.
- 2026-05-01 — Step 6 done. `npm run lint` clean (no errors / warnings).
  `npm run build` clean (`tsc -b` + `vite build` both succeed; bundle
  size warning is the pre-existing >500 kB chunk warning, not from
  this change). Tour walk-through left to user (browser-side) per the
  testing instructions in § 9.
