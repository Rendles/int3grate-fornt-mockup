# Notifications MVP — frontend mock

## 1. Task summary

Add a notifications system to the prototype: topbar bell icon with dropdown of recent items + new `Settings → Notifications` tab with simple on/off preferences. Three event types (approval pending, approval expiring, agent stuck), two channels (email, in-app). All data mocked client-side; email is not actually sent — surfaces just say "(simulated)".

## 2. Current repository state

- Branch: `master`. Working tree dirty (HomeScreen vocab pass, recent doc reorg).
- No notification-related code exists in `src/prototype/` (grep for `notification|notify|unread|inbox` — 3 incidental hits, all in fixture text bodies, no infrastructure).
- Topbar is in `src/prototype/components/shell.tsx` lines 152–215. After breadcrumbs it shows: user email (md+), IconHelp button (Learning Center), then theme/login controls. Bell will go between user email and IconHelp.
- Settings tabs in `src/prototype/screens/SettingsScreen.tsx`: `workspace / team / history / developer / diagnostic`. Adding `notifications` as 6th tab.
- Routes registered in `src/prototype/index.tsx`. Need to add `/settings/notifications`.
- Icons: no IconBell currently. Hugeicons free has `Notification01Icon` etc. Need to add an export in `components/icons.tsx`.

## 3. Relevant files inspected

- `src/prototype/components/shell.tsx` — topbar layout
- `src/prototype/screens/SettingsScreen.tsx` — tabs structure + tab render pattern
- `src/prototype/lib/types.ts`, `lib/fixtures.ts`, `lib/api.ts` — domain layer pattern
- `src/prototype/components/common.tsx` (barrel) — primitives available
- `src/prototype/components/common/mock-badge.tsx` — `MockBadge kind="design"` pattern
- `docs/ux-spec.md` § 8 — vocabulary rules
- `docs/backend-gaps.md` § 7 — notifications already flagged as open question; will add UI surfaces to the catalogue

## 4. Assumptions and uncertainties

- Bell uses Radix `Popover.Root` + `Popover.Trigger` + `Popover.Content` (consistent with rest of app's overlay style).
- `Notification01Icon` from `@hugeicons/core-free-icons` is the right icon name. If lint/build complains, fall back to inline SVG.
- Read state is in-memory (mutates fixture array, lost on reload) — matches existing `lib/api.ts` convention.
- Default seeded fixtures: 3 unread + 1 read, mixed types and ages, all linking to existing approval/agent IDs.
- Email is not sent. Mock surfaces use `(simulated)` text or `MockBadge kind="design"`.
- Vocabulary: titles use spec-blessed terms — "got stuck — needs help" (not "failed"), "wants to {action}" (not "requests"), "expires in 4h" is fine.
- Per-agent rules / quiet hours / per-priority routing — explicitly out of scope (confirmed in chat).

## 5. Proposed approach

Layered top-down:

1. Domain layer (types + fixtures + API).
2. Bell component (standalone).
3. Mount bell in topbar.
4. Settings tab (route + UI).
5. Style polish + MockBadge surfaces.
6. Update `docs/backend-gaps.md` with the new UI surfaces.
7. Verify (grep, lint, build, manual visual check).

## 6. Risks and trade-offs

- **Hugeicons icon name:** if `Notification01Icon` isn't exported under that exact name, lint catches it and we adjust. Low risk.
- **Tab index already crowded:** Settings has 5 tabs; 6th is borderline. Acceptable — still fits horizontally.
- **Bell on mobile:** topbar is desktop-first per existing prototype convention. Bell will display but dropdown might be awkward on narrow viewports — out of scope for this MVP (mobile is its own backlog item).
- **Mock realism:** the dropdown shows hardcoded fixtures, so the demo always looks the same. That's intended (matches the prototype's pattern), but reviewers may ask "why doesn't the count change?" — `MockBadge` answers that.
- **"Approval expiring" without a real expiry mechanism:** approvals in fixtures don't have a real `expires_at`; we'll seed one notification with a hardcoded "expires in 4h" wording. If we ever wire real expiry, the headline can become dynamic.

## 7. Step-by-step implementation plan

### 7.1 Add types (`src/prototype/lib/types.ts`)

```ts
export type NotificationType = 'approval_pending' | 'approval_expiring' | 'agent_stuck'
export type NotificationChannel = 'email' | 'in_app'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body?: string
  agent_id?: string
  approval_id?: string
  created_at: string
  read: boolean
}

export interface NotificationPreferences {
  events: Record<NotificationType, Record<NotificationChannel, boolean>>
}
```

Add at the end of the file under a new `// ─────── Notifications (mock-only — no gateway endpoint) ───────` separator.

### 7.2 Add fixtures (`src/prototype/lib/fixtures.ts`)

Add `fxNotifications: Notification[]` with 4 entries (3 unread, 1 read), referencing existing `agt_*` and `apr_*` IDs from current fixtures. Mix of types and ages (5 min, 1h, 2h, 1d).

Add `fxNotificationPrefs: NotificationPreferences` defaulting all 6 toggles to `true`.

### 7.3 Add API methods (`src/prototype/lib/api.ts`)

```ts
listNotifications(): Promise<{ items: Notification[]; unread_count: number }>
markNotificationRead(id: string): Promise<void>
markAllNotificationsRead(): Promise<void>
getNotificationPreferences(): Promise<NotificationPreferences>
updateNotificationPreferences(prefs: NotificationPreferences): Promise<NotificationPreferences>
```

All wrapped with `delay(120, 280)` like the rest. Mutations alter `fxNotifications` / `fxNotificationPrefs` in place.

### 7.4 Add `IconBell` to `components/icons.tsx`

Export legacy named binding using `Notification01Icon` from `@hugeicons/core-free-icons`. Pattern matches existing exports (`IconHelp` etc.).

### 7.5 Create `src/prototype/components/notifications-bell.tsx`

Self-contained component:
- `useEffect` loads notifications on mount.
- Polls or refetches on focus (skip polling for MVP — fixtures are static anyway).
- `Popover.Root` with `IconButton` trigger + Badge for `unread_count`.
- `Popover.Content` width 360px, max-height ~400px, scroll inside.
- Header: "Notifications" + small "(simulated)" caption.
- List items: per-type icon, title (truncated), `ago(created_at)`, unread dot.
- Empty state: green check + "All caught up".
- Click on item: `markNotificationRead`, then `navigate(href)` based on `type` and IDs.
- Keyboard: Esc closes (Radix default).

Per-type routing:
- `approval_pending` / `approval_expiring` → `/approvals/{approval_id}`
- `agent_stuck` → `/agents/{agent_id}/activity`

### 7.6 Mount bell in topbar (`src/prototype/components/shell.tsx`)

Insert `<NotificationsBell />` between user email and IconHelp button (after line ~199, before line ~201).

### 7.7 Add Notifications tab to Settings

In `src/prototype/screens/SettingsScreen.tsx`:
- Add `'notifications'` to `SettingsTab` union type.
- Add `{ key: 'notifications', label: 'Notifications', href: '/settings/notifications' }` to `SETTINGS_TABS`.
- Add `{tab === 'notifications' && <NotificationsTab user={user!} />}` to render chain.
- Add `NotificationsTab` function (inline in same file, matching existing tab functions like `DiagnosticModeTab`).

`NotificationsTab` UI:
- `MockBadge kind="design"` on the card title row.
- Read-only email row (DataList item using `user.email`).
- 3×2 grid of toggles (rows: event types, cols: channels).
- "Save" button; on click calls `api.updateNotificationPreferences` and shows brief success toast or inline confirmation.
- "(Email is simulated — no actual messages are sent)" footnote.

### 7.8 Register route (`src/prototype/index.tsx`)

Add to routes array, after the existing `/settings/diagnostic`:
```ts
{ pattern: '/settings/notifications', render: () => <SettingsScreen tab="notifications" /> },
```

### 7.9 CSS (`src/prototype/prototype.css`)

If needed — small classes for bell unread-dot, notification-row layout. Probably ~15 lines. Reuse existing `.card`, `.truncate`, `.legend-dot` where possible.

### 7.10 Update `docs/backend-gaps.md`

Add notifications-MVP-mock to § 4 "Disabled UI features (planned, no backend yet)" or as new § 4.6. Reference: `POST /notifications`, `GET /notifications`, `PATCH /notifications/{id}/read`, `GET/PUT /me/notification-preferences` — none exist in `docs/gateway.yaml`.

### 7.11 Verify

- `npm run lint` clean
- `npm run build` clean
- Manual visual: log in as Ada, see bell with badge "3", click → dropdown with 4 items, click an approval → navigates and marks read. Visit `/settings/notifications`, see grid, toggle one, click Save, see confirmation. Reload → notifications reset to fixtures (in-memory).

## 8. Verification checklist

- [ ] `IconBell` resolves and renders in topbar
- [ ] Badge shows correct unread count (3 from seeded fixtures)
- [ ] Dropdown opens on click, shows 4 items with right per-type icons
- [ ] Empty state appears if all marked read
- [ ] Click on an item: navigates to right URL, marks read, badge decrements
- [ ] `/settings/notifications` route works (admin only — same gating as other tabs)
- [ ] Notifications tab card shows email read-only, 3×2 grid, Save button, MockBadge
- [ ] Save persists in memory (toggle changes survive tab navigation but NOT page reload)
- [ ] `(simulated)` caption visible in bell dropdown header
- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] No regressions on Home / Approvals / Activity / Agents pages

## 9. Browser testing instructions for the user

1. `npm run dev`, open `http://localhost:5173/#/`.
2. Log in as `frontend@int3grate.ai`.
3. **Topbar bell:** confirm bell icon appears between your email and the `?` button. Confirm it has a small badge showing "3".
4. Click the bell. Confirm a dropdown appears (~360px wide) listing 4 notifications. Confirm each has a type-appropriate icon, a clear title, and a relative time. Confirm the 3 unread ones have a small dot; the read one doesn't.
5. Click on the "Sales agent wants to send..." item. Confirm the page navigates to the relevant approval detail. Reopen the bell — that item should no longer have the unread dot, and the badge should now read "2".
6. Mark all read by clicking through. Reopen bell. Confirm empty state ("All caught up").
7. Reload the page — confirm 3 unread reappear (in-memory reset is intended).
8. Navigate to **Settings** in sidebar. Confirm "Notifications" appears as a new tab. Click it.
9. Confirm: a card with `MOCK` badge, your email shown read-only, a grid of 6 toggles, a "Save" button, and a footnote about simulation.
10. Toggle one off, click Save. Confirm a brief success indicator. Switch tabs and back — toggle stays off (in-memory persist).
11. Quick spot checks on Home, Approvals list/detail, Activity, Team, Apps, Costs — nothing should look different.

## 10. Progress log

- 2026-04-29 16:20: Chat scope confirmed — email + bell, 3 events, simple on/off, mock fixtures.
- 2026-04-29 16:20: Inventory of existing topbar / Settings structure / icons completed.
- 2026-04-29 16:20: Plan file created.
