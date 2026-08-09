# Prysm UI Design Guide

Prysm uses a restrained, operational interface for optical-clinic workflows. The UI should feel calm, precise, and familiar across pages. Prefer established shared components and nearby production pages over introducing a new visual pattern.

## Core principles

- Keep information hierarchy clear and compact. Page title, primary actions, toolbar, then content.
- Use `Geist`, the existing semantic color tokens, and the shared spacing/radius scale.
- Use color to communicate state or priority, not as decoration.
- Add borders, backgrounds, and shadows only when they clarify grouping or elevation.
- Preserve the real page shell while data loads; skeletonize only unavailable content.

## RTL behavior

- Hebrew application surfaces use `dir="rtl"` at the page or component boundary.
- Use logical alignment such as `text-start` instead of breakpoint-specific `text-left` or `text-right`.
- Do not rely on inherited RTL direction to position separate toolbar groups. `TableFiltersBar` uses an explicit spatial layout.
- In list toolbars, the physical order from left to right is: secondary navigation, filters, search. Search is always at the far right.
- RTL buttons place text first and a trailing icon second in JSX so the icon appears on the physical left.
- Numeric values, SKUs, barcodes, phone numbers, and similar machine-readable values may use `dir="ltr"` locally.

## List and table pages

- Use `ListPageHeader` for the title, optional subtitle, and page-level actions so sibling list pages share the same top spacing and hierarchy.
- Use `TableFiltersBar` for search, filters, secondary navigation, and actions.
- Keep search and filters flat. Do not wrap the toolbar in a `Card`.
- Keep data tables flat and consistent with the clients, orders, and exams pages. A simple `rounded-md bg-card` table shell is sufficient; do not wrap tables in `Card`.
- Primary tabs that represent distinct page sections belong in `SiteHeader`, matching the client workspace.
- Do not create separate tabs when the only difference is hiding columns. Merge the columns into one table and use filters for states such as active or archived.
- Use cards only for independent summaries, insights, or semantic panels—not as default containers around every region.
- Table loading states belong inside table rows so the toolbar and table structure remain stable.
- Use `TablePagination` below paginated tables for the shared page count and previous/next controls.
- Do not add arbitrary bottom margins to table roots; page padding and the shared pagination component own the surrounding spacing.
- In fixed-height app layouts, the page, tab content, and table shell must use a `min-h-0` flex chain. Only the table container scrolls; pagination remains visible outside it.
- App-shell children must size with `h-full`, not `h-screen`; the desktop title bar already consumes part of the viewport.

## Dialogs

- Set `dir="rtl"` on `DialogContent` for Hebrew dialogs.
- `DialogHeader`, its title, and its description inherit logical start alignment from the shared dialog component. Do not add page-level RTL alignment overrides.
- `DialogFooter` handles RTL action order centrally. Keep secondary/cancel actions first and primary actions last in JSX.
- The close button uses logical placement: right in LTR dialogs and left in RTL dialogs.

## Actions and controls

- One clear primary action per page section; secondary actions use outline, secondary, or menu treatments.
- Keep common controls at the shared 36px height (`h-9`).
- Use concise labels. Icons support labels and should not replace them unless the action is universally understood and has an accessible name.
- Destructive actions must be visually and verbally explicit.

## Responsive behavior

- Preserve the same semantic order on smaller screens. Toolbars may stack, with search and filters before navigation/actions.
- Tables may scroll horizontally or vertically rather than compressing critical values into unreadable layouts.
- Avoid fixed widths except for predictable controls such as filters, icon actions, and identifiers.

## Analytics surfaces

- Use the shared `AnalyticsRangePicker` and keep `range`, `from`, and `to` in the URL so analytics views are reproducible.
- Standard ranges are 7, 30, 90, and 365 days plus inclusive custom dates. Compare with the immediately preceding equal-length period.
- Bucket daily through 45 days, weekly through 180 days, and monthly for longer ranges.
- KPI cards are icon-free. They contain a label, tabular value, prior-period comparison, optional context, and a compact sparkline only when a real series exists.
- KPI labels and comparison/context lines are always single-line and use the full card width. Truncate overflow with an accessible title; never let copy increase the shared card height.
- KPI values use compact responsive sizing and must never overflow their card. A sparkline shares only the value row and must not narrow the label or comparison rows.
- Declare metric polarity: higher is positive for growth metrics; lower is positive for outstanding balances, reorder needs, and stockouts. A non-zero value after a zero comparison is shown as `חדש`, never infinity.
- Treat current inventory snapshots as snapshots. Do not display fabricated historical comparisons for reorder, stockout, or current stock value.
- Analytics panels keep stable dimensions while loading and show explicit empty and error states. Never substitute a failed query with zeros.
- Use restrained, stable series colors, sparse horizontal gridlines, bottom legends, RTL tooltips, and tabular numerals.
- Chart colors must come from the shared `--chart-1` through `--chart-5` palette; never rely on an undefined CSS variable or browser fallback color.
- When a low-volume series shares a chart with a much larger series, give it a clearly distinct stroke treatment and visible data points so it remains readable near the baseline.
- Donut charts pair a compact legend with a center total. The center total must stay below the chart tooltip layer so hover details remain fully legible.
- Hebrew time-series charts run chronologically from right to left: the earliest bucket is on the right and the latest on the left. Numeric axes and category labels belong on the right; horizontal value bars grow leftward from a right-side zero origin.
- Ranked metrics use the shared table pattern with optional share bars. Avoid decorative wrappers and separate drill-down pages.
- Analytics tables are standalone white surfaces with one standard card-weight border. Do not show a separate title or subtitle above them and never place their table shell inside another bordered wrapper. Instead, make the primary column header describe the ranking or dataset clearly.
- When a ranked table has no rows, retain its white table shell and show the empty state in a table row. Do not replace it with unbounded empty page space.
- Mixed chart/table grids align items to the start. A long table must not stretch a neighboring chart card and create dead vertical space.
- KPI grids preserve semantic order and collapse from five columns to two and then one. Charts may scroll horizontally only when labels cannot remain readable.

## Before adding a new pattern

1. Inspect the closest existing page with the same purpose.
2. Reuse or extend a shared component where possible.
3. Confirm RTL physical order, not only text direction.
4. Check light/dark tokens and loading, empty, permission, and mobile states.
5. Avoid one-off wrappers or styling that makes the page diverge from sibling workflows.
