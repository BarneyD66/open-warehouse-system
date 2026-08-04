# Issue Triage Labels

This guide keeps GitHub issue labels consistent while Open Warehouse System is still an early open-source project. The goal is to make the backlog easier for contributors to scan without exposing private warehouse operations, customer names, production credentials, or real pricing details.

## Label Groups

Use a small set of labels and prefer clarity over precision. Most issues should have one type label and one domain label.

### Type Labels

- `bug`: broken or incorrect behavior.
- `enhancement`: new capability or workflow improvement.
- `documentation`: README, guide, setup, example, or release-note work.
- `developer-experience`: local setup, scripts, fixtures, test ergonomics, or repository hygiene.
- `test`: automated test, smoke test, or manual verification improvement.
- `security`: security policy, auth, data isolation, secrets, or vulnerability-handling work.

### Domain Labels

- `frontend`: customer portal, ops workbench, warehouse workbench, or public UI.
- `backend`: API routes, persistence, validation, migrations, or service logic.
- `inventory`: SKU, stock balance, movement log, adjustment, stocktake, or replenishment.
- `billing`: statements, payment proof, dispute handling, fee calculation, or reconciliation.
- `logistics`: carrier, tracking, label, handoff, rate estimate, or delivery workflow.
- `warehouse`: receiving, putaway, picking, packing, locations, or warehouse task flow.
- `returns`: RMA, return inspection, restock, refund evidence, or exception handling.
- `internationalization`: language, region, carrier, tax, customs, privacy, or localized export behavior.
- `localization`: workflow-level translation readiness, customer-visible copy, locale examples, or translated artifacts for one route or workflow.

### Contributor Labels

- `good first issue`: narrow task that can be completed in one focused pull request.
- `help wanted`: useful task where maintainers welcome outside design or implementation input.

### Risk Labels

- `auth`: login, staff session, whitelist, role, or permission boundary.
- `data-isolation`: customer data visibility, tenant separation, or `customer_code` access checks.
- `migration`: database schema, migration script, or local data migration.
- `security-sensitive`: area needs careful review; do not publish exploit details in the issue body.

## Triage Rules

- Add one type label first, then one domain label when the affected workflow is clear.
- Use `good first issue` only when the task has a clear file or route, small scope, safe fake data, and explicit verification steps.
- Use `help wanted` when the issue is useful to the roadmap but needs contributor input before implementation.
- Use `security` or `security-sensitive` carefully. Public issues should not include exploit steps, real customer data, secrets, logs, production URLs, or private documents.
- Use `localization` when an issue reviews one workflow's translated page copy, validation messages, CSV/Excel headers, printable notes, or customer-facing examples.
- Use `internationalization` when an issue affects broader language architecture, region-specific deployment, carrier assumptions, tax/customs copy, or localized templates across workflows.
- For Chinese-mode customer-facing flows, check the full visible artifact: page copy, admin copy shown to customers, downloadable templates, CSV/Excel headers, and example rows.
- Do not create labels that contain customer names, private warehouse names, carrier account identifiers, or production incident details.

## Examples

| Issue | Labels |
| --- | --- |
| Document how to reset safe local demo data | `documentation`, `developer-experience`, `good first issue` |
| Add acceptance criteria for mock carrier adapter behavior | `documentation`, `logistics`, `help wanted` |
| Fix staff-only API route that accepts a customer session | `bug`, `backend`, `auth`, `security-sensitive` |
| Review CSV template headers for Chinese-mode exports | `documentation`, `internationalization`, `good first issue` |
| Map localization readiness for `/outbound` customer copy and exports | `documentation`, `localization`, `good first issue` |
| Add Playwright smoke coverage for inbound receiving | `test`, `warehouse`, `inventory` |

## Related Docs

- `SECURITY.md`: vulnerability reporting and public data policy.
- `docs/GOOD_FIRST_ISSUE_DRAFTS.md`: copy-ready starter issue drafts.
- `docs/TRANSLATION_CONTRIBUTION_GUIDE.md`: translation and localization contribution rules.
- `docs/INITIAL_ISSUES.md`: first public backlog candidates.
- `docs/CONTRIBUTOR_QUICK_PATH.md`: short contributor onboarding path.
- `docs/MAINTENANCE_PLAN.md`: maintenance cadence, review policy, and quality gates.
