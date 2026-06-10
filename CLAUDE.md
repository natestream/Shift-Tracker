# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Run the app in development (launches Electron directly)
npm run build      # Package distributable binaries (Windows .exe, macOS .dmg, Linux .AppImage)
```

There are no test or lint commands configured.

## Architecture

This is a single-window **Electron tray app** — no web framework, no backend, no build step for development. Electron loads local HTML/CSS/JS files directly.

**Process split:**

- `main.js` — Node.js main process: creates the tray icon, positions the popup window near the tray, manages auto-launch, and handles IPC
- `preload.js` — Context bridge exposing `window.electronAPI.closeWindow()` to the renderer
- `src/time-tracker.{html,css,js}` — Browser renderer: the entire UI in a 480×640 popup

**State and persistence:**

- All state lives in `src/time-tracker.js` as a plain `state` object: `{ date, in1, out1, in2, goal }` where time values are `"HH:MM"` strings and `goal` is paid-hours target
- Persisted via `localStorage` under the key `"shift-tracker-today"`; auto-resets at midnight by comparing `state.date` to today's date string on every render

**Window behavior:**

- Tray click toggles the window; window auto-hides on blur
- Window is positioned via `Tray.getBounds()` so it appears above or near the tray icon

**No routing, no state management library, no component framework** — DOM is manipulated directly in `time-tracker.js`.

## Design & Visual Iteration Rules

### Reference-Driven Design

Any image attached to the chat during development is a **design reference** and must be treated as the source of truth for:

- **Color** — exact or nearest-match hex values; do not substitute with generic palette defaults
- **Typography** — font family, weight, size, line height, letter spacing
- **Spacing & padding** — match the visual rhythm and density of the reference; do not apply arbitrary or "comfortable" defaults
- **Component style** — border radius, shadows, borders, opacity, and any other visual treatment visible in the reference

Do not invent design decisions. If a value is visible in the reference, extract it. If it is ambiguous, ask before guessing.

### No Generic AI Design

The following are explicitly banned unless they appear in the reference:

- Default Tailwind or Bootstrap aesthetics
- Generic card shadows (`box-shadow: 0 4px 6px rgba(0,0,0,0.1)`)
- Rounded-everything (`border-radius: 12px` on every element)
- Blue primary buttons with white text as a default
- Inter/system-ui as a fallback font choice when the reference uses something specific
- Excessive whitespace padding that softens the design beyond what the reference shows

### Screenshot Iteration Protocol

After every visual implementation:

1. Take a screenshot of the current state using the Electron window (use `screenshot` or equivalent tooling available in the environment)
2. Place the screenshot side-by-side against the reference image in your reasoning
3. Identify specific deltas: color mismatches, spacing deviations, font weight differences, alignment issues
4. Apply corrections and re-screenshot
5. Repeat until the implementation is **90–95% visually accurate** to the reference before considering the task done

Do not call a UI task complete without completing at least one screenshot comparison cycle.
