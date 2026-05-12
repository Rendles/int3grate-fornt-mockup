# Hero-loop scripted scene — embed for landing page

> Plan owner: Claude
> Created: 2026-05-12 21:48 local
> Status: **complete — Phases 1-5 all shipped 2026-05-13**

## 1. Task summary

Build a self-contained, looping, scripted "scene" of the int3grate.AI UI that can sit inside the marketing landing-page hero. The scene plays automatically: a synthetic cursor moves across a miniature stage, "clicks" elements, and the UI responds — agent tile pulses → approval card slides in → Approve clicked → success state → next request arrives → loop.

Goal of this iteration: **build the scene inside the prototype repo first, mount it on a sandbox route so we can review it in the browser at design size.** Landing-handoff happens only after we approve the look.

Three product pillars (per `docs/landing-handoff.md` § 4) must all land in one ~9-second loop:
1. Team metaphor — named agents with statuses
2. Approval gate — every action waits for human OK
3. Real work in 5 minutes — concrete dollar amount + concrete action, on real-looking data

## 2. Current repository state

- `master` branch, lots of unstaged work-in-progress edits (vocabulary/brand-colour pass — unrelated to this plan).
- Sandbox pattern is already established: `/sandbox/team-bridge`, `/sandbox/team-map` mount inside `AppShell`, surfaced in sidebar with muted "preview" badge.
- Tour engine exists (`src/prototype/tours/`) with overlay + spotlight + scripted steps — feature-complete but **deferred for rebuild**, can't be reused for an autoplay loop without significant rework. Build fresh component instead.
- All status colours migrated to brand palette: `violet` (accent), `cyan` (info), `orange` (warn), `jade` (success), `red` (danger). `amber/green/indigo/blue` are forbidden.
- `prefers-reduced-motion` handling exists across multiple animations — established pattern: drop transitions but keep state changes.
- The landing page itself lives in `preview (8).html` (single-file demo with an "Agentic Organisation Map" hero). The current hero **conflicts with `docs/ux-spec.md` § 8** (uses banned vocab "workflow", "DAG-like", "reporting lines"). That's a separate fix — flagged but not in scope of this plan.

## 3. Relevant files inspected

- `src/prototype/index.tsx` — flat route list, hash router, sandbox routes 158–159.
- `src/prototype/components/approval-card.tsx` — real ApprovalCard wired to props + state. Reference for visual structure (avatar, "wants to" caption, action verb body, View/✓/✕ footer).
- `src/prototype/screens/sandbox/TeamBridgeScreen.tsx` — `AgentTile` shape: 44px avatar, status-accent band, pulsing dot, "Working / Waiting on you / Got stuck / Idle" taxonomy with brand-colour mapping. Reference for status pill semantics.
- `src/prototype/lib/fixtures.ts` — canonical named entities:
  - Agents: `Lead Qualifier`, `Refund Resolver`, `Access Provisioner`
  - Approvals: `stripe.refund · $412 on charge ch_3P8fL2 (order #44021)`, `email.send batch × 8 · personalised outreach to high-fit leads`
- `src/prototype/prototype.css` — `.card`, `.card--hover`, `.card--flush` exist with brand surfaces; `@keyframes proto-pulse` exists; `prefers-reduced-motion` blocks are present.

## 4. Assumptions and uncertainties

**Assumptions:**
- Stage size: **500×600 portrait** (matches the existing placeholder on the landing). Tolerance ±10% but stays portrait — composition is designed around vertical headroom.
- Implication for layout: 3 tiles in one compact row at top (~155×80 each), approval card slides into the lower ~360 px slot below. Plenty of breathing room below tile row before the card arrives.
- The scene should NOT load the full `AppShell` (sidebar, topbar, breadcrumbs) — it's a stage, not a page. Sandbox route just hosts it in `AppShell` for review convenience; the **component itself takes no `AppShell` dependency**, so handoff to landing is a clean copy-paste of one folder.
- We hardcode mini-fixtures inside the component, not import from `lib/fixtures.ts`. Reason: the scene must be portable; pulling the full fixtures graph drags in the whole prototype.
- Autoplay loop. No interaction needed — user can't click on the scene. (If we later want hover-pauses, that's a v2 enhancement.)
- Cursor is a small synthetic SVG element animated via `transform: translate3d()`. No real `pointer-events`.
- Reduced motion: scene still progresses through phases (state changes), but `transition-duration: 0` everywhere — cursor teleports instead of glides.

**Uncertainties to verify before/during build:**
- Whether the hero on the actual landing is light or dark. `docs/landing-handoff.md` § 8 recommends dark. I'll build dark-first; light is a CSS variable flip.
- Whether the scene needs to be exactly 16:9 or flexible. I'll make it flexible (intrinsic min-width ~640px, max ~1080px, height driven by aspect-ratio).
- Whether the cursor should be a Mac arrow, a generic dot, or a hand. I'll start with the generic Mac arrow SVG — most universal.
- Exact loop length. Targeting 9–10 s; will tune in the browser. **First number to react to is "does it feel rushed or sluggish at first watch?"** — ask the user after step 1.

## 5. Proposed approach

### 5.1. Architecture

One self-contained component tree under `src/prototype/components/hero-loop/`:

```
hero-loop/
  HeroLoop.tsx          — top-level, owns phase state machine
  HeroLoop.css          — scene-scoped (.hero-loop class root)
  scene-data.ts         — hardcoded mini-fixtures (3 agents, 2 approvals)
  parts/
    StageFrame.tsx      — outer frame, header strip, "live demo" badge
    AgentTile.tsx       — single tile (clone of TeamBridge tile, simplified)
    ApprovalCard.tsx    — clone of components/approval-card.tsx, no router/state deps
    SuccessCard.tsx     — post-approve state
    Cursor.tsx          — synthetic cursor, position via props
    PulseDot.tsx        — orange/cyan/jade pulsing status dot
  index.ts              — barrel export
```

Zero imports from `src/prototype/lib/*` or `src/prototype/components/common/*`. The scene must compile if you move the whole `hero-loop/` folder into another project — only deps are React + Radix Themes tokens (and we can inline the Radix CSS variables we need into `HeroLoop.css` for the eventual handoff).

### 5.2. State machine

Phase index `0..N`. `useEffect` schedules a `setTimeout` per phase using a per-phase `duration` ms. On the final phase, reset to 0 → loop. Single source of truth, no library.

Driving table (~9.4 s loop):

| # | t (s) | Phase name        | Stage shows                                                                                    | Cursor at         |
|---|-------|-------------------|------------------------------------------------------------------------------------------------|-------------------|
| 0 | 0.0   | `idle`            | 3 agent tiles. Refund Resolver has pulsing orange dot + "Waiting on you".                      | rest (top-right)  |
| 1 | 1.2   | `cursor-to-tile`  | Same. Cursor glides to Refund Resolver's tile.                                                 | over tile         |
| 2 | 2.4   | `tile-click`      | Tile depresses 1 px, ripple from cursor.                                                       | on tile           |
| 3 | 2.6   | `approval-enter`  | Approval card slides up from bottom, covering tile row. Tiles dim.                             | follows card edge |
| 4 | 4.0   | `cursor-to-approve` | Card fully visible. Cursor glides from card edge to **Approve** button.                      | over Approve      |
| 5 | 5.4   | `approve-click`   | Button depresses, jade ripple.                                                                 | on Approve        |
| 6 | 5.6   | `success`         | Card body cross-fades to jade success state: "✓ Refund issued · just now". Approver name pill. | rest              |
| 7 | 7.0   | `next-incoming`   | Below success card, a thin orange notification slides up: "Lead Qualifier wants to email 8 leads". | rest          |
| 8 | 8.4   | `outro`           | Whole stage fades out (200 ms).                                                                | rest              |
| 9 | 8.6+  | (loop reset)      | Snap back to phase 0, fade in.                                                                 | rest              |

Cursor positions are computed in CSS — each tile/button has a `data-target="…"` attribute, the cursor's position is set per-phase via a lookup. `transition: transform 1.2s cubic-bezier(.4,.0,.2,1)` on the cursor element handles the glide.

### 5.3. Visual fidelity

- Same `.card` border-radius (16 px), same surface token (`--color-panel-solid`), same Inter font, same letter-spacing as the real app. Inline the variables so it's portable.
- Status dots use real Radix step 9 (`--orange-9`, `--jade-9`, `--cyan-9`) — pulse via opacity, not size, to stay calm.
- Approval card "Approve" button uses jade (success), not violet — matches real product behaviour.
- All copy uses canonical vocabulary (`docs/ux-spec.md` § 8). No "workflow", "execution", "trace". `wants to`, `Approve`, `Refund issued`.

### 5.4. Mount points

1. **Review-internal:** new sandbox route `/sandbox/hero-loop` rendering `<HeroLoop />` inside `AppShell` with a `PageHeader` explaining what it is + a `MockBadge kind="design"`. Sidebar entry **not added** — direct URL only. (Sandbox is already crowded.)
2. **Landing handoff (later):** copy `src/prototype/components/hero-loop/` into the landing repo. One folder, no transitive deps.

## 6. Risks and trade-offs

| Risk | Mitigation |
|------|------------|
| Loop feels repetitive / annoying after watching twice | Keep total under 10 s. Outro fade gives a "breath" between cycles. Easy to A/B at landing stage by stopping the loop after N cycles. |
| Cursor motion feels fake (too smooth, no human jitter) | Use a single ease-out curve, not multi-bezier with jitter. Consumer-y "human cursor" libraries always feel worse than a deliberate stylised glide. Reference: Linear's marketing autoplay. |
| Mobile readability — text at 12–13 px in a 360-wide hero is unreadable | Below 640 px viewport, scene swaps to a 3-frame static carousel (same data, no animation). Phase still cycles but cursor hides. |
| Reduced-motion users see a flicker | `transition-duration: 0` everywhere; opacity changes only, no transforms. Looks like a slideshow. |
| Pulling fixtures from `lib/fixtures.ts` couples scene to prototype | Hardcode 3 agents + 2 approvals in `scene-data.ts`. Strings are short, doesn't hurt to repeat. |
| Vocabulary drift if real product copy changes | Acceptable. Scene is a marketing artifact; it doesn't need to track product UI 1:1. |
| Brand colours drift if Radix tokens move | Inline a `:root` block in `HeroLoop.css` with the 6 brand hexes from `docs/landing-colors-handoff.md`. Self-contained → portable. |
| Performance: framer-motion or similar adds 30 KB | Don't use it. Plain CSS transitions + a single `useEffect`. ~3 KB component. |

## 7. Step-by-step implementation plan

> **One step per work cycle.** After each step: report what changed, files touched, why, how to verify, what's next. Wait for "go" before the next step.

### Step 1 — Scaffold the component skeleton (no animation, no cursor)
- Create `src/prototype/components/hero-loop/` with `HeroLoop.tsx`, `HeroLoop.css`, `scene-data.ts`, `index.ts`.
- Implement only the **static idle frame**: outer stage frame + 3 agent tiles + nothing else. Hardcoded fixtures in `scene-data.ts`.
- Add `/sandbox/hero-loop` route in `index.tsx` rendering `<HeroLoop />` inside `AppShell`.
- **Verification:** open `http://localhost:5173/#/sandbox/hero-loop` → see 3 agent tiles in a clean dark frame, no animation. Tiles look 1:1 with `/sandbox/team-bridge` tiles but smaller and standalone. No console errors. `npm run lint` clean.
- **Decision gate:** does the visual style of the static frame match the product? If yes → Step 2. If no, adjust dimensions/spacing here before adding behaviour.

### Step 2 — Add the approval card overlay (static, no animation yet)
- Create `parts/ApprovalCard.tsx` — visual clone of `components/approval-card.tsx`, no router/state.
- Render it permanently visible below the tiles, no animation. Just to confirm the layout works in the stage.
- **Verification:** approval card visible below tiles, looks like the real one (avatar, "wants to" caption, action verb, View / ✓ / ✕ footer). Both fit comfortably in 960×620.

### Step 3 — Add the synthetic cursor (static, parked at rest position)
- Create `parts/Cursor.tsx` — SVG arrow, positioned absolute, `transform: translate3d()`.
- Park it at top-right; verify it doesn't break layout.
- **Verification:** cursor visible, looks like a Mac arrow, sits where expected.

### Step 4 — Wire the state machine (phase timer, no visual change yet)
- Implement the `usePhaseLoop()` hook in `HeroLoop.tsx`: `phase: number`, advances via `setTimeout`, loops at end.
- Print current phase + remaining time as a `<div className="hero-loop__debug">` in the top corner (toggleable).
- **Verification:** debug overlay shows phase 0 → 1 → … → loops back. Timings match the table.

### Step 5 — Hook cursor position to phase
- Cursor moves between named target positions per phase (`data-target="rest" | "tile-rr" | "approve"`).
- Add CSS transition on the cursor's transform.
- **Verification:** cursor glides smoothly between targets in time with the phase timer. Reduced-motion mode: cursor teleports.

### Step 6 — Hook visual state to phase (pulses, slides, success)
- Agent tile pulse, approval card slide-in, button depress, jade success cross-fade, next-incoming toast.
- All CSS transitions, no JS animation library.
- **Verification:** full loop plays end-to-end. Read the whole sequence cold — does it tell the story? Show user, get reaction.

### Step 7 — Mobile fallback + reduced motion
- Below 640 px: hide cursor, drop transforms, keep state changes (3-frame slideshow).
- `@media (prefers-reduced-motion: reduce)`: same fallback.
- **Verification:** resize browser to phone width — scene still cycles, no cursor. Toggle reduced-motion in OS — no motion, still cycles.

### Step 8 — Remove debug overlay + polish + final review
- Strip the debug counter, finalise timings, add a single `<MockBadge>` on the sandbox host page noting "design preview".
- Inline the 6 brand hexes into `HeroLoop.css` as fallback for handoff portability.
- `npm run lint && npm run build` clean.
- **Decision gate:** user approves → ready for landing handoff (separate step, not this plan).

## 8. Verification checklist

After every step:
- [ ] `npm run lint` clean.
- [ ] `npm run build` clean.
- [ ] No new console errors at `/sandbox/hero-loop`.
- [ ] Existing screens unaffected (Home, Approvals, Activity, Team).
- [ ] No regression in `/sandbox/team-bridge` (the nearest neighbour).

After final step:
- [ ] Reduced-motion mode tested manually in OS settings.
- [ ] Mobile viewport tested (Chrome DevTools, 375×667).
- [ ] Scene component compiles when imported without the rest of the prototype (sanity check: move the folder to a scratch project later).
- [ ] All copy passes vocab grep (`workflow|MCP|tokens|prompt|execution|trace|DAG|node|pipeline` → zero matches in the new files).

## 9. Browser testing instructions for the user

After Step 1:
- URL: `http://localhost:5173/#/sandbox/hero-loop`
- Expect: dark frame, 3 agent tiles in a row (Lead Qualifier, Refund Resolver, Access Provisioner). No animation yet. No console errors.
- Compare against: `/sandbox/team-bridge` — tiles should feel like the same family but cleaner / more "spotlit".

After Step 6 (the big one):
- Same URL. Watch the loop play.
- Things to react to:
  1. Does the **first second** sell the team metaphor? Can you tell who the agents are without reading?
  2. Does the **approve moment** feel like control, or like a fait accompli?
  3. Does the **loop reset** feel natural or jarring?
  4. Is the cursor speed right (not too slow, not too fast)?

After Step 7:
- Resize browser to ~375 px wide. Expect: cursor gone, simpler slideshow, still 3 phases.
- In macOS: System Settings → Accessibility → Display → "Reduce motion" ON. Same URL. Expect: no glides, just state snaps. Still cycles.

## 9b. Phase 2 — product-faithful redesign

User feedback after Step 8: scene reads as "marketing illustration", not "slice of the real product". Bottom is empty during idle. Animation underuses real data we have.

**Direction (user-confirmed):** rebuild idle composition as a faithful slice of the Home `AdminView` — greeting + 3 `MetricCard`-style KPIs + pending-approvals queue stack (3 visible + "+N more"). Animation focuses on the top queue row: expand → approve → jade success → collapse out → next row promotes to focal → KPI `Pending` count decrements. Loop resets to original queue. Infinite-queue feel (user confirmed: gives "product takes load off you" reading).

**Greeting:** no name binding ("Good morning · Tuesday, 8:42 AM").

**Components delta:**
- New: `Greeting.tsx`, `KpiStrip.tsx`, `QueueRow.tsx`
- Removed: `AgentTile.tsx`, `ApprovalCard.tsx`, `SuccessCard.tsx`, `Toast.tsx` (their roles fold into `QueueRow` states)
- Kept: `Cursor.tsx`, `phases.ts`, state-machine in `HeroLoop.tsx` (same 9 phases / 9s loop)

**New view-state model (per-row, not abstract):**

| Phase | rr | lq | ap | next | pending count |
|-------|----|----|----|------|---------------|
| idle | focal | idle | idle | hidden | 5 |
| cursor-to-tile | focal | idle | idle | hidden | 5 |
| tile-click | focal + pressed | idle | idle | hidden | 5 |
| approval-enter | expanded | dim | dim | hidden | 5 |
| cursor-to-approve | expanded | dim | dim | hidden | 5 |
| approve-click | expanded + approveP | dim | dim | hidden | 5 |
| success | success | dim | dim | hidden | 4 |
| next-incoming | hidden | focal | idle | idle | 4 |
| outro | hidden | focal (fading) | idle (fading) | idle (fading) | 4 → 5 |

Queue rotation via 4-item DOM that's always rendered; row visibility through `max-height` + `opacity` transitions. The "+1 more" item (4th) reveals when the top collapses.

**Cursor targets (recomputed for new layout):**
- rest → (440, 30)
- focal row → (250, 230) (top of queue)
- approve btn → (140, 322) (inside expanded row footer)

**Done as a single bigger step** (visual + animation tightly coupled; splitting would require intermediate states that don't tell a coherent story).

## 9c. Phase 3 — second variant: chat scene

User wants a second hero variant **next to** the existing one (sibling, not replacement). Different flow, different animation. Story: an agent joins the team → user delegates a task via chat → agent responds usefully. Independent from the first scene (no cross-reference to approvals).

**Direction (user-confirmed):**
- Compressed-hire: agent already in the header (`joined just now`), no welcome-flow / template-picker beats. Skips ~3 seconds of UI no one will read.
- Single chat surface, no transitions between welcome → chat. Everything happens in one plane.
- Loop reset clears the chat (welcome bubble fades back, user msg + response + CTA fade out). No history accumulation.
- No connection to Scene 1 — independent story.

**Folder layout:**

```
src/prototype/components/hero-chat-loop/
├── HeroChatLoop.tsx
├── HeroChatLoop.css
├── scene-data.ts
├── phases.ts
├── index.ts
└── parts/
    ├── AgentHeader.tsx
    ├── MessageBubble.tsx       (agent + user variants)
    ├── TypingIndicator.tsx     (●●● animated)
    ├── InputBar.tsx            (states: idle / typing / ready-to-send / pressed)
    ├── ActionCta.tsx           (inline pill below response)
    └── Cursor.tsx              (same SVG as hero-loop, copied for portability)
```

Route: `/sandbox/hero-chat-loop`. No sidebar entry. `screens/sandbox/HeroChatLoopScreen.tsx`.

**Phase table (9.4s loop):**

| # | Phase | Duration | Visual |
|---|---|---|---|
| 0 | idle | 1000 | Agent header + welcome bubble only |
| 1 | cursor-to-input | 1000 | Cursor moves to input |
| 2 | typing | 2000 | Text appears in input char-by-char (~20 chars/sec) |
| 3 | cursor-to-send | 800 | Cursor to send button |
| 4 | send-click | 200 | Click. User bubble appears right-aligned. Input clears. |
| 5 | thinking | 1000 | ●●● pulsing dots, agent-side |
| 6 | agent-responds | 1400 | Response bubble fade+slide-in, multi-line with bullets |
| 7 | action-cta | 1400 | Small inline CTA slides up under response |
| 8 | outro | 600 | All non-welcome msgs fade out, ready for loop reset |

Total: 9400 ms.

**Step plan (mirrors Phase 1):**

- **P3.1**: Scaffold + static idle frame (agent header + welcome bubble + empty input bar). Route mounted in sandbox.
- **P3.2**: Phase state machine + cursor (port from hero-loop, new positions).
- **P3.3**: Wire animations per phase (typing, send, thinking, response, CTA).
- **P3.4**: Static-mode fallback + polish.

## 9d. Phase 4 — chat-loop: add hire beat

User feedback after Phase 3 review: the chat scene compressed "agent creation" into an implicit "joined just now" caption in the header. User explicitly wanted the **full flow visible**: creation → chat → message → useful response.

**Redesign:**

Two-view stack inside the same 500×600 stage, cross-fading at `hire-transition` phase. Picker view first (4 template cards in a vertical list), then chat view.

**New phase table (10s loop):**

| # | Phase | Duration | View | What |
|---|---|---|---|---|
| 0 | idle | 800 | picker | "Who needs to join the team?" + 4 cards |
| 1 | cursor-to-template | 1000 | picker | Cursor → Sales card |
| 2 | template-click | 200 | picker | Press feedback on Sales card |
| 3 | hire-transition | 700 | both fade | Picker fades out, chat fades in |
| 4 | cursor-to-input | 800 | chat | Cursor → input |
| 5 | typing | 2000 | chat | Char-by-char text |
| 6 | cursor-to-send | 600 | chat | Cursor → send |
| 7 | send-click | 200 | chat | Click, user bubble |
| 8 | thinking | 800 | chat | ●●● |
| 9 | agent-responds | 1200 | chat | Cascade |
| 10 | action-cta | 1100 | chat | CTA pill |
| 11 | outro | 600 | both fade | Fade everything |

Total: 10000 ms.

**Cursor targets:**
- rest (picker view): (440, 30) — top-right
- Sales card centre: (250, 126) — first row of vertical card list
- rest (chat view): (440, 92) — same as Phase 3
- input / send: same as Phase 3

**Components delta:**
- New: `TemplatePicker.tsx` (4-card vertical list + header)
- Updated: `scene-data.ts` adds `SCENE_TEMPLATES` (Sales / Marketing / Support / Custom)
- Updated: `phases.ts` adds 3 phases (cursor-to-template, template-click, hire-transition)
- Updated: `HeroChatLoop.tsx` — view-stack with picker + chat absolutely positioned, cross-fade
- Updated: `HeroChatLoop.css` — `.hcl-view` (absolute, cross-fade), `.hcl-picker`, `.hcl-tpl`

Done as a single step (visual + animation tightly coupled; same rationale as Phase 2).

## 9e. Phase 5 — comprehensive journey scene

User feedback after Phase 4 review: focused single-feature scenes aren't what they want for hero. Wants ONE longer animation that walks through ALL the main features so a visitor sees every cool moment in one play. User accepts the longer duration trade-off (acknowledged 18–22s is fine, retention drops are OK).

**Direction (user-confirmed):**
- One comprehensive scene, ~20 seconds.
- Walks through 6 product surfaces in a connected user journey ("Maria's morning"):
  1. Dashboard with KPIs + pending queue
  2. Approval expansion + approve decision
  3. "Hire an agent" CTA → template picker
  4. Chat with newly-hired agent → user types task
  5. Agent responds with output + drafts-ready CTA
  6. Activity ticker peek
  7. Return to dashboard with updated state (5→6 active, 5→4 pending)
- New sandbox route + screen. Existing `hero-loop/` and `hero-chat-loop/` stay untouched.

**Folder layout:**

```
src/prototype/components/hero-journey-loop/
├── HeroJourneyLoop.tsx
├── HeroJourneyLoop.css
├── scene-data.ts            (combined fixtures: KPIs, queue, templates, chat, activity)
├── phases.ts                (~22 phases × 20s)
├── index.ts
└── parts/
    ├── Cursor.tsx
    ├── Greeting.tsx
    ├── KpiStrip.tsx
    ├── QueueRow.tsx
    ├── HireButton.tsx
    ├── TemplatePicker.tsx
    ├── AgentHeader.tsx
    ├── MessageBubble.tsx
    ├── TypingIndicator.tsx
    ├── InputBar.tsx
    ├── ActionCta.tsx
    └── ActivityTicker.tsx
```

Parts are copies of equivalents in `hero-loop/` and `hero-chat-loop/` (slight adaptations as needed). Some duplication, kept for portability — each scene folder must be copyable to the landing repo standalone. CSS namespace: `--hjl-*` / `.hjl-*` (hero-journey-loop).

Route: `/sandbox/hero-journey-loop`. No sidebar entry.

**Phase plan (~20.8s loop, 23 phases):**

| # | Phase | Dur (ms) | View | What happens |
|---|---|---|---|---|
| 0 | idle | 1000 | dashboard | KPIs (5/2/$284), queue idle, RR pulsing |
| 1 | cursor-to-pending-row | 1200 | dashboard | Cursor → top queue row |
| 2 | expand-pending | 1200 | dashboard | Row expands with Approve/Reject; KPI dim |
| 3 | cursor-to-approve | 1200 | dashboard | Cursor → Approve button |
| 4 | approve-click | 240 | dashboard | Press feedback |
| 5 | success | 1200 | dashboard | Row → jade success; KPI flash 2→1 |
| 6 | post-approve | 1400 | dashboard | Queue rotates, cursor → "Hire" button |
| 7 | hire-click | 240 | dashboard | Press, view transitions |
| 8 | wizard-enter | 600 | wizard | Template picker fades in |
| 9 | cursor-to-template | 1000 | wizard | Cursor → Sales card |
| 10 | template-click | 240 | wizard | Press feedback |
| 11 | hire-transition | 700 | both fade | Wizard → chat cross-fade |
| 12 | chat-welcome-dwell | 700 | chat | Welcome bubble settles |
| 13 | cursor-to-input | 800 | chat | Cursor → input |
| 14 | typing | 1800 | chat | Char-by-char typing |
| 15 | cursor-to-send | 600 | chat | Cursor → send |
| 16 | send-click | 240 | chat | Press, user bubble |
| 17 | thinking | 800 | chat | ●●● |
| 18 | agent-responds | 1200 | chat | Response cascade |
| 19 | drafts-cta | 1000 | chat | CTA pill appears |
| 20 | activity-flash | 1400 | activity | Transition to activity ticker, 3 recent items |
| 21 | return-and-update | 1400 | dashboard | Return to dashboard with updated KPIs (6/4) |
| 22 | outro | 600 | all | Fade |

Total: 20880 ms ≈ 20.9 s.

**Cursor key positions:**
- rest (dashboard): (440, 30)
- top queue row: (250, ~230) — same as hero-loop
- Approve button: (140, ~322) — same as hero-loop
- Hire button: (~410, 30) — top-right of greeting strip
- Sales template card: (250, 126) — same as hero-chat-loop
- chat input: (120, 556) — same as hero-chat-loop
- chat send: (456, 556) — same as hero-chat-loop

**Step plan:**

- **P5.1**: Scaffold + static dashboard idle view. Parts: Greeting, KpiStrip, QueueRow, HireButton. Route mounted.
- **P5.2**: Static wizard view. Part: TemplatePicker.
- **P5.3**: Static chat view. Parts: AgentHeader, MessageBubble, TypingIndicator, InputBar, ActionCta.
- **P5.4**: Static activity view. Part: ActivityTicker. + dashboard-updated state variant.
- **P5.5**: Phase state machine + cursor positions. No content animation yet.
- **P5.6**: View state per phase + view-switching transitions.
- **P5.7**: Content animations (queue rotation, KPI flash, typing, response cascade).
- **P5.8**: Polish, vocab sweep, static-mode fallback, final review.

8 steps. Roughly equivalent effort to Phase 1 + Phase 4 combined.

## 10. Progress log

| Date / time | Step | Notes |
|-------------|------|-------|
| 2026-05-12 21:48 | Plan drafted | Awaiting user go on Step 1. |
| 2026-05-12 22:05 | Stage size locked: 500×600 portrait | User pick; plan § 4 updated. |
| 2026-05-12 22:10 | **Step 1 done** | Scaffold + static idle frame. Files: `components/hero-loop/{HeroLoop.tsx, HeroLoop.css, scene-data.ts, index.ts, parts/AgentTile.tsx}`, `screens/sandbox/HeroLoopScreen.tsx`, route + import in `index.tsx`. Lint + build clean. Awaiting browser review. |
| 2026-05-12 22:25 | **Step 2 done** | Static approval card in lower slot. Added `parts/ApprovalCard.tsx` (inline SVG icons, no router/state). Mounted in `HeroLoop.tsx`. Card uses Approve-as-CTA two-button layout (jade Approve / red Reject) — closer to /approvals/:id detail than to the queue card. Subtle orange-bordered pending state matches ApprovalsDeck pattern. Lint + build clean. |
| 2026-05-12 22:40 | **Step 3 done** | Synthetic cursor parked at rest (440, 40). Added `parts/Cursor.tsx` — inline-SVG Mac arrow, position driven by `--hl-cursor-x`/`-y` CSS variables so Step 5 only has to swap values + add a transition. `pointer-events: none`, drop-shadow for contrast on dark surface. Lint + build clean. |
| 2026-05-12 22:55 | **Step 4 done** | Phase state machine wired. New `phases.ts` (9 phases, total 9.0s loop). `usePhaseLoop()` advances via rolling `setTimeout` with React cleanup; `useNow()` 10 Hz tick drives the remaining-time readout. Debug bar rendered as sibling of stage (not inside), labelled `phase {idx}: {name}` + countdown + total loop length. No visual changes inside the stage. Lint + build clean. |
| 2026-05-12 23:10 | **Step 5 done** | Cursor position driven by phase. `CURSOR_POSITIONS` lookup table in `HeroLoop.tsx` maps each `PhaseName` → `{x, y}`. CSS transition `transform 1.2s cubic-bezier(.4,0,.2,1)` glides between phases. `prefers-reduced-motion`: teleport (transition: none). Three target points: rest (440,40), tile-RR (250,95), Approve-btn (140,545). Cursor pullback to rest happens on entry to `success` phase — synced with the 1.4s success-state phase. Lint + build clean. |
| 2026-05-12 23:50 | **Step 6 done** | Full visual state machine wired. New parts: `SuccessCard.tsx` (jade-bordered ledger success state, scale-in entry), `Toast.tsx` (next-incoming, slides up from bottom). Updated parts: `AgentTile.tsx` (`pulse`/`pressed` props), `ApprovalCard.tsx` (`visible`/`approvePressed` props). In `HeroLoop.tsx`: `ViewState` interface + `viewStateForPhase()` switch — single source of truth for what every element shows per phase. CSS additions: scoped `box-sizing: border-box` reset, `.hero-loop__tiles--dim`, `.hl-tile--pulse` + `@keyframes hl-pulse-dot`, `.hl-tile--pressed`, `.hl-approval` repositioned absolute with fade+slide-up entry, `.hl-btn--pressed`, full `.hl-success` and `.hl-toast` blocks, consolidated `@media prefers-reduced-motion`. Lint + build clean. |
| 2026-05-13 00:10 | **Step 7 done** | Mobile + reduced-motion fallback consolidated into a single media query block `@media (max-width: 640px), (prefers-reduced-motion: reduce)`. Cursor `display: none`. All transitions collapse to opacity-only (220ms ease). Transforms stripped from every visibility state (hidden + visible + pressed) so entries become pure opacity fades. Pulse animation on the waiting dot suppressed; static orange ring on the tile stays so "needs you" still reads. Removed the standalone reduced-motion block on `.hl-cursor` — now handled by the consolidated block. Lint + build clean. |
| 2026-05-13 00:25 | **Step 8 done** | Debug overlay stripped. Removed `useNow` hook, `phaseStartedAt` from `usePhaseLoop` (returns just `phaseIndex` now), all debug JSX, `TOTAL_LOOP_MS` import, and the `.hero-loop__debug*` CSS block. `.hero-loop` simplified from flex-column to `inline-block` (only one child remains). HeroLoopScreen subtitle + MockBadge hint updated to reflect handoff-ready state. Vocab sweep: only 2 matches for banned terms — both on `tokens` in code comments ("brand tokens" / CSS vars), which is internal-not-user-facing per ux-spec § 11.2. Lint + build clean (715 ms). **Scene is design-complete and portable.** |
| 2026-05-13 00:30 | Plan complete (Phase 1) | All 8 steps shipped. Hand-off-ready folder: `src/prototype/components/hero-loop/`. |
| 2026-05-13 01:15 | **Phase 2 done — product-faithful redesign** | Replaced abstract "3 tiles + 1 approval card" with real dashboard slice: greeting + 3 KPIs + 4-row approvals queue. Removed `AgentTile.tsx`, `ApprovalCard.tsx`, `SuccessCard.tsx`, `Toast.tsx`. Added `Greeting.tsx`, `KpiStrip.tsx`, `QueueRow.tsx` (6 states: idle/focal/expanded/success/dim/hidden). Rewrote `HeroLoop.tsx` view-state to per-row + KPI flags. Queue rotation via `max-height: 0` collapse + 4th-row reveal. KPI Pending count animates 5→4 with flash; orange pulse on warn tile + focal-row avatar. Same 9-phase / 9s loop. Cursor targets recomputed. Static mode (mobile + reduced-motion) preserved. Lint + build clean (706 ms). |
| 2026-05-13 01:35 | **Phase 2 polish** | Two fixes from user review: (1) Removed all borders per project convention — stage, KPI tiles, queue rows, pills, buttons, queue count badge. State indication now via tinted background gradients only (focal: orange 10%, expanded: orange 15% + drop shadow, success: jade 14%). Pill/button fills bumped slightly to compensate. (2) Approve-click was missing the actual button — cursor at y=322 was ~50px below the rendered button. Recomputed CURSOR_POSITIONS from actual layout math: tile-target y=205 (centred on compact row), approve-target y=272 (Approve button centre in expanded footer). Lint + build clean (703 ms). |
| 2026-05-13 02:00 | **Phase 3 — Step P3.1 done** | Second hero variant scaffolded as `src/prototype/components/hero-chat-loop/`. Static idle frame: `AgentHeader` (LQ avatar + "joined just now" + pulsing jade live-dot) + `MessageBubble` showing welcome message + empty `InputBar` with placeholder + send button. Borderless throughout (filled bg only). Brand tokens inlined, scoped box-sizing reset, static-mode media query. Sandbox host at `/sandbox/hero-chat-loop`. Lint + build clean (762 ms). Awaiting browser review. |
| 2026-05-13 02:15 | **Step P3.2 done** | Phase state machine + cursor wired. `phases.ts` (9 phases × 9.4s loop). `parts/Cursor.tsx` (same SVG as hero-loop, copied for portability, namespaced `--hcl-cursor-*`). `usePhaseLoop()` in `HeroChatLoop.tsx`. `CURSOR_POSITIONS` table with three targets: rest (440, 92), input (120, 556), send (456, 556). CSS transition `transform 0.9s cubic-bezier(.4,0,.2,1)`. Cursor pullback to rest on `thinking` phase. No content animation yet — that's P3.3. Static-mode hides cursor. Lint + build clean (669 ms). |
| 2026-05-13 02:40 | **Step P3.3 done** | Full content state machine wired. New parts: `TypingIndicator.tsx` (●●● bounce dots in agent-side bubble), `ActionCta.tsx` (jade pill slides up after response). `ViewState` per-element flags + `viewStateForPhase()` switch. Agent response cascade (intro + 4 bullets) via CSS animation-delay (280→920ms), staggered 160ms. **Typing animation is pure CSS** (`steps(26, end)` on `max-width` over 2s) — sidestepped React 19's strict `set-state-in-effect` / `refs` lint rules. `InputBar` rewritten to take `state: 'empty' \| 'typing' \| 'full'` driven by phase. Send-button press feedback (200ms scale + brightness). User bubble fades in right-aligned on send-click. Static-mode collapses cascade to single fade. Lint + build clean (691 ms). |
| 2026-05-13 03:00 | **Phase 3 complete** | Step P3.4 polish: vocab sweep — only 2 hits on "tokens" in code comments ("brand tokens" / CSS vars), internal-not-user-facing per ux-spec § 11.2. HeroChatLoopScreen subtitle and MockBadge hint updated to handoff-ready language. Both scenes (`/sandbox/hero-loop` + `/sandbox/hero-chat-loop`) are now portable, design-complete, and live side-by-side for landing-team review. |
| 2026-05-13 09:30 | **Phase 4 done — chat-loop hire beat added** | User reviewed Phase 3 and pointed out the "agent creation" beat was implicit (just a header caption), not the full flow they wanted. Redesigned the chat-loop scene as a **two-view stack**: picker view (4 template cards) for phases 0–3, then cross-fade to chat view (phases 3–11). New `TemplatePicker.tsx` part. New phases inserted: `cursor-to-template`, `template-click`, `hire-transition`. Total loop now 10s (was 9.4s). New cursor target: Sales card centre (250, 126). `SCENE_TEMPLATES` added (Sales/Marketing/Support/Custom). CSS: `.hcl-view` (absolute, cross-fade), `.hcl-picker`, `.hcl-tpl` with press-state. Static-mode includes picker fade. Lint + build clean (713 ms). |
| 2026-05-13 10:00 | **Phase 4 polish — 20% slower** | User wanted hero-chat-loop pacing eased. All phase durations × 1.2 (total now 12s, was 10s). CSS timings coupled to phases also scaled: `.hcl-cursor` transition 0.9s → 1.08s, `.hcl-view` cross-fade 500ms → 600ms, typing reveal 2000ms → 2400ms. Cascade delays (intro/bullets) and loop animations (caret blink, dot bounce) left as-is — they're stylistic, not pacing. Lint + build clean (706 ms). |
| 2026-05-13 11:00 | **Phase 5 — Step P5.2 done** | Static wizard view scaffolded. New `parts/TemplatePicker.tsx` (clone of hero-chat-loop equivalent with `hjl-` namespace; `pressedId` plumbed through for P5.7). `HeroJourneyLoop.tsx` now renders dashboard + wizard as sibling `.hjl-view` blocks stacked absolutely; a top-of-file `staticView` constant ('dashboard' / 'wizard' / 'chat' / 'activity') picks the visible one and gets replaced by phase-driven selection in P5.5. Switched to 'wizard' for review. CSS additions: `.hjl-picker` block (header eyebrow + title + list) and `.hjl-tpl` (avatar + body, press state via violet bg). Added `.hjl-tpl` to the static-mode media query so reduced-motion / mobile strip the press transform. Subtitle on HeroJourneyLoopScreen updated. Lint + build clean (764 ms). |
| 2026-05-13 11:25 | **Phase 5 — Step P5.3 done** | Static chat view scaffolded. Five new parts cloned from hero-chat-loop with `hjl-` namespace: `AgentHeader.tsx`, `MessageBubble.tsx`, `TypingIndicator.tsx`, `InputBar.tsx` (incl. inline `SendIcon` SVG + `InputState` type), `ActionCta.tsx`. `HeroJourneyLoop.tsx` adds the chat view DOM (header + 3 bubbles + typing slot + CTA + input) in its densest static state: welcome + user msg + agent response (intro + 4 bullets) + drafts-ready CTA, typing hidden, input empty. `staticView` switched to 'chat'. CSS additions: full chat block — `.hjl-header` (+avatar/id/name/caption/dot pulse), `.hjl-chat`, `.hjl-msg` (+variants/bubble/avatar), `.hjl-resp__intro/list` with 5-line cascade (`hjl-line-in` keyframe, 280→920 ms staggered), `.hjl-typing` (+dots, `hjl-typing-bounce`), `.hjl-cta` (+pill/dot), `.hjl-input` (states empty/typing/full, `hjl-input-reveal` and `hjl-caret` keyframes, send button ready/pressed states). Typing reveal duration set to 1800 ms — matches the 1800 ms `typing` phase in `phases.ts` (vs 2400 ms in hero-chat-loop which had 2400 ms phase after 20% slowdown). Static-mode media query extended to suppress new transforms/animations and collapse the response cascade to a single fade. Subtitle updated. Lint + build clean (676 ms). |
| 2026-05-13 11:50 | **Phase 5 — Step P5.4 done** | Static activity view scaffolded. New `parts/ActivityTicker.tsx` — eyebrow `RECENT ACTIVITY` + faint hint `across your team` + vertical list of 3 rows from `SCENE_ACTIVITY`. Top row (`hjl-act--fresh`) gets a subtle cyan-tinted gradient bg + cyan-coloured `ago` timestamp to anchor on the just-produced event from the chat beat. Each row: 28 px gradient avatar + agent/action body + ago timestamp, ellipsis on overflow. `HeroJourneyLoop.tsx` adds the activity view DOM as a fourth `.hjl-view` sibling; `staticView` switched to 'activity'. Documented the dashboard-updated state variant in a comment: `SCENE_KPI_UPDATED` data exists, prop-wiring belongs to P5.6 (view-state per phase). CSS additions: full `.hjl-activity` block (head + list + row, fresh-variant gradient). `.hjl-act` added to static-mode media query. Subtitle updated. Lint + build clean (695 ms). |
| 2026-05-13 12:15 | **Phase 5 — Step P5.5 done** | Phase state machine + cursor live. New `parts/Cursor.tsx` (same SVG arrow as hero-loop / hero-chat-loop, namespaced `hjl-cursor-*` CSS variables). `usePhaseLoop()` hook in `HeroJourneyLoop.tsx` advances `phaseIndex` via rolling `setTimeout` with React cleanup, loops at end. `staticView` constant removed. New `PHASE_TO_VIEW: Record<PhaseName, ViewName \| null>` table — 22 phases map to one of dashboard/wizard/chat/activity, `outro` → null (every view fades out, opacity transition handles cross-fades automatically). New `CURSOR_POSITIONS` table with computed layout coords for all 23 phases (dashboard: rest 440,30 / row 250,201 / approve 140,261 / hire 448,35; wizard: 250,126; chat: rest 440,92 / input 120,556 / send 456,556). CSS additions: `.hjl-cursor` block with `transform 0.58s cubic-bezier(.4,0,.2,1)` glide — chosen just under the shortest cursor-move phase (`cursor-to-send` at 600 ms). Cursor `display: none` in static-mode media query. Content inside each view stays static (queue rows not expanding, KPI not flashing, etc.) — that wiring is P5.6. Subtitle updated. Lint + build clean (670 ms). |
| 2026-05-13 12:50 | **Phase 5 — Step P5.6 done** | Full view-state-per-phase wired. `HeroJourneyLoop.tsx` got a `ViewState` interface covering every per-element flag across all four views (KPI values + dim/pulse/flash, hire button press, 4-row queue state + approve-button press, template press id, welcome / user-msg / typing / response / CTA bubble visibilities, send button press, input bar state). Three reusable row tuples — `ROWS_INITIAL`, `ROWS_EXPANDED`, `ROWS_ROTATED` — keep `viewStateForPhase()` readable. Intermediate `KPI_AFTER_APPROVE` constant (pending: 4, active: 5) is carried from `success` through `hire-click` and the wizard / chat phases; `SCENE_KPI_UPDATED` (6/4) lands at `return-and-update` with `pendingFlash`. Queue rotation happens at the success→post-approve boundary: row 0 success → hidden (CSS `max-height: 0` 480 ms collapse), row 3 hidden → idle (reveal as part of the same transition). The hidden / rotated queue is preserved through the wizard / chat / activity phases so the dashboard cross-fade back at `return-and-update` doesn't snap rows around. The whole JSX now consumes one `vs` object — no more hardcoded literals. Lint + build clean (689 ms). |
| 2026-05-13 13:10 | **Phase 5 — Step P5.7 done** | Content-animation polish. (1) Response cascade tightened from start-280 / stagger-160 ms to start-240 / stagger-140 ms; last bullet now ends at 240 + 4×140 + 320 = 1120 ms with 80 ms buffer before the 1200 ms `agent-responds` phase closes and the CTA fades in. (2) Activity-view fresh row gets a one-second cyan flash on view entry — `.hjl-view--activity.hjl-view--visible .hjl-act--fresh { animation: hjl-fresh-flash 1000ms ease-out }` keyframes a 0.32 → 0.10 cyan-tint decay back to default. Scoped to the activity view's visible class so the animation re-fires every loop iteration when the view becomes visible. Static-mode media query extended to suppress the new flash animation. Subtitle updated. Lint + build clean (683 ms). |
| 2026-05-13 13:25 | **Phase 5 — Step P5.8 done** | Final polish + handoff readiness. Vocab sweep (`workflow\|MCP\|tokens\|prompt\|execution\|trace\|DAG\|pipeline\|orchestration\|temperature`) over `src/prototype/components/hero-journey-loop/` returns 2 acceptable hits, both on "tokens" in code comments ("brand tokens" / inlined CSS variables) — internal-not-user-facing per ux-spec § 11.2. Same vocab status as hero-loop and hero-chat-loop. HeroJourneyLoopScreen subtitle rewritten to handoff-ready language (no step numbers, describes the loop's beats). HeroJourneyLoop.tsx file header rewritten to handoff-ready (no plan step references, describes architecture: phase state machine + three lookup tables, all animations pure CSS). MockBadge hint unchanged — already handoff-ready from P5.1. Static-mode fallback already comprehensive after P5.1-P5.7 incremental additions. Lint + build clean (715 ms). **Phase 5 complete.** |
| 2026-05-13 13:30 | Plan complete (Phase 5) | Three sibling hero-loop variants now live side-by-side at `/sandbox/hero-loop`, `/sandbox/hero-chat-loop`, `/sandbox/hero-journey-loop`. All three are portable, design-complete, and ready for landing-team handoff. |
