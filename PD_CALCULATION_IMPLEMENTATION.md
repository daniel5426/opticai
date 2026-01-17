# PD Calculation Implementation

## Overview

This document explains the implementation of the Pupillary Distance (PD) field calculation feature and the remaining issues that need to be addressed.

## What Was Implemented

### 1. Shared PD Calculation Utility

Created a centralized utility function `PDCalculationUtils.handlePDChange` in `src/components/exam/data/exam-constants.ts` to handle PD field calculations across all exam tabs. This eliminates code duplication and ensures consistent behavior.

**Key Features:**
- When updating R or L eye: Calculates the sum (R + L) and updates the combined (C) field
- When updating combined (C) field: Divides the value by 2 and updates both R and L fields
- Supports three field types: `pd_far`, `pd_close`, and `pd`

### 2. Immediate Updates

Added `debounceMs={0}` to all PD field inputs across the following exam tabs to make updates immediate:
- `OldRefractionExtensionTab.tsx` - for `pd_far` and `pd_close` fields
- `SubjectiveTab.tsx` - for `pd_far` and `pd_close` fields
- `FinalSubjectiveTab.tsx` - for `pd_far` and `pd_close` fields
- `RetinoscopTab.tsx` - for `pd_far` and `pd_close` fields
- `RetinoscopDilationTab.tsx` - for `pd_far` and `pd_close` fields
- `FinalPrescriptionTab.tsx` - for `pd` field

This removes the 1500ms debounce delay that was causing noticeable lag in PD field updates.

### 3. Calculation Logic

The utility function:
1. Reads the current value of the other eye from the `data` prop
2. Uses the new value for the eye being changed
3. Calculates the sum before updating fields
4. Updates only the changed eye field and the combined field (never the other eye)

## Current Status: NOT WORKING

**The PD calculation feature is currently broken and causes an infinite update loop.**

### Current Issue: Infinite Update Loop

**Problem:** When changing any PD field, an infinite loop occurs where:
1. The combined (middle) field changes
2. This triggers the eye fields to change
3. Which triggers the combined field to change again
4. This cycle repeats infinitely, causing the application to crash with "Maximum update depth exceeded"

**Error Message:**
```
flushSync was called from inside a lifecycle method. React cannot flush when React is already rendering.
Error: Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.
```

**Root Cause:**
The issue occurs because:
1. Multiple `onChange` calls are made synchronously (e.g., updating eye field and combined field)
2. Each `onChange` triggers `flushSync` in the `OptimizedInput` component
3. React batches these updates, but the multiple `flushSync` calls during a render cycle cause React to enter an infinite loop
4. Each update triggers a re-render, which triggers another update, creating a feedback loop

## Previous Issues (Still Present)

### Issue 1: Other Eye Gets Updated Incorrectly

**Problem:** When changing one eye's PD value (R or L), the other eye's value is also being changed, which should not happen.

**Expected Behavior:**
- Changing R should only update R and the combined field
- Changing L should only update L and the combined field
- The other eye should remain unchanged

**Additional Context:**
- When editing the combined field first, then editing individual eye fields, the calculation works correctly (but still causes the loop)
- After deleting and re-editing, the lag disappears, but the loop persists

### Issue 2: Initial Value Bug (9.9/19.9)

**Problem:** When first changing a PD field to 15 (the minimum value), there's a brief bug where:
- Each eye shows 9.9
- Combined field shows 19.9
- After a second, it corrects itself
- Subsequent changes work correctly and react immediately

**Expected Behavior:**
- Setting R to 15 should show R=15, L=unchanged, Combined=15+L
- No intermediate incorrect values should appear

## Attempted Fixes

### Attempt 1: Direct Data Reading
**What was tried:**
- Changed from using `getRValue`/`getLValue` functions to reading directly from `data[rField]` and `data[lField]`
- Improved empty value handling with explicit checks

**Result:** Still caused the loop. Reading from `data` prop was stale due to React batching.

### Attempt 2: Value Normalization
**What was tried:**
- Normalized both eye values before calculation using `Number(newEyeVal.toFixed(1))` and `Number(otherEyeVal.toFixed(1))`
- Ensured consistent decimal formatting

**Result:** Still caused the loop. Normalization didn't address the core issue of multiple synchronous `onChange` calls.

### Attempt 3: Deferred Updates with setTimeout
**What was tried:**
- Used `setTimeout(..., 0)` to defer secondary updates (combined field update when editing eyes, R/L updates when editing combined)
- Attempted to break the synchronous update chain

**Result:** Still causes infinite loop. The deferred updates still trigger `flushSync` in the next event loop, which still conflicts with React's render cycle.

## Technical Details

### Current Implementation Flow (Broken)

When updating R or L eye:
1. Parse the new value
2. Read the other eye's current value from `data` prop using `getRValue`/`getLValue`
3. Calculate sum = newEyeValue + otherEyeValue
4. Immediately update the changed eye field with `onChange(eyeField, value)`
5. Defer combined field update with `setTimeout(() => onChange(combField, sum), 0)`

When updating C (combined) field:
1. Parse the combined value
2. Divide by 2 to get half value
3. Immediately update combined field with `onChange(combField, value)`
4. Defer R and L updates with `setTimeout(() => { onChange(rField, halfValue); onChange(lField, halfValue); }, 0)`

**Problem:** Even with `setTimeout`, the deferred `onChange` calls still use `flushSync` inside `OptimizedInput`, which causes React to throw errors when called during render cycles.

### Architecture Challenge

The core architectural issue is:
- `OptimizedInput` uses `flushSync` to ensure immediate updates (required for `debounceMs={0}`)
- `PDCalculationUtils.handlePDChange` needs to call `onChange` multiple times (eye + combined)
- Multiple `onChange` calls with `flushSync` during a render cycle causes React to enter an infinite loop
- The `data` prop is stale during calculation because React batches state updates
- We cannot access the latest state during calculation because functional updates are handled in the parent component


## Files Modified

- `src/components/exam/data/exam-constants.ts` - Added `PDCalculationUtils`
- `src/components/exam/OldRefractionExtensionTab.tsx` - Added immediate debounce for PD fields
- `src/components/exam/SubjectiveTab.tsx` - Added immediate debounce for PD fields
- `src/components/exam/FinalSubjectiveTab.tsx` - Added immediate debounce for PD fields
- `src/components/exam/RetinoscopTab.tsx` - Added immediate debounce for PD fields
- `src/components/exam/RetinoscopDilationTab.tsx` - Added immediate debounce for PD fields
- `src/components/exam/FinalPrescriptionTab.tsx` - Added immediate debounce for PD field

## Testing Recommendations

When fixing the issues, test the following scenarios:
1. Set R to 15 (minimum) - verify L doesn't change and combined shows correct value (no loop)
2. Set L to 20 - verify R doesn't change and combined shows correct value (no loop)
3. Set combined to 60 - verify both R and L become 30 (no loop)
4. Clear one eye - verify the other eye and combined update correctly (no loop)
5. Rapidly change values - verify no race conditions, incorrect intermediate states, or loops
6. Edit combined field first, then edit individual eyes - verify no loop occurs
7. Delete and re-edit fields - verify behavior is consistent

## Notes

- The feature was intended to work with `debounceMs={0}` for immediate updates
- `OptimizedInput` component uses `flushSync` internally, which conflicts with multiple synchronous `onChange` calls
- React's state batching makes it difficult to access the latest state during calculation
- The infinite loop suggests the approach needs to be fundamentally reconsidered, possibly requiring changes to how `OptimizedInput` handles updates or how the PD calculation utility interacts with the state update mechanism
