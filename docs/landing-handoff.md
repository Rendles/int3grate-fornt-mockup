# Landing handoff — Int3grate.AI

Reference document for the team building the marketing landing page. Pulls together the product positioning, the visual language used inside the app, the canonical vocabulary, and a one-paragraph description of every page the user can see.

> Source of truth: this prototype repo. The product UX spec lives in `docs/ux-spec.md`. The OpenAPI contract is `docs/gateway.yaml`. This document is a derivative — when conflicts appear, the spec wins for product copy and the gateway file wins for technical claims.

> Last reviewed: 2026-05-02.

---

## 1. Product in one paragraph

**Int3grate.AI is a control plane for AI agents that work inside your business tools.** The user — a small/medium-business owner like the canonical persona "Maria" — hires agents the way they would hire employees: each agent has a name, a role, a set of apps they can touch, and a brief that describes what they should do. Anything an agent does that touches the outside world (sending an email, updating a CRM record, issuing a refund) flows through an approvals queue by default, so the owner stays in control. The product is not workflow automation, not a no-code DAG editor, not a chatbot — it is a small digital team you can talk to, give jobs to, and review the work of.

Target user — **agent-curious owner** of a 10–20-person business who is comfortable with Zoho/QuickBooks/HubSpot and ChatGPT, wants AI agents, but will not read documentation and is afraid of losing control. Everything on the landing must respect that profile.

---

## 2. Brand & visual language

The app uses **Radix Themes** with the following tokens. The landing should match these to keep the brand coherent across marketing → app.

### 2.1 Color

- **Accent colour:** Radix `indigo` (`accentColor='indigo'` in the theme provider).
- **Gray scale:** Radix `slate` (`grayColor='slate'`). Cool, slightly blue — not warm.
- **Status colours:** standard Radix scales — `green` (success / working), `amber` (waiting / warn), `red` (error / stuck), `blue` (informational / running), `cyan` (occasional info accent).
- **Both light and dark modes ship.** Theme is toggled in the topbar (`☀️` / `🌙`). Landing should support both, or pick **dark as the hero treatment** to match the operator feel.

> All colours in the app come from Radix CSS variables (`--gray-1..12`, `--accent-1..12`, plus `--*-a1..12` alpha scales). The landing should reuse the same scales to avoid colour drift. Don't introduce new hex codes.

### 2.2 Typography

- **Single family:** **Inter** (300 / 400 / 500 / 600 / 700), loaded via Google Fonts. Headings, body, and code all use Inter — there is no second typeface.
- **Base size:** 14px, line-height 1.5, letter-spacing −0.005em.
- **Headings:** weight 500 (medium), letter-spacing −0.01em. The display size used on page hero (`size="8"`) is roughly 36–40px. The pattern `Your <em>team</em>.` puts a single accent-coloured word inside the heading — `<em>` gets accent colour without italics.

### 2.3 Border radius

- **Radix radius preset:** `small` (compact, business-tool feel — not the bubbly `large`).
- **Custom radii in CSS** (these may differ from what landing convention defaults to — please follow):
  - **Cards:** `16px` (large, rounded panels).
  - **Buttons / inputs / selects:** small (Radix `radius="small"` ≈ 3px).
  - **Badges:** `12px` (pill-shaped via `radius="full"` more often).
  - **Icon buttons:** `12px`.
  - **Tiles inside cards (list rows, chips):** `4–6px`.

> The pattern is: large rounded cards on the outside, small rounded controls inside. Don't make everything one radius — the contrast is intentional.

### 2.4 Density and spacing

- The app is **desktop-first** and dense — closer to QuickBooks / Linear / Zoho than to a consumer app.
- Default Radix scale `100%`. Don't blow up to `110%` for landing — keep it operator-tight.
- Page padding is generous (`.page` ≈ 32px); within cards padding is `14–18px`. Landing can be more breathy than the app, but the hero section should still feel **business-serious**, not consumer-playful.

### 2.5 Iconography

- Icons come from **Hugeicons free set** (`@hugeicons/core-free-icons`). Outline / line style. Default size 14px in dense UI; 18–24px in hero/tile contexts.
- Icons inherit `currentColor` — no fixed brand colour.
- Icons used in the app today: home, robot (Agent), bubble-chat, checkmark-badge (Approval), clock (Run / Activity), tools, dollar-circle (Spend), audit, lock, plus, arrow-left/right, alert, info, eye, lock, sun, moon, settings, help.

### 2.6 What NOT to do (visual)

From `docs/ux-spec.md` § 9 / § 10 — these apply to the landing too:

- **No cartoon robots / mascots / "AI sparkles".** Agents are employees, not Wall-E.
- **No purple gradients.** Don't reach for the generative-AI cliché.
- **No confetti, balloons, celebration animations.**
- **No "hacker neon" dark.** The app's dark mode is muted slate, not Matrix-green.
- **No avatar-as-emoji.** When agents are pictured, they are realistic neutral portraits (think HR-system staff photo). Initials are the current placeholder.

---

## 3. Vocabulary — what to call things on the landing

This is the **most important section for landing copy.** Use these words; avoid the engineering equivalents.

### 3.1 Translation table (mandatory)

| Don't say | Say instead |
|---|---|
| Deploy | **Hire** |
| Configure / Set up | **Train** / **Brief** |
| Workflow | **Playbook** |
| Run / Execute | **Ask** / **Assign** |
| Tools / Connectors / Integrations | **Apps** (page name) / **What they can access** |
| Errors / Failures | **Got stuck — needs help** |
| Logs / Traces | **Activity** |
| Tokens / Usage | **Hours worked** / **Monthly bill** |
| Costs (engineering) | **Spend** / **Costs** (acceptable; no "burn rate", "OpEx") |
| Model | (don't mention) |
| Prompt | **Instruction** / **Brief** |
| System prompt / Temperature / Context window | (don't mention) |
| User / Operator | **Owner** / **Admin** / **Team member** |
| Tenant / Workspace (engineering) | **Workspace** (user-friendly) |

### 3.2 Words you CAN use freely

- **Agent** — the central concept. Don't hide it. The product is *for* people who came looking for AI agents.
- **Team** — the mental model. "Your team", "your digital team", "hire a team member".
- **Approval** — what the human does to greenlight an action.
- **Brief** — the short instructions you give an agent (think: brief to a contractor).
- **Workspace** — your account boundary.

### 3.3 Words that are absolutely banned

These appear in the spec's anti-pattern list — never put them in front of the user:

`workflow, MCP, tokens, model, prompt, JSON, run, execution, trace, context window, orchestration, system prompt, temperature, DAG, node, pipeline, webhook, API key`

### 3.4 Tone

- **Calm, business-serious, slightly understated.** Like Zoho, QuickBooks, Linear, HubSpot.
- **Not** "Hey friend! 👋", **not** "Awesome! 🎉", **not** "Let's get you started on your AI journey!".
- Concrete examples beat abstractions:
  - ✅ *"Sarah is ready. Connect Zoho to let her review your leads."*
  - ✅ *"12 leads need a follow-up. Drafts ready for your review."*
  - ❌ *"Unleash the power of AI for your sales pipeline."*

---

## 4. The three core promises (use as landing pillars)

Per `docs/ux-spec.md` § 1 / § 3 / § 5, the product is built around three commitments. The landing's value props should map to these:

1. **A small digital team you can talk to.**
   *"Each agent has a name, a role, and a brief — like an employee, not a workflow."*

2. **Nothing escapes your control.**
   *"Every action that touches a customer, a CRM record, or your money waits for your approval first."*

3. **Real work in the first five minutes.**
   *"Connect your tools, hire an agent, and watch them do real work on real data — no week-long onboarding."*

These are the three things every visitor must walk away understanding.

---

## 5. Page inventory — what's actually inside the app

Use this section as the source for "What's inside" or "Tour" sections of the landing. Page names below are exactly what users see in the sidebar.

### 5.1 Primary navigation (5 items, visible to all users)

#### Home — `/`
Operational dashboard. Greets the user by name + time of day. Shows three at-a-glance numbers: **Active agents**, **Pending approvals** (warning-tinted when > 0), **Spend · 7d**. Below: a two-column block with the **pending approvals list** (top 4) and **recent activity** (most recent 5 runs). Bottom: spend-by-agent breakdown. *Landing equivalent: "Your team's command centre".*

#### Approvals — `/approvals`
The queue of agent actions that are waiting for a human decision. Each row shows the prettified action ("Send email", "Refund $412"), which agent requested it, who can approve (role gate), and how long it's been waiting. Click → review screen at `/approvals/:id` where the user can approve or reject with an optional reason. *Landing equivalent: "Nothing ships without your sign-off".*

#### Activity — `/activity`
Chronological stream of every action agents have taken. Filter chips by status (All / Running / Waiting / Pending / Completed / Finished with errors / Got stuck / Cancelled). Infinite scroll. Click a row → technical detail at `/activity/:runId` showing the step-by-step trace. *Landing equivalent: "See exactly what your agents did and when".*

#### Team — `/agents`
The roster of hired agents. Card grid: avatar + name + description + status pill + last-active timestamp + "Talk to" / "Manage" buttons. Filter by status (active / paused / draft / archived) and free-text search. Top-right `Hire an agent` button (admin-only) opens the wizard at `/agents/new`. *Landing equivalent: "Meet your team. Hire who you need."*

#### Costs — `/costs`
Spend overview. Hero number ("$X spent · last 7 days") + range chips (1d / 7d / 30d / 90d) + three stat cards (**Total**, **Activities**, **Tokens** with in/out breakdown — though "tokens" is the only place this engineering word leaks; under review). Bottom: per-agent breakdown with bars showing relative spend. *Landing equivalent: "Predictable per-agent monthly bill".*

### 5.2 Secondary surfaces (admin-only, deep-link, or hidden in MVP)

These exist in the codebase but won't all be in the sidebar — useful context for landing if it wants to talk about features that aren't yet in the main nav:

- **Hire wizard — `/agents/new`** — multi-step flow: pick a template (Sales / Marketing / Reports / Customer Support / Finance / Operations / Custom) → name the agent → pick what apps they can access → review → success. Default permissions come pre-filled per template.
- **Agent detail — `/agents/:id`** — six tabs: **Overview** (vital stats), **Talk** (1-on-1 chat with the agent), **Permissions** (apps + per-tool read/ask/auto level), **Activity** (this agent's runs only), **Settings** (read-only metadata), **Advanced** (versioning).
- **Profile — `/profile`** — current user's account info.
- **Learning Center — `/learn`** — guided in-product tours (some are stale and being rebuilt).
- **Login — `/login`** — three demo accounts (Ada admin, Marcelo domain admin, Priya member). Registration is hidden until the backend ships `POST /auth/register`.
- **Hidden in MVP, not for landing:** Apps catalogue (`/apps`), Settings (`/settings`), Audit log (`/audit`), Tasks (`/tasks/*` — fully removed). See `docs/handoff-prep.md`.

### 5.3 Sandbox (current experiment, not real)

- **Team Bridge — `/sandbox/team-bridge`** — design preview of a control-room layout (live agent tiles + sticky approvals deck + activity ticker). Currently shown in the sidebar with a `preview` badge for stakeholder feedback. **Do not feature on the landing yet** — concept under review.

---

## 6. Pre-built agent templates (for "What you can hire" sections)

The hire wizard ships with seven starter templates. The landing can mention these by name to make the value concrete:

| Name | What they do (short pitch) |
|---|---|
| **Sales Agent** | Finds leads, sends intros, follows up. |
| **Marketing Agent** | Drafts campaigns, schedules posts, watches signal. |
| **Reports Analyst** | Pulls dashboards, summarises numbers, flags anomalies. |
| **Customer Support** | Answers FAQs, escalates the rest. |
| **Finance Helper** | Reconciles invoices, prepares refunds, flags exceptions. |
| **Operations Helper** | Handles user provisioning, access changes, app hygiene. |
| **Custom Agent** | Start from scratch and train everything yourself. |

Source of truth: `src/prototype/lib/templates.ts` — change there if the line-up is updated.

---

## 7. Connected apps (for "Works with" / integration logos)

The product integrates with shared backend credentials for the following apps. Landing logos should focus on what users actually recognise — the connections that matter. Concrete app prefixes referenced in tool grants (from `lib/format.ts` / fixtures):

- **Gmail** — send, search, draft.
- **HubSpot** — contacts, deals, pipeline.
- **Pipedrive** — leads, deals.
- **Notion** — read / write pages.
- **GitHub** — issues, PRs.
- **Sheets** (Google Sheets) — read / append rows.
- **Apollo** — lead enrichment.
- **Stripe** — refunds, payments lookup.
- **Slack** — post messages.

> **Important architectural note for landing copy:** Int3grate.AI manages credentials for these integrations centrally — there is **no per-tenant OAuth** (no "Connect your Gmail" flow on the user side). The landing should not promise per-account OAuth. Use phrasing like "Works with Gmail, HubSpot, and Pipedrive" — not "Securely connect your accounts via OAuth".

---

## 8. Landing-specific recommendations (where the design must shift)

The app is intentionally dense and operator-feeling. The landing needs to translate that into **persuasion** without becoming generic SaaS.

- **Lead with the team metaphor, not the technology.** Hero: a row of agent cards (Sarah, Marcus, Lisa) with realistic portraits, names, statuses — not a robot illustration.
- **Show the approvals queue as a screenshot.** "Every action waits for your green light." Concrete proof beats abstract claim.
- **Use real spend numbers in the price section** — match the format used in-app (`$X spent · last 7 days`, never raw token counts).
- **Reuse Radix indigo + slate** — don't introduce a separate marketing palette.
- **Border-radius and density may be SOFTER than the app**: the app is 14px base + 16px card radius; the landing can go to 16px base and slightly larger cards in the hero — but stay in the same visual family. Avoid jumping to 24px+ "marketing" radii.
- **Dark hero is on-brand.** The app's primary aesthetic is dark instrument-panel; a dark hero with light-mode below works.
- **No stock-photo "happy people on laptops".** Either real product screenshots or none.

---

## 9. Quick checklist for landing review

Before shipping, run the page against this:

- [ ] Word **"Agent"** appears prominently.
- [ ] Words **"workflow", "tokens", "model", "prompt", "DAG"** do NOT appear anywhere.
- [ ] The **approvals / control** message is one of the three pillars.
- [ ] The **team metaphor** is concrete (named agents, roles) not abstract ("AI workforce").
- [ ] Tone is **calm and business-serious**, not "🚀 supercharge your workflow".
- [ ] Visual style uses **Radix indigo + slate**, Inter font, no purple AI gradients, no robot mascots.
- [ ] Aha moment ("real work in 5 minutes") is shown, not just claimed.
- [ ] Integration list does NOT promise per-account OAuth.
- [ ] CTA verbs match the app: **Hire, Try, Talk to a team** — not "Get started with Workflow Engine".

---

## 10. Where to dig deeper

- `docs/ux-spec.md` — full target-user spec (Maria persona, anti-patterns, three screens, trust ladder).
- `docs/gateway.yaml` — backend contract; what the product can actually do.
- `docs/handoff-prep.md` — what is hidden / deferred in the current build (don't promise Settings, Apps catalogue, Tasks, Register on the landing — they're not shipping in MVP).
- `docs/backend-gaps.md` — known gaps. Skim if landing wants to make claims about realtime / notifications / billing.
- `src/prototype/lib/templates.ts` — current agent template line-up, single source of truth.
- `src/prototype/prototype.css` — actual CSS tokens (radii, cards, typography).
