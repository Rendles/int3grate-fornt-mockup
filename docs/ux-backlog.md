# UX backlog — visible gaps in the prototype

Living document. Items found by inspection, sorted by impact on the target user (Maria, agent-curious owner). Not all items are decided — this is a discussion log.

**Status legend:**
- 🔍 — actively discussing
- ⏸ — noted, deferred
- ✅ — addressed
- 🚫 — explicitly out of scope

---

## Major gaps in core flows

### 1. Notifications 🔍
*How does Maria learn that a new approval is waiting when she's not in the app?*

Currently: badge count on the sidebar Approvals item. That's it. If Maria is in a Zoom meeting for an hour while an agent waits for approval, there is no surfacing mechanism.

Open questions: email vs in-app vs push vs Slack vs SMS; per-user vs per-tenant config; what events trigger (approvals only? stuck agents? weekly summary?); where it's configured in Settings.

Backend gap: `docs/backend-gaps.md` § 7 explicitly flags notifications as an open question. No endpoints, no fixtures, no UI placeholder.

### 2. First-time onboarding / aha moment ⏸
*What does Maria see on her first login with zero agents?*

Currently: `FreshWorkspace` CTA on Home, plus the Hire wizard. Spec § 7 calls this "the most important screen of the product" but is explicitly deferred. Real Zoho integration in the first 5 minutes is the spec ideal — backend doesn't support it, but we could mock harder than we do.

### 3. Mobile / responsive ⏸
*Can Maria approve an action from her phone between meetings?*

Likely: no. Instrument-panel aesthetic is desktop-first. Sidebar 7-items, dense tables, multi-column dashboards. Approve-on-the-go is a real Maria scenario; if mobile is broken, it's a sceanrio blocker, not a polish item.

---

## Mid-importance polish

### 4. Confirmation modals for destructive actions ⏸
*Fire agent, revoke app access, change permissions — single click or "are you sure"?*

The "fire an employee" metaphor implies friction. Need to audit which destructive paths are one-click vs gated.

### 5. Avatar photos instead of initials ⏸
*Spec § 9 wants realistic neutral portraits; currently 2-letter initials.*

Cheap visual upgrade with a strong effect on the "digital team" feeling. `[SA]` reads as NPC; a photo of "Sarah" reads as employee. Asset library is the heavy part.

### 6. Toasts / success feedback ⏸
*When Maria approves an approval, what does she see?*

Currently: probably just disappears from the list. Closing the loop with a "Approved · Sarah continued the task" toast would feel more responsive.

---

## Smaller wins

### 7. Global search in topbar ⏸
*With many agents/approvals/tasks, finding things by sidebar-only navigation gets painful.*

### 8. Agent personality preview in Hire wizard ⏸
*When Maria selects "Sales Agent", does she see a sample message? Example interaction?*

Reduces "what am I about to hire" anxiety.

---

## Out of this audit's scope (already on the books)

- Trust ladder — `docs/ux-spec.md` § 6, deferred by user decision.
- Per-agent daily/weekly briefing — `docs/ux-spec.md` § 4.1, deferred.
- Tour rebuild under new vocabulary — deferred (`docs/plans/tours.md`).
- Apps per-agent collapse — explicitly out (Apps stays top-level).
