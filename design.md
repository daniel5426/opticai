# Prysm UI Design Guide

Prysm uses a restrained, operational interface for optical-clinic workflows. The UI should feel calm, precise, and familiar across pages. Prefer established shared components and nearby production pages over introducing a new visual pattern.

## Core principles

- Keep information hierarchy clear and compact. Page title, primary actions, toolbar, then content.
- Use `Geist`, the existing semantic color tokens, and the shared spacing/radius scale.
- Use color to communicate state or priority, not as decoration.
- Add borders, backgrounds, and shadows only when they clarify grouping or elevation.
- Shared cards, including exam and order cards, use `border-border/50` and `shadow-sm` in both appearance styles. Order cards retain their own padding and gaps; compact sidebar billing keeps its flat grouping.
- On the exam detail page, cards use the layout editor's `bg-card` surface, subtle border, and `shadow-sm`, keeping their rounded corners and gaps. Fields inside these cards retain their muted backgrounds and transparent borders in both modes; focus and validation remain visible. The tab panel uses the `#FCFCFC` surface in light mode, shared with the active tab and layout editor to separate the cards from the tinted page canvas. The tab panel and active tabs use the order workspace's borderless `shadow-sm` treatment in both appearance styles.
- Layout editor full-height edge hit areas show a short grip beside the pointer on hover/focus and resize the centered layout symmetrically. Optional `layoutWidthPx` in version 2 layout JSON saves the preferred maximum width. Sidebar and agent panels consume surrounding gaps before the layout shrinks to fit; extra room restores its preferred width. Older `sideInsetPx` settings resolve to a width once on opening, and layouts without either setting fill the available width.
- Labeled order fields have empty placeholders to avoid repeating their labels. Keep validation and lookup menu feedback visible.
- Frame and lens catalog links occupy a reserved full-width sidebar-colored row below the product inputs. Product names wrap within that row; selecting or unlinking a product must not move the inputs above it. Unlink removes the catalog association while preserving entered details and price; the separate clear icon empties product fields.
- Offer catalog creation in that footer row, rather than in field dropdowns. A changed frame price has an explicit catalog-update icon beside unlink; editing or saving the order alone does not change catalog prices. New frame products inherit the entered price, including zero. Keep the order workspace's successful-save text visually hidden while retaining accessible announcements and visible error recovery.
- General borders use the shared `--border` token in `src/styles/appearance.css`, including sidebar dividers. Tune it per style and mode; input borders and focus rings keep their separate tokens.
- Preserve the real page shell while data loads; skeletonize only unavailable content.

## Appearance themes

- `Classic` is the default and preserves the current appearance and its accent palettes. `Pro` uses neutral light/dark surfaces and square rectangular controls; status, appointment, and chart colors keep their meaning.
- `src/lib/appearance.ts` owns document appearance and the style/palette registry. The single root `ThemeProvider` exposes its state; legacy helpers delegate to it. Do not set theme classes or appearance variables from pages.
- Define style tokens in `src/styles/appearance.css`, scoped to the root `data-style` attribute and light/dark mode. A new style needs a registry entry, translated label, and token definitions; selectors derive their choices from the registry.
- Use `bg-canvas` for application canvas, `bg-field` for controls, existing semantic text/state tokens, and the shared radius scale. Use `shadow-floating` or `shadow-dialog` for elevated overlays; do not tie generic cards to clinical styling.
- Fields use the same muted `bg-field` surface in view and edit modes. General editable fields use a transparent border by default and show a focus or validation border; explicit bordered variants remain available. Clinical card fields also use transparent borders in both view and edit modes. Disabled or read-only fields keep a transparent border to preserve their size. Explicitly transparent inline controls retain their surrounding surface.
- Shared fields use `--field-scale: 0.9` for height, padding, icons, and font sizes in both modes. Keep textarea minimum heights on spacing utilities and mark plain view-mode field containers with `field-view`. Surrounding labels and layout tracks keep their normal scale.
- Themes change presentation only. Preserve font metrics, spacing, sizing, grid tracks, and breakpoints. Circular avatars, status indicators, and switch mechanics remain circular in Pro.
- Style selection is stored per user on the device. Keep existing mode/palette keys and database `theme_preference` compatible; persisted appointment colors are independent.
- The default is Classic / Bloom Blue, light mode, flat surfaces, and a solid `#F2F7FD` page canvas. The November 5, 2026 rollout applies it once per account on each device, including existing accounts; later appearance choices remain saved. Device mode choices take precedence over the server's older cached preference.
- `Bloom blue` adds the grainy blue gradient only to the sidebar and outer app wrapper; page canvases use a much lighter grained gradient tinted by the active palette. It uses the existing device-local palette preference and has a darker variant for dark mode.
- Settings → Appearance owns style, display mode, palette, raised surfaces, and page backgrounds. Style, mode, palette, and elevation save immediately. The background editor offers theme default, solid color, or gradient with two colors, direction, strength, and grain. Background changes preview live; Save commits the device-local per-user override, Cancel discards it, and Restore default previews the solid `#F2F7FD` canvas until saved. Suggested colors are pale tints. Reset to default appearance immediately restores the entire default combo and saves it on this device. Existing gradient preferences remain compatible. Page backgrounds do not change the breadcrumb header, sidebar gradient, or clinical state colors.
- `/dev/appearance` is a development-only gallery of synthetic shared-component fixtures, with locale/style/mode controls. Use it to check Hebrew RTL and English/French LTR without changing production locale routing.

## RTL behavior

- Hebrew is the primary layout. Design the Hebrew RTL composition first, then confirm English and French. Do not treat LTR as the screen that has to look finished.
- Use the width. A full-width panel with the controls stacked in a narrow start column and empty space beside them is unfinished, especially in Hebrew. Put the main work on the inline start and supporting context on the inline end.
- Hebrew application surfaces use `dir="rtl"` at the page or component boundary.
- Use logical alignment such as `text-start` instead of breakpoint-specific `text-left` or `text-right`.
- Do not rely on inherited RTL direction to position separate toolbar groups. `TableFiltersBar` uses an explicit spatial layout.
- In list toolbars, the physical order from left to right is: secondary navigation, filters, search. Search is always at the far right.
- RTL buttons place text first and a trailing icon second in JSX so the icon appears on the physical left.
- Numeric values, SKUs, barcodes, phone numbers, and similar machine-readable values may use `dir="ltr"` locally.

## List and table pages

- Use `ListPageHeader` for the title, optional subtitle, and page-level actions so sibling list pages share the same top spacing and hierarchy.
- Use `TableListPageContent` for list page padding and `TableListLayout` for the toolbar, table, loading rows, empty state, and pagination. Orders and exams share these wrappers; keep spacing, scrolling, and header placement in the wrappers.
- Use `TableFiltersBar` for search, filters, secondary navigation, and actions. Pass its props through `TableListLayout.toolbar` on shared list pages.
- Table/card view switches belong in that shared toolbar. Both views retain the same search state and item-opening behavior, and remember the chosen view across visits.
- Keep search and filters out of a `Card`. Controls that sit on the canvas — search, filter menus, page actions, and pagination — use the shared canvas surface: `rounded-xl`, no border, `bg-card`, and `shadow-sm` in both appearance styles. `canvasSurfaceClassName` and `data-canvas-toolbar` own that treatment.
- List tables use the same canvas surface on the table container (`elevated`, the default). Do not add a second card shell around them. Nested tables inside an existing panel pass `elevated={false}`.
- Primary tabs that represent distinct page sections belong in `SiteHeader`, matching the client workspace.
- Do not create separate tabs when the only difference is hiding columns. Merge the columns into one table and use filters for states such as active or archived.
- Use cards only for independent summaries, insights, or semantic panels—not as default containers around every region.
- Table loading states belong inside table rows so the toolbar and table structure remain stable.
- Use `TablePagination` below paginated tables for the shared page count and previous/next controls.
- Do not add arbitrary bottom margins to table roots; page padding and the shared pagination component own the surrounding spacing.
- In fixed-height app layouts, the page, tab content, and table shell must use a `min-h-0` flex chain. Only the table container scrolls; pagination remains visible outside it.
- Shared list tables shrink to their rows and scroll only when the available height is exceeded. Keep empty messages in a compact table row. `TableListLayout` owns the pagination gap; do not add another margin inside it.
- App-shell children must size with `h-full`, not `h-screen`; the desktop title bar already consumes part of the viewport.

## Dialogs

- Set `dir="rtl"` on `DialogContent` for Hebrew dialogs.
- `DialogHeader`, its title, and its description inherit logical start alignment from the shared dialog component. Do not add page-level RTL alignment overrides.
- `DialogFooter` handles RTL action order centrally. Keep secondary/cancel actions first and primary actions last in JSX.
- The close button uses logical placement: right in LTR dialogs and left in RTL dialogs.
- Scanned-item details use a compact `sm:max-w-sm` dialog, a shared label/value grid aligned to logical start, and small actions in `DialogFooter`. Keep numbers and barcodes inside `bdi`; do not set entire value cells LTR, which moves them to the opposite edge in Hebrew.
- Selecting a recent scan keeps its dropdown open with a spinner on that item until its details are ready. Close the menu when handing off to the item dialog, confirmation, or screen fields; loading errors remain in the menu for retry.
- When a dialog contains portal-based comboboxes, keep the dialog surface `overflow-visible` and scroll an inner content wrapper instead. Scope the portal to the dialog so the menu remains interactive, but never let the scroll wrapper clip it.

## Catalog forms

- The catalog item dialog has a 650px maximum desktop width. Keep it compact unless a new requirement needs more space.
- Give each field a visible label; do not rely on placeholder text in labeled selects or comboboxes.
- Labels use regular weight, stay on one line, and use no more than two words in every supported locale. Resize or rearrange the field instead of wrapping or truncating its label.
- Size fields by their data: names, models, suppliers, colors, SKUs, and barcodes may use wider cells; clinical measurements, quantities, prices, and currency use compact cells.
- Group contact-lens measurements together in a compact specification area and keep their numeric values locally LTR. Keep product identity, variant identifiers, and pricing as separate groups.
- In the catalog dialog, keep the contact-lens color selector compact and give the remaining row width to the measurement grid so `SPH`, `BC`, and `DIA` remain comfortably usable.
- Use standard contact-lens abbreviations (`SPH`, `BC`, `DIA`, `CYL`, `AX`, `ADD`) wherever they are unambiguous; reserve descriptive labels for fields such as box quantity.
- Test explicit grid tracks in RTL: source order maps to the rightmost track first, so assign any wider track to the intended field rather than assuming left-to-right placement.
- Numeric controls with increment/decrement buttons must size the control wrapper and input together; never widen only the input or separate the buttons from it.
- Show currency selectors as ISO codes only (`ILS`, `USD`, `EUR`), not expanded currency names.

## Actions and controls

- One clear primary action per page section; secondary actions use outline, secondary, or menu treatments.
- Keep common controls at the shared 36px height (`h-9`).
- Build forms with shared `Input`, `Textarea`, `Select`, `DateInput`, and `TimeInput`; do not substitute native selects or browser date/time fields. Dates and times are locally LTR and centered, with symmetric icon clearance. General fields keep comfortable inline padding; clinical cards retain their compact insets. Width classes on `Input` also size its wrapper so numeric steppers and affixes stay inside the control. Use `wrapperClassName` for surrounding layout.
- Hide visible scrollbars with `no-scrollbar` while retaining scrolling, including nested editor surfaces.
- Use concise labels. Icons support labels and should not replace them unless the action is universally understood and has an accessible name.
- Horizontal tab labels stay on one line. Never squeeze them into wrapped words or taller tabs; use concise translations, intrinsic tab widths, and horizontal scrolling when necessary.
- Settings tabs and their active section's filters/export actions share one toolbar, with tabs at logical start and actions at logical end. Wrap whole groups only when space runs out; keep the table below the toolbar.
- Settings form labels sit above their inputs in a dedicated field container, with an explicit `htmlFor`/`id` association. Do not nest an input inside the flex-based shared `Label`, which compresses the label beside the control. Rearrange whole fields when space is tight.
- Keep section headings inside their card padding. Do not use a floating `legend` as a card title; name fieldsets with an internal heading and `aria-labelledby` instead.
- Small numbers and amounts use compact controls sized at the wrapper and input together (typically `w-28` to `w-36`), with the currency inside the control. They must not stretch to fill the available row.
- Configuration notices use compact `text-sm` copy, restrained status icons, and close vertical spacing. Group related notices; do not scatter large paragraphs between summary cards and their toolbar.
- Destructive actions must be visually and verbally explicit.
- Sent user attachments share the same logical end alignment as user message bubbles: left in Hebrew RTL and right in English/French LTR. Keep attachment filenames locally LTR. The agent sidebar uses the shared panel toggle for closing; do not add a second close arrow in its toolbar.
- Voice recording uses ElevenLabs LiveWaveform with the recorder's existing microphone stream. The waveform borrows the stream; the recorder owns track cleanup. Keep the floating pill centered and its waveform between Send on the physical left and Cancel on the physical right across locales. Do not add a separate stop-square control. Send reuses the composer's circular up-arrow control. Plain Enter sends active or stopped recordings before a focused editor can submit its own draft; composition confirmation and Shift+Enter remain available to the editor.

## Responsive behavior

- Preserve the same semantic order on smaller screens. Toolbars may stack, with search and filters before navigation/actions.
- Tables may scroll horizontally or vertically rather than compressing critical values into unreadable layouts.
- Avoid fixed widths except for predictable controls such as filters, icon actions, and identifiers.

## Campaign workspaces

- Keep four sections: Audience, Content, Review & send, and Results. Scheduling belongs beside the content editor, using the former preview column.
- Group channel toggles and message language in the composer toolbar. Disabled channels do not get separate cards. Put personalization fields in one insertion menu.
- Review uses one card with automatic audience/cost calculation, a corner refresh action, and send actions. Save draft edits before calculating; never send or activate a schedule automatically.
- Test sending uses one dialog with explicit destinations, its own price quote, and an explicit send button. Keep its quote separate from the campaign quote and preserve request keys on uncertain retries.
- Place a visible Back button at logical start of the footer and Next at logical end. Omit step-count and continuation copy.

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
