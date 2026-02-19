# Installation Guide

## Prerequisites

Before installing the Naide VS Code extension, ensure you have:

1. **VS Code 1.99.0 or later**
   - Download from: https://code.visualstudio.com/

2. **GitHub Copilot extension** (with active subscription)
   - Install from VS Code Marketplace: `GitHub Copilot Chat`
   - Sign in with your GitHub account
   - Ensure you have an active Copilot subscription

## Installation Methods

### Method 1: From VSIX File (Recommended for Testing)

1. Download or locate the `naide-0.1.0.vsix` file

2. Install using command line:
   ```bash
   code --install-extension naide-0.1.0.vsix
   ```

3. Or install via VS Code UI:
   - Open VS Code
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
   - Type "Extensions: Install from VSIX..."
   - Select the `naide-0.1.0.vsix` file

4. Restart VS Code when prompted

### Method 2: From VS Code Marketplace (Future)

Once published to the marketplace:

1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "Naide"
4. Click "Install"

## Verification

To verify the extension is installed:

1. Open VS Code
2. Press `Ctrl+Shift+I` (or `Cmd+Shift+I`) to open Copilot Chat
3. Type `@naide` in the chat input
4. You should see "Naide" appear as an available participant

## Setting Up a Project

The extension works best with a properly structured Naide project:

1. Create a `.prompts/` directory in your workspace root:
   ```bash
   mkdir -p .prompts/{plan,features,learnings}
   ```

2. Optionally add project specs to `.prompts/plan/`:
   - `intent.md`
   - `app-spec.md`
   - `data-spec.md`
   - `rules.md`
   - `tasks.json`

3. Add feature specifications to `.prompts/features/` as needed

**Note**: System prompts are bundled with the extension - you don't need to copy them to your workspace.

## First Use

1. Open your workspace in VS Code
2. Open Copilot Chat (`Ctrl+Shift+I` or `Cmd+Shift+I`)
3. Try these commands:

   ```
   @naide help me understand this project
   @naide /plan add a user authentication system
   @naide /build implement the login form
   ```

## Configuration (Optional)

Customize paths in VS Code settings (`Ctrl+,` or `Cmd+,`):

```json
{
  "naide.systemPromptsPath": ".prompts/system",
  "naide.specsPath": ".prompts/plan",
  "naide.featuresPath": ".prompts/features",
  "naide.learningsPath": ".prompts/learnings"
}
```

## Troubleshooting

### Extension doesn't appear

- Ensure GitHub Copilot Chat extension is installed and active
- Restart VS Code
- Check the Output panel for errors (View → Output → Naide)

### @naide doesn't work

- Make sure you're typing in the Copilot Chat panel, not the editor
- Ensure your workspace has a `.prompts/` directory
- Check that at least `base.system.md` exists in `.prompts/system/`

### No response from @naide

- Verify GitHub Copilot is working (try regular Copilot chat)
- Check your Copilot subscription is active
- Look for errors in Developer Tools (Help → Toggle Developer Tools → Console)

## Uninstallation

To remove the extension:

```bash
code --uninstall-extension naide
```

Or use VS Code UI:
1. Go to Extensions view
2. Find "Naide"
3. Click the gear icon → Uninstall

## Support

For issues, questions, or contributions:
- GitHub Repository: https://github.com/sayedihashimi/naide
- Issues: https://github.com/sayedihashimi/naide/issues
- Documentation: See README.md in the extension directory

---

created by naide
