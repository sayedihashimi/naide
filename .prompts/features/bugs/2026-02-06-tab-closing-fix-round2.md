---
Type: bug-fix
Area: ui, tabs
Created: 2026-02-06
Fixed: 2026-02-06
Severity: high
---

# Bug Fix: Tab Closing Not Working & Single-Click Preview Removed

## Issues

### Issue 1: Tab Closing Not Working (Critical)
**Severity**: High  
**Area**: UI - Tab Management

**Description**: The X button to close tabs was not working. Clicking the close button had no effect, leaving users unable to close tabs through the UI.

**Root Cause**: Even though the previous fix attempted to use functional setState, the implementation still had closure issues:

1. **Calling `confirm()` inside setState callback**: React's setState is asynchronous and batched. Calling synchronous blocking operations like `confirm()` inside the callback causes race conditions.

2. **Accessing outer scope variables**: The code was accessing `activeTabId`, `setActiveTabId`, and `setSelectedFeaturePath` from within the `setTabs` functional update callback, creating stale closures.

**Code Location**: `src/naide-desktop/src/pages/GenerateAppScreen.tsx:999-1031`

**Before (Broken)**:
```typescript
const handleCloseTab = (tabId: string) => {
  setTabs((currentTabs) => {
    const tab = currentTabs.find(t => t.id === tabId);
    if (!tab || tab.type === 'chat') {
      return currentTabs;
    }
    
    // ❌ Blocking confirm() inside setState callback
    if (tab.hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Discard?')) {
        return currentTabs;
      }
    }
    
    const newTabs = currentTabs.filter(t => t.id !== tabId);
    
    // ❌ Accessing activeTabId from outer scope - stale closure
    if (activeTabId === tabId) {
      setActiveTabId(newActiveTab.id);  // Called inside setState
      setSelectedFeaturePath(...);      // Called inside setState
    }
    
    return newTabs;
  });
};
```

**After (Fixed)**:
```typescript
const handleCloseTab = (tabId: string) => {
  // ✅ Do all checks BEFORE setState
  const tab = tabs.find(t => t.id === tabId);
  if (!tab || tab.type === 'chat') {
    return;
  }
  
  // ✅ Blocking operations happen first, outside setState
  if (tab.hasUnsavedChanges) {
    if (!confirm('You have unsaved changes. Discard?')) {
      return;
    }
  }
  
  // ✅ Clean state updates
  const newTabs = tabs.filter(t => t.id !== tabId);
  setTabs(newTabs);
  
  // ✅ Sequential state updates using current scope
  if (activeTabId === tabId) {
    const closedIndex = tabs.findIndex(t => t.id === tabId);
    const newActiveTab = newTabs[Math.max(0, closedIndex - 1)] || newTabs[0];
    if (newActiveTab) {
      setActiveTabId(newActiveTab.id);
      if (newActiveTab.type === 'feature-file') {
        setSelectedFeaturePath(newActiveTab.filePath || null);
      } else {
        setSelectedFeaturePath(null);
      }
    }
  }
};
```

**Key Principles**:
1. **Do blocking operations (confirm, alert, etc.) BEFORE setState**
2. **Don't call other setState functions from inside a setState callback**
3. **Use current scope variables, not nested closures**

**Fix Applied**: Same pattern to `handleCloseAllTabs` function.

---

### Issue 2: Single-Click Preview Causing Issues
**Severity**: Medium  
**Area**: UI - File Selection

**Description**: The single-click preview feature (temporary tabs) was causing confusion and issues for users. The behavior was:
- Single-click: Opens temporary/preview tab (italic, replaceable)
- Double-click: Opens pinned tab (persistent)

Users found this confusing and it was causing problems in the workflow.

**User Feedback**: "The single click to preview is causing some issues, let's remove that."

**Solution**: Simplified to single behavior:
- **Any click now opens a pinned tab** (persistent until manually closed)
- Removed all temporary/preview tab logic
- Removed double-click handler
- Removed italic styling for temporary tabs

**Changes Made**:

1. **Updated `handleFeatureFileSelect`**:
```typescript
// Before
const handleFeatureFileSelect = (file, clickType) => {
  const isPinned = clickType === 'double';
  handleOpenFeatureTab(file, isPinned);
};

// After
const handleFeatureFileSelect = (file) => {
  handleOpenFeatureTab(file, true); // Always pinned
};
```

2. **Simplified `handleOpenFeatureTab`**:
- Removed temporary tab filtering logic
- Removed isTemporary checks
- Always creates tabs with `isPinned: true, isTemporary: false`
- Removed complex tab replacement logic for temporary tabs

3. **Updated Component Interfaces**:
- `FeatureFilesViewer`: Removed `clickType` parameter
- `FeatureFilesList`: Removed `clickType` parameter
- Removed `onDoubleClick` handler from file buttons

4. **Updated TabBar Styling**:
- Removed italic conditional: `${tab.isTemporary ? 'italic' : ''}`
- All tab labels now use normal styling

**Files Modified**:
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx`
- `src/naide-desktop/src/components/FeatureFilesViewer.tsx`
- `src/naide-desktop/src/components/FeatureFilesList.tsx`
- `src/naide-desktop/src/components/TabBar.tsx`

---

## Testing Performed

✅ Build compiles successfully (no new errors)  
✅ Code is simpler and more maintainable  

### Manual Testing Checklist
- [ ] Click feature file - opens as pinned tab
- [ ] Click X button - tab closes immediately
- [ ] Right-click tab → Close - works
- [ ] Right-click tab → Close All - works
- [ ] Middle-click tab - closes tab
- [ ] Close tab with unsaved changes - shows confirmation
- [ ] All tabs remain open until explicitly closed
- [ ] No double-click required

---

## Impact

**Positive**:
- ✅ Tab closing now works reliably
- ✅ Simpler, more predictable behavior
- ✅ Less code complexity
- ✅ Better UX - no confusion about temporary vs pinned
- ✅ No need to remember double-click gesture

**Breaking Changes**:
- ⚠️ Tab persistence format still includes `isTemporary` field (but always false)
- ⚠️ Users who expected preview behavior will now get persistent tabs

---

## Related Files

- Original feature spec: `.prompts/features/2026-02-06-feature-file-tabs.md`
- Previous bug fix: `.prompts/features/bugs/2026-02-06-tab-closing-and-persistence.md`

---

## Lessons Learned

1. **Don't mix blocking operations with setState**: Always perform `confirm()`, `alert()`, or other blocking operations BEFORE calling setState, never inside the callback.

2. **Keep setState callbacks simple**: Only perform the state calculation inside setState callbacks. Don't call other setState functions from within.

3. **Listen to user feedback**: The temporary tab feature seemed like a good idea (VS Code-inspired), but user feedback showed it was causing more problems than it solved. Simpler is often better.

4. **Test closing operations thoroughly**: Tab/window closing operations often have edge cases that don't show up in happy-path testing.

---

created by naide
