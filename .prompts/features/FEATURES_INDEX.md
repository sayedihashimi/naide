# Features Index

This index provides a chronological overview of all feature files in `.prompts/features/`. Features are listed from oldest to newest based on creation date.

**Last Updated**: 2026-02-17

---

## Active Features

| Feature File | Summary | Status |
|--------------|---------|--------|
| [2026-02-01-add-copilot-integration.md](./2026-02-01-add-copilot-integration.md) | Initial Copilot SDK + CLI integration for Planning mode | shipped |
| [2026-02-01-add-file-logger.md](./2026-02-01-add-file-logger.md) | Add persistent file logging to backend and sidecar | shipped |
| [2026-02-01-building-mode.md](./2026-02-01-building-mode.md) | Enable AI-assisted code implementation in Building mode | shipped |
| [2026-02-01-conversation-memory.md](./2026-02-01-conversation-memory.md) | Add conversation memory and context management for chat | shipped |
| [2026-02-01-feature-files-viewer.md](./2026-02-01-feature-files-viewer.md) | UI component to browse and view feature files | shipped |
| [2026-02-01-fix-naide-folder-location.md](./2026-02-01-fix-naide-folder-location.md) | Fix .naide folder to use opened project directory instead of Documents | shipped |
| [2026-02-01-generate-app-screen.md](./2026-02-01-generate-app-screen.md) | 3-column layout with chat interface and mode selector | shipped |
| [2026-02-01-last-used-project.md](./2026-02-01-last-used-project.md) | Automatically remember and reload last opened project | shipped |
| [2026-02-01-new-chat-button.md](./2026-02-01-new-chat-button.md) | Add New Chat button to start fresh conversations | shipped |
| [2026-02-01-recent-projects-dropdown.md](./2026-02-01-recent-projects-dropdown.md) | Dropdown list of recent projects in project switcher | shipped |
| [2026-02-01-simplify-to-single-chat-screen.md](./2026-02-01-simplify-to-single-chat-screen.md) | Simplify to single chat-driven screen, remove intent capture | shipped |
| [2026-02-01-stream-copilot-responses.md](./2026-02-01-stream-copilot-responses.md) | Stream Copilot responses incrementally for better UX | shipped |
| [2026-02-02-bug-handling-conventions.md](./2026-02-02-bug-handling-conventions.md) | Establish conventions for bug reporting and tracking | shipped |
| [2026-02-03-ai-activity-status-display.md](./2026-02-03-ai-activity-status-display.md) | Real-time AI operation status via WebSocket | shipped |
| [2026-02-03-chat-history-viewer.md](./2026-02-03-chat-history-viewer.md) | UI component to view and load previous chat sessions | shipped |
| [2026-02-03-resizable-chat-textarea.md](./2026-02-03-resizable-chat-textarea.md) | Drag-to-resize chat textarea height | not-implemented |
| [2026-02-04-delete-chat-sessions.md](./2026-02-04-delete-chat-sessions.md) | Delete archived chat sessions with soft-delete to trash | implemented |
| [2026-02-04-resizable-running-app-column.md](./2026-02-04-resizable-running-app-column.md) | Resizable right column for running app preview | shipped |
| [2026-02-04-search-learnings-tool.md](./2026-02-04-search-learnings-tool.md) | On-demand learnings search via Copilot SDK tool | implemented |
| [2026-02-04-support-running-apps.md](./2026-02-04-support-running-apps.md) | Run npm and .NET apps with iframe preview | implemented |
| [2026-02-05-copilot-working-indicator.md](./2026-02-05-copilot-working-indicator.md) | Brightness pulsing animation on assistant icon during processing | implemented |
| [2026-02-06-app-selector-dropdown.md](./2026-02-06-app-selector-dropdown.md) | Dropdown to choose which app to run when multiple detected | implemented |
| [2026-02-06-copilot-indicator-brightness.md](./2026-02-06-copilot-indicator-brightness.md) | Visual brightness animation on copilot icon during processing | implemented |
| [2026-02-06-feature-file-tabs.md](./2026-02-06-feature-file-tabs.md) | Tabbed feature file viewer replacing popup modal | implemented |
| [2026-02-06-left-column-redesign.md](./2026-02-06-left-column-redesign.md) | Remove navigation, add Features + Files sections in left column | implemented |
| [2026-02-06-remove-recent-project.md](./2026-02-06-remove-recent-project.md) | Remove project from recent projects list | implemented |

## Planned Features

| Feature File | Summary | Status |
|--------------|---------|--------|
| [2026-02-09-favorite-chat-sessions.md](./2026-02-09-favorite-chat-sessions.md) | Favorite chat sessions with star icon for quick access | planned |
| [2026-02-03-adaptive-learnings-index.md](./2026-02-03-adaptive-learnings-index.md) | Auto-indexing for large learning sets | planned |
| [2026-02-06-project-file-watcher.md](./2026-02-06-project-file-watcher.md) | Watch project folder for new runnable apps | planned |
| [2026-02-08-monaco-editor-integration.md](./2026-02-08-monaco-editor-integration.md) | Monaco Editor for syntax highlighting, line numbers, and rich editing | planned |
| [2026-02-08-terminal-command-output-in-chat.md](./2026-02-08-terminal-command-output-in-chat.md) | Show terminal command output inline in chat as collapsible blocks | planned |
| [2026-02-09-project-file-link-interception.md](./2026-02-09-project-file-link-interception.md) | Intercept project file links in chat/previews and open in editor tabs | planned |
| [2026-02-10-auto-mode.md](./2026-02-10-auto-mode.md) | Auto mode — Copilot infers planning vs building intent | planned |
| [2026-02-17-naide-vscode-extension.md](./2026-02-17-naide-vscode-extension.md) | Naide as a VS Code Copilot Chat participant extension | planned |

## Superseded Features

| Feature File | Summary | Superseded By |
|--------------|---------|---------------|
| [2026-02-01-mode-tabs-left-nav.md](./2026-02-01-mode-tabs-left-nav.md) | Replace mode dropdown with left nav tabs | [left-column-redesign](./2026-02-06-left-column-redesign.md) |
| [2026-02-03-feature-files-popup-viewer.md](./2026-02-03-feature-files-popup-viewer.md) | Popup window for feature files | [feature-file-tabs](./2026-02-06-feature-file-tabs.md) |

---

## Bugs

| Bug File | Summary | Status |
|----------|---------|--------|
| [bugs/2026-02-02-fix-learnings-folder-location.md](./bugs/2026-02-02-fix-learnings-folder-location.md) | Fix learnings folder to use .prompts/learnings/ | Fixed |
| [bugs/2026-02-03-base-system-prompt-not-required.md](./bugs/2026-02-03-base-system-prompt-not-required.md) | Make base.system.md required instead of optional | Open |
| [bugs/2026-02-03-feature-viewer-not-refreshing.md](./bugs/2026-02-03-feature-viewer-not-refreshing.md) | Feature viewer not refreshing after file changes | Fixed |
| [bugs/2026-02-03-status-messages-show-relative-paths.md](./bugs/2026-02-03-status-messages-show-relative-paths.md) | Status messages showing absolute instead of relative paths | Fixed |
| [bugs/2026-02-04-npm-app-detection-not-implemented.md](./bugs/2026-02-04-npm-app-detection-not-implemented.md) | npm app detection not implemented | Fixed |
| [bugs/2026-02-04-npm-command-not-passed-to-backend.md](./bugs/2026-02-04-npm-command-not-passed-to-backend.md) | npm command not passed to backend | Fixed |
| [bugs/2026-02-04-proxy-url-escaping-error.md](./bugs/2026-02-04-proxy-url-escaping-error.md) | Proxy URL escaping error with trailing slashes | Fixed |
| [bugs/2026-02-05-npm-app-detection-subdirectory.md](./bugs/2026-02-05-npm-app-detection-subdirectory.md) | npm detection only checking project root | Fixed |
| [bugs/2026-02-05-npm-app-epipe-on-hot-reload.md](./bugs/2026-02-05-npm-app-epipe-on-hot-reload.md) | EPIPE crash on hot reload | Fixed |
| [bugs/2026-02-05-npm-app-restart-loses-command.md](./bugs/2026-02-05-npm-app-restart-loses-command.md) | npm app restart loses command | Fixed |
| [bugs/2026-02-05-npm-app-stop-not-killing-processes.md](./bugs/2026-02-05-npm-app-stop-not-killing-processes.md) | Stop button not killing child processes | Fixed |
| [bugs/2026-02-06-copilot-indicator-persistence.md](./bugs/2026-02-06-copilot-indicator-persistence.md) | Copilot indicator not clearing properly | Fixed |
| [bugs/2026-02-06-doubleclick-and-closing-fix.md](./bugs/2026-02-06-doubleclick-and-closing-fix.md) | Double-click and tab closing fixes | Fixed |
| [bugs/2026-02-06-duplicate-log-files.md](./bugs/2026-02-06-duplicate-log-files.md) | Duplicate log files created per run | Fixed |
| [bugs/2026-02-06-excessive-tab-saves.md](./bugs/2026-02-06-excessive-tab-saves.md) | Tab persistence flooding with saves | Fixed |
| [bugs/2026-02-06-infinite-loop-tab-close.md](./bugs/2026-02-06-infinite-loop-tab-close.md) | Infinite loop from useEffect deps preventing tab close | Fixed |
| [bugs/2026-02-06-tab-closing-and-persistence.md](./bugs/2026-02-06-tab-closing-and-persistence.md) | Tab closing not working (round 1) | Fixed |
| [bugs/2026-02-06-tab-closing-fix-round2.md](./bugs/2026-02-06-tab-closing-fix-round2.md) | Tab closing not working (round 2) | Fixed |

---

## Status Legend

- **shipped** / **implemented** - Feature has been implemented and merged
- **planned** - Feature is specified but not yet implemented
- **superseded** - Feature replaced by a different approach
- **removed** - Feature has been removed (archived in `removed-features/`)
- **Fixed** - Bug has been resolved
- **Open** - Bug is identified but not yet fixed

---

## Removed Features

Removed features are archived in the `removed-features/` subdirectory and are not listed here. These files are retained for historical reference only.

---

**Note**: This index is maintained manually. When adding or modifying features, please update this file accordingly.
