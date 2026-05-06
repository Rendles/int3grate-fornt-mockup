# Plan: Custom Styled Scrollbar

Add a custom, minimalist scrollbar to the prototype to match the "instrument-panel" aesthetic and ensure consistent look-and-feel across different browsers/platforms.

## Task Summary
- Implement custom scrollbar styles using CSS variables and Radix Themes tokens.
- Apply styles globally within the `.prototype-root` container.
- Ensure compatibility with Webkit (Chrome/Safari/Edge) and Firefox.
- Maintain accessibility and usability (adequate contrast, hover states).

## Current Repository State
- The project uses a dark/light theme via Radix Themes.
- Scrolling is handled by standard browser scrollbars.
- Key scrollable areas identified in `prototype.css`:
    - `.shell__sidebar` (`overflow-y: auto`)
    - `.chat-detail__messages` (`overflow-y: auto`)
    - `.welcome-frame__messages` (`overflow-y: auto`)
    - `.card` (`overflow-x: auto` on mobile)
    - `.prototype-root` itself (standard document scroll)

## Relevant Files Inspected
- `src/prototype/prototype.css`: Main stylesheet for the prototype.
- `src/App.tsx`: App entry point.

## Assumptions and Uncertainties
- **Assumption:** Modern browsers (supporting CSS variables and the new `scrollbar-*` properties) are the target.
- **Uncertainty:** How `scrollbar-gutter: stable` will interact with existing Radix Themes layouts in corner cases (like portaled Select contents).

## Proposed Approach
1. Define scrollbar-specific CSS variables in `.prototype-root` based on Radix gray/accent scales.
2. Use `::-webkit-scrollbar` family for Webkit-based browsers.
3. Use `scrollbar-width` and `scrollbar-color` for Firefox.
4. Apply a "thin" style to the sidebar and chat messages, while keeping the main window scrollbar slightly more prominent or standard.
5. Add hover effects to the scrollbar thumb for better interactive feedback.

## Risks and Trade-offs
- **Risk:** Custom scrollbars can sometimes be harder to grab for users with motor impairments. We will ensure the thumb has a minimum size and high enough contrast.
- **Trade-off:** We are using standard CSS/Webkit properties instead of a heavy JS-based scrollbar library (like OverlayScrollbars) to keep the prototype lightweight and maintainable.

## Step-by-step Implementation Plan

### Step 1: Define Variables and Global Styles
- Open `src/prototype/prototype.css`.
- Add scrollbar variables to `.prototype-root`.
- Implement global scrollbar resets and styles.

### Step 2: Refining Specific Areas
- Ensure the sidebar scrollbar is subtle.
- Check chat messages and welcome frame.
- Verify behavior in Radix `Select.Content` (which portals out of `.prototype-root`).

### Step 3: Verification and Polish
- Test light/dark theme switching.
- Test hover states.
- Verify on different browsers if possible (simulated or instructions for user).

## Verification Checklist
- [ ] Scrollbar is visible in the sidebar.
- [ ] Scrollbar is visible in chat history.
- [ ] Scrollbar matches the theme (dark vs light).
- [ ] Thumb changes color/opacity on hover.
- [ ] No layout jumps when scrollbar appears/disappears (where `scrollbar-gutter` is used).

## Browser Testing Instructions
1. Open the app at `http://localhost:5173/#/`.
2. Go to the "Activity" or "Team" page.
3. Shrink the browser window vertically to force scrolling in the sidebar or main content.
4. Open a Chat (`Team` -> Click an agent -> `Talk` tab).
5. Send enough messages to trigger scrolling.
6. Observe the scrollbar style.
7. Switch between Light and Dark modes in Settings (or via system preference if wired).

## Progress Log
- 2026-05-05: Initial plan created.
