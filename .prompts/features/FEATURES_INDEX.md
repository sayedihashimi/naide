# Features Index

This index provides a chronological overview of all feature files in `.prompts/features/`. Features are listed from oldest to newest based on creation date.

**Last Updated**: 2026-02-03

---

## Active Features

| Feature File | Summary | Status |
|--------------|---------|--------|
| [2026-02-01-add-copilot-integration.md](./2026-02-01-add-copilot-integration.md) | Initial Copilot SDK + CLI integration for Planning mode | shipped |
| [2026-02-01-add-file-logger.md](./2026-02-01-add-file-logger.md) | Add persistent file logging to backend and sidecar | shipped |
| [2026-02-01-building-mode.md](./2026-02-01-building-mode.md) | Enable AI-assisted code implementation in Building mode | planned |
| [2026-02-01-conversation-memory.md](./2026-02-01-conversation-memory.md) | Add conversation memory and context management for chat | shipped |
| [2026-02-01-feature-files-viewer.md](./2026-02-01-feature-files-viewer.md) | UI component to browse and view feature files | shipped |
| [2026-02-01-fix-naide-folder-location.md](./2026-02-01-fix-naide-folder-location.md) | Fix .naide folder to use opened project directory instead of Documents | shipped |
| [2026-02-01-generate-app-screen.md](./2026-02-01-generate-app-screen.md) | 3-column layout with chat interface and mode selector | shipped |
| [2026-02-01-last-used-project.md](./2026-02-01-last-used-project.md) | Automatically remember and reload last opened project | shipped |
| [2026-02-01-mode-tabs-left-nav.md](./2026-02-01-mode-tabs-left-nav.md) | Replace mode dropdown with Planning/Building/Analyzing tabs | partially-implemented |
| [2026-02-01-new-chat-button.md](./2026-02-01-new-chat-button.md) | Add New Chat button to start fresh conversations | shipped |
| [2026-02-01-recent-projects-dropdown.md](./2026-02-01-recent-projects-dropdown.md) | Dropdown list of recent projects in project switcher | shipped |
| [2026-02-01-simplify-to-single-chat-screen.md](./2026-02-01-simplify-to-single-chat-screen.md) | Simplify to single chat-driven screen, remove intent capture | shipped |
| [2026-02-01-stream-copilot-responses.md](./2026-02-01-stream-copilot-responses.md) | Stream Copilot responses incrementally for better UX | shipped |
| [2026-02-02-bug-handling-conventions.md](./2026-02-02-bug-handling-conventions.md) | Establish conventions for bug reporting and tracking | shipped |
| [2026-02-03-chat-history-viewer.md](./2026-02-03-chat-history-viewer.md) | UI component to view and load previous chat sessions | shipped |
| [2026-02-03-feature-files-popup-viewer.md](./2026-02-03-feature-files-popup-viewer.md) | Popup window for viewing/editing feature files | partially-implemented |

---

## Bugs

| Bug File | Summary | Status |
|----------|---------|--------|
| [bugs/2026-02-02-fix-learnings-folder-location.md](./bugs/2026-02-02-fix-learnings-folder-location.md) | Fix learnings folder to use .prompts/learnings/ instead of .naide/learnings/ | Fixed |
| [bugs/2026-02-03-base-system-prompt-not-required.md](./bugs/2026-02-03-base-system-prompt-not-required.md) | Make base.system.md required instead of optional | Open |

---

## Status Legend

- **planned** - Feature is specified but not yet implemented
- **partially-implemented** - Feature is partially implemented, some aspects remain
- **shipped** - Feature has been implemented and merged
- **removed** - Feature has been removed (archived in `removed-features/`)
- **Fixed** - Bug has been resolved (for bugs)
- **Open** - Bug is identified but not yet fixed (for bugs)

---

## Removed Features

Removed features are archived in the `removed-features/` subdirectory and are not listed here. These files are retained for historical reference only.

---

**Note**: This index is maintained manually. When adding or modifying features, please update this file accordingly.
