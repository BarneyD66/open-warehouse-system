# 219 SLA reminder rule configuration pass

## Scope

- Added an operations-side SLA reminder rule store for inbound putaway, outbound shipping, outbound intercepts, outbound weighing, work orders, finance review, and billing reminders.
- Added `/api/ops/notifications/sla-rules` so staff with reports or permissions access can read and update SLA thresholds, near-due thresholds, channels, and escalation roles.
- Wired the ops permissions/message panel to render editable SLA rules and save changes.
- Updated notification generation to use configurable SLA rules for staff inbound, outbound, intercept, weighing, work order, and finance-review reminders.
- Normalized notification channels to stable internal keys: `in_app`, `email`, `sms`, `wechat`, while accepting Chinese channel names from existing forms.
- Added audit action support for SLA rule updates.

## Stability Fixes

- Rebuilt customer and staff notification generation around stable ASCII/Unicode escaped source strings to avoid corrupted Chinese literals in PowerShell write cycles.
- Fixed notification delivery channel typing after moving from Chinese channel literals to stable internal channel keys.
- Kept customer-facing runtime copy Chinese for key notification titles while using escaped source where needed.

## Verification

- `npm run lint`
- `npm run build`
- Conflict-marker scan: no matches in `src` and `docs`.
- Targeted mojibake scan for the touched notification/SLA files: no matches after cleanup.

## Remaining Follow-Up

- The next highest-value message/SLA follow-up is to connect real email/SMS/WeChat providers and add user-level subscription preferences per customer/account.
