# Tech Setup — Tauri + React + Vite (Naide Desktop)

Follow these instructions to create the Naide prototype under **src/naide-desktop**.

## Folder layout (required)
Repository structure must be:

```
src/
  naide-desktop/
    (tauri + frontend project)
  copilot-sidecar/
    (node.js typescript sidecar)
```

The Vite frontend should live in `src/naide-desktop` and Tauri config in `src/naide-desktop/src-tauri`.
The Copilot sidecar lives in `src/copilot-sidecar` and is auto-started by Tauri.

## Create the Tauri + Vite project
Use the official Tauri + Vite template flow (current tooling varies). If you need to initialize manually:

- Create Vite React TS app in `src/naide-desktop`
- Add Tauri (`@tauri-apps/cli` and `@tauri-apps/api`)
- Initialize `src-tauri` with Tauri config

The app must build with:
- `tauri dev`
- `tauri build`

## TypeScript Best Practices (from PR #17)
When working with React components and external libraries:

1. **Interface Extensions**: Prefer extending React's built-in interfaces over using index signatures
   - ✅ Good: `interface CodeProps extends React.HTMLAttributes<HTMLElement> { inline?: boolean; }`
   - ❌ Avoid: `interface CodeProps { [key: string]: unknown; }`
   
2. **Type Compatibility**: Ensure custom component interfaces are compatible with library expectations
   - Example: `react-markdown` expects `JSX.IntrinsicElements[Key] & ExtraProps`
   - Extending `React.HTMLAttributes` provides full HTML attribute support while satisfying type constraints

3. **Avoid Redundancy**: Don't redeclare properties already provided by parent interfaces
   - `HTMLAttributes` already includes `className`, `children`, etc.

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

## CI/CD Setup (Implemented in PR #5)
GitHub Actions workflow configured for continuous integration:

### Build Matrix
- Platforms: `ubuntu-latest`, `windows-latest`, `macos-latest`
- Node.js: Version 18.x
- Rust: Stable toolchain

### Build Steps
1. Install Node.js and Rust dependencies
2. Install system dependencies (Linux: webkit2gtk, libayatana-appindicator3)
3. Run linter: `npm run lint`
4. Run tests: `npm run testonly`
5. Build TypeScript and frontend: `npm run build`
6. Build Tauri application: `npm run tauri build`

### Configuration
- Workflow triggers: push and pull_request on all branches
- TypeScript config: Excludes `*.test.tsx` and `*.test.ts` files from build
- ESLint config: Excludes test files from linting
- Tauri bundle identifier: `com.naide.desktop` (changed from default `com.tauri.dev`)

## Build verification
Ensure:
- `tauri dev` starts the app
- Screen 1 renders at `/`
- Planning Mode renders at `/planning`
- Generate App screen renders at `/generate`
- Screen 1 Continue behavior works (modal on empty; navigation on non-empty)
- All tests pass with `npm run testonly`
- Linting passes with `npm run lint`
- Build succeeds on all platforms (ubuntu, windows, macos)
