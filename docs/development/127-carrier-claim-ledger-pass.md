# 127 Carrier Claim Ledger Pass

## Scope

- Added `/api/ops/reports/carrier-claims` for a Chinese CSV/JSON carrier claim ledger.
- The ledger covers outbound order, customer, platform order, carrier, tracking number, delivery exception, claim amount/status, POD link, redelivery note, customer confirmation, owner, and next action.
- Added the carrier claim ledger to the ops report download area.
- Added `carrier_claims` to saved report views and scheduled report delivery routing.

## Product Notes

- This makes the logistics compensation workflow easier to run daily: claim cases are no longer buried inside the general exception report.
- Boss/ops can filter by customer, carrier, claim status, exception status, and keyword to review open compensation risk.
- Scheduled report delivery can now send this report like other production reports.

## Verification

- Passed `npm run lint`.
- Passed `npm run build`.
- Passed conflict marker check.
- Passed `git diff --check` with only existing CRLF normalization warnings.
