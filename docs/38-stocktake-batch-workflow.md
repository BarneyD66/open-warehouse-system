# Stocktake Batch Workflow

Date: 2026-05-24

## Mabang Gap Covered

Mabang treats stocktake as a formal batch workflow, not a direct inventory edit. A batch has warehouse scope, SKU lines, system quantity, counted quantity, difference, operator, approval state, and downstream inventory movements.

Our previous MVP had inventory adjustment approval and a simple "stocktake adjustment" entry, but it did not yet provide stocktake batches.

## Implemented

- Added `StocktakeBatch` and `StocktakeBatchItem` models.
- Added stocktake statuses: `draft`, `counting`, `pending_approval`, `completed`, `cancelled`.
- Added candidate calculation from inventory risk:
  - below alert quantity
  - high aging days
  - reserved quantity higher than available quantity
- Added `/api/ops/stocktakes`:
  - `GET` returns stocktake candidates and batches.
  - `POST action=create_batch` creates a stocktake batch from selected inventory balances.
  - `POST action=count_item` records counted quantity and difference.
  - `POST action=submit_batch` submits differences as pending inventory adjustment approvals.
- Added Postgres persistence table `warehouse_stocktake_batches`, plus local JSON fallback.
- Added ops dashboard panel "库存盘点批次" with:
  - risk candidate table
  - one-click risk stocktake batch creation
  - active batch count entry
  - submit differences to approval

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Local Playwright smoke passed:
  - `/ops` renders "库存盘点批次".
  - `/api/ops/stocktakes` returns candidates.
  - creating a stocktake batch returns `200`.
  - counting an item returns `200`.
  - submitting the batch returns `200`.
  - submission creates one pending inventory adjustment and sets batch status to `pending_approval`.

## Product Notes

This keeps the inventory ledger controlled: stocktake differences do not directly alter stock. They enter the existing inventory adjustment approval queue, and only approved differences update balances and movements.

## Next Product Step

Next Mabang-style gaps to continue:

- Transfer order lifecycle actions: approve, pick, ship, receive, partial receive, exception.
- Carrier bill import and fee reconciliation by tracking number.
- Customer-facing replenishment and stocktake visibility, showing only customer-safe summaries.
