---
Type: bug-fix
Area: ui, tabs
Created: 2026-02-06
Fixed: 2026-02-06
Severity: high
---

# Bug Fix: Tab Closing Issues and Missing Tab Persistence

## Issues

### Issue 1: Tab Closing Not Working
**Severity**: High  
**Area**: UI - Tab Bar

**Description**: Clicking the close button (×) on feature file tabs, using the context menu "Close" option, or middle-clicking tabs did not close the tabs as expected.

**Root Cause**: The `handleCloseTab` and `handleCloseAllTabs` functions were using stale closure over the `tabs` state variable. When these functions were called from child components or after state updates, they referenced an outdated version of the tabs array.

**Code Location**: `src/naide-desktop/src/pages/GenerateAppScreen.tsx:952-981`

**Before**:
```typescript
const handleCloseTab = (tabId: string) => {
  const tab = tabs.find(t => t.id === tabId);  // ❌ Stale closure
  // ...
  const newTabs = tabs.filter(t => t.id !== tabId);  // ❌ Stale closure
  setTabs(newTabs);
  // ...
}
```

**After**:
```typescript
const handleCloseTab = (tabId: string) => {
  setTabs((currentTabs) => {  // ✅ Functional update
    const tab = currentTabs.find(t => t.id === tabId);
    // ...
    const newTabs = currentTabs.filter(t => t.id !== tabId);
    return newTabs;
  });
}
```

**Fix**: Used functional setState pattern `setTabs((currentTabs) => ...)` to ensure the functions always work with the most current state.

---

### Issue 2: Tabs Not Cleared on Project Switch
**Severity**: Medium  
**Area**: UI - Project Management

**Description**: When switching between projects, the feature file tabs from the previous project remained open, showing files from the old project context.

**Expected Behavior**: When switching projects, all feature file tabs should be closed, leaving only the Generate App (chat) tab.

**Code Location**: 
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx:789` - `handleOpenProjectFolder`
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx:842` - `handleSelectRecentProject`

**Fix**: 
1. Created `resetTabsToChat()` helper function that:
   - Keeps only the chat tab
   - Sets chat tab as active
   - Clears selected feature path
2. Called `resetTabsToChat()` in both project switching functions
3. Added tab persistence before resetting (see Issue 3)

---

### Issue 3: Missing Tab Persistence (New Requirement)
**Severity**: Medium  
**Area**: UI - Tab State Management

**Description**: When reopening a project, previously open tabs were not restored. Users had to manually reopen all the feature files they were working on.

**Expected Behavior**: 
- When switching away from a project, save which tabs were open
- When returning to a project, restore those tabs
- Preserve which tab was active

**Implementation**:

1. **Created new utility** - `src/naide-desktop/src/utils/tabPersistence.ts`:
   - `loadOpenTabs(projectPath)` - Load saved tabs from project config
   - `saveOpenTabs(projectPath, tabsState)` - Save tabs to project config
   - `clearOpenTabs(projectPath)` - Clear saved tabs
   - Storage location: `.naide/project-config.json`

2. **Data Structure**:
```typescript
interface PersistedTabsState {
  tabs: PersistedTab[];  // Array of tab info (id, type, label, filePath, isPinned, isTemporary)
  activeTabId: string;    // Which tab was active
}
```

3. **Save Triggers**:
   - On tab changes (debounced 1 second)
   - When switching projects
   - On component unmount

4. **Restore Triggers**:
   - After successfully loading a project

5. **Edge Cases Handled**:
   - Files that no longer exist (filtered out during restore)
   - Missing/invalid config file (graceful fallback)
   - Active tab no longer exists (defaults to chat tab)

---

## Testing Performed

✅ Build compiles successfully (no new TypeScript errors)  
✅ Code review passed  
✅ Security scan passed  

### Manual Testing Checklist
- [ ] Tab close button works
- [ ] Context menu "Close" works
- [ ] Context menu "Close All" works
- [ ] Middle-click close works
- [ ] Unsaved changes warning shows on close
- [ ] Project switch clears tabs
- [ ] Project switch saves tabs
- [ ] Project reopen restores tabs
- [ ] Active tab is restored correctly
- [ ] Deleted files are filtered out on restore

---

## Files Changed

### New Files
- `src/naide-desktop/src/utils/tabPersistence.ts` (127 lines)

### Modified Files
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx`:
  - Fixed `handleCloseTab` function (line ~952)
  - Fixed `handleCloseAllTabs` function (line ~986)
  - Added `resetTabsToChat` helper (line ~1010)
  - Added `saveTabsToProject` function (line ~1023)
  - Added `loadTabsFromProject` function (line ~1045)
  - Updated `handleOpenProjectFolder` (line ~789)
  - Updated `handleSelectRecentProject` (line ~842)
  - Added debounced save useEffect (line ~280)
  - Added unmount save useEffect (line ~293)
  - Added import for tabPersistence (line 23)

---

## Related Documentation
- Feature spec: `.prompts/features/2026-02-06-feature-file-tabs.md`
- Pattern reference: `src/naide-desktop/src/utils/appSelection.ts`

---

## Lessons Learned

1. **Always use functional setState when new state depends on previous state**, especially when:
   - Functions are passed to child components
   - Functions may be called in quick succession
   - State updates may be batched by React

2. **Follow established patterns** in the codebase:
   - Used same structure as `appSelection.ts` for consistency
   - Saved to same config file (`.naide/project-config.json`)
   - Non-fatal error handling (persistence failures don't break app)

3. **Debounce frequent saves** to avoid excessive file I/O
   - 1 second debounce on tab changes
   - Immediate save on critical events (project switch, unmount)

---

created by naide
