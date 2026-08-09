# Competitor versus OpticAI Inventory V1

## Verdict

The competitor covers much of the standalone inventory-management surface, but the screenshots do not show the most valuable part of the proposed OpticAI V1: a governed product catalog with interconnected attribute filtering inside the existing patient order workflow.

Estimated overlap with the OpticAI V1 feature list: roughly 60–70%. It appears stronger on secondary inventory operations and weaker on catalog quality, order integration, and reliable stock semantics.

## Comparison

| Capability | Competitor evidence | OpticAI V1 direction |
| --- | --- | --- |
| Inventory list | Present | Present |
| Search and barcode | Present | Present |
| Quantity per store | Present | Present |
| Reserved quantity | Present | Present and tied explicitly to patient orders |
| Product creation | Present | Present, but catalog identity is separate from receiving stock |
| Smart cascading product selection | Not demonstrated | Core V1 capability |
| Selection inside patient order | Not demonstrated | Core V1 capability |
| Automatic order field population | Not demonstrated | Core V1 capability |
| Manual/non-inventory product | Not demonstrated | Explicit fallback |
| Import/export | Present | Present with mapping, dry-run, and duplicate handling |
| Labels | Present | Present as a selection/receipt action |
| Store transfer | Present as direct location change | Deferred or safer transfer workflow |
| Supplier return | Present | Later phase or simple adjustment first |
| Analytics | Tab visible, behavior unknown | Basic useful insights in V1 |
| Audit/history | Tab visible, behavior unknown | Movement history behind all quantity changes |

## Main structural concern

The competitor's `Add New Frame` form stores one row containing location, quantity, status, barcode, product attributes, purchase price, retail price, and purchase date. This is workable for a small spreadsheet-like inventory, but it blurs three concepts:

1. Product definition: brand/model/color/size.
2. Stock: how many exist at a location.
3. Receipt/pricing event: when and at what cost they were acquired.

OpticAI V1 can remain simple in the UI while separating those concepts internally. That enables reusable products across clinics, reliable quantities, smart order selection, and future purchasing without rebuilding the feature.

## Evidence limits

The screenshots show empty states only. They do not prove how product variants, order integration, reservations, validation, duplicate handling, analytics, audit history, permissions, accessibility, or error recovery actually behave.
