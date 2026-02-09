---
Status: planned
Area: ui, chat, editor
Created: 2026-02-09
LastUpdated: 2026-02-09
---

# Feature: Project File Link Interception
**Status**: 🟡 PLANNED

## Summary
When markdown content in the chat or file previews contains links that point to project files (e.g., `http://localhost:5173/.prompts/features/some-feature.md` or relative paths like `.prompts/features/some-feature.md`), clicking the link should open the file in the tab-based editor instead of opening a new browser tab. A global setting allows users to add custom domains that should also be treated as local project links.

---

## Goals
- Intercept clicks on links that point to project files and open them in the editor tab system
- Support both `localhost` URLs (any port) and relative path links
- Support user-defined custom domains via a global setting
- Verify file exists on disk before opening; show a tooltip error if it doesn't
- Apply everywhere markdown is rendered (chat messages, feature file previews, project file previews)

---

## Non-Goals
- Custom visual styling for project file links (keep as normal links for now; may revisit later)
- Creating new files from links (link must point to an existing file)
- Deep linking to specific line numbers within files
- Handling directory links (only files)
- Link interception for non-markdown contexts (e.g., plain text)

---

## Problem Statement
Copilot responses frequently include links to project files using localhost URLs (e.g., `http://localhost:5173/.prompts/features/2026-02-03-resizable-chat-textarea.md`). Currently, clicking these links does nothing useful — they either try to open in a browser (which may not have the dev server running) or fail silently. Users must manually find and open the referenced file, breaking their workflow.

By intercepting these links and opening the file directly in the editor, users get a seamless navigation experience between AI responses and project files.

---

## Core Behavior

### Link Recognition

A link is treated as a **project file link** if it matches any of these patterns:

1. **Localhost URL** (any port): `http://localhost:{port}/{path}` or `https://localhost:{port}/{path}`
2. **127.0.0.1 URL** (any port): `http://127.0.0.1:{port}/{path}` or `https://127.0.0.1:{port}/{path}`
3. **Relative path**: A URL that is not absolute (no protocol/host) and resolves to a file path — e.g., `.prompts/features/some-feature.md`, `src/App.tsx`
4. **Custom domain URL**: Any URL whose hostname matches an entry in the user's configured `projectLinkDomains` setting — e.g., if the user added `myapp.local`, then `http://myapp.local/src/App.tsx` is treated as a project file link

### Path Extraction

From a recognized URL, extract the **file path** portion:

- **Localhost/IP/custom domain**: Strip the protocol, host, and port. The remaining path is the relative project file path.
  - `http://localhost:5173/.prompts/features/foo.md` → `.prompts/features/foo.md`
  - `https://127.0.0.1:3000/src/App.tsx` → `src/App.tsx`
  - `http://myapp.local/src/components/Button.tsx` → `src/components/Button.tsx`
- **Relative paths**: Use the path as-is.
  - `.prompts/features/foo.md` → `.prompts/features/foo.md`
  - `src/App.tsx` → `src/App.tsx`
- **URL decoding**: Decode percent-encoded characters (e.g., `%20` → space)
- **Leading slash**: Strip any leading `/` from the extracted path to get a relative path from project root

### Click Behavior

When a user clicks a recognized project file link:

1. **Extract the relative file path** from the URL
2. **Check if the file exists** on disk by calling a backend command (e.g., `check_file_exists`)
3. **If the file exists**:
   - Determine the file type:
     - If path starts with `.prompts/features/` → open as a **feature-file** tab
     - Otherwise → open as a **project-file** tab
   - Open the file in the tab system (reuse existing tab if already open)
   - Prevent the default browser navigation
4. **If the file does not exist**:
   - Show a tooltip-style error near the link: "File not found: {path}"
   - The tooltip should auto-dismiss after 3 seconds
   - Do NOT open a browser tab or navigate away

### Where Link Interception Applies

Link interception must work **everywhere markdown is rendered**:
- Chat messages (user and assistant) in `MessageContent.tsx`
- Feature file previews in `MarkdownPreview.tsx` (used by `FeatureFileTab`)
- Project file previews (`.md` files rendered via `MarkdownPreview` in `ProjectFileTab`)

Since `MarkdownPreview` delegates to `MessageContent` for rendering, the interception logic only needs to be implemented once in the shared `<a>` component override within `MessageContent.tsx`.

---

## Global Setting: Project Link Domains

### Setting Location
Global app settings file: `naide-settings.json` (same file used for `last_used_project` and `recent_projects`)

### Setting Schema
Add a new field to `GlobalSettings`:

```json
{
  "version": 1,
  "last_used_project": { ... },
  "recent_projects": [ ... ],
  "projectLinkDomains": []
}
```

**Field details:**
- **Name**: `projectLinkDomains`
- **Type**: `string[]` (array of domain strings)
- **Default**: `[]` (empty — only localhost/127.0.0.1 are recognized by default)
- **Examples**: `["myapp.local", "dev.myapp.com", "192.168.1.100"]`
- **Case-insensitive matching**: `MyApp.Local` matches `myapp.local`

### Setting Management
- For MVP, users edit this setting manually in `naide-settings.json` or it can be set via a future settings UI
- No in-app UI for managing this setting in this feature (future enhancement)
- The setting is read on app startup and cached; changes require app restart to take effect (acceptable for MVP)

---

## Technical Implementation

### Frontend: Link Component Override (`MessageContent.tsx`)

The `<a>` component override in `createComponents()` needs to:

1. Check if the `href` matches a project file link pattern
2. If yes: intercept the click, extract the file path, verify existence, and open in tab
3. If no: keep current behavior (open in new browser tab)

**Updated `<a>` component:**

```typescript
a: ({ href, children, ...props }) => {
  const safeHref = isValidHref(href) ? href : undefined;

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!href) return;

    const projectFilePath = extractProjectFilePath(href, projectLinkDomains);
    if (!projectFilePath) return; // Not a project link, let default behavior happen

    e.preventDefault(); // Prevent browser navigation

    // Check if file exists
    const exists = await checkFileExists(projectPath, projectFilePath);
    if (exists) {
      onOpenProjectFile(projectFilePath);
    } else {
      showLinkError(e.currentTarget, `File not found: ${projectFilePath}`);
    }
  };

  return (
    <a
      {...props}
      href={safeHref}
      className="text-blue-400 hover:text-blue-300 underline"
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
    />
  );
};
```

**Key change**: `createComponents()` must accept callback props to access project context:

```typescript
interface ComponentsConfig {
  projectPath: string | null;
  projectLinkDomains: string[];
  onOpenProjectFile: (relativePath: string) => void;
}

const createComponents = (config: ComponentsConfig): Components => ({
  // ...
});
```

Since `MessageContent` currently creates components as a module-level singleton, this needs to change to per-render or memoized creation with the config as a dependency.

### New Utility: `projectLinkUtils.ts`

```typescript
// src/naide-desktop/src/utils/projectLinkUtils.ts

/**
 * Check if a URL points to a project file and extract the relative path.
 * Returns the relative file path, or null if not a project link.
 */
export function extractProjectFilePath(
  href: string,
  customDomains: string[]
): string | null {
  // Try parsing as absolute URL
  try {
    const url = new URL(href, window.location.href);

    // Check localhost or 127.0.0.1
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return decodeAndNormalizePath(url.pathname);
    }

    // Check custom domains (case-insensitive)
    if (customDomains.some(d => d.toLowerCase() === hostname)) {
      return decodeAndNormalizePath(url.pathname);
    }
  } catch {
    // Not a valid absolute URL — check if it looks like a relative file path
    if (isRelativeFilePath(href)) {
      return decodeAndNormalizePath(href);
    }
  }

  return null;
}

/**
 * Decode URL encoding and normalize the path:
 * - Decode percent-encoded characters
 * - Strip leading slash
 * - Normalize path separators to forward slashes
 */
function decodeAndNormalizePath(urlPath: string): string | null {
  try {
    let path = decodeURIComponent(urlPath);
    // Strip leading slash
    path = path.replace(/^\/+/, '');
    // Strip query string and hash
    path = path.split('?')[0].split('#')[0];
    // Normalize separators
    path = path.replace(/\\/g, '/');

    if (!path || path === '') return null;
    return path;
  } catch {
    return null;
  }
}

/**
 * Check if a string looks like a relative file path (not an external URL).
 */
function isRelativeFilePath(href: string): boolean {
  // Must not start with a protocol
  if (/^[a-z]+:\/\//i.test(href)) return false;
  // Must not start with # (anchor link)
  if (href.startsWith('#')) return false;
  // Must contain at least one path separator or file extension
  return href.includes('/') || href.includes('.');
}

/**
 * Determine if a file path should open as a feature-file or project-file tab.
 */
export function getTabType(relativePath: string): 'feature-file' | 'project-file' {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.startsWith('.prompts/features/')) {
    return 'feature-file';
  }
  return 'project-file';
}
```

### Backend: File Existence Check

**New Tauri command**: `check_file_exists`

```rust
#[tauri::command]
async fn check_file_exists(project_path: String, relative_path: String) -> Result<bool, String> {
    let full_path = Path::new(&project_path).join(&relative_path);

    // Security: ensure path is within project directory
    let canonical = match full_path.canonicalize() {
        Ok(c) => c,
        Err(_) => return Ok(false), // Path doesn't exist
    };
    let project_canonical = Path::new(&project_path).canonicalize()
        .map_err(|e| format!("Failed to resolve project path: {}", e))?;

    if !canonical.starts_with(&project_canonical) {
        return Ok(false); // Path escapes project directory
    }

    Ok(canonical.is_file())
}
```

Register in `lib.rs` invoke handler.

### Backend: Settings Extension (`settings.rs`)

Add `project_link_domains` to `GlobalSettings`:

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GlobalSettings {
    pub version: u32,
    pub last_used_project: Option<LastProject>,
    pub recent_projects: Vec<LastProject>,
    #[serde(default)]
    pub project_link_domains: Vec<String>,
}
```

The `#[serde(default)]` ensures backward compatibility — existing settings files without this field will default to an empty vec.

### Frontend: Settings Loading (`globalSettings.ts`)

Add function to load the domains:

```typescript
export async function getProjectLinkDomains(): Promise<string[]> {
  try {
    return await invoke<string[]>('get_project_link_domains');
  } catch (error) {
    console.error('Failed to load project link domains:', error);
    return [];
  }
}
```

Or alternatively, load the full settings once on startup and extract the field.

### Backend: New Tauri Command

```rust
#[tauri::command]
async fn get_project_link_domains() -> Result<Vec<String>, String> {
    let settings = read_settings().map_err(|e| e.to_string())?;
    Ok(settings.project_link_domains)
}
```

### State Management

**In `GenerateAppScreen.tsx`** (or `App.tsx`):
- Load `projectLinkDomains` on app startup
- Store in state: `const [projectLinkDomains, setProjectLinkDomains] = useState<string[]>([]);`
- Pass to `MessageContent` (and by extension `MarkdownPreview`) via props or context

**Prop threading:**
- `GenerateAppScreen` → `MessageContent` (for chat messages): pass `projectPath`, `projectLinkDomains`, and `onOpenProjectFile` callback
- `MarkdownPreview` → `MessageContent`: forward the same props
- `FeatureFileTab` / `ProjectFileTab` → `MarkdownPreview`: forward the same props

Since these props need to reach `MessageContent` through multiple layers, consider using a **React context** to avoid excessive prop drilling:

```typescript
// src/naide-desktop/src/context/ProjectLinkContext.tsx
interface ProjectLinkContextValue {
  projectPath: string | null;
  projectLinkDomains: string[];
  onOpenProjectFile: (relativePath: string) => void;
}

const ProjectLinkContext = createContext<ProjectLinkContextValue>({
  projectPath: null,
  projectLinkDomains: [],
  onOpenProjectFile: () => {},
});
```

`MessageContent` reads from this context internally — no prop changes needed for `MarkdownPreview` or tab components.

### Tooltip Error Display

When a linked file doesn't exist, show a tooltip near the clicked link:

**Implementation approach:**
- Create a lightweight tooltip component (or use a simple `div` positioned absolutely)
- On "file not found", show the tooltip anchored to the link element
- Auto-dismiss after 3 seconds
- Style: `bg-red-900 text-red-200 text-sm px-3 py-1.5 rounded shadow-lg`

**Positioning:**
- Use the link element's `getBoundingClientRect()` to position the tooltip below the link
- Use a React portal to render outside the markdown container (avoids overflow clipping)

```typescript
function showLinkError(anchor: HTMLElement, message: string) {
  const rect = anchor.getBoundingClientRect();
  // Create and position tooltip at (rect.left, rect.bottom + 4)
  // Auto-remove after 3 seconds
}
```

Alternatively, use a state-driven approach:
- Store `{ message, x, y }` in state
- Render a fixed-position tooltip component
- Clear after 3 seconds via `setTimeout`

---

## Component Changes Summary

### `MessageContent.tsx`
- Change `createComponents()` to accept a `ComponentsConfig` parameter (or read from context)
- Update `<a>` component to call `extractProjectFilePath()` on click
- If project file link: prevent default, check existence, open in tab or show error
- If not a project file link: keep existing behavior (open in new tab)

### `MarkdownPreview.tsx`
- No changes needed if using React context approach
- If using props: accept and forward `projectPath`, `projectLinkDomains`, `onOpenProjectFile` to `MessageContent`

### `GenerateAppScreen.tsx`
- Load `projectLinkDomains` from settings on startup
- Create `handleOpenFileFromLink(relativePath)` callback that:
  - Determines tab type (feature-file or project-file) based on path
  - Calls `handleOpenFeatureTab` or `handleOpenProjectTab` accordingly
- Provide `ProjectLinkContext.Provider` wrapping the center column content

### `settings.rs`
- Add `project_link_domains: Vec<String>` to `GlobalSettings` with `#[serde(default)]`
- Add `get_project_link_domains` function

### `lib.rs`
- Add `check_file_exists` Tauri command
- Add `get_project_link_domains` Tauri command
- Register both in invoke handler

### `globalSettings.ts`
- Add `getProjectLinkDomains()` function

---

## Edge Cases

### Link With Query String or Hash
- Strip query string (`?foo=bar`) and hash (`#section`) before extracting the file path
- `http://localhost:5173/src/App.tsx?v=123#line-42` → `src/App.tsx`

### Link to Directory
- If the path resolves to a directory (not a file), treat as "file not found"
- The `check_file_exists` command checks `is_file()`, not just existence

### Path Traversal Attempts
- Paths like `../../etc/passwd` are blocked by the backend's canonical path check
- The backend verifies the resolved path is within the project directory

### Empty or Invalid Paths
- `http://localhost:5173/` → path is empty after stripping → not treated as a project link
- `http://localhost:5173/..` → resolved path escapes project → treated as "not found"

### Concurrent Link Clicks
- Each click triggers an independent file existence check
- No debouncing needed (clicks are user-initiated and infrequent)

### File Opens But Is Binary
- The tab system's standard behavior handles this — binary files show a "binary file" message in the editor
- No special handling needed in the link interception logic

### Link in Edit Mode Textarea
- Links in raw markdown (textarea/Monaco editor) are plain text, not rendered HTML
- No interception occurs — this is expected and correct

### Already-Open Tab
- If the file is already open in a tab, switch to that tab (existing behavior of `handleOpenFeatureTab` / `handleOpenProjectTab`)

---

## Error Handling

### File Existence Check Fails (Tauri Error)
- Log the error
- Show tooltip: "Unable to verify file: {path}"
- Do NOT open a browser tab

### Settings Load Fails
- Fall back to empty `projectLinkDomains` array
- localhost and 127.0.0.1 still work (hardcoded)

### Invalid URL in href
- `isValidHref()` already filters these
- Non-matching links keep default behavior

---

## Acceptance Criteria

- [ ] Clicking `http://localhost:{any-port}/{path}` in chat opens the file in editor (if it exists)
- [ ] Clicking `http://127.0.0.1:{any-port}/{path}` in chat opens the file in editor (if it exists)
- [ ] Clicking relative paths (e.g., `.prompts/features/foo.md`) in chat opens the file in editor (if it exists)
- [ ] Clicking a URL matching a custom domain from `projectLinkDomains` opens the file in editor (if it exists)
- [ ] Files under `.prompts/features/` open as feature-file tabs
- [ ] All other files open as project-file tabs
- [ ] If file doesn't exist, a tooltip error "File not found: {path}" appears near the link
- [ ] Tooltip auto-dismisses after 3 seconds
- [ ] Link interception works in chat messages (MessageContent)
- [ ] Link interception works in feature file markdown previews (MarkdownPreview)
- [ ] Link interception works in project file markdown previews (ProjectFileTab)
- [ ] Non-project links (external URLs) still open in a new browser tab (unchanged)
- [ ] `projectLinkDomains` setting added to `GlobalSettings` with `#[serde(default)]`
- [ ] Empty `projectLinkDomains` by default (only localhost/127.0.0.1 recognized without config)
- [ ] Custom domains are case-insensitive
- [ ] Query strings and hashes are stripped from URLs before path extraction
- [ ] Path traversal attempts are blocked (backend security check)
- [ ] Binary files linked this way open and show the standard "binary file" message
- [ ] Already-open files switch to the existing tab instead of opening a duplicate
- [ ] App builds and all existing tests pass
- [ ] No console errors or warnings

---

## Files to Create

- `src/naide-desktop/src/utils/projectLinkUtils.ts` — URL parsing, path extraction, tab type detection
- `src/naide-desktop/src/context/ProjectLinkContext.tsx` — React context for project link config (optional; props approach is also acceptable)

## Files to Modify

### Frontend
- `src/naide-desktop/src/components/MessageContent.tsx` — Intercept link clicks, check file existence, open in editor or show error
- `src/naide-desktop/src/components/MarkdownPreview.tsx` — Forward project link props (if not using context)
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` — Load domains setting, provide context/props, add `handleOpenFileFromLink` callback

### Backend
- `src/naide-desktop/src-tauri/src/settings.rs` — Add `project_link_domains` field to `GlobalSettings`
- `src/naide-desktop/src-tauri/src/lib.rs` — Add `check_file_exists` and `get_project_link_domains` commands

### Utilities
- `src/naide-desktop/src/utils/globalSettings.ts` — Add `getProjectLinkDomains()` function

---

## Testing Strategy

### Unit Tests
- `extractProjectFilePath()`:
  - Localhost URL with path → returns relative path
  - 127.0.0.1 URL with path → returns relative path
  - Custom domain URL → returns relative path (when domain is in list)
  - External URL → returns null
  - Relative path → returns path
  - URL with query string → strips query
  - URL with hash → strips hash
  - Empty path → returns null
  - URL-encoded characters → decoded correctly
- `getTabType()`:
  - `.prompts/features/...` → `'feature-file'`
  - `src/...` → `'project-file'`
- `isRelativeFilePath()`:
  - `src/App.tsx` → true
  - `http://example.com` → false
  - `#anchor` → false

### Integration Tests
- Click localhost link with valid file → tab opens
- Click localhost link with missing file → tooltip error shown
- Click external link → opens in new browser tab (unchanged)
- Click relative path link → file opens in editor
- Custom domain in settings → domain links intercepted

### Manual Testing
- [ ] Click a localhost link in a chat message → file opens in correct tab type
- [ ] Click a relative link in a feature file preview → file opens
- [ ] Click a link to non-existent file → tooltip "File not found" appears and dismisses
- [ ] Add a custom domain to settings → links with that domain are intercepted
- [ ] External links (e.g., github.com) still open in browser
- [ ] Link in assistant response with encoded characters works correctly
- [ ] Link to a binary file → opens tab showing "binary file" message
- [ ] Link to already-open file → switches to existing tab

---

## Future Enhancements

### Visual Distinction for Project Links
- Add a small file icon or different color to project file links
- Tooltip preview showing file path on hover

### In-App Settings UI
- Add a UI panel for managing `projectLinkDomains` instead of manual JSON editing
- Per-project domain overrides

### Line Number Deep Links
- Support `#L42` or `#line-42` hash to scroll to a specific line in the editor
- Requires Monaco editor integration for line jumping

### Link Preview on Hover
- Show a small preview popup of the file content when hovering over a project link
- Similar to VS Code's peek definition

### Auto-Detection of Dev Server URLs
- When a running app is detected (e.g., Vite on port 5173), automatically treat that port's URLs as project links
- No manual domain configuration needed for the running dev server

---

## Dependencies

### Frontend
- No new packages required
- Uses existing React context, Tauri invoke, and markdown rendering infrastructure

### Backend
- No new crates required
- Uses existing `std::fs` and `std::path` for file existence checks

---

## Related Features
- [2026-02-06-feature-file-tabs.md](./2026-02-06-feature-file-tabs.md) — Tab system used to open files
- [2026-02-06-left-column-redesign.md](./2026-02-06-left-column-redesign.md) — Project file browsing
- [2026-02-08-monaco-editor-integration.md](./2026-02-08-monaco-editor-integration.md) — Editor for opened files
- [2026-02-01-generate-app-screen.md](./2026-02-01-generate-app-screen.md) — Chat UI where links appear

---

created by naide
