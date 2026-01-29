# Tech Setup — Tauri + React + Vite (Naide Desktop)

Follow these instructions to create the Naide prototype under **src/naide-desktop**.

## Folder layout (required)
Repository structure must be:

```
src/
  naide-desktop/
    (tauri + frontend project)
```

The Vite frontend should live in `src/naide-desktop` and Tauri config in `src/naide-desktop/src-tauri`.

## Create the Tauri + Vite project
Use the official Tauri + Vite template flow (current tooling varies). If you need to initialize manually:

- Create Vite React TS app in `src/naide-desktop`
- Add Tauri (`@tauri-apps/cli` and `@tauri-apps/api`)
- Initialize `src-tauri` with Tauri config

The app must build with:
- `tauri dev`
- `tauri build`

## Window defaults (required)
Configure the main window:
- default size: **1200x800**
- **resizable: true**
- title: **Naide**
- dark-only: do not implement light mode toggle

In Tauri, ensure window sizing is set in `tauri.conf.json` or equivalent.

## Tailwind CSS (required)
Install and configure Tailwind for the Vite React project.

Requirements:
- Dark mode only (do not use `dark:` toggles; the entire app is dark by default)
- Use a consistent design system:
  - page background: very dark
  - panels/surfaces: slightly lighter
  - borders: subtle
  - typography: high contrast but not pure white

## Fonts (required; must be bundled)
Bundle and use:
- **Inter** (UI font)
- **JetBrains Mono** (monospace blocks)

Implementation guidance:
1. Add font files under:
   - `src/naide-desktop/src/assets/fonts/Inter/`
   - `src/naide-desktop/src/assets/fonts/JetBrainsMono/`
2. Add `@font-face` declarations in a global CSS file (e.g., `src/styles/fonts.css`)
3. Set Tailwind theme font families:
   - `font-sans` → Inter
   - `font-mono` → JetBrains Mono

NOTE: Include the font files in the repo. Use regular + medium weights at minimum.

## Routing (required)
Use a simple client-side router:
- `/` → Screen 1 (Intent Capture)
- `/planning` → Planning Mode

Keep routing minimal. React Router is acceptable; if you use it, keep to v6+.

## State management (required)
Use lightweight in-memory state:
- React context or a small store (no heavy frameworks)
- Data to pass:
  - `initialIntentText` from Screen 1 to Planning Mode
  - `planDirty` boolean for Planning Mode footer state

Persisting to localStorage is optional but not required.

## Accessibility and UX requirements
- Modal must trap focus and be dismissible with Escape.
- Buttons must have visible focus states.
- Ensure keyboard navigation works.

## Build verification
Ensure:
- `tauri dev` starts the app
- Screen 1 renders at `/`
- Planning Mode renders at `/planning`
- Screen 1 Continue behavior works (modal on empty; navigation on non-empty)
