# Changelog

All notable changes to the Naide VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Conversation context support: Extension now maintains full conversation history within a chat session
- Previous messages from the same chat are included when sending requests to the language model
- LICENSE file added to extension directory (resolves packaging warning)
- **Tool invocation support**: Language model can now create and edit files in the workspace
- Multi-round tool execution: Handles tool calls from the language model and returns results

### Changed
- System prompts are now bundled with the extension instead of being loaded from workspace
- Removed `naide.systemPromptsPath` configuration setting (system prompts are always bundled)
- Default mode is now Planning (when no slash command is specified)
- Package size increased to 37.62 KB (from initial 15.91 KB)
- Switched from streaming `.text` to `.stream` to handle both text and tool call parts

### Removed
- Auto mode support and `auto.system.md` system prompt
- Analyzing mode support and `analyzing.system.md` system prompt
- `/analyze` slash command

## [0.1.0] - 2026-02-17

### Added
- Initial release of Naide VS Code extension
- Chat participant registration (`@naide`)
- Slash commands: `/plan`, `/build`
- System prompt loading (bundled with extension)
- Specification file loading from `.prompts/plan/`
- Feature file loading from `.prompts/features/`
- `search_learnings` language model tool
- Configuration settings for custom paths
- Full TypeScript implementation with strict mode
- Comprehensive README with usage instructions

### Features
- Reuses existing Naide project structure and system prompts
- Integrates seamlessly with VS Code's native UI
- Works with GitHub Copilot Chat
- Provides project-aware AI assistance
- Supports professional developer workflows

[0.1.0]: https://github.com/sayedihashimi/naide/releases/tag/v0.1.0
