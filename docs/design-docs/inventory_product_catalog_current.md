# Inventory And Product Catalog Current

Last Updated: 2026-08-09

## Ownership And Scope

- `CatalogProduct` and `CatalogVariant` are company-scoped catalog records. A variant is deduplicated per company by its normalized fingerprint; SKU and barcode are also company-unique.
- `InventoryBalance` is the clinic-specific stock position for one catalog variant. It owns `on_hand`, `reserved`, reorder policy, and an optimistic `version`; a catalog item can exist without a balance at a clinic.
- `InventoryMovement` is the immutable movement audit trail. `OrderInventoryAllocation` links an order component to a selected variant without rewriting the legacy order JSON.

## Lifecycle And Stock States

- Products and variants are active or archived. Archiving is blocked while stock or active allocations remain; restoring makes the same record available again.
- A balance has `on_hand`, `reserved`, and derived `available = on_hand - reserved`. Adjustments, counts, imports, reservations, releases, and consumption create movements. Negative stock and reservations above on-hand are rejected.
- Allocation sources are `inventory` and `supplier_ordered`. Lifecycle states are `reserved`, `supplier_ordered`, `consumed`, `released`, and `detached`. Inventory allocations reserve stock, supplier orders do not; delivery consumes a reservation and cancellation/deletion releases it.
- First balance creation is protected by the `(clinic_id, variant_id)` unique constraint. Postgres uses `INSERT … ON CONFLICT DO NOTHING` before reloading the balance; normal balance updates retain the existing version checks and row locking.

## Roles And Cost Visibility

- Viewer users (role level below 2) have inventory read access only. Preview, import, catalog, balance, count, policy, archive, and discovery-confirm writes require inventory-write access.
- Workers (level 2) can manage stock and retail values but do not receive or write default cost. Managers (level 3+) can view and manage cost.

## Orders And Legacy Compatibility

- New order saves can carry explicit inventory selections. Allocation reconciliation runs as part of the order save/delete transaction.
- Legacy desktop saves that omit selections are reconciled against the existing allocation and their component snapshot. A matching delivered legacy order consumes an existing reservation; a changed or removed component detaches/releases it rather than silently changing legacy order data.
- Discovery reads historical order data to suggest catalog candidates. Confirmation creates catalog/observation records only and does not rewrite source orders.

## API And UI Surfaces

- Backend module: [`backend/EndPoints/inventory.py`](../../backend/EndPoints/inventory.py), mounted under `/api/v1/inventory` with 21 explicit routes.
- Main UI: [`src/pages/InventoryPage.tsx`](../../src/pages/InventoryPage.tsx) at `/inventory`; order editors use [`src/components/inventory/CatalogVariantPicker.tsx`](../../src/components/inventory/CatalogVariantPicker.tsx).
- The surface includes catalog variants, summary, catalog create/update/archive, balance adjust/policy/count, movements, order allocations, discovery, CSV import/export, and current inventory insights.

## CSV Import Contract

- Preview accepts CSV text and requires inventory-write access. Accepted columns include category/type, product identity, variant attributes, SKU/barcode, cost/retail, opening `on_hand`, `reorder_point`, and `target_quantity`.
- Rows are normalized server-side. Category must be `frame` or `contact_lens`; required product/stock attributes, numeric non-negative integer quantities, and `target_quantity >= reorder_point` when a target is provided are enforced.
- Duplicate variant fingerprints, SKUs, and barcodes are checked both within the submitted rows and against the current company catalog. Commit re-runs this validation and recomputes all fingerprints; browser-supplied preview status, fingerprint, and normalized data are not authorization or validation evidence.
- The current UI submits its preview-valid rows. The API still returns per-row validation errors and skips independently invalid submitted rows so older clients that submit the full preview remain usable. Valid rows commit in one transaction; a concurrent database uniqueness conflict rolls the import back and returns a conflict.

## Analytics Assumptions

- Demand prefers confirmed order observations. Manual/legacy consume movements are included only when no matching observation exists, avoiding double-counting.
- Reorder, stockout, available stock, and stock-value metrics are current snapshots. Snapshot KPIs intentionally have no invented prior-period comparison.
- Reorder quantity is `max(0, target_quantity - available)` only when available is at or below the reorder point and a positive target exists.

## Intentional V1 Limits

- No supplier purchase-order, receiving, transfer, batch/serial, expiry, tax, or multi-currency workflow exists.
- Catalog price defaults are not a full price-history system; balances are clinic-scoped but catalog identity is company-scoped.
- Import is a create/opening-stock flow, not a general destructive catalog synchronization or bulk update mechanism.
- Discovery is review-and-confirm only; it does not infer a complete stockable variant or mutate historical order payloads.
