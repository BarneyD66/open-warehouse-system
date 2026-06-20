# 120 Automation Run History Dashboard Pass

## Scope

- Added `automationRunStore` for production automation run history.
- `/api/ops/automation/run-due` now records every run with:
  - actor and trigger
  - run status
  - child task results
  - duration
  - next action
- Added `/api/ops/reports/automation-runs` for JSON dashboard data and Chinese CSV export.
- Added automation run records to saved report views and scheduled reports.
- Added an operations overview panel for latest automation run status and failed child tasks.

## Product value

- Operators can see whether platform sync, batch jobs, carrier retries, fulfillment retries, notification retries, and report delivery ran successfully.
- Managers can review the last automation run without reading raw audit logs.
- Failed child tasks show the next recommended action directly in the workbench.

## Verification

- `npm run lint`
- `npm run build`

