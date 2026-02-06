# Bug Fix: Copilot Indicator Persistence

**Issue**: Extension of #86 - Copilot waiting indicator disappearing during streaming
**Date**: 2026-02-06
**Status**: Fixed

## Problem

The copilot waiting indicator would disappear after some copilot text started printing during streaming responses. Users needed a consistent visual cue that:
1. Copilot is actively working
2. They cannot send another message
3. The system is responsive and not frozen

## Root Cause

The previous implementation relied on text-based indicators ("Copilot is thinking...") that would be replaced once streaming content started arriving. There was no persistent visual indicator on the assistant's icon itself.

## Solution

Implemented a continuous brightness pulsing animation on the blue lightbulb icon that:
- Activates when `isLoading` is true
- Applies to the last assistant message's icon
- Uses a sine wave mathematical pattern for smooth, natural movement
- Persists throughout the entire streaming response
- Only stops when `isLoading` is set to false

### Technical Details

**Animation Pattern**: 
- Sine wave with phase increment of 0.08 per 180ms interval
- Brightness range: 65% to 100%
- RGB color interpolation between two blue shades
- Both background color and opacity are modulated

**Trigger Conditions**:
```typescript
const applyWorkingVisual = message.role === 'assistant' && isLoading && finalMessageInList;
```

## Testing

Verified that:
- ✅ Icon pulses when message is being streamed
- ✅ Animation stops when streaming completes
- ✅ No performance issues with interval-based animation
- ✅ Proper cleanup when component unmounts or loading stops
- ✅ Applies to both message icons and fallback loading indicator

## Files Modified

- `src/naide-desktop/src/pages/GenerateAppScreen.tsx`
  - Added visualIntensity state and useEffect
  - Modified icon rendering to use inline styles
  - Applied to both message icons and loading indicator

## Related

- Issue #86: Original waiting indicator implementation
- Feature spec: `.prompts/features/2026-02-06-copilot-indicator-brightness.md`
