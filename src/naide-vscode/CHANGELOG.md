# Changelog

All notable changes to the Naide VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-17

### Added
- Initial release of Naide VS Code extension
- Chat participant registration (`@naide`)
- Slash commands: `/plan`, `/build`, `/analyze`
- Auto mode (default when no slash command is used)
- System prompt loading from `.prompts/system/`
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
