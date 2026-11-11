# Exam Layout Engine Current

Last Updated: 2026-07-26

## Summary

The exam system is the heaviest and most custom part of the renderer. It is layout-driven, metadata-heavy, and backed by unified exam data APIs rather than many narrow per-tab API calls.

## Main Components

- [`src/components/exam/ExamCardRenderer.tsx`](/Users/danielbenassaya/Code/personal/opticai/src/components/exam/ExamCardRenderer.tsx)
- [`src/components/exam/ExamLayoutRenderer.tsx`](/Users/danielbenassaya/Code/personal/opticai/src/components/exam/ExamLayoutRenderer.tsx)
- [`src/lib/exam-component-registry.ts`](/Users/danielbenassaya/Code/personal/opticai/src/lib/exam-component-registry.ts)
- [`src/lib/exam-field-mappings.ts`](/Users/danielbenassaya/Code/personal/opticai/src/lib/exam-field-mappings.ts)
- Existing deep-dive reference: [`docs/EXAM_CARD_ARCHITECTURE.md`](/Users/danielbenassaya/Code/personal/opticai/docs/EXAM_CARD_ARCHITECTURE.md)

## Current Behavior

- Exam cards are rendered from layout rows and item metadata.
- Preferred card widths use the 1280px reference grid in the viewer, preview, and editor. Empty columns collapse first, then widened cards shrink to their minimums before the row scrolls. This affects rendering only, so wider panes restore the saved sizes and the cards stay mounted.
- Cards can be positioned to the edge of the available row. Dragging within a row stops at adjacent cards. The existing version-2 layout records the occupied columns and keeps fractional card positions and widths.
- Imported OpticPlus cards keep one stable display arrangement instead of changing their widths and rows with the pane.
- Migration note: Not needed; existing layouts load directly. Use the updated editor when saving layouts with positions beyond the original 24 columns or fractional spans.
- Many card types support multi-instance or tabbed behavior.
- Unified exam data is loaded and saved by layout instance.
- Specialized optimized inputs try to reduce render churn on large forms.
- Card additions must follow the extension contract in [`docs/EXAM_CARD_ARCHITECTURE.md`](/Users/danielbenassaya/Code/personal/opticai/docs/EXAM_CARD_ARCHITECTURE.md), including shared field definitions, renderer/registry/mapping wiring, compatibility handling, verification, and payload documentation.

## Current Risks

- Build output shows code-splitting intent is undermined by static imports in the renderer.
- This subsystem is large and central to client value, so it is a `P0` audit focus.
- The existing implementation has strong domain depth but limited automated protection.
- Launch validation must include create, edit, save, layout switching, and order/referral handoff paths.
