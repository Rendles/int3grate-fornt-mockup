# Fix Connect/OAuth semantics in wizard + document architectural model

Status: **Done — all 5 steps implemented; lint + build clean.**

## Architectural revelation that drives this plan

User confirmed (2026-05-01) that the backend has **no per-tenant OAuth model and never will**:
- Int3grate maintains shared/centralised credentials for every supported integration
- Tenants get access to all integrations by default (variant **A**: full access)
- The only authorisation surface a user touches is `PUT /agents/{id}/grants` — agent-level permissions over already-available tools
- "Connect Gmail" in any UI is **semantically wrong** — there's nothing to connect; there are only permissions to allow or remove

This makes:
- `backend-gaps.md § 1.7` (Integration registry / OAuth flow) — **invalid gap** (not pending; out-of-scope by design)
- `backend-gaps.md § 2.3` (App connection status derived from grants) — **not an oversimplification but the correct model**
- `AgentNewScreen.tsx` wizard step 2 MockBadge — **factually wrong** (claims missing OAuth wiring; the underlying `setGrants` call is real and works)

The wizard step **already does the right thing in code** (`AgentNewScreen.tsx:143-148` — `api.setGrants` is real, applies template grants on hire). Only the labels and the badge are wrong.

## 1. Task summary

Two parallel cleanups:
1. **Documentation:** record the "no OAuth, shared credentials" model as a top-level architectural fact in `handoff-prep.md` and clean stale gap entries in `backend-gaps.md`.
2. **Wizard step 2:** rewrite copy from "Connect apps" semantics to "Allow access" semantics, remove the misleading `<MockBadge>`. No behavioural change — `setGrants` keeps doing the same thing.

## 2. Sign-off decisions

- **C-1 (terminology):** use **"Allow access"** as the step heading; toggle buttons read **"Allow"** / **"Remove"** (not "Connect / Disconnect"). Summary label in ReviewStep: **"Allowed apps"**. Warning banner: **"N apps not allowed yet"**. Internal state names (`connectedApps`, `setConnectedApps`, `phase === 'apps'`) — left alone, not user-visible.
- **C-2 (MockBadge removal):** remove the `<MockBadge>` from `AgentNewScreen.tsx:338` entirely. The wizard step is real working surface.
- **C-3 (no architectural copy in wizard):** do NOT explain "we manage credentials centrally" in the wizard copy. Keep it simple — "choose which apps {agent} can use". Architectural detail belongs in admin docs / sales materials, not in onboarding.
- **C-4 (handoff-prep doc):** add a new top-level section **"0. Architectural model"** at the very top, before `## 1. Ship-blockers`. Single source of truth that future sessions read first.
- **C-5 (backend-gaps doc):** delete § 1.7 entry, delete § 4.4 entry, rewrite § 2.3 entry. Update the priority table accordingly. Don't rewrite the whole doc — surgical edits.
- **C-6 (templates.ts comment):** trivial nit, fix the "user must connect" comment to "user can allow".

## 3. Files touched

- `docs/handoff-prep.md` — add § 0
- `docs/backend-gaps.md` — surgical: delete § 1.7, § 4.4; rewrite § 2.3; update priority table
- `src/prototype/screens/AgentNewScreen.tsx` — copy edits (heading, subtitle, AppsStep buttons, ReviewStep labels, warning banner, success message). Remove MockBadge. ~10 small edits in one file.
- `src/prototype/lib/templates.ts` — one-line comment fix (line 7)

## 4. Risks

| Risk | Mitigation |
|---|---|
| New copy ("Allow / Remove") feels less inviting than "Connect" — affects sales-demo "wow" factor. | If user feedback, iterate. The current "Connect" is honest neither to architecture nor to behaviour, so optics don't justify keeping it. |
| `<MockBadge>` removal makes us forget this surface during future audits. | The architectural § 0 in `handoff-prep.md` is the durable record. Audits should consult that doc first. |
| `connectedApps` variable name stays — internal cognitive dissonance for future devs. | Acceptable — internal name, not user-visible. CLAUDE.md says internal type/var names stay even when UI labels change. Rename in a separate cleanup pass if needed. |

## 5. Step-by-step plan

Stop-and-report after each step.

### Step 1 — Architectural § 0 in `handoff-prep.md`

Insert a new section between "## Назначение" and "## 1. Ship-blockers". Content:
- **Heading:** `## 0. Architectural model — read this first`
- Statement of the central fact: shared credentials, no per-tenant OAuth, all tools available to all tenants, only `setGrants` exposed to user
- Implications for UI design: no "Connect" / "Authorise" surfaces; only "Allow access" semantics
- Reference back to `backend-gaps.md` for the per-endpoint detail
- Date stamp + provenance ("confirmed by user 2026-05-01 in conversation")

### Step 2 — Surgical edits to `backend-gaps.md`

- Delete § 1.7 entirely; replace with one-line "removed 2026-05-01 — see handoff-prep § 0" stub OR remove without trace and note in the doc footer log
- Rewrite § 2.3 to say "this **is** the model, not a workaround"
- Delete § 4.4 (Connect new app placeholder — invalid concept; surface already hidden)
- Update the priority table: drop the 1.7 row
- Refresh the "Last updated" footer

### Step 3 — `AgentNewScreen.tsx` copy + MockBadge removal

In one editing pass:
- `:328` heading: "Connect apps." → "Allow access."
- `:336` subtitle: rewrite to "Choose which apps {agent} can use. You can change this on the agent's Permissions tab later."
- `:338` `<MockBadge>` — delete the whole `<MockBadge … />` element
- `:630` empty banner title: "No apps to connect for this template" → "No specific apps for this template"
- `:664` button label: "Disconnect" → "Remove"
- `:668` button label: "Connect" → "Allow"
- `:762` summary row label: "Connected apps" → "Allowed apps"
- `:794` warning banner title: "N apps not connected" → "N apps not allowed yet"
- `:795` warning body: rewrite from "won't be able to use … until you connect … from the Permissions tab" → "won't be able to use … until you allow {them} on the Permissions tab"
- `:416` success copy: "will start working with the apps you connected" → "will start working with the apps you allowed"

Verify imports are still correct (MockBadge import may become unused → drop from imports).

### Step 4 — `templates.ts` comment

- `:7` change "apps the user must connect in step 2" → "apps the user can allow for the agent in step 2"

### Step 5 — Lint + build + verify

- `npm run lint`
- `npm run build`
- Walk wizard manually (or describe browser test) — ensure copy reads coherent, no orphan "Connect" text remains.

## 6. Verification checklist

- [ ] `handoff-prep.md` opens with § 0 documenting the architectural model
- [ ] `backend-gaps.md` no longer contains § 1.7, § 4.4
- [ ] `backend-gaps.md` § 2.3 rewritten to describe the canonical model
- [ ] No `<MockBadge>` on wizard step 2
- [ ] No "Connect" / "Disconnect" text on wizard step 2 or in ReviewStep summary
- [ ] Success message uses "allowed apps", not "connected apps"
- [ ] `templates.ts:7` comment fixed
- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] Bundle size within ~10 kB of previous (no new dependencies)

## 7. Browser test

After Step 3 lands, log in, click `Hire an agent`:
1. Pick any template (e.g. Sales agent). Click `Set up`.
2. Continue to step 2 — heading reads **"Allow access."** No mock badge.
3. Subtitle: **"Choose which apps Sales agent can use. You can change this on the agent's Permissions tab later."**
4. Each app card has **"Allow"** button (or **"Remove"** if already toggled). Per-permission badges (Read only / Read & write …) unchanged.
5. Toggle one or two apps on. Continue to step 3.
6. Review screen → summary row reads **"Allowed apps"**. If you skipped any, banner reads **"N apps not allowed yet"** with body referencing the Permissions tab.
7. Hire. Success screen says **"… will start working with the apps you allowed."**
8. Open the new agent's Permissions tab — only the apps you allowed are present.

## 8. Progress log

- 2026-05-01 20:30 — plan drafted; awaiting confirmation before Step 1.
- 2026-05-01 — Step 1 done. Added § 0 «Architectural model — read this first» to `handoff-prep.md` (between Назначение section and § 1 Ship-blockers). Documents the central fact: shared credentials, no per-tenant OAuth, all integrations available to all tenants by default, only `setGrants` is the user-touchable auth surface. Lists implications for UI design and backend planning. Cross-links to `backend-gaps.md`. Marked as "корневой факт" so future sessions read it before re-introducing OAuth-style copy.
- 2026-05-01 — Step 2 done. Surgical edits to `backend-gaps.md`:
  - § 1.7 (Integration registry / OAuth flow) — replaced with REMOVED-stub explaining it's architecturally out-of-scope
  - § 2.3 (App connection status) — rewritten as the canonical model, not a workaround; added caveat that "Connected" copy can mislead and should be reworded if Apps page is ever restored
  - § 4.4 (Connect new app modal) — replaced with REMOVED-stub
  - Priority table — row 1.7 struck through, marked removed
  - Footer — `Last updated: 2026-05-01` with description of changes
- 2026-05-01 — Step 3 done. 9 copy edits in `AgentNewScreen.tsx`:
  - Step heading: `Connect apps` → `Allow access`
  - Step subtitle: rewritten + structurally simplified (removed `<Flex>` wrapper that only existed to host the badge; subtitle now uses the same single-`<Text>` ternary as the other two phases)
  - `<MockBadge>` removed entirely + dropped from imports
  - Empty banner title: `No apps to connect for this template` → `No specific apps for this template`
  - AppsStep buttons: `Connect`/`Disconnect` → `Allow`/`Remove`
  - ReviewStep summary label: `Connected apps` → `Allowed apps`
  - ReviewStep warning title: `N apps not connected` → `N apps not allowed yet`
  - ReviewStep warning body + Success message: rewritten to use "allow"/"allowed" semantics
- 2026-05-01 — Step 4 done. Internal comment in `templates.ts:7-8` updated from "apps the user must connect in step 2" to "apps the user can allow for the agent in step 2".
- 2026-05-01 — Step 5 done. `npm run lint` clean. `npm run build` clean. Bundle 968.65 kB (was 968.97 kB — basically unchanged; this was a copy/semantics rewrite, not a feature removal). No regressions; all 5 steps verified.
- Internal-only stayed as-is per CLAUDE.md vocab rules: `connectedApps` state, `phase === 'apps'` enum key, `requiredAppPrefixes` variable name. Renames are a separate refactor pass if desired.
