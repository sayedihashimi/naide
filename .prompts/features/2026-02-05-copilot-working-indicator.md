# Feature: Improved Copilot Working Indicator

**Date:** 2026-02-05  
**Status:** Implemented  
**Issue:** Make it more clear when copilot is working

## Problem Statement

In some cases where it's taking Copilot a while to respond, it's not clear to the user that Copilot is still working. Users were seeing a generic "Starting..." message that didn't provide enough feedback about what was happening.

The existing 10-second timeout on status messages was being applied too broadly, potentially hiding messages while users were still waiting for a response.

## Solution

### Changes Made

1. **Improved Initial Loading Message**
   - Changed "Starting..." to "Copilot is thinking..."
   - This provides clearer feedback that the AI is actively processing the request
   - Location: `src/naide-desktop/src/pages/GenerateAppScreen.tsx` (loading indicator section)

2. **Added Empty Response Indicator**
   - When streaming begins and the assistant message placeholder is created but empty
   - Shows "Copilot is working on your request..." with a pulsing animation
   - This fills the gap between when the request is sent and when content starts streaming
   - Location: `src/naide-desktop/src/pages/GenerateAppScreen.tsx` (message rendering logic)

### How It Works

**Flow:**
1. User sends a message
2. Loading indicator shows: "Copilot is thinking..." (before assistant placeholder is created)
3. Empty assistant message is created for streaming
4. Empty message shows: "Copilot is working on your request..." (pulsing animation)
5. As content streams in, it replaces the placeholder text
6. ActivityStatusBar continues to show detailed progress (file operations, API calls, etc.)
7. When session completes, ActivityStatusBar auto-hides after 10 seconds

**Existing Behavior Preserved:**
- The 10-second auto-hide timeout correctly applies ONLY after `session_complete` event
- This was already implemented correctly and was not changed
- ActivityStatusBar shows detailed status events during Copilot operations

## Technical Details

### Files Modified
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx`
  - Line ~1200: Updated loading indicator text
  - Line ~1175: Added conditional rendering for empty assistant messages

### UI States

1. **Pre-Request**: No indicator
2. **Request Sent** (before streaming setup): "Copilot is thinking..."
3. **Streaming Setup** (empty assistant message): "Copilot is working on your request..." (pulsing)
4. **Streaming Active**: Content appears in real-time
5. **Complete**: Message displayed, ActivityStatusBar shows completion
6. **Post-Complete** (after 10 seconds): ActivityStatusBar auto-hides

## Testing

- All existing tests pass (25 test suites, 159 tests)
- Manual testing recommended to verify visual improvements
- The changes are minimal and don't alter the core streaming logic

## Notes

- The ActivityStatusBar was already functioning correctly and provides detailed feedback
- The 10-second timeout was already correctly implemented to only apply after completion
- These changes focus on the initial waiting period which was the actual UX gap
