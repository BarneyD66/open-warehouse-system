# Replenishment And Transfer Planning

Date: 2026-05-24

## Mabang Gap Covered

Mabang's overseas warehouse module includes smart replenishment, replenishment plans, and transfer order management. Our prior MVP already had inventory balances, locations, stock movements, barcode lookup, pick lists, labels, and inventory adjustment approval, but it did not yet turn stock risk into replenishment or transfer work orders.

## Implemented

- Added replenishment suggestion calculation from available, reserved, inbound, alert quantity, and estimated daily sales.
- Added replenishment plan records with status, planned quantity, recommended quantity, target warehouse, source inventory balance, creator, and timestamps.
- Added transfer order records with source warehouse, destination warehouse, quantity, received quantity, progress, status, carrier/tracking placeholders, and related replenishment plan support.
- Added `/api/ops/replenishment`:
  - `GET` returns suggestions, plans, and transfer orders.
  - `POST action=create_plan` creates a replenishment plan from an inventory balance.
  - `POST action=create_transfer` creates a transfer order from an inventory balance.
- Added the ops dashboard panel "补货建议与调拨计划" so operators can create a replenishment plan or transfer order directly from a risk SKU.
- Added Postgres persistence tables for replenishment plans and transfer orders, with local JSON fallback support.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Local Playwright smoke passed:
  - `/ops` renders "补货建议与调拨计划".
  - `/api/ops/replenishment` returns suggestions.
  - Creating a replenishment plan returns `200`.
  - Creating a transfer order returns `200`.

## Next Product Step

The next Mabang-style gap is formal stocktake batches: create stocktake task batches, record before/after quantities, route differences into approval, and expose stocktake exceptions in the ops queue.
