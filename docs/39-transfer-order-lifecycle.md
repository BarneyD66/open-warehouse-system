# Transfer Order Lifecycle

Date: 2026-05-24

## Mabang Gap Covered

Mabang's transfer order management is not just a list of transfer plans. It supports approval, warehouse picking, shipment, in-transit tracking, partial receipt, full receipt, exception handling, and cancellation.

Our previous version could create transfer orders from replenishment suggestions, but the order could not yet be operated through the warehouse lifecycle.

## Implemented

- Extended `TransferOrder` with operational fields:
  - picked quantity
  - shipped quantity
  - received quantity
  - approval, picking, shipping, and receiving operators/timestamps
  - exception note
  - carrier and tracking placeholders
- Added transfer lifecycle actions:
  - approve
  - start picking
  - ship
  - partial receive
  - receive
  - mark exception
  - cancel
- Added `progressTransferOrder` business logic:
  - validates allowed status transitions
  - records source warehouse outbound movement when source stock exists
  - creates or updates destination warehouse inventory balance on receipt
  - writes destination warehouse inbound inventory movement
  - updates related replenishment plan status when linked
- Extended `/api/ops/replenishment` with `action=progress_transfer`.
- Added ops dashboard panel "调拨单作业流" for daily transfer operations.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Local smoke test passed:
  - `/ops` renders "调拨单作业流".
  - Created a transfer order from a replenishment suggestion.
  - Progressed through approve -> picking -> ship -> partial receive -> receive.
  - Final transfer status became `received`.
  - Final progress became `100`.

## Product Notes

This turns transfer orders from a planning object into an executable warehouse workflow. It is now possible to manage in-transit transfer queues, partial receipt, and exception queues from the ops dashboard.

## Next Product Step

Next Mabang-style gap: carrier bill import and logistics fee reconciliation by tracking number, so real carrier bills can be matched against estimated charges and outbound orders.
