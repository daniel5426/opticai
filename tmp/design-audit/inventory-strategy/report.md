# Inventory and Supply Layer Review

Date: 2026-08-09

## Verdict

OpticAI should not add a standalone frame spreadsheet beside Orders. It should add a company-scoped product and supplier catalog, clinic/location-scoped stock, and an immutable movement ledger, then connect those records to the existing patient order flow through explicit allocation and fulfillment actions.

The best rollout is a general inventory core with a frame-first workflow. Frames benefit immediately from scanning, serial/unit tracking, transfers, reservations, supplier returns, and aging analysis. The same foundation can later support contact-lens boxes, accessories, consumables, and lens blanks without rebuilding the model.

## Current OpticAI Fit

The existing order experience already owns the patient-specific work:

- Regular and contact-lens orders are linked to the client and clinic.
- Orders can import examination/prescription data.
- Regular orders capture lens and frame supplier, manufacturer, model, color, dimensions, warranty, lab, delivery clinic, priority, status, and notes.
- Contact-lens orders capture eye-specific product attributes and quantities.
- Billing supports SKU, quantity, price, discounts, supplier, and supplied state.
- Global order lists support kind/status filters, sorting, payment state, export, and inline status updates.

The missing layer is shared product identity and stock truth. Frame/lens data is mostly stored as free-text snapshots in `order_data`; billing items are financial rows; neither creates a reservation, receipt, transfer, or stock issue. Supplier/manufacturer/model lookups are clinic-scoped names rather than a reusable company catalog.

## What To Keep From The Competitor

- Barcode-first lookup and scan workflows.
- Stock scoped by store/location.
- Transfers, supplier returns, counts/audits, imports, and label printing.
- Reserved and low-stock visibility.
- Cost visibility for authorized roles.

## What Not To Copy

- `Add Frame` mixes catalog creation, stock receipt, quantity, status, barcode, cost, and retail price. Those are separate concepts and often have different permissions.
- A manually editable `status` beside quantity creates contradictory truth. Availability should be derived from stock movements and reservations.
- `Sold` is a historical event, not a current inventory state. `Low stock` and `Out of stock` are threshold alerts, not unit states.
- A direct `Store Location Change` loses chain of custody. A transfer should have source, destination, dispatch, in-transit state, and receipt confirmation.
- A single barcode cannot safely mean both a product/SKU and multiple serialized physical frames.
- Silent CSV creation of brands/models will fragment the catalog through spelling variants and duplicates.
- The bulk modal mixes unrelated jobs: importing, repairs, transfers, and returns.
- `Inventory Diagnostic` exposes an implementation-oriented concept. Users need a clear `Needs attention` queue.
- Fixed eight-digit barcodes and a single currency assumption are unnecessarily restrictive.

Visible polish/accessibility risks include low-contrast secondary text, controls whose state is communicated mainly through color, small dense tab labels, and generated localization leaks such as `inventory.supplier` and `{{symbol}}`. Keyboard behavior, focus order, screen-reader names, responsive reflow, and error announcements could not be verified from screenshots.

## Recommended Domain Model

### Catalog

- `vendors`: company-scoped supplier identity, contacts, terms, return window, and active state.
- `products`: company-scoped conceptual product with category (`frame`, `contact_lens`, `accessory`, `lens_blank`, `service`).
- `product_variants`: sellable/stockable SKU with barcode aliases, brand, model, color, dimensions, cost defaults, retail defaults, and tracking mode (`serialized`, `quantity`, `non_stock`).

Catalog identity must be company-scoped so all clinics share the same product. Stock stays location-scoped.

### Stock

- `inventory_locations`: clinic plus optional sublocations such as sales floor, back room, lab, repair, quarantine, and in transit.
- `inventory_units`: one row per serialized physical frame, with condition and unit barcode.
- `stock_balances`: efficient quantity balances for quantity-tracked variants.
- `stock_movements`: immutable ledger for receipt, transfer, reserve, release, lab dispatch, sale/issue, customer return, supplier return, adjustment, damage, repair, and opening balance.
- `inventory_reservations`: explicit links between an order material and a unit/quantity.

Stock numbers are derived:

- `on hand = available + reserved + unavailable`
- `incoming` is separate until receipt
- `low/out` is calculated from reorder policy

### Orders and fulfillment

Add a fulfillment-level `order_material_items` concept separate from billing. It should support frame, right lens, left lens, contact-lens box, accessory, and service; a source of `stock`, `customer_owned`, `supplier_ordered`, or `non_stock`; an optional product variant/unit; quantities; snapshots; allocation/fulfillment state; and links to both regular and contact-lens orders.

Billing lines may optionally reference an order material, but should not be the inventory source of truth. A package price or service charge does not necessarily map one-to-one to physical stock.

## Recommended Order Experience

In the existing Frame section, add a clear source choice:

1. **From stock** — scan/search, show availability by clinic, select a physical unit, fill existing frame fields, and reserve it.
2. **Customer's frame** — retain the current free-entry fields; no stock movement.
3. **Order from supplier** — capture the selected/catalog product and create an incoming procurement need instead of pretending it is on hand.

For stock frames, saving a confirmed order reserves stock. Sending work to a lab moves the reserved unit to an `At lab` location. Delivery to the patient issues it from stock. Cancellation releases or returns the allocation. These should be explicit fulfillment actions that may suggest an order-status change; changing a generic order status alone should not silently mutate stock.

The existing free-text snapshot should remain on the order so historical documents never change when catalog data changes.

## Recommended Inventory Information Architecture

### Inventory overview

Lead with scan/search and operational work:

- Available, reserved, incoming, at lab/repair, low stock, and needs attention.
- Company/clinic/location scope.
- Table columns for product, identifiers, location, on hand, available, reserved, incoming, cost/retail (permission-aware), and last movement.
- Selecting a row opens an item drawer with stock by location, units, movement history, related orders, purchasing history, and labels.

### Purchasing

- Needs queue from supplier-ordered patient items and reorder rules.
- Supplier-grouped draft purchase orders.
- Sent/confirmed/partially received/received/cancelled states.
- Receiving that records actual quantities, cost, barcode/serial labels, discrepancies, and backorders.
- Supplier returns tied to the original receipt when possible.

### Transfers

- Source and destination.
- Scan/pick at source.
- In-transit state.
- Receive and reconcile at destination.
- Immutable movement records and user/timestamp ownership.

### Counts and adjustments

- Location-based count sessions.
- Scan or enter counted quantities.
- Preview missing/unexpected/damaged items.
- Apply adjustments only with a reason and permission.

### Import and labels

- Import should be a guided mapping/dry-run workflow with duplicate matching, row-level errors, and an explicit opening-balance date.
- Label printing should be an action on selected products/units or a receipt, not a separate parallel inventory application.

## Roles

- Staff: search, scan, reserve, release, pick, and receive transfers.
- Manager: receipts, supplier returns, adjustments, counts, costs, and purchasing.
- Company admin: catalog governance, vendor terms, permissions, and company-wide analytics.

`Hide cost` should be a permission, not a per-screen button.

## Production-Safe Rollout

1. **Foundation + frame MVP**: additive tables, barcode/search, unit tracking, movement ledger, reservations, transfers, counts, opening balance, and order frame source selection.
2. **Purchasing**: procurement needs, purchase orders, receiving, backorders, supplier returns, and reorder rules.
3. **Broader inventory**: contact-lens boxes, accessories, consumables, lens blanks, aging/turns/margin reporting, and vendor/catalog integrations.

Compatibility plan:

- Add only new tables and nullable links at first.
- Existing orders remain valid snapshot-only records and must never retroactively consume stock.
- When an inventory product is selected, dual-write its snapshot into the existing `order_data.frame`/lens fields so current DOCX/PDF/export code continues to work.
- Read linked inventory data when present and fall back to legacy JSON/free text when absent.
- Seed catalog candidates from existing lookups, but require review/merge; do not automatically create opening stock.
- Establish opening stock through an import or counted cutover session.
- Keep billing lines compatible; add an optional material-item link later.
- Gate the feature per company during rollout and keep inventory writes transactional with order saves.

## Evidence

- `01-current-orders.png`: current global orders surface; data inspection was blocked by missing authenticated session.
- `02-new-order-blocked.png`: current new-order route; full form inspection was blocked by missing authenticated client/user context.
- `03`–`08`: competitor overview, add frame, transfer, supplier return, import, and label/export surfaces supplied by the user.

The current workflow conclusions are therefore grounded in the code/data model and the visible order shell; populated runtime behavior, keyboard flow, validation, failures, permissions, and responsive states still need an authenticated audit.
