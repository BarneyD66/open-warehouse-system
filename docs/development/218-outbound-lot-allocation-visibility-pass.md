# 218 - Outbound Lot Allocation Visibility Pass

## Goal

Continue the Mabang comparison goal by tightening the deep WMS rule layer. The system already had lot, expiry, serial number, freeze, stocktake, transfer, and location-capacity primitives, but operators still could not see which lots should be picked for pending outbound orders before warehouse scanning.

## Implemented

- Added an FEFO outbound lot allocation view to the operations WMS compliance panel.
- The panel now evaluates pending outbound orders against active inventory lots and shows:
  - pending orders needing lot allocation;
  - orders with SKU lot shortages;
  - expiring lots included in recommended picks;
  - order-level coverage or shortage quantity;
  - SKU-level required, allocated, and shortage quantity;
  - recommended lot number, location, pick quantity, expiry date, and near-expiry warning.
- Wired the operations inventory page to pass outbound orders into the WMS compliance panel.
- Added `/api/ops/reports/outbound-lot-allocation` for CSV and JSON export of outbound lot allocation recommendations, with staff report permission checks and audit logging.
- Added a WMS panel download entry for the outbound lot allocation report.
- Registered the outbound lot allocation report in the report center, saved-view export router, scheduled-report router, Mabang comparison report shortcuts, and saved-view module selector.

## Product Impact

- Warehouse staff can check lot-level pick guidance before scanning.
- Operations and management can see FEFO risks and shortage gaps in the same WMS risk board as locations, expiry, serial numbers, frozen inventory, and defective inventory.
- This keeps the current shipping and inventory-deduction flow unchanged while making the daily outbound decision layer more production-ready.

## Verification

- `rg -n "^(<<<<<<<|=======|>>>>>>>)" src docs`
- `git diff --check`
- `npm run lint`
- `npm run build`
