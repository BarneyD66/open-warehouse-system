# Support

Open Warehouse System is an early `0.x` open-source WMS starter. Support is community-oriented and best-effort.

Use this guide to choose the right channel and avoid posting private warehouse, customer, carrier, billing, or security-sensitive data in public.

## Before Asking

Please check the relevant docs first:

- `README.en.md` for project overview and quick start.
- `docs/CONTRIBUTOR_ONBOARDING.md` for first-run guidance.
- `docs/DOCKER_COMPOSE_RUNBOOK.md` for local PostgreSQL startup and troubleshooting.
- `docs/LOCAL_POSTGRESQL.md` for database setup.
- `docs/SMOKE_TEST_PLAN.md` for verification paths.
- `docs/ISSUE_TRIAGE_LABELS.md` for issue labels and triage expectations.

## Questions

For setup, usage, documentation, or workflow questions, open a GitHub issue with:

- What you are trying to do.
- Your local mode: local fallback or PostgreSQL.
- The relevant route, command, or document.
- Expected behavior.
- Actual behavior.
- Safe fake examples only.

Do not include `.env.local`, production URLs, database credentials, customer files, payment proofs, carrier credentials, logs, or private screenshots.

## Bugs

For bugs, use the bug report issue template and include:

- Reproduction steps.
- Affected route or command.
- Local data mode.
- Browser and OS when relevant.
- Verification already attempted.
- Safe fake data that maintainers can reproduce.

If the bug touches auth, customer data isolation, file downloads, billing, inventory, returns, logistics, or carrier workflows, include that risk in the issue summary.

## Feature Requests

For feature requests, describe the warehouse workflow rather than only the UI or implementation idea.

Useful context:

- User role: customer, ops, warehouse staff, maintainer, or integrator.
- Workflow: inbound, SKU, inventory, outbound, returns, billing, tracking, reporting, or setup.
- Region assumptions: language, carrier, tax, customs, address, privacy, or billing requirements.
- Acceptance criteria.
- Whether the work is suitable for a `good first issue`.

## Security Reports

Do not open a public issue with exploit details, customer data, secrets, production logs, database URLs, carrier credentials, payment proofs, private pricing sheets, or private documents.

Use `SECURITY.md` for vulnerability reporting guidance.

If private vulnerability reporting is not available, open a minimal public issue asking for a maintainer security contact without disclosing sensitive details.

## Data Safety

All public issues, pull requests, screenshots, release notes, and examples must use fake demo data.

Do not post:

- Real customer names, addresses, phones, or emails.
- Warehouse addresses or inventory documents.
- Production order IDs, labels, tracking payloads, or carrier account data.
- Payment proofs, invoices, private pricing sheets, or bank information.
- `.env.local`, production environment variables, database dumps, logs, uploads, or `.local-data`.

## Maintainer Response Expectations

Maintainers prioritize:

- Security and customer data isolation issues.
- Reproducible setup failures.
- Bugs in customer, ops, warehouse, billing, returns, inventory, and logistics workflows.
- Documentation that improves onboarding and safe local development.
- Small contributor-friendly improvements with clear verification steps.

Response time is not guaranteed. Small, reproducible issues with fake data and clear verification notes are more likely to be handled quickly.

## Related Docs

- `SECURITY.md`
- `CONTRIBUTING.md`
- `docs/CONTRIBUTOR_QUICK_PATH.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `docs/SMOKE_TEST_PLAN.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
