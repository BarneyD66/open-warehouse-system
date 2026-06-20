# 119 Production Automation Runner Pass

## Scope

- Added `/api/ops/automation/run-due` as a unified production automation runner.
- The runner executes due operational jobs in sequence and keeps going even if one child task fails:
  - platform order sync
  - runnable batch jobs
  - failed/queued batch job retry
  - carrier label retry
  - platform fulfillment retry
  - notification delivery retry
  - scheduled report delivery
- Added an operations backend button for manual due-task inspection.
- Added audit logging with `automation_run_due`.
- Added production readiness checks for `AUTOMATION_RUN_SECRET` or `CRON_SECRET`.

## Production operation notes

- Recommended Cron target: `/api/ops/automation/run-due`.
- Authentication can use `AUTOMATION_RUN_SECRET` for the unified endpoint and `CRON_SECRET` or task-specific secrets for child endpoints.
- Scheduled report delivery still supports `REPORT_SCHEDULE_SECRET`.

## Verification

- `npm run lint`
- `npm run build`

