# Exam Card Architecture - OpticAI

This document provides a comprehensive overview of the architecture and implementation of the Exam Cards system in OpticAI.

## Overview

The exam card system is a highly modular, metadata-driven architecture designed to handle a wide variety of clinical eye examinations. It allows for dynamic layouts, multi-instance components, and seamless data sharing between different types of exams.

---

## Core Components

### 1. `ExamLayoutRenderer`
Located in `src/components/exam/ExamLayoutRenderer.tsx`.
- **Responsibility**: Orchestrates the rendering of multiple rows of exam cards.
- **Key Logic**: 
    - Calculates the width of each card in a row using `calculateCardWidth`.
    - Manages row-level state and layout constraints.
    - Maps through `cardRows` to render individual `ExamCardRenderer` instances.

### 2. `ExamCardRenderer`
Located in `src/components/exam/ExamCardRenderer.tsx`.
- **Responsibility**: Acts as a bridge between the layout and the specific exam tab components.
- **Key Logic**:
    - **Type-based Rendering**: Uses a large switch statement to render the correct tab (e.g., `ObjectiveTab`, `SubjectiveTab`) based on the `item.type`.
    - **Toolbox Integration**: Renders the `ExamToolbox` for each card, providing actions like Copy, Paste, and Clear.
    - **Width & Constraints**: Defines column counts and maximum widths for each component type.
    - **Multi-instance Support**: Handles components with internal tabs (like `CoverTestTab` or `OldRefractionTab`) by managing sub-keys (e.g., `type-cardId-tabId`).

### 3. `ExamComponentRegistry`
Located in `src/lib/exam-component-registry.ts`.
- **Responsibility**: A singleton that manages all available exam components.
- **Key Features**:
    - **Dynamic Registration**: Components are registered with their metadata (name, icon, order).
    - **Lazy Loading**: Uses dynamic `import()` to load tab components only when needed, reducing initial bundle size.
    - **Unified Data Handling**: Provides `loadAllData` and `saveAllData` methods that interact with the backend using `layout_instance_id`.

---

## Data Architecture

### Unified Data Model
OpticAI uses a "unified" approach for exam data. Instead of many small tables, all field data for a layout instance is loaded and saved as a single unified object.

- **Data Keys**: Field values are stored in a record where keys follow these patterns:
    - Standard: `component-type` (e.g., `objective`)
    - Instance-specific: `component-type-instanceId` (e.g., `notes-uuid`)
    - Tab-specific: `component-type-cardId-tabId` (e.g., `cover-test-uuid-tabUuid`)
- **Scoping**: All data is scoped to a `layout_instance_id`, ensuring isolation between different exam layouts or patient visits.

### `ExamFieldMapper`
Located in `src/lib/exam-field-mappings.ts`.
- **Responsibility**: Handles field-level transformations and data sharing.
- **Cross-component Copy**: Defines mappings between different exam types (e.g., copying SPH/CYL from `Keratometer` to `Objective`).
- **Clearing Logic**: Knows which fields belong to which component to perform precise "Clear Data" operations.

---

## UI/UX Patterns

### Optimized Inputs
To maintain high performance in a large form with many fields, OpticAI uses specialized input components:

- **`FastInput` / `FastTextarea` / `FastSelect`**: Located in `src/components/exam/shared/OptimizedInputs.tsx`.
    - **Debouncing**: Changes are buffered locally and synced to the global state after a short delay (e.g., 1.5s).
    - **Sync Management**: The `inputSyncManager` ensures that any pending changes are flushed before save or navigation.
    - **Direct DOM Updates**: Uses refs and `defaultValue` to avoid React render cycles for every keystroke.

### Shared UI Components
- **`VASelect`**: A specialized component for Visual Acuity that handles both Meter (6/6) and Decimal (1.0) formats, including easy stepping with arrow keys and +/- modifiers.
- **RTL Support**: All components are designed for Hebrew (RTL), with specific layout adjustments for eye-specific labels (Right/Left).

---

## Adding a New Exam Card

To add a new exam type:
1. **Define Schema**: Add the model to `backend/models.py` and the interface to `src/lib/db/schema-interface.ts`.
2. **Create Tab Component**: Implement the UI in `src/components/exam/YourNewTab.tsx`.
3. **Register Component**: Add it to `examComponentRegistry.register()` in `src/lib/exam-component-registry.ts`.
4. **Update Mapper**: Add field mappings and defaults in `src/lib/exam-field-mappings.ts`.
5. **Update Renderer**: Add the type to `CardItem['type']` and the switch case in `ExamCardRenderer.tsx`.

---

## Key Files Summary

| File | Purpose |
|------|---------|
| `src/components/exam/ExamCardRenderer.tsx` | Main router and layout calculator for cards |
| `src/components/exam/ExamLayoutRenderer.tsx` | Grid orchestrator for rows |
| `src/lib/exam-component-registry.ts` | Central registry for all exam types |
| `src/lib/exam-field-mappings.ts` | Data mapping and copying logic |
| `src/components/exam/shared/OptimizedInputs.tsx` | High-performance input components |
| `src/components/exam/data/exam-field-definitions.ts` | Global field constants (min/max/step) |
| `src/components/exam/data/exam-constants.ts` | Shared constants (VA, Base values, etc.) |
| `src/components/exam/data/exam-field-definitions.ts` | Field configuration and validation rules |

---

## Field Range & Validation Configuration

Field constraints (minimum values, maximum values, and step increments) are managed at the frontend level to ensure a consistent clinical data entry experience.

### 1. Global Field Definitions (`EXAM_FIELDS`)
Located in `src/components/exam/data/exam-field-definitions.ts`.
- Defines standard constraints for core optometric fields:
    - **SPH/CYL**: `-30` to `+30`, step `0.25`
    - **AXIS**: `0` to `180`, step `1`
    - **ADD**: `0` to `5`, step `0.25`
    - **PRISM**: `0` to `50`, step `0.25`
    - **PD**: `35` to `85`, step `0.5`
- These are used as "mixins" in various tab components to avoid duplication.

### 2. Enforcement via Pattern & Shared Components
The global definitions are enforced across the app using a two-stage approach:

1.  **Object Spreading in Tabs**: Each exam tab (e.g., `ObjectiveTab`, `SubjectiveTab`) imports `EXAM_FIELDS` and spreads the relevant field config into its local column definitions:
    ```tsx
    const columns = [
      { key: "sph", ...EXAM_FIELDS.SPH },
      { key: "cyl", ...EXAM_FIELDS.CYL },
      // ...
    ];
    ```
2.  **Prop Propagation to `FastInput`**: The tab's rendering logic passes these properties (`min`, `max`, `step`, `showPlus`) directly into the `FastInput` component.
3.  **Browser & Logic Enforcement**: `FastInput` applies these values as HTML attributes (`min`, `max`, `step`) on the underlying input element. Additionally, the `useOptimizedInput` hook uses these values to clamp and validate data as the user types, ensuring the clinical boundaries are never exceeded.

### 3. Component-Local Overrides
Many tabs define their field configurations locally within their own file (usually in a `columns` or `fields` array) to allow for specialized behavior:
- **Example (`ObjectiveTab.tsx`)**: Explicitly sets `min`, `max`, and `step` for its specific columns.
- **Example (`KeratometerTab.tsx`)**: Dynamically switches ranges and steps based on the unit of measurement (`mm` vs `diopter`).

### 3. Backend Enforcement
- **Storage**: The backend stores these values in a `JSON` field (`exam_data` column in `exam_layout_instances` table).
- **Validation**: While the frontend strictly enforces these ranges via the `FastInput` (using HTML `min`/`max`/`step`), the backend acts as a flexible document store for this data, prioritizing availability and layout flexibility over strict schema enforcement of individual clinical values.
