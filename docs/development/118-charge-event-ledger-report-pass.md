# 118 Charge Event Ledger Report Pass

## Scope

- Added an operations report endpoint at `/api/ops/reports/charge-events`.
- The report derives a fee event row from every billing fee line, so finance can trace each charge back to a customer, bill, business source, fee code, amount, status, and next action.
- Connected the report to saved report views, scheduled report delivery links, and the operations report download area.

## Product value

- Finance can audit storage rent, outbound handling, labels, returns, surcharges, and manual fees at the event level instead of only at the bill level.
- Operators and managers can filter by month, customer, source type, fee code, status, or keyword.
- Exports use Chinese headers and UTF-8 BOM CSV for direct Excel opening in Chinese-first workflows.

## Verification

- `npm run lint`
- `npm run build`

