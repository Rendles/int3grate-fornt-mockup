# Tours audit fixes — copy refresh + 2 rebuilds

## 1. Task summary

Bring the 4 existing guided tours back in sync with current UI and `docs/ux-spec.md` § 8 vocabulary. Three tours need copy/structure tweaks; one (`configure-tool-grants`) needs a full rebuild because the underlying UX (scope selects, grants/policy split) was rewritten as a unified permissions table. Also rewire `start-a-chat` to teach the canonical Team → agent → Talk path instead of the legacy `/chats/new` form.

## 2. Current repository state

- 4 tour files: `sidebar-tour.tsx`, `approval-review-tour.tsx`, `start-a-chat-tour.tsx`, `configure-tool-grants-tour.tsx`. All registered in `registry.ts`.
- All `data-tour` selectors used by tours resolve in current DOM **except 3 in configure-tool-grants**: `grants-tool-cell`, `grants-scope-type`, `grants-policy` — corresponding UI elements don't exist in the new permissions-table layout.
- `CommandBar` component still exists but is **no longer used in `ApprovalDetailScreen`** — the approval-review tour references it in step "detail-action".
- `AgentsScreen.tsx` and `AgentDetailScreen.tsx` have **zero `data-tour` attributes**. To rewire start-a-chat and configure-tool-grants through the canonical path, we need to add ~3 selectors there.
- Training-mode fixtures already exist for `approval-review`, `start-a-chat`, and `configure-tool-grants` scenarios. Phase 4 may need fixture tweaks if the rebuild changes which agent the tour walks through.
- Anti-pattern words appearing in tour bodies: `run`, `orchestrator`, `model`, `version`, `grants list`, `human-in-the-loop`. Per `docs/ux-spec.md` § 8, none should be visible to Maria.

## 3. Relevant files inspected

- `src/prototype/tours/{sidebar,approval-review,start-a-chat,configure-tool-grants}-tour.tsx` — tour data
- `src/prototype/tours/registry.ts` — duration labels need updating after step counts change
- `src/prototype/tours/training-fixtures.ts` — scenario fixtures
- `src/prototype/components/shell.tsx` — sidebar nav keys (home, approvals, activity, **assistants**, apps, costs, settings)
- `src/prototype/components/grants-editor.tsx` — current permissions UI; existing `data-tour` props: `grants-catalog`, `grants-add`, `grants-mode`, `grants-save`
- `src/prototype/screens/AgentDetailScreen.tsx` — tabs (overview/talk/grants/activity/settings/advanced); Talk-to tab embeds chat
- `src/prototype/screens/AgentsScreen.tsx`, `ApprovalDetailScreen.tsx`, `ApprovalsScreen.tsx`, `ChatNewScreen.tsx`
- `docs/ux-spec.md` § 8 — vocabulary rules

## 4. Assumptions and uncertainties

- Sidebar tour expanding from 5 to 9 steps is acceptable (~2 min instead of ~1 min). Settings step is admin-only; tour audience is `'all'` so Settings step might fail-soft for member users — need to either gate the step or change audience to `'admin'`. Decision: keep audience `'all'` and accept that the Settings step shows a "couldn't find target" fallback for members. (Member tour use is rare; not worth the conditional complexity.)
- For start-a-chat rebuild: the canonical flow ends in the embedded chat panel inside agent detail. We won't tour the chat composer itself (out of scope) — the tour ends when the user lands on the Talk tab.
- For configure-tool-grants rebuild: the tour name visibly changes — proposing **"Set agent permissions"** to match current page UI ("Permissions" tab). Tour `id` stays `configure-tool-grants` to not break localStorage tour-completion records.
- The `chat-model` selector still exists in `ChatNewScreen.tsx`, but the start-a-chat tour stops using `/chats/new`, so all `chat-*` selectors there can stay (legacy form keeps working) — we just rewire the tour to a different path.
- Plan does not delete the old `/chats/new` legacy route or the `chat-*` selectors. Out of scope.

## 5. Proposed approach

Four sequential phases. Each ends at a verifiable checkpoint (lint + build + manual try-the-tour).

- **Phase 1**: Sidebar tour — expand to 9 steps.
- **Phase 2**: Approval-review tour — copy fixes for 3 step bodies.
- **Phase 3**: Start-a-chat tour — rewire to Team → agent → Talk; add 2-3 new `data-tour` attributes to screens.
- **Phase 4**: Configure-tool-grants tour — full rebuild; add 1-2 new `data-tour` attributes; update training-fixtures if needed; update tour name and registry duration label.

Each phase is independently shippable. Stop after each one, verify, then continue.

## 6. Risks and trade-offs

- **Adding `data-tour` attributes to many places**: low risk, attributes are inert. Only matters for the tour engine.
- **Tour-completion localStorage**: keyed by tour `id`. Since we keep all 4 ids, returning users won't see "completed" tours suddenly become uncompleted.
- **Sidebar tour Settings step for members**: tour is registered as `audience: 'all'`. Members will hit a broken step. Fallback message will show. Acceptable for MVP — admin demo accounts (Ada) is the primary user.
- **Rebuild risk for configure-tool-grants**: the new tour might still feel awkward without the conceptual structure (scope/mode/policy was actually informative). The unified permissions UI is simpler for users but offers fewer hooks for explanatory steps. Mitigation: lean on the existing PermissionSelect's options as the primary teaching moment.
- **Chat-tour landing**: the Talk-tab embedded chat may auto-open the most recent chat or show an empty state. The tour step needs to be robust to both. We'll point at the tab itself and/or the start-new-chat affordance, not at any specific in-chat element.

## 7. Step-by-step implementation plan

### Phase 1 — Sidebar tour expansion

Edit `src/prototype/tours/sidebar-tour.tsx`:

Insert 4 new steps in the right order:

1. brand (existing)
2. dashboard / nav-home (existing) — title "Your home"
3. **NEW** approvals — move `approvals` step here from current position 4. Already exists, just reorder.
4. **NEW** activity — `[data-tour="nav-activity"]`. Title "Activity". Body: "Live ribbon of what your agents did. Open it to see recent actions, sentence by sentence."
5. agents/Team (existing) — title "Team"
6. **NEW** apps — `[data-tour="nav-apps"]`. Title "Apps". Body: "Connected services your agents can access. Manage which apps each agent is permitted to use."
7. **NEW** costs — `[data-tour="nav-costs"]`. Title "Costs". Body: "What your agents are spending. See the trend, top spenders, and break it down by agent."
8. **NEW** settings — `[data-tour="nav-settings"]`. Title "Settings". Body: "Workspace details, team members, history log. Admin-only — members won't see this."
9. footer (existing)

Update `registry.ts` duration label: `'~1 min · 5 steps'` → `'~2 min · 9 steps'`.

**Verify:** dev server, log in as Ada, start sidebar tour from /learn, walk through all 9 steps, no broken targets.

### Phase 2 — Approval-review copy fixes

Edit `src/prototype/tours/approval-review-tour.tsx`:

- Step **detail-action** body: replace
  > "The title summarises the action — friendly tool label plus amounts and reference IDs. The CommandBar below adds run, task, approver role, and expiry context."
  with
  > "The title summarises what the agent wants to do — the friendly action name plus amounts and reference IDs."

- Step **detail-evidence** body: replace
  > "Read this first. The agent attaches the run summary, customer / charge metadata, and policy verdicts that triggered the gate. Decide based on this."
  with
  > "Read this first. The agent attaches a short summary, customer / charge metadata, and the policy reason that triggered the request. Decide based on this."

- Step **detail-decision** body: replace
  > "Both decisions are queued and written to the audit trail. The orchestrator resumes the suspended run on accept or terminates it on reject. Reject requires a reason (≥ 4 characters); approve is optional."
  with
  > "Both decisions are written to the history log. On accept, the agent continues the action right away. On reject, the agent stops. Reject requires a reason (≥ 4 characters); approve is optional."

No selector changes. Step count stays at 6, registry duration label unchanged.

**Verify:** start tour, walk all 6 steps. None should mention `CommandBar`, `run`, `orchestrator`, `audit trail`.

### Phase 3 — Start-a-chat rewire

#### 3a. Add `data-tour` attributes to screens

In `src/prototype/screens/AgentsScreen.tsx`:
- Find the agent card/row rendering and add `data-tour="team-agent-card"` to the **first card** (or use a stable marker — easiest: add it to every card; the engine targets the first match).

In `src/prototype/screens/AgentDetailScreen.tsx`:
- Find `<Tabs items={tabs} ...>` and the Talk tab definition. Tabs primitive may not pass through `data-tour` per item — if not, add to the parent or wrap.
- Add `data-tour="agent-talk-cta"` on the "Talk to {name}" button (line 104-107).
- Add `data-tour="agent-talk-tab-content"` on the Talk-tab rendered area or a stable element inside `TalkToTab`.

#### 3b. Rewrite tour file

`src/prototype/tours/start-a-chat-tour.tsx` — fully replace content. New 5-step flow:

1. **team-page** — `[data-tour="nav-assistants"]` (sidebar Team) — `navigateTo: '/agents'`. Title "Find your team". Body: "Your agents live here. Pick one to start a conversation with."
2. **agent-card** — `[data-tour="team-agent-card"]`. Title "Pick an active agent". Body: "Active agents are ready to talk. Paused agents need to be unpaused first. Click the agent you want."
3. **agent-detail** — `[data-tour="agent-talk-cta"]` — `navigateTo: '/agents/{seededAgentId}'`. Title "Open the conversation". Body: "Tap Talk to start a new chat with this agent — the conversation lives inside the agent's detail page."
4. **talk-tab-content** — `[data-tour="agent-talk-tab-content"]` — `navigateTo: '/agents/{seededAgentId}/talk'`. Title "Your chat opens here". Body: "Past conversations show on the side. Open one to continue, or start a new chat any time."
5. **wrap-up** — re-target the first chat composer or just the tab area. Title "You're set". Body: "Type your question and the agent will reply. The conversation is private to you and the agent."

May need 5 steps or could be 4 — let's design 5 then trim if redundant. `seededAgentId` comes from `START_CHAT_ACTIVE_AGENT_ID` in `training-fixtures.ts`.

#### 3c. Update registry

Duration label: `'~2 min · 5 steps'` → likely unchanged.

**Verify:** start tour from /learn under Training mode. Walk all 5 steps. Should never visit `/chats/new`.

### Phase 4 — Configure-tool-grants rebuild

#### 4a. Tour metadata

- Tour `id` stays `'configure-tool-grants'` (preserve completion records).
- Tour `name` change: `'Configure tool grants'` → `'Set agent permissions'`.
- Registry description update to match new copy and new step count.
- Registry `durationLabel` update — likely `'~2 min · 6 steps'`.

#### 4b. Add minimal new `data-tour` attributes

In `src/prototype/components/grants-editor.tsx`:
- Add `data-tour="grants-summary"` to the Caption row (line ~229) showing "N permissions · N require approval".
- Add `data-tour="grants-write-warning"` to the warning banner (line ~304) for write-without-approval — conditional render is OK; tour will gracefully skip if absent.

In `src/prototype/screens/AgentDetailScreen.tsx`:
- Add `data-tour="agent-tab-grants"` on the Permissions tab trigger if Tabs primitive supports per-item attrs; otherwise wrap.

Existing usable selectors: `grants-catalog`, `grants-add`, `grants-mode`, `grants-save`.

#### 4c. Rewrite tour file

Replace content of `src/prototype/tours/configure-tool-grants-tour.tsx` with new 6-step tour:

1. **open-permissions** — `[data-tour="agent-tab-grants"]` — `navigateTo: '/agents/{seededAgentId}/grants'`. Title "Where you set what an agent can do". Body: "Each agent has its own list of permissions — which apps and actions it can use. Open the Permissions tab to manage them."
2. **summary** — `[data-tour="grants-summary"]`. Title "What's already permitted". Body: "This row shows how many permissions are set and how many require approval before the agent can act."
3. **mode** — `[data-tour="grants-mode"]`. Title "Pick the access level". Body: "Read-only is safest. Read & write lets the agent change things. Read & write (with approval) makes the agent ask before each action."
4. **catalog** — `[data-tour="grants-catalog"]`. Title "Add a new permission". Body: "Pick an app from the catalog. Already-permitted apps are hidden so you don't add duplicates."
5. **add** — `[data-tour="grants-add"]`. Title "Confirm". Body: "This adds the permission to the list. It's not saved yet — you can change the access level before saving."
6. **save** — `[data-tour="grants-save"]`. Title "Save". Body: "This replaces the agent's full permission set. After saving, the agent uses the new permissions on its next action."

Optional 7th step (conditional render OK to fail-soft):
7. **write-warning** — `[data-tour="grants-write-warning"]`. Title "Heads up: write without approval". Body: "If any permission is set to Read & write without approval, the agent can change things on its own. Switch to Read & write (with approval) if you want a human to confirm every write."

Decision: include the 7th conditional step. Tour engine fallback handles absence gracefully.

#### 4d. Training fixtures

Verify `CONFIGURE_TOOL_GRANTS` scenario in `training-fixtures.ts` seeds an agent with at least one existing permission (so step "summary" has a non-empty count) and at least one `write_auto`-style permission (so step 7 conditional has the warning to point at). If not, adjust the scenario fixture.

**Verify:** tour walks 6-7 steps without broken targets, copy uses spec-blessed terms ("permissions", "access level", no "grants/scope/policy/human-in-the-loop").

### Phase 5 — Final pass

- `npm run lint` — clean
- `npm run build` — clean
- Walk all 4 tours end-to-end in dev server under Training mode (where applicable). No broken targets, no stale copy.

## 8. Verification checklist

- [ ] Phase 1: sidebar tour walks 9 steps, all targets resolve
- [ ] Phase 1: registry duration label updated
- [ ] Phase 2: approval-review tour has no `CommandBar`, `run`, `orchestrator`, `audit trail` mentions
- [ ] Phase 3: AgentsScreen + AgentDetailScreen have new `data-tour` attrs (~3 added)
- [ ] Phase 3: start-a-chat tour navigates Team → agent → Talk path; never hits `/chats/new`
- [ ] Phase 4: configure-tool-grants renamed to "Set agent permissions"; tour `id` unchanged
- [ ] Phase 4: 3 stale selectors (`grants-tool-cell`, `grants-scope-type`, `grants-policy`) gone from tour
- [ ] Phase 4: tour copy uses "permissions", not "grants/scope/policy"
- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] All 4 tours walked manually in dev — no broken target fallbacks

## 9. Browser testing instructions for the user

After each phase:
1. `npm run dev`, open `http://localhost:5173/#/`, log in as Ada.
2. Open `/learn`, find the relevant tour card, click Start.
3. Walk every step. Check: target spotlight is visible (not "couldn't find target" fallback), copy reads naturally, references match what you see on screen.
4. For tours requiring training mode (`approval-review`, `start-a-chat`, `configure-tool-grants`): the green training banner should appear at the top throughout. Closing the tour returns to real data.

After all 4 phases:
- Walk all 4 tours back-to-back from /learn.
- Spot-check no leftover anti-pattern words appear: search the rendered tour bodies for "run", "model", "scope_type", "grants list", "orchestrator", "CommandBar", "human-in-the-loop".

## 10. Progress log

- 2026-04-29 17:00: Audit completed — selector + copy issues catalogued in chat.
- 2026-04-29 17:00: User confirmed all 4 questions: copy fixes for 3 tours, full rebuild for configure-tool-grants, expand sidebar to 7 nav, rewire start-a-chat to canonical path.
- 2026-04-29 17:00: Plan file created.
