# Exam Layout Engine Current

Last Updated: 2026-04-09

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
- Many card types support multi-instance or tabbed behavior.
- Unified exam data is loaded and saved by layout instance.
- Specialized optimized inputs try to reduce render churn on large forms.

## Current Risks
- Build output shows code-splitting intent is undermined by static imports in the renderer.
- This subsystem is large and central to client value, so it is a `P0` audit focus.
- The existing implementation has strong domain depth but limited automated protection.
- Launch validation must include create, edit, save, layout switching, and order/referral handoff paths.
