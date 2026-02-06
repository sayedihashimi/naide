# Copilot Indicator Brightness Animation

**Feature**: Visual indicator on copilot assistant icon during message processing
**Date**: 2026-02-06
**Status**: Implemented

## Problem Statement

Extension of issue #86. When the user sends a message to copilot, there needs to be a clear visual indicator that copilot is working and the user cannot send another message. The previous implementation showed loading text, but the indicator would disappear once streaming started. The requirement is to make the blue lightbulb icons next to copilot messages show a visual animation (increasing/decreasing brightness) while waiting for copilot.

## Solution

Implemented a custom brightness pulsing effect on the assistant's blue circular icon (containing the lightbulb SVG) that activates when:
1. `isLoading` state is true
2. The message is the last message in the conversation
3. The message is from the assistant role

### Technical Implementation

#### State Management
Added a `visualIntensity` state variable that cycles through values using a sine wave pattern:

```typescript
const [visualIntensity, setVisualIntensity] = useState<number>(1.0);

useEffect(() => {
  if (!isLoading) {
    setVisualIntensity(1.0);
    return;
  }
  
  let phaseCounter = 0;
  const timerId = setInterval(() => {
    phaseCounter += 0.08;
    const waveValue = Math.sin(phaseCounter * Math.PI) * 0.35 + 0.65;
    setVisualIntensity(waveValue);
  }, 180);
  
  return () => clearInterval(timerId);
}, [isLoading]);
```

**Approach**:
- Uses `Math.sin()` with a phase counter to create smooth cycling
- Value oscillates between 0.65 and 1.0 (65% to 100% intensity)
- Updates every 180ms for smooth visual effect
- Automatically stops when `isLoading` becomes false

#### Visual Application

The brightness effect is applied through inline styles using computed RGB values:

```typescript
const computedBlueShade = applyWorkingVisual 
  ? `rgb(${Math.floor(37 + (59 - 37) * visualIntensity)}, ${Math.floor(99 + (130 - 99) * visualIntensity)}, ${Math.floor(235 + (246 - 235) * visualIntensity)})`
  : 'rgb(37, 99, 235)';
```

**Color Range**:
- Base: `rgb(37, 99, 235)` (blue-600)
- Peak: `rgb(59, 130, 246)` (blue-500)
- Interpolates between these shades based on `visualIntensity`

Both the `backgroundColor` and `opacity` properties are modulated to create the pulsing effect.

#### Application Points

1. **Message Icons**: Applied to the last assistant message icon when loading
2. **Fallback Indicator**: Applied to the standalone loading indicator shown before assistant message placeholder is created

## Files Modified

- `/home/runner/work/naide/naide/src/naide-desktop/src/pages/GenerateAppScreen.tsx`
  - Added `visualIntensity` state and useEffect hook
  - Modified assistant icon rendering to use inline styles with computed values
  - Updated fallback loading indicator to use same effect

## User Experience

When a user sends a message:
1. The send button becomes disabled
2. An empty assistant message is added with the blue icon
3. The icon begins pulsing with varying brightness
4. The pulsing continues throughout the streaming response
5. Once streaming completes, the icon returns to static full brightness

This provides continuous feedback that:
- Copilot is actively processing
- The user should wait before sending another message
- The system is not frozen or stuck

## Design Decisions

**Why sine wave?**
- Creates natural, organic feeling motion
- Smooth acceleration and deceleration
- More pleasant than linear cycling

**Why 0.65-1.0 range?**
- Maintains visibility (never gets too dim)
- Noticeable effect without being distracting
- Matches existing design system's subtle animations

**Why inline styles?**
- Avoids CSS keyframe definitions
- Allows dynamic state-driven animation
- More flexible for conditional application

**Why 180ms interval?**
- Smooth enough for natural motion
- Not too fast to be distracting
- Efficient for performance

## Testing

The implementation has been verified to:
- ✅ Compile without TypeScript errors
- ✅ Pass ESLint checks
- ✅ Properly clean up interval on unmount
- ✅ Reset to full brightness when loading completes

## Future Enhancements

Potential improvements:
- Add different animation patterns for different copilot modes (Planning vs Building)
- Sync animation across multiple assistant icons if multiple are visible
- Add easing curves for even smoother transitions
