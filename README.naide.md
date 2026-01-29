# Naide (Not An IDE) — Prototype

This repo contains a prototype of **Naide**, a desktop app for non‑pro developers to create and maintain apps using AI.

## What this prototype includes
- Screen 1: Intent Capture (chips, textarea, Continue modal behavior)
- Planning Mode shell: section-based guided Q&A layout with a dirty-state footer:
  - "Plan is out of date → Rebuild Plan"
- Navigation: Screen 1 → Planning Mode with initial intent text prefilled

## What is intentionally missing
- No Copilot SDK integration
- No project creation/update
- No artifact generation
- No persistence

## How to run
From `src/naide-desktop`:

```sh
tauri dev
```

## How to build
From `src/naide-desktop`:

```sh
tauri build
```

## Next steps (not implemented)
- Implement artifact generation from Planning Mode
- Connect to Copilot SDK (sidecar) to generate/update an app from artifacts
