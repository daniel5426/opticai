# Feature Design: Missing Axis Warning

## Overview

The **Missing Axis Warning** feature provides immediate visual feedback to the clinician when an incomplete cylinder refraction is detected. This is a critical validation step in optometry, as a cylinder value is meaningless without an axis, and an axis value is meaningless without a power (cylinder).

The feature manifests as:
1.  **Red Border**: A red ring around the flagged input field.
2.  **Notification Badge**: A label ("חסר Axis" or "חסר Cyl") floating above the field.
3.  **Bidirectional Logic**: The warning appears instantaneously when:
    - **Missing Axis**: A CYL value (e.g., -0.25) is entered but the Axis is empty.
    - **Missing Cyl**: An Axis value (e.g., 90) is entered but the Cylinder is empty (or 0).

## Technical Implementation

### The Challenge: Performance vs. Responsiveness
Most exam cards use `FastInput` (a debounced input wrapper) to handle large forms performantly. However, using `FastInput` for this feature caused significant UX issues:
- **Lag**: The warning would not appear until the debounce period ended (1.5s), feeling sluggish.
- **Data Latency**: Typing quickly caused state synchronization issues, leading to "reappearing text" bugs when delete/backspace was used.
- **Large Page Lag**: On pages with 30+ cards, switching to full "Direct Input" (standard React state) can cause typing lag if every keystroke triggers a full-page re-render.

### The Solution: The "Hybrid Responsiveness" Pattern
To achieve both data stability and instant feedback without sacrificing performance, we implemented a three-layer strategy.

#### 1. Direct Input Control (Stability)
For **Cylinder** and **Axis** fields, we bypass `FastInput` and use the standard `Input` component, controlled directly by the parent's prop data.
- **Why**: This ensures 1:1 data binding. There is no intermediate buffer, effectively ending "stuttering" or value resets during fast edits.

#### 2. Optimistic Local State (Responsiveness)
We use a local React state (`fieldWarnings`) to track errors for each eye.
- **How**: Within the `handleChange` function, we calculate the warning logic *locally* using the latest value before doing the persistent state update.
- **Advantage**: The UI highlights the error within 1ms of the keystroke, long before the database or global state would have finished processing.

#### 3. Dual Event Listening
We attach both `onChange` and `onInput` listeners to the `Input` component.
- **Why**: Custom stepper buttons (up/down arrows) in our `Input` component dispatch native `input` events. React's `onChange` doesn't always capture these cleanly. Listening to both ensures the warning updates regardless of how the value changed.

---

## Large Page Performance Strategy

To maintain high performance on complex pages where 100+ inputs might exist, we implemented the following architectural safeguards:

### 1. Stable Handlers (ExamDetailPage)
We stabilized the `fieldHandlers` object identity in the top-level page components.
- **Mechanism**: Use `useMemo` with `useRef` for state dependencies (`examFormData`, `activeInstanceId`). 
- **Impact**: The functions passed down the component tree never change their reference. This is the prerequisite for effective memoization of child cards.

### 2. Smart Memoization (ExamCardRenderer)
We wrapped `ExamCardRenderer` in `React.memo` with a **custom comparison function**.
- **Mechanism**: The comparator checks if the `examFormData` changes *only for the specific card being edited*.
- **Impact**: Typing in the "Old Refraction" card now prevents the "Subjective", "Addition", and "Notes" cards from re-rendering entirely. Re-renders are localized to the active card.

---

## Globalization Strategy

To implement this universally across all cards (`FinalSubjective`, `Retinoscopy`, etc.), we utilize the following components and patterns.

### Reusable Calculation Logic
The logic for determining a warning should be centered in a helper (or eventually the `useAxisWarning` hook):
```typescript
const checkWarningsInData = (eye: "R" | "L", data: any) => {
  const cyl = data[`${eye}_cyl`]?.toString() || "";
  const ax = data[`${eye}_ax`]?.toString() || "";
  
  const missingAxis = !!(cyl && cyl !== "0" && !ax);
  const missingCyl = !!(ax && (!cyl || cyl === "0"));
  
  return { missingAxis, missingCyl };
};
```

### Adoption Plan
1.  **Standardize Rendering**: Implement the `renderField` helper used in `OldRefractionTab` which handles the layout and badge logic.
2.  **Apply Logic**: Replace `FastInput` with `Input` and wire up the `fieldWarnings` state in:
    - `FinalSubjectiveTab.tsx`
    - `RetinoscopTab.tsx`
    - `ObjectiveTab.tsx`
    - `ContactLensExamTab.tsx`

This approach ensures that even as the application grows in complexity, the core refraction fields remain high-performance and user-friendly.

