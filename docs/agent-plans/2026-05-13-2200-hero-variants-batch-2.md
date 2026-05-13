# Landing hero — variants batch 2 (variants 4–8)

> Plan owner: Claude
> Created: 2026-05-13 22:00 local
> Status: in progress — variant 4 (Team Roster) being built first

## 1. Task summary

Build five new scripted hero scenes for the marketing landing — siblings of the existing three (`/sandbox/hero-loop`, `/sandbox/hero-chat-loop`, `/sandbox/hero-journey-loop`). Each one explores a distinct narrative angle that the existing three don't cover. Goal: enough variety on a single page to compare side-by-side and pick the final hero loop (or compose 2–3 of them into a rotation on the landing).

Each variant ships as:
- A self-contained `src/prototype/components/hero-<name>-loop/` folder with the same portability contract as the existing three (zero deps on the rest of `src/prototype`, brand tokens inlined, copy-paste handoff to the landing repo).
- A sandbox screen `src/prototype/screens/sandbox/Hero<Name>LoopScreen.tsx` at `/sandbox/hero-<name>-loop`.
- No sidebar entry — direct URL only (same as existing 3).

Implement one per work cycle. User reviews in the browser between each.

## 2. Current repository state

- Three hero loops shipped and live (`master` clean as of 2026-05-13):
  - `HeroLoop` — 9s, single approval card scenario (operator angle).
  - `HeroChatLoop` — 12s, hire template → chat delegation → bullet response + CTA.
  - `HeroJourneyLoop` — 21s, comprehensive walkthrough of 6 surfaces.
- Sandbox routing pattern established. Sidebar surfaces only `team-bridge`; everything else is direct URL.
- Brand palette migrated; `violet` (accent), `cyan` (info), `orange` (warn), `jade` (success), `red` (danger). `amber/green/indigo/blue` forbidden.
- Portability contract from the existing loops works — brand tokens inlined into per-component CSS, no `src/prototype/lib/*` or `components/common/*` imports inside the loop folders.

## 3. Relevant files inspected

- `src/prototype/components/hero-loop/{HeroLoop.tsx,HeroLoop.css,phases.ts,scene-data.ts,parts/*}` — canonical pattern: phase state machine on rolling `setTimeout`, per-phase view state, brand tokens inlined as CSS custom properties, `prefers-reduced-motion` + `max-width: 640px` block that strips transitions/animations.
- `src/prototype/components/hero-chat-loop/`, `src/prototype/components/hero-journey-loop/` — sibling implementations confirming the pattern scales (12 and 23 phases respectively).
- `src/prototype/index.tsx` — flat hash router; sandbox routes registered as plain `{ pattern, render }` entries near line 161–165.
- `src/prototype/screens/sandbox/HeroLoopScreen.tsx` (and siblings) — boilerplate screen wrapping the loop inside `AppShell` with `PageHeader` + `MockBadge`.
- `docs/agent-plans/2026-05-12-2148-hero-loop-embed.md` — original plan for the 3-loop suite. References `docs/landing-handoff.md § 4` for the three product pillars that any hero must hit (team metaphor, approval gate, real work in 5 minutes).

## 4. Assumptions and uncertainties

**Assumptions (all carry over from the first 3 loops):**
- Stage size 500×600 portrait. Each variant may break this if the narrative demands (e.g. variant 8 split-screen wants wide), but defaults to 500×600 unless flagged.
- Mini-fixtures hardcoded inside each component folder (zero `lib/fixtures.ts` import). Names match canonical agents (`Lead Qualifier`, `Refund Resolver`, `Access Provisioner`, `Knowledge Base Sync`) for cross-variant consistency.
- Autoplay only. No interaction.
- Brand tokens inlined per-folder (each variant has its own `--hr-*` / `--ho-*` / etc. variable namespace).
- Reduced-motion + sub-640px viewport strip animations but keep state changes visible.

**Uncertainties:**
- After all 5 are live, will the user want them composed into a single landing rotation, or one picked? Decision deferred until comparison.
- Variant 8 (split-screen "you vs you+agents") may need ~700–900 wide stage; portrait layout doesn't fit. To confirm with user once we get to it.

## 5. Proposed approach — the five variants

### Variant 4 — Team Roster (parallel)

**Angle:** Sells the "team" mental model directly. Four named agents shown side-by-side, each in its own state and own micro-timeline. The viewer is the observer (no cursor in this variant) watching their digital team work.

**Differentiation from existing 3:**
- Existing 3 all use a synthetic cursor; this one does NOT (intentional — the message is "this runs without you").
- Existing 3 follow a single linear story; this one shows parallelism — multiple states held simultaneously.
- Initial frame shows ONE OF EACH state (working / needs-you / done / idle) → at-a-glance richness.

**Stage 500×600.**
- Header strip ~40 px: `Team` label + time + `needs you` pill on right (count badge, orange when ≥1, muted when 0; brief 420 ms flash on change).
- 2×2 grid of agent cards (~224×247 each, 12 px gap).

**Agents:**
- LQ — Lead Qualifier — Sales
- RR — Refund Resolver — Support
- AP — Access Provisioner — IT Ops
- KS — Knowledge Base Sync — Docs

Each agent has 4 state-bound content blocks (`task` + `meta` per state).

**Card structure:**
- Top row: avatar (gradient initials) · name+role · status pill
- Body: current task line + meta line (right-aligned baseline)
- Bottom: progress strip (visible only when `working`, CSS-loop shimmer)
- State-driven accents:
  - working → cyan top-border + cyan pill + cyan progress-bar shimmer
  - needs-you → orange top-border + orange pill + pulsing corner dot
  - done → jade top-border + jade pill + ✓ icon on task line
  - idle → no top-border, muted (opacity 0.55), gray pill

**Phase machine (12 phases × ~1.0 s = ~12 s loop):**
- p0 idle hold (initial frame: LQ working · RR needs-you · AP done · KS idle)
- p1 KS: idle → working
- p2 RR: needs-you → done (counter → 0)
- p3 LQ: working → needs-you (counter → 1)
- p4 AP: done → idle
- p5 KS: working → needs-you (counter → 2)
- p6 LQ: needs-you → done (counter → 1)
- p7 AP: idle → working
- p8 KS: needs-you → done (counter → 0)
- p9 RR: done → working
- p10 LQ: done → idle
- p11 outro hold, then loop reset to initial frame

Pending-count rhythm over the loop: 1 → 1 → 0 → 1 → 1 → 2 → 1 → 1 → 0 → 0 → 0 → 0 (drama in the first half, calm in the second; loop restart re-introduces the orange pill).

**Files:**
```
src/prototype/components/hero-roster-loop/
  HeroRosterLoop.tsx        — top-level, owns phase state machine
  HeroRosterLoop.css        — scoped (.hero-roster root)
  scene-data.ts             — agents + state content map
  phases.ts                 — PHASES table + statesForPhase()
  parts/
    AgentCard.tsx
    Header.tsx
  index.ts
src/prototype/screens/sandbox/HeroRosterLoopScreen.tsx
```

Route: `/sandbox/hero-roster-loop`.

### Variant 5 — Overnight Ribbon

**Angle:** Sells time-savings / ROI directly. Clock spins 6 PM → 8 AM. Activity ribbon fills with rows ("Resolved ticket #4081", "Drafted 8 outreach emails", "Synced 14 runbook pages"). At 8 AM, morning summary card slides in: "While you slept · 47 tasks · 6 need approval · $284 spent".

**Stage 500×600 portrait.**
- Top: animated clock face (analog or large digital, hand sweeps).
- Middle: scrolling activity ribbon (rows arrive from bottom, drift up, stack ~6 visible).
- Bottom: morning summary card (slides up + fades in at the final phase).

**Phase machine sketch (~12 s):**
- p0 sunset hold (6 PM, empty ribbon)
- p1–p7 clock advances every phase; 1–2 activity rows appear each phase; cyan/jade/orange colored dots distinguish run/done/approval-needed events
- p8 morning arrives (8 AM, light shift on stage background gradient)
- p9 summary card slides in
- p10 outro

**Differentiation:**
- Only variant with strong temporal narrative ("while you slept").
- Only variant with a strong visible counter ROI hook (47 tasks + $ amount).

### Variant 6 — Trust Ladder

**Angle:** Sells "the agent gets better over time" — concept genuinely novel for the category. Same task type runs three times in sequence; each time the friction shrinks.

**Stage 500×600 portrait.**
- Top: agent identity card (one agent, e.g. Refund Resolver).
- Middle: three "run" panels stacked vertically (Run 1, Run 2, Run 3).
- Each panel walks through the same task ("Refund $412 on order #44021"):
  - Run 1: long form — full approval card, Approve clicked manually.
  - Run 2: shorter — single-line approval, auto-approved after 2 s (caption: "rule applies · auto-approved").
  - Run 3: silent — task completes with a single ✓ row; caption: "trusted · ran solo".
- Bottom: "Trust level" meter ticks up: Supervised → Assisted → Autonomous.

**Phase machine (~14 s):**
- p0 intro (agent card + Run 1 starting)
- p1–p3 Run 1 — full approval drama
- p4 trust meter ticks up
- p5–p7 Run 2 — single-line + auto-approve flash
- p8 trust meter ticks up
- p9–p10 Run 3 — silent ✓
- p11 trust meter caps at Autonomous, "next refund: ran without asking" caption
- p12 outro

**Differentiation:**
- Only variant that explicitly answers "what's the trajectory?"
- Most conceptually unique — competitors don't pitch this.

### Variant 7 — Empty → Buzzing

**Angle:** Origin story. Start from an empty dashboard ("Hire your first agent" CTA). Click. Dashboard fills up over time as new agents join, KPI counters climb, activity rows accumulate.

**Stage 500×600 portrait.**
- Empty initial frame: greeting + huge `+ Hire your first agent` CTA at center.
- Cursor approaches CTA → click → wizard transition (brief).
- One agent appears (LQ). KPI: `1 agent · $0 spent`.
- Then 2nd, 3rd, 4th appear (staggered). KPIs climb. Activity rows trickle in.
- End state: full dashboard.
- Loops back to empty (gentle fade) → re-tells the origin story.

**Phase machine (~15 s):**
- p0 empty hold
- p1 cursor approaches CTA
- p2 click → wizard transition
- p3–p4 first agent joins, KPI updates
- p5–p7 second/third agent joins
- p8–p9 fourth agent joins, activity rows arrive
- p10 hold full state
- p11 fade to empty → loop

**Differentiation:**
- Only variant with a strong "before/after" narrative.
- Recruits the "I want to see myself getting started" empathy hook.

### Variant 8 — Side-by-side (you vs you+agents)

**Angle:** Strongest emotional sell. Split screen. Left: a human-only workflow — cursor frantically clicks through tabs (Gmail → Stripe → Slack → Notion), tasks pile up. Right: agents do the same work in parallel; user just clicks Approve once.

**Stage:** likely 800×500 landscape — split vertically.
- Left pane: simulated human flow. Cursor zips between mini browser tabs, task counter goes up: `3 done · 12 pending`. Caption: "Without int3grate".
- Right pane: agent dashboard with 4 cards working in parallel + single approval card. Cursor clicks Approve once. Counter: `12 done · 0 pending`. Caption: "With int3grate".
- Both panes loop synchronized so the contrast is unmistakable.

**Phase machine (~13 s):**
- p0 setup hold
- p1–p8 alternating tick: left advances 1 task, right advances 2–3 tasks (parallel)
- p9 left has 4 done / 12 left, right has 11 done / 0 left
- p10 right's "$ saved · 6 hours" callout flashes
- p11 outro

**Differentiation:**
- Only variant that explicitly contrasts "before / after the product."
- Most emotionally direct — but technically the most complex (two stages worth of UI). Highest implementation cost; build last.

## 6. Risks and trade-offs

- **Maintenance creep**: 8 hero loops total is a lot. Mitigation: each loop is self-contained, portability contract holds, deletion is trivial (folder + route).
- **Decision paralysis**: more options ≠ better landing. Push back on user once 5–6 are built: do we have a criterion to pick a winner? If not, stop adding variants.
- **Vocab drift**: each new scene-data file re-introduces a chance to hit banned vocab (workflow, MCP, tokens, prompt). Mitigation: review each variant against `docs/ux-spec.md § 8` before signing off.
- **Variant 8 stage shape**: if landing hero is fixed-portrait, variant 8 may not slot in. Surface this to user when we reach it.
- **`agents` plural in user-facing string**: all variants use the word "agent(s)". Confirmed in scope per `docs/ux-spec.md § 8` "Keep" list.

## 7. Step-by-step implementation plan

One variant per work cycle. User reviews before next variant starts.

- **Step 1 — Variant 4 (Team Roster).** Files listed in § 5 above. Register route. Lint + build clean. Browser-verify the parallel-state initial frame, the 12 phase transitions, and reduced-motion fallback.
- **Step 2 — Variant 5 (Overnight Ribbon).** New folder `hero-overnight-loop/`. Clock face, scrolling ribbon, summary card. Register route.
- **Step 3 — Variant 6 (Trust Ladder).** New folder `hero-ladder-loop/`. Three nested mini-runs + trust meter. Register route.
- **Step 4 — Variant 7 (Empty → Buzzing).** New folder `hero-onboarding-loop/`. Empty state → progressive fill. Register route.
- **Step 5 — Variant 8 (Side-by-side).** Stage shape TBD with user. New folder `hero-split-loop/`. Two-pane parallel narrative. Register route.

Between each step: **stop and ask the user to review before next**.

## 8. Verification checklist

For each variant:
- `npm run lint` clean (no unused imports, no banned vocab in user-facing strings).
- `npm run build` clean (tsc + vite).
- Route resolves: `#/sandbox/hero-<name>-loop` mounts the screen.
- Loop completes a full cycle without console errors.
- Reduced-motion: open DevTools rendering tab, enable `prefers-reduced-motion: reduce`, verify cursor/animations are suppressed but state still progresses.
- Mobile breakpoint (max-width: 640px): same as reduced-motion.
- Component folder has zero imports from `src/prototype/lib/*` or `components/common/*` (portability contract).

## 9. Browser testing instructions for the user

Per variant, after I ship:
1. Open `http://localhost:5173/#/sandbox/hero-<name>-loop`.
2. Watch ~30 s (2–3 full loops) — confirm the narrative reads at first watch.
3. Check at least one phase boundary feels neither rushed nor sluggish.
4. Toggle reduced-motion in OS settings (or DevTools rendering panel) — confirm animations are suppressed but state changes still happen.
5. Resize browser to <640 px wide — confirm same fallback.

For **variant 4** specifically:
- Initial frame should show one card in each of the 4 states (working / needs-you / done / idle) at a glance.
- The orange "needs you" pill in the header should pulse-flash when the count changes.
- The cyan progress strip should only animate on cards in `working` state.

## 10. Progress log

- **2026-05-13 22:00** — Plan drafted. All 5 variants documented. Variant 4 detailed; variants 5–8 sketched at concept level (to be detailed when each is started).
- **2026-05-13 22:15** — Variant 4 (Team Roster) implemented. Files: `hero-roster-loop/{HeroRosterLoop.tsx,HeroRosterLoop.css,phases.ts,scene-data.ts,parts/{AgentCard,Header}.tsx,index.ts}` + `screens/sandbox/HeroRosterLoopScreen.tsx`. Route `/sandbox/hero-roster-loop` registered in `index.tsx`. Lint + build clean.
- **2026-05-13 22:40** — Variant 5 (Overnight Ribbon) implemented. Files: `hero-overnight-loop/{HeroOvernightLoop.tsx,HeroOvernightLoop.css,phases.ts,scene-data.ts,parts/{ClockStrip,ActivityRow,SummaryCard}.tsx,index.ts}` + `screens/sandbox/HeroOvernightLoopScreen.tsx`. Route `/sandbox/hero-overnight-loop` registered. Clock 6 PM → 8 AM, ribbon saturates at 5 visible rows (oldest scrolls out), stage panel warms during dawn/morning, summary card slides into a pre-reserved 86 px bottom slot at phase 9. Lint + build clean.
- **2026-05-13 23:05** — Variant 6 (Trust Ladder) implemented. Files: `hero-ladder-loop/{HeroLadderLoop.tsx,HeroLadderLoop.css,phases.ts,scene-data.ts,parts/{AgentStrip,TrustMeter,Cursor,Runs}.tsx,index.ts}` + `screens/sandbox/HeroLadderLoopScreen.tsx`. Route `/sandbox/hero-ladder-loop` registered. 11 phases × ~12s. Three sequential runs of the same refund task: Run 1 expanded + cursor + Approve click; Run 2 compact + rule chip + auto-approve; Run 3 silent ✓. Trust meter advances Supervised (orange) → Assisted (cyan) → Autonomous (jade). Cursor fades to hidden after Run 1 — its disappearance is part of the message. Lint + build clean.
- **2026-05-13 23:35** — Variant 7 (Empty → Buzzing) implemented. Files: `hero-onboarding-loop/{HeroOnboardingLoop.tsx,HeroOnboardingLoop.css,phases.ts,scene-data.ts,parts/{Greeting,CtaCard,KpiStrip,AgentsGrid,ActivityFeed,Cursor}.tsx,index.ts}` + `screens/sandbox/HeroOnboardingLoopScreen.tsx`. Route `/sandbox/hero-onboarding-loop` registered. 12 phases × ~12s. Empty stage with centred violet Hire CTA → cursor clicks → KPI strip slides down + activity feed slides up + 2×2 grid populates one card at a time (LQ → RR → AP → KS) → KPI counters tick up (active 0→4, done 0→7, spend $0→$124) → full state holds → fades back to empty. Lint + build clean.
